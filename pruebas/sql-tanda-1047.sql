-- Tanda 1047: los deseos con versión, contra PostgreSQL (sobre la base de la 942).
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-1047.sql
--
-- Cada caso imprime «ok …» o «MAL …». Las tablas imitan las de
-- verdad en lo que la migración toca (ids uuid, las restricciones y los
-- disparadores de user_collection, los mensajes y los avisos).
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

drop table if exists public.trade_offer_items, public.trade_offers, public.trade_confirmations, public.user_notifications,
  public.private_messages, public.conversation_participants, public.conversations, public.user_wants,
  public.user_collection, public.user_profiles cascade;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'jugador') then create role jugador nologin; end if;
end $$;
grant authenticated to jugador;
grant usage on schema auth to authenticated, anon;
grant execute on function public.ponerse(uuid) to authenticated;

create table public.user_profiles (id uuid primary key, username text, display_name text, avatar_url text,
  is_admin boolean default false, is_moderator boolean default false, is_banned boolean default false);
create table public.user_collection (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null, market text not null default 'WEST', idioma text not null default 'es',
  estado text not null default 'NM', variante text not null default 'normal', cantidad int not null default 1,
  gradeo text, valor_manual numeric(10,2), precio_compra numeric(10,2), notas text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  cambio int not null default 0,
  constraint user_collection_idioma check (idioma in ('es','en','fr','de','it','pt','ja')),
  constraint user_collection_estado check (estado in ('MT','NM','EX','GD','LP','PL','PO')),
  constraint user_collection_variante check (variante ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint user_collection_cantidad check (cantidad between 1 and 999));
create or replace function public.user_collection_tocar() returns trigger language plpgsql as $$
begin new.updated_at := now(); new.user_id := old.user_id; return new; end $$;
create trigger user_collection_tocar before update on public.user_collection for each row execute function public.user_collection_tocar();
create table public.user_wants (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users (id),
  card_id text not null, idioma text, prioridad int not null default 1, created_at timestamptz not null default now());
create table public.conversations (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
create table public.conversation_participants (conversation_id uuid references public.conversations (id) on delete cascade,
  user_id uuid references auth.users (id), last_read_at timestamptz, primary key (conversation_id, user_id));
create table public.private_messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references public.conversations (id),
  sender_id uuid not null references auth.users (id), body text not null, adjuntos jsonb not null default '[]', deleted_at timestamptz,
  created_at timestamptz not null default now());
create table public.user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null references auth.users (id),
  type text not null, title text not null, body text, link text, read_at timestamptz, created_at timestamptz not null default now());
