-- ============================================================
-- Tandas 1065 y 1066: la analítica que se entiende.
--
-- PINGU: «¿cuánta gente entra desde la app instalada?… quiero mejorar la
-- analítica del panel: más sencilla de ver y con los datos que dicen si la
-- web mejora». Eligió lo recomendado de la propuesta («Analítica que se
-- entiende»): contar personas distintas sin identificar a nadie, el panel
-- en cuatro pestañas y un resumen el lunes en la campanita del equipo.
--
--   1. Cinco columnas en `page_views`, que manda la web (js/page-views.js):
--      · modo: 'app' si la página se abrió desde el icono instalado (el
--        navegador lo dice: display-mode standalone o navigator.standalone),
--        'web' si no.
--      · primera_del_dia: la primera carga de ESE navegador ese día. El
--        navegador guarda solo la fecha de su última visita; contar estas
--        filas es contar personas distintas al día, sin cookies ni
--        identificador.
--      · primera_en_app: la primera vez que ese navegador abre la web como
--        app = una instalación (en iPhone y en Android por igual).
--      · nueva_visita: la primera carga tras media hora sin entrar.
--      · plataforma: ios / android / otro (para las instalaciones).
--   2. `admin_analitica_resumen(p_dias)`: lo del Resumen, contado en la base.
--      La lee el panel (con `admin_analitica`, que no cambia) y la función
--      del lunes (con la clave de servicio).
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- ============================================================

-- ── 1. Las columnas nuevas ──
alter table public.page_views add column if not exists modo text;
alter table public.page_views add column if not exists primera_del_dia boolean;
alter table public.page_views add column if not exists primera_en_app boolean;
alter table public.page_views add column if not exists nueva_visita boolean;
alter table public.page_views add column if not exists plataforma text;

-- El insert está abierto a cualquiera: lo que llega se acota aquí también.
alter table public.page_views drop constraint if exists page_views_modo_valido;
alter table public.page_views add constraint page_views_modo_valido check (modo is null or modo in ('app', 'web'));
alter table public.page_views drop constraint if exists page_views_plataforma_valida;
alter table public.page_views add constraint page_views_plataforma_valida check (plataforma is null or plataforma in ('ios', 'android', 'otro'));

-- Las cuentas del Resumen van por estas filas: un índice parcial pequeño.
create index if not exists page_views_primera_dia_idx on public.page_views (created_at) where primera_del_dia;

