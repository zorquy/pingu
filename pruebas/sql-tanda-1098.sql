-- Tanda 1098: quién confirma qué en un cambio, contra PostgreSQL.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-1098.sql
--
-- Cada caso imprime «1098 ok …» o «1098 FALLA …». Las tablas imitan las de
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

-- Ana (a1) da un Charizard; Beto (b1) no da nada que ella busque; Cris (c1)
-- regala un Iono.
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.user_profiles (id, username) values ('00000000-0000-0000-0000-0000000000a1','ana'), ('00000000-0000-0000-0000-0000000000b1','beto'), ('00000000-0000-0000-0000-0000000000c1','cris');
insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','obf-223','es','NM',1,1),
  ('00000000-0000-0000-0000-00000000cc01','00000000-0000-0000-0000-0000000000c1','pal-185','es','NM',1,1);

set role jugador;

-- 1. Una venta: Ana da el Charizard y Beto le paga 20 € por Bizum.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000b1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1,"precio":25}]'::jsonb, 20, 'para', 'bizum', null);
  perform set_config('t1098.venta', v::text, false);
end $$;
reset role;
select case when public.cambio_recibe_algo(current_setting('t1098.venta')::uuid, '00000000-0000-0000-0000-0000000000a1')
  and public.cambio_recibe_algo(current_setting('t1098.venta')::uuid, '00000000-0000-0000-0000-0000000000b1')
  then '1098 ok   venta: los dos reciben algo (ella el dinero, él la carta)' else '1098 FALLA recibe_algo en la venta' end;
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select public.cambio_contestar(current_setting('t1098.venta')::uuid, 'aceptar') is not null as x \gset
select case when recibido_de_at is null and recibido_para_at is null and estado = 'aceptada' then '1098 ok   venta aceptada: nadie confirmado todavía' else '1098 FALLA venta aceptada ' || estado || coalesce(recibido_de_at::text, '-') || coalesce(recibido_para_at::text, '-') end
  from public.trade_offers where id = current_setting('t1098.venta')::uuid;
select (public.cambio_lo_tengo(current_setting('t1098.venta')::uuid)).estado as e \gset
select case when :'e' = 'aceptada' then '1098 ok   «Cartas recibidas» de Beto: espera el dinero de Ana' else '1098 FALLA tras Beto: ' || :'e' end;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select (public.cambio_lo_tengo(current_setting('t1098.venta')::uuid)).estado as e \gset
select case when :'e' = 'hecha' then '1098 ok   «Dinero recibido» de Ana: hecha' else '1098 FALLA tras Ana: ' || :'e' end;
reset role;
select case when count(*) = 1 then '1098 ok   el Charizard está en la colección de Beto' else '1098 FALLA Charizard: ' || count(*) end
  from public.user_collection where user_id = '00000000-0000-0000-0000-0000000000b1' and card_id = 'obf-223';
select case when count(*) = 1 then '1098 ok   el mensaje ya no dice «Lo tengo»' else '1098 FALLA mensaje aceptar' end
  from public.private_messages where body like 'He aceptado tu propuesta. Cuando te llegue lo mío, confírmalo%';
select case when count(*) = 0 then '1098 ok   ningún mensaje nuevo con «Lo tengo»' else '1098 FALLA quedan ' || count(*) end
  from public.private_messages where body like '%Lo tengo%';
set role jugador;

-- 2. Un regalo: Cris da el Iono a Ana y no recibe nada.
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000a1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000cc01","cantidad":1}]'::jsonb);
  perform set_config('t1098.regalo', v::text, false);
end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select public.cambio_contestar(current_setting('t1098.regalo')::uuid, 'aceptar') is not null as x \gset
select case when recibido_de_at is not null and recibido_para_at is null then '1098 ok   regalo aceptado: Cris, que no recibe nada, ya está confirmado' else '1098 FALLA regalo ' || coalesce(recibido_de_at::text, 'de sin') || ' / ' || coalesce(recibido_para_at::text, 'para sin') end
  from public.trade_offers where id = current_setting('t1098.regalo')::uuid;
select (public.cambio_lo_tengo(current_setting('t1098.regalo')::uuid)).estado as e \gset
select case when :'e' = 'hecha' then '1098 ok   con la «Carta recibida» de Ana basta: hecha' else '1098 FALLA regalo: ' || :'e' end;

-- 3. Deshacer el regalo: vuelve a aceptada y Cris sigue sin tener que confirmar.
select (public.cambio_deshacer(current_setting('t1098.regalo')::uuid)).estado as e \gset
select case when :'e' = 'aceptada' then '1098 ok   deshecho: aceptada otra vez' else '1098 FALLA deshacer: ' || :'e' end;
select case when recibido_de_at is not null and recibido_para_at is null then '1098 ok   …y Cris sigue confirmado, Ana no' else '1098 FALLA tras deshacer' end
  from public.trade_offers where id = current_setting('t1098.regalo')::uuid;

-- 4. Las de dentro no se llaman desde fuera.
do $$ begin
  perform public.cambio_sin_esperar(current_setting('t1098.regalo')::uuid);
  raise notice '1098 FALLA cambio_sin_esperar se deja llamar';
exception when others then raise notice '1098 ok   cambio_sin_esperar no se llama desde fuera'; end $$;
