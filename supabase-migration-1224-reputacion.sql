-- Tanda 1224: la reputación en los cambios (PINGU: «al hacer un trade, venta
-- o compra, deberías poder ver que has hecho eso para que otros usuarios vean
-- que has completado trades… y así ver que eres confiable»).
--
-- 1. `reputacion_de(p_user)`: lo que `cambios_de` (795) ya daba —tratos
--    hechos y cuántos dijo el otro que fueron bien— más cuántos dijo que
--    hubo un problema, cuántos fueron cambio, venta o compra (lo dice la
--    propuesta que lo cerró; un «Cambio hecho» de Mensajes, sin propuesta,
--    cuenta como cambio) y el primero y el último. Con quién, nunca.
--    La web pinta los niveles (js/cambios-hechos.js, `nivelDe`); los
--    problemas no salen en público: con alguno, sale el tanto por ciento.
-- 2. Tres logros: «Primer trato», «Diez tratos» y «Muy de fiar».
--
-- Sin esta migración la web sigue con `cambios_de` (sin tipos ni fechas).
-- Se puede ejecutar más de una vez. Cada sentencia va sola (el SQL Editor
-- puede mandarlas por separado, la 631): nada de tablas temporales.

create or replace function public.reputacion_de(p_user uuid)
returns table (
  hechos bigint,
  bien bigint,
  problemas bigint,
  cambios bigint,
  ventas bigint,
  compras bigint,
  primero timestamptz,
  ultimo timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with mias as (
    select
      c.id,
      greatest(c.hecho_a_at, c.hecho_b_at) as cuando,
      -- Lo que dijo EL OTRO de este trato.
      case when c.user_a = p_user then c.valoracion_b else c.valoracion_a end as suya
    from public.trade_confirmations c
    where p_user in (c.user_a, c.user_b)
      and c.hecho_a_at is not null
      and c.hecho_b_at is not null
  ),
  con_tipo as (
    select
      m.cuando,
      m.suya,
      (
        select case
          when bool_or(i.quien = p_user) and bool_or(i.quien <> p_user) then 'cambio'
          when bool_or(i.quien = p_user) then 'venta'
          when bool_or(i.quien <> p_user) then 'compra'
        end
        from public.trade_offers o
        join public.trade_offer_items i on i.oferta = o.id
        where o.confirmacion = m.id
      ) as tipo
    from mias m
  )
  select
    count(*),
    count(*) filter (where suya = 'bien'),
    count(*) filter (where suya = 'problema'),
    count(*) filter (where coalesce(tipo, 'cambio') = 'cambio'),
    count(*) filter (where tipo = 'venta'),
    count(*) filter (where tipo = 'compra'),
    min(cuando),
    max(cuando)
  from con_tipo
$$;

grant execute on function public.reputacion_de(uuid) to anon, authenticated;

insert into public.achievement_definitions (id, title, description, emoji, rarity, xp_reward, is_active, condition)
values
  ('cambios_1', 'Primer trato', 'Has cerrado tu primer trato (un cambio, una venta o una compra) con alguien de PokeDoc.', 'refreshCw', 'bronze', 25, true, '{"type": "trades_done_count", "count": 1}'::jsonb),
  ('cambios_10', 'Diez tratos', 'Has cerrado 10 tratos con otras personas de PokeDoc.', 'refreshCw', 'silver', 75, true, '{"type": "trades_done_count", "count": 10}'::jsonb),
  ('muy_de_fiar', 'Muy de fiar', 'Has cerrado 20 tratos o más y al menos el 95 % dijo que todo fue bien.', 'shield', 'gold', 150, true, '{"type": "trades_trusted", "count": 1}'::jsonb)
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  emoji = excluded.emoji,
  rarity = excluded.rarity,
  xp_reward = excluded.xp_reward,
  condition = excluded.condition;
