-- ============================================================
-- Espejo del catálogo de cartas de TCGdex.
--
-- Los datos vienen de https://api.tcgdex.net (gratis, sin clave,
-- comunitario). NO se consultan en vivo cada vez: se copian aquí.
--
-- Por qué copiarlos en vez de llamar a la API cada vez:
--   1. Buscar y filtrar tiene que ser instantáneo, y la API devuelve
--      TODAS las coincidencias sin paginar por defecto.
--   2. Lo que viene después (álbum, mazos) necesita CRUZAR cartas con
--      datos de cada usuario. Eso no se puede hacer contra una API.
--   3. Si TCGdex se cae o cambia, la web sigue funcionando.
--
-- Son ~23.600 cartas en ~217 sets: unos 8 MB. Nada para Postgres.
--
-- LAS IMÁGENES NO SE COPIAN. Se guarda solo la ruta y se enlazan a su
-- CDN. Las cartas son propiedad de Nintendo/Creatures/GAME FREAK;
-- enlazarlas es una cosa y alojarlas es otra distinta.
--
-- Es idempotente: se puede ejecutar más de una vez.
-- ============================================================

begin;

-- ── Sets ──
create table if not exists tcg_sets (
  id text primary key,                 -- 'swsh3'
  name text not null,                  -- 'Espada y Escudo: Oscuridad Incandescente'
  serie_id text,                       -- 'swsh'
  serie_name text,
  -- Ruta del logo SIN el idioma delante: 'swsh/swsh3/logo'. El idioma se
  -- pone al pintar, para poder caer a inglés cuando no hay versión
  -- española (ver la nota de abajo).
  logo_path text,
  symbol_url text,                     -- este sí es universal, va entero
  release_date date,
  card_count_total int,
  card_count_official int,
  -- Cuándo se importó y cuántas cartas entraron. Sirve para saber en el
  -- panel qué sets faltan por traer y cuáles se han quedado a medias.
  imported_at timestamptz,
  imported_cards int not null default 0
);

-- ── Cartas ──
create table if not exists tcg_cards (
  id text primary key,                 -- 'swsh3-136'
  set_id text not null references tcg_sets (id) on delete cascade,
  local_id text not null,              -- '136' (el número impreso en la carta)
  name text not null,                  -- en español si existe; si no, en inglés
  -- Misma idea que logo_path: 'swsh/swsh3/136', sin idioma ni extensión.
  -- La URL final se monta así:
  --   https://assets.tcgdex.net/<idioma>/<image_path>/<calidad>.<formato>
  -- p.ej. https://assets.tcgdex.net/es/swsh/swsh3/136/high.webp
  image_path text,
  -- Las de abajo llegan vacías con la importación básica: el listado de
  -- un set solo trae id/localId/name/image. Se rellenarán cuando hagan
  -- falta (el álbum las necesita para filtrar por tipo o rareza; el
  -- buscador de cartas del editor, no).
  category text,                       -- Pokemon | Trainer | Energy
  rarity text,
  types text[],
  hp int,
  dex_ids int[],
  illustrator text,
  updated_at timestamptz not null default now()
);

create extension if not exists pg_trgm;
create extension if not exists unaccent;

-- unaccent() es STABLE, no IMMUTABLE (depende del diccionario que tenga
-- cargado), y Postgres no deja indexar ni generar columnas con funciones
-- que no sean IMMUTABLE. Este envoltorio fija el diccionario, con lo que
-- el resultado sí es constante para una entrada dada.
create or replace function immutable_unaccent(text)
  returns text language sql immutable strict parallel safe as
$$ select public.unaccent('public.unaccent', $1) $$;

-- 1.159 cartas llevan tilde o eñe ("Piedra Pómez", "Poké Ball del Equipo
-- Plasma"). Buscando con ILIKE a secas, quien escriba "pomez" no
-- encuentra NADA — y aquí casi nadie va a poner las tildes. Esta columna
-- guarda el nombre en minúsculas y sin tildes, y el buscador normaliza
-- lo que se teclea de la misma forma antes de consultar.
alter table tcg_cards
  add column if not exists name_search text
  generated always as (immutable_unaccent(lower(name))) stored;

-- El buscador del editor consulta mientras se escribe, así que este
-- índice es el que decide si va fluido o a tirones. `gin_trgm_ops` es lo
-- que hace rápidos los ILIKE '%algo%'.
create index if not exists tcg_cards_name_search_trgm_idx on tcg_cards using gin (name_search gin_trgm_ops);
create index if not exists tcg_cards_set_idx on tcg_cards (set_id, local_id);

-- ── Permisos ──
-- El catálogo es público: cualquiera puede leerlo, con sesión o sin
-- ella. Es un dato de dominio público, no de nadie.
alter table tcg_sets enable row level security;
alter table tcg_cards enable row level security;

drop policy if exists "tcg_sets_read" on tcg_sets;
create policy "tcg_sets_read" on tcg_sets for select using (true);

drop policy if exists "tcg_cards_read" on tcg_cards;
create policy "tcg_cards_read" on tcg_cards for select using (true);

-- Escribir, solo el equipo desde el panel. La importación corre en el
-- navegador de un admin con su propia sesión, no con una clave de
-- servicio, así que necesita política propia.
do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_admin') then
    drop policy if exists "tcg_sets_write" on tcg_sets;
    create policy "tcg_sets_write" on tcg_sets for all using (is_admin()) with check (is_admin());

    drop policy if exists "tcg_cards_write" on tcg_cards;
    create policy "tcg_cards_write" on tcg_cards for all using (is_admin()) with check (is_admin());
  else
    raise notice 'No existe is_admin(); las tablas quedan de solo lectura. Aplica antes la migración que la crea.';
  end if;
end $$;

commit;


-- ────────────────────────────────────────────────────────────
-- COMPROBACIÓN
-- ────────────────────────────────────────────────────────────

-- Recién ejecutada esto sale a cero: la importación se lanza desde
-- /admin → Cartas, no desde aquí.
select
  (select count(*) from tcg_sets) as sets,
  (select count(*) from tcg_cards) as cartas;

-- Las cuatro políticas: lectura pública y escritura de admins.
select tablename, policyname, cmd
from pg_policies
where tablename in ('tcg_sets', 'tcg_cards')
order by tablename, policyname;
