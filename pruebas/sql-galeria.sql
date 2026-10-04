-- «Partidas de ejemplo: publicar una repetición en la ficha de su mazo»,
-- contra PostgreSQL (tanda 520).
--
--   1. ¿Publica SOLO su dueño, por la función, con un mazo del meta, y se
--      queda compartida? ¿Nadie se pone `publica` a mano?
--   2. ¿La lista de un mazo da las publicadas Y compartidas de ese mazo, a
--      cualquiera (con y sin cuenta), sin el registro?
--   3. ¿Quitar: su dueño y la administración; nadie más?
--   4. ¿Los topes: 30 publicadas por persona, y la forma de los ids?
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-galeria.sql
\set ON_ERROR_STOP off
\set QUIET on
set client_min_messages = notice;

drop schema if exists auth cascade;
create schema auth;
create table auth.users (id uuid primary key);
create table auth.yo (uid uuid);
insert into auth.yo values (null);
create or replace function auth.uid() returns uuid language sql stable security definer as $$ select uid from auth.yo $$;
create or replace function public.ponerse(p uuid) returns void language sql security definer as $$ update auth.yo set uid = p $$;

drop table if exists public.replays, public.match_log, public.tournament_match_replays,
  public.tournaments, public.rounds, public.tournament_matches, public.judge_applications, public.user_profiles cascade;
drop function if exists public.repeticiones_guardar(text, text, text[], text, int, boolean) cascade;
drop function if exists public.repeticiones_guardar(text, text, text[], text, int, boolean, text[]) cascade;
drop function if exists public.repeticiones_leer(text) cascade;
drop function if exists public.repeticiones_resumen(text) cascade;
drop function if exists public.torneos_adjuntar_repeticion(uuid, text) cascade;
drop function if exists public.torneos_quitar_repeticion(uuid) cascade;
drop function if exists public.torneos_quitar_repeticion(uuid, text) cascade;
drop function if exists public.repeticiones_juez_de(uuid) cascade;
drop function if exists public.replays_notas_validas(jsonb) cascade;
drop function if exists public.repeticiones_publicar(text, boolean, text[]) cascade;
drop function if exists public.repeticiones_publicas(text, int) cascade;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'visitante') then create role visitante nologin; end if;
end $$;
grant authenticated to jugador;
grant anon to visitante;

-- ASH publica; MISTY es otra persona; ROSA es administradora del sitio.
insert into auth.users values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3');

-- Lo que las migraciones dan por hecho (copiado de sql-repeticiones.sql),
-- con el nombre de la gente, que la lista enseña.
create table public.user_profiles (id uuid primary key, username text, display_name text, is_admin boolean default false, is_tournament_admin boolean default false);
insert into public.user_profiles values
  ('00000000-0000-0000-0000-0000000000a1', 'ash', 'Ash', false, false),
  ('00000000-0000-0000-0000-0000000000a2', 'misty', null, false, false),
  ('00000000-0000-0000-0000-0000000000a3', 'rosa', 'Rosa', true, false);
create table public.match_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  mi_mazo text not null, rival_mazo text not null,
  mi_mazo_nombre text not null, rival_mazo_nombre text not null,
  resultado text not null check (resultado in ('win', 'loss', 'draw')),
  donde text, notas text,
  jugada_el date not null default current_date,
  created_at timestamptz not null default now());
alter table public.match_log enable row level security;
create policy partidas_solo_mias on public.match_log for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create table public.tournaments (id uuid primary key, name text, admin_id uuid);
create table public.rounds (id uuid primary key, tournament_id uuid, round_number int);
create table public.tournament_matches (id uuid primary key, round_id uuid, player_a_id uuid, player_b_id uuid, status text default 'active');
create table public.judge_applications (id uuid primary key default gen_random_uuid(), tournament_id uuid, user_id uuid, status text default 'pending');
create or replace function public.torneos_soy_admin() returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select exists (select 1 from public.user_profiles p where p.id = auth.uid() and (p.is_admin or coalesce(p.is_tournament_admin, false)));
$$;
create or replace function public.torneos_mando(p_torneo uuid) returns boolean
language sql stable security definer set search_path = public, pg_catalog as $$
  select public.torneos_soy_admin() or exists (select 1 from public.tournaments t where t.id = p_torneo and t.admin_id = auth.uid());
