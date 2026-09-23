-- ════════════════════════════════════════════════════════════════════
-- Tanda 339 — la marca de regulación es del SET, no de la carta
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU, sobre el Mew ex de 30th Celebration: «sí que lleva marca de
-- regulación, llevan la marca J… no podemos dejar la marca vacía, y por
-- fecha ya deberías saber qué marca lleva».
--
-- Las dos cosas son ciertas. El catálogo de TCGdex no trae
-- `regulationMark` para las cartas del set `30th` —se comprobó mirando
-- las filas ya engordadas: `detalle_at` puesto, `detalle_lang` = es, sin
-- error, y la columna a null—, y `detalleDeCarta` solo escribe la marca
-- SI VIENE, a propósito: ponerla a null cuando falta borraría las 8.288
-- que sembró la tanda 215.
--
-- Así que la columna se queda vacía y la ficha dice «No es legal en
-- Estándar» de una carta que sí lo es. Eso es peor que no decir nada.
--
-- ── Lo que hace que esto se pueda arreglar sin inventar ──
--
-- **Todas las cartas de un set llevan la misma marca.** Es una
-- propiedad del set, no de cada carta. De ahí las dos fases de abajo:
-- la primera no adivina NADA —le pregunta a las propias cartas del
-- set— y solo la segunda deduce, y deduce de datos nuestros y no de una
-- lista escrita a mano, que es lo que se queda viejo (la 323).
--
-- Y queda apuntado DE DÓNDE sale cada una (`regulation_mark_origen`),
-- que es lo que permite revisar solo las deducidas en vez de las 220.
--
-- Ejecutar en el SQL Editor de Supabase.

begin;

alter table public.tcg_sets
  add column if not exists regulation_mark text,
  add column if not exists regulation_mark_origen text;

comment on column public.tcg_sets.regulation_mark is
  'La letra de regulación de TODAS las cartas de este set. Es propiedad '
  'del set: TCGdex no la trae para algunos, y sin ella la ficha de una '
  'carta dice que no es legal cuando sí lo es.';
comment on column public.tcg_sets.regulation_mark_origen is
  'cartas = salió de las propias cartas del set (segura). '
  'fecha = deducida del set anterior más cercano (revisable). '
  'mano = la puso un humano en /admin (manda sobre las otras dos).';

-- ── Fase 1: preguntarle a las cartas del propio set ──
--
-- Aquí no se adivina nada: si 200 de las cartas de un set llevan la G,
-- el set es G. Se coge la más repetida y no «la primera» porque una
-- fila suelta mal importada no puede decidir por el set entero.
with por_set as (
  select set_id, market, regulation_mark as marca,
         row_number() over (
           partition by set_id, market order by count(*) desc, regulation_mark
         ) as puesto
  from public.tcg_cards
  where regulation_mark is not null
  group by set_id, market, regulation_mark
)
update public.tcg_sets s
set regulation_mark = p.marca,
    regulation_mark_origen = 'cartas'
from por_set p
where p.set_id = s.id and p.market = s.market and p.puesto = 1
  and s.regulation_mark_origen is distinct from 'mano';

-- ── Fase 2: los que no tienen NINGUNA carta con marca ──
--
-- Se hereda la del set anterior más cercano por fecha del mismo
-- mercado. Y con un suelo que también sale de los datos y no de una
-- fecha escrita a mano: **el set más antiguo que tiene marca**. Antes de
-- eso las marcas no existían, y ahí el null no es un hueco: es la
-- verdad, y esas cartas no son legales en Estándar.
with inicio as (
  select min(release_date) as desde
  from public.tcg_sets
  where regulation_mark is not null and release_date is not null
)
update public.tcg_sets s
set regulation_mark = (
      select anterior.regulation_mark
      from public.tcg_sets anterior
      where anterior.regulation_mark is not null
        and anterior.market = s.market
        and anterior.release_date is not null
        and anterior.release_date <= s.release_date
      order by anterior.release_date desc
      limit 1
    ),
    regulation_mark_origen = 'fecha'
where s.regulation_mark is null
  and s.release_date is not null
  and s.release_date >= (select desde from inicio);

-- ── Fase 3: lo que PINGU ya ha comprobado a mano ──
--
-- 30th Celebration lleva la J. Lo dice quien tiene la carta delante, y
-- eso manda sobre cualquier deducción — la fase 2 habría cogido la del
-- set anterior, que no tiene por qué ser la misma si la rotación cae
-- justo ahí. Va como 'mano' para que ninguna pasada futura la pise.
update public.tcg_sets
set regulation_mark = 'J', regulation_mark_origen = 'mano'
where id = '30th' and market = 'WEST';

-- ── Y ahora sí, a las cartas ──
--
-- Se escribe SOLO donde está vacía: lo que TCGdex haya dicho de una
-- carta concreta no se toca nunca. Y si mañana TCGdex empieza a traer la
-- marca de ese set, el engorde la sobrescribe sola con la de verdad.
update public.tcg_cards c
set regulation_mark = s.regulation_mark
from public.tcg_sets s
where s.id = c.set_id and s.market = c.market
  and s.regulation_mark is not null
  and c.regulation_mark is null;

commit;

-- ── Para revisar ──
--
-- Los que hay que mirar son los DEDUCIDOS, que son un puñado, no los 220:
--
-- select id, name, release_date, regulation_mark
-- from public.tcg_sets
-- where market = 'WEST' and regulation_mark_origen = 'fecha'
-- order by release_date desc;
--
-- Y los que se quedan sin marca (anteriores a que existieran, donde el
-- null es la verdad):
--
-- select count(*) from public.tcg_sets
-- where market = 'WEST' and regulation_mark is null;
