-- ═══════════════════════════════════════════════════════════════════
-- LAS ENERGÍAS ESPECIALES, BIEN TRADUCIDAS (tanda 629)
--
-- PINGU: «hay problemas de traducción con la energía telepática, repasa
-- las energías especiales y pon todas las cartas en el mismo idioma bien
-- traducidas».
--
-- TCGdex nombra en español las energías especiales de Megaevolución (y
-- las de Espada y Escudo) con el TIPO SIN TRADUCIR: «Energía Psychic
-- Telepática», «Energía Water Burbujeante», «Energía Metal Magnética». La
-- carta impresa y TCG Live dicen «Energía Psíquica Telepática», así que:
--   · el registro de una partida no casaba con la lista del jugador
--     («4 cartas de la partida no están en esta lista… Energía Psíquica
--     Telepática»),
--   · el buscador no la encontraba escribiendo «psíquica»,
--   · y la ficha y el mazo salían a medio traducir.
--
-- Esto corrige lo que YA está guardado (en `name_es`, y en `name` donde el
-- espejo guardó el español —ver js/constructor/nombres.js—). Lo que llegue
-- a partir de ahora ya entra corregido: `corregirNombreEs` (js/texto.js)
-- se aplica al leer el nombre de TCGdex y al enseñarlo.
--
-- Detrás de «Energía» el tipo va como en las básicas (femenino: Psíquica,
-- Oscura, Metálica, Incolora); en los Amuletos Hada, como sustantivo.
--
-- Y el NOMBRE INGLÉS de las de Megaevolución: tres vacíos (Perfect Order)
-- y cinco con el tipo como símbolo («Bubbly \[W\] Energy»), que no casan
-- con nada que se busque en inglés.
--
-- `name_search` y `name_key` son columnas GENERADAS: se ponen al día solas.
-- Es re-ejecutable: la segunda vez no encuentra nada que cambiar.
-- ═══════════════════════════════════════════════════════════════════

-- Sin tabla temporal y sin `begin`/`commit` (corregido el 2026-10-06): el
-- SQL Editor de Supabase no conserva la tabla temporal de una sentencia a
-- la siguiente, y la primera versión falló con «relation "tipos_629" does
-- not exist» sin cambiar nada. Cada sentencia lleva su propia lista de
-- tipos y se basta sola; como todas son re-ejecutables, no hace falta que
-- vayan juntas en una transacción.

-- ── 1. «Energía <tipo en inglés> …» → «Energía <tipo en español> …» ──
update public.tcg_cards c
   set name_es = regexp_replace(c.name_es, '^Energía ' || t.en || '( |$)', 'Energía ' || t.energia || '\1')
  from (values ('Grass', 'Planta'), ('Fire', 'Fuego'), ('Water', 'Agua'), ('Lightning', 'Rayo'),
               ('Psychic', 'Psíquica'), ('Fighting', 'Lucha'), ('Darkness', 'Oscura'), ('Metal', 'Metálica'),
               ('Fairy', 'Hada'), ('Dragon', 'Dragón'), ('Colorless', 'Incolora')) as t(en, energia)
 where c.name_es ~ ('^Energía ' || t.en || '( |$)');

update public.tcg_cards c
   set name = regexp_replace(c.name, '^Energía ' || t.en || '( |$)', 'Energía ' || t.energia || '\1')
  from (values ('Grass', 'Planta'), ('Fire', 'Fuego'), ('Water', 'Agua'), ('Lightning', 'Rayo'),
               ('Psychic', 'Psíquica'), ('Fighting', 'Lucha'), ('Darkness', 'Oscura'), ('Metal', 'Metálica'),
               ('Fairy', 'Hada'), ('Dragon', 'Dragón'), ('Colorless', 'Incolora')) as t(en, energia)
 where c.name ~ ('^Energía ' || t.en || '( |$)');

-- ── 2. Los Amuletos Hada (Sol y Luna), con el tipo como sustantivo ──
update public.tcg_cards c
   set name_es = 'Amuleto Hada ' || t.sustantivo
  from (values ('Grass', 'Planta'), ('Fire', 'Fuego'), ('Water', 'Agua'), ('Lightning', 'Rayo'),
               ('Psychic', 'Psíquico'), ('Fighting', 'Lucha'), ('Darkness', 'Oscuro'), ('Metal', 'Metal'),
               ('Fairy', 'Hada'), ('Dragon', 'Dragón'), ('Colorless', 'Incoloro')) as t(en, sustantivo)
 where c.name_es = 'Amuleto Hada ' || t.en;

-- ── 3. El nombre inglés con el tipo como símbolo: «[W]» o «\[W\]» ──
update public.tcg_cards c
   set name_en = regexp_replace(c.name_en, '\\?\[' || t.letra || '\\?\]', t.en, 'g')
  from (values ('Grass', 'G'), ('Fire', 'R'), ('Water', 'W'), ('Lightning', 'L'), ('Psychic', 'P'),
               ('Fighting', 'F'), ('Darkness', 'D'), ('Metal', 'M'), ('Fairy', 'Y'), ('Dragon', 'N'),
               ('Colorless', 'C')) as t(en, letra)
 where c.name_en ~ ('\\?\[' || t.letra || '\\?\]');

-- ── 4. Los tres de Perfect Order (me03) que no tenían nombre inglés ──
update public.tcg_cards set name_en = 'Growing Grass Energy'
 where set_id = 'me03' and local_id in ('086', '86') and name_en is null and coalesce(name_es, name) ~ '^Energía Planta Creciente$';
update public.tcg_cards set name_en = 'Rocky Fighting Energy'
 where set_id = 'me03' and local_id in ('087', '87') and name_en is null and coalesce(name_es, name) ~ '^Energía Lucha Rocosa$';
update public.tcg_cards set name_en = 'Telepathic Psychic Energy'
 where set_id = 'me03' and local_id in ('088', '88') and name_en is null and coalesce(name_es, name) ~ '^Energía Psíquica Telepática$';

-- ── Comprobación ───────────────────────────────────────────────────
-- Tiene que devolver CERO filas: ningún nombre español con el tipo en
-- inglés, y ningún nombre inglés con el tipo como símbolo.
select id, market, name, name_es, name_en
  from public.tcg_cards
 where name_es ~ '^(Energía|Amuleto Hada) (Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy|Dragon|Colorless)( |$)'
    or name ~ '^Energía (Grass|Fire|Water|Lightning|Psychic|Fighting|Darkness|Metal|Fairy|Dragon|Colorless)( |$)'
    or name_en ~ '\[[A-Z]\]';

-- Y la telepática, ya bien: «Energía Psíquica Telepática» / «Telepathic
-- Psychic Energy».
select id, name, name_es, name_en from public.tcg_cards where set_id = 'me03' and local_id in ('088', '88');
