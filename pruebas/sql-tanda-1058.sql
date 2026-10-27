-- Tanda 1058: evento_lista (la lista del QR del Modo evento), contra
-- PostgreSQL. Sobre la base de la 1047 (Ana busca la Chikorita normal), con
-- la 1057 y la 1058 (dos veces).
\i /tmp/wt-pruebas/pruebas/sql-tanda-1047.sql
\set ON_ERROR_STOP on
\i /home/user/pingu/supabase-migration-1057-listas-deseo.sql
\i /home/user/pingu/supabase-migration-1058-evento-lista.sql
\i /home/user/pingu/supabase-migration-1058-evento-lista.sql
\set ON_ERROR_STOP off
grant usage on schema public to anon, authenticated;
-- Como en la base: los deseos se leen sin cuenta (la política user_wants_ver).
grant select on public.user_wants to anon, authenticated;

-- Ana hace «Feria» con la Chikorita (que quiere) y el Cyndaquil (que ya no).
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000a1');
insert into public.user_want_lists (id, nombre) values ('00000000-0000-0000-0000-00000000aaa1', 'Feria');
insert into public.user_want_list_items (list_id, card_id) values
  ('00000000-0000-0000-0000-00000000aaa1', 'mcd21-2'), ('00000000-0000-0000-0000-00000000aaa1', 'mcd21-3');
reset role;

set role anon;
select case when string_agg(card_id || ':' || nombre || ':' || user_id, ',') = 'mcd21-2:Feria:00000000-0000-0000-0000-0000000000a1'
  then 'ok 1058 sin cuenta, la lista con su nombre y su dueña, y solo lo que sigue queriendo'
  else 'MAL 1058 evento_lista: ' || coalesce(string_agg(card_id, ','), 'nada') end
  from public.evento_lista('00000000-0000-0000-0000-00000000aaa1');
select case when count(*) = 0 then 'ok 1058 una lista que no existe, nada' else 'MAL 1058 lista inventada' end
  from public.evento_lista('00000000-0000-0000-0000-0000000000ff');
reset role;

-- Las filas de la lista siguen siendo solo de Ana.
set role jugador;
select public.ponerse('00000000-0000-0000-0000-0000000000b1');
select case when count(*) = 0 then 'ok 1058 Beto no lee las filas de la lista de Ana' else 'MAL 1058 Beto las lee' end
  from public.user_want_list_items;
do $$ begin
  insert into public.user_want_list_items (list_id, card_id) values ('00000000-0000-0000-0000-00000000aaa1', 'mcd21-3');
  raise notice 'MAL 1058 Beto mete una carta en la lista de Ana';
exception when others then raise notice 'ok 1058 Beto no puede meter cartas en la lista de Ana'; end $$;
reset role;
