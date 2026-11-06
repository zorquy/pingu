-- ============================================================
-- Tanda 1254 — EL MOSTRADOR: cómo te pagan y a qué precio la tenías
-- ============================================================
-- PINGU: «estoy en un card show… unos quieren comprar, otros quieren
-- vender». Vender rápido apunta dos cosas más de cada venta:
--
--   1. `tienda_ventas.pago`: efectivo, tarjeta, Bizum o PayPal (NULL en lo de
--      antes y en lo que no se dijo: una reserva recogida, una oferta).
--   2. `tienda_ventas.precio_lista`: el precio que la tienda tenía puesto en
--      ese momento (el de la oferta mientras dure, `tienda_precio_de`), para
--      saber lo que se rebajó al regatear. Lo pone la BASE, no el navegador.
--   3. `tienda_vender(lineas, donde, pago)`: la de la 1072 con el pago. Se
--      borra la de dos parámetros: con las dos, una llamada con (lineas, donde)
--      no sabría cuál elegir.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1072 y la 1082 (`tienda_precio_de`, en la 1079).
-- ============================================================

begin;

alter table public.tienda_ventas add column if not exists pago text;
alter table public.tienda_ventas add column if not exists precio_lista numeric(10, 2);
alter table public.tienda_ventas drop constraint if exists tienda_ventas_pago;
alter table public.tienda_ventas add constraint tienda_ventas_pago
  check (pago is null or pago in ('efectivo', 'tarjeta', 'bizum', 'paypal'));
alter table public.tienda_ventas drop constraint if exists tienda_ventas_lista;
alter table public.tienda_ventas add constraint tienda_ventas_lista check (precio_lista is null or precio_lista >= 0);

drop function if exists public.tienda_vender(jsonb, text);

-- `p_lineas`: [{ "stock_id": uuid, "unidades": n, "precio": €/unidad }].
-- Todo o nada: si una línea no tiene tantas unidades, no se vende ninguna.
create or replace function public.tienda_vender(p_lineas jsonb, p_donde text default 'mostrador', p_pago text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ticket uuid := gen_random_uuid();
  v_pago text := nullif(btrim(coalesce(p_pago, '')), '');
  v_linea jsonb;
  v_stock tienda_stock%rowtype;
  v_n int;
  v_precio numeric;
  v_lista numeric;
  v_total numeric := 0;
  v_beneficio numeric := 0;
  v_rebaja numeric := 0;
  v_sin_coste int := 0;
  v_lineas int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda vende.' using errcode = '42501';
  end if;
  if coalesce(p_donde, '') not in ('mostrador', 'cardmarket', 'evento', 'otro') then
    raise exception 'Ese sitio de venta no existe.' using errcode = '22023';
  end if;
  if v_pago is not null and v_pago not in ('efectivo', 'tarjeta', 'bizum', 'paypal') then
    raise exception 'Esa forma de pago no existe.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'No hay nada que vender.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lineas) > 200 then
    raise exception 'Como mucho 200 líneas por venta.' using errcode = '22023';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_n := (v_linea->>'unidades')::int;
    v_precio := round((v_linea->>'precio')::numeric, 2);
    if v_n is null or v_n < 1 then
      raise exception 'Cada línea vende al menos una unidad.' using errcode = '22023';
    end if;
    if v_precio is null or v_precio < 0 then
      raise exception 'Cada línea lleva su precio.' using errcode = '22023';
    end if;
    -- Bloqueada: dos ventas a la vez de la última copia no la venden dos veces.
    select * into v_stock from tienda_stock
      where id = (v_linea->>'stock_id')::uuid and tienda_id = v_uid
      for update;
    if not found then
      raise exception 'Una de las cartas ya no está en tu stock.' using errcode = 'P0002';
    end if;
    if v_stock.unidades < v_n then
      raise exception 'No quedan tantas: de una línea hay %.', v_stock.unidades using errcode = '22023';
    end if;
    v_lista := public.tienda_precio_de(v_stock.precio, v_stock.oferta_precio, v_stock.oferta_hasta);
    update tienda_stock set unidades = unidades - v_n, updated_at = now() where id = v_stock.id;
    insert into tienda_ventas (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, precio, coste, donde, pago, precio_lista)
    values (v_uid, v_ticket, v_stock.id, v_stock.card_id, v_stock.market, v_stock.product_id, v_stock.idioma, v_stock.estado, v_stock.variante, v_stock.gradeo, v_n, v_precio, v_stock.coste, p_donde, v_pago, v_lista);
    v_lineas := v_lineas + 1;
    v_total := v_total + v_precio * v_n;
    if v_lista is not null and v_lista > v_precio then
      v_rebaja := v_rebaja + (v_lista - v_precio) * v_n;
    end if;
    if v_stock.coste is null then
      v_sin_coste := v_sin_coste + 1;
    else
      v_beneficio := v_beneficio + (v_precio - v_stock.coste) * v_n;
    end if;
  end loop;

  return jsonb_build_object('ticket', v_ticket, 'lineas', v_lineas, 'total', v_total, 'beneficio', v_beneficio,
    'sin_coste', v_sin_coste, 'rebaja', v_rebaja, 'pago', v_pago);
end;
$$;

revoke all on function public.tienda_vender(jsonb, text, text) from public, anon;
grant execute on function public.tienda_vender(jsonb, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';
