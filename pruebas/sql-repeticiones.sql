-- «Guardar y compartir una repetición», contra PostgreSQL (tanda 480).
--
-- La migración deja la tabla `replays` cerrada salvo para su dueño, y
-- abre DOS puertas: guardar (una función) y abrir con el enlace (otra).
-- Aquí se pregunta, en vez de argumentarlo:
--
--   1. ¿Guardar crea la fila, y guardar otra vez la misma partida NO la
--      duplica? (y cambia el título si se da)
--   2. ¿Una repetición guardada sin compartir la abre SOLO su dueño?
--   3. ¿Compartida, la abre cualquiera con el enlace… pero nadie puede
--      LISTAR las de otros?
--   4. ¿Otra persona puede cambiarla o borrarla? (no, y sin error: no
--      toca nada)
--   5. ¿El dueño puede cambiarle la PARTIDA, el dueño o el enlace? (no)
--   6. ¿Se puede guardar sin cuenta, o saltándose la función? (no)
--   7. ¿Los topes: 30 por hora y 500 en total?
--   8. ¿Borrar y dejar de compartir cierran el enlace?
--   9. ¿Los mazos se guardan con la partida, y nadie los cambia a mano?
--  10. ¿Las notas: solo el dueño, con su forma y sus topes, y las lee
--      quien abre la compartida?
--  11. ¿Mis partidas: la partida apuntada lleva su repetición, una vez?
--  12. ¿La repetición de una partida de torneo: la adjunta SOLO un jugador
--      de la mesa, con una suya, y la ven los dos, quien lleva el torneo y
--      sus jueces — nadie más?
--
-- Cada comprobación dice «ok» o «FALLA»: la prueba del navegador corre
-- esto y busca la palabra.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-repeticiones.sql
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
-- Y las de las tandas de después, en todas las formas que han tenido: una
-- base de pruebas con una versión vieja hace que la nueva «no sea única»
-- al llamarla, y eso es un rojo del contenedor, no de la web.
drop function if exists public.torneos_adjuntar_repeticion(uuid, text) cascade;
drop function if exists public.torneos_quitar_repeticion(uuid) cascade;
drop function if exists public.torneos_quitar_repeticion(uuid, text) cascade;
drop function if exists public.repeticiones_juez_de(uuid) cascade;
drop function if exists public.replays_notas_validas(jsonb) cascade;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'visitante') then create role visitante nologin; end if;
end $$;
grant authenticated to jugador;
grant anon to visitante;

-- Gente: ASH guarda; MISTY es otra persona con cuenta; BROCK y GARY, para
-- los topes.
insert into auth.users values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2'),
  ('00000000-0000-0000-0000-0000000000a3'),
  ('00000000-0000-0000-0000-0000000000a4');

-- Lo que la migración da por hecho que ya está: Mis partidas (su tabla con
-- la política de siempre) y los torneos (las mesas, las rondas, los jueces y
-- quién lleva un torneo), copiados de sus migraciones.
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

grant select, insert, update, delete on public.match_log to authenticated;
grant select on public.tournament_matches, public.rounds, public.tournaments to authenticated;

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid(), public.ponerse(uuid) to anon, authenticated;

-- Las dos ayudas de la prueba: una que devuelve el error de una frase
-- (o 'sin error'), y otra que dice ok / FALLA.
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
grant execute on function public.torneos_mando(uuid), public.torneos_soy_admin() to authenticated;

-- Una partida de mentira, larga como un registro (los 100 caracteres de
-- mínimo), y otra distinta.
create temp table partida (n int, texto text);
insert into partida values
  (1, 'Preparación' || chr(10) || repeat('Rojo ha robado una carta.' || chr(10), 10)),
  (2, 'Preparación' || chr(10) || repeat('Azul ha robado una carta.' || chr(10), 10));
grant select on partida to anon, authenticated;

