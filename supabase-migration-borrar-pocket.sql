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
-- El paso 1 ya lo ejecutó PINGU el 2026-09-22 y salieron CATORCE sets,
-- todos de Pocket y todos con `serie_id` a NULL:
--
--   B2a Paldean Wonders 131 · B2  Fantastical Parade 234
--   B1a Crimson Blaze   103 · B1  Mega Rising        331
--   A4a Secluded Springs 105 · A4  Wisdom of Sea and Sky 241
--   A3b Eevee Grove     107 · A3a Extradimensional Crisis 103
--   A3  Celestial Guardians 239 · A2b Shining Revelry 111
--   A2a Triumphant Light  96 · A2  Space-Time Smackdown 207
--   A1a Mythical Island   86 · A1  Genetic Apex       286
--
--   → 14 sets y 2.380 cartas, un 10% del catálogo.
--
-- Y el dato que importa: **la serie está vacía en los catorce**, así que
-- identificarlos por `serie_id = 'tcgp'` no echaba a ninguno. Los
-- reconoce el IDENTIFICADOR: Pocket numera con UNA letra y un número
-- (A1, A1a, A2b, B1, B2a…) y los sets del TCG de mesa llevan siempre dos
-- letras o más antes del número (`base1`, `swsh3`, `sv5`, `xy7`,
-- `hgss2`, `col1`), así que no se pisan.

begin;

-- Las cartas primero, a mano y no por el `on delete cascade`, para que
-- Postgres devuelva CUÁNTAS se han ido de verdad. Con el cascade no lo
-- dice, y aquí interesa poder comparar el número con las 2.380 de
-- arriba: si no cuadra, algo ha cambiado desde el paso 1.
delete from public.tcg_cards
where set_id in (
  select id from public.tcg_sets
  where serie_id = 'tcgp' or id ~ '^[AB][0-9]+[a-zA-Z]?$'
);

delete from public.tcg_sets
where serie_id = 'tcgp' or id ~ '^[AB][0-9]+[a-zA-Z]?$';

commit;

-- ── `tcg_card_play` NO se toca a propósito ──
--
-- La tarea programada la rehace ENTERA cada media hora (escribe lo nuevo
-- y borra lo que no lleva la marca de esa pasada), así que se cura sola.
-- Borrar aquí obligaría a casar `name_key` —que lo calcula JavaScript—
-- con el `unaccent` de Postgres, y esos dos no tienen por qué decir lo
-- mismo al carácter: un desajuste se llevaría por delante filas buenas.
-- Media hora de espera es mucho más barato que eso.

-- ════════════════════════════════════════════════════════════════════
-- DESPUÉS: qué queda, para decidir lo de los sets japoneses
-- ════════════════════════════════════════════════════════════════════
--
-- Esta no borra nada. Dice qué series hay, de qué tamaño y cuáles
-- tienen código de TCG Live —que es el que solo llevan los sets
-- occidentales—. Con eso decidimos con datos cuáles se listan.

select coalesce(serie_id, '(sin serie)') as serie,
       coalesce(serie_name, '(sin nombre)') as nombre,
       count(*) as sets,
       min(release_date) as desde,
       max(release_date) as hasta,
       count(*) filter (where tcg_online_code is not null) as con_codigo_live
from public.tcg_sets
where market = 'WEST'
group by 1, 2
order by hasta desc nulls last;
