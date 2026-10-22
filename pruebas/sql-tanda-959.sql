-- Para la 959, encima de la base de la 956: los cuatro sets de Platino, sus
-- SH y una carta normal de Arceus.
insert into public.tcg_sets (id, market, name) values
  ('pl1', 'WEST', 'Platinum'), ('pl2', 'WEST', 'Rising Rivals'), ('pl3', 'WEST', 'Supreme Victors'), ('pl4', 'WEST', 'Arceus');
insert into public.tcg_cards (id, market, set_id) values
  ('pl1-SH4', 'WEST', 'pl1'), ('pl1-SH5', 'WEST', 'pl1'), ('pl1-SH6', 'WEST', 'pl1'),
  ('pl3-SH7', 'WEST', 'pl3'), ('pl3-SH8', 'WEST', 'pl3'), ('pl3-SH9', 'WEST', 'pl3'),
  ('pl4-SH10', 'WEST', 'pl4'), ('pl4-SH11', 'WEST', 'pl4'), ('pl4-SH12', 'WEST', 'pl4'), ('pl4-1', 'WEST', 'pl4');
-- Arceus con un anuncio «en español» (mal catalogado).
insert into public.tcg_card_prices (card_id, cm_low_es, cm_low_en, cm_low_it) values ('pl4-1', 1, 2, 3);
