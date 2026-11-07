-- ============================================================
-- Tanda 1266 — EL CAMBIO en el Mostrador: cartas por cartas y la
-- diferencia en dinero
-- ============================================================
-- Una tienda en un evento: «yo compro al 80 %… viene un chico con una carta
-- que vale 100… me está dando 80 y luego me tiene que dar 20 en cash». PINGU
-- eligió lo recomendado: un tanto por ciento propio para cambios, tu carta a
-- tu precio, lo recibido a «Por poner a la venta» y una venta y una compra
-- enlazadas.
--
--   1. `tienda_cambios`: un cambio (lo entregado, lo recibido, la diferencia
--      con su forma de pago y a quién), con los tickets de su venta y su
--      compra. Solo la ve su tienda; escribe la función.
--   2. «cambio» es una forma de pago más en ventas y compras: lo que se pagó
--      EN CARTAS. No se elige a mano (no está en PAGOS_VENTA/PAGOS_COMPRA de
--      la web); solo lo pone `tienda_cambio`.
--   3. `tienda_cambio(te_da, le_das, pago, cliente, donde, pct)`: todo o
--      nada. Vende lo que das (`tienda_vender`) y compra lo que te dan
--      (`tienda_comprar`: entra por poner a la venta), marca las dos con
--      «cambio» y apunta la diferencia: positiva, te paga (un pago de venta);
--      negativa, le pagas (uno de compra); cero, ninguno.
--   4. `tienda_deshacer_cambio(id o ticket)`: las dos mitades a la vez.
--      Deshacer solo la venta o solo la compra de un cambio ya no se puede.
--   5. Las listas de Ventas y Compras traen `pago` (para la chapa «Cambio»).
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1072, la 1091, la 1254 y la 1255.
-- ============================================================

begin;

-- ── 1. Los cambios ──
create table if not exists public.tienda_cambios (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  venta_ticket uuid not null,
  compra_ticket uuid not null,
  -- Lo que vale lo que das (lo vendido) y lo que cuenta lo que te dan.
  entregado numeric(10, 2) not null,
  recibido numeric(10, 2) not null,
  -- entregado − recibido: positiva, te paga; negativa, le pagas.
  diferencia numeric(10, 2) not null,
  pago text,
  -- El tanto por ciento con el que se tasó (orientativo; cada línea lleva lo suyo).
  pct int,
  cliente text,
  hecho_el timestamptz not null default now(),
  constraint tienda_cambios_dinero check (entregado >= 0 and recibido >= 0),
  constraint tienda_cambios_pago check (
    (diferencia = 0 and pago is null)
    or (diferencia > 0 and pago in ('efectivo', 'tarjeta', 'bizum', 'paypal'))
    or (diferencia < 0 and pago in ('efectivo', 'bizum', 'paypal', 'otro'))
  ),
  constraint tienda_cambios_pct check (pct is null or pct between 0 and 200),
  constraint tienda_cambios_cliente check (cliente is null or char_length(cliente) between 1 and 80)
);
create index if not exists tienda_cambios_tienda_idx on public.tienda_cambios (tienda_id, hecho_el desc);
create unique index if not exists tienda_cambios_venta_idx on public.tienda_cambios (venta_ticket);
create unique index if not exists tienda_cambios_compra_idx on public.tienda_cambios (compra_ticket);

alter table public.tienda_cambios enable row level security;
drop policy if exists tienda_cambios_suyos on public.tienda_cambios;
create policy tienda_cambios_suyos on public.tienda_cambios for select to authenticated
  using (tienda_id = auth.uid());
grant select on public.tienda_cambios to authenticated;

-- ── 2. «cambio» como forma de pago ──
alter table public.tienda_ventas drop constraint if exists tienda_ventas_pago;
alter table public.tienda_ventas add constraint tienda_ventas_pago
  check (pago is null or pago in ('efectivo', 'tarjeta', 'bizum', 'paypal', 'cambio'));
alter table public.tienda_compras drop constraint if exists tienda_compras_pago;
alter table public.tienda_compras add constraint tienda_compras_pago
  check (pago is null or pago in ('efectivo', 'bizum', 'paypal', 'otro', 'cambio'));

