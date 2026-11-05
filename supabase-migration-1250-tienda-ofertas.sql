-- ============================================================
-- Tanda 1250 — COMPRARLE A UNA TIENDA: pedir, ofrecer, contraofertar
-- ============================================================
-- PINGU: «un sistema como el de las propuestas, pero para las tiendas… te
-- tiene que salir el precio de esa carta que ha puesto la tienda y para
-- editarlo por si tú quieres lanzar una oferta… y la tienda aceptar esa
-- propuesta o hacerle la contraoferta, como se hace en Vinted». Y eligió lo
-- recomendado: aceptar RESERVA la carta (7 días), una oferta sin respuesta
-- caduca a las 48 h, la tienda puede poner un mínimo, el envío es la tabla de
-- los cambios (1108) y se paga por Bizum, PayPal o en efectivo (en mano).
--
--   1. `tienda_cobros`: cómo cobra cada tienda (qué acepta, su Bizum y su
--      PayPal, y el mínimo de las ofertas en % de su precio). PRIVADA: `tiendas`
--      la lee cualquiera, así que el Bizum no puede ir ahí. Lo de fuera se
--      pregunta por `tienda_condiciones` (sin el número ni la cuenta).
--   2. `tienda_ofertas`: una por persona y copia mientras esté viva. Lleva lo
--      que es (para pintarla aunque la línea se borre), el precio que está
--      sobre la mesa, de quién es el turno, los pasos, el envío y el pago, y
--      su reserva al aceptarse. La ven sus dos; escriben las funciones.
--   3. `tienda_oferta_enviar`: pedir (al precio de la tienda) u ofrecer menos.
--      Si ya hay una viva de esa persona en esa copia, es un paso más.
--   4. `tienda_oferta_responder`: aceptar, rechazar o contraofertar (a quien
--      le toque) y retirar (quien compra). Aceptar saca las unidades del
--      stock a una reserva de 7 días a nombre de quien compra.
--   5. `tienda_oferta_paso`: la tienda marca pagado, hecho (entregada o
--      enviada, con seguimiento: es la VENTA, con el coste de ese momento y
--      «PokeDoc» de dónde), alarga la reserva o la cancela.
--   6. `tienda_ofertas_al_dia`: las que caducan (48 h sin respuesta, o la
--      reserva que venció). La llaman el panel, el escaparate y la tarjeta.
--   7. `tienda_oferta_ver`, `tienda_ofertas_lista`, `tienda_cobros_mios`,
--      `tienda_cobros_poner`, `tienda_condiciones`.
--
-- Cada paso deja una línea en la conversación con un adjunto
-- `{ tipo: 'oferta_tienda', oferta, evento }` (la tarjeta de la web) y un
-- aviso `tienda_oferta`. Ventas: `donde` admite 'pokedoc'.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1067, 1068, 1072, 1079 (`tienda_precio_de`), 1092 (reservas),
-- 1108 (`cambio_envio_tarifa`), 942 (`cambio_conversacion`), 891 (`adjuntos`)
-- y 1245 (`tienda_publica`).
-- ============================================================

begin;

-- ── 1. Cómo cobra cada tienda ──
create table if not exists public.tienda_cobros (
  tienda_id uuid primary key references auth.users (id) on delete cascade,
  pagos text[] not null default array['bizum', 'paypal', 'efectivo'],
  bizum text,
  paypal text,
  -- En % del precio de la tienda: por debajo, no se puede ofrecer. Sin él, todo.
  minimo int,
  updated_at timestamptz not null default now(),
  constraint tienda_cobros_pagos check (pagos <@ array['bizum', 'paypal', 'efectivo'] and cardinality(pagos) >= 1),
  constraint tienda_cobros_minimo check (minimo is null or minimo between 1 and 100),
  constraint tienda_cobros_textos check ((bizum is null or char_length(bizum) <= 40) and (paypal is null or char_length(paypal) <= 120))
);
alter table public.tienda_cobros enable row level security;
-- Sin políticas: la leen y la escriben las funciones de abajo.

