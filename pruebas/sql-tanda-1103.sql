-- Tanda 1103: «Ya lo he enviado» y el borrado de direcciones, contra PostgreSQL.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-1103.sql
--
-- Cada caso imprime «1103 ok …» o «1103 FALLA …». Las tablas imitan las de
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
\i /home/user/pingu/supabase-migration-1103-cambio-enviado.sql
\i /home/user/pingu/supabase-migration-1103-cambio-enviado.sql

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.user_profiles (id, username) values ('00000000-0000-0000-0000-0000000000a1','ana'), ('00000000-0000-0000-0000-0000000000b1','beto'), ('00000000-0000-0000-0000-0000000000c1','cris');
insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','obf-223','es','NM',2,2);

insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-0000000000b1','sv2-269','es','NM',1,1);

set role jugador;
-- Ana le propone a Beto un cambio por certificado; Beto acepta con su dirección.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000b1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1},{"de":"otro","linea":"00000000-0000-0000-0000-00000000bb01","cantidad":1}]'::jsonb, 0, null, null, null);
  perform set_config('t1103.uno', v::text, false);
  perform public.cambio_envio_poner(v, 'correo');
end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  perform public.cambio_direccion_poner(current_setting('t1103.uno')::uuid, '{"nombre":"Beto Gil","calle":"Av. Mar 3","cp":"41001","ciudad":"Sevilla"}');
  perform public.cambio_aceptar(current_setting('t1103.uno')::uuid, 'certificado');
end $$;
-- Beto todavía no tiene la de Ana: no puede decir que lo ha enviado.
do $$ begin
  perform public.cambio_enviado(current_setting('t1103.uno')::uuid, 'X');
  raise notice '1103 FALLA enviado sin su dirección';
exception when others then raise notice '1103 ok   sin su dirección no se manda (%)', sqlerrm; end $$;
-- Ana sí tiene la de Beto.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select case when e.enviado_de_at is not null and e.seguimiento_de = 'PK123456789ES' then '1103 ok   Ana lo da por enviado, con el número limpio' else '1103 FALLA ' || coalesce(e.seguimiento_de, '-') end
  from public.cambio_enviado(current_setting('t1103.uno')::uuid, '  PK123456789ES ') e;
select case when e.seguimiento_de = 'PK999' then '1103 ok   el número se puede corregir' else '1103 FALLA corregir' end
  from public.cambio_enviado(current_setting('t1103.uno')::uuid, 'PK999') e;
do $$ begin
  perform public.cambio_enviado(current_setting('t1103.uno')::uuid, repeat('9', 61));
  raise notice '1103 FALLA un número de 61';
exception when others then raise notice '1103 ok   un número demasiado largo no entra (%)', sqlerrm; end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
do $$ begin
  perform public.cambio_enviado(current_setting('t1103.uno')::uuid, null);
  raise notice '1103 FALLA un tercero lo marca';
exception when others then raise notice '1103 ok   un tercero no lo marca (%)', sqlerrm; end $$;
reset role;
select case when count(*) = 2 and bool_and(adjuntos->0->>'evento' = 'cambio_enviado') and bool_or(body = 'Te lo he mandado por certificado. Seguimiento: PK123456789ES.') then '1103 ok   cada «enviado» avisa con su tarjeta' else '1103 FALLA mensajes ' || count(*) end
  from public.private_messages where body like 'Te lo he mandado%';

-- El borrado: un trato hecho hace 31 días pierde sus direcciones; uno de hace 5, no.
update public.trade_offers set estado = 'hecha', hecha_at = now() - interval '31 days' where id = current_setting('t1103.uno')::uuid;
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select case when count(*) = 0 then '1103 ok   de un trato cerrado hace 31 días ya no se enseñan' else '1103 FALLA se ven ' || count(*) end from public.cambio_direcciones(array[current_setting('t1103.uno')::uuid]);
reset role;
select case when count(*) = 1 then '1103 ok   …aunque sigue ahí hasta que pase otro trato' else '1103 FALLA quedan ' || count(*) end from public.trade_offer_direcciones;
-- Otro trato (Ana le vende a Cris en mano) pasa por cambio_avisar: se purga.
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select public.cambio_proponer('00000000-0000-0000-0000-0000000000c1', '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1}]'::jsonb, 5, 'para', 'bizum', null) is not null as x \gset
reset role;
select case when count(*) = 0 then '1103 ok   el siguiente aviso de cualquier trato las borra' else '1103 FALLA quedan ' || count(*) end from public.trade_offer_direcciones;
select case when not has_function_privilege('authenticated', 'public.cambio_direcciones_purgar()', 'execute') then '1103 ok   nadie llama al borrado a pelo' else '1103 FALLA el borrado se puede llamar' end;
