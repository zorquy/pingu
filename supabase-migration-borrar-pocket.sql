-- ════════════════════════════════════════════════════════════════════
-- Tanda 328 — fuera Pokémon TCG Pocket del catálogo
-- ════════════════════════════════════════════════════════════════════
--
-- Pocket es OTRO JUEGO. Sus cartas no se juegan en el TCG de mesa, no
-- entran en ninguna decklist y lo único que hacen aquí es ensuciar: el
-- índice, el buscador, «otras versiones» y —lo peor— el resolutor de
-- decklists, que puede coger una gemela de Pocket para una carta de
-- verdad.
--
-- El filtro al leer ya está puesto en el código, pero filtrar no es
-- borrar: mientras las filas estén, siguen pesando, siguen saliendo en
-- cualquier consulta nueva que se olvide del filtro, y siguen contando
-- en los números del panel.
--
-- ── EJECUTAR EN DOS PASOS, NO DE UNA ──
--
-- El paso 1 NO borra nada: enseña lo que se iría. Míralo, y solo si
-- cuadra, ejecuta el paso 2. Un DELETE sobre 23.000 cartas no se
-- deshace.

-- ════════════════════════════════════════════════════════════════════
-- PASO 1 — MIRAR (no toca nada)
-- ════════════════════════════════════════════════════════════════════
--
-- Los sets que se irían, con cuántas cartas se lleva cada uno.
--
-- Se identifican por DOS caminos, porque uno solo no basta:
--   · `serie_id = 'tcgp'`, que es como los marca TCGdex; y
--   · el identificador, que en Pocket es A1, A1a, A2b, B1, A3B…
--     (una letra y un número, y a veces otra letra). Hace falta porque
--     los que se importaron antes de que existiera el filtro pueden
--     haber entrado con la serie vacía.
--
-- Si en la lista aparece algún set que SÍ es del TCG de mesa, para y
-- dímelo antes de ejecutar el paso 2.

select
  s.id,
  s.name,
  s.serie_id,
  s.release_date,
  count(c.id) as cartas,
  case when s.serie_id = 'tcgp' then 'serie' else 'identificador' end as por_que
from public.tcg_sets s
left join public.tcg_cards c on c.set_id = s.id and c.market = s.market
where s.serie_id = 'tcgp'
   or s.id ~ '^[AB][0-9]+[a-zA-Z]?$'
group by s.id, s.name, s.serie_id, s.release_date
order by s.release_date desc nulls last;

-- ════════════════════════════════════════════════════════════════════
-- PASO 2 — BORRAR (esto sí toca)
-- ════════════════════════════════════════════════════════════════════
--
-- Descomenta el bloque entero y ejecútalo SOLO después de mirar el paso 1.
--
-- `tcg_cards` tiene `on delete cascade` contra `tcg_sets`, así que
-- borrar el set se lleva sus cartas. Se borran igualmente a mano
-- primero, para que el número que devuelve Postgres diga cuántas cartas
-- se han ido de verdad — con el cascade no lo dice, y aquí interesa
-- saberlo.
--
-- begin;
--
-- delete from public.tcg_cards
-- where set_id in (
--   select id from public.tcg_sets
--   where serie_id = 'tcgp' or id ~ '^[AB][0-9]+[a-zA-Z]?$'
-- );
--
-- delete from public.tcg_sets
-- where serie_id = 'tcgp' or id ~ '^[AB][0-9]+[a-zA-Z]?$';
--
-- -- Y lo que hubiera quedado en el agregado de juego: se recalcula
-- -- entero cada media hora, pero no hay que esperar media hora para
-- -- que deje de haber cartas de Pocket en una ficha.
-- delete from public.tcg_card_play
-- where name_key not in (select distinct immutable_unaccent(lower(name)) from public.tcg_cards);
--
-- commit;

-- ════════════════════════════════════════════════════════════════════
-- Y DESPUÉS: mirar qué queda
-- ════════════════════════════════════════════════════════════════════
--
-- Para el otro asunto —los sets japoneses en el catálogo occidental—,
-- esta consulta dice qué series hay y de qué tamaño. Con eso se decide
-- cuáles se listan y cuáles se quedan solo para consultar.

-- select coalesce(serie_id, '(sin serie)') as serie,
--        coalesce(serie_name, '(sin nombre)') as nombre,
--        count(*) as sets,
--        min(release_date) as desde,
--        max(release_date) as hasta,
--        count(*) filter (where tcg_online_code is not null) as con_codigo_live
-- from public.tcg_sets
-- where market = 'WEST'
-- group by 1, 2
-- order by hasta desc nulls last;
