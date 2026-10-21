-- Propuestas de cambio (tandas 942 y 943; propuesta «Cambios en PokeDoc»,
-- PINGU: «adelante con lo recomendado»).
--
-- Hasta aquí un cambio se hablaba por el chat y luego cada uno quitaba y
-- ponía sus cartas a mano. Ahora es un objeto: una PROPUESTA con lo que da
-- cada uno (la copia concreta: idioma, estado, versión) y el precio de ese
-- día, y el dinero que se paga aparte. El dinero se APUNTA para que los dos
-- estéis de acuerdo en lo mismo, pero PokeDoc no lo cobra ni lo comprueba.
--
--   enviada ──aceptar──▶ aceptada ──«Lo tengo» de los dos──▶ hecha
--      │  └─rechazar──▶ rechazada        │                      │
--      │  └─otra nueva─▶ cambiada         └─anular─▶ anulada     └─deshacer (un día)─▶ aceptada
--      └─anular (quien la manda)─▶ anulada
--
-- Al cerrarse, las cartas se MUEVEN solas: salen de la colección de quien
-- las da y entran en la de quien las recibe, y se tachan de su «La quiero».
-- Lo que se ha movido queda apuntado (`movimientos`) para poder deshacerlo
-- durante un día. Y cuenta para la confianza (trade_confirmations, 795).
--
-- Nadie escribe en las tablas directamente: todo pasa por las funciones de
-- abajo, y la RLS deja leer a cada uno SUS propuestas. Lo que queda
-- reservado en un cambio aceptado lo dice `cambios_reservadas`.
-- Sin tablas temporales (631). Se puede ejecutar más de una vez.
begin;

create table if not exists public.trade_offers (
  id uuid primary key default gen_random_uuid(),
  -- Quien la manda y a quien se la manda. En una contraoferta se dan la vuelta.
  de uuid not null references auth.users (id) on delete cascade,
  para uuid not null references auth.users (id) on delete cascade,
  estado text not null default 'enviada'
    check (estado in ('enviada', 'aceptada', 'rechazada', 'anulada', 'cambiada', 'hecha')),
  version int not null default 1,
  anterior uuid references public.trade_offers (id) on delete set null,
  -- La diferencia en dinero: cuánto, quién paga ('de' o 'para') y cómo.
  dinero numeric(10, 2) not null default 0 check (dinero >= 0 and dinero <= 100000),
  dinero_paga text check (dinero_paga in ('de', 'para')),
  dinero_como text check (dinero_como in ('bizum', 'mano', 'paypal', 'otro')),
  nota text check (char_length(nota) <= 500),
  conversacion uuid,
  aceptada_at timestamptz,
  recibido_de_at timestamptz,
  recibido_para_at timestamptz,
  hecha_at timestamptz,
  deshacer_hasta timestamptz,
  movimientos jsonb,
  confirmacion uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (de <> para),
  check ((dinero = 0) = (dinero_paga is null))
);

create index if not exists trade_offers_de_idx on public.trade_offers (de, created_at desc);
create index if not exists trade_offers_para_idx on public.trade_offers (para, created_at desc);

create table if not exists public.trade_offer_items (
  id uuid primary key default gen_random_uuid(),
  oferta uuid not null references public.trade_offers (id) on delete cascade,
  -- Quien DA esta carta.
  quien uuid not null references auth.users (id) on delete cascade,
  -- Su línea de la colección. Null: se la pides y no la tiene en «doy»
  -- (`pedida`); al aceptar se busca si la tiene.
  linea uuid,
  card_id text not null,
  market text not null default 'WEST',
  idioma text not null default 'es',
  estado text not null default 'NM',
  variante text not null default 'normal',
  gradeo text,
  cantidad int not null default 1 check (cantidad between 1 and 99),
  -- Lo que valía el día que se propuso (en el idioma de la copia).
  precio numeric(10, 2) check (precio is null or precio >= 0),
  pedida boolean not null default false
);

create index if not exists trade_offer_items_oferta_idx on public.trade_offer_items (oferta);
create index if not exists trade_offer_items_linea_idx on public.trade_offer_items (linea) where linea is not null;

