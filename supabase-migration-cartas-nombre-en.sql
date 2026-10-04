-- El nombre OCCIDENTAL de las cartas japonesas (tanda 537).
--
-- PINGU: «además de los kanji, ponme los nombres que tiene Scrydex».
--
-- Misma idea que `tcg_sets.name_en` (tanda 532) y por el mismo motivo: el
-- japonés es el nombre de verdad de la carta y además es con lo que se
-- cruza por dentro, así que NO se pisa — se guarda al lado y se enseña el
-- que se pueda leer.
--
-- Ojo a la diferencia con `name_es`, que ya existe: ese es el español de
-- TCGdex para el catálogo occidental. Son dos columnas distintas porque son
-- dos catálogos distintos, y mezclarlas dejaría una carta japonesa
-- rotulada en español cuando no existe en español.
alter table public.tcg_cards add column if not exists name_en text;

comment on column public.tcg_cards.name_en is
  'Nombre occidental de la carta, de Scrydex (translation.en.name). Se ENSEÑA cuando el nombre lleva kanji; no es una clave.';

select count(*) filter (where name_en is not null) as con_nombre_en,
       count(*) as cartas
from public.tcg_cards where market = 'JP';
