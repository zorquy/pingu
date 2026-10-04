-- «Enlaces cortos», contra PostgreSQL (tanda 591).
--
--   1. ¿Crear da un id de 8 letras, y la misma carga otra vez el MISMO id?
--   2. ¿Leer por el id devuelve el tipo y la carga, con cuenta y sin ella,
--      y un id que no existe no devuelve nada?
--   3. ¿Solo la forma que hace la web (p= / t= para una repetición, pos=
--      para una posición), ni vacía ni de más de 60.000?
--   4. ¿Nadie lee ni escribe la tabla a mano, ni la lista?
--   5. ¿El tope por conexión (30 por hora) y que otra conexión sí puede?
--   6. ¿Sin cabeceras (desde el SQL Editor) no hay tope por conexión?
--   7. ¿El tope del día entre todos?
--   8. ¿La migración se puede ejecutar otra vez?
--
--   psql -h /var/tmp -p 5433 -U postgres -d prueba_enlaces -f sql-enlaces-cortos.sql
\set ON_ERROR_STOP off
\set QUIET on
set client_min_messages = warning;

drop table if exists public.enlaces_cortos cascade;
drop function if exists public.enlace_corto_crear(text, text) cascade;
drop function if exists public.enlace_corto_leer(text) cascade;
drop function if exists public.enlaces_cortos_quien() cascade;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'visitante') then create role visitante nologin; end if;
end $$;
grant authenticated to jugador;
grant anon to visitante;
grant usage on schema public to anon, authenticated;

\i /home/user/pingu/supabase-migration-enlaces-cortos.sql

set client_min_messages = notice;
create or replace function public.error_de(q text) returns text language plpgsql as $$
begin execute q; return 'sin error'; exception when others then return sqlerrm; end $$;
create or replace function public.comprobar(etiqueta text, ok boolean, extra text default '') returns void
language plpgsql as $$
begin
  raise notice '%', (case when coalesce(ok, false) then '  ok  ' else '  FALLA ' end) || etiqueta
    || case when coalesce(extra, '') <> '' then ' — ' || extra else '' end;
end $$;
grant execute on function public.error_de(text), public.comprobar(text, boolean, text) to anon, authenticated;
create temp table ids (k text, id text);
grant select, insert on ids to anon, authenticated;

-- Las cabeceras de una conexión, como las pone PostgREST.
select set_config('request.headers', '{"x-forwarded-for": "1.2.3.4, 10.0.0.1"}', false);

\echo '── 1. Crear ──'
set role visitante;
insert into ids select 'a', public.enlace_corto_crear('repeticion', 'p=' || repeat('Ab_-9', 40));
select public.comprobar('sin cuenta se crea, con un id de 8 letras', (select id ~ '^[a-z2-9]{8}$' from ids where k = 'a'), (select id from ids where k = 'a'));
insert into ids select 'a2', public.enlace_corto_crear('repeticion', 'p=' || repeat('Ab_-9', 40));
select public.comprobar('  …y la misma carga otra vez es el MISMO enlace', (select id from ids where k = 'a') = (select id from ids where k = 'a2'));
reset role;
select public.comprobar('  …(una sola fila)', (select count(*) from public.enlaces_cortos) = 1);
select public.comprobar('  …y lo que se guarda de la conexión no es la conexión', (select quien = md5('pokedoc-enlaces:1.2.3.4') from public.enlaces_cortos));
set role jugador;
insert into ids select 'b', public.enlace_corto_crear('posicion', 'pos=' || repeat('xyZ09', 30));
select public.comprobar('con cuenta también, y una posición', (select id ~ '^[a-z2-9]{8}$' from ids where k = 'b'));
insert into ids select 'b2', public.enlace_corto_crear('repeticion', 't=' || repeat('xyZ09', 30));
select public.comprobar('  …la misma carga con OTRO tipo es otro enlace', (select id from ids where k = 'b') <> (select id from ids where k = 'b2'));
reset role;

\echo '── 2. Leer ──'
set role visitante;
select public.comprobar('sin cuenta se lee: el tipo y la carga, tal cual', (select tipo = 'repeticion' and carga = 'p=' || repeat('Ab_-9', 40) from public.enlace_corto_leer((select id from ids where k = 'a'))));
select public.comprobar('  …y un id que no existe no devuelve nada', (select count(*) from public.enlace_corto_leer('zzzzzzzz')) = 0);
reset role;
set role jugador;
select public.comprobar('con cuenta, la posición', (select tipo = 'posicion' from public.enlace_corto_leer((select id from ids where k = 'b'))));
reset role;

