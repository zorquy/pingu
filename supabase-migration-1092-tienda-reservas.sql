-- ============================================================
-- Tanda 1092: «Apártamela».
--
-- Cuando alguien escribe «me la guardas hasta el sábado», la carta seguía a
-- la vista y se podía vender dos veces. Ahora la tienda APARTA unidades para
-- alguien hasta un día. PINGU lo eligió de «Tiendas, la tercera vuelta»
-- (punto 2), con lo recomendado: aparta solo la tienda (desde su stock o
-- desde un «Me interesa» del chat); la gente lo pide por mensaje.
--
-- Apartar SACA las unidades del stock mientras dure: así el escaparate, «En
-- tiendas», el Mercado, Vender y las cuentas del Panel las dejan de ofrecer
-- sin tocar ninguna de esas funciones. Al recogerlas se apunta la venta; al
-- quitarlas o al caducar, vuelven a su línea.
--
--   1. `tienda_reservas`: qué línea, cuántas, para quién, hasta cuándo y a
--      qué precio quedó. Solo la ve su tienda; escriben las funciones.
--   2. `tienda_apartar(…)`: aparta (saca las unidades) o dice por qué no.
--   3. `tienda_reserva_quitar(id)`: deshace el apartado (vuelven al stock).
--   4. `tienda_reserva_recoger(id, precio, dónde)`: la venta, con el coste de
--      la línea; se deshace como cualquier venta (vuelven al stock).
--   5. `tienda_reservas_al_dia(tienda)`: las caducadas vuelven a su línea.
--      La llaman el panel de la tienda y su escaparate al abrirse: sin una
--      pasada programada, caducan cuando alguien mira, que es cuando importa.
--   6. `tienda_reservas_lista()`: las de la tienda, con el nombre de la carta.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1067, la 1068, la 1072 y la 1079 (`tienda_precio_de`).
-- ============================================================

-- ── 1. Lo apartado ──
create table if not exists public.tienda_reservas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  stock_id uuid not null references public.tienda_stock (id) on delete cascade,
  unidades int not null,
  -- El precio al que quedó (el de la línea al apartarla, o el que se pactó).
  precio numeric(10, 2),
  -- Para quién: lo que escribe la tienda (un nombre, un @) y, si es de
  -- PokeDoc, su cuenta (desde el chat).
  para text not null,
  para_usuario uuid references auth.users (id) on delete set null,
  nota text,
  hasta timestamptz not null,
  created_at timestamptz not null default now(),
  constraint tienda_reservas_unidades check (unidades between 1 and 99999),
  constraint tienda_reservas_precio check (precio is null or precio >= 0),
  constraint tienda_reservas_textos check (char_length(para) between 1 and 80 and (nota is null or char_length(nota) <= 200))
);

create index if not exists tienda_reservas_tienda_idx on public.tienda_reservas (tienda_id, hasta);
create index if not exists tienda_reservas_stock_idx on public.tienda_reservas (stock_id);

alter table public.tienda_reservas enable row level security;
drop policy if exists tienda_reservas_suyas on public.tienda_reservas;
create policy tienda_reservas_suyas on public.tienda_reservas for select to authenticated
  using (tienda_id = auth.uid() and public.soy_tienda());
grant select on public.tienda_reservas to authenticated;

-- ── 2. Apartar ──
create or replace function public.tienda_apartar(
  p_stock uuid,
  p_unidades int,
  p_para text,
  p_hasta timestamptz,
  p_precio numeric default null,
  p_nota text default null,
  p_para_usuario uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_stock tienda_stock%rowtype;
  v_para text := nullif(btrim(coalesce(p_para, '')), '');
  v_id uuid;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda aparta.' using errcode = '42501';
  end if;
  if v_para is null then
    raise exception 'Di para quién es.' using errcode = '22023';
  end if;
  if p_unidades is null or p_unidades < 1 then
    raise exception 'Aparta al menos una.' using errcode = '22023';
  end if;
  if p_hasta is null or p_hasta <= now() then
    raise exception 'El día tiene que ser de aquí en adelante.' using errcode = '22023';
  end if;
  if p_hasta > now() + interval '60 days' then
    raise exception 'Como mucho, dos meses.' using errcode = '22023';
  end if;
  if p_precio is not null and p_precio < 0 then
    raise exception 'Revisa el precio.' using errcode = '22023';
  end if;
  -- Bloqueada: dos apartados (o un apartado y una venta) de la última copia.
  select * into v_stock from tienda_stock where id = p_stock and tienda_id = v_uid for update;
  if not found then
    raise exception 'Esa carta ya no está en tu stock.' using errcode = 'P0002';
  end if;
  if v_stock.unidades < p_unidades then
    raise exception 'No quedan tantas: hay %.', v_stock.unidades using errcode = '22023';
  end if;
  update tienda_stock set unidades = unidades - p_unidades, updated_at = now() where id = v_stock.id;
  insert into tienda_reservas (tienda_id, stock_id, unidades, precio, para, para_usuario, nota, hasta)
  values (v_uid, v_stock.id, p_unidades,
    round(coalesce(p_precio, public.tienda_precio_de(v_stock.precio, v_stock.oferta_precio, v_stock.oferta_hasta)), 2),
    left(v_para, 80), p_para_usuario, nullif(left(btrim(coalesce(p_nota, '')), 200), ''), p_hasta)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'quedan', v_stock.unidades - p_unidades);
