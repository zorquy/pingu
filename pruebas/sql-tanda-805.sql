-- Prueba de supabase-migration-seguridad-perfil.sql (tanda 805): lo mínimo
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
create table public.user_profiles (
  id uuid primary key, username text, display_name text,
  is_admin boolean not null default false, is_moderator boolean default false, forum_title text, forum_title_color text,
  is_banned boolean not null default false, is_muted boolean not null default false, is_pro boolean not null default false,
  is_tournament_admin boolean not null default false, is_news_writer boolean not null default false,
  total_xp int default 0, level text default 'Novato', current_streak int default 0,
  avatar_url text, banner_url text);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_admin from user_profiles where id = auth.uid()), false) $$;
create or replace function public.nivel_de_xp(p_xp int) returns text language sql immutable as $$
  select case when coalesce(p_xp, 0) >= 1000 then 'Coleccionista' when coalesce(p_xp, 0) >= 250 then 'Entrenador' else 'Novato' end $$;
-- Una función de la casa que reparte XP (como xp_por_mensaje_de_foro).
create or replace function public.premio_de_la_casa(p int) returns void language plpgsql security definer set search_path=public as $$
begin update user_profiles set total_xp = total_xp + p where id = auth.uid(); end $$;
grant execute on function public.premio_de_la_casa(int) to authenticated;
alter table public.user_profiles enable row level security;
create policy up_sel on public.user_profiles for select using (true);
create policy up_ins on public.user_profiles for insert to authenticated with check (auth.uid() = id);
create policy up_upd on public.user_profiles for update to authenticated using (auth.uid() = id or public.is_admin());
grant usage on schema public, auth to authenticated, anon;
grant all on all tables in schema public to authenticated;
insert into public.user_profiles (id, username, is_admin, is_banned, is_muted, total_xp, avatar_url) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', true, false, false, 0, null),
  ('00000000-0000-0000-0000-00000000000c', 'castigado', false, true, true, 100, 'https://ejemplo.supabase.co/foto.png');
-- Lo que necesita la migración del redactor (803), que trae la versión
-- vigente de solo_admin_da_titulos: sin ella `is_admin` no está guardado.
create table public.guides (id uuid primary key default gen_random_uuid(), author_id uuid, kind text not null default 'guide',
  review_status text, published_at timestamptz, xp_reward int, guide_rarity text, is_pro boolean);
create table public.forum_boards (id uuid primary key default gen_random_uuid(), slug text, post_policy text default 'todos', is_hidden boolean default false);
create table public.forum_threads (id uuid primary key default gen_random_uuid(), board_id uuid, author_id uuid);
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_admin or is_moderator from user_profiles where id = auth.uid()), false) $$;
create or replace function public.is_banned() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_banned from user_profiles where id = auth.uid()), false) $$;
create or replace function public.is_muted() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_muted from user_profiles where id = auth.uid()), false) $$;
