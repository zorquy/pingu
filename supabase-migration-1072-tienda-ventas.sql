-- ============================================================
-- Tanda 1072: vender y las ventas de una tienda.
--
-- Lo que pedía PINGU el primer día («cuánto han pagado, en cuánto lo están
-- vendiendo, para que le calcule el profit… resumen diario, semanal,
-- mensual, anual»): el stock sabía lo que costó y a cuánto se vende, pero no
-- cuándo salía de la tienda. Ahora una venta resta las unidades y se apunta
-- con lo que costó EN ESE MOMENTO (si luego cambias el coste de la línea, lo
-- vendido no cambia) y dónde se vendió (PINGU eligió apuntarlo).
--
--   1. `tienda_ventas`: una fila por línea vendida; las líneas de una misma
--      venta comparten `ticket`. Solo la ve su tienda; escribe la función.
--   2. `tienda_vender(lineas, donde)`: resta del stock (sin pasar de lo que
--      hay) y apunta, todo o nada.
--   3. `tienda_deshacer_venta(ticket)`: borra la venta y devuelve las
--      unidades a su línea (si la línea ya no existe, solo se borra).
--   4. `tienda_ventas_lista(filtros, desde, cuántas)`: la lista con sus
--      sumas, EN LA BASE (el tope de 1.000 filas, la 808).
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1067 y la 1068.
-- ============================================================

-- ── 1. Las ventas ──
create table if not exists public.tienda_ventas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  ticket uuid not null,
  -- La línea del stock de la que salió (si se borra, la venta se queda).
  stock_id uuid references public.tienda_stock (id) on delete set null,
  -- Lo que era, copiado: la venta no cambia si cambia la línea.
  card_id text,
  market text not null default 'WEST',
  product_id bigint,
  idioma text not null,
  estado text not null,
  variante text not null default 'normal',
  gradeo text,
  unidades int not null,
  -- Por unidad. Sin coste, la venta no tiene beneficio (no un cero).
  precio numeric(10, 2) not null,
  coste numeric(10, 2),
  donde text not null default 'mostrador',
  vendida_el timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint tienda_ventas_que check ((card_id is null) <> (product_id is null)),
  constraint tienda_ventas_unidades check (unidades between 1 and 99999),
  constraint tienda_ventas_dinero check (precio >= 0 and (coste is null or coste >= 0)),
  constraint tienda_ventas_donde check (donde in ('mostrador', 'cardmarket', 'evento', 'otro'))
);

create index if not exists tienda_ventas_tienda_idx on public.tienda_ventas (tienda_id, vendida_el desc);
create index if not exists tienda_ventas_ticket_idx on public.tienda_ventas (ticket);

alter table public.tienda_ventas enable row level security;
drop policy if exists tienda_ventas_suyas on public.tienda_ventas;
create policy tienda_ventas_suyas on public.tienda_ventas for select to authenticated
  using (tienda_id = auth.uid() and public.soy_tienda());
grant select on public.tienda_ventas to authenticated;

-- ── 2. Vender ──
-- `p_lineas`: [{ "stock_id": uuid, "unidades": n, "precio": €/unidad }].
-- Todo o nada: si una línea no tiene tantas unidades, no se vende ninguna.
create or replace function public.tienda_vender(p_lineas jsonb, p_donde text default 'mostrador')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ticket uuid := gen_random_uuid();
  v_linea jsonb;
  v_stock tienda_stock%rowtype;
  v_n int;
  v_precio numeric;
  v_total numeric := 0;
  v_beneficio numeric := 0;
  v_sin_coste int := 0;
  v_lineas int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda vende.' using errcode = '42501';
  end if;
  if coalesce(p_donde, '') not in ('mostrador', 'cardmarket', 'evento', 'otro') then
    raise exception 'Ese sitio de venta no existe.' using errcode = '22023';
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
    update tienda_stock set unidades = unidades - v_n, updated_at = now() where id = v_stock.id;
    insert into tienda_ventas (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, precio, coste, donde)
    values (v_uid, v_ticket, v_stock.id, v_stock.card_id, v_stock.market, v_stock.product_id, v_stock.idioma, v_stock.estado, v_stock.variante, v_stock.gradeo, v_n, v_precio, v_stock.coste, p_donde);
    v_lineas := v_lineas + 1;
    v_total := v_total + v_precio * v_n;
    if v_stock.coste is null then
      v_sin_coste := v_sin_coste + 1;
    else
      v_beneficio := v_beneficio + (v_precio - v_stock.coste) * v_n;
    end if;
  end loop;

  return jsonb_build_object('ticket', v_ticket, 'lineas', v_lineas, 'total', v_total, 'beneficio', v_beneficio, 'sin_coste', v_sin_coste);
