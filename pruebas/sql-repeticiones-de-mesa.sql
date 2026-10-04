-- «La repetición de una MESA», contra PostgreSQL (tanda 555).
--
-- La añade un juez (o quien lleva el torneo) con el registro que le pasa
-- un jugador, y la ve cualquiera que vea la mesa —con cuenta o sin ella—.
-- Las que adjuntan los jugadores (tanda 496) siguen siendo privadas.
--
--   1. ¿El juez la añade, queda pública y compartida, y otra vez no la
--      duplica?
--   2. ¿La ve cualquiera: otra persona con cuenta, sin cuenta, los dos de la
--      mesa (y la abre con el enlace)?
--   3. ¿Las de los jugadores siguen privadas aunque la mesa tenga una
--      pública al lado?
--   4. ¿Las puertas: jueza pendiente, jugador, otra persona, sin cuenta,
--      una repetición ajena, una mesa sin partida, otro torneo, una mesa que
--      no existe, y escribir a mano?
--   5. ¿Quien lleva el torneo también, y el tope de tres por mesa?
--   6. ¿Quitar: solo juez o quien lleva, solo las públicas, y la repetición
--      se queda guardada?
--   7. ¿Una mesa que la base no deja ver no enseña su repetición?
--   8. ¿La migración se puede ejecutar otra vez sin perder nada?
--
--   psql -h /var/tmp -p 5433 -U postgres -d prueba_de_mesa -f sql-repeticiones-de-mesa.sql
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
drop function if exists public.torneos_juez_adjuntar_repeticion(uuid, text) cascade;
drop function if exists public.torneos_juez_quitar_repeticion(uuid, text) cascade;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'visitante') then create role visitante nologin; end if;
end $$;
grant authenticated to jugador;
grant anon to visitante;

-- Gente: ASH y MISTY juegan la mesa 1; OAK lleva el torneo; MAY es jueza
-- aprobada y DAWN la tiene pendiente; TRACEY no tiene nada que ver.
insert into auth.users values
  ('00000000-0000-0000-0000-0000000000a1'), -- ASH
  ('00000000-0000-0000-0000-0000000000a2'), -- MISTY
  ('00000000-0000-0000-0000-0000000000b1'), -- OAK
  ('00000000-0000-0000-0000-0000000000b2'), -- MAY
  ('00000000-0000-0000-0000-0000000000b3'), -- DAWN
  ('00000000-0000-0000-0000-0000000000c1'); -- TRACEY

-- Lo que la migración da por hecho (copiado de sus migraciones). Las mesas
-- llevan su propia política: la de la repetición de mesa le pregunta a ESTA
-- quién ve la mesa, así que aquí hay una mesa que no ve nadie.
create table public.user_profiles (id uuid primary key, is_admin boolean default false, is_tournament_admin boolean default false);
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
create table public.tournament_matches (id uuid primary key, round_id uuid, player_a_id uuid, player_b_id uuid, status text default 'active', visible boolean not null default true);
alter table public.tournament_matches enable row level security;
create policy mesas_ver on public.tournament_matches for select using (visible);
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
-- La base de producción tiene la de la 496 como era ANTES: su política
-- para todo el mundo y la tabla cerrada sin cuenta. La de la 555 tiene que
-- arreglarlo ella sola (sin esto, lo arreglaba la de la 496 de ahora y la
-- prueba no vería si la nueva lo hace — dos guardas que se cubren).
alter policy tmr_ver on public.tournament_match_replays to public;
revoke select on public.tournament_match_replays from anon;
\i /home/user/pingu/supabase-migration-torneos-repeticiones-de-mesa.sql

-- Los torneos son el escaparate (tanda 252): las mesas se leen sin cuenta.
grant select on public.tournament_matches, public.rounds, public.tournaments to anon, authenticated;
grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid(), public.ponerse(uuid) to anon, authenticated;

create or replace function public.error_de(q text) returns text language plpgsql as $$
begin execute q; return 'sin error'; exception when others then return sqlerrm; end $$;
create or replace function public.comprobar(etiqueta text, ok boolean, extra text default '') returns void
language plpgsql as $$
begin
  raise notice '%', (case when coalesce(ok, false) then '  ok  ' else '  FALLA ' end) || etiqueta
    || case when coalesce(extra, '') <> '' then ' — ' || extra else '' end;
