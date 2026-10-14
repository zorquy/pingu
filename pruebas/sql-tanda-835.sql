-- Lo mínimo que da por hecho supabase-migration-retos-xp.sql (tanda 835).
\set ON_ERROR_STOP on
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('prueba.uid', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create table public.user_profiles (id uuid primary key, total_xp int default 0, level text default 'Novato');
create table public.daily_challenge_results (user_id uuid not null, day date not null, correct int default 0, total int default 0, score int default 0, primary key (user_id, day));
create table public.achievement_definitions (id text primary key, title text, description text, emoji text, rarity text, xp_reward int, is_active boolean, condition jsonb);
-- `xp_sumar` como la de la 388, sin el tope: suma a auth.uid() y devuelve el total.
create or replace function public.xp_sumar(p_cuanto int) returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if auth.uid() is null then raise exception 'sin sesión'; end if;
  update public.user_profiles set total_xp = coalesce(total_xp, 0) + p_cuanto where id = auth.uid() returning total_xp into v;
  return v;
end $$;
grant usage on schema public, auth to authenticated, anon;
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b2'), ('00000000-0000-0000-0000-0000000000c3');
insert into public.user_profiles (id) values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b2'), ('00000000-0000-0000-0000-0000000000c3');