\echo '── 3. La forma ──'
set role visitante;
select public.comprobar('un tipo que no existe no', e like 'Ese tipo de enlace no existe%', e) from public.error_de($q$select public.enlace_corto_crear('foto', 'p=abcdefgh')$q$) e;
select public.comprobar('una carga que no es de la web no', e like 'Eso no es un enlace de PokeDoc%', e) from public.error_de($q$select public.enlace_corto_crear('repeticion', 'https://otra-web.example/abc')$q$) e;
select public.comprobar('  …ni una posición con la forma de una repetición', e like 'Eso no es un enlace de PokeDoc%', e) from public.error_de($q$select public.enlace_corto_crear('posicion', 'p=abcdefghij')$q$) e;
select public.comprobar('  …ni corta', e like 'Eso no cabe%', e) from public.error_de($q$select public.enlace_corto_crear('repeticion', 'p=ab')$q$) e;
select public.comprobar('  …ni de más de 60.000', e like 'Eso no cabe%', e) from public.error_de(format('select public.enlace_corto_crear(%L, %L)', 'repeticion', 'p=' || repeat('a', 60000))) e;
reset role;

\echo '── 4. A mano, no ──'
set role visitante;
select public.comprobar('sin cuenta no se lee la tabla', e like '%permission denied%', e) from public.error_de('select * from public.enlaces_cortos') e;
reset role;
set role jugador;
select public.comprobar('con cuenta tampoco (no se pueden listar)', e like '%permission denied%', e) from public.error_de('select id from public.enlaces_cortos') e;
select public.comprobar('  …ni escribir', e like '%permission denied%', e) from public.error_de($q$insert into public.enlaces_cortos (id, tipo, carga, huella) values ('aaaaaaaa', 'repeticion', 'p=abcdefgh', 'x')$q$) e;
reset role;

\echo '── 5. Por conexión ──'
set role visitante;
do $$ begin for i in 1..27 loop perform public.enlace_corto_crear('repeticion', 'p=n' || i || repeat('q', 20)); end loop; end $$;
reset role;
select public.comprobar('la misma conexión lleva 30 en la hora', (select count(*) from public.enlaces_cortos where quien = md5('pokedoc-enlaces:1.2.3.4')) = 30);
set role visitante;
select public.comprobar('  …y la 31 no', e like 'Has hecho muchos enlaces cortos%', e) from public.error_de($q$select public.enlace_corto_crear('repeticion', 'p=otra' || repeat('q', 20))$q$) e;
select public.comprobar('  …pero una que ya existe sí (no es un enlace nuevo)', (select public.enlace_corto_crear('repeticion', 'p=' || repeat('Ab_-9', 40))) = (select id from ids where k = 'a'));
reset role;
select set_config('request.headers', '{"cf-connecting-ip": "5.6.7.8"}', false);
set role visitante;
select public.comprobar('otra conexión sí puede', (select public.enlace_corto_crear('repeticion', 'p=otra' || repeat('q', 20))) ~ '^[a-z2-9]{8}$');
reset role;

\echo '── 6. Sin cabeceras ──'
select set_config('request.headers', '', false);
do $$ begin for i in 1..35 loop perform public.enlace_corto_crear('repeticion', 'p=sin' || i || repeat('w', 20)); end loop; end $$;
select public.comprobar('sin cabeceras no hay tope por conexión (35 seguidas)', (select count(*) from public.enlaces_cortos where quien is null) = 35);

\echo '── 7. El del día ──'
insert into public.enlaces_cortos (id, tipo, carga, huella, creado_at)
  select 'r' || lpad(g::text, 7, '0'), 'repeticion', 'p=relleno' || g, md5('relleno' || g), now() - interval '2 hours' from generate_series(1, 3000) g;
select set_config('request.headers', '{"x-forwarded-for": "9.9.9.9"}', false);
set role visitante;
select public.comprobar('con 3.000 en el día, uno nuevo ya no', e like 'Hoy ya se han hecho muchos%', e) from public.error_de($q$select public.enlace_corto_crear('repeticion', 'p=del-dia' || repeat('q', 20))$q$) e;
select public.comprobar('  …y leer sigue igual', (select count(*) from public.enlace_corto_leer((select id from ids where k = 'a'))) = 1);
reset role;
delete from public.enlaces_cortos where id like 'r_______' and carga like 'p=relleno%';

\echo '── 8. Otra vez ──'
set client_min_messages = warning;
\i /home/user/pingu/supabase-migration-enlaces-cortos.sql
set client_min_messages = notice;
select public.comprobar('ejecutarla otra vez no pierde nada', (select count(*) from public.enlaces_cortos) = 66);
set role visitante;
select public.comprobar('  …y se sigue leyendo', (select count(*) from public.enlace_corto_leer((select id from ids where k = 'a'))) = 1);
reset role;
