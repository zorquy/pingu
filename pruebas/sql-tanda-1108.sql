-- Tanda 1108: el envío automático, contra PostgreSQL.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-1108.sql
--
-- Cada caso imprime «1108 ok …» o «1108 FALLA …». Las tablas imitan las de
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
\i /home/user/pingu/supabase-migration-1108-cambio-envio-automatico.sql
\i /home/user/pingu/supabase-migration-1108-cambio-envio-automatico.sql

insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.user_profiles (id, username) values ('00000000-0000-0000-0000-0000000000a1','ana'), ('00000000-0000-0000-0000-0000000000b1','beto'), ('00000000-0000-0000-0000-0000000000c1','cris');
insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','obf-223','es','NM',2,2);

insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-0000000000b1','sv2-269','es','NM',1,1);

-- 1. La tarifa, con la misma tabla que la web.
select case when string_agg(t.tipo || ':' || t.precio::numeric(10,2), ',' order by x.n) = 'normal:1.45,normal:2.25,normal:4.20,certificado:7.06,certificado:11.61,certificado:26.65,certificado:60.10,certificado:125.95,certificado:150.00'
  then '1108 ok   la tarifa: ordinaria hasta 25 € por peso, certificado por valor y peso'
  else '1108 FALLA ' || string_agg(t.tipo || ':' || t.precio, ',' order by x.n) end
from (values (1, 25::numeric, 1), (2, 10, 30), (3, 10, 120), (4, 25.01, 1), (5, 10, 300), (6, 180, 1), (7, 450, 1), (8, 900, 1), (9, 5000, 1)) as x(n, v, c),
  lateral public.cambio_envio_tarifa(x.v, x.c) t;

insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa02','00000000-0000-0000-0000-0000000000a1','sv2-269','es','NM',1,1);

set role jugador;
-- 2. Ana le vende a Beto por 20 € por correo: ordinario a 1,45 €.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000b1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1,"precio":20}]'::jsonb, 20, 'para', 'mano', null);
  perform set_config('t1108.uno', v::text, false);
  perform public.cambio_envio_poner(v, 'correo');
end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when e.envio_tipo = 'normal' and e.envio_precio = 1.45 then '1108 ok   20 € por correo: ordinario a 1,45 € (aunque pidiera «certificado»)' else '1108 FALLA ' || coalesce(e.envio_tipo, '-') || ' ' || coalesce(e.envio_precio::text, '-') end
  from public.cambio_aceptar(current_setting('t1108.uno')::uuid, 'certificado') e;

-- 3. Un cambio: certificado si alguno lo es, a 0.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000b1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1,"precio":40},{"de":"otro","linea":"00000000-0000-0000-0000-00000000bb01","cantidad":1,"precio":5}]'::jsonb, 0, null, null, null);
  perform set_config('t1108.dos', v::text, false);
  perform public.cambio_envio_poner(v, 'correo');
end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when e.envio_tipo = 'certificado' and e.envio_precio = 0 then '1108 ok   un cambio con una carta de 40 €: certificado, cada uno el suyo' else '1108 FALLA ' || coalesce(e.envio_tipo, '-') || ' ' || coalesce(e.envio_precio::text, '-') end
  from public.cambio_aceptar(current_setting('t1108.dos')::uuid, null) e;

-- 4. «En mano» al aceptar sigue valiendo.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000c1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa02","cantidad":1,"precio":30}]'::jsonb, 30, 'para', 'bizum', null);
  perform set_config('t1108.tres', v::text, false);
  perform public.cambio_envio_poner(v, 'correo');
end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
select case when e.envio_tipo = 'mano' and e.envio_precio = 0 then '1108 ok   al aceptar, «en mano» deja el envío a 0' else '1108 FALLA ' || coalesce(e.envio_tipo, '-') end
  from public.cambio_aceptar(current_setting('t1108.tres')::uuid, 'mano') e;
