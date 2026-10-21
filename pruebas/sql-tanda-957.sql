-- Lo que la 957 da por hecho, encima de la 885 y la 934 (sus fixtures y
-- migraciones): lo que pide la 956 para cargarse, y los sets y la carta que
-- toca.
\set ON_ERROR_STOP on
alter table public.tcg_card_prices add column if not exists cm_low_es numeric, add column if not exists cm_low_en numeric,
  add column if not exists cm_low_de numeric, add column if not exists cm_low_fr numeric, add column if not exists cm_low_it numeric,
  add column if not exists cm_low_ja numeric, add column if not exists cm_low_ko numeric, add column if not exists cm_low_zh numeric;
create table if not exists public.tcg_set_idiomas (set_id text not null, market text not null default 'WEST', idiomas text[] not null, primary key (set_id, market));
insert into public.tcg_sets (id, market, name, name_en, serie_id) values
  ('bw5', 'WEST', 'Dark Explorers', 'Dark Explorers', 'bw'),
  ('2019sm', 'WEST', 'McDonald''s Collection 2019', 'McDonald''s Collection 2019', 'mc');
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, origen) values ('bw5-4', 'WEST', 'bw5', '4', 'Scyther', 'Scyther', 'tcgdex');
