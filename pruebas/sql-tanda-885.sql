-- Prueba de supabase-migration-885-catalogo-correcciones.sql: lo mínimo
-- que da por hecho, con los roles de Supabase.
\set ON_ERROR_STOP on
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('prueba.uid', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create table public.user_profiles (id uuid primary key, username text, is_admin boolean not null default false);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_admin from user_profiles where id = auth.uid()), false) $$;
insert into public.user_profiles (id, username, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', true),
  ('00000000-0000-0000-0000-00000000000b', 'normal', false);
-- Las dos tablas del catálogo, con las columnas que tocan (jsonb, arrays,
-- fechas, enteros) y la clave compuesta de verdad (437).
create table public.tcg_sets (
  id text not null, market text not null default 'WEST', name text not null, name_en text, serie_id text, serie_name text, serie_name_en text,
  release_date date, card_count_official int, card_count_total int, tcg_online_code text, logo_path text, logo_scrydex text, logo_tcggo text,
  symbol_scrydex text, oculto boolean not null default false, orden int, tcggo_id int, scrydex_id text, origen text,
  primary key (id, market));
create table public.tcg_cards (
  id text not null, market text not null default 'WEST', set_id text not null, local_id text not null, name text not null, name_en text, name_es text,
  image_path text, image_tcggo text, image_scrydex text, rarity text, rarity_en text, category text, hp int, types text[], stage text, evolve_from text,
  retreat int, attacks jsonb, abilities jsonb, weaknesses jsonb, resistances jsonb, trainer_type text, energy_type text, illustrator text,
  description text, dex_ids int[], regulation_mark text, variants jsonb, suffix text, cm_id_product_propio int, tp_id_product_propio int,
  tcggo_id int, origen text, detalle_at timestamptz,
  primary key (id, market), foreign key (set_id, market) references public.tcg_sets (id, market) on delete cascade);
create table public.user_collection (id serial primary key, card_id text, user_id uuid, cantidad int default 1);
alter table public.tcg_sets enable row level security;
alter table public.tcg_cards enable row level security;
create policy s_leer on public.tcg_sets for select using (true);
create policy c_leer on public.tcg_cards for select using (true);
create policy s_admin on public.tcg_sets for all using (is_admin()) with check (is_admin());
create policy c_admin on public.tcg_cards for all using (is_admin()) with check (is_admin());
grant usage on schema public, auth to authenticated, anon, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
insert into public.tcg_sets (id, market, name, name_en, release_date, card_count_total, logo_tcggo, tcggo_id) values
  ('s12a', 'JP', 'VSTARユニバース', 'VSTAR Universe', '2022-12-02', 262, 'https://tcggo/logo.png', 913),
  ('ex7', 'WEST', 'EX Team Rocket Returns', 'EX Team Rocket Returns', '2004-11-01', 111, null, null);
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, image_path, hp, types, dex_ids, variants, tcggo_id, origen) values
  ('tcggo-1', 'JP', 's12a', '173', 'ヒスイのビリリダマ', 'Hisuian Voltorb', null, 60, array['Lightning'], array[100], '{"normal": true}', 55001, 'tcggo'),
  ('ex7-15', 'WEST', 'ex7', '15', 'Dark Dragonite', 'Dark Dragonite', 'ex/ex7/15', 120, array['Darkness'], array[149], '{"holo": true, "normal": true}', null, 'tcgdex');
