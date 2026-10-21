-- Lo mínimo para la 911 y la 956: lo de la 911 (cartas, precios por idioma,
-- las dos restricciones viejas) más los sets, el admin y los roles.
\set ON_ERROR_STOP on
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('prueba.uid', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
end $$;
create table public.user_profiles (id uuid primary key, is_admin boolean not null default false);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_admin from user_profiles where id = auth.uid()), false) $$;
insert into public.user_profiles values ('00000000-0000-0000-0000-00000000000a', true), ('00000000-0000-0000-0000-00000000000b', false);
create table public.tcg_sets (id text not null, market text not null default 'WEST', name text not null, primary key (id, market));
insert into public.tcg_sets (id, market, name) values
  ('base2', 'WEST', 'Jungle'), ('hgss3', 'WEST', 'Undaunted'), ('bw5', 'WEST', 'Dark Explorers'),
  ('dp7', 'WEST', 'Stormfront'), ('bw7', 'WEST', 'Boundaries Crossed'), ('bw10', 'WEST', 'Plasma Blast');
create table public.tcg_cards (id text not null, market text not null default 'WEST', set_id text not null, primary key (id, market));
create table public.tcg_card_prices (card_id text primary key, cm_low numeric, cm_low_es numeric, cm_low_en numeric, cm_low_de numeric, cm_low_fr numeric, cm_low_it numeric, cm_low_ja numeric, cm_low_ko numeric, cm_low_zh numeric);
create table public.user_collection (id serial primary key, idioma text not null, constraint user_collection_idioma check (idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'zh')));
create table public.user_wants (id serial primary key, idioma text, constraint user_wants_idioma check (idioma is null or idioma in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'zh')));
insert into public.tcg_cards (id, market, set_id) values ('bw5-1', 'WEST', 'bw5'), ('bw10-1', 'WEST', 'bw10'), ('hgss3-1', 'WEST', 'hgss3');
-- Dark Explorers con un anuncio «en español» (mal catalogado: no salió).
insert into public.tcg_card_prices (card_id, cm_low_es, cm_low_en) values ('bw5-1', 3, 1), ('bw10-1', null, 1), ('hgss3-1', null, 2);
grant usage on schema public, auth to authenticated, anon;
grant select on all tables in schema public to authenticated, anon;
