-- Lo mínimo que da por hecho la 905: las tablas del valor de la colección,
-- con las columnas de precio que hay en producción, y los roles de
-- Supabase. Las funciones de precio (eur_por_usd, tp_de_version,
-- emparejamiento_dudoso, valor_de_linea) NO se copian aquí: la prueba las
-- saca de sus migraciones, que es lo que corre en la base.
\set ON_ERROR_STOP on
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated; end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role; end if;
end $$;
create table public.tcg_card_prices (
  card_id text primary key, cm_low numeric(10,2), cm_trend numeric(10,2), cm_avg30 numeric(10,2),
  cm_low_holo numeric(10,2), cm_trend_holo numeric(10,2), cm_avg30_holo numeric(10,2),
  cm_low_es numeric(10,2), cm_low_en numeric(10,2), cm_low_de numeric(10,2), cm_low_fr numeric(10,2), cm_low_it numeric(10,2), cm_low_ja numeric(10,2),
  tp_market_eur numeric(10,2),
  tp_normal_market numeric(10,2), tp_normal_low numeric(10,2), tp_holo_market numeric(10,2), tp_holo_low numeric(10,2),
  tp_reverse_market numeric(10,2), tp_reverse_low numeric(10,2), tp_primera_market numeric(10,2), tp_primera_low numeric(10,2),
  cm_gradeadas jsonb, ebay_gradeadas jsonb);
create table public.user_collection (
  id serial primary key, user_id uuid not null, card_id text not null, market text not null default 'WEST', idioma text, estado text,
  variante text not null default 'normal', cantidad int not null default 1, gradeo text, valor_manual numeric(10,2));
create table public.user_collection_value (
  user_id uuid not null, dia date not null, valor numeric, copias int, distintas int, sin_precio int, primary key (user_id, dia));
-- Una PSA 10 de Cardmarket, una BGS 9.5 de eBay, una PSA 8 sin precio
-- de su nota (vale la carta sin gradear), una con «Tu valor» que manda y
-- una cruda. Todas de la misma persona.
insert into public.tcg_card_prices (card_id, cm_low, cm_low_es, cm_gradeadas, ebay_gradeadas) values
  ('xy5-150', 39, 140, '{"psa":{"psa10":2621,"psa9":184}}', '{"bgs":{"9.5":{"median_price":100,"sample_size":3}}}'),
  ('sv8-1', 2, 3, null, null);
insert into public.user_collection (user_id, card_id, idioma, cantidad, gradeo, valor_manual) values
  ('00000000-0000-0000-0000-00000000000a', 'xy5-150', 'es', 2, 'PSA 10', null),
  ('00000000-0000-0000-0000-00000000000a', 'xy5-150', 'es', 1, 'BGS 9.5', null),
  ('00000000-0000-0000-0000-00000000000a', 'xy5-150', 'es', 1, 'PSA 8', null),
  ('00000000-0000-0000-0000-00000000000a', 'xy5-150', 'es', 1, 'PSA 10', 5000),
  ('00000000-0000-0000-0000-00000000000a', 'sv8-1', 'es', 1, null, null),
  ('00000000-0000-0000-0000-00000000000a', 'sv8-1', 'es', 1, 'PSA 10', null);
