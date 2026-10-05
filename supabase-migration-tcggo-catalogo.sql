-- ─────────────────────────────────────────────────────────────────────
-- EL CATÁLOGO DESDE TCGGO (tanda 640).
--
-- TCGGO pasa a ser quien dice qué sets y qué cartas existen: cada semana
-- `tcggo-catalogo` recorre sus expansiones (occidentales y japonesas),
-- casa cada carta suya con la nuestra —por el id de Cardmarket, por el
-- tcgid o por el número— y lo que no tenemos (variantes, promos de tienda,
-- cartas de staff, sets enteros) lo CREA. Lo que ya tenemos conserva su
-- id (es la llave de las colecciones, de las fichas y de las URLs) y gana
-- lo que TCGGO sabe de ello: su id, su imagen, los ids de producto, la
-- rareza inglesa, los PS, el ilustrador.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

alter table public.tcg_cards add column if not exists tcggo_id int;
alter table public.tcg_cards add column if not exists image_tcggo text;
alter table public.tcg_cards add column if not exists origen text;
alter table public.tcg_cards add column if not exists tcggo_at timestamptz;
alter table public.tcg_sets add column if not exists origen text;

comment on column public.tcg_cards.origen is 'null = vino de TCGdex; «tcggo» = la creó tcggo-catalogo (su id es tcggo-<id>, y TCGdex no la conoce).';
comment on column public.tcg_cards.image_tcggo is 'La foto de TCGGO (PNG en su CDN), respaldo de la de TCGdex/Scrydex.';

create index if not exists tcg_cards_tcggo_idx on public.tcg_cards (tcggo_id) where tcggo_id is not null;

-- ── Sets nuevos: solo los que no existen ──
-- `p_sets` es [{ "id": "tg-415", "name": "Pitch Black", "name_en": "Pitch Black",
--   "tcg_online_code": "PBL", "release_date": "2026-07-17", "card_count_total": 120,
--   "logo_tcggo": "https://…png", "tcggo_id": 415 }].
create or replace function public.tcggo_crear_sets(p_sets jsonb, p_market text default 'WEST')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  insert into public.tcg_sets (id, market, name, name_en, tcg_online_code, release_date, card_count_total, card_count_official, serie_id, serie_name, serie_name_en, logo_tcggo, tcggo_id, origen)
  select p.id, p_market, coalesce(p.name, p.id), p.name_en, p.tcg_online_code, p.release_date, nullif(p.card_count_total, 0), nullif(p.card_count_official, 0), p.serie_id, p.serie_name, p.serie_name_en, p.logo_tcggo, p.tcggo_id, 'tcggo'
    from jsonb_to_recordset(p_sets) as p(id text, name text, name_en text, tcg_online_code text, release_date date, card_count_total int, card_count_official int, serie_id text, serie_name text, serie_name_en text, logo_tcggo text, tcggo_id int)
  on conflict (id, market) do nothing;
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;
revoke all on function public.tcggo_crear_sets(jsonb, text) from public, anon, authenticated;
grant execute on function public.tcggo_crear_sets(jsonb, text) to service_role;

