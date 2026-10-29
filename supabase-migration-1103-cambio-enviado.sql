-- Tanda 1103: «Ya lo he enviado», con el número de seguimiento (PINGU: «si
-- es un envío certificado, deberíamos poder poner el número de
-- seguimiento»), y el borrado de las direcciones de los tratos cerrados a los
-- 30 días (lo recomendado de la propuesta).
--
--   1. `trade_offers`: `enviado_de_at` / `enviado_para_at` (cuándo mandó lo
--      suyo cada uno) y `seguimiento_de` / `seguimiento_para`.
--   2. `cambio_enviado(oferta, seguimiento)`: quien manda cartas por correo,
--      con el trato aceptado y la dirección del otro ya puesta. Se puede
--      volver a llamar para corregir el número. Avisa al otro
--      (`cambio_enviado`, la tarjeta «Enviado» de Mensajes).
--   3. `cambio_direcciones_purgar()`: borra las direcciones de los tratos
--      hechos, rechazados, anulados o cambiados hace más de 30 días. La llama
--      `cambio_avisar` (cada paso de cualquier trato), así que no hace falta
--      una función programada; y `cambio_direcciones` ya no las enseña aunque
--      sigan ahí.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1101 y la 1102.
begin;

alter table public.trade_offers add column if not exists enviado_de_at timestamptz;
alter table public.trade_offers add column if not exists enviado_para_at timestamptz;
alter table public.trade_offers add column if not exists seguimiento_de text check (seguimiento_de is null or char_length(seguimiento_de) <= 60);
alter table public.trade_offers add column if not exists seguimiento_para text check (seguimiento_para is null or char_length(seguimiento_para) <= 60);

create or replace function public.cambio_direcciones_purgar()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.trade_offer_direcciones d
  using public.trade_offers o
  where o.id = d.oferta
    and o.estado in ('hecha', 'rechazada', 'anulada', 'cambiada')
    and coalesce(o.hecha_at, o.updated_at) < now() - interval '30 days'
$$;

-- La de la 1101, que además purga.
create or replace function public.cambio_avisar(p_oferta uuid, p_de uuid, p_para uuid, p_tipo text, p_titulo text, p_texto text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conv uuid;
  v_texto text := replace(p_texto, ' La tienes arriba de la conversación.', '');
begin
  v_conv := public.cambio_conversacion(p_de, p_para);
  update public.trade_offers set conversacion = v_conv where id = p_oferta and conversacion is null;
  insert into public.private_messages (conversation_id, sender_id, body, adjuntos)
  values (v_conv, p_de, v_texto, jsonb_build_array(jsonb_build_object('tipo', 'propuesta', 'oferta', p_oferta, 'evento', p_tipo)));
  insert into public.user_notifications (recipient_id, type, title, body, link)
  values (p_para, p_tipo, p_titulo, v_texto, '/mi-coleccion?ver=cambios#oferta-' || p_oferta);
  perform public.cambio_direcciones_purgar();
end
$$;

-- La de la 1102, sin las de los tratos cerrados hace más de 30 días.
create or replace function public.cambio_direcciones(p_ofertas uuid[])
returns table (oferta uuid, quien uuid, nombre text, calle text, cp text, ciudad text, provincia text, telefono text)
language sql
stable
security definer
set search_path = public
as $$
  select d.oferta, d.quien, d.nombre, d.calle, d.cp, d.ciudad, d.provincia, d.telefono
  from public.trade_offer_direcciones d
  join public.trade_offers o on o.id = d.oferta
  where d.oferta = any (p_ofertas)
    and auth.uid() in (o.de, o.para)
    and (d.quien = auth.uid() or o.estado in ('aceptada', 'hecha'))
    and not (o.estado in ('hecha', 'rechazada', 'anulada', 'cambiada') and coalesce(o.hecha_at, o.updated_at) < now() - interval '30 days')
$$;

create or replace function public.cambio_enviado(p_oferta uuid, p_seguimiento text default null)
returns public.trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  v_otro uuid;
  v_seg text := nullif(btrim(coalesce(p_seguimiento, '')), '');
  v_como text;
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado <> 'aceptada' then raise exception 'Ese trato no está aceptado.'; end if;
  if o.envio is distinct from 'correo' or o.envio_tipo = 'mano' then raise exception 'Ese trato no va por correo.'; end if;
  if not exists (select 1 from public.trade_offer_items i where i.oferta = o.id and i.quien = yo) then
    raise exception 'En ese trato no mandas cartas.';
  end if;
  v_otro := case when yo = o.de then o.para else o.de end;
  if not exists (select 1 from public.trade_offer_direcciones d where d.oferta = o.id and d.quien = v_otro) then
    raise exception 'Todavía no tienes su dirección.';
  end if;
  if char_length(v_seg) > 60 then raise exception 'Ese número de seguimiento es demasiado largo.'; end if;
  if yo = o.de then
    update public.trade_offers set enviado_de_at = coalesce(enviado_de_at, now()), seguimiento_de = v_seg, updated_at = now() where id = o.id returning * into o;
  else
    update public.trade_offers set enviado_para_at = coalesce(enviado_para_at, now()), seguimiento_para = v_seg, updated_at = now() where id = o.id returning * into o;
  end if;
  v_como := case o.envio_tipo when 'certificado' then 'por certificado' else 'por correo' end;
  perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_enviado', 'Te lo ha enviado',
    'Te lo he mandado ' || v_como || '.' || coalesce(' Seguimiento: ' || v_seg || '.', ''));
  return o;
end
$$;

revoke all on function public.cambio_direcciones_purgar() from public, anon, authenticated;
revoke all on function public.cambio_avisar(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.cambio_enviado(uuid, text) from public, anon;
grant execute on function public.cambio_enviado(uuid, text) to authenticated;

commit;

notify pgrst, 'reload schema';
