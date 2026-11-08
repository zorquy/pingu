-- Tanda 1269 — «Ya nos cambiamos» deja de existir (SCHEMA 1269).
--
-- PINGU: «el botón de ya nos cambiamos creo que da pie a confusión». Era el
-- «Cambio hecho» de la 795, de antes de las propuestas: lo marcaba uno, lo
-- marcaba el otro y quedaba un trato hecho para la reputación, SIN mover ni
-- una carta y tantas veces como se quisiera («Marcar otro»). Dos amigos
-- podían salir «Muy de fiar» en un minuto. Desde la 942 un trato se apunta
-- solo al cerrar su propuesta (también uno en mano), así que la web ya no
-- enseña el botón y aquí se cierra la puerta de atrás: `cambio_marcar` ya no
-- abre ni completa nada, y nadie puede llamarla.
--
-- Lo que ya se marcó SIGUE contando (PINGU eligió la recomendada: no se le
-- quita a nadie lo que tiene). `trade_confirmations` no tiene política de
-- escritura, así que sin esta función la única forma de crear una fila es
-- `cambio_recibido` (o `cambio_mover`) al cerrar una propuesta.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (631).
begin;

create or replace function public.cambio_marcar(p_otro uuid)
returns public.trade_confirmations
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Los cambios se apuntan solos al cerrar una propuesta: propón el cambio desde Mensajes (también si es en mano).';
end
$$;

revoke execute on function public.cambio_marcar(uuid) from public;
revoke execute on function public.cambio_marcar(uuid) from anon;
revoke execute on function public.cambio_marcar(uuid) from authenticated;

commit;
