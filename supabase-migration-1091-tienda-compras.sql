-- ============================================================
-- Tanda 1091: comprar a un cliente.
--
-- Alguien llega a la tienda con un taco de cartas. La tienda las tasa (lo que
-- valen en Cardmarket, orientativo, y lo que paga ella) y, al cerrarlo, todo
-- entra al stock con lo que costó DE VERDAD: así el beneficio de Ventas sale
-- bien sin apuntar nada a mano. PINGU lo eligió de «Tiendas, la tercera
-- vuelta» (punto 1).
--
--   1. `tienda_compras`: una fila por línea comprada; las de una misma compra
--      comparten `ticket`. Lo que era va copiado (si la línea del stock se
--      borra o cambia, la compra no). Solo la ve su tienda; escribe la función.
--   2. `tienda_comprar(lineas, cliente)`: una línea NUEVA de stock por cada
--      línea comprada (con su coste y la fecha de hoy, para que «días en tu
--      stock» diga la verdad), y la compra apuntada. Todo o nada.
--   3. `tienda_deshacer_compra(ticket)`: quita esas unidades del stock (borra
--      la línea si se queda en cero) y la compra. Si ya se vendió alguna, no
--      deshace nada y lo dice.
--   4. `tienda_compras_lista(filtros, desde, cuántas)`: la lista con sus
--      sumas, EN LA BASE (el tope de 1.000 filas, la 808).
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1067 y la 1068.
-- ============================================================

-- ── 1. Las compras ──
create table if not exists public.tienda_compras (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ticket uuid not null,
  -- La línea del stock en la que entró (si se borra, la compra se queda).
  stock_id uuid references public.tienda_stock (id) on delete set null,
  card_id text,
  market text not null default 'WEST',
  product_id bigint,
  idioma text not null,
  estado text not null,
  variante text not null default 'normal',
  gradeo text,
  unidades int not null,
  -- Lo que pagó la tienda, por unidad.
  coste numeric(10, 2) not null,
  -- Lo que valía en Cardmarket al comprarla (orientativo), por unidad.
  cm numeric(10, 2),
  -- A quién se le compró, si la tienda lo apunta (un nombre o un usuario).
  cliente text,
  comprada_el timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint tienda_compras_que check ((card_id is null) <> (product_id is null)),
  constraint tienda_compras_unidades check (unidades between 1 and 99999),
  constraint tienda_compras_dinero check (coste >= 0 and (cm is null or cm >= 0)),
  constraint tienda_compras_cliente check (cliente is null or char_length(cliente) between 1 and 80)
);

create index if not exists tienda_compras_tienda_idx on public.tienda_compras (tienda_id, comprada_el desc);
create index if not exists tienda_compras_ticket_idx on public.tienda_compras (ticket);

alter table public.tienda_compras enable row level security;
drop policy if exists tienda_compras_suyas on public.tienda_compras;
create policy tienda_compras_suyas on public.tienda_compras for select to authenticated
  using (tienda_id = auth.uid() and public.soy_tienda());
grant select on public.tienda_compras to authenticated;

