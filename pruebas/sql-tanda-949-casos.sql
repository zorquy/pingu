-- Casos de supabase-migration-949-versiones-en-lote.sql, sobre la base de
-- pruebas de la 948 (los sets japoneses, sin ejecutar la 948): el admin pone
-- y quita versiones a muchas cartas, y nadie más puede.
\set ON_ERROR_STOP on
create table public.resultado (n serial, caso text, ok boolean);
grant all on public.resultado, public.resultado_n_seq to authenticated, service_role;
grant all on all tables in schema public to authenticated, service_role;
grant all on all sequences in schema public to authenticated, service_role;
set role authenticated;

set prueba.uid = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  begin perform public.catalogo_versiones_lote('JP', array['tcggo-50003'], array['1st Edition']);
    insert into resultado (caso, ok) values ('alguien que no es admin no pone versiones', false);
  exception when insufficient_privilege then insert into resultado (caso, ok) values ('alguien que no es admin no pone versiones', true); end;
end $$;

set prueba.uid = '00000000-0000-0000-0000-00000000000a';
do $$
declare r jsonb;
begin
  -- Cuatro etiquetas con una repetida en otra caja: son tres.
  r := public.catalogo_versiones_lote('JP', array['tcggo-50003', 'tcggo-50004', 'tcggo-50003'], array['1st Edition', 'Unlimited', ' 1st Edition Reverse Holo ', 'unlimited'], false, true);
  insert into resultado (caso, ok) values ('el admin pone tres versiones a dos cartas (una etiqueta repetida en otra caja cuenta una vez)', (r->>'cartas')::int = 2 and (r->>'nuevas')::int = 6 and (r->>'ya')::int = 0);
  insert into resultado (caso, ok) values ('  …y con «mover», las dos copias «normal» pasan a Unlimited', (r->>'copias')::int = 2);
  r := public.catalogo_versiones_lote('JP', array['tcggo-50003', 'tcggo-50004'], array['1st Edition', 'Unlimited'], false, true);
  insert into resultado (caso, ok) values ('otra vez lo mismo no crea nada', (r->>'nuevas')::int = 0 and (r->>'ya')::int = 4 and (r->>'copias')::int = 0);
end $$;

insert into resultado (caso, ok) select 'son filas de edición, impresiones, colgadas de la carta, sin espacios en la etiqueta',
  count(*) = 6 and bool_and(origen = 'edicion' and clase = 'impresion' and market = 'JP' and set_id = 'tg-900' and tcggo_id < 0 and etiqueta = trim(etiqueta))
  from tcg_card_versions where card_id in ('tcggo-50003', 'tcggo-50004') and origen = 'edicion';
insert into resultado (caso, ok) select 'la Unlimited lleva el producto de la carta; la 1.ª edición no',
  (select cm_id_product from tcg_card_versions where card_id = 'tcggo-50003' and etiqueta = 'Unlimited') = 700003
  and (select cm_id_product from tcg_card_versions where card_id = 'tcggo-50003' and etiqueta = '1st Edition') is null;
insert into resultado (caso, ok) select 'en el orden dado: la 1.ª edición tiene un id mayor que la Unlimited (la web las ordena así)',
  (select tcggo_id from tcg_card_versions where card_id = 'tcggo-50003' and etiqueta = '1st Edition') > (select tcggo_id from tcg_card_versions where card_id = 'tcggo-50003' and etiqueta = 'Unlimited');
insert into resultado (caso, ok) select 'las copias: la 1.ª edición se queda; la normal, a Unlimited',
  (select string_agg(variante, ',' order by variante) from user_collection where card_id = 'tcggo-50003') = 'primera,unlimited';
insert into resultado (caso, ok) select '  …y la de otra carta no se toca',
  (select variante from user_collection where card_id = 'tcggo-60001') = 'normal';

do $$
declare r jsonb;
begin
  r := public.catalogo_versiones_lote('JP', array['tcggo-50003', 'tcggo-50004'], array['1st edition reverse holo'], true);
  insert into resultado (caso, ok) values ('quitar borra esa versión de las dos (sin distinguir caja)', (r->>'quitadas')::int = 2);
  r := public.catalogo_versiones_lote('JP', array['tcggo-50003'], array['Standard'], true);
  insert into resultado (caso, ok) values ('  …y no toca lo que no es de edición (la «Standard» de TCGGO)', (r->>'quitadas')::int = 0);
  begin perform public.catalogo_versiones_lote('JP', array['tcggo-50003'], array['  ', '']);
    insert into resultado (caso, ok) values ('sin ninguna versión, error', false);
  exception when invalid_parameter_value then insert into resultado (caso, ok) values ('sin ninguna versión, error', true); end;
  begin perform public.catalogo_versiones_lote('WEST', array['tcggo-50003'], array['1st Edition']);
    insert into resultado (caso, ok) values ('una carta de otro catálogo no existe para este', false);
  exception when no_data_found then insert into resultado (caso, ok) values ('una carta de otro catálogo no existe para este', true); end;
  begin perform public.catalogo_versiones_lote('JP', array['tcggo-50003'], array[repeat('x', 61)]);
    insert into resultado (caso, ok) values ('una etiqueta de más de 60 letras, error', false);
  exception when invalid_parameter_value then insert into resultado (caso, ok) values ('una etiqueta de más de 60 letras, error', true); end;
end $$;
insert into resultado (caso, ok) select 'la «Standard» sigue ahí',
  exists (select 1 from tcg_card_versions where card_id = 'tcggo-50003' and etiqueta = 'Standard');

reset role;
select case when ok then 'ok ' else 'MAL ' end || caso from resultado order by n;
