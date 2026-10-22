-- Lo mínimo para la 965: Reviving Legends japonés con las dos de la 951 y lo
-- que se añadió a mano encima, otro set que no se toca y las copias.
\set ON_ERROR_STOP on
create table public.tcg_sets (id text not null, market text not null default 'WEST', name text not null, name_en text, oculto boolean default false, primary key (id, market));
create table public.tcg_cards (id text not null, market text not null default 'WEST', set_id text not null, name text, cm_id_product_propio int, primary key (id, market));
create sequence public.tcg_card_versions_mano_seq start 100;
create table public.tcg_card_versions (tcggo_id int not null, market text not null default 'WEST', card_id text, set_id text, nombre text, etiqueta text,
  clase text, cm_id_product int, origen text, actualizado_at timestamptz, primary key (tcggo_id, market));
create table public.user_collection (id serial primary key, card_id text, market text default 'WEST', variante text);
create table public.scrydex_estado (clave text primary key, valor jsonb, updated_at timestamptz);
insert into public.tcg_sets (id, market, name, name_en) values ('L2_ja', 'JP', 'よみがえる伝説', 'Reviving Legends'), ('L1_ja', 'JP', 'ハートゴールドコレクション', 'HeartGold Collection');
insert into public.tcg_cards values ('L2-001', 'JP', 'L2_ja', 'ナゾノクサ', 5001), ('L2-002', 'JP', 'L2_ja', 'クサイハナ', 5002), ('L2-003', 'JP', 'L2_ja', 'ラフレシア', 5003), ('L1-001', 'JP', 'L1_ja', 'X', 6001);
insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, etiqueta, clase, cm_id_product, origen) values
  -- Las dos de la 951 (las más antiguas: ids más cerca del cero).
  (-10, 'JP', 'L2-001', 'L2_ja', '1st Edition', 'impresion', null, 'edicion'), (-11, 'JP', 'L2-001', 'L2_ja', 'Unlimited', 'impresion', 5001, 'edicion'),
  (-12, 'JP', 'L2-002', 'L2_ja', '1st Edition', 'impresion', null, 'edicion'), (-13, 'JP', 'L2-002', 'L2_ja', 'Unlimited', 'impresion', 5002, 'edicion'),
  -- Lo de «Versiones de todas» encima: dos reverse, una Normal y una 1st Edition repetida.
  (-50, 'JP', 'L2-001', 'L2_ja', '1st Edition Reverse Holo', 'impresion', null, 'edicion'), (-51, 'JP', 'L2-001', 'L2_ja', 'Unlimited Reverse Holo', 'impresion', null, 'edicion'),
  (-52, 'JP', 'L2-001', 'L2_ja', 'Normal', 'impresion', null, 'edicion'), (-53, 'JP', 'L2-002', 'L2_ja', '1st edition', 'impresion', null, 'edicion'),
  -- Una a mano, y una de TCGGO (sin origen) que no se toca.
  (-54, 'JP', 'L2-002', 'L2_ja', 'Holo', 'impresion', null, 'mano'), (777, 'JP', 'L2-002', 'L2_ja', 'Reverse Holo', null, 888, null),
  -- La 003 se quedó sin las de la 951 (alguien las quitó).
  (-55, 'JP', 'L2-003', 'L2_ja', 'Reverse Holo', 'impresion', null, 'edicion'),
  -- Otro set: no se toca.
  (-60, 'JP', 'L1-001', 'L1_ja', 'Normal', 'impresion', null, 'edicion');
insert into public.user_collection (card_id, market, variante) values
  ('L2-001', 'JP', '1st-edition-reverse-holo'), ('L2-001', 'JP', 'unlimited-reverse-holo'), ('L2-001', 'JP', 'primera'), ('L2-002', 'JP', 'holo'), ('L1-001', 'JP', 'normal');
