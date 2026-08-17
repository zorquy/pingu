-- ============================================================
-- ¿Cuántas cartas faltan de verdad? (solo lectura)
-- ============================================================
--
-- Este fichero NO CAMBIA NADA: son SELECT. Se pega entero en el SQL
-- Editor de Supabase y se lee de arriba abajo.
--
-- Existe porque "faltan cartas japonesas y chinas" puede querer decir
-- tres cosas muy distintas, y hasta saber cuál es no se puede decidir
-- nada:
--
--   a) No se han importado (la migración de mercados sin ejecutar, o el
--      import cortado a medias). No falta nada en TCGdex: falta traerlo.
--   b) Se importaron, pero el set se quedó corto: TCGdex declara 200
--      cartas y guardamos 130.
--   c) Están todas, pero sin escaneo: la carta existe y la imagen no.
--
-- Solo (b) y (c) son motivo para plantearse cambiar de API. (a) es
-- nuestro. Las consultas de abajo dicen cuál es cuál.
-- ============================================================

-- ── 0. Lo primero: ¿está aplicada la migración de mercados? ──
--
-- Si sale NO, todo lo de abajo que mencione el mercado va a dar error, y
-- la respuesta a "faltan las japonesas" es simplemente que todavía no
-- hay dónde ponerlas.
select
  case when exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'tcg_cards' and column_name = 'market'
  ) then 'SÍ — hay mercados, sigue leyendo'
       else 'NO — falta ejecutar supabase-migration-cartas-mercado.sql; para aquí'
  end as "¿migración de mercados aplicada?",
  (select count(*) from public.tcg_cards) as "cartas en total",
  (select count(*) from public.tcg_sets)  as "sets en total";


-- ── 1. Resumen por mercado ──
--
-- "declaradas" es lo que dice TCGdex que tiene el set (card_count_total,
-- guardado al traer la lista). "guardadas" es lo que hay en nuestra base.
-- La diferencia entre las dos es el hueco real.
select
  s.market                                              as "mercado",
  count(*)                                              as "sets",
  count(*) filter (where s.imported_at is not null)      as "sets importados",
  coalesce(sum(s.card_count_total), 0)                   as "cartas declaradas",
  coalesce(sum(c.guardadas), 0)                          as "cartas guardadas",
  coalesce(sum(s.card_count_total), 0) - coalesce(sum(c.guardadas), 0) as "hueco",
  coalesce(sum(c.sin_imagen), 0)                         as "sin escaneo"
from public.tcg_sets s
left join (
  select set_id, market, count(*) as guardadas,
         count(*) filter (where image_path is null) as sin_imagen
  from public.tcg_cards
  group by set_id, market
) c on c.set_id = s.id and c.market = s.market
group by s.market
order by "hueco" desc;


-- ── 2. Sets que nunca se han importado ──
--
-- Estos no son un problema de TCGdex: es darle al botón. Si salen
-- muchos, el import se cortó (o se canceló) por el camino.
select s.market as "mercado", s.id, s.name, s.card_count_total as "declaradas"
from public.tcg_sets s
where s.imported_at is null
order by s.market, s.card_count_total desc nulls last
limit 40;


-- ── 3. Los sets que se quedaron cortos ──
--
-- AQUÍ está la respuesta a "faltan cartas". Un set importado en el que
-- guardamos menos de lo que TCGdex declara. Ojo: una diferencia de una o
-- dos cartas es normal (TCGdex cuenta alguna promo que no publica), pero
-- un set con la mitad es un fallo que hay que mirar.
select
  s.market as "mercado", s.id, s.name,
  s.card_count_total as "declaradas",
  coalesce(c.guardadas, 0) as "guardadas",
  s.card_count_total - coalesce(c.guardadas, 0) as "faltan",
  round(100.0 * coalesce(c.guardadas, 0) / nullif(s.card_count_total, 0), 1) as "% cubierto",
  s.imported_at as "importado"
from public.tcg_sets s
left join (
  select set_id, market, count(*) as guardadas
  from public.tcg_cards group by set_id, market
) c on c.set_id = s.id and c.market = s.market
where s.imported_at is not null
  and s.card_count_total is not null
  and coalesce(c.guardadas, 0) < s.card_count_total
order by "faltan" desc
limit 40;


-- ── 4. Cartas sin escaneo, por mercado ──
--
-- Esto es lo que se ve en la web como el recuadro "sin imagen". Si el
-- porcentaje es alto en japonés o chino, es un problema DE LOS DATOS de
-- TCGdex y no se arregla importando otra vez.
select
  market as "mercado",
  count(*) as "cartas",
  count(*) filter (where image_path is null) as "sin escaneo",
  round(100.0 * count(*) filter (where image_path is null) / count(*), 1) as "% sin escaneo"
from public.tcg_cards
group by market
order by "% sin escaneo" desc;


-- ── 5. Los sets con más cartas sin escaneo ──
--
-- Para poder mirar dos o tres a mano en tcgdex.net y ver si es que no
-- existe el escaneo o es que lo estamos guardando mal.
select
  c.market as "mercado", c.set_id, s.name,
  count(*) as "cartas",
  count(*) filter (where c.image_path is null) as "sin escaneo"
from public.tcg_cards c
join public.tcg_sets s on s.id = c.set_id and s.market = c.market
group by c.market, c.set_id, s.name
having count(*) filter (where c.image_path is null) > 0
order by "sin escaneo" desc
limit 25;


-- ── 6. Las cartas que usan las guías, ¿están todas? ──
--
-- Lo único que de verdad importa para la web: si una guía referencia una
-- carta que no está en el catálogo, sale el aviso de "ya no están en el
-- catálogo". Esta consulta saca esas referencias huérfanas.
--
-- Las referencias van en data-cards="sv1-25,CS1a-1@TW" dentro del HTML
-- de los bloques de referencia, así que hay que sacarlas del texto.
with refs as (
  select distinct trim(unnest(string_to_array(m[1], ','))) as ref
  from public.guides g,
       regexp_matches(coalesce(g.reference_blocks::text, ''), 'data-cards=\\"([^\\"]*)\\"', 'g') as m
),
partidas as (
  select ref,
         split_part(ref, '@', 1) as id,
         case when position('@' in ref) > 0 then split_part(ref, '@', 2) else 'WEST' end as market
  from refs where ref <> ''
)
select p.ref as "referencia en una guía", p.id, p.market as "mercado"
from partidas p
left join public.tcg_cards c on c.id = p.id and c.market = p.market
where c.id is null
order by p.ref
limit 50;