-- ── 2. Una venta por PokeDoc dice de dónde vino ──
alter table public.tienda_ventas drop constraint if exists tienda_ventas_donde;
alter table public.tienda_ventas add constraint tienda_ventas_donde check (donde in ('mostrador', 'cardmarket', 'evento', 'otro', 'pokedoc'));

-- ── 3. Las ofertas ──
create table if not exists public.tienda_ofertas (
  id uuid primary key default gen_random_uuid(),
  tienda_id uuid not null references auth.users (id) on delete cascade,
  comprador_id uuid not null references auth.users (id) on delete cascade,
  stock_id uuid references public.tienda_stock (id) on delete set null,
  -- Lo que es, copiado: si la línea se borra, la oferta se sigue entendiendo.
  card_id text,
  market text,
  product_id bigint,
  idioma text,
  estado_carta text,
  variante text,
  gradeo text,
  unidades int not null default 1,
  -- Por unidad. `precio_tienda`: el que pedía la tienda al empezar.
  precio_tienda numeric(10, 2),
  precio numeric(10, 2) not null,
  -- A quién le toca contestar mientras esté abierta.
  turno text not null default 'tienda',
  pasos jsonb not null default '[]'::jsonb,
  estado text not null default 'abierta',
  envio text not null default 'mano',
  envio_tipo text,
  envio_precio numeric(10, 2) not null default 0,
  pago text not null,
  reserva_id uuid references public.tienda_reservas (id) on delete set null,
  reservada_hasta timestamptz,
  ticket uuid,
  seguimiento text,
  caduca_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tienda_ofertas_turno check (turno in ('tienda', 'comprador')),
  constraint tienda_ofertas_estado check (estado in ('abierta', 'aceptada', 'pagada', 'hecha', 'rechazada', 'retirada', 'caducada', 'cancelada')),
  constraint tienda_ofertas_envio check (envio in ('mano', 'correo')),
  constraint tienda_ofertas_pago check (pago in ('bizum', 'paypal', 'efectivo')),
  constraint tienda_ofertas_efectivo check (pago <> 'efectivo' or envio = 'mano'),
  constraint tienda_ofertas_unidades check (unidades between 1 and 99),
  constraint tienda_ofertas_precio check (precio > 0),
  constraint tienda_ofertas_seguimiento check (seguimiento is null or char_length(seguimiento) <= 80)
);
create index if not exists tienda_ofertas_tienda_idx on public.tienda_ofertas (tienda_id, estado, updated_at desc);
create index if not exists tienda_ofertas_comprador_idx on public.tienda_ofertas (comprador_id, updated_at desc);
-- Una viva por persona y copia: ofrecer otra vez es un paso de la misma.
create unique index if not exists tienda_ofertas_una_viva on public.tienda_ofertas (comprador_id, stock_id) where estado = 'abierta';

alter table public.tienda_ofertas enable row level security;
drop policy if exists tienda_ofertas_las_suyas on public.tienda_ofertas;
create policy tienda_ofertas_las_suyas on public.tienda_ofertas for select to authenticated
  using (tienda_id = auth.uid() or comprador_id = auth.uid());
grant select on public.tienda_ofertas to authenticated;

-- ── Lo que se ve de fuera: qué acepta y el mínimo (ni el Bizum ni el PayPal) ──
create or replace function public.tienda_condiciones(p_tienda uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'pagos', coalesce((select to_jsonb(c.pagos) from tienda_cobros c where c.tienda_id = p_tienda), '["bizum","paypal","efectivo"]'::jsonb),
    'minimo', (select c.minimo from tienda_cobros c where c.tienda_id = p_tienda)
  )
$$;

create or replace function public.tienda_cobros_mios()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('pagos', to_jsonb(c.pagos), 'bizum', c.bizum, 'paypal', c.paypal, 'minimo', c.minimo) from tienda_cobros c where c.tienda_id = auth.uid()),
    jsonb_build_object('pagos', '["bizum","paypal","efectivo"]'::jsonb, 'bizum', null, 'paypal', null, 'minimo', null))
$$;