$$;

\i /home/user/pingu/supabase-migration-repeticiones.sql
\i /home/user/pingu/supabase-migration-repeticiones-galeria.sql

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid(), public.ponerse(uuid) to anon, authenticated;

create or replace function public.error_de(q text) returns text language plpgsql as $$
begin execute q; return 'sin error'; exception when others then return sqlerrm; end $$;
create or replace function public.filas_de(q text) returns int language plpgsql as $$
declare n int; begin execute q; get diagnostics n = row_count; return n; exception when others then return -1; end $$;
create or replace function public.comprobar(etiqueta text, ok boolean, extra text default '') returns void
language plpgsql as $$
begin
  raise notice '%', (case when coalesce(ok, false) then '  ok  ' else '  FALLA ' end) || etiqueta
    || case when coalesce(extra, '') <> '' then ' — ' || extra else '' end;
end $$;
grant execute on function public.error_de(text), public.filas_de(text), public.comprobar(text, boolean, text) to anon, authenticated;

-- Tres partidas de Ash y una de Misty, sin compartir.
create temp table partida (n int, texto text);
insert into partida select k, 'Preparación' || chr(10) || repeat('Rojo ha robado la carta ' || k || '.' || chr(10), 10) from generate_series(1, 4) k;
grant select on partida to anon, authenticated;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
create temp table ids as
  select k, (select id from public.repeticiones_guardar((select texto from partida where n = k), 'Partida ' || k, array['Rojo', 'Azul'], 'Rojo', 10, false, array['Dragapult ex', 'Gardevoir ex'])) as id
  from generate_series(1, 3) k;
grant select on ids to public;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
insert into ids select 4, (select id from public.repeticiones_guardar((select texto from partida where n = 4), 'La de Misty', array['Rojo', 'Azul'], 'Azul', 9, false, null));
reset role;

\echo '── 1. Quién publica ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty no publica la de Ash',
  public.error_de(format($q$select public.repeticiones_publicar(%L, true, array['dragapult-dusknoir'])$q$, (select id from ids where k = 1))) like 'Solo quien la guardó%');
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash no se pone «publica» a mano (solo por la función)',
  public.filas_de(format('update public.replays set publica = true where id = %L', (select id from ids where k = 1))) = -1);
select public.comprobar('  …ni sin ningún mazo del meta',
  public.error_de(format($q$select public.repeticiones_publicar(%L, true, array['NO VALE', null])$q$, (select id from ids where k = 1))) like 'Ninguno de los dos mazos%');
select public.comprobar('Ash publica la 1 con sus dos mazos (repetidos y uno malo fuera)',
  public.error_de(format($q$select public.repeticiones_publicar(%L, true, array['dragapult-dusknoir', 'dragapult-dusknoir', 'gardevoir', 'Malo!'])$q$, (select id from ids where k = 1))) = 'sin error');
select public.comprobar('  …y queda publicada, COMPARTIDA, con los dos ids limpios y su fecha',
  publica and compartida and arquetipos = array['dragapult-dusknoir', 'gardevoir'] and publicada_at is not null, array_to_string(arquetipos, ','))
  from public.replays where id = (select id from ids where k = 1);
select public.comprobar('publica la 2, de un solo mazo', public.error_de(format($q$select public.repeticiones_publicar(%L, true, array['gardevoir'])$q$, (select id from ids where k = 2))) = 'sin error');
reset role;

