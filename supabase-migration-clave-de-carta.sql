-- ════════════════════════════════════════════════════════════════════
-- Tanda 349 — el guion de las megas
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU: «Mew ex sí sale en qué mazos se ha jugado, pero Mega Darkrai
-- no, y también se ha usado una vez».
--
-- No era el umbral (desde la 338 con UN mazo ya se enseña). Era la
-- CLAVE. TCGdex llama a las megas «Mega-Darkrai ex», con GUION; TCG Live
-- las escribe «Mega Darkrai ex», con espacio. Normalizados son dos
-- claves distintas, así que la fila de `tcg_card_play` existía y la
-- ficha preguntaba por otra cosa. Sin dar error, y para la era entera.
--
-- En el código la clave pasa a juntar los separadores (`claveDeCarta`,
-- en js/normalizar.js), y las dos mitades —la ficha que pregunta y la
-- tarea que rellena la tabla— usan esa misma función.
--
-- ── Y por qué esto además toca la base ──
--
-- `tcg_cards.name_key` es una columna GENERADA, y el sitemap la usa de
-- prefiltro para cruzar contra `tcg_card_play`. Si el JavaScript junta
-- los separadores y Postgres no, el prefiltro deja fuera justo a las
-- cartas con guion: no es un error visible, es que esas fichas dejan de
-- ofrecerse a Google.
--
-- Así que la columna se redefine con la MISMA regla: sin tildes, en
-- minúsculas, los separadores a espacio y los espacios juntados.
--
-- Ejecutar en el SQL Editor de Supabase. Re-ejecutable.

alter table public.tcg_cards drop column if exists name_key;

alter table public.tcg_cards
  add column name_key text
  generated always as (
    btrim(regexp_replace(
      immutable_unaccent(lower(coalesce(name, ''))),
      '[-–—_[:space:]]+', ' ', 'g'
    ))
  ) stored;

create index if not exists tcg_cards_name_key_idx
  on public.tcg_cards (name_key);

-- ── Comprobación ──
--
-- Las megas, que son las que lo destaparon: su clave ya no lleva guion.
--
-- select name, name_key from public.tcg_cards
-- where market = 'WEST' and name like 'Mega-%' limit 10;
