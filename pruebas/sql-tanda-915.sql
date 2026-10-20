-- Lo mínimo de la base que la migración 915 da por hecho: perfiles, quién
-- sigue a quién, las colecciones y los roles de Supabase (auth.uid()).
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create table public.user_profiles (id uuid primary key, username text, display_name text, avatar_url text, is_admin boolean, is_moderator boolean, is_banned boolean, coleccion_publica boolean);
create table public.user_follows (follower_id uuid, following_id uuid);
create table public.user_collection (id serial primary key, user_id uuid, card_id text, cantidad int not null default 1, cambio int default 0);
insert into public.user_profiles (id, username, coleccion_publica, is_banned) values
  ('00000000-0000-0000-0000-000000000001', 'yo', true, false),
  ('00000000-0000-0000-0000-000000000002', 'ana', true, false),       -- pública, la sigo
  ('00000000-0000-0000-0000-000000000003', 'beto', true, false),      -- pública, no la sigo, tiene 5
  ('00000000-0000-0000-0000-000000000004', 'caro', false, false),     -- privada, da 1 de 3
  ('00000000-0000-0000-0000-000000000005', 'dani', false, false),     -- privada, no da: no sale
  ('00000000-0000-0000-0000-000000000006', 'eva', true, true),        -- baneada: no sale
  ('00000000-0000-0000-0000-000000000007', 'fede', true, false);      -- pública, la da
insert into public.user_follows values ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');
insert into public.user_collection (user_id, card_id, cantidad, cambio) values
  ('00000000-0000-0000-0000-000000000001', 'sv8-238', 2, 0),
  ('00000000-0000-0000-0000-000000000002', 'sv8-238', 1, 0),
  ('00000000-0000-0000-0000-000000000003', 'sv8-238', 3, 0),
  ('00000000-0000-0000-0000-000000000003', 'sv8-238', 2, null),
  ('00000000-0000-0000-0000-000000000004', 'sv8-238', 3, 1),
  ('00000000-0000-0000-0000-000000000005', 'sv8-238', 4, 0),
  ('00000000-0000-0000-0000-000000000006', 'sv8-238', 9, 9),
  ('00000000-0000-0000-0000-000000000007', 'sv8-238', 1, 1),
  ('00000000-0000-0000-0000-000000000002', 'otra-1', 1, 0);