\echo '── 2. La lista de un mazo ──'
select public.ponerse(null);
set role visitante;
select public.comprobar('sin cuenta, la lista de Gardevoir da las dos, la más nueva primero',
  -- En el orden en que las DEVUELVE la función (`with ordinality`): ordenarlas
  -- aquí otra vez por fecha comprobaría el orden de esta consulta, no el suyo.
  (select array_agg(t.id order by t.ordinality) from public.repeticiones_publicas('gardevoir', 12) with ordinality t) = array[(select id from ids where k = 2), (select id from ids where k = 1)]);
select public.comprobar('  …la de Dragapult, una', (select count(*) from public.repeticiones_publicas('dragapult-dusknoir', 12)) = 1);
select public.comprobar('  …con quién la subió (su nombre visible)', (select autor from public.repeticiones_publicas('dragapult-dusknoir', 12)) = 'Ash');
select public.comprobar('  …y sin el registro (la lista no lo devuelve)',
  (select count(*) from pg_proc where proname = 'repeticiones_publicas' and pg_get_function_result(oid) like '%registro%') = 0);
select public.comprobar('  …y el tope de la lista se respeta', (select count(*) from public.repeticiones_publicas('gardevoir', 1)) = 1);
reset role;
-- Dejar de compartirla la saca de la lista.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.filas_de(format('update public.replays set compartida = false where id = %L', (select id from ids where k = 2)));
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('dejar de compartirla la saca de la lista', (select count(*) from public.repeticiones_publicas('gardevoir', 12)) = 1);
reset role;

\echo '── 3. Quitar ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty no quita la de Ash',
  public.error_de(format($q$select public.repeticiones_publicar(%L, false)$q$, (select id from ids where k = 1))) like 'Solo quien la publicó%');
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a3');
set role jugador;
select public.comprobar('la administración sí la quita',
  public.error_de(format($q$select public.repeticiones_publicar(%L, false)$q$, (select id from ids where k = 1))) = 'sin error');
select public.comprobar('  …pero no la publica (no es suya)',
  public.error_de(format($q$select public.repeticiones_publicar(%L, true, array['gardevoir'])$q$, (select id from ids where k = 1))) like 'Solo quien la guardó%');
reset role;
select public.comprobar('  …y queda sin publicar (y compartida: el enlace no se rompe)', not publica and compartida and publicada_at is null)
  from public.replays where id = (select id from ids where k = 1);

\echo '── 4. Los topes ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('un id de mazo con forma rara no entra ni a mano en la columna',
  public.error_de(format($q$select public.repeticiones_publicar(%L, true, array['%s'])$q$, (select id from ids where k = 3), repeat('a', 90))) like 'Ninguno de los dos mazos%');
reset role;
-- 30 publicadas de Ash (de mentira, a mano como administrador de la base).
-- La 2 sigue con `publica` pero sin compartir: esa no cuenta (no sale).
insert into public.replays (user_id, titulo, registro, publica, compartida, arquetipos, publicada_at)
  select '00000000-0000-0000-0000-0000000000a1', 'Relleno ' || k, 'Preparación' || chr(10) || repeat('Relleno ' || k || '.' || chr(10), 12), true, true, array['gardevoir'], now() - k * interval '1 minute'
  from generate_series(1, 30) k;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('con 30 publicadas, la 31 no entra',
  public.error_de(format($q$select public.repeticiones_publicar(%L, true, array['gardevoir'])$q$, (select id from ids where k = 3))) like 'Caben 30 partidas publicadas%');
select public.comprobar('  …pero volver a publicar una que ya lo está, sí (no cuenta dos veces)',
  public.error_de(format($q$select public.repeticiones_publicar(%L, true, array['gardevoir'])$q$, (select id from public.replays where titulo = 'Relleno 1'))) = 'sin error');
reset role;
select public.comprobar('  …y conserva su fecha de publicación', publicada_at < now() - interval '30 seconds') from public.replays where titulo = 'Relleno 1';

\echo '── 5. Se puede repetir entera ──'
\i /home/user/pingu/supabase-migration-repeticiones-galeria.sql
select public.comprobar('ejecutarla otra vez no pierde las publicadas', (select count(*) from public.replays where publica and compartida) = 30);