\echo '── 1. Guardar, y guardar otra vez ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
create temp table g1 as
  select * from public.repeticiones_guardar((select texto from partida where n = 1), 'Rojo contra Azul', array['Rojo', 'Azul'], 'Rojo', 13, null);
grant select on g1 to public;
select public.comprobar('Ash guarda una partida: fila nueva, sin compartir, enlace de 10',
  nueva and not compartida and char_length(id) = 10, id) from g1;
create temp table g2 as
  select * from public.repeticiones_guardar((select texto from partida where n = 1), 'La final', null, null, null, null);
select public.comprobar('  …guardarla OTRA vez da la misma fila, no otra',
  (select id from g2) = (select id from g1) and not (select nueva from g2));
select public.comprobar('  …y le cambia el título', titulo = 'La final' and jugador_a = 'Rojo' and turnos = 13, titulo)
  from public.replays where id = (select id from g1);
reset role;
select public.comprobar('  …una sola fila en la base', count(*) = 1, count(*)::text) from public.replays;

\echo '── 2. Sin compartir, solo la abre su dueño ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash la abre con su enlace (y es suya)',
  (select mia and not compartida from public.repeticiones_leer((select id from g1))));
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty NO la abre (no está compartida)',
  (select count(*) from public.repeticiones_leer((select id from g1))) = 0);
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('  …ni alguien sin cuenta',
  (select count(*) from public.repeticiones_leer((select id from g1))) = 0);
reset role;

\echo '── 3. Compartida: la abre quien tenga el enlace, y nadie las lista ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash la comparte (cambiando la fila él mismo)',
  public.filas_de(format('update public.replays set compartida = true where id = %L', (select id from g1))) = 1);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty ya la abre (y no es suya)',
  (select not mia and registro like 'Preparación%' from public.repeticiones_leer((select id from g1))));
select public.comprobar('  …pero NO puede listar las de otros',
  (select count(*) from public.replays) = 0);
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('alguien sin cuenta la abre con el enlace',
  (select count(*) from public.repeticiones_leer((select id from g1))) = 1);
select public.comprobar('  …y la vista previa sale sin el registro',
  (select titulo = 'La final' and jugador_b = 'Azul' from public.repeticiones_resumen((select id from g1))));
select public.comprobar('  …pero la tabla, ni tocarla', e like '%permission denied%', e)
  from public.error_de('select * from public.replays') e;
reset role;

\echo '── 4. Otra persona no la cambia ni la borra ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty cambia el título de la de Ash: no toca nada',
  public.filas_de(format('update public.replays set titulo = %L where id = %L', 'Mía', (select id from g1))) = 0);
select public.comprobar('  …ni la borra',
  public.filas_de(format('delete from public.replays where id = %L', (select id from g1))) = 0);
reset role;
select public.comprobar('  …y sigue como estaba', titulo = 'La final', titulo) from public.replays where id = (select id from g1);

\echo '── 5. El dueño no cambia la partida, el dueño ni el enlace ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash no puede cambiarle la PARTIDA', e like '%permission denied%', e)
  from public.error_de(format('update public.replays set registro = %L where id = %L', repeat('x', 200), (select id from g1))) e;
select public.comprobar('  …ni pasársela a otra cuenta', e like '%permission denied%', e)
  from public.error_de(format('update public.replays set user_id = %L where id = %L', '00000000-0000-0000-0000-0000000000a2', (select id from g1))) e;
select public.comprobar('  …ni cambiarle el enlace', e like '%permission denied%', e)
  from public.error_de(format('update public.replays set id = %L where id = %L', 'abc', (select id from g1))) e;
reset role;

\echo '── 6. Sin cuenta no se guarda, ni saltándose la función ──'
select public.ponerse(null);
set role visitante;
select public.comprobar('alguien sin cuenta no puede llamar a guardar', e like '%permission denied%', e)
  from public.error_de($q$select public.repeticiones_guardar((select texto from partida where n = 2))$q$) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty no puede insertar directo (saltándose la función)', e like '%permission denied%', e)
  from public.error_de($q$insert into public.replays (registro) values ((select texto from partida where n = 2))$q$) e;
