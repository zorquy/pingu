-- Tanda 1070, contra PostgreSQL: el torneo apuntado con su mazo guardado y su
-- puesto, y el mazo predeterminado.
--
-- supabase-migration-1070-torneos-mazo-y-puesto.sql. Se pregunta, en vez de
-- argumentarlo:
--
--   1. ¿Un torneo se cuelga de un mazo TUYO y de ninguno más (ni del público
--      de otra persona)?
--   2. ¿El puesto es opcional y no admite imposibles (0, «5.º de 4»)?
--   3. ¿Cambiar el mazo del torneo lo arrastra a sus rondas, con el
--      arquetipo, el nombre y la fecha de siempre (251)?
--   4. ¿Borrar el mazo deja el torneo y sus rondas, sin el enlace?
--   5. ¿El predeterminado es privado de verdad (ni otra cuenta ni sin cuenta),
--      solo con un mazo tuyo, y con el arquetipo entero o sin él?
--   6. ¿La migración se puede ejecutar dos veces?
--
--   psql -h /var/tmp -p 5433 -U postgres -v raiz=/home/user/pingu -f sql-tanda-1070.sql
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

drop table if exists public.match_log, public.match_log_torneos, public.match_log_ajustes, public.user_decks, public.user_profiles cascade;
drop function if exists public.match_log_mazo_propio() cascade;
drop function if exists public.match_log_torneo_arrastra() cascade;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'mirón') then create role "mirón" nologin; end if;
end $$;
grant authenticated to jugador;
grant anon to "mirón";

-- ASH apunta; MISTY tiene un mazo público y otro privado.
insert into auth.users values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2');
create table public.user_profiles (id uuid primary key);
insert into public.user_profiles select id from auth.users;

-- Lo que la migración da por hecho, con SUS migraciones de verdad: los mazos,
-- Mis partidas, sus torneos (236), el disparador de la 251 y el mazo guardado
-- de la 627.
\i :raiz/supabase-migration-mazos.sql
\i :raiz/supabase-migration-partidas.sql
\i :raiz/supabase-migration-partidas-tipo.sql
\i :raiz/supabase-migration-partidas-torneos.sql
\i :raiz/supabase-migration-partidas-editar.sql
\i :raiz/supabase-migration-partidas-cerrar.sql
\i :raiz/supabase-migration-partidas-mazo-guardado.sql
\echo '── la 1070, dos veces ──'
\i :raiz/supabase-migration-1070-torneos-mazo-y-puesto.sql
\i :raiz/supabase-migration-1070-torneos-mazo-y-puesto.sql

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid(), public.ponerse(uuid) to anon, authenticated;
-- Lo que Supabase concede solo a las tablas de siempre (la de ajustes se lo da
-- la migración, y eso es lo que se mira).
grant select, insert, update, delete on public.match_log, public.match_log_torneos, public.user_decks to authenticated;

create or replace function public.error_de(q text) returns text language plpgsql as $$
begin execute q; return 'sin error'; exception when others then return sqlerrm; end $$;
create or replace function public.comprobar(etiqueta text, ok boolean, extra text default '') returns void
language plpgsql as $$
begin
  raise notice '%', (case when coalesce(ok, false) then '  ok  ' else '  FALLA ' end) || etiqueta
    || case when coalesce(extra, '') <> '' then ' — ' || extra else '' end;
end $$;
grant execute on function public.error_de(text), public.comprobar(text, boolean, text) to anon, authenticated;

insert into public.user_decks (id, user_id, name, is_public) values
  ('00000000-0000-0000-0000-00000000d0a1', '00000000-0000-0000-0000-0000000000a1', 'Dragapult de Ash', false),
  ('00000000-0000-0000-0000-00000000d0a2', '00000000-0000-0000-0000-0000000000a1', 'Gholdengo de Ash', false),
  ('00000000-0000-0000-0000-00000000d0b1', '00000000-0000-0000-0000-0000000000a2', 'Gardevoir de Misty (público)', true),
  ('00000000-0000-0000-0000-00000000d0b2', '00000000-0000-0000-0000-0000000000a2', 'Lugia de Misty (privado)', false);

