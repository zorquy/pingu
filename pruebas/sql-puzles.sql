-- «Puzles "¿Qué jugarías?"», contra PostgreSQL (tanda 521).
--
--   1. ¿Hace puzles SOLO el dueño de la repetición, por la función, con su
--      forma (2 a 4 opciones, la buena dentro), y la deja compartida?
--   2. ¿La solución NO se lee de la tabla, ni con cuenta ni sin ella?
--   3. ¿Contestar da la solución y el recuento, apunta la PRIMERA respuesta
--      (una por persona) y sin cuenta no apunta nada?
--   4. ¿Si la repetición deja de compartirse, el puzle deja de verse?
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-puzles.sql
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
drop table if exists public.replay_puzzle_answers, public.replay_puzzles cascade;
drop function if exists public.puzles_crear(text, int, text, text[], int, text) cascade;
drop function if exists public.puzles_responder(text, int) cascade;
drop function if exists public.puzles_lista(int) cascade;
drop function if exists public.repeticion_compartida(text) cascade;

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
\i /home/user/pingu/supabase-migration-repeticiones-puzles.sql

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

-- Una partida de Ash, sin compartir.
create temp table partida as select 'Preparación' || chr(10) || repeat('Rojo ha robado una carta.' || chr(10), 10) as texto;
grant select on partida to anon, authenticated;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
create temp table rep as select (select id from public.repeticiones_guardar((select texto from partida), 'Para un puzle', array['Rojo', 'Azul'], 'Rojo', 10, false, null)) as id;
grant select on rep to public;
reset role;

\echo '── 1. Hacer un puzle ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty no hace puzles de la repetición de Ash',
  public.error_de(format($q$select public.puzles_crear(%L, 5, '¿Qué jugarías?', array['A', 'B'], 0, 'Porque sí, y ya.')$q$, (select id from rep))) like 'Solo se hacen puzles de repeticiones tuyas%');
select public.comprobar('  …ni escribiendo en la tabla', public.error_de(format($q$insert into public.replay_puzzles (replay_id, foto, pregunta, opciones, correcta, explicacion) values (%L, 5, 'x?', array['a','b'], 0, 'abc')$q$, (select id from rep))) like '%permission denied%');
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('con una sola opción (las vacías no cuentan), no',
  public.error_de(format($q$select public.puzles_crear(%L, 5, '¿Qué jugarías?', array['Retirarse', '  ', null], 0, 'Porque sí, y ya.')$q$, (select id from rep))) like 'Hacen falta de 2 a 4 opciones%');
select public.comprobar('  …ni con la buena fuera de las opciones',
  public.error_de(format($q$select public.puzles_crear(%L, 5, '¿Qué jugarías?', array['A', 'B'], 2, 'Porque sí, y ya.')$q$, (select id from rep))) like '%replay_puzzles_correcta%');
create temp table pz as select public.puzles_crear((select id from rep), 7, ' ¿Qué jugarías aquí? ', array[' Retirarse ', 'Atacar', '', 'Jugar a Boss'], 2, ' Con Boss se cogen los dos últimos premios. ') as id;
grant select on pz to public;
select public.comprobar('Ash lo hace: las opciones limpias (sin la vacía) y la buena es la que dijo',
  (select opciones = array['Retirarse', 'Atacar', 'Jugar a Boss'] and pregunta = '¿Qué jugarías aquí?' and foto = 7 from public.replay_puzzles where id = (select id from pz)));
reset role;
select public.comprobar('  …(la buena, guardada: «Jugar a Boss», la 2)', correcta = 2 and explicacion = 'Con Boss se cogen los dos últimos premios.') from public.replay_puzzles where id = (select id from pz);
select public.comprobar('  …y la repetición queda compartida', compartida) from public.replays where id = (select id from rep);

\echo '── 2. La solución no se lee ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty ve el puzle (pregunta y opciones)', (select count(*) from public.replay_puzzles where id = (select id from pz)) = 1);
select public.comprobar('  …pero no la buena', public.error_de(format('select correcta from public.replay_puzzles where id = %L', (select id from pz))) like '%permission denied%');
select public.comprobar('  …ni la explicación', public.error_de(format('select explicacion from public.replay_puzzles where id = %L', (select id from pz))) like '%permission denied%');
select public.comprobar('  …ni las respuestas de los demás', public.error_de('select * from public.replay_puzzle_answers') like '%permission denied%');
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('sin cuenta también lo ve, sin la buena', (select count(*) from public.replay_puzzles where id = (select id from pz)) = 1
  and public.error_de(format('select correcta from public.replay_puzzles where id = %L', (select id from pz))) like '%permission denied%');
reset role;

\echo '── 3. Contestar ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
create temp table r1 as select * from public.puzles_responder((select id from pz), 1);
grant select on r1 to public;
select public.comprobar('Misty contesta «Atacar»: le dice la buena, la explicación y el recuento', correcta = 2 and explicacion like 'Con Boss%' and recuento = array[0, 1, 0] and tuya = 1, recuento::text) from r1;
create temp table r2 as select * from public.puzles_responder((select id from pz), 2);
grant select on r2 to public;
select public.comprobar('  …contestar otra vez (ya sabiendo la buena) no cambia lo apuntado', recuento = array[0, 1, 0] and tuya = 1, recuento::text) from r2;
select public.comprobar('  …y una opción que no existe, no', public.error_de(format('select * from public.puzles_responder(%L, 3)', (select id from pz))) like 'Esa opción no es de este puzle%');
reset role;
select public.ponerse(null);
set role visitante;
create temp table r3 as select * from public.puzles_responder((select id from pz), 2);
grant select on r3 to public;
select public.comprobar('sin cuenta: ve la solución y no se apunta nada', correcta = 2 and recuento = array[0, 1, 0] and tuya is null, recuento::text) from r3;
select public.comprobar('  …y la lista de puzles lo cuenta (1 respuesta, 0 aciertos)', (select respuestas = 1 and aciertos = 0 and autor = 'Ash' from public.puzles_lista(20) where id = (select id from pz)));
reset role;

\echo '── 4. Si la repetición deja de compartirse ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.filas_de(format('update public.replays set compartida = false where id = %L', (select id from rep)));
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('el puzle deja de verse', (select count(*) from public.replay_puzzles where id = (select id from pz)) = 0);
select public.comprobar('  …ni se contesta', public.error_de(format('select * from public.puzles_responder(%L, 1)', (select id from pz))) like 'Ese puzle no existe%');
select public.comprobar('  …ni sale en la lista', not exists (select 1 from public.puzles_lista(20) where id = (select id from pz)));
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('su dueño sí lo sigue viendo, y lo borra', (select count(*) from public.replay_puzzles where id = (select id from pz)) = 1
  and public.filas_de(format('delete from public.replay_puzzles where id = %L', (select id from pz))) = 1);
reset role;

\echo '── 5. Se puede repetir entera ──'
\i /home/user/pingu/supabase-migration-repeticiones-puzles.sql
select public.comprobar('ejecutarla otra vez no da error ni pierde nada', (select count(*) from public.replays) = 1);
