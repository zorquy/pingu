-- Prueba de supabase-migration-987-repetidas-en-versiones.sql: carga después
-- de lo de la 885 y la 934 (sus tablas y sus migraciones), con las columnas
-- que la 987 toca y que esas no traen. Las cartas son la forma de verdad: la
-- promo de TCGdex y la Staff que creó el catálogo de TCGGO, «tcggo-…» en el
-- mismo set, con su producto de Cardmarket.
\set ON_ERROR_STOP on
alter table public.tcg_card_versions
  add column cm_low_en numeric, add column cm_low_de numeric, add column cm_low_fr numeric, add column cm_low_es numeric, add column cm_low_it numeric,
  add column cm_avg7 numeric, add column cm_avg30 numeric, add column cm_disponibles int, add column tp_market_eur numeric, add column tp_mid_eur numeric;
alter table public.tcg_card_prices
  add column cm_id_product int, add column cm_low_es numeric, add column cm_low_en numeric, add column cm_low_de numeric, add column cm_low_fr numeric,
  add column cm_low_it numeric, add column cm_avg7 numeric, add column cm_avg30 numeric, add column cm_disponibles int, add column tp_market_eur numeric,
  add column tp_mid_eur numeric, add column checked_at timestamptz not null default now();
-- La regla de orígenes de producción (la 945): sin ella aquí, la 987
-- escribía «fundida» en la prueba y en la base real fallaba (PINGU la cazó).
alter table public.tcg_card_versions add constraint tcg_card_versions_origen_ok
  check (origen is null or origen in ('mano', 'edicion', 'foto', 'tcgdex'));
alter table public.user_price_alerts add column market text not null default 'WEST';
alter table public.user_showcase add column market text not null default 'WEST';
-- `name_key` es GENERADA en producción (447): deshacer no puede escribirla.
alter table public.tcg_cards add column name_key text generated always as (public.immutable_unaccent(lower(name))) stored;
insert into public.tcg_sets (id, market, name, name_en, release_date, serie_id, tcg_online_code, oculto) values
  ('svp', 'WEST', 'SVP Black Star Promos', 'SVP Black Star Promos', '2023-03-31', 'sv', 'SVP', false),
  ('oculta', 'WEST', 'Escondida', 'Escondida', '2020-01-01', 'sv', null, true),
  ('svp', 'JP', 'SV-P プロモ', 'SV-P Promos', '2023-01-20', 'SV', null, false),
  ('pps9', 'WEST', 'Play! Pokémon Prize Pack Series Nine', 'Play! Pokémon Prize Pack Series Nine', '2026-06-01', 'sv', null, false);
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, origen, tcggo_id, hp, illustrator, attacks, cm_id_product_propio, image_path, image_tcggo) values
  -- El Darmanitan: la nuestra y la Staff de TCGGO (otro producto).
  ('svp-181', 'WEST', 'svp', '181', 'N''s Darmanitan', 'N''s Darmanitan', null, 48210, 140, 'Tetsu Kayama', '[{"name": "Back Draft", "damage": "30x"}]', 790001, 'sv/svp/181', 'https://tcggo/darmanitan.png'),
  ('tcggo-48211', 'WEST', 'svp', '181', 'N''s Darmanitan', 'N''s Darmanitan', 'tcggo', 48211, 140, 'Tetsu Kayama', '[{"name": "Back Draft", "damage": "30x"}]', 790002, null, 'https://tcggo/darmanitan-staff.png'),
  -- Pikachu: la repetida es la de TCGdex («060»), y la de TCGGO («60») es
  -- la principal; la de TCGdex casaba con su `tcggo_id` 47700.
  ('tcggo-47701', 'WEST', 'svp', '60', 'Pikachu', 'Pikachu', 'tcggo', 47701, 60, null, null, 780001, null, null),
  ('svp-060', 'WEST', 'svp', '060', 'Pikachu', 'Pikachu', null, 47700, 60, null, null, 780002, 'sv/svp/060', null),
  -- Mismo número y otro nombre: no es repetida.
  ('svp-100', 'WEST', 'svp', '100', 'Mew', 'Mew', null, null, 60, null, null, null, null, null),
  ('tcggo-100', 'WEST', 'svp', '100', 'Mewtwo', 'Mewtwo', 'tcggo', 100, 120, null, null, null, null, null),
  -- En una colección escondida no cuenta.
  ('oc-1', 'WEST', 'oculta', '1', 'Eevee', 'Eevee', null, null, 50, null, null, null, null, null),
  ('oc-1b', 'WEST', 'oculta', '1', 'Eevee', 'Eevee', 'tcggo', null, 50, null, null, null, null, null),
  -- Las mismas ids en el japonés: lo que se mueve no se sale del catálogo.
  ('svp-181', 'JP', 'svp', '181', 'Nのヒヒダルマ', 'N''s Darmanitan', null, null, 140, null, null, null, null, null),
  -- Dos más para «son distintas».
  ('svp-200', 'WEST', 'svp', '200', 'Snorlax', 'Snorlax', null, null, 150, null, null, null, null, null),
  ('tcggo-200', 'WEST', 'svp', '200', 'Snorlax', 'Snorlax', 'tcggo', 200, 150, null, null, null, null, null),
  -- El Prize Pack: la normal y la holo, dos productos de TCGGO.
  ('tcggo-9012', 'WEST', 'pps9', '12', 'Arcanine', 'Arcanine', 'tcggo', 9012, 130, null, null, 990012, null, 'https://tcggo/arcanine.png'),
  ('tcggo-9013', 'WEST', 'pps9', '12', 'Arcanine', 'Arcanine', 'tcggo', 9013, 130, null, null, 990013, null, 'https://tcggo/arcanine-holo.png'),
  ('tcggo-9020', 'WEST', 'pps9', '20', 'Growlithe', 'Growlithe', 'tcggo', 9020, 70, null, null, 990020, null, null),
  ('tcggo-9021', 'WEST', 'pps9', '20', 'Growlithe', 'Growlithe', 'tcggo', 9021, 70, null, null, 990021, null, null);
