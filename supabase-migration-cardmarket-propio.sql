-- ─────────────────────────────────────────────────────────────────────
-- NUESTRO PROPIO EMPAREJAMIENTO CON CARDMARKET (tanda 587).
--
-- TCGdex casa cada carta con un producto de Cardmarket y lo hace mal a lo
-- grande (su issue #2325). Desde la 587 el cruce lo hacemos nosotros con
-- los ficheros abiertos de Cardmarket (netlify/lib/cardmarket-catalogo.mjs)
-- y el resultado vive AQUÍ, en nuestra tabla de cartas: `cm_id_product_
-- propio` es el producto de Cardmarket que NOSOTROS decimos que es esta
-- carta, y `cm_por` cómo se decidió («orden», «nombre+ataques», «nombre»).
--
-- Con ese id, `cardmarket-precios` lee cada día la guía de precios de
-- Cardmarket (un fichero, todas las cartas) y rellena `tcg_card_prices`;
-- `precios-coleccion` (TCGdex) deja de pisar Cardmarket en las cartas que
-- tienen par propio y se queda solo con TCGplayer.
--
-- Ejecutar en el SQL Editor de Supabase. Es re-ejecutable.
-- ─────────────────────────────────────────────────────────────────────
begin;

alter table public.tcg_cards add column if not exists cm_id_product_propio int;
alter table public.tcg_cards add column if not exists cm_por text;
alter table public.tcg_cards add column if not exists cm_emparejado_at timestamptz;

create index if not exists tcg_cards_cm_propio_idx on public.tcg_cards (cm_id_product_propio) where cm_id_product_propio is not null;

-- Guardar los pares de una pasada: UNA sentencia para cientos de cartas.
-- Un PATCH por carta serían 23.000 peticiones; un upsert de la carta
-- entera tendría que repetir todas las columnas obligatorias (la 526).
-- `p_pares` es [{ "id": "xy5-150", "id_product": 273681, "por": "orden" }].
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
         cm_por = p.por,
         cm_emparejado_at = now()
    from jsonb_to_recordset(p_pares) as p(id text, id_product int, por text)
   where c.id = p.id and c.market = p_market;
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

-- Solo la función de Netlify, con la clave de servicio.
revoke all on function public.cardmarket_guardar_pares(jsonb, text) from public, anon, authenticated;
grant execute on function public.cardmarket_guardar_pares(jsonb, text) to service_role;

commit;

notify pgrst, 'reload schema';

-- Comprobación: cuántas cartas tienen par propio, y cuántas de ellas
-- discrepan del producto que les da TCGdex (las que estaban mal).
select count(*) filter (where c.cm_id_product_propio is not null) as con_par_propio,
       count(*) filter (where c.cm_id_product_propio is not null and p.cm_id_product is not null and p.cm_id_product <> c.cm_id_product_propio) as distinto_de_tcgdex
  from public.tcg_cards c
  left join public.tcg_card_prices p on p.card_id = c.id
 where c.market = 'WEST';
