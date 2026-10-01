-- «Lo que hace un juez el día del torneo» (tanda 394), contra PostgreSQL.
--
-- La migración le da al juez DOS funciones y nada más: dar de baja a un
-- jugador y resolver una mesa viva. Aquí se pregunta, en vez de
-- argumentarlo:
--
--   1. ¿Un juez APROBADO de ESE torneo puede dar de baja? (antes no)
--   2. ¿Y repetirla no rompe nada? (devuelve false, sin error)
--   3. ¿Un juez de OTRO torneo, un jugador o un juez pendiente? (no)
--   4. ¿Quien lleva el torneo sigue pudiendo? (sí)
--   5. ¿Un juez resuelve una mesa VIVA, con su ganador y su firma?
--   6. ¿Y NO puede corregir una cerrada, ni empatar en el corte, ni
--      tocar una ronda que no está en juego, ni la mesa de otro torneo?
--   7. ¿Las puede llamar alguien sin cuenta? (no)
--
-- Cada comprobación dice «ok» o «FALLA»: la prueba del navegador
-- (test-tanda-394.mjs) corre esto y busca la palabra.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-jueces.sql
\set ON_ERROR_STOP off
\set QUIET on
set client_min_messages = notice;

drop schema if exists auth cascade;
create schema auth;
create table auth.yo (uid uuid);
insert into auth.yo values (null);
create or replace function auth.uid() returns uuid language sql stable security definer as $$ select uid from auth.yo $$;
create or replace function public.ponerse(p uuid) returns void language sql security definer as $$ update auth.yo set uid = p $$;

drop table if exists public.tournaments, public.user_profiles, public.rounds,
  public.tournament_matches, public.match_results, public.tournament_registrations,
  public.judge_applications cascade;

create table public.user_profiles (
  id uuid primary key, username text, is_admin boolean default false,
  is_tournament_admin boolean default false);
create table public.tournaments (
  id uuid primary key, name text, admin_id uuid, current_round_id uuid);
create table public.rounds (
  id uuid primary key, tournament_id uuid, round_number int, status text, phase text default 'swiss');
create table public.tournament_matches (
  id uuid primary key, round_id uuid, table_number int, player_a_id uuid, player_b_id uuid,
  status text default 'active', check_in_a_at timestamptz, check_in_b_at timestamptz, finished_at timestamptz);
create table public.match_results (
  id uuid primary key default gen_random_uuid(), match_id uuid unique, result text, winner_id uuid,
  resolved_by uuid, resolved_at timestamptz default now());
create table public.tournament_registrations (
  id uuid primary key, tournament_id uuid, user_id uuid, status text default 'active',
  dropped_at timestamptz, dropped_after_round_id uuid);
create table public.judge_applications (
  id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid, status text default 'pending');

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
end $$;
grant authenticated to jugador;

drop function if exists public.torneos_soy_admin() cascade;
drop function if exists public.torneos_soy_juez(uuid) cascade;
drop function if exists public.torneos_mando(uuid) cascade;
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

-- Las tablas con RLS y SIN políticas de escritura: si las funciones
-- escriben, es por ser `security definer`, no porque la tabla esté
-- abierta. Un juez no puede escribir directo (eso no cambia).
do $$ declare t text; begin
  foreach t in array array['tournaments','rounds','tournament_matches','match_results',
    'tournament_registrations','judge_applications','user_profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy leer on public.%I for select using (true)', t);
  end loop;
end $$;

-- Gente: ASH crea el torneo; BROCK es su juez aprobado; MISTY pidió
-- serlo y está pendiente; ERIKA es jueza de OTRO torneo; GARY, SABRINA
-- y BLAINE juegan.
insert into public.user_profiles (id, username) values
  ('00000000-0000-0000-0000-0000000000b1','ash'),
  ('00000000-0000-0000-0000-0000000000b2','misty'),
  ('00000000-0000-0000-0000-0000000000b3','brock'),
  ('00000000-0000-0000-0000-0000000000b4','erika'),
  ('00000000-0000-0000-0000-0000000000c1','gary'),
  ('00000000-0000-0000-0000-0000000000c2','sabrina'),
  ('00000000-0000-0000-0000-0000000000c3','blaine');
