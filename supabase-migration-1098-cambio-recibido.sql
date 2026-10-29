-- Tanda 1098: el botón de «recibido» dice lo que recibes, y quien no recibe
-- nada no tiene que confirmar (propuesta «Cambios más claros», PINGU: «dale»).
--
-- Hasta aquí los dos pulsaban «Lo tengo», recibieran cartas o dinero. En la
-- web el botón ya dice «Carta recibida», «Cartas recibidas», «Dinero
-- recibido» o «Recibido» (eso es del navegador). Lo que hace esta migración:
--
--   1. `cambio_recibe_algo(oferta, quien)`: si a esa persona le llega algo
--      (una carta del otro o el dinero que paga el otro).
--   2. `cambio_sin_esperar(oferta)`: a quien no le llega nada (regala una
--      carta) se le da por confirmado. Lo llaman aceptar y deshacer.
--   3. `cambio_contestar`, `cambio_lo_tengo` y `cambio_deshacer`, las de la
--      942 con eso y con los mensajes sin «Lo tengo».
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 942.
begin;

create or replace function public.cambio_recibe_algo(p_oferta uuid, p_quien uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.trade_offer_items i where i.oferta = o.id and i.quien <> p_quien)
      or (coalesce(o.dinero, 0) > 0 and ((o.dinero_paga = 'de' and p_quien = o.para) or (o.dinero_paga = 'para' and p_quien = o.de)))
  from public.trade_offers o
  where o.id = p_oferta
$$;

create or replace function public.cambio_sin_esperar(p_oferta uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.trade_offers;
begin
  select * into o from public.trade_offers where id = p_oferta;
  if o.id is null or o.estado <> 'aceptada' then return; end if;
  update public.trade_offers
  set recibido_de_at = case when recibido_de_at is null and not public.cambio_recibe_algo(o.id, o.de) then now() else recibido_de_at end,
      recibido_para_at = case when recibido_para_at is null and not public.cambio_recibe_algo(o.id, o.para) then now() else recibido_para_at end
  where id = o.id;
end
$$;

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
    -- Quien no recibe nada (regala una carta) no tiene nada que confirmar (1098).
    perform public.cambio_sin_esperar(o.id);
    select * into o from public.trade_offers where id = o.id;
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_aceptado', 'Han aceptado tu cambio',
      'He aceptado tu propuesta. Cuando te llegue lo mío, confírmalo en la propuesta y las cartas se mueven solas.');
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
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_recibido', 'Ya tiene lo tuyo', 'Ya me ha llegado lo tuyo. Cuando te llegue lo mío, confírmalo en la propuesta y las cartas se mueven solas.');
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
  perform public.cambio_sin_esperar(o.id);
  select * into o from public.trade_offers where id = o.id;
  perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_deshecho', 'Un cambio se ha deshecho', 'He deshecho el cambio: las cartas vuelven a donde estaban y sigue aceptado.');
  return o;
end
$$;

revoke all on function public.cambio_recibe_algo(uuid, uuid) from public, anon, authenticated;
revoke all on function public.cambio_sin_esperar(uuid) from public, anon, authenticated;
revoke all on function public.cambio_contestar(uuid, text) from public, anon;
revoke all on function public.cambio_lo_tengo(uuid) from public, anon;
revoke all on function public.cambio_deshacer(uuid) from public, anon;
grant execute on function public.cambio_contestar(uuid, text) to authenticated;
grant execute on function public.cambio_lo_tengo(uuid) to authenticated;
grant execute on function public.cambio_deshacer(uuid) to authenticated;

-- Las que ya están aceptadas y esperan a alguien que no recibe nada.
select public.cambio_sin_esperar(id) from public.trade_offers where estado = 'aceptada';

commit;

notify pgrst, 'reload schema';
