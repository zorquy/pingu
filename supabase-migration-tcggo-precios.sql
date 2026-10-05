-- ─────────────────────────────────────────────────────────────────────
-- LOS PRECIOS POR IDIOMA, DESDE TCGGO (tanda 589).
--
-- TCGGO da, por cada carta, el mínimo Near Mint de Cardmarket EN CADA
-- IDIOMA (inglés, alemán, francés, español, italiano), las medias de 30 y
-- 7 días, cuántas hay a la venta, el precio de TCGplayer ya en euros, los
-- precios de gradeadas de Cardmarket y las ventas de gradeadas en eBay
-- (PSA, BGS, CGC, ACE, TAG). Todo cabe en la misma fila de
-- `tcg_card_prices`; lo de la guía diaria de Cardmarket (tendencia) y lo
-- de TCGdex (TCGplayer por versión, en dólares) se queda donde estaba.
--
-- Y el VALOR de una copia pasa a ser el mínimo de SU idioma: lo que vale
-- tu carta en español es lo que cuesta la más barata en español, no la
-- tendencia de todas juntas. Las funciones de la foto diaria cambian con
-- esa regla.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

-- ── Las columnas nuevas de la fila de precios ──
alter table public.tcg_card_prices add column if not exists cm_low_en numeric(10, 2);
alter table public.tcg_card_prices add column if not exists cm_low_de numeric(10, 2);
alter table public.tcg_card_prices add column if not exists cm_low_fr numeric(10, 2);
alter table public.tcg_card_prices add column if not exists cm_low_es numeric(10, 2);
alter table public.tcg_card_prices add column if not exists cm_low_it numeric(10, 2);
alter table public.tcg_card_prices add column if not exists cm_disponibles int;
alter table public.tcg_card_prices add column if not exists tp_market_eur numeric(10, 2);
alter table public.tcg_card_prices add column if not exists tp_mid_eur numeric(10, 2);
alter table public.tcg_card_prices add column if not exists cm_gradeadas jsonb;
alter table public.tcg_card_prices add column if not exists ebay_gradeadas jsonb;
alter table public.tcg_card_prices add column if not exists tcggo_id int;
alter table public.tcg_card_prices add column if not exists tcggo_updated timestamptz;

comment on column public.tcg_card_prices.cm_low_es is 'Mínimo Near Mint en Cardmarket de las copias EN ESPAÑOL (TCGGO, lowest_near_mint_ES). cm_low_en es lowest_near_mint a secas.';
comment on column public.tcg_card_prices.cm_gradeadas is 'Gradeadas en Cardmarket (EUR): {"psa":{"psa10":2700,"psa9":114},"bgs":{...},"cgc":{...}}. Null si no hay.';
comment on column public.tcg_card_prices.ebay_gradeadas is 'Ventas de gradeadas en eBay (USD): {"psa":{"10":{"median_price":88.67,"sample_size":1}},...}. Null si no hay.';

-- El id de TCGplayer de la carta, al lado del de Cardmarket: el botón de
-- TCGplayer va directo al producto.
alter table public.tcg_cards add column if not exists tp_id_product_propio int;

-- Y lo que TCGGO sabe de cada set: su logo (PNG en su CDN) y su id.
alter table public.tcg_sets add column if not exists logo_tcggo text;
alter table public.tcg_sets add column if not exists tcggo_id int;

-- ── Los pares, ahora con el id de TCGplayer ──
-- Misma firma que en la 587: la clave `tp_id_product` es opcional y la
-- función vieja la ignoraba, así que el emparejador puede mandarla antes
-- o después de ejecutar esto.
create or replace function public.cardmarket_guardar_pares(p_pares jsonb, p_market text default 'WEST')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  update public.tcg_cards c
     set cm_id_product_propio = p.id_product,
         tp_id_product_propio = coalesce(p.tp_id_product, c.tp_id_product_propio),
         cm_por = p.por,
         cm_emparejado_at = now()
    from jsonb_to_recordset(p_pares) as p(id text, id_product int, por text, tp_id_product int)
   where c.id = p.id and c.market = p_market;
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;
revoke all on function public.cardmarket_guardar_pares(jsonb, text) from public, anon, authenticated;
grant execute on function public.cardmarket_guardar_pares(jsonb, text) to service_role;

-- ── Lo que TCGGO sabe de los sets: logo, fecha, total ──
-- Solo RELLENA lo que esté vacío (la 508: el cero es un valor), salvo el
-- logo y el id, que son suyos. `p_sets` es
-- [{ "id": "sv08.5", "tcggo_id": 212, "logo": "https://…png", "fecha": "2025-01-17", "cartas": 180 }].
create or replace function public.tcggo_guardar_sets(p_sets jsonb, p_market text default 'WEST')
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  update public.tcg_sets s
     set logo_tcggo = coalesce(nullif(p.logo, ''), s.logo_tcggo),
         tcggo_id = coalesce(p.tcggo_id, s.tcggo_id),
         release_date = coalesce(s.release_date, p.fecha),
         card_count_total = coalesce(s.card_count_total, nullif(p.cartas, 0))
    from jsonb_to_recordset(p_sets) as p(id text, tcggo_id int, logo text, fecha date, cartas int)
   where s.id = p.id and s.market = p_market;
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;
revoke all on function public.tcggo_guardar_sets(jsonb, text) from public, anon, authenticated;
grant execute on function public.tcggo_guardar_sets(jsonb, text) to service_role;