select public.comprobar('un texto de nada no se guarda', e like 'Eso no parece el registro%', e)
  from public.error_de($q$select public.repeticiones_guardar('hola')$q$) e;
create temp table g3 as select * from public.repeticiones_guardar((select texto from partida where n = 1), null, null, null, null, true);
grant select on g3 to public;
select public.comprobar('Misty guarda la MISMA partida que Ash: es suya, con su propio enlace',
  (select nueva and compartida and id <> (select id from g1) from g3));
reset role;

\echo '── 7. Los topes ──'
insert into public.replays (user_id, titulo, registro, created_at)
  select '00000000-0000-0000-0000-0000000000a3', 'r' || g, 'Preparación' || chr(10) || repeat('Brock ' || g || ' ', 30), now()
  from generate_series(1, 30) g;
select public.ponerse('00000000-0000-0000-0000-0000000000a3');
set role jugador;
select public.comprobar('31 en una hora, no', e like 'Has guardado muchas repeticiones seguidas%', e)
  from public.error_de($q$select public.repeticiones_guardar((select texto from partida where n = 2))$q$) e;
reset role;
insert into public.replays (user_id, titulo, registro, created_at)
  select '00000000-0000-0000-0000-0000000000a4', 'r' || g, 'Preparación' || chr(10) || repeat('Gary ' || g || ' ', 30), now() - interval '2 days'
  from generate_series(1, 500) g;
select public.ponerse('00000000-0000-0000-0000-0000000000a4');
set role jugador;
select public.comprobar('la 501, no', e like 'Has llegado al máximo de 500%', e)
  from public.error_de($q$select public.repeticiones_guardar((select texto from partida where n = 2))$q$) e;
reset role;

\echo '── 8. Dejar de compartir y borrar cierran el enlace ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash deja de compartirla',
  public.filas_de(format('update public.replays set compartida = false where id = %L', (select id from g1))) = 1);
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('  …y el enlace ya no la abre',
  (select count(*) from public.repeticiones_leer((select id from g1))) = 0);
select public.comprobar('  …ni su vista previa',
  (select count(*) from public.repeticiones_resumen((select id from g1))) = 0);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty borra la suya',
  public.filas_de(format('delete from public.replays where id = %L', (select id from g3))) = 1);
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('  …y su enlace ya no abre nada',
  (select count(*) from public.repeticiones_leer((select id from g3))) = 0);
reset role;

\echo '── 9. Los mazos ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
create temp table g9 as
  select * from public.repeticiones_guardar((select texto from partida where n = 2), 'Con mazos', array['Rojo', 'Azul'], 'Azul', 9, false, array['Zoroark ex de N', 'Dragapult ex']);
grant select on g9 to public;
reset role;
select public.comprobar('guardar deja los mazos de los dos', mazo_a = 'Zoroark ex de N' and mazo_b = 'Dragapult ex', mazo_a || ' / ' || mazo_b)
  from public.replays where id = (select id from g9);
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('  …y guardarla otra vez sin mazos no los borra', (select id from public.repeticiones_guardar((select texto from partida where n = 2))) = (select id from g9));
reset role;
select public.comprobar('  …(siguen ahí)', mazo_a = 'Zoroark ex de N') from public.replays where id = (select id from g9);
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('el dueño NO puede escribir los mazos a mano (salen del registro)', e like '%permission denied%', e)
  from public.error_de(format('update public.replays set mazo_a = %L where id = %L', 'Lo que yo diga', (select id from g9))) e;
reset role;

\echo '── 10. Las notas ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('el dueño pone notas en dos jugadas',
  public.filas_de(format('update public.replays set notas = %L where id = %L', '[{"fila": 12, "texto": "Aquí tenía que retirar"}, {"fila": 40, "texto": "Buen golpe"}]', (select id from g9))) = 1);
