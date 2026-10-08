-- El Mercado de Deseos y cambios (tanda 770), contra PostgreSQL.
--
--   1. ¿Sale lo que dan los demás, una fila por carta, y lo mío no?
--   2. ¿Cuenta personas (no líneas), copias e idiomas? ¿Avatares, cinco?
--   3. ¿Filtra por catálogo, idioma, texto, expansión y «solo las que busco»?
--   4. ¿Ordena por lo último, por gente y por precio? ¿Pagina y da el total?
--   5. ¿Un baneado no sale? ¿Lo ve anon?
--   6. ¿La migración se puede pasar dos veces?
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-mercado.sql
\set ON_ERROR_STOP off
\set QUIET on
set client_min_messages = notice;

drop schema if exists auth cascade;
create schema auth;
create table auth.yo (uid uuid);
insert into auth.yo values (null);
create or replace function auth.uid() returns uuid language sql stable security definer as $$ select uid from auth.yo $$;
create or replace function public.ponerse(p uuid) returns void language sql security definer as $$ update auth.yo set uid = p $$;

drop table if exists public.user_collection, public.user_profiles, public.user_wants, public.tcg_cards, public.tcg_card_prices cascade;
drop function if exists public.intercambios_mercado(text, text, text, text[], boolean, text, int, int);

create table public.user_profiles (id uuid primary key, username text, display_name text, avatar_url text,
  is_admin boolean, is_moderator boolean, is_banned boolean);
create table public.tcg_cards (id text, market text default 'WEST', set_id text, name text, name_search text,
  primary key (id, market));
create table public.tcg_card_prices (card_id text primary key, cm_low numeric, cm_trend numeric);
create table public.user_collection (id serial primary key, user_id uuid, card_id text, market text not null default 'WEST',
  idioma text not null default 'es', cantidad int default 1, cambio int not null default 0, updated_at timestamptz default now());
