-- Lo mínimo que da por hecho supabase-migration-1017-portada-consultas.sql:
-- las tablas que leen sus funciones, con las columnas de producción que
-- miran, y los roles. Las funciones de precio (eur_por_usd, tp_de_version,
-- emparejamiento_dudoso, valor_de_linea, valor_gradeado, la foto) y las de
-- los retos y la portada NO se copian: la prueba las saca de sus
-- migraciones, que es lo que corre en la base.
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
grant usage on schema public, auth to authenticated, anon;

create table public.user_profiles (
  id uuid primary key, username text, display_name text, avatar_url text, total_xp int default 0, level text default 'Novato',
  hide_activity boolean not null default false, coleccion_publica boolean not null default false, retos_oculto boolean not null default false,
  is_admin boolean not null default false, is_moderator boolean not null default false,
  achievements text[] not null default '{}', forum_read_all_at timestamptz);
create table public.daily_challenge_results (user_id uuid not null, day date not null, correct int default 0, total int default 0, score int default 0, primary key (user_id, day));
create table public.achievement_definitions (id text primary key, title text, description text, emoji text, rarity text, xp_reward int, is_active boolean, condition jsonb);
create or replace function public.xp_sumar(p_cuanto int) returns int language plpgsql security definer set search_path = public as $$
declare v int;
begin
  update public.user_profiles set total_xp = coalesce(total_xp, 0) + p_cuanto where id = auth.uid() returning total_xp into v;
  return v;
end $$;

-- El valor de la colección (la 905).
create table public.tcg_card_prices (
  card_id text primary key, cm_low numeric(10,2), cm_trend numeric(10,2), cm_avg30 numeric(10,2),
  cm_low_holo numeric(10,2), cm_trend_holo numeric(10,2), cm_avg30_holo numeric(10,2),
  cm_low_es numeric(10,2), cm_low_en numeric(10,2), cm_low_de numeric(10,2), cm_low_fr numeric(10,2), cm_low_it numeric(10,2), cm_low_ja numeric(10,2),
  tp_market_eur numeric(10,2),
  tp_normal_market numeric(10,2), tp_normal_low numeric(10,2), tp_holo_market numeric(10,2), tp_holo_low numeric(10,2),
  tp_reverse_market numeric(10,2), tp_reverse_low numeric(10,2), tp_primera_market numeric(10,2), tp_primera_low numeric(10,2),
  cm_gradeadas jsonb, ebay_gradeadas jsonb);
create table public.user_collection (
  id serial primary key, user_id uuid not null, card_id text not null, market text not null default 'WEST', idioma text, estado text,
  variante text not null default 'normal', cantidad int not null default 1, gradeo text, valor_manual numeric(10,2),
  created_at timestamptz not null default now());
create table public.user_collection_value (
  user_id uuid not null, dia date not null, valor numeric, copias int, distintas int, sin_precio int, primary key (user_id, dia));
create or replace function public.coleccion_es_publica(p_user uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select coleccion_publica from public.user_profiles where id = p_user), false);
$$;

-- Torneos, catálogo, guías, mazos, cursos.
create table public.tournaments (id uuid primary key default gen_random_uuid(), slug text, name text, start_at timestamptz, status text, format text default 'standard', matchday_dates jsonb, champion_id uuid, updated_at timestamptz not null default now());
create table public.tournament_registrations (id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid, status text default 'active', registered_at timestamptz not null default now());
create table public.tcg_sets (id text, market text default 'WEST', name text, name_en text, serie_id text, release_date date, logo_tcggo text, logo_scrydex text, oculto boolean default false, tcggo_id int, card_count_official int, primary key (id, market));
create table public.tcg_cards (id text, market text default 'WEST', set_id text, local_id text, primary key (id, market));
create table public.guides (id uuid primary key default gen_random_uuid(), slug text, title text, blocks jsonb, estimated_mins int, kind text default 'guide', published_at timestamptz, author_id uuid);
create table public.user_progress (user_id uuid not null, guide_id uuid not null, current_block int default 0, status text default 'in_progress', started_at timestamptz, read_at timestamptz, completed_at timestamptz, primary key (user_id, guide_id));
create table public.user_decks (id uuid primary key default gen_random_uuid(), user_id uuid not null, name text not null, cards jsonb not null default '[]', is_public boolean not null default false, updated_at timestamptz not null default now());
create table public.course_review_queue (user_id uuid not null, guide_id uuid not null, question_key text not null, review_after timestamptz not null default now(), primary key (user_id, guide_id, question_key));
create table public.user_follows (follower_id uuid, following_id uuid, created_at timestamptz not null default now());

-- El foro.
create table public.forum_sections (id uuid primary key default gen_random_uuid(), name text not null, position int not null default 0);
create table public.forum_boards (id uuid primary key default gen_random_uuid(), section_id uuid, parent_id uuid, name text not null, slug text not null, description text, position int not null default 0, is_hidden boolean not null default false);
create table public.forum_threads (id uuid primary key default gen_random_uuid(), board_id uuid, title text, prefix text, post_count int default 1, author_id uuid, last_post_author_id uuid, created_at timestamptz not null default now(), last_post_at timestamptz);
create table public.forum_posts (id uuid primary key default gen_random_uuid(), thread_id uuid, author_id uuid, body_html text default '', created_at timestamptz not null default now());
create table public.forum_thread_reads (user_id uuid not null, thread_id uuid not null, last_read_at timestamptz not null default now(), primary key (user_id, thread_id));
create table public.forum_subscriptions (user_id uuid not null, thread_id uuid not null, created_at timestamptz not null default now(), primary key (user_id, thread_id));
-- La vista de los foros con sus cuentas, como en supabase-migration-foro.sql.
create or replace view public.forum_boards_resumen with (security_invoker = true) as
with recursive descendientes as (
  select b.id as board_id, b.id as hijo_id from public.forum_boards b
  union all
  select d.board_id, h.id from descendientes d join public.forum_boards h on h.parent_id = d.hijo_id
)
select b.*, coalesce(n.temas, 0) as thread_count, coalesce(n.mensajes, 0) as post_count,
       u.last_thread_id, u.last_thread_title, u.last_post_at, u.last_post_author_id
from public.forum_boards b
left join lateral (
  select count(distinct t.id) as temas, count(p.id) as mensajes
    from descendientes d join public.forum_threads t on t.board_id = d.hijo_id left join public.forum_posts p on p.thread_id = t.id
   where d.board_id = b.id) n on true
left join lateral (
  select t.id as last_thread_id, t.title as last_thread_title, p.created_at as last_post_at, p.author_id as last_post_author_id
    from descendientes d join public.forum_threads t on t.board_id = d.hijo_id join public.forum_posts p on p.thread_id = t.id
   where d.board_id = b.id order by p.created_at desc limit 1) u on true;

-- Tres personas.
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b2'), ('00000000-0000-0000-0000-0000000000c3');
insert into public.user_profiles (id, username) values
  ('00000000-0000-0000-0000-0000000000a1', 'ash'), ('00000000-0000-0000-0000-0000000000b2', 'misty'), ('00000000-0000-0000-0000-0000000000c3', 'brock');
