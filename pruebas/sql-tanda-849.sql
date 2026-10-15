-- Tanda 849 — rondas por jornada, contra PostgreSQL. Una liga de 3 jornadas
-- de 3 rondas (9 en total) con la J1 ya jugada (rondas 1–3).
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-849.sql
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


-- El límite viejo de 12 rondas, con un nombre que NO es el de siempre: la
-- migración tiene que quitarlo por lo que comprueba.
alter table public.tournaments add constraint un_nombre_cualquiera check (swiss_rounds between 1 and 12);
\i /home/user/pingu/supabase-migration-torneos-jornadas.sql
\i /home/user/pingu/supabase-migration-torneos-rondas-jornada.sql
\i /home/user/pingu/supabase-migration-torneos-rondas-jornada.sql

insert into public.tournaments (id, name, admin_id, format, status, swiss_rounds, rounds_per_matchday) values
  ('00000000-0000-0000-0000-000000000031','La liga de tres','00000000-0000-0000-0000-0000000000a0','league','in_progress',9,3),
  ('00000000-0000-0000-0000-000000000032','La liga llena','00000000-0000-0000-0000-0000000000a0','league','in_progress',6,3);
insert into public.rounds values
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000031',1,'finished','swiss'),(gen_random_uuid(),'00000000-0000-0000-0000-000000000031',2,'finished','swiss'),(gen_random_uuid(),'00000000-0000-0000-0000-000000000031',3,'finished','swiss'),
  (gen_random_uuid(),'00000000-0000-0000-0000-000000000032',1,'finished','swiss'),(gen_random_uuid(),'00000000-0000-0000-0000-000000000032',4,'pending','swiss');
insert into public.tournament_registrations (tournament_id, user_id, status) values
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000a1','active'),('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-0000000000a2','active');

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


\echo '── 1. Las cuentas ──'
select public.comprobar('la columna nace a 1 en lo que ya había', (select rounds_per_matchday from tournaments where id = '00000000-0000-0000-0000-000000000011') = 1);
select public.comprobar('9 rondas de 3 son 3 jornadas', public.torneos_num_jornadas('00000000-0000-0000-0000-000000000031') = 3);
select public.comprobar('una liga de antes: 3 rondas, 3 jornadas', public.torneos_num_jornadas('00000000-0000-0000-0000-000000000011') = 3);
select public.comprobar('la J1 tiene rondas (la 1, 2 y 3)', public.torneos_jornada_con_rondas('00000000-0000-0000-0000-000000000031', 1));
select public.comprobar('  …la J2 todavía no (sus rondas son la 4, 5 y 6)', not public.torneos_jornada_con_rondas('00000000-0000-0000-0000-000000000031', 2));
select public.comprobar('en una liga de antes, la J2 es la ronda 2', not public.torneos_jornada_con_rondas('00000000-0000-0000-0000-000000000011', 2) and public.torneos_jornada_con_rondas('00000000-0000-0000-0000-000000000011', 1));

\echo '── 2. Las listas, por jornada ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash no manda lista para la J1 (ya se jugó)', e like 'Las inscripciones de la jornada 1 están cerradas%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000031', 1, 'x', '{}'::jsonb)$q$) e;
select public.comprobar('  …sí para la J2', public.torneos_lista_jornada('00000000-0000-0000-0000-000000000031', 2, '4 Pikachu SVI 63', '{"total": 4}'::jsonb));
select public.comprobar('  …y para la J3, que es la última', public.torneos_lista_jornada('00000000-0000-0000-0000-000000000031', 3, '4 Pikachu SVI 63', '{"total": 4}'::jsonb));
select public.comprobar('  …pero no para una J4, que no existe (9 rondas / 3 = 3 jornadas)', e like 'Esa jornada no existe%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000031', 4, 'x', '{"total": 1}'::jsonb)$q$) e;
reset role;

\echo '── 3. Cerrar y reabrir una jornada de varias rondas ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a0');
set role jugador;
select public.comprobar('Oak cierra la J2', public.torneos_cerrar_jornada('00000000-0000-0000-0000-000000000031', 2, true));
select public.comprobar('  …y la reabre (aún sin rondas)', public.torneos_cerrar_jornada('00000000-0000-0000-0000-000000000031', 2, false));
reset role;
insert into public.rounds values (gen_random_uuid(),'00000000-0000-0000-0000-000000000031',5,'pending','swiss');
select public.ponerse('00000000-0000-0000-0000-0000000000a0');
set role jugador;
select public.comprobar('con la ronda 5 hecha (es de la J2), ya no se reabre', e like 'La jornada 2 ya tiene pareos%', e)
  from public.error_de($q$select public.torneos_cerrar_jornada('00000000-0000-0000-0000-000000000031', 2, false)$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('  …y no admite listas (Misty, inscrita)', e like 'Las inscripciones de la jornada 2 están cerradas%', e)
  from public.error_de($q$select public.torneos_lista_jornada('00000000-0000-0000-0000-000000000031', 2, 'x', '{"total": 1}'::jsonb)$q$) e;
reset role;

\echo '── 4. Apuntarse tarde ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a6');
set role jugador;
select public.comprobar('Sabrina entra en la liga de tres: le queda la J3', public.torneos_inscribirse('00000000-0000-0000-0000-000000000031', 'SABRINA') is not null);
select public.comprobar('  …pero no en la llena: sus dos jornadas tienen rondas (la 1 y la 4)', e like 'Las inscripciones no están abiertas%', e)
  from public.error_de($q$select public.torneos_inscribirse('00000000-0000-0000-0000-000000000032', 'SABRINA')$q$) e;
reset role;

\echo '── 5. Los límites ──'
select public.comprobar('una liga de 10 × 3 (30 rondas) se puede guardar', e = 'sin error', e)
  from public.error_de($q$update public.tournaments set swiss_rounds = 30 where id = '00000000-0000-0000-0000-000000000031'$q$) e;
select public.comprobar('  …más de 60, no', e like '%swiss_rounds%', e)
  from public.error_de($q$update public.tournaments set swiss_rounds = 61 where id = '00000000-0000-0000-0000-000000000031'$q$) e;
select public.comprobar('  …ni 6 rondas por jornada', e like '%rounds_per_matchday%', e)
  from public.error_de($q$update public.tournaments set rounds_per_matchday = 6 where id = '00000000-0000-0000-0000-000000000031'$q$) e;
select public.comprobar('ya no queda el límite viejo de 12', not exists (select 1 from pg_constraint where conrelid = 'public.tournaments'::regclass and pg_get_constraintdef(oid) ilike '%12%' and pg_get_constraintdef(oid) ilike '%swiss_rounds%'));