insert into public.tournaments values
  ('00000000-0000-0000-0000-000000000011','La pachanga de Ash','00000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-000000000022'),
  ('00000000-0000-0000-0000-000000000012','La de otro',        '00000000-0000-0000-0000-0000000000c3', null);
insert into public.rounds values
  ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011',1,'finished','swiss'),
  ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000011',2,'active','swiss'),
  ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000011',3,'active','top_cut'),
  ('00000000-0000-0000-0000-000000000029','00000000-0000-0000-0000-000000000012',1,'active','swiss');
insert into public.tournament_matches (id, round_id, table_number, player_a_id, player_b_id, status) values
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000022',1,
   '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2','active'),
  ('00000000-0000-0000-0000-000000000032','00000000-0000-0000-0000-000000000023',1,
   '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2','active'),
  ('00000000-0000-0000-0000-000000000033','00000000-0000-0000-0000-000000000021',1,
   '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2','active'),
  ('00000000-0000-0000-0000-000000000039','00000000-0000-0000-0000-000000000029',1,
   '00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000c2','active');
insert into public.tournament_registrations (id, tournament_id, user_id) values
  ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000c1'),
  ('00000000-0000-0000-0000-000000000042','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000c2'),
  ('00000000-0000-0000-0000-000000000043','00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000c3');
insert into public.judge_applications (tournament_id, user_id, status) values
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000b3','approved'),
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-0000000000b2','pending'),
  ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-0000000000b4','approved');

\i /home/user/pingu/supabase-migration-torneos-jueces.sql

grant usage on schema public, auth to jugador;
grant select, insert, update, delete on all tables in schema public to jugador;
grant execute on function auth.uid(), public.ponerse(uuid) to jugador;

-- Las dos ayudas de la prueba: una que devuelve el error de una frase
-- (o 'sin error'), y otra que dice ok / FALLA.
create or replace function public.error_de(q text) returns text language plpgsql as $$
begin execute q; return 'sin error'; exception when others then return sqlerrm; end $$;
create or replace function public.comprobar(etiqueta text, ok boolean, extra text default '') returns void
language plpgsql as $$
begin
  raise notice '%', (case when coalesce(ok, false) then '  ok  ' else '  FALLA ' end) || etiqueta
    || case when coalesce(extra, '') <> '' then ' — ' || extra else '' end;
end $$;
grant execute on function public.error_de(text), public.comprobar(text, boolean, text) to jugador;

\echo '── 1. Un juez aprobado da de baja ──'
select public.ponerse('00000000-0000-0000-0000-0000000000b3');
set role jugador;
select public.comprobar('Brock (juez) da de baja a Gary', public.torneos_dar_de_baja('00000000-0000-0000-0000-000000000041'));
reset role;
select public.comprobar('  …y queda de baja, apuntada en la ronda en juego',
  status = 'dropped' and dropped_at is not null and dropped_after_round_id = '00000000-0000-0000-0000-000000000022', status)
  from public.tournament_registrations where id = '00000000-0000-0000-0000-000000000041';

\echo '── 2. Repetirla no rompe nada ──'
select public.ponerse('00000000-0000-0000-0000-0000000000b3');
set role jugador;
select public.comprobar('la segunda vez devuelve false, sin error',
  public.torneos_dar_de_baja('00000000-0000-0000-0000-000000000041') = false);
reset role;

