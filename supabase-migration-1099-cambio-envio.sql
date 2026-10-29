-- Tanda 1099: el envío de un cambio (propuesta «Cambios más claros», 2.ª
-- vuelta; PINGU: «que le dejes a él decidir si es envío normal o
-- certificado: normal son 2 € y el certificado 7 €»).
--
-- Quien propone dice si va EN MANO o POR CORREO; si va por correo, quien la
-- recibe elige al aceptar normal (2 €), certificado (7 €) o en mano (0 €).
-- Quién lo paga (PINGU: «adelante» con lo recomendado): en una venta, quien
-- compra (se suma a lo que paga); en un cambio, cada uno manda lo suyo y
-- paga su envío, así que solo se apunta cómo. Eso lo cuenta la web
-- (`queRecibe`, js/cambio-propuesta-puro.js); la base guarda lo elegido.
--
--   1. `trade_offers`: `envio` ('mano' | 'correo'), `envio_tipo` ('mano' |
--      'normal' | 'certificado', lo que eligió quien la recibe) y
--      `envio_precio` (lo que costaba ese día).
--   2. `cambio_envio_poner(oferta, envio)`: quien la manda, recién enviada.
--   3. `cambio_aceptar(oferta, envio)`: aceptar eligiendo el envío; por
--      dentro es el «aceptar» de siempre (`cambio_contestar`).
--
-- Los precios (2 € y 7 €) están aquí y en `ENVIOS` de
-- js/cambio-propuesta-puro.js: si cambian, en los dos.
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 942 y la 1098.
begin;

alter table public.trade_offers add column if not exists envio text check (envio in ('mano', 'correo'));
alter table public.trade_offers add column if not exists envio_tipo text check (envio_tipo in ('mano', 'normal', 'certificado'));
alter table public.trade_offers add column if not exists envio_precio numeric(10, 2) check (envio_precio is null or envio_precio >= 0);

create or replace function public.cambio_envio_precio(p_tipo text)
returns numeric
language sql
immutable
as $$
  select case p_tipo when 'normal' then 2.00 when 'certificado' then 7.00 else 0 end::numeric(10, 2)
$$;

create or replace function public.cambio_envio_poner(p_oferta uuid, p_envio text)
returns public.trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.trade_offers;
begin
  if coalesce(p_envio, '') not in ('mano', 'correo') then raise exception 'El envío es en mano o por correo.'; end if;
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or o.de is distinct from auth.uid() then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado <> 'enviada' then raise exception 'Esa propuesta ya no se puede cambiar.'; end if;
  update public.trade_offers set envio = p_envio, updated_at = now() where id = o.id returning * into o;
  return o;
end
$$;

create or replace function public.cambio_aceptar(p_oferta uuid, p_envio text default null)
returns public.trade_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  o public.trade_offers;
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or o.para is distinct from auth.uid() then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado <> 'enviada' then raise exception 'Esa propuesta ya no se puede aceptar.'; end if;
  if o.envio = 'correo' then
    if coalesce(p_envio, '') not in ('mano', 'normal', 'certificado') then raise exception 'Elige cómo te lo manda: normal, certificado o en mano.'; end if;
    update public.trade_offers set envio_tipo = p_envio, envio_precio = public.cambio_envio_precio(p_envio) where id = o.id;
  elsif o.envio = 'mano' then
    update public.trade_offers set envio_tipo = 'mano', envio_precio = 0 where id = o.id;
  end if;
  return public.cambio_contestar(p_oferta, 'aceptar');
end
$$;

revoke all on function public.cambio_envio_poner(uuid, text) from public, anon;
revoke all on function public.cambio_aceptar(uuid, text) from public, anon;
grant execute on function public.cambio_envio_poner(uuid, text) to authenticated;
grant execute on function public.cambio_aceptar(uuid, text) to authenticated;

commit;

notify pgrst, 'reload schema';