select public.comprobar('  …una nota de más de 500 caracteres, no', e like '%replays_notas%', e)
  from public.error_de(format('update public.replays set notas = %L where id = %L', json_build_array(json_build_object('fila', 1, 'texto', repeat('x', 501)))::text, (select id from g9))) e;
select public.comprobar('  …una nota vacía, no', e like '%replays_notas%', e)
  from public.error_de(format('update public.replays set notas = %L where id = %L', '[{"fila": 1, "texto": ""}]', (select id from g9))) e;
select public.comprobar('  …una nota sin jugada, no', e like '%replays_notas%', e)
  from public.error_de(format('update public.replays set notas = %L where id = %L', '[{"fila": "doce", "texto": "hola"}]', (select id from g9))) e;
select public.comprobar('  …algo que no es una lista, no', e like '%replays_notas%', e)
  from public.error_de(format('update public.replays set notas = %L where id = %L', '{"fila": 1}', (select id from g9))) e;
select public.comprobar('  …y más de 300, no', e like '%replays_notas%', e)
  from public.error_de(format('update public.replays set notas = %L where id = %L', (select json_agg(json_build_object('fila', g, 'texto', 'n'))::text from generate_series(1, 301) g), (select id from g9))) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('otra persona no le cambia las notas (no toca nada)',
  public.filas_de(format('update public.replays set notas = %L where id = %L', '[{"fila": 1, "texto": "Mía"}]', (select id from g9))) = 0);
select public.comprobar('  …y sin compartir, el enlace no se las enseña', (select count(*) from public.repeticiones_leer((select id from g9))) = 0);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.filas_de(format('update public.replays set compartida = true where id = %L', (select id from g9)));
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('compartida, quien abre el enlace lee las notas y los mazos',
  jsonb_array_length(notas) = 2 and notas -> 0 ->> 'texto' = 'Aquí tenía que retirar' and mazo_b = 'Dragapult ex' and not mia, notas::text)
  from public.repeticiones_leer((select id from g9));
reset role;

\echo '── 11. Mis partidas ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('apuntar la partida con su repetición',
  public.filas_de(format($q$insert into public.match_log (user_id, mi_mazo, rival_mazo, mi_mazo_nombre, rival_mazo_nombre, resultado, replay_id) values (%L, 'd:zoroark', 'd:dragapult', 'Zoroark', 'Dragapult', 'loss', %L)$q$, '00000000-0000-0000-0000-0000000000a1', (select id from g9))) = 1);
select public.comprobar('  …y la misma repetición dos veces, no', e like '%match_log_repeticion%', e)
  from public.error_de(format($q$insert into public.match_log (user_id, mi_mazo, rival_mazo, mi_mazo_nombre, rival_mazo_nombre, resultado, replay_id) values (%L, 'd:zoroark', 'd:dragapult', 'Zoroark', 'Dragapult', 'loss', %L)$q$, '00000000-0000-0000-0000-0000000000a1', (select id from g9))) e;
reset role;

\echo '── 12. La repetición de una partida de torneo ──'
-- Un torneo de OAK, con MAY de jueza aprobada y DAWN pendiente; la mesa es
-- de ASH contra MISTY. TRACEY no tiene nada que ver (y no es Brock, que ya
-- gastó sus 30 de la hora en la sección 7).
insert into auth.users values ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000b2'), ('00000000-0000-0000-0000-0000000000b3'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.tournaments values ('10000000-0000-0000-0000-000000000001', 'Liga', '00000000-0000-0000-0000-0000000000b1');
insert into public.rounds values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1);
insert into public.tournament_matches values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2');
insert into public.judge_applications (tournament_id, user_id, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2', 'approved'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b3', 'pending');
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
create temp table g12 as select * from public.repeticiones_guardar((select texto from partida where n = 1) || 'torneo', 'Ronda 1', null, null, null, false);
grant select on g12 to public;
select public.comprobar('Ash adjunta la repetición de SU partida',
  public.torneos_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from g12)));
