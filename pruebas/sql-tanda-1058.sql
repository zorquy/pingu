-- Tanda 1058: las listas que no cuentan para los cruces, contra PostgreSQL.
-- Se monta sobre la base de la 1047 (sus casos dejan a Ana buscando la
-- Chikorita NORMAL, que Beto da) y le pone la 1057 y la 1058 (dos veces).
\i /tmp/wt-pruebas/pruebas/sql-tanda-1047.sql
\set ON_ERROR_STOP on
\i /home/user/pingu/supabase-migration-1057-listas-deseo.sql
\i /home/user/pingu/supabase-migration-1058-listas-cruces.sql
\i /home/user/pingu/supabase-migration-1058-listas-cruces.sql
\set ON_ERROR_STOP off
grant select on public.user_wants to anon, authenticated;
grant usage on schema public to anon, authenticated;

-- 0. De partida, Ana se cruza con Beto por la Chikorita normal.
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
select case when count(*) >= 1 then 'ok 1058 sin listas, el deseo cuenta (Ana ve a Beto)' else 'MAL 1058 sin listas no cuenta' end
  from public.intercambios_quien_tiene(50) where card_id = 'mcd21-2' and username = 'beto';

-- 1. Ana la mete en «A vigilar», que no cuenta.
insert into public.user_want_lists (id, nombre, cruces) values ('00000000-0000-0000-0000-00000000aaa1', 'A vigilar', false);
insert into public.user_want_list_items (list_id, card_id) values ('00000000-0000-0000-0000-00000000aaa1', 'mcd21-2');
select case when count(*) = 0 then 'ok 1058 en una lista que no cuenta, Ana ya no ve a Beto' else 'MAL 1058 quien_tiene sigue: ' || count(*) end
  from public.intercambios_quien_tiene(50) where card_id = 'mcd21-2';
select case when count(*) = 0 then 'ok 1058 y el Mercado de lo que busco no la cuenta' else 'MAL 1058 mercado: ' || count(*) end
  from public.intercambios_mercado('WEST', null, null, null, true) where card_id = 'mcd21-2';
select case when count(*) = 1 then 'ok 1058 Ana sigue viendo su deseo' else 'MAL 1058 Ana no ve su deseo: ' || count(*) end
  from public.user_wants where user_id = '00000000-0000-0000-0000-0000000000a1' and card_id = 'mcd21-2';
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when count(*) = 0 then 'ok 1058 a Beto no le sale Ana buscándola' else 'MAL 1058 quien_busca de Beto: ' || count(*) end
  from public.intercambios_quien_busca(50) where username = 'ana';
select case when count(*) = 0 then 'ok 1058 y Beto no ve el deseo en la tabla (perfil, evento)' else 'MAL 1058 Beto lo ve: ' || count(*) end
  from public.user_wants where user_id = '00000000-0000-0000-0000-0000000000a1' and card_id = 'mcd21-2';
reset role;
set role anon;
select case when count(*) = 0 then 'ok 1058 sin cuenta tampoco' else 'MAL 1058 anon lo ve' end
  from public.user_wants where user_id = '00000000-0000-0000-0000-0000000000a1' and card_id = 'mcd21-2';
select case when count(*) = 1 then 'ok 1058 lo de otros sí se ve sin cuenta (Cris, Cyndaquil)' else 'MAL 1058 anon no ve nada: ' || count(*) end
  from public.user_wants where user_id = '00000000-0000-0000-0000-0000000000c1';
select case when string_agg(card_id || ':' || nombre || ':' || user_id, ',') = 'mcd21-2:A vigilar:00000000-0000-0000-0000-0000000000a1' then 'ok 1058 evento_lista da la lista con su enlace, sin cuenta'
  else 'MAL 1058 evento_lista: ' || coalesce(string_agg(card_id, ','), 'nada') end
  from public.evento_lista('00000000-0000-0000-0000-00000000aaa1');
reset role;

-- 2. Que Beto ponga otra normal no avisa a Ana.
delete from public.user_notifications;
insert into public.user_collection (user_id, card_id, idioma, variante, cantidad, cambio) values
  ('00000000-0000-0000-0000-0000000000b1', 'mcd21-2', 'fr', 'normal', 1, 1);
select case when count(*) = 0 then 'ok 1058 una lista que no cuenta no avisa' else 'MAL 1058 avisa: ' || count(*) end
  from public.user_notifications where recipient_id = '00000000-0000-0000-0000-0000000000a1';

-- 3. Si además está en una que sí cuenta, cuenta.
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
insert into public.user_want_lists (id, nombre) values ('00000000-0000-0000-0000-00000000aaa2', 'Master set');
insert into public.user_want_list_items (list_id, card_id) values ('00000000-0000-0000-0000-00000000aaa2', 'mcd21-2');
select case when count(*) >= 1 then 'ok 1058 en una que cuenta y otra que no, cuenta' else 'MAL 1058 no cuenta' end
  from public.intercambios_quien_tiene(50) where card_id = 'mcd21-2';
-- 4. Una carta no entra en la lista de otro.
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
do $$ begin
  insert into public.user_want_list_items (list_id, card_id) values ('00000000-0000-0000-0000-00000000aaa1', 'mcd21-3');
  raise notice 'MAL 1058 Beto mete una carta en la lista de Ana';
exception when others then raise notice 'ok 1058 Beto no puede meter cartas en la lista de Ana'; end $$;
reset role;
