-- ─────────────────────────────────────────────────────────────────────
-- LOS DOS MERCADOS: TCGPLAYER AL LADO DE CARDMARKET (tanda 586).
--
-- PINGU: «yo metería los dos: Cardmarket lo usamos los españoles, pero
-- tenemos muchos usuarios latinoamericanos que usan TCGplayer». TCGdex
-- trae los dos en la misma ficha, así que se guardan los dos.
--
-- Y hay un segundo motivo, que es el que lo hace urgente: TCGdex a veces
-- EMPAREJA MAL una carta con Cardmarket (el Groudon-EX de Duelos
-- Primigenios traía el precio del Groudon común: 2 € por una carta de
-- 200). Lo único que lo delata es el otro mercado: cuando Cardmarket y
-- TCGplayer se llevan más de diez veces, el de Cardmarket no se cree y el
-- valor sale de TCGplayer convertido a euros. Esa regla vive en
-- `valor_de_linea`, igual que en js/cardmarket.js: la foto diaria tiene
-- que sumar LO MISMO que la cabecera (la 377).
--
-- Las columnas `tp_*` van por versión (normal, holo, reverse, primera):
-- TCGplayer da un precio por cada una. `market` es su «marketPrice» y
-- `low` su «lowPrice», en dólares.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

alter table public.tcg_card_prices add column if not exists tp_normal_market numeric(10, 2);
alter table public.tcg_card_prices add column if not exists tp_normal_low numeric(10, 2);
alter table public.tcg_card_prices add column if not exists tp_holo_market numeric(10, 2);
alter table public.tcg_card_prices add column if not exists tp_holo_low numeric(10, 2);
alter table public.tcg_card_prices add column if not exists tp_reverse_market numeric(10, 2);
alter table public.tcg_card_prices add column if not exists tp_reverse_low numeric(10, 2);
alter table public.tcg_card_prices add column if not exists tp_primera_market numeric(10, 2);
alter table public.tcg_card_prices add column if not exists tp_primera_low numeric(10, 2);
alter table public.tcg_card_prices add column if not exists tp_updated timestamptz;
-- Las de la 585 (pokemontcg.io), por si no se ejecutó aquella: la API
-- murió, pero las columnas no estorban y el código las tolera.
alter table public.tcg_card_prices add column if not exists cm_url text;
alter table public.tcg_card_prices add column if not exists origen text;

-- Cuánto vale un dólar en euros, A OJO (el mismo número que
-- `EUR_POR_USD` en js/cardmarket.js: si se cambia uno, se cambia el otro).
create or replace function public.eur_por_usd()
returns numeric
language sql
immutable
as $$ select 0.86::numeric $$;

-- El precio de TCGplayer de UNA versión, en dólares: el de mercado, y si
-- no, el «desde». Una versión que TCGplayer no vende cae a la más parecida
-- (una ultra rara no tiene «normal»: su normal es el holo).
create or replace function public.tp_de_version(
  p_variante text,
  p_normal_market numeric, p_normal_low numeric,
  p_holo_market numeric, p_holo_low numeric,
  p_reverse_market numeric, p_reverse_low numeric,
  p_primera_market numeric, p_primera_low numeric
)
returns numeric
language sql
immutable
as $$
  select case p_variante
    when 'reverse' then coalesce(nullif(p_reverse_market, 0), nullif(p_reverse_low, 0), nullif(p_holo_market, 0), nullif(p_holo_low, 0), nullif(p_normal_market, 0), nullif(p_normal_low, 0))
    when 'holo' then coalesce(nullif(p_holo_market, 0), nullif(p_holo_low, 0), nullif(p_normal_market, 0), nullif(p_normal_low, 0))
    when 'primera' then coalesce(nullif(p_primera_market, 0), nullif(p_primera_low, 0), nullif(p_holo_market, 0), nullif(p_holo_low, 0), nullif(p_normal_market, 0), nullif(p_normal_low, 0))
    else coalesce(nullif(p_normal_market, 0), nullif(p_normal_low, 0), nullif(p_holo_market, 0), nullif(p_holo_low, 0))
  end;
$$;

-- ¿Se llevan más de diez veces? Entonces Cardmarket tiene OTRA carta.
create or replace function public.emparejamiento_dudoso(p_eur numeric, p_usd numeric)
returns boolean
language sql
immutable
as $$
  select case
    when coalesce(p_eur, 0) <= 0 or coalesce(p_usd, 0) <= 0 then false
    else p_eur / (p_usd * public.eur_por_usd()) > 10 or (p_usd * public.eur_por_usd()) / p_eur > 10
  end;
$$;

-- El valor de UNA línea, con el mismo orden que la página: manual; si no,
-- Cardmarket (salvo que sea dudoso); si no, TCGplayer convertido.
create or replace function public.valor_de_linea(
  p_valor_manual numeric,
  p_cantidad int,
  p_variante text,
  p_trend numeric, p_avg30 numeric, p_low numeric,
  p_trend_holo numeric, p_avg30_holo numeric, p_low_holo numeric,
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
      -- La variante `reverse` va por sus cifras... y si no las tiene, por
      -- las normales (tanda 375).
      coalesce(
        case when p_variante = 'reverse'
             then coalesce(nullif(p_trend_holo, 0), nullif(p_avg30_holo, 0), nullif(p_low_holo, 0))
        end,
        nullif(p_trend, 0), nullif(p_avg30, 0), nullif(p_low, 0)
      ) as eur,
      public.tp_de_version(p_variante,
        p_tp_normal_market, p_tp_normal_low, p_tp_holo_market, p_tp_holo_low,
        p_tp_reverse_market, p_tp_reverse_low, p_tp_primera_market, p_tp_primera_low) as usd
  )
  select coalesce(
    nullif(p_valor_manual, 0),
    case when eur is not null and not public.emparejamiento_dudoso(eur, usd) then eur end,
    round(usd * public.eur_por_usd(), 2),
    eur,
    0
  ) * greatest(coalesce(p_cantidad, 1), 0)
  from cifras;
$$;

-- La foto diaria, con las columnas nuevas. Mismo cuerpo que en
-- supabase-migration-valor-historico.sql, más los `tp_*`.
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
           c.valor_manual, c.cantidad, c.variante,
           pr.cm_trend, pr.cm_avg30, pr.cm_low,
           pr.cm_trend_holo, pr.cm_avg30_holo, pr.cm_low_holo,
           pr.tp_normal_market, pr.tp_normal_low, pr.tp_holo_market, pr.tp_holo_low,
           pr.tp_reverse_market, pr.tp_reverse_low, pr.tp_primera_market, pr.tp_primera_low)),
         sum(c.cantidad),
         count(distinct c.card_id),
         -- «Sin precio» se cuenta en COPIAS, igual que lo dice la página.
         coalesce(sum(c.cantidad) filter (
           where coalesce(c.valor_manual, 0) = 0
             and coalesce(pr.cm_trend, pr.cm_avg30, pr.cm_low, 0) = 0
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

-- Comprobación: el Groudon dudoso vale lo de TCGplayer convertido.
select public.valor_de_linea(null, 1, 'holo', 2.06, 1.34, 0.25, null, null, null, null, null, 150, 120, null, null, null, null) as groudon_en_euros;