do $$ declare t text; begin
  foreach t in array array['user_collection','user_profiles','user_wants','conversations','conversation_participants','private_messages','user_notifications'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
-- Lo que la 1047 toca además: el aviso (perfiles con sus preferencias, a
-- quién sigues), el Mercado (cartas y precios) y el índice de no repetir tal
-- como lo dejó la 376.
alter table public.user_profiles add column notification_prefs_disabled text[];
alter table public.user_wants add column notas text;
create unique index user_wants_unico on public.user_wants (user_id, card_id, coalesce(idioma, '*'));
create table public.user_follows (follower_id uuid, following_id uuid, primary key (follower_id, following_id));
create table public.tcg_cards (id text, market text not null default 'WEST', set_id text, name text, name_es text, name_search text, primary key (id, market));
create table public.tcg_card_prices (card_id text primary key, cm_low numeric, cm_trend numeric);
-- Lo de juntar repetidas se prueba en la otra base (sql-tanda-1047-repetidas.sql);
-- aquí basta con que exista la tabla que su función declara.
create table public.tcg_repetidas_hechas (id bigserial primary key);
\i /home/user/pingu/supabase-migration-cambios-hechos.sql
\i /home/user/pingu/supabase-migration-942-propuestas-cambio.sql
\i /home/user/pingu/supabase-migration-cambios-seguidos.sql
drop trigger if exists intercambios_avisar on public.user_collection;
create trigger intercambios_avisar after insert or update of cambio on public.user_collection
  for each row execute function public.intercambios_avisar();

\set ON_ERROR_STOP on
\i /home/user/pingu/supabase-migration-1047-deseos-con-version.sql
-- Dos veces: se puede volver a ejecutar.
\i /home/user/pingu/supabase-migration-1047-deseos-con-version.sql
\set ON_ERROR_STOP off
\pset tuples_only on
\pset format unaligned

-- Ana (a1) busca la Chikorita del McDonald's 2021 en HOLO. Beto (b1) da la
-- normal; Cris (c1) da la holo y busca un Cyndaquil en Reverse.
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.user_profiles (id, username) values ('00000000-0000-0000-0000-0000000000a1','ana'), ('00000000-0000-0000-0000-0000000000b1','beto'), ('00000000-0000-0000-0000-0000000000c1','cris');
insert into public.tcg_cards (id, set_id, name, name_search) values ('mcd21-2', 'mcd21', 'Chikorita', 'chikorita'), ('mcd21-3', 'mcd21', 'Cyndaquil', 'cyndaquil');
insert into public.user_wants (id, user_id, card_id, idioma, variante) values
  ('00000000-0000-0000-0000-00000000ee01', '00000000-0000-0000-0000-0000000000a1', 'mcd21-2', null, 'holo'),
  ('00000000-0000-0000-0000-00000000ee02', '00000000-0000-0000-0000-0000000000c1', 'mcd21-3', null, 'reverse');
insert into public.user_collection (id, user_id, card_id, idioma, variante, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000bb01', '00000000-0000-0000-0000-0000000000b1', 'mcd21-2', 'es', 'normal', 1, 1),
  ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-0000000000c1', 'mcd21-2', 'es', 'holo', 1, 1),
  ('00000000-0000-0000-0000-00000000aa01', '00000000-0000-0000-0000-0000000000a1', 'mcd21-3', 'es', 'normal', 1, 1);

-- 1. La columna y la regla de no repetir.
select case when count(*) = 1 then 'ok la columna variante existe' else 'MAL falta la columna' end
  from information_schema.columns where table_name = 'user_wants' and column_name = 'variante';
select case when pg_get_indexdef('public.user_wants_unico'::regclass) like '%COALESCE(variante%' then 'ok el índice de no repetir cuenta la versión' else 'MAL índice: ' || pg_get_indexdef('public.user_wants_unico'::regclass) end;
do $$ begin
  insert into public.user_wants (user_id, card_id, idioma, variante) values ('00000000-0000-0000-0000-0000000000a1', 'mcd21-2', null, 'normal');
  insert into public.user_wants (user_id, card_id, idioma, variante) values ('00000000-0000-0000-0000-0000000000a1', 'mcd21-2', null, null);
  raise notice 'ok la Holo, la Normal y «cualquiera» son tres deseos';
  delete from public.user_wants where card_id = 'mcd21-2' and user_id = '00000000-0000-0000-0000-0000000000a1' and coalesce(variante, '') <> 'holo';
exception when others then raise notice 'MAL no deja apuntar otra versión: %', sqlerrm; end $$;
do $$ begin
  insert into public.user_wants (user_id, card_id, idioma, variante) values ('00000000-0000-0000-0000-0000000000a1', 'mcd21-2', null, 'holo');
  raise notice 'MAL la misma versión dos veces';
exception when unique_violation then raise notice 'ok la misma versión dos veces no'; end $$;
do $$ begin
  insert into public.user_wants (user_id, card_id, variante) values ('00000000-0000-0000-0000-0000000000a1', 'mcd21-3', 'Holo!');
  raise notice 'MAL una versión con otra forma';
exception when check_violation then raise notice 'ok una versión con otra forma no entra'; end $$;

-- 2. Quién tiene lo que buscas: la holo de Cris sí, la normal de Beto no.
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select case when string_agg(username || ':' || variante, ',' order by username) = 'cris:holo' then 'ok Ana (Holo) solo se cruza con la holo de Cris'
  else 'MAL quien_tiene: ' || coalesce(string_agg(username || ':' || variante, ','), 'nadie') end from public.intercambios_quien_tiene(50);
-- Recíproco: Cris busca el Cyndaquil Reverse y Ana lo da en normal: no cuenta.
select case when bool_or(reciproco) is false then 'ok la normal de Ana no le vale a Cris (Reverse): no es recíproco' else 'MAL recíproco con la versión equivocada' end
  from public.intercambios_quien_tiene(50);
reset role;
insert into public.user_collection (id, user_id, card_id, idioma, variante, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa02', '00000000-0000-0000-0000-0000000000a1', 'mcd21-3', 'es', 'reverse', 1, 1);
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select case when bool_and(reciproco) then 'ok con la Reverse ya es recíproco' else 'MAL la Reverse no cuenta' end
  from public.intercambios_quien_tiene(50);
-- Y «cualquiera» casa con las dos.
reset role;
update public.user_wants set variante = null where id = '00000000-0000-0000-0000-00000000ee01';
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select case when count(distinct user_id) = 2 then 'ok «cualquier versión» se cruza con Beto y Cris' else 'MAL cualquiera: ' || count(distinct user_id) end
  from public.intercambios_quien_tiene(50);
reset role;
update public.user_wants set variante = 'holo' where id = '00000000-0000-0000-0000-00000000ee01';

-- 3. Quién busca lo que das: a Beto (normal) no le sale Ana; a Cris (holo), sí.
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when count(*) = 0 then 'ok a Beto no le sale Ana (busca la Holo)' else 'MAL quien_busca de Beto: ' || count(*) end
  from public.intercambios_quien_busca(50) where username = 'ana';
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
select case when count(*) = 1 then 'ok a Cris le sale Ana' else 'MAL quien_busca de Cris: ' || count(*) end
  from public.intercambios_quien_busca(50) where username = 'ana';

-- 4. El Mercado con «Solo las que busco»: la Chikorita la da una persona (Cris).
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select case when personas = 1 and dan = array['00000000-0000-0000-0000-0000000000c1']::uuid[] then 'ok el Mercado de lo que busco cuenta solo la holo'
  else 'MAL mercado: ' || personas end
  from public.intercambios_mercado('WEST', null, null, null, true) where card_id = 'mcd21-2';
select case when personas = 2 then 'ok sin «Solo las que busco», las dos' else 'MAL mercado entero: ' || personas end
  from public.intercambios_mercado('WEST', null, null, null, false) where card_id = 'mcd21-2';
reset role;

-- 5. El aviso: que Beto ponga otra normal no avisa a Ana; que Cris ponga otra holo, sí.
delete from public.user_notifications;
insert into public.user_collection (user_id, card_id, idioma, variante, cantidad, cambio) values
  ('00000000-0000-0000-0000-0000000000b1', 'mcd21-2', 'en', 'normal', 1, 1);
select case when count(*) = 0 then 'ok una normal no avisa a quien busca la Holo' else 'MAL avisa de la normal' end
  from public.user_notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1';
insert into public.user_collection (user_id, card_id, idioma, variante, cantidad, cambio) values
  ('00000000-0000-0000-0000-0000000000c1', 'mcd21-2', 'en', 'holo', 1, 1);
select case when count(*) = 1 then 'ok una holo sí avisa' else 'MAL avisos de la holo: ' || count(*) end
  from public.user_notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1' and type = 'trade_match';

-- 6. Al cerrar un cambio, a Ana se le tacha la Holo y no la Normal.
insert into public.user_wants (id, user_id, card_id, idioma, variante) values
  ('00000000-0000-0000-0000-00000000ee03', '00000000-0000-0000-0000-0000000000a1', 'mcd21-2', null, 'normal');
insert into public.trade_offers (id, de, para, estado) values ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1', 'aceptada');
insert into public.trade_offer_items (oferta, quien, linea, card_id, idioma, variante, cantidad) values
  ('00000000-0000-0000-0000-0000000000f1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000cc01', 'mcd21-2', 'es', 'holo', 1);
select public.cambio_mover('00000000-0000-0000-0000-0000000000f1') is not null;
select case when string_agg(coalesce(variante, '*'), ',') = 'normal' then 'ok al recibir la holo se tacha el deseo Holo y queda el Normal'
  else 'MAL deseos tras el cambio: ' || coalesce(string_agg(coalesce(variante, '*'), ','), 'ninguno') end
  from public.user_wants where user_id = '00000000-0000-0000-0000-0000000000a1' and card_id = 'mcd21-2';
select case when count(*) = 1 then 'ok y Ana tiene la holo' else 'MAL la holo no ha llegado' end
  from public.user_collection where user_id = '00000000-0000-0000-0000-0000000000a1' and card_id = 'mcd21-2' and variante = 'holo';
