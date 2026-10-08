-- Las jornadas de una liga (tandas 634 y 635), contra PostgreSQL.
--
-- En una liga cada jornada se juega con SU lista y se cierra por
-- separado. Aquí se pregunta, en vez de argumentarlo:
--
--   1. ¿Un inscrito manda su lista para una jornada abierta? ¿La cambia?
--      ¿La retira (= no la juega)?
--   2. ¿Y en una jornada cerrada, o con pareos, o que no existe? (no)
--   3. ¿Quién no está inscrito, el retirado, el de la cola? (no)
--   4. ¿Cerrar y reabrir es solo de quien lleva la liga? ¿Reabrir con
--      pareos? (no)
--   5. ¿Las listas de una jornada las ve solo su dueño, el organizador y
--      los jueces? ¿Escribir directo? (no)
--   6. ¿Publicar copia la lista de la jornada a tournament_decklists?
--   7. ¿Una liga empezada admite gente nueva mientras quede una jornada
--      abierta? ¿Y sin ninguna? ¿Y un torneo normal empezado? (no)
--   8. ¿La migración se puede pasar dos veces, y se lleva lo de la 634?
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-jornadas.sql
\set ON_ERROR_STOP off
\set QUIET on
set client_min_messages = notice;

drop schema if exists auth cascade;
create schema auth;
create table auth.yo (uid uuid);
insert into auth.yo values (null);
create or replace function auth.uid() returns uuid language sql stable security definer as $$ select uid from auth.yo $$;
create or replace function public.ponerse(p uuid) returns void language sql security definer as $$ update auth.yo set uid = p $$;

drop table if exists public.tournament_matchday_absences, public.tournament_matchday_decklists,
  public.tournament_matchday_closures, public.tournament_decklists, public.tournament_join_codes,
  public.judge_applications, public.tournaments, public.user_profiles, public.rounds,
  public.tournament_registrations cascade;

create table public.user_profiles (id uuid primary key, username text, is_admin boolean default false,
  is_tournament_admin boolean default false);
create table public.tournaments (
  id uuid primary key, name text, admin_id uuid, format text, status text, swiss_rounds int,
  max_players int, is_private boolean default false);
create table public.tournament_join_codes (tournament_id uuid primary key, code text);
create table public.rounds (
  id uuid primary key, tournament_id uuid, round_number int, status text, phase text default 'swiss');
create table public.tournament_registrations (
  id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid, status text default 'active',
  tcg_live_username text);
create table public.judge_applications (
  id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid, status text default 'pending');
create table public.tournament_decklists (
  id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid, raw_text text not null,
  parsed_cards jsonb not null, submitted_at timestamptz default now(), locked_at timestamptz,
  unique (tournament_id, user_id));
-- Lo que dejó la migración de la 634, para ver que esta se lo lleva.
create table public.tournament_matchday_absences (tournament_id uuid, user_id uuid, matchday int);

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
end $$;
grant authenticated to jugador;

create or replace function public.torneos_soy_admin() returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select exists (select 1 from public.user_profiles p where p.id = auth.uid()
    and (p.is_admin or coalesce(p.is_tournament_admin, false)));
$$;
create or replace function public.torneos_soy_juez(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from judge_applications j
    where j.tournament_id = t and j.user_id = auth.uid() and j.status = 'approved')
$$;
create or replace function public.torneos_mando(p_torneo uuid) returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select public.torneos_soy_admin()
      or exists (select 1 from public.tournaments t where t.id = p_torneo and t.admin_id = auth.uid());
$$;