-- ── El valor de una copia: el mínimo de SU idioma ──
--
-- La regla, de la más exacta a la más floja:
--   1. el precio que puso su dueño a mano;
--   2. el mínimo Near Mint en Cardmarket de SU idioma (TCGGO);
--   3. el mínimo general de Cardmarket, la tendencia o la media de 30 días
--      (la guía / TCGdex) — salvo si TCGdex parece tener OTRA carta
--      emparejada (la 586), que entonces no se creen;
--   4. TCGplayer en euros (TCGGO), o en dólares por versión (TCGdex)
--      convertido a ojo.
-- No se descuenta por estado a propósito: un descuento por «Good» sería
-- un número inventado.
drop function if exists public.valor_de_linea(numeric, int, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric);

create or replace function public.valor_de_linea(
  p_valor_manual numeric,
  p_cantidad int,
  p_variante text,
  p_idioma text,
  p_low_es numeric, p_low_en numeric, p_low_de numeric, p_low_fr numeric, p_low_it numeric,
  p_trend numeric, p_avg30 numeric, p_low numeric,
  p_trend_holo numeric, p_avg30_holo numeric, p_low_holo numeric,
  p_tp_market_eur numeric,
  p_tp_normal_market numeric default null, p_tp_normal_low numeric default null,
  p_tp_holo_market numeric default null, p_tp_holo_low numeric default null,
  p_tp_reverse_market numeric default null, p_tp_reverse_low numeric default null,
  p_tp_primera_market numeric default null, p_tp_primera_low numeric default null
)
returns numeric
language sql
immutable
as $$
  with cifras as (
    select
      nullif(case p_idioma
               when 'es' then p_low_es
               when 'en' then p_low_en
               when 'de' then p_low_de
               when 'fr' then p_low_fr
               when 'it' then p_low_it
             end, 0) as del_idioma,
      coalesce(
        case when p_variante = 'reverse'
             then coalesce(nullif(p_trend_holo, 0), nullif(p_avg30_holo, 0), nullif(p_low_holo, 0))
        end,
        nullif(p_low, 0), nullif(p_trend, 0), nullif(p_avg30, 0)
      ) as general,
      public.tp_de_version(p_variante,
        p_tp_normal_market, p_tp_normal_low, p_tp_holo_market, p_tp_holo_low,
        p_tp_reverse_market, p_tp_reverse_low, p_tp_primera_market, p_tp_primera_low) as usd
  )
  select coalesce(
    nullif(p_valor_manual, 0),
    del_idioma,
    case when general is not null and not public.emparejamiento_dudoso(general, usd) then general end,
    nullif(p_tp_market_eur, 0),
    round(usd * public.eur_por_usd(), 2),
    general,
    0
  ) * greatest(coalesce(p_cantidad, 1), 0)
  from cifras;
$$;

-- La foto diaria, con la regla nueva (mismo cuerpo que en la 586, más el
-- idioma de la copia y las columnas de TCGGO).
create or replace function public.coleccion_foto_diaria(p_dia date default current_date)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_filas int;
begin
  insert into public.user_collection_value (user_id, dia, valor, copias, distintas, sin_precio)
  select c.user_id,
         p_dia,
         sum(public.valor_de_linea(
           c.valor_manual, c.cantidad, c.variante, c.idioma,
           pr.cm_low_es, pr.cm_low_en, pr.cm_low_de, pr.cm_low_fr, pr.cm_low_it,
           pr.cm_trend, pr.cm_avg30, pr.cm_low,
           pr.cm_trend_holo, pr.cm_avg30_holo, pr.cm_low_holo,
           pr.tp_market_eur,
           pr.tp_normal_market, pr.tp_normal_low, pr.tp_holo_market, pr.tp_holo_low,
           pr.tp_reverse_market, pr.tp_reverse_low, pr.tp_primera_market, pr.tp_primera_low)),
         sum(c.cantidad),
         count(distinct c.card_id),
         -- «Sin precio» se cuenta en COPIAS, igual que lo dice la página.
         coalesce(sum(c.cantidad) filter (
           where coalesce(c.valor_manual, 0) = 0
             and coalesce(pr.cm_low_es, pr.cm_low_en, pr.cm_low_de, pr.cm_low_fr, pr.cm_low_it, 0) = 0
             and coalesce(pr.cm_trend, pr.cm_avg30, pr.cm_low, 0) = 0
             and coalesce(pr.tp_market_eur, 0) = 0
             and coalesce(pr.tp_normal_market, pr.tp_normal_low, pr.tp_holo_market, pr.tp_holo_low, pr.tp_reverse_market, pr.tp_reverse_low, pr.tp_primera_market, pr.tp_primera_low, 0) = 0
         ), 0)
    from public.user_collection c
    left join public.tcg_card_prices pr on pr.card_id = c.card_id
   group by c.user_id
  on conflict (user_id, dia) do update
    set valor = excluded.valor,
        copias = excluded.copias,
        distintas = excluded.distintas,
        sin_precio = excluded.sin_precio;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;
revoke all on function public.coleccion_foto_diaria(date) from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';

-- Comprobaciones:
--   · una copia en español con mínimo español 140 y tendencia 196 vale 140;
--   · una en alemán sin mínimo alemán cae al general.
select public.valor_de_linea(null, 1, 'holo', 'es', 140, 194, null, 150, null, 196.68, 131.56, 39, null, null, null, 171.08) as en_espanol_140,
       public.valor_de_linea(null, 2, 'normal', 'de', 140, 194, null, 150, null, 196.68, 131.56, 39, null, null, null, 171.08) as en_aleman_2x39;