reset role;
select public.comprobar('  …y adjuntarla la comparte (si no, los demás no la abren)', compartida) from public.replays where id = (select id from g12);
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('  …y la misma otra vez no la duplica',
  public.torneos_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from g12))
  and (select count(*) from public.tournament_match_replays) = 1);
-- Un BO3 son tres partidas: tres repeticiones por jugador, y no cuatro.
create temp table g12c as select n, (public.repeticiones_guardar((select texto from partida where n = 1) || 'juego ' || n, null, null, null, null, false)).id from generate_series(2, 4) n;
grant select on g12c to public;
-- Por separado: dentro de un mismo `and`, Postgres puede contar ANTES de
-- adjuntar.
select public.torneos_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from g12c where n = 2));
select public.torneos_adjuntar_repeticion('30000000-0000-0000-0000-000000000001', (select id from g12c where n = 3));
select public.comprobar('  …un BO3: la segunda y la tercera también entran', (select count(*) from public.tournament_match_replays) = 3);
select public.comprobar('  …pero la cuarta no', e like 'Caben tres%', e)
  from public.error_de(format('select public.torneos_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from g12c where n = 4))) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
set role jugador;
create temp table g12b as select * from public.repeticiones_guardar((select texto from partida where n = 2) || 'brock', null, null, null, null, false);
grant select on g12b to public;
select public.comprobar('Tracey (que no juega esa mesa) no puede adjuntar nada', e like 'Solo los dos jugadores%', e)
  from public.error_de(format('select public.torneos_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from g12b))) e;
select public.comprobar('  …ni ver la de Ash', (select count(*) from public.tournament_match_replays) = 0);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty (su rival) la ve', (select count(*) from public.tournament_match_replays where replay_id = (select id from g12)) = 1);
select public.comprobar('  …pero no se la puede quitar a Ash', not public.torneos_quitar_repeticion('30000000-0000-0000-0000-000000000001', (select id from g12)));
select public.comprobar('  …y la abre con su enlace', (select count(*) from public.repeticiones_leer((select id from g12))) = 1);
select public.comprobar('  …pero no puede adjuntar una que no es suya', e like 'Esa repetición no es tuya%', e)
  from public.error_de(format('select public.torneos_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from g12b))) e;
select public.comprobar('  …ni escribir en la tabla directamente', e like '%permission denied%', e)
  from public.error_de(format('insert into public.tournament_match_replays (match_id, user_id, replay_id) values (%L, %L, %L)', '30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2', (select id from g12))) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
set role jugador;
select public.comprobar('quien lleva el torneo las ve', (select count(*) from public.tournament_match_replays) = 3);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000b2');
set role jugador;
select public.comprobar('la jueza aprobada las ve', (select count(*) from public.tournament_match_replays) = 3);
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000b3');
set role jugador;
select public.comprobar('la jueza PENDIENTE no', (select count(*) from public.tournament_match_replays) = 0);
reset role;
select public.ponerse(null);
set role visitante;
select public.comprobar('sin cuenta no se adjunta nada', e like '%permission denied%', e)
  from public.error_de(format('select public.torneos_adjuntar_repeticion(%L, %L)', '30000000-0000-0000-0000-000000000001', (select id from g12))) e;
reset role;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash quita una', public.torneos_quitar_repeticion('30000000-0000-0000-0000-000000000001', (select id from g12)));
reset role;
select public.comprobar('  …y ya no está, y las otras dos sí', (select count(*) from public.tournament_match_replays where replay_id = (select id from g12)) = 0
  and (select count(*) from public.tournament_match_replays) = 2);
select public.comprobar('borrar la repetición quita también su rastro en Mis partidas (sin borrar la partida)',
  (select replay_id is not null from public.match_log limit 1));
delete from public.replays where id = (select id from g9);
select public.comprobar('  …(la partida sigue, sin enlace)', (select count(*) = 1 and bool_and(replay_id is null) from public.match_log));

