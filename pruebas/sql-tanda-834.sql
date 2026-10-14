-- Prueba de supabase-migration-play-pokemon.sql (tanda 834): lo mínimo que
-- da por hecho, con los roles de Supabase.
\set ON_ERROR_STOP on
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('prueba.uid', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
end $$;
create table public.user_profiles (id uuid primary key, username text);
alter table public.user_profiles enable row level security;
create policy up_sel on public.user_profiles for select using (true);
grant usage on schema public, auth to authenticated, anon;
grant select on public.user_profiles to authenticated, anon;
insert into public.user_profiles (id, username) values
  ('00000000-0000-0000-0000-00000000000a', 'ash'),
  ('00000000-0000-0000-0000-00000000000b', 'misty');
