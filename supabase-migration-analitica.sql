-- ============================================================
-- Tanda 848: analítica mejor, sin cookies y sin identificar a nadie.
--
-- PINGU: «dale, hazla toda y ponme el panel en el admin mucho más bonito
-- y visual». Cuatro cosas nuevas, todas sin un identificador de visitante:
--
--   1. De dónde llega la gente: `page_views.origen` es solo el DOMINIO de
--      procedencia ya traducido («google», «instagram», «telegram»…),
--      «directo» si no hay, o «interno» si viene de otra página nuestra.
--      `campana` es el `utm_source` del enlace (los que compartes tú).
--   2. Móvil o PC: `page_views.aparato` (movil / tablet / pc), por el
--      ancho de la pantalla.
--   3. Qué se busca: `busquedas` apunta lo que alguien escribe en el
--      buscador de la web y cuántos resultados salen. Sin usuario.
--   4. Páginas rotas: `enlaces_rotos` apunta la dirección que dio 404 y
--      desde dónde se llegó (una página nuestra = un enlace roto nuestro).
--
-- Y `admin_analitica(p_dias)` lo cuenta TODO en la base para el panel: la
-- vieja pedía las visitas de mil en mil al navegador.
--
-- Se puede ejecutar más de una vez. Sin tablas temporales (la 631).
-- ============================================================

-- ── 1 y 2. Columnas nuevas en las visitas ──
alter table public.page_views add column if not exists origen text;
alter table public.page_views add column if not exists campana text;
alter table public.page_views add column if not exists aparato text;

-- Lo que llega del navegador se acota en la base también: el insert está
-- abierto a cualquiera.
alter table public.page_views drop constraint if exists page_views_origen_largo;
alter table public.page_views add constraint page_views_origen_largo check (origen is null or char_length(origen) <= 60);
alter table public.page_views drop constraint if exists page_views_campana_largo;
alter table public.page_views add constraint page_views_campana_largo check (campana is null or char_length(campana) <= 40);
alter table public.page_views drop constraint if exists page_views_aparato_valido;
alter table public.page_views add constraint page_views_aparato_valido check (aparato is null or aparato in ('movil', 'tablet', 'pc'));

-- ── 3. Búsquedas ──
create table if not exists public.busquedas (
  id bigint generated always as identity primary key,
  q text not null check (char_length(q) between 2 and 80),
  resultados integer not null default 0 check (resultados >= 0),
  donde text check (donde is null or char_length(donde) <= 60),
  created_at timestamptz not null default now()
);
create index if not exists busquedas_created_at_idx on public.busquedas (created_at);
alter table public.busquedas enable row level security;
drop policy if exists "busquedas_insert_anyone" on public.busquedas;
create policy "busquedas_insert_anyone" on public.busquedas for insert to anon, authenticated with check (true);
-- La de leer va en la misma migración (la 510): sin ella el panel leería
-- cero filas y diría «nadie ha buscado nada».
drop policy if exists "busquedas_admin_select" on public.busquedas;
create policy "busquedas_admin_select" on public.busquedas for select to authenticated using (is_admin());
grant insert on public.busquedas to anon, authenticated;
grant select on public.busquedas to authenticated;