do $$ declare t text; begin
  foreach t in array array['tournaments','rounds','tournament_registrations','user_profiles',
    'judge_applications','tournament_decklists','tournament_join_codes'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy leer on public.%I for select using (true)', t);
  end loop;
end $$;

-- OAK lleva la liga; BROCK es su juez; ASH, MISTY y GARY juegan (Gary
-- se retiró); ERIKA está en la cola; SABRINA no está.
insert into public.user_profiles (id, username) values
  ('00000000-0000-0000-0000-0000000000a0','oak'),
  ('00000000-0000-0000-0000-0000000000a1','ash'),
  ('00000000-0000-0000-0000-0000000000a2','misty'),
  ('00000000-0000-0000-0000-0000000000a3','brock'),
  ('00000000-0000-0000-0000-0000000000a4','gary'),
  ('00000000-0000-0000-0000-0000000000a5','erika'),
  ('00000000-0000-0000-0000-0000000000a6','sabrina');
insert into public.tournaments (id, name, admin_id, format, status, swiss_rounds) values
  ('00000000-0000-0000-0000-000000000011','La liga','00000000-0000-0000-0000-0000000000a0','league','in_progress',3),
  ('00000000-0000-0000-0000-000000000012','El de un día','00000000-0000-0000-0000-0000000000a0','standard','in_progress',3),
  ('00000000-0000-0000-0000-000000000013','La liga pasada','00000000-0000-0000-0000-0000000000a0','league','finished',3),
  ('00000000-0000-0000-0000-000000000014','La liga sin jornadas abiertas','00000000-0000-0000-0000-0000000000a0','league','in_progress',2);
insert into public.rounds values
  ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011',1,'finished','swiss'),
  ('00000000-0000-0000-0000-000000000024','00000000-0000-0000-0000-000000000014',1,'finished','swiss');
insert into public.tournament_registrations (tournament_id, user_id, status) values
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a1','active'),
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a2','active'),
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a4','dropped'),
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a5','waitlisted'),
  ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-0000000000a1','active'),
  ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-0000000000a1','active');
insert into public.judge_applications (tournament_id, user_id, status) values
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a3','approved');

\i /home/user/pingu/supabase-migration-torneos-jornadas.sql
-- La liga de 2 jornadas: la J2 la ha cerrado el organizador.
insert into public.tournament_matchday_closures (tournament_id, matchday) values ('00000000-0000-0000-0000-000000000014', 2);
-- Dos veces: la migración se tiene que poder repetir.
\i /home/user/pingu/supabase-migration-torneos-jornadas.sql

grant usage on schema public, auth to jugador, anon;
grant select, insert, update, delete on all tables in schema public to jugador;
grant execute on function auth.uid(), public.ponerse(uuid) to jugador, anon;

create or replace function public.error_de(q text) returns text language plpgsql as $$
begin execute q; return 'sin error'; exception when others then return sqlerrm; end $$;
create or replace function public.comprobar(etiqueta text, ok boolean, extra text default '') returns void
language plpgsql as $$
begin
  raise notice '%', (case when coalesce(ok, false) then '  ok  ' else '  FALLA ' end) || etiqueta
    || case when coalesce(extra, '') <> '' then ' — ' || extra else '' end;
end $$;
grant execute on function public.error_de(text), public.comprobar(text, boolean, text) to jugador, anon;

select public.comprobar('la tabla de ausencias de la 634 ya no está', to_regclass('public.tournament_matchday_absences') is null);

\echo '── 1. Ash manda, cambia y retira su lista ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash manda su lista para la jornada 2',
  public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 2, '4 Pikachu SVI 63', '{"total": 4}'::jsonb));
select public.comprobar('  …y la cambia',
  public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 2, '4 Raichu SVI 64', '{"total": 4}'::jsonb));
select public.comprobar('  …sigue habiendo una, con el texto nuevo', count(*) = 1 and min(raw_text) = '4 Raichu SVI 64', count(*)::text)
  from public.tournament_matchday_decklists where user_id = '00000000-0000-0000-0000-0000000000a1' and matchday = 2;
select public.comprobar('manda también la de la J3',
  public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 3, '4 Raichu SVI 64', '{"total": 4}'::jsonb));
select public.comprobar('retirar la de la J3 (= no la juega)',
  public.torneos_quitar_lista_jornada('00000000-0000-0000-0000-000000000011', 3));
select public.comprobar('  …y repetirlo devuelve false, sin error',
  public.torneos_quitar_lista_jornada('00000000-0000-0000-0000-000000000011', 3) = false);
