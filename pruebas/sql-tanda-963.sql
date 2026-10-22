-- Lo mínimo para la 963: sets y cartas con las columnas que escribe, y la tabla
-- de idiomas a mano de la 956. Un set de TCGGO con el código CLC (el guarda) y
-- sets de antes para la era.
\set ON_ERROR_STOP on
create table public.tcg_sets (id text not null, market text not null default 'WEST', name text not null, name_en text, serie_id text,
  release_date date, card_count_official int, card_count_total int, tcg_online_code text, origen text, oculto boolean default false, primary key (id, market));
create table public.tcg_cards (id text not null, market text not null default 'WEST', set_id text not null, local_id text not null, name text not null,
  name_en text, category text, types text[], dex_ids int[], origen text, primary key (id, market));
create table public.tcg_set_idiomas_mano (set_id text not null, market text not null default 'WEST', idioma text not null, hay boolean not null,
  autor uuid, updated_at timestamptz not null default now(), primary key (set_id, market, idioma));
insert into public.tcg_sets (id, market, name, serie_id, release_date, tcg_online_code, origen) values
  ('SM9a', 'JP', 'Night Unison', 'SM', '2019-03-01', null, 'tcggo'),
  ('SM10', 'JP', 'Double Blaze', 'SM', '2019-05-31', null, 'tcggo'),
  ('SV4a', 'JP', 'Shiny Treasure ex', 'SV', '2023-12-01', null, 'tcggo'),
  ('SV4K', 'JP', 'Ancient Roar', 'SV', '2023-10-27', null, 'tcggo'),
  ('sv04', 'WEST', 'Paradox Rift', 'sv', '2023-11-03', 'PAR', null),
  ('tcggo-999', 'WEST', 'Charizard & Ho-Oh ex Deck', 'sv', '2023-11-17', 'clc', 'tcggo');
