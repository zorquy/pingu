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

drop table if exists public.replays cascade;
drop function if exists public.repeticiones_guardar(text, text, text[], text, int, boolean) cascade;
drop function if exists public.repeticiones_leer(text) cascade;
drop function if exists public.repeticiones_resumen(text) cascade;

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

\i /home/user/pingu/supabase-migration-repeticiones.sql

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