insert into public.tcg_card_prices (card_id, cm_low, cm_id_product, cm_low_es, cm_low_en) values
  ('svp-181', 6.5, 790001, 6.5, 10), ('tcggo-48211', 7, 790002, 7, 19), ('svp-060', 2, 780002, 2, 3);
insert into public.tcg_card_history (card_id, dia, cm_low) values ('tcggo-48211', '2026-10-01', 7.2);
insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, etiqueta, cm_low) values (48211, 'WEST', 'tcggo-48211', 'svp', 'Standard', 7);
insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior) values ('tcg_cards', 'tcggo-48211', 'WEST', 'image_path', '"https://a-mano/staff.png"', null);
insert into public.user_collection (card_id, market, user_id, cantidad, variante, idioma) values
  ('tcggo-48211', 'WEST', '00000000-0000-0000-0000-0000000000c1', 1, 'normal', 'es'),
  ('svp-181', 'WEST', '00000000-0000-0000-0000-0000000000c1', 2, 'normal', 'es'),
  ('svp-181', 'JP', '00000000-0000-0000-0000-0000000000c3', 1, 'normal', 'ja'),
  ('svp-060', 'WEST', '00000000-0000-0000-0000-0000000000c2', 1, 'normal', 'en'),
  ('tcggo-9013', 'WEST', '00000000-0000-0000-0000-0000000000c2', 1, 'normal', 'es');
insert into public.user_wants (user_id, card_id, idioma) values
  ('00000000-0000-0000-0000-0000000000c1', 'tcggo-48211', null),
  ('00000000-0000-0000-0000-0000000000c1', 'svp-181', null),
  ('00000000-0000-0000-0000-0000000000c2', 'tcggo-48211', 'es');
insert into public.user_albums (user_id, cartas) values ('00000000-0000-0000-0000-0000000000c1', '[{"id": "svp-181"}, {"id": "tcggo-48211", "pos": 4}]');
insert into public.user_price_alerts (user_id, card_id, market) values ('00000000-0000-0000-0000-0000000000c1', 'tcggo-48211', 'WEST');
insert into public.user_showcase (user_id, posicion, card_id, market) values ('00000000-0000-0000-0000-0000000000c1', 1, 'tcggo-48211', 'WEST');
