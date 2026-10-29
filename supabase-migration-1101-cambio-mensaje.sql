-- Tanda 1101: el mensaje automático de un cambio, como una tarjeta (PINGU:
-- «en vez de que sea un texto plano, algo más interactivo, con un botón de
-- propuesta»).
--
-- `cambio_avisar` (942) mete en la conversación un mensaje de texto cada vez
-- que pasa algo (propuesta, aceptada, recibido, hecho…). Ahora el mensaje
-- lleva además un adjunto `{ tipo: 'propuesta', oferta, evento }`, y la web
-- lo pinta como una tarjeta con su título y «Ver propuesta», que lleva al
-- trato en Cruces → «En curso». El texto se queda (lo usan el aviso, la
-- lista de conversaciones y quien no tenga la web nueva), sin el «La tienes
-- arriba de la conversación»: desde la 1100 se sigue en Cruces.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 942 y la 891 (la columna `adjuntos`).
begin;

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
end
$$;

revoke all on function public.cambio_avisar(uuid, uuid, uuid, text, text, text) from public, anon, authenticated;

commit;

notify pgrst, 'reload schema';
