-- ─────────────────────────────────────────────────────────────────────
-- EL PRECIO DE LAS CARTAS JAPONESAS (tanda 642).
--
-- TCGGO da, en su catálogo japonés, el mínimo Near Mint de Cardmarket de
-- la impresión japonesa (`lowest_near_mint_JP`). Es una columna más de la
-- fila de precios, y el idioma «ja» entra en la regla del valor de una
-- copia igual que los cinco occidentales.
--
-- Ejecutar en el SQL Editor de Supabase DESPUÉS de
-- supabase-migration-tcggo-precios.sql. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

alter table public.tcg_card_prices add column if not exists cm_low_ja numeric(10, 2);
comment on column public.tcg_card_prices.cm_low_ja is 'Mínimo Near Mint en Cardmarket de la impresión JAPONESA (TCGGO, lowest_near_mint_JP).';

-- La regla del valor, con el japonés. Misma regla que en la 589; la firma
-- vieja se borra para que no haya dos.
drop function if exists public.valor_de_linea(numeric, int, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric);

create or replace function public.valor_de_linea(
  p_valor_manual numeric,
  p_cantidad int,
  p_variante text,
  p_idioma text,
  p_low_es numeric, p_low_en numeric, p_low_de numeric, p_low_fr numeric, p_low_it numeric, p_low_ja numeric,
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
               when 'ja' then p_low_ja
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
           pr.cm_low_es, pr.cm_low_en, pr.cm_low_de, pr.cm_low_fr, pr.cm_low_it, pr.cm_low_ja,
           pr.cm_trend, pr.cm_avg30, pr.cm_low,
           pr.cm_trend_holo, pr.cm_avg30_holo, pr.cm_low_holo,
           pr.tp_market_eur,
           pr.tp_normal_market, pr.tp_normal_low, pr.tp_holo_market, pr.tp_holo_low,
           pr.tp_reverse_market, pr.tp_reverse_low, pr.tp_primera_market, pr.tp_primera_low)),
         sum(c.cantidad),
         count(distinct c.card_id),
         coalesce(sum(c.cantidad) filter (
           where coalesce(c.valor_manual, 0) = 0
             and coalesce(pr.cm_low_es, pr.cm_low_en, pr.cm_low_de, pr.cm_low_fr, pr.cm_low_it, pr.cm_low_ja, 0) = 0
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

-- Comprobación: una copia japonesa con mínimo japonés 12 vale 12.
select public.valor_de_linea(null, 1, 'normal', 'ja', null, 20, null, null, null, 12, null, null, 3, null, null, null, null) as japonesa_12;