end $$;
grant execute on function public.error_de(text), public.comprobar(text, boolean, text) to anon, authenticated;
grant execute on function public.torneos_mando(uuid), public.torneos_soy_admin() to authenticated;

-- El torneo de OAK: la mesa 1 (ASH contra MISTY, jugándose), la 2 sin
-- empezar, la 3 un bye y la 4, que la base no deja ver. Y otro torneo, de
-- otra persona, donde MAY no es jueza.
insert into public.tournaments values
  ('10000000-0000-0000-0000-000000000001', 'Liga', '00000000-0000-0000-0000-0000000000b1'),
  ('10000000-0000-0000-0000-000000000002', 'Otra', '00000000-0000-0000-0000-0000000000c1');
insert into public.rounds values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 1);
insert into public.tournament_matches (id, round_id, player_a_id, player_b_id, status, visible) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'active', true),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'pending', true),
  ('30000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', null, 'bye', true),
  ('30000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'completed', false),
  ('30000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', 'active', true);
insert into public.judge_applications (tournament_id, user_id, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'approved'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b3', 'pending');

-- Un registro de mentira por partida (los 100 caracteres de mínimo).
create temp table partida (n int, texto text);
insert into partida select n, 'Preparación' || chr(10) || repeat('Rojo ha robado una carta. ' || n || chr(10), 10) from generate_series(1, 9) n;
grant select on partida to anon, authenticated;
create temp table ids (quien text, id text);
grant select, insert on ids to anon, authenticated;

\echo '── 1. El juez la añade ──'
select public.ponerse('00000000-0000-0000-0000-0000000000b2');
set role jugador;
insert into ids select 'may1', id from public.repeticiones_guardar((select texto from partida where n = 1), 'Liga · Ronda 1 · Mesa 1', array['Rojo', 'Azul'], 'Rojo', 5, false);
insert into ids select 'may2', id from public.repeticiones_guardar((select texto from partida where n = 2), null, null, null, null, false);
select public.comprobar('May (jueza aprobada) añade la repetición de la mesa 1',
  public.torneos_juez_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'may1')));
reset role;
select public.comprobar('  …queda PÚBLICA, a su nombre', publica and user_id = '00000000-0000-0000-0000-0000000000b2')
  from public.tournament_match_replays where replay_id = (select id from ids where quien = 'may1');
select public.comprobar('  …y COMPARTIDA (si no, los demás no la abrirían)', compartida) from public.replays where id = (select id from ids where quien = 'may1');
select public.ponerse('00000000-0000-0000-0000-0000000000b2');
set role jugador;
select public.comprobar('  …y otra vez no la duplica',
  public.torneos_juez_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'may1')));
reset role;
select public.comprobar('  …(sigue habiendo una)', (select count(*) from public.tournament_match_replays) = 1);

\echo '── 2. La ve cualquiera ──'
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
set role jugador;
select public.comprobar('Tracey (otra persona con cuenta) la ve', (select count(*) from public.tournament_match_replays where publica) = 1);
select public.comprobar('  …y la abre con su enlace', (select count(*) from public.repeticiones_leer((select id from ids where quien = 'may1'))) = 1);
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('sin cuenta también se ve', (select count(*) from public.tournament_match_replays) = 1);
select public.comprobar('  …y se abre', (select count(*) from public.repeticiones_leer((select id from ids where quien = 'may1'))) = 1);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty, que juega la mesa, la ve', (select count(*) from public.tournament_match_replays) = 1);
reset role;

\echo '── 3. Las de los jugadores, privadas ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
insert into ids select 'ash', id from public.repeticiones_guardar((select texto from partida where n = 3), null, null, null, null, false);
select public.comprobar('Ash adjunta la suya (la de jugador, tanda 496)',
  public.torneos_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'ash')));