\echo '── 1. El torneo, con un mazo tuyo ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('las tres columnas nuevas del torneo existen',
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'match_log_torneos' and column_name in ('user_deck_id', 'puesto', 'jugadores')) = 3);
select public.comprobar('Ash apunta un torneo con SU mazo guardado y su puesto',
  public.error_de($q$insert into public.match_log_torneos (id, user_id, nombre, donde, mi_mazo, mi_mazo_nombre, user_deck_id, puesto, jugadores, jugado_el)
    values ('00000000-0000-0000-0000-0000000007a1', '00000000-0000-0000-0000-0000000000a1', 'Liga del jueves', 'Torneo local', 'd:dragapult ex', 'Dragapult ex', '00000000-0000-0000-0000-00000000d0a1', 3, 24, '2026-10-22')$q$) = 'sin error');
select public.comprobar('y otro sin mazo guardado ni puesto, como siempre',
  public.error_de($q$insert into public.match_log_torneos (id, user_id, nombre, mi_mazo, mi_mazo_nombre)
    values ('00000000-0000-0000-0000-0000000007a2', '00000000-0000-0000-0000-0000000000a1', 'Regional', 'd:gardevoir ex', 'Gardevoir ex')$q$) = 'sin error');
select public.comprobar('  …que nace sin mazo guardado, sin puesto y sin jugadores',
  (select user_deck_id is null and puesto is null and jugadores is null from public.match_log_torneos where id = '00000000-0000-0000-0000-0000000007a2'));
select public.comprobar('Ash ve el mazo PÚBLICO de Misty (por eso hace falta la guarda)',
  exists (select 1 from public.user_decks where id = '00000000-0000-0000-0000-00000000d0b1'));
select public.comprobar('…pero no puede colgar su torneo de él',
  public.error_de($q$insert into public.match_log_torneos (user_id, nombre, user_deck_id)
    values ('00000000-0000-0000-0000-0000000000a1', 'X', '00000000-0000-0000-0000-00000000d0b1')$q$) ~ 'no es tuyo');
select public.comprobar('ni cambiar uno suyo a ese mazo',
  public.error_de($q$update public.match_log_torneos set user_deck_id = '00000000-0000-0000-0000-00000000d0b2' where id = '00000000-0000-0000-0000-0000000007a2'$q$) ~ 'no es tuyo');

\echo '── 2. El puesto ──'
select public.comprobar('puesto 0, no',
  public.error_de($q$update public.match_log_torneos set puesto = 0 where id = '00000000-0000-0000-0000-0000000007a2'$q$) ~ 'match_log_torneos_puesto_ok');
select public.comprobar('«5.º de 4», no',
  public.error_de($q$update public.match_log_torneos set puesto = 5, jugadores = 4 where id = '00000000-0000-0000-0000-0000000007a2'$q$) ~ 'match_log_torneos_puesto_cabe');
select public.comprobar('un torneo de un jugador, no',
  public.error_de($q$update public.match_log_torneos set jugadores = 1 where id = '00000000-0000-0000-0000-0000000007a2'$q$) ~ 'match_log_torneos_jugadores_ok');
select public.comprobar('el puesto sin saber cuántos erais, sí',
  public.error_de($q$update public.match_log_torneos set puesto = 7 where id = '00000000-0000-0000-0000-0000000007a2'$q$) = 'sin error');
select public.comprobar('  …y quitarlo otra vez, también',
  public.error_de($q$update public.match_log_torneos set puesto = null where id = '00000000-0000-0000-0000-0000000007a2'$q$) = 'sin error');