end;
$$;

-- ── 3. Quitar ──
create or replace function public.tienda_reserva_quitar(p_reserva uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_r tienda_reservas%rowtype;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda aparta.' using errcode = '42501';
  end if;
  select * into v_r from tienda_reservas where id = p_reserva and tienda_id = v_uid for update;
  if not found then
    raise exception 'Eso ya no está apartado.' using errcode = 'P0002';
  end if;
  update tienda_stock set unidades = unidades + v_r.unidades, updated_at = now() where id = v_r.stock_id and tienda_id = v_uid;
  delete from tienda_reservas where id = v_r.id;
  return jsonb_build_object('devueltas', v_r.unidades);
end;
$$;

-- ── 4. Recoger: la venta ──
create or replace function public.tienda_reserva_recoger(p_reserva uuid, p_precio numeric default null, p_donde text default 'mostrador')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_r tienda_reservas%rowtype;
  v_stock tienda_stock%rowtype;
  v_ticket uuid := gen_random_uuid();
  v_precio numeric;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda vende.' using errcode = '42501';
  end if;
  if coalesce(p_donde, '') not in ('mostrador', 'cardmarket', 'evento', 'otro') then
    raise exception 'Ese sitio de venta no existe.' using errcode = '22023';
  end if;
  select * into v_r from tienda_reservas where id = p_reserva and tienda_id = v_uid for update;
  if not found then
    raise exception 'Eso ya no está apartado.' using errcode = 'P0002';
  end if;
  select * into v_stock from tienda_stock where id = v_r.stock_id;
  v_precio := round(coalesce(p_precio, v_r.precio), 2);
  if v_precio is null or v_precio < 0 then
    raise exception 'Pon el precio al que la vendes.' using errcode = '22023';
  end if;
  -- Las unidades ya salieron del stock al apartarla: solo se apunta la venta.
  insert into tienda_ventas (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, precio, coste, donde)
  values (v_uid, v_ticket, v_stock.id, v_stock.card_id, v_stock.market, v_stock.product_id, v_stock.idioma, v_stock.estado, v_stock.variante, v_stock.gradeo,
    v_r.unidades, v_precio, v_stock.coste, p_donde);
  delete from tienda_reservas where id = v_r.id;
  return jsonb_build_object('ticket', v_ticket, 'lineas', 1, 'total', v_precio * v_r.unidades,
    'beneficio', case when v_stock.coste is null then 0 else (v_precio - v_stock.coste) * v_r.unidades end,
    'sin_coste', case when v_stock.coste is null then 1 else 0 end);
end;
$$;

-- ── 5. Las caducadas vuelven ──
-- Cualquiera puede llamarla (la llama el escaparate al abrirse): solo toca lo
-- que ya caducó, que es lo que tiene que pasar de todas formas.
create or replace function public.tienda_reservas_al_dia(p_tienda uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tienda uuid := coalesce(p_tienda, auth.uid());
  v_n int := 0;
  v_r record;
begin
  if v_tienda is null then
    return 0;
  end if;
  for v_r in select * from tienda_reservas where tienda_id = v_tienda and hasta <= now() for update skip locked loop
    update tienda_stock set unidades = unidades + v_r.unidades, updated_at = now() where id = v_r.stock_id;
    delete from tienda_reservas where id = v_r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- ── 6. La lista ──
create or replace function public.tienda_reservas_lista()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda aparta.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'stock_id', r.stock_id, 'unidades', r.unidades, 'precio', r.precio,
      'para', r.para, 'para_usuario', r.para_usuario, 'para_username', u.username, 'nota', r.nota, 'hasta', r.hasta,
      'card_id', s.card_id, 'market', s.market, 'product_id', s.product_id, 'idioma', s.idioma, 'estado', s.estado,
      'variante', s.variante, 'gradeo', s.gradeo, 'coste', s.coste,
      'nombre', coalesce(c.name_es, c.name, p.name), 'set_id', c.set_id, 'numero', c.local_id
    ) order by r.hasta, r.created_at), '[]'::jsonb)
    from tienda_reservas r
    join tienda_stock s on s.id = r.stock_id
    left join user_profiles u on u.id = r.para_usuario
    left join tcg_cards c on c.id = s.card_id and c.market = s.market
    left join tcg_products p on p.id = s.product_id
    where r.tienda_id = v_uid
  );
end;
$$;

revoke all on function public.tienda_apartar(uuid, int, text, timestamptz, numeric, text, uuid) from public;
revoke all on function public.tienda_reserva_quitar(uuid) from public;
revoke all on function public.tienda_reserva_recoger(uuid, numeric, text) from public;
revoke all on function public.tienda_reservas_al_dia(uuid) from public;
revoke all on function public.tienda_reservas_lista() from public;
grant execute on function public.tienda_apartar(uuid, int, text, timestamptz, numeric, text, uuid) to authenticated;
grant execute on function public.tienda_reserva_quitar(uuid) to authenticated;
grant execute on function public.tienda_reserva_recoger(uuid, numeric, text) to authenticated;
grant execute on function public.tienda_reservas_al_dia(uuid) to anon, authenticated;
grant execute on function public.tienda_reservas_lista() to authenticated;

notify pgrst, 'reload schema';
