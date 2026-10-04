-- «Quién se lleva cada premio, y si ya se le dio», contra PostgreSQL
-- (tanda 516).
--
--   1. ¿La marca la pone SOLO quien lleva el torneo (y su organizador), y
--      solo por la función? ¿Un jugador no se marca la suya?
--   2. ¿Solo con el torneo terminado, y solo a quien lo jugó?
--   3. ¿Marcar dos veces no duplica, y desmarcar la quita?
--   4. ¿La ve quien ve el torneo —con y sin cuenta— y nadie escribe a mano?
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-premios-entrega.sql
\set ON_ERROR_STOP off
\set QUIET on
set client_min_messages = notice;

drop schema if exists auth cascade;
create schema auth;
create table auth.yo (uid uuid);
insert into auth.yo values (null);
create or replace function auth.uid() returns uuid language sql stable security definer as $$ select uid from auth.yo $$;
create or replace function public.ponerse(p uuid) returns void language sql security definer as $$ update auth.yo set uid = p $$;

drop table if exists public.tournament_prize_deliveries, public.tournament_registrations, public.tournaments, public.user_profiles cascade;
drop function if exists public.torneos_premio_entregado(uuid, uuid, boolean) cascade;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'visitante') then create role visitante nologin; end if;
end $$;
grant authenticated to jugador;
grant anon to visitante;

-- Lo que la migración da por hecho: los torneos con su lectura (un torneo
-- PRIVADO solo lo ven su dueño y sus inscritos, como el de verdad), las
-- inscripciones y quién lleva un torneo, copiados de sus migraciones.
create table public.user_profiles (id uuid primary key, is_admin boolean default false, is_tournament_admin boolean default false);
create table public.tournaments (id uuid primary key, name text, admin_id uuid, status text, is_private boolean default false);
create table public.tournament_registrations (id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid);
alter table public.tournaments enable row level security;
create policy torneos_leer on public.tournaments for select using (
  not is_private or admin_id = auth.uid()
  or exists (select 1 from public.tournament_registrations r where r.tournament_id = tournaments.id and r.user_id = auth.uid()));
create or replace function public.torneos_soy_admin() returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select exists (select 1 from public.user_profiles p where p.id = auth.uid() and (p.is_admin or coalesce(p.is_tournament_admin, false)));
$$;
create or replace function public.torneos_mando(p_torneo uuid) returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select public.torneos_soy_admin() or exists (select 1 from public.tournaments t where t.id = p_torneo and t.admin_id = auth.uid());
$$;
grant usage on schema public, auth to anon, authenticated;
grant select on public.tournaments, public.tournament_registrations to anon, authenticated;
grant execute on function auth.uid(), public.ponerse(uuid), public.torneos_mando(uuid), public.torneos_soy_admin() to anon, authenticated;

\i /home/user/pingu/supabase-migration-torneos-premios-entrega.sql

create or replace function public.error_de(q text) returns text language plpgsql as $$
begin execute q; return 'sin error'; exception when others then return sqlerrm; end $$;
create or replace function public.comprobar(etiqueta text, ok boolean, extra text default '') returns void
language plpgsql as $$
begin
  raise notice '%', (case when coalesce(ok, false) then '  ok  ' else '  FALLA ' end) || etiqueta
    || case when coalesce(extra, '') <> '' then ' — ' || extra else '' end;
end $$;
grant execute on function public.error_de(text), public.comprobar(text, boolean, text) to anon, authenticated;

-- ORGA lleva la Copa (terminada) y la Liga (en juego); ASH y MISTY juegan
-- la Copa; GARY no juega nada; ROSA es organizadora del sitio.
insert into public.user_profiles values
  ('00000000-0000-0000-0000-0000000000a1', false, false),
  ('00000000-0000-0000-0000-0000000000a2', false, false),
  ('00000000-0000-0000-0000-0000000000a3', false, false),
  ('00000000-0000-0000-0000-0000000000a9', false, false),
  ('00000000-0000-0000-0000-0000000000b1', false, true);
insert into public.tournaments values
  ('00000000-0000-0000-0000-00000000c0a1', 'Copa', '00000000-0000-0000-0000-0000000000a9', 'finished', false),
  ('00000000-0000-0000-0000-00000000c0a2', 'Liga', '00000000-0000-0000-0000-0000000000a9', 'in_progress', false),
  ('00000000-0000-0000-0000-00000000c0a3', 'Privada', '00000000-0000-0000-0000-0000000000a9', 'finished', true);
insert into public.tournament_registrations (tournament_id, user_id) values
  ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-00000000c0a2', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-00000000c0a3', '00000000-0000-0000-0000-0000000000a1');

