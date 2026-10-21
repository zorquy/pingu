-- Prueba de supabase-migration-945-versiones-ball.sql: carga después de lo
-- de la 885, la 934 y la 935 (sus tablas, sus datos y sus migraciones). Las
-- cartas son las de verdad de Black Bolt (ids y productos de Cardmarket de
-- tcgdex/cards-database) y la colada, como la crea el catálogo de TCGGO.
\set ON_ERROR_STOP on
alter table public.tcg_card_versions add column if not exists cm_low_en numeric;
update public.tcg_sets set tcggo_id = 610 where id = 'sv10.5b';
-- Otro set de la MISMA expansión de TCGGO (la estantería los junta).
insert into public.tcg_sets (id, market, name, name_en, tcggo_id) values ('tcggo-610', 'WEST', 'Black Bolt', 'Black Bolt', 610);
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, origen, cm_id_product_propio) values
  -- Pansage: el del foro. La nuestra (835910) y su Poké Ball colada como carta.
  ('sv10.5b-004', 'WEST', 'sv10.5b', '004', 'Pansage', 'Pansage', 'tcgdex', 835910),
  ('tcggo-90041', 'WEST', 'sv10.5b', '4', 'Pansage', 'Pansage', 'tcggo', 836261),
  -- Snivy: TCGGO ya le da la Poké Ball (sin producto) y la carta misma.
  ('sv10.5b-001', 'WEST', 'sv10.5b', '001', 'Snivy', 'Snivy', 'tcgdex', 835905),
  -- En el 002 hay OTRA carta (no Servine): no se toca.
  ('sv10.5b-002', 'WEST', 'sv10.5b', '002', 'Otra', 'Otra', 'tcgdex', 835906),
  -- Sewaddle de White Flare… en el otro set de la expansión no: White Flare
  -- no está, así que se cuenta sin carta. Y una de Black Bolt que vive en el
  -- set hermano (tcggo-610).
  ('tcggo-610-005', 'WEST', 'tcggo-610', '5', 'Simisage', 'Simisage', 'tcggo', 835908);
update public.tcg_cards set image_tcggo = 'https://tcggo/pansage-pb.png' where id = 'tcggo-90041';
insert into public.tcg_card_prices values ('tcggo-90041', 0.9) on conflict do nothing;
insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, etiqueta, cm_low) values
  (70000, 'WEST', 'sv10.5b-001', 'sv10.5b', 'Standard', 0.05),
  (70001, 'WEST', 'sv10.5b-001', 'sv10.5b', 'Poké Ball', 1.2),
  -- La de TCGGO de la colada (su «Standard»): pasa a la buena.
  (70041, 'WEST', 'tcggo-90041', 'sv10.5b', 'Standard', 0.9);
insert into public.user_collection (card_id, user_id, cantidad, variante) values
  ('tcggo-90041', '00000000-0000-0000-0000-0000000000c1', 2, 'normal'),
  ('sv10.5b-004', '00000000-0000-0000-0000-0000000000c1', 1, 'reverse');
insert into public.user_wants (user_id, card_id, idioma) values
  ('00000000-0000-0000-0000-0000000000c3', 'tcggo-90041', null);
