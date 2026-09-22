-- ════════════════════════════════════════════════════════════════════
-- Tanda 335 — el nombre en español, en su propia columna
-- ════════════════════════════════════════════════════════════════════
--
-- Al engordar en español (tanda 330) el nombre traducido se escribía
-- ENCIMA de `tcg_cards.name`. Y ese nombre no es solo una etiqueta: es
-- la CLAVE con la que se cruzan tres cosas que vienen en inglés.
--
--   · `tcg_card_play` se agrupa por nombre, y se construye con el texto
--     de las decklists — que TCG Live exporta en inglés. Con el
--     catálogo en español, la ficha preguntaba por «órdenes del jefe» y
--     el agregado tenía «boss s orders»: el bloque «En los torneos de
--     PokeDoc» no podía casar NUNCA, y desaparecía sin dar error.
--   · El camino de respaldo del resolutor de decklists busca por nombre,
--     también en inglés.
--   · La huella que decide si dos impresiones son la misma carta.
--
-- Es la misma lección que los enums traducidos de la tanda 334, y no la
-- apliqué al nombre porque no lo vi: **lo que se GUARDA como clave es
-- canónico; lo que se ENSEÑA va traducido.**
--
-- Ejecutar en el SQL Editor de Supabase.

begin;

-- El nombre en español. Null = todavía no se ha engordado en español, o
-- esa carta no está traducida (las anteriores a 2011).
alter table public.tcg_cards
  add column if not exists name_es text;

-- ── El buscador tiene que encontrar por los DOS ──
--
-- `name_search` era una columna generada a partir de `name` y sirve al
-- buscador de /cartas, al del editor de guías y al respaldo del
-- resolutor. Si solo mira el inglés, nadie encuentra «Órdenes del jefe»
-- escribiéndolo; si solo mirara el español, se rompen las decklists.
-- Mira los dos.
--
-- Hay que tirar el índice y la columna para redefinirla: una columna
-- generada no se puede alterar en su sitio.
drop index if exists public.tcg_cards_name_search_trgm_idx;
alter table public.tcg_cards drop column if exists name_search;

alter table public.tcg_cards
  add column name_search text
  generated always as (
    immutable_unaccent(lower(coalesce(name, '') || ' ' || coalesce(name_es, '')))
  ) stored;

create index if not exists tcg_cards_name_search_trgm_idx
  on public.tcg_cards using gin (name_search gin_trgm_ops);

-- ── Y la clave de cruce, que es OTRA cosa ──
--
-- `name_search` servía para dos trabajos que hasta ahora se parecían:
-- buscar a trozos (`like '%…%'`) y cruzar EXACTO contra el `name_key` de
-- `tcg_card_play`. Al meterle el español dejan de parecerse: el valor
-- pasa a ser «boss s orders órdenes del jefe» y un `in.(…)` con la clave
-- inglesa no casa con NADA. El sitemap, que es el único que cruza
-- exacto, se habría quedado sin las fichas traducidas sin dar error.
--
-- Así que el cruce se lleva su propia columna, que es literalmente lo
-- que `name_search` era antes de esta migración.
alter table public.tcg_cards drop column if exists name_key;

alter table public.tcg_cards
  add column name_key text
  generated always as (immutable_unaccent(lower(coalesce(name, '')))) stored;

create index if not exists tcg_cards_name_key_idx
  on public.tcg_cards (name_key);

-- ── Y lo que ya se guardó con el nombre pisado ──
--
-- Las cartas engordadas en español entre la 330 y esto tienen el nombre
-- TRADUCIDO en `name`. Son dos arreglos distintos:
--
--   1. El español ya lo tenemos: está en `name`, así que se copia a su
--      columna y ese lado queda hecho aquí mismo.
--   2. El inglés se ha perdido y no se puede recuperar con SQL: hay que
--      volver a pedírselo a TCGdex. Lo hace una fase nueva de la tarea
--      programada, que va por SETS (el listado de un set trae el nombre
--      de todas sus cartas, así que son ~220 peticiones y no 2.811).
--
-- `detalle_lang` se deja como está: es lo que marca cuáles llevan el
-- nombre traducido, y ponerlo a null aquí sería borrar el único rastro.
update public.tcg_cards
set name_es = name
where market = 'WEST' and detalle_lang = 'es' and name_es is null;

-- Por dónde va la reparación de los nombres ingleses. Null = pendiente.
alter table public.tcg_sets
  add column if not exists names_fixed_at timestamptz;

-- Y los sets que NO hay que repasar se marcan ya: si ninguna de sus
-- cartas se engordó en español, su `name` está intacto. Así la tarea
-- solo visita los que de verdad tienen algo que arreglar en vez de los
-- 220.
update public.tcg_sets s
set names_fixed_at = now()
where s.market = 'WEST'
  and not exists (
    select 1 from public.tcg_cards c
    where c.set_id = s.id and c.market = s.market and c.detalle_lang = 'es'
  );

commit;

-- ── Para mirar cómo va ──
--
-- select count(*) filter (where name_es is not null) as con_nombre_es,
--        count(*) filter (where detalle_lang = 'es') as en_espanol,
--        count(*) as total
-- from public.tcg_cards where market = 'WEST';
--
-- Y por dónde va la reparación de los nombres ingleses:
--
-- select count(*) filter (where names_fixed_at is null) as sets_pendientes,
--        count(*) as sets
-- from public.tcg_sets where market = 'WEST';
