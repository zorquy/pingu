-- Prueba de supabase-migration-934-versiones-a-mano.sql: lo de la 885 (que
-- carga antes) más las tablas que la 934 toca, con las columnas que usa.
\set ON_ERROR_STOP on
create extension if not exists unaccent;
create or replace function public.immutable_unaccent(text) returns text language sql immutable as $$ select public.unaccent($1) $$;
alter table public.user_collection add column market text not null default 'WEST', add column variante text not null default 'normal', add column idioma text not null default 'es';
create table public.tcg_card_versions (
  tcggo_id int primary key, market text not null default 'WEST', card_id text not null, set_id text, numero text, nombre text, etiqueta text,
  cm_id_product int, link_cm text, cm_low numeric, actualizado_at timestamptz not null default now(), creado_at timestamptz not null default now());
create table public.tcg_card_prices (card_id text primary key, cm_low numeric);
create table public.tcg_card_history (id serial primary key, card_id text not null, dia date, cm_low numeric);
create table public.user_wants (id serial primary key, user_id uuid, card_id text not null, idioma text);
create unique index user_wants_unico on public.user_wants (user_id, card_id, coalesce(idioma, '*'));
create table public.user_albums (id serial primary key, user_id uuid, cartas jsonb not null default '[]'::jsonb);
create table public.user_price_alerts (id serial primary key, user_id uuid, card_id text not null);
create table public.user_showcase (user_id uuid, posicion int, card_id text not null, primary key (user_id, posicion));
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
insert into public.tcg_sets (id, market, name, name_en) values ('base1', 'WEST', 'Base Set', 'Base Set'), ('sv10.5b', 'WEST', 'Black Bolt', 'Black Bolt');
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, origen) values
  ('base1-4', 'WEST', 'base1', '4', 'Charizard', 'Charizard', 'tcgdex'),
  ('sv10.5b-060', 'WEST', 'sv10.5b', '060', 'Escavalier', 'Escavalier', 'tcgdex'),
  ('tcggo-9060', 'WEST', 'sv10.5b', '60', 'Escavalier', 'Escavalier', 'tcggo'),
  ('mano-sv10.5b-999', 'WEST', 'sv10.5b', '999', 'Prueba', 'Prueba', 'mano');
insert into public.tcg_card_prices values ('tcggo-9060', 0.5);
insert into public.user_collection (card_id, user_id, cantidad, variante) values
  ('tcggo-9060', '00000000-0000-0000-0000-0000000000c1', 2, 'normal'),
  ('base1-4', '00000000-0000-0000-0000-0000000000c1', 1, 'holo');
insert into public.user_wants (user_id, card_id, idioma) values
  ('00000000-0000-0000-0000-0000000000c1', 'tcggo-9060', null),
  ('00000000-0000-0000-0000-0000000000c2', 'tcggo-9060', null),
  ('00000000-0000-0000-0000-0000000000c2', 'sv10.5b-060', null);
insert into public.user_albums (user_id, cartas) values ('00000000-0000-0000-0000-0000000000c1', '[{"id": "base1-4"}, {"id": "tcggo-9060", "pos": 3}]');
