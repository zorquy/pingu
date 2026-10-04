-- El nombre OCCIDENTAL de los sets japoneses (tanda 532).
--
-- PINGU, mirando la biblioteca japonesa con los logos ya puestos: «Scrydex
-- guarda el nombre de los sets japoneses en occidental, y las eras también,
-- así que deberías traerte ese nombre en vez de los kanjis, porque no se
-- sabe leer esto».
--
-- Y lo trae en la MISMA respuesta que el logo, sin pedir nada más:
--
--   "name": "30th セレブレーション プレミアムデッキセット エーフィ・ブラッキー",
--   "translation": { "en": { "name": "30th Celebration Premium Deck Set: …" } },
--   "series": "Mega Evolution"
--
-- POR QUÉ DOS COLUMNAS NUEVAS Y NO PISAR `name`: porque el japonés es el
-- nombre de verdad del set y hay quien lo quiere (y porque `name` es la
-- clave con la que se cruzan cosas, la lección de las tandas 334 y 335).
-- Lo que se GUARDA es canónico; lo que se ENSEÑA va traducido.
alter table public.tcg_sets add column if not exists name_en text;
alter table public.tcg_sets add column if not exists serie_name_en text;

comment on column public.tcg_sets.name_en is
  'Nombre occidental del set, de Scrydex (translation.en.name). Se ENSEÑA en vez del japonés cuando el nombre lleva kanji; no es una clave.';
comment on column public.tcg_sets.serie_name_en is
  'Nombre occidental de la era/serie, de Scrydex (series). Misma idea que name_en.';

select count(*) filter (where name_en is not null) as con_nombre_en,
       count(*) as sets
from public.tcg_sets where market = 'JP';
