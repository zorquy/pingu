-- ============================================================
-- Tanda 1255 — COMPRAR RÁPIDO y «POR PONER A LA VENTA»
-- ============================================================
-- PINGU: «lo guardas y eso se te guarda en el stock… pero aún no está en
-- venta… se quedaría en un apartado de compradas». Y: «a cuánto lo valoras
-- y a cuánto lo compras».
--
--   1. `tienda_stock.valorado`: lo que la tienda le da de valor al comprarla
--      (por unidad). Es el precio de partida al ponerla a la venta.
--   2. `tienda_stock.por_poner`: comprada y sin poner a la venta. Entra oculta
--      (`visible = false`), así que el escaparate, el Mercado y «En tiendas»
--      no la enseñan sin tocarlos (todos miran `visible`).
--   3. `tienda_compras.pago` (efectivo, Bizum, PayPal u otro) y `valorado`.
--   4. `tienda_comprar(lineas, cliente, pago)`: la de la 1091, con el valor de
--      cada línea, el pago, y cada línea entra POR PONER A LA VENTA. Se borra
--      la de dos parámetros (con las dos, una llamada sería ambigua).
--   5. `tienda_poner_a_la_venta(ids, precio)`: la publica. Sin precio, el que
--      tenga o su valor; si no tiene ninguno, se la salta y lo dice.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1068 y la 1091.
-- ============================================================

begin;

alter table public.tienda_stock add column if not exists valorado numeric(10, 2);
alter table public.tienda_stock add column if not exists por_poner boolean not null default false;
alter table public.tienda_stock drop constraint if exists tienda_stock_valorado;
alter table public.tienda_stock add constraint tienda_stock_valorado check (valorado is null or valorado >= 0);
create index if not exists tienda_stock_por_poner on public.tienda_stock (tienda_id) where por_poner;

alter table public.tienda_compras add column if not exists pago text;
alter table public.tienda_compras add column if not exists valorado numeric(10, 2);
alter table public.tienda_compras drop constraint if exists tienda_compras_pago;
alter table public.tienda_compras add constraint tienda_compras_pago
  check (pago is null or pago in ('efectivo', 'bizum', 'paypal', 'otro'));
alter table public.tienda_compras drop constraint if exists tienda_compras_valorado;
alter table public.tienda_compras add constraint tienda_compras_valorado check (valorado is null or valorado >= 0);

drop function if exists public.tienda_comprar(jsonb, text);

