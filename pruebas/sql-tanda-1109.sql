-- Tanda 1109: lo de una propuesta en marcha sale del Mercado, contra PostgreSQL.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-1109.sql
--
-- Cada caso imprime «1109 ok …» o «1109 FALLA …». Las tablas imitan las de
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

drop table if exists public.tienda_stock, public.tiendas, public.tcg_card_prices, public.tcg_cards, public.trade_offer_items, public.trade_offers, public.trade_confirmations, public.user_notifications,
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
  is_admin boolean default false, is_moderator boolean default false, is_banned boolean default false, tipo text default 'persona');
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
  card_id text not null, idioma text, variante text, prioridad int not null default 1, created_at timestamptz not null default now());
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

create table public.tcg_cards (id text, market text default 'WEST', name_search text, set_id text);
create table public.tcg_card_prices (card_id text, cm_low numeric, cm_trend numeric);
create table public.tiendas (user_id uuid primary key, precio_visible boolean default true, ciudad text);
create table public.tienda_stock (id uuid primary key default gen_random_uuid(), tienda_id uuid, card_id text, market text default 'WEST', idioma text,
  variante text default 'normal', unidades int, visible boolean default true, precio numeric, oferta_precio numeric, oferta_hasta timestamptz, updated_at timestamptz default now());
create or replace function public.tienda_precio_de(p numeric, o numeric, h timestamptz) returns numeric language sql immutable as $f$ select coalesce(o, p) $f$;
\i /home/user/pingu/supabase-migration-cambios-hechos.sql
\i /home/user/pingu/supabase-migration-942-propuestas-cambio.sql
\i /home/user/pingu/supabase-migration-942-propuestas-cambio.sql
\i /home/user/pingu/supabase-migration-1098-cambio-recibido.sql
\i /home/user/pingu/supabase-migration-1098-cambio-recibido.sql
\i /home/user/pingu/supabase-migration-1099-cambio-envio.sql
\i /home/user/pingu/supabase-migration-1109-cambio-fuera-del-mercado.sql
\i /home/user/pingu/supabase-migration-1109-cambio-fuera-del-mercado.sql

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.user_profiles (id, username) values ('00000000-0000-0000-0000-0000000000a1','ana'), ('00000000-0000-0000-0000-0000000000b1','beto'), ('00000000-0000-0000-0000-0000000000c1','cris');
insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','obf-223','es','NM',2,2);

insert into public.tcg_cards values ('obf-223', 'WEST', 'charizard ex', 'obf'), ('sv2-269', 'WEST', 'iono', 'sv2');
-- Ana da dos copias de Charizard (aa01) y un Iono (aa02); Cris busca las dos.
insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000a1','sv2-269','es','NM',1,1);
insert into public.user_wants (user_id, card_id) values ('00000000-0000-0000-0000-0000000000c1', 'obf-223'), ('00000000-0000-0000-0000-0000000000c1', 'sv2-269');

set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
select case when string_agg(card_id || ':' || copias, ',' order by card_id) = 'obf-223:2,sv2-269:1' then '1109 ok   antes: el Mercado tiene las dos (2 Charizard, 1 Iono)' else '1109 FALLA ' || coalesce(string_agg(card_id || ':' || copias, ','), '-') end
  from public.mercado_con_tiendas();

-- Ana le propone a Beto una venta de un Charizard y el Iono.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000b1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1,"precio":30},{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa02","cantidad":1,"precio":10}]'::jsonb, 40, 'para', 'bizum', null);
  perform set_config('t1109.uno', v::text, false);
end $$;

select public.ponerse('00000000-0000-0000-0000-0000000000c1');
select case when string_agg(card_id || ':' || copias, ',' order by card_id) = 'obf-223:1' then '1109 ok   propuesta enviada: el Iono sale y queda un Charizard' else '1109 FALLA ' || coalesce(string_agg(card_id || ':' || copias, ','), '-') end
  from public.mercado_con_tiendas();
select case when string_agg(card_id || ':' || copias, ',' order by card_id) = 'obf-223:1' then '1109 ok   …y en el Mercado sin tiendas' else '1109 FALLA ' || coalesce(string_agg(card_id || ':' || copias, ','), '-') end
  from public.intercambios_mercado();
select case when count(*) = 0 then '1109 ok   «quién da el Iono»: nadie' else '1109 FALLA ' || count(*) end from public.intercambios_de_carta('sv2-269');
select case when string_agg(card_id || ':' || cambio, ',' order by card_id) = 'obf-223:1' then '1109 ok   los cruces de Cris: un Charizard' else '1109 FALLA ' || coalesce(string_agg(card_id || ':' || cambio, ','), '-') end
  from public.intercambios_quien_tiene();
select case when string_agg(card_id || ':' || cambio, ',' order by card_id) = 'obf-223:1' then '1109 ok   el perfil de Ana: un Charizard' else '1109 FALLA ' || coalesce(string_agg(card_id || ':' || cambio, ','), '-') end
  from public.intercambios_de_persona('00000000-0000-0000-0000-0000000000a1');
select case when string_agg(card_id || ':' || cantidad, ',' order by card_id) = 'obf-223:1,sv2-269:1' then '1109 ok   «Reservada» cuenta las enviadas' else '1109 FALLA ' || coalesce(string_agg(card_id || ':' || cantidad, ','), '-') end
  from public.cambios_reservadas(array['obf-223', 'sv2-269']);

-- Beto la acepta: aceptar no choca con su propia propuesta.
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when e.estado = 'aceptada' then '1109 ok   aceptarla funciona (no se bloquea a sí misma)' else '1109 FALLA ' || e.estado end
  from public.cambio_aceptar(current_setting('t1109.uno')::uuid, null) e;
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
select case when string_agg(card_id || ':' || copias, ',' order by card_id) = 'obf-223:1' then '1109 ok   aceptada: siguen fuera' else '1109 FALLA ' || coalesce(string_agg(card_id || ':' || copias, ','), '-') end
  from public.mercado_con_tiendas();

-- Si se anula, vuelven.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select (public.cambio_contestar(current_setting('t1109.uno')::uuid, 'anular')).estado as e \gset
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
select case when string_agg(card_id || ':' || copias, ',' order by card_id) = 'obf-223:2,sv2-269:1' then '1109 ok   anulada: vuelven al Mercado' else '1109 FALLA ' || coalesce(string_agg(card_id || ':' || copias, ','), '-') end
  from public.mercado_con_tiendas();
