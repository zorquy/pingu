-- Lo mínimo que la migración de torneos da por hecho que ya existe.
create schema if not exists auth;
create table if not exists public.user_profiles (
  id uuid primary key,
  username text,
  is_admin boolean not null default false,
  xp integer not null default 0
);
-- auth.uid() de mentira: lee de una variable de sesión, que es lo que
-- permite hacerse pasar por cada usuario en la prueba.
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('prueba.uid', true), '')::uuid
$$;
create table if not exists public.achievement_definitions (
  id text primary key, title text, emoji text, rarity text, description text,
  icon text, xp_reward integer default 0, icon_url text, is_active boolean default true,
  condition jsonb
);
create table if not exists public.site_settings (key text primary key, value jsonb);
create table if not exists public.forum_threads (id uuid primary key default gen_random_uuid(), title text);
create table if not exists public.tcg_cards (
  id text primary key, set_id text, local_id text, name text, market text, image_path text
);
