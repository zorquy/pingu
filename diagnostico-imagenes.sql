-- Diagnóstico de las imágenes que faltan (tanda 431).
--
-- ESTO NO CAMBIA NADA: son cuatro SELECT. Se pega en el SQL Editor de
-- Supabase y se mira el resultado.
--
-- Por qué hace falta antes de tocar nada: una carta sin escaneo puede
-- serlo por tres motivos distintos, y cada uno se arregla de otra manera.
--
--   1. `image_path` a null Y el set SIN código de TCG Live  → no hay
--      ningún sitio de donde sacarla con lo que tenemos hoy.
--   2. `image_path` a null pero el set CON código           → la cadena
--      de Limitless ya debería estar salvándola; si no se ve, el fallo
--      está en cómo se monta esa dirección y no en que falte el dato.
--   3. `image_path` puesto pero la imagen no carga          → es el
--      espejo de TCGdex el que no la tiene, y eso no se arregla desde
--      aquí.
--
-- Hasta no saber CUÁNTAS hay de cada clase, cualquier arreglo es a ciegas.

-- ── 1. Los sets sin dibujo ninguno ──
-- Son los que salen con el nombre escrito en vez del logo.
select
  count(*) filter (where logo_path is null and symbol_url is null) as sin_nada,
  count(*) filter (where logo_path is null and symbol_url is not null) as solo_simbolo,
  count(*) filter (where logo_path is not null) as con_logo,
  count(*) as total
from tcg_sets
where market = 'WEST';

-- ── 2. Cuáles son, por si son pocos y se ven de un vistazo ──
select id, name, tcg_online_code, release_date, card_count_total
from tcg_sets
where market = 'WEST' and logo_path is null and symbol_url is null
order by release_date desc nulls last, id;

-- ── 3. Las cartas sin escaneo, por colección ──
-- `rescatable` es la columna que decide el plan: con código de TCG Live,
-- la cadena de Limitless puede montar la dirección sola; sin él, no.
select
  s.id,
  s.name,
  s.tcg_online_code,
  (s.tcg_online_code is not null) as rescatable_por_limitless,
  count(*) filter (where c.image_path is null) as sin_imagen,
  count(*) as cartas
from tcg_cards c
join tcg_sets s on s.id = c.set_id
where c.market = 'WEST'
group by s.id, s.name, s.tcg_online_code
having count(*) filter (where c.image_path is null) > 0
order by count(*) filter (where c.image_path is null) desc;

-- ── 4. El resumen de todo, en una línea ──
select
  count(*) as cartas,
  count(*) filter (where image_path is null) as sin_imagen,
  count(*) filter (where image_path is null and s.tcg_online_code is not null) as sin_imagen_pero_con_codigo,
  count(*) filter (where image_path is null and s.tcg_online_code is null) as sin_imagen_y_sin_codigo
from tcg_cards c
join tcg_sets s on s.id = c.set_id
where c.market = 'WEST';
