-- «Quien crea un torneo, lo lleva» (tanda 296), contra PostgreSQL.
--
-- Seis preguntas, respondidas en vez de argumentadas:
--
--   1. ¿El CREADOR puede dar de baja a un inscrito de SU torneo? (antes no)
--   2. ¿Y ver las decklists de SU torneo, para el deck check?
--   3. ¿Y nombrar jueces de SU torneo?
--   4. ¿Se queda fuera del torneo de OTRO? (tiene que quedarse fuera)
--   5. ¿Sigue sin poder ponerle el sello de OFICIAL a lo suyo?
--   6. ¿Sigue cerrada la puerta de atrás de los chats (tanda 294)?
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-dueno.sql
\set ON_ERROR_STOP off
\set QUIET on

drop schema if exists auth cascade;
create schema auth;
create table auth.yo (uid uuid);
insert into auth.yo values (null);
create or replace function auth.uid() returns uuid language sql stable security definer as $$ select uid from auth.yo $$;
create or replace function public.ponerse(p uuid) returns void language sql security definer as $$ update auth.yo set uid = p $$;

drop table if exists public.tournaments, public.user_profiles, public.rounds,
  public.tournament_matches, public.match_results, public.pairing_history,
  public.tournament_registrations, public.tournament_decklists,
  public.judge_applications, public.judge_calls, public.judge_messages,
  public.match_messages, public.match_reports cascade;

create table public.user_profiles (
  id uuid primary key, username text, is_admin boolean default false,
  is_tournament_admin boolean default false);
create table public.tournaments (
  id uuid primary key, name text, admin_id uuid, slug text, status text default 'in_progress',
  decklist_visibility text default 'al_terminar', is_official boolean not null default false);
create table public.rounds (id uuid primary key, tournament_id uuid, number int);
create table public.tournament_matches (
  id uuid primary key, round_id uuid, player_a_id uuid, player_b_id uuid);
create table public.match_results (id uuid primary key default gen_random_uuid(), match_id uuid, result text);
create table public.pairing_history (id uuid primary key default gen_random_uuid(), tournament_id uuid);
create table public.tournament_registrations (
  id uuid primary key, tournament_id uuid, user_id uuid, status text default 'active',
  dropped_at timestamptz, participation_confirmed_at timestamptz);
create table public.tournament_decklists (
  id uuid primary key, tournament_id uuid, user_id uuid, content text, locked_at timestamptz);
create table public.judge_applications (
  id uuid primary key, tournament_id uuid, user_id uuid, status text default 'pending');
create table public.judge_calls (
  id uuid primary key, tournament_id uuid, match_id uuid, created_by uuid, status text default 'open',
  assigned_judge_id uuid);
create table public.judge_messages (id uuid primary key default gen_random_uuid(), judge_call_id uuid, sender_id uuid, message text);
create table public.match_messages (id uuid primary key default gen_random_uuid(), match_id uuid, sender_id uuid, message text);
create table public.match_reports (id uuid primary key default gen_random_uuid(), match_id uuid, reporter_id uuid, result text);

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
end $$;

-- Con `drop function` delante: `create or replace` no puede cambiarle el
-- nombre a un parámetro, y estas quedan de la pasada anterior.
drop function if exists public.torneos_soy_admin() cascade;
drop function if exists public.torneos_soy_juez(uuid) cascade;
drop function if exists public.torneos_es_mio(uuid) cascade;
drop function if exists public.torneos_mando(uuid) cascade;
drop function if exists public.torneos_soy_admin_del_sitio() cascade;

-- Las funciones de las que cuelga todo, como en producción.
create or replace function public.torneos_soy_admin() returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select exists (select 1 from public.user_profiles p where p.id = auth.uid()
    and (p.is_admin or coalesce(p.is_tournament_admin, false)));
$$;
create or replace function public.torneos_soy_juez(p_torneo uuid) returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select exists (select 1 from public.judge_applications j
    where j.tournament_id = p_torneo and j.user_id = auth.uid() and j.status = 'approved');
$$;
create or replace function public.torneos_es_mio(p_torneo uuid) returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select exists (select 1 from public.tournaments t where t.id = p_torneo and t.admin_id = auth.uid());
$$;
create or replace function public.torneos_soy_admin_del_sitio() returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select coalesce((select p.is_admin from public.user_profiles p where p.id = auth.uid()), false);
$$;
create or replace function public.torneos_solo_admin_marca_oficial() returns trigger
language plpgsql security definer set search_path = public, pg_catalog as $$
begin
  if auth.uid() is not null and not public.torneos_soy_admin_del_sitio() then
    new.is_official := coalesce(old.is_official, false);
  end if;
  return new;
end $$;
create trigger trg_oficial before insert or update on public.tournaments
  for each row execute function public.torneos_solo_admin_marca_oficial();

