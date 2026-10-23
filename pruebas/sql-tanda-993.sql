-- Lo mínimo que da por hecho supabase-migration-993-avisos-sin-duplicar.sql.
\set ON_ERROR_STOP on
create schema if not exists auth;
create table if not exists auth.users (id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('prueba.uid', true), '')::uuid $$;
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
end $$;
create table public.user_profiles (id uuid primary key, is_banned boolean default false, notification_prefs_disabled text[] default '{}');
create table public.forum_threads (id uuid primary key, author_id uuid, title text);
create table public.forum_posts (id uuid primary key, thread_id uuid, author_id uuid);
create table public.forum_subscriptions (thread_id uuid, user_id uuid, primary key (thread_id, user_id));
create table public.user_notifications (id bigserial primary key, recipient_id uuid, type text, title text, body text, link text);
grant usage on schema public, auth to authenticated;
-- La firma vieja (la de foro-mejoras), para comprobar que la 993 la sustituye.
create function public.forum_avisar_suscritos(p_thread uuid, p_post uuid, p_titulo text) returns integer language sql as $$ select -1 $$;
insert into public.user_profiles (id) values
  ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-0000000000c3'), ('00000000-0000-0000-0000-0000000000d4');
insert into public.forum_threads values ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'Mi tema');
insert into public.forum_posts values ('00000000-0000-0000-0000-00000000bbbb', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000b2');
-- A abrió el tema (suscrito solo), C lo sigue, D lo sigue y B es quien responde.
insert into public.forum_subscriptions values
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000c3'),
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000d4');
