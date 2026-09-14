-- El rol de organizador de torneos (tanda 295), contra PostgreSQL.
--
-- Tres preguntas, y las tres se responden aquí en vez de argumentarlas:
--
--   1. ¿Un organizador manda de verdad en los torneos de OTROS?
--   2. ¿Puede marcar un torneo como OFICIAL de PokeDoc? (no debe)
--   3. ¿Puede darse el rol a sí mismo, o dárselo a un amigo? (no debe)
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-organizadores.sql
\set ON_ERROR_STOP off
\set QUIET on

drop schema if exists auth cascade;
create schema auth;
create table auth.yo (uid uuid);
insert into auth.yo values (null);
create or replace function auth.uid() returns uuid language sql stable security definer as $$ select uid from auth.yo $$;
create or replace function public.ponerse(p uuid) returns void language sql security definer as $$ update auth.yo set uid = p $$;

drop table if exists public.tournaments, public.user_profiles cascade;
create table public.user_profiles (
  id uuid primary key, username text, is_admin boolean default false,
  is_tournament_admin boolean default false, forum_title text, is_moderator boolean default false);
create table public.tournaments (
  id uuid primary key default gen_random_uuid(), name text, admin_id uuid,
  is_official boolean not null default false);

create or replace function public.is_admin() returns boolean language sql stable security definer as $$
  select coalesce((select is_admin from public.user_profiles where id = auth.uid()), false) $$;

insert into public.user_profiles (id, username, is_admin, is_tournament_admin) values
  ('00000000-0000-0000-0000-0000000000a1','pingu',    true,  false),
  ('00000000-0000-0000-0000-0000000000a2','presidente',false, true),
  ('00000000-0000-0000-0000-0000000000b1','ash',      false, false);

-- Un torneo de PINGU, que el organizador NO ha creado.
insert into public.tournaments (id, name, admin_id, is_official)
  values ('00000000-0000-0000-0000-000000000011','Copa de PINGU','00000000-0000-0000-0000-0000000000a1', true);

alter table public.user_profiles enable row level security;
alter table public.tournaments enable row level security;
create policy perfiles_leer on public.user_profiles for select using (true);
-- A propósito, el caso MALO: que cada cual pueda editar su propia fila.
-- Es lo que no se puede comprobar desde el repositorio, así que se
-- supone lo peor y se comprueba que el disparador aguante igual.
create policy perfiles_editar on public.user_profiles for update
  using (id = auth.uid()) with check (id = auth.uid());
create policy torneos_leer on public.tournaments for select using (true);

\i /home/user/pingu/supabase-migration-torneos-organizadores.sql

-- La política de escritura de torneos, como en producción (tanda 266).
create policy torneos_escribir on public.tournaments for all
  using (torneos_soy_admin() or admin_id = auth.uid())
  with check (torneos_soy_admin() or admin_id = auth.uid());

create role jugador nologin;
grant usage on schema public, auth to jugador;
grant select, insert, update on all tables in schema public to jugador;
grant execute on all functions in schema public, auth to jugador;
\set QUIET off

\echo ''
\echo '════ 1. El organizador manda en el torneo de PINGU ════'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
update public.tournaments set name = 'Copa, llevada por el equipo'
  where id = '00000000-0000-0000-0000-000000000011';
reset role;
select name from public.tournaments where id = '00000000-0000-0000-0000-000000000011';

\echo ''
\echo '════ 2. Pero un jugador normal, NO ════'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
update public.tournaments set name = 'me la apropio'
  where id = '00000000-0000-0000-0000-000000000011';
reset role;
select name from public.tournaments where id = '00000000-0000-0000-0000-000000000011';

\echo ''
\echo '════ 3. El organizador NO puede marcar OFICIAL ════'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
insert into public.tournaments (name, admin_id, is_official)
  values ('Torneo del equipo','00000000-0000-0000-0000-0000000000a2', true);
reset role;
select name, is_official from public.tournaments where name = 'Torneo del equipo';

\echo ''
\echo '════ 4. Y PINGU sí ════'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
insert into public.tournaments (name, admin_id, is_official)
  values ('Torneo de la casa','00000000-0000-0000-0000-0000000000a1', true);
reset role;
select name, is_official from public.tournaments where name = 'Torneo de la casa';

\echo ''
\echo '════ 5. Nadie se da el rol a sí mismo ════'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
update public.user_profiles set is_admin = true, is_tournament_admin = true
  where id = '00000000-0000-0000-0000-0000000000b1';
reset role;
select username, is_admin, is_tournament_admin from public.user_profiles where username = 'ash';

\echo ''
\echo '════ 6. Ni el organizador reparte el rol ════'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
update public.user_profiles set is_tournament_admin = true
  where id = '00000000-0000-0000-0000-0000000000b1';
reset role;
select username, is_tournament_admin from public.user_profiles where username = 'ash';
