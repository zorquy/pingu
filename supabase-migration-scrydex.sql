-- ════════════════════════════════════════════════════════════════════
--  Scrydex como fuente del catálogo occidental (tanda 507)
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU: «estamos pagando Scrydex, de algo tiene que servir. Fíate del
-- catálogo de Scrydex, y si falta algo en Scrydex cógelo de las otras
-- cosas».
--
-- ── POR QUÉ SON COLUMNAS NUEVAS Y NO LAS DE SIEMPRE ──
--
-- Porque `logo_path` e `image_path` NO guardan una URL: guardan un trozo
-- de ruta de TCGdex sin el idioma delante (`swsh/swsh3/logo`), y quien
-- pinta le monta alrededor el idioma, el dominio y la extensión. Y la
-- calidad se escribe distinto en cada sitio: TCGdex pide `/high.webp` y
-- Scrydex `/large`. Meter una URL de Scrydex en esas columnas sería la
-- trampa de la tanda 335 —una columna con dos trabajos— y el síntoma
-- sería una imagen rota que nadie distingue de una buena.
--
-- Y `symbol_url`, que parecía libre porque guarda una URL, tampoco lo
-- está: se pinta como `${set.symbol_url}.webp`, así que le falta la
-- extensión a propósito.
--
-- Así que una columna por FUENTE. El nombre dice de dónde viene, que es
-- justo lo que no se puede deducir de una columna vacía (la lección de
-- las tandas 484 y 486), y hace imposible confundir las dos formas.
--
-- ── Y NO SE BORRA NADA ──
--
-- Lo de TCGdex se queda donde está y sigue siendo el respaldo: el día
-- que Scrydex no conteste, la cadena de dibujos de /mi-coleccion pasa al
-- siguiente sitio como ya hace hoy (la lección de la tanda 321: un
-- respaldo que vive en el mismo sitio no es un respaldo).

alter table public.tcg_sets  add column if not exists logo_scrydex text;
alter table public.tcg_sets  add column if not exists symbol_scrydex text;
alter table public.tcg_cards add column if not exists image_scrydex text;

comment on column public.tcg_sets.logo_scrydex is
  'URL ENTERA del logo en Scrydex (images.scrydex.com/...). Distinta de logo_path, que es un trozo de ruta de TCGdex. Se prefiere esta cuando está.';
comment on column public.tcg_sets.symbol_scrydex is
  'URL ENTERA del símbolo en Scrydex. Distinta de symbol_url, que se pinta añadiéndole .webp.';
comment on column public.tcg_cards.image_scrydex is
  'URL ENTERA del escaneo en Scrydex, sin la calidad al final (se añade /small, /medium o /large). Distinta de image_path, que es un trozo de ruta de TCGdex.';

-- Para saber en el panel cuánto queda por traer sin recorrer la tabla.
create index if not exists tcg_sets_sin_logo_scrydex
  on public.tcg_sets (market) where logo_scrydex is null;
create index if not exists tcg_cards_sin_imagen_scrydex
  on public.tcg_cards (market) where image_scrydex is null;

-- Cuántas hay hoy de cada cosa. Para pegar el resultado en la bitácora.
select
  (select count(*) from public.tcg_sets  where market = 'WEST')                            as sets_west,
  (select count(*) from public.tcg_sets  where market = 'WEST' and logo_path is null)       as sets_sin_logo_tcgdex,
  (select count(*) from public.tcg_cards where market = 'WEST')                            as cartas_west,
  (select count(*) from public.tcg_cards where market = 'WEST' and image_path is null)      as cartas_sin_foto_tcgdex,
  -- Y el hallazgo de la tanda 505: cuántas llevan el español metido en
  -- `name`, que por la norma de las 334/335 es la CLAVE con la que se
  -- cruzan `tcg_card_play`, el resolutor de decklists y la huella de las
  -- reimpresiones. Esas no casan con nada y no dan ningún error.
  (select count(*) from public.tcg_cards
     where market = 'WEST' and name_es is not null
       and immutable_unaccent(lower(name)) = immutable_unaccent(lower(name_es)))            as cartas_con_nombre_en_espanol;