-- ── 2. Comprar ──
-- `p_lineas`: [{ "card_id" | "product_id", "market", "idioma", "estado",
-- "variante", "gradeo", "unidades", "coste": €/unidad, "cm": €/unidad o null,
-- "precio": tu precio de venta o null }].
create or replace function public.tienda_comprar(p_lineas jsonb, p_cliente text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ticket uuid := gen_random_uuid();
  v_cliente text := nullif(btrim(coalesce(p_cliente, '')), '');
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
  v_precio numeric;
  v_stock uuid;
  v_total numeric := 0;
  v_unidades int := 0;
  v_lineas int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda compra.' using errcode = '42501';
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
    v_precio := round(nullif(v_linea->>'precio', '')::numeric, 2);
    if (v_card is null) = (v_prod is null) then
      raise exception 'Cada línea es una carta o un producto.' using errcode = '22023';
    end if;
    if v_n is null or v_n < 1 or v_n > 99999 then
      raise exception 'Cada línea compra al menos una unidad.' using errcode = '22023';
    end if;
    if v_coste is null or v_coste < 0 then
      raise exception 'Cada línea lleva lo que pagas.' using errcode = '22023';
    end if;
    if v_precio is not null and v_precio < 0 then
      raise exception 'Revisa tu precio de venta.' using errcode = '22023';
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

    -- Una línea NUEVA: con su coste exacto y la fecha de hoy. Las
    -- restricciones de `tienda_stock` (estado, idioma, textos) valen aquí.
    insert into tienda_stock (tienda_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, precio, visible, entro_el)
    values (v_uid, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_coste, v_precio, true, now())
    returning id into v_stock;

    insert into tienda_compras (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, cm, cliente)
    values (v_uid, v_ticket, v_stock, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_coste, v_cm, v_cliente);

    v_lineas := v_lineas + 1;
    v_unidades := v_unidades + v_n;
    v_total := v_total + v_coste * v_n;
  end loop;

  return jsonb_build_object('ticket', v_ticket, 'lineas', v_lineas, 'unidades', v_unidades, 'total', v_total);
end;
$$;

-- ── 3. Deshacer ──
-- Todo o nada: si de una línea ya no quedan las unidades que entraron (se
-- vendió alguna), no se toca ninguna.
create or replace function public.tienda_deshacer_compra(p_ticket uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_compra record;
  v_quedan int;
  v_borradas int := 0;
  v_lineas int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda compra.' using errcode = '42501';
  end if;
  for v_compra in select * from tienda_compras where ticket = p_ticket and tienda_id = v_uid for update loop
    v_lineas := v_lineas + 1;
    if v_compra.stock_id is not null then
      select unidades into v_quedan from tienda_stock where id = v_compra.stock_id and tienda_id = v_uid for update;
      if found and v_quedan < v_compra.unidades then
        raise exception 'Ya has vendido alguna de esta compra: quítalas del stock a mano.' using errcode = 'P0001';
      end if;
      if found then
        if v_quedan = v_compra.unidades then
          delete from tienda_stock where id = v_compra.stock_id;
          v_borradas := v_borradas + 1;
        else
          update tienda_stock set unidades = unidades - v_compra.unidades, updated_at = now() where id = v_compra.stock_id;
        end if;
      end if;
    end if;
    delete from tienda_compras where id = v_compra.id;
  end loop;
  if v_lineas = 0 then
    raise exception 'Esa compra ya no existe.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('lineas', v_lineas, 'borradas', v_borradas);
end;
$$;

-- ── 4. La lista ──
create or replace function public.tienda_compras_lista(
  p_filtros jsonb default '{}'::jsonb,
  p_desde int default 0,
  p_cuantas int default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
  v_q text := lower(btrim(coalesce(p_filtros->>'q', '')));
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda compra.' using errcode = '42501';
  end if;

  with
  base as (
    select v.*,
      c.set_id, c.local_id as numero,
      coalesce(c.name_es, c.name, p.name) as nombre,
      lower(coalesce(c.name_search, '') || ' ' || coalesce(p.name, '') || ' ' || coalesce(v.cliente, '')) as texto
    from tienda_compras v
    left join tcg_cards c on c.id = v.card_id and c.market = v.market
    left join tcg_products p on p.id = v.product_id
    where v.tienda_id = v_uid
      and (p_filtros->>'desde' is null or v.comprada_el >= (p_filtros->>'desde')::timestamptz)
      and (p_filtros->>'hasta' is null or v.comprada_el < (p_filtros->>'hasta')::timestamptz)
  ),
  filtrada as (
    select * from base b
    where v_q = '' or b.numero = v_q or not exists (
      select 1 from unnest(regexp_split_to_array(v_q, '\s+')) palabra where position(palabra in b.texto) = 0
    )
  ),
  ordenada as (
    select f.*, row_number() over (order by f.comprada_el desc, f.ticket, f.id) as puesto from filtrada f
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'tickets', (select count(distinct ticket) from filtrada),
    'sumas', jsonb_build_object(
      'unidades', (select coalesce(sum(unidades), 0) from filtrada),
      'importe', (select coalesce(sum(coste * unidades), 0) from filtrada),
      'cm', (select coalesce(sum(cm * unidades), 0) from filtrada where cm is not null),
      'importe_con_cm', (select coalesce(sum(coste * unidades), 0) from filtrada where cm is not null)
    ),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'ticket', ticket, 'stock_id', stock_id, 'card_id', card_id, 'market', market, 'product_id', product_id,
      'nombre', nombre, 'set_id', set_id, 'numero', numero,
      'idioma', idioma, 'estado', estado, 'variante', variante, 'gradeo', gradeo,
      'unidades', unidades, 'coste', coste, 'cm', cm, 'cliente', cliente, 'comprada_el', comprada_el
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 100), 1), 5000)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

revoke all on function public.tienda_comprar(jsonb, text) from public;
revoke all on function public.tienda_deshacer_compra(uuid) from public;
revoke all on function public.tienda_compras_lista(jsonb, int, int) from public;
grant execute on function public.tienda_comprar(jsonb, text) to authenticated;
grant execute on function public.tienda_deshacer_compra(uuid) to authenticated;
grant execute on function public.tienda_compras_lista(jsonb, int, int) to authenticated;

notify pgrst, 'reload schema';