alter table public.trade_offers enable row level security;
alter table public.trade_offer_items enable row level security;

drop policy if exists trade_offers_ver on public.trade_offers;
create policy trade_offers_ver on public.trade_offers
  for select to authenticated
  using (auth.uid() in (de, para));

drop policy if exists trade_offer_items_ver on public.trade_offer_items;
create policy trade_offer_items_ver on public.trade_offer_items
  for select to authenticated
  using (exists (select 1 from public.trade_offers o where o.id = oferta and auth.uid() in (o.de, o.para)));

grant select on public.trade_offers, public.trade_offer_items to authenticated;

-- Cuántas copias de una línea están ya comprometidas en un cambio aceptado.
create or replace function public.cambio_reservadas_linea(p_linea uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(i.cantidad), 0)::int
  from public.trade_offer_items i
  join public.trade_offers o on o.id = i.oferta
  where i.linea = p_linea and o.estado = 'aceptada'
$$;

-- El importe en texto, como en la web: «64,00 €».
create or replace function public.cambio_euros(p numeric)
returns text
language sql
immutable
as $$ select replace(to_char(p, 'FM999990.00'), '.', ',') || ' €' $$;

-- La conversación de dos personas, o una nueva: la propuesta vive ahí.
create or replace function public.cambio_conversacion(p_a uuid, p_b uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v uuid;
begin
  select c1.conversation_id into v
  from public.conversation_participants c1
  join public.conversation_participants c2 on c2.conversation_id = c1.conversation_id
  where c1.user_id = p_a and c2.user_id = p_b
  limit 1;
  if v is null then
    insert into public.conversations default values returning id into v;
    insert into public.conversation_participants (conversation_id, user_id) values (v, p_a), (v, p_b);
  end if;
  return v;
end
$$;

-- Un aviso y una línea en la conversación, para cada paso.
create or replace function public.cambio_avisar(p_oferta uuid, p_de uuid, p_para uuid, p_tipo text, p_titulo text, p_texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv uuid;
begin
  v_conv := public.cambio_conversacion(p_de, p_para);
  update public.trade_offers set conversacion = v_conv where id = p_oferta and conversacion is null;
  insert into public.private_messages (conversation_id, sender_id, body) values (v_conv, p_de, p_texto);
  insert into public.user_notifications (recipient_id, type, title, body, link)
  values (p_para, p_tipo, p_titulo, p_texto, '/mensajes.html?c=' || v_conv);
end
$$;

-- ── Proponer ──
--
-- `p_items`: una lista de { de: 'yo'|'otro', linea, card_id, market, idioma,
-- estado, variante, cantidad, precio }. Lo tuyo sale siempre de una línea
-- tuya; lo suyo, de una línea suya puesta para cambio o, sin línea, como
-- «se la pides». Con `p_anterior` es una contraoferta (o un cambio de la
-- tuya): la vieja se queda «cambiada». Entre dos personas hay UNA viva.
create or replace function public.cambio_proponer(
  p_para uuid,
  p_items jsonb,
  p_dinero numeric default 0,
  p_paga text default null,
  p_como text default null,
  p_nota text default null,
  p_anterior uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  v_id uuid;
  v_version int := 1;
  v_ant public.trade_offers;
  it jsonb;
  l public.user_collection;
  n int;
  v_quien uuid;
  v_dinero numeric := coalesce(p_dinero, 0);
  v_doy int := 0;
  v_recibo int := 0;
  v_texto text;
begin
  if yo is null then raise exception 'Hace falta entrar con tu cuenta.'; end if;
  if p_para is null or p_para = yo then raise exception 'Un cambio es entre dos personas.'; end if;
  if not exists (select 1 from public.user_profiles where id = p_para and not coalesce(is_banned, false)) then
    raise exception 'A esa persona no se le pueden mandar propuestas.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Una propuesta lleva al menos una carta.';
  end if;
  if jsonb_array_length(p_items) > 60 then raise exception 'Como mucho 60 cartas por propuesta.'; end if;
  if v_dinero < 0 or v_dinero > 100000 then raise exception 'La diferencia en dinero no puede ser esa.'; end if;
  if v_dinero > 0 and coalesce(p_paga, '') not in ('de', 'para') then raise exception 'Di quién paga la diferencia.'; end if;
  if p_como is not null and p_como not in ('bizum', 'mano', 'paypal', 'otro') then raise exception 'Esa forma de pago no la conozco.'; end if;

  if p_anterior is not null then
    select * into v_ant from public.trade_offers where id = p_anterior for update;
    if v_ant.id is null or v_ant.estado <> 'enviada' or yo not in (v_ant.de, v_ant.para) or p_para not in (v_ant.de, v_ant.para) then
      raise exception 'Esa propuesta ya no se puede cambiar.';
    end if;
    v_version := v_ant.version + 1;
  end if;

  update public.trade_offers set estado = 'cambiada', updated_at = now()
  where estado = 'enviada' and ((de = yo and para = p_para) or (de = p_para and para = yo));

  insert into public.trade_offers (de, para, version, anterior, dinero, dinero_paga, dinero_como, nota)
  values (yo, p_para, v_version, p_anterior, v_dinero,
          case when v_dinero > 0 then p_paga end,
          case when v_dinero > 0 then p_como end,
          nullif(left(btrim(coalesce(p_nota, '')), 500), ''))
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_quien := case it->>'de' when 'yo' then yo when 'otro' then p_para end;
    if v_quien is null then raise exception 'Cada carta dice quién la da.'; end if;
    n := greatest(1, least(99, coalesce(nullif(it->>'cantidad', '')::int, 1)));
    if nullif(it->>'linea', '') is not null then
      select * into l from public.user_collection where id = (it->>'linea')::uuid;
      if l.id is null or l.user_id <> v_quien then raise exception 'Una de las cartas ya no está en su colección.'; end if;
      if v_quien = p_para and coalesce(l.cambio, 0) <= 0 then raise exception 'Una de sus cartas ya no la da.'; end if;
      if n > l.cantidad - public.cambio_reservadas_linea(l.id) then
        raise exception 'De % no quedan tantas copias libres.', l.card_id;
      end if;
      insert into public.trade_offer_items (oferta, quien, linea, card_id, market, idioma, estado, variante, gradeo, cantidad, precio, pedida)
      values (v_id, v_quien, l.id, l.card_id, l.market, l.idioma, l.estado, l.variante, l.gradeo, n,
              nullif(it->>'precio', '')::numeric, false);
    else
      if v_quien = yo then raise exception 'Lo que das tiene que salir de tu colección.'; end if;
      if nullif(it->>'card_id', '') is null then raise exception 'Falta la carta que le pides.'; end if;
      if coalesce(nullif(it->>'idioma', ''), 'es') not in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja') then raise exception 'Ese idioma no lo conozco.'; end if;
      if coalesce(nullif(it->>'estado', ''), 'NM') not in ('MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO') then raise exception 'Ese estado no lo conozco.'; end if;
      if coalesce(nullif(it->>'variante', ''), 'normal') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Esa versión no la conozco.'; end if;
      insert into public.trade_offer_items (oferta, quien, linea, card_id, market, idioma, estado, variante, gradeo, cantidad, precio, pedida)
      values (v_id, p_para, null, it->>'card_id', coalesce(nullif(it->>'market', ''), 'WEST'),
              coalesce(nullif(it->>'idioma', ''), 'es'), coalesce(nullif(it->>'estado', ''), 'NM'),
              coalesce(nullif(it->>'variante', ''), 'normal'), null, n, nullif(it->>'precio', '')::numeric, true);
    end if;
    if v_quien = yo then v_doy := v_doy + n; else v_recibo := v_recibo + n; end if;
  end loop;

  v_texto := case when p_anterior is null then 'Te he mandado una propuesta de cambio: ' else 'He cambiado la propuesta de cambio: ' end
    || 'doy ' || v_doy || case when v_doy = 1 then ' carta' else ' cartas' end
    || ' y recibo ' || v_recibo || case when v_recibo = 1 then ' carta' else ' cartas' end
    || case when v_dinero > 0 and p_paga = 'de' then ' y te pago ' || public.cambio_euros(v_dinero)
            when v_dinero > 0 then ' y me pagas ' || public.cambio_euros(v_dinero) else '' end
    || '. La tienes arriba de la conversación.';
  perform public.cambio_avisar(v_id, yo, p_para, 'cambio_propuesta', 'Propuesta de cambio', v_texto);
  return v_id;
end
$$;

-- ── Contestar: aceptar, rechazar o anular ──
create or replace function public.cambio_contestar(p_oferta uuid, p_accion text)
returns public.trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  it public.trade_offer_items;
  l public.user_collection;
  v_otro uuid;
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  v_otro := case when yo = o.de then o.para else o.de end;

  if p_accion = 'aceptar' then
    if o.estado <> 'enviada' or yo <> o.para then raise exception 'Esa propuesta ya no se puede aceptar.'; end if;
    for it in select * from public.trade_offer_items where oferta = o.id loop
      if it.linea is not null then
        select * into l from public.user_collection where id = it.linea and user_id = it.quien;
        if l.id is null or l.cantidad - public.cambio_reservadas_linea(l.id) < it.cantidad then
          raise exception 'Ya no quedan copias libres de % para este cambio: cámbiala o recházala.', it.card_id;
        end if;
      elsif it.pedida then
        -- Se la pedían y no la tenía en «doy»: si la tiene, esa copia.
        select * into l from public.user_collection
        where user_id = it.quien and card_id = it.card_id and market = it.market
        order by (idioma = it.idioma) desc, (estado = it.estado) desc, cantidad desc
        limit 1;
        if l.id is not null then
          update public.trade_offer_items
          set linea = l.id, idioma = l.idioma, estado = l.estado, variante = l.variante, gradeo = l.gradeo
          where id = it.id;
        end if;
      end if;
    end loop;
    update public.trade_offers set estado = 'aceptada', aceptada_at = now(), updated_at = now() where id = o.id returning * into o;
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_aceptado', 'Han aceptado tu cambio',
      'He aceptado tu propuesta de cambio. Cuando te llegue lo mío, dale a «Lo tengo».');
  elsif p_accion = 'rechazar' then
    if o.estado <> 'enviada' or yo <> o.para then raise exception 'Esa propuesta ya no se puede rechazar.'; end if;
    update public.trade_offers set estado = 'rechazada', updated_at = now() where id = o.id returning * into o;
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_rechazado', 'Han rechazado tu cambio', 'No me cuadra esta propuesta de cambio.');
  elsif p_accion = 'anular' then
    if not ((o.estado = 'enviada' and yo = o.de) or o.estado = 'aceptada') then raise exception 'Esa propuesta ya no se puede anular.'; end if;
    update public.trade_offers set estado = 'anulada', updated_at = now() where id = o.id returning * into o;
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_anulado', 'Un cambio se ha anulado', 'He anulado la propuesta de cambio.');
  else
    raise exception 'No sé hacer eso con una propuesta.';
  end if;
  return o;
end
$$;

-- ── Mover las cartas (lo llama «Lo tengo» cuando ya lo han dado los dos) ──
-- Devuelve lo que ha hecho, en orden, para poder deshacerlo.
create or replace function public.cambio_mover(p_oferta uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.trade_offers;
  it public.trade_offer_items;
  l public.user_collection;
  dest public.user_collection;
  v_rec uuid;
  n int;
  v_nueva uuid;
  v_deseos jsonb;
  hecho jsonb := '[]'::jsonb;
begin
  select * into o from public.trade_offers where id = p_oferta;
  for it in select * from public.trade_offer_items where oferta = o.id order by id loop
    v_rec := case when it.quien = o.de then o.para else o.de end;
    n := it.cantidad;
    select * into l from public.user_collection where id = it.linea and user_id = it.quien for update;
    if l.id is null then
      hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'faltaba', 'card_id', it.card_id, 'quien', it.quien));
    else
      n := least(n, l.cantidad);
      if l.cantidad - n <= 0 then
        hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'borrada', 'fila', to_jsonb(l)));
        delete from public.user_collection where id = l.id;
      else
        hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'restada', 'id', l.id, 'n', n, 'cambio', l.cambio));
        update public.user_collection
        set cantidad = cantidad - n, cambio = greatest(0, least(cambio - n, cantidad - n))
        where id = l.id;
      end if;
    end if;
    select * into dest from public.user_collection
    where user_id = v_rec and card_id = it.card_id and market = it.market and idioma = it.idioma
      and estado = it.estado and variante = it.variante and gradeo is not distinct from it.gradeo
    order by created_at
    limit 1
    for update;
    if dest.id is not null then
      update public.user_collection set cantidad = least(999, cantidad + n) where id = dest.id;
      hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'sumada', 'id', dest.id, 'n', n));
    else
      insert into public.user_collection (user_id, card_id, market, idioma, estado, variante, gradeo, cantidad)
      values (v_rec, it.card_id, it.market, it.idioma, it.estado, it.variante, it.gradeo, n)
      returning id into v_nueva;
      hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'creada', 'id', v_nueva));
    end if;
    -- Lo que buscaba quien la recibe, tachado (en cualquier idioma o en ese).
    with fuera as (
      delete from public.user_wants
      where user_id = v_rec and card_id = it.card_id and (idioma is null or idioma = it.idioma)
      returning *
    )
    select coalesce(jsonb_agg(jsonb_build_object('op', 'deseo', 'fila', to_jsonb(fuera))), '[]'::jsonb) into v_deseos from fuera;
    hecho := hecho || v_deseos;
  end loop;
  return hecho;