-- ── 2. El Resumen ──
--
-- Todo en un periodo (`p_dias`) contra el anterior de la misma longitud:
--   personas            primeras del día (no robots), y cuántas desde la app
--   instalaciones       primeras en app, y por plataforma
--   activos             cuentas distintas que han entrado
--   acciones            lo que la gente HACE, de las tablas que ya existen:
--                       líneas nuevas de colección, deseos, retos jugados,
--                       mensajes del foro, guías/cursos terminados y partidas
--   altas               quien se registró en el periodo, y de ellas cuántas
--                       hicieron algo en sus 7 primeros días, cuántas
--                       añadieron una carta y cuántas volvieron tras la
--                       primera semana
--   salud               errores del navegador por día, páginas rotas y el
--                       p75 del LCP (lo de «Lo que tarda de verdad»)
--   por_dia             personas por día, web y app
--   medido_desde        la primera fila con `primera_del_dia`: antes de eso
--                       no hay personas ni app que contar, y el panel lo dice
--
-- La lee el equipo (is_admin) y la clave de servicio (la función del lunes):
-- `auth.role()` sale del JWT, así que vale dentro de `security definer`.
create or replace function public.admin_analitica_resumen(p_dias integer default 7)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_dias integer := greatest(1, least(coalesce(p_dias, 7), 365));
  v_desde timestamptz := now() - make_interval(days => v_dias);
  v_antes timestamptz := now() - make_interval(days => v_dias * 2);
  v_res jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(is_admin(), false) then
    raise exception 'Solo el equipo puede ver la analítica' using errcode = '42501';
  end if;

  with
  pv as (
    select created_at, user_id, modo, primera_del_dia, primera_en_app, nueva_visita, plataforma
    from page_views
    where created_at >= v_antes and is_bot = false
  ),
  ahora as (select * from pv where created_at >= v_desde),
  antes as (select * from pv where created_at < v_desde),
  dias as (
    select d::date as dia
    from generate_series((now() at time zone 'Europe/Madrid')::date - (v_dias - 1), (now() at time zone 'Europe/Madrid')::date, interval '1 day') d
  ),
  por_dia as (
    select d.dia,
      count(a.*) filter (where a.primera_del_dia and a.modo is distinct from 'app') as web,
      count(a.*) filter (where a.primera_del_dia and a.modo = 'app') as app
    from dias d
    left join ahora a on (a.created_at at time zone 'Europe/Madrid')::date = d.dia
    group by d.dia
  ),
  -- Lo que hace la gente: una fila por cosa hecha, con su momento.
  hechos as (
    select 'cartas'::text as que, created_at, user_id from user_collection where created_at >= v_antes
    union all select 'deseos', created_at, user_id from user_wants where created_at >= v_antes
    union all select 'retos', created_at, user_id from retos_resultados where created_at >= v_antes
    union all select 'foro', created_at, author_id from forum_posts where created_at >= v_antes
    union all select 'guias', completed_at, user_id from user_progress where completed_at >= v_antes
    union all select 'partidas', created_at, user_id from match_log where created_at >= v_antes
  ),
  altas as (select id, created_at from user_profiles where created_at >= v_antes),
  altas_cuentan as (
    select a.id, a.created_at >= v_desde as ahora,
      exists (select 1 from hechos h where h.user_id = a.id and h.created_at < a.created_at + interval '7 days') as hacen,
      exists (select 1 from user_collection c where c.user_id = a.id and c.created_at < a.created_at + interval '7 days') as carta,
      exists (select 1 from page_views v where v.user_id = a.id and v.created_at >= a.created_at + interval '7 days') as vuelven
    from altas a
  )
  select jsonb_build_object(
    'dias', v_dias,
    'medido_desde', (select min(created_at) from page_views where primera_del_dia is not null),
    'personas', (select count(*) from ahora where primera_del_dia),
    'personas_antes', (select count(*) from antes where primera_del_dia),
    'personas_app', (select count(*) from ahora where primera_del_dia and modo = 'app'),
    'personas_app_antes', (select count(*) from antes where primera_del_dia and modo = 'app'),
    'visitas', (select count(*) from ahora where nueva_visita),
    'instalaciones', (select count(*) from ahora where primera_en_app),
    'instalaciones_antes', (select count(*) from antes where primera_en_app),
    'instalaciones_por', coalesce((select jsonb_object_agg(coalesce(plataforma, 'otro'), n) from (select plataforma, count(*) as n from ahora where primera_en_app group by plataforma) x), '{}'::jsonb),
    'activos', (select count(distinct user_id) from ahora),
    'activos_antes', (select count(distinct user_id) from antes),
    'registrados', (select count(*) from user_profiles),
    'acciones', coalesce((
      select jsonb_object_agg(que, jsonb_build_object('n', n, 'antes', m))
      from (
        select q.que,
          (select count(*) from hechos h where h.que = q.que and h.created_at >= v_desde) as n,
          (select count(*) from hechos h where h.que = q.que and h.created_at < v_desde) as m
        from (values ('cartas'), ('deseos'), ('retos'), ('foro'), ('guias'), ('partidas')) q(que)
      ) t), '{}'::jsonb),
    'altas', jsonb_build_object(
      'n', (select count(*) from altas_cuentan where ahora),
      'hacen', (select count(*) from altas_cuentan where ahora and hacen),
      'carta', (select count(*) from altas_cuentan where ahora and carta),
      'vuelven', (select count(*) from altas_cuentan where ahora and vuelven),
      'n_antes', (select count(*) from altas_cuentan where not ahora),
      'hacen_antes', (select count(*) from altas_cuentan where not ahora and hacen)
    ),
    'salud', jsonb_build_object(
      'errores', (select count(*) from client_errors where created_at >= v_desde),
      'errores_antes', (select count(*) from client_errors where created_at >= v_antes and created_at < v_desde),
      'rotos', (select count(distinct ruta) from enlaces_rotos where created_at >= v_desde and desde like '/%'),
      'lcp_p75', (select round(percentile_cont(0.75) within group (order by lcp_ms)) from page_vitals where created_at >= v_desde and lcp_ms is not null)
    ),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'web', web, 'app', app) order by dia) from por_dia), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

revoke all on function public.admin_analitica_resumen(integer) from public;
grant execute on function public.admin_analitica_resumen(integer) to authenticated, service_role;

notify pgrst, 'reload schema';