-- ── Cartas: las que existen ganan lo de TCGGO; las que no, se crean ──
-- Una sentencia para cientos de filas. Las que se CREAN llevan
-- `origen = 'tcggo'`, `detalle_at` puesto y `detalle_lang = 'tcggo'`: así
-- el engorde de TCGdex (cartas-detalle) no las visita —TCGdex no las
-- conoce y serían 404 uno tras otro—. Las que ya existen conservan todo
-- lo suyo —id, número, nombre, set, ids de producto— y de TCGGO se
-- escribe lo que es de TCGGO: su id, su foto, y desde la 644 también la
-- RAREZA, los PS y el ilustrador, que ganan a lo que hubiera (el catálogo
-- es TCGGO, y lo de antes era de Scrydex o de TCGdex). El nombre inglés y
-- la categoría solo se rellenan si faltan.
create or replace function public.tcggo_guardar_cartas(p_cartas jsonb, p_market text default 'WEST')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, tcggo_id, image_tcggo, cm_id_product_propio, tp_id_product_propio, cm_por, cm_emparejado_at, rarity_en, hp, illustrator, category, origen, tcggo_at, detalle_at, detalle_lang)
  select p.id, p_market, p.set_id, coalesce(p.local_id, ''), coalesce(p.name, p.id), p.name_en, p.tcggo_id, p.image_tcggo,
         p.cm_id_product, p.tp_id_product, case when p.cm_id_product is not null then 'tcggo' end, case when p.cm_id_product is not null then now() end,
         p.rarity_en, p.hp, p.illustrator, p.category, 'tcggo', now(), now(), 'tcggo'
    from jsonb_to_recordset(p_cartas) as p(id text, set_id text, local_id text, name text, name_en text, tcggo_id int, image_tcggo text, cm_id_product int, tp_id_product int, rarity_en text, hp int, illustrator text, category text)
  on conflict (id, market) do update
    set tcggo_id = excluded.tcggo_id,
        image_tcggo = coalesce(excluded.image_tcggo, tcg_cards.image_tcggo),
        cm_id_product_propio = coalesce(tcg_cards.cm_id_product_propio, excluded.cm_id_product_propio),
        tp_id_product_propio = coalesce(tcg_cards.tp_id_product_propio, excluded.tp_id_product_propio),
        cm_por = case when tcg_cards.cm_id_product_propio is null and excluded.cm_id_product_propio is not null then 'tcggo' else tcg_cards.cm_por end,
        cm_emparejado_at = case when tcg_cards.cm_id_product_propio is null and excluded.cm_id_product_propio is not null then now() else tcg_cards.cm_emparejado_at end,
        rarity_en = coalesce(excluded.rarity_en, tcg_cards.rarity_en),
        hp = coalesce(excluded.hp, tcg_cards.hp),
        illustrator = coalesce(excluded.illustrator, tcg_cards.illustrator),
        name_en = coalesce(tcg_cards.name_en, excluded.name_en),
        category = coalesce(tcg_cards.category, excluded.category),
        tcggo_at = now();
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;
revoke all on function public.tcggo_guardar_cartas(jsonb, text) from public, anon, authenticated;
grant execute on function public.tcggo_guardar_cartas(jsonb, text) to service_role;

-- ── Los sets que ya tenemos: también el total IMPRESO (tanda 644) ──
-- La de la 589 (supabase-migration-tcggo-precios.sql) rellenaba logo,
-- fecha y total; TCGGO da además `cards_printed_total`, que es nuestro
-- `card_count_official` (el «120» de «125/120»). Misma regla: solo se
-- rellena lo vacío. Se vuelve a escribir entera para no depender del orden.
create or replace function public.tcggo_guardar_sets(p_sets jsonb, p_market text default 'WEST')
returns int
language plpgsql
security definer
set search_path = public
as $
declare
  v_filas int;
begin
  update public.tcg_sets s
     set logo_tcggo = coalesce(nullif(p.logo, ''), s.logo_tcggo),
         tcggo_id = coalesce(p.tcggo_id, s.tcggo_id),
         release_date = coalesce(s.release_date, p.fecha),
         card_count_total = coalesce(s.card_count_total, nullif(p.cartas, 0)),
         card_count_official = coalesce(s.card_count_official, nullif(p.impresas, 0))
    from jsonb_to_recordset(p_sets) as p(id text, tcggo_id int, logo text, fecha date, cartas int, impresas int)
   where s.id = p.id and s.market = p_market;
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$;
revoke all on function public.tcggo_guardar_sets(jsonb, text) from public, anon, authenticated;
grant execute on function public.tcggo_guardar_sets(jsonb, text) to service_role;

commit;

notify pgrst, 'reload schema';

-- Comprobación: cuántas cartas sabe TCGGO, y cuántas ha creado.
select market,
       count(*) filter (where tcggo_id is not null) as con_tcggo,
       count(*) filter (where origen = 'tcggo') as creadas_por_tcggo,
       count(*) filter (where image_tcggo is not null) as con_foto_tcggo
  from public.tcg_cards
 group by market
 order by market;
