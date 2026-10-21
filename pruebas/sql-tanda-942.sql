-- Tanda 942: las propuestas de cambio, contra PostgreSQL.
--
--   psql -h /var/tmp -p 5433 -U postgres -f sql-tanda-942.sql
--
-- Cada caso imprime «942 ok …» o «942 FALLA …». Las tablas imitan las de
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

-- A (a1) da Charizard (2 copias, 1 para cambio) y busca Iono. B (b1) da Iono
-- (1 copia) y tiene un Pikachu sin darlo. C (c1) es otra persona.
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1');
insert into public.user_profiles (id, username) values ('00000000-0000-0000-0000-0000000000a1','ana'), ('00000000-0000-0000-0000-0000000000b1','beto'), ('00000000-0000-0000-0000-0000000000c1','cris');
insert into public.user_collection (id, user_id, card_id, idioma, estado, cantidad, cambio) values
  ('00000000-0000-0000-0000-00000000aa01','00000000-0000-0000-0000-0000000000a1','obf-223','es','NM',2,1),
  ('00000000-0000-0000-0000-00000000bb01','00000000-0000-0000-0000-0000000000b1','pal-185','es','NM',1,1),
  ('00000000-0000-0000-0000-00000000bb02','00000000-0000-0000-0000-0000000000b1','sv8-25','en','LP',1,0);
insert into public.user_wants (id, user_id, card_id, idioma) values ('00000000-0000-0000-0000-00000000ee01','00000000-0000-0000-0000-0000000000a1','pal-185', null);

set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');

-- 1. Proponer.
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000b1',
    '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":1,"precio":70},
      {"de":"otro","linea":"00000000-0000-0000-0000-00000000bb01","precio":3},
      {"de":"otro","card_id":"sv8-25","idioma":"es","precio":3}]'::jsonb, 64, 'para', 'bizum', 'Te la mando el lunes');
  perform set_config('t942.uno', v::text, false);
end $$;
select case when count(*) = 1 then '942 ok   propuesta enviada' else '942 FALLA propuesta: ' || count(*) end
  from public.trade_offers where id = current_setting('t942.uno')::uuid and estado = 'enviada' and dinero = 64 and dinero_paga = 'para' and dinero_como = 'bizum';
select case when count(*) = 3 and count(*) filter (where pedida) = 1 then '942 ok   tres cartas, una pedida' else '942 FALLA cartas: ' || count(*) end
  from public.trade_offer_items where oferta = current_setting('t942.uno')::uuid;

-- 2. Lo que no se puede proponer.
do $$ begin
  perform public.cambio_proponer('00000000-0000-0000-0000-0000000000b1', '[{"de":"yo","card_id":"x-1"}]'::jsonb);
  raise notice '942 FALLA dar una carta que no está en tu colección';
exception when others then raise notice '942 ok   dar algo que no tienes no se puede (%)', sqlerrm; end $$;
do $$ begin
  perform public.cambio_proponer('00000000-0000-0000-0000-0000000000b1', '[{"de":"otro","linea":"00000000-0000-0000-0000-00000000bb02"}]'::jsonb);
  raise notice '942 FALLA pedir de una línea que no da';
exception when others then raise notice '942 ok   su línea que no da no se pide por línea (%)', sqlerrm; end $$;
do $$ begin
  perform public.cambio_proponer('00000000-0000-0000-0000-0000000000b1', '[{"de":"otro","card_id":"pal-185"}]'::jsonb, 5, null);
  raise notice '942 FALLA dinero sin quién paga';
exception when others then raise notice '942 ok   dinero sin quién paga, no (%)', sqlerrm; end $$;

-- 3. Lo ve cada uno el suyo; la conversación y el aviso existen.
reset role;
select case when count(*) = 1 then '942 ok   el mensaje está en su conversación' else '942 FALLA mensajes: ' || count(*) end
  from public.private_messages m join public.trade_offers o on o.conversacion = m.conversation_id
  where o.id = current_setting('t942.uno')::uuid and m.body like 'Te he mandado una propuesta de cambio: doy 1 carta y recibo 2 cartas y me pagas 64,00 €%';