-- ── 3. Hacer un cambio ──
-- `p_te_da`: las líneas de `tienda_comprar` («coste» es lo que CUENTA, por
-- unidad). `p_le_das`: las de `tienda_vender` («precio» es a lo que la dejas).
create or replace function public.tienda_cambio(
  p_te_da jsonb,
  p_le_das jsonb,
  p_pago text default null,
  p_cliente text default null,
  p_donde text default 'mostrador',
  p_pct int default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pago text := nullif(btrim(coalesce(p_pago, '')), '');
  v_venta jsonb;
  v_compra jsonb;
  v_entregado numeric;
  v_recibido numeric;
  v_dif numeric;
  v_id uuid;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda hace cambios.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_te_da) <> 'array' or jsonb_array_length(p_te_da) = 0 then
    raise exception 'Falta lo que te da: sin eso es una venta.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_le_das) <> 'array' or jsonb_array_length(p_le_das) = 0 then
    raise exception 'Falta lo que le das: sin eso es una compra.' using errcode = '22023';
  end if;
  if p_pct is not null and (p_pct < 0 or p_pct > 200) then
    raise exception 'Revisa el tanto por ciento.' using errcode = '22023';
  end if;

  -- Las dos mitades, con sus comprobaciones de siempre (stock, catálogo,
  -- precios): si una falla, no se hace nada.
  v_venta := public.tienda_vender(p_le_das, coalesce(p_donde, 'mostrador'), null);
  v_compra := public.tienda_comprar(p_te_da, p_cliente, null);
  v_entregado := round((v_venta->>'total')::numeric, 2);
  v_recibido := round((v_compra->>'total')::numeric, 2);
  v_dif := v_entregado - v_recibido;

  if v_dif = 0 then
    v_pago := null;
  elsif v_pago is null then
    raise exception 'Falta cómo se paga la diferencia.' using errcode = '22023';
  elsif v_dif > 0 and v_pago not in ('efectivo', 'tarjeta', 'bizum', 'paypal') then
    raise exception 'Esa forma de pago no existe para lo que te paga.' using errcode = '22023';
  elsif v_dif < 0 and v_pago not in ('efectivo', 'bizum', 'paypal', 'otro') then
    raise exception 'Esa forma de pago no existe para lo que le pagas.' using errcode = '22023';
  end if;

  update tienda_ventas set pago = 'cambio' where ticket = (v_venta->>'ticket')::uuid and tienda_id = v_uid;
  update tienda_compras set pago = 'cambio' where ticket = (v_compra->>'ticket')::uuid and tienda_id = v_uid;
  insert into tienda_cambios (tienda_id, venta_ticket, compra_ticket, entregado, recibido, diferencia, pago, pct, cliente)
  values (v_uid, (v_venta->>'ticket')::uuid, (v_compra->>'ticket')::uuid, v_entregado, v_recibido, v_dif, v_pago, p_pct,
    nullif(btrim(coalesce(p_cliente, '')), ''))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'venta_ticket', v_venta->'ticket', 'compra_ticket', v_compra->'ticket',
    'entregado', v_entregado, 'recibido', v_recibido, 'diferencia', v_dif, 'pago', v_pago,
    'unidades_dadas', (select coalesce(sum((l->>'unidades')::int), 0) from jsonb_array_elements(p_le_das) l),
    'unidades_recibidas', (v_compra->>'unidades')::int);
end;
$$;

-- ── 4. Deshacer ──
-- Por el id del cambio o por el ticket de cualquiera de sus mitades (lo que
-- tiene a mano la lista de Ventas o de Compras). La compra primero: si ya se
-- vendió algo de lo recibido, no deja (y no se toca nada).
create or replace function public.tienda_deshacer_cambio(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_c tienda_cambios%rowtype;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda hace cambios.' using errcode = '42501';
  end if;
  select * into v_c from tienda_cambios
    where tienda_id = v_uid and (id = p_id or venta_ticket = p_id or compra_ticket = p_id)
    for update;
  if not found then
    raise exception 'Ese cambio no existe o ya se deshizo.' using errcode = 'P0002';
  end if;
  -- Fuera la fila antes: las de deshacer venta y compra no dejan tocar un
  -- ticket que esté en un cambio.
  delete from tienda_cambios where id = v_c.id;
  perform public.tienda_deshacer_compra(v_c.compra_ticket);
  perform public.tienda_deshacer_venta(v_c.venta_ticket);
  return jsonb_build_object('id', v_c.id, 'diferencia', v_c.diferencia, 'pago', v_c.pago);
end;
$$;

-- Las de la 1072 y la 1091, iguales salvo la primera comprobación: medio
-- cambio no se deshace solo.
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
  if exists (select 1 from tienda_cambios where venta_ticket = p_ticket and tienda_id = v_uid) then
    raise exception 'Esta venta es parte de un cambio: deshaz el cambio entero.' using errcode = 'P0001';
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
  if exists (select 1 from tienda_cambios where compra_ticket = p_ticket and tienda_id = v_uid) then
    raise exception 'Esta compra es parte de un cambio: deshaz el cambio entero.' using errcode = 'P0001';
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

-- ── 5. Las listas, con la forma de pago (la de la 1072 y la 1091, iguales
-- salvo `pago` en cada fila) ──
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
      'unidades', unidades, 'precio', precio, 'coste', coste, 'donde', donde, 'pago', pago, 'vendida_el', vendida_el
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 100), 1), 5000)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

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
      'unidades', unidades, 'coste', coste, 'cm', cm, 'cliente', cliente, 'pago', pago, 'comprada_el', comprada_el
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 100), 1), 5000)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

revoke all on function public.tienda_cambio(jsonb, jsonb, text, text, text, int) from public, anon;
grant execute on function public.tienda_cambio(jsonb, jsonb, text, text, text, int) to authenticated;
revoke all on function public.tienda_deshacer_cambio(uuid) from public, anon;
grant execute on function public.tienda_deshacer_cambio(uuid) to authenticated;
revoke all on function public.tienda_deshacer_venta(uuid) from public, anon;
grant execute on function public.tienda_deshacer_venta(uuid) to authenticated;
revoke all on function public.tienda_deshacer_compra(uuid) from public, anon;
grant execute on function public.tienda_deshacer_compra(uuid) to authenticated;
revoke all on function public.tienda_ventas_lista(jsonb, int, int) from public, anon;
grant execute on function public.tienda_ventas_lista(jsonb, int, int) to authenticated;
revoke all on function public.tienda_compras_lista(jsonb, int, int) from public, anon;
grant execute on function public.tienda_compras_lista(jsonb, int, int) to authenticated;

commit;

notify pgrst, 'reload schema';