-- Gente: PINGU (admin), ASH (crea su torneo), MISTY y BROCK (juegan),
-- y GARY, que no pinta nada en ningún torneo.
insert into public.user_profiles (id, username, is_admin) values
  ('00000000-0000-0000-0000-0000000000a1','pingu', true),
  ('00000000-0000-0000-0000-0000000000b1','ash',   false),
  ('00000000-0000-0000-0000-0000000000b2','misty', false),
  ('00000000-0000-0000-0000-0000000000b3','brock', false),
  ('00000000-0000-0000-0000-0000000000c1','gary',  false);

-- El torneo de ASH, y otro de PINGU donde Ash no pinta nada.
insert into public.tournaments (id, name, admin_id, slug) values
  ('00000000-0000-0000-0000-000000000011','La pachanga de Ash','00000000-0000-0000-0000-0000000000b1','pachanga'),
  ('00000000-0000-0000-0000-000000000012','Copa de PINGU',     '00000000-0000-0000-0000-0000000000a1','copa');
insert into public.rounds values ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011',1);
insert into public.tournament_matches values
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000021',
   '00000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000b3');
insert into public.tournament_registrations (id, tournament_id, user_id) values
  ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000b2'),
  ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-0000000000b2');
insert into public.tournament_decklists (id, tournament_id, user_id, content) values
  ('00000000-0000-0000-0000-000000000051','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000b2','4 Pikachu');
insert into public.judge_applications (id, tournament_id, user_id) values
  ('00000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000b3');
insert into public.judge_calls (id, tournament_id, match_id, created_by) values
  ('00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000011',
   '00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000b2');

do $$ declare t text; begin
  foreach t in array array['tournaments','rounds','tournament_matches','match_results','pairing_history',
    'tournament_registrations','tournament_decklists','judge_applications','judge_calls',
    'judge_messages','match_messages','match_reports','user_profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy leer on public.%I for select using (true)', t);
  end loop;
end $$;
-- La de tournaments se sustituye por la de verdad más abajo; esta es
-- para que las funciones de apoyo puedan leer.

\i /home/user/pingu/supabase-migration-torneos-dueno.sql

grant usage on schema public, auth to jugador;
grant select, insert, update, delete on all tables in schema public to jugador;
grant execute on all functions in schema public, auth to jugador;
\set QUIET off

\echo ''
\echo '════ 1. ASH da de baja a Misty en SU torneo (antes no podía) ════'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
update public.tournament_registrations set status = 'dropped', dropped_at = now()
  where id = '00000000-0000-0000-0000-000000000041';
reset role;

\echo ''
\echo '════ 2. ASH ve la decklist de Misty en SU torneo (deck check) ════'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
select content as lista_que_ve_ash from public.tournament_decklists
 where tournament_id = '00000000-0000-0000-0000-000000000011';
reset role;

\echo ''
\echo '════ 3. ASH aprueba a Brock como juez de SU torneo ════'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
update public.judge_applications set status = 'approved'
  where id = '00000000-0000-0000-0000-000000000061';
reset role;
select status as solicitud_de_brock from public.judge_applications
 where id = '00000000-0000-0000-0000-000000000061';

\echo ''
\echo '════ 4. ASH NO manda en el torneo de PINGU (tiene que dar 0) ════'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
update public.tournament_registrations set status = 'dropped'
  where id = '00000000-0000-0000-0000-000000000042';
update public.tournaments set name = 'secuestrada'
  where id = '00000000-0000-0000-0000-000000000012';
reset role;
select name as copa_de_pingu from public.tournaments where id = '00000000-0000-0000-0000-000000000012';

\echo ''
\echo '════ 5. ASH NO puede ponerle el sello de OFICIAL a lo suyo ════'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
update public.tournaments set is_official = true where id = '00000000-0000-0000-0000-000000000011';
reset role;
select is_official as sello_del_torneo_de_ash from public.tournaments
 where id = '00000000-0000-0000-0000-000000000011';

\echo ''
\echo '════ 6. GARY sigue sin poder escribir en la mesa de Misty y Brock ════'
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
set role jugador;
insert into public.match_messages (match_id, sender_id, message)
  values ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000c1','hola');
insert into public.judge_messages (judge_call_id, sender_id, message)
  values ('00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-0000000000c1','hola');
reset role;

\echo ''
\echo '════ 7. …y ASH, que lleva el torneo, SÍ escribe en esa mesa ════'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
insert into public.match_messages (match_id, sender_id, message)
  values ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000b1','soy el organizador');
reset role;

\echo ''
\echo '════ Resumen ════'
select
  (select status from public.tournament_registrations where id = '00000000-0000-0000-0000-000000000041') as misty_en_el_torneo_de_ash,
  (select status from public.tournament_registrations where id = '00000000-0000-0000-0000-000000000042') as misty_en_el_de_pingu,
  (select count(*) from public.match_messages) as mensajes_en_la_mesa;
