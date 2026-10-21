-- Prueba de supabase-migration-948-ediciones-japonesas.sql: carga después de
-- lo de la 885, la 934 y la 935 (sus tablas, sus datos y sus migraciones).
-- Sets japoneses como los crea el calco de TCGGO (ids «tg-…» o su código).
\set ON_ERROR_STOP on
alter table public.user_collection add column if not exists market text not null default 'WEST';
alter table public.user_collection add column if not exists variante text;
create table if not exists public.scrydex_estado (clave text primary key, valor jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now());
insert into public.tcg_sets (id, market, name, name_en, release_date, card_count_official, card_count_total, tcggo_id, oculto) values
  -- 金の空、銀の海 (PCG4): por el día, y ese día sale también una baraja.
  ('tg-900', 'JP', 'Golden Sky, Silvery Ocean', 'Golden Sky, Silvery Ocean', '2005-04-08', 106, 106, 900, false),
  ('tg-901', 'JP', 'Constructed Starter Deck', 'Constructed Starter Deck', '2005-04-08', 30, 30, 901, false),
  -- 海からの風 (E3): por el código, con otro día (TCGGO lo fecha distinto).
  ('e3', 'JP', 'Wind from the Sea', 'Wind from the Sea', '2002-06-01', 87, 87, 902, false),
  -- ロケット団の逆襲 (PCG3): por el día, pero TCGGO solo tiene 10 cartas.
  ('tg-903', 'JP', 'Rocket Gang Strikes Back', 'Rocket Gang Strikes Back', '2004-10-15', 84, 10, 903, false),
  -- 蒼空の激突 (PCG2): dos sets ese día y ninguno con su cuenta → empate.
  ('tg-904', 'JP', 'Clash of the Blue Sky', 'Clash of the Blue Sky', '2004-07-01', 80, 80, 904, false),
  ('tg-905', 'JP', 'Otra cosa', 'Otra cosa', '2004-07-01', 81, 81, 905, false),
  -- El viejo de TCGdex, escondido por el calco: no se toca aunque se llame igual.
  ('PCG4', 'JP', '金の空、銀の海', null, '2005-04-08', 106, 106, null, true),
  -- Un occidental del mismo día: es otro catálogo.
  ('ex-uf', 'WEST', 'Unseen Forces', 'Unseen Forces', '2005-04-08', 115, 115, null, false);
insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, origen, cm_id_product_propio) values
  ('tcggo-50003', 'JP', 'tg-900', '003', 'ストライク', 'Scyther', 'tcggo', 700003),
  ('tcggo-50004', 'JP', 'tg-900', '4/106', 'メガニウム', 'Meganium', 'tcggo', 700004),
  ('tcggo-50001', 'JP', 'tg-900', '1', 'カードA', 'Card A', 'tcggo', null),
  ('tcggo-60001', 'JP', 'tg-901', '003', 'ストライク', 'Scyther', 'tcggo', 700103),
  ('tcggo-61003', 'JP', 'e3', '003', 'ラフレシア', 'Vileplume', 'tcggo', 710003),
  ('tcggo-62001', 'JP', 'tg-903', '001', 'エカン', 'Ekans', 'tcggo', 720001),
  ('tcggo-63001', 'JP', 'tg-904', '001', 'X', 'X', 'tcggo', 730001),
  ('PCG4-003', 'JP', 'PCG4', '003', 'スキスター', null, null, null),
  ('ex-uf-3', 'WEST', 'ex-uf', '3', 'Scyther', 'Scyther', null, 800003);
-- El resto de cada set, como lo trae TCGGO: «005» … «106» en PCG4 y «1» … «87» en E3.
insert into public.tcg_cards (id, market, set_id, local_id, name, origen)
select 'tcggo-5' || lpad(n::text, 4, '0'), 'JP', 'tg-900', lpad(n::text, 3, '0'), 'カード' || n, 'tcggo' from generate_series(2, 106) as n where n not in (3, 4);
insert into public.tcg_cards (id, market, set_id, local_id, name, origen)
select 'tcggo-61' || lpad(n::text, 3, '0'), 'JP', 'e3', n::text, 'カード' || n, 'tcggo' from generate_series(1, 87) as n where n <> 3;
-- Las de un usuario del foro: una 1.ª edición, una normal, una holo y una reverse.
insert into public.user_collection (card_id, user_id, cantidad, variante, market) values
  ('tcggo-50003', '00000000-0000-0000-0000-0000000000c1', 1, 'primera', 'JP'),
  ('tcggo-50003', '00000000-0000-0000-0000-0000000000c1', 2, 'normal', 'JP'),
  ('tcggo-50004', '00000000-0000-0000-0000-0000000000c1', 1, 'normal', 'JP'),
  ('tcggo-61003', '00000000-0000-0000-0000-0000000000c1', 1, 'holo', 'JP'),
  ('tcggo-60001', '00000000-0000-0000-0000-0000000000c1', 1, 'normal', 'JP'),
  ('ex-uf-3', '00000000-0000-0000-0000-0000000000c1', 1, 'normal', 'WEST');
-- La «Standard» que ya escribió la pasada de precios: se queda.
insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, etiqueta) values (50003, 'JP', 'tcggo-50003', 'tg-900', 'Standard');