create table public.user_wants (id serial primary key, user_id uuid, card_id text, idioma text, prioridad int default 1);

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
end $$;
grant authenticated to jugador;
-- Nadie lee las tablas directamente: la función es security definer.
do $$ declare t text; begin
  foreach t in array array['user_collection','user_profiles','user_wants','tcg_cards','tcg_card_prices'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- YO (a1) busco Umbreon en cualquier idioma y Charizard en inglés.
-- MISTY da Umbreon (es) y Charizard (es y en: dos líneas); BROCK da
-- Umbreon (en) y Pikachu; GARY, baneado, da Mew; yo doy Pikachu; ERIKA da
-- una japonesa. Siete personas más dan Iono para pasar de cinco avatares.
insert into public.user_profiles (id, username, is_banned) values
  ('00000000-0000-0000-0000-0000000000a1','yo', false),
  ('00000000-0000-0000-0000-0000000000a2','misty', false),
  ('00000000-0000-0000-0000-0000000000a3','brock', false),
  ('00000000-0000-0000-0000-0000000000a4','gary', true),
  ('00000000-0000-0000-0000-0000000000a5','erika', false);
insert into public.user_profiles (id, username)
  select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'fan' || i from generate_series(1, 7) i;
insert into public.tcg_cards (id, market, set_id, name, name_search) values
  ('swsh7-215','WEST','swsh7','Umbreon VMAX','umbreon vmax'),
  ('sv3pt5-199','WEST','sv3pt5','Charizard ex','charizard ex'),
  ('sv8-238','WEST','sv8','Pikachu ex','pikachu ex'),
  ('sv3pt5-151','WEST','sv3pt5','Mew ex','mew ex'),
  ('sv2-269','WEST','sv2','Iono','iono'),
  ('SV2a-201','JP','SV2a','リザードン','リザードン charizard');
insert into public.tcg_card_prices values ('swsh7-215', 612, 600), ('sv3pt5-199', 118, 120), ('sv8-238', 85, 80), ('sv2-269', 42, 40);
insert into public.user_collection (user_id, card_id, market, idioma, cambio, updated_at) values
  ('00000000-0000-0000-0000-0000000000a2','swsh7-215','WEST','es',1, now() - interval '3 days'),
  ('00000000-0000-0000-0000-0000000000a2','sv3pt5-199','WEST','es',1, now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a2','sv3pt5-199','WEST','en',2, now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a3','swsh7-215','WEST','en',1, now() - interval '1 day'),
  ('00000000-0000-0000-0000-0000000000a3','sv8-238','WEST','es',1, now() - interval '5 days'),
  ('00000000-0000-0000-0000-0000000000a3','sv3pt5-151','WEST','es',0, now()),
  ('00000000-0000-0000-0000-0000000000a4','sv3pt5-151','WEST','es',3, now()),
  ('00000000-0000-0000-0000-0000000000a1','sv8-238','WEST','es',1, now()),
  ('00000000-0000-0000-0000-0000000000a5','SV2a-201','JP','ja',1, now());
insert into public.user_collection (user_id, card_id, market, idioma, cambio, updated_at)
  select ('00000000-0000-0000-0000-0000000001' || lpad(i::text, 2, '0'))::uuid, 'sv2-269', 'WEST', 'es', 1, now() - (i || ' hours')::interval
  from generate_series(1, 7) i;
insert into public.user_wants (user_id, card_id, idioma) values
  ('00000000-0000-0000-0000-0000000000a1','swsh7-215', null),
  ('00000000-0000-0000-0000-0000000000a1','sv3pt5-199', 'en');

\i /home/user/pingu/supabase-migration-mercado.sql
-- Dos veces: la migración se tiene que poder repetir.
\i /home/user/pingu/supabase-migration-mercado.sql

grant usage on schema public, auth to jugador, anon;
grant execute on function auth.uid(), public.ponerse(uuid) to jugador, anon;
create or replace function public.error_de(q text) returns text language plpgsql as $$
begin execute q; return 'sin error'; exception when others then return sqlerrm; end $$;
create or replace function public.comprobar(etiqueta text, ok boolean, extra text default '') returns void
language plpgsql as $$
begin
  raise notice '%', (case when coalesce(ok, false) then '  ok  ' else '  FALLA ' end) || etiqueta
    || case when coalesce(extra, '') <> '' then ' — ' || extra else '' end;
end $$;
grant execute on function public.error_de(text), public.comprobar(text, boolean, text) to jugador, anon;

\echo '── 1. Lo que dan los demás, por carta ──'
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
set role jugador;
select public.comprobar('cuatro cartas occidentales (sin la mía, sin la del baneado, sin la que da 0)',
  string_agg(card_id, ',' order by card_id) = 'sv2-269,sv3pt5-199,sv8-238,swsh7-215', string_agg(card_id, ',' order by card_id))
  from public.intercambios_mercado();
select public.comprobar('  …Pikachu la da Brock, no yo', dan = array['00000000-0000-0000-0000-0000000000a3'::uuid], dan::text)
  from public.intercambios_mercado() where card_id = 'sv8-238';

\echo '── 2. Personas, copias, idiomas y avatares ──'
select public.comprobar('Charizard: una persona con dos líneas = 1 persona, 3 copias, es y en',
  personas = 1 and copias = 3 and idiomas = array['en','es'], format('%s %s %s', personas, copias, idiomas))
  from public.intercambios_mercado() where card_id = 'sv3pt5-199';
select public.comprobar('  …y sale una vez en los avatares', jsonb_array_length(gente) = 1 and gente->0->>'username' = 'misty', gente::text)
  from public.intercambios_mercado() where card_id = 'sv3pt5-199';
select public.comprobar('Umbreon: Brock (el más reciente) primero', dan[1] = '00000000-0000-0000-0000-0000000000a3' and personas = 2, dan::text)
  from public.intercambios_mercado() where card_id = 'swsh7-215';
select public.comprobar('Iono: siete personas, cinco avatares y las siete ids',
  personas = 7 and jsonb_array_length(gente) = 5 and cardinality(dan) = 7, format('%s %s %s', personas, jsonb_array_length(gente), cardinality(dan)))
  from public.intercambios_mercado() where card_id = 'sv2-269';
select public.comprobar('  …con su rango (is_admin) en cada avatar', (gente->0) ? 'is_admin', gente->>0)
  from public.intercambios_mercado() where card_id = 'sv2-269';

\echo '── 3. Filtros ──'
select public.comprobar('catálogo japonés: solo la japonesa', string_agg(card_id, ',') = 'SV2a-201', string_agg(card_id, ','))
  from public.intercambios_mercado('JP');
select public.comprobar('en inglés: Charizard y Umbreon', string_agg(card_id, ',' order by card_id) = 'sv3pt5-199,swsh7-215', string_agg(card_id, ','))
  from public.intercambios_mercado('WEST', 'en');
select public.comprobar('  …y cuenta solo lo de ese idioma', copias = 2, copias::text)
  from public.intercambios_mercado('WEST', 'en') where card_id = 'sv3pt5-199';
select public.comprobar('texto «chari»', string_agg(card_id, ',') = 'sv3pt5-199', string_agg(card_id, ','))
  from public.intercambios_mercado('WEST', null, 'chari');
select public.comprobar('texto en japonés y en inglés (name_search lleva los dos)', string_agg(card_id, ',') = 'SV2a-201', string_agg(card_id, ','))
  from public.intercambios_mercado('JP', null, 'charizard');
select public.comprobar('expansión sv3pt5', string_agg(card_id, ',') = 'sv3pt5-199', string_agg(card_id, ','))
  from public.intercambios_mercado('WEST', null, null, array['sv3pt5']);
select public.comprobar('solo las que busco: Umbreon y Charizard', string_agg(card_id, ',' order by card_id) = 'sv3pt5-199,swsh7-215', string_agg(card_id, ','))
  from public.intercambios_mercado('WEST', null, null, null, true);
select public.comprobar('  …y de Charizard, la inglesa (la quiero en inglés)', copias = 2 and idiomas = array['en'], format('%s %s', copias, idiomas))
  from public.intercambios_mercado('WEST', null, null, null, true) where card_id = 'sv3pt5-199';

\echo '── 4. Orden, páginas y total ──'
select public.comprobar('lo último primero: Iono (hace 1 h)', (array_agg(card_id))[1] = 'sv2-269', string_agg(card_id, ','))
  from public.intercambios_mercado();
select public.comprobar('por gente: Iono, luego Umbreon', (array_agg(card_id))[1:2] = array['sv2-269','swsh7-215'], string_agg(card_id, ','))
  from public.intercambios_mercado('WEST', null, null, null, false, 'gente');
select public.comprobar('más caro: Umbreon, Charizard, Pikachu, Iono', string_agg(card_id, ',') = 'swsh7-215,sv3pt5-199,sv8-238,sv2-269', string_agg(card_id, ','))
  from public.intercambios_mercado('WEST', null, null, null, false, 'caro');
select public.comprobar('página de dos, la segunda, con el total de cuatro',
  count(*) = 2 and min(total) = 4 and max(total) = 4, format('%s filas, total %s', count(*), min(total)))
  from public.intercambios_mercado('WEST', null, null, null, false, 'caro', 2, 2);
reset role;

\echo '── 5. Sin cuenta ──'
select public.ponerse(null);
set role anon;
select public.comprobar('anon la llama', public.error_de('select * from public.intercambios_mercado()') = 'sin error');
select public.comprobar('  …y sale también lo que doy yo (no hay «yo»)', count(*) = 4, count(*)::text)
  from public.intercambios_mercado();
select public.comprobar('  …y «solo las que busco» sin cuenta no da nada', count(*) = 0, count(*)::text)
  from public.intercambios_mercado('WEST', null, null, null, true);
select public.comprobar('anon no lee la colección directamente',
  public.error_de('select * from public.user_collection') like '%permission denied%');
reset role;
