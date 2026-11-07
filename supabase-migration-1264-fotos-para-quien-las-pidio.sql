-- Tanda 1264 — Las fotos de una copia las ve SIEMPRE quien las pidió.
--
-- PINGU pidió fotos a una tienda, la tienda las subió, le llegó «Ya están las
-- fotos» a Mensajes… y «Ver las fotos» no hacía nada. Las fotos se leen por la
-- política de `tienda_stock_fotos`, que solo deja verlas si la copia está a la
-- vista y le quedan unidades (`tienda_foto_se_ve`, 1235). Pero una copia que
-- se RESERVA (1092) o se acepta en una oferta (1250) saca sus unidades del
-- stock, y una que la tienda oculta deja de estar a la vista: justo cuando
-- quien compra quiere mirarlas, la base le decía «no hay» (una lista vacía,
-- sin error). Ahora también las ve quien las pidió (`tienda_fotos_pedidas`) o
-- quien tiene una oferta por esa copia (`tienda_ofertas`). La tienda las sigue
-- viendo siempre y los demás, como antes.
--
-- Se puede ejecutar más de una vez. Necesita la 1235, la 1250 y la 1251.

create or replace function public.tienda_foto_se_ve(p_stock uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
      select 1 from tienda_stock s
      where s.id = p_stock and (s.tienda_id = auth.uid() or (s.visible and s.unidades > 0))
    )
    or exists (select 1 from tienda_fotos_pedidas f where f.stock_id = p_stock and f.comprador_id = auth.uid())
    or exists (select 1 from tienda_ofertas o where o.stock_id = p_stock and o.comprador_id = auth.uid());
$$;
revoke all on function public.tienda_foto_se_ve(uuid) from public;
grant execute on function public.tienda_foto_se_ve(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
