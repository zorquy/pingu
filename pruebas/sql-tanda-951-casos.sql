-- Casos de supabase-migration-951-ediciones-japonesas-hasta-2016.sql: se
-- carga después de la base de pruebas de la 948 (sin ejecutar la 948) y de
-- unos sets más; aquí se ejecuta la 948b, luego la 951 dos veces, y se mira.
\set ON_ERROR_STOP on
insert into public.tcg_sets (id, market, name, name_en, release_date, card_count_official, card_count_total, tcggo_id, oculto) values
  ('bw1_ja', 'JP', 'Black Collection', 'Black Collection', '2010-12-03', 53, 53, 951, false),
  ('xy11_ja', 'JP', 'Cruel Traitor', 'Cruel Traitor', '2016-09-30', 2, 2, 952, false),
  ('sm1_ja', 'JP', 'Collection Sun', 'Collection Sun', '2016-12-09', 2, 2, 953, false),
  ('neo1_ja', 'JP', 'Gold, Silver, to a New World...', 'Gold, Silver, to a New World...', '2000-07-07', 2, 2, 954, false),
  ('dpp_ja', 'JP', 'DP Promotional Cards', 'DP Promotional Cards', '2007-01-01', 2, 2, 955, false),
  ('oculto_ja', 'JP', 'Escondido', 'Escondido', '2008-01-01', 2, 2, 956, true),
  ('vacio_ja', 'JP', 'Sin cartas', 'Sin cartas', '2009-01-01', 0, 0, 957, false);
insert into public.tcg_cards (id, market, set_id, local_id, name, origen, cm_id_product_propio) values
  ('tcggo-b1', 'JP', 'bw1_ja', '001', 'ツタージャ', 'tcggo', 810001),
  ('tcggo-b2', 'JP', 'bw1_ja', '002', 'ジャノビー', 'tcggo', 810002),
  ('tcggo-x1', 'JP', 'xy11_ja', '001', 'X', 'tcggo', null),
  ('tcggo-s1', 'JP', 'sm1_ja', '001', 'S', 'tcggo', null),
  ('tcggo-n1', 'JP', 'neo1_ja', '001', 'N', 'tcggo', null),
  ('tcggo-p1', 'JP', 'dpp_ja', '001', 'P', 'tcggo', null),
  ('tcggo-o1', 'JP', 'oculto_ja', '001', 'O', 'tcggo', null);
insert into public.user_collection (card_id, user_id, cantidad, variante, market) values
  ('tcggo-b1', '00000000-0000-0000-0000-0000000000c1', 1, 'normal', 'JP'),
  ('tcggo-b1', '00000000-0000-0000-0000-0000000000c1', 1, 'reverse', 'JP'),
  ('tcggo-s1', '00000000-0000-0000-0000-0000000000c1', 1, 'normal', 'JP');
\i :migracion948b
\i :migracion951
select count(*) as tras_la_primera from public.tcg_card_versions \gset
\i :migracion951

with v as (select card_id, etiqueta, cm_id_product, set_id from public.tcg_card_versions where origen = 'edicion' and market = 'JP')
select case when cond then 'ok ' else 'MAL ' end || que from (values
  ((select string_agg(etiqueta, ',' order by etiqueta) from v where card_id = 'tcggo-b1') = '1st Edition,Unlimited', 'una carta de BW (2010) recibe la 1.ª edición y la Unlimited'),
  ((select cm_id_product from v where card_id = 'tcggo-b1' and etiqueta = 'Unlimited') = 810001, '  …la Unlimited con el producto de la carta'),
  ((select count(*) from v where card_id = 'tcggo-x1') = 2, 'el último día del tramo (CP6, 30-9-2016) entra'),
  ((select count(*) from v where card_id = 'tcggo-s1') = 0, 'Sol y Luna (diciembre de 2016) no: ya no hubo 1.ª edición'),
  ((select count(*) from v where card_id = 'tcggo-n1') = 0, 'neo (2000) tampoco: antes de VS no hubo 1.ª edición'),
  ((select count(*) from v where card_id = 'tcggo-p1') = 0, 'las promos no se tocan'),
  ((select count(*) from v where card_id = 'tcggo-o1') = 0, 'un set escondido no se toca'),
  ((select count(*) from v where card_id = 'tcggo-50003') = 2, 'lo de la 948 se queda como estaba (dos, no cuatro)'),
  ((select variante from public.user_collection where card_id = 'tcggo-b1' and variante <> 'reverse') = 'unlimited', 'la copia «normal» de BW pasa a Unlimited'),
  ((select count(*) from public.user_collection where card_id = 'tcggo-b1' and variante = 'reverse') = 1, '  …la reverse se queda'),
  ((select variante from public.user_collection where card_id = 'tcggo-s1') = 'normal', '  …y la de Sol y Luna también'),
  ((select count(*) from public.tcg_card_versions) = :tras_la_primera, 'la segunda vez no crea nada'),
  ((select jsonb_array_length(valor->'sets') from public.scrydex_estado where clave = 'ediciones_jp_951') > 0, '  …y el informe sigue siendo el de la primera'),
  ((select bool_and(x->>'set' not in ('sm1_ja', 'neo1_ja', 'dpp_ja', 'oculto_ja', 'vacio_ja')) from public.scrydex_estado e, jsonb_array_elements(e.valor->'sets') x where e.clave = 'ediciones_jp_951'), 'el informe no nombra ninguno de los que no tocaba'),
  ((select count(*) from public.scrydex_estado e, jsonb_array_elements(e.valor->'sets') x where e.clave = 'ediciones_jp_951' and x->>'set' in ('bw1_ja', 'xy11_ja')) = 2, '  …y sí BW y CP6')
) as t(cond, que);