select case when count(*) = 1 then '942 ok   aviso a quien la recibe' else '942 FALLA avisos: ' || count(*) end
  from public.user_notifications where recipient_id = '00000000-0000-0000-0000-0000000000b1' and type = 'cambio_propuesta' and link like '/mensajes.html?c=%';
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
select case when count(*) = 0 then '942 ok   otra persona no la ve' else '942 FALLA la ve otra persona' end from public.trade_offers;
select case when count(*) = 0 then '942 ok   ni sus cartas' else '942 FALLA ve las cartas' end from public.trade_offer_items;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when count(*) = 1 then '942 ok   quien la recibe la ve' else '942 FALLA no la ve' end from public.trade_offers;

-- 4. Aceptar: solo quien la recibe; la pedida se casa con su Pikachu.
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ begin
  perform public.cambio_contestar(current_setting('t942.uno')::uuid, 'aceptar');
  raise notice '942 FALLA la acepta quien la manda';
exception when others then raise notice '942 ok   quien la manda no la acepta'; end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select (public.cambio_contestar(current_setting('t942.uno')::uuid, 'aceptar')).estado as e \gset
select case when :'e' = 'aceptada' then '942 ok   aceptada' else '942 FALLA aceptar: ' || :'e' end;
select case when linea = '00000000-0000-0000-0000-00000000bb02' and idioma = 'en' and estado = 'LP' then '942 ok   la pedida es su Pikachu (en, LP)' else '942 FALLA pedida: ' || coalesce(linea::text, 'sin línea') end
  from public.trade_offer_items where oferta = current_setting('t942.uno')::uuid and pedida;

-- 5. Reservadas: lo aceptado no se puede volver a prometer.
select case when cantidad = 1 then '942 ok   el Charizard sale reservado' else '942 FALLA reservadas' end
  from public.cambios_reservadas(array['obf-223']) where user_id = '00000000-0000-0000-0000-0000000000a1';
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select case when libres = 0 then '942 ok   lo que da Beto ya no tiene copias libres de Iono' else '942 FALLA libres ' || libres end
  from public.cambio_lo_que_da('00000000-0000-0000-0000-0000000000b1') where card_id = 'pal-185';
do $$ begin
  perform public.cambio_proponer('00000000-0000-0000-0000-0000000000c1', '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000aa01","cantidad":2}]'::jsonb);
  raise notice '942 FALLA prometer dos veces la misma copia';
exception when others then raise notice '942 ok   la copia reservada no se promete dos veces (%)', sqlerrm; end $$;

-- 6. «Lo tengo» de los dos: se mueven las cartas.
select (public.cambio_lo_tengo(current_setting('t942.uno')::uuid)).estado as e \gset
select case when :'e' = 'aceptada' then '942 ok   con uno solo, sigue aceptada' else '942 FALLA ' || :'e' end;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select (public.cambio_lo_tengo(current_setting('t942.uno')::uuid)).estado as e \gset
select case when :'e' = 'hecha' then '942 ok   con los dos, hecha' else '942 FALLA ' || :'e' end;
reset role;
select case when cantidad = 1 and cambio = 0 then '942 ok   a Ana le queda 1 Charizard y ya no lo da' else '942 FALLA Charizard de Ana: ' || cantidad || '/' || cambio end
  from public.user_collection where id = '00000000-0000-0000-0000-00000000aa01';
select case when count(*) = 1 then '942 ok   Beto tiene el Charizard (es, NM)' else '942 FALLA Charizard de Beto' end
  from public.user_collection where user_id = '00000000-0000-0000-0000-0000000000b1' and card_id = 'obf-223' and idioma = 'es' and estado = 'NM' and cantidad = 1;
select case when count(*) = 0 then '942 ok   la línea de Iono de Beto ya no existe' else '942 FALLA Iono de Beto sigue' end
  from public.user_collection where id = '00000000-0000-0000-0000-00000000bb01';
select case when count(*) = 2 then '942 ok   Ana tiene Iono y el Pikachu inglés' else '942 FALLA cartas de Ana: ' || count(*) end
  from public.user_collection where user_id = '00000000-0000-0000-0000-0000000000a1' and ((card_id = 'pal-185' and idioma = 'es') or (card_id = 'sv8-25' and idioma = 'en' and estado = 'LP'));
select case when count(*) = 0 then '942 ok   Iono, tachada de La quiero de Ana' else '942 FALLA el deseo sigue' end
  from public.user_wants where id = '00000000-0000-0000-0000-00000000ee01';
