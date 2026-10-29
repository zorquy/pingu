-- Tanda 1101: el mensaje de un cambio lleva su propuesta, contra PostgreSQL.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-1101.sql
--
-- Cada caso imprime «1101 ok …» o «1101 FALLA …». Las tablas imitan las de
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

\i /home/user/pingu/supabase-migration-cambios-hechos.sql
\i /home/user/pingu/supabase-migration-942-propuestas-cambio.sql
\i /home/user/pingu/supabase-migration-942-propuestas-cambio.sql
\i /home/user/pingu/supabase-migration-1098-cambio-recibido.sql
\i /home/user/pingu/supabase-migration-1098-cambio-recibido.sql
\i /home/user/pingu/supabase-migration-1099-cambio-envio.sql
\i /home/user/pingu/supabase-migration-1101-cambio-mensaje.sql
\i /home/user/pingu/supabase-migration-1101-cambio-mensaje.sql

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.user_profiles (id, username) values ('00000000-0000-0000-0000-0000000000a1','ana'), ('00000000-0000-0000-0000-0000000000b1','beto'), ('00000000-0000-0000-0000-0000000000c1','cris');
insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','obf-223','es','NM',2,2);

set role jugador;
-- Ana le propone a Beto, y Beto la acepta.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000b1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1,"precio":30}]'::jsonb, 30, 'para', 'bizum', null);
  perform set_config('t1101.uno', v::text, false);
end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select (public.cambio_aceptar(current_setting('t1101.uno')::uuid, null)).estado as e \gset
reset role;

select case when count(*) = 2 then '1101 ok   dos mensajes: la propuesta y la aceptada' else '1101 FALLA mensajes: ' || count(*) end from public.private_messages;
select case when count(*) = 2 then '1101 ok   los dos llevan su adjunto de propuesta con la oferta'
  else '1101 FALLA adjuntos: ' || coalesce(string_agg(adjuntos::text, ' | '), '-') end
  from public.private_messages
  where adjuntos @> jsonb_build_array(jsonb_build_object('tipo', 'propuesta', 'oferta', current_setting('t1101.uno')));
select case when string_agg(adjuntos->0->>'evento', ',' order by created_at, body) in ('cambio_propuesta,cambio_aceptado', 'cambio_aceptado,cambio_propuesta')
  then '1101 ok   …con su evento (propuesta y aceptada)' else '1101 FALLA eventos: ' || coalesce(string_agg(adjuntos->0->>'evento', ','), '-') end from public.private_messages;
select case when bool_and(body not like '%arriba de la conversación%') then '1101 ok   el texto ya no dice «La tienes arriba de la conversación»'
  else '1101 FALLA texto: ' || string_agg(body, ' | ') end from public.private_messages;
select case when bool_and(link = '/mi-coleccion?ver=cambios#oferta-' || current_setting('t1101.uno')) and count(*) = 2
  then '1101 ok   los avisos llevan al trato en Cruces' else '1101 FALLA enlaces: ' || coalesce(string_agg(link, ' | '), '-') end from public.user_notifications;
select case when not has_function_privilege('authenticated', 'public.cambio_avisar(uuid, uuid, uuid, text, text, text)', 'execute')
  then '1101 ok   nadie llama a cambio_avisar a pelo' else '1101 FALLA cambio_avisar se puede llamar' end;
