-- Tanda 1107: el Bizum o el PayPal de quien cobra, contra PostgreSQL.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-1107.sql
--
-- Cada caso imprime «1107 ok …» o «1107 FALLA …». Las tablas imitan las de
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

drop table if exists public.trade_offer_cobros, public.user_cobros, public.trade_offer_direcciones, public.user_direcciones, public.trade_offer_items, public.trade_offers, public.trade_confirmations, public.user_notifications,
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

\i /home/user/pingu/supabase-migration-cambios-hechos.sql
\i /home/user/pingu/supabase-migration-942-propuestas-cambio.sql
\i /home/user/pingu/supabase-migration-942-propuestas-cambio.sql
\i /home/user/pingu/supabase-migration-1098-cambio-recibido.sql
\i /home/user/pingu/supabase-migration-1098-cambio-recibido.sql
\i /home/user/pingu/supabase-migration-1099-cambio-envio.sql
\i /home/user/pingu/supabase-migration-1101-cambio-mensaje.sql
\i /home/user/pingu/supabase-migration-1102-cambio-direccion.sql
\i /home/user/pingu/supabase-migration-1103-cambio-enviado.sql
\i /home/user/pingu/supabase-migration-1107-cambio-cobro.sql
\i /home/user/pingu/supabase-migration-1107-cambio-cobro.sql

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.user_profiles (id, username) values ('00000000-0000-0000-0000-0000000000a1','ana'), ('00000000-0000-0000-0000-0000000000b1','beto'), ('00000000-0000-0000-0000-0000000000c1','cris');
insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','obf-223','es','NM',2,2);

insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-0000000000b1','sv2-269','es','NM',1,1);

set role jugador;
-- 1. Ana le vende a Beto por Bizum (Beto paga, Ana cobra).
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000b1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1,"precio":30}]'::jsonb, 30, 'para', 'bizum', null);
  perform set_config('t1107.uno', v::text, false);
  perform public.cambio_envio_poner(v, 'mano');
end $$;
do $$ begin
  perform public.cambio_cobro_poner(current_setting('t1107.uno')::uuid, '12');
  raise notice '1107 FALLA un número corto entra';
exception when others then raise notice '1107 ok   un número corto no entra (%)', sqlerrm; end $$;
select public.cambio_cobro_poner(current_setting('t1107.uno')::uuid, '600 11 22 33');
select case when dato = '600112233' and como = 'bizum' then '1107 ok   Ana pone su Bizum, limpio' else '1107 FALLA ' || coalesce(dato, '-') end from public.cambio_cobros(array[current_setting('t1107.uno')::uuid]);
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when count(*) = 0 then '1107 ok   Beto no lo ve antes de aceptar' else '1107 FALLA Beto ve ' || count(*) end from public.cambio_cobros(array[current_setting('t1107.uno')::uuid]);
do $$ begin
  perform public.cambio_cobro_poner(current_setting('t1107.uno')::uuid, '600112233');
  raise notice '1107 FALLA quien paga pone un Bizum';
exception when others then raise notice '1107 ok   quien paga no pone nada (%)', sqlerrm; end $$;
select (public.cambio_aceptar(current_setting('t1107.uno')::uuid, null)).estado as e \gset
select case when count(*) = 1 then '1107 ok   aceptado, Beto lo ve' else '1107 FALLA Beto ve ' || count(*) end from public.cambio_cobros(array[current_setting('t1107.uno')::uuid]);
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select public.cambio_cobro_poner(current_setting('t1107.uno')::uuid, '+34 611 22 33 44');
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
select case when count(*) = 0 then '1107 ok   un tercero no ve nada' else '1107 FALLA Cris ve ' || count(*) end from public.cambio_cobros(array[current_setting('t1107.uno')::uuid]);

-- 2. Un cambio en mano sin dinero, y uno por PayPal.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000c1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1}]'::jsonb, 0, null, null, null);
  perform public.cambio_cobro_poner(v, '600112233');
  raise notice '1107 FALLA sin dinero se pone un Bizum';
exception when others then raise notice '1107 ok   sin dinero no hay cobro (%)', sqlerrm; end $$;
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000c1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1}]'::jsonb, 10, 'para', 'paypal', null);
  perform set_config('t1107.dos', v::text, false);
  begin
    perform public.cambio_cobro_poner(v, 'hola que tal');
    raise notice '1107 FALLA un PayPal raro entra';
  exception when others then raise notice '1107 ok   un PayPal raro no entra (%)', sqlerrm; end;
  perform public.cambio_cobro_poner(v, '@ana_tcg');
end $$;
select case when dato = '@ana_tcg' and como = 'paypal' then '1107 ok   el PayPal entra' else '1107 FALLA paypal' end from public.cambio_cobros(array[current_setting('t1107.dos')::uuid]);

-- 3. Lo guardado: solo lo tuyo.
insert into public.user_cobros (bizum, paypal) values ('600112233', 'ana@pokedoc.es');
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when count(*) = 0 then '1107 ok   lo guardado de Ana no lo ve Beto' else '1107 FALLA Beto ve ' || count(*) end from public.user_cobros;
do $$ begin
  perform 1 from public.trade_offer_cobros;
  raise notice '1107 FALLA la tabla de los tratos se lee a pelo';
exception when others then raise notice '1107 ok   la tabla de los tratos no se lee a pelo (%)', sqlerrm; end $$;
reset role;
select case when count(*) = 1 and bool_and(body = 'Ya tienes mi Bizum para pagarme.') and bool_and(adjuntos->0->>'evento' = 'cambio_cobro') then '1107 ok   ponerlo ya aceptado avisa con «cambio_cobro»' else '1107 FALLA avisos ' || count(*) end
  from public.private_messages where body like 'Ya tienes mi%pagarme.';
select case when dato = '+34611223344' then '1107 ok   el nuevo sustituye al de antes' else '1107 FALLA ' || dato end from public.trade_offer_cobros where oferta = current_setting('t1107.uno')::uuid;

-- 4. El borrado a los 30 días se lleva también el cobro.
update public.trade_offers set estado = 'hecha', hecha_at = now() - interval '31 days' where id = current_setting('t1107.uno')::uuid;
select public.cambio_direcciones_purgar();
select case when count(*) = 0 then '1107 ok   el de un trato cerrado hace 31 días se borra' else '1107 FALLA quedan ' || count(*) end from public.trade_offer_cobros where oferta = current_setting('t1107.uno')::uuid;
select case when count(*) = 1 then '1107 ok   …y el de uno en marcha, no' else '1107 FALLA el otro: ' || count(*) end from public.trade_offer_cobros where oferta = current_setting('t1107.dos')::uuid;