-- ── 4. Páginas rotas ──
create table if not exists public.enlaces_rotos (
  id bigint generated always as identity primary key,
  ruta text not null check (char_length(ruta) between 1 and 200),
  desde text check (desde is null or char_length(desde) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists enlaces_rotos_created_at_idx on public.enlaces_rotos (created_at);
alter table public.enlaces_rotos enable row level security;
drop policy if exists "enlaces_rotos_insert_anyone" on public.enlaces_rotos;
create policy "enlaces_rotos_insert_anyone" on public.enlaces_rotos for insert to anon, authenticated with check (true);
drop policy if exists "enlaces_rotos_admin_select" on public.enlaces_rotos;
create policy "enlaces_rotos_admin_select" on public.enlaces_rotos for select to authenticated using (is_admin());
grant insert on public.enlaces_rotos to anon, authenticated;
grant select on public.enlaces_rotos to authenticated;

-- ── El panel: todo contado en la base ──
--
-- «Personas» es `is_bot = false`: las filas de antes de la 541 (sin
-- clasificar) no entran en lo nuevo, que de todas formas no tenían origen.
-- Las semanas y las horas van en hora de Madrid, que es donde vive la web.
create or replace function public.admin_analitica(p_dias integer default 7)
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
  if not coalesce(is_admin(), false) then
    raise exception 'Solo el equipo puede ver la analítica' using errcode = '42501';
  end if;

  with
  vistas as (
    select v.created_at, v.user_id, v.origen, v.campana, v.aparato,
      case
        when v.path in ('/index.html', '/index', '') then '/'
        when v.path like '/usuario/%' or v.path = '/usuario.html' then '/usuario'
        when v.path like '/tema/%' or v.path = '/tema.html' then '/tema'
        else coalesce(nullif(regexp_replace(regexp_replace(v.path, '\.html$', ''), '/+$', ''), ''), '/')
      end as ruta
    from page_views v
    where v.created_at >= v_antes and v.is_bot = false
  ),
  ahora as (select * from vistas where created_at >= v_desde),
  antes as (select * from vistas where created_at < v_desde),
  dias as (
    select d::date as dia
    from generate_series((now() at time zone 'Europe/Madrid')::date - (v_dias - 1), (now() at time zone 'Europe/Madrid')::date, interval '1 day') d
  ),
  por_dia as (
    select d.dia,
      count(a.*) filter (where a.created_at is not null) as personas,
      count(a.user_id) as con_sesion
    from dias d
    left join ahora a on (a.created_at at time zone 'Europe/Madrid')::date = d.dia
    group by d.dia
  ),
  -- Una «entrada» es una carga que no viene de otra página nuestra: lo más
  -- parecido a una visita sin poner un identificador.
  entradas as (select * from ahora where origen is not null and origen <> 'interno'),
  semanas as (
    select generate_series(date_trunc('week', now() at time zone 'Europe/Madrid') - interval '7 weeks', date_trunc('week', now() at time zone 'Europe/Madrid'), interval '1 week') as semana
  ),
  activos as (
    select distinct date_trunc('week', v.created_at at time zone 'Europe/Madrid') as semana, v.user_id
    from page_views v
    where v.user_id is not null and v.is_bot is not true
      and v.created_at >= (date_trunc('week', now() at time zone 'Europe/Madrid') - interval '7 weeks') at time zone 'Europe/Madrid'
  ),
  retencion as (
    select s.semana,
      (select count(*) from activos a where a.semana = s.semana) as activos,
      case when s.semana + interval '1 week' > date_trunc('week', now() at time zone 'Europe/Madrid') then null
        else (select count(*) from activos a where a.semana = s.semana
              and exists (select 1 from activos b where b.user_id = a.user_id and b.semana = s.semana + interval '1 week')) end as vuelven,
      (select count(*) from user_profiles p where date_trunc('week', p.created_at at time zone 'Europe/Madrid') = s.semana) as altas
    from semanas s
  ),
  horas as (
    select extract(isodow from created_at at time zone 'Europe/Madrid')::int as dia,
      extract(hour from created_at at time zone 'Europe/Madrid')::int as hora,
      count(*) as n
    from ahora group by 1, 2
  ),
  bus as (select * from busquedas where created_at >= v_desde),
  rotos as (select * from enlaces_rotos where created_at >= v_desde)
  select jsonb_build_object(
    'dias', v_dias,
    'resumen', jsonb_build_object(
      'personas', (select count(*) from ahora),
      'personas_antes', (select count(*) from antes),
      'entradas', (select count(*) from entradas),
      'entradas_antes', (select count(*) from antes where origen is not null and origen <> 'interno'),
      'activos', (select count(distinct user_id) from ahora),
      'activos_antes', (select count(distinct user_id) from antes),
      'con_sesion', (select count(*) from ahora where user_id is not null),
      'robots', (select count(*) from page_views where created_at >= v_desde and is_bot = true),
      'altas', (select count(*) from user_profiles where created_at >= v_desde),
      'altas_antes', (select count(*) from user_profiles where created_at >= v_antes and created_at < v_desde),
      'registrados', (select count(*) from user_profiles),
      'con_aparato', (select count(*) from ahora where aparato is not null),
      'movil', (select count(*) from ahora where aparato = 'movil')
    ),
    'por_dia', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'personas', personas, 'con_sesion', con_sesion) order by dia) from por_dia), '[]'::jsonb),
    'origenes', coalesce((select jsonb_agg(jsonb_build_object('origen', origen, 'n', n) order by n desc) from (select origen, count(*) as n from entradas group by origen order by count(*) desc limit 12) o), '[]'::jsonb),
    'campanas', coalesce((select jsonb_agg(jsonb_build_object('campana', campana, 'n', n) order by n desc) from (select campana, count(*) as n from ahora where campana is not null group by campana order by count(*) desc limit 10) c), '[]'::jsonb),
    'aparatos', coalesce((select jsonb_agg(jsonb_build_object('aparato', aparato, 'n', n) order by n desc) from (select aparato, count(*) as n from ahora where aparato is not null group by aparato) x), '[]'::jsonb),
    'paginas', coalesce((select jsonb_agg(jsonb_build_object('ruta', ruta, 'n', n) order by n desc) from (select ruta, count(*) as n from ahora group by ruta order by count(*) desc limit 15) p), '[]'::jsonb),
    'retencion', coalesce((select jsonb_agg(jsonb_build_object('semana', (semana)::date, 'activos', activos, 'vuelven', vuelven, 'altas', altas) order by semana) from retencion), '[]'::jsonb),
    'horas', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'hora', hora, 'n', n)) from horas), '[]'::jsonb),
    'busquedas', jsonb_build_object(
      'total', (select count(*) from bus),
      'vacias', (select count(*) from bus where resultados = 0),
      'top', coalesce((select jsonb_agg(jsonb_build_object('q', q, 'n', n, 'vacias', vacias) order by n desc) from (select q, count(*) as n, count(*) filter (where resultados = 0) as vacias from bus group by q order by count(*) desc limit 15) t), '[]'::jsonb),
      'sin_resultado', coalesce((select jsonb_agg(jsonb_build_object('q', q, 'n', n) order by n desc) from (select q, count(*) as n from bus where resultados = 0 group by q order by count(*) desc limit 15) t), '[]'::jsonb)
    ),
    'rotos', coalesce((select jsonb_agg(jsonb_build_object('ruta', ruta, 'n', n, 'desde', desde, 'ultima', ultima) order by n desc) from (
      select ruta, count(*) as n, max(created_at) as ultima,
        (select r2.desde from rotos r2 where r2.ruta = r.ruta and r2.desde is not null group by r2.desde order by count(*) desc limit 1) as desde
      from rotos r group by ruta order by count(*) desc limit 15) z), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

revoke all on function public.admin_analitica(integer) from public;
grant execute on function public.admin_analitica(integer) to authenticated;

notify pgrst, 'reload schema';
