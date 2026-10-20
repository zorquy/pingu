-- Lo mínimo de la base que la migración 911 da por hecho: las cartas, sus
-- precios por idioma y las dos tablas con la restricción de idioma vieja.
\set ON_ERROR_STOP on
create table public.tcg_cards (id text not null, market text not null default 'WEST', set_id text not null, primary key (id, market));
create table public.tcg_card_prices (card_id text primary key, cm_low numeric, cm_low_es numeric, cm_low_en numeric, cm_low_de numeric, cm_low_fr numeric, cm_low_it numeric, cm_low_ja numeric, cm_low_ko numeric, cm_low_zh numeric);
create table public.user_collection (id serial primary key, idioma text not null, constraint user_collection_idioma check (idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'zh')));
create table public.user_wants (id serial primary key, idioma text, constraint user_wants_idioma check (idioma is null or idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'zh')));
insert into public.tcg_cards (id, market, set_id) values
  -- Plasma Blast: anuncios en inglés, alemán, francés e italiano; ni uno en español.
  ('bw10-96', 'WEST', 'bw10'), ('bw10-1', 'WEST', 'bw10'),
  -- Gym Heroes: la ficha de TCGdex dice solo inglés; los anuncios, más.
  ('gym1-1', 'WEST', 'gym1'),
  -- Un set que TCGdex no tiene.
  ('tcggo-500', 'WEST', 'tcggo-9'),
  -- Japonés: la japonesa, la coreana y la china en el mismo producto.
  ('M6A-001', 'JP', 'M6A'), ('M6A-002', 'JP', 'M6A'),
  -- Un set sin precios de nadie.
  ('vacio-1', 'WEST', 'vacio');
insert into public.tcg_card_prices (card_id, cm_low_es, cm_low_en, cm_low_de, cm_low_fr, cm_low_it, cm_low_ja, cm_low_ko, cm_low_zh) values
  ('bw10-96', null, 65, 174.99, 87.9, 20, null, null, null),
  ('bw10-1', 0, 1, null, null, null, null, null, null),
  ('gym1-1', 30, 12, 9, null, null, null, null, null),
  ('tcggo-500', 2, 1, null, null, null, null, null, null),
  ('M6A-001', null, null, null, null, null, 0.02, 0.05, null),
  ('M6A-002', null, null, null, null, null, 0.1, null, 0.02);
