-- Diagnóstico de las imágenes que faltan (tandas 431 y 432).
--
-- ESTO NO CAMBIA NADA: son SELECT. Se pega en el SQL Editor de Supabase.
--
-- La primera tanda de consultas ya está contestada y el resultado está en
-- la bitácora. Lo que queda es UNA pregunta, y es la que decide si hay que
-- escribir código o solo ejecutar una migración que se quedó sin ejecutar.
--
-- ── EL CONTEXTO ──
--
-- El relleno de logos YA EXISTE desde la tanda 380: `curarSet` en
-- `netlify/functions/cartas-detalle.mjs` pide el set COMPLETO a TCGdex y
-- rellena logo, símbolo y las dos cuentas. Y `faltaVisitar` tiene un
-- cerrojo con dos llaves:
--
--     if ('curado_v' in fila && (fila.curado_v ?? 0) < VERSION_CURADO) return true
--     if ('curado_at' in fila) return !fila.curado_at
--
-- O sea: si la columna `curado_v` NO EXISTE, un set con `curado_at`
-- puesto no vuelve a visitarse NUNCA — y los que se curaron antes de la
-- 380, cuando el curador todavía no sabía de logos, se quedaron marcados
-- como hechos sin logo. No daría ningún error: simplemente no pasa nada.

-- ── 1. ¿Existen las dos columnas del cerrojo? ──
-- Si `curado_v` no sale aquí, ese es el fallo entero.
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'tcg_sets'
  and column_name in ('curado_at', 'curado_v')
order by column_name;

-- ── 2. En qué estado están los 41 sets sin dibujo ──
-- `curado_at` con fecha y `curado_v` nulo o 0 = marcados como hechos por
-- un curador que todavía no sabía rellenar el logo.
select
  count(*) as sets_sin_dibujo,
  count(*) filter (where curado_at is not null) as ya_visitados,
  count(*) filter (where curado_at is null) as sin_visitar
from tcg_sets
where market = 'WEST' and logo_path is null and symbol_url is null;

-- ── 3. Y los cuatro sets que parecen DUPLICADOS ──
-- `swsh9.5tg`, `swsh10.5tg`, `swsh11.5tg` y `swsh12.5tg` tienen el mismo
-- nombre que `swsh9tg`…`swsh12tg`, pero sin código, sin fecha y con sus
-- 30 cartas sin imagen. Si son copias, son 120 cartas fantasma que
-- inflan las cuentas de la colección y de la Pokédex.
select s.id, s.name, s.tcg_online_code, s.release_date,
       count(c.id) as cartas,
       count(*) filter (where c.image_path is not null) as con_imagen,
       count(distinct c.local_id) as numeros_distintos
from tcg_sets s
left join tcg_cards c on c.set_id = s.id and c.market = 'WEST'
where s.market = 'WEST' and s.id like 'swsh%tg'
group by s.id, s.name, s.tcg_online_code, s.release_date
order by s.id;

-- ── 4. ¿Alguien tiene cartas de esos cuatro? ──
-- Antes de tocar un set duplicado hay que saber si hay colecciones
-- apuntadas en él: borrarlo se las llevaría por delante.
select c.set_id, count(*) as lineas_de_coleccion, count(distinct u.user_id) as personas
from user_collection u
join tcg_cards c on c.id = u.card_id
where c.set_id in ('swsh9.5tg', 'swsh10.5tg', 'swsh11.5tg', 'swsh12.5tg')
group by c.set_id;