end;
$$;

-- ── 3. Deshacer ──
create or replace function public.tienda_deshacer_venta(p_ticket uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_devueltas int := 0;
  v_borradas int := 0;
  v_venta record;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda vende.' using errcode = '42501';
  end if;
  for v_venta in select * from tienda_ventas where ticket = p_ticket and tienda_id = v_uid for update loop
    if v_venta.stock_id is not null then
      update tienda_stock set unidades = unidades + v_venta.unidades, updated_at = now()
        where id = v_venta.stock_id and tienda_id = v_uid;
      if found then v_devueltas := v_devueltas + 1; end if;
    end if;
    delete from tienda_ventas where id = v_venta.id;
    v_borradas := v_borradas + 1;
  end loop;
  if v_borradas = 0 then
    raise exception 'Esa venta no existe o ya se deshizo.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('borradas', v_borradas, 'devueltas', v_devueltas);
end;
$$;

-- ── 4. La lista ──
-- Filtros (todos opcionales): desde, hasta (fechas ISO; `hasta` sin incluir),
-- donde (lista) y q (palabras del nombre, o el número).
create or replace function public.tienda_ventas_lista(
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
    raise exception 'Solo una cuenta de tienda vende.' using errcode = '42501';
  end if;

  with
  base as (
    select v.*,
      c.set_id, c.local_id as numero,
      coalesce(c.name_es, c.name, p.name) as nombre,
      lower(coalesce(c.name_search, '') || ' ' || coalesce(p.name, '')) as texto
    from tienda_ventas v
    left join tcg_cards c on c.id = v.card_id and c.market = v.market
    left join tcg_products p on p.id = v.product_id
    where v.tienda_id = v_uid
      and (p_filtros->>'desde' is null or v.vendida_el >= (p_filtros->>'desde')::timestamptz)
      and (p_filtros->>'hasta' is null or v.vendida_el < (p_filtros->>'hasta')::timestamptz)
      and (jsonb_typeof(p_filtros->'donde') is distinct from 'array' or jsonb_array_length(p_filtros->'donde') = 0 or (p_filtros->'donde') ? v.donde)
  ),
  filtrada as (
    select * from base b
    where v_q = '' or b.numero = v_q or not exists (
      select 1 from unnest(regexp_split_to_array(v_q, '\s+')) palabra where position(palabra in b.texto) = 0
    )
  ),
  ordenada as (
    select f.*, row_number() over (order by f.vendida_el desc, f.ticket, f.id) as puesto from filtrada f
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'tickets', (select count(distinct ticket) from filtrada),
    'sumas', jsonb_build_object(
      'unidades', (select coalesce(sum(unidades), 0) from filtrada),
      'importe', (select coalesce(sum(precio * unidades), 0) from filtrada),
      'coste', (select coalesce(sum(coste * unidades), 0) from filtrada where coste is not null),
      'importe_con_coste', (select coalesce(sum(precio * unidades), 0) from filtrada where coste is not null),
      'beneficio', (select coalesce(sum((precio - coste) * unidades), 0) from filtrada where coste is not null),
      'sin_coste', (select count(*) from filtrada where coste is null)
    ),
    'por_donde', coalesce((select jsonb_object_agg(donde, importe) from (
      select donde, sum(precio * unidades) as importe from filtrada group by donde
    ) d), '{}'::jsonb),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'ticket', ticket, 'stock_id', stock_id, 'card_id', card_id, 'market', market, 'product_id', product_id,
      'nombre', nombre, 'set_id', set_id, 'numero', numero,
      'idioma', idioma, 'estado', estado, 'variante', variante, 'gradeo', gradeo,
      'unidades', unidades, 'precio', precio, 'coste', coste, 'donde', donde, 'vendida_el', vendida_el
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 100), 1), 5000)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

revoke all on function public.tienda_vender(jsonb, text) from public;
revoke all on function public.tienda_deshacer_venta(uuid) from public;
revoke all on function public.tienda_ventas_lista(jsonb, int, int) from public;
grant execute on function public.tienda_vender(jsonb, text) to authenticated;
grant execute on function public.tienda_deshacer_venta(uuid) to authenticated;
grant execute on function public.tienda_ventas_lista(jsonb, int, int) to authenticated;