select case when count(*) = 1 then '942 ok   cuenta para la confianza' else '942 FALLA confianza: ' || count(*) end
  from public.trade_confirmations where hecho_a_at is not null and hecho_b_at is not null;

-- 7. Deshacer: todo vuelve, y el cambio sigue aceptado.
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select (public.cambio_deshacer(current_setting('t942.uno')::uuid)).estado as e \gset
select case when :'e' = 'aceptada' then '942 ok   deshecho: vuelve a aceptada' else '942 FALLA ' || :'e' end;
reset role;
select case when cantidad = 2 and cambio = 1 then '942 ok   Ana vuelve a tener 2 Charizard y da 1' else '942 FALLA Charizard de Ana: ' || cantidad || '/' || cambio end
  from public.user_collection where id = '00000000-0000-0000-0000-00000000aa01';
select case when count(*) = 1 then '942 ok   la línea de Iono de Beto vuelve, con su id' else '942 FALLA no vuelve' end
  from public.user_collection where id = '00000000-0000-0000-0000-00000000bb01' and cantidad = 1 and cambio = 1;
select case when count(*) = 0 then '942 ok   las que le entraron a cada uno, fuera' else '942 FALLA quedan: ' || count(*) end
  from public.user_collection where (user_id = '00000000-0000-0000-0000-0000000000b1' and card_id = 'obf-223') or (user_id = '00000000-0000-0000-0000-0000000000a1' and card_id in ('pal-185', 'sv8-25'));
select case when count(*) = 1 then '942 ok   el Pikachu de Beto (tenía 1 y se borró) vuelve con su id' else '942 FALLA Pikachu' end
  from public.user_collection where id = '00000000-0000-0000-0000-00000000bb02';
select case when count(*) = 1 then '942 ok   el deseo vuelve' else '942 FALLA deseo' end from public.user_wants where id = '00000000-0000-0000-0000-00000000ee01';
select case when count(*) = 0 then '942 ok   y la confianza, fuera' else '942 FALLA confianza sigue' end from public.trade_confirmations;

-- 8. Contraoferta: la vieja queda «cambiada» y la nueva es la versión 2.
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000c1', '[{"de":"otro","card_id":"pal-185"}]'::jsonb);
  perform set_config('t942.dos', v::text, false);
end $$;
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000a1', '[{"de":"yo","card_id":"zz-1"}]'::jsonb, 0, null, null, null, current_setting('t942.dos')::uuid);
  raise notice '942 FALLA dar algo que no tiene';
exception when others then raise notice '942 ok   la contraoferta también valida lo que da'; end $$;
reset role;
insert into public.user_collection (id, user_id, card_id, cantidad, cambio) values ('00000000-0000-0000-0000-00000000cc01', '00000000-0000-0000-0000-0000000000c1', 'mew-151', 1, 1);
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000c1');
do $$ declare v uuid; begin
  v := public.cambio_proponer('00000000-0000-0000-0000-0000000000a1', '[{"de":"yo","linea":"00000000-0000-0000-0000-00000000cc01"}]'::jsonb, 10, 'de', 'mano', null, current_setting('t942.dos')::uuid);
  perform set_config('t942.tres', v::text, false);
end $$;
reset role;
select case when (select estado from public.trade_offers where id = current_setting('t942.dos')::uuid) = 'cambiada'
             and (select version from public.trade_offers where id = current_setting('t942.tres')::uuid) = 2
            then '942 ok   contraoferta: la vieja cambiada, la nueva versión 2' else '942 FALLA contraoferta' end;

-- 9. Rechazar y anular.
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select (public.cambio_contestar(current_setting('t942.tres')::uuid, 'rechazar')).estado as e \gset
select case when :'e' = 'rechazada' then '942 ok   rechazada' else '942 FALLA ' || :'e' end;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select (public.cambio_contestar(current_setting('t942.uno')::uuid, 'anular')).estado as e \gset
select case when :'e' = 'anulada' then '942 ok   un cambio aceptado se puede anular' else '942 FALLA ' || :'e' end;

-- 10. Las de dentro no se llaman desde fuera.
do $$ begin
  perform public.cambio_mover(current_setting('t942.uno')::uuid);
  raise notice '942 FALLA cambio_mover se puede llamar';
exception when insufficient_privilege then raise notice '942 ok   cambio_mover no se puede llamar desde fuera'; end $$;
reset role;