select public.comprobar('una lista vacía, no', e like 'La lista está vacía%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 3, '  ', '{}'::jsonb)$q$) e;
reset role;

\echo '── 2. Las jornadas que no admiten listas ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('la J1, con pareos, no', e like 'Las inscripciones de la jornada 1 están cerradas%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 1, 'x', '{}'::jsonb)$q$) e;
select public.comprobar('una J4 que no existe, no', e like 'Esa jornada no existe%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 4, 'x', '{}'::jsonb)$q$) e;
reset role;

\echo '── 3. Cerrar y reabrir ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash (jugador) no cierra jornadas', e like 'Solo quien lleva la liga%', e)
  from public.error_de($q$select public.torneos_cerrar_jornada('00000000-0000-0000-0000-000000000011', 2, true)$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a0');
set role jugador;
select public.comprobar('Oak cierra la jornada 2',
  public.torneos_cerrar_jornada('00000000-0000-0000-0000-000000000011', 2, true));
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('con la J2 cerrada, Misty ya no manda lista', e like 'Las inscripciones de la jornada 2 están cerradas%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 2, 'x', '{"total": 1}'::jsonb)$q$) e;
select public.comprobar('  …pero la J3 sigue abierta',
  public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 3, '4 Psyduck SVI 1', '{"total": 4}'::jsonb));
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('  …y Ash no retira la suya de la J2 cerrada', e like 'Las inscripciones de la jornada 2 están cerradas%', e)
  from public.error_de($q$select public.torneos_quitar_lista_jornada('00000000-0000-0000-0000-000000000011', 2)$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a0');
set role jugador;
select public.comprobar('Oak la reabre', public.torneos_cerrar_jornada('00000000-0000-0000-0000-000000000011', 2, false));
reset role;
insert into public.rounds values
  ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000011',2,'pending','swiss');
select public.ponerse('00000000-0000-0000-0000-0000000000a0');
set role jugador;
select public.comprobar('con pareos, la J2 no se reabre', e like 'La jornada 2 ya tiene pareos%', e)
  from public.error_de($q$select public.torneos_cerrar_jornada('00000000-0000-0000-0000-000000000011', 2, false)$q$) e;
reset role;

\echo '── 4. Quién no puede mandar listas ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a6');
set role jugador;
select public.comprobar('Sabrina, que no está inscrita, no', e like 'Solo los inscritos%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 3, 'x', '{}'::jsonb)$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a4');
set role jugador;
select public.comprobar('Gary, retirado, no', e like 'Solo los inscritos%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 3, 'x', '{}'::jsonb)$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a5');
set role jugador;
select public.comprobar('Erika, en la cola, no', e like 'Solo los inscritos%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 3, 'x', '{}'::jsonb)$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('en un torneo de un día, no', e like 'Solo las ligas%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000012', 2, 'x', '{}'::jsonb)$q$) e;
select public.comprobar('en una liga terminada, no', e like 'La liga no admite listas%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000013', 2, 'x', '{}'::jsonb)$q$) e;
select public.comprobar('escribiendo directo en la tabla, no', e <> 'sin error', e)
  from public.error_de($q$insert into public.tournament_matchday_decklists (tournament_id, user_id, matchday, raw_text, parsed_cards)
    values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a1', 3, 'x', '{}')$q$) e;
reset role;
select public.ponerse(null);
set role anon;
select public.comprobar('anon no puede mandar listas', e like '%permission denied%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 3, 'x', '{}'::jsonb)$q$) e;
select public.comprobar('anon NO lee las listas de las jornadas', e like '%permission denied%', e)
  from public.error_de($q$select count(*) from public.tournament_matchday_decklists$q$) e;
select public.comprobar('  …pero sí qué jornadas están cerradas', e = 'sin error', e)
  from public.error_de($q$select count(*) from public.tournament_matchday_closures$q$) e;
reset role;

\echo '── 5. Quién ve las listas de una jornada ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty ve solo la suya (no la de Ash)', count(*) = 1 and bool_and(user_id = '00000000-0000-0000-0000-0000000000a2'), count(*)::text)
  from public.tournament_matchday_decklists;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a0');
set role jugador;
select public.comprobar('Oak, que lleva la liga, las ve todas', count(*) = 2, count(*)::text)
  from public.tournament_matchday_decklists;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a3');
set role jugador;
select public.comprobar('Brock, juez, también', count(*) = 2, count(*)::text)
  from public.tournament_matchday_decklists;
reset role;

\echo '── 6. Publicar las listas de la jornada al emparejarla ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash no publica', e like 'Solo quien lleva la liga%', e)
  from public.error_de($q$select public.torneos_publicar_listas_jornada('00000000-0000-0000-0000-000000000011', 2)$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a0');
set role jugador;
select public.comprobar('Oak publica la J2 (la de Ash)',
  public.torneos_publicar_listas_jornada('00000000-0000-0000-0000-000000000011', 2) = 1);
reset role;
select public.comprobar('  …y la lista de Ash es la de la J2, sellada', raw_text = '4 Raichu SVI 64' and locked_at is not null, raw_text)
  from public.tournament_decklists where user_id = '00000000-0000-0000-0000-0000000000a1';
select public.comprobar('  …y la de Misty para la J3 no se publica antes de tiempo', count(*) = 0, count(*)::text)
  from public.tournament_decklists where user_id = '00000000-0000-0000-0000-0000000000a2';

\echo '── 7. Entrar en una liga que ya ha empezado ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a6');
set role jugador;
select public.comprobar('Sabrina entra en la liga en juego (le queda la J3)',
  public.torneos_inscribirse('00000000-0000-0000-0000-000000000011', 'Sabrina99') is not null);
select public.comprobar('  …y puede mandar su lista de la J3',
  public.torneos_lista_jornada('00000000-0000-0000-0000-000000000011', 3, '4 Abra SVI 2', '{"total": 4}'::jsonb));
select public.comprobar('en un torneo normal en juego, no', e like 'Las inscripciones no están abiertas%', e)
  from public.error_de($q$select public.torneos_inscribirse('00000000-0000-0000-0000-000000000012', 'Sabrina99')$q$) e;
select public.comprobar('en una liga sin jornadas abiertas, no', e like 'Las inscripciones no están abiertas%', e)
  from public.error_de($q$select public.torneos_inscribirse('00000000-0000-0000-0000-000000000014', 'Sabrina99')$q$) e;
reset role;
