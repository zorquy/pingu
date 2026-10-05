-- «El mazo guardado de una partida», contra PostgreSQL (tanda 627).
--
-- supabase-migration-partidas-mazo-guardado.sql añade `match_log.user_deck_id`.
-- Aquí se pregunta, en vez de argumentarlo:
--
--   1. ¿Se puede enlazar una partida con un mazo TUYO, y sin mazo sigue
--      todo como antes?
--   2. ¿Con el mazo de OTRA persona no, ni aunque sea público (que se puede
--      leer) ni cambiándolo después?
--   3. ¿Borrar el mazo deja la partida (sin el enlace)?
--   4. ¿La migración se puede ejecutar dos veces?
--
--   psql -h /var/tmp -p 5433 -U postgres -v raiz=/home/user/pingu -f sql-partidas-mazo.sql
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

drop table if exists public.match_log, public.match_log_torneos, public.user_decks, public.user_profiles cascade;
drop function if exists public.match_log_mazo_propio() cascade;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
end $$;
grant authenticated to jugador;

-- ASH apunta; MISTY tiene un mazo público y otro privado.
insert into auth.users values
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000a2');
create table public.user_profiles (id uuid primary key);
insert into public.user_profiles select id from auth.users;

-- Lo que la migración da por hecho: los mazos y Mis partidas, con SUS
-- migraciones de verdad (no una copia que se les parezca).
\i :raiz/supabase-migration-mazos.sql
\i :raiz/supabase-migration-partidas.sql
\i :raiz/supabase-migration-partidas-mazo-guardado.sql
-- Y otra vez: tiene que poder ejecutarse dos veces.
\i :raiz/supabase-migration-partidas-mazo-guardado.sql

grant usage on schema public, auth to anon, authenticated;
grant execute on function auth.uid(), public.ponerse(uuid) to anon, authenticated;
grant select, insert, update, delete on public.match_log to authenticated;

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
  ('00000000-0000-0000-0000-00000000d0b1', '00000000-0000-0000-0000-0000000000a2', 'Gardevoir de Misty (público)', true),
  ('00000000-0000-0000-0000-00000000d0b2', '00000000-0000-0000-0000-0000000000a2', 'Lugia de Misty (privado)', false);

\echo '── 1. Con un mazo tuyo ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('la columna existe y es uuid',
  (select data_type from information_schema.columns where table_schema = 'public' and table_name = 'match_log' and column_name = 'user_deck_id') = 'uuid');
select public.comprobar('Ash apunta una partida con SU mazo guardado',
  public.error_de($q$insert into public.match_log (id, user_id, mi_mazo, rival_mazo, mi_mazo_nombre, rival_mazo_nombre, resultado, user_deck_id)
    values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000a1', 'd:dragapult', 'd:lugia', 'Dragapult', 'Lugia', 'win', '00000000-0000-0000-0000-00000000d0a1')$q$) = 'sin error');
select public.comprobar('y otra sin mazo, como siempre',
  public.error_de($q$insert into public.match_log (id, user_id, mi_mazo, rival_mazo, mi_mazo_nombre, rival_mazo_nombre, resultado)
    values ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000a1', 'd:dragapult', 'd:lugia', 'Dragapult', 'Lugia', 'loss')$q$) = 'sin error');
select public.comprobar('la segunda se queda sin mazo (null)',
  (select user_deck_id from public.match_log where id = '00000000-0000-0000-0000-0000000000f2') is null);
-- En dos frases: una consulta no ve lo que cambia una función que ella
-- misma llama (su foto de la base es de antes de empezar).
select public.comprobar('enlazarla DESPUÉS con su mazo también vale',
  public.error_de($q$update public.match_log set user_deck_id = '00000000-0000-0000-0000-00000000d0a1' where id = '00000000-0000-0000-0000-0000000000f2'$q$) = 'sin error');
select public.comprobar('  …y queda enlazada',
  (select user_deck_id from public.match_log where id = '00000000-0000-0000-0000-0000000000f2') = '00000000-0000-0000-0000-00000000d0a1');

\echo '── 2. Con el mazo de otra persona, no ──'
select public.comprobar('Ash ve el mazo PÚBLICO de Misty (por eso hace falta la guarda)',
  exists (select 1 from public.user_decks where id = '00000000-0000-0000-0000-00000000d0b1'));
select public.comprobar('…pero no puede colgar su partida de él',
  public.error_de($q$insert into public.match_log (user_id, mi_mazo, rival_mazo, mi_mazo_nombre, rival_mazo_nombre, resultado, user_deck_id)
    values ('00000000-0000-0000-0000-0000000000a1', 'd:x', 'd:y', 'X', 'Y', 'win', '00000000-0000-0000-0000-00000000d0b1')$q$) ~ 'no es tuyo');
select public.comprobar('ni del privado',
  public.error_de($q$insert into public.match_log (user_id, mi_mazo, rival_mazo, mi_mazo_nombre, rival_mazo_nombre, resultado, user_deck_id)
    values ('00000000-0000-0000-0000-0000000000a1', 'd:x', 'd:y', 'X', 'Y', 'win', '00000000-0000-0000-0000-00000000d0b2')$q$) ~ 'no es tuyo');
select public.comprobar('ni cambiando una partida suya a ese mazo',
  public.error_de($q$update public.match_log set user_deck_id = '00000000-0000-0000-0000-00000000d0b1' where id = '00000000-0000-0000-0000-0000000000f1'$q$) ~ 'no es tuyo');
select public.comprobar('  …que se queda con el suyo',
  (select user_deck_id from public.match_log where id = '00000000-0000-0000-0000-0000000000f1') = '00000000-0000-0000-0000-00000000d0a1');
select public.comprobar('ni con un mazo que no existe',
  public.error_de($q$insert into public.match_log (user_id, mi_mazo, rival_mazo, mi_mazo_nombre, rival_mazo_nombre, resultado, user_deck_id)
    values ('00000000-0000-0000-0000-0000000000a1', 'd:x', 'd:y', 'X', 'Y', 'win', '00000000-0000-0000-0000-00000000dead')$q$) <> 'sin error');

\echo '── 3. Borrar el mazo deja la partida ──'
select public.comprobar('Ash borra su mazo',
  public.error_de($q$delete from public.user_decks where id = '00000000-0000-0000-0000-00000000d0a1'$q$) = 'sin error');
select public.comprobar('…y sus dos partidas siguen ahí, sin el enlace',
  (select count(*) from public.match_log where id in ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000f2') and user_deck_id is null) = 2);
reset role;
