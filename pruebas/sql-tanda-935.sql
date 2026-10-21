-- Prueba de supabase-migration-935-ediciones-wizards.sql: carga después de
-- lo de la 885 y la 934 (sus tablas y sus migraciones). Las cartas son las
-- de verdad (ids y productos de Cardmarket de tcgdex/cards-database) y las
-- repetidas, como las crea el catálogo de TCGGO: «tcggo-…» en el mismo set.
\set ON_ERROR_STOP on
alter table public.tcg_card_versions add column cm_low_en numeric;
insert into public.tcg_sets (id, market, name, name_en) values ('gym2', 'WEST', 'Gym Challenge', 'Gym Challenge'), ('si1', 'WEST', 'Southern Islands', 'Southern Islands');
update public.tcg_cards set cm_id_product_propio = 273699 where id = 'base1-4';
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, origen, cm_id_product_propio, image_tcggo) values
  -- Chansey: la nuestra (Unlimited) y la Shadowless de TCGGO.
  ('base1-3', 'WEST', 'base1', '3', 'Chansey', 'Chansey', 'tcgdex', 273698, null),
  ('tcggo-3001', 'WEST', 'base1', '3', 'Chansey', 'Chansey', 'tcggo', 660225, 'https://tcggo/chansey-shadowless.png'),
  -- Charizard: la Shadowless de TCGGO y una suya con un producto que
  -- ninguna edición conoce (no se toca: se cuenta).
  ('tcggo-4001', 'WEST', 'base1', '4', 'Charizard', 'Charizard', 'tcggo', 660224, 'https://tcggo/charizard-shadowless.png'),
  ('tcggo-4002', 'WEST', 'base1', '4', 'Charizard', 'Charizard', 'tcggo', 888888, null),
  -- Otra carta de TCGGO del set, que no es de ninguna (Pikachu sin la nuestra).
  ('tcggo-5800', 'WEST', 'base1', '58', 'Pikachu', 'Pikachu', 'tcggo', 273753, null),
  -- Gym Challenge: la nuestra lleva el producto de la 1.ª edición (el
  -- único que TCGdex sabe) y la de TCGGO otro: es la Unlimited.
  ('gym2-1', 'WEST', 'gym2', '1', 'Blaine''s Arcanine', 'Blaine''s Arcanine', 'tcgdex', 274269, null),
  ('tcggo-6001', 'WEST', 'gym2', '1', 'Blaine''s Arcanine', 'Blaine''s Arcanine', 'tcggo', 555555, 'https://tcggo/arcanine.png'),
  -- Southern Islands: una sola impresión, nada que hacer.
  ('si1-1', 'WEST', 'si1', '1', 'Mew', 'Mew', 'tcgdex', 274000, null);
insert into public.tcg_card_prices values ('tcggo-4001', 900), ('tcggo-3001', 40);
insert into public.tcg_card_history (card_id, dia, cm_low) values ('tcggo-4001', '2026-10-01', 880);
-- La «1st Edition» que TCGGO da como versión de su Shadowless, con su precio.
insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, etiqueta, cm_low) values (50001, 'WEST', 'tcggo-4001', 'base1', '1st Edition', 9000);
insert into public.user_collection (card_id, user_id, cantidad, variante) values
  ('tcggo-4001', '00000000-0000-0000-0000-0000000000c1', 1, 'holo'),
  ('tcggo-4001', '00000000-0000-0000-0000-0000000000c2', 1, 'primera'),
  ('base1-3', '00000000-0000-0000-0000-0000000000c1', 1, 'normal'),
  ('base1-3', '00000000-0000-0000-0000-0000000000c2', 1, 'primera'),
  ('tcggo-3001', '00000000-0000-0000-0000-0000000000c2', 3, 'normal'),
  ('tcggo-6001', '00000000-0000-0000-0000-0000000000c1', 1, 'holo'),
  ('si1-1', '00000000-0000-0000-0000-0000000000c1', 1, 'normal');
insert into public.user_wants (user_id, card_id, idioma) values
  ('00000000-0000-0000-0000-0000000000c1', 'base1-4', null),
  ('00000000-0000-0000-0000-0000000000c1', 'tcggo-4001', null),
  ('00000000-0000-0000-0000-0000000000c3', 'tcggo-4001', null);
insert into public.user_albums (user_id, cartas) values ('00000000-0000-0000-0000-0000000000c3', '[{"id": "tcggo-4001", "pos": 1}, {"id": "si1-1"}]');
insert into public.user_showcase values ('00000000-0000-0000-0000-0000000000c3', 1, 'tcggo-3001');
