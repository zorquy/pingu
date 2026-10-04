-- ════════════════════════════════════════════════════════════════════
--  Scrydex rellenando las CARTAS, y las rarezas exactas (tanda 509)
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU: «quiero que me rellenes todas las cartas posibles, todos los
-- logos posibles […] y las rarezas tienen que ser muy exactas». Y el
-- ejemplo que lo demuestra: en Lost Thunder las arcoíris están guardadas
-- como «Rara Híper» y no lo son — son **Rare Rainbow**.
--
-- El motivo es que TCGdex COLAPSA esa rareza: le llama «Hyper rare» a la
-- arcoíris y a la dorada. Scrydex las distingue, y además trae un código
-- corto por rareza. Así que el inglés canónico de Scrydex va a su propia
-- columna y `rarity` se queda como está —en español, que es lo que pintan
-- los filtros—, exactamente igual que `name` y `name_es` (tanda 335).
--
-- NO BORRA NI RENOMBRA NADA.

-- ── Las rarezas, de Scrydex ──
alter table public.tcg_cards add column if not exists rarity_en text;
alter table public.tcg_cards add column if not exists rarity_code text;

-- ── Cuándo pasó Scrydex por esta carta ──
--
-- Es el marcador por el que se REANUDA, igual que `detalle_at` en
-- `cartas-detalle`: el progreso vive en los datos y no en un contador
-- aparte, así que una pasada que se muere a medias no pierde nada y la
-- siguiente sigue por donde iba.
alter table public.tcg_cards add column if not exists scrydex_at timestamptz;

-- ── El emparejamiento, GUARDADO ──
--
-- La tanda 507 verificó 167 sets contra Scrydex y se le olvidó lo más
-- útil: apuntar con QUIÉN casa cada uno. Sin esto, cada pasada de las
-- cartas tendría que volver a pedir sus 224 expansiones y a verificar los
-- pares — y lo que es peor, podría emparejar distinto que la vez anterior
-- sin que nada lo dijera. Un emparejamiento verificado es un dato, no un
-- cálculo que se repite.
alter table public.tcg_sets add column if not exists scrydex_id text;
alter table public.tcg_sets add column if not exists scrydex_por text;

comment on column public.tcg_sets.scrydex_id is
  'Id de ESE set en Scrydex, una vez verificado el emparejamiento. Null = sin verificar; no se escribe nada en sus cartas.';
comment on column public.tcg_sets.scrydex_por is
  'Con qué señal se confirmó el emparejamiento (el código del set, los números de Pokédex…). Para poder revisar a mano los flojos.';
comment on column public.tcg_cards.rarity_en is
  'Rareza en inglés canónico, de Scrydex («Rare Rainbow»). Distinta de `rarity`, que está en español y la pintan los filtros. TCGdex colapsa Rainbow en «Hyper rare».';

-- ── Dónde iba la pasada por SU catálogo ──
--
-- Lo único que no se puede sacar de los datos: por qué página de las
-- suyas iba. Una fila, una clave.
create table if not exists public.scrydex_estado (
  clave text primary key,
  valor jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.scrydex_estado enable row level security;
-- Nadie la lee desde el navegador: la escribe la función programada con
-- la clave de servicio, que se salta la RLS. Sin políticas = sin acceso
-- público, que es lo que se quiere.

-- Para que la reanudación no recorra la tabla entera.
create index if not exists tcg_cards_sin_scrydex
  on public.tcg_cards (market, set_id) where scrydex_at is null;

-- ── Qué hay ahora mismo ──
select
  (select count(*) from public.tcg_cards where market = 'WEST')                        as cartas_west,
  (select count(*) from public.tcg_cards where market = 'WEST' and image_path is null)  as sin_foto_tcgdex,
  (select count(*) from public.tcg_sets  where market = 'WEST' and logo_scrydex is null) as sets_sin_logo_scrydex,
  (select count(*) from public.tcg_cards where market = 'WEST' and rarity is null)      as sin_rareza,
  (select count(distinct rarity) from public.tcg_cards where market = 'WEST')           as rarezas_distintas;
