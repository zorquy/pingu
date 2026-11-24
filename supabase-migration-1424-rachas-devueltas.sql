-- Tanda 1424 — Devolver las rachas que se perdieron con protectores guardados.
--
-- Hasta la 1424, un protector solo perdonaba perder EXACTAMENTE un día: quien
-- faltaba dos días con dos protectores perdía la racha y se quedaba con los
-- protectores (se lo pasó a sergio.m, y lo contó). La regla nueva —cada
-- protector cubre un día— no devuelve sola lo que ya se perdió, porque la
-- racha no guarda historia: este SQL la rehace con las visitas.
--
-- Cómo: los días (UTC, como la racha) en que cada persona abrió la web salen
-- de page_views (se apunta en la misma carga que cuenta la racha, js/app.js).
-- Con esos días se repasa la historia DOS veces: con la regla de antes y con
-- la de ahora (los protectores existen desde el 2026-08-25; antes, cualquier
-- día perdido reiniciaba en las dos). Lo que la regla nueva da DE MÁS sobre
-- la vieja es lo que se perdió por el fallo, y eso se suma a la racha que la
-- persona tiene hoy (sumar la diferencia, y no copiar la simulada, deja
-- intacto lo que page_views no ve: rachas de antes de agosto, un día sin
-- apuntar…). Los protectores quedan los de la regla nueva.
--
-- Solo sube rachas, nunca las baja, y no toca tiendas (no tienen racha).
-- Y solo a quien «cuadra»: su racha de hoy es la que da la regla de antes con
-- sus visitas. Eso hace que ejecutarla dos veces no sume dos veces (tras la
-- primera ya no cuadra) y deja fuera a quien page_views no explica; la
-- sentencia 1 los enseña igual, con cuadra_con_la_web = false, para mirarlos.
--
-- CUÁNDO: ANTES de subir la 1424. Después, los días nuevos ya irían con la
-- regla nueva y la cuenta de «la de antes» saldría mal.
--
-- Son DOS sentencias. La 1 solo mira: quién sale y cuánto. La 2 cambia.

-- ── 1. Mirar (no cambia nada) ──
with recursive
dias as (
  select distinct v.user_id as u, (v.created_at at time zone 'utc')::date as d
  from page_views v
  join user_profiles p on p.id = v.user_id
  where p.current_streak > 0
    and (v.created_at at time zone 'utc')::date <= p.last_active_date
),
orden as (
  select u, d, row_number() over (partition by u order by d) as n from dias
),
sim as (
  select u, n, d, 1 as vieja, 0 as esc_vieja, 1 as nueva, 0 as esc_nueva
  from orden where n = 1
  union all
  select o.u, o.n, o.d, v.racha, v.esc, w.racha, w.esc
  from sim s
  join orden o on o.u = s.u and o.n = s.n + 1
  cross join lateral (select (o.d - s.d - 1) as perdidos, o.d >= date '2026-08-25' as con) x
  -- La regla de antes: un día perdido y un protector, sigue; si no, a 1.
  cross join lateral (
    select r as racha, case when x.con and r % 7 = 0 then least(e + 1, 2) else e end as esc
    from (select
      case when x.perdidos = 0 or (x.con and x.perdidos = 1 and s.esc_vieja > 0) then s.vieja + 1 else 1 end as r,
      case when x.perdidos = 1 and x.con and s.esc_vieja > 0 then s.esc_vieja - 1 else s.esc_vieja end as e) a
  ) v
  -- La de ahora: cada protector cubre un día.
  cross join lateral (
    select r as racha, case when x.con and r % 7 = 0 then least(e + 1, 2) else e end as esc
    from (select
      case when x.perdidos = 0 or (x.con and x.perdidos <= s.esc_nueva) then s.nueva + 1 else 1 end as r,
      case when x.perdidos > 0 and x.con and x.perdidos <= s.esc_nueva then s.esc_nueva - x.perdidos else s.esc_nueva end as e) b
  ) w
),
final as (
  select distinct on (u) u, d, vieja, nueva, esc_nueva from sim order by u, n desc
)
select p.username, p.current_streak as racha_hoy, p.streak_shields as protectores_hoy,
       f.nueva - f.vieja as dias_devueltos,
       p.current_streak + (f.nueva - f.vieja) as racha_nueva, f.esc_nueva as protectores_nuevos,
       (f.vieja = p.current_streak) as cuadra_con_la_web
from final f
join user_profiles p on p.id = f.u
where f.d = p.last_active_date and f.nueva > f.vieja
order by dias_devueltos desc;

-- ── 2. Devolver ──
with recursive
dias as (
  select distinct v.user_id as u, (v.created_at at time zone 'utc')::date as d
  from page_views v
  join user_profiles p on p.id = v.user_id
  where p.current_streak > 0
    and (v.created_at at time zone 'utc')::date <= p.last_active_date
),
orden as (
  select u, d, row_number() over (partition by u order by d) as n from dias
),
sim as (
  select u, n, d, 1 as vieja, 0 as esc_vieja, 1 as nueva, 0 as esc_nueva
  from orden where n = 1
  union all
  select o.u, o.n, o.d, v.racha, v.esc, w.racha, w.esc
  from sim s
  join orden o on o.u = s.u and o.n = s.n + 1
  cross join lateral (select (o.d - s.d - 1) as perdidos, o.d >= date '2026-08-25' as con) x
  cross join lateral (
    select r as racha, case when x.con and r % 7 = 0 then least(e + 1, 2) else e end as esc
    from (select
      case when x.perdidos = 0 or (x.con and x.perdidos = 1 and s.esc_vieja > 0) then s.vieja + 1 else 1 end as r,
      case when x.perdidos = 1 and x.con and s.esc_vieja > 0 then s.esc_vieja - 1 else s.esc_vieja end as e) a
  ) v
  cross join lateral (
    select r as racha, case when x.con and r % 7 = 0 then least(e + 1, 2) else e end as esc
    from (select
      case when x.perdidos = 0 or (x.con and x.perdidos <= s.esc_nueva) then s.nueva + 1 else 1 end as r,
      case when x.perdidos > 0 and x.con and x.perdidos <= s.esc_nueva then s.esc_nueva - x.perdidos else s.esc_nueva end as e) b
  ) w
),
final as (
  select distinct on (u) u, d, vieja, nueva, esc_nueva from sim order by u, n desc
)
update user_profiles p
set current_streak = p.current_streak + (f.nueva - f.vieja),
    streak_shields = f.esc_nueva
from final f
where p.id = f.u and f.d = p.last_active_date and f.nueva > f.vieja
  and f.vieja = p.current_streak;
