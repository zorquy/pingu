-- Datos de la 1037, encima del fixture de la 987: el Zekrom de N como está en
-- la base (PINGU pegó la consulta de la 1034): la de TCGdex con el nombre en
-- español y la de TCGGO con el inglés y la de Pokémon Center fundida.
\set ON_ERROR_STOP on
insert into public.tcg_sets (id, market, name, name_en, release_date, serie_id, tcg_online_code, oculto) values
  ('mep', 'WEST', 'MEP Black Star Promos', 'MEP Black Star Promos', '2025-09-26', 'me', 'MEP', false);
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, name_es, origen, tcggo_id, cm_id_product_propio, image_path, variants) values
  ('mep-031', 'WEST', 'mep', '031', 'Zekrom de N', 'N''s Zekrom', 'Zekrom de N', null, null, null, 'me/mep/031', '{"holo": true}'),
  ('tcggo-33636', 'WEST', 'mep', '031', 'N''s Zekrom', 'N''s Zekrom', null, 'tcggo', 33636, 873702, null, '{"holo": true}'),
  -- Otra pareja inglés/español en otro número: sale en la lista.
  ('mep-050', 'WEST', 'mep', '050', 'Pikachu de Ash', null, 'Pikachu de Ash', null, null, null, null, null),
  ('tcggo-50', 'WEST', 'mep', 'MEP 050', 'Ash''s Pikachu', 'Ash''s Pikachu', 'Pikachu de Ash', 'tcggo', 50, null, null, null),
  -- Mismo número, nada en común: no sale.
  ('mep-060', 'WEST', 'mep', '060', 'Mew', 'Mew', 'Mew', null, null, null, null, null),
  ('tcggo-60', 'WEST', 'mep', '060', 'Mewtwo', 'Mewtwo', 'Mewtwo', 'tcggo', 60, null, null, null);
insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, etiqueta, clase, origen, cm_low) values
  (-18578, 'WEST', 'tcggo-33636', 'mep', 'Pokémon Center', 'sello', 'fundida', 12),
  (33636, 'WEST', 'tcggo-33636', 'mep', 'Standard', null, null, 3);
insert into public.tcg_card_prices (card_id, cm_low, cm_id_product, cm_low_es, cm_low_en) values ('tcggo-33636', 3, 873702, 4, 3);
insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior) values ('tcg_cards', 'tcggo-33636', 'WEST', 'variants', '{"holo": true}', null);
insert into public.user_collection (card_id, market, user_id, cantidad, variante, idioma) values
  ('tcggo-33636', 'WEST', '00000000-0000-0000-0000-0000000000c1', 2, 'holo', 'es'),
  ('tcggo-33636', 'WEST', '00000000-0000-0000-0000-0000000000c2', 1, 'pokemon-center', 'en');
-- auth.uid() como el de Supabase: lee el JWT de la petición (en el SQL
-- Editor no hay ninguno y la migración presta el de un admin).
create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