-- `p_lineas`: [{ "card_id" | "product_id", "market", "idioma", "estado",
-- "variante", "gradeo", "unidades", "coste": lo que pagas por unidad,
-- "valorado": lo que vale para ti o null, "cm": Cardmarket o null }].
create or replace function public.tienda_comprar(p_lineas jsonb, p_cliente text default null, p_pago text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ticket uuid := gen_random_uuid();
  v_cliente text := nullif(btrim(coalesce(p_cliente, '')), '');
  v_pago text := nullif(btrim(coalesce(p_pago, '')), '');
  v_linea jsonb;
  v_card text;
  v_prod bigint;
  v_market text;
  v_idioma text;
  v_estado text;
  v_variante text;
  v_gradeo text;
  v_n int;
  v_coste numeric;
  v_cm numeric;
  v_valor numeric;
  v_stock uuid;
  v_total numeric := 0;
  v_valorado numeric := 0;
  v_unidades int := 0;
  v_lineas int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda compra.' using errcode = '42501';
  end if;
  if v_pago is not null and v_pago not in ('efectivo', 'bizum', 'paypal', 'otro') then
    raise exception 'Esa forma de pago no existe.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'No hay nada que comprar.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lineas) > 200 then
    raise exception 'Como mucho 200 líneas por compra.' using errcode = '22023';
  end if;
  if v_cliente is not null and char_length(v_cliente) > 80 then
    raise exception 'El nombre del cliente, como mucho 80 letras.' using errcode = '22023';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_card := nullif(v_linea->>'card_id', '');
    v_prod := nullif(v_linea->>'product_id', '')::bigint;
    v_market := coalesce(nullif(v_linea->>'market', ''), 'WEST');
    v_n := (v_linea->>'unidades')::int;
    v_coste := round((v_linea->>'coste')::numeric, 2);
    v_cm := round(nullif(v_linea->>'cm', '')::numeric, 2);
    v_valor := round(nullif(v_linea->>'valorado', '')::numeric, 2);
    if (v_card is null) = (v_prod is null) then
      raise exception 'Cada línea es una carta o un producto.' using errcode = '22023';
    end if;
    if v_n is null or v_n < 1 or v_n > 99999 then
      raise exception 'Cada línea compra al menos una unidad.' using errcode = '22023';
    end if;
    if v_coste is null or v_coste < 0 then
      raise exception 'Cada línea lleva lo que pagas.' using errcode = '22023';
    end if;
    if v_valor is not null and v_valor < 0 then
      raise exception 'Revisa lo que vale.' using errcode = '22023';
    end if;
    if v_card is not null then
      if not exists (select 1 from tcg_cards where id = v_card and market = v_market) then
        raise exception 'Una de las cartas no está en el catálogo.' using errcode = 'P0002';
      end if;
      v_idioma := coalesce(nullif(v_linea->>'idioma', ''), case when v_market = 'JP' then 'ja' else 'es' end);
      v_estado := coalesce(nullif(v_linea->>'estado', ''), 'NM');
      v_variante := coalesce(nullif(v_linea->>'variante', ''), 'normal');
      v_gradeo := nullif(btrim(coalesce(v_linea->>'gradeo', '')), '');
    else
      if not exists (select 1 from tcg_products where id = v_prod) then
        raise exception 'Uno de los productos no está en el catálogo.' using errcode = 'P0002';
      end if;
      v_idioma := coalesce(nullif(v_linea->>'idioma', ''), 'en');
      v_estado := 'sellado';
      v_variante := 'normal';
      v_gradeo := null;
    end if;

    -- Una línea NUEVA, oculta y por poner a la venta, con su coste exacto.
    insert into tienda_stock (tienda_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, valorado, precio, visible, por_poner, entro_el)
    values (v_uid, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_coste, v_valor, null, false, true, now())
    returning id into v_stock;

    insert into tienda_compras (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, cm, cliente, pago, valorado)
    values (v_uid, v_ticket, v_stock, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_coste, v_cm, v_cliente, v_pago, v_valor);

    v_lineas := v_lineas + 1;
    v_unidades := v_unidades + v_n;
    v_total := v_total + v_coste * v_n;
    v_valorado := v_valorado + coalesce(v_valor, v_cm, 0) * v_n;
  end loop;

  return jsonb_build_object('ticket', v_ticket, 'lineas', v_lineas, 'unidades', v_unidades, 'total', v_total, 'valorado', v_valorado, 'pago', v_pago);
end;
$$;

-- Ponerlas a la venta: las tuyas que estén por poner. Sin precio dado, el que
-- tengan o su valor.
create or replace function public.tienda_poner_a_la_venta(p_ids uuid[], p_precio numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_puestas int := 0;
  v_sin int := 0;
  v_s record;
  v_precio numeric;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  if p_precio is not null and p_precio < 0 then
    raise exception 'Revisa el precio.' using errcode = '22023';
  end if;
  for v_s in select id, precio, valorado from tienda_stock
    where tienda_id = v_uid and por_poner and id = any (coalesce(p_ids, '{}')) for update loop
    v_precio := round(coalesce(p_precio, v_s.precio, v_s.valorado), 2);
    if v_precio is null then
      v_sin := v_sin + 1;
      continue;
    end if;
    update tienda_stock set precio = v_precio, visible = true, por_poner = false, updated_at = now() where id = v_s.id;
    v_puestas := v_puestas + 1;
  end loop;
  return jsonb_build_object('puestas', v_puestas, 'sin_precio', v_sin);
end;
$$;

revoke all on function public.tienda_comprar(jsonb, text, text) from public, anon;
grant execute on function public.tienda_comprar(jsonb, text, text) to authenticated;
revoke all on function public.tienda_poner_a_la_venta(uuid[], numeric) from public, anon;
grant execute on function public.tienda_poner_a_la_venta(uuid[], numeric) to authenticated;

commit;

notify pgrst, 'reload schema';
