-- Casos de supabase-migration-952-legend-promos-juntas.sql: se carga después
-- de la base de pruebas de la 948. Primero sin los sets (no toca nada),
-- luego con los dos, la 952 dos veces, y se mira.
\set ON_ERROR_STOP on
\i :migracion952
select valor->>'hecho' as sin_sets from public.scrydex_estado where clave = 'legend_promos_952' \gset
insert into public.tcg_sets (id, market, name, name_en, release_date, card_count_official, card_count_total, tcggo_id, logo_tcggo, oculto) values
  ('tg-lp', 'JP', 'L-P Promos', 'L-P Promos', '2009-07-10', 82, 82, 960, null, false),
  ('LP_JA', 'JP', 'LEGEND Promos', 'LEGEND Promos', '2009-07-10', 92, 92, 961, 'https://logo/lp.png', false);
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, origen) values
  -- En los dos: mismo número (con otra forma) y mismo nombre.
  ('tcggo-lp1', 'JP', 'tg-lp', '001', 'ピカチュウ', 'Pikachu', 'tcggo'),
  ('tcggo-LP1', 'JP', 'LP_JA', 'L-P 001', 'ピカチュウ', 'Pikachu', 'tcggo'),
  -- En los dos, y casa por el inglés aunque el japonés venga distinto.
  ('tcggo-lp2', 'JP', 'tg-lp', '2', 'ライチュウ', 'Raichu', 'tcggo'),
  ('tcggo-LP2', 'JP', 'LP_JA', '002', 'ライチュウ (LP)', 'Raichu', 'tcggo'),
  -- Mismo número, otro nombre: se muda y se cuenta como dudosa.
  ('tcggo-lp3', 'JP', 'tg-lp', '003', 'ゼニガメ', 'Squirtle', 'tcggo'),
  ('tcggo-LP3', 'JP', 'LP_JA', '003', 'ヒトカゲ', 'Charmander', 'tcggo'),
  -- Solo en el pequeño: se muda.
  ('tcggo-lp9', 'JP', 'tg-lp', '099', 'ミュウ', 'Mew', 'tcggo'),
  -- Relleno: el grande tiene más.
  ('tcggo-LP4', 'JP', 'LP_JA', '004', 'X', 'X', 'tcggo'),
  ('tcggo-LP5', 'JP', 'LP_JA', '005', 'Y', 'Y', 'tcggo');
insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, numero, etiqueta, origen) values
  (95201, 'JP', 'tcggo-lp1', 'tg-lp', '001', 'Holo', 'mano'),
  (95202, 'JP', 'tcggo-LP1', 'LP_JA', '001', 'Holo', null),
  (95203, 'JP', 'tcggo-lp1', 'tg-lp', '001', 'Prerelease', 'mano'),
  (95204, 'JP', 'tcggo-lp9', 'tg-lp', '099', 'Holo', 'mano');
insert into public.tcg_card_prices (card_id, cm_low) values ('tcggo-lp1', 3);
insert into public.tcg_card_history (card_id, dia, cm_low) values ('tcggo-lp1', '2026-10-01', 3);
insert into public.user_collection (card_id, user_id, cantidad, variante, market) values
  ('tcggo-lp1', '00000000-0000-0000-0000-0000000000c1', 2, 'holo', 'JP'),
  ('tcggo-lp9', '00000000-0000-0000-0000-0000000000c1', 1, 'holo', 'JP');
insert into public.user_wants (user_id, card_id, idioma) values
  ('00000000-0000-0000-0000-0000000000c1', 'tcggo-lp1', null),
  ('00000000-0000-0000-0000-0000000000c1', 'tcggo-LP1', null),
  ('00000000-0000-0000-0000-0000000000c2', 'tcggo-lp2', 'ja');
insert into public.user_price_alerts (user_id, card_id) values ('00000000-0000-0000-0000-0000000000c1', 'tcggo-lp2');
insert into public.user_showcase (user_id, posicion, card_id) values ('00000000-0000-0000-0000-0000000000c1', 1, 'tcggo-lp1');
insert into public.user_albums (user_id, cartas) values ('00000000-0000-0000-0000-0000000000c1', '[{"id": "tcggo-lp1", "pos": 0}, {"id": "tcggo-zz", "pos": 1}]');
\i :migracion952
select count(*) as cartas_tras_la_primera from public.tcg_cards \gset
select valor::text as informe_primera from public.scrydex_estado where clave = 'legend_promos_952' \gset
\i :migracion952