\echo '── 3. Quien no es juez de ESTE torneo, no ──'
select public.ponerse('00000000-0000-0000-0000-0000000000b4');
set role jugador;
select public.comprobar('Erika (jueza de OTRO torneo) no puede', e like 'Solo el organizador o un juez%', e)
  from public.error_de($q$select public.torneos_dar_de_baja('00000000-0000-0000-0000-000000000042')$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000b2');
set role jugador;
select public.comprobar('Misty (jueza PENDIENTE) no puede', e like 'Solo el organizador o un juez%', e)
  from public.error_de($q$select public.torneos_dar_de_baja('00000000-0000-0000-0000-000000000042')$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000c3');
set role jugador;
select public.comprobar('Blaine (jugador) no puede dar de baja a otro', e like 'Solo el organizador o un juez%', e)
  from public.error_de($q$select public.torneos_dar_de_baja('00000000-0000-0000-0000-000000000042')$q$) e;
-- Y el juez sigue SIN poder escribir directo: la puerta es la función.
update public.tournament_registrations set status = 'dropped' where id = '00000000-0000-0000-0000-000000000042';
reset role;
select public.comprobar('  …ni por la puerta de atrás (update directo)', status = 'active', status)
  from public.tournament_registrations where id = '00000000-0000-0000-0000-000000000042';

\echo '── 4. Quien lleva el torneo, también ──'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
select public.comprobar('Ash (lo creó) da de baja a Blaine', public.torneos_dar_de_baja('00000000-0000-0000-0000-000000000043'));
reset role;

\echo '── 5. Un juez resuelve una mesa viva ──'
select public.ponerse('00000000-0000-0000-0000-0000000000b3');
set role jugador;
select public.comprobar('Brock resuelve la mesa: no se presentó Gary',
  public.torneos_resolver_como_juez('00000000-0000-0000-0000-000000000031', 'forfeit_a'));
reset role;
select public.comprobar('  …la mesa cae por incomparecencia de A', status = 'forfeit_a' and finished_at is not null, status)
  from public.tournament_matches where id = '00000000-0000-0000-0000-000000000031';
select public.comprobar('  …gana Sabrina, firmado por Brock',
  result = 'forfeit_a' and winner_id = '00000000-0000-0000-0000-0000000000c2' and resolved_by = '00000000-0000-0000-0000-0000000000b3',
  result || ' / ' || coalesce(winner_id::text, 'sin ganador'))
  from public.match_results where match_id = '00000000-0000-0000-0000-000000000031';

\echo '── 6. Lo que un juez NO puede ──'
select public.ponerse('00000000-0000-0000-0000-0000000000b3');
set role jugador;
select public.comprobar('corregir una mesa ya cerrada', e like '%cosa del organizador%', e)
  from public.error_de($q$select public.torneos_resolver_como_juez('00000000-0000-0000-0000-000000000031', 'a_wins')$q$) e;
select public.comprobar('empatar en el top cut', e like '%no hay empates%', e)
  from public.error_de($q$select public.torneos_resolver_como_juez('00000000-0000-0000-0000-000000000032', 'draw')$q$) e;
select public.comprobar('tocar una ronda que no está en juego', e like '%no está en juego%', e)
  from public.error_de($q$select public.torneos_resolver_como_juez('00000000-0000-0000-0000-000000000033', 'a_wins')$q$) e;
select public.comprobar('resolver la mesa de OTRO torneo', e like 'Solo el organizador o un juez%', e)
  from public.error_de($q$select public.torneos_resolver_como_juez('00000000-0000-0000-0000-000000000039', 'a_wins')$q$) e;
select public.comprobar('un resultado que no existe', e like '%inválido%', e)
  from public.error_de($q$select public.torneos_resolver_como_juez('00000000-0000-0000-0000-000000000032', 'gana_yo')$q$) e;
-- Y directo, tampoco: la RLS de las mesas sigue siendo de quien manda.
update public.tournament_matches set status = 'finished' where id = '00000000-0000-0000-0000-000000000032';
reset role;
select public.comprobar('  …ni escribir la mesa directamente', status = 'active', status)
  from public.tournament_matches where id = '00000000-0000-0000-0000-000000000032';

\echo '── 7. Sin cuenta, nada ──'
select public.comprobar('anon no puede llamar a dar de baja',
  not has_function_privilege('anon', 'public.torneos_dar_de_baja(uuid)', 'execute'));
select public.comprobar('anon no puede llamar a resolver',
  not has_function_privilege('anon', 'public.torneos_resolver_como_juez(uuid, text)', 'execute'));
select public.comprobar('con cuenta, sí',
  has_function_privilege('authenticated', 'public.torneos_dar_de_baja(uuid)', 'execute')
  and has_function_privilege('authenticated', 'public.torneos_resolver_como_juez(uuid, text)', 'execute'));
select public.comprobar('las dos son security definer',
  (select bool_and(prosecdef) from pg_proc where proname in ('torneos_dar_de_baja', 'torneos_resolver_como_juez')));

\echo 'FIN'
