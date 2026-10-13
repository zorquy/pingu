-- Prueba de supabase-migration-redactor-noticias.sql contra PostgreSQL de
-- verdad (tanda 803). Monta lo mínimo que la migración da por hecho, pone
-- las migraciones de antes que reescribe, y luego la nueva.
\set ON_ERROR_STOP on
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('prueba.uid', true), '')::uuid $$;
do $$ begin if not exists (select 1 from pg_roles where rolname=$q$authenticated$q$) then create role authenticated; end if; if not exists (select 1 from pg_roles where rolname=$q$anon$q$) then create role anon; end if; end $$;
create table public.user_profiles (
  id uuid primary key, username text, is_admin boolean not null default false,
  is_moderator boolean default false, forum_title text, is_banned boolean default false,
  is_muted boolean default false, is_tournament_admin boolean not null default false);
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_admin from user_profiles where id = auth.uid()), false) $$;
create or replace function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_admin or is_moderator from user_profiles where id = auth.uid()), false) $$;
create or replace function public.is_banned() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_banned from user_profiles where id = auth.uid()), false) $$;
create or replace function public.is_muted() returns boolean language sql stable security definer set search_path=public as $$
  select coalesce((select is_muted from user_profiles where id = auth.uid()), false) $$;
create table public.guides (
  id uuid primary key default gen_random_uuid(), author_id uuid, title text,
  review_status text not null default 'draft', published_at timestamptz,
  xp_reward int default 20, guide_rarity text default 'bronze', is_pro boolean default false,
  description text, reference_blocks jsonb, blocks jsonb, cover_image text);
alter table public.guides enable row level security;
create policy guides_select on public.guides for select using (true);
create policy "guides_author_insert" on public.guides for insert
  with check (auth.uid() = author_id and review_status in ('draft', 'pending'));
create table public.forum_boards (id uuid primary key default gen_random_uuid(), slug text, post_policy text not null default 'todos', is_hidden boolean not null default false);
create table public.forum_threads (id uuid primary key default gen_random_uuid(), board_id uuid, author_id uuid, title text, prefix text);
alter table public.forum_threads enable row level security;
create policy ft_sel on public.forum_threads for select using (true);
alter table public.user_profiles enable row level security;
create policy up_sel on public.user_profiles for select using (true);
create policy up_upd on public.user_profiles for update using (auth.uid() = id or public.is_admin());
grant usage on schema public, auth to authenticated;
grant all on all tables in schema public to authenticated;
insert into public.forum_boards (slug, post_policy) values ('noticias', 'staff'), ('anuncios', 'staff'), ('general', 'todos');
insert into public.user_profiles (id, username, is_admin) values
  ('00000000-0000-0000-0000-00000000000a', 'admin', true),
  ('00000000-0000-0000-0000-00000000000b', 'redactora', false),
  ('00000000-0000-0000-0000-00000000000c', 'normal', false);