select case when cond then 'ok ' else 'MAL ' end || que from (values
  (:'sin_sets' = 'false', 'sin los dos sets no toca nada y lo dice'),
  ((select count(*) from public.tcg_cards where id in ('tcggo-lp1', 'tcggo-lp2')) = 0, 'las dos que están en los dos se funden (por el japonés y por el inglés)'),
  ((select count(*) from public.tcg_correcciones where tabla = 'tcg_cards' and columna = '__borrada' and id in ('tcggo-lp1', 'tcggo-lp2')) = 2, '  …con lápida'),
  ((select card_id from public.user_collection where cantidad = 2 and variante = 'holo' and market = 'JP') = 'tcggo-LP1', 'la copia pasa a la que se queda'),
  ((select count(*) from public.user_wants where card_id in ('tcggo-lp1', 'tcggo-LP1')) = 1, 'el deseo repetido no se duplica'),
  ((select card_id from public.user_wants where idioma = 'ja' and user_id = '00000000-0000-0000-0000-0000000000c2') = 'tcggo-LP2', '  …y el otro deseo pasa'),
  ((select card_id from public.user_price_alerts where user_id = '00000000-0000-0000-0000-0000000000c1') = 'tcggo-LP2', 'el aviso de precio pasa'),
  ((select card_id from public.user_showcase where user_id = '00000000-0000-0000-0000-0000000000c1') = 'tcggo-LP1', 'la vitrina pasa'),
  ((select cartas->0->>'id' from public.user_albums where cartas @> '[{"id": "tcggo-zz"}]') = 'tcggo-LP1' and (select cartas->1->>'id' from public.user_albums where cartas @> '[{"id": "tcggo-zz"}]') = 'tcggo-zz', 'el álbum apunta a la buena y no toca lo demás'),
  ((select string_agg(etiqueta, ',' order by etiqueta) from public.tcg_card_versions where card_id = 'tcggo-LP1') = 'Holo,Prerelease', 'la versión que la buena no tenía pasa; la repetida no'),
  ((select count(*) from public.tcg_card_prices where card_id = 'tcggo-lp1') + (select count(*) from public.tcg_card_history where card_id = 'tcggo-lp1') = 0, 'el precio de la repetida se va'),
  ((select set_id from public.tcg_cards where id = 'tcggo-lp3') = 'LP_JA', 'mismo número y otro nombre: se muda, no se funde'),
  ((select set_id from public.tcg_cards where id = 'tcggo-lp9') = 'LP_JA', 'la que solo está en el pequeño se muda'),
  ((select set_id from public.tcg_card_versions where card_id = 'tcggo-lp9') = 'LP_JA', '  …con sus versiones'),
  ((select card_id from public.user_collection where cantidad = 1 and variante = 'holo' and market = 'JP' and card_id like 'tcggo-lp%') = 'tcggo-lp9', '  …y su copia sigue en ella'),
  ((select valor #>> '{}' from public.tcg_correcciones where tabla = 'tcg_cards' and id = 'tcggo-lp9' and columna = 'set_id') = 'LP_JA', '  …y la mudanza queda como corrección'),
  ((select oculto from public.tcg_sets where id = 'tg-lp') and not (select oculto from public.tcg_sets where id = 'LP_JA'), 'el pequeño se esconde; el grande no'),
  ((select count(*) from public.tcg_correcciones where tabla = 'tcg_sets' and id = 'tg-lp' and columna = 'oculto') = 1, '  …y el escondido queda como corrección'),
  ((select count(*) from public.tcg_cards where set_id = 'tg-lp') = 0, 'el escondido se queda sin cartas'),
  ((select count(*) from public.tcg_cards where set_id = 'LP_JA') = 7, 'el que se queda tiene las suyas y las mudadas'),
  ((:'informe_primera')::jsonb @> '{"hecho": true, "se_queda": "LP_JA", "se_esconde": "tg-lp", "fundidas": 2, "mudadas": 2, "dudosas": 1, "copias_movidas": 1}', 'el informe cuenta lo que ha hecho'),
  ((select count(*) from public.tcg_cards) = :cartas_tras_la_primera, 'la segunda vez no cambia nada'),
  ((select valor from public.scrydex_estado where clave = 'legend_promos_952') @> '{"fundidas": 2, "mudadas": 2}', '  …y el informe sigue siendo el de la primera')
) as t(cond, que);
