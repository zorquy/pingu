-- Tanda 1108: el envío, automático con la tabla de Cardmarket (PINGU: «lo
-- normal es ordinario, con un valor máximo de 25; más de 25, certificado y ya
-- está… calcula cómo están los precios en España con la tabla de Cardmarket
-- y que te diga automáticamente qué tipo de envío escoger»).
--
-- Hasta aquí (1099) quien aceptaba elegía normal (2 €) o certificado (7 €).
-- Ahora lo dice lo que se manda: hasta 25 € y 500 g, carta ordinaria; si no,
-- certificado (Paq Ligero hasta 150 €; por encima, paquete con valor
-- declarado o mensajería con seguro), con los precios de Cardmarket para
-- España → España y el peso por cartas que da su tabla de sobres. Quien
-- acepta solo elige entre eso y «en mano».
--
--   1. `cambio_envio_tarifa(valor, cartas)`: (tipo, precio). La misma tabla
--      que `envioAutomatico` de js/cambio-propuesta-puro.js: si cambia, en
--      los dos.
--   2. `cambio_aceptar(oferta, envio)`: con `envio` 'mano', en mano; con
--      cualquier otro, lo calcula. En una venta guarda el envío de quien manda
--      las cartas (lo paga quien compra); en un cambio, cada uno paga el suyo
--      y se guarda certificado si alguno de los dos lo es, a 0.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- Necesita la 1099.
begin;

create or replace function public.cambio_envio_tarifa(p_valor numeric, p_cartas int)
returns table (tipo text, precio numeric)
language plpgsql
immutable
as $$
declare
  n int := greatest(1, coalesce(p_cartas, 1));
  v numeric := greatest(0, coalesce(p_valor, 0));
  g int;
begin
  -- El peso: 4 cartas en 20 g, 17 en 50 g, 40 en 100 g y 40 más cada 100 g.
  g := case when n <= 4 then 20 when n <= 17 then 50 when n <= 40 then 100 else 100 + ceil((n - 40) / 40.0)::int * 100 end;
  if v <= 25 and g <= 500 then
    return query select 'normal'::text, (case when g <= 50 then 1.45 when g <= 100 then 2.25 else 4.20 end)::numeric;
  elsif v <= 150 then
    return query select 'certificado'::text, (case when g <= 250 then 7.06 when g <= 500 then 8.56 when g <= 1000 then 11.61 else 13.64 end)::numeric;
  elsif v <= 200 then
    return query select 'certificado'::text, (case when g <= 1000 then 26.65 when g <= 2000 then 30.10 else 35.95 end)::numeric;
  elsif v <= 500 then
    return query select 'certificado'::text, (case when g <= 1000 then 60.10 when g <= 2000 then 65.95 else 70.81 end)::numeric;
  elsif v <= 1000 then
    return query select 'certificado'::text, (case when g <= 1000 then 125.95 when g <= 2000 then 130.81 else 136.65 end)::numeric;
  else
    return query select 'certificado'::text, 150.00::numeric;
  end if;
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
  v_lados int;
  v_tipo text;
  v_precio numeric;
  v_cert boolean := false;
  r record;
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or o.para is distinct from auth.uid() then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado <> 'enviada' then raise exception 'Esa propuesta ya no se puede aceptar.'; end if;
  if o.envio = 'correo' and p_envio = 'mano' then
    update public.trade_offers set envio_tipo = 'mano', envio_precio = 0 where id = o.id;
  elsif o.envio = 'correo' then
    -- Lo que manda cada uno: lo que vale (sus precios; en una venta sin
    -- precios, el dinero) y cuántas cartas son.
    select count(distinct quien) into v_lados from public.trade_offer_items where oferta = o.id;
    for r in
      select i.quien, sum(coalesce(i.precio, 0) * i.cantidad) as valor, sum(i.cantidad)::int as cartas
      from public.trade_offer_items i where i.oferta = o.id group by i.quien
    loop
      select t.tipo, t.precio into v_tipo, v_precio
      from public.cambio_envio_tarifa(case when r.valor = 0 and v_lados = 1 then o.dinero else r.valor end, r.cartas) t;
      v_cert := v_cert or v_tipo = 'certificado';
    end loop;
    if v_lados = 1 then
      update public.trade_offers set envio_tipo = v_tipo, envio_precio = v_precio where id = o.id;
    else
      update public.trade_offers set envio_tipo = case when v_cert then 'certificado' else 'normal' end, envio_precio = 0 where id = o.id;
    end if;
  elsif o.envio = 'mano' then
    update public.trade_offers set envio_tipo = 'mano', envio_precio = 0 where id = o.id;
  end if;
  return public.cambio_contestar(p_oferta, 'aceptar');
end
$$;

revoke all on function public.cambio_aceptar(uuid, text) from public, anon;
grant execute on function public.cambio_aceptar(uuid, text) to authenticated;
grant execute on function public.cambio_envio_tarifa(numeric, int) to anon, authenticated;

commit;

notify pgrst, 'reload schema';
