-- Tanda 1102: la dirección en los cambios por correo, contra PostgreSQL.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-1102.sql
--
-- Cada caso imprime «1102 ok …» o «1102 FALLA …». Las tablas imitan las de
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

drop table if exists public.trade_offer_direcciones, public.user_direcciones, public.trade_offer_items, public.trade_offers, public.trade_confirmations, public.user_notifications,
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
\i /home/user/pingu/supabase-migration-1102-cambio-direccion.sql

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.user_profiles (id, username) values ('00000000-0000-0000-0000-0000000000a1','ana'), ('00000000-0000-0000-0000-0000000000b1','beto'), ('00000000-0000-0000-0000-0000000000c1','cris');
insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','obf-223','es','NM',2,2);

insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-0000000000b1','sv2-269','es','NM',1,1);

set role jugador;
-- 1. Ana le propone a Beto un cambio por correo (una carta cada uno) y adjunta su dirección.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000b1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1},{"de":"otro","linea":"00000000-0000-0000-0000-00000000bb01","cantidad":1}]'::jsonb, 0, null, null, null);
  perform set_config('t1102.uno', v::text, false);
  perform public.cambio_envio_poner(v, 'correo');
  perform public.cambio_direccion_poner(v, '{"nombre":"Ana Ruiz","calle":"C/ Sol 1","cp":"28001","ciudad":"Madrid"}');
end $$;
select case when count(*) = 1 then '1102 ok   Ana ve la suya' else '1102 FALLA Ana ve ' || count(*) end from public.cambio_direcciones(array[current_setting('t1102.uno')::uuid]);
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when count(*) = 0 then '1102 ok   Beto no la ve antes de aceptar' else '1102 FALLA Beto ve ' || count(*) end from public.cambio_direcciones(array[current_setting('t1102.uno')::uuid]);
do $$ begin
  perform public.cambio_direccion_poner(current_setting('t1102.uno')::uuid, '{"nombre":"B","calle":"x","cp":"1","ciudad":""}');
  raise notice '1102 FALLA una dirección a medias entra';
exception when others then raise notice '1102 ok   una dirección a medias no entra (%)', sqlerrm; end $$;
-- Beto pone la suya y acepta.
do $$ begin
  perform public.cambio_direccion_poner(current_setting('t1102.uno')::uuid, '{"nombre":"Beto Gil","calle":"Av. Mar 3","cp":"41001","ciudad":"Sevilla","telefono":"600"}');
  perform public.cambio_aceptar(current_setting('t1102.uno')::uuid, 'certificado');
end $$;
select case when count(*) = 2 then '1102 ok   aceptado, Beto ve las dos' else '1102 FALLA Beto ve ' || count(*) end from public.cambio_direcciones(array[current_setting('t1102.uno')::uuid]);
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select case when string_agg(ciudad, ',' order by ciudad) = 'Madrid,Sevilla' then '1102 ok   Ana ve las dos' else '1102 FALLA Ana: ' || coalesce(string_agg(ciudad, ','), '-') end from public.cambio_direcciones(array[current_setting('t1102.uno')::uuid]);
-- Ana la cambia ya aceptado: al otro le llega el aviso.
select public.cambio_direccion_poner(current_setting('t1102.uno')::uuid, '{"nombre":"Ana Ruiz","calle":"C/ Luna 2","cp":"28002","ciudad":"Madrid"}');
-- Cris no ve nada de un trato ajeno.
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
select case when count(*) = 0 then '1102 ok   un tercero no ve nada' else '1102 FALLA Cris ve ' || count(*) end from public.cambio_direcciones(array[current_setting('t1102.uno')::uuid]);
do $$ begin
  perform public.cambio_direccion_poner(current_setting('t1102.uno')::uuid, '{"nombre":"Cris","calle":"C/ x 9","cp":"08001","ciudad":"Barcelona"}');
  raise notice '1102 FALLA un tercero pone dirección';
exception when others then raise notice '1102 ok   un tercero no pone dirección (%)', sqlerrm; end $$;

-- 2. Una venta de Ana a Cris en mano: no hay dirección que poner.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000c1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1}]'::jsonb, 5, 'para', 'bizum', null);
  perform set_config('t1102.dos', v::text, false);
  perform public.cambio_envio_poner(v, 'mano');
end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  perform public.cambio_direccion_poner(current_setting('t1102.dos')::uuid, '{"nombre":"Cris","calle":"C/ x 9","cp":"08001","ciudad":"Barcelona"}');
  raise notice '1102 FALLA en mano se pone dirección';
exception when others then raise notice '1102 ok   en mano no hay dirección (%)', sqlerrm; end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.cambio_envio_poner(current_setting('t1102.dos')::uuid, 'correo');
  perform public.cambio_direccion_poner(current_setting('t1102.dos')::uuid, '{"nombre":"Ana Ruiz","calle":"C/ Sol 1","cp":"28001","ciudad":"Madrid"}');
  raise notice '1102 FALLA quien solo vende pone dirección';
exception when others then raise notice '1102 ok   quien solo vende no la pone (%)', sqlerrm; end $$;

-- 3. Tu dirección guardada: solo la tuya.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
insert into public.user_direcciones (nombre, calle, cp, ciudad) values ('Ana Ruiz', 'C/ Sol 1', '28001', 'Madrid');
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when count(*) = 0 then '1102 ok   la guardada de Ana no la ve Beto' else '1102 FALLA Beto ve ' || count(*) end from public.user_direcciones;
do $$ begin
  insert into public.user_direcciones (user_id, nombre, calle, cp, ciudad) values ('00000000-0000-0000-0000-0000000000a1', 'Falsa', 'C/ x 1', '00001', 'Nada');
  raise notice '1102 FALLA Beto escribe la de Ana';
exception when others then raise notice '1102 ok   nadie escribe la de otro (%)', sqlerrm; end $$;
do $$ begin
  perform 1 from public.trade_offer_direcciones;
  raise notice '1102 FALLA la tabla de los tratos se lee a pelo';
exception when others then raise notice '1102 ok   la tabla de los tratos no se lee a pelo (%)', sqlerrm; end $$;
reset role;
select case when count(*) = 1 and bool_and(adjuntos->0->>'evento' = 'cambio_direccion') then '1102 ok   cambiarla ya aceptado avisa con «cambio_direccion»' else '1102 FALLA avisos: ' || count(*) end
  from public.private_messages where body = 'Ya tienes mi dirección para el envío.';
select case when calle = 'C/ Luna 2' then '1102 ok   la nueva sustituye a la de antes' else '1102 FALLA calle ' || calle end
  from public.trade_offer_direcciones where quien = '00000000-0000-0000-0000-0000000000a1';