\echo '── 3. Las rondas llevan el mazo del torneo, y lo siguen ──'
select public.comprobar('Ash apunta dos rondas con el mazo del torneo',
  public.error_de($q$insert into public.match_log (id, user_id, torneo_id, mi_mazo, mi_mazo_nombre, rival_mazo, rival_mazo_nombre, resultado, user_deck_id, donde, jugada_el) values
    ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000007a1', 'd:dragapult ex', 'Dragapult ex', 'd:lugia', 'Lugia', 'win', '00000000-0000-0000-0000-00000000d0a1', 'Liga del jueves', '2026-10-22'),
    ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000007a1', 'd:dragapult ex', 'Dragapult ex', 'd:charizard', 'Charizard', 'loss', '00000000-0000-0000-0000-00000000d0a1', 'Liga del jueves', '2026-10-22')$q$) = 'sin error');
-- Las dos frases por separado: una consulta no ve lo que cambia una función
-- que ella misma llama (su foto de la base es de antes de empezar).
select public.comprobar('cambia el mazo guardado (y el arquetipo) del torneo',
  public.error_de($q$update public.match_log_torneos set user_deck_id = '00000000-0000-0000-0000-00000000d0a2', mi_mazo = 'd:gholdengo ex', mi_mazo_nombre = 'Gholdengo ex' where id = '00000000-0000-0000-0000-0000000007a1'$q$) = 'sin error');
select public.comprobar('  …y sus dos rondas lo siguen: el guardado y el arquetipo',
  (select count(*) from public.match_log where torneo_id = '00000000-0000-0000-0000-0000000007a1' and user_deck_id = '00000000-0000-0000-0000-00000000d0a2' and mi_mazo = 'd:gholdengo ex' and mi_mazo_nombre = 'Gholdengo ex') = 2);
select public.comprobar('cambiar SOLO el mazo guardado también arrastra',
  public.error_de($q$update public.match_log_torneos set user_deck_id = '00000000-0000-0000-0000-00000000d0a1' where id = '00000000-0000-0000-0000-0000000007a1'$q$) = 'sin error');
select public.comprobar('  …a las dos',
  (select count(*) from public.match_log where torneo_id = '00000000-0000-0000-0000-0000000007a1' and user_deck_id = '00000000-0000-0000-0000-00000000d0a1') = 2);
select public.comprobar('el nombre y la fecha siguen arrastrando (la 251 no se ha perdido)',
  public.error_de($q$update public.match_log_torneos set nombre = 'Liga del jueves (J3)', jugado_el = '2026-10-23' where id = '00000000-0000-0000-0000-0000000007a1'$q$) = 'sin error');
select public.comprobar('  …a las dos',
  (select count(*) from public.match_log where torneo_id = '00000000-0000-0000-0000-0000000007a1' and donde = 'Liga del jueves (J3)' and jugada_el = '2026-10-23') = 2);
-- `xmin` cambia con cada escritura de la fila: si el disparador reescribiera
-- las rondas por un cambio de puesto, cambiaría.
select string_agg(xmin::text, ',' order by id) as rondas_antes from public.match_log where torneo_id = '00000000-0000-0000-0000-0000000007a1' \gset
select public.comprobar('cambiar solo el PUESTO',
  public.error_de($q$update public.match_log_torneos set puesto = 2 where id = '00000000-0000-0000-0000-0000000007a1'$q$) = 'sin error');
select public.comprobar('  …no reescribe las rondas (el puesto no se copia)',
  (select string_agg(xmin::text, ',' order by id) from public.match_log where torneo_id = '00000000-0000-0000-0000-0000000007a1') = :'rondas_antes');
select public.comprobar('quitarle el mazo guardado al torneo se lo quita a las rondas',
  public.error_de($q$update public.match_log_torneos set user_deck_id = null where id = '00000000-0000-0000-0000-0000000007a1'$q$) = 'sin error');
select public.comprobar('  …y el arquetipo se queda',
  (select count(*) from public.match_log where torneo_id = '00000000-0000-0000-0000-0000000007a1' and user_deck_id is null and mi_mazo = 'd:gholdengo ex') = 2);
select public.comprobar('y volver a ponérselo',
  public.error_de($q$update public.match_log_torneos set user_deck_id = '00000000-0000-0000-0000-00000000d0a1' where id = '00000000-0000-0000-0000-0000000007a1'$q$) = 'sin error');

\echo '── 4. Borrar el mazo deja el torneo y sus rondas ──'
select public.comprobar('Ash borra su mazo de Dragapult',
  public.error_de($q$delete from public.user_decks where id = '00000000-0000-0000-0000-00000000d0a1'$q$) = 'sin error');
select public.comprobar('…y el torneo sigue ahí, sin el enlace y con su puesto',
  (select user_deck_id is null and puesto = 2 and mi_mazo = 'd:gholdengo ex' from public.match_log_torneos where id = '00000000-0000-0000-0000-0000000007a1'));
select public.comprobar('…y sus dos rondas también',
  (select count(*) from public.match_log where torneo_id = '00000000-0000-0000-0000-0000000007a1' and user_deck_id is null) = 2);

\echo '── 5. El mazo predeterminado ──'
select public.comprobar('Ash guarda el suyo: un mazo guardado con su arquetipo',
  public.error_de($q$insert into public.match_log_ajustes (user_deck_id, mi_mazo, mi_mazo_nombre)
    values ('00000000-0000-0000-0000-00000000d0a2', 'd:gholdengo ex', 'Gholdengo ex')$q$) = 'sin error');
select public.comprobar('  …y la fila es SUYA (el dueño lo pone la base)',
  (select user_id from public.match_log_ajustes) = '00000000-0000-0000-0000-0000000000a1');
select public.comprobar('cambiarlo es actualizar esa fila (upsert por user_id)',
  public.error_de($q$insert into public.match_log_ajustes (user_id, user_deck_id, mi_mazo, mi_mazo_nombre)
    values ('00000000-0000-0000-0000-0000000000a1', null, 'd:pikachu ex', 'Pikachu ex')
    on conflict (user_id) do update set user_deck_id = excluded.user_deck_id, mi_mazo = excluded.mi_mazo, mi_mazo_nombre = excluded.mi_mazo_nombre$q$) = 'sin error');
select public.comprobar('  …y queda una sola fila, la nueva',
  (select count(*) = 1 and min(mi_mazo_nombre) = 'Pikachu ex' from public.match_log_ajustes));
select public.comprobar('el arquetipo va entero o no va (clave sin nombre, no)',
  public.error_de($q$update public.match_log_ajustes set mi_mazo_nombre = null$q$) ~ 'match_log_ajustes_mazo_entero');
select public.comprobar('con el mazo PÚBLICO de Misty, no',
  public.error_de($q$update public.match_log_ajustes set user_deck_id = '00000000-0000-0000-0000-00000000d0b1'$q$) ~ 'no es tuyo');
select public.comprobar('ni apuntando una fila a nombre de Misty',
  public.error_de($q$insert into public.match_log_ajustes (user_id, mi_mazo, mi_mazo_nombre) values ('00000000-0000-0000-0000-0000000000a2', 'd:x', 'X')$q$) ~ 'row-level security');
select public.comprobar('vuelve a su mazo guardado',
  public.error_de($q$update public.match_log_ajustes set user_deck_id = '00000000-0000-0000-0000-00000000d0a2', mi_mazo = 'd:gholdengo ex', mi_mazo_nombre = 'Gholdengo ex'$q$) = 'sin error');
reset role;

select public.ponerse('00000000-0000-0000-0000-0000000000a2');
set role jugador;
select public.comprobar('Misty NO ve el predeterminado de Ash',
  (select count(*) from public.match_log_ajustes) = 0);
select public.comprobar('ni lo puede cambiar (la RLS no da error: no toca nada)',
  public.error_de($q$update public.match_log_ajustes set mi_mazo = 'd:x', mi_mazo_nombre = 'X'$q$) = 'sin error');
select public.comprobar('ni borrar',
  public.error_de($q$delete from public.match_log_ajustes$q$) = 'sin error');
reset role;
select public.comprobar('  …y sigue como lo dejó Ash',
  (select mi_mazo_nombre from public.match_log_ajustes where user_id = '00000000-0000-0000-0000-0000000000a1') = 'Gholdengo ex');

set role "mirón";
select public.comprobar('sin cuenta, ni leerla',
  public.error_de($q$select 1 from public.match_log_ajustes$q$) ~ 'permission denied');
reset role;

select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('Ash borra el mazo que tenía por defecto',
  public.error_de($q$delete from public.user_decks where id = '00000000-0000-0000-0000-00000000d0a2'$q$) = 'sin error');
select public.comprobar('…y el predeterminado se queda con el arquetipo, sin el enlace',
  (select user_deck_id is null and mi_mazo_nombre = 'Gholdengo ex' from public.match_log_ajustes));
reset role;

\echo '── 6. Borrar la cuenta se lleva el predeterminado ──'
delete from public.user_profiles where id = '00000000-0000-0000-0000-0000000000a1';
select public.comprobar('sin perfil, sin fila de ajustes', (select count(*) from public.match_log_ajustes) = 0);