end
$$;

-- ── «Lo tengo»: cada uno dice que le ha llegado lo del otro ──
create or replace function public.cambio_lo_tengo(p_oferta uuid)
returns public.trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  v_otro uuid;
  v_conf uuid;
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado <> 'aceptada' then raise exception 'Ese cambio no está aceptado.'; end if;
  v_otro := case when yo = o.de then o.para else o.de end;
  if yo = o.de then
    update public.trade_offers set recibido_de_at = coalesce(recibido_de_at, now()), updated_at = now() where id = o.id returning * into o;
  else
    update public.trade_offers set recibido_para_at = coalesce(recibido_para_at, now()), updated_at = now() where id = o.id returning * into o;
  end if;
  if o.recibido_de_at is null or o.recibido_para_at is null then
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_recibido', 'Ya tiene lo tuyo', 'Ya me ha llegado lo tuyo. Cuando te llegue lo mío, dale a «Lo tengo» y las cartas se mueven solas.');
    return o;
  end if;
  -- Los dos: se mueven las cartas y cuenta para la confianza (795).
  update public.trade_offers
  set movimientos = public.cambio_mover(o.id), estado = 'hecha', hecha_at = now(),
      deshacer_hasta = now() + interval '1 day', updated_at = now()
  where id = o.id
  returning * into o;
  if to_regclass('public.trade_confirmations') is not null then
    execute 'insert into public.trade_confirmations (user_a, user_b, hecho_a_at, hecho_b_at) values ($1, $2, now(), now()) returning id'
      into v_conf using least(o.de, o.para), greatest(o.de, o.para);
    update public.trade_offers set confirmacion = v_conf where id = o.id returning * into o;
  end if;
  perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_hecho', 'Cambio hecho', 'Cambio hecho: las cartas ya están en la colección de cada uno.');
  return o;
