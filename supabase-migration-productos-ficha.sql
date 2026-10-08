-- Tanda 769 — La ficha de un producto sellado: lo que vale en cada sitio y
-- su histórico de precios.
--
-- PINGU: «cuando clicas en un producto, que te abra igual que una carta…
-- con toda la info que traemos desde la API: el precio, el gráfico, el link
-- directo a Cardmarket y TCGplayer, igual igual».
--
--   · tres columnas en `tcg_products`: el mínimo en Alemania, Francia e
--     Italia (TCGGO ya los da; hasta ahora se guardaban España, Europa y el
--     de todo Cardmarket). `tcggo-productos` no las manda hasta que existan.
--   · `historial_at`: cuándo se le pidió su histórico a TCGGO, para pedirlo
--     como mucho una vez a la semana (la función tiene además su tope
--     diario).
--   · `tcg_product_history`: una fila por producto y día, con el mínimo de
--     Cardmarket y TCGplayer en euros (sin las columnas por idioma de las
--     cartas: un producto sellado ES de un idioma, y la gráfica rotularía
--     «Alemán» lo que es «vendedores de Alemania»). La escribe
--     la función con la clave de servicio; la lee todo el mundo, como el
--     precio de una carta. La política de SELECT va en la MISMA migración
--     (la 510).
--
-- Sin tablas temporales y sentencia a sentencia (la 631).

alter table public.tcg_products add column if not exists cm_lowest_de numeric;
alter table public.tcg_products add column if not exists cm_lowest_fr numeric;
alter table public.tcg_products add column if not exists cm_lowest_it numeric;
alter table public.tcg_products add column if not exists historial_at timestamptz;

create table if not exists public.tcg_product_history (
  product_id bigint not null references public.tcg_products (id) on delete cascade,
  dia date not null,
  cm_low numeric,
  cm_low_en numeric,
  tp_market_eur numeric,
  origen text not null default 'tcggo',
  primary key (product_id, dia)
);

alter table public.tcg_product_history enable row level security;

drop policy if exists tcg_product_history_ver on public.tcg_product_history;
create policy tcg_product_history_ver on public.tcg_product_history for select to anon, authenticated using (true);

notify pgrst, 'reload schema';
