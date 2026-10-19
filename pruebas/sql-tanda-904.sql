-- El lío de PINGU, tal cual: la era de e-Card rebautizada «Play! Pokémon
-- Prize Pack» con los cuatro sets de e-Card Y las nueve series de Prize Pack
-- dentro. Lo mínimo de la base que la migración 904 da por hecho.
\set ON_ERROR_STOP on
create table public.tcg_sets (
  id text not null, market text not null default 'WEST', name text not null, name_en text, serie_id text, serie_name text, serie_name_en text,
  release_date date, card_count_official int, card_count_total int, oculto boolean not null default false, orden int, tcggo_id int, origen text,
  primary key (id, market));
create table public.tcg_eras (
  market text not null, id text not null, nombre text not null, orden int not null default 0, created_at timestamptz not null default now(),
  primary key (market, id),
  constraint tcg_eras_id check (id ~ '^[a-z0-9][a-z0-9-]*$' and char_length(id) <= 60),
  constraint tcg_eras_nombre check (char_length(nombre) between 1 and 80));
create table public.tcg_correcciones (
  tabla text not null check (tabla in ('tcg_sets', 'tcg_cards')), id text not null, market text not null default 'WEST', columna text not null,
  valor jsonb, anterior jsonb, autor uuid, updated_at timestamptz not null default now(),
  primary key (tabla, id, market, columna));
insert into public.tcg_eras (market, id, nombre, orden) values
  ('WEST', 'base', 'Base', 170),
  ('WEST', 'ecard', 'Play! Pokémon Prize Pack', 150),
  ('WEST', 'neo', 'Neo', 140),
  ('WEST', 'ex', 'EX', 130),
  ('JP', 'ecard', 'e-Card (JP)', 0);
insert into public.tcg_sets (id, market, name, name_en, serie_id, release_date) values
  ('base1', 'WEST', 'Base Set', 'Base Set', 'base', '1999-01-09'),
  ('neo1', 'WEST', 'Neo Genesis', 'Neo Genesis', 'neo', '2000-12-16'),
  ('ex1', 'WEST', 'Ruby & Sapphire', 'Ruby & Sapphire', 'ex', '2003-07-18'),
  ('ecard1', 'WEST', 'Expedition Base Set', 'Expedition Base Set', 'ecard', '2002-09-15'),
  ('ecard2', 'WEST', 'Aquapolis', 'Aquapolis', 'ecard', '2003-01-15'),
  ('ecard3', 'WEST', 'Skyridge', 'Skyridge', 'ecard', '2003-05-12'),
  ('tcggo-77', 'WEST', 'Best of Game', 'Best of Game', 'ecard', '2002-12-01'),
  ('tcggo-91', 'WEST', 'Play! Pokémon Prize Pack Series One', 'Play! Pokémon Prize Pack Series One', 'ecard', '2022-01-01'),
  ('tcggo-92', 'WEST', 'Play! Pokémon Prize Pack Series Two', 'Play! Pokémon Prize Pack Series Two', 'ecard', '2022-07-01'),
  ('tcggo-93', 'WEST', 'Play! Pokémon Prize Pack Series Three', 'Play! Pokémon Prize Pack Series Three', 'ecard', '2023-01-01'),
  ('tcggo-94', 'WEST', 'Play! Pokémon Prize Pack Series Four', 'Play! Pokémon Prize Pack Series Four', 'ecard', '2023-07-01'),
  ('tcggo-95', 'WEST', 'Play! Pokémon Prize Pack Series Five', 'Play! Pokémon Prize Pack Series Five', 'ecard', '2024-01-01'),
  ('tcggo-96', 'WEST', 'Play! Pokémon Prize Pack Series Six', 'Play! Pokémon Prize Pack Series Six', 'ecard', '2024-07-01'),
  ('tcggo-97', 'WEST', 'Play! Pokemon Prize Pack Series Seven', 'Play! Pokemon Prize Pack Series Seven', 'ecard', '2025-01-01'),
  ('tcggo-98', 'WEST', 'Play! Pokémon Prize Pack Series Eight', 'Play! Pokémon Prize Pack Series Eight', 'ecard', '2025-07-01'),
  ('tcggo-99', 'WEST', 'Play! Pokémon Prize Pack Series Nine', 'Play! Pokémon Prize Pack Series Nine', 'ecard', '2026-01-01'),
  ('ecard1', 'JP', 'e-Card 1', 'e-Card 1', 'ecard', '2001-12-01');
