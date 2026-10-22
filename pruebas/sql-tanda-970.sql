-- Tanda 970: un juez aprobado lleva su torneo como el organizador.
--
-- Contra PostgreSQL, con la migración DE VERDAD (\i):
--   1. Un juez aprobado de ESE torneo crea rondas y mesas, y edita el torneo
--      (estado, ronda en curso), que es lo que hacen «Generar pareos» y
--      «Saltar jornada».
--   2. No puede BORRAR el torneo.
--   3. Un juez pendiente, uno de OTRO torneo o un jugador: nada.
--   4. Quien lo creó y un organizador siguen pudiendo.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-970.sql
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
  public.tournament_matches, public.judge_applications cascade;
create table public.user_profiles (id uuid primary key, username text, is_admin boolean default false, is_tournament_admin boolean default false);
create table public.tournaments (id uuid primary key, name text, admin_id uuid, status text default 'registration_open', current_round_id uuid);
create table public.rounds (id uuid primary key default gen_random_uuid(), tournament_id uuid, round_number int, status text);
create table public.tournament_matches (id uuid primary key default gen_random_uuid(), round_id uuid, tournament_id uuid, table_number int);
create table public.judge_applications (id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid, status text default 'pending');

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
-- El mando de ANTES (supabase-migration-torneos-dueno.sql), para ver que la
-- migración lo cambia.
create or replace function public.torneos_mando(p_torneo uuid) returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select public.torneos_soy_admin()
      or exists (select 1 from public.tournaments t where t.id = p_torneo and t.admin_id = auth.uid());
$$;

-- Las políticas de siempre (torneos-dueno y torneos-publico).
do $$ declare t text; begin
  foreach t in array array['tournaments','rounds','tournament_matches','judge_applications','user_profiles'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy leer on public.%I for select using (true)', t);
  end loop;
end $$;
create policy torneos_escribir on public.tournaments for all
  using (torneos_soy_admin() or admin_id = auth.uid()) with check (torneos_soy_admin() or admin_id = auth.uid());
create policy torneos_escribir on public.rounds for all using (torneos_mando(tournament_id)) with check (torneos_mando(tournament_id));
create policy torneos_escribir on public.tournament_matches for all using (torneos_mando(tournament_id)) with check (torneos_mando(tournament_id));
grant select, insert, update, delete on public.tournaments, public.rounds, public.tournament_matches to authenticated;
grant select on public.judge_applications, public.user_profiles to authenticated;
grant usage on schema auth to authenticated;
grant execute on function public.ponerse(uuid) to authenticated;

-- Gente: creador (c), organizador (o), juez aprobado (j), juez pendiente
-- (p), juez de OTRO torneo (x) y un jugador (g).
insert into public.user_profiles (id, username, is_tournament_admin) values
  ('00000000-0000-0000-0000-00000000000c', 'creador', false),
  ('00000000-0000-0000-0000-00000000000a', 'organizador', true),
  ('00000000-0000-0000-0000-000000000001', 'juez', false),
  ('00000000-0000-0000-0000-000000000002', 'pendiente', false),
  ('00000000-0000-0000-0000-000000000003', 'otro', false),
  ('00000000-0000-0000-0000-000000000004', 'jugador', false);
insert into public.tournaments (id, name, admin_id) values
  ('10000000-0000-0000-0000-000000000001', 'Mañana', '00000000-0000-0000-0000-00000000000c'),
  ('10000000-0000-0000-0000-000000000002', 'Otro', '00000000-0000-0000-0000-00000000000c');
insert into public.judge_applications (tournament_id, user_id, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'approved'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'pending'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'approved');

create or replace function pg_temp.intento(quien uuid, que text) returns text language plpgsql as $$
declare n int;
begin
  perform public.ponerse(quien);
  set local role jugador;
  if que = 'ronda' then
    insert into public.rounds (tournament_id, round_number, status) values ('10000000-0000-0000-0000-000000000001', 1, 'pending');
  elsif que = 'mesa' then
    insert into public.tournament_matches (tournament_id, table_number) values ('10000000-0000-0000-0000-000000000001', 1);
  elsif que = 'empezar' then
    update public.tournaments set status = 'in_progress' where id = '10000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    if n = 0 then reset role; return 'nada'; end if;
  elsif que = 'borrar' then
    delete from public.tournaments where id = '10000000-0000-0000-0000-000000000001';
    get diagnostics n = row_count;
    if n = 0 then reset role; return 'nada'; end if;
  end if;
  reset role;
  return 'si';
exception when others then
  reset role;
  return 'no';
end $$;

create or replace function pg_temp.ver(etiqueta text, ok boolean) returns void language plpgsql as $$
begin raise notice '% %', case when ok then 'ok   ' else 'FALLA' end, etiqueta; end $$;

-- Antes de la migración, el juez no puede (es lo que vio PINGU).
select pg_temp.ver('antes de la 970, el juez no genera pareos', pg_temp.intento('00000000-0000-0000-0000-000000000001', 'ronda') = 'no');

\i /home/user/pingu/supabase-migration-970-jueces-como-organizador.sql
\set QUIET on

select pg_temp.ver('el juez aprobado crea la ronda', pg_temp.intento('00000000-0000-0000-0000-000000000001', 'ronda') = 'si');
select pg_temp.ver('  …y sus mesas', pg_temp.intento('00000000-0000-0000-0000-000000000001', 'mesa') = 'si');
select pg_temp.ver('  …y edita el torneo (empezarlo, la ronda en curso)', pg_temp.intento('00000000-0000-0000-0000-000000000001', 'empezar') = 'si');
select pg_temp.ver('  …pero no lo borra', pg_temp.intento('00000000-0000-0000-0000-000000000001', 'borrar') = 'nada');
select pg_temp.ver('un juez PENDIENTE no crea rondas', pg_temp.intento('00000000-0000-0000-0000-000000000002', 'ronda') = 'no');
select pg_temp.ver('  …ni edita el torneo', pg_temp.intento('00000000-0000-0000-0000-000000000002', 'empezar') = 'nada');
select pg_temp.ver('un juez de OTRO torneo no crea rondas aquí', pg_temp.intento('00000000-0000-0000-0000-000000000003', 'ronda') = 'no');
select pg_temp.ver('  …ni edita este torneo', pg_temp.intento('00000000-0000-0000-0000-000000000003', 'empezar') = 'nada');
select pg_temp.ver('un jugador, nada', pg_temp.intento('00000000-0000-0000-0000-000000000004', 'ronda') = 'no' and pg_temp.intento('00000000-0000-0000-0000-000000000004', 'empezar') = 'nada');
select pg_temp.ver('el organizador, como siempre', pg_temp.intento('00000000-0000-0000-0000-00000000000a', 'ronda') = 'si');
select pg_temp.ver('quien lo creó, también', pg_temp.intento('00000000-0000-0000-0000-00000000000c', 'mesa') = 'si');
select pg_temp.ver('  …y él sí lo puede borrar', pg_temp.intento('00000000-0000-0000-0000-00000000000c', 'borrar') = 'si');