end
$$;

-- ── Deshacer, durante un día ──
-- Devuelve las cartas a donde estaban (lo que se pueda: si una línea ya no
-- existe, se vuelve a crear con lo que tenía) y el cambio queda aceptado.
create or replace function public.cambio_deshacer(p_oferta uuid)
returns public.trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  m jsonb;
  v_otro uuid;
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado <> 'hecha' or o.deshacer_hasta is null or now() > o.deshacer_hasta then raise exception 'Ese cambio ya no se puede deshacer.'; end if;
  v_otro := case when yo = o.de then o.para else o.de end;
  for m in select x from jsonb_array_elements(coalesce(o.movimientos, '[]'::jsonb)) with ordinality as t(x, i) order by i desc loop
    if m->>'op' = 'creada' then
      delete from public.user_collection where id = (m->>'id')::uuid;
    elsif m->>'op' = 'sumada' then
      delete from public.user_collection where id = (m->>'id')::uuid and cantidad <= (m->>'n')::int;
      update public.user_collection set cantidad = cantidad - (m->>'n')::int where id = (m->>'id')::uuid and cantidad > (m->>'n')::int;
    elsif m->>'op' = 'restada' then
      update public.user_collection
      set cantidad = least(999, cantidad + (m->>'n')::int), cambio = least((m->>'cambio')::int, cantidad + (m->>'n')::int)
      where id = (m->>'id')::uuid;
    elsif m->>'op' = 'borrada' then
      insert into public.user_collection select * from jsonb_populate_record(null::public.user_collection, m->'fila') on conflict (id) do nothing;
    elsif m->>'op' = 'deseo' then
      insert into public.user_wants select * from jsonb_populate_record(null::public.user_wants, m->'fila') on conflict (id) do nothing;
    end if;
  end loop;
  if o.confirmacion is not null and to_regclass('public.trade_confirmations') is not null then
    execute 'delete from public.trade_confirmations where id = $1' using o.confirmacion;
  end if;
  update public.trade_offers
  set estado = 'aceptada', recibido_de_at = null, recibido_para_at = null, hecha_at = null,
      deshacer_hasta = null, movimientos = null, confirmacion = null, updated_at = now()
  where id = o.id
  returning * into o;
  perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_deshecho', 'Un cambio se ha deshecho', 'He deshecho el cambio: las cartas vuelven a donde estaban y sigue aceptado.');
  return o;