create or replace function public.tienda_cobros_poner(p_pagos text[], p_bizum text, p_paypal text, p_minimo int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  -- En el orden en que vienen, sin repetir y sin lo que no existe.
  v_pagos text[] := array(select u.x from unnest(coalesce(p_pagos, '{}')) with ordinality u(x, i) where u.x in ('bizum', 'paypal', 'efectivo') group by u.x order by min(u.i));
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  if cardinality(v_pagos) = 0 then
    raise exception 'Elige al menos una forma de cobrar.' using errcode = '22023';
  end if;
  if p_minimo is not null and (p_minimo < 1 or p_minimo > 100) then
    raise exception 'El mínimo va del 1 al 100 %%.' using errcode = '22023';
  end if;
  insert into tienda_cobros (tienda_id, pagos, bizum, paypal, minimo, updated_at)
  values (v_uid, v_pagos, nullif(left(btrim(coalesce(p_bizum, '')), 40), ''), nullif(left(btrim(coalesce(p_paypal, '')), 120), ''), p_minimo, now())
  on conflict (tienda_id) do update set pagos = excluded.pagos, bizum = excluded.bizum, paypal = excluded.paypal, minimo = excluded.minimo, updated_at = now();
  return public.tienda_cobros_mios();
end;
$$;

-- ── El paso en la conversación y el aviso ──
create or replace function public.tienda_oferta_avisar(p_oferta uuid, p_de uuid, p_para uuid, p_evento text, p_titulo text, p_texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv uuid := public.cambio_conversacion(p_de, p_para);
  v_es_tienda boolean := exists (select 1 from tienda_ofertas where id = p_oferta and tienda_id = p_para);
begin
  insert into private_messages (conversation_id, sender_id, body, adjuntos)
  values (v_conv, p_de, p_texto, jsonb_build_array(jsonb_build_object('tipo', 'oferta_tienda', 'oferta', p_oferta, 'evento', p_evento)));
  -- A la tienda, a su pestaña de Ofertas; a quien compra, a la conversación.
  insert into user_notifications (recipient_id, type, title, body, link)
  values (p_para, 'tienda_oferta', p_titulo, p_texto,
    case when v_es_tienda then '/tienda?ver=ofertas#oferta-' || p_oferta else '/mensajes.html?c=' || v_conv end);
end;
$$;

-- Un paso más en la historia: quién, qué y a cuánto.
create or replace function public.tienda_oferta_con_paso(p_pasos jsonb, p_quien text, p_que text, p_precio numeric)
returns jsonb
language sql
immutable
as $$
  select coalesce(p_pasos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('quien', p_quien, 'que', p_que, 'precio', p_precio, 'at', now()))
$$;

-- ── 6. Lo que caduca ──
-- Abiertas sin respuesta en 48 h, y aceptadas cuya reserva ya no está (la
-- quitó `tienda_reservas_al_dia` al vencer, o la quitaron a mano).
create or replace function public.tienda_ofertas_al_dia(p_tienda uuid default null)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tienda uuid := coalesce(p_tienda, auth.uid());
  v_n int := 0;
  v_m int := 0;
begin
  if v_tienda is null then
    return 0;
  end if;
  perform public.tienda_reservas_al_dia(v_tienda);
  update tienda_ofertas set estado = 'caducada', updated_at = now(),
    pasos = public.tienda_oferta_con_paso(pasos, 'nadie', 'caducada', precio)
  where tienda_id = v_tienda and estado = 'abierta' and caduca_at <= now();
  get diagnostics v_n = row_count;
  update tienda_ofertas set estado = 'caducada', updated_at = now(),
    pasos = public.tienda_oferta_con_paso(pasos, 'nadie', 'reserva_vencida', precio)
  where tienda_id = v_tienda and estado in ('aceptada', 'pagada') and reserva_id is null;
  get diagnostics v_m = row_count;
  return v_n + v_m;
end;
$$;

-- ── 3. Pedir u ofrecer ──
create or replace function public.tienda_oferta_enviar(p_stock uuid, p_precio numeric, p_envio text, p_pago text, p_unidades int default 1)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_s tienda_stock%rowtype;
  v_pide numeric;
  v_cond jsonb;
  v_minimo int;
  v_precio numeric := round(p_precio, 2);
  v_n int := coalesce(p_unidades, 1);
  v_envio text := coalesce(p_envio, 'mano');
  v_tipo text;
  v_coste_envio numeric := 0;
  v_o tienda_ofertas%rowtype;
  v_yo text;
  v_que text;
  v_nueva boolean := false;
begin
  if v_uid is null then
    raise exception 'Entra con tu cuenta para comprar.' using errcode = '42501';
  end if;
  if soy_tienda() then
    raise exception 'Una cuenta de tienda no compra a otras tiendas.' using errcode = '42501';
  end if;
  select * into v_s from tienda_stock where id = p_stock;
  if not found or not v_s.visible or v_s.tienda_id = v_uid or not public.tienda_publica(v_s.tienda_id) then
    raise exception 'Esa carta ya no está en la tienda.' using errcode = 'P0002';
  end if;
  if v_n < 1 or v_n > v_s.unidades then
    raise exception 'No quedan tantas: tiene %.', v_s.unidades using errcode = '22023';
  end if;
  if v_precio is null or v_precio <= 0 then
    raise exception 'Pon cuánto ofreces.' using errcode = '22023';
  end if;
  if v_envio not in ('mano', 'correo') then
    raise exception 'Elige en mano o por correo.' using errcode = '22023';
  end if;
  v_cond := public.tienda_condiciones(v_s.tienda_id);
  if p_pago is null or not (v_cond->'pagos') ? p_pago then
    raise exception 'Esta tienda no cobra así.' using errcode = '22023';
  end if;
  if p_pago = 'efectivo' and v_envio <> 'mano' then
    raise exception 'En efectivo, solo en mano.' using errcode = '22023';
  end if;
  v_pide := public.tienda_precio_de(v_s.precio, v_s.oferta_precio, v_s.oferta_hasta);
  -- Nunca más de lo que pide: «Pedir» es a su precio.
  if v_pide is not null and v_precio > v_pide then
    v_precio := v_pide;
  end if;
  v_minimo := nullif(v_cond->>'minimo', '')::int;
  if v_pide is not null and v_minimo is not null and v_precio < round(v_pide * v_minimo / 100.0, 2) then
    raise exception 'Esta tienda no mira ofertas por debajo de % €.', to_char(round(v_pide * v_minimo / 100.0, 2), 'FM999990.00') using errcode = '22023';
  end if;
  if v_envio = 'correo' then
    select t.tipo, t.precio into v_tipo, v_coste_envio from public.cambio_envio_tarifa(v_precio * v_n, v_n) t;
  end if;
  v_que := case when v_pide is not null and v_precio >= v_pide then 'pide' else 'ofrece' end;

  select * into v_o from tienda_ofertas where comprador_id = v_uid and stock_id = v_s.id and estado = 'abierta' for update;
  if found then
    update tienda_ofertas set precio = v_precio, unidades = v_n, envio = v_envio, envio_tipo = v_tipo, envio_precio = coalesce(v_coste_envio, 0), pago = p_pago,
      turno = 'tienda', caduca_at = now() + interval '48 hours', updated_at = now(),
      pasos = public.tienda_oferta_con_paso(pasos, 'comprador', v_que, v_precio)
    where id = v_o.id returning * into v_o;
  else
    v_nueva := true;
    insert into tienda_ofertas (tienda_id, comprador_id, stock_id, card_id, market, product_id, idioma, estado_carta, variante, gradeo, unidades,
      precio_tienda, precio, turno, pasos, envio, envio_tipo, envio_precio, pago, caduca_at)
    values (v_s.tienda_id, v_uid, v_s.id, v_s.card_id, v_s.market, v_s.product_id, v_s.idioma, v_s.estado, v_s.variante, v_s.gradeo, v_n,
      v_pide, v_precio, 'tienda', public.tienda_oferta_con_paso('[]'::jsonb, 'comprador', v_que, v_precio), v_envio, v_tipo, coalesce(v_coste_envio, 0), p_pago,
      now() + interval '48 hours')
    returning * into v_o;
  end if;
  select coalesce(display_name, username, 'Alguien') into v_yo from user_profiles where id = v_uid;
  perform public.tienda_oferta_avisar(v_o.id, v_uid, v_s.tienda_id, case when v_nueva then 'oferta_nueva' else 'oferta_otra' end,
    case when v_que = 'pide' then 'Te quieren comprar una carta' else 'Te han hecho una oferta' end,
    case when v_que = 'pide' then 'Te la compro a tu precio: ' else 'Te ofrezco ' end || to_char(v_precio, 'FM999990.00') || ' €' || case when v_n > 1 then ' cada una (' || v_n || ')' else '' end || '.');
  return jsonb_build_object('id', v_o.id, 'precio', v_o.precio, 'que', v_que, 'envio_precio', v_o.envio_precio);
end;
$$;

-- ── 4. Contestar ──
create or replace function public.tienda_oferta_responder(p_oferta uuid, p_accion text, p_precio numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_o tienda_ofertas%rowtype;
  v_s tienda_stock%rowtype;
  v_soy text;
  v_otro uuid;
  v_precio numeric := round(p_precio, 2);
  v_para text;
  v_reserva uuid;
  v_texto text;
  v_titulo text;
  v_evento text;
  v_tipo text;
  v_envio numeric;
begin
  if v_uid is null then
    raise exception 'Entra con tu cuenta.' using errcode = '42501';
  end if;
  select * into v_o from tienda_ofertas where id = p_oferta and (tienda_id = v_uid or comprador_id = v_uid) for update;
  if not found then
    raise exception 'Esa oferta no existe.' using errcode = 'P0002';
  end if;
  v_soy := case when v_o.tienda_id = v_uid then 'tienda' else 'comprador' end;
  v_otro := case when v_soy = 'tienda' then v_o.comprador_id else v_o.tienda_id end;
  -- (Lo caducado lo apunta `tienda_ofertas_al_dia`: aquí un `update` antes
  -- del `raise` se desharía con él.)
  if v_o.estado = 'abierta' and v_o.caduca_at <= now() then
    raise exception 'Esa oferta ha caducado: pasaron 48 horas sin respuesta.' using errcode = '22023';
  end if;
  if v_o.estado <> 'abierta' then
    raise exception 'Esa oferta ya no está abierta.' using errcode = '22023';
  end if;

  if p_accion = 'retirar' then
    if v_soy <> 'comprador' then
      raise exception 'Solo quien ofrece la retira.' using errcode = '42501';
    end if;
    update tienda_ofertas set estado = 'retirada', updated_at = now(), pasos = public.tienda_oferta_con_paso(pasos, v_soy, 'retira', precio) where id = v_o.id returning * into v_o;
    perform public.tienda_oferta_avisar(v_o.id, v_uid, v_otro, 'oferta_retirada', 'Han retirado una oferta', 'He retirado mi oferta.');
    return to_jsonb(v_o);
  end if;

  if v_o.turno <> v_soy then
    raise exception 'Ahora le toca contestar a la otra parte.' using errcode = '22023';
  end if;

  if p_accion = 'rechazar' then
    update tienda_ofertas set estado = 'rechazada', updated_at = now(), pasos = public.tienda_oferta_con_paso(pasos, v_soy, 'rechaza', precio) where id = v_o.id returning * into v_o;
    v_evento := 'oferta_rechazada'; v_titulo := 'Oferta rechazada'; v_texto := 'No me cuadra esta oferta.';
  elsif p_accion = 'contraoferta' then
    if v_precio is null or v_precio <= 0 then
      raise exception 'Pon tu precio.' using errcode = '22023';
    end if;
    if v_precio = v_o.precio then
      raise exception 'Es el mismo precio: acéptala.' using errcode = '22023';
    end if;
    if v_soy = 'tienda' and v_o.precio_tienda is not null and v_precio > v_o.precio_tienda then
      raise exception 'Como mucho, tu precio: % €.', to_char(v_o.precio_tienda, 'FM999990.00') using errcode = '22023';
    end if;
    if v_o.envio = 'correo' then
      select t.tipo, t.precio into v_tipo, v_envio from public.cambio_envio_tarifa(v_precio * v_o.unidades, v_o.unidades) t;
    end if;
    update tienda_ofertas set precio = v_precio, turno = case when v_soy = 'tienda' then 'comprador' else 'tienda' end,
      envio_tipo = coalesce(v_tipo, envio_tipo), envio_precio = coalesce(v_envio, envio_precio),
      caduca_at = now() + interval '48 hours', updated_at = now(), pasos = public.tienda_oferta_con_paso(pasos, v_soy, 'contraoferta', v_precio)
    where id = v_o.id returning * into v_o;
    v_evento := 'oferta_contraoferta'; v_titulo := 'Te han hecho una contraoferta';
    v_texto := 'Te la dejo en ' || to_char(v_precio, 'FM999990.00') || ' €.';
    if v_soy = 'comprador' then v_titulo := 'Te han hecho otra oferta'; v_texto := 'Te ofrezco ' || to_char(v_precio, 'FM999990.00') || ' €.'; end if;
  elsif p_accion = 'aceptar' then
    -- Aceptar reserva: las unidades salen del stock a nombre de quien compra.
    select * into v_s from tienda_stock where id = v_o.stock_id and tienda_id = v_o.tienda_id for update;
    if not found or v_s.unidades < v_o.unidades then
      raise exception 'Ya no quedan: se ha vendido mientras tanto.' using errcode = '22023';
    end if;
    select '@' || coalesce(username, 'cliente') into v_para from user_profiles where id = v_o.comprador_id;
    update tienda_stock set unidades = unidades - v_o.unidades, updated_at = now() where id = v_s.id;
    insert into tienda_reservas (tienda_id, stock_id, unidades, precio, para, para_usuario, nota, hasta)
    values (v_o.tienda_id, v_s.id, v_o.unidades, v_o.precio, left(coalesce(v_para, '@cliente'), 80), v_o.comprador_id, 'Oferta en PokeDoc', now() + interval '7 days')
    returning id into v_reserva;
    update tienda_ofertas set estado = 'aceptada', reserva_id = v_reserva, reservada_hasta = now() + interval '7 days', updated_at = now(),
      pasos = public.tienda_oferta_con_paso(pasos, v_soy, 'acepta', precio)
    where id = v_o.id returning * into v_o;
    v_evento := 'oferta_aceptada'; v_titulo := 'Oferta aceptada';
    v_texto := 'Hecho: ' || to_char(v_o.precio, 'FM999990.00') || ' €. Queda reservada 7 días.';
  else
    raise exception 'No sé hacer eso con una oferta.' using errcode = '22023';
  end if;
  perform public.tienda_oferta_avisar(v_o.id, v_uid, v_otro, v_evento, v_titulo, v_texto);
  return to_jsonb(v_o);
end;
$$;

-- ── 5. Lo que hace la tienda después de aceptar ──
create or replace function public.tienda_oferta_paso(p_oferta uuid, p_paso text, p_seguimiento text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_o tienda_ofertas%rowtype;
  v_r tienda_reservas%rowtype;
  v_s tienda_stock%rowtype;
  v_ticket uuid := gen_random_uuid();
  v_seg text := nullif(left(btrim(coalesce(p_seguimiento, '')), 80), '');
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo la tienda.' using errcode = '42501';
  end if;
  select * into v_o from tienda_ofertas where id = p_oferta and tienda_id = v_uid for update;
  if not found then
    raise exception 'Esa oferta no existe.' using errcode = 'P0002';
  end if;
  if v_o.estado not in ('aceptada', 'pagada') then
    raise exception 'Esa oferta no está aceptada.' using errcode = '22023';
  end if;
  if v_o.reserva_id is not null then
    select * into v_r from tienda_reservas where id = v_o.reserva_id for update;
  end if;
  if v_o.reserva_id is null or v_r.id is null then
    raise exception 'La reserva ya venció y la carta volvió al stock.' using errcode = '22023';
  end if;

  if p_paso = 'pagada' then
    update tienda_ofertas set estado = 'pagada', updated_at = now(), pasos = public.tienda_oferta_con_paso(pasos, 'tienda', 'pagada', precio) where id = v_o.id returning * into v_o;
    perform public.tienda_oferta_avisar(v_o.id, v_uid, v_o.comprador_id, 'oferta_pagada', 'Pago recibido', 'Me ha llegado el pago, gracias.');
  elsif p_paso = 'hecha' then
    -- La VENTA, como «Recogida» (1092): con el coste de la línea y «PokeDoc».
    select * into v_s from tienda_stock where id = v_r.stock_id;
    insert into tienda_ventas (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, precio, coste, donde)
    values (v_uid, v_ticket, v_s.id, v_s.card_id, v_s.market, v_s.product_id, v_s.idioma, v_s.estado, v_s.variante, v_s.gradeo, v_r.unidades, v_o.precio, v_s.coste, 'pokedoc');
    delete from tienda_reservas where id = v_r.id;
    update tienda_ofertas set estado = 'hecha', ticket = v_ticket, seguimiento = coalesce(v_seg, seguimiento), updated_at = now(),
      pasos = public.tienda_oferta_con_paso(pasos, 'tienda', case when envio = 'correo' then 'enviada' else 'entregada' end, precio)
    where id = v_o.id returning * into v_o;
    perform public.tienda_oferta_avisar(v_o.id, v_uid, v_o.comprador_id, 'oferta_hecha',
      case when v_o.envio = 'correo' then 'Tu carta va de camino' else 'Venta hecha' end,
      case when v_o.envio = 'correo' then 'Te la he mandado.' || coalesce(' Seguimiento: ' || v_o.seguimiento || '.', '') else '¡Que la disfrutes!' end);
  elsif p_paso = 'alargar' then
    if v_r.hasta + interval '7 days' > now() + interval '60 days' then
      raise exception 'Como mucho, dos meses.' using errcode = '22023';
    end if;
    update tienda_reservas set hasta = hasta + interval '7 days' where id = v_r.id;
    update tienda_ofertas set reservada_hasta = v_r.hasta + interval '7 days', updated_at = now() where id = v_o.id returning * into v_o;
  elsif p_paso = 'cancelar' then
    update tienda_stock set unidades = unidades + v_r.unidades, updated_at = now() where id = v_r.stock_id;
    delete from tienda_reservas where id = v_r.id;
    update tienda_ofertas set estado = 'cancelada', updated_at = now(), pasos = public.tienda_oferta_con_paso(pasos, 'tienda', 'cancela', precio) where id = v_o.id returning * into v_o;
    perform public.tienda_oferta_avisar(v_o.id, v_uid, v_o.comprador_id, 'oferta_cancelada', 'Venta cancelada', 'He cancelado esta venta: la carta vuelve a la tienda.');
  else
    raise exception 'No sé hacer eso con una oferta.' using errcode = '22023';
  end if;
  return jsonb_build_object('id', v_o.id, 'estado', v_o.estado, 'ticket', v_o.ticket, 'reservada_hasta', v_o.reservada_hasta);
end;
$$;

-- ── 7. Ver una (la tarjeta de Mensajes) ──
-- A quien compra, el Bizum o el PayPal de la tienda solo cuando ya está
-- aceptada; a la tienda, su coste (para el margen). Nunca al revés.
create or replace function public.tienda_oferta_ver(p_oferta uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_o tienda_ofertas%rowtype;
  v_c tienda_cobros%rowtype;
  v_soy text;
begin
  select * into v_o from tienda_ofertas where id = p_oferta and (tienda_id = v_uid or comprador_id = v_uid);
  if not found then
    return null;
  end if;
  perform public.tienda_ofertas_al_dia(v_o.tienda_id);
  select * into v_o from tienda_ofertas where id = p_oferta;
  v_soy := case when v_o.tienda_id = v_uid then 'tienda' else 'comprador' end;
  select * into v_c from tienda_cobros where tienda_id = v_o.tienda_id;
  return to_jsonb(v_o) || jsonb_build_object(
    'soy', v_soy,
    'tienda', (select jsonb_build_object('id', p.id, 'username', p.username, 'nombre', coalesce(p.display_name, p.username), 'avatar_url', p.avatar_url) from user_profiles p where p.id = v_o.tienda_id),
    'comprador', (select jsonb_build_object('id', p.id, 'username', p.username, 'nombre', coalesce(p.display_name, p.username), 'avatar_url', p.avatar_url) from user_profiles p where p.id = v_o.comprador_id),
    'cobro', case when v_soy = 'comprador' and v_o.estado in ('aceptada', 'pagada') then
      case v_o.pago when 'bizum' then v_c.bizum when 'paypal' then v_c.paypal end end,
    'coste', case when v_soy = 'tienda' then (select s.coste from tienda_stock s where s.id = v_o.stock_id) end,
    'quedan', (select s.unidades from tienda_stock s where s.id = v_o.stock_id)
  );
end;
$$;

-- ── La pestaña Ofertas del panel ──
-- `p_que`: 'responder' (te toca), 'esperando' (le toca a quien compra),
-- 'reservadas' (aceptadas o pagadas) y 'cerradas' (lo demás, 60 días).
create or replace function public.tienda_ofertas_lista(p_que text default 'responder')
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  perform public.tienda_ofertas_al_dia(v_uid);
  return jsonb_build_object(
    'cuentas', jsonb_build_object(
      'responder', (select count(*) from tienda_ofertas where tienda_id = v_uid and estado = 'abierta' and turno = 'tienda'),
      'esperando', (select count(*) from tienda_ofertas where tienda_id = v_uid and estado = 'abierta' and turno = 'comprador'),
      'reservadas', (select count(*) from tienda_ofertas where tienda_id = v_uid and estado in ('aceptada', 'pagada'))
    ),
    -- Lo reservado, lo que antes vence primero; lo demás, lo último arriba.
    'filas', coalesce((select jsonb_agg(x.f order by x.k) from (
      select to_jsonb(o) || jsonb_build_object(
        'comprador', (select jsonb_build_object('id', p.id, 'username', p.username, 'nombre', coalesce(p.display_name, p.username), 'avatar_url', p.avatar_url) from user_profiles p where p.id = o.comprador_id),
        'coste', s.coste,
        'quedan', s.unidades,
        'nombre', coalesce(c.name_es, c.name, pr.name)
      ) f,
      case when p_que = 'reservadas' then extract(epoch from o.reservada_hasta) else -extract(epoch from o.updated_at) end k
      from tienda_ofertas o
      left join tienda_stock s on s.id = o.stock_id
      left join tcg_cards c on c.id = o.card_id
      left join tcg_products pr on pr.id = o.product_id
      where o.tienda_id = v_uid and case p_que
        when 'responder' then o.estado = 'abierta' and o.turno = 'tienda'
        when 'esperando' then o.estado = 'abierta' and o.turno = 'comprador'
        when 'reservadas' then o.estado in ('aceptada', 'pagada')
        else o.estado not in ('abierta', 'aceptada', 'pagada') and o.updated_at > now() - interval '60 days'
      end
      order by k
      limit 200
    ) x), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.tienda_oferta_avisar(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.tienda_oferta_con_paso(jsonb, text, text, numeric) from public, anon, authenticated;
revoke all on function public.tienda_condiciones(uuid) from public;
revoke all on function public.tienda_cobros_mios() from public, anon;
revoke all on function public.tienda_cobros_poner(text[], text, text, int) from public, anon;
revoke all on function public.tienda_ofertas_al_dia(uuid) from public;
revoke all on function public.tienda_oferta_enviar(uuid, numeric, text, text, int) from public, anon;
revoke all on function public.tienda_oferta_responder(uuid, text, numeric) from public, anon;
revoke all on function public.tienda_oferta_paso(uuid, text, text) from public, anon;
revoke all on function public.tienda_oferta_ver(uuid) from public, anon;
revoke all on function public.tienda_ofertas_lista(text) from public, anon;
grant execute on function public.tienda_condiciones(uuid) to anon, authenticated;
grant execute on function public.tienda_cobros_mios() to authenticated;
grant execute on function public.tienda_cobros_poner(text[], text, text, int) to authenticated;
grant execute on function public.tienda_ofertas_al_dia(uuid) to anon, authenticated;
grant execute on function public.tienda_oferta_enviar(uuid, numeric, text, text, int) to authenticated;
grant execute on function public.tienda_oferta_responder(uuid, text, numeric) to authenticated;
grant execute on function public.tienda_oferta_paso(uuid, text, text) to authenticated;
grant execute on function public.tienda_oferta_ver(uuid) to authenticated;
grant execute on function public.tienda_ofertas_lista(text) to authenticated;

commit;

notify pgrst, 'reload schema';
