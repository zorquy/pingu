-- «Tus jornadas» de una liga (tanda 634), contra PostgreSQL.
--
-- La migración da UNA función (torneos_jornada) y una tabla que solo se
-- lee. Aquí se pregunta, en vez de argumentarlo:
--
--   1. ¿Un inscrito se desapunta de una jornada sin pareos? ¿Y vuelve?
--   2. ¿Repetirlo no rompe nada? (false, sin error)
--   3. ¿Y una jornada con pareos? ¿Una que no existe? (no)
--   4. ¿Quien no está inscrito, el retirado, el de la cola? (no)
--   5. ¿En un torneo que no es liga, o una liga terminada? (no)
--   6. ¿Sin cuenta? (no) ¿Escribiendo directo en la tabla? (no)
--   7. ¿Se lee la tabla sin ser nadie? (sí: el pareo la necesita)
--   8. ¿La migración se puede pasar dos veces?
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

drop table if exists public.tournament_matchday_absences, public.tournaments, public.user_profiles, public.rounds,
  public.tournament_registrations cascade;

create table public.user_profiles (id uuid primary key, username text);
create table public.tournaments (
  id uuid primary key, name text, admin_id uuid, format text, status text, swiss_rounds int);
create table public.rounds (
  id uuid primary key, tournament_id uuid, round_number int, status text, phase text default 'swiss');
create table public.tournament_registrations (
  id uuid primary key, tournament_id uuid, user_id uuid, status text default 'active');

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
end $$;
grant authenticated to jugador;

do $$ declare t text; begin
  foreach t in array array['tournaments','rounds','tournament_registrations','user_profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy leer on public.%I for select using (true)', t);
  end loop;
end $$;

-- ASH, MISTY y BROCK juegan la liga; GARY se retiró; ERIKA está en la
-- cola; SABRINA no está apuntada.
insert into public.user_profiles (id, username) values
  ('00000000-0000-0000-0000-0000000000a1','ash'),
  ('00000000-0000-0000-0000-0000000000a2','misty'),
  ('00000000-0000-0000-0000-0000000000a3','brock'),
  ('00000000-0000-0000-0000-0000000000a4','gary'),
  ('00000000-0000-0000-0000-0000000000a5','erika'),
  ('00000000-0000-0000-0000-0000000000a6','sabrina');
insert into public.tournaments values
  ('00000000-0000-0000-0000-000000000011','La liga','00000000-0000-0000-0000-0000000000a6','league','in_progress',3),
  ('00000000-0000-0000-0000-000000000012','El de un día','00000000-0000-0000-0000-0000000000a6','standard','in_progress',3),
  ('00000000-0000-0000-0000-000000000013','La liga pasada','00000000-0000-0000-0000-0000000000a6','league','finished',3);
insert into public.rounds values
  ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011',1,'finished','swiss');
insert into public.tournament_registrations (id, tournament_id, user_id, status) values
  ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a1','active'),
  ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a2','active'),
  ('00000000-0000-0000-0000-000000000043','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a3','active'),
  ('00000000-0000-0000-0000-000000000044','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a4','dropped'),
  ('00000000-0000-0000-0000-000000000045','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a5','waitlisted'),
  ('00000000-0000-0000-0000-000000000046','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-0000000000a1','active'),
  ('00000000-0000-0000-0000-000000000047','00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-0000000000a1','active');

\i /home/user/pingu/supabase-migration-torneos-jornadas.sql
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

\echo '── 1. Ash se desapunta de la J2 y vuelve ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash se desapunta de la jornada 2',
  public.torneos_jornada('00000000-0000-0000-0000-000000000011', 2, false));
select public.comprobar('  …y queda apuntado que no la juega', count(*) = 1, count(*)::text)
  from public.tournament_matchday_absences
  where user_id = '00000000-0000-0000-0000-0000000000a1' and matchday = 2;
select public.comprobar('repetirlo devuelve false, sin error',
  public.torneos_jornada('00000000-0000-0000-0000-000000000011', 2, false) = false);
select public.comprobar('volver a apuntarse la borra',
  public.torneos_jornada('00000000-0000-0000-0000-000000000011', 2, true));
select public.comprobar('  …y no queda ninguna', count(*) = 0, count(*)::text)
  from public.tournament_matchday_absences where user_id = '00000000-0000-0000-0000-0000000000a1';
select public.comprobar('apuntarse a una que ya jugaba devuelve false',
  public.torneos_jornada('00000000-0000-0000-0000-000000000011', 3, true) = false);
reset role;

\echo '── 2. Las jornadas que no se pueden cambiar ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('la J1, con pareos, no', e like 'La jornada 1 ya ha empezado%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000011', 1, false)$q$) e;
select public.comprobar('una J4 que no existe, no', e like 'Esa jornada no existe%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000011', 4, false)$q$) e;
select public.comprobar('ni la J0', e like 'Esa jornada no existe%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000011', 0, false)$q$) e;
reset role;
-- El organizador genera los pareos de la J2: desde ese momento, cerrada.
insert into public.rounds values
  ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000011',2,'pending','swiss');
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('con los pareos de la J2 generados, Misty ya no se desapunta', e like 'La jornada 2 ya ha empezado%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000011', 2, false)$q$) e;
reset role;
delete from public.rounds where id = '00000000-0000-0000-0000-000000000022';
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('  …y si los deshace, vuelve a poder',
  public.torneos_jornada('00000000-0000-0000-0000-000000000011', 2, false));
reset role;

\echo '── 3. Quién no puede ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a6');
set role jugador;
select public.comprobar('Sabrina, que no está inscrita, no', e like 'Solo los inscritos%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000011', 3, false)$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a4');
set role jugador;
select public.comprobar('Gary, retirado, no', e like 'Solo los inscritos%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000011', 3, false)$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a5');
set role jugador;
select public.comprobar('Erika, en la cola, no', e like 'Solo los inscritos%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000011', 3, false)$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('en un torneo de un día, no', e like 'Solo las ligas%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000012', 2, false)$q$) e;
select public.comprobar('en una liga terminada, no', e like 'La liga ya no está en juego%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000013', 2, false)$q$) e;
select public.comprobar('escribiendo directo en la tabla, no (solo por la función)', e <> 'sin error', e)
  from public.error_de($q$insert into public.tournament_matchday_absences (tournament_id, user_id, matchday)
    values ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000a3', 3)$q$) e;
select public.error_de($q$delete from public.tournament_matchday_absences where user_id = '00000000-0000-0000-0000-0000000000a2'$q$);
select public.comprobar('  …ni borrando la de otro', count(*) = 1, count(*)::text)
  from public.tournament_matchday_absences where user_id = '00000000-0000-0000-0000-0000000000a2';
reset role;
select public.ponerse(null);
set role jugador;
select public.comprobar('sin cuenta, no', e like 'Entra en tu cuenta%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000011', 3, false)$q$) e;
reset role;
set role anon;
select public.comprobar('anon no puede ni llamarla', e like '%permission denied%', e)
  from public.error_de($q$select public.torneos_jornada('00000000-0000-0000-0000-000000000011', 3, false)$q$) e;
select public.comprobar('pero anon SÍ lee quién no juega (el escaparate y el pareo)', count(*) = 1, count(*)::text)
  from public.tournament_matchday_absences;
reset role;