end
$$;

-- ── Lo que se lee de fuera ──

-- Lo que da una persona, con su línea y las copias libres (las que no están
-- ya en un cambio aceptado): para elegir en una propuesta.
create or replace function public.cambio_lo_que_da(p_user uuid)
returns table (id uuid, card_id text, market text, idioma text, estado text, variante text, gradeo text, cambio int, libres int)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.card_id, c.market, c.idioma, c.estado, c.variante, c.gradeo, c.cambio,
         greatest(0, least(c.cambio, c.cantidad - public.cambio_reservadas_linea(c.id)))::int
  from public.user_collection c
  join public.user_profiles p on p.id = c.user_id
  where c.user_id = p_user and c.cambio > 0 and not coalesce(p.is_banned, false)
  order by c.updated_at desc nulls last, c.card_id
  limit 1000
$$;

-- Lo que está reservado en un cambio aceptado, por persona y carta: el
-- Mercado lo enseña como «Reservada». Sin quién ni con quién.
create or replace function public.cambios_reservadas(p_cards text[])
returns table (user_id uuid, card_id text, cantidad int)
language sql
stable
security definer
set search_path = public
as $$
  select i.quien, i.card_id, sum(i.cantidad)::int
  from public.trade_offer_items i
  join public.trade_offers o on o.id = i.oferta
  where o.estado = 'aceptada' and i.linea is not null and i.card_id = any (p_cards)
  group by i.quien, i.card_id
$$;

-- Las de dentro no las llama nadie desde fuera.
revoke all on function public.cambio_reservadas_linea(uuid) from public, anon, authenticated;
revoke all on function public.cambio_conversacion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cambio_avisar(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.cambio_mover(uuid) from public, anon, authenticated;
revoke all on function public.cambio_proponer(uuid, jsonb, numeric, text, text, text, uuid) from public, anon;
revoke all on function public.cambio_contestar(uuid, text) from public, anon;
revoke all on function public.cambio_lo_tengo(uuid) from public, anon;
revoke all on function public.cambio_deshacer(uuid) from public, anon;
revoke all on function public.cambio_lo_que_da(uuid) from public, anon;
grant execute on function public.cambio_proponer(uuid, jsonb, numeric, text, text, text, uuid) to authenticated;
grant execute on function public.cambio_contestar(uuid, text) to authenticated;
grant execute on function public.cambio_lo_tengo(uuid) to authenticated;
grant execute on function public.cambio_deshacer(uuid) to authenticated;
grant execute on function public.cambio_lo_que_da(uuid) to authenticated;
grant execute on function public.cambios_reservadas(text[]) to anon, authenticated;

commit;