\echo '── 1. Quién la pone ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash (jugador) no se marca su propio premio',
  public.error_de($q$select public.torneos_premio_entregado('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000a1', true)$q$) like 'Solo quien lleva el torneo%');
select public.comprobar('  …ni escribiendo en la tabla a mano',
  public.error_de($q$insert into public.tournament_prize_deliveries (tournament_id, user_id) values ('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000a1')$q$) like '%permission denied%');
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('sin cuenta, tampoco (ni la función se le deja)',
  public.error_de($q$select public.torneos_premio_entregado('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000a1', true)$q$) like '%permission denied%');
reset role;

select public.ponerse('00000000-0000-0000-0000-0000000000a9');
set role jugador;
select public.comprobar('quien lleva el torneo marca el de Ash',
  public.error_de($q$select public.torneos_premio_entregado('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000a1', true)$q$) = 'sin error');
select public.comprobar('  …y marcarlo otra vez no lo duplica ni da error',
  public.error_de($q$select public.torneos_premio_entregado('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000a1', true)$q$) = 'sin error'
  and (select count(*) from public.tournament_prize_deliveries where user_id = '00000000-0000-0000-0000-0000000000a1') = 1);
select public.comprobar('  …y apunta quién lo marcó',
  (select delivered_by from public.tournament_prize_deliveries where user_id = '00000000-0000-0000-0000-0000000000a1') = '00000000-0000-0000-0000-0000000000a9');
reset role;

select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
select public.comprobar('la organizadora del sitio también (torneos_mando)',
  public.error_de($q$select public.torneos_premio_entregado('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000a2', true)$q$) = 'sin error');
reset role;

\echo '── 2. Cuándo y a quién ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a9');
set role jugador;
select public.comprobar('con el torneo en juego, no',
  public.error_de($q$select public.torneos_premio_entregado('00000000-0000-0000-0000-00000000c0a2', '00000000-0000-0000-0000-0000000000a1', true)$q$) like 'Los premios se dan con el torneo terminado%');
select public.comprobar('a quien no lo jugó, no',
  public.error_de($q$select public.torneos_premio_entregado('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000a3', true)$q$) like 'Esa persona no jugó este torneo%');

\echo '── 3. Desmarcar ──'
-- En dos frases: dentro de una sola, la consulta de fuera no ve lo que la
-- función acaba de borrar (las dos miran la misma foto de la base).
create temp table desmarcar as select public.error_de($q$select public.torneos_premio_entregado('00000000-0000-0000-0000-00000000c0a1', '00000000-0000-0000-0000-0000000000a2', false)$q$) as e;
select public.comprobar('desmarcar la quita',
  (select e from desmarcar) = 'sin error' and not exists (select 1 from public.tournament_prize_deliveries where user_id = '00000000-0000-0000-0000-0000000000a2'));
select public.comprobar('  …y no se lleva la de otro', exists (select 1 from public.tournament_prize_deliveries where user_id = '00000000-0000-0000-0000-0000000000a1'));
select public.comprobar('quien lleva no borra a mano (solo por la función)',
  public.error_de($q$delete from public.tournament_prize_deliveries$q$) like '%permission denied%');
-- La de la privada, para el apartado 4.
select public.torneos_premio_entregado('00000000-0000-0000-0000-00000000c0a3', '00000000-0000-0000-0000-0000000000a1', true);
reset role;

\echo '── 4. Quién la ve ──'
select public.ponerse(null);
set role visitante;
select public.comprobar('sin cuenta se ve la de un torneo público',
  (select count(*) from public.tournament_prize_deliveries where tournament_id = '00000000-0000-0000-0000-00000000c0a1') = 1);
select public.comprobar('  …pero no la de uno privado', (select count(*) from public.tournament_prize_deliveries where tournament_id = '00000000-0000-0000-0000-00000000c0a3') = 0);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('quien jugó la privada sí la ve', (select count(*) from public.tournament_prize_deliveries where tournament_id = '00000000-0000-0000-0000-00000000c0a3') = 1);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a3');
set role jugador;
select public.comprobar('  …y otro con cuenta que no la jugó, no', (select count(*) from public.tournament_prize_deliveries where tournament_id = '00000000-0000-0000-0000-00000000c0a3') = 0);
reset role;

\echo '── 5. Se puede repetir entera ──'
\i /home/user/pingu/supabase-migration-torneos-premios-entrega.sql
select public.comprobar('ejecutarla otra vez no pierde lo apuntado', (select count(*) from public.tournament_prize_deliveries) = 2);