select public.comprobar('  …y Ash ve las dos', (select count(*) from public.tournament_match_replays) = 2);
reset role;
select public.comprobar('  …la suya NO es pública', not publica) from public.tournament_match_replays where replay_id = (select id from ids where quien = 'ash');
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
set role jugador;
select public.comprobar('Tracey solo ve la de la mesa, no la de Ash', (select count(*) from public.tournament_match_replays) = 1
  and (select replay_id from public.tournament_match_replays) = (select id from ids where quien = 'may1'));
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('  …y sin cuenta, tampoco', (select count(*) from public.tournament_match_replays) = 1);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000b2');
set role jugador;
select public.comprobar('la jueza ve las dos', (select count(*) from public.tournament_match_replays) = 2);
reset role;

\echo '── 4. Las puertas ──'
select public.ponerse('00000000-0000-0000-0000-0000000000b3');
set role jugador;
insert into ids select 'dawn', id from public.repeticiones_guardar((select texto from partida where n = 4), null, null, null, null, false);
select public.comprobar('Dawn (jueza PENDIENTE) no puede', e like 'Solo quien lleva el torneo%', e)
  from public.error_de(format('select public.torneos_juez_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'dawn'))) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash (que juega la mesa) no puede hacer pública la suya', e like 'Solo quien lleva el torneo%', e)
  from public.error_de(format('select public.torneos_juez_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'ash'))) e;
select public.comprobar('  …ni a mano', e like '%permission denied%', e)
  from public.error_de(format('update public.tournament_match_replays set publica = true where replay_id = %L', (select id from ids where quien = 'ash'))) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
set role jugador;
insert into ids select 'tracey', id from public.repeticiones_guardar((select texto from partida where n = 5), null, null, null, null, false);
select public.comprobar('Tracey no puede', e like 'Solo quien lleva el torneo%', e)
  from public.error_de(format('select public.torneos_juez_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'tracey'))) e;
select public.comprobar('  …ni escribir en la tabla', e like '%permission denied%', e)
  from public.error_de(format('insert into public.tournament_match_replays (match_id, user_id, replay_id, publica) values (%L, %L, %L, true)', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000c1', (select id from ids where quien = 'tracey'))) e;
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('sin cuenta no se añade nada', e like '%permission denied%', e)
  from public.error_de(format('select public.torneos_juez_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'may2'))) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000b2');
set role jugador;
select public.comprobar('May no puede añadir la repetición de OTRO (la de Ash)', e like 'Esa repetición no es tuya%', e)
  from public.error_de(format('select public.torneos_juez_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'ash'))) e;
select public.comprobar('  …ni a una mesa sin empezar', e like 'Esa mesa no tiene partida%', e)
  from public.error_de(format('select public.torneos_juez_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000002', (select id from ids where quien = 'may2'))) e;
select public.comprobar('  …ni a un bye', e like 'Esa mesa no tiene partida%', e)
  from public.error_de(format('select public.torneos_juez_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000003', (select id from ids where quien = 'may2'))) e;
select public.comprobar('  …ni en un torneo donde no es jueza', e like 'Solo quien lleva el torneo%', e)
  from public.error_de(format('select public.torneos_juez_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000005', (select id from ids where quien = 'may2'))) e;
select public.comprobar('  …ni en una mesa que no existe', e like 'Esa mesa no existe%', e)
  from public.error_de(format('select public.torneos_juez_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-0000000000ff', (select id from ids where quien = 'may2'))) e;
select public.comprobar('  …ni escribir en la tabla directamente', e like '%permission denied%', e)
  from public.error_de(format('insert into public.tournament_match_replays (match_id, user_id, replay_id, publica) values (%L, %L, %L, true)', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', (select id from ids where quien = 'may2'))) e;
reset role;
select public.comprobar('  …(y de todo eso no ha entrado nada)', (select count(*) from public.tournament_match_replays) = 2);

\echo '── 5. Quien lleva el torneo, y el tope ──'
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
insert into ids select 'oak' || g.k, r.id from generate_series(6, 8) g(k), lateral public.repeticiones_guardar((select texto from partida where partida.n = g.k), null, null, null, null, false) r;
-- Por separado: dentro de un mismo `and`, Postgres puede contar ANTES.
select public.torneos_juez_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'oak6'));
select public.torneos_juez_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'oak7'));
reset role;
select public.comprobar('Oak (lleva el torneo) añade la segunda y la tercera de un BO3', (select count(*) from public.tournament_match_replays where publica) = 3);
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
select public.comprobar('  …pero la cuarta no', e like 'Caben tres%', e)
  from public.error_de(format('select public.torneos_juez_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'oak8'))) e;
select public.comprobar('  …y volver a añadir una que ya está no cuenta como cuarta',
  public.torneos_juez_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'oak6')));
reset role;
select public.comprobar('  …(la de Ash no cuenta para el tope de las públicas)', (select count(*) from public.tournament_match_replays) = 4);
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
insert into ids select 'ash2', id from public.repeticiones_guardar((select texto from partida where n = 9), null, null, null, null, false);
select public.comprobar('  …ni las públicas para el de Ash: puede adjuntar otra suya',
  public.torneos_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'ash2')));
reset role;

\echo '── 6. Quitar ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash no puede quitar la de la mesa', e like 'Solo quien lleva el torneo%', e)
  from public.error_de(format('select public.torneos_juez_quitar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'may1'))) e;
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('  …ni sin cuenta', e like '%permission denied%', e)
  from public.error_de(format('select public.torneos_juez_quitar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'may1'))) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000b2');
set role jugador;
select public.comprobar('May no le quita a Ash la suya (la de jugador es de él)',
  not public.torneos_juez_quitar_repeticion('30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'ash')));
reset role;
select public.comprobar('  …(sigue ahí)', (select count(*) from public.tournament_match_replays where replay_id = (select id from ids where quien = 'ash')) = 1);
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
select public.comprobar('Oak quita la que añadió May',
  public.torneos_juez_quitar_repeticion('30000000-0000-0000-0000-000000000001', (select id from ids where quien = 'may1')));
reset role;
select public.comprobar('  …ya no está en la mesa, y las otras sí', (select count(*) from public.tournament_match_replays where publica) = 2
  and (select count(*) from public.tournament_match_replays where replay_id = (select id from ids where quien = 'may1')) = 0);
select public.comprobar('  …pero la repetición sigue guardada (es de May)', (select count(*) from public.replays where id = (select id from ids where quien = 'may1')) = 1);

\echo '── 7. Una mesa que no se ve ──'
insert into public.tournament_match_replays (match_id, user_id, replay_id, publica)
  values ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000b2', (select id from ids where quien = 'may2'), true);
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
set role jugador;
select public.comprobar('la repetición de una mesa que la base no deja ver, tampoco se ve',
  (select count(*) from public.tournament_match_replays where match_id = '30000000-0000-0000-0000-000000000004') = 0
  and (select count(*) from public.tournament_match_replays where publica) = 2);
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('  …ni sin cuenta', (select count(*) from public.tournament_match_replays where match_id = '30000000-0000-0000-0000-000000000004') = 0);
reset role;

\echo '── 8. Otra vez la migración ──'
\i /home/user/pingu/supabase-migration-torneos-repeticiones-de-mesa.sql
select public.comprobar('ejecutarla otra vez no pierde nada', (select count(*) from public.tournament_match_replays where publica) = 3
  and (select count(*) from public.tournament_match_replays where not publica) = 2);
select public.ponerse(null);
set role visitante;
select public.comprobar('  …y se sigue viendo sin cuenta', (select count(*) from public.tournament_match_replays) = 2);
reset role;
-- Y la de las repeticiones (la de antes) otra vez DESPUÉS: no puede volver
-- a cerrar la tabla a quien no tiene cuenta, ni a dejar su política para
-- todo el mundo (que hacía fallar la consulta entera sin cuenta).
\i /home/user/pingu/supabase-migration-repeticiones.sql
select public.ponerse(null);
set role visitante;
select public.comprobar('ejecutar DESPUÉS la de las repeticiones no le quita nada a quien no tiene cuenta', (select count(*) from public.tournament_match_replays) = 2);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('  …y Ash sigue viendo las suyas y las de la mesa', (select count(*) from public.tournament_match_replays where match_id = '30000000-0000-0000-0000-000000000001') = 4);
reset role;
