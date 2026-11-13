-- ESQUEMA ACTUAL de PokeDoc (tanda 1332, I3). GENERADO: no se edita a mano.
--
-- Solo para LEER cómo es hoy una tabla o una función sin recorrer las
-- migraciones. Lo que manda siguen siendo las supabase-migration-*.sql, que
-- es lo que un humano ejecuta. Se rehace con  node herramientas/esquema-actual.mjs
-- (rama pruebas), aplicando las 308 migraciones en el orden en que
-- entraron sobre un PostgreSQL vacío con lo justo de Supabase delante y la base
-- de partida del primer SCHEMA.md (las tablas de antes de la primera migración:
-- sus TIPOS son aproximados).
--
-- Sentencias que no entraron en esa base (lo suyo puede faltar aquí):
--   supabase-migration-telegram-torneos.sql (1)

--
-- PostgreSQL database dump
--

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;

--
-- Name: admin_analitica(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_analitica(p_dias integer DEFAULT 7) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
$_$;

--
-- Name: admin_analitica_resumen(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_analitica_resumen(p_dias integer DEFAULT 7) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: admin_aviso_avisar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_aviso_avisar(p_aviso uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_n int;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'solo el equipo puede avisar a todo el mundo'; end if;
  -- Se marca ANTES de avisar: si lo de después falla, se pierde un aviso; al
  -- revés, saldría dos veces (la 665).
  update avisos set avisado_at = now()
   where id = p_aviso and avisado_at is null and publicado and 'campanita' = any (sitios)
     and (desde is null or desde <= now()) and (hasta is null or hasta > now());
  if not found then return jsonb_build_object('ok', true, 'ya', true, 'personas', 0); end if;
  v_n := public.aviso_mandar(p_aviso, false);
  return jsonb_build_object('ok', true, 'personas', v_n);
end;
$$;

--
-- Name: admin_aviso_campanita(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_aviso_campanita(p_titulo text, p_cuerpo text DEFAULT NULL::text, p_enlace text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_titulo text := left(trim(coalesce(p_titulo, '')), 200);
  v_cuerpo text := nullif(left(trim(coalesce(p_cuerpo, '')), 500), '');
  v_enlace text := nullif(trim(coalesce(p_enlace, '')), '');
  v_n int;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede avisar a todo el mundo';
  end if;
  if v_titulo = '' then
    raise exception 'el aviso necesita un texto';
  end if;
  -- Un enlace de la casa (/algo) o de fuera (https://…); otra cosa, no.
  if v_enlace is not null and v_enlace !~ '^(/[^/]|/$|https://)' then
    raise exception 'el enlace tiene que empezar por / o por https://';
  end if;
  -- Dos veces el mismo aviso en una hora es un doble clic, no un aviso.
  if exists (
    select 1 from avisos_enviados
     where titulo = v_titulo and coalesce(enlace, '') = coalesce(v_enlace, '')
       and created_at > now() - interval '1 hour'
  ) then
    return jsonb_build_object('ok', true, 'ya', true, 'personas', 0);
  end if;

  insert into user_notifications (recipient_id, type, title, body, link)
  select p.id, 'aviso_equipo', v_titulo, v_cuerpo, v_enlace
    from user_profiles p
   where not ('aviso_equipo' = any (coalesce(p.notification_prefs_disabled, '{}'::text[])))
     and exists (select 1 from auth.users u where u.id = p.id);
  get diagnostics v_n = row_count;

  insert into avisos_enviados (titulo, cuerpo, enlace, personas, por)
  values (v_titulo, v_cuerpo, v_enlace, v_n, auth.uid());

  return jsonb_build_object('ok', true, 'personas', v_n);
end;
$_$;

--
-- Name: admin_aviso_participantes(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_aviso_participantes(p_aviso uuid) RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, created_at timestamp with time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'solo el equipo'; end if;
  return query
    select p.id, p.username, p.display_name, p.avatar_url, ap.created_at
      from aviso_participantes ap join user_profiles p on p.id = ap.user_id
     where ap.aviso_id = p_aviso
     order by ap.created_at;
end;
$$;

--
-- Name: admin_aviso_sortear(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_aviso_sortear(p_aviso uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_antes uuid;
  v_g uuid;
  v_total int;
  v_p record;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'solo el equipo'; end if;
  select ganador_id into v_antes from avisos where id = p_aviso;
  if not found then raise exception 'ese aviso no existe'; end if;
  select count(*) into v_total from aviso_participantes where aviso_id = p_aviso;
  if v_total = 0 then raise exception 'todavía no se ha apuntado nadie'; end if;
  select ap.user_id into v_g from aviso_participantes ap
   where ap.aviso_id = p_aviso and (v_antes is null or ap.user_id <> v_antes or v_total = 1)
   order by random() limit 1;
  update avisos set ganador_id = v_g, sorteado_at = now(), updated_at = now() where id = p_aviso;
  select id, username, display_name, avatar_url into v_p from user_profiles where id = v_g;
  return jsonb_build_object('total', v_total, 'ganador', jsonb_build_object(
    'id', v_g, 'username', v_p.username, 'display_name', v_p.display_name, 'avatar_url', v_p.avatar_url));
end;
$$;

--
-- Name: admin_correo_prueba(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_correo_prueba(p_tipo text, p_asunto text, p_cita text DEFAULT NULL::text, p_enlace text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede mandarse pruebas';
  end if;
  if coalesce(trim(p_tipo), '') = '' or coalesce(trim(p_asunto), '') = '' then
    raise exception 'falta el tipo o el asunto';
  end if;
  -- Cinco pruebas por hora como mucho: es un botón, y la cola es de verdad.
  if (select count(*) from email_outbox
       where recipient_id = auth.uid() and thread_key like 'prueba:%' and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'ya van cinco pruebas esta hora';
  end if;
  insert into email_outbox (recipient_id, type, subject, preview, link, thread_key)
  values (auth.uid(), left(p_tipo, 60), left(trim(p_asunto), 200), left(p_cita, 2000), left(p_enlace, 500), 'prueba:' || gen_random_uuid());
  return jsonb_build_object('ok', true);
end;
$$;

--
-- Name: admin_logro_dar(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_logro_dar(p_usuario uuid, p_logro text, p_motivo text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_titulo text;
  v_xp int;
  v_tenia boolean;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede dar logros';
  end if;
  select title, greatest(coalesce(xp_reward, 0), 0) into v_titulo, v_xp
    from achievement_definitions where id = p_logro;
  if v_titulo is null then
    raise exception 'ese logro no existe';
  end if;
  select coalesce(p_logro = any(achievements), false) into v_tenia
    from user_profiles where id = p_usuario;
  if v_tenia is null then
    raise exception 'esa persona no existe';
  end if;
  if v_tenia then
    return jsonb_build_object('ok', true, 'ya', true);
  end if;

  update user_profiles
     set achievements = array_append(coalesce(achievements, '{}'::text[]), p_logro),
         total_xp = coalesce(total_xp, 0) + v_xp,
         level = public.nivel_de_xp(coalesce(total_xp, 0) + v_xp)
   where id = p_usuario;

  insert into logros_a_mano (user_id, logro_id, accion, motivo, por)
  values (p_usuario, p_logro, 'dar', v_motivo, auth.uid());

  insert into user_notifications (recipient_id, type, title, body, link)
  values (p_usuario, 'logro', 'Tienes un logro nuevo: ' || v_titulo, v_motivo, '/perfil?ver=logros');

  return jsonb_build_object('ok', true, 'xp', v_xp);
end;
$$;

--
-- Name: admin_logro_quitar(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_logro_quitar(p_usuario uuid, p_logro text, p_motivo text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_xp int;
  v_tenia boolean;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede quitar logros';
  end if;
  select coalesce(p_logro = any(achievements), false) into v_tenia
    from user_profiles where id = p_usuario;
  if v_tenia is null then
    raise exception 'esa persona no existe';
  end if;
  if not v_tenia then
    return jsonb_build_object('ok', true, 'ya', true);
  end if;
  select greatest(coalesce(xp_reward, 0), 0) into v_xp from achievement_definitions where id = p_logro;
  v_xp := coalesce(v_xp, 0);

  -- Sin bajar de cero, y si era el destacado, deja de serlo.
  update user_profiles
     set achievements = array_remove(achievements, p_logro),
         total_xp = greatest(coalesce(total_xp, 0) - v_xp, 0),
         level = public.nivel_de_xp(greatest(coalesce(total_xp, 0) - v_xp, 0)),
         showcase_achievement = case when showcase_achievement = p_logro then null else showcase_achievement end
   where id = p_usuario;

  insert into logros_a_mano (user_id, logro_id, accion, motivo, por)
  values (p_usuario, p_logro, 'quitar', nullif(trim(coalesce(p_motivo, '')), ''), auth.uid());

  return jsonb_build_object('ok', true, 'xp', v_xp);
end;
$$;

--
-- Name: admin_moderar(uuid, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_moderar(p_usuario uuid, p_que text, p_motivo text DEFAULT NULL::text, p_dias integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_hasta timestamptz := case when p_dias is null or p_dias <= 0 then null else now() + make_interval(days => p_dias) end;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede moderar';
  end if;
  if p_que not in ('silencio', 'baneo') then
    raise exception 'qué: silencio o baneo';
  end if;
  if p_usuario = auth.uid() then
    raise exception 'a ti no';
  end if;
  if not exists (select 1 from user_profiles where id = p_usuario) then
    raise exception 'esa persona no existe';
  end if;
  -- La anterior del mismo tipo se cierra: manda la última.
  update moderaciones set quitada_at = now(), quitada_por = auth.uid()
   where user_id = p_usuario and que = p_que and quitada_at is null;
  insert into moderaciones (user_id, que, motivo, hasta, por)
  values (p_usuario, p_que, nullif(left(trim(coalesce(p_motivo, '')), 300), ''), v_hasta, auth.uid());
  if p_que = 'silencio' then
    update user_profiles set is_muted = true where id = p_usuario;
  else
    update user_profiles set is_banned = true where id = p_usuario;
  end if;
  return jsonb_build_object('ok', true, 'hasta', v_hasta);
end;
$$;

--
-- Name: admin_moderar_quitar(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_moderar_quitar(p_usuario uuid, p_que text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'solo el equipo puede moderar';
  end if;
  if p_que not in ('silencio', 'baneo') then
    raise exception 'qué: silencio o baneo';
  end if;
  update moderaciones set quitada_at = now(), quitada_por = auth.uid()
   where user_id = p_usuario and que = p_que and quitada_at is null;
  if p_que = 'silencio' then
    update user_profiles set is_muted = false where id = p_usuario;
  else
    update user_profiles set is_banned = false where id = p_usuario;
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

--
-- Name: admin_tienda_de_pruebas(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.admin_tienda_de_pruebas(p_tienda uuid, p_si boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if not coalesce(is_admin(), false) then
    raise exception 'Solo el equipo.' using errcode = '42501';
  end if;
  if not exists (select 1 from user_profiles where id = p_tienda and tipo = 'tienda') then
    raise exception 'Esa cuenta no es una tienda.' using errcode = '22023';
  end if;
  insert into tiendas (user_id, de_pruebas) values (p_tienda, coalesce(p_si, false))
  on conflict (user_id) do update set de_pruebas = excluded.de_pruebas, updated_at = now();
end;
$$;

--
-- Name: adviento_abrir(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adviento_abrir(p_dia integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_hoy date := public.adviento_hoy();
  v_anio int := extract(year from v_hoy)::int;
  v_filas int;
  v_xp int := 0;
  v_abiertas int;
  v_logro text := 'adviento_' || extract(year from v_hoy)::int;
  v_xp_logro int;
  v_tenia boolean;
  v_ganado text := null;
  v_total int;
begin
  if v_uid is null then
    raise exception 'hay que tener sesión para abrir el calendario';
  end if;
  if extract(month from v_hoy) <> 12 then
    raise exception 'el calendario de Adviento es de diciembre';
  end if;
  if p_dia is null or p_dia < 1 or p_dia > 24 or p_dia > extract(day from v_hoy) then
    raise exception 'esa casilla todavía no se puede abrir';
  end if;

  insert into adviento_casillas (user_id, anio, dia)
  values (v_uid, v_anio, p_dia)
  on conflict do nothing;
  get diagnostics v_filas = row_count;

  if v_filas > 0 then
    v_xp := 10;
    -- El nivel en el MISMO update (la 387): subir el XP sin tocar `level`
    -- deja la chapa vieja sin dar error.
    update user_profiles
       set total_xp = coalesce(total_xp, 0) + 10,
           level = public.nivel_de_xp(coalesce(total_xp, 0) + 10)
     where id = v_uid;
  end if;

  select count(*)::int into v_abiertas
    from adviento_casillas
   where user_id = v_uid and anio = v_anio;

  if v_abiertas >= 24 then
    select greatest(coalesce(xp_reward, 0), 0) into v_xp_logro
      from achievement_definitions
     where id = v_logro and coalesce(is_active, true);
    select coalesce(v_logro = any(achievements), false) into v_tenia
      from user_profiles where id = v_uid;
    if v_xp_logro is not null and not coalesce(v_tenia, true) then
      update user_profiles
         set achievements = array_append(coalesce(achievements, '{}'::text[]), v_logro),
             total_xp = coalesce(total_xp, 0) + v_xp_logro,
             level = public.nivel_de_xp(coalesce(total_xp, 0) + v_xp_logro)
       where id = v_uid;
      v_xp := v_xp + v_xp_logro;
      v_ganado := v_logro;
    end if;
  end if;

  select total_xp into v_total from user_profiles where id = v_uid;
  if v_total is null then
    raise exception 'no hay perfil para %', v_uid;
  end if;

  return jsonb_build_object('nueva', v_filas > 0, 'xp', v_xp, 'abiertas', v_abiertas, 'logro', v_ganado, 'total_xp', v_total);
end;
$$;

--
-- Name: adviento_hoy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.adviento_hoy() RETURNS date
    LANGUAGE sql STABLE
    AS $$ select (now() at time zone 'Europe/Madrid')::date $$;

--
-- Name: aviso_apuntarme(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aviso_apuntarme(p_aviso uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_yo uuid := auth.uid();
  v_n int;
  v_total int;
begin
  if v_yo is null then raise exception 'para apuntarte hace falta una cuenta'; end if;
  if not exists (select 1 from avisos a where a.id = p_aviso and a.participar) then
    raise exception 'en ese aviso no hay que apuntarse';
  end if;
  if not exists (
    select 1 from avisos a
     where a.id = p_aviso and a.publicado
       and (a.desde is null or a.desde <= now()) and (a.hasta is null or a.hasta > now())
  ) then raise exception 'ese aviso ya ha terminado'; end if;
  if exists (select 1 from user_profiles p where p.id = v_yo and p.tipo = 'tienda') then
    raise exception 'las cuentas de tienda no participan';
  end if;
  insert into aviso_participantes (aviso_id, user_id) values (p_aviso, v_yo) on conflict do nothing;
  get diagnostics v_n = row_count;
  select count(*) into v_total from aviso_participantes where aviso_id = p_aviso;
  return jsonb_build_object('ok', true, 'ya', v_n = 0, 'total', v_total);
end;
$$;

--
-- Name: aviso_contar(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aviso_contar(p_aviso uuid, p_que text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_dia date := (now() at time zone 'Europe/Madrid')::date;
begin
  if p_que not in ('visto', 'clic', 'cerrado') then return; end if;
  if not exists (
    select 1 from avisos a
     where a.id = p_aviso and a.publicado
       and (a.desde is null or a.desde <= now()) and (a.hasta is null or a.hasta > now())
  ) then return; end if;
  insert into aviso_cifras (aviso_id, dia, vistos, clics, cerrados)
  values (p_aviso, v_dia, (p_que = 'visto')::int, (p_que = 'clic')::int, (p_que = 'cerrado')::int)
  on conflict (aviso_id, dia) do update set
    vistos = aviso_cifras.vistos + excluded.vistos,
    clics = aviso_cifras.clics + excluded.clics,
    cerrados = aviso_cifras.cerrados + excluded.cerrados;
end;
$$;

--
-- Name: aviso_mandar(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aviso_mandar(p_aviso uuid, p_recordatorio boolean) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v record;
  v_titulo text;
  v_cuerpo text;
  v_n int;
begin
  select * into v from avisos where id = p_aviso;
  if not found or v.publico = 'sin_cuenta' then return 0; end if;
  v_titulo := left(case when p_recordatorio then 'Se acaba pronto: ' || v.titulo else v.titulo end, 200);
  v_cuerpo := case when p_recordatorio then (case when v.participar then 'Aún estás a tiempo de apuntarte.' else 'Aún estás a tiempo.' end)
                   else nullif(left(btrim(coalesce(v.texto, '')), 500), '') end;
  insert into user_notifications (recipient_id, type, title, body, link)
  select p.id, 'aviso_equipo', v_titulo, v_cuerpo, '/?aviso=' || v.id
    from user_profiles p
   where not ('aviso_equipo' = any (coalesce(p.notification_prefs_disabled, '{}'::text[])))
     and (coalesce(p.tipo, '') <> 'tienda' or v.tipo = 'mantenimiento')
     and exists (select 1 from auth.users u where u.id = p.id)
     and not (p_recordatorio and exists (select 1 from aviso_participantes ap where ap.aviso_id = v.id and ap.user_id = p.id));
  get diagnostics v_n = row_count;
  insert into avisos_enviados (titulo, cuerpo, enlace, personas, por)
  values (v_titulo, case when p_recordatorio then 'Recordatorio automático' else v_cuerpo end, '/?aviso=' || v.id, v_n, auth.uid());
  return v_n;
end;
$$;

--
-- Name: aviso_participacion(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aviso_participacion(p_aviso uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'total', (select count(*) from aviso_participantes where aviso_id = p_aviso),
    'yo', auth.uid() is not null and exists (select 1 from aviso_participantes where aviso_id = p_aviso and user_id = auth.uid()))
  where exists (select 1 from avisos a where a.id = p_aviso and a.participar and a.publicado)
$$;

--
-- Name: avisos_al_dia(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.avisos_al_dia(p_ahora timestamp with time zone DEFAULT now()) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v record;
  v_total int := 0;
  v_hora int := extract(hour from p_ahora at time zone 'Europe/Madrid');
begin
  if v_hora < 10 or v_hora >= 22 then return 0; end if;
  for v in
    select id from avisos a
     where a.publicado and 'campanita' = any (a.sitios) and a.avisado_at is null
       and (a.desde is null or a.desde <= p_ahora) and (a.hasta is null or a.hasta > p_ahora)
     for update skip locked
  loop
    update avisos set avisado_at = p_ahora where id = v.id;
    v_total := v_total + public.aviso_mandar(v.id, false);
  end loop;
  for v in
    select id from avisos a
     where a.publicado and a.recordar and 'campanita' = any (a.sitios) and a.recordado_at is null
       and a.hasta is not null and a.hasta > p_ahora and a.hasta <= p_ahora + interval '30 hours'
       and (a.desde is null or a.desde <= p_ahora)
       -- Si acaba de salir, el aviso de salida ya hace de recordatorio.
       and (a.avisado_at is null or a.avisado_at < p_ahora - interval '12 hours')
     for update skip locked
  loop
    update avisos set recordado_at = p_ahora where id = v.id;
    v_total := v_total + public.aviso_mandar(v.id, true);
  end loop;
  return v_total;
end;
$$;

--
-- Name: calendario_cambiar_clave(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calendario_cambiar_clave() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  perform public.calendario_mio();
  update public.calendario_claves set clave = public.calendario_clave_nueva(), creada_at = now() where user_id = auth.uid();
  return public.calendario_mio();
end $$;

--
-- Name: calendario_clave_nueva(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calendario_clave_nueva() RETURNS text
    LANGUAGE sql
    AS $$
  select replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')
$$;

--
-- Name: calendario_de(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calendario_de(p_clave text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  c public.calendario_claves;
  v_torneos jsonb := '[]'::jsonb;
  v_eventos jsonb := '[]'::jsonb;
  v_lanz jsonb := '[]'::jsonb;
begin
  if p_clave is null or length(p_clave) < 32 then
    return null;
  end if;
  select * into c from public.calendario_claves where clave = p_clave;
  if not found then
    return null;
  end if;
  if c.torneos then
    -- `matchday_dates` va por to_jsonb: si una base no tiene la columna, no
    -- se rompe la función entera.
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', t.id, 'nombre', t.name, 'empieza', t.start_at,
             'jornadas', coalesce(to_jsonb(t) -> 'matchday_dates', '[]'::jsonb)) order by t.start_at), '[]'::jsonb)
      into v_torneos
      from public.tournaments t
      join public.tournament_registrations r on r.tournament_id = t.id
     where r.user_id = c.user_id
       and r.status <> 'dropped'
       and t.status <> 'cancelled'
       and t.start_at > now() - interval '180 days';
  end if;
  if c.eventos then
    select coalesce(jsonb_agg(jsonb_build_object(
             'slug', e.slug, 'nombre', e.nombre, 'empieza', e.empieza, 'termina', e.termina,
             'sitio', e.sitio, 'direccion', e.direccion, 'ciudad', e.ciudad,
             'horario', to_jsonb(e) -> 'horario') order by e.empieza), '[]'::jsonb)
      into v_eventos
      from public.eventos e
      join public.evento_asistentes a on a.evento_id = e.id
     where a.user_id = c.user_id
       and coalesce(e.termina, e.empieza) > now() - interval '30 days';
  end if;
  if c.lanzamientos then
    -- Los de los catálogos en los que tienes cartas (o el occidental).
    select coalesce(jsonb_agg(jsonb_build_object('id', s.id, 'nombre', s.name, 'dia', s.release_date, 'market', s.market) order by s.release_date), '[]'::jsonb)
      into v_lanz
      from public.tcg_sets s
     where s.release_date between current_date - 7 and current_date + 180
       and s.market in (
         select distinct uc.market from public.user_collection uc where uc.user_id = c.user_id
         union select 'WEST'
       );
  end if;
  return jsonb_build_object('torneos', v_torneos, 'eventos', v_eventos, 'lanzamientos', v_lanz);
end $$;

--
-- Name: calendario_mio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calendario_mio() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v public.calendario_claves;
begin
  if auth.uid() is null then
    raise exception 'Hay que entrar en tu cuenta.';
  end if;
  insert into public.calendario_claves (user_id, clave) values (auth.uid(), public.calendario_clave_nueva())
  on conflict (user_id) do nothing;
  select * into v from public.calendario_claves where user_id = auth.uid();
  return jsonb_build_object('clave', v.clave, 'torneos', v.torneos, 'eventos', v.eventos, 'lanzamientos', v.lanzamientos);
end $$;

--
-- Name: calendario_poner(boolean, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calendario_poner(p_torneos boolean, p_eventos boolean, p_lanzamientos boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  perform public.calendario_mio();
  update public.calendario_claves
     set torneos = coalesce(p_torneos, torneos),
         eventos = coalesce(p_eventos, eventos),
         lanzamientos = coalesce(p_lanzamientos, lanzamientos)
   where user_id = auth.uid();
  return public.calendario_mio();
end $$;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: trade_offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_offers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    de uuid NOT NULL,
    para uuid NOT NULL,
    estado text DEFAULT 'enviada'::text NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    anterior uuid,
    dinero numeric(10,2) DEFAULT 0 NOT NULL,
    dinero_paga text,
    dinero_como text,
    nota text,
    conversacion uuid,
    aceptada_at timestamp with time zone,
    recibido_de_at timestamp with time zone,
    recibido_para_at timestamp with time zone,
    hecha_at timestamp with time zone,
    deshacer_hasta timestamp with time zone,
    movimientos jsonb,
    confirmacion uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    envio text,
    envio_tipo text,
    envio_precio numeric(10,2),
    enviado_de_at timestamp with time zone,
    enviado_para_at timestamp with time zone,
    seguimiento_de text,
    seguimiento_para text,
    CONSTRAINT trade_offers_check CHECK ((de <> para)),
    CONSTRAINT trade_offers_check1 CHECK (((dinero = (0)::numeric) = (dinero_paga IS NULL))),
    CONSTRAINT trade_offers_dinero_check CHECK (((dinero >= (0)::numeric) AND (dinero <= (100000)::numeric))),
    CONSTRAINT trade_offers_dinero_como_check CHECK ((dinero_como = ANY (ARRAY['bizum'::text, 'mano'::text, 'paypal'::text, 'otro'::text]))),
    CONSTRAINT trade_offers_dinero_paga_check CHECK ((dinero_paga = ANY (ARRAY['de'::text, 'para'::text]))),
    CONSTRAINT trade_offers_envio_check CHECK ((envio = ANY (ARRAY['mano'::text, 'correo'::text]))),
    CONSTRAINT trade_offers_envio_precio_check CHECK (((envio_precio IS NULL) OR (envio_precio >= (0)::numeric))),
    CONSTRAINT trade_offers_envio_tipo_check CHECK ((envio_tipo = ANY (ARRAY['mano'::text, 'normal'::text, 'certificado'::text]))),
    CONSTRAINT trade_offers_estado_check CHECK ((estado = ANY (ARRAY['enviada'::text, 'aceptada'::text, 'rechazada'::text, 'anulada'::text, 'cambiada'::text, 'hecha'::text]))),
    CONSTRAINT trade_offers_nota_check CHECK ((char_length(nota) <= 500)),
    CONSTRAINT trade_offers_seguimiento_de_check CHECK (((seguimiento_de IS NULL) OR (char_length(seguimiento_de) <= 60))),
    CONSTRAINT trade_offers_seguimiento_para_check CHECK (((seguimiento_para IS NULL) OR (char_length(seguimiento_para) <= 60)))
);

--
-- Name: cambio_aceptar(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_aceptar(p_oferta uuid, p_envio text DEFAULT NULL::text) RETURNS public.trade_offers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: cambio_avisar(uuid, uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_avisar(p_oferta uuid, p_de uuid, p_para uuid, p_tipo text, p_titulo text, p_texto text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: cambio_cobro_poner(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_cobro_poner(p_oferta uuid, p_dato text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  v_otro uuid;
  v_dato text := btrim(coalesce(p_dato, ''));
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado not in ('enviada', 'aceptada') then raise exception 'Ese trato ya no está en marcha.'; end if;
  if coalesce(o.dinero_como, '') not in ('bizum', 'paypal') then raise exception 'Ese trato no se paga por Bizum ni por PayPal.'; end if;
  if public.cambio_quien_cobra(o.id) is distinct from yo then raise exception 'En ese trato no cobras tú.'; end if;
  if o.dinero_como = 'bizum' then
    v_dato := regexp_replace(v_dato, '[^0-9+]', '', 'g');
    if v_dato !~ '^\+?[0-9]{9,15}$' then raise exception 'Ese no parece un número de teléfono para Bizum.'; end if;
  elsif char_length(v_dato) < 3 or char_length(v_dato) > 120 or v_dato !~ '^(@?[A-Za-z0-9._-]+|[^@ ]+@[^@ ]+\.[^@ ]+|(https?://)?(www\.)?paypal\.me/[A-Za-z0-9._-]+)$' then
    raise exception 'Pon el email o el usuario de PayPal.';
  end if;
  v_otro := case when yo = o.de then o.para else o.de end;
  insert into public.trade_offer_cobros (oferta, quien, como, dato)
  values (o.id, yo, o.dinero_como, v_dato)
  on conflict (oferta, quien) do update set como = excluded.como, dato = excluded.dato, created_at = now();
  if o.estado = 'aceptada' then
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_cobro', 'Ya tienes cómo pagarle',
      case o.dinero_como when 'bizum' then 'Ya tienes mi Bizum para pagarme.' else 'Ya tienes mi PayPal para pagarme.' end);
  end if;
end
$_$;

--
-- Name: cambio_cobros(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_cobros(p_ofertas uuid[]) RETURNS TABLE(oferta uuid, quien uuid, como text, dato text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.oferta, c.quien, c.como, c.dato
  from public.trade_offer_cobros c
  join public.trade_offers o on o.id = c.oferta
  where c.oferta = any (p_ofertas)
    and auth.uid() in (o.de, o.para)
    and (c.quien = auth.uid() or o.estado in ('aceptada', 'hecha'))
    and not (o.estado in ('hecha', 'rechazada', 'anulada', 'cambiada') and coalesce(o.hecha_at, o.updated_at) < now() - interval '30 days')
$$;

--
-- Name: cambio_contestar(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_contestar(p_oferta uuid, p_accion text) RETURNS public.trade_offers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  it public.trade_offer_items;
  l public.user_collection;
  v_otro uuid;
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  v_otro := case when yo = o.de then o.para else o.de end;

  if p_accion = 'aceptar' then
    if o.estado <> 'enviada' or yo <> o.para then raise exception 'Esa propuesta ya no se puede aceptar.'; end if;
    for it in select * from public.trade_offer_items where oferta = o.id loop
      if it.linea is not null then
        select * into l from public.user_collection where id = it.linea and user_id = it.quien;
        if l.id is null or l.cantidad - public.cambio_reservadas_linea(l.id) < it.cantidad then
          raise exception 'Ya no quedan copias libres de % para este cambio: cámbiala o recházala.', it.card_id;
        end if;
      elsif it.pedida then
        -- Se la pedían y no la tenía en «doy»: si la tiene, esa copia.
        select * into l from public.user_collection
        where user_id = it.quien and card_id = it.card_id and market = it.market
        order by (idioma = it.idioma) desc, (estado = it.estado) desc, cantidad desc
        limit 1;
        if l.id is not null then
          update public.trade_offer_items
          set linea = l.id, idioma = l.idioma, estado = l.estado, variante = l.variante, gradeo = l.gradeo
          where id = it.id;
        end if;
      end if;
    end loop;
    update public.trade_offers set estado = 'aceptada', aceptada_at = now(), updated_at = now() where id = o.id returning * into o;
    -- Quien no recibe nada (regala una carta) no tiene nada que confirmar (1098).
    perform public.cambio_sin_esperar(o.id);
    select * into o from public.trade_offers where id = o.id;
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_aceptado', 'Han aceptado tu cambio',
      'He aceptado tu propuesta. Cuando te llegue lo mío, confírmalo en la propuesta y las cartas se mueven solas.');
  elsif p_accion = 'rechazar' then
    if o.estado <> 'enviada' or yo <> o.para then raise exception 'Esa propuesta ya no se puede rechazar.'; end if;
    update public.trade_offers set estado = 'rechazada', updated_at = now() where id = o.id returning * into o;
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_rechazado', 'Han rechazado tu cambio', 'No me cuadra esta propuesta de cambio.');
  elsif p_accion = 'anular' then
    if not ((o.estado = 'enviada' and yo = o.de) or o.estado = 'aceptada') then raise exception 'Esa propuesta ya no se puede anular.'; end if;
    update public.trade_offers set estado = 'anulada', updated_at = now() where id = o.id returning * into o;
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_anulado', 'Un cambio se ha anulado', 'He anulado la propuesta de cambio.');
  else
    raise exception 'No sé hacer eso con una propuesta.';
  end if;
  return o;
end
$$;

--
-- Name: cambio_conversacion(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_conversacion(p_a uuid, p_b uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v uuid;
begin
  select c1.conversation_id into v
  from public.conversation_participants c1
  join public.conversation_participants c2 on c2.conversation_id = c1.conversation_id
  where c1.user_id = p_a and c2.user_id = p_b
  limit 1;
  if v is null then
    insert into public.conversations default values returning id into v;
    insert into public.conversation_participants (conversation_id, user_id) values (v, p_a), (v, p_b);
  end if;
  return v;
end
$$;

--
-- Name: cambio_deshacer(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_deshacer(p_oferta uuid) RETURNS public.trade_offers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  m jsonb;
  v_otro uuid;
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado <> 'hecha' or o.deshacer_hasta is null or now() > o.deshacer_hasta then raise exception 'Ese cambio ya no se puede deshacer.'; end if;
  v_otro := case when yo = o.de then o.para else o.de end;
  for m in select x from jsonb_array_elements(coalesce(o.movimientos, '[]'::jsonb)) with ordinality as t(x, i) order by i desc loop
    if m->>'op' = 'creada' then
      delete from public.user_collection where id = (m->>'id')::uuid;
    elsif m->>'op' = 'sumada' then
      delete from public.user_collection where id = (m->>'id')::uuid and cantidad <= (m->>'n')::int;
      update public.user_collection set cantidad = cantidad - (m->>'n')::int where id = (m->>'id')::uuid and cantidad > (m->>'n')::int;
    elsif m->>'op' = 'restada' then
      update public.user_collection
      set cantidad = least(999, cantidad + (m->>'n')::int), cambio = least((m->>'cambio')::int, cantidad + (m->>'n')::int)
      where id = (m->>'id')::uuid;
    elsif m->>'op' = 'borrada' then
      insert into public.user_collection select * from jsonb_populate_record(null::public.user_collection, m->'fila') on conflict (id) do nothing;
    elsif m->>'op' = 'deseo' then
      insert into public.user_wants select * from jsonb_populate_record(null::public.user_wants, m->'fila') on conflict (id) do nothing;
    end if;
  end loop;
  if o.confirmacion is not null and to_regclass('public.trade_confirmations') is not null then
    execute 'delete from public.trade_confirmations where id = $1' using o.confirmacion;
  end if;
  update public.trade_offers
  set estado = 'aceptada', recibido_de_at = null, recibido_para_at = null, hecha_at = null,
      deshacer_hasta = null, movimientos = null, confirmacion = null, updated_at = now()
  where id = o.id
  returning * into o;
  perform public.cambio_sin_esperar(o.id);
  select * into o from public.trade_offers where id = o.id;
  perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_deshecho', 'Un cambio se ha deshecho', 'He deshecho el cambio: las cartas vuelven a donde estaban y sigue aceptado.');
  return o;
end
$_$;

--
-- Name: cambio_direccion_poner(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_direccion_poner(p_oferta uuid, p_dir jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  v_otro uuid;
  v_nombre text := btrim(coalesce(p_dir ->> 'nombre', ''));
  v_calle text := btrim(coalesce(p_dir ->> 'calle', ''));
  v_cp text := btrim(coalesce(p_dir ->> 'cp', ''));
  v_ciudad text := btrim(coalesce(p_dir ->> 'ciudad', ''));
  v_provincia text := nullif(btrim(coalesce(p_dir ->> 'provincia', '')), '');
  v_telefono text := nullif(btrim(coalesce(p_dir ->> 'telefono', '')), '');
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado not in ('enviada', 'aceptada') then raise exception 'Ese trato ya no está en marcha.'; end if;
  if o.envio is distinct from 'correo' or o.envio_tipo = 'mano' then raise exception 'Ese trato no va por correo.'; end if;
  if not exists (select 1 from public.trade_offer_items i where i.oferta = o.id and i.quien <> yo) then
    raise exception 'En ese trato no te mandan cartas: no hace falta tu dirección.';
  end if;
  if char_length(v_nombre) < 2 or char_length(v_calle) < 3 or char_length(v_cp) < 3 or char_length(v_ciudad) < 2 then
    raise exception 'Falta algo de la dirección: nombre, calle, código postal y ciudad.';
  end if;
  v_otro := case when yo = o.de then o.para else o.de end;
  insert into public.trade_offer_direcciones (oferta, quien, nombre, calle, cp, ciudad, provincia, telefono)
  values (o.id, yo, v_nombre, v_calle, v_cp, v_ciudad, v_provincia, v_telefono)
  on conflict (oferta, quien) do update
    set nombre = excluded.nombre, calle = excluded.calle, cp = excluded.cp, ciudad = excluded.ciudad,
        provincia = excluded.provincia, telefono = excluded.telefono, created_at = now();
  -- Con el trato aceptado, el otro ya puede mandarlo: se le dice.
  if o.estado = 'aceptada' then
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_direccion', 'Ya tienes su dirección', 'Ya tienes mi dirección para el envío.');
  end if;
end
$$;

--
-- Name: cambio_direcciones(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_direcciones(p_ofertas uuid[]) RETURNS TABLE(oferta uuid, quien uuid, nombre text, calle text, cp text, ciudad text, provincia text, telefono text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select d.oferta, d.quien, d.nombre, d.calle, d.cp, d.ciudad, d.provincia, d.telefono
  from public.trade_offer_direcciones d
  join public.trade_offers o on o.id = d.oferta
  where d.oferta = any (p_ofertas)
    and auth.uid() in (o.de, o.para)
    and (d.quien = auth.uid() or o.estado in ('aceptada', 'hecha'))
    and not (o.estado in ('hecha', 'rechazada', 'anulada', 'cambiada') and coalesce(o.hecha_at, o.updated_at) < now() - interval '30 days')
$$;

--
-- Name: cambio_direcciones_purgar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_direcciones_purgar() RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  delete from public.trade_offer_direcciones d
  using public.trade_offers o
  where o.id = d.oferta
    and o.estado in ('hecha', 'rechazada', 'anulada', 'cambiada')
    and coalesce(o.hecha_at, o.updated_at) < now() - interval '30 days';
  delete from public.trade_offer_cobros c
  using public.trade_offers o
  where o.id = c.oferta
    and o.estado in ('hecha', 'rechazada', 'anulada', 'cambiada')
    and coalesce(o.hecha_at, o.updated_at) < now() - interval '30 days';
$$;

--
-- Name: cambio_enviado(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_enviado(p_oferta uuid, p_seguimiento text DEFAULT NULL::text) RETURNS public.trade_offers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: cambio_envio_poner(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_envio_poner(p_oferta uuid, p_envio text) RETURNS public.trade_offers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: cambio_envio_precio(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_envio_precio(p_tipo text) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select case p_tipo when 'normal' then 2.00 when 'certificado' then 7.00 else 0 end::numeric(10, 2)
$$;

--
-- Name: cambio_envio_tarifa(numeric, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_envio_tarifa(p_valor numeric, p_cartas integer) RETURNS TABLE(tipo text, precio numeric)
    LANGUAGE plpgsql IMMUTABLE
    AS $$
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

--
-- Name: cambio_euros(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_euros(p numeric) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$ select replace(to_char(p, 'FM999990.00'), '.', ',') || ' €' $$;

--
-- Name: cambio_libres_de(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_libres_de(p_linea uuid, p_cambio integer, p_cantidad integer) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select greatest(0, least(coalesce(p_cambio, 0), coalesce(p_cantidad, 0) - coalesce((
    select sum(i.cantidad)
    from public.trade_offer_items i
    join public.trade_offers o on o.id = i.oferta
    where i.linea = p_linea and o.estado in ('enviada', 'aceptada')
  ), 0)))::int
$$;

--
-- Name: cambio_lo_que_da(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_lo_que_da(p_user uuid) RETURNS TABLE(id uuid, card_id text, market text, idioma text, estado text, variante text, gradeo text, cambio integer, libres integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.id, c.card_id, c.market, c.idioma, c.estado, c.variante, c.gradeo, c.cambio,
         greatest(0, least(c.cambio, c.cantidad - public.cambio_reservadas_linea(c.id)))::int
  from public.user_collection c
  join public.user_profiles p on p.id = c.user_id
  where c.user_id = p_user and c.cambio > 0 and not coalesce(p.is_banned, false)
  order by c.updated_at desc nulls last, c.card_id
  limit 1000
$$;

--
-- Name: cambio_lo_tengo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_lo_tengo(p_oferta uuid) RETURNS public.trade_offers
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  yo uuid := auth.uid();
  o public.trade_offers;
  v_otro uuid;
  v_conf uuid;
begin
  select * into o from public.trade_offers where id = p_oferta for update;
  if o.id is null or yo is null or yo not in (o.de, o.para) then raise exception 'Esa propuesta no es tuya.'; end if;
  if o.estado <> 'aceptada' then raise exception 'Ese cambio no está aceptado.'; end if;
  v_otro := case when yo = o.de then o.para else o.de end;
  if yo = o.de then
    update public.trade_offers set recibido_de_at = coalesce(recibido_de_at, now()), updated_at = now() where id = o.id returning * into o;
  else
    update public.trade_offers set recibido_para_at = coalesce(recibido_para_at, now()), updated_at = now() where id = o.id returning * into o;
  end if;
  if o.recibido_de_at is null or o.recibido_para_at is null then
    perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_recibido', 'Ya tiene lo tuyo', 'Ya me ha llegado lo tuyo. Cuando te llegue lo mío, confírmalo en la propuesta y las cartas se mueven solas.');
    return o;
  end if;
  -- Los dos: se mueven las cartas y cuenta para la confianza (795).
  update public.trade_offers
  set movimientos = public.cambio_mover(o.id), estado = 'hecha', hecha_at = now(),
      deshacer_hasta = now() + interval '1 day', updated_at = now()
  where id = o.id
  returning * into o;
  if to_regclass('public.trade_confirmations') is not null then
    execute 'insert into public.trade_confirmations (user_a, user_b, hecho_a_at, hecho_b_at) values ($1, $2, now(), now()) returning id'
      into v_conf using least(o.de, o.para), greatest(o.de, o.para);
    update public.trade_offers set confirmacion = v_conf where id = o.id returning * into o;
  end if;
  perform public.cambio_avisar(o.id, yo, v_otro, 'cambio_hecho', 'Cambio hecho', 'Cambio hecho: las cartas ya están en la colección de cada uno.');
  return o;
end
$_$;

--
-- Name: trade_confirmations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_confirmations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_a uuid NOT NULL,
    user_b uuid NOT NULL,
    hecho_a_at timestamp with time zone,
    hecho_b_at timestamp with time zone,
    valoracion_a text,
    valoracion_b text,
    nota_a text,
    nota_b text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trade_confirmations_check CHECK ((user_a < user_b)),
    CONSTRAINT trade_confirmations_nota_a_check CHECK ((char_length(nota_a) <= 500)),
    CONSTRAINT trade_confirmations_nota_b_check CHECK ((char_length(nota_b) <= 500)),
    CONSTRAINT trade_confirmations_valoracion_a_check CHECK ((valoracion_a = ANY (ARRAY['bien'::text, 'problema'::text]))),
    CONSTRAINT trade_confirmations_valoracion_b_check CHECK ((valoracion_b = ANY (ARRAY['bien'::text, 'problema'::text])))
);

--
-- Name: cambio_marcar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_marcar(p_otro uuid) RETURNS public.trade_confirmations
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  raise exception 'Los cambios se apuntan solos al cerrar una propuesta: propón el cambio desde Mensajes (también si es en mano).';
end
$$;

--
-- Name: cambio_mover(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_mover(p_oferta uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  o public.trade_offers;
  it public.trade_offer_items;
  l public.user_collection;
  dest public.user_collection;
  v_rec uuid;
  n int;
  v_nueva uuid;
  v_deseos jsonb;
  hecho jsonb := '[]'::jsonb;
begin
  select * into o from public.trade_offers where id = p_oferta;
  for it in select * from public.trade_offer_items where oferta = o.id order by id loop
    v_rec := case when it.quien = o.de then o.para else o.de end;
    n := it.cantidad;
    select * into l from public.user_collection where id = it.linea and user_id = it.quien for update;
    if l.id is null then
      hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'faltaba', 'card_id', it.card_id, 'quien', it.quien));
    else
      n := least(n, l.cantidad);
      if l.cantidad - n <= 0 then
        hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'borrada', 'fila', to_jsonb(l)));
        delete from public.user_collection where id = l.id;
      else
        hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'restada', 'id', l.id, 'n', n, 'cambio', l.cambio));
        update public.user_collection
        set cantidad = cantidad - n, cambio = greatest(0, least(cambio - n, cantidad - n))
        where id = l.id;
      end if;
    end if;
    select * into dest from public.user_collection
    where user_id = v_rec and card_id = it.card_id and market = it.market and idioma = it.idioma
      and estado = it.estado and variante = it.variante and gradeo is not distinct from it.gradeo
    order by created_at
    limit 1
    for update;
    if dest.id is not null then
      update public.user_collection set cantidad = least(999, cantidad + n) where id = dest.id;
      hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'sumada', 'id', dest.id, 'n', n));
    else
      insert into public.user_collection (user_id, card_id, market, idioma, estado, variante, gradeo, cantidad)
      values (v_rec, it.card_id, it.market, it.idioma, it.estado, it.variante, it.gradeo, n)
      returning id into v_nueva;
      hecho := hecho || jsonb_build_array(jsonb_build_object('op', 'creada', 'id', v_nueva));
    end if;
    -- Lo que buscaba quien la recibe, tachado (en cualquier idioma o en ese, y
    -- en cualquier versión o en esa: 1047).
    with fuera as (
      delete from public.user_wants
      where user_id = v_rec and card_id = it.card_id and (idioma is null or idioma = it.idioma)
        and (variante is null or variante = coalesce(it.variante, 'normal'))
      returning *
    )
    select coalesce(jsonb_agg(jsonb_build_object('op', 'deseo', 'fila', to_jsonb(fuera))), '[]'::jsonb) into v_deseos from fuera;
    hecho := hecho || v_deseos;
  end loop;
  return hecho;
end
$$;

--
-- Name: cambio_proponer(uuid, jsonb, numeric, text, text, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_proponer(p_para uuid, p_items jsonb, p_dinero numeric DEFAULT 0, p_paga text DEFAULT NULL::text, p_como text DEFAULT NULL::text, p_nota text DEFAULT NULL::text, p_anterior uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  yo uuid := auth.uid();
  v_id uuid;
  v_version int := 1;
  v_ant public.trade_offers;
  it jsonb;
  l public.user_collection;
  n int;
  v_quien uuid;
  v_dinero numeric := coalesce(p_dinero, 0);
  v_doy int := 0;
  v_recibo int := 0;
  v_texto text;
begin
  if yo is null then raise exception 'Hace falta entrar con tu cuenta.'; end if;
  if p_para is null or p_para = yo then raise exception 'Un cambio es entre dos personas.'; end if;
  if not exists (select 1 from public.user_profiles where id = p_para and not coalesce(is_banned, false)) then
    raise exception 'A esa persona no se le pueden mandar propuestas.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Una propuesta lleva al menos una carta.';
  end if;
  if jsonb_array_length(p_items) > 60 then raise exception 'Como mucho 60 cartas por propuesta.'; end if;
  if v_dinero < 0 or v_dinero > 100000 then raise exception 'La diferencia en dinero no puede ser esa.'; end if;
  if v_dinero > 0 and coalesce(p_paga, '') not in ('de', 'para') then raise exception 'Di quién paga la diferencia.'; end if;
  if p_como is not null and p_como not in ('bizum', 'mano', 'paypal', 'otro') then raise exception 'Esa forma de pago no la conozco.'; end if;

  if p_anterior is not null then
    select * into v_ant from public.trade_offers where id = p_anterior for update;
    if v_ant.id is null or v_ant.estado <> 'enviada' or yo not in (v_ant.de, v_ant.para) or p_para not in (v_ant.de, v_ant.para) then
      raise exception 'Esa propuesta ya no se puede cambiar.';
    end if;
    v_version := v_ant.version + 1;
  end if;

  update public.trade_offers set estado = 'cambiada', updated_at = now()
  where estado = 'enviada' and ((de = yo and para = p_para) or (de = p_para and para = yo));

  insert into public.trade_offers (de, para, version, anterior, dinero, dinero_paga, dinero_como, nota)
  values (yo, p_para, v_version, p_anterior, v_dinero,
          case when v_dinero > 0 then p_paga end,
          case when v_dinero > 0 then p_como end,
          nullif(left(btrim(coalesce(p_nota, '')), 500), ''))
  returning id into v_id;

  for it in select * from jsonb_array_elements(p_items) loop
    v_quien := case it->>'de' when 'yo' then yo when 'otro' then p_para end;
    if v_quien is null then raise exception 'Cada carta dice quién la da.'; end if;
    n := greatest(1, least(99, coalesce(nullif(it->>'cantidad', '')::int, 1)));
    if nullif(it->>'linea', '') is not null then
      select * into l from public.user_collection where id = (it->>'linea')::uuid;
      if l.id is null or l.user_id <> v_quien then raise exception 'Una de las cartas ya no está en su colección.'; end if;
      if v_quien = p_para and coalesce(l.cambio, 0) <= 0 then raise exception 'Una de sus cartas ya no la da.'; end if;
      if n > l.cantidad - public.cambio_reservadas_linea(l.id) then
        raise exception 'De % no quedan tantas copias libres.', l.card_id;
      end if;
      insert into public.trade_offer_items (oferta, quien, linea, card_id, market, idioma, estado, variante, gradeo, cantidad, precio, pedida)
      values (v_id, v_quien, l.id, l.card_id, l.market, l.idioma, l.estado, l.variante, l.gradeo, n,
              nullif(it->>'precio', '')::numeric, false);
    else
      if v_quien = yo then raise exception 'Lo que das tiene que salir de tu colección.'; end if;
      if nullif(it->>'card_id', '') is null then raise exception 'Falta la carta que le pides.'; end if;
      if coalesce(nullif(it->>'idioma', ''), 'es') not in ('es', 'en', 'fr', 'de', 'it', 'pt', 'ja') then raise exception 'Ese idioma no lo conozco.'; end if;
      if coalesce(nullif(it->>'estado', ''), 'NM') not in ('MT', 'NM', 'EX', 'GD', 'LP', 'PL', 'PO') then raise exception 'Ese estado no lo conozco.'; end if;
      if coalesce(nullif(it->>'variante', ''), 'normal') !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then raise exception 'Esa versión no la conozco.'; end if;
      insert into public.trade_offer_items (oferta, quien, linea, card_id, market, idioma, estado, variante, gradeo, cantidad, precio, pedida)
      values (v_id, p_para, null, it->>'card_id', coalesce(nullif(it->>'market', ''), 'WEST'),
              coalesce(nullif(it->>'idioma', ''), 'es'), coalesce(nullif(it->>'estado', ''), 'NM'),
              coalesce(nullif(it->>'variante', ''), 'normal'), null, n, nullif(it->>'precio', '')::numeric, true);
    end if;
    if v_quien = yo then v_doy := v_doy + n; else v_recibo := v_recibo + n; end if;
  end loop;

  v_texto := case when p_anterior is null then 'Te he mandado una propuesta de cambio: ' else 'He cambiado la propuesta de cambio: ' end
    || 'doy ' || v_doy || case when v_doy = 1 then ' carta' else ' cartas' end
    || ' y recibo ' || v_recibo || case when v_recibo = 1 then ' carta' else ' cartas' end
    || case when v_dinero > 0 and p_paga = 'de' then ' y te pago ' || public.cambio_euros(v_dinero)
            when v_dinero > 0 then ' y me pagas ' || public.cambio_euros(v_dinero) else '' end
    || '. La tienes arriba de la conversación.';
  perform public.cambio_avisar(v_id, yo, p_para, 'cambio_propuesta', 'Propuesta de cambio', v_texto);
  return v_id;
end
$_$;

--
-- Name: cambio_quien_cobra(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_quien_cobra(p_oferta uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case when coalesce(o.dinero, 0) > 0 and o.dinero_paga = 'de' then o.para
              when coalesce(o.dinero, 0) > 0 and o.dinero_paga = 'para' then o.de end
  from public.trade_offers o
  where o.id = p_oferta
$$;

--
-- Name: cambio_recibe_algo(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_recibe_algo(p_oferta uuid, p_quien uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.trade_offer_items i where i.oferta = o.id and i.quien <> p_quien)
      or (coalesce(o.dinero, 0) > 0 and ((o.dinero_paga = 'de' and p_quien = o.para) or (o.dinero_paga = 'para' and p_quien = o.de)))
  from public.trade_offers o
  where o.id = p_oferta
$$;

--
-- Name: cambio_reservadas_linea(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_reservadas_linea(p_linea uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(sum(i.cantidad), 0)::int
  from public.trade_offer_items i
  join public.trade_offers o on o.id = i.oferta
  where i.linea = p_linea and o.estado = 'aceptada'
$$;

--
-- Name: cambio_sin_esperar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_sin_esperar(p_oferta uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  o public.trade_offers;
begin
  select * into o from public.trade_offers where id = p_oferta;
  if o.id is null or o.estado <> 'aceptada' then return; end if;
  update public.trade_offers
  set recibido_de_at = case when recibido_de_at is null and not public.cambio_recibe_algo(o.id, o.de) then now() else recibido_de_at end,
      recibido_para_at = case when recibido_para_at is null and not public.cambio_recibe_algo(o.id, o.para) then now() else recibido_para_at end
  where id = o.id;
end
$$;

--
-- Name: cambio_valorar(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambio_valorar(p_id uuid, p_valor text, p_nota text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  yo uuid := auth.uid();
  fila public.trade_confirmations;
begin
  if p_valor not in ('bien', 'problema') then raise exception 'La valoración es «bien» o «problema».'; end if;
  select * into fila from public.trade_confirmations where id = p_id;
  if fila.id is null or yo not in (fila.user_a, fila.user_b) then raise exception 'Ese cambio no es tuyo.'; end if;
  if fila.hecho_a_at is null or fila.hecho_b_at is null then raise exception 'Primero tenéis que marcarlo los dos como hecho.'; end if;
  if yo = fila.user_a then
    update public.trade_confirmations set valoracion_a = p_valor, nota_a = left(p_nota, 500) where id = p_id;
  else
    update public.trade_confirmations set valoracion_b = p_valor, nota_b = left(p_nota, 500) where id = p_id;
  end if;
end
$$;

--
-- Name: cambios_de(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambios_de(p_user uuid) RETURNS TABLE(hechos bigint, bien bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select
    count(*) filter (where hecho_a_at is not null and hecho_b_at is not null),
    count(*) filter (where (user_a = p_user and valoracion_b = 'bien') or (user_b = p_user and valoracion_a = 'bien'))
  from public.trade_confirmations
  where p_user in (user_a, user_b)
$$;

--
-- Name: cambios_reservadas(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cambios_reservadas(p_cards text[]) RETURNS TABLE(user_id uuid, card_id text, cantidad integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select i.quien, i.card_id, sum(i.cantidad)::int
  from public.trade_offer_items i
  join public.trade_offers o on o.id = i.oferta
  where o.estado in ('enviada', 'aceptada') and i.linea is not null and i.card_id = any (p_cards)
  group by i.quien, i.card_id
$$;

--
-- Name: cardmarket_guardar_pares(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cardmarket_guardar_pares(p_pares jsonb, p_market text DEFAULT 'WEST'::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_filas int;
begin
  update public.tcg_cards c
     set cm_id_product_propio = p.id_product,
         tp_id_product_propio = coalesce(p.tp_id_product, c.tp_id_product_propio),
         cm_por = p.por,
         cm_emparejado_at = now()
    from jsonb_to_recordset(p_pares) as p(id text, id_product int, por text, tp_id_product int)
   where c.id = p.id and c.market = p_market;
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

--
-- Name: carpetas_resumen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.carpetas_resumen() RETURNS TABLE(folder_id uuid, cartas bigint, copias bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with recursive arbol as (
    -- Cada carpeta, como raíz de sí misma.
    select f.id as raiz, f.id
      from public.collection_folders f
     where f.user_id = auth.uid()
    union all
    select a.raiz, h.id
      from arbol a
      join public.collection_folders h on h.parent_id = a.id
  )
  select a.raiz,
         count(distinct c.line_id),
         coalesce(sum(u.cantidad), 0)
    from arbol a
    left join public.collection_folder_cards c on c.folder_id = a.id
    left join public.user_collection u on u.id = c.line_id
   group by a.raiz;
$$;

--
-- Name: carpetas_sin_ciclos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.carpetas_sin_ciclos() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  v_padre uuid := new.parent_id;
  v_vueltas int := 0;
begin
  while v_padre is not null loop
    if v_padre = new.id then
      raise exception 'una carpeta no puede estar dentro de sí misma';
    end if;
    -- Tope de seguridad: si ya hubiera un ciclo de antes, este bucle no
    -- terminaría nunca y se llevaría la conexión por delante.
    v_vueltas := v_vueltas + 1;
    if v_vueltas > 50 then
      raise exception 'las carpetas están anidadas demasiado hondo';
    end if;
    select parent_id into v_padre from public.collection_folders where id = v_padre;
  end loop;
  return new;
end;
$$;

--
-- Name: catalogo_aplicar_correcciones(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_aplicar_correcciones() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v jsonb;
begin
  select jsonb_object_agg(c.columna, c.valor) into v
    from public.tcg_correcciones c
   where c.tabla = TG_TABLE_NAME and c.id = new.id and c.market = new.market;
  if v ? '__borrada' then
    return null;
  end if;
  if v is not null then
    new := jsonb_populate_record(new, v);
  end if;
  return new;
end;
$$;

--
-- Name: catalogo_borrar_carta(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_borrar_carta(p_id text, p_market text, p_destino text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_origen text;
  v_existe boolean;
  v_quien jsonb := public.catalogo_quien_tiene_carta(p_id, p_market);
  v_apuntada boolean;
begin
  select true, origen into v_existe, v_origen from public.tcg_cards where id = p_id and market = p_market;
  if v_existe is null then
    raise exception 'Esa carta no existe.' using errcode = 'P0002';
  end if;
  v_apuntada := (v_quien->>'copias')::int > 0 or (v_quien->>'deseos')::int > 0 or (v_quien->>'albumes')::int > 0
    or (v_quien->>'avisos')::int > 0 or (v_quien->>'vitrina')::int > 0;
  if v_apuntada and p_destino is null then
    raise exception 'Alguien la tiene apuntada: elige a qué carta pasa antes de borrarla.' using errcode = '23503';
  end if;
  if p_destino is not null then
    if p_destino = p_id or not exists (select 1 from public.tcg_cards where id = p_destino and market = p_market) then
      raise exception 'La carta a la que pasan las copias no existe (o es la misma).' using errcode = 'P0002';
    end if;
    update public.user_collection set card_id = p_destino, market = p_market where card_id = p_id;
    -- Un deseo que ya estaba en la de destino se queda el de allí (el índice
    -- único de la 763 no deja dos).
    delete from public.user_wants w
     where w.card_id = p_id
       and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*'));
    update public.user_wants set card_id = p_destino where card_id = p_id;
    update public.user_price_alerts set card_id = p_destino where card_id = p_id;
    update public.user_showcase set card_id = p_destino where card_id = p_id;
    update public.user_albums a set cartas = (
      select coalesce(jsonb_agg(case when e->>'id' = p_id then jsonb_set(e, '{id}', to_jsonb(p_destino)) else e end order by n), '[]'::jsonb)
        from jsonb_array_elements(a.cartas) with ordinality as x(e, n))
     where a.cartas @> jsonb_build_array(jsonb_build_object('id', p_id));
  end if;
  delete from public.tcg_card_prices where card_id = p_id;
  delete from public.tcg_card_history where card_id = p_id;
  delete from public.tcg_card_versions where card_id = p_id;
  delete from public.tcg_correcciones where tabla = 'tcg_cards' and id = p_id and market = p_market;
  -- La lápida: una carta de las APIs la volvería a crear su pasada. Las de a
  -- mano no las crea nadie más.
  if v_origen is distinct from 'mano' then
    insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
    values ('tcg_cards', p_id, p_market, '__borrada', 'true'::jsonb, null, auth.uid(), now())
    on conflict (tabla, id, market, columna) do update set updated_at = now();
  end if;
  delete from public.tcg_cards where id = p_id and market = p_market;
  return v_quien || jsonb_build_object('borrada', p_id, 'destino', p_destino);
end;
$$;

--
-- Name: catalogo_borrar_version_mano(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_borrar_version_mano(p_tcggo_id integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v record;
  v_copias int;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  select card_id, etiqueta, origen into v from public.tcg_card_versions where tcggo_id = p_tcggo_id;
  if not found then
    raise exception 'Esa versión no existe.' using errcode = 'P0002';
  end if;
  if v.origen is distinct from 'mano' then
    raise exception 'Solo se borran las versiones hechas a mano; las de TCGGO las trae su pasada.' using errcode = '42501';
  end if;
  select coalesce(sum(cantidad), 0) into v_copias from public.user_collection
   where card_id = v.card_id and variante = public.catalogo_id_de_version(v.etiqueta);
  if v_copias > 0 then
    raise exception 'Hay % copias apuntadas en esa versión: no se borra.', v_copias using errcode = '23503';
  end if;
  delete from public.tcg_card_versions where tcggo_id = p_tcggo_id;
  return true;
end;
$$;

--
-- Name: catalogo_columnas_corregibles(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_columnas_corregibles(p_tabla text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  select case p_tabla
    when 'tcg_cards' then array['name', 'name_en', 'name_es', 'local_id', 'set_id', 'rarity', 'rarity_en', 'category', 'hp', 'types', 'stage', 'evolve_from', 'retreat', 'attacks', 'abilities', 'weaknesses', 'resistances', 'trainer_type', 'energy_type', 'illustrator', 'description', 'dex_ids', 'regulation_mark', 'variants', 'suffix', 'image_path', 'image_tcggo', 'image_scrydex', 'cm_id_product_propio', 'tp_id_product_propio', 'origen']
    when 'tcg_sets' then array['name', 'name_en', 'serie_id', 'serie_name', 'serie_name_en', 'release_date', 'card_count_official', 'card_count_total', 'tcg_online_code', 'logo_tcggo', 'logo_scrydex', 'logo_path', 'symbol_scrydex', 'oculto', 'orden', 'origen', 'tcggo_gemelos']
    else array[]::text[]
  end
$$;

--
-- Name: catalogo_corregir(text, text, text, jsonb, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_corregir(p_tabla text, p_id text, p_market text, p_cambios jsonb, p_crear boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_yo uuid := auth.uid();
  v_permitidas text[] := public.catalogo_columnas_corregibles(p_tabla);
  v_col text;
  v_existe boolean;
  v_fila jsonb;
  v_cols text;
  v_cambios jsonb := coalesce(p_cambios, '{}'::jsonb);
begin
  if v_yo is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if p_tabla not in ('tcg_sets', 'tcg_cards') then
    raise exception 'Tabla desconocida: %', p_tabla using errcode = '22023';
  end if;
  if p_market not in ('WEST', 'JP', 'TW', 'CN') then
    raise exception 'Mercado desconocido: %', p_market using errcode = '22023';
  end if;
  if jsonb_typeof(v_cambios) <> 'object' or v_cambios = '{}'::jsonb then
    raise exception 'No hay nada que cambiar.' using errcode = '22023';
  end if;
  for v_col in select jsonb_object_keys(v_cambios) loop
    if not (v_col = any (v_permitidas)) then
      raise exception 'La columna % no se puede corregir desde aquí.', v_col using errcode = '22023';
    end if;
  end loop;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1 and t.market = $2', p_tabla)
    into v_fila using p_id, p_market;
  v_existe := v_fila is not null;

  if not v_existe then
    if not p_crear then
      raise exception 'No existe % en % (%).', p_id, p_tabla, p_market using errcode = 'P0002';
    end if;
    v_cambios := v_cambios || jsonb_build_object('id', p_id, 'market', p_market);
    if not (v_cambios ? 'origen') then v_cambios := v_cambios || '{"origen": "mano"}'::jsonb; end if;
    if p_tabla = 'tcg_cards' and (coalesce(v_cambios->>'set_id', '') = '' or coalesce(v_cambios->>'local_id', '') = '' or coalesce(v_cambios->>'name', '') = '') then
      raise exception 'Una carta nueva necesita set_id, local_id y name.' using errcode = '22023';
    end if;
    if p_tabla = 'tcg_sets' and coalesce(v_cambios->>'name', '') = '' then
      raise exception 'Un set nuevo necesita name.' using errcode = '22023';
    end if;
    select string_agg(format('%I', k), ', ') into v_cols from jsonb_object_keys(v_cambios) k;
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) r', p_tabla, v_cols,
      (select string_agg(format('r.%I', k), ', ') from jsonb_object_keys(v_cambios) k), p_tabla)
      using v_cambios;
    execute format('select to_jsonb(t) from public.%I t where t.id = $1 and t.market = $2', p_tabla)
      into v_fila using p_id, p_market;
    return v_fila;
  end if;

  -- Las correcciones, con lo que había antes la primera vez.
  for v_col in select jsonb_object_keys(v_cambios) loop
    insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
    values (p_tabla, p_id, p_market, v_col, v_cambios->v_col, v_fila->v_col, v_yo, now())
    on conflict (tabla, id, market, columna) do update
      set valor = excluded.valor, autor = excluded.autor, updated_at = now();
  end loop;

  -- Y la fila: el disparador aplica las correcciones recién apuntadas, así
  -- que basta con tocarla; se escriben igual las columnas para no depender
  -- del orden.
  select string_agg(format('%I = r.%I', k, k), ', ') into v_cols from jsonb_object_keys(v_cambios) k;
  execute format('update public.%I t set %s from jsonb_populate_record(null::public.%I, $1) r where t.id = $2 and t.market = $3', p_tabla, v_cols, p_tabla)
    using v_cambios, p_id, p_market;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1 and t.market = $2', p_tabla)
    into v_fila using p_id, p_market;
  return v_fila;
end;
$_$;

--
-- Name: catalogo_descorregir(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_descorregir(p_tabla text, p_id text, p_market text, p_columna text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_anterior jsonb;
  v_habia boolean;
  v_fila jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if p_tabla not in ('tcg_sets', 'tcg_cards') then
    raise exception 'Tabla desconocida: %', p_tabla using errcode = '22023';
  end if;
  delete from public.tcg_correcciones
   where tabla = p_tabla and id = p_id and market = p_market and columna = p_columna
  returning anterior into v_anterior;
  v_habia := found;
  if not v_habia then
    raise exception 'Esa columna no estaba corregida.' using errcode = 'P0002';
  end if;
  execute format('update public.%I t set %I = r.%I from jsonb_populate_record(null::public.%I, $1) r where t.id = $2 and t.market = $3', p_tabla, p_columna, p_columna, p_tabla)
    using jsonb_build_object(p_columna, v_anterior), p_id, p_market;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1 and t.market = $2', p_tabla)
    into v_fila using p_id, p_market;
  return v_fila;
end;
$_$;

--
-- Name: catalogo_id_de_version(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_id_de_version(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  with t as (select trim(regexp_replace(public.immutable_unaccent(lower(coalesce(p, ''))), '\s+', ' ', 'g')) as t)
  select case
    when t = '' then 'reverse'
    when t in ('reverse holo', 'reverse', 'reverse holofoil') then 'reverse'
    when t in ('holo', 'holofoil') then 'holo'
    when t in ('standard', 'normal') then 'normal'
    when t in ('1st edition', 'first edition') then 'primera'
    else coalesce(nullif(left(trim(both '-' from regexp_replace(t, '[^a-z0-9]+', '-', 'g')), 40), ''), 'reverse')
  end
  from t
$$;

--
-- Name: catalogo_idioma_de_set(text, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_idioma_de_set(p_set text, p_market text, p_idioma text, p_hay boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tcg_sets where id = p_set and market = p_market) then
    raise exception 'No existe el set % (%).', p_set, p_market using errcode = 'P0002';
  end if;
  if p_hay is null then
    delete from public.tcg_set_idiomas_mano where set_id = p_set and market = p_market and idioma = p_idioma;
  else
    insert into public.tcg_set_idiomas_mano (set_id, market, idioma, hay, autor, updated_at)
    values (p_set, p_market, p_idioma, p_hay, auth.uid(), now())
    on conflict (set_id, market, idioma) do update set hay = excluded.hay, autor = excluded.autor, updated_at = now();
  end if;
  return jsonb_build_object('idiomas', to_jsonb(public.idiomas_de_set(p_set, p_market)));
end;
$$;

--
-- Name: catalogo_nombre_de_repetida(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_nombre_de_repetida(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select regexp_replace(
    regexp_replace(public.immutable_unaccent(lower(coalesce(p, ''))), '\([^)]*\)|\[[^]]*\]|\m(jumbo|oversized)\M', '', 'g'),
    '[^a-z0-9]+', '', 'g')
$$;

--
-- Name: catalogo_numero_comparable(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_numero_comparable(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select regexp_replace(lower(trim(coalesce(p, ''))), '(^|[^0-9])0+([0-9])', '\1\2', 'g')
$$;

--
-- Name: catalogo_numero_de_repetida(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_numero_de_repetida(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  select public.catalogo_numero_comparable(regexp_replace(trim(coalesce(p, '')), '^[A-Za-z]+\s+([0-9]+)$', '\1'))
$_$;

--
-- Name: catalogo_posibles_repetidas(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_posibles_repetidas(p_market text DEFAULT NULL::text, p_limite integer DEFAULT 300) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  with c as (
    select c.*, public.catalogo_numero_de_repetida(c.local_id) as n,
           public.catalogo_nombre_de_repetida(coalesce(nullif(trim(c.name_en), ''), c.name)) as k,
           array(select distinct x from unnest(array[
             public.catalogo_nombre_de_repetida(c.name),
             public.catalogo_nombre_de_repetida(c.name_en),
             public.catalogo_nombre_de_repetida(c.name_es)]) as x where x <> '') as ks
      from public.tcg_cards c
      join public.tcg_sets s on s.id = c.set_id and s.market = c.market
     where (p_market is null or c.market = p_market)
       and not coalesce(s.oculto, false)
       and trim(coalesce(c.local_id, '')) <> ''
  ), m as (
    -- Las que comparten algún nombre con otra del mismo número.
    select distinct a.id, a.market from c a
      join c b on b.market = a.market and b.set_id = a.set_id and b.n = a.n and b.id <> a.id and a.ks && b.ks
  ), cm as (
    select c.* from c join m on m.id = c.id and m.market = c.market
  ), g as (
    select market, set_id, n, min(k) as k, array_agg(id order by id) as ids
      from cm group by market, set_id, n
  ), vivos as (
    select g.* from g
     where not exists (
       select 1 from public.tcg_repetidas_distintas d
        where d.market = g.market and d.set_id = g.set_id and g.ids <@ d.ids)
  ), elegidos as (
    select v.*, s.name as set_nombre, s.name_en as set_nombre_en, s.release_date, s.serie_id, s.tcg_online_code
      from vivos v join public.tcg_sets s on s.id = v.set_id and s.market = v.market
     order by s.release_date desc nulls last, v.set_id, v.n
     limit greatest(1, least(coalesce(p_limite, 300), 1000))
  )
  select jsonb_build_object(
    'total', (select count(*) from vivos),
    'grupos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'market', e.market, 'set_id', e.set_id, 'numero', e.n, 'nombre', e.k,
        'set', jsonb_build_object('id', e.set_id, 'name', e.set_nombre, 'name_en', e.set_nombre_en, 'release_date', e.release_date),
        'cartas', (
          select jsonb_agg(jsonb_build_object(
            'id', c.id, 'market', c.market, 'set_id', c.set_id, 'local_id', c.local_id, 'name', c.name, 'name_es', c.name_es,
            'origen', c.origen, 'tcggo_id', c.tcggo_id, 'hp', c.hp, 'illustrator', c.illustrator, 'attacks', c.attacks,
            'category', c.category, 'stage', c.stage, 'types', c.types,
            'abilities', c.abilities, 'rarity', c.rarity, 'variants', c.variants, 'image_path', c.image_path,
            'image_tcggo', c.image_tcggo, 'cm_id_product_propio', c.cm_id_product_propio,
            'tcg_sets', jsonb_build_object('serie_id', e.serie_id, 'tcg_online_code', e.tcg_online_code, 'release_date', e.release_date),
            'precio', (select jsonb_build_object('cm_id_product', p.cm_id_product, 'cm_low', p.cm_low, 'cm_low_es', p.cm_low_es, 'cm_low_en', p.cm_low_en)
                         from public.tcg_card_prices p where p.card_id = c.id),
            'personas', (select count(distinct u.user_id) from public.user_collection u where u.card_id = c.id and u.market = c.market),
            'copias', (select coalesce(sum(u.cantidad), 0) from public.user_collection u where u.card_id = c.id and u.market = c.market)
          ) order by (c.origen = 'tcggo') nulls first, c.tcggo_id nulls first, c.id)
            from cm c where c.market = e.market and c.set_id = e.set_id and c.n = e.n)
      ) order by e.release_date desc nulls last, e.set_id, e.n)
        from elegidos e), '[]'::jsonb),
    'hechas', coalesce((
      select jsonb_agg(jsonb_build_object('id', h.id, 'market', h.market, 'carta', h.carta, 'destino', h.destino, 'decision', h.decision,
        'etiqueta', h.etiqueta, 'nombre', h.fila->>'name', 'set_id', h.fila->>'set_id', 'local_id', h.fila->>'local_id', 'hecha_at', h.hecha_at)
        order by h.hecha_at desc)
        from (select * from public.tcg_repetidas_hechas where deshecha_at is null and (p_market is null or market = p_market) order by hecha_at desc limit 200) h), '[]'::jsonb),
    'distintas', coalesce((
      select jsonb_agg(jsonb_build_object('market', d.market, 'set_id', d.set_id, 'numero', d.numero, 'nombre', d.nombre, 'ids', d.ids, 'creado_at', d.creado_at)
        order by d.creado_at desc)
        from public.tcg_repetidas_distintas d where p_market is null or d.market = p_market), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

--
-- Name: catalogo_quien_tiene_carta(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_quien_tiene_carta(p_id text, p_market text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'personas', (select count(distinct user_id) from public.user_collection where card_id = p_id),
    'copias', (select coalesce(sum(cantidad), 0) from public.user_collection where card_id = p_id),
    'deseos', (select count(*) from public.user_wants where card_id = p_id),
    'albumes', (select count(*) from public.user_albums where cartas @> jsonb_build_array(jsonb_build_object('id', p_id))),
    'avisos', (select count(*) from public.user_price_alerts where card_id = p_id),
    'vitrina', (select count(*) from public.user_showcase where card_id = p_id)
  );
end;
$$;

--
-- Name: catalogo_repetida_deshacer(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_repetida_deshacer(p_hecha bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  h public.tcg_repetidas_hechas%rowtype;
  v_cols text;
  v_var text;
  v_quita boolean := false;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  select * into h from public.tcg_repetidas_hechas where id = p_hecha for update;
  if not found then
    raise exception 'No hay nada hecho con ese número.' using errcode = 'P0002';
  end if;
  if h.deshecha_at is not null then
    raise exception 'Eso ya se deshizo.' using errcode = '22023';
  end if;
  if exists (select 1 from public.tcg_cards where id = h.carta and market = h.market) then
    raise exception 'La carta % ya vuelve a estar en el catálogo.', h.carta using errcode = '23505';
  end if;

  delete from public.tcg_correcciones where tabla = 'tcg_cards' and market = h.market and columna = '__borrada' and id = any(h.lapidas);

  -- Las correcciones primero: el disparador de la 885 las pone encima de la
  -- carta al volver a escribirla.
  if h.correcciones is not null then
    insert into public.tcg_correcciones select * from jsonb_populate_recordset(null::public.tcg_correcciones, h.correcciones)
    on conflict (tabla, id, market, columna) do nothing;
  end if;
  -- La carta, tal cual estaba, sin las columnas que calcula la base (las
  -- generadas no se pueden escribir).
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
    from information_schema.columns
   where table_schema = 'public' and table_name = 'tcg_cards' and is_generated = 'NEVER';
  execute format('insert into public.tcg_cards (%1$s) select %1$s from jsonb_populate_record(null::public.tcg_cards, $1)', v_cols) using h.fila;
  if h.precio is not null then
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
      from information_schema.columns
     where table_schema = 'public' and table_name = 'tcg_card_prices' and is_generated = 'NEVER';
    execute format('insert into public.tcg_card_prices (%1$s) select %1$s from jsonb_populate_record(null::public.tcg_card_prices, $1) on conflict (card_id) do nothing', v_cols) using h.precio;
  end if;

  -- Sus versiones (996): las que se mudaron salen de la principal y vuelven
  -- todas a la repetida, como estaban.
  if h.versiones is not null and jsonb_array_length(h.versiones) > 0 then
    delete from public.tcg_card_versions v
     where v.market = h.market and v.card_id = h.destino
       and v.tcggo_id in (select (e->>'tcggo_id')::int from jsonb_array_elements(h.versiones) e);
    select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into v_cols
      from information_schema.columns
     where table_schema = 'public' and table_name = 'tcg_card_versions' and is_generated = 'NEVER';
    execute format('insert into public.tcg_card_versions (%1$s) select %1$s from jsonb_populate_recordset(null::public.tcg_card_versions, $1) on conflict do nothing', v_cols) using h.versiones;
  end if;

  -- Lo apuntado vuelve, y solo lo que sigue donde se dejó.
  update public.user_collection u set card_id = h.carta, variante = x.variante
    from jsonb_to_recordset(coalesce(h.coleccion, '[]'::jsonb)) as x(id text, variante text)
   where u.id::text = x.id and u.card_id = h.destino and u.market = h.market;
  -- Los deseos vuelven con la versión que tenían (1047); lo apuntado antes de
  -- la 1047 es una lista de ids y deja la versión como esté.
  update public.user_wants w set card_id = h.carta, variante = case when x.trae then x.variante else w.variante end
    from (select case when jsonb_typeof(e) = 'object' then e->>'id' else e #>> '{}' end as id,
                 jsonb_typeof(e) = 'object' as trae, e->>'variante' as variante
            from jsonb_array_elements(coalesce(h.deseos, '[]'::jsonb)) e) x
   where w.id::text = x.id and w.card_id = h.destino;
  if h.deseos_borrados is not null then
    insert into public.user_wants select * from jsonb_populate_recordset(null::public.user_wants, h.deseos_borrados) on conflict do nothing;
  end if;
  update public.user_price_alerts set card_id = h.carta
   where id::text in (select jsonb_array_elements_text(coalesce(h.avisos, '[]'::jsonb))) and card_id = h.destino;
  update public.user_showcase s set card_id = h.carta
    from jsonb_to_recordset(coalesce(h.vitrina, '[]'::jsonb)) as x(user_id text, posicion int)
   where s.user_id::text = x.user_id and s.posicion = x.posicion and s.card_id = h.destino;
  update public.user_albums a set cartas = (
    select coalesce(jsonb_agg(case when e->>'id' = h.destino and n in (select (jsonb_array_elements_text(x.pos))::bigint) then jsonb_set(e, '{id}', to_jsonb(h.carta)) else e end order by n), '[]'::jsonb)
      from jsonb_array_elements(a.cartas) with ordinality as y(e, n))
    from jsonb_to_recordset(coalesce(h.albumes, '[]'::jsonb)) as x(id text, pos jsonb)
   where a.id::text = x.id;

  -- La versión nueva se va si nadie más la ha apuntado mientras tanto.
  if h.decision = 'version' and h.version_creada and h.version_id is not null then
    v_var := public.catalogo_variante_de_etiqueta(h.etiqueta);
    if not exists (select 1 from public.user_collection where card_id = h.destino and market = h.market and variante = v_var) then
      delete from public.tcg_card_versions where tcggo_id = h.version_id and origen = 'fundida';
      v_quita := true;
    end if;
  end if;

  update public.tcg_repetidas_hechas set deshecha_at = now() where id = h.id;
  return jsonb_build_object('carta', h.carta, 'version_quitada', v_quita);
end;
$_$;

--
-- Name: catalogo_repetida_resolver(text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_repetida_resolver(p_carta text, p_destino text, p_market text, p_decision text, p_etiqueta text DEFAULT NULL::text, p_clase text DEFAULT 'sello'::text, p_imagen text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_c public.tcg_cards%rowtype;
  v_d public.tcg_cards%rowtype;
  v_etiqueta text := nullif(trim(coalesce(p_etiqueta, '')), '');
  v_var text;
  v_clase text := coalesce(nullif(p_clase, ''), 'sello');
  v_precio jsonb;
  v_version int;
  v_creada boolean := false;
  v_lapidas text[] := '{}';
  v_hecha bigint;
  v_tcggo text;
  v_movidas int := 0;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if p_decision not in ('version', 'misma') then
    raise exception 'La decisión es «version» o «misma».' using errcode = '22023';
  end if;
  if p_carta = p_destino then
    raise exception 'Una carta no puede ser versión de sí misma.' using errcode = '22023';
  end if;
  select * into v_c from public.tcg_cards where id = p_carta and market = p_market for update;
  if not found then
    raise exception 'No existe la carta % (%).', p_carta, p_market using errcode = 'P0002';
  end if;
  select * into v_d from public.tcg_cards where id = p_destino and market = p_market;
  if not found then
    raise exception 'No existe la carta % (%).', p_destino, p_market using errcode = 'P0002';
  end if;
  if v_c.set_id is distinct from v_d.set_id then
    raise exception 'Las dos cartas tienen que ser de la misma colección.' using errcode = '22023';
  end if;
  if p_decision = 'version' then
    if v_etiqueta is null then
      raise exception 'La versión necesita un nombre.' using errcode = '22023';
    end if;
    -- Holo, Normal y Reverse valen: en el Prize Pack la normal y la holo son
    -- dos productos de Cardmarket y TCGGO las da como dos cartas. Esas son
    -- impresiones (cuentan). La «Standard» de TCGGO (la carta misma) y las
    -- ediciones de Wizards (la 935) no se crean aquí.
    if public.catalogo_id_de_version(v_etiqueta) in ('standard', '1st-edition', 'first-edition', 'primera', 'primera-edicion') then
      raise exception 'Ese nombre no vale para una versión de aquí (p. ej. «Staff» u «Holo»).' using errcode = '22023';
    end if;
    v_var := public.catalogo_variante_de_etiqueta(v_etiqueta);
    if v_var = '' then
      raise exception 'La versión necesita un nombre.' using errcode = '22023';
    end if;
    if v_var in ('normal', 'holo', 'reverse') then
      v_clase := 'impresion';
    end if;
    if v_clase not in ('impresion', 'sello', 'adicional') then
      raise exception 'La clase es impresion, sello o adicional.' using errcode = '22023';
    end if;
  end if;

  select to_jsonb(p) into v_precio from public.tcg_card_prices p where p.card_id = p_carta;

  -- Lo apuntado, ANTES de moverlo: es lo que se deshace.
  insert into public.tcg_repetidas_hechas (market, carta, destino, decision, etiqueta, fila, precio, correcciones, coleccion, deseos, deseos_borrados, avisos, vitrina, albumes, autor)
  values (p_market, p_carta, p_destino, p_decision, v_etiqueta, to_jsonb(v_c), v_precio,
    (select jsonb_agg(to_jsonb(x)) from public.tcg_correcciones x where x.tabla = 'tcg_cards' and x.id = p_carta and x.market = p_market),
    (select jsonb_agg(jsonb_build_object('id', u.id::text, 'variante', u.variante)) from public.user_collection u where u.card_id = p_carta and u.market = p_market),
    (select jsonb_agg(jsonb_build_object('id', w.id::text, 'variante', w.variante)) from public.user_wants w where w.card_id = p_carta
       and not exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*')
         and coalesce(o.variante, '*') = coalesce(case when p_decision = 'version' then coalesce(w.variante, v_var) else w.variante end, '*'))),
    (select jsonb_agg(to_jsonb(w)) from public.user_wants w where w.card_id = p_carta
       and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*')
         and coalesce(o.variante, '*') = coalesce(case when p_decision = 'version' then coalesce(w.variante, v_var) else w.variante end, '*'))),
    (select jsonb_agg(a.id::text) from public.user_price_alerts a where a.card_id = p_carta and a.market = p_market),
    (select jsonb_agg(jsonb_build_object('user_id', s.user_id::text, 'posicion', s.posicion)) from public.user_showcase s where s.card_id = p_carta and s.market = p_market),
    (select jsonb_agg(jsonb_build_object('id', a.id::text, 'pos', (
        select jsonb_agg(n) from jsonb_array_elements(a.cartas) with ordinality as x(e, n) where e->>'id' = p_carta)))
       from public.user_albums a where a.cartas @> jsonb_build_array(jsonb_build_object('id', p_carta))),
    auth.uid())
  returning id into v_hecha;
  -- Sus versiones, tal cual (996): se mudan a la principal y, al deshacer,
  -- vuelven de aquí.
  update public.tcg_repetidas_hechas
     set versiones = (select jsonb_agg(to_jsonb(v)) from public.tcg_card_versions v where v.card_id = p_carta and v.market = p_market)
   where id = v_hecha;

  -- La versión: la que ya tenga la principal con ese nombre, o una nueva
  -- con id negativo (la secuencia de la 934: ninguna pasada los escribe).
  if p_decision = 'version' then
    select tcggo_id into v_version from public.tcg_card_versions
     where card_id = p_destino and market = p_market and public.catalogo_variante_de_etiqueta(etiqueta) = v_var
     order by tcggo_id limit 1;
    if v_version is null then
      v_version := -nextval('public.tcg_card_versions_mano_seq')::int;
      v_creada := true;
      insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, numero, nombre, etiqueta, imagen, clase, origen,
        cm_id_product, cm_low, cm_low_en, cm_low_de, cm_low_fr, cm_low_es, cm_low_it, cm_avg7, cm_avg30, cm_disponibles, tp_market_eur, tp_mid_eur, actualizado_at)
      values (v_version, p_market, p_destino, v_d.set_id, v_c.local_id, v_d.name, v_etiqueta, nullif(trim(coalesce(p_imagen, '')), ''), v_clase, 'fundida',
        coalesce(v_c.cm_id_product_propio, (v_precio->>'cm_id_product')::int),
        (v_precio->>'cm_low')::numeric, (v_precio->>'cm_low_en')::numeric, (v_precio->>'cm_low_de')::numeric, (v_precio->>'cm_low_fr')::numeric,
        (v_precio->>'cm_low_es')::numeric, (v_precio->>'cm_low_it')::numeric, (v_precio->>'cm_avg7')::numeric, (v_precio->>'cm_avg30')::numeric,
        (v_precio->>'cm_disponibles')::int, (v_precio->>'tp_market_eur')::numeric, (v_precio->>'tp_mid_eur')::numeric, now());
    end if;
    update public.user_collection set card_id = p_destino, variante = v_var where card_id = p_carta and market = p_market;
  else
    update public.user_collection set card_id = p_destino where card_id = p_carta and market = p_market;
  end if;

  -- Lo demás, como `catalogo_borrar_carta` (934), pero sin salirse del
  -- catálogo: el japonés y el occidental pueden compartir ids.
  -- Un deseo de la repetida pasa a la principal EN SU VERSIÓN (1047): quien
  -- quería la Chikorita Holo suelta quiere la Chikorita en «Holo».
  delete from public.user_wants w
   where w.card_id = p_carta
     and exists (select 1 from public.user_wants o where o.user_id = w.user_id and o.card_id = p_destino and coalesce(o.idioma, '*') = coalesce(w.idioma, '*')
         and coalesce(o.variante, '*') = coalesce(case when p_decision = 'version' then coalesce(w.variante, v_var) else w.variante end, '*'));
  update public.user_wants w set card_id = p_destino, variante = case when p_decision = 'version' then coalesce(w.variante, v_var) else w.variante end where w.card_id = p_carta;
  update public.user_price_alerts set card_id = p_destino where card_id = p_carta and market = p_market;
  update public.user_showcase set card_id = p_destino where card_id = p_carta and market = p_market;
  update public.user_albums a set cartas = (
    select coalesce(jsonb_agg(case when e->>'id' = p_carta then jsonb_set(e, '{id}', to_jsonb(p_destino)) else e end order by n), '[]'::jsonb)
      from jsonb_array_elements(a.cartas) with ordinality as x(e, n))
   where a.cartas @> jsonb_build_array(jsonb_build_object('id', p_carta));

  delete from public.tcg_card_prices where card_id = p_carta;
  delete from public.tcg_card_history where card_id = p_carta;
  -- Las versiones de la repetida se MUDAN a la principal (996): eran las
  -- que PINGU le había puesto a mano al Mewtwo ex SVP 205 de TCGGO, y
  -- borrarlas las perdía. Solo se queda atrás (y se va) la que repite una que
  -- la principal ya tiene.
  update public.tcg_card_versions v set card_id = p_destino, set_id = v_d.set_id
   where v.card_id = p_carta and v.market = p_market
     and not exists (select 1 from public.tcg_card_versions o
                      where o.card_id = p_destino and o.market = p_market
                        and public.catalogo_variante_de_etiqueta(o.etiqueta) = public.catalogo_variante_de_etiqueta(v.etiqueta));
  get diagnostics v_movidas = row_count;
  delete from public.tcg_card_versions where card_id = p_carta and market = p_market;
  delete from public.tcg_correcciones where tabla = 'tcg_cards' and id = p_carta and market = p_market;

  -- Las lápidas: la repetida no vuelve por la pasada que la trajo. Si era de
  -- TCGdex y la de TCGGO casaba con ella, sin ella esa nacería como
  -- `tcggo-<id>`: también lleva la suya.
  if v_c.origen is distinct from 'mano' then
    v_lapidas := array_append(v_lapidas, p_carta);
  end if;
  if v_c.tcggo_id is not null then
    v_tcggo := 'tcggo-' || v_c.tcggo_id;
    if v_tcggo <> p_carta and not exists (select 1 from public.tcg_cards where id = v_tcggo and market = p_market) then
      v_lapidas := array_append(v_lapidas, v_tcggo);
    end if;
  end if;
  insert into public.tcg_correcciones (tabla, id, market, columna, valor, anterior, autor, updated_at)
  select 'tcg_cards', l, p_market, '__borrada', 'true'::jsonb, null, auth.uid(), now() from unnest(v_lapidas) l
  on conflict (tabla, id, market, columna) do update set updated_at = now();

  delete from public.tcg_cards where id = p_carta and market = p_market;

  update public.tcg_repetidas_hechas set version_id = v_version, version_creada = v_creada, lapidas = v_lapidas where id = v_hecha;
  return jsonb_build_object('hecha', v_hecha, 'version', v_version, 'variante', v_var, 'creada', v_creada, 'lapidas', to_jsonb(v_lapidas), 'versiones_movidas', v_movidas,
    'copias', (select count(*) from public.user_collection where card_id = p_destino and market = p_market and (v_var is null or variante = v_var)));
end;
$$;

--
-- Name: catalogo_repetidas_distintas(text, text, text, text, text[], boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_repetidas_distintas(p_market text, p_set text, p_numero text, p_nombre text, p_ids text[], p_quitar boolean DEFAULT false) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if p_quitar then
    delete from public.tcg_repetidas_distintas where market = p_market and set_id = p_set and numero = p_numero and nombre = p_nombre;
    return true;
  end if;
  if coalesce(array_length(p_ids, 1), 0) < 2 then
    raise exception 'Hacen falta las cartas del grupo.' using errcode = '22023';
  end if;
  insert into public.tcg_repetidas_distintas (market, set_id, numero, nombre, ids, autor)
  values (p_market, p_set, p_numero, p_nombre, p_ids, auth.uid())
  on conflict (market, set_id, numero, nombre) do update set ids = excluded.ids, autor = excluded.autor, creado_at = now();
  return true;
end;
$$;

--
-- Name: catalogo_variante_de_etiqueta(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_variante_de_etiqueta(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case v when 'reverse-holo' then 'reverse' when 'reverse-holofoil' then 'reverse' when 'holofoil' then 'holo' else v end
    from (select public.catalogo_id_de_version(p) as v) x
$$;

--
-- Name: catalogo_version_de_idioma(text, text, text, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_version_de_idioma(p_set text, p_market text, p_variante text, p_idioma text, p_hay boolean, p_carta text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_carta text := coalesce(trim(p_carta), '');
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tcg_sets where id = p_set and market = p_market) then
    raise exception 'No existe el set % (%).', p_set, p_market using errcode = 'P0002';
  end if;
  if coalesce(trim(p_variante), '') = '' then
    raise exception 'Falta la versión.' using errcode = '22023';
  end if;
  if v_carta <> '' and not exists (select 1 from public.tcg_cards where id = v_carta and set_id = p_set and market = p_market) then
    raise exception 'La carta % no es del set % (%).', v_carta, p_set, p_market using errcode = 'P0002';
  end if;
  -- En el set, «sí salió» es lo de por defecto y no se guarda; en una carta,
  -- solo null deja de mandar.
  if p_hay is null or (v_carta = '' and p_hay) then
    delete from public.tcg_version_idioma
    where set_id = p_set and market = p_market and card_id = v_carta and variante = p_variante and idioma = p_idioma;
  else
    insert into public.tcg_version_idioma (set_id, market, card_id, variante, idioma, hay, autor, updated_at)
    values (p_set, p_market, v_carta, p_variante, p_idioma, p_hay, auth.uid(), now())
    on conflict (set_id, market, card_id, variante, idioma) do update set hay = excluded.hay, autor = excluded.autor, updated_at = now();
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

--
-- Name: catalogo_version_foto(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_version_foto(p_card_id text, p_market text, p_variante text, p_imagen text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_carta record;
  v_id int;
  v_imagen text := nullif(trim(coalesce(p_imagen, '')), '');
  v_fila jsonb;
  v_etiqueta text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  select id, set_id, name into v_carta from public.tcg_cards where id = p_card_id and market = p_market;
  if not found then
    raise exception 'No existe la carta % (%).', p_card_id, p_market using errcode = 'P0002';
  end if;
  -- La fila de esa versión: la que tenga una foto ya, si hay dos (una de
  -- TCGGO y una de edición con el mismo nombre), y si no la primera.
  select tcggo_id into v_id from public.tcg_card_versions
   where card_id = p_card_id and market = p_market and public.catalogo_id_de_version(etiqueta) = p_variante
   order by (imagen is not null) desc, (origen = 'edicion') desc, tcggo_id
   limit 1;
  if v_id is null then
    if v_imagen is null then
      return null;
    end if;
    v_etiqueta := case p_variante when 'normal' then 'Normal' when 'holo' then 'Holo' when 'reverse' then 'Reverse Holo' when 'primera' then '1st Edition' else initcap(replace(p_variante, '-', ' ')) end;
    v_id := -nextval('public.tcg_card_versions_mano_seq')::int;
    insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, imagen, origen, actualizado_at)
    values (v_id, p_market, p_card_id, v_carta.set_id, v_carta.name, v_etiqueta, v_imagen, 'foto', now());
  elsif v_imagen is null and exists (select 1 from public.tcg_card_versions where tcggo_id = v_id and origen = 'foto') then
    -- Quitar la foto de una versión de siempre es quitar la fila que solo
    -- estaba para llevarla.
    delete from public.tcg_card_versions where tcggo_id = v_id;
    return null;
  else
    update public.tcg_card_versions set imagen = v_imagen, actualizado_at = now() where tcggo_id = v_id;
  end if;
  select to_jsonb(v) into v_fila from public.tcg_card_versions v where tcggo_id = v_id;
  return v_fila;
end;
$$;

--
-- Name: catalogo_version_mano(text, text, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_version_mano(p_card_id text, p_market text, p_datos jsonb, p_tcggo_id integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_carta record;
  v_id int;
  v_nuevo int := nullif(trim(coalesce(p_datos->>'tcggo_id', '')), '')::int;
  v_etiqueta text := nullif(trim(coalesce(p_datos->>'etiqueta', '')), '');
  v_clase text := coalesce(nullif(p_datos->>'clase', ''), 'adicional');
  v_vieja record;
  v_fila jsonb;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  select id, set_id, name into v_carta from public.tcg_cards where id = p_card_id and market = p_market;
  if not found then
    raise exception 'No existe la carta % (%).', p_card_id, p_market using errcode = 'P0002';
  end if;
  if v_etiqueta is null then
    raise exception 'La versión necesita un nombre.' using errcode = '22023';
  end if;
  if public.catalogo_id_de_version(v_etiqueta) in ('normal', 'reverse', 'holo', 'primera', 'reverse-holo', 'standard', '1st-edition', 'first-edition') then
    raise exception 'Ese nombre es el de una versión de siempre: ponle otro (p. ej. «Metálica»).' using errcode = '22023';
  end if;

  if p_tcggo_id is null then
    v_id := coalesce(v_nuevo, -nextval('public.tcg_card_versions_mano_seq')::int);
    if exists (select 1 from public.tcg_card_versions where tcggo_id = v_id) then
      raise exception 'Ya hay una versión con el id %.', v_id using errcode = '23505';
    end if;
    insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, numero, nombre, etiqueta, icono, imagen, salio_en, lanzamiento, clase, link_cm, cm_id_product, origen, actualizado_at)
    values (v_id, p_market, v_carta.id, v_carta.set_id, nullif(trim(coalesce(p_datos->>'numero', '')), ''), v_carta.name, v_etiqueta,
      nullif(p_datos->>'icono', ''), nullif(trim(coalesce(p_datos->>'imagen', '')), ''), nullif(trim(coalesce(p_datos->>'salio_en', '')), ''),
      nullif(p_datos->>'lanzamiento', '')::date, v_clase, nullif(trim(coalesce(p_datos->>'link_cm', '')), ''),
      nullif(trim(coalesce(p_datos->>'cm_id_product', '')), '')::int, 'mano', now());
  else
    select tcggo_id, etiqueta into v_vieja from public.tcg_card_versions where tcggo_id = p_tcggo_id and card_id = p_card_id and origen = 'mano';
    if not found then
      raise exception 'Esa versión no es de esta carta o no está hecha a mano.' using errcode = 'P0002';
    end if;
    if v_nuevo is not null and v_nuevo <> p_tcggo_id and exists (select 1 from public.tcg_card_versions where tcggo_id = v_nuevo) then
      raise exception 'Ya hay una versión con el id %.', v_nuevo using errcode = '23505';
    end if;
    v_id := coalesce(v_nuevo, p_tcggo_id);
    update public.tcg_card_versions set
      tcggo_id = v_id,
      numero = nullif(trim(coalesce(p_datos->>'numero', '')), ''),
      etiqueta = v_etiqueta,
      icono = nullif(p_datos->>'icono', ''),
      imagen = nullif(trim(coalesce(p_datos->>'imagen', '')), ''),
      salio_en = nullif(trim(coalesce(p_datos->>'salio_en', '')), ''),
      lanzamiento = nullif(p_datos->>'lanzamiento', '')::date,
      clase = v_clase,
      link_cm = nullif(trim(coalesce(p_datos->>'link_cm', '')), ''),
      cm_id_product = nullif(trim(coalesce(p_datos->>'cm_id_product', '')), '')::int,
      actualizado_at = now()
    where tcggo_id = p_tcggo_id;
    -- Las copias apuntadas con el nombre de antes se van con ella.
    if public.catalogo_id_de_version(v_vieja.etiqueta) <> public.catalogo_id_de_version(v_etiqueta) then
      update public.user_collection set variante = public.catalogo_id_de_version(v_etiqueta)
       where card_id = p_card_id and variante = public.catalogo_id_de_version(v_vieja.etiqueta);
    end if;
  end if;
  select to_jsonb(v) into v_fila from public.tcg_card_versions v where tcggo_id = v_id;
  return v_fila;
end;
$$;

--
-- Name: catalogo_versiones_lote(text, text[], text[], boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.catalogo_versiones_lote(p_market text, p_cartas text[], p_etiquetas text[], p_quitar boolean DEFAULT false, p_mover boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_etiquetas text[];
  v_cartas text[];
  v_existen int;
  v_nuevas int := 0;
  v_ya int := 0;
  v_quitadas int := 0;
  v_copias int := 0;
  c record;
  e record;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Solo el admin corrige el catálogo.' using errcode = '42501';
  end if;
  if p_market not in ('WEST', 'JP', 'TW', 'CN') then
    raise exception 'Catálogo desconocido: %', p_market using errcode = '22023';
  end if;
  -- Las etiquetas, recortadas, sin vacías ni repetidas y en el orden dado.
  select coalesce(array_agg(t order by k), '{}') into v_etiquetas
    from (select distinct on (lower(t)) t, k
            from unnest(coalesce(p_etiquetas, '{}')) with ordinality as x(t0, k), lateral (select trim(t0) as t) y
           where t <> '' order by lower(t), k) z;
  if cardinality(v_etiquetas) = 0 then
    raise exception 'Elige al menos una versión.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_etiquetas) t where length(t) > 60) then
    raise exception 'Una versión no puede llamarse con más de 60 letras.' using errcode = '22023';
  end if;
  select coalesce(array_agg(distinct x), '{}') into v_cartas from unnest(coalesce(p_cartas, '{}')) x where x is not null and x <> '';
  if cardinality(v_cartas) = 0 then
    raise exception 'No hay ninguna carta elegida.' using errcode = '22023';
  end if;
  if cardinality(v_cartas) > 2000 then
    raise exception 'Como mucho 2.000 cartas de una vez.' using errcode = '22023';
  end if;
  select count(*) into v_existen from public.tcg_cards where market = p_market and id = any(v_cartas);
  if v_existen = 0 then
    raise exception 'Ninguna de esas cartas existe en ese catálogo.' using errcode = 'P0002';
  end if;

  if p_quitar then
    delete from public.tcg_card_versions
     where market = p_market and card_id = any(v_cartas) and origen = 'edicion'
       and lower(etiqueta) in (select lower(t) from unnest(v_etiquetas) t);
    get diagnostics v_quitadas = row_count;
    return jsonb_build_object('cartas', v_existen, 'quitadas', v_quitadas);
  end if;

  for c in select id, set_id, name, cm_id_product_propio from public.tcg_cards where market = p_market and id = any(v_cartas) order by id loop
    -- En el orden dado: la web ordena las de edición por su id (van hacia abajo).
    for e in select t, k from unnest(v_etiquetas) with ordinality as x(t, k) order by k loop
      if exists (select 1 from public.tcg_card_versions where card_id = c.id and market = p_market and origen = 'edicion' and lower(etiqueta) = lower(e.t)) then
        v_ya := v_ya + 1;
        continue;
      end if;
      insert into public.tcg_card_versions (tcggo_id, market, card_id, set_id, nombre, etiqueta, clase, cm_id_product, origen, actualizado_at)
      values (-nextval('public.tcg_card_versions_mano_seq')::int, p_market, c.id, c.set_id, c.name, e.t, 'impresion',
              case when public.catalogo_id_de_version(e.t) = 'unlimited' then c.cm_id_product_propio end, 'edicion', now());
      v_nuevas := v_nuevas + 1;
    end loop;
  end loop;

  if p_mover and exists (select 1 from unnest(v_etiquetas) t where public.catalogo_id_de_version(t) = 'unlimited') then
    update public.user_collection set variante = 'unlimited'
     where market = p_market and card_id = any(v_cartas) and coalesce(variante, 'normal') in ('normal', 'holo');
    get diagnostics v_copias = row_count;
  end if;

  return jsonb_build_object('cartas', v_existen, 'nuevas', v_nuevas, 'ya', v_ya, 'copias', v_copias);
end;
$$;

--
-- Name: cerrar_sesion(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cerrar_sesion(p_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if auth.uid() is null or p_id is null or p_id::text = coalesce(auth.jwt() ->> 'session_id', '') then
    return false;
  end if;
  delete from auth.sessions where id = p_id and user_id = auth.uid();
  return found;
end $$;

--
-- Name: coleccion_es_publica(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.coleccion_es_publica(p_user uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select coleccion_publica from public.user_profiles where id = p_user), false);
$$;

--
-- Name: coleccion_foto_diaria(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.coleccion_foto_diaria(p_dia date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_filas int;
begin
  insert into public.user_collection_value (user_id, dia, valor, copias, distintas, sin_precio)
  select c.user_id,
         p_dia,
         sum(public.valor_de_copia(c, pr)),
         sum(c.cantidad),
         count(distinct c.card_id),
         coalesce(sum(c.cantidad) filter (where public.sin_precio(c, pr)), 0)
    from public.user_collection c
    left join public.tcg_card_prices pr on pr.card_id = c.card_id
   group by c.user_id
  on conflict (user_id, dia) do update
    set valor = excluded.valor,
        copias = excluded.copias,
        distintas = excluded.distintas,
        sin_precio = excluded.sin_precio;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

--
-- Name: coleccion_por_set(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.coleccion_por_set(p_market text DEFAULT 'WEST'::text) RETURNS TABLE(set_id text, distintas integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select c.set_id, count(distinct l.card_id)::int
  from public.user_collection l
  join public.tcg_cards c on c.id = l.card_id and c.market = l.market
  where l.user_id = auth.uid()
    and l.market = coalesce(nullif(p_market, ''), 'WEST')
  group by c.set_id
$$;

--
-- Name: coleccion_quien_la_tiene(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.coleccion_quien_la_tiene(p_card_id text) RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, is_admin boolean, is_moderator boolean, copias bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select p.id,
         p.username,
         p.display_name,
         p.avatar_url,
         coalesce(p.is_admin, false),
         coalesce(p.is_moderator, false),
         sum(c.cantidad)
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
   where c.card_id = p_card_id
     and c.user_id <> auth.uid()
     -- Solo a quien sigues: la pregunta es «quién de los MÍOS», no
     -- «quién en toda la web». Lo segundo sería un directorio de
     -- colecciones ajenas.
     and exists (
       select 1 from public.user_follows f
        where f.follower_id = auth.uid() and f.following_id = c.user_id
     )
     and coalesce(p.coleccion_publica, false)
     and not coalesce(p.is_banned, false)
   group by p.id, p.username, p.display_name, p.avatar_url, p.is_admin, p.is_moderator
   order by sum(c.cantidad) desc, p.username
   limit 20;
$$;

--
-- Name: coleccion_quien_la_tiene_todos(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.coleccion_quien_la_tiene_todos(p_card_id text, p_limite integer DEFAULT 12) RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, is_admin boolean, is_moderator boolean, copias bigint, da bigint, sigues boolean, total bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with suyos as (
    select c.user_id,
           sum(c.cantidad)::bigint as copias,
           sum(greatest(coalesce(c.cambio, 0), 0))::bigint as da
      from public.user_collection c
     where c.card_id = p_card_id
       and c.user_id is distinct from auth.uid()
     group by c.user_id
  ), visibles as (
    select p.id,
           p.username,
           p.display_name,
           p.avatar_url,
           coalesce(p.is_admin, false) as es_admin,
           coalesce(p.is_moderator, false) as es_mod,
           case when coalesce(p.coleccion_publica, false) then s.copias else s.da end as copias,
           s.da,
           exists (
             select 1 from public.user_follows f
              where f.follower_id = auth.uid() and f.following_id = p.id
           ) as sigues
      from suyos s
      join public.user_profiles p on p.id = s.user_id
     where (coalesce(p.coleccion_publica, false) or s.da > 0)
       and not coalesce(p.is_banned, false)
  )
  select id, username, display_name, avatar_url, es_admin, es_mod, copias, da, sigues,
         count(*) over ()::bigint as total
    from visibles
   order by sigues desc, (da > 0) desc, copias desc, username
   limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;

--
-- Name: coleccion_seguidos_y_mis_deseos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.coleccion_seguidos_y_mis_deseos() RETURNS TABLE(card_id text, user_id uuid, username text, display_name text, avatar_url text, is_admin boolean, is_moderator boolean, copias bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.card_id,
         p.id,
         p.username,
         p.display_name,
         p.avatar_url,
         coalesce(p.is_admin, false),
         coalesce(p.is_moderator, false),
         sum(c.cantidad)
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
   where c.card_id in (select w.card_id from public.user_wants w where w.user_id = auth.uid())
     and c.user_id <> auth.uid()
     and exists (
       select 1 from public.user_follows f
        where f.follower_id = auth.uid() and f.following_id = c.user_id
     )
     and coalesce(p.coleccion_publica, false)
     and not coalesce(p.is_banned, false)
   group by c.card_id, p.id, p.username, p.display_name, p.avatar_url, p.is_admin, p.is_moderator
   order by c.card_id, sum(c.cantidad) desc, p.username
   limit 2000;
$$;

--
-- Name: coleccion_valor_de(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.coleccion_valor_de(p_user uuid DEFAULT auth.uid()) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
    when p_user is null or not (p_user = auth.uid() or public.coleccion_es_publica(p_user)) then null
    else (
      select jsonb_build_object(
        'valor', coalesce(sum(public.valor_de_copia(c, pr)), 0),
        'copias', coalesce(sum(c.cantidad), 0),
        'lineas', count(*),
        'distintas', count(distinct c.card_id),
        'sin_precio', coalesce(sum(c.cantidad) filter (where public.sin_precio(c, pr)), 0))
      from public.user_collection c
      left join public.tcg_card_prices pr on pr.card_id = c.card_id
      where c.user_id = p_user)
  end
$$;

--
-- Name: course_attempt_medalla(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.course_attempt_medalla() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
declare
  ratio numeric;
begin
  if new.total <= 0 then
    new.medal := null;
    return new;
  end if;

  ratio := new.correct::numeric / new.total::numeric;

  new.medal := case
    when ratio >= 1 then 'oro'
    when ratio >= 0.8 then 'plata'
    when ratio >= 0.5 then 'bronce'
    else null
  end;

  return new;
end;
$$;

--
-- Name: course_leaderboard(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.course_leaderboard(p_guide_id uuid, p_limit integer DEFAULT 100) RETURNS TABLE(posicion bigint, user_id uuid, username text, display_name text, avatar_url text, score integer, correct integer, total integer, medal text, duration_ms integer, achieved_at timestamp with time zone)
    LANGUAGE sql STABLE
    AS $$
  select
    row_number() over (
      order by m.score desc, m.duration_ms asc nulls last, m.created_at asc
    ) as posicion,
    m.user_id, m.username, m.display_name, m.avatar_url,
    m.score, m.correct, m.total, m.medal, m.duration_ms, m.created_at
  from (
    -- `distinct on` obliga a que el orden empiece por user_id; el resto
    -- del orden es lo que decide CUÁL de tus partidas es la buena.
    select distinct on (a.user_id)
      a.user_id, p.username, p.display_name, p.avatar_url,
      a.score, a.correct, a.total, a.medal, a.duration_ms, a.created_at
    from public.course_attempts a
    join public.user_profiles p on p.id = a.user_id
    where a.guide_id = p_guide_id
      and coalesce(p.hide_activity, false) = false
      and coalesce(p.is_banned, false) = false
    order by a.user_id, a.score desc, a.duration_ms asc nulls last, a.created_at asc
  ) m
  order by posicion
  limit greatest(coalesce(p_limit, 100), 1)
$$;

--
-- Name: cuenta_borrado_pendiente(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cuenta_borrado_pendiente() RETURNS TABLE(id uuid, borrar_at timestamp with time zone, creada timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select r.id, r.borrar_at, r.created_at
  from public.account_deletion_requests r
  where r.user_id = auth.uid() and r.status = 'pending'
  order by r.created_at desc
  limit 1
$$;

--
-- Name: cuenta_borrar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cuenta_borrar(p_user uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $_$
declare
  v_par text[];
  v_n integer;
  v_hecho jsonb := '{}'::jsonb;
  v_col text;
  -- Lo privado: se borra entero. (tabla, columna con el usuario)
  v_borrar text[][] := array[
    array['user_collection', 'user_id'], array['user_collection_value', 'user_id'],
    array['user_wants', 'user_id'], array['user_want_list_items', 'user_id'], array['user_want_lists', 'user_id'],
    array['user_products', 'user_id'], array['user_albums', 'user_id'], array['user_decks', 'user_id'],
    array['user_direcciones', 'user_id'], array['user_cobros', 'user_id'], array['user_cumple', 'user_id'],
    array['user_privado', 'user_id'], array['user_follows', 'follower_id'], array['user_follows', 'following_id'],
    array['push_subscriptions', 'user_id'], array['user_price_alerts', 'user_id'], array['user_release_alerts', 'user_id'],
    array['user_showcase', 'user_id'], array['user_play_pokemon', 'user_id'],
    array['match_log', 'user_id'], array['match_log_ajustes', 'user_id'], array['match_log_torneos', 'user_id'],
    array['user_notifications', 'recipient_id'], array['forum_subscriptions', 'user_id'], array['forum_thread_reads', 'user_id'],
    array['collection_folders', 'user_id'], array['collection_favorite_sets', 'user_id'], array['online_now', 'user_id'],
    array['trade_offer_direcciones', 'quien'], array['trade_offer_cobros', 'quien'],
    array['retos_partidas', 'user_id'], array['evento_asistentes', 'user_id'], array['aviso_participantes', 'user_id'],
    array['course_attempts', 'user_id'], array['course_review_queue', 'user_id'], array['daily_challenge_results', 'user_id'],
    array['guide_helpful', 'user_id'], array['forum_post_likes', 'user_id'], array['forum_post_reactions', 'user_id'],
    array['private_message_reactions', 'user_id'], array['tienda_avisos', 'user_id'], array['adviento_casillas', 'user_id'],
    array['replay_puzzle_answers', 'user_id'], array['user_cumple', 'user_id']
  ];
  -- Del perfil: lo que se vacía (si existe).
  v_vaciar text[] := array['avatar_url', 'banner_url', 'banner_color', 'bio', 'birthday_md', 'forum_title', 'showcase_achievement',
    'website', 'instagram', 'twitter', 'location', 'ciudad', 'favorite_pokemon', 'pokemon_favorito', 'tcg_live_name', 'play_pokemon_id'];
begin
  if p_user is null then
    return '{}'::jsonb;
  end if;
  foreach v_par slice 1 in array v_borrar loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = v_par[1] and column_name = v_par[2]) then
      execute format('delete from public.%I where %I = $1', v_par[1], v_par[2]) using p_user;
      get diagnostics v_n = row_count;
      if v_n > 0 then v_hecho := v_hecho || jsonb_build_object(v_par[1], coalesce((v_hecho ->> v_par[1])::int, 0) + v_n); end if;
    end if;
  end loop;
  -- Los mensajes privados: vacíos y marcados, para que la conversación del
  -- otro no se rompa.
  if to_regclass('public.private_messages') is not null then
    update public.private_messages set body = '', adjuntos = '[]'::jsonb, deleted_at = coalesce(deleted_at, now()) where sender_id = p_user;
    get diagnostics v_n = row_count;
    v_hecho := v_hecho || jsonb_build_object('mensajes_vaciados', v_n);
  end if;
  -- El perfil, anónimo.
  update public.user_profiles set
    username = 'borrado-' || left(replace(p_user::text, '-', ''), 10),
    display_name = 'Usuario borrado',
    borrado_at = now()
  where id = p_user;
  foreach v_col in array v_vaciar loop
    if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = v_col) then
      execute format('update public.user_profiles set %I = null where id = $1', v_col) using p_user;
    end if;
  end loop;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'hide_activity') then
    update public.user_profiles set hide_activity = true where id = p_user;
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'user_profiles' and column_name = 'coleccion_publica') then
    update public.user_profiles set coleccion_publica = false where id = p_user;
  end if;
  -- El acceso: sin email de verdad, sin contraseña, sin Google, sin sesiones.
  begin
    update auth.users set
      email = 'borrado+' || replace(p_user::text, '-', '') || '@pokedoc.invalid',
      encrypted_password = null,
      phone = null,
      raw_user_meta_data = '{}'::jsonb,
      banned_until = 'infinity'
    where id = p_user;
  exception when others then
    v_hecho := v_hecho || jsonb_build_object('auth_users', sqlerrm);
  end;
  begin execute 'delete from auth.identities where user_id = $1' using p_user; exception when others then null; end;
  begin execute 'delete from auth.sessions where user_id = $1' using p_user; exception when others then null; end;
  begin execute 'delete from auth.mfa_factors where user_id = $1' using p_user; exception when others then null; end;
  update public.account_deletion_requests set status = 'done' where user_id = p_user and status = 'pending';
  return v_hecho;
end $_$;

--
-- Name: cuenta_cancelar_borrado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cuenta_cancelar_borrado() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  update public.account_deletion_requests set status = 'cancelled'
  where user_id = auth.uid() and status = 'pending';
  return found;
end $$;

--
-- Name: cuenta_nueva(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cuenta_nueva(p_uid uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select exists (select 1 from auth.users u where u.id = p_uid and u.created_at > now() - interval '24 hours')
$$;

--
-- Name: cuenta_pedir_borrado(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cuenta_pedir_borrado(p_motivo text DEFAULT NULL::text) RETURNS timestamp with time zone
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_tienda boolean;
  v_cuando timestamptz;
begin
  if v_uid is null then
    raise exception 'Hace falta entrar.' using errcode = '42501';
  end if;
  select coalesce(p.tipo = 'tienda', false) into v_tienda from public.user_profiles p where p.id = v_uid;
  v_cuando := case when coalesce(v_tienda, false) then null else now() + interval '14 days' end;
  update public.account_deletion_requests set status = 'cancelled' where user_id = v_uid and status = 'pending';
  insert into public.account_deletion_requests (user_id, reason, status, borrar_at)
  values (v_uid, left(nullif(trim(p_motivo), ''), 500), 'pending', v_cuando);
  return v_cuando;
end $$;

--
-- Name: cuentas_borrar_vencidas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cuentas_borrar_vencidas() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_r record;
  v_n integer := 0;
begin
  for v_r in select distinct user_id from public.account_deletion_requests
             where status = 'pending' and borrar_at is not null and borrar_at <= now() loop
    perform public.cuenta_borrar(v_r.user_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

--
-- Name: cumple_al_perfil(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cumple_al_perfil() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if tg_op = 'DELETE' then
    update public.user_profiles set birthday_md = null where id = old.user_id;
    return old;
  end if;
  update public.user_profiles
    set birthday_md = lpad(extract(month from new.birthday)::int::text, 2, '0') || '-' || lpad(extract(day from new.birthday)::int::text, 2, '0')
    where id = new.user_id;
  return new;
end $$;

--
-- Name: dar_xp_al_autor(uuid, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.dar_xp_al_autor(p_guia uuid, p_quien uuid, p_xp integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_autor uuid;
begin
  select author_id into v_autor from guides where id = p_guia;
  -- Sin autor (guía oficial) no hay a quién dárselo; y nadie se da XP a
  -- sí mismo leyendo lo suyo.
  if v_autor is null or v_autor = p_quien then
    return;
  end if;
  update user_profiles set total_xp = coalesce(total_xp, 0) + p_xp where id = v_autor;
end;
$$;

--
-- Name: email_outbox_errores(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_outbox_errores() RETURNS TABLE(type text, last_error text, attempts integer, created_at timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select o.type, o.last_error, o.attempts, o.created_at
  from public.email_outbox o
  where o.last_error is not null
    and exists (
      select 1 from public.user_profiles p
      where p.id = auth.uid() and p.is_admin = true
    )
  order by o.created_at desc
  limit 20
$$;

--
-- Name: email_outbox_resumen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_outbox_resumen() RETURNS TABLE(type text, status text, cuantos bigint, ultimo timestamp with time zone)
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select o.type, o.status, count(*), max(coalesce(o.sent_at, o.created_at))
  from public.email_outbox o
  where exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid() and p.is_admin = true
  )
  group by o.type, o.status
  order by 3 desc
$$;

--
-- Name: email_preview(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.email_preview(p_texto text, p_largo integer DEFAULT 140) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  select case
    when p_texto is null then null
    when length(regexp_replace(p_texto, '\s+', ' ', 'g')) <= p_largo
      then trim(regexp_replace(p_texto, '\s+', ' ', 'g'))
    else trim(regexp_replace(
      left(regexp_replace(p_texto, '\s+', ' ', 'g'), p_largo),
      '\s\S*$', ''
    )) || '…'
  end
$_$;

--
-- Name: emparejamiento_dudoso(numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.emparejamiento_dudoso(p_eur numeric, p_usd numeric) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when coalesce(p_eur, 0) <= 0 or coalesce(p_usd, 0) <= 0 then false
    else p_eur / (p_usd * public.eur_por_usd()) > 10 or (p_usd * public.eur_por_usd()) / p_eur > 10
  end;
$$;

--
-- Name: enlace_corto_crear(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enlace_corto_crear(p_tipo text, p_carga text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_huella text;
  v_id text;
  v_quien text := public.enlaces_cortos_quien();
  v_letras constant text := 'abcdefghjkmnpqrstuvwxyz23456789';
  i int;
begin
  if p_tipo is null or p_tipo not in ('repeticion', 'posicion') then
    raise exception 'Ese tipo de enlace no existe.' using errcode = '22023';
  end if;
  if p_carga is null or char_length(p_carga) < 8 or char_length(p_carga) > 60000 then
    raise exception 'Eso no cabe en un enlace corto: usa el largo.' using errcode = '22023';
  end if;
  -- La forma que hace la web, y ninguna otra: lo de detrás del `#`.
  if (p_tipo = 'repeticion' and p_carga !~ '^(p|t)=[A-Za-z0-9_-]+$')
     or (p_tipo = 'posicion' and p_carga !~ '^pos=[A-Za-z0-9_-]+$') then
    raise exception 'Eso no es un enlace de PokeDoc.' using errcode = '22023';
  end if;

  v_huella := md5(p_tipo || ':' || p_carga);
  select e.id into v_id from public.enlaces_cortos e where e.huella = v_huella;
  if v_id is not null then
    return v_id;
  end if;

  -- Sin conexión conocida (`v_quien` null), `e.quien = v_quien` no casa con
  -- nada y este tope no cuenta: queda el del día.
  if (
    select count(*) from public.enlaces_cortos e where e.quien = v_quien and e.creado_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Has hecho muchos enlaces cortos en una hora: espera un poco (el largo funciona igual).' using errcode = 'P0001';
  end if;
  if (select count(*) from public.enlaces_cortos e where e.creado_at > now() - interval '1 day') >= 3000 then
    raise exception 'Hoy ya se han hecho muchos enlaces cortos: usa el largo, que funciona igual.' using errcode = 'P0001';
  end if;

  loop
    v_id := '';
    for i in 1..8 loop
      v_id := v_id || substr(v_letras, 1 + floor(random() * length(v_letras))::int, 1);
    end loop;
    begin
      insert into public.enlaces_cortos (id, tipo, carga, huella, quien) values (v_id, p_tipo, p_carga, v_huella, v_quien);
      return v_id;
    exception when unique_violation then
      -- O ese id ya estaba (se prueba otro), o la misma carga ha entrado a
      -- la vez por otra llamada (y entonces es esa).
      select e.id into v_id from public.enlaces_cortos e where e.huella = v_huella;
      if v_id is not null then
        return v_id;
      end if;
    end;
  end loop;
end;
$_$;

--
-- Name: enlace_corto_leer(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enlace_corto_leer(p_id text) RETURNS TABLE(tipo text, carga text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select e.tipo, e.carga from public.enlaces_cortos e where e.id = p_id;
$$;

--
-- Name: enlace_de_fuera(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enlace_de_fuera(p_texto text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(p_texto, '') ~* '(https?://|www\.)'
     and regexp_replace(coalesce(p_texto, ''), '(https?://)?(www\.)?pokedoc\.es[^\s"''<>]*', '', 'gi') ~* '(https?://|www\.)'
$$;

--
-- Name: enlaces_cortos_quien(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enlaces_cortos_quien() RETURNS text
    LANGUAGE plpgsql STABLE
    AS $$
declare
  v_cab json;
  v_ip text;
begin
  begin
    v_cab := nullif(current_setting('request.headers', true), '')::json;
  exception when others then
    v_cab := null;
  end;
  v_ip := coalesce(nullif(trim(v_cab ->> 'cf-connecting-ip'), ''), nullif(trim(split_part(coalesce(v_cab ->> 'x-forwarded-for', ''), ',', 1)), ''));
  return case when v_ip is null then null else md5('pokedoc-enlaces:' || v_ip) end;
end;
$$;

--
-- Name: enqueue_email(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_email(p_recipient uuid, p_type text, p_subject text, p_preview text, p_link text, p_thread_key text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_desactivados text[];
begin
  if p_recipient is null then
    return;
  end if;

  select notification_email_disabled into v_desactivados
  from user_profiles where id = p_recipient;

  -- Si no hay perfil, no se encola: sin perfil no hay forma de saber si
  -- esa persona quiere correo, y el silencio es la opción segura.
  if v_desactivados is null then
    return;
  end if;

  if p_type = any (v_desactivados) then
    return;
  end if;

  -- Agrupación. Dos casos, y los dos importan:
  --
  --   a) Ya hay un correo PENDIENTE del mismo hilo. Diez mensajes
  --      seguidos en la misma conversación deben ser un correo, no diez.
  --   b) Ya se ENVIÓ uno del mismo hilo hace menos de 30 minutos. Si no,
  --      una conversación en directo se convierte en un correo por cada
  --      frase, que es exactamente lo que hace que la gente se dé de baja.
  if p_thread_key is not null and exists (
    select 1 from email_outbox
    where recipient_id = p_recipient
      and thread_key = p_thread_key
      and (
        status = 'pending'
        or (status = 'sent' and sent_at > now() - interval '30 minutes')
      )
  ) then
    return;
  end if;

  insert into email_outbox (recipient_id, type, subject, preview, link, thread_key)
  values (p_recipient, p_type, p_subject, p_preview, p_link, p_thread_key);
end $$;

--
-- Name: esconder_si_denuncian(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.esconder_si_denuncian() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if new.content_type <> 'forum_post' then
    return new;
  end if;
  -- Tres personas distintas y con cuenta de más de una semana: tres cuentas
  -- recién hechas no pueden esconder a nadie.
  if (select count(distinct r.reporter_id)
        from public.content_reports r join auth.users u on u.id = r.reporter_id
       where r.content_type = 'forum_post' and r.content_id = new.content_id and r.status = 'pending'
         and u.created_at < now() - interval '7 days') >= 3 then
    -- Lo hace la base, no quien denuncia: la guarda de abajo lo deja pasar.
    perform set_config('pokedoc.esconder_spam', 'si', true);
    update public.forum_posts set oculto_spam_at = now() where id = new.content_id and oculto_spam_at is null;
    perform set_config('pokedoc.esconder_spam', '', true);
  end if;
  return new;
end $$;

--
-- Name: eur_por_usd(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eur_por_usd() RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$ select 0.86::numeric $$;

--
-- Name: evento_ficha(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evento_ficha(p_slug text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select evento_json(e, 500)
  from eventos e
  where e.slug = p_slug
    and (e.publicado or (auth.uid() is not null and public.is_admin()))
$$;

--
-- Name: evento_hilo(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evento_hilo(p_evento uuid, p_titulo text, p_cuerpo text, p_prefijo text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_hilo uuid;
  v_foro uuid;
  v_primero uuid;
begin
  if not public.is_admin() then
    raise exception 'Solo el equipo abre los hilos de los eventos' using errcode = '42501';
  end if;
  if coalesce(btrim(p_titulo), '') = '' or coalesce(btrim(p_cuerpo), '') = '' then
    raise exception 'Falta el título o el mensaje del hilo' using errcode = '22023';
  end if;

  select e.hilo_id into v_hilo from eventos e where e.id = p_evento;
  if not found then
    raise exception 'Ese evento no existe' using errcode = 'P0002';
  end if;
  if v_hilo is not null and not exists (select 1 from forum_threads t where t.id = v_hilo) then
    v_hilo := null;
  end if;

  if v_hilo is not null then
    select p.id into v_primero from forum_posts p where p.thread_id = v_hilo order by p.created_at, p.id limit 1;
    update forum_posts set author_id = null, body_html = p_cuerpo where id = v_primero;
    update forum_threads t
       set title = left(p_titulo, 150),
           prefix = coalesce(p_prefijo, t.prefix),
           author_id = null,
           de_pokedoc = true,
           last_post_author_id = case when t.post_count <= 1 then null else t.last_post_author_id end
     where t.id = v_hilo;
    return v_hilo;
  end if;

  select b.id into v_foro from forum_boards b where b.slug = 'eventos';
  if v_foro is null then
    raise exception 'Falta el foro «Eventos y quedadas» (supabase-migration-1197-eventos-foro.sql)' using errcode = 'P0002';
  end if;
  insert into forum_threads (board_id, author_id, title, prefix, de_pokedoc)
  values (v_foro, null, left(p_titulo, 150), p_prefijo, true)
  returning id into v_hilo;
  insert into forum_posts (thread_id, author_id, body_html) values (v_hilo, null, p_cuerpo);
  update eventos set hilo_id = v_hilo where id = p_evento;
  return v_hilo;
end;
$$;

--
-- Name: eventos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.eventos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    nombre text NOT NULL,
    tipo text DEFAULT 'card_show'::text NOT NULL,
    empieza timestamp with time zone NOT NULL,
    termina timestamp with time zone,
    sitio text,
    direccion text,
    ciudad text,
    provincia text,
    entrada text,
    juegos text,
    descripcion text,
    web text,
    instagram text,
    tcgmap_url text,
    logo_url text,
    siglas text,
    color text,
    publicado boolean DEFAULT true NOT NULL,
    creado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    horario jsonb DEFAULT '[]'::jsonb NOT NULL,
    entradas jsonb DEFAULT '[]'::jsonb NOT NULL,
    cartel_url text,
    hilo_id uuid,
    destacado boolean DEFAULT false NOT NULL,
    logo_sin_fondo boolean DEFAULT false NOT NULL,
    CONSTRAINT eventos_check CHECK (((termina IS NULL) OR (termina >= empieza))),
    CONSTRAINT eventos_color_check CHECK (((color IS NULL) OR (color ~ '^#[0-9a-fA-F]{6}$'::text))),
    CONSTRAINT eventos_entradas_lista CHECK (((jsonb_typeof(entradas) = 'array'::text) AND (jsonb_array_length(entradas) <= 12))),
    CONSTRAINT eventos_horario_lista CHECK (((jsonb_typeof(horario) = 'array'::text) AND (jsonb_array_length(horario) <= 31))),
    CONSTRAINT eventos_nombre_check CHECK (((length(btrim(nombre)) >= 2) AND (length(btrim(nombre)) <= 120))),
    CONSTRAINT eventos_siglas_check CHECK (((siglas IS NULL) OR (length(siglas) <= 8))),
    CONSTRAINT eventos_slug_check CHECK ((slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text)),
    CONSTRAINT eventos_tipo_check CHECK ((tipo = ANY (ARRAY['card_show'::text, 'trade_day'::text, 'trade_night'::text, 'quedada'::text, 'torneo'::text])))
);

--
-- Name: evento_json(public.eventos, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evento_json(e public.eventos, p_caras integer DEFAULT 5) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select to_jsonb(e) - 'creado_por'
    || jsonb_build_object(
      'van', (select count(*) from evento_asistentes a where a.evento_id = e.id),
      'caras', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'display_name', p.display_name, 'avatar_url', p.avatar_url) order by a.created_at)
        from (select * from evento_asistentes a where a.evento_id = e.id and not a.oculto order by a.created_at limit greatest(p_caras, 0)) a
        join user_profiles p on p.id = a.user_id
      ), '[]'::jsonb),
      'voy', exists (select 1 from evento_asistentes a where a.evento_id = e.id and a.user_id = auth.uid()),
      'oculto', coalesce((select a.oculto from evento_asistentes a where a.evento_id = e.id and a.user_id = auth.uid()), false),
      'mi_numero', (
        select count(*) from evento_asistentes o, evento_asistentes yo
        where yo.evento_id = e.id and yo.user_id = auth.uid()
          and o.evento_id = e.id
          and (o.created_at, o.user_id) <= (yo.created_at, yo.user_id)
      )
    )
$$;

--
-- Name: evento_lista(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evento_lista(p_lista uuid) RETURNS TABLE(card_id text, market text, nombre text, user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select i.card_id, i.market, l.nombre, l.user_id
  from public.user_want_list_items i
  join public.user_want_lists l on l.id = i.list_id
  where i.list_id = p_lista
    and exists (select 1 from public.user_wants w where w.user_id = i.user_id and w.card_id = i.card_id);
$$;

--
-- Name: evento_voy(uuid, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.evento_voy(p_evento uuid, p_voy boolean DEFAULT true, p_oculto boolean DEFAULT false) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_yo uuid := auth.uid();
  v_e eventos;
begin
  if v_yo is null then
    raise exception 'Entra en tu cuenta para marcar que vas';
  end if;
  select * into v_e from eventos where id = p_evento and publicado;
  if not found then
    raise exception 'Ese evento no existe';
  end if;
  if p_voy then
    if coalesce(v_e.termina, v_e.empieza) < now() - interval '1 day' then
      raise exception 'Ese evento ya pasó';
    end if;
    insert into evento_asistentes (evento_id, user_id, oculto) values (p_evento, v_yo, coalesce(p_oculto, false))
    on conflict (evento_id, user_id) do update set oculto = excluded.oculto;
  else
    delete from evento_asistentes where evento_id = p_evento and user_id = v_yo;
  end if;
  return jsonb_build_object(
    'voy', p_voy,
    'oculto', p_voy and coalesce(p_oculto, false),
    'van', (select count(*) from evento_asistentes where evento_id = p_evento)
  );
end;
$$;

--
-- Name: eventos_lista(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eventos_lista(p_desde timestamp with time zone DEFAULT (now() - '120 days'::interval)) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(evento_json(e, 5) order by e.empieza), '[]'::jsonb)
  from eventos e
  where e.publicado and coalesce(e.termina, e.empieza) >= p_desde
$$;

--
-- Name: eventos_uno_destacado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.eventos_uno_destacado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.destacado then
    update public.eventos set destacado = false where destacado and id <> new.id;
  end if;
  return new;
end $$;

--
-- Name: foro_premiar_solucion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.foro_premiar_solucion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_autor uuid;
  v_nuevo uuid;
begin
  if new.solved_post_id is null or new.solved_post_id is not distinct from old.solved_post_id then
    return new;
  end if;
  select author_id into v_autor from public.forum_posts where id = new.solved_post_id and thread_id = new.id;
  if v_autor is null or v_autor is not distinct from new.author_id then
    return new;
  end if;
  insert into public.forum_solucion_xp (thread_id, post_id, autor)
  values (new.id, new.solved_post_id, v_autor)
  on conflict (thread_id) do nothing
  returning thread_id into v_nuevo;
  if v_nuevo is null then
    return new;
  end if;
  update public.user_profiles
     set total_xp = coalesce(total_xp, 0) + 15,
         level = public.nivel_de_xp(coalesce(total_xp, 0) + 15)
   where id = v_autor;
  insert into public.user_notifications (recipient_id, type, title, body, link)
  values (
    v_autor,
    'forum_solucion',
    'Tu respuesta resolvió una duda',
    left(coalesce(new.title, ''), 140) || ' · +15 XP',
    '/tema/' || new.id || '#mensaje-' || new.solved_post_id
  );
  return new;
end $$;

--
-- Name: foro_resumen(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.foro_resumen() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_hasta timestamptz := (select u.forum_read_all_at from public.user_profiles u where u.id = v_uid);
  v jsonb;
begin
  with foros as (
    select f.* from public.forum_boards_resumen f where not coalesce(f.is_hidden, false)
  ),
  sin_leer as (
    select t.board_id, count(*)::int as n
      from public.forum_threads t
      left join public.forum_thread_reads r on r.thread_id = t.id and r.user_id = v_uid
     where v_uid is not null and t.last_post_at is not null
       and (t.last_post_author_id is null or t.last_post_author_id <> v_uid)
       and t.last_post_at > coalesce(greatest(r.last_read_at, v_hasta), '-infinity'::timestamptz)
     group by t.board_id
  ),
  perfiles as (
    select u.id, u.username, u.display_name, u.avatar_url, u.level, u.total_xp, u.hide_activity, u.is_admin, u.is_moderator
      from public.user_profiles u
     where u.id in (select f.last_post_author_id from foros f where f.last_post_author_id is not null)
  )
  select jsonb_build_object(
    'secciones', coalesce((select jsonb_agg(to_jsonb(s) order by s.position) from public.forum_sections s), '[]'::jsonb),
    'foros', coalesce((select jsonb_agg(to_jsonb(f) order by f.position) from foros f), '[]'::jsonb),
    'nuevos', coalesce((select jsonb_object_agg(x.board_id::text, x.n) from sin_leer x), '{}'::jsonb),
    'perfiles', coalesce((select jsonb_object_agg(p.id::text, to_jsonb(p)) from perfiles p), '{}'::jsonb),
    'pokedoc', coalesce((select jsonb_agg(f.id) from foros f join public.forum_threads t on t.id = f.last_thread_id
                          where f.last_post_author_id is null and t.de_pokedoc and t.post_count <= 1), '[]'::jsonb),
    'rol', (select jsonb_build_object('staff', coalesce(u.is_admin, false) or coalesce(u.is_moderator, false), 'admin', coalesce(u.is_admin, false))
              from public.user_profiles u where u.id = v_uid),
    'marcas', v_uid is not null
  ) into v;
  return v;
end;
$$;

--
-- Name: foro_spam_revisar(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.foro_spam_revisar(p_post uuid, p_borrar boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if auth.uid() is null or not public.sin_freno() then
    raise exception 'Solo el equipo puede revisar esto.' using errcode = '42501';
  end if;
  update public.content_reports set status = 'reviewed'
   where content_type = 'forum_post' and content_id = p_post and status = 'pending';
  if p_borrar then
    delete from public.forum_posts where id = p_post;
  else
    update public.forum_posts set oculto_spam_at = null where id = p_post;
  end if;
  return found;
end $$;

--
-- Name: forum_avisar_suscritos(uuid, uuid, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forum_avisar_suscritos(p_thread uuid, p_post uuid, p_titulo text, p_ya_avisados uuid[] DEFAULT '{}'::uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_yo uuid := auth.uid();
  v_cuantos integer := 0;
begin
  if v_yo is null then
    return 0;
  end if;

  -- Que el mensaje exista, sea de ese tema y sea de quien dice ser.
  if not exists (
    select 1 from forum_posts p
    where p.id = p_post and p.thread_id = p_thread and p.author_id = v_yo
  ) then
    return 0;
  end if;

  with destinatarios as (
    select s.user_id
      from forum_subscriptions s
      join user_profiles u on u.id = s.user_id
     where s.thread_id = p_thread
       and s.user_id <> v_yo
       and not (s.user_id = any(coalesce(p_ya_avisados, '{}')))
       and coalesce(u.is_banned, false) = false
       and not (coalesce(u.notification_prefs_disabled, '{}') @> array['forum_reply'])
  ), insertados as (
    insert into user_notifications (recipient_id, type, title, body, link)
    select d.user_id,
           'forum_reply',
           'Nueva respuesta en un tema que sigues',
           left(coalesce(p_titulo, ''), 200),
           '/tema/' || p_thread::text
      from destinatarios d
    returning 1
  )
  select count(*) into v_cuantos from insertados;

  return v_cuantos;
end;
$$;

--
-- Name: forum_contar_mensajes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forum_contar_mensajes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  update public.user_profiles
     set forum_post_count = greatest(0, forum_post_count + (case when tg_op = 'INSERT' then 1 else -1 end))
   where id = coalesce(new.author_id, old.author_id);
  return null;
end;
$$;

--
-- Name: forum_editar_encuesta(uuid, text, boolean, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forum_editar_encuesta(p_thread uuid, p_pregunta text, p_multiple boolean, p_opciones text[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_autor uuid;
  v_de_antes text[];
  v_multiple_antes boolean;
  v_borrados integer := 0;
  v_opcion text;
  v_pos integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Entra con tu cuenta.';
  end if;
  if public.is_banned() or public.is_muted() then
    raise exception 'Tu cuenta no puede hacer cambios en el foro.';
  end if;

  select t.author_id into v_autor from public.forum_threads t where t.id = p_thread;
  if v_autor is null then
    raise exception 'Este tema no existe.';
  end if;
  if v_autor <> auth.uid() and not public.is_staff() then
    raise exception 'Solo quien abrió el tema (o el equipo) puede tocar su encuesta.';
  end if;

  select p.multiple into v_multiple_antes from public.forum_polls p where p.thread_id = p_thread;
  if v_multiple_antes is null then
    raise exception 'Este tema no tiene encuesta.';
  end if;

  -- Quitar la encuesta entera: opciones y votos se van en cascada.
  if p_opciones is null then
    select count(*) into v_borrados from public.forum_poll_votes v where v.thread_id = p_thread;
    delete from public.forum_polls where thread_id = p_thread;
    return v_borrados;
  end if;

  -- Las mismas reglas que al crearla (ver js/encuesta.js): aquí también,
  -- porque esta función es alcanzable llamando a la API sin pasar por la
  -- pantalla.
  if coalesce(trim(p_pregunta), '') = '' or length(p_pregunta) > 150 then
    raise exception 'La pregunta no puede estar vacía (ni pasar de 150 letras).';
  end if;
  if array_length(p_opciones, 1) < 2 or array_length(p_opciones, 1) > 8 then
    raise exception 'La encuesta necesita entre 2 y 8 opciones.';
  end if;
  foreach v_opcion in array p_opciones loop
    if coalesce(trim(v_opcion), '') = '' or length(v_opcion) > 80 then
      raise exception 'Hay una opción vacía o demasiado larga.';
    end if;
  end loop;
  if (select count(distinct lower(trim(o))) from unnest(p_opciones) o) <> array_length(p_opciones, 1) then
    raise exception 'Hay dos opciones repetidas.';
  end if;

  select array_agg(o.label order by o.order_pos)
    into v_de_antes
    from public.forum_poll_options o
   where o.thread_id = p_thread;

  -- ¿El cambio toca la estructura? Si las opciones y el modo quedan
  -- exactamente igual, es una corrección de la pregunta: los votos se
  -- conservan, porque siguen significando lo mismo.
  if v_de_antes is distinct from p_opciones or v_multiple_antes is distinct from p_multiple then
    -- Los votos se borran ANTES de tocar `multiple`: la clave ajena de
    -- los votos copia esa columna con ON UPDATE CASCADE, y pasar de
    -- "varias" a "una" con votos múltiples vivos chocaría con el índice
    -- único de un-voto-por-persona.
    select count(*) into v_borrados from public.forum_poll_votes v where v.thread_id = p_thread;
    delete from public.forum_poll_votes where thread_id = p_thread;
    delete from public.forum_poll_options where thread_id = p_thread;

    update public.forum_polls
       set question = trim(p_pregunta), multiple = p_multiple
     where thread_id = p_thread;

    foreach v_opcion in array p_opciones loop
      insert into public.forum_poll_options (thread_id, label, order_pos)
      values (p_thread, trim(v_opcion), v_pos);
      v_pos := v_pos + 1;
    end loop;
  else
    update public.forum_polls
       set question = trim(p_pregunta)
     where thread_id = p_thread;
  end if;

  return v_borrados;
end;
$$;

--
-- Name: forum_marcar_editado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forum_marcar_editado() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.body_html is distinct from old.body_html then
    new.edited_at := now();
  end if;
  return new;
end;
$$;

--
-- Name: forum_poll_resultados(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forum_poll_resultados(p_thread uuid) RETURNS TABLE(option_id uuid, label text, order_pos integer, votos bigint)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select o.id, o.label, o.order_pos, count(v.user_id)
  from public.forum_poll_options o
  left join public.forum_poll_votes v on v.option_id = o.id
  where o.thread_id = p_thread
  group by o.id, o.label, o.order_pos
  order by o.order_pos
$$;

--
-- Name: forum_recontar_tema(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forum_recontar_tema() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_thread uuid := coalesce(new.thread_id, old.thread_id);
begin
  update forum_threads t
     set post_count = (select count(*) from forum_posts p where p.thread_id = v_thread),
         last_post_at = coalesce(
           (select max(p.created_at) from forum_posts p where p.thread_id = v_thread),
           t.created_at
         ),
         -- El autor del más reciente. Si no queda ninguno (se borraron
         -- todos), se cae al autor del tema, que es lo que hay.
         last_post_author_id = coalesce(
           (select p.author_id from forum_posts p
             where p.thread_id = v_thread
             order by p.created_at desc
             limit 1),
           t.author_id
         )
   where t.id = v_thread;
  return null;
end;
$$;

--
-- Name: forum_solo_staff_modera(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forum_solo_staff_modera() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if auth.uid() is not null and not public.is_staff() then
    new.is_pinned := old.is_pinned;
    new.is_locked := old.is_locked;
    new.board_id := old.board_id;
    if coalesce(current_setting('pokedoc.contando_visita', true), '') <> '1' then
      new.view_count := old.view_count;
    end if;
  end if;
  return new;
end;
$$;

--
-- Name: forum_suscribir_al_escribir(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forum_suscribir_al_escribir() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if new.author_id is not null then
    insert into forum_subscriptions (user_id, thread_id)
    values (new.author_id, new.thread_id)
    on conflict do nothing;
  end if;
  return null;
end;
$$;

--
-- Name: forum_valida_resuelto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forum_valida_resuelto() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if new.solved_post_id is not null
     and not exists (
       select 1 from public.forum_posts p
       where p.id = new.solved_post_id and p.thread_id = new.id
     ) then
    raise exception 'La solución tiene que ser un mensaje de este mismo tema.';
  end if;
  return new;
end;
$$;

--
-- Name: forum_ver_tema(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.forum_ver_tema(p_thread uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  perform set_config('pokedoc.contando_visita', '1', true);
  update forum_threads set view_count = coalesce(view_count, 0) + 1 where id = p_thread;
  perform set_config('pokedoc.contando_visita', '', true);
end;
$$;

--
-- Name: freno_de_cuenta_nueva(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.freno_de_cuenta_nueva() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_quien uuid := auth.uid();
begin
  if public.sin_freno() or not public.cuenta_nueva(v_quien) then
    return new;
  end if;
  if tg_table_name = 'forum_threads' then
    if (select count(*) from public.forum_threads t where t.author_id = v_quien and t.created_at > now() - interval '24 hours') >= 3 then
      raise exception 'Las cuentas nuevas pueden abrir 3 temas el primer día. Mañana, todos los que quieras.' using errcode = 'PD403';
    end if;
  elsif tg_table_name = 'forum_posts' then
    if public.enlace_de_fuera(new.body_html) then
      raise exception 'Las cuentas nuevas no pueden poner enlaces a otras webs el primer día.' using errcode = 'PD403';
    end if;
  elsif tg_table_name = 'private_messages' then
    if public.enlace_de_fuera(new.body) then
      raise exception 'Las cuentas nuevas no pueden mandar enlaces a otras webs el primer día.' using errcode = 'PD403';
    end if;
    if not exists (select 1 from public.private_messages m where m.sender_id = v_quien and m.conversation_id = new.conversation_id)
       and (select count(distinct m.conversation_id) from public.private_messages m where m.sender_id = v_quien and m.created_at > now() - interval '24 hours') >= 5 then
      raise exception 'Las cuentas nuevas pueden empezar 5 conversaciones el primer día.' using errcode = 'PD403';
    end if;
  end if;
  return new;
end $$;

--
-- Name: freno_de_ritmo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.freno_de_ritmo() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $_$
declare
  v_col text := tg_argv[0];
  v_min int := tg_argv[1]::int;
  v_hora int := tg_argv[2]::int;
  v_quien uuid;
  v_n_min int;
  v_n_hora int;
begin
  if public.sin_freno() then
    return new;
  end if;
  execute format('select ($1).%I', v_col) into v_quien using new;
  if v_quien is null or v_quien <> auth.uid() then
    return new;
  end if;
  execute format('select count(*) filter (where created_at > now() - interval ''1 minute''), count(*) from %I.%I where %I = $1 and created_at > now() - interval ''1 hour''',
                 tg_table_schema, tg_table_name, v_col)
    into v_n_min, v_n_hora using v_quien;
  if v_n_min >= v_min or v_n_hora >= v_hora then
    raise exception 'Vas muy rápido. Espera un poco y vuelve a probar.' using errcode = 'PD429';
  end if;
  return new;
end $_$;

--
-- Name: freno_de_telemetria(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.freno_de_telemetria() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_tope integer := coalesce(nullif(tg_argv[0], '')::integer, 300);
  v_minuto timestamptz := date_trunc('minute', now());
  v_n integer;
begin
  -- Nadie apunta una visita o un error a nombre de otro (page_vitals no
  -- lleva quién).
  -- (Anidado: plpgsql no promete cortar un `and`, y `new.user_id` en
  -- page_vitals es un error.)
  if tg_table_name in ('page_views', 'client_errors') then
    if new.user_id is not null and new.user_id is distinct from auth.uid() then
      new.user_id := auth.uid();
    end if;
  end if;
  if tg_table_name = 'page_views' then
    new.path := left(new.path, 300);
    new.origen := left(new.origen, 120);
    new.campana := left(new.campana, 120);
    new.aparato := left(new.aparato, 60);
  elsif tg_table_name = 'client_errors' then
    new.message := left(new.message, 600);
    new.stack := left(new.stack, 4000);
    new.page_url := left(new.page_url, 500);
    new.user_agent := left(new.user_agent, 300);
    new.status := 'new';
  end if;
  insert into public.telemetria_ritmo as r (tabla, minuto, n) values (tg_table_name, v_minuto, 1)
  on conflict (tabla, minuto) do update set n = r.n + 1
  returning n into v_n;
  -- De vez en cuando, fuera los minutos viejos (la tabla se queda en nada).
  if random() < 0.01 then
    delete from public.telemetria_ritmo where minuto < now() - interval '2 hours';
  end if;
  if v_n > v_tope then
    return null;
  end if;
  return new;
end $$;

--
-- Name: guarda_oculto_spam(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guarda_oculto_spam() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if new.oculto_spam_at is distinct from old.oculto_spam_at and not public.sin_freno()
     and coalesce(current_setting('pokedoc.esconder_spam', true), '') <> 'si' then
    new.oculto_spam_at := old.oculto_spam_at;
  end if;
  return new;
end $$;

--
-- Name: guardar_lo_que_no_es_del_autor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guardar_lo_que_no_es_del_autor() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.review_status = 'approved'
     and old.review_status is distinct from 'approved'
     and ((new.kind = 'news' and public.soy_redactor_de_noticias()) or public.soy_redactor()) then
    -- La fecha de publicación la pone la base, no el cliente: es la que
    -- ordena /noticias y /aprender y la que dispara el aviso de Telegram.
    new.published_at := coalesce(old.published_at, now());
    new.xp_reward := old.xp_reward;
    new.guide_rarity := old.guide_rarity;
    new.is_pro := old.is_pro;
    return new;
  end if;

  -- Lo que el autor sí puede: mover su guía entre borrador y revisión, en
  -- los dos sentidos. Lo que no: publicarla, rechazarla, o tocar el estado
  -- de una que ya está publicada.
  if new.review_status is distinct from old.review_status
     and not (
       old.review_status in ('draft', 'rejected', 'pending')
       and new.review_status in ('draft', 'pending')
     ) then
    raise exception 'No puedes cambiar el estado de revisión de esta guía'
      using errcode = 'check_violation';
  end if;

  new.published_at := old.published_at;
  new.xp_reward := old.xp_reward;
  new.guide_rarity := old.guide_rarity;
  new.is_pro := old.is_pro;
  return new;
end;
$$;

--
-- Name: guide_author_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guide_author_stats(p_author uuid) RETURNS TABLE(guide_id uuid, slug text, title text, published_at timestamp with time zone, lecturas integer, lectores bigint, guardados bigint, comentarios bigint, agradecimientos bigint, valoraciones bigint, nota numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select
    g.id,
    g.slug,
    g.title,
    g.published_at,
    coalesce(g.view_count, 0),
    (select count(*) from user_progress up where up.guide_id = g.id and up.read_at is not null),
    (select count(*) from user_privado v where g.id = any (v.saved_guides)),
    (select count(*) from guide_comments c where c.guide_id = g.id),
    (select count(*) from guide_helpful h where h.guide_id = g.id),
    (select count(*) from guide_reviews r where r.guide_id = g.id),
    (select round(avg(r.rating)::numeric, 1) from guide_reviews r where r.guide_id = g.id)
  from guides g
  where g.author_id = p_author
    and (auth.uid() = p_author or public.is_admin())
  order by g.published_at desc nulls first, g.created_at desc
$$;

--
-- Name: guides_cuenta_del_tema(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guides_cuenta_del_tema() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Solo cuando cambia lo que cuenta. Va sin `update of …` a propósito: la
  -- fecha la pone un disparador ANTES (al publicar), y `update of` solo mira
  -- las columnas que trae la sentencia — con él, publicar no sumaba.
  if tg_op = 'UPDATE' and new.published_at is not distinct from old.published_at
     and new.category_id is not distinct from old.category_id then
    return null;
  end if;
  -- En un INSERT `old` es NULL y en un DELETE lo es `new` (PostgreSQL 11+),
  -- así que una sola sentencia sirve para los tres casos.
  update public.categories c
     set guide_count = (select count(*) from public.guides g where g.category_id = c.id and g.published_at is not null)
   where c.id = old.category_id or c.id = new.category_id;
  return null;
end $$;

--
-- Name: guides_marca_actualizacion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guides_marca_actualizacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  -- Solo si cambia algo que se lee. Tocar `view_count` en cada visita no
  -- es «actualizar el artículo», y sin esta condición cualquier visita
  -- haría parecer que la noticia se acaba de reescribir.
  if tg_op = 'UPDATE'
     and new.title is not distinct from old.title
     and new.description is not distinct from old.description
     and new.reference_blocks is not distinct from old.reference_blocks
     and new.blocks is not distinct from old.blocks
     and new.cover_image is not distinct from old.cover_image then
    return new;
  end if;
  new.updated_at := now();
  return new;
end $$;

--
-- Name: guides_solo_admin_publica_noticias(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guides_solo_admin_publica_noticias() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_admin boolean;
  v_redactor boolean;
begin
  if tg_op = 'UPDATE' and new.kind is not distinct from old.kind then
    return new;
  end if;
  if auth.uid() is null then
    return new;
  end if;

  select coalesce(p.is_admin, false), coalesce(p.is_news_writer, false) or coalesce(p.is_writer, false)
    into v_admin, v_redactor
  from public.user_profiles p
  where p.id = auth.uid();

  if coalesce(v_admin, false) then
    return new;
  end if;

  -- Una noticia PUBLICADA que pasara a guía sería una guía publicada sin
  -- revisión. Se queda noticia (también para Redacción: lo suyo se corrige,
  -- no se cambia de sección).
  if tg_op = 'UPDATE' and old.kind = 'news' and old.review_status = 'approved' then
    new.kind := old.kind;
    return new;
  end if;

  if new.kind = 'guide' or coalesce(v_redactor, false) then
    return new;
  end if;

  new.kind := case when tg_op = 'UPDATE' then old.kind else 'guide' end;
  return new;
end $$;

--
-- Name: guides_tambien_en(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.guides_tambien_en() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $_$
begin
  if auth.uid() is not null and not public.soy_redactor() then
    if tg_op = 'INSERT' then
      new.tambien_en_url := null;
      new.tambien_en_nombre := null;
    else
      new.tambien_en_url := old.tambien_en_url;
      new.tambien_en_nombre := old.tambien_en_nombre;
    end if;
  end if;
  -- Una dirección que se pinta en un enlace: https y sin nada raro.
  new.tambien_en_url := nullif(btrim(coalesce(new.tambien_en_url, '')), '');
  if new.tambien_en_url is not null and new.tambien_en_url !~ '^https://[^[:space:]"''<>\\`]+$' then
    new.tambien_en_url := null;
  end if;
  new.tambien_en_nombre := nullif(left(btrim(coalesce(new.tambien_en_nombre, '')), 40), '');
  if new.tambien_en_url is null then
    new.tambien_en_nombre := null;
  end if;
  return new;
end $_$;

--
-- Name: historial_foto_diaria(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.historial_foto_diaria(p_dia date DEFAULT CURRENT_DATE) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_filas int;
begin
  insert into public.tcg_card_history (card_id, dia, cm_low, cm_low_es, cm_low_en, cm_low_de, cm_low_fr, cm_low_it, cm_low_ja, tp_market_eur, origen)
  select p.card_id, p_dia, p.cm_low, p.cm_low_es, p.cm_low_en, p.cm_low_de, p.cm_low_fr, p.cm_low_it, p.cm_low_ja, p.tp_market_eur, 'foto'
    from public.tcg_card_prices p
   where exists (select 1 from public.user_collection c where c.card_id = p.card_id)
     and coalesce(p.cm_low, p.cm_low_es, p.cm_low_en, p.cm_low_de, p.cm_low_fr, p.cm_low_it, p.cm_low_ja, p.tp_market_eur) is not null
  on conflict (card_id, dia) do update
    set cm_low = excluded.cm_low, cm_low_es = excluded.cm_low_es, cm_low_en = excluded.cm_low_en,
        cm_low_de = excluded.cm_low_de, cm_low_fr = excluded.cm_low_fr, cm_low_it = excluded.cm_low_it,
        cm_low_ja = excluded.cm_low_ja, tp_market_eur = excluded.tp_market_eur, origen = 'foto';
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

--
-- Name: idiomas_de_set(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.idiomas_de_set(p_set text, p_market text DEFAULT 'WEST'::text) RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(array_agg(distinct x order by x), '{}')
  from (
    select unnest(public.idiomas_de_set_calculados(p_set, p_market)) as x
    union all
    select idioma from public.tcg_set_idiomas_mano where set_id = p_set and market = p_market and hay
  ) t
  where x not in (select idioma from public.tcg_set_idiomas_mano where set_id = p_set and market = p_market and not hay)
$$;

--
-- Name: idiomas_de_set_calculados(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.idiomas_de_set_calculados(p_set text, p_market text DEFAULT 'WEST'::text) RETURNS text[]
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with precios as (
    select
      bool_or(p.cm_low_es > 0) as es, bool_or(p.cm_low_en > 0) as en,
      bool_or(p.cm_low_de > 0) as de, bool_or(p.cm_low_fr > 0) as fr,
      bool_or(p.cm_low_it > 0) as it, bool_or(p.cm_low_ja > 0) as ja,
      bool_or(p.cm_low_ko > 0) as ko, bool_or(p.cm_low_zh > 0) as zh
    from public.tcg_cards c
    join public.tcg_card_prices p on p.card_id = c.id
    where c.set_id = p_set and c.market = p_market
  ),
  ficha as (
    select idiomas from public.tcg_set_idiomas where set_id = p_set and market = p_market
  )
  select coalesce(array_agg(distinct x order by x), '{}')
  from (
    select unnest(array[
      case when es then 'es' end, case when en then 'en' end, case when de then 'de' end,
      case when fr then 'fr' end, case when it then 'it' end, case when ja then 'ja' end,
      case when ko then 'ko' end, case when zh then 'zh' end
    ]) as x
    from precios
    union all
    select unnest(idiomas) from ficha
    union all
    select 'pt' where p_market = 'WEST'
      and not exists (select 1 from ficha)
      and exists (select 1 from precios where es or en or de or fr or it)
  ) t
  where x is not null
$$;

--
-- Name: immutable_unaccent(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.immutable_unaccent(text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    AS $_$ select public.unaccent('public.unaccent', $1) $_$;

--
-- Name: intercambios_avisar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.intercambios_avisar() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_nombre text;
  v_quien text;
begin
  if coalesce(new.cambio, 0) <= 0 or coalesce(old.cambio, 0) > 0 then
    return new;
  end if;

  select coalesce(name_es, name) into v_nombre from public.tcg_cards where id = new.card_id;
  select username into v_quien from public.user_profiles where id = new.user_id;

  insert into public.user_notifications (recipient_id, type, title, body, link)
  select d.user_id,
         case when d.sigue then 'trade_match_seguido' else 'trade_match' end,
         case when d.sigue and v_quien is not null then '@' || v_quien || ', a quien sigues, da una carta que buscas'
              else 'Alguien da una carta que buscas' end,
         d.nombre,
         '/mi-coleccion?ver=cambios'
    from (
      select distinct on (w.user_id)
             w.user_id,
             w.prioridad,
             w.created_at,
             coalesce(v_nombre, new.card_id) as nombre,
             exists (select 1 from public.user_follows f where f.follower_id = w.user_id and f.following_id = new.user_id) as sigue,
             coalesce(u.notification_prefs_disabled, '{}') as apagados
        from public.user_wants w
        join public.user_profiles u on u.id = w.user_id
       where w.card_id = new.card_id
         and w.user_id <> new.user_id
         and (w.idioma is null or w.idioma = new.idioma)
         and (w.variante is null or w.variante = coalesce(new.variante, 'normal'))
         and coalesce(u.is_banned, false) = false
         and not exists (
           select 1 from public.user_notifications n
            where n.recipient_id = w.user_id
              and n.type in ('trade_match', 'trade_match_seguido')
              and n.read_at is null
              and n.body = coalesce(v_nombre, new.card_id)
         )
       order by w.user_id, w.prioridad desc, w.created_at
    ) d
   -- Cada uno con SU preferencia: quien apagó el de los que sigue sigue
   -- recibiendo el general de los demás, y al revés.
   where not (d.apagados @> array[case when d.sigue then 'trade_match_seguido' else 'trade_match' end])
   -- Los que siguen a quien la da, primero; luego los que más la buscan.
   order by d.sigue desc, d.prioridad desc, d.created_at
   limit 25;

  return new;
end;
$$;

--
-- Name: intercambios_de_carta(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.intercambios_de_carta(p_card_id text, p_limite integer DEFAULT 20) RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, is_admin boolean, is_moderator boolean, idioma text, estado text, variante text, gradeo text, cambio integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.user_id, p.username, p.display_name, p.avatar_url,
         coalesce(p.is_admin, false), coalesce(p.is_moderator, false),
         c.idioma, c.estado, c.variante, c.gradeo, public.cambio_libres_de(c.id, c.cambio, c.cantidad)
  from public.user_collection c
  join public.user_profiles p on p.id = c.user_id
  where c.card_id = p_card_id
    and c.cambio > 0
    and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
    and not coalesce(p.is_banned, false)
    and c.user_id is distinct from auth.uid()
  order by c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 20), 100));
$$;

--
-- Name: intercambios_de_persona(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.intercambios_de_persona(p_user uuid, p_limite integer DEFAULT 500) RETURNS TABLE(card_id text, market text, idioma text, estado text, variante text, gradeo text, cambio integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.card_id, c.market, c.idioma, c.estado, c.variante, c.gradeo, public.cambio_libres_de(c.id, c.cambio, c.cantidad)
  from public.user_collection c
  join public.user_profiles p on p.id = c.user_id
  where c.user_id = p_user
    and c.cambio > 0
    and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
    and not coalesce(p.is_banned, false)
  order by c.updated_at desc nulls last, c.card_id
  limit greatest(1, least(coalesce(p_limite, 500), 2000));
$$;

--
-- Name: intercambios_mercado(text, text, text, text[], boolean, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.intercambios_mercado(p_market text DEFAULT 'WEST'::text, p_idioma text DEFAULT NULL::text, p_texto text DEFAULT NULL::text, p_sets text[] DEFAULT NULL::text[], p_solo_mias boolean DEFAULT false, p_orden text DEFAULT 'nuevo'::text, p_limite integer DEFAULT 60, p_desde integer DEFAULT 0) RETURNS TABLE(card_id text, market text, personas integer, copias integer, idiomas text[], dan uuid[], gente jsonb, ultima timestamp with time zone, total bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with dan as (
    select c.card_id, c.market, c.user_id, c.idioma, public.cambio_libres_de(c.id, c.cambio, c.cantidad) as cambio, c.updated_at,
           p.username, p.display_name, p.avatar_url,
           coalesce(p.is_admin, false) as is_admin,
           coalesce(p.is_moderator, false) as is_moderator
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
    where c.cambio > 0
      and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
      and c.market = coalesce(p_market, 'WEST')
      and not coalesce(p.is_banned, false)
      and c.user_id is distinct from auth.uid()
      and (p_idioma is null or c.idioma = p_idioma)
      -- El texto llega ya normalizado (minúsculas, sin acentos), que es
      -- como está `name_search`, columna generada.
      and (coalesce(p_texto, '') = '' or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.name_search like '%' || p_texto || '%'))
      and (p_sets is null or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.set_id = any (p_sets)))
      -- «Solo las que busco»: con la misma regla de idioma que los cruces
      -- (un deseo sin idioma vale cualquiera).
      and (not coalesce(p_solo_mias, false) or exists (
        select 1 from public.user_wants w
        where w.user_id = auth.uid() and w.card_id = c.card_id
          and (w.idioma is null or w.idioma = c.idioma)
          and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))))
  ),
  -- Una persona puede dar la misma carta en dos líneas (en dos idiomas):
  -- en los avatares sale una vez.
  por_persona as (
    select d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url,
           d.is_admin, d.is_moderator, max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url, d.is_admin, d.is_moderator
  ),
  por_carta as (
    select d.card_id, d.market,
           count(distinct d.user_id)::int as personas,
           sum(d.cambio)::int as copias,
           array_agg(distinct d.idioma order by d.idioma) as idiomas,
           max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market
  )
  select pc.card_id, pc.market, pc.personas, pc.copias, pc.idiomas,
         (select array_agg(pp.user_id order by pp.ultima desc)
            from por_persona pp where pp.card_id = pc.card_id and pp.market = pc.market) as dan,
         (select jsonb_agg(jsonb_build_object(
                   'user_id', s.user_id, 'username', s.username, 'display_name', s.display_name,
                   'avatar_url', s.avatar_url, 'is_admin', s.is_admin, 'is_moderator', s.is_moderator)
                 order by s.ultima desc)
            from (select * from por_persona pp
                  where pp.card_id = pc.card_id and pp.market = pc.market
                  order by pp.ultima desc limit 5) s) as gente,
         pc.ultima,
         count(*) over () as total
  from por_carta pc
  left join public.tcg_card_prices pr on pr.card_id = pc.card_id
  order by
    case when p_orden = 'gente' then pc.personas end desc nulls last,
    case when p_orden = 'caro' then coalesce(pr.cm_low, pr.cm_trend) end desc nulls last,
    pc.ultima desc,
    pc.card_id
  limit greatest(1, least(coalesce(p_limite, 60), 200))
  offset greatest(0, coalesce(p_desde, 0));
$$;

--
-- Name: intercambios_quien_busca(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.intercambios_quien_busca(p_limite integer DEFAULT 200) RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, is_admin boolean, is_moderator boolean, card_id text, idioma text, estado text, variante text, gradeo text, cambio integer, prioridad integer, reciproco boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with yo as (select auth.uid() as id),
  -- Lo que yo busco, para saber si la otra persona da algo que quiero.
  busco as (select w.card_id, w.idioma, w.variante from public.user_wants w, yo where w.user_id = yo.id)
  select
    w.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    coalesce(p.is_admin, false),
    coalesce(p.is_moderator, false),
    c.card_id,
    c.idioma,
    c.estado,
    c.variante,
    c.gradeo,
    c.cambio,
    w.prioridad,
    exists (
      select 1
      from public.user_collection c2
      join busco b on b.card_id = c2.card_id and (b.idioma is null or b.idioma = c2.idioma)
                  and (b.variante is null or b.variante = coalesce(c2.variante, 'normal'))
      where c2.user_id = w.user_id and c2.cambio > 0
    ) as reciproco
  from public.user_collection c
  join yo on c.user_id = yo.id
  join public.user_wants w
    on w.card_id = c.card_id
   and w.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
   and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))
  join public.user_profiles p on p.id = w.user_id
  where c.cambio > 0 and not coalesce(p.is_banned, false)
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;

--
-- Name: intercambios_quien_tiene(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.intercambios_quien_tiene(p_limite integer DEFAULT 200) RETURNS TABLE(user_id uuid, username text, display_name text, avatar_url text, is_admin boolean, is_moderator boolean, card_id text, idioma text, estado text, variante text, gradeo text, cambio integer, prioridad integer, reciproco boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with yo as (select auth.uid() as id),
  -- Lo que yo doy, para saber si la otra persona busca algo mío.
  mias as (
    select c.card_id, c.idioma, c.variante
    from public.user_collection c, yo
    where c.user_id = yo.id and c.cambio > 0
  )
  select
    c.user_id,
    p.username,
    p.display_name,
    p.avatar_url,
    coalesce(p.is_admin, false),
    coalesce(p.is_moderator, false),
    c.card_id,
    c.idioma,
    c.estado,
    c.variante,
    c.gradeo,
    public.cambio_libres_de(c.id, c.cambio, c.cantidad),
    w.prioridad,
    exists (
      select 1
      from public.user_wants w2
      join mias m on m.card_id = w2.card_id and (w2.idioma is null or w2.idioma = m.idioma)
                 and (w2.variante is null or w2.variante = coalesce(m.variante, 'normal'))
      where w2.user_id = c.user_id
    ) as reciproco
  from public.user_wants w
  join yo on w.user_id = yo.id
  join public.user_collection c
    on c.card_id = w.card_id
   and c.cambio > 0
   and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
   and c.user_id <> yo.id
   and (w.idioma is null or w.idioma = c.idioma)
   and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))
  join public.user_profiles p on p.id = c.user_id
  where not coalesce(p.is_banned, false)
  -- Lo recíproco primero: es lo único que se cierra de un mensaje.
  order by reciproco desc, w.prioridad desc, c.cambio desc, p.username
  limit greatest(1, least(coalesce(p_limite, 200), 500));
$$;

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select coalesce(public.is_admin_base(), false) and public.sesion_cumple_mfa()
$$;

--
-- Name: is_admin_base(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin_base() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ select coalesce((select is_admin from public.user_profiles where id = auth.uid()), false) $$;

--
-- Name: is_banned(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_banned() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select is_banned from user_profiles where id = auth.uid()), false);
$$;

--
-- Name: is_conversation_participant(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_conversation_participant(conv_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv_id and user_id = auth.uid()
  );
$$;

--
-- Name: is_muted(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_muted() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select is_muted from user_profiles where id = auth.uid()), false);
$$;

--
-- Name: is_staff(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_staff() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select coalesce(
    (select is_admin or is_moderator from public.user_profiles where id = auth.uid()),
    false
  );
$$;

--
-- Name: latido_en_linea(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.latido_en_linea(p_token text, p_thread uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $_$
declare
  v_quien uuid := auth.uid();
  v_oculto boolean := false;
begin
  if p_token is null or p_token !~ '^[0-9a-f-]{36}$' then
    return;
  end if;

  if v_quien is not null then
    select coalesce(hide_activity, false) into v_oculto from public.user_profiles where id = v_quien;
    if coalesce(v_oculto, false) then
      v_quien := null;
      p_thread := null;
    end if;
  end if;

  if p_thread is not null and not exists (select 1 from public.forum_threads t where t.id = p_thread) then
    p_thread := null;
  end if;

  insert into public.online_now as o (token, user_id, thread_id, last_seen)
  values (p_token, v_quien, p_thread, now())
  on conflict (token) do update
    set last_seen = now(),
        thread_id = excluded.thread_id,
        -- Al esconderte se borra también lo de antes de esta pestaña.
        user_id = case when v_oculto then null else coalesce(v_quien, o.user_id) end;

  delete from public.online_now where last_seen < now() - interval '1 day';
end;
$_$;

--
-- Name: liga_listas_jornada(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.liga_listas_jornada(p_torneo uuid, p_jornada integer) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select count(*)::int
  from tournament_matchday_decklists d
  join tournament_registrations r
    on r.tournament_id = d.tournament_id and r.user_id = d.user_id and r.status = 'active'
  where d.tournament_id = p_torneo and d.matchday = p_jornada
$$;

--
-- Name: logros_reparto(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.logros_reparto() RETURNS TABLE(id text, personas bigint, total bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select d.id::text,
         (select count(*) from public.user_profiles p where p.achievements @> array[d.id::text]) as personas,
         (select count(*) from public.user_profiles) as total
  from public.achievement_definitions d
  where d.is_active
$$;

--
-- Name: match_log_mazo_propio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_log_mazo_propio() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  if new.user_deck_id is not null and not exists (
    select 1 from public.user_decks d where d.id = new.user_deck_id and d.user_id = new.user_id
  ) then
    raise exception 'Ese mazo no es tuyo.' using errcode = '42501';
  end if;
  return new;
end;
$$;

--
-- Name: match_log_torneo_arrastra(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_log_torneo_arrastra() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  -- `is distinct from` y no `<>`: estas columnas admiten NULL (251).
  if new.mi_mazo is distinct from old.mi_mazo
     or new.mi_mazo_nombre is distinct from old.mi_mazo_nombre
     or new.user_deck_id is distinct from old.user_deck_id
     or new.nombre is distinct from old.nombre
     or new.jugado_el is distinct from old.jugado_el then
    update match_log
       set mi_mazo = new.mi_mazo,
           mi_mazo_nombre = new.mi_mazo_nombre,
           user_deck_id = new.user_deck_id,
           donde = new.nombre,
           jugada_el = new.jugado_el
     where torneo_id = new.id;
  end if;
  return new;
end $$;

--
-- Name: menciones_de(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.menciones_de(p_texto text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(array_agg(nombre), '{}')
  from (
    select distinct lower(m[1]) as nombre
    from regexp_matches(
      coalesce(p_texto, ''),
      '(?:^|[^a-zA-Z0-9@._-])@([a-zA-Z0-9][a-zA-Z0-9_-]{1,29})',
      'g'
    ) as m
    limit 5
  ) n
$$;

--
-- Name: mensaje_reaccionable(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mensaje_reaccionable(p_mensaje uuid, p_conversacion uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.private_messages m
    where m.id = p_mensaje
      and m.conversation_id = p_conversacion
      and m.sender_id <> auth.uid()
      and m.deleted_at is null
  ) and public.is_conversation_participant(p_conversacion);
$$;

--
-- Name: mensaje_respuesta_misma_conversacion(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mensaje_respuesta_misma_conversacion() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from public.private_messages p
    where p.id = new.reply_to_id and p.conversation_id = new.conversation_id
  ) then
    raise exception 'Solo se puede responder a un mensaje de la misma conversación' using errcode = '23514';
  end if;
  return new;
end
$$;

--
-- Name: mensajes_adjunto_es_mio(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mensajes_adjunto_es_mio(nombre text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  select (storage.foldername(nombre))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     and public.is_conversation_participant(((storage.foldername(nombre))[1])::uuid);
$_$;

--
-- Name: mercado_con_tiendas(text, text, text, text[], boolean, text, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mercado_con_tiendas(p_market text DEFAULT 'WEST'::text, p_idioma text DEFAULT NULL::text, p_texto text DEFAULT NULL::text, p_sets text[] DEFAULT NULL::text[], p_solo_mias boolean DEFAULT false, p_orden text DEFAULT 'nuevo'::text, p_limite integer DEFAULT 60, p_desde integer DEFAULT 0, p_quien text DEFAULT 'todos'::text) RETURNS TABLE(card_id text, market text, personas integer, tiendas integer, copias integer, idiomas text[], dan uuid[], gente jsonb, desde numeric, ultima timestamp with time zone, total bigint)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with dan as (
    select c.card_id, c.market, c.user_id, c.idioma, public.cambio_libres_de(c.id, c.cambio, c.cantidad) as copias, c.updated_at,
           p.username, p.display_name, p.avatar_url,
           coalesce(p.is_admin, false) as is_admin,
           coalesce(p.is_moderator, false) as is_moderator,
           false as es_tienda, null::numeric as precio, null::text as ciudad
    from public.user_collection c
    join public.user_profiles p on p.id = c.user_id
    where coalesce(p_quien, 'todos') <> 'tiendas'
      and c.cambio > 0
      and public.cambio_libres_de(c.id, c.cambio, c.cantidad) > 0
      and coalesce(p.tipo, 'persona') <> 'tienda'
      and c.market = coalesce(p_market, 'WEST')
      and not coalesce(p.is_banned, false)
      and c.user_id is distinct from auth.uid()
      and (p_idioma is null or c.idioma = p_idioma)
      and (coalesce(p_texto, '') = '' or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.name_search like '%' || p_texto || '%'))
      and (p_sets is null or exists (
        select 1 from public.tcg_cards t
        where t.id = c.card_id and t.market = c.market and t.set_id = any (p_sets)))
      and (not coalesce(p_solo_mias, false) or exists (
        select 1 from public.user_wants w
        where w.user_id = auth.uid() and w.card_id = c.card_id
          and (w.idioma is null or w.idioma = c.idioma)
          and (w.variante is null or w.variante = coalesce(c.variante, 'normal'))))
    union all
    select s.card_id, s.market, s.tienda_id, s.idioma, s.unidades, s.updated_at,
           p.username, p.display_name, p.avatar_url, false, false,
           true, case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end, t.ciudad
    from public.tienda_stock s
    join public.user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda'
    left join public.tiendas t on t.user_id = s.tienda_id
    where coalesce(p_quien, 'todos') <> 'personas'
      and s.card_id is not null and s.visible and public.tienda_publica(s.tienda_id) and s.unidades > 0
      and s.market = coalesce(p_market, 'WEST')
      and not coalesce(p.is_banned, false)
      and s.tienda_id is distinct from auth.uid()
      and (p_idioma is null or s.idioma = p_idioma)
      and (coalesce(p_texto, '') = '' or exists (
        select 1 from public.tcg_cards tc
        where tc.id = s.card_id and tc.market = s.market and tc.name_search like '%' || p_texto || '%'))
      and (p_sets is null or exists (
        select 1 from public.tcg_cards tc
        where tc.id = s.card_id and tc.market = s.market and tc.set_id = any (p_sets)))
      and (not coalesce(p_solo_mias, false) or exists (
        select 1 from public.user_wants w
        where w.user_id = auth.uid() and w.card_id = s.card_id
          and (w.idioma is null or w.idioma = s.idioma)
          and (w.variante is null or w.variante = s.variante)))
  ),
  por_quien as (
    select d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url,
           d.is_admin, d.is_moderator, d.es_tienda, min(d.precio) as precio, d.ciudad, max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market, d.user_id, d.username, d.display_name, d.avatar_url, d.is_admin, d.is_moderator, d.es_tienda, d.ciudad
  ),
  por_carta as (
    select d.card_id, d.market,
           count(distinct d.user_id) filter (where not d.es_tienda)::int as personas,
           count(distinct d.user_id) filter (where d.es_tienda)::int as tiendas,
           sum(d.copias)::int as copias,
           array_agg(distinct d.idioma order by d.idioma) as idiomas,
           min(d.precio) as desde,
           max(d.updated_at) as ultima
    from dan d
    group by d.card_id, d.market
  )
  select pc.card_id, pc.market, pc.personas, pc.tiendas, pc.copias, pc.idiomas,
         (select array_agg(pq.user_id order by pq.ultima desc)
            from por_quien pq where pq.card_id = pc.card_id and pq.market = pc.market and not pq.es_tienda) as dan,
         (select jsonb_agg(jsonb_build_object(
                   'user_id', s.user_id, 'username', s.username, 'display_name', s.display_name,
                   'avatar_url', s.avatar_url, 'is_admin', s.is_admin, 'is_moderator', s.is_moderator,
                   'tienda', s.es_tienda, 'precio', s.precio, 'ciudad', s.ciudad)
                 order by s.es_tienda, s.ultima desc)
            from (select * from por_quien pq
                  where pq.card_id = pc.card_id and pq.market = pc.market
                  order by pq.es_tienda, pq.ultima desc limit 6) s) as gente,
         pc.desde,
         pc.ultima,
         count(*) over () as total
  from por_carta pc
  left join public.tcg_card_prices pr on pr.card_id = pc.card_id
  order by
    case when p_orden = 'gente' then pc.personas + pc.tiendas end desc nulls last,
    case when p_orden = 'caro' then coalesce(pr.cm_low, pr.cm_trend) end desc nulls last,
    pc.ultima desc,
    pc.card_id
  limit greatest(1, least(coalesce(p_limite, 60), 200))
  offset greatest(0, coalesce(p_desde, 0));
$$;

--
-- Name: meta_dias(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meta_dias(p_dias integer) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$ select greatest(1, least(coalesce(p_dias, 14), 365)) $$;

--
-- Name: meta_firmas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meta_firmas() RETURNS TABLE(arquetipo text, nombre text, firma text[])
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with listas as (
    select r.arquetipo, count(*) as n
    from public.meta_resultados r
    join public.meta_torneos t on t.id = r.torneo_id
    where r.con_lista and t.fuente <> 'pokedoc' and t.fecha > now() - interval '60 days'
    group by r.arquetipo
    having count(*) >= 10
  ),
  cartas as (
    select c.arquetipo, c.set_codigo || ' ' || c.numero as impresion, sum(c.mazos) as mazos
    from public.meta_cartas_dia c
    where c.seccion = 'pokemon' and c.dia > (now() - interval '60 days')::date
    group by c.arquetipo, c.set_codigo, c.numero
  )
  select l.arquetipo, a.nombre, array_agg(c.impresion order by c.mazos desc)
  from listas l
  join cartas c on c.arquetipo = l.arquetipo and c.mazos >= 0.8 * l.n
  join public.meta_arquetipos a on a.id = l.arquetipo
  where l.arquetipo <> 'other'
  group by l.arquetipo, a.nombre;
$$;

--
-- Name: meta_ingerir_torneo(jsonb, jsonb, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meta_ingerir_torneo(p_torneo jsonb, p_clasificacion jsonb, p_top integer DEFAULT 8) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_id text := p_torneo->>'id';
  v_fecha timestamptz := (p_torneo->>'date')::timestamptz;
  v_dia date := ((p_torneo->>'date')::timestamptz at time zone 'UTC')::date;
  v_fuente text := coalesce(nullif(p_torneo->>'fuente', ''), 'online');
  v_contar boolean := coalesce((p_torneo->>'contar_cartas')::boolean, true);
  v_clasificados int := 0;
  v_con_lista int := 0;
begin
  if v_id is null or v_fecha is null then
    raise exception 'meta_ingerir_torneo: falta el id o la fecha del torneo';
  end if;
  if jsonb_typeof(p_clasificacion) is distinct from 'array' then
    raise exception 'meta_ingerir_torneo: la clasificación no es una lista';
  end if;

  perform 1 from public.meta_torneos where id = v_id for update;
  if found then
    return jsonb_build_object('torneo', v_id, 'ya_leido', true);
  end if;

  create temporary table if not exists _meta_filas (
    jugador text, nombre text, pais text, puesto int, v int, d int, e int,
    abandono int, arquetipo text, arquetipo_nombre text, iconos text[], lista jsonb, enlace text
  ) on commit drop;
  -- Si la tabla venía de la versión de la 364 (sin `enlace`), se rehace.
  if not exists (select 1 from pg_attribute where attrelid = '_meta_filas'::regclass and attname = 'enlace') then
    drop table _meta_filas;
    create temporary table _meta_filas (
      jugador text, nombre text, pais text, puesto int, v int, d int, e int,
      abandono int, arquetipo text, arquetipo_nombre text, iconos text[], lista jsonb, enlace text
    ) on commit drop;
  end if;
  truncate _meta_filas;

  insert into _meta_filas
  select distinct on (x->>'player')
    x->>'player', x->>'name', x->>'country',
    nullif(x->>'placing', '')::int,
    coalesce((x->'record'->>'wins')::int, 0),
    coalesce((x->'record'->>'losses')::int, 0),
    coalesce((x->'record'->>'ties')::int, 0),
    nullif(x->>'drop', '')::int,
    x->'deck'->>'id',
    coalesce(x->'deck'->>'name', x->'deck'->>'id'),
    case when jsonb_typeof(x->'deck'->'icons') = 'array'
      then array(select jsonb_array_elements_text(x->'deck'->'icons')) else '{}' end,
    case when jsonb_typeof(x->'decklist') = 'object' then x->'decklist' end,
    nullif(x->>'enlace', '')
  from jsonb_array_elements(p_clasificacion) x
  where coalesce(x->'deck'->>'id', '') <> '' and coalesce(x->>'player', '') <> '';

  select count(*), count(lista) into v_clasificados, v_con_lista from _meta_filas;

  insert into public.meta_torneos (id, nombre, fecha, jugadores, organizador, clasificados, con_lista, fuente, tipo, enlace)
  values (
    v_id, left(coalesce(p_torneo->>'name', v_id), 200), v_fecha,
    coalesce((p_torneo->>'players')::int, jsonb_array_length(p_clasificacion)),
    nullif(p_torneo->>'organizerId', '')::int,
    v_clasificados, v_con_lista, v_fuente,
    left(nullif(p_torneo->>'tipo', ''), 40), left(nullif(p_torneo->>'enlace', ''), 300)
  );

  if v_clasificados = 0 then
    return jsonb_build_object('torneo', v_id, 'clasificados', 0, 'con_lista', 0);
  end if;

  -- Un arquetipo que ya existe NO se renombra desde PokeDoc: su nombre e
  -- iconos buenos son los de Limitless.
  insert into public.meta_arquetipos as a (id, nombre, iconos, visto_at)
  select distinct on (arquetipo) arquetipo, arquetipo_nombre, iconos, v_fecha
  from _meta_filas
  order by arquetipo
  on conflict (id) do update
    set nombre = case when v_fuente <> 'pokedoc' and excluded.visto_at >= a.visto_at then excluded.nombre else a.nombre end,
        iconos = case when v_fuente <> 'pokedoc' and excluded.visto_at >= a.visto_at and cardinality(excluded.iconos) > 0 then excluded.iconos else a.iconos end,
        visto_at = greatest(a.visto_at, excluded.visto_at);

  insert into public.meta_resultados
    (torneo_id, jugador, arquetipo, puesto, victorias, derrotas, empates, abandono, con_lista, nombre_jugador, pais, lista, enlace)
  select
    v_id, jugador, arquetipo, puesto, v, d, e, abandono, lista is not null,
    case when lista is not null and puesto between 1 and p_top then left(nombre, 80) end,
    case when lista is not null and puesto between 1 and p_top then left(pais, 2) end,
    case when puesto between 1 and p_top then lista end,
    case when puesto between 1 and p_top then left(enlace, 300) end
  from _meta_filas;

  if v_contar then
    with lineas as (
      select f.jugador, f.arquetipo, s.seccion,
        trim(l->>'name') as nombre,
        upper(coalesce(l->>'set', '')) as set_codigo,
        coalesce(l->>'number', '') as numero,
        coalesce((l->>'count')::int, 0) as copias
      from _meta_filas f
      cross join (values ('pokemon'), ('trainer'), ('energy')) as s (seccion)
      cross join lateral jsonb_array_elements(
        case when jsonb_typeof(f.lista->s.seccion) = 'array' then f.lista->s.seccion else '[]'::jsonb end
      ) l
      where f.lista is not null
    ),
    claves as (
      select *,
        case when seccion = 'pokemon' then lower(nombre) || '|' || set_codigo || '|' || numero else lower(nombre) end as clave
      from lineas
      where copias > 0 and coalesce(nombre, '') <> ''
    ),
    por_mazo as (
      select jugador, arquetipo, seccion, clave, min(nombre) as nombre,
        (array_agg(set_codigo || ' ' || numero order by copias desc))[1] as impresion,
        sum(copias) as copias
      from claves
      group by jugador, arquetipo, seccion, clave
    ),
    por_arquetipo as (
      select arquetipo, seccion, clave, min(nombre) as nombre,
        mode() within group (order by impresion) as impresion,
        count(*)::int as mazos, sum(copias)::int as copias
      from por_mazo
      group by arquetipo, seccion, clave
    )
    insert into public.meta_cartas_dia as c (dia, arquetipo, seccion, clave, nombre, set_codigo, numero, mazos, copias)
    select v_dia, arquetipo, seccion, clave, nombre,
      split_part(impresion, ' ', 1), split_part(impresion, ' ', 2), mazos, copias
    from por_arquetipo
    on conflict (dia, arquetipo, clave) do update
      set mazos = c.mazos + excluded.mazos,
          copias = c.copias + excluded.copias;
  end if;

  delete from public.meta_torneos where fuente = 'online' and fecha < now() - interval '65 days';
  delete from public.meta_torneos where fuente <> 'online' and fecha < now() - interval '400 days';
  delete from public.meta_cartas_dia where dia < (now() - interval '400 days')::date;

  return jsonb_build_object('torneo', v_id, 'clasificados', v_clasificados, 'con_lista', v_con_lista, 'fuente', v_fuente);
end;
$$;

--
-- Name: meta_lista_media(text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meta_lista_media(p_arquetipo text, p_dias integer DEFAULT 14, p_fuente text DEFAULT NULL::text) RETURNS TABLE(seccion text, nombre text, set_codigo text, numero text, mazos integer, listas integer, porcentaje numeric, media numeric)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with dias as (select public.meta_dias(p_dias) as n),
  total as (
    select count(*)::int as n
    from public.meta_resultados r
    join public.meta_torneos t on t.id = r.torneo_id
    where r.arquetipo = p_arquetipo and r.con_lista
      and t.fuente <> 'pokedoc'
      and (p_fuente is null or t.fuente = p_fuente)
      and (t.fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - (select n from dias)
  ),
  cartas as (
    select c.seccion, c.clave, min(c.nombre) as nombre,
      (array_agg(c.set_codigo order by c.mazos desc))[1] as set_codigo,
      (array_agg(c.numero order by c.mazos desc))[1] as numero,
      sum(c.mazos)::int as mazos, sum(c.copias)::int as copias
    from public.meta_cartas_dia c
    where c.arquetipo = p_arquetipo
      and c.dia > (now() at time zone 'UTC')::date - (select n from dias)
      -- Filtrando por fuente, solo los días en que esa fuente tuvo torneo.
      and (p_fuente is null or exists (
        select 1 from public.meta_torneos t
        where t.fuente = p_fuente and (t.fecha at time zone 'UTC')::date = c.dia))
    group by c.seccion, c.clave
  )
  select seccion, nombre, set_codigo, numero, least(mazos, (select n from total)), (select n from total),
    round(100 * least(mazos, (select n from total))::numeric / nullif((select n from total), 0), 1),
    round(copias::numeric / nullif(mazos, 0), 2)
  from cartas
  where (select n from total) > 0
  order by case seccion when 'pokemon' then 1 when 'trainer' then 2 else 3 end, mazos desc, copias desc, nombre;
$$;

--
-- Name: meta_listas(text, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meta_listas(p_arquetipo text, p_dias integer DEFAULT 14, p_limite integer DEFAULT 12, p_fuente text DEFAULT NULL::text) RETURNS TABLE(torneo_id text, torneo text, fecha timestamp with time zone, jugadores integer, fuente text, tipo text, jugador text, nombre_jugador text, pais text, puesto integer, victorias integer, derrotas integer, empates integer, lista jsonb, enlace text, torneo_enlace text)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select t.id, t.nombre, t.fecha, t.jugadores, t.fuente, t.tipo,
    r.jugador, r.nombre_jugador, r.pais,
    r.puesto, r.victorias, r.derrotas, r.empates, r.lista, r.enlace, t.enlace
  from public.meta_resultados r
  join public.meta_torneos t on t.id = r.torneo_id
  where r.arquetipo = p_arquetipo and r.lista is not null
    and (p_fuente is null or t.fuente = p_fuente)
    and (t.fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - public.meta_dias(p_dias)
  order by (t.fuente = 'oficial') desc, r.puesto asc nulls last, t.jugadores desc, t.fecha desc
  limit greatest(1, least(coalesce(p_limite, 12), 40));
$$;

--
-- Name: meta_resumen(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meta_resumen(p_dias integer DEFAULT 14, p_fuente text DEFAULT NULL::text) RETURNS TABLE(arquetipo text, nombre text, iconos text[], mazos integer, cuota numeric, cuota_anterior numeric, victorias integer, derrotas integer, empates integer, porcentaje_victorias numeric, top8 integer, torneos integer, listas integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  with dias as (select public.meta_dias(p_dias) as n),
  base as (
    select r.*, (t.fecha at time zone 'UTC')::date as dia
    from public.meta_resultados r
    join public.meta_torneos t on t.id = r.torneo_id
    where (t.fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - 2 * (select n from dias)
      and (p_fuente is null or t.fuente = p_fuente)
  ),
  ahora as (select * from base where dia > (now() at time zone 'UTC')::date - (select n from dias)),
  -- El periodo anterior solo se compara si hay datos de él: lo online se
  -- borra a los 65 días, así que con más de 30 días de ventana lo de
  -- «antes» estaría a medias y la flecha mentiría.
  antes as (
    select * from base
    where dia <= (now() at time zone 'UTC')::date - (select n from dias)
      and ((select n from dias) <= 30 or p_fuente in ('oficial', 'pokedoc'))
  ),
  total_ahora as (select count(*)::numeric as n from ahora),
  total_antes as (select count(*)::numeric as n from antes),
  cuotas_antes as (select arquetipo, count(*)::numeric as n from antes group by arquetipo)
  select
    x.arquetipo, coalesce(a.nombre, x.arquetipo), coalesce(a.iconos, '{}'),
    count(*)::int,
    round(100 * count(*) / nullif((select n from total_ahora), 0), 2),
    round(100 * max(ca.n) / nullif((select n from total_antes), 0), 2),
    sum(x.victorias)::int, sum(x.derrotas)::int, sum(x.empates)::int,
    round(100 * sum(x.victorias)::numeric / nullif(sum(x.victorias + x.derrotas + x.empates), 0), 1),
    (count(*) filter (where x.puesto between 1 and 8))::int,
    count(distinct x.torneo_id)::int,
    (count(*) filter (where x.con_lista))::int
  from ahora x
  left join public.meta_arquetipos a on a.id = x.arquetipo
  left join cuotas_antes ca on ca.arquetipo = x.arquetipo
  group by x.arquetipo, a.nombre, a.iconos
  order by count(*) desc, x.arquetipo;
$$;

--
-- Name: meta_totales(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.meta_totales(p_dias integer DEFAULT 14, p_fuente text DEFAULT NULL::text) RETURNS TABLE(torneos integer, jugadores integer, desde date, ultima_lectura timestamp with time zone, oficiales integer, pokedoc integer, online integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select count(*)::int, coalesce(sum(clasificados), 0)::int, min((fecha at time zone 'UTC')::date),
    (select max(leido_at) from public.meta_torneos),
    (count(*) filter (where fuente = 'oficial'))::int,
    (count(*) filter (where fuente = 'pokedoc'))::int,
    (count(*) filter (where fuente = 'online'))::int
  from public.meta_torneos
  where (fecha at time zone 'UTC')::date > (now() at time zone 'UTC')::date - public.meta_dias(p_dias)
    and (p_fuente is null or fuente = p_fuente);
$$;

--
-- Name: mis_invitados(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mis_invitados() RETURNS TABLE(id uuid, username text, display_name text, avatar_url text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select p.id, p.username, p.display_name, p.avatar_url, p.created_at
  from public.user_privado v
  join public.user_profiles p on p.id = v.user_id
  where v.referred_by = auth.uid() and auth.uid() is not null
  order by p.created_at desc
$$;

--
-- Name: mis_sesiones(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mis_sesiones() RETURNS TABLE(id uuid, creada timestamp with time zone, ultima timestamp with time zone, navegador text, esta boolean, con_codigo boolean)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select s.id,
         s.created_at,
         coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at),
         s.user_agent,
         s.id::text = coalesce(auth.jwt() ->> 'session_id', ''),
         coalesce(s.aal::text, 'aal1') = 'aal2'
  from auth.sessions s
  where s.user_id = auth.uid() and auth.uid() is not null
    and (s.not_after is null or s.not_after > now())
  order by coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) desc
$$;

--
-- Name: moderacion_al_dia(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.moderacion_al_dia() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_silencios uuid[];
  v_baneos uuid[];
  v_n int;
begin
  -- En dos pasos a propósito: las sentencias de un mismo `with` ven la
  -- base de ANTES, y el «¿le queda otra abierta?» vería abierta la que se
  -- acaba de cerrar (y no levantaría nada).
  with vencidas as (
    update moderaciones set quitada_at = now()
     where quitada_at is null and hasta is not null and hasta <= now()
    returning user_id, que
  )
  select array_agg(distinct user_id) filter (where que = 'silencio'),
         array_agg(distinct user_id) filter (where que = 'baneo'),
         count(*)
    into v_silencios, v_baneos, v_n
    from vencidas;
  if v_n = 0 then
    return 0;
  end if;
  update user_profiles p set is_muted = false
   where p.id = any (coalesce(v_silencios, '{}')) and p.is_muted
     and not exists (select 1 from moderaciones m where m.user_id = p.id and m.que = 'silencio' and m.quitada_at is null);
  update user_profiles p set is_banned = false
   where p.id = any (coalesce(v_baneos, '{}')) and p.is_banned
     and not exists (select 1 from moderaciones m where m.user_id = p.id and m.que = 'baneo' and m.quitada_at is null);
  return v_n;
end;
$$;

--
-- Name: nivel_de_xp(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.nivel_de_xp(p_xp integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when coalesce(p_xp, 0) >= 25000 then 'Maestro'
    when coalesce(p_xp, 0) >= 16000 then 'Campeón'
    when coalesce(p_xp, 0) >= 10000 then 'Alto Mando'
    when coalesce(p_xp, 0) >= 6000  then 'As'
    when coalesce(p_xp, 0) >= 3500  then 'Experto'
    when coalesce(p_xp, 0) >= 1800  then 'Veterano'
    when coalesce(p_xp, 0) >= 900   then 'Rival'
    when coalesce(p_xp, 0) >= 400   then 'Entrenador'
    when coalesce(p_xp, 0) >= 150   then 'Aprendiz'
    else 'Novato'
  end;
$$;

--
-- Name: on_collab_application(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_collab_application() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_quien text;
  v_admin record;
begin
  select coalesce(email_preview(display_name, 60), email_preview(username, 60), 'Alguien')
    into v_quien
    from user_profiles where id = new.user_id;
  v_quien := coalesce(v_quien, 'Alguien');

  for v_admin in select id from user_profiles where is_admin = true loop
    continue when v_admin.id = new.user_id;

    insert into user_notifications (recipient_id, type, title, body, link)
    values (
      v_admin.id,
      'collab_application',
      'Alguien quiere colaborar',
      v_quien || ' se ha ofrecido para echar una mano',
      '/admin/'
    );

    perform enqueue_email(
      v_admin.id,
      'collab_application',
      'Alguien quiere colaborar en PokeDoc',
      v_quien || ' se ha ofrecido para echar una mano. Su solicitud está en /admin.',
      '/admin/',
      -- Por PERSONA: si alguien manda dos en una tarde, un aviso.
      'colabora:' || new.user_id::text
    );
  end loop;

  return new;
end $$;

--
-- Name: on_comment_reply_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_comment_reply_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_destinatario uuid;
  v_nombre text;
  v_titulo text;
  v_slug text;
begin
  if new.reply_to_id is null then
    return new;
  end if;

  select author_id into v_destinatario
  from guide_comments where id = new.reply_to_id;

  -- Nadie se avisa a sí mismo por responderse.
  if v_destinatario is null or v_destinatario = new.author_id then
    return new;
  end if;

  -- email_preview colapsa cualquier espacio en blanco, saltos de línea
  -- incluidos. Va aquí porque este nombre acaba en la CABECERA Subject
  -- del correo, y un nombre con un \n permitiría inyectar cabeceras.
  select email_preview(coalesce(display_name, username, 'Alguien'), 60) into v_nombre
  from user_profiles where id = new.author_id;

  select g.title, g.slug into v_titulo, v_slug
  from guides g where g.id = new.guide_id;

  perform enqueue_email(
    v_destinatario,
    'comment_reply',
    coalesce(v_nombre, 'Alguien') || ' ha respondido a tu comentario',
    email_preview(new.body),
    '/guia.html?slug=' || coalesce(v_slug, ''),
    'reply:' || new.reply_to_id::text
  );

  return new;
end $$;

--
-- Name: on_forum_post_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_forum_post_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_texto text;
  v_nombre text;
  v_titulo text;
  v_enlace text;
  v_vista text;
  v_mencionados uuid[];
  v_citado uuid;
  v_id uuid;
begin
  -- El cuerpo se guarda como HTML. Las etiquetas fuera antes de nada:
  -- si no, un @nombre metido en un href contaría como mención y la
  -- vista previa del correo saldría llena de <p> y <strong>.
  --
  -- Dos pasadas, y la diferencia importa:
  --
  --   · Las etiquetas de BLOQUE dejan un espacio. Sin él,
  --     "<p>hola</p><p>@ash</p>" es "hola@ash", que por la regla de las
  --     direcciones de correo deja de ser una mención.
  --   · Las de dentro de una frase (b, i, a, code…) no dejan nada. Con
  --     un espacio, "<b>@ash</b>," se leería "@ash ," y así saldría en
  --     la vista previa del correo.
  --
  -- Es la misma división que BLOQUES en js/menciones.js. Si divergen,
  -- alguien recibe el correo pero no ve el enlace en el mensaje.
  v_texto := regexp_replace(coalesce(new.body_html, ''),
    '</?(p|div|br|li|ul|ol|h[1-6]|blockquote|tr|td|pre|hr)( [^>]*)?/?>', ' ', 'gi');
  v_texto := regexp_replace(v_texto, '<[^>]*>', '', 'g');
  v_vista := email_preview(v_texto);

  -- email_preview colapsa cualquier espacio en blanco, saltos de línea
  -- incluidos. Va aquí porque el nombre y el título acaban en la
  -- CABECERA Subject del correo, y un \n ahí permitiría inyectar
  -- cabeceras.
  select email_preview(coalesce(display_name, username, 'Alguien'), 60) into v_nombre
  from user_profiles where id = new.author_id;
  v_nombre := coalesce(v_nombre, 'Alguien');

  select email_preview(t.title, 80) into v_titulo
  from forum_threads t where t.id = new.thread_id;
  v_titulo := coalesce(v_titulo, 'un tema del foro');

  v_enlace := '/tema/' || new.thread_id::text;

  -- ── Los mencionados ──
  --
  -- `lower(username)` a los dos lados: el índice único de los usernames
  -- es sobre lower(username), así que esto es lo que hay.
  select coalesce(array_agg(distinct u.id), '{}') into v_mencionados
  from unnest(menciones_de(v_texto)) as nombre
  join user_profiles u on lower(u.username) = nombre
  where u.id is distinct from new.author_id
    and coalesce(u.is_banned, false) = false;

  foreach v_id in array v_mencionados loop
    perform enqueue_email(
      v_id,
      'forum_mention',
      v_nombre || ' te ha mencionado en «' || v_titulo || '»',
      v_vista,
      v_enlace,
      -- Clave propia, distinta de la de las respuestas: que te
      -- mencionen es lo bastante directo como para no quedarse
      -- tragado por el correo de "hay movimiento en ese tema".
      'foromen:' || new.thread_id::text
    );
  end loop;

  -- ── A quien se cita y a quien sigue el tema ──
  --
  -- El citado va aunque no siga el tema: es una respuesta a SU mensaje,
  -- igual que en las respuestas a comentarios de guías.
  --
  -- Quien abrió el tema no necesita caso aparte: el disparador
  -- trg_forum_suscribir_al_escribir ya le suscribió al escribir el
  -- primer mensaje.
  if new.reply_to_id is not null then
    select author_id into v_citado from forum_posts where id = new.reply_to_id;
  end if;

  for v_id in
    select u.id
    from user_profiles u
    where u.id is distinct from new.author_id
      and coalesce(u.is_banned, false) = false
      -- Ya avisado por mención: uno y no dos.
      and not (u.id = any (v_mencionados))
      and (
        u.id = v_citado
        or exists (
          select 1 from forum_subscriptions s
          where s.thread_id = new.thread_id and s.user_id = u.id
        )
      )
  loop
    perform enqueue_email(
      v_id,
      'forum_reply',
      v_nombre || ' ha respondido en «' || v_titulo || '»',
      v_vista,
      v_enlace,
      -- Diez respuestas seguidas en un tema animado son UN correo, no
      -- diez (enqueue_email agrupa por esta clave y además espera 30
      -- minutos desde el último enviado).
      'foro:' || new.thread_id::text
    );
  end loop;

  return new;
end $$;

--
-- Name: on_guide_review_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_guide_review_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_autor text;
  v_titulo text;
  v_admin record;
  v_motivo text;
begin
  if tg_op = 'UPDATE' and new.review_status is not distinct from old.review_status then
    return new;
  end if;

  v_titulo := coalesce(email_preview(new.title, 70), 'Sin título');

  if new.review_status = 'pending' and new.author_id is not null then
    select coalesce(email_preview(display_name, 60), email_preview(username, 60), 'Alguien')
      into v_autor
      from user_profiles where id = new.author_id;
    v_autor := coalesce(v_autor, 'Alguien');

    for v_admin in select id from user_profiles where is_admin = true loop
      continue when v_admin.id = new.author_id;

      insert into user_notifications (recipient_id, type, title, body, link)
      values (
        v_admin.id,
        'guide_submitted',
        'Guía nueva para revisar',
        v_autor || ' ha enviado «' || v_titulo || '»',
        '/admin/'
      );

      perform enqueue_email(
        v_admin.id,
        'guide_submitted',
        'Guía nueva para revisar en PokeDoc',
        v_autor || ' ha enviado a revisión «' || v_titulo || '».',
        '/admin/',
        'guiarev:' || new.id::text
      );
    end loop;
    return new;
  end if;

  if new.author_id is null then
    return new;
  end if;

  if new.review_status = 'approved' then
    -- La ha publicado su autor (Redacción): no hay nadie que la haya aprobado.
    if auth.uid() is not null and auth.uid() = new.author_id then
      return new;
    end if;
    perform enqueue_email(
      new.author_id,
      'guide_approved',
      'Tu guía ya está publicada en PokeDoc',
      'Hemos aprobado «' || v_titulo || '». Ya la puede leer todo el mundo.',
      '/guia.html?slug=' || coalesce(new.slug, ''),
      'guiaest:' || new.id::text
    );
  elsif new.review_status = 'rejected' then
    v_motivo := coalesce(email_preview(new.rejection_reason, 200), '');
    perform enqueue_email(
      new.author_id,
      'guide_rejected',
      'Tu guía necesita unos cambios',
      case when v_motivo = '' then 'Ábrela en el editor para ver qué falta.'
           else 'Motivo: ' || v_motivo end,
      '/editor-guia.html?id=' || new.id::text,
      'guiaest:' || new.id::text
    );
  end if;

  return new;
end $$;

--
-- Name: on_new_follower_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_new_follower_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_nombre text;
  v_usuario text;
  v_bio text;
  v_baneado boolean;
begin
  -- La tabla ya prohíbe seguirse a uno mismo (user_follows_no_self),
  -- pero esto no depende de que esa restricción siga ahí mañana.
  if new.follower_id is null or new.follower_id = new.following_id then
    return new;
  end if;

  select email_preview(coalesce(display_name, username, 'Alguien'), 60),
         username,
         email_preview(bio, 140),
         coalesce(is_banned, false)
    into v_nombre, v_usuario, v_bio, v_baneado
    from user_profiles
   where id = new.follower_id;

  -- De un baneado no se avisa: sería usar nuestro correo para que le
  -- llegue a alguien lo que no queremos ni que se vea en la web.
  if v_baneado then
    return new;
  end if;

  -- Al que recibe también se le mira: a una cuenta baneada no se le
  -- escribe.
  if coalesce((select is_banned from user_profiles where id = new.following_id), false) then
    return new;
  end if;

  perform enqueue_email(
    new.following_id,
    'new_follower',
    coalesce(v_nombre, 'Alguien') || ' ha empezado a seguirte',
    -- La bio del que sigue, si la tiene: da contexto para decidir si te
    -- interesa devolverle el seguimiento sin tener que abrir nada.
    v_bio,
    -- Al perfil de quien te sigue, que es lo que quieres mirar.
    case when v_usuario is not null then '/usuario/' || v_usuario else '/usuarios.html' end,
    'follow:' || new.following_id::text
  );

  return new;
end $$;

--
-- Name: on_private_message_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_private_message_email() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_destinatario uuid;
  v_nombre text;
begin
  select cp.user_id into v_destinatario
  from conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id <> new.sender_id
  limit 1;

  if v_destinatario is null then
    return new;
  end if;

  -- email_preview colapsa cualquier espacio en blanco, saltos de línea
  -- incluidos. Va aquí porque este nombre acaba en la CABECERA Subject
  -- del correo, y un nombre con un \n permitiría inyectar cabeceras.
  select email_preview(coalesce(display_name, username, 'Alguien'), 60) into v_nombre
  from user_profiles where id = new.sender_id;

  perform enqueue_email(
    v_destinatario,
    'private_message',
    coalesce(v_nombre, 'Alguien') || ' te ha enviado un mensaje',
    email_preview(new.body),
    '/mensajes.html?c=' || new.conversation_id::text,
    'dm:' || new.conversation_id::text
  );

  return new;
end $$;

--
-- Name: perfil_guarda_columnas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.perfil_guarda_columnas() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_admin := false;
    new.is_moderator := false;
    new.is_tournament_admin := false;
    new.is_news_writer := false;
    new.is_writer := false;
    new.is_banned := false;
    new.is_muted := false;
    new.is_pro := false;
    new.forum_title := null;
    new.forum_title_color := null;
    new.total_xp := 0;
    new.level := public.nivel_de_xp(0);
    if not public.url_de_imagen_segura(new.avatar_url) then new.avatar_url := null; end if;
    if not public.url_de_imagen_segura(new.banner_url) then new.banner_url := null; end if;
    return new;
  end if;

  new.is_banned := old.is_banned;
  new.is_muted := old.is_muted;
  new.is_pro := old.is_pro;
  new.forum_title_color := old.forum_title_color;
  new.total_xp := old.total_xp;
  new.level := old.level;
  if new.avatar_url is distinct from old.avatar_url and not public.url_de_imagen_segura(new.avatar_url) then
    new.avatar_url := old.avatar_url;
  end if;
  if new.banner_url is distinct from old.banner_url and not public.url_de_imagen_segura(new.banner_url) then
    new.banner_url := old.banner_url;
  end if;
  return new;
end;
$$;

--
-- Name: plegar_texto(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.plegar_texto(txt text) RETURNS text
    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE
    SET search_path TO 'extensions', 'public', 'pg_catalog'
    AS $$
  select lower(unaccent('unaccent'::regdictionary, txt))
$$;

--
-- Name: pokedex_marcar(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pokedex_marcar(p_filas jsonb) RETURNS integer
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with datos as (
    select
      x ->> 'id' as id,
      x ->> 'market' as market,
      -- El centinela de la 381 se respeta: `{}` significa «mirada y no
      -- lleva ningún Pokémon», y es lo que hace que la cola se vacíe. Si
      -- esto devolviera null, esas cartas volverían en cada pasada para
      -- siempre (lecciones de las tandas 333, 380 y 381).
      coalesce(
        (select array_agg(v::int) from jsonb_array_elements_text(x -> 'dex_ids') v),
        '{}'::int[]
      ) as dex_ids
    from jsonb_array_elements(p_filas) x
  ),
  hecho as (
    update public.tcg_cards c
       set dex_ids = d.dex_ids
      from datos d
     where c.id = d.id
       and c.market = d.market
    returning 1
  )
  select count(*)::int from hecho;
$$;

--
-- Name: pokedex_resumen(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.pokedex_resumen(p_market text DEFAULT 'WEST'::text) RETURNS TABLE(dex integer, cartas integer)
    LANGUAGE sql STABLE
    AS $$
  select d.dex, count(*)::int
    from public.tcg_cards c, unnest(c.dex_ids) as d(dex)
   where c.market = p_market and c.dex_ids is not null
   group by d.dex
   order by d.dex;
$$;

--
-- Name: poner_padrino(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.poner_padrino(p_padrino uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_yo uuid := auth.uid();
begin
  if v_yo is null or p_padrino is null or p_padrino = v_yo then
    return false;
  end if;
  if not exists (select 1 from public.user_profiles where id = p_padrino) then
    return false;
  end if;
  insert into public.user_privado (user_id) values (v_yo) on conflict (user_id) do nothing;
  update public.user_privado set referred_by = p_padrino, updated_at = now()
    where user_id = v_yo and referred_by is null;
  return found;
end $$;

--
-- Name: portada_clasificacion(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portada_clasificacion(p_periodo text DEFAULT 'semana'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_desde date;
  v jsonb;
begin
  v_desde := case when p_periodo = 'mes'
    then date_trunc('month', current_date)::date
    else current_date - (extract(isodow from current_date)::int - 1)
  end;

  with puntos as (
    select t.user_id, sum(t.xp)::int as xp, count(distinct t.day)::int as dias
    from (
      select r.user_id, r.day, r.xp from public.retos_resultados r where r.day between v_desde and current_date
      union all
      select b.user_id, b.day, b.xp from public.retos_bonos b where b.day between v_desde and current_date
    ) t
    group by t.user_id
    having sum(t.xp) > 0
  ),
  orden as (
    select p.*, row_number() over (order by p.xp desc, p.dias desc, p.user_id) as puesto from puntos p
  ),
  visibles as (
    select o.*, u.username, u.display_name, u.avatar_url
    from orden o
    join public.user_profiles u on u.id = o.user_id
    where not coalesce(u.retos_oculto, false) and not coalesce(u.hide_activity, false)
  )
  select jsonb_build_object(
    'periodo', case when p_periodo = 'mes' then 'mes' else 'semana' end,
    'desde', v_desde,
    'jugadores', (select count(*) from orden),
    'ranking', coalesce((select jsonb_agg(jsonb_build_object(
        'puesto', x.puesto, 'username', x.username, 'display_name', x.display_name, 'avatar_url', x.avatar_url,
        'xp', x.xp, 'dias', x.dias, 'tu', x.user_id = v_uid) order by x.puesto)
      from (select * from visibles order by puesto limit 10) x), '[]'::jsonb),
    -- Tu puesto entre TODOS, y cuánto te falta para pasar al de delante
    -- (con su nombre solo si sale con nombre).
    'tu', (select jsonb_build_object(
        'puesto', o.puesto, 'xp', o.xp,
        'faltan', (select a.xp - o.xp + 1 from orden a where a.puesto = o.puesto - 1),
        'pasarA', (select coalesce(v2.display_name, v2.username) from visibles v2 where v2.puesto = o.puesto - 1))
      from orden o where o.user_id = v_uid)
  ) into v;
  return v;
end;
$$;

--
-- Name: portada_comunidad(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portada_comunidad(p_limite integer DEFAULT 12) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  with gente as (
    select u.id, u.username, u.display_name, u.avatar_url, u.coleccion_publica, u.is_admin, u.is_moderator
    from public.user_profiles u
    where not coalesce(u.hide_activity, false)
  ),
  perfectos as (
    select 'perfecto'::text as tipo, b.user_id, b.created_at as fecha, jsonb_build_object('dia', b.day) as datos
    from public.retos_bonos b
    where b.tipo = 'perfecto' and b.day >= current_date - 7
  ),
  mazos as (
    select distinct on (d.user_id) 'mazo'::text as tipo, d.user_id, d.updated_at as fecha,
      jsonb_build_object('id', d.id, 'nombre', d.name) as datos
    from public.user_decks d
    where d.is_public and d.updated_at >= now() - interval '30 days'
    order by d.user_id, d.updated_at desc
  ),
  campeones as (
    select 'campeon'::text as tipo, t.champion_id as user_id, t.updated_at as fecha,
      jsonb_build_object('slug', t.slug, 'nombre', t.name) as datos
    from public.tournaments t
    where t.status = 'finished' and t.champion_id is not null and t.updated_at >= now() - interval '30 days'
  ),
  -- Solo se mira lo que alguien ha tocado este mes: una expansión se
  -- completa al añadir la ÚLTIMA carta, y esa es reciente.
  tocados as (
    select distinct c.user_id, k.set_id, k.market
    from public.user_collection c
    join public.tcg_cards k on k.id = c.card_id and k.market = c.market
    join gente g on g.id = c.user_id and g.coleccion_publica
    where c.created_at >= now() - interval '30 days'
  ),
  colecciones as (
    select 'coleccion'::text as tipo, x.user_id, max(c.created_at) as fecha,
      jsonb_build_object('set', s.id, 'market', s.market, 'nombre', s.name) as datos
    from tocados x
    join public.tcg_sets s on s.id = x.set_id and s.market = x.market
    join public.tcg_cards k on k.set_id = s.id and k.market = s.market
    join public.user_collection c on c.card_id = k.id and c.market = k.market and c.user_id = x.user_id
    where coalesce(s.card_count_official, 0) > 0
      and k.local_id ~ '^\d+$' and k.local_id::int between 1 and s.card_count_official
    group by x.user_id, s.id, s.market, s.name, s.card_count_official
    having count(distinct k.id) >= s.card_count_official
  ),
  inscripciones as (
    select 'inscripcion'::text as tipo, r.user_id, r.registered_at as fecha,
      jsonb_build_object('slug', t.slug, 'nombre', t.name) as datos
    from public.tournament_registrations r
    join public.tournaments t on t.id = r.tournament_id
    where r.status = 'active' and t.status not in ('draft', 'cancelled') and r.registered_at >= now() - interval '30 days'
  ),
  seguidos as (
    select 'sigue'::text as tipo, f.follower_id as user_id, f.created_at as fecha,
      jsonb_build_object('username', g2.username, 'display_name', g2.display_name, 'is_admin', g2.is_admin, 'is_moderator', g2.is_moderator) as datos
    from public.user_follows f
    join gente g2 on g2.id = f.following_id
    where f.created_at >= now() - interval '30 days'
  ),
  -- Una respuesta es un mensaje que no abre el tema; de cada persona, el
  -- último por tema (una conversación animada no llena la lista sola).
  respuestas as (
    select distinct on (p.author_id, p.thread_id) 'respuesta'::text as tipo, p.author_id as user_id, p.created_at as fecha,
      jsonb_build_object('id', t.id, 'titulo', t.title) as datos
    from public.forum_posts p
    join public.forum_threads t on t.id = p.thread_id
    where p.created_at >= now() - interval '7 days' and p.author_id is not null
      and (p.author_id <> t.author_id or p.created_at > t.created_at + interval '1 minute')
    order by p.author_id, p.thread_id, p.created_at desc
  ),
  cambios as (
    select 'cambio'::text as tipo, c.user_id, max(c.updated_at) as fecha, jsonb_build_object('cartas', count(*)) as datos
    from public.user_collection c
    where c.cambio > 0 and c.updated_at >= now() - interval '14 days'
    group by c.user_id
  ),
  todo as (
    select * from perfectos union all select * from mazos union all select * from campeones union all select * from colecciones
    union all select * from inscripciones union all select * from seguidos union all select * from respuestas union all select * from cambios
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'tipo', e.tipo, 'fecha', e.fecha, 'datos', e.datos,
      'username', e.username, 'display_name', e.display_name, 'avatar_url', e.avatar_url,
      'is_admin', e.is_admin, 'is_moderator', e.is_moderator) order by e.fecha desc), '[]'::jsonb)
  from (
    select t.tipo, t.fecha, t.datos, g.username, g.display_name, g.avatar_url, g.is_admin, g.is_moderator
    from todo t join gente g on g.id = t.user_id
    order by t.fecha desc
    limit greatest(1, least(coalesce(p_limite, 12), 60))
  ) e;
$_$;

--
-- Name: portada_foro(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portada_foro(p_desde timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_desde timestamptz := coalesce(p_desde, date_trunc('day', now()));
  v_hasta timestamptz := (select u.forum_read_all_at from public.user_profiles u where u.id = v_uid);
  v jsonb;
begin
  with visibles as (
    select b.id, b.name from public.forum_boards b where not coalesce(b.is_hidden, false)
  ),
  -- Los cuatro temas más recientes de los foros que se ven (876).
  temas as (
    select t.id, t.title, t.prefix, t.post_count, t.created_at, t.last_post_at, t.author_id, t.last_post_author_id, t.board_id
      from public.forum_threads t
      join visibles b on b.id = t.board_id
     order by t.last_post_at desc nulls last
     limit 4
  ),
  de_hoy as (
    select m.thread_id, m.author_id from public.forum_posts m where m.created_at >= v_desde limit 1000
  ),
  cuenta_hoy as (
    select h.thread_id, count(*)::int as n from de_hoy h group by h.thread_id
  ),
  -- Delante, el que más mensajes ha tenido hoy; a igualdad, el más reciente.
  top as (
    select t.id from temas t left join cuenta_hoy c on c.thread_id = t.id
     order by coalesce(c.n, 0) desc, t.last_post_at desc nulls last
     limit 1
  ),
  ultimos as (
    select m.id, m.author_id, left(m.body_html, 1500) as body_html, m.created_at
      from public.forum_posts m
     where m.thread_id = (select id from top)
     order by m.created_at desc
     limit 10
  ),
  gente as (
    select t.author_id as id from temas t
    union select t.last_post_author_id from temas t
    union select u.author_id from ultimos u
  ),
  perfiles as (
    select u.id, u.username, u.display_name, u.avatar_url, u.level, u.total_xp, u.hide_activity, u.is_admin, u.is_moderator
      from public.user_profiles u
     where u.id in (select g.id from gente g where g.id is not null)
  ),
  -- Lo que no has leído, con la regla de `estaSinLeer`; el de delante con
  -- su cuenta exacta (los mensajes de otros posteriores a tu marca, y uno
  -- como poco), los demás con su punto.
  sin_leer as (
    select t.id, t.post_count, greatest(r.last_read_at, v_hasta) as ref
      from temas t
      left join public.forum_thread_reads r on r.thread_id = t.id and r.user_id = v_uid
     where v_uid is not null and t.last_post_at is not null
       and (t.last_post_author_id is null or t.last_post_author_id <> v_uid)
       and t.last_post_at > coalesce(greatest(r.last_read_at, v_hasta), '-infinity'::timestamptz)
  ),
  nuevos as (
    select s.id,
           case when s.id = (select id from top) then
                  case when s.ref is null then least(coalesce(s.post_count, 1), 10)
                       else greatest((select count(*) from ultimos u where u.created_at > s.ref and u.author_id <> v_uid), 1) end
                else 1 end as n
      from sin_leer s
  )
  select jsonb_build_object(
    'temas', coalesce((select jsonb_agg(to_jsonb(t) order by (t.id = (select id from top)) desc, t.last_post_at desc nulls last) from temas t), '[]'::jsonb),
    'foros', coalesce((select jsonb_object_agg(b.id::text, b.name) from visibles b), '{}'::jsonb),
    'hoy', coalesce((select jsonb_object_agg(c.thread_id::text, c.n) from cuenta_hoy c), '{}'::jsonb),
    'escribiendo', (select count(distinct h.author_id) from de_hoy h),
    'ultimo', (select to_jsonb(u) from ultimos u order by u.created_at desc limit 1),
    'participantes', coalesce((select jsonb_agg(a.author_id order by a.ultimo desc)
                                 from (select u.author_id, max(u.created_at) as ultimo from ultimos u where u.author_id is not null group by u.author_id) a), '[]'::jsonb),
    'perfiles', coalesce((select jsonb_object_agg(p.id::text, to_jsonb(p)) from perfiles p), '{}'::jsonb),
    'nuevos', coalesce((select jsonb_object_agg(n.id::text, n.n) from nuevos n), '{}'::jsonb),
    'sesion', v_uid is not null
  ) into v;
  return v;
end;
$$;

--
-- Name: portada_hoy(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.portada_hoy() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_uid uuid := auth.uid();
  v_hoy date := current_date;
  -- Lo que se puede JUGAR en una guía: es `PRACTICE_TYPES` de
  -- js/guia-contenido.js (una copia, y la vigila test-tanda-1017.mjs).
  v_practica text[] := array['quiz', 'truefalse', 'fillblank', 'match', 'order', 'cartaquiz', 'zonas', 'ordenprecio', 'clasifica', 'intruso', 'desliza', 'memoria', 'escribe', 'diferencias'];
begin
  if v_uid is null then return null; end if;
  return jsonb_build_object(
    'dia', v_hoy,
    -- El valor: las fotos de 60 días y la suma de ahora (hoy.js: la foto es
    -- de anoche y no lleva lo que pusiste a mano ni lo que subió hoy).
    'valor', jsonb_build_object(
      'historia', coalesce((select jsonb_agg(jsonb_build_object('dia', h.dia, 'valor', h.valor) order by h.dia)
                             from public.user_collection_value h
                            where h.user_id = v_uid and h.dia >= v_hoy - 60), '[]'::jsonb),
      'ahora', public.coleccion_valor_de(v_uid)),
    -- Tus torneos con inscripción activa, todos: cuál es el próximo lo
    -- decide `proximaCita` en el navegador (879: una liga empezó hace
    -- semanas y su cita es la próxima jornada).
    'torneos', coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name, 'start_at', t.start_at,
                                 'status', t.status, 'format', t.format, 'matchday_dates', t.matchday_dates))
                          from public.tournaments t
                         where t.id in (select r.tournament_id from public.tournament_registrations r
                                         where r.user_id = v_uid and r.status = 'active')), '[]'::jsonb),
    -- El próximo con inscripciones abiertas (la ficha de quien no juega ninguno).
    'abierto', (select jsonb_build_object('id', t.id, 'slug', t.slug, 'name', t.name, 'start_at', t.start_at)
                  from public.tournaments t
                 where t.status = 'registration_open' and t.start_at >= now()
                 order by t.start_at limit 1),
    -- Los tres próximos lanzamientos del catálogo occidental (656), sin
    -- Pocket; las de TCGGO nacen escondidas (756) y las filtra el navegador.
    'sets', coalesce((select jsonb_agg(jsonb_build_object('name', s.name, 'name_en', s.name_en, 'release_date', s.release_date,
                              'logo_tcggo', s.logo_tcggo, 'logo_scrydex', s.logo_scrydex, 'oculto', s.oculto, 'tcggo_id', s.tcggo_id)
                              order by s.release_date)
                       from (select * from public.tcg_sets
                              where market = 'WEST' and serie_id <> 'tcgp' and release_date >= v_hoy
                              order by release_date limit 3) s), '[]'::jsonb),
    -- Lo que tienes a medias (748): las últimas cuatro guías empezadas y
    -- sin acabar, con lo que la tarjeta pinta de cada una (no los bloques
    -- enteros: `bloques` y si hay algo que jugar), y tus tres últimos mazos
    -- con sus cartas contadas.
    'sigue', jsonb_build_object(
      'progreso', coalesce((select jsonb_agg(jsonb_build_object(
                             'guide_id', p.guide_id, 'current_block', p.current_block, 'status', p.status,
                             'started_at', p.started_at, 'read_at', p.read_at,
                             'guia', jsonb_build_object('id', g.id, 'slug', g.slug, 'title', g.title, 'estimated_mins', g.estimated_mins,
                               'bloques', case when jsonb_typeof(g.blocks) = 'array' then jsonb_array_length(g.blocks) else 0 end,
                               'curso', exists (select 1 from jsonb_array_elements(case when jsonb_typeof(g.blocks) = 'array' then g.blocks else '[]'::jsonb end) b
                                                 where b ->> 'type' = any (v_practica))))
                             order by p.started_at desc)
                            from (select * from public.user_progress
                                   where user_id = v_uid and status <> 'completed' and started_at is not null
                                   order by started_at desc limit 4) p
                            join public.guides g on g.id = p.guide_id), '[]'::jsonb),
      'mazos', coalesce((select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'updated_at', d.updated_at,
                           'cartas', (select coalesce(sum((x ->> 'n')::numeric), 0)
                                        from jsonb_array_elements(case when jsonb_typeof(d.cards) = 'array' then d.cards else '[]'::jsonb end) x
                                       where (x ->> 'n') ~ '^[0-9]+(\.[0-9]+)?$'))
                           order by d.updated_at desc)
                          from (select * from public.user_decks where user_id = v_uid order by updated_at desc limit 3) d), '[]'::jsonb)),
    -- Los temas que sigues con algo que no has visto (1010), con la regla
    -- de `estaSinLeer`: el último mensaje no es tuyo y es posterior a tu
    -- marca del tema o a «todo leído», la más nueva; sin ninguna, está sin
    -- leer. Las últimas 200 suscripciones, como la web.
    'hilos', (select jsonb_build_object('cuenta', count(*),
                                        'uno', (array_agg(t.id order by t.last_post_at desc))[1],
                                        'titulo', (array_agg(t.title order by t.last_post_at desc))[1])
                from (select s.thread_id from public.forum_subscriptions s where s.user_id = v_uid order by s.created_at desc limit 200) s
                join public.forum_threads t on t.id = s.thread_id
                left join public.forum_thread_reads r on r.thread_id = t.id and r.user_id = v_uid
               where t.last_post_at is not null
                 and (t.last_post_author_id is null or t.last_post_author_id <> v_uid)
                 and t.last_post_at > coalesce(greatest(r.last_read_at, (select u.forum_read_all_at from public.user_profiles u where u.id = v_uid)), '-infinity'::timestamptz)),
    -- Los retos (835) y la gente de hoy (842), las funciones de siempre.
    'retos', public.retos_mis_numeros(7),
    'comunidad', public.retos_comunidad(v_hoy),
    -- Las preguntas por repasar (curso-datos.js).
    'repaso', (select count(*) from public.course_review_queue q where q.user_id = v_uid and q.review_after <= now()),
    -- Los primeros pasos (primeros-pasos.js): si ya tienes el trofeo, y si
    -- no, cuál de los tres llevas.
    'pasos', (select jsonb_build_object(
                'logro', coalesce(u.achievements @> array['primeros_pasos'], false),
                'leer', exists (select 1 from public.user_progress p where p.user_id = v_uid and p.read_at is not null),
                'curso', exists (select 1 from public.user_progress p where p.user_id = v_uid and p.status = 'completed'),
                'foro', exists (select 1 from public.forum_posts m where m.author_id = v_uid))
                from public.user_profiles u where u.id = v_uid)
  );
end;
$_$;

--
-- Name: precios_pendientes(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.precios_pendientes(p_limite integer DEFAULT 40, p_horas integer DEFAULT 20) RETURNS TABLE(card_id text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select c.card_id
  from (select distinct card_id from public.user_collection where market = 'WEST') c
  left join public.tcg_card_prices p on p.card_id = c.card_id
  where p.card_id is null
     or p.checked_at < now() - make_interval(hours => greatest(1, coalesce(p_horas, 20)))
     or (p.tp_updated is null and p.checked_at < now() - interval '5 minutes')
  order by p.checked_at asc nulls first, c.card_id
  limit greatest(1, least(coalesce(p_limite, 40), 200));
$$;

--
-- Name: premios_bien_formados(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.premios_bien_formados(p_premios jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select jsonb_typeof(p_premios) = 'array'
     -- Doce premios son de sobra para un podio y un par de menciones.
     and jsonb_array_length(p_premios) <= 12
     and not exists (
       select 1
       from jsonb_array_elements(p_premios) as p
       -- `is distinct from` y no `<>`: si la clave NO ESTÁ, `jsonb_typeof`
       -- devuelve NULL, y `NULL <> 'string'` no es cierto — es nulo. Con
       -- `<>` se colaba un premio a medias ({"puesto":"1º"} sin premio),
       -- que es justo el caso que esto viene a impedir.
       where jsonb_typeof(p) is distinct from 'object'
          or jsonb_typeof(p -> 'puesto') is distinct from 'string'
          or jsonb_typeof(p -> 'premio') is distinct from 'string'
          or length(p ->> 'puesto') > 40
          or length(p ->> 'premio') > 200
     )
$$;

--
-- Name: privado_al_nacer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.privado_al_nacer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  insert into public.user_privado (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

--
-- Name: productos_por_expansion(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.productos_por_expansion(p_market text DEFAULT 'WEST'::text) RETURNS TABLE(episode_id bigint, productos integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select p.episode_id, count(*)::int
    from public.tcg_products p
   where p.market = coalesce(p_market, 'WEST') and p.episode_id is not null
   group by p.episode_id
$$;

--
-- Name: puzles_crear(text, integer, text, text[], integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzles_crear(p_repeticion text, p_foto integer, p_pregunta text, p_opciones text[], p_correcta integer, p_explicacion text) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id text;
  v_opciones text[];
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  if not exists (select 1 from public.replays r where r.id = p_repeticion and r.user_id = auth.uid()) then
    raise exception 'Solo se hacen puzles de repeticiones tuyas: guárdala primero.' using errcode = '42501';
  end if;
  if (select count(*) from public.replay_puzzles where user_id = auth.uid()) >= 100 then
    raise exception 'Caben 100 puzles por persona: borra alguno antes.' using errcode = 'P0001';
  end if;
  select array_agg(btrim(o) order by k) into v_opciones
  from unnest(p_opciones) with ordinality as t(o, k)
  where btrim(coalesce(o, '')) <> '';
  if v_opciones is null or cardinality(v_opciones) < 2 or cardinality(v_opciones) > 4 then
    raise exception 'Hacen falta de 2 a 4 opciones.' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_opciones) o where char_length(o) > 120) then
    raise exception 'Cada opción cabe en 120 caracteres.' using errcode = '22023';
  end if;
  insert into public.replay_puzzles (replay_id, foto, pregunta, opciones, correcta, explicacion)
  values (p_repeticion, p_foto, btrim(p_pregunta), v_opciones, p_correcta, btrim(p_explicacion))
  returning id into v_id;
  -- Sin el registro a la vista no hay mesa que enseñar.
  update public.replays set compartida = true where id = p_repeticion;
  return v_id;
end;
$$;

--
-- Name: puzles_lista(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzles_lista(p_limite integer DEFAULT 20) RETURNS TABLE(id text, pregunta text, created_at timestamp with time zone, autor text, respuestas integer, aciertos integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select pz.id, pz.pregunta, pz.created_at, coalesce(p.display_name, p.username),
         (select count(*)::int from public.replay_puzzle_answers a where a.puzzle_id = pz.id),
         (select count(*)::int from public.replay_puzzle_answers a where a.puzzle_id = pz.id and a.opcion = pz.correcta)
  from public.replay_puzzles pz
  join public.replays r on r.id = pz.replay_id and r.compartida
  left join public.user_profiles p on p.id = pz.user_id
  order by pz.created_at desc
  limit least(greatest(coalesce(p_limite, 20), 1), 50)
$$;

--
-- Name: puzles_responder(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzles_responder(p_puzle text, p_opcion integer) RETURNS TABLE(correcta integer, explicacion text, recuento integer[], tuya integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v public.replay_puzzles;
begin
  select pz.* into v from public.replay_puzzles pz
  where pz.id = p_puzle
    and (pz.user_id = auth.uid() or exists (select 1 from public.replays r where r.id = pz.replay_id and r.compartida));
  if v.id is null then
    raise exception 'Ese puzle no existe o ya no se comparte.' using errcode = 'P0002';
  end if;
  if p_opcion is null or p_opcion < 0 or p_opcion >= cardinality(v.opciones) then
    raise exception 'Esa opción no es de este puzle.' using errcode = '22023';
  end if;
  if auth.uid() is not null then
    insert into public.replay_puzzle_answers (puzzle_id, user_id, opcion)
    values (v.id, auth.uid(), p_opcion)
    on conflict (puzzle_id, user_id) do nothing;
  end if;
  return query
    select v.correcta, v.explicacion,
           (select array_agg((select count(*)::int from public.replay_puzzle_answers a where a.puzzle_id = v.id and a.opcion = k - 1) order by k)
              from generate_series(1, cardinality(v.opciones)) k),
           (select a.opcion from public.replay_puzzle_answers a where a.puzzle_id = v.id and a.user_id = auth.uid());
end;
$$;

--
-- Name: record_question_answer(uuid, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_question_answer(p_guide_id uuid, p_question_key text, p_correct boolean) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  -- Solo gente con cuenta, y no la que está baneada: si no, el
  -- porcentaje lo puede mover cualquiera desde fuera con un bucle.
  if auth.uid() is null then
    return;
  end if;
  if public.is_banned() then
    return;
  end if;

  -- Una clave absurdamente larga solo puede venir de alguien trasteando.
  if p_question_key is null or length(p_question_key) > 64 then
    return;
  end if;

  -- Y que la pregunta sea de un curso que existe y se puede ver.
  if not exists (
    select 1 from public.guides g
    where g.id = p_guide_id and g.published_at is not null
  ) then
    return;
  end if;

  insert into public.question_stats (guide_id, question_key, times_answered, times_correct)
  values (p_guide_id, p_question_key, 1, case when p_correct then 1 else 0 end)
  on conflict (guide_id, question_key) do update
    set times_answered = public.question_stats.times_answered + 1,
        times_correct = public.question_stats.times_correct + case when p_correct then 1 else 0 end,
        updated_at = now();
end;
$$;

--
-- Name: repeticion_compartida(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.repeticion_compartida(p_id text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from public.replays r where r.id = p_id and r.compartida)
$$;

--
-- Name: repeticiones_guardar(text, text, text[], text, integer, boolean, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.repeticiones_guardar(p_registro text, p_titulo text DEFAULT NULL::text, p_jugadores text[] DEFAULT NULL::text[], p_ganador text DEFAULT NULL::text, p_turnos integer DEFAULT NULL::integer, p_compartida boolean DEFAULT NULL::boolean, p_mazos text[] DEFAULT NULL::text[]) RETURNS TABLE(id text, compartida boolean, nueva boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_yo uuid := auth.uid();
  v_titulo text := left(nullif(trim(coalesce(p_titulo, '')), ''), 120);
  v_id text;
  v_compartida boolean;
  v_intentos int := 0;
begin
  if v_yo is null then
    raise exception 'Hace falta iniciar sesión para guardar una repetición.' using errcode = '28000';
  end if;
  if p_registro is null or char_length(p_registro) < 100 or char_length(p_registro) > 200000 then
    raise exception 'Eso no parece el registro de una partida.' using errcode = '22023';
  end if;

  -- La misma partida otra vez: la de antes, con lo nuevo.
  select r.id into v_id from public.replays r where r.user_id = v_yo and r.registro_md5 = md5(p_registro);
  if v_id is not null then
    update public.replays r
       set titulo = coalesce(v_titulo, r.titulo),
           compartida = coalesce(p_compartida, r.compartida),
           mazo_a = coalesce(left(nullif(trim(p_mazos[1]), ''), 120), r.mazo_a),
           mazo_b = coalesce(left(nullif(trim(p_mazos[2]), ''), 120), r.mazo_b)
     where r.id = v_id
     returning r.compartida into v_compartida;
    return query select v_id, v_compartida, false;
    return;
  end if;

  if (select count(*) from public.replays r where r.user_id = v_yo and r.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Has guardado muchas repeticiones seguidas. Prueba dentro de un rato.' using errcode = 'P0001';
  end if;

  loop
    v_intentos := v_intentos + 1;
    begin
      insert into public.replays (user_id, titulo, registro, jugador_a, jugador_b, ganador, turnos, compartida, mazo_a, mazo_b)
      values (
        v_yo,
        coalesce(v_titulo, 'Repetición'),
        p_registro,
        left(nullif(trim(p_jugadores[1]), ''), 40),
        left(nullif(trim(p_jugadores[2]), ''), 40),
        left(nullif(trim(p_ganador), ''), 40),
        case when p_turnos between 0 and 500 then p_turnos end,
        coalesce(p_compartida, false),
        left(nullif(trim(p_mazos[1]), ''), 120),
        left(nullif(trim(p_mazos[2]), ''), 120)
      )
      returning replays.id, replays.compartida into v_id, v_compartida;
      return query select v_id, v_compartida, true;
      return;
    exception when unique_violation then
      -- O ha chocado el identificador (se prueba otro), o esa misma
      -- partida se acaba de guardar en otra pestaña: entonces, esa.
      select r.id, r.compartida into v_id, v_compartida
        from public.replays r where r.user_id = v_yo and r.registro_md5 = md5(p_registro);
      if v_id is not null then
        return query select v_id, v_compartida, false;
        return;
      end if;
      if v_intentos >= 5 then
        raise;
      end if;
    end;
  end loop;
end;
$$;

--
-- Name: repeticiones_juez_de(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.repeticiones_juez_de(p_torneo uuid) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if to_regclass('public.judge_applications') is null then
    return false;
  end if;
  return exists (
    select 1 from public.judge_applications j
     where j.tournament_id = p_torneo and j.user_id = auth.uid() and j.status = 'approved');
end;
$$;

--
-- Name: repeticiones_leer(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.repeticiones_leer(p_id text) RETURNS TABLE(registro text, titulo text, jugador_a text, jugador_b text, turnos integer, created_at timestamp with time zone, mia boolean, compartida boolean, notas jsonb, mazo_a text, mazo_b text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.registro, r.titulo, r.jugador_a, r.jugador_b, r.turnos, r.created_at,
         coalesce(r.user_id = auth.uid(), false), r.compartida, r.notas, r.mazo_a, r.mazo_b
  from public.replays r
  where r.id = p_id
    and (r.compartida or r.user_id = auth.uid())
$$;

--
-- Name: repeticiones_publicar(text, boolean, text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.repeticiones_publicar(p_id text, p_publica boolean, p_arquetipos text[] DEFAULT NULL::text[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_dueno uuid;
  v_ids text[];
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  select user_id into v_dueno from public.replays where id = p_id;
  if v_dueno is null then
    raise exception 'Esa repetición no existe.' using errcode = 'P0002';
  end if;
  if not p_publica then
    if v_dueno <> auth.uid() and not exists (select 1 from public.user_profiles p where p.id = auth.uid() and p.is_admin) then
      raise exception 'Solo quien la publicó puede quitarla de la lista.' using errcode = '42501';
    end if;
    update public.replays set publica = false, publicada_at = null where id = p_id;
    return false;
  end if;
  if v_dueno <> auth.uid() then
    raise exception 'Solo quien la guardó puede publicarla.' using errcode = '42501';
  end if;
  -- Los ids de mazo que tienen forma de id del catálogo, sin repetir, dos
  -- como mucho (los dos de la partida).
  select array_agg(x order by primero) into v_ids
  from (select x, min(o) as primero
          from unnest(coalesce(p_arquetipos, '{}'::text[])) with ordinality as t(x, o)
         where x ~ '^[a-z0-9][a-z0-9-]{0,79}$'
         group by x) s;
  if v_ids is null then
    raise exception 'Ninguno de los dos mazos es de los del meta: no saldría en ninguna ficha.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.replays where user_id = auth.uid() and publica and compartida and id <> p_id) >= 30 then
    raise exception 'Caben 30 partidas publicadas por persona: quita alguna antes.' using errcode = 'P0001';
  end if;
  update public.replays
     set publica = true, compartida = true, arquetipos = v_ids[1:2], publicada_at = coalesce(publicada_at, now())
   where id = p_id;
  return true;
end;
$_$;

--
-- Name: repeticiones_publicas(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.repeticiones_publicas(p_arquetipo text, p_limite integer DEFAULT 12) RETURNS TABLE(id text, titulo text, jugador_a text, jugador_b text, ganador text, turnos integer, mazo_a text, mazo_b text, publicada_at timestamp with time zone, autor text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.id, r.titulo, r.jugador_a, r.jugador_b, r.ganador, r.turnos, r.mazo_a, r.mazo_b, r.publicada_at,
         coalesce(p.display_name, p.username)
  from public.replays r
  left join public.user_profiles p on p.id = r.user_id
  where r.publica and r.compartida and r.arquetipos @> array[p_arquetipo]
  order by r.publicada_at desc nulls last
  limit least(greatest(coalesce(p_limite, 12), 1), 50)
$$;

--
-- Name: repeticiones_resumen(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.repeticiones_resumen(p_id text) RETURNS TABLE(titulo text, jugador_a text, jugador_b text, turnos integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select r.titulo, r.jugador_a, r.jugador_b, r.turnos
  from public.replays r
  where r.id = p_id and r.compartida
$$;

--
-- Name: replays_notas_validas(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replays_notas_validas(n jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select jsonb_typeof(n) = 'array'
     and jsonb_array_length(n) <= 300
     and coalesce((
       select bool_and(
         jsonb_typeof(e) = 'object'
         and jsonb_typeof(e -> 'fila') = 'number'
         and (e ->> 'fila')::numeric between 0 and 100000
         and jsonb_typeof(e -> 'texto') = 'string'
         and char_length(e ->> 'texto') between 1 and 500)
       from jsonb_array_elements(n) e), true)
$$;

--
-- Name: replays_tocar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replays_tocar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  new.id := old.id;
  new.user_id := old.user_id;
  new.registro := old.registro;
  new.created_at := old.created_at;
  return new;
end;
$$;

--
-- Name: replays_tope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.replays_tope() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (select count(*) from public.replays where user_id = new.user_id) >= 500 then
    raise exception 'Has llegado al máximo de 500 repeticiones guardadas. Borra alguna para guardar más.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

--
-- Name: reputacion_de(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reputacion_de(p_user uuid) RETURNS TABLE(hechos bigint, bien bigint, problemas bigint, cambios bigint, ventas bigint, compras bigint, primero timestamp with time zone, ultimo timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: retos_carta_det(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_carta_det(p_id text, p_r jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  g record;
  v_misma boolean;
  v_mismo_nombre boolean;
  v_familia boolean;
  v_nombre text;
  v_ei text;
  v_er text;
  v_fi date;
  v_fr date;
  v_misma_era boolean;
  v_ti text;
  v_tr text;
  v_zi text;
  v_zr text;
  v_ri int;
  v_rr int;
  v_misma_rareza boolean;
begin
  select c.id, c.set_id, c.local_id, c.name, c.dex_ids, c.types, c.rarity, c.rarity_en, s.serie_id, s.release_date
    into g
    from public.tcg_cards c
    left join public.tcg_sets s on s.id = c.set_id and s.market = c.market
   where c.id = p_id and c.market = 'WEST';
  if not found then raise exception 'reto: esa carta no está en el catálogo'; end if;

  v_mismo_nombre := public.retos_clave_nombre(g.name) = public.retos_clave_nombre(p_r->>'name');
  v_misma := g.id = p_r->>'id'
    or (coalesce(g.set_id, '') <> '' and g.set_id = p_r->>'set_id'
        and public.retos_numero_limpio(g.local_id) = public.retos_numero_limpio(p_r->>'local_id')
        and v_mismo_nombre);
  v_familia := coalesce(g.dex_ids && array(select jsonb_array_elements_text(coalesce(p_r->'familia', '[]'::jsonb))::int), false);
  v_nombre := case when v_misma then 'si' when v_mismo_nombre or v_familia then 'casi' else 'no' end;

  v_ei := lower(coalesce(g.serie_id, ''));
  v_er := lower(coalesce(p_r->>'serie_id', ''));
  v_misma_era := v_ei <> '' and v_ei = v_er;
  v_fi := g.release_date;
  v_fr := nullif(left(coalesce(p_r->>'release_date', ''), 10), '')::date;

  v_ti := lower(coalesce(g.types[1], ''));
  v_tr := lower(coalesce(p_r->'types'->>0, ''));

  v_zi := lower(coalesce(nullif(g.rarity_en, ''), nullif(g.rarity, ''), ''));
  v_zr := lower(coalesce(nullif(p_r->>'rarity_en', ''), nullif(p_r->>'rarity', ''), ''));
  v_ri := public.retos_rango_rareza(v_zi);
  v_rr := public.retos_rango_rareza(v_zr);
  v_misma_rareza := v_zi <> '' and v_zi = v_zr;

  return jsonb_build_object(
    'nombre', jsonb_build_object('estado', v_nombre, 'flecha', null)
              || case when v_nombre = 'casi' and v_mismo_nombre then jsonb_build_object('motivo', 'impresion') else '{}'::jsonb end,
    'era', jsonb_build_object(
      'estado', case when v_misma_era then 'si' when v_fi is not null and v_fr is not null and abs(v_fi - v_fr) <= 365 then 'casi' else 'no' end,
      'flecha', case when not v_misma_era and v_fi is not null and v_fr is not null and v_fi <> v_fr then case when v_fr > v_fi then 'nueva' else 'antigua' end end),
    'tipo', jsonb_build_object('estado', case when v_ti <> '' and v_ti = v_tr then 'si' else 'no' end, 'flecha', null),
    'rareza', jsonb_build_object(
      'estado', case when v_misma_rareza then 'si' when v_ri is not null and v_rr is not null and abs(v_ri - v_rr) = 1 then 'casi' else 'no' end,
      'flecha', case when not v_misma_rareza and v_ri is not null and v_rr is not null and v_ri <> v_rr then case when v_rr > v_ri then 'rara' else 'comun' end end)
  );
end;
$$;

--
-- Name: retos_clave_nombre(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_clave_nombre(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select trim(regexp_replace(lower(public.immutable_unaccent(coalesce(p, ''))), '\s+', ' ', 'g'))
$$;

--
-- Name: retos_comunidad(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_comunidad(p_dia date DEFAULT NULL::date) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_dia date := coalesce(p_dia, current_date);
  v_uid uuid := auth.uid();
  v jsonb;
begin
  -- Solo hoy (o un día de margen por los husos): no es un histórico público.
  if v_dia < current_date - 1 or v_dia > current_date + 1 then v_dia := current_date; end if;

  with hoy as (
    select r.user_id, count(*)::int as juegos, sum(r.xp)::int as xp
    from public.retos_resultados r
    where r.day = v_dia
    group by r.user_id
  ),
  orden as (
    select h.user_id, h.juegos,
      h.xp + coalesce((select sum(b.xp) from public.retos_bonos b where b.user_id = h.user_id and b.day = v_dia), 0)::int as total
    from hoy h
  ),
  puestos as (
    select o.*, rank() over (order by o.total desc, o.juegos desc) as puesto from orden o
  ),
  visibles as (
    select p.*, u.username, u.display_name, u.avatar_url
    from puestos p
    join public.user_profiles u on u.id = p.user_id
    where not coalesce(u.retos_oculto, false) and not coalesce(u.hide_activity, false)
  )
  select jsonb_build_object(
    'dia', v_dia,
    'jugadores', (select count(*) from hoy),
    'ayer', (select count(distinct user_id) from public.retos_resultados where day = v_dia - 1),
    'caras', coalesce((select jsonb_agg(jsonb_build_object('username', x.username, 'display_name', x.display_name, 'avatar_url', x.avatar_url) order by x.puesto)
      from (select * from visibles order by puesto, user_id limit 8) x), '[]'::jsonb),
    'ranking', coalesce((select jsonb_agg(jsonb_build_object(
        'puesto', x.puesto, 'username', x.username, 'display_name', x.display_name, 'avatar_url', x.avatar_url,
        'juegos', x.juegos, 'xp', x.total, 'racha', public.retos_racha_de(x.user_id, v_dia), 'tu', x.user_id = v_uid) order by x.puesto)
      from (select * from visibles order by puesto, user_id limit 5) x), '[]'::jsonb),
    'tu', (select jsonb_build_object('puesto', p.puesto, 'juegos', p.juegos, 'xp', p.total, 'username', u.username, 'display_name', u.display_name, 'avatar_url', u.avatar_url)
      from puestos p join public.user_profiles u on u.id = p.user_id where p.user_id = v_uid),
    'oculto', (select retos_oculto from public.user_profiles where id = v_uid),
    'porJuego', coalesce((select jsonb_object_agg(j.juego, jsonb_build_object('jugadores', j.n, 'acertaron', j.a, 'aciertos', j.aciertos, 'total', j.total))
      from (select juego, count(*) as n, count(*) filter (where acertada) as a, sum(aciertos) as aciertos, sum(total) as total
            from public.retos_resultados where day = v_dia group by juego) j), '{}'::jsonb),
    'dias', (select jsonb_agg(jsonb_build_object('dia', d.dia, 'n', (select count(distinct r.user_id) from public.retos_resultados r where r.day = d.dia)) order by d.dia)
      from (select (v_dia - g)::date as dia from generate_series(0, 13) g) d),
    'rachaMax', (select jsonb_build_object('username', z.username, 'display_name', z.display_name, 'avatar_url', z.avatar_url, 'dias', z.racha)
      from (select v.username, v.display_name, v.avatar_url, public.retos_racha_de(v.user_id, v_dia) as racha from visibles v) z
      where z.racha > 1 order by z.racha desc, z.username limit 1)
  ) into v;
  return v;
end;
$$;

--
-- Name: retos_dias_de(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_dias_de(p_user uuid) RETURNS TABLE(day date, juegos integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select d.day, count(distinct d.juego)::int
    from (
      select r.day, r.juego from public.retos_resultados r where r.user_id = p_user
      union
      select c.day, 'reto' from public.daily_challenge_results c where c.user_id = p_user
    ) d
   group by d.day;
$$;

--
-- Name: retos_estadisticas(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_estadisticas(p_juego text, p_dia date) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'jugadores', count(*),
    'acertaron', count(*) filter (where acertada),
    'porIntentos', coalesce((select jsonb_object_agg(i, n) from (select intentos as i, count(*) as n from public.retos_resultados where juego = p_juego and day = p_dia and acertada and intentos is not null group by intentos) x), '{}'::jsonb),
    'porAciertos', coalesce((select jsonb_object_agg(a, n) from (select aciertos as a, count(*) as n from public.retos_resultados where juego = p_juego and day = p_dia group by aciertos) y), '{}'::jsonb)
  )
  from public.retos_resultados
  where juego = p_juego and day = p_dia;
$$;

--
-- Name: retos_estado_inicial(text, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_estado_inicial(p_juego text, p_dia date) RETURNS jsonb
    LANGUAGE sql
    AS $$
  select jsonb_build_object('dia', p_dia::text) || case p_juego
    when 'carta' then jsonb_build_object('intentos', '[]'::jsonb, 'acertada', false)
    when 'caro' then jsonb_build_object('respuestas', '[]'::jsonb)
    when 'silueta' then jsonb_build_object('elegidos', '[]'::jsonb, 'acertada', false)
    when 'ordena' then jsonb_build_object('intentos', '[]'::jsonb, 'acertada', false)
    when 'expansion' then jsonb_build_object('elegidas', '[]'::jsonb, 'tira', '[]'::jsonb)
    -- La mesa de Parejas se baraja POR PARTIDA, aquí: si saliera de la fecha
    -- (como hasta la 1267) estaría en el código de la página.
    when 'parejas' then jsonb_build_object('movimientos', 0, 'hechas', '[]'::jsonb, 'tira', '[]'::jsonb, 'abierta', null,
      'mesa', (select jsonb_agg(x order by random()) from (select g % 6 as x from generate_series(0, 11) g) t))
    else '{}'::jsonb
  end
$$;

--
-- Name: retos_guardar(text, date, integer, integer, integer, boolean, boolean[], jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_guardar(p_juego text, p_dia date, p_aciertos integer DEFAULT 0, p_total integer DEFAULT 0, p_intentos integer DEFAULT NULL::integer, p_acertada boolean DEFAULT false, p_tira boolean[] DEFAULT NULL::boolean[], p_estado jsonb DEFAULT NULL::jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_xp int;
  v_filas int;
  v_total int := null;
  v_juegos_hoy int;
  v_perfecto boolean := false;
  v_racha int;
  v_bono_racha boolean := false;
begin
  if v_uid is null then raise exception 'hay que tener sesión para guardar un reto'; end if;
  -- El día es el UTC del reto; uno de margen a cada lado por los husos.
  if p_dia is null or p_dia < current_date - 1 or p_dia > current_date + 1 then
    raise exception 'ese día no es el de hoy: %', p_dia;
  end if;

  v_xp := public.retos_xp(p_juego, p_aciertos, p_total, p_intentos, p_acertada, p_tira);
  insert into public.retos_resultados (user_id, juego, day, aciertos, total, intentos, acertada, xp, estado)
  values (v_uid, p_juego, p_dia, greatest(0, coalesce(p_aciertos, 0)), greatest(0, coalesce(p_total, 0)), p_intentos, coalesce(p_acertada, false), v_xp,
    case when jsonb_typeof(p_estado) = 'object' and octet_length(p_estado::text) <= 8000 then p_estado end)
  on conflict (user_id, juego, day) do nothing;
  get diagnostics v_filas = row_count;

  -- Ya estaba guardado: ni XP ni bonos otra vez.
  if v_filas = 0 then
    return jsonb_build_object('nuevo', false, 'xp', (select xp from public.retos_resultados where user_id = v_uid and juego = p_juego and day = p_dia));
  end if;

  if v_xp > 0 then v_total := public.xp_sumar(v_xp); end if;

  -- El día perfecto: los seis retos el mismo día.
  select d.juegos into v_juegos_hoy from public.retos_dias_de(p_user => v_uid) d where d.day = p_dia;
  if coalesce(v_juegos_hoy, 0) >= 6 then
    insert into public.retos_bonos (user_id, tipo, day, xp) values (v_uid, 'perfecto', p_dia, 25) on conflict do nothing;
    get diagnostics v_filas = row_count;
    if v_filas > 0 then v_perfecto := true; v_total := public.xp_sumar(25); end if;
  end if;

  -- Cada siete días seguidos, +50 (una vez ese día).
  v_racha := public.retos_racha_de(v_uid, p_dia);
  if v_racha > 0 and v_racha % 7 = 0 then
    insert into public.retos_bonos (user_id, tipo, day, xp) values (v_uid, 'racha7', p_dia, 50) on conflict do nothing;
    get diagnostics v_filas = row_count;
    if v_filas > 0 then v_bono_racha := true; v_total := public.xp_sumar(50); end if;
  end if;

  return jsonb_build_object(
    'nuevo', true, 'xp', v_xp, 'perfecto', v_perfecto, 'xpPerfecto', case when v_perfecto then 25 else 0 end,
    'racha', v_racha, 'bonoRacha', v_bono_racha, 'xpRacha', case when v_bono_racha then 50 else 0 end,
    'juegosHoy', coalesce(v_juegos_hoy, 0), 'totalXp', v_total
  );
end;
$$;

--
-- Name: retos_jugar(text, date, integer, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_jugar(p_juego text, p_dia date, p_libre integer DEFAULT NULL::integer, p_jugada jsonb DEFAULT NULL::jsonb, p_ficha text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'extensions'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_cuenta boolean;
  v_llave text;
  v_datos jsonb;
  v_estado jsonb;
  v_de_ficha jsonb;
  v_r jsonb;
  v_eco jsonb;
  v_guardado jsonb;
  v_fin jsonb;
  v_ficha text;
  v_xp int;
  v_hay boolean;
begin
  if p_juego is null or p_juego not in ('carta', 'caro', 'silueta', 'ordena', 'expansion', 'parejas') then
    raise exception 'reto: juego desconocido';
  end if;
  if p_libre is not null then
    if p_libre < 1 or p_libre > 1000 then raise exception 'reto: esa partida libre no existe'; end if;
    if p_dia is distinct from date '1900-01-01' + p_libre then raise exception 'reto: ese día no es el de la partida libre'; end if;
  elsif p_dia is null or p_dia < current_date - 1 or p_dia > current_date + 1 then
    raise exception 'reto: ese día no es el de hoy';
  end if;
  if p_jugada is not null and octet_length(p_jugada::text) > 2000 then raise exception 'reto: jugada demasiado larga'; end if;
  if p_ficha is not null and octet_length(p_ficha) > 12000 then raise exception 'reto: ficha demasiado larga'; end if;

  select a.datos into v_datos from public.retos_arbitro a where a.juego = p_juego and a.day = p_dia;
  if v_datos is null and p_juego <> 'parejas' then raise exception 'reto: todavía no hay reto para ese día'; end if;
  select l.llave into v_llave from public.retos_llave l where l.id = 1;

  -- La ficha, si viene y es de esta partida.
  if p_ficha is not null and p_ficha <> '' then
    begin
      v_de_ficha := pgp_sym_decrypt(decode(p_ficha, 'base64'), v_llave)::jsonb;
    exception when others then
      v_de_ficha := null;
    end;
    if v_de_ficha is not null and (v_de_ficha->>'j' is distinct from p_juego or v_de_ficha->>'d' is distinct from p_dia::text
       or (v_de_ficha->>'l')::int is distinct from p_libre) then
      v_de_ficha := null;
    end if;
  end if;

  v_cuenta := v_uid is not null and p_libre is null;
  if v_cuenta then
    select p.estado, p.guardado into v_estado, v_guardado from public.retos_partidas p
     where p.user_id = v_uid and p.juego = p_juego and p.day = p_dia for update;
    v_hay := found;
    if not v_hay then
      -- Lo que ya apuntaste hoy antes de la 1268: hecho, y no se vuelve a jugar.
      select r.xp, r.estado into v_xp, v_r from public.retos_resultados r where r.user_id = v_uid and r.juego = p_juego and r.day = p_dia;
      if found then
        v_estado := public.retos_estado_inicial(p_juego, p_dia) || coalesce(v_r, '{}'::jsonb) || '{"cerrada": true}'::jsonb;
        v_guardado := jsonb_build_object('nuevo', false, 'xp', v_xp);
      elsif v_de_ficha is not null and p_juego <> 'parejas' then
        v_estado := v_de_ficha->'e';
      else
        v_estado := public.retos_estado_inicial(p_juego, p_dia);
      end if;
      insert into public.retos_partidas (user_id, juego, day, estado, guardado) values (v_uid, p_juego, p_dia, v_estado, v_guardado);
    end if;
  else
    v_estado := coalesce(v_de_ficha->'e', public.retos_estado_inicial(p_juego, p_dia));
  end if;

  if p_jugada is not null then
    v_r := public.retos_mover(p_juego, v_datos, v_estado, p_jugada);
    v_estado := v_r->'estado';
    v_eco := v_r->'eco';
  end if;

  if v_cuenta then
    -- Acabada y sin apuntar: se apunta aquí, con lo que dice la partida.
    if public.retos_terminada(p_juego, v_datos, v_estado) and v_guardado is null then
      v_fin := public.retos_resultado(p_juego, v_estado);
      begin
        v_guardado := public.retos_guardar(
          p_juego, p_dia, (v_fin->>'aciertos')::int, (v_fin->>'total')::int, (v_fin->>'intentos')::int,
          coalesce((v_fin->>'acertada')::boolean, false),
          case when v_fin ? 'tira' then array(select x.b::boolean from jsonb_array_elements_text(v_fin->'tira') as x(b)) end,
          v_estado - 'mesa' - 'abierta' - 'cerrada');
      exception when others then
        -- Si no se puede apuntar (sin perfil, por ejemplo), la partida
        -- sigue y se volverá a intentar al abrirla.
        v_guardado := null;
        v_eco := coalesce(v_eco, '{}'::jsonb) || jsonb_build_object('sinGuardar', sqlerrm);
      end;
    end if;
    update public.retos_partidas p set estado = v_estado, guardado = v_guardado, updated_at = now()
     where p.user_id = v_uid and p.juego = p_juego and p.day = p_dia;
  else
    v_ficha := translate(encode(pgp_sym_encrypt(jsonb_build_object('j', p_juego, 'd', p_dia::text, 'l', p_libre, 'e', v_estado)::text, v_llave), 'base64'), E'\n', '');
  end if;

  return jsonb_build_object(
    'juego', p_juego,
    'dia', p_dia::text,
    'cuenta', v_cuenta,
    'estado', public.retos_vista(p_juego, v_datos, v_estado),
    'eco', v_eco,
    'ficha', v_ficha,
    'guardado', v_guardado
  );
end;
$$;

--
-- Name: retos_mis_numeros(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_mis_numeros(p_dias integer DEFAULT 60) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_mejor int := 0;
begin
  if v_uid is null then return null; end if;
  select coalesce(max(n), 0) into v_mejor from (
    select count(*) as n from (
      select day, day - (row_number() over (order by day))::int as grupo from public.retos_dias_de(p_user => v_uid)
    ) g group by grupo
  ) islas;
  return jsonb_build_object(
    'dias', coalesce((select jsonb_object_agg(d.day, d.juegos) from public.retos_dias_de(p_user => v_uid) d where d.day > current_date - greatest(1, least(p_dias, 400))), '{}'::jsonb),
    'jugados', coalesce((select count(*) from public.retos_resultados where user_id = v_uid and juego <> 'reto'), 0)
               + coalesce((select count(*) from public.daily_challenge_results where user_id = v_uid), 0),
    'racha', public.retos_racha_de(v_uid, current_date),
    'mejorRacha', v_mejor,
    'diasPerfectos', coalesce((select count(*) from public.retos_bonos where user_id = v_uid and tipo = 'perfecto'), 0),
    'cartaPrimera', coalesce((select count(*) from public.retos_resultados where user_id = v_uid and juego = 'carta' and acertada and intentos = 1), 0),
    'cartaAciertos', coalesce((select count(*) from public.retos_resultados where user_id = v_uid and juego = 'carta' and acertada), 0),
    'caroPerfectos', coalesce((select count(*) from public.retos_resultados where user_id = v_uid and juego = 'caro' and aciertos = 5), 0),
    'xpHoy', coalesce((select sum(xp) from public.retos_resultados where user_id = v_uid and day = current_date), 0)
             + coalesce((select sum(xp) from public.retos_bonos where user_id = v_uid and day = current_date), 0),
    'hoy', coalesce((select jsonb_object_agg(juego, jsonb_build_object('aciertos', aciertos, 'total', total, 'intentos', intentos, 'acertada', acertada, 'xp', xp, 'estado', estado)) from public.retos_resultados where user_id = v_uid and day = current_date), '{}'::jsonb),
    'cartaIntentos', coalesce((select jsonb_object_agg(i, n) from (select intentos as i, count(*) as n from public.retos_resultados where user_id = v_uid and juego = 'carta' and acertada and intentos is not null group by intentos) x), '{}'::jsonb)
  );
end;
$$;

--
-- Name: retos_mover(text, jsonb, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_mover(p_juego text, p_datos jsonb, e jsonb, j jsonb) RETURNS jsonb
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  v_n int;
  v_det jsonb;
  v_bien boolean;
  v_a numeric;
  v_b numeric;
  v_txt text;
  v_dex int;
  v_hueco int;
  v_carta int;
  v_otro int;
  v_pareja boolean;
  v_orden jsonb;
  v_bienes jsonb;
begin
  if public.retos_terminada(p_juego, p_datos, e) then raise exception 'reto: esta partida ya está acabada'; end if;
  if p_juego = 'carta' then
    v_txt := j->>'carta';
    if coalesce(v_txt, '') = '' then raise exception 'reto: falta la carta'; end if;
    v_det := public.retos_carta_det(v_txt, p_datos->'respuesta');
    e := jsonb_set(e, '{intentos}', coalesce(e->'intentos', '[]') || jsonb_build_array(jsonb_build_object('id', v_txt, 'det', v_det)));
    if v_det->'nombre'->>'estado' = 'si' then e := jsonb_set(e, '{acertada}', 'true'); end if;
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('det', v_det));
  elsif p_juego = 'caro' then
    v_txt := j->>'respuesta';
    if v_txt not in ('mas', 'menos') then raise exception 'reto: respuesta desconocida'; end if;
    v_n := jsonb_array_length(coalesce(e->'respuestas', '[]'));
    v_a := (p_datos->'precios'->>v_n)::numeric;
    v_b := (p_datos->'precios'->>(v_n + 1))::numeric;
    if v_a is null or v_b is null then raise exception 'reto: no hay más rondas'; end if;
    v_bien := (v_txt = 'mas' and v_b > v_a) or (v_txt = 'menos' and v_b < v_a);
    e := jsonb_set(e, '{respuestas}', coalesce(e->'respuestas', '[]') || to_jsonb(v_bien));
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('bien', v_bien, 'precio', v_b));
  elsif p_juego = 'silueta' then
    v_dex := (j->>'dex')::int;
    if v_dex is null or not (p_datos->'opciones' @> to_jsonb(v_dex)) then raise exception 'reto: esa opción no está'; end if;
    if coalesce(e->'elegidos', '[]') @> to_jsonb(v_dex) then raise exception 'reto: esa ya la has dicho'; end if;
    v_bien := v_dex = (p_datos->>'buena')::int;
    e := jsonb_set(e, '{elegidos}', coalesce(e->'elegidos', '[]') || to_jsonb(v_dex));
    if v_bien then e := jsonb_set(e, '{acertada}', 'true'); end if;
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('bien', v_bien));
  elsif p_juego = 'ordena' then
    v_orden := j->'orden';
    if jsonb_typeof(v_orden) <> 'array' or jsonb_array_length(v_orden) <> (select count(*) from jsonb_object_keys(p_datos->'precios'))
       or (select count(distinct x.v) from jsonb_array_elements_text(v_orden) as x(v) where p_datos->'precios' ? x.v) <> jsonb_array_length(v_orden) then
      raise exception 'reto: ese orden no vale';
    end if;
    v_bienes := public.retos_ordena_bien(p_datos->'precios', v_orden);
    e := jsonb_set(e, '{intentos}', coalesce(e->'intentos', '[]') || jsonb_build_array(v_orden));
    if not (v_bienes @> '[false]') then e := jsonb_set(e, '{acertada}', 'true'); end if;
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('bien', v_bienes));
  elsif p_juego = 'expansion' then
    v_txt := j->>'set';
    v_n := jsonb_array_length(coalesce(e->'elegidas', '[]'));
    if coalesce(v_txt, '') = '' or (p_datos->'opciones'->v_n is not null and not (p_datos->'opciones'->v_n @> to_jsonb(v_txt))) then
      raise exception 'reto: esa expansión no está entre las de esta carta';
    end if;
    v_bien := v_txt = p_datos->'buenas'->>v_n;
    e := jsonb_set(jsonb_set(e, '{elegidas}', coalesce(e->'elegidas', '[]') || to_jsonb(v_txt)), '{tira}', coalesce(e->'tira', '[]') || to_jsonb(v_bien));
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('bien', v_bien, 'buena', p_datos->'buenas'->>v_n));
  elsif p_juego = 'parejas' then
    v_hueco := (j->>'hueco')::int;
    if v_hueco is null or v_hueco < 0 or v_hueco > 11 then raise exception 'reto: ese hueco no existe'; end if;
    v_carta := (e->'mesa'->>v_hueco)::int;
    if coalesce(e->'hechas', '[]') @> to_jsonb(v_carta) then raise exception 'reto: esa pareja ya está hecha'; end if;
    v_otro := (e->>'abierta')::int;
    if v_otro is null then
      e := jsonb_set(e, '{abierta}', to_jsonb(v_hueco));
      return jsonb_build_object('estado', e, 'eco', jsonb_build_object('hueco', v_hueco, 'carta', v_carta));
    end if;
    if v_otro = v_hueco then raise exception 'reto: esa ya está vuelta'; end if;
    v_pareja := (e->'mesa'->>v_otro)::int = v_carta;
    e := jsonb_set(e, '{abierta}', 'null');
    e := jsonb_set(e, '{movimientos}', to_jsonb(coalesce((e->>'movimientos')::int, 0) + 1));
    e := jsonb_set(e, '{tira}', coalesce(e->'tira', '[]') || to_jsonb(v_pareja));
    if v_pareja then e := jsonb_set(e, '{hechas}', coalesce(e->'hechas', '[]') || to_jsonb(v_carta)); end if;
    return jsonb_build_object('estado', e, 'eco', jsonb_build_object('hueco', v_hueco, 'carta', v_carta, 'otro', v_otro, 'otraCarta', (e->'mesa'->>v_otro)::int, 'pareja', v_pareja));
  end if;
  raise exception 'reto: juego desconocido';
end;
$$;

--
-- Name: retos_numero_limpio(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_numero_limpio(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  select regexp_replace(lower(trim(coalesce(p, ''))), '^0+(?=[0-9])', '')
$$;

--
-- Name: retos_ordena_bien(jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_ordena_bien(p_precios jsonb, p_orden jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$
  with bueno as (
    select x.k, (row_number() over (order by (p_precios->>x.k)::numeric, x.k) - 1)::int as i
      from jsonb_object_keys(p_precios) as x(k)
  )
  select coalesce(jsonb_agg(coalesce(o.v = b.k, false) order by o.n), '[]'::jsonb)
    from jsonb_array_elements_text(p_orden) with ordinality as o(v, n)
    left join bueno b on b.i = o.n - 1
$$;

--
-- Name: retos_racha_de(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_racha_de(p_user uuid, p_hasta date) RETURNS integer
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_dia date := p_hasta;
  v_n int := 0;
begin
  if not exists (select 1 from public.retos_dias_de(p_user => p_user) d where d.day = v_dia) then
    v_dia := v_dia - 1;
  end if;
  while exists (select 1 from public.retos_dias_de(p_user => p_user) d where d.day = v_dia) loop
    v_n := v_n + 1;
    v_dia := v_dia - 1;
    exit when v_n > 3650;
  end loop;
  return v_n;
end;
$$;

--
-- Name: retos_rango_rareza(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_rango_rareza(p text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when r = '' then null
    when r ~ 'mega hyper' then 8
    when r ~ '(special illustration|hyper|rainbow|secret|shining|star|legend|gold)' then 7
    when r ~ '(ultra|illustration|shiny|radiant|amazing|full art|character|trainer gallery)' then 6
    when r ~ '(double|\yex\y|\ygx\y|\yv\y|vmax|vstar|prime|lv\.?x|break|ace)' then 5
    when r ~ 'holo' then 4
    when r ~ 'uncommon' then 2
    when r ~ 'common' then 1
    when r ~ '(rare|promo)' then 3
    else null
  end
  from (select lower(coalesce(p, '')) as r) x
$$;

--
-- Name: retos_resultado(text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_resultado(p_juego text, e jsonb) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$
  select case p_juego
    when 'carta' then jsonb_build_object('aciertos', case when (e->>'acertada')::boolean then 1 else 0 end, 'total', 1,
      'intentos', jsonb_array_length(coalesce(e->'intentos', '[]')), 'acertada', coalesce((e->>'acertada')::boolean, false))
    when 'caro' then jsonb_build_object('aciertos', (select count(*) from jsonb_array_elements(coalesce(e->'respuestas', '[]')) as x(b) where x.b = 'true'::jsonb),
      'total', 5, 'acertada', false, 'tira', coalesce(e->'respuestas', '[]'))
    when 'silueta' then jsonb_build_object('aciertos', case when (e->>'acertada')::boolean then 1 else 0 end, 'total', 1,
      'intentos', jsonb_array_length(coalesce(e->'elegidos', '[]')), 'acertada', coalesce((e->>'acertada')::boolean, false))
    when 'ordena' then jsonb_build_object('aciertos', case when (e->>'acertada')::boolean then 1 else 0 end, 'total', 1,
      'intentos', jsonb_array_length(coalesce(e->'intentos', '[]')), 'acertada', coalesce((e->>'acertada')::boolean, false))
    when 'expansion' then jsonb_build_object('aciertos', (select count(*) from jsonb_array_elements(coalesce(e->'tira', '[]')) as x(b) where x.b = 'true'::jsonb),
      'total', 5, 'acertada', false, 'tira', coalesce(e->'tira', '[]'))
    when 'parejas' then jsonb_build_object('aciertos', 6, 'total', 6, 'intentos', coalesce((e->>'movimientos')::int, 0), 'acertada', true, 'tira', coalesce(e->'tira', '[]'))
  end
$$;

--
-- Name: retos_terminada(text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_terminada(p_juego text, p_datos jsonb, e jsonb) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce((e->>'cerrada')::boolean, false) or case p_juego
    when 'carta' then coalesce((e->>'acertada')::boolean, false) or jsonb_array_length(coalesce(e->'intentos', '[]')) >= 6
    when 'caro' then jsonb_array_length(coalesce(e->'respuestas', '[]')) >= 5
    when 'silueta' then coalesce((e->>'acertada')::boolean, false)
      or jsonb_array_length(coalesce(e->'elegidos', '[]')) - case when coalesce((e->>'acertada')::boolean, false) then 1 else 0 end >= 3
    when 'ordena' then coalesce((e->>'acertada')::boolean, false) or jsonb_array_length(coalesce(e->'intentos', '[]')) >= 3
    when 'expansion' then jsonb_array_length(coalesce(e->'elegidas', '[]')) >= 5
    when 'parejas' then jsonb_array_length(coalesce(e->'hechas', '[]')) >= 6
    else false
  end
$$;

--
-- Name: retos_vista(text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_vista(p_juego text, p_datos jsonb, e jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
declare
  v_fin boolean := public.retos_terminada(p_juego, p_datos, e);
  v_n int;
  v_pub jsonb := e - 'mesa' - 'abierta' - 'cerrada';
  v_pistas jsonb := '{}'::jsonb;
  v_k text;
  v_i int := 0;
begin
  if p_juego = 'carta' then
    v_n := jsonb_array_length(coalesce(e->'intentos', '[]'));
    foreach v_k in array array['era', 'tipo', 'rareza', 'ilustrador', 'inicial'] loop
      exit when not v_fin and v_i >= v_n;
      v_pistas := v_pistas || jsonb_build_object(v_k, p_datos->'pistas'->v_k);
      v_i := v_i + 1;
    end loop;
    return v_pub || jsonb_build_object('terminada', v_fin, 'pistas', v_pistas,
      'foto', case when v_fin then null else p_datos->'fotos'->>least(v_n, 5) end,
      'respuesta', case when v_fin then p_datos->'respuesta'->>'id' end);
  elsif p_juego = 'caro' then
    v_n := jsonb_array_length(coalesce(e->'respuestas', '[]'));
    return v_pub || jsonb_build_object('terminada', v_fin,
      'precios', (select coalesce(jsonb_agg(p order by i), '[]'::jsonb) from jsonb_array_elements(p_datos->'precios') with ordinality as x(p, i) where i <= v_n + 1));
  elsif p_juego = 'silueta' then
    v_n := jsonb_array_length(coalesce(e->'elegidos', '[]')) - case when coalesce((e->>'acertada')::boolean, false) then 1 else 0 end;
    return v_pub || jsonb_build_object('terminada', v_fin,
      'foto', case when v_fin then null else p_datos->'fotos'->>least(v_n, 2) end,
      'buena', case when v_fin then (p_datos->>'buena')::int end);
  elsif p_juego = 'ordena' then
    return v_pub || jsonb_build_object('terminada', v_fin,
      'bien', (select coalesce(jsonb_agg(public.retos_ordena_bien(p_datos->'precios', o) order by i), '[]'::jsonb) from jsonb_array_elements(coalesce(e->'intentos', '[]')) with ordinality as x(o, i)),
      'precios', case when v_fin then p_datos->'precios' end);
  elsif p_juego = 'expansion' then
    v_n := jsonb_array_length(coalesce(e->'elegidas', '[]'));
    return v_pub || jsonb_build_object('terminada', v_fin,
      'buenas', (select coalesce(jsonb_agg(b order by i), '[]'::jsonb) from jsonb_array_elements(coalesce(p_datos->'buenas', '[]')) with ordinality as x(b, i) where i <= v_n));
  elsif p_juego = 'parejas' then
    return v_pub || jsonb_build_object('terminada', v_fin,
      -- Las que ya están hechas, en su hueco (para volver a la mesa a medias).
      'descubiertas', (select coalesce(jsonb_object_agg(h - 1, c), '{}'::jsonb) from jsonb_array_elements(coalesce(e->'mesa', '[]')) with ordinality as x(c, h) where coalesce(e->'hechas', '[]') @> c),
      'abierta', case when e->>'abierta' is not null then jsonb_build_object('hueco', (e->>'abierta')::int, 'carta', (e->'mesa'->>((e->>'abierta')::int))::int) end);
  end if;
  return v_pub || jsonb_build_object('terminada', v_fin);
end;
$$;

--
-- Name: retos_xp(text, integer, integer, integer, boolean, boolean[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.retos_xp(p_juego text, p_aciertos integer, p_total integer, p_intentos integer, p_acertada boolean, p_tira boolean[] DEFAULT NULL::boolean[]) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
declare
  v_puntos int := 0;
  v_racha int := 0;
  v_i int;
begin
  if p_juego = 'reto' then
    -- El de preguntas ya daba su XP en curso.js: aquí no cobra dos veces.
    return 0;
  elsif p_juego = 'carta' then
    if not coalesce(p_acertada, false) then return 5; end if;
    return case coalesce(p_intentos, 6) when 1 then 50 when 2 then 45 when 3 then 40 when 4 then 30 when 5 then 20 else 15 end;
  elsif p_juego = 'caro' then
    if p_tira is null then return least(30, greatest(0, coalesce(p_aciertos, 0)) * 3); end if;
    for v_i in 1 .. least(coalesce(array_length(p_tira, 1), 0), 5) loop
      if p_tira[v_i] then
        v_racha := v_racha + 1;
        v_puntos := v_puntos + case when v_racha >= 3 then 6 else 3 end;
      else
        v_racha := 0;
      end if;
    end loop;
    if coalesce(array_length(p_tira, 1), 0) = 5 and not (false = any (p_tira)) then v_puntos := v_puntos + 6; end if;
    return least(30, v_puntos);
  elsif p_juego = 'silueta' then
    if not coalesce(p_acertada, false) then return 0; end if;
    -- 991: el primer intento va borroso, así que vale más.
    return case coalesce(p_intentos, 3) when 1 then 30 when 2 then 20 else 10 end;
  elsif p_juego = 'ordena' then
    if not coalesce(p_acertada, false) then return 2; end if;
    return case coalesce(p_intentos, 3) when 1 then 25 when 2 then 15 else 8 end;
  elsif p_juego = 'expansion' then
    return least(5, greatest(0, coalesce(p_aciertos, 0))) * 4;
  elsif p_juego = 'parejas' then
    -- Siempre se acaba: lo que cuenta son los movimientos.
    return case
      when coalesce(p_intentos, 99) <= 7 then 30
      when p_intentos <= 10 then 20
      when p_intentos <= 14 then 10
      else 5
    end;
  end if;
  return 0;
end;
$$;

--
-- Name: sesion_cumple_mfa(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sesion_cumple_mfa() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f
                     where f.user_id = auth.uid() and f.status::text = 'verified')
$$;

--
-- Name: sin_freno(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sin_freno() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select auth.uid() is null
      or coalesce(public.is_admin(), false)
      or exists (select 1 from public.user_profiles p where p.id = auth.uid() and coalesce(p.is_moderator, false))
$$;

--
-- Name: tcg_card_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_card_prices (
    card_id text NOT NULL,
    cm_id_product integer,
    cm_low numeric(10,2),
    cm_trend numeric(10,2),
    cm_avg30 numeric(10,2),
    cm_avg7 numeric(10,2),
    cm_low_holo numeric(10,2),
    cm_trend_holo numeric(10,2),
    cm_avg30_holo numeric(10,2),
    cm_updated timestamp with time zone,
    checked_at timestamp with time zone DEFAULT now() NOT NULL,
    cm_url text,
    origen text,
    tp_normal_market numeric(10,2),
    tp_normal_low numeric(10,2),
    tp_holo_market numeric(10,2),
    tp_holo_low numeric(10,2),
    tp_reverse_market numeric(10,2),
    tp_reverse_low numeric(10,2),
    tp_primera_market numeric(10,2),
    tp_primera_low numeric(10,2),
    tp_updated timestamp with time zone,
    cm_low_en numeric(10,2),
    cm_low_de numeric(10,2),
    cm_low_fr numeric(10,2),
    cm_low_es numeric(10,2),
    cm_low_it numeric(10,2),
    cm_disponibles integer,
    tp_market_eur numeric(10,2),
    tp_mid_eur numeric(10,2),
    cm_gradeadas jsonb,
    ebay_gradeadas jsonb,
    tcggo_id integer,
    tcggo_updated timestamp with time zone,
    cm_low_ja numeric(10,2),
    historial_at timestamp with time zone,
    cm_low_ko numeric(10,2),
    cm_low_zh numeric(10,2)
);

--
-- Name: user_collection; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_collection (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    card_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    idioma text DEFAULT 'es'::text NOT NULL,
    estado text DEFAULT 'NM'::text NOT NULL,
    variante text DEFAULT 'normal'::text NOT NULL,
    cantidad integer DEFAULT 1 NOT NULL,
    gradeo text,
    valor_manual numeric(10,2),
    precio_compra numeric(10,2),
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cambio integer DEFAULT 0 NOT NULL,
    CONSTRAINT user_collection_cambio CHECK (((cambio >= 0) AND (cambio <= 999))),
    CONSTRAINT user_collection_cantidad CHECK (((cantidad >= 1) AND (cantidad <= 999))),
    CONSTRAINT user_collection_compra CHECK (((precio_compra IS NULL) OR (precio_compra >= (0)::numeric))),
    CONSTRAINT user_collection_estado CHECK ((estado = ANY (ARRAY['MT'::text, 'NM'::text, 'EX'::text, 'GD'::text, 'LP'::text, 'PL'::text, 'PO'::text]))),
    CONSTRAINT user_collection_gradeo CHECK (((gradeo IS NULL) OR ((char_length(gradeo) >= 1) AND (char_length(gradeo) <= 20)))),
    CONSTRAINT user_collection_idioma CHECK ((idioma = ANY (ARRAY['es'::text, 'en'::text, 'fr'::text, 'de'::text, 'it'::text, 'pt'::text, 'nl'::text, 'ja'::text, 'ko'::text, 'zh'::text]))),
    CONSTRAINT user_collection_notas CHECK (((notas IS NULL) OR (char_length(notas) <= 280))),
    CONSTRAINT user_collection_valor CHECK (((valor_manual IS NULL) OR (valor_manual >= (0)::numeric))),
    CONSTRAINT user_collection_variante CHECK (((variante ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND ((length(variante) >= 1) AND (length(variante) <= 40))))
);

--
-- Name: sin_precio(public.user_collection, public.tcg_card_prices); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sin_precio(c public.user_collection, pr public.tcg_card_prices) RETURNS boolean
    LANGUAGE sql STABLE
    AS $$
  select coalesce((c).valor_manual, 0) = 0
     and public.valor_gradeado((c).gradeo, (pr).cm_gradeadas, (pr).ebay_gradeadas) is null
     and coalesce((pr).cm_low_es, (pr).cm_low_en, (pr).cm_low_de, (pr).cm_low_fr, (pr).cm_low_it, (pr).cm_low_ja, 0) = 0
     and coalesce((pr).cm_trend, (pr).cm_avg30, (pr).cm_low, 0) = 0
     and coalesce((pr).tp_market_eur, 0) = 0
     and coalesce((pr).tp_normal_market, (pr).tp_normal_low, (pr).tp_holo_market, (pr).tp_holo_low, (pr).tp_reverse_market, (pr).tp_reverse_low, (pr).tp_primera_market, (pr).tp_primera_low, 0) = 0
$$;

--
-- Name: sobre_cifras(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sobre_cifras() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'personas', (select count(*) from public.user_profiles p
                  where coalesce(p.tipo, 'persona') <> 'tienda'
                    and not coalesce(p.is_banned, false)),
    'cartas',   (select coalesce(sum(c.cantidad), 0) from public.user_collection c),
    'temas',    (select count(*) from public.forum_threads),
    'torneos',  (select count(*) from public.tournaments t where t.status = 'finished'),
    'equipo',   coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', p.id,
               'username', p.username,
               'display_name', p.display_name,
               'avatar_url', p.avatar_url,
               'is_admin', coalesce(p.is_admin, false),
               'is_moderator', coalesce(p.is_moderator, false),
               'is_writer', coalesce(p.is_writer, false)
             ) order by coalesce(p.is_admin, false) desc,
                        coalesce(p.is_moderator, false) desc,
                        p.created_at)
        from public.user_profiles p
       where (coalesce(p.is_admin, false) or coalesce(p.is_moderator, false) or coalesce(p.is_writer, false))
         and coalesce(p.tipo, 'persona') <> 'tienda'
         and not coalesce(p.is_banned, false)
    ), '[]'::jsonb)
  )
$$;

--
-- Name: solo_admin_da_titulos(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.solo_admin_da_titulos() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if auth.uid() is not null and not public.is_admin() then
    new.forum_title := old.forum_title;
    new.is_moderator := old.is_moderator;
    new.is_admin := old.is_admin;
    new.is_tournament_admin := coalesce(old.is_tournament_admin, false);
    new.is_news_writer := coalesce(old.is_news_writer, false);
    new.is_writer := coalesce(old.is_writer, false);
  end if;
  return new;
end;
$$;

--
-- Name: soy_redactor(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soy_redactor() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid()
      and (p.is_admin or coalesce(p.is_writer, false))
  )
$$;

--
-- Name: soy_redactor_de_noticias(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soy_redactor_de_noticias() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = auth.uid()
      and (p.is_admin or coalesce(p.is_news_writer, false) or coalesce(p.is_writer, false))
  )
$$;

--
-- Name: soy_tienda(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.soy_tienda() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from user_profiles where id = auth.uid() and tipo = 'tienda')
$$;

--
-- Name: tcggo_crear_sets(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tcggo_crear_sets(p_sets jsonb, p_market text DEFAULT 'WEST'::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_filas int;
begin
  insert into public.tcg_sets (id, market, name, name_en, tcg_online_code, release_date, card_count_total, card_count_official, serie_id, serie_name, serie_name_en, logo_tcggo, tcggo_id, origen)
  select p.id, p_market, coalesce(p.name, p.id), p.name_en, p.tcg_online_code, p.release_date, nullif(p.card_count_total, 0), nullif(p.card_count_official, 0), p.serie_id, p.serie_name, p.serie_name_en, p.logo_tcggo, p.tcggo_id, 'tcggo'
    from jsonb_to_recordset(p_sets) as p(id text, name text, name_en text, tcg_online_code text, release_date date, card_count_total int, card_count_official int, serie_id text, serie_name text, serie_name_en text, logo_tcggo text, tcggo_id int)
  on conflict (id, market) do nothing;
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

--
-- Name: tcggo_guardar_cartas(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tcggo_guardar_cartas(p_cartas jsonb, p_market text DEFAULT 'WEST'::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_filas int;
begin
  insert into public.tcg_cards (id, market, set_id, local_id, name, name_en, tcggo_id, image_tcggo, cm_id_product_propio, tp_id_product_propio, cm_por, cm_emparejado_at, rarity_en, hp, illustrator, category, origen, tcggo_at, detalle_at, detalle_lang)
  select p.id, p_market, p.set_id, coalesce(p.local_id, ''), coalesce(p.name, p.id), p.name_en, p.tcggo_id, p.image_tcggo,
         p.cm_id_product, p.tp_id_product, case when p.cm_id_product is not null then 'tcggo' end, case when p.cm_id_product is not null then now() end,
         p.rarity_en, p.hp, p.illustrator, p.category, 'tcggo', now(), now(), 'tcggo'
    from jsonb_to_recordset(p_cartas) as p(id text, set_id text, local_id text, name text, name_en text, tcggo_id int, image_tcggo text, cm_id_product int, tp_id_product int, rarity_en text, hp int, illustrator text, category text)
  on conflict (id, market) do update
    set tcggo_id = excluded.tcggo_id,
        image_tcggo = coalesce(excluded.image_tcggo, tcg_cards.image_tcggo),
        cm_id_product_propio = coalesce(tcg_cards.cm_id_product_propio, excluded.cm_id_product_propio),
        tp_id_product_propio = coalesce(tcg_cards.tp_id_product_propio, excluded.tp_id_product_propio),
        cm_por = case when tcg_cards.cm_id_product_propio is null and excluded.cm_id_product_propio is not null then 'tcggo' else tcg_cards.cm_por end,
        cm_emparejado_at = case when tcg_cards.cm_id_product_propio is null and excluded.cm_id_product_propio is not null then now() else tcg_cards.cm_emparejado_at end,
        rarity_en = coalesce(excluded.rarity_en, tcg_cards.rarity_en),
        hp = coalesce(excluded.hp, tcg_cards.hp),
        illustrator = coalesce(excluded.illustrator, tcg_cards.illustrator),
        name_en = coalesce(tcg_cards.name_en, excluded.name_en),
        category = coalesce(tcg_cards.category, excluded.category),
        tcggo_at = now();
  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

--
-- Name: tcggo_guardar_sets(jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tcggo_guardar_sets(p_sets jsonb, p_market text DEFAULT 'WEST'::text) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_filas int;
begin
  update public.tcg_sets s
     set logo_tcggo = coalesce(nullif(p.logo, ''), s.logo_tcggo),
         -- El símbolo, como el logo: el de TCGGO cuando lo da.
         symbol_tcggo = coalesce(nullif(p.simbolo, ''), s.symbol_tcggo),
         tcggo_id = coalesce(p.tcggo_id, s.tcggo_id),
         release_date = coalesce(s.release_date, p.fecha),
         card_count_total = coalesce(s.card_count_total, nullif(p.cartas, 0)),
         card_count_official = coalesce(s.card_count_official, nullif(p.impresas, 0))
    from jsonb_to_recordset(p_sets) as p(id text, tcggo_id int, logo text, simbolo text, fecha date, cartas int, impresas int)
   where s.id = p.id and s.market = p_market;
  get diagnostics v_filas = row_count;

  insert into public.tcg_set_valor (set_id, market, dia, valor_cm, valor_tp)
  select p.id, p_market, current_date, nullif(p.valor_cm, 0), nullif(p.valor_tp, 0)
    from jsonb_to_recordset(p_sets) as p(id text, valor_cm numeric, valor_tp numeric)
   where (p.valor_cm is not null or p.valor_tp is not null)
     and exists (select 1 from public.tcg_sets s where s.id = p.id and s.market = p_market)
  on conflict (set_id, market, dia) do update
    set valor_cm = excluded.valor_cm,
        valor_tp = excluded.valor_tp;

  return v_filas;
end;
$$;

--
-- Name: tienda_alta(uuid, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_alta(p_token uuid, p_username text, p_nombre text, p_ciudad text DEFAULT NULL::text, p_direccion text DEFAULT NULL::text, p_web text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_uid uuid := auth.uid();
  v_email text := lower(coalesce(auth.email(), ''));
  v tienda_solicitudes%rowtype;
  v_user text := lower(btrim(coalesce(p_username, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_perfil user_profiles%rowtype;
begin
  if v_uid is null then
    raise exception 'Entra con la cuenta de la tienda para terminar el alta.' using errcode = '42501';
  end if;
  select * into v from tienda_solicitudes where token = p_token for update;
  if not found or v.estado <> 'aceptada' or v.usada_el is not null then
    raise exception 'Esta invitación ya no vale. Pide otra desde /tiendas.' using errcode = '22023';
  end if;
  if v.caduca < now() then
    raise exception 'Esta invitación ha caducado. Escríbenos y te mandamos otra.' using errcode = '22023';
  end if;
  if lower(v.email) <> v_email then
    raise exception 'Has entrado con otro email. La invitación es para %.', v.email using errcode = '42501';
  end if;
  if v_user !~ '^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$' then
    raise exception 'Tu @ solo puede llevar letras, números y guiones (de 3 a 40).' using errcode = '22023';
  end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'Escribe el nombre de la tienda.' using errcode = '22023';
  end if;
  if exists (select 1 from user_profiles where lower(username) = v_user and id <> v_uid) then
    raise exception 'Ese @ ya lo tiene otra cuenta. Prueba con otro.' using errcode = '23505';
  end if;

  select * into v_perfil from user_profiles where id = v_uid;
  if found and v_perfil.tipo = 'persona' and v_perfil.onboarding_completed is true then
    raise exception 'Este email ya tiene una cuenta personal en PokeDoc. Pide la tienda con el email de la tienda.' using errcode = '22023';
  end if;

  insert into user_profiles (id, username, display_name, tipo, onboarding_completed)
  values (v_uid, v_user, v_nombre, 'tienda', true)
  on conflict (id) do update
    set username = excluded.username, display_name = excluded.display_name,
        tipo = 'tienda', onboarding_completed = true;

  -- La ciudad que se deja vacía en el alta se queda vacía (1074): es
  -- opcional, y la de la solicitud solo rellena el formulario.
  insert into tiendas (user_id, ciudad, direccion, web, instagram)
  values (
    v_uid,
    nullif(left(btrim(coalesce(p_ciudad, '')), 80), ''),
    nullif(left(btrim(coalesce(p_direccion, '')), 160), ''),
    nullif(left(btrim(coalesce(p_web, '')), 160), ''),
    v.instagram
  )
  on conflict (user_id) do update
    set ciudad = excluded.ciudad, direccion = excluded.direccion, web = excluded.web,
        instagram = excluded.instagram, updated_at = now();

  update tienda_solicitudes set estado = 'usada', usada_el = now(), usada_por = v_uid where id = v.id;

  return jsonb_build_object('ok', true, 'username', v_user);
end;
$_$;

--
-- Name: tienda_apartar(uuid, integer, text, timestamp with time zone, numeric, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_apartar(p_stock uuid, p_unidades integer, p_para text, p_hasta timestamp with time zone, p_precio numeric DEFAULT NULL::numeric, p_nota text DEFAULT NULL::text, p_para_usuario uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_stock tienda_stock%rowtype;
  v_para text := nullif(btrim(coalesce(p_para, '')), '');
  v_id uuid;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda aparta.' using errcode = '42501';
  end if;
  if v_para is null then
    raise exception 'Di para quién es.' using errcode = '22023';
  end if;
  if p_unidades is null or p_unidades < 1 then
    raise exception 'Aparta al menos una.' using errcode = '22023';
  end if;
  if p_hasta is null or p_hasta <= now() then
    raise exception 'El día tiene que ser de aquí en adelante.' using errcode = '22023';
  end if;
  if p_hasta > now() + interval '60 days' then
    raise exception 'Como mucho, dos meses.' using errcode = '22023';
  end if;
  if p_precio is not null and p_precio < 0 then
    raise exception 'Revisa el precio.' using errcode = '22023';
  end if;
  -- Bloqueada: dos apartados (o un apartado y una venta) de la última copia.
  select * into v_stock from tienda_stock where id = p_stock and tienda_id = v_uid for update;
  if not found then
    raise exception 'Esa carta ya no está en tu stock.' using errcode = 'P0002';
  end if;
  if v_stock.unidades < p_unidades then
    raise exception 'No quedan tantas: hay %.', v_stock.unidades using errcode = '22023';
  end if;
  update tienda_stock set unidades = unidades - p_unidades, updated_at = now() where id = v_stock.id;
  insert into tienda_reservas (tienda_id, stock_id, unidades, precio, para, para_usuario, nota, hasta)
  values (v_uid, v_stock.id, p_unidades,
    round(coalesce(p_precio, public.tienda_precio_de(v_stock.precio, v_stock.oferta_precio, v_stock.oferta_hasta)), 2),
    left(v_para, 80), p_para_usuario, nullif(left(btrim(coalesce(p_nota, '')), 200), ''), p_hasta)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'quedan', v_stock.unidades - p_unidades);
end;
$$;

--
-- Name: tienda_apuntar_valor(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_apuntar_valor(p_zona text DEFAULT 'Europe/Madrid'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_fila tienda_valor_diario%rowtype;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda tiene stock.' using errcode = '42501';
  end if;
  insert into tienda_valor_diario (tienda_id, dia, lineas, unidades, valor, cm, coste)
  select v_uid, (now() at time zone coalesce(p_zona, 'Europe/Madrid'))::date,
    count(*), coalesce(sum(x.unidades), 0),
    coalesce(round(sum(x.precio * x.unidades), 2), 0),
    coalesce(round(sum(x.cm * x.unidades), 2), 0),
    coalesce(round(sum(x.coste * x.unidades), 2), 0)
  from (
    select s.unidades, s.coste, public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) as precio,
      case
        when s.product_id is not null then (select coalesce(p.cm_lowest_es, p.cm_lowest_eu, p.cm_lowest) from tcg_products p where p.id = s.product_id)
        else public.valor_de_copia(
          jsonb_populate_record(null::public.user_collection, jsonb_build_object('cantidad', 1, 'variante', s.variante, 'idioma', s.idioma, 'gradeo', s.gradeo)),
          pr)
      end as cm
    from tienda_stock s
    left join tcg_card_prices pr on pr.card_id = s.card_id
    where s.tienda_id = v_uid and s.unidades > 0
  ) x
  on conflict (tienda_id, dia) do update
    set lineas = excluded.lineas, unidades = excluded.unidades, valor = excluded.valor, cm = excluded.cm, coste = excluded.coste
  returning * into v_fila;
  return to_jsonb(v_fila);
end;
$$;

--
-- Name: tienda_avisar(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_avisar(p_card text, p_market text DEFAULT 'WEST'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_market text := coalesce(nullif(p_market, ''), 'WEST');
  v_tienda text;
  v_usuario text;
  v_carta text;
  v_precio numeric;
  v_quien uuid[];
begin
  if v_uid is null or not public.soy_tienda() then
    raise exception 'Solo una tienda' using errcode = '42501';
  end if;
  if not exists (select 1 from tienda_stock s where s.tienda_id = v_uid and s.card_id = p_card and s.market = v_market and s.unidades > 0 and s.visible) then
    raise exception 'Esa carta no está a la vista en tu escaparate' using errcode = 'P0001';
  end if;

  select array_agg(user_id) into v_quien from public.tienda_por_avisar(v_uid, p_card, v_market);
  if v_quien is null then
    return jsonb_build_object('avisadas', 0,
      'antes', (select count(*) from tienda_avisos a where a.tienda_id = v_uid and a.card_id = p_card and a.market = v_market));
  end if;

  select coalesce(nullif(u.display_name, ''), u.username, 'Una tienda'), u.username into v_tienda, v_usuario
    from user_profiles u where u.id = v_uid;
  select coalesce(c.name_es, c.name) into v_carta from tcg_cards c where c.id = p_card and c.market = v_market;
  select min(public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta)) into v_precio
    from tienda_stock s
    join tiendas t on t.user_id = s.tienda_id
    where s.tienda_id = v_uid and s.card_id = p_card and s.market = v_market and s.unidades > 0 and s.visible
      and coalesce(t.precio_visible, true);

  insert into tienda_avisos (tienda_id, card_id, market, user_id)
    select v_uid, p_card, v_market, q from unnest(v_quien) q
    on conflict do nothing;

  insert into user_notifications (recipient_id, type, title, body, link)
    select q, 'tienda_la_tiene',
      left(v_tienda || ' tiene ' || coalesce(v_carta, 'una carta que buscas'), 200),
      'Está en tu lista de «La quiero».' ||
        case when v_precio is not null then ' Desde ' || replace(to_char(v_precio, 'FM9999990.00'), '.', ',') || ' €.' else '' end,
      case when v_usuario is not null then '/usuario/' || v_usuario || '?carta=' || p_card else null end
    from unnest(v_quien) q;

  return jsonb_build_object('avisadas', cardinality(v_quien),
    'antes', (select count(*) from tienda_avisos a where a.tienda_id = v_uid and a.card_id = p_card and a.market = v_market) - cardinality(v_quien));
end;
$$;

--
-- Name: tienda_avisos_de(jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_avisos_de(p_cartas jsonb) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not public.soy_tienda() then
    raise exception 'Solo una tienda' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'card_id', c.card_id, 'market', c.market,
      'pendientes', (select count(*) from public.tienda_por_avisar(v_uid, c.card_id, c.market)),
      'avisadas', (select count(*) from tienda_avisos a where a.tienda_id = v_uid and a.card_id = c.card_id and a.market = c.market),
      'ultimo', (select max(a.avisado_el) from tienda_avisos a where a.tienda_id = v_uid and a.card_id = c.card_id and a.market = c.market))), '[]'::jsonb)
    from (
      select distinct x->>'card_id' as card_id, coalesce(x->>'market', 'WEST') as market
      from jsonb_array_elements(coalesce(p_cartas, '[]'::jsonb)) x
      where coalesce(x->>'card_id', '') <> ''
      limit 50
    ) c
  );
end;
$$;

--
-- Name: tienda_cambio(jsonb, jsonb, text, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_cambio(p_te_da jsonb, p_le_das jsonb, p_pago text DEFAULT NULL::text, p_cliente text DEFAULT NULL::text, p_donde text DEFAULT 'mostrador'::text, p_pct integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_pago text := nullif(btrim(coalesce(p_pago, '')), '');
  v_venta jsonb;
  v_compra jsonb;
  v_entregado numeric;
  v_recibido numeric;
  v_dif numeric;
  v_id uuid;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda hace cambios.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_te_da) <> 'array' or jsonb_array_length(p_te_da) = 0 then
    raise exception 'Falta lo que te da: sin eso es una venta.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_le_das) <> 'array' or jsonb_array_length(p_le_das) = 0 then
    raise exception 'Falta lo que le das: sin eso es una compra.' using errcode = '22023';
  end if;
  if p_pct is not null and (p_pct < 0 or p_pct > 200) then
    raise exception 'Revisa el tanto por ciento.' using errcode = '22023';
  end if;

  -- Las dos mitades, con sus comprobaciones de siempre (stock, catálogo,
  -- precios): si una falla, no se hace nada.
  v_venta := public.tienda_vender(p_le_das, coalesce(p_donde, 'mostrador'), null);
  v_compra := public.tienda_comprar(p_te_da, p_cliente, null);
  v_entregado := round((v_venta->>'total')::numeric, 2);
  v_recibido := round((v_compra->>'total')::numeric, 2);
  v_dif := v_entregado - v_recibido;

  if v_dif = 0 then
    v_pago := null;
  elsif v_pago is null then
    raise exception 'Falta cómo se paga la diferencia.' using errcode = '22023';
  elsif v_dif > 0 and v_pago not in ('efectivo', 'tarjeta', 'bizum', 'paypal') then
    raise exception 'Esa forma de pago no existe para lo que te paga.' using errcode = '22023';
  elsif v_dif < 0 and v_pago not in ('efectivo', 'bizum', 'paypal', 'otro') then
    raise exception 'Esa forma de pago no existe para lo que le pagas.' using errcode = '22023';
  end if;

  update tienda_ventas set pago = 'cambio' where ticket = (v_venta->>'ticket')::uuid and tienda_id = v_uid;
  update tienda_compras set pago = 'cambio' where ticket = (v_compra->>'ticket')::uuid and tienda_id = v_uid;
  insert into tienda_cambios (tienda_id, venta_ticket, compra_ticket, entregado, recibido, diferencia, pago, pct, cliente)
  values (v_uid, (v_venta->>'ticket')::uuid, (v_compra->>'ticket')::uuid, v_entregado, v_recibido, v_dif, v_pago, p_pct,
    nullif(btrim(coalesce(p_cliente, '')), ''))
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'venta_ticket', v_venta->'ticket', 'compra_ticket', v_compra->'ticket',
    'entregado', v_entregado, 'recibido', v_recibido, 'diferencia', v_dif, 'pago', v_pago,
    'unidades_dadas', (select coalesce(sum((l->>'unidades')::int), 0) from jsonb_array_elements(p_le_das) l),
    'unidades_recibidas', (v_compra->>'unidades')::int);
end;
$$;

--
-- Name: tienda_cifras(timestamp with time zone, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_cifras(p_desde timestamp with time zone, p_hasta timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda tiene cifras.' using errcode = '42501';
  end if;

  with
  ventas as (
    select v.card_id, v.market, v.product_id, v.unidades, v.precio * v.unidades as importe,
      case when v.coste is not null then (v.precio - v.coste) * v.unidades end as beneficio,
      c.set_id, c.local_id as numero, coalesce(c.name_es, c.name, p.name) as nombre
    from tienda_ventas v
    left join tcg_cards c on c.id = v.card_id and c.market = v.market
    left join tcg_products p on p.id = v.product_id
    where v.tienda_id = v_uid and v.vendida_el >= p_desde and v.vendida_el < p_hasta
  ),
  por_carta as (
    select card_id, market, product_id, max(nombre) as nombre, max(set_id) as set_id, max(numero) as numero,
      sum(unidades) as unidades, sum(importe) as importe, sum(beneficio) as beneficio
    from ventas group by card_id, market, product_id
  ),
  por_set as (
    select v.set_id, v.market, max(st.name) as nombre, sum(v.unidades) as unidades, sum(v.importe) as importe,
      count(distinct v.card_id) as cartas
    from ventas v
    left join tcg_sets st on st.id = v.set_id and st.market = v.market
    where v.set_id is not null
    group by v.set_id, v.market
  ),
  quietas as (
    select s.id, s.card_id, s.market, s.product_id, s.idioma, s.estado, s.variante, s.unidades, s.entro_el,
      coalesce(c.name_es, c.name, p.name) as nombre, c.set_id, c.local_id as numero,
      public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) as precio
    from tienda_stock s
    left join tcg_cards c on c.id = s.card_id and c.market = s.market
    left join tcg_products p on p.id = s.product_id
    where s.tienda_id = v_uid and s.unidades > 0 and s.entro_el <= now() - interval '90 days'
      and not exists (select 1 from tienda_ventas v where v.stock_id = s.id and v.vendida_el > now() - interval '90 days')
  )
  select jsonb_build_object(
    'cartas', coalesce((select jsonb_agg(jsonb_build_object(
        'card_id', card_id, 'market', market, 'product_id', product_id, 'nombre', nombre, 'set_id', set_id,
        'numero', numero, 'unidades', unidades, 'importe', importe, 'beneficio', beneficio) order by unidades desc, importe desc, nombre)
      from (select * from por_carta order by unidades desc, importe desc, nombre limit 8) x), '[]'::jsonb),
    'sets', coalesce((select jsonb_agg(jsonb_build_object(
        'set_id', set_id, 'market', market, 'nombre', nombre, 'unidades', unidades, 'importe', importe, 'cartas', cartas) order by importe desc, unidades desc, set_id)
      from (select * from por_set order by importe desc, unidades desc, set_id limit 6) x), '[]'::jsonb),
    'quietas', jsonb_build_object(
      'lineas', (select count(*) from quietas),
      'unidades', (select coalesce(sum(unidades), 0) from quietas),
      'valor', (select coalesce(sum(precio * unidades), 0) from quietas),
      'filas', coalesce((select jsonb_agg(jsonb_build_object(
          'id', id, 'card_id', card_id, 'market', market, 'product_id', product_id, 'nombre', nombre, 'set_id', set_id,
          'numero', numero, 'idioma', idioma, 'estado', estado, 'variante', variante, 'unidades', unidades,
          'precio', precio, 'entro_el', entro_el) order by coalesce(precio, 0) * unidades desc, entro_el, id)
        from (select * from quietas order by coalesce(precio, 0) * unidades desc, entro_el, id limit 8) x), '[]'::jsonb)),
    'valor', coalesce((select jsonb_agg(jsonb_build_object('dia', dia, 'valor', valor, 'cm', cm, 'coste', coste, 'unidades', unidades) order by dia)
      from tienda_valor_diario
      where tienda_id = v_uid and dia >= (now() - interval '180 days')::date), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

--
-- Name: tienda_cobros_mios(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_cobros_mios() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(
    (select jsonb_build_object('pagos', to_jsonb(c.pagos), 'bizum', c.bizum, 'paypal', c.paypal, 'minimo', c.minimo) from tienda_cobros c where c.tienda_id = auth.uid()),
    jsonb_build_object('pagos', '["bizum","paypal","efectivo"]'::jsonb, 'bizum', null, 'paypal', null, 'minimo', null))
$$;

--
-- Name: tienda_cobros_poner(text[], text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_cobros_poner(p_pagos text[], p_bizum text, p_paypal text, p_minimo integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  -- En el orden en que vienen, sin repetir y sin lo que no existe.
  v_pagos text[] := array(select u.x from unnest(coalesce(p_pagos, '{}')) with ordinality u(x, i) where u.x in ('bizum', 'paypal', 'efectivo') group by u.x order by min(u.i));
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  if cardinality(v_pagos) = 0 then
    raise exception 'Elige al menos una forma de cobrar.' using errcode = '22023';
  end if;
  if p_minimo is not null and (p_minimo < 1 or p_minimo > 100) then
    raise exception 'El mínimo va del 1 al 100 %%.' using errcode = '22023';
  end if;
  insert into tienda_cobros (tienda_id, pagos, bizum, paypal, minimo, updated_at)
  values (v_uid, v_pagos, nullif(left(btrim(coalesce(p_bizum, '')), 40), ''), nullif(left(btrim(coalesce(p_paypal, '')), 120), ''), p_minimo, now())
  on conflict (tienda_id) do update set pagos = excluded.pagos, bizum = excluded.bizum, paypal = excluded.paypal, minimo = excluded.minimo, updated_at = now();
  return public.tienda_cobros_mios();
end;
$$;

--
-- Name: tienda_comprar(jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_comprar(p_lineas jsonb, p_cliente text DEFAULT NULL::text, p_pago text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_ticket uuid := gen_random_uuid();
  v_cliente text := nullif(btrim(coalesce(p_cliente, '')), '');
  v_pago text := nullif(btrim(coalesce(p_pago, '')), '');
  v_linea jsonb;
  v_card text;
  v_prod bigint;
  v_market text;
  v_idioma text;
  v_estado text;
  v_variante text;
  v_gradeo text;
  v_n int;
  v_coste numeric;
  v_cm numeric;
  v_valor numeric;
  v_stock uuid;
  v_lote uuid;
  v_cartas int;
  v_foto text;
  v_pct int;
  v_total numeric := 0;
  v_valorado numeric := 0;
  v_unidades int := 0;
  v_lineas int := 0;
  v_lotes int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda compra.' using errcode = '42501';
  end if;
  if v_pago is not null and v_pago not in ('efectivo', 'bizum', 'paypal', 'otro') then
    raise exception 'Esa forma de pago no existe.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'No hay nada que comprar.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lineas) > 200 then
    raise exception 'Como mucho 200 líneas por compra.' using errcode = '22023';
  end if;
  if v_cliente is not null and char_length(v_cliente) > 80 then
    raise exception 'El nombre del cliente, como mucho 80 letras.' using errcode = '22023';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_coste := round((v_linea->>'coste')::numeric, 2);
    v_valor := round(nullif(v_linea->>'valorado', '')::numeric, 2);
    if v_coste is null or v_coste < 0 then
      raise exception 'Cada línea lleva lo que pagas.' using errcode = '22023';
    end if;
    if v_valor is not null and v_valor < 0 then
      raise exception 'Revisa lo que vale.' using errcode = '22023';
    end if;

    -- Un lote: no entra al stock (no se sabe qué lleva); espera a desglosarse.
    if coalesce(v_linea->>'lote', 'false') = 'true' then
      v_cartas := nullif(v_linea->>'cartas', '')::int;
      v_foto := nullif(btrim(coalesce(v_linea->>'foto', '')), '');
      v_pct := nullif(v_linea->>'pct', '')::numeric::int;
      if v_cartas is not null and (v_cartas < 1 or v_cartas > 9999) then
        raise exception 'Revisa cuántas cartas trae el lote.' using errcode = '22023';
      end if;
      -- La foto, en la carpeta de la tienda (la política del cubo, 1235).
      if v_foto is not null and (v_foto not like v_uid::text || '/lotes/%' or char_length(v_foto) > 200 or v_foto like '%..%') then
        raise exception 'Esa foto no es de tu tienda.' using errcode = '22023';
      end if;
      if v_pct is not null and (v_pct < 0 or v_pct > 200) then
        raise exception 'Revisa el tanto por ciento.' using errcode = '22023';
      end if;
      insert into tienda_lotes (tienda_id, compra_ticket, vale, coste, pct, cartas, foto, cliente)
      values (v_uid, v_ticket, v_valor, v_coste, v_pct, v_cartas, v_foto, v_cliente)
      returning id into v_lote;
      insert into tienda_compras (tienda_id, ticket, lote_id, market, idioma, estado, variante, unidades, coste, cliente, pago, valorado)
      values (v_uid, v_ticket, v_lote, 'WEST', '', 'lote', 'normal', 1, v_coste, v_cliente, v_pago, v_valor);
      v_lineas := v_lineas + 1;
      v_lotes := v_lotes + 1;
      v_unidades := v_unidades + coalesce(v_cartas, 1);
      v_total := v_total + v_coste;
      v_valorado := v_valorado + coalesce(v_valor, 0);
      continue;
    end if;

    v_card := nullif(v_linea->>'card_id', '');
    v_prod := nullif(v_linea->>'product_id', '')::bigint;
    v_market := coalesce(nullif(v_linea->>'market', ''), 'WEST');
    v_n := (v_linea->>'unidades')::int;
    v_cm := round(nullif(v_linea->>'cm', '')::numeric, 2);
    if (v_card is null) = (v_prod is null) then
      raise exception 'Cada línea es una carta o un producto.' using errcode = '22023';
    end if;
    if v_n is null or v_n < 1 or v_n > 99999 then
      raise exception 'Cada línea compra al menos una unidad.' using errcode = '22023';
    end if;
    if v_card is not null then
      if not exists (select 1 from tcg_cards where id = v_card and market = v_market) then
        raise exception 'Una de las cartas no está en el catálogo.' using errcode = 'P0002';
      end if;
      v_idioma := coalesce(nullif(v_linea->>'idioma', ''), case when v_market = 'JP' then 'ja' else 'es' end);
      v_estado := coalesce(nullif(v_linea->>'estado', ''), 'NM');
      v_variante := coalesce(nullif(v_linea->>'variante', ''), 'normal');
      v_gradeo := nullif(btrim(coalesce(v_linea->>'gradeo', '')), '');
    else
      if not exists (select 1 from tcg_products where id = v_prod) then
        raise exception 'Uno de los productos no está en el catálogo.' using errcode = 'P0002';
      end if;
      v_idioma := coalesce(nullif(v_linea->>'idioma', ''), 'en');
      v_estado := 'sellado';
      v_variante := 'normal';
      v_gradeo := null;
    end if;

    -- Una línea NUEVA, oculta y por poner a la venta, con su coste exacto.
    insert into tienda_stock (tienda_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, valorado, precio, visible, por_poner, entro_el)
    values (v_uid, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_coste, v_valor, null, false, true, now())
    returning id into v_stock;

    insert into tienda_compras (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, cm, cliente, pago, valorado)
    values (v_uid, v_ticket, v_stock, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_coste, v_cm, v_cliente, v_pago, v_valor);

    v_lineas := v_lineas + 1;
    v_unidades := v_unidades + v_n;
    v_total := v_total + v_coste * v_n;
    v_valorado := v_valorado + coalesce(v_valor, v_cm, 0) * v_n;
  end loop;

  return jsonb_build_object('ticket', v_ticket, 'lineas', v_lineas, 'unidades', v_unidades, 'total', v_total, 'valorado', v_valorado, 'pago', v_pago, 'lotes', v_lotes);
end;
$$;

--
-- Name: tienda_compras_lista(jsonb, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_compras_lista(p_filtros jsonb DEFAULT '{}'::jsonb, p_desde integer DEFAULT 0, p_cuantas integer DEFAULT 100) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
  v_q text := lower(btrim(coalesce(p_filtros->>'q', '')));
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda compra.' using errcode = '42501';
  end if;

  with
  base as (
    select v.*,
      c.set_id, c.local_id as numero,
      coalesce(c.name_es, c.name, p.name, case when v.lote_id is not null then 'Lote sin desglosar' end) as nombre,
      l.cartas,
      lower(coalesce(c.name_search, '') || ' ' || coalesce(p.name, '') || ' ' || coalesce(v.cliente, '') || case when v.lote_id is not null then ' lote' else '' end) as texto
    from tienda_compras v
    left join tcg_cards c on c.id = v.card_id and c.market = v.market
    left join tcg_products p on p.id = v.product_id
    left join tienda_lotes l on l.id = v.lote_id
    where v.tienda_id = v_uid
      and (p_filtros->>'desde' is null or v.comprada_el >= (p_filtros->>'desde')::timestamptz)
      and (p_filtros->>'hasta' is null or v.comprada_el < (p_filtros->>'hasta')::timestamptz)
  ),
  filtrada as (
    select * from base b
    where v_q = '' or b.numero = v_q or not exists (
      select 1 from unnest(regexp_split_to_array(v_q, '\s+')) palabra where position(palabra in b.texto) = 0
    )
  ),
  ordenada as (
    select f.*, row_number() over (order by f.comprada_el desc, f.ticket, f.id) as puesto from filtrada f
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'tickets', (select count(distinct ticket) from filtrada),
    'sumas', jsonb_build_object(
      'unidades', (select coalesce(sum(unidades), 0) from filtrada),
      'importe', (select coalesce(sum(coste * unidades), 0) from filtrada),
      'cm', (select coalesce(sum(cm * unidades), 0) from filtrada where cm is not null),
      'importe_con_cm', (select coalesce(sum(coste * unidades), 0) from filtrada where cm is not null)
    ),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'ticket', ticket, 'stock_id', stock_id, 'card_id', card_id, 'market', market, 'product_id', product_id,
      'lote_id', lote_id, 'de_lote', de_lote, 'cartas', cartas,
      'nombre', nombre, 'set_id', set_id, 'numero', numero,
      'idioma', idioma, 'estado', estado, 'variante', variante, 'gradeo', gradeo,
      'unidades', unidades, 'coste', coste, 'cm', cm, 'valorado', valorado, 'cliente', cliente, 'pago', pago, 'comprada_el', comprada_el
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 100), 1), 5000)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

--
-- Name: tienda_condiciones(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_condiciones(p_tienda uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select jsonb_build_object(
    'pagos', coalesce((select to_jsonb(c.pagos) from tienda_cobros c where c.tienda_id = p_tienda), '["bizum","paypal","efectivo"]'::jsonb),
    'minimo', (select c.minimo from tienda_cobros c where c.tienda_id = p_tienda)
  )
$$;

--
-- Name: tienda_contar_visita(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_contar_visita(p_tienda uuid, p_qr boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if p_tienda is null or auth.uid() is not distinct from p_tienda then return; end if;
  if not exists (select 1 from user_profiles where id = p_tienda and tipo = 'tienda') then return; end if;
  insert into tienda_visitas (tienda_id, dia, visitas, qr)
  values (p_tienda, (now() at time zone 'Europe/Madrid')::date, 1, case when p_qr then 1 else 0 end)
  on conflict (tienda_id, dia) do update
    set visitas = tienda_visitas.visitas + 1, qr = tienda_visitas.qr + excluded.qr;
end;
$$;

--
-- Name: tienda_cumple(jsonb, text, text, text, text, text, text, text, text, text, text, numeric, numeric, numeric, integer, text, boolean, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_cumple(p jsonb, p_sin text, v_texto text, v_numero text, v_catalogo text, v_set text, v_idioma text, v_estado text, v_variante text, v_rareza text, v_ubicacion text, v_precio numeric, v_coste numeric, v_cm numeric, v_unidades integer, v_gradeo text, v_visible boolean, v_entro timestamp with time zone) RETURNS boolean
    LANGUAGE plpgsql STABLE
    AS $$
declare
  palabra text;
  lista text[];
  ok boolean;
  margen numeric;
begin
  p := coalesce(p, '{}'::jsonb);
  -- Las listas: si el filtro trae una lista no vacía, el valor tiene que estar.
  if p_sin <> 'catalogo' and jsonb_typeof(p->'catalogo') = 'array' and jsonb_array_length(p->'catalogo') > 0
     and not (p->'catalogo') ? v_catalogo then return false; end if;
  if p_sin <> 'sets' and jsonb_typeof(p->'sets') = 'array' and jsonb_array_length(p->'sets') > 0
     and not (p->'sets') ? coalesce(v_set, '') then return false; end if;
  if p_sin <> 'idioma' and jsonb_typeof(p->'idioma') = 'array' and jsonb_array_length(p->'idioma') > 0
     and not (p->'idioma') ? v_idioma then return false; end if;
  if p_sin <> 'estado' and jsonb_typeof(p->'estado') = 'array' and jsonb_array_length(p->'estado') > 0
     and not (p->'estado') ? v_estado then return false; end if;
  if p_sin <> 'variante' and jsonb_typeof(p->'variante') = 'array' and jsonb_array_length(p->'variante') > 0
     and not (p->'variante') ? v_variante then return false; end if;
  if p_sin <> 'rareza' and jsonb_typeof(p->'rareza') = 'array' and jsonb_array_length(p->'rareza') > 0
     and not (p->'rareza') ? coalesce(v_rareza, '') then return false; end if;
  if p_sin <> 'ubicacion' and jsonb_typeof(p->'ubicacion') = 'array' and jsonb_array_length(p->'ubicacion') > 0
     and not (p->'ubicacion') ? coalesce(v_ubicacion, '') then return false; end if;

  -- El texto: cada palabra en el nombre (ya plegado), o el número entero.
  if p_sin <> 'q' and coalesce(btrim(p->>'q'), '') <> '' then
    for palabra in select unnest(regexp_split_to_array(lower(btrim(p->>'q')), '\s+')) loop
      if palabra <> '' and position(palabra in coalesce(v_texto, '')) = 0
         and lower(coalesce(v_numero, '')) <> palabra then
        return false;
      end if;
    end loop;
  end if;

  -- Los rangos (en euros, por unidad).
  if p_sin <> 'precio' then
    if p ? 'precio_min' and (v_precio is null or v_precio < (p->>'precio_min')::numeric) then return false; end if;
    if p ? 'precio_max' and (v_precio is null or v_precio > (p->>'precio_max')::numeric) then return false; end if;
  end if;
  if p_sin <> 'cm' then
    if p ? 'cm_min' and (v_cm is null or v_cm < (p->>'cm_min')::numeric) then return false; end if;
    if p ? 'cm_max' and (v_cm is null or v_cm > (p->>'cm_max')::numeric) then return false; end if;
  end if;
  if p_sin <> 'coste' then
    if p ? 'coste_min' and (v_coste is null or v_coste < (p->>'coste_min')::numeric) then return false; end if;
    if p ? 'coste_max' and (v_coste is null or v_coste > (p->>'coste_max')::numeric) then return false; end if;
  end if;

  -- El margen, sobre lo pagado: (precio − coste) / coste.
  if p_sin <> 'margen' and jsonb_typeof(p->'margen') = 'array' and jsonb_array_length(p->'margen') > 0 then
    margen := case when v_coste > 0 and v_precio is not null then (v_precio - v_coste) / v_coste * 100 end;
    ok := ((p->'margen') ? 'sin_coste' and (v_coste is null or v_coste = 0 or v_precio is null))
       or ((p->'margen') ? 'pierdes' and margen < 0)
       or ((p->'margen') ? '0-20' and margen >= 0 and margen < 20)
       or ((p->'margen') ? '20-50' and margen >= 20 and margen < 50)
       or ((p->'margen') ? '50+' and margen >= 50);
    if not coalesce(ok, false) then return false; end if;
  end if;

  if p_sin <> 'contra' and jsonb_typeof(p->'contra') = 'array' and jsonb_array_length(p->'contra') > 0 then
    if v_precio is null or v_cm is null or v_cm = 0 then return false; end if;
    ok := ((p->'contra') ? 'debajo' and v_precio < v_cm * 0.95)
       or ((p->'contra') ? 'igual' and v_precio between v_cm * 0.95 and v_cm * 1.05)
       or ((p->'contra') ? 'encima' and v_precio > v_cm * 1.05);
    if not ok then return false; end if;
  end if;

  if p_sin <> 'dias' and jsonb_typeof(p->'dias') = 'array' and jsonb_array_length(p->'dias') > 0 then
    ok := ((p->'dias') ? '30' and v_entro > now() - interval '30 days')
       or ((p->'dias') ? '30-90' and v_entro <= now() - interval '30 days' and v_entro > now() - interval '90 days')
       or ((p->'dias') ? '90+' and v_entro <= now() - interval '90 days');
    if not ok then return false; end if;
  end if;

  if p_sin <> 'unidades' and jsonb_typeof(p->'unidades') = 'array' and jsonb_array_length(p->'unidades') > 0 then
    ok := ((p->'unidades') ? 'agotadas' and v_unidades = 0)
       or ((p->'unidades') ? 'una' and v_unidades = 1)
       or ((p->'unidades') ? 'varias' and v_unidades > 1);
    if not ok then return false; end if;
  end if;

  if p_sin <> 'gradeadas' and jsonb_typeof(p->'gradeadas') = 'array' and jsonb_array_length(p->'gradeadas') = 1 then
    if ((p->'gradeadas') ? 'si') <> (v_gradeo is not null) then return false; end if;
  end if;

  if p_sin <> 'visible' and jsonb_typeof(p->'visible') = 'array' and jsonb_array_length(p->'visible') = 1 then
    if ((p->'visible') ? 'si') <> v_visible then return false; end if;
  end if;

  return true;
end;
$$;

--
-- Name: tienda_decidir(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_decidir(p_id uuid, p_aceptar boolean) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v tienda_solicitudes%rowtype;
begin
  if coalesce(auth.role(), '') <> 'service_role' and not coalesce(is_admin(), false) then
    raise exception 'Solo el equipo puede decidir las solicitudes de tienda.' using errcode = '42501';
  end if;
  select * into v from tienda_solicitudes where id = p_id for update;
  if not found then
    raise exception 'Esa solicitud no existe.' using errcode = 'P0002';
  end if;
  if v.estado = 'usada' then
    raise exception 'Esa tienda ya tiene su cuenta.' using errcode = '22023';
  end if;

  if p_aceptar then
    update tienda_solicitudes
      set estado = 'aceptada', token = gen_random_uuid(), caduca = now() + interval '14 days',
          decidio = auth.uid(), decidida_el = now()
      where id = p_id
      returning * into v;
  else
    update tienda_solicitudes
      set estado = 'rechazada', token = null, caduca = null, decidio = auth.uid(), decidida_el = now()
      where id = p_id
      returning * into v;
  end if;

  return jsonb_build_object(
    'id', v.id, 'estado', v.estado, 'nombre', v.nombre, 'email', v.email,
    'contacto', v.contacto, 'token', v.token, 'caduca', v.caduca
  );
end;
$$;

--
-- Name: tienda_deshacer_cambio(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_deshacer_cambio(p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_c tienda_cambios%rowtype;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda hace cambios.' using errcode = '42501';
  end if;
  select * into v_c from tienda_cambios
    where tienda_id = v_uid and (id = p_id or venta_ticket = p_id or compra_ticket = p_id)
    for update;
  if not found then
    raise exception 'Ese cambio no existe o ya se deshizo.' using errcode = 'P0002';
  end if;
  -- Fuera la fila antes: las de deshacer venta y compra no dejan tocar un
  -- ticket que esté en un cambio.
  delete from tienda_cambios where id = v_c.id;
  perform public.tienda_deshacer_compra(v_c.compra_ticket);
  perform public.tienda_deshacer_venta(v_c.venta_ticket);
  return jsonb_build_object('id', v_c.id, 'diferencia', v_c.diferencia, 'pago', v_c.pago);
end;
$$;

--
-- Name: tienda_deshacer_compra(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_deshacer_compra(p_ticket uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_compra record;
  v_quedan int;
  v_borradas int := 0;
  v_lineas int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda compra.' using errcode = '42501';
  end if;
  if exists (select 1 from tienda_cambios where compra_ticket = p_ticket and tienda_id = v_uid) then
    raise exception 'Esta compra es parte de un cambio: deshaz el cambio entero.' using errcode = 'P0001';
  end if;
  for v_compra in select * from tienda_compras where ticket = p_ticket and tienda_id = v_uid for update loop
    v_lineas := v_lineas + 1;
    if v_compra.stock_id is not null then
      select unidades into v_quedan from tienda_stock where id = v_compra.stock_id and tienda_id = v_uid for update;
      if found and v_quedan < v_compra.unidades then
        raise exception 'Ya has vendido alguna de esta compra: quítalas del stock a mano.' using errcode = 'P0001';
      end if;
      if found then
        if v_quedan = v_compra.unidades then
          delete from tienda_stock where id = v_compra.stock_id;
          v_borradas := v_borradas + 1;
        else
          update tienda_stock set unidades = unidades - v_compra.unidades, updated_at = now() where id = v_compra.stock_id;
        end if;
      end if;
    end if;
    delete from tienda_compras where id = v_compra.id;
  end loop;
  if v_lineas = 0 then
    raise exception 'Esa compra ya no existe.' using errcode = 'P0002';
  end if;
  delete from tienda_lotes where compra_ticket = p_ticket and tienda_id = v_uid;
  return jsonb_build_object('lineas', v_lineas, 'borradas', v_borradas);
end;
$$;

--
-- Name: tienda_deshacer_venta(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_deshacer_venta(p_ticket uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_devueltas int := 0;
  v_borradas int := 0;
  v_venta record;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda vende.' using errcode = '42501';
  end if;
  if exists (select 1 from tienda_cambios where venta_ticket = p_ticket and tienda_id = v_uid) then
    raise exception 'Esta venta es parte de un cambio: deshaz el cambio entero.' using errcode = 'P0001';
  end if;
  for v_venta in select * from tienda_ventas where ticket = p_ticket and tienda_id = v_uid for update loop
    if v_venta.stock_id is not null then
      update tienda_stock set unidades = unidades + v_venta.unidades, updated_at = now()
        where id = v_venta.stock_id and tienda_id = v_uid;
      if found then v_devueltas := v_devueltas + 1; end if;
    end if;
    delete from tienda_ventas where id = v_venta.id;
    v_borradas := v_borradas + 1;
  end loop;
  if v_borradas = 0 then
    raise exception 'Esa venta no existe o ya se deshizo.' using errcode = 'P0002';
  end if;
  return jsonb_build_object('borradas', v_borradas, 'devueltas', v_devueltas);
end;
$$;

--
-- Name: tienda_escaparate(uuid, jsonb, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_escaparate(p_tienda uuid, p_filtros jsonb DEFAULT '{}'::jsonb, p_orden text DEFAULT 'recientes'::text, p_desde integer DEFAULT 0, p_cuantas integer DEFAULT 60) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_res jsonb;
  v_precios boolean;
  f jsonb := coalesce(p_filtros, '{}'::jsonb);
begin
  if not exists (select 1 from user_profiles where id = p_tienda and tipo = 'tienda' and not coalesce(is_banned, false)) or not public.tienda_publica(p_tienda) then
    return null;
  end if;
  select coalesce(precio_visible, true) into v_precios from tiendas where user_id = p_tienda;
  v_precios := coalesce(v_precios, true);

  with
  base as (
    select s.id, s.card_id, s.market, s.product_id, s.idioma, s.estado, s.variante, s.gradeo, s.unidades,
      public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) as precio,
      (v_precios and s.oferta_precio is not null and (s.oferta_hasta is null or s.oferta_hasta > now())) as en_oferta,
      s.precio as precio_lista, s.oferta_hasta, s.destacada, s.entro_el,
      (s.entro_el > now() - interval '7 days') as nueva,
      c.set_id, c.local_id as numero,
      case when s.product_id is not null then 'sellado' else s.market end as catalogo,
      coalesce(c.name_es, c.name, p.name) as nombre,
      lower(coalesce(c.name_search, '') || ' ' || coalesce(p.name, '')) as texto,
      (auth.uid() is not null and s.card_id is not null and exists (
        select 1 from user_wants w
        where w.user_id = auth.uid() and w.card_id = s.card_id
          and (w.idioma is null or w.idioma = s.idioma)
          and (w.variante is null or w.variante = s.variante))) as de_tu_lista
    from tienda_stock s
    left join tcg_cards c on c.id = s.card_id and c.market = s.market
    left join tcg_products p on p.id = s.product_id
    where s.tienda_id = p_tienda and s.visible and s.unidades > 0
  ),
  filtrada as (
    select * from base b
    where (not coalesce((f->>'de_tu_lista')::boolean, false) or b.de_tu_lista)
      -- Una carta concreta: desde «En tiendas» de su ficha (`?carta=`).
      and (coalesce(f->>'carta', '') = '' or b.card_id = f->>'carta')
      and (coalesce(f->>'id', '') = '' or b.id::text = f->>'id')
      and (coalesce(f->>'seccion', '') = ''
        or (f->>'seccion' = 'destacadas' and b.destacada)
        or (f->>'seccion' = 'nuevas' and b.nueva)
        or (f->>'seccion' = 'ofertas' and b.en_oferta))
      and (jsonb_typeof(f->'catalogo') is distinct from 'array' or jsonb_array_length(f->'catalogo') = 0 or (f->'catalogo') ? b.catalogo)
      and (jsonb_typeof(f->'idioma') is distinct from 'array' or jsonb_array_length(f->'idioma') = 0 or (f->'idioma') ? b.idioma)
      and (jsonb_typeof(f->'sets') is distinct from 'array' or jsonb_array_length(f->'sets') = 0 or (f->'sets') ? coalesce(b.set_id, ''))
      and (coalesce(btrim(f->>'q'), '') = '' or not exists (
        select 1 from unnest(regexp_split_to_array(lower(btrim(f->>'q')), '\s+')) palabra
        where palabra <> '' and position(palabra in b.texto) = 0 and lower(coalesce(b.numero, '')) <> palabra))
  ),
  ordenada as (
    select fi.*, row_number() over (
      order by
        case when p_orden = 'precio_asc' and v_precios then fi.precio end asc nulls last,
        case when p_orden = 'precio_desc' and v_precios then fi.precio end desc nulls last,
        case when p_orden = 'nombre' then fi.nombre end asc nulls last,
        fi.de_tu_lista desc, fi.entro_el desc, fi.id
    ) as puesto
    from filtrada fi
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'en_escaparate', (select count(*) from base),
    'de_tu_lista', (select count(*) from base where de_tu_lista),
    'destacadas', (select count(*) from base where destacada),
    'nuevas', (select count(*) from base where nueva),
    'ofertas', (select count(*) from base where en_oferta),
    'precios', v_precios,
    'facetas', jsonb_build_object(
      'catalogo', coalesce((select jsonb_object_agg(catalogo, n) from (select catalogo, count(*) n from base group by catalogo) x), '{}'::jsonb),
      'idioma', coalesce((select jsonb_object_agg(idioma, n) from (select idioma, count(*) n from base group by idioma) x), '{}'::jsonb),
      'sets', coalesce((select jsonb_object_agg(set_id, n) from (select set_id, count(*) n from base where set_id is not null group by set_id) x), '{}'::jsonb)
    ),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'card_id', card_id, 'market', market, 'product_id', product_id, 'nombre', nombre,
      'set_id', set_id, 'numero', numero, 'idioma', idioma, 'estado', estado, 'variante', variante,
      'gradeo', gradeo, 'unidades', unidades, 'precio', case when v_precios then precio end,
      'precio_antes', case when en_oferta then precio_lista end,
      'oferta_hasta', case when en_oferta then oferta_hasta end,
      'destacada', destacada, 'nueva', nueva, 'entro_el', entro_el,
      'de_tu_lista', de_tu_lista
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 60), 1), 200)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

--
-- Name: tienda_foto_puedo(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_foto_puedo(p_stock uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.soy_tienda() and exists (
    select 1 from tienda_stock s
    where s.id = p_stock and s.tienda_id = auth.uid() and s.card_id is not null
  );
$$;

--
-- Name: tienda_foto_se_ve(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_foto_se_ve(p_stock uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
      select 1 from tienda_stock s
      where s.id = p_stock and (s.tienda_id = auth.uid() or (s.visible and s.unidades > 0))
    )
    or exists (select 1 from tienda_fotos_pedidas f where f.stock_id = p_stock and f.comprador_id = auth.uid())
    or exists (select 1 from tienda_ofertas o where o.stock_id = p_stock and o.comprador_id = auth.uid());
$$;

--
-- Name: tienda_fotos_avisar(uuid, uuid, uuid, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_fotos_avisar(p_stock uuid, p_de uuid, p_para uuid, p_evento text, p_titulo text, p_texto text, p_link text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_conv uuid := public.cambio_conversacion(p_de, p_para);
begin
  insert into private_messages (conversation_id, sender_id, body, adjuntos)
  values (v_conv, p_de, p_texto, jsonb_build_array(jsonb_build_object('tipo', 'fotos_tienda', 'stock_id', p_stock, 'evento', p_evento)));
  insert into user_notifications (recipient_id, type, title, body, link)
  values (p_para, 'tienda_fotos', p_titulo, p_texto, coalesce(p_link, '/mensajes.html?c=' || v_conv));
end;
$$;

--
-- Name: tienda_fotos_pedidas_lista(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_fotos_pedidas_lista() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  return coalesce((select jsonb_agg(x.f order by x.k desc) from (
    select jsonb_build_object(
      'id', f.id, 'stock_id', f.stock_id, 'created_at', f.created_at,
      'comprador', (select jsonb_build_object('id', p.id, 'username', p.username, 'nombre', coalesce(p.display_name, p.username)) from user_profiles p where p.id = f.comprador_id),
      'card_id', s.card_id, 'market', s.market, 'product_id', s.product_id, 'idioma', s.idioma, 'estado', s.estado, 'variante', s.variante, 'gradeo', s.gradeo,
      'precio', public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta),
      'nombre', coalesce(c.name_es, c.name, pr.name)
    ) f, extract(epoch from f.created_at) k
    from tienda_fotos_pedidas f
    join tienda_stock s on s.id = f.stock_id
    left join tcg_cards c on c.id = s.card_id
    left join tcg_products pr on pr.id = s.product_id
    where f.tienda_id = v_uid and f.atendida_at is null
    order by f.created_at desc
    limit 200
  ) x), '[]'::jsonb);
end;
$$;

--
-- Name: tienda_fotos_quitar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_fotos_quitar(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  update tienda_fotos_pedidas set atendida_at = now(), como = 'quitada'
  where id = p_id and tienda_id = auth.uid() and atendida_at is null;
  if not found then
    raise exception 'Esa petición ya no está.' using errcode = 'P0002';
  end if;
end;
$$;

--
-- Name: tienda_fotos_subidas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_fotos_subidas() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_p record;
  v_s tienda_stock%rowtype;
begin
  if new.frente is null and new.dorso is null then
    return new;
  end if;
  select * into v_s from tienda_stock where id = new.stock_id;
  for v_p in select * from tienda_fotos_pedidas where stock_id = new.stock_id and atendida_at is null for update loop
    update tienda_fotos_pedidas set atendida_at = now(), como = 'subidas' where id = v_p.id;
    perform public.tienda_fotos_avisar(new.stock_id, v_p.tienda_id, v_p.comprador_id, 'fotos_subidas', 'Ya tienes las fotos',
      'Ya están las fotos que me pediste.', null);
  end loop;
  return new;
end;
$$;

--
-- Name: tienda_guarda_tipo(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_guarda_tipo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if coalesce(public.is_admin(), false) then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.tipo := 'persona';
  else
    new.tipo := old.tipo;
  end if;
  return new;
end;
$$;

--
-- Name: tienda_hoy(timestamp with time zone, timestamp with time zone, timestamp with time zone, timestamp with time zone, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_hoy(p_desde timestamp with time zone, p_hasta timestamp with time zone, p_antes_desde timestamp with time zone DEFAULT NULL::timestamp with time zone, p_antes_hasta timestamp with time zone DEFAULT NULL::timestamp with time zone, p_paso text DEFAULT 'day'::text, p_zona text DEFAULT 'Europe/Madrid'::text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
  -- Las visitas van por días: un límite a media tarde cuenta su día entero.
  v_d1 date := (p_desde at time zone p_zona)::date;
  v_d2 date := (p_hasta at time zone p_zona)::date + case when (p_hasta at time zone p_zona)::time = '00:00' then 0 else 1 end;
  v_a1 date := (p_antes_desde at time zone p_zona)::date;
  v_a2 date := (p_antes_hasta at time zone p_zona)::date + case when (p_antes_hasta at time zone p_zona)::time = '00:00' then 0 else 1 end;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda tiene panel.' using errcode = '42501';
  end if;
  if p_paso not in ('hour', 'day', 'month') then
    raise exception 'Ese paso no existe.' using errcode = '22023';
  end if;

  with
  ventas as (
    select vendida_el, ticket, unidades, precio * unidades as importe,
      case when coste is not null then (precio - coste) * unidades end as beneficio,
      coste * unidades as coste
    from tienda_ventas
    where tienda_id = v_uid
      and vendida_el >= least(p_desde, coalesce(p_antes_desde, p_desde))
      and vendida_el < greatest(p_hasta, coalesce(p_antes_hasta, p_hasta))
  ),
  -- El stock, con el Cardmarket de su idioma: la cuenta de `tienda_stock_lista`.
  stock as (
    select s.unidades, s.precio, s.coste, s.entro_el,
      case
        when s.product_id is not null then (select coalesce(p.cm_lowest_es, p.cm_lowest_eu, p.cm_lowest) from tcg_products p where p.id = s.product_id)
        else public.valor_de_copia(
          jsonb_populate_record(null::public.user_collection, jsonb_build_object('cantidad', 1, 'variante', s.variante, 'idioma', s.idioma, 'gradeo', s.gradeo)),
          pr)
      end as cm
    from tienda_stock s
    left join tcg_card_prices pr on pr.card_id = s.card_id
    where s.tienda_id = v_uid
  ),
  -- Lo que se busca y tiene: la regla de un deseo de siempre (1047), solo lo
  -- que se ve en el escaparate con unidades, y sin decir quién lo busca.
  demanda as (
    select s.card_id, s.market, sum(s.unidades) as tienes,
      (select count(distinct w.user_id) from user_wants w
        where w.card_id = s.card_id and w.user_id <> v_uid
          and exists (select 1 from tienda_stock s2 where s2.tienda_id = v_uid and s2.card_id = s.card_id and s2.unidades > 0 and s2.visible
            and (w.idioma is null or w.idioma = s2.idioma) and (w.variante is null or w.variante = s2.variante))) as quieren
    from tienda_stock s
    where s.tienda_id = v_uid and s.card_id is not null and s.unidades > 0 and s.visible
    group by s.card_id, s.market
  ),
  pasos as (
    select t from generate_series(
      date_trunc(p_paso, p_desde at time zone p_zona),
      date_trunc(p_paso, (p_hasta - interval '1 microsecond') at time zone p_zona),
      ('1 ' || p_paso)::interval) t
  )
  select jsonb_build_object(
    'actual', (select jsonb_build_object(
        'importe', coalesce(sum(importe), 0), 'beneficio', sum(beneficio), 'coste', coalesce(sum(coste), 0),
        'unidades', coalesce(sum(unidades), 0), 'ventas', count(distinct ticket), 'sin_coste', count(*) filter (where beneficio is null))
      from ventas where vendida_el >= p_desde and vendida_el < p_hasta),
    'anterior', case when p_antes_desde is null then null else (select jsonb_build_object(
        'importe', coalesce(sum(importe), 0), 'beneficio', sum(beneficio), 'coste', coalesce(sum(coste), 0),
        'unidades', coalesce(sum(unidades), 0), 'ventas', count(distinct ticket))
      from ventas where vendida_el >= p_antes_desde and vendida_el < p_antes_hasta) end,
    'serie', (select coalesce(jsonb_agg(jsonb_build_object('t', to_char(p.t, 'YYYY-MM-DD"T"HH24:MI'), 'importe', coalesce(x.importe, 0)) order by p.t), '[]'::jsonb)
      from pasos p left join lateral (
        select sum(v.importe) as importe from ventas v
        where v.vendida_el >= p_desde and v.vendida_el < p_hasta and date_trunc(p_paso, v.vendida_el at time zone p_zona) = p.t
      ) x on true),
    'stock', (select jsonb_build_object(
        'lineas', count(*), 'unidades', coalesce(sum(unidades), 0),
        'valor', coalesce(sum(precio * unidades), 0), 'cm', coalesce(round(sum(cm * unidades), 2), 0), 'coste', coalesce(sum(coste * unidades), 0))
      from stock),
    -- Los mismos umbrales que `tienda_cumple` (contra «debajo», margen
    -- «pierdes», días «90+», unidades «agotadas»): la prueba los compara.
    'avisos', (select jsonb_build_object(
        'debajo', count(*) filter (where precio is not null and cm > 0 and precio < cm * 0.95),
        'pierden', count(*) filter (where coste > 0 and precio is not null and precio < coste),
        'viejas', count(*) filter (where entro_el <= now() - interval '90 days'),
        'agotadas', count(*) filter (where unidades = 0))
      from stock),
    'demanda', (select coalesce(jsonb_agg(jsonb_build_object(
        'card_id', d.card_id, 'market', d.market, 'quieren', d.quieren, 'tienes', d.tienes,
        'nombre', coalesce(c.name_es, c.name), 'set_id', c.set_id, 'numero', c.local_id) order by d.quieren desc, d.tienes desc, d.card_id), '[]'::jsonb)
      from (select * from demanda where quieren > 0 order by quieren desc, tienes desc, card_id limit 8) d
      left join tcg_cards c on c.id = d.card_id and c.market = d.market),
    'visitas', jsonb_build_object(
      'actual', (select coalesce(sum(visitas), 0) from tienda_visitas where tienda_id = v_uid and dia >= v_d1 and dia < v_d2),
      'qr', (select coalesce(sum(qr), 0) from tienda_visitas where tienda_id = v_uid and dia >= v_d1 and dia < v_d2),
      'anterior', case when p_antes_desde is null then null else (select coalesce(sum(visitas), 0) from tienda_visitas where tienda_id = v_uid and dia >= v_a1 and dia < v_a2) end)
  ) into v_res;
  return v_res;
end;
$$;

--
-- Name: tienda_instagram(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_instagram(p text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
declare
  v text := btrim(coalesce(p, ''));
  u text;
begin
  if v = '' then
    return null;
  end if;
  u := substring(v from '(?i)^(?:https?://)?(?:www\.)?instagram\.com/([A-Za-z0-9._]{1,30})/?(?:\?.*)?$');
  if u is null then
    u := substring(v from '^@?([A-Za-z0-9._]{1,30})$');
  end if;
  if u is null then
    raise exception 'Ese Instagram no parece un usuario: escribe solo tu @.' using errcode = '22023';
  end if;
  return u;
end;
$_$;

--
-- Name: tienda_invitacion(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_invitacion(p_token uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v tienda_solicitudes%rowtype;
begin
  select * into v from tienda_solicitudes where token = p_token;
  if not found then
    return jsonb_build_object('valida', false, 'motivo', 'no_existe');
  end if;
  if v.estado = 'usada' or v.usada_el is not null then
    return jsonb_build_object('valida', false, 'motivo', 'usada');
  end if;
  if v.estado <> 'aceptada' then
    return jsonb_build_object('valida', false, 'motivo', 'no_existe');
  end if;
  if v.caduca < now() then
    return jsonb_build_object('valida', false, 'motivo', 'caducada');
  end if;
  return jsonb_build_object(
    'valida', true, 'nombre', v.nombre, 'ciudad', v.ciudad, 'email', v.email,
    'web', v.web, 'instagram', v.instagram, 'caduca', v.caduca
  );
end;
$$;

--
-- Name: tienda_lote_desglosar(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_lote_desglosar(p_lote uuid, p_lineas jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_l tienda_lotes%rowtype;
  v_c tienda_compras%rowtype;
  v_costes numeric[];
  v_linea jsonb;
  v_i int;
  v_card text;
  v_prod bigint;
  v_market text;
  v_idioma text;
  v_estado text;
  v_variante text;
  v_gradeo text;
  v_n int;
  v_cm numeric;
  v_valor numeric;
  v_stock uuid;
  v_total numeric := 0;
  v_unidades int := 0;
  v_lineas int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  select * into v_l from tienda_lotes where id = p_lote and tienda_id = v_uid for update;
  if not found then
    raise exception 'Ese lote no existe.' using errcode = 'P0002';
  end if;
  if v_l.estado <> 'por_desglosar' then
    raise exception 'Ese lote ya está desglosado.' using errcode = 'P0001';
  end if;
  select * into v_c from tienda_compras where lote_id = p_lote and tienda_id = v_uid for update;
  if not found then
    raise exception 'La compra de ese lote ya no existe.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'Añade al menos una carta del lote.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lineas) > 200 then
    raise exception 'Como mucho 200 líneas por lote.' using errcode = '22023';
  end if;

  v_costes := tienda_repartir(v_c.coste * v_c.unidades, (
    select jsonb_agg(jsonb_build_object('unidades', e->'unidades', 'cm', coalesce(nullif(e->>'valorado', ''), nullif(e->>'cm', ''))::numeric) order by o)
    from jsonb_array_elements(p_lineas) with ordinality as t (e, o)));

  for v_linea, v_i in select e, o::int from jsonb_array_elements(p_lineas) with ordinality as t (e, o) order by o loop
    v_card := nullif(v_linea->>'card_id', '');
    v_prod := nullif(v_linea->>'product_id', '')::bigint;
    v_market := coalesce(nullif(v_linea->>'market', ''), 'WEST');
    v_n := (v_linea->>'unidades')::int;
    v_cm := round(nullif(v_linea->>'cm', '')::numeric, 2);
    v_valor := round(nullif(v_linea->>'valorado', '')::numeric, 2);
    if (v_card is null) = (v_prod is null) then
      raise exception 'Cada línea es una carta o un producto.' using errcode = '22023';
    end if;
    if v_n is null or v_n < 1 or v_n > 99999 then
      raise exception 'Cada línea lleva al menos una unidad.' using errcode = '22023';
    end if;
    if v_valor is not null and v_valor < 0 then
      raise exception 'Revisa lo que vale.' using errcode = '22023';
    end if;
    if v_card is not null then
      if not exists (select 1 from tcg_cards where id = v_card and market = v_market) then
        raise exception 'Una de las cartas no está en el catálogo.' using errcode = 'P0002';
      end if;
      v_idioma := coalesce(nullif(v_linea->>'idioma', ''), case when v_market = 'JP' then 'ja' else 'es' end);
      v_estado := coalesce(nullif(v_linea->>'estado', ''), 'NM');
      v_variante := coalesce(nullif(v_linea->>'variante', ''), 'normal');
      v_gradeo := nullif(btrim(coalesce(v_linea->>'gradeo', '')), '');
    else
      if not exists (select 1 from tcg_products where id = v_prod) then
        raise exception 'Uno de los productos no está en el catálogo.' using errcode = 'P0002';
      end if;
      v_idioma := coalesce(nullif(v_linea->>'idioma', ''), 'en');
      v_estado := 'sellado';
      v_variante := 'normal';
      v_gradeo := null;
    end if;

    insert into tienda_stock (tienda_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, valorado, precio, visible, por_poner, entro_el)
    values (v_uid, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_costes[v_i], v_valor, null, false, true, now())
    returning id into v_stock;

    insert into tienda_compras (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, coste, cm, cliente, pago, valorado, comprada_el, de_lote)
    values (v_uid, v_c.ticket, v_stock, v_card, v_market, v_prod, v_idioma, v_estado, v_variante, v_gradeo, v_n, v_costes[v_i], v_cm, v_c.cliente, v_c.pago, v_valor, v_c.comprada_el, p_lote);

    v_lineas := v_lineas + 1;
    v_unidades := v_unidades + v_n;
    v_total := v_total + v_costes[v_i] * v_n;
  end loop;

  delete from tienda_compras where id = v_c.id;
  update tienda_lotes set estado = 'desglosado', desglosado_el = now(), desglosadas = v_unidades where id = p_lote;

  return jsonb_build_object('lote', p_lote, 'ticket', v_c.ticket, 'lineas', v_lineas, 'unidades', v_unidades, 'total', v_total);
end;
$$;

--
-- Name: tienda_oferta_avisar(uuid, uuid, uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_oferta_avisar(p_oferta uuid, p_de uuid, p_para uuid, p_evento text, p_titulo text, p_texto text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_conv uuid := public.cambio_conversacion(p_de, p_para);
  v_es_tienda boolean := exists (select 1 from tienda_ofertas where id = p_oferta and tienda_id = p_para);
begin
  insert into private_messages (conversation_id, sender_id, body, adjuntos)
  values (v_conv, p_de, p_texto, jsonb_build_array(jsonb_build_object('tipo', 'oferta_tienda', 'oferta', p_oferta, 'evento', p_evento)));
  -- A la tienda, a su pestaña de Ofertas; a quien compra, a la conversación.
  insert into user_notifications (recipient_id, type, title, body, link)
  values (p_para, 'tienda_oferta', p_titulo, p_texto,
    case when v_es_tienda then '/tienda?ver=ofertas#oferta-' || p_oferta else '/mensajes.html?c=' || v_conv end);
end;
$$;

--
-- Name: tienda_oferta_con_paso(jsonb, text, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_oferta_con_paso(p_pasos jsonb, p_quien text, p_que text, p_precio numeric) RETURNS jsonb
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(p_pasos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('quien', p_quien, 'que', p_que, 'precio', p_precio, 'at', now()))
$$;

--
-- Name: tienda_oferta_enviar(uuid, numeric, text, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_oferta_enviar(p_stock uuid, p_precio numeric, p_envio text, p_pago text, p_unidades integer DEFAULT 1) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_s tienda_stock%rowtype;
  v_pide numeric;
  v_cond jsonb;
  v_minimo int;
  v_precio numeric := round(p_precio, 2);
  v_n int := coalesce(p_unidades, 1);
  v_envio text := coalesce(p_envio, 'mano');
  v_tipo text;
  v_coste_envio numeric := 0;
  v_o tienda_ofertas%rowtype;
  v_yo text;
  v_que text;
  v_nueva boolean := false;
begin
  if v_uid is null then
    raise exception 'Entra con tu cuenta para comprar.' using errcode = '42501';
  end if;
  if soy_tienda() then
    raise exception 'Una cuenta de tienda no compra a otras tiendas.' using errcode = '42501';
  end if;
  select * into v_s from tienda_stock where id = p_stock;
  if not found or not v_s.visible or v_s.tienda_id = v_uid or not public.tienda_publica(v_s.tienda_id) then
    raise exception 'Esa carta ya no está en la tienda.' using errcode = 'P0002';
  end if;
  if v_n < 1 or v_n > v_s.unidades then
    raise exception 'No quedan tantas: tiene %.', v_s.unidades using errcode = '22023';
  end if;
  if v_precio is null or v_precio <= 0 then
    raise exception 'Pon cuánto ofreces.' using errcode = '22023';
  end if;
  if v_envio not in ('mano', 'correo') then
    raise exception 'Elige en mano o por correo.' using errcode = '22023';
  end if;
  v_cond := public.tienda_condiciones(v_s.tienda_id);
  if p_pago is null or not (v_cond->'pagos') ? p_pago then
    raise exception 'Esta tienda no cobra así.' using errcode = '22023';
  end if;
  if p_pago = 'efectivo' and v_envio <> 'mano' then
    raise exception 'En efectivo, solo en mano.' using errcode = '22023';
  end if;
  v_pide := public.tienda_precio_de(v_s.precio, v_s.oferta_precio, v_s.oferta_hasta);
  -- Nunca más de lo que pide: «Pedir» es a su precio.
  if v_pide is not null and v_precio > v_pide then
    v_precio := v_pide;
  end if;
  v_minimo := nullif(v_cond->>'minimo', '')::int;
  if v_pide is not null and v_minimo is not null and v_precio < round(v_pide * v_minimo / 100.0, 2) then
    raise exception 'Esta tienda no mira ofertas por debajo de % €.', to_char(round(v_pide * v_minimo / 100.0, 2), 'FM999990.00') using errcode = '22023';
  end if;
  if v_envio = 'correo' then
    select t.tipo, t.precio into v_tipo, v_coste_envio from public.cambio_envio_tarifa(v_precio * v_n, v_n) t;
  end if;
  v_que := case when v_pide is not null and v_precio >= v_pide then 'pide' else 'ofrece' end;

  select * into v_o from tienda_ofertas where comprador_id = v_uid and stock_id = v_s.id and estado = 'abierta' for update;
  if found then
    update tienda_ofertas set precio = v_precio, unidades = v_n, envio = v_envio, envio_tipo = v_tipo, envio_precio = coalesce(v_coste_envio, 0), pago = p_pago,
      turno = 'tienda', caduca_at = now() + interval '48 hours', updated_at = now(),
      pasos = public.tienda_oferta_con_paso(pasos, 'comprador', v_que, v_precio)
    where id = v_o.id returning * into v_o;
  else
    v_nueva := true;
    insert into tienda_ofertas (tienda_id, comprador_id, stock_id, card_id, market, product_id, idioma, estado_carta, variante, gradeo, unidades,
      precio_tienda, precio, turno, pasos, envio, envio_tipo, envio_precio, pago, caduca_at)
    values (v_s.tienda_id, v_uid, v_s.id, v_s.card_id, v_s.market, v_s.product_id, v_s.idioma, v_s.estado, v_s.variante, v_s.gradeo, v_n,
      v_pide, v_precio, 'tienda', public.tienda_oferta_con_paso('[]'::jsonb, 'comprador', v_que, v_precio), v_envio, v_tipo, coalesce(v_coste_envio, 0), p_pago,
      now() + interval '48 hours')
    returning * into v_o;
  end if;
  select coalesce(display_name, username, 'Alguien') into v_yo from user_profiles where id = v_uid;
  perform public.tienda_oferta_avisar(v_o.id, v_uid, v_s.tienda_id, case when v_nueva then 'oferta_nueva' else 'oferta_otra' end,
    case when v_que = 'pide' then 'Te quieren comprar una carta' else 'Te han hecho una oferta' end,
    case when v_que = 'pide' then 'Te la compro a tu precio: ' else 'Te ofrezco ' end || to_char(v_precio, 'FM999990.00') || ' €' || case when v_n > 1 then ' cada una (' || v_n || ')' else '' end || '.');
  return jsonb_build_object('id', v_o.id, 'precio', v_o.precio, 'que', v_que, 'envio_precio', v_o.envio_precio);
end;
$$;

--
-- Name: tienda_oferta_paso(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_oferta_paso(p_oferta uuid, p_paso text, p_seguimiento text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_o tienda_ofertas%rowtype;
  v_r tienda_reservas%rowtype;
  v_s tienda_stock%rowtype;
  v_ticket uuid := gen_random_uuid();
  v_seg text := nullif(left(btrim(coalesce(p_seguimiento, '')), 80), '');
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo la tienda.' using errcode = '42501';
  end if;
  select * into v_o from tienda_ofertas where id = p_oferta and tienda_id = v_uid for update;
  if not found then
    raise exception 'Esa oferta no existe.' using errcode = 'P0002';
  end if;
  if v_o.estado not in ('aceptada', 'pagada') then
    raise exception 'Esa oferta no está aceptada.' using errcode = '22023';
  end if;
  if v_o.reserva_id is not null then
    select * into v_r from tienda_reservas where id = v_o.reserva_id for update;
  end if;
  if v_o.reserva_id is null or v_r.id is null then
    raise exception 'La reserva ya venció y la carta volvió al stock.' using errcode = '22023';
  end if;

  if p_paso = 'pagada' then
    update tienda_ofertas set estado = 'pagada', updated_at = now(), pasos = public.tienda_oferta_con_paso(pasos, 'tienda', 'pagada', precio) where id = v_o.id returning * into v_o;
    perform public.tienda_oferta_avisar(v_o.id, v_uid, v_o.comprador_id, 'oferta_pagada', 'Pago recibido', 'Me ha llegado el pago, gracias.');
  elsif p_paso = 'hecha' then
    -- La VENTA, como «Recogida» (1092): con el coste de la línea y «PokeDoc».
    select * into v_s from tienda_stock where id = v_r.stock_id;
    insert into tienda_ventas (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, precio, coste, donde)
    values (v_uid, v_ticket, v_s.id, v_s.card_id, v_s.market, v_s.product_id, v_s.idioma, v_s.estado, v_s.variante, v_s.gradeo, v_r.unidades, v_o.precio, v_s.coste, 'pokedoc');
    delete from tienda_reservas where id = v_r.id;
    update tienda_ofertas set estado = 'hecha', ticket = v_ticket, seguimiento = coalesce(v_seg, seguimiento), updated_at = now(),
      pasos = public.tienda_oferta_con_paso(pasos, 'tienda', case when envio = 'correo' then 'enviada' else 'entregada' end, precio)
    where id = v_o.id returning * into v_o;
    perform public.tienda_oferta_avisar(v_o.id, v_uid, v_o.comprador_id, 'oferta_hecha',
      case when v_o.envio = 'correo' then 'Tu carta va de camino' else 'Venta hecha' end,
      case when v_o.envio = 'correo' then 'Te la he mandado.' || coalesce(' Seguimiento: ' || v_o.seguimiento || '.', '') else '¡Que la disfrutes!' end);
  elsif p_paso = 'alargar' then
    if v_r.hasta + interval '7 days' > now() + interval '60 days' then
      raise exception 'Como mucho, dos meses.' using errcode = '22023';
    end if;
    update tienda_reservas set hasta = hasta + interval '7 days' where id = v_r.id;
    update tienda_ofertas set reservada_hasta = v_r.hasta + interval '7 days', updated_at = now() where id = v_o.id returning * into v_o;
  elsif p_paso = 'cancelar' then
    update tienda_stock set unidades = unidades + v_r.unidades, updated_at = now() where id = v_r.stock_id;
    delete from tienda_reservas where id = v_r.id;
    update tienda_ofertas set estado = 'cancelada', updated_at = now(), pasos = public.tienda_oferta_con_paso(pasos, 'tienda', 'cancela', precio) where id = v_o.id returning * into v_o;
    perform public.tienda_oferta_avisar(v_o.id, v_uid, v_o.comprador_id, 'oferta_cancelada', 'Venta cancelada', 'He cancelado esta venta: la carta vuelve a la tienda.');
  else
    raise exception 'No sé hacer eso con una oferta.' using errcode = '22023';
  end if;
  return jsonb_build_object('id', v_o.id, 'estado', v_o.estado, 'ticket', v_o.ticket, 'reservada_hasta', v_o.reservada_hasta);
end;
$$;

--
-- Name: tienda_oferta_responder(uuid, text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_oferta_responder(p_oferta uuid, p_accion text, p_precio numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_o tienda_ofertas%rowtype;
  v_s tienda_stock%rowtype;
  v_soy text;
  v_otro uuid;
  v_precio numeric := round(p_precio, 2);
  v_para text;
  v_reserva uuid;
  v_texto text;
  v_titulo text;
  v_evento text;
  v_tipo text;
  v_envio numeric;
begin
  if v_uid is null then
    raise exception 'Entra con tu cuenta.' using errcode = '42501';
  end if;
  select * into v_o from tienda_ofertas where id = p_oferta and (tienda_id = v_uid or comprador_id = v_uid) for update;
  if not found then
    raise exception 'Esa oferta no existe.' using errcode = 'P0002';
  end if;
  v_soy := case when v_o.tienda_id = v_uid then 'tienda' else 'comprador' end;
  v_otro := case when v_soy = 'tienda' then v_o.comprador_id else v_o.tienda_id end;
  -- (Lo caducado lo apunta `tienda_ofertas_al_dia`: aquí un `update` antes
  -- del `raise` se desharía con él.)
  if v_o.estado = 'abierta' and v_o.caduca_at <= now() then
    raise exception 'Esa oferta ha caducado: pasaron 48 horas sin respuesta.' using errcode = '22023';
  end if;
  if v_o.estado <> 'abierta' then
    raise exception 'Esa oferta ya no está abierta.' using errcode = '22023';
  end if;

  if p_accion = 'retirar' then
    if v_soy <> 'comprador' then
      raise exception 'Solo quien ofrece la retira.' using errcode = '42501';
    end if;
    update tienda_ofertas set estado = 'retirada', updated_at = now(), pasos = public.tienda_oferta_con_paso(pasos, v_soy, 'retira', precio) where id = v_o.id returning * into v_o;
    perform public.tienda_oferta_avisar(v_o.id, v_uid, v_otro, 'oferta_retirada', 'Han retirado una oferta', 'He retirado mi oferta.');
    return to_jsonb(v_o);
  end if;

  if v_o.turno <> v_soy then
    raise exception 'Ahora le toca contestar a la otra parte.' using errcode = '22023';
  end if;

  if p_accion = 'rechazar' then
    update tienda_ofertas set estado = 'rechazada', updated_at = now(), pasos = public.tienda_oferta_con_paso(pasos, v_soy, 'rechaza', precio) where id = v_o.id returning * into v_o;
    v_evento := 'oferta_rechazada'; v_titulo := 'Oferta rechazada'; v_texto := 'No me cuadra esta oferta.';
  elsif p_accion = 'contraoferta' then
    if v_precio is null or v_precio <= 0 then
      raise exception 'Pon tu precio.' using errcode = '22023';
    end if;
    if v_precio = v_o.precio then
      raise exception 'Es el mismo precio: acéptala.' using errcode = '22023';
    end if;
    if v_soy = 'tienda' and v_o.precio_tienda is not null and v_precio > v_o.precio_tienda then
      raise exception 'Como mucho, tu precio: % €.', to_char(v_o.precio_tienda, 'FM999990.00') using errcode = '22023';
    end if;
    if v_o.envio = 'correo' then
      select t.tipo, t.precio into v_tipo, v_envio from public.cambio_envio_tarifa(v_precio * v_o.unidades, v_o.unidades) t;
    end if;
    update tienda_ofertas set precio = v_precio, turno = case when v_soy = 'tienda' then 'comprador' else 'tienda' end,
      envio_tipo = coalesce(v_tipo, envio_tipo), envio_precio = coalesce(v_envio, envio_precio),
      caduca_at = now() + interval '48 hours', updated_at = now(), pasos = public.tienda_oferta_con_paso(pasos, v_soy, 'contraoferta', v_precio)
    where id = v_o.id returning * into v_o;
    v_evento := 'oferta_contraoferta'; v_titulo := 'Te han hecho una contraoferta';
    v_texto := 'Te la dejo en ' || to_char(v_precio, 'FM999990.00') || ' €.';
    if v_soy = 'comprador' then v_titulo := 'Te han hecho otra oferta'; v_texto := 'Te ofrezco ' || to_char(v_precio, 'FM999990.00') || ' €.'; end if;
  elsif p_accion = 'aceptar' then
    -- Aceptar reserva: las unidades salen del stock a nombre de quien compra.
    select * into v_s from tienda_stock where id = v_o.stock_id and tienda_id = v_o.tienda_id for update;
    if not found or v_s.unidades < v_o.unidades then
      raise exception 'Ya no quedan: se ha vendido mientras tanto.' using errcode = '22023';
    end if;
    select '@' || coalesce(username, 'cliente') into v_para from user_profiles where id = v_o.comprador_id;
    update tienda_stock set unidades = unidades - v_o.unidades, updated_at = now() where id = v_s.id;
    insert into tienda_reservas (tienda_id, stock_id, unidades, precio, para, para_usuario, nota, hasta)
    values (v_o.tienda_id, v_s.id, v_o.unidades, v_o.precio, left(coalesce(v_para, '@cliente'), 80), v_o.comprador_id, 'Oferta en PokeDoc', now() + interval '7 days')
    returning id into v_reserva;
    update tienda_ofertas set estado = 'aceptada', reserva_id = v_reserva, reservada_hasta = now() + interval '7 days', updated_at = now(),
      pasos = public.tienda_oferta_con_paso(pasos, v_soy, 'acepta', precio)
    where id = v_o.id returning * into v_o;
    v_evento := 'oferta_aceptada'; v_titulo := 'Oferta aceptada';
    v_texto := 'Hecho: ' || to_char(v_o.precio, 'FM999990.00') || ' €. Queda reservada 7 días.';
  else
    raise exception 'No sé hacer eso con una oferta.' using errcode = '22023';
  end if;
  perform public.tienda_oferta_avisar(v_o.id, v_uid, v_otro, v_evento, v_titulo, v_texto);
  return to_jsonb(v_o);
end;
$$;

--
-- Name: tienda_oferta_ver(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_oferta_ver(p_oferta uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_o tienda_ofertas%rowtype;
  v_c tienda_cobros%rowtype;
  v_soy text;
begin
  select * into v_o from tienda_ofertas where id = p_oferta and (tienda_id = v_uid or comprador_id = v_uid);
  if not found then
    return null;
  end if;
  perform public.tienda_ofertas_al_dia(v_o.tienda_id);
  select * into v_o from tienda_ofertas where id = p_oferta;
  v_soy := case when v_o.tienda_id = v_uid then 'tienda' else 'comprador' end;
  select * into v_c from tienda_cobros where tienda_id = v_o.tienda_id;
  return to_jsonb(v_o) || jsonb_build_object(
    'soy', v_soy,
    'tienda', (select jsonb_build_object('id', p.id, 'username', p.username, 'nombre', coalesce(p.display_name, p.username), 'avatar_url', p.avatar_url) from user_profiles p where p.id = v_o.tienda_id),
    'comprador', (select jsonb_build_object('id', p.id, 'username', p.username, 'nombre', coalesce(p.display_name, p.username), 'avatar_url', p.avatar_url) from user_profiles p where p.id = v_o.comprador_id),
    'cobro', case when v_soy = 'comprador' and v_o.estado in ('aceptada', 'pagada') then
      case v_o.pago when 'bizum' then v_c.bizum when 'paypal' then v_c.paypal end end,
    'coste', case when v_soy = 'tienda' then (select s.coste from tienda_stock s where s.id = v_o.stock_id) end,
    'quedan', (select s.unidades from tienda_stock s where s.id = v_o.stock_id)
  );
end;
$$;

--
-- Name: tienda_ofertas_al_dia(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_ofertas_al_dia(p_tienda uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tienda uuid := coalesce(p_tienda, auth.uid());
  v_n int := 0;
  v_m int := 0;
begin
  if v_tienda is null then
    return 0;
  end if;
  perform public.tienda_reservas_al_dia(v_tienda);
  update tienda_ofertas set estado = 'caducada', updated_at = now(),
    pasos = public.tienda_oferta_con_paso(pasos, 'nadie', 'caducada', precio)
  where tienda_id = v_tienda and estado = 'abierta' and caduca_at <= now();
  get diagnostics v_n = row_count;
  update tienda_ofertas set estado = 'caducada', updated_at = now(),
    pasos = public.tienda_oferta_con_paso(pasos, 'nadie', 'reserva_vencida', precio)
  where tienda_id = v_tienda and estado in ('aceptada', 'pagada') and reserva_id is null;
  get diagnostics v_m = row_count;
  return v_n + v_m;
end;
$$;

--
-- Name: tienda_ofertas_lista(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_ofertas_lista(p_que text DEFAULT 'responder'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  perform public.tienda_ofertas_al_dia(v_uid);
  return jsonb_build_object(
    'cuentas', jsonb_build_object(
      'responder', (select count(*) from tienda_ofertas where tienda_id = v_uid and estado = 'abierta' and turno = 'tienda'),
      'esperando', (select count(*) from tienda_ofertas where tienda_id = v_uid and estado = 'abierta' and turno = 'comprador'),
      'reservadas', (select count(*) from tienda_ofertas where tienda_id = v_uid and estado in ('aceptada', 'pagada'))
    ),
    -- Lo reservado, lo que antes vence primero; lo demás, lo último arriba.
    'filas', coalesce((select jsonb_agg(x.f order by x.k) from (
      select to_jsonb(o) || jsonb_build_object(
        'comprador', (select jsonb_build_object('id', p.id, 'username', p.username, 'nombre', coalesce(p.display_name, p.username), 'avatar_url', p.avatar_url) from user_profiles p where p.id = o.comprador_id),
        'coste', s.coste,
        'quedan', s.unidades,
        'nombre', coalesce(c.name_es, c.name, pr.name)
      ) f,
      case when p_que = 'reservadas' then extract(epoch from o.reservada_hasta) else -extract(epoch from o.updated_at) end k
      from tienda_ofertas o
      left join tienda_stock s on s.id = o.stock_id
      left join tcg_cards c on c.id = o.card_id
      left join tcg_products pr on pr.id = o.product_id
      where o.tienda_id = v_uid and case p_que
        when 'responder' then o.estado = 'abierta' and o.turno = 'tienda'
        when 'esperando' then o.estado = 'abierta' and o.turno = 'comprador'
        when 'reservadas' then o.estado in ('aceptada', 'pagada')
        else o.estado not in ('abierta', 'aceptada', 'pagada') and o.updated_at > now() - interval '60 days'
      end
      order by k
      limit 200
    ) x), '[]'::jsonb)
  );
end;
$$;

--
-- Name: tienda_pedir(text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_pedir(p_nombre text, p_ciudad text, p_email text, p_contacto text DEFAULT NULL::text, p_web text DEFAULT NULL::text, p_tamano text DEFAULT NULL::text, p_instagram text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_ciudad text := nullif(btrim(coalesce(p_ciudad, '')), '');
  v_ig text := public.tienda_instagram(p_instagram);
  v_id uuid;
begin
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 80 then
    raise exception 'Escribe el nombre de la tienda.' using errcode = '22023';
  end if;
  if v_ciudad is not null and (char_length(v_ciudad) < 2 or char_length(v_ciudad) > 80) then
    raise exception 'Escribe la ciudad entera, o déjala vacía.' using errcode = '22023';
  end if;
  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or char_length(v_email) > 160 then
    raise exception 'Revisa que el email sea correcto.' using errcode = '22023';
  end if;

  -- Ya hay una viva con ese email: no se repite.
  if exists (
    select 1 from tienda_solicitudes
    where lower(email) = v_email and estado in ('pendiente', 'aceptada', 'usada')
  ) then
    return jsonb_build_object('ok', true);
  end if;

  if (select count(*) from tienda_solicitudes where created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Ahora mismo llegan demasiadas solicitudes. Prueba dentro de un rato.' using errcode = '54000';
  end if;

  insert into tienda_solicitudes (nombre, ciudad, email, contacto, web, tamano, instagram)
  values (
    v_nombre, v_ciudad, v_email,
    nullif(left(btrim(coalesce(p_contacto, '')), 80), ''),
    nullif(left(btrim(coalesce(p_web, '')), 160), ''),
    case when p_tamano in ('poca', 'media', 'mucha') then p_tamano end,
    v_ig
  )
  returning id into v_id;

  -- La campanita del equipo.
  insert into user_notifications (recipient_id, type, title, body, link)
  select id, 'tienda_solicitud', 'Una tienda pide acceso',
    left(v_nombre || coalesce(' · ' || v_ciudad, ''), 200), '/admin/?ver=tiendas'
  from user_profiles where is_admin = true;

  return jsonb_build_object('ok', true);
end;
$_$;

--
-- Name: tienda_pedir_fotos(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_pedir_fotos(p_stock uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_s tienda_stock%rowtype;
  v_f tienda_stock_fotos%rowtype;
  v_id uuid;
  v_nombre text;
begin
  if v_uid is null then
    raise exception 'Entra con tu cuenta para pedir fotos.' using errcode = '42501';
  end if;
  select * into v_s from tienda_stock where id = p_stock;
  if not found or not v_s.visible or v_s.unidades < 1 or v_s.tienda_id = v_uid or not public.tienda_publica(v_s.tienda_id) then
    raise exception 'Esa carta ya no está en la tienda.' using errcode = 'P0002';
  end if;
  select * into v_f from tienda_stock_fotos where stock_id = p_stock;
  if v_f.frente is not null and v_f.dorso is not null then
    return jsonb_build_object('ya_tiene', true);
  end if;
  select id into v_id from tienda_fotos_pedidas where comprador_id = v_uid and stock_id = p_stock and atendida_at is null;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'ya_pedidas', true);
  end if;
  insert into tienda_fotos_pedidas (tienda_id, comprador_id, stock_id) values (v_s.tienda_id, v_uid, v_s.id) returning id into v_id;
  select coalesce(c.name_es, c.name, p.name, 'una carta') into v_nombre
  from tienda_stock s left join tcg_cards c on c.id = s.card_id left join tcg_products p on p.id = s.product_id where s.id = v_s.id;
  perform public.tienda_fotos_avisar(v_s.id, v_uid, v_s.tienda_id, 'fotos_pedidas', 'Te piden fotos',
    '¿Me enseñas fotos de ' || v_nombre || ' (' || upper(v_s.idioma) || ' · ' || coalesce(v_s.gradeo, v_s.estado) || ')? Por delante y por detrás.',
    '/tienda?ver=ofertas#fotos-' || v_id);
  return jsonb_build_object('id', v_id);
end;
$$;

--
-- Name: tienda_poner_a_la_venta(uuid[], numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_poner_a_la_venta(p_ids uuid[], p_precio numeric DEFAULT NULL::numeric) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_puestas int := 0;
  v_sin int := 0;
  v_s record;
  v_precio numeric;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda.' using errcode = '42501';
  end if;
  if p_precio is not null and p_precio < 0 then
    raise exception 'Revisa el precio.' using errcode = '22023';
  end if;
  for v_s in select id, precio, valorado from tienda_stock
    where tienda_id = v_uid and por_poner and id = any (coalesce(p_ids, '{}')) for update loop
    v_precio := round(coalesce(p_precio, v_s.precio, v_s.valorado), 2);
    if v_precio is null then
      v_sin := v_sin + 1;
      continue;
    end if;
    update tienda_stock set precio = v_precio, visible = true, por_poner = false, updated_at = now() where id = v_s.id;
    v_puestas := v_puestas + 1;
  end loop;
  return jsonb_build_object('puestas', v_puestas, 'sin_precio', v_sin);
end;
$$;

--
-- Name: tienda_por_avisar(uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_por_avisar(p_tienda uuid, p_card text, p_market text) RETURNS TABLE(user_id uuid)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select distinct w.user_id
  from user_wants w
  join user_profiles u on u.id = w.user_id
  where w.card_id = p_card and w.user_id <> p_tienda
    and exists (select 1 from tienda_stock s
      where s.tienda_id = p_tienda and s.card_id = p_card and s.market = p_market and s.unidades > 0 and s.visible
        and (w.idioma is null or w.idioma = s.idioma) and (w.variante is null or w.variante = s.variante))
    and coalesce(u.tipo, 'persona') <> 'tienda'
    and not exists (select 1 from tiendas t where t.user_id = p_tienda and t.de_pruebas)
    and not (coalesce(u.notification_prefs_disabled, '{}') @> array['tienda_la_tiene'])
    and not exists (select 1 from tienda_avisos a
      where a.tienda_id = p_tienda and a.card_id = p_card and a.market = p_market and a.user_id = w.user_id)
$$;

--
-- Name: tienda_precio_de(numeric, numeric, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_precio_de(p_precio numeric, p_oferta numeric, p_hasta timestamp with time zone) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
  select case when p_oferta is not null and (p_hasta is null or p_hasta > now()) then p_oferta else p_precio end
$$;

--
-- Name: tienda_publica(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_publica(p_tienda uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  -- `coalesce`: sin cuenta, `auth.uid()` es NULL y la comparación también; en
  -- un `where` NULL no deja pasar, pero en el `if` del escaparate NULL no
  -- entra en la rama y la de pruebas se enseñaba a quien no tiene cuenta.
  select coalesce(p_tienda = auth.uid(), false)
      or not exists (select 1 from tiendas t where t.user_id = p_tienda and t.de_pruebas)
$$;

--
-- Name: tienda_redondear(numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_redondear(p numeric, p_modo text) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select case
    when p is null then null
    when p_modo = '95' then greatest(floor(p) + 0.95 - case when p - floor(p) > 0.95 then -1 else 0 end, 0.95)
    when p_modo = '99' then greatest(floor(p) + 0.99 - case when p - floor(p) > 0.99 then -1 else 0 end, 0.99)
    when p_modo = 'entero' then ceil(p)
    else round(p, 2)
  end
$$;

--
-- Name: tienda_repartir(numeric, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_repartir(p_total numeric, p_lineas jsonb) RETURNS numeric[]
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
declare
  v_t bigint;
  v_k int;
  v_n int[] := '{}';
  v_cm numeric[] := '{}';
  v_pesos numeric[] := '{}';
  v_por bigint[] := '{}';
  v_res numeric[] := '{}';
  v_x jsonb;
  v_v numeric;
  v_con int := 0;
  v_sumcm numeric := 0;
  v_media numeric;
  v_suma numeric := 0;
  v_resto bigint;
  v_una int := 0;
  v_q bigint;
  i int;
begin
  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' then
    return '{}';
  end if;
  v_k := jsonb_array_length(p_lineas);
  for v_x in select * from jsonb_array_elements(p_lineas) loop
    v_n := array_append(v_n, greatest(0, round(coalesce(nullif(v_x->>'unidades', '')::numeric, 0)))::int);
    v_v := nullif(v_x->>'cm', '')::numeric;
    v_cm := array_append(v_cm, case when v_v > 0 then v_v end);
  end loop;
  v_t := round(p_total * 100);
  if p_total is null or v_t < 0 or v_k = 0 or not exists (select 1 from unnest(v_n) z where z > 0) then
    return array_fill(null::numeric, array[v_k]);
  end if;
  for i in 1..v_k loop
    if v_cm[i] is not null and v_n[i] > 0 then
      v_con := v_con + 1;
      v_sumcm := v_sumcm + v_cm[i];
    end if;
  end loop;
  v_media := case when v_con > 0 then v_sumcm / v_con else 1 end;
  for i in 1..v_k loop
    v_pesos := array_append(v_pesos, case when v_n[i] > 0 then coalesce(v_cm[i], v_media) * v_n[i] else 0 end);
    v_suma := v_suma + v_pesos[i];
  end loop;
  for i in 1..v_k loop
    v_por := array_append(v_por, case when v_n[i] > 0 then floor(v_t * v_pesos[i] / v_suma / v_n[i])::bigint else 0 end);
  end loop;
  v_resto := v_t;
  for i in 1..v_k loop
    v_resto := v_resto - v_por[i] * v_n[i];
  end loop;
  for i in 1..v_k loop
    if v_n[i] = 1 then
      v_una := i;
      exit;
    end if;
  end loop;
  if v_una > 0 then
    v_por[v_una] := v_por[v_una] + v_resto;
  else
    for i in 1..v_k loop
      exit when v_resto < v_n[i];
      continue when v_n[i] = 0;
      v_q := v_resto / v_n[i];
      v_por[i] := v_por[i] + v_q;
      v_resto := v_resto - v_q * v_n[i];
    end loop;
  end if;
  for i in 1..v_k loop
    v_res := array_append(v_res, case when v_n[i] > 0 then round(v_por[i] / 100.0, 2) end);
  end loop;
  return v_res;
end;
$$;

--
-- Name: tienda_reserva_quitar(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_reserva_quitar(p_reserva uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_r tienda_reservas%rowtype;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda aparta.' using errcode = '42501';
  end if;
  select * into v_r from tienda_reservas where id = p_reserva and tienda_id = v_uid for update;
  if not found then
    raise exception 'Eso ya no está apartado.' using errcode = 'P0002';
  end if;
  update tienda_stock set unidades = unidades + v_r.unidades, updated_at = now() where id = v_r.stock_id and tienda_id = v_uid;
  delete from tienda_reservas where id = v_r.id;
  return jsonb_build_object('devueltas', v_r.unidades);
end;
$$;

--
-- Name: tienda_reserva_recoger(uuid, numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_reserva_recoger(p_reserva uuid, p_precio numeric DEFAULT NULL::numeric, p_donde text DEFAULT 'mostrador'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_r tienda_reservas%rowtype;
  v_stock tienda_stock%rowtype;
  v_ticket uuid := gen_random_uuid();
  v_precio numeric;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda vende.' using errcode = '42501';
  end if;
  if coalesce(p_donde, '') not in ('mostrador', 'cardmarket', 'evento', 'otro') then
    raise exception 'Ese sitio de venta no existe.' using errcode = '22023';
  end if;
  select * into v_r from tienda_reservas where id = p_reserva and tienda_id = v_uid for update;
  if not found then
    raise exception 'Eso ya no está apartado.' using errcode = 'P0002';
  end if;
  select * into v_stock from tienda_stock where id = v_r.stock_id;
  v_precio := round(coalesce(p_precio, v_r.precio), 2);
  if v_precio is null or v_precio < 0 then
    raise exception 'Pon el precio al que la vendes.' using errcode = '22023';
  end if;
  -- Las unidades ya salieron del stock al apartarla: solo se apunta la venta.
  insert into tienda_ventas (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, precio, coste, donde)
  values (v_uid, v_ticket, v_stock.id, v_stock.card_id, v_stock.market, v_stock.product_id, v_stock.idioma, v_stock.estado, v_stock.variante, v_stock.gradeo,
    v_r.unidades, v_precio, v_stock.coste, p_donde);
  delete from tienda_reservas where id = v_r.id;
  return jsonb_build_object('ticket', v_ticket, 'lineas', 1, 'total', v_precio * v_r.unidades,
    'beneficio', case when v_stock.coste is null then 0 else (v_precio - v_stock.coste) * v_r.unidades end,
    'sin_coste', case when v_stock.coste is null then 1 else 0 end);
end;
$$;

--
-- Name: tienda_reservas_al_dia(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_reservas_al_dia(p_tienda uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tienda uuid := coalesce(p_tienda, auth.uid());
  v_n int := 0;
  v_r record;
begin
  if v_tienda is null then
    return 0;
  end if;
  for v_r in select * from tienda_reservas where tienda_id = v_tienda and hasta <= now() for update skip locked loop
    update tienda_stock set unidades = unidades + v_r.unidades, updated_at = now() where id = v_r.stock_id;
    delete from tienda_reservas where id = v_r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

--
-- Name: tienda_reservas_lista(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_reservas_lista() RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda aparta.' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'stock_id', r.stock_id, 'unidades', r.unidades, 'precio', r.precio,
      'para', r.para, 'para_usuario', r.para_usuario, 'para_username', u.username, 'nota', r.nota, 'hasta', r.hasta,
      'card_id', s.card_id, 'market', s.market, 'product_id', s.product_id, 'idioma', s.idioma, 'estado', s.estado,
      'variante', s.variante, 'gradeo', s.gradeo, 'coste', s.coste,
      'nombre', coalesce(c.name_es, c.name, p.name), 'set_id', c.set_id, 'numero', c.local_id
    ) order by r.hasta, r.created_at), '[]'::jsonb)
    from tienda_reservas r
    join tienda_stock s on s.id = r.stock_id
    left join user_profiles u on u.id = r.para_usuario
    left join tcg_cards c on c.id = s.card_id and c.market = s.market
    left join tcg_products p on p.id = s.product_id
    where r.tienda_id = v_uid
  );
end;
$$;

--
-- Name: tienda_sku(text, text, text, text, text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_sku(p_codigo text, p_set text, p_numero text, p_idioma text, p_estado text, p_gradeo text, p_variante text, p_producto text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
  select case
    when nullif(p_producto, '') is not null then
      concat_ws('-', 'SEL', public.tienda_sku_limpio(p_producto), nullif(public.tienda_sku_limpio(coalesce(nullif(p_idioma, ''), 'es')), ''))
    else concat_ws('-',
      coalesce(nullif(public.tienda_sku_limpio(p_codigo), ''), nullif(public.tienda_sku_limpio(p_set), ''), 'X'),
      -- El número tal como va impreso, sin el total ni los ceros de delante.
      (select case when n ~ '^[0-9]+$' then coalesce(nullif(ltrim(n, '0'), ''), '0')
                   else coalesce(nullif(public.tienda_sku_limpio(n), ''), '0') end
         from (select split_part(coalesce(p_numero, ''), '/', 1) as n) q),
      nullif(public.tienda_sku_limpio(coalesce(nullif(p_idioma, ''), 'es')), ''),
      nullif(case when nullif(p_gradeo, '') is not null then public.tienda_sku_limpio(p_gradeo)
                  else public.tienda_sku_limpio(coalesce(nullif(p_estado, ''), 'NM')) end, ''),
      nullif(public.tienda_sku_version(p_variante), ''))
  end
$_$;

--
-- Name: tienda_sku_buscar(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_sku_buscar(p_tienda uuid, p_sku text) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_tienda uuid := coalesce(p_tienda, auth.uid());
  v_mia boolean;
  v_sku text := upper(regexp_replace(coalesce(p_sku, ''), '[^A-Za-z0-9-]', '', 'g'));
begin
  if v_tienda is null or v_sku = '' then
    return '[]'::jsonb;
  end if;
  v_mia := v_tienda = auth.uid();
  if not v_mia and not public.tienda_publica(v_tienda) then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(x.f order by x.k1, x.k2) from (
    select jsonb_build_object(
      'id', s.id, 'card_id', s.card_id, 'market', s.market, 'product_id', s.product_id,
      'idioma', s.idioma, 'estado', s.estado, 'variante', s.variante, 'gradeo', s.gradeo,
      'unidades', s.unidades, 'visible', s.visible,
      'precio', public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta),
      'nombre', coalesce(c.name_es, c.name, p.name), 'sku', v_sku
    ) f,
    case when s.unidades > 0 then 0 else 1 end k1,
    coalesce(public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta), 1e9) k2
    from tienda_stock s
    left join tcg_cards c on c.id = s.card_id
    left join tcg_sets st on st.id = c.set_id and st.market = c.market
    left join tcg_products p on p.id = s.product_id
    where s.tienda_id = v_tienda
      and (v_mia or (s.visible and s.unidades > 0))
      and public.tienda_sku(st.tcg_online_code, c.set_id, c.local_id, s.idioma, s.estado, s.gradeo, s.variante, s.product_id::text) = v_sku
    limit 50
  ) x), '[]'::jsonb);
end;
$$;

--
-- Name: tienda_sku_de(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_sku_de(p_stock uuid) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select public.tienda_sku(st.tcg_online_code, c.set_id, c.local_id, s.idioma, s.estado, s.gradeo, s.variante, s.product_id::text)
  from tienda_stock s
  left join tcg_cards c on c.id = s.card_id
  left join tcg_sets st on st.id = c.set_id and st.market = c.market
  -- La de otra tienda, solo si su escaparate la enseña.
  where s.id = p_stock and (s.tienda_id = auth.uid() or (s.visible and public.tienda_publica(s.tienda_id)))
$$;

--
-- Name: tienda_sku_limpio(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_sku_limpio(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select regexp_replace(public.immutable_unaccent(upper(coalesce(p, ''))), '[^A-Z0-9]', '', 'g')
$$;

--
-- Name: tienda_sku_version(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_sku_version(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  select case lower(coalesce(nullif(p, ''), 'normal'))
    when 'normal' then ''
    when 'reverse' then 'R'
    when 'holo' then 'H'
    when 'primera' then '1E'
    else upper(coalesce((
      select string_agg(case when t ~ '^[0-9]' then t else left(t, 1) end, '' order by i)
      from regexp_split_to_table(lower(p), '[^a-z0-9]+') with ordinality as x(t, i)
      where t <> ''), ''))
  end
$$;

--
-- Name: tienda_stock_lista(jsonb, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_stock_lista(p_filtros jsonb DEFAULT '{}'::jsonb, p_orden text DEFAULT 'recientes'::text, p_desde integer DEFAULT 0, p_cuantas integer DEFAULT 50) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda tiene stock.' using errcode = '42501';
  end if;

  with
  base as (
    select s.*,
      coalesce(c.set_id, null) as set_id,
      coalesce(c.rarity_en, c.rarity) as rareza,
      c.local_id as numero,
      case when s.product_id is not null then 'sellado' else s.market end as catalogo,
      lower(coalesce(c.name_search, '') || ' ' || coalesce(pr_nombre.n, '')) as texto,
      coalesce(c.name_es, c.name, pr_nombre.n) as nombre,
      case
        when s.product_id is not null then pr_nombre.cm
        else public.valor_de_copia(
          jsonb_populate_record(null::public.user_collection, jsonb_build_object('cantidad', 1, 'variante', s.variante, 'idioma', s.idioma, 'gradeo', s.gradeo)),
          pr)
      end as cm
    from tienda_stock s
    left join tcg_cards c on c.id = s.card_id and c.market = s.market
    left join tcg_card_prices pr on pr.card_id = s.card_id
    left join lateral (
      select p.name as n, coalesce(p.cm_lowest_es, p.cm_lowest_eu, p.cm_lowest) as cm
      from tcg_products p where p.id = s.product_id
    ) pr_nombre on true
    where s.tienda_id = v_uid
  ),
  marcada as (
    select b.*,
      public.tienda_cumple(p_filtros, '', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza,
        b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el) as pasa
    from base b
  ),
  filtrada as (select * from marcada where pasa),
  ordenada as (
    select f.*, row_number() over (
      order by
        case when p_orden = 'nombre' then f.nombre end asc nulls last,
        case when p_orden = 'precio_desc' then f.precio end desc nulls last,
        case when p_orden = 'precio_asc' then f.precio end asc nulls last,
        case when p_orden = 'cm_desc' then f.cm end desc nulls last,
        case when p_orden = 'margen_desc' then (f.precio - f.coste) / nullif(f.coste, 0) end desc nulls last,
        case when p_orden = 'margen_asc' then (f.precio - f.coste) / nullif(f.coste, 0) end asc nulls last,
        case when p_orden = 'antiguas' then f.entro_el end asc,
        case when p_orden = 'unidades' then f.unidades end desc,
        f.entro_el desc, f.id
    ) as puesto
    from filtrada f
  ),
  -- Cuántas deja cada opción de un grupo, con los OTROS grupos puestos.
  facetas as (
    select 'catalogo' as grupo, catalogo as valor, count(*) as n from base b
      where public.tienda_cumple(p_filtros, 'catalogo', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by catalogo
    union all
    select 'sets', set_id, count(*) from base b
      where set_id is not null and public.tienda_cumple(p_filtros, 'sets', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by set_id
    union all
    select 'idioma', idioma, count(*) from base b
      where public.tienda_cumple(p_filtros, 'idioma', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by idioma
    union all
    select 'estado', estado, count(*) from base b
      where public.tienda_cumple(p_filtros, 'estado', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by estado
    union all
    select 'variante', variante, count(*) from base b
      where public.tienda_cumple(p_filtros, 'variante', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by variante
    union all
    select 'rareza', rareza, count(*) from base b
      where rareza is not null and public.tienda_cumple(p_filtros, 'rareza', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by rareza
    union all
    select 'ubicacion', ubicacion, count(*) from base b
      where ubicacion is not null and public.tienda_cumple(p_filtros, 'ubicacion', b.texto, b.numero, b.catalogo, b.set_id, b.idioma, b.estado, b.variante, b.rareza, b.ubicacion, b.precio, b.coste, b.cm, b.unidades, b.gradeo, b.visible, b.entro_el)
      group by ubicacion
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'en_stock', (select count(*) from base),
    'destacadas', (select count(*) from base where destacada),
    'sumas', jsonb_build_object(
      'unidades', (select coalesce(sum(unidades), 0) from filtrada),
      'coste', (select coalesce(sum(coste * unidades), 0) from filtrada),
      'precio', (select coalesce(sum(precio * unidades), 0) from filtrada),
      'cm', (select coalesce(sum(cm * unidades), 0) from filtrada),
      'sin_coste', (select count(*) from filtrada where coste is null),
      'sin_precio', (select count(*) from filtrada where precio is null)
    ),
    'facetas', coalesce((select jsonb_object_agg(grupo, valores) from (
      select grupo, jsonb_object_agg(valor, n) as valores from facetas group by grupo
    ) g), '{}'::jsonb),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'card_id', card_id, 'market', market, 'product_id', product_id, 'nombre', nombre,
      'set_id', set_id, 'numero', numero, 'rareza', rareza,
      'idioma', idioma, 'estado', estado, 'variante', variante, 'gradeo', gradeo,
      'unidades', unidades, 'coste', coste, 'precio', precio, 'cm', round(cm, 2),
      'ubicacion', ubicacion, 'visible', visible, 'notas', notas, 'entro_el', entro_el,
      'destacada', destacada, 'oferta_precio', oferta_precio, 'oferta_hasta', oferta_hasta,
      'en_oferta', (oferta_precio is not null and (oferta_hasta is null or oferta_hasta > now()))
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 50), 1), 5000)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

--
-- Name: tienda_stock_precio_bloque(uuid[], numeric, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_stock_precio_bloque(p_ids uuid[], p_pct numeric, p_redondeo text DEFAULT 'centimo'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_hechas int;
  v_sin int;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda tiene stock.' using errcode = '42501';
  end if;
  if p_pct is null or p_pct < -90 or p_pct > 1000 then
    raise exception 'El porcentaje tiene que estar entre −90 y 1000.' using errcode = '22023';
  end if;

  with valores as (
    select s.id,
      case
        when s.product_id is not null then (select coalesce(p.cm_lowest_es, p.cm_lowest_eu, p.cm_lowest) from tcg_products p where p.id = s.product_id)
        else public.valor_de_copia(
          jsonb_populate_record(null::public.user_collection, jsonb_build_object('cantidad', 1, 'variante', s.variante, 'idioma', s.idioma, 'gradeo', s.gradeo)),
          pr)
      end as cm
    from tienda_stock s
    left join tcg_card_prices pr on pr.card_id = s.card_id
    where s.tienda_id = v_uid and s.id = any(p_ids)
  ),
  cambio as (
    update tienda_stock s
      set precio = tienda_redondear(v.cm * (1 + p_pct / 100), p_redondeo), updated_at = now()
      from valores v
      where s.id = v.id and v.cm is not null and v.cm > 0
      returning s.id
  )
  select (select count(*) from cambio), (select count(*) from valores where cm is null or cm = 0)
    into v_hechas, v_sin;

  return jsonb_build_object('cambiadas', v_hechas, 'sin_cardmarket', v_sin);
end;
$$;

--
-- Name: tienda_stock_tope_destacadas(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_stock_tope_destacadas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  if new.destacada and (tg_op = 'INSERT' or not old.destacada) then
    if (select count(*) from public.tienda_stock where tienda_id = new.tienda_id and destacada and id <> new.id) >= 8 then
      raise exception 'Como mucho 8 destacadas: quita la estrella a otra antes.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

--
-- Name: tienda_vender(jsonb, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_vender(p_lineas jsonb, p_donde text DEFAULT 'mostrador'::text, p_pago text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_ticket uuid := gen_random_uuid();
  v_pago text := nullif(btrim(coalesce(p_pago, '')), '');
  v_linea jsonb;
  v_stock tienda_stock%rowtype;
  v_n int;
  v_precio numeric;
  v_lista numeric;
  v_total numeric := 0;
  v_beneficio numeric := 0;
  v_rebaja numeric := 0;
  v_sin_coste int := 0;
  v_lineas int := 0;
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda vende.' using errcode = '42501';
  end if;
  if coalesce(p_donde, '') not in ('mostrador', 'cardmarket', 'evento', 'otro') then
    raise exception 'Ese sitio de venta no existe.' using errcode = '22023';
  end if;
  if v_pago is not null and v_pago not in ('efectivo', 'tarjeta', 'bizum', 'paypal') then
    raise exception 'Esa forma de pago no existe.' using errcode = '22023';
  end if;
  if jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    raise exception 'No hay nada que vender.' using errcode = '22023';
  end if;
  if jsonb_array_length(p_lineas) > 200 then
    raise exception 'Como mucho 200 líneas por venta.' using errcode = '22023';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_n := (v_linea->>'unidades')::int;
    v_precio := round((v_linea->>'precio')::numeric, 2);
    if v_n is null or v_n < 1 then
      raise exception 'Cada línea vende al menos una unidad.' using errcode = '22023';
    end if;
    if v_precio is null or v_precio < 0 then
      raise exception 'Cada línea lleva su precio.' using errcode = '22023';
    end if;
    -- Bloqueada: dos ventas a la vez de la última copia no la venden dos veces.
    select * into v_stock from tienda_stock
      where id = (v_linea->>'stock_id')::uuid and tienda_id = v_uid
      for update;
    if not found then
      raise exception 'Una de las cartas ya no está en tu stock.' using errcode = 'P0002';
    end if;
    if v_stock.unidades < v_n then
      raise exception 'No quedan tantas: de una línea hay %.', v_stock.unidades using errcode = '22023';
    end if;
    v_lista := public.tienda_precio_de(v_stock.precio, v_stock.oferta_precio, v_stock.oferta_hasta);
    update tienda_stock set unidades = unidades - v_n, updated_at = now() where id = v_stock.id;
    insert into tienda_ventas (tienda_id, ticket, stock_id, card_id, market, product_id, idioma, estado, variante, gradeo, unidades, precio, coste, donde, pago, precio_lista)
    values (v_uid, v_ticket, v_stock.id, v_stock.card_id, v_stock.market, v_stock.product_id, v_stock.idioma, v_stock.estado, v_stock.variante, v_stock.gradeo, v_n, v_precio, v_stock.coste, p_donde, v_pago, v_lista);
    v_lineas := v_lineas + 1;
    v_total := v_total + v_precio * v_n;
    if v_lista is not null and v_lista > v_precio then
      v_rebaja := v_rebaja + (v_lista - v_precio) * v_n;
    end if;
    if v_stock.coste is null then
      v_sin_coste := v_sin_coste + 1;
    else
      v_beneficio := v_beneficio + (v_precio - v_stock.coste) * v_n;
    end if;
  end loop;

  return jsonb_build_object('ticket', v_ticket, 'lineas', v_lineas, 'total', v_total, 'beneficio', v_beneficio,
    'sin_coste', v_sin_coste, 'rebaja', v_rebaja, 'pago', v_pago);
end;
$$;

--
-- Name: tienda_ventas_lista(jsonb, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tienda_ventas_lista(p_filtros jsonb DEFAULT '{}'::jsonb, p_desde integer DEFAULT 0, p_cuantas integer DEFAULT 100) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_uid uuid := auth.uid();
  v_res jsonb;
  v_q text := lower(btrim(coalesce(p_filtros->>'q', '')));
begin
  if v_uid is null or not soy_tienda() then
    raise exception 'Solo una cuenta de tienda vende.' using errcode = '42501';
  end if;

  with
  base as (
    select v.*,
      c.set_id, c.local_id as numero,
      coalesce(c.name_es, c.name, p.name) as nombre,
      lower(coalesce(c.name_search, '') || ' ' || coalesce(p.name, '')) as texto
    from tienda_ventas v
    left join tcg_cards c on c.id = v.card_id and c.market = v.market
    left join tcg_products p on p.id = v.product_id
    where v.tienda_id = v_uid
      and (p_filtros->>'desde' is null or v.vendida_el >= (p_filtros->>'desde')::timestamptz)
      and (p_filtros->>'hasta' is null or v.vendida_el < (p_filtros->>'hasta')::timestamptz)
      and (jsonb_typeof(p_filtros->'donde') is distinct from 'array' or jsonb_array_length(p_filtros->'donde') = 0 or (p_filtros->'donde') ? v.donde)
  ),
  filtrada as (
    select * from base b
    where v_q = '' or b.numero = v_q or not exists (
      select 1 from unnest(regexp_split_to_array(v_q, '\s+')) palabra where position(palabra in b.texto) = 0
    )
  ),
  ordenada as (
    select f.*, row_number() over (order by f.vendida_el desc, f.ticket, f.id) as puesto from filtrada f
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrada),
    'tickets', (select count(distinct ticket) from filtrada),
    'sumas', jsonb_build_object(
      'unidades', (select coalesce(sum(unidades), 0) from filtrada),
      'importe', (select coalesce(sum(precio * unidades), 0) from filtrada),
      'coste', (select coalesce(sum(coste * unidades), 0) from filtrada where coste is not null),
      'importe_con_coste', (select coalesce(sum(precio * unidades), 0) from filtrada where coste is not null),
      'beneficio', (select coalesce(sum((precio - coste) * unidades), 0) from filtrada where coste is not null),
      'sin_coste', (select count(*) from filtrada where coste is null)
    ),
    'por_donde', coalesce((select jsonb_object_agg(donde, importe) from (
      select donde, sum(precio * unidades) as importe from filtrada group by donde
    ) d), '{}'::jsonb),
    'filas', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'ticket', ticket, 'stock_id', stock_id, 'card_id', card_id, 'market', market, 'product_id', product_id,
      'nombre', nombre, 'set_id', set_id, 'numero', numero,
      'idioma', idioma, 'estado', estado, 'variante', variante, 'gradeo', gradeo,
      'unidades', unidades, 'precio', precio, 'coste', coste, 'donde', donde, 'pago', pago, 'vendida_el', vendida_el
    ) order by puesto) from ordenada
      where puesto > greatest(coalesce(p_desde, 0), 0)
        and puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 100), 1), 5000)), '[]'::jsonb)
  ) into v_res;
  return v_res;
end;
$$;

--
-- Name: tiendas_agenda(text, text, boolean, boolean, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tiendas_agenda(p_texto text DEFAULT NULL::text, p_ciudad text DEFAULT NULL::text, p_con_local boolean DEFAULT false, p_de_mi_lista boolean DEFAULT false, p_desde integer DEFAULT 0, p_cuantas integer DEFAULT 24) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with base as (
    select p.id as user_id, p.username, p.display_name, p.avatar_url, p.banner_url,
           nullif(trim(t.ciudad), '') as ciudad,
           nullif(trim(t.direccion), '') is not null as con_local,
           nullif(trim(t.horario), '') as horario,
           nullif(trim(t.web), '') as web,
           nullif(trim(t.instagram), '') as instagram,
           coalesce(t.precio_visible, true) as precios,
           (select count(*) from tienda_stock s
             where s.tienda_id = p.id and s.visible and s.unidades > 0 and s.card_id is not null)::int as cartas,
           (select count(*) from tienda_stock s
             where s.tienda_id = p.id and s.visible and s.unidades > 0 and s.product_id is not null)::int as productos,
           (case when auth.uid() is null then 0 else
             (select count(distinct s.card_id) from tienda_stock s
               where s.tienda_id = p.id and s.visible and s.unidades > 0 and s.card_id is not null
                 and exists (select 1 from user_wants w
                   where w.user_id = auth.uid() and w.card_id = s.card_id
                     and (w.idioma is null or w.idioma = s.idioma)
                     and (w.variante is null or w.variante = s.variante))) end)::int as de_tu_lista,
           (select max(s.updated_at) from tienda_stock s where s.tienda_id = p.id and s.visible) as ultima
    from user_profiles p
    left join tiendas t on t.user_id = p.id
    where p.tipo = 'tienda' and not coalesce(p.is_banned, false) and public.tienda_publica(p.id)
  ),
  buscado as (
    select public.immutable_unaccent(lower(trim(coalesce(p_texto, '')))) as q
  ),
  cumplen as (
    select b.* from base b, buscado
    where (buscado.q = ''
           or public.immutable_unaccent(lower(coalesce(b.display_name, '') || ' ' || coalesce(b.username, '') || ' ' || coalesce(b.ciudad, '')))
                like '%' || buscado.q || '%'
           -- Por carta (1244): la tienda que la tiene a la vista.
           or exists (select 1 from tienda_stock s
                      join tcg_cards c on c.id = s.card_id and c.market = s.market
                      where s.tienda_id = b.user_id and s.visible and s.unidades > 0
                        and coalesce(c.name_search, '') like '%' || buscado.q || '%'))
      and (coalesce(trim(p_ciudad), '') = '' or lower(b.ciudad) = lower(trim(p_ciudad)))
      and (not coalesce(p_con_local, false) or b.con_local)
      and (not coalesce(p_de_mi_lista, false) or b.de_tu_lista > 0)
  ),
  ordenadas as (
    select c.*, row_number() over (
             order by c.de_tu_lista desc, (c.cartas + c.productos > 0) desc, c.ultima desc nulls last,
                      lower(coalesce(c.display_name, c.username)), c.user_id) as puesto
    from cumplen c
  ),
  pagina as (
    select * from ordenadas o
    where o.puesto > greatest(coalesce(p_desde, 0), 0)
      and o.puesto <= greatest(coalesce(p_desde, 0), 0) + least(greatest(coalesce(p_cuantas, 24), 1), 100)
  )
  select jsonb_build_object(
    'total', (select count(*) from cumplen),
    'ciudades', coalesce((select jsonb_object_agg(ciudad, n) from (
        select ciudad, count(*) as n from base where ciudad is not null group by ciudad) x), '{}'::jsonb),
    -- La banda (1244): de TODAS, no de las que cumplen los filtros.
    'cifras', jsonb_build_object(
      'tiendas', (select count(*) from base),
      'ciudades', (select count(distinct lower(ciudad)) from base where ciudad is not null),
      'cartas', (select coalesce(sum(cartas), 0) from base)),
    'tiendas', coalesce((select jsonb_agg(jsonb_build_object(
        'user_id', o.user_id, 'username', o.username, 'display_name', o.display_name,
        'avatar_url', o.avatar_url, 'banner_url', o.banner_url, 'ciudad', o.ciudad,
        'con_local', o.con_local, 'online', not o.con_local,
        'horario', o.horario, 'web', o.web, 'instagram', o.instagram,
        'cartas', o.cartas, 'productos', o.productos, 'de_tu_lista', o.de_tu_lista,
        'precios', o.precios,
        -- Sus cuatro de escaparate: las destacadas primero y, si faltan, lo
        -- último. Con el precio que cuenta, y solo si la tienda lo enseña.
        'destacadas', coalesce((
          select jsonb_agg(jsonb_build_object(
              'id', d.id, 'card_id', d.card_id, 'market', d.market, 'product_id', d.product_id,
              'precio', case when o.precios then d.precio end,
              'precio_antes', case when o.precios and d.en_oferta then d.precio_lista end,
              'destacada', d.destacada) order by d.n)
          from (
            select s.id, s.card_id, s.market, s.product_id, s.destacada,
                   public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) as precio,
                   s.precio as precio_lista,
                   (s.oferta_precio is not null and (s.oferta_hasta is null or s.oferta_hasta > now())) as en_oferta,
                   row_number() over (order by s.destacada desc, s.entro_el desc, s.id) as n
            from tienda_stock s
            where s.tienda_id = o.user_id and s.visible and s.unidades > 0
          ) d where d.n <= 4), '[]'::jsonb)
      ) order by o.puesto) from pagina o), '[]'::jsonb)
  );
$$;

--
-- Name: tiendas_con_la_carta(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tiendas_con_la_carta(p_card_id text, p_limite integer DEFAULT 12) RETURNS TABLE(stock_id uuid, tienda_id uuid, username text, display_name text, avatar_url text, ciudad text, con_local boolean, idioma text, estado text, variante text, gradeo text, unidades integer, precio numeric, de_tu_lista boolean, precio_antes numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.id, s.tienda_id, p.username, p.display_name, p.avatar_url, t.ciudad,
         nullif(trim(t.direccion), '') is not null,
         s.idioma, s.estado, s.variante, s.gradeo, s.unidades,
         case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end,
         (auth.uid() is not null and exists (
           select 1 from user_wants w
           where w.user_id = auth.uid() and w.card_id = s.card_id
             and (w.idioma is null or w.idioma = s.idioma)
             and (w.variante is null or w.variante = s.variante))),
         case when coalesce(t.precio_visible, true) and s.oferta_precio is not null
                   and (s.oferta_hasta is null or s.oferta_hasta > now()) then s.precio end
  from tienda_stock s
  join user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda' and not coalesce(p.is_banned, false)
  left join tiendas t on t.user_id = s.tienda_id
  where s.card_id = p_card_id and s.visible and public.tienda_publica(s.tienda_id) and s.unidades > 0
  order by case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end asc nulls last, p.username, s.id
  limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;

--
-- Name: tiendas_con_mis_deseos(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tiendas_con_mis_deseos(p_limite integer DEFAULT 12) RETURNS TABLE(tienda_id uuid, username text, display_name text, avatar_url text, ciudad text, cartas integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.tienda_id, p.username, p.display_name, p.avatar_url, t.ciudad, count(distinct s.card_id)::int
  from tienda_stock s
  join user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda' and not coalesce(p.is_banned, false)
  left join tiendas t on t.user_id = s.tienda_id
  where auth.uid() is not null and s.visible and public.tienda_publica(s.tienda_id) and s.unidades > 0 and s.card_id is not null
    and s.tienda_id is distinct from auth.uid()
    and exists (
      select 1 from user_wants w
      where w.user_id = auth.uid() and w.card_id = s.card_id
        and (w.idioma is null or w.idioma = s.idioma)
        and (w.variante is null or w.variante = s.variante))
  group by s.tienda_id, p.username, p.display_name, p.avatar_url, t.ciudad
  order by count(distinct s.card_id) desc, p.username
  limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;

--
-- Name: tiendas_que_tienen(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tiendas_que_tienen(p_card_id text, p_limite integer DEFAULT 12) RETURNS TABLE(tienda_id uuid, username text, display_name text, avatar_url text, ciudad text, idioma text, estado text, variante text, gradeo text, unidades integer, precio numeric, de_tu_lista boolean, precio_antes numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select s.tienda_id, p.username, p.display_name, p.avatar_url, t.ciudad,
         s.idioma, s.estado, s.variante, s.gradeo, s.unidades,
         case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end,
         (auth.uid() is not null and exists (
           select 1 from user_wants w
           where w.user_id = auth.uid() and w.card_id = s.card_id
             and (w.idioma is null or w.idioma = s.idioma)
             and (w.variante is null or w.variante = s.variante))),
         case when coalesce(t.precio_visible, true) and s.oferta_precio is not null
                   and (s.oferta_hasta is null or s.oferta_hasta > now()) then s.precio end
  from tienda_stock s
  join user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda' and not coalesce(p.is_banned, false)
  left join tiendas t on t.user_id = s.tienda_id
  where s.card_id = p_card_id and s.visible and public.tienda_publica(s.tienda_id) and s.unidades > 0
  order by case when coalesce(t.precio_visible, true) then public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) end asc nulls last, p.username
  limit greatest(1, least(coalesce(p_limite, 12), 50));
$$;

--
-- Name: tiendas_recien(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tiendas_recien(p_cuantas integer DEFAULT 8) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', r.id, 'card_id', r.card_id, 'market', r.market, 'product_id', r.product_id,
      'nombre', r.nombre, 'precio', case when r.precios then r.precio end,
      'precio_antes', case when r.precios and r.en_oferta then r.precio_lista end,
      'entro_el', r.entro_el,
      'tienda', jsonb_build_object('user_id', r.tienda_id, 'username', r.username, 'display_name', r.display_name)
    ) order by r.entro_el desc, r.id), '[]'::jsonb)
  from (
    select x.* from (
      select s.id, s.card_id, s.market, s.product_id, s.entro_el, s.tienda_id,
             public.tienda_precio_de(s.precio, s.oferta_precio, s.oferta_hasta) as precio,
             s.precio as precio_lista,
             (s.oferta_precio is not null and (s.oferta_hasta is null or s.oferta_hasta > now())) as en_oferta,
             coalesce(c.name_es, c.name, pr.name) as nombre,
             p.username, p.display_name, coalesce(t.precio_visible, true) as precios,
             row_number() over (partition by s.tienda_id order by s.entro_el desc, s.id) as de_la_tienda
      from tienda_stock s
      join user_profiles p on p.id = s.tienda_id and p.tipo = 'tienda' and not coalesce(p.is_banned, false) and public.tienda_publica(s.tienda_id)
      left join tiendas t on t.user_id = s.tienda_id
      left join tcg_cards c on c.id = s.card_id and c.market = s.market
      left join tcg_products pr on pr.id = s.product_id
      where s.visible and s.unidades > 0
    ) x
    order by x.de_la_tienda, x.entro_el desc, x.id
    limit least(greatest(coalesce(p_cuantas, 8), 1), 24)
  ) r;
$$;

--
-- Name: timbre_hay_trabajo(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.timbre_hay_trabajo(p_que text) RETURNS boolean
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if p_que = 'torneos' then
    return exists (select 1 from public.rounds where status = 'active')
      or exists (select 1 from public.tournaments t where
           (t.status = 'registration_open' and t.registration_notified_at is null)
        or (t.status = 'cancelled' and t.cancel_notified_at is null)
        or (t.status in ('registration_open', 'registration_closed') and t.reminder_notified_at is null
            and t.start_at between now() and now() + interval '61 minutes')
        or (t.status = 'finished' and t.podium is not null and t.xp_awarded_at is null)
        or (t.status = 'finished' and t.finish_notified_at is null))
      or exists (select 1 from public.judge_calls j where j.status = 'open' and j.notified_at is null)
      or exists (select 1 from public.tournament_registrations r join public.tournaments t on t.id = r.tournament_id
                  where r.status = 'waitlisted' and t.status in ('registration_open', 'registration_closed'));
  elsif p_que = 'correos' then
    return exists (select 1 from public.email_outbox where status = 'pending')
      or exists (select 1 from public.email_outbox where status = 'sending' and claimed_at < now() - interval '10 minutes');
  elsif p_que = 'push' then
    return exists (select 1 from public.user_notifications where pushed_at is null and created_at > now() - interval '24 hours');
  end if;
  return false;
end $$;

--
-- Name: timbre_tocar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.timbre_tocar() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_secreto text;
  v_que text;
  v_llamadas jsonb := '{}'::jsonb;
  v_hay boolean;
begin
  begin
    select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'timbre_secreto' limit 1;
  exception when others then
    v_secreto := null;
  end;
  if v_secreto is null or v_secreto = '' then
    return;
  end if;
  foreach v_que in array array['torneos', 'correos', 'push'] loop
    begin
      v_hay := public.timbre_hay_trabajo(v_que);
    exception when others then
      -- Una tabla que no existe o un fallo de la consulta: se llama igual (más
      -- vale una llamada de más que un torneo parado).
      v_hay := true;
    end;
    if v_hay then
      perform net.http_post(
        url := 'https://pokedoc.es/.netlify/functions/timbre?que=' || v_que,
        headers := jsonb_build_object('x-timbre', v_secreto, 'content-type', 'application/json'),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      );
      v_llamadas := v_llamadas || jsonb_build_object(v_que, true);
    end if;
  end loop;
  insert into public.scrydex_estado (clave, valor, updated_at)
  values ('timbre', jsonb_build_object('ultimo', now(), 'llamadas', v_llamadas), now())
  on conflict (clave) do update set
    valor = jsonb_build_object(
      'ultimo', now(),
      'llamadas', excluded.valor -> 'llamadas',
      'llamadasHoy', case when (public.scrydex_estado.valor ->> 'dia') = to_char(now(), 'YYYY-MM-DD')
                          then coalesce((public.scrydex_estado.valor ->> 'llamadasHoy')::int, 0) + (select count(*) from jsonb_object_keys(v_llamadas))
                          else (select count(*) from jsonb_object_keys(v_llamadas)) end,
      'dia', to_char(now(), 'YYYY-MM-DD')),
    updated_at = now();
end $$;

--
-- Name: torneos_adjuntar_repeticion(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_adjuntar_repeticion(p_partida uuid, p_repeticion text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_yo uuid := auth.uid();
begin
  if v_yo is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  if not exists (
    select 1 from public.tournament_matches m
     where m.id = p_partida and (m.player_a_id = v_yo or m.player_b_id = v_yo)
  ) then
    raise exception 'Solo los dos jugadores de una partida pueden adjuntarle su repetición.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.replays r where r.id = p_repeticion and r.user_id = v_yo) then
    raise exception 'Esa repetición no es tuya: guárdala primero en «Tus repeticiones».' using errcode = '42501';
  end if;
  -- La misma otra vez no cuenta: ya está.
  if exists (select 1 from public.tournament_match_replays t where t.match_id = p_partida and t.replay_id = p_repeticion) then
    return true;
  end if;
  if (select count(*) from public.tournament_match_replays t where t.match_id = p_partida and t.user_id = v_yo) >= 3 then
    raise exception 'Caben tres repeticiones tuyas por partida (una por juego de un BO3): quita una antes.' using errcode = 'P0001';
  end if;
  update public.replays set compartida = true where id = p_repeticion;
  insert into public.tournament_match_replays (match_id, user_id, replay_id)
  values (p_partida, v_yo, p_repeticion);
  return true;
end;
$$;

--
-- Name: torneos_atender_llamada(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_atender_llamada(p_llamada uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_torneo uuid;
begin
  select tournament_id into v_torneo from judge_calls where id = p_llamada;
  if not found then raise exception 'Llamada no encontrada.'; end if;
  if not (torneos_mando(v_torneo) or torneos_soy_juez(v_torneo)) then
    raise exception 'Solo jueces aprobados u organizadores atienden llamadas.';
  end if;
  update judge_calls
    set status = 'in_progress', assigned_judge_id = auth.uid()
    where id = p_llamada and status = 'open';
  return found; -- false = otro juez se adelantó
end $$;

--
-- Name: torneos_cerrar_jornada(uuid, integer, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_cerrar_jornada(p_torneo uuid, p_jornada integer, p_cerrar boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_t tournaments%rowtype;
  v_n int;
begin
  select * into v_t from tournaments where id = p_torneo;
  if not found then raise exception 'Torneo no encontrado.'; end if;
  if not torneos_mando(p_torneo) then raise exception 'Solo quien lleva la liga cierra sus jornadas.'; end if;
  if v_t.format is distinct from 'league' then raise exception 'Solo las ligas tienen jornadas.'; end if;
  if p_jornada is null or p_jornada < 1 or p_jornada > torneos_num_jornadas(p_torneo) then
    raise exception 'Esa jornada no existe en esta liga.';
  end if;
  if p_cerrar then
    insert into tournament_matchday_closures (tournament_id, matchday) values (p_torneo, p_jornada)
      on conflict do nothing;
  else
    if torneos_jornada_con_rondas(p_torneo, p_jornada) then
      raise exception 'La jornada % ya tiene pareos: deshazlos antes de reabrirla.', p_jornada;
    end if;
    delete from tournament_matchday_closures where tournament_id = p_torneo and matchday = p_jornada;
  end if;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

--
-- Name: torneos_checkin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_checkin(p_partida uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_m tournament_matches%rowtype;
begin
  select * into v_m from tournament_matches where id = p_partida;
  if not found then raise exception 'Mesa no encontrada.'; end if;
  if auth.uid() not in (v_m.player_a_id, v_m.player_b_id) then
    raise exception 'Solo los jugadores de la mesa se marcan listos.';
  end if;
  -- Mientras la mesa siga viva. `awaiting_confirmation` es el estado del
  -- fallo; `disputed` entra por la misma razón —hay gente sentada y un
  -- juez mirando— aunque hoy el cliente no ofrezca el botón ahí.
  --
  -- Lo que vigila la prueba NO es que esta lista y el cliente sean
  -- iguales, sino lo único que importa: que **todo estado en el que la
  -- pantalla pinta el botón esté aquí dentro**. Copiar la lista en
  -- JavaScript habría sido una copia más que mantener; esto se mide
  -- abriendo la página en los nueve estados.
  if v_m.status not in ('pending', 'active', 'awaiting_confirmation', 'disputed') then
    raise exception 'Esta mesa ya está cerrada: no se puede hacer check-in.';
  end if;

  if auth.uid() = v_m.player_a_id then
    update tournament_matches set check_in_a_at = coalesce(check_in_a_at, now()) where id = p_partida;
  else
    update tournament_matches set check_in_b_at = coalesce(check_in_b_at, now()) where id = p_partida;
  end if;
  return true;
end $$;

--
-- Name: torneos_dar_de_baja(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_dar_de_baja(p_inscripcion uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_insc tournament_registrations%rowtype;
  v_ronda uuid;
begin
  select * into v_insc from tournament_registrations where id = p_inscripcion for update;
  if not found then raise exception 'Inscripción no encontrada.'; end if;

  -- La puerta. La función es `security definer`, así que la RLS no la
  -- para: lo que decide quién entra es esto.
  if not (torneos_mando(v_insc.tournament_id) or torneos_soy_juez(v_insc.tournament_id)) then
    raise exception 'Solo el organizador o un juez del torneo pueden dar de baja a un jugador.';
  end if;

  if v_insc.status <> 'active' then return false; end if;

  select current_round_id into v_ronda from tournaments where id = v_insc.tournament_id;
  update tournament_registrations
     set status = 'dropped', dropped_at = now(), dropped_after_round_id = v_ronda
   where id = p_inscripcion and status = 'active';
  return found;
end $$;

--
-- Name: torneos_desreportar(uuid, smallint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_desreportar(p_partida uuid, p_juego smallint DEFAULT 0) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_m tournament_matches%rowtype;
begin
  select * into v_m from tournament_matches where id = p_partida for update;
  if not found then raise exception 'Mesa no encontrada.'; end if;
  if auth.uid() not in (v_m.player_a_id, v_m.player_b_id) then
    raise exception 'Solo los jugadores de la mesa pueden reportar.';
  end if;
  if v_m.status not in ('active','awaiting_confirmation') then
    raise exception 'Esta mesa ya no admite cambios.';
  end if;

  perform 1 from match_reports
    where match_id = p_partida and reporter_id <> auth.uid() and game_number = p_juego;
  if found then
    raise exception 'Tu rival ya ha reportado esa partida: llama al organizador.';
  end if;

  delete from match_reports
    where match_id = p_partida and reporter_id = auth.uid() and game_number = p_juego;

  -- Si no queda ningún reporte pendiente, la mesa vuelve a estar en juego.
  perform 1 from match_reports where match_id = p_partida;
  if not found then
    update tournament_matches set status = 'active' where id = p_partida;
  end if;
  return 'retirado';
end $$;

--
-- Name: torneos_entrar_con_codigo(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_entrar_con_codigo(p_slug text, p_codigo text, p_tcg_live text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_id uuid;
begin
  select id into v_id from tournaments where slug = p_slug;
  if v_id is null then raise exception 'Torneo no encontrado.'; end if;
  -- Un solo sitio donde se comprueba el código y se cuentan las plazas.
  return public.torneos_inscribirse(v_id, p_tcg_live, false, p_codigo);
end $$;

--
-- Name: torneos_es_mio(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_es_mio(p_torneo uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select exists (
    select 1 from public.tournaments t
     where t.id = p_torneo and t.admin_id = auth.uid()
  );
$$;

--
-- Name: torneos_estoy_inscrito(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_estoy_inscrito(p_torneo uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from tournament_registrations
    where tournament_id = p_torneo and user_id = auth.uid()
  );
$$;

--
-- Name: torneos_inscribirse(uuid, text, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_inscribirse(p_torneo uuid, p_tcg_live text, p_cola boolean DEFAULT false, p_codigo text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_torneo tournaments%rowtype;
  v_codigo text;
  v_ocupadas int;
  v_lleno boolean;
  v_estado text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para inscribirte.'; end if;
  if coalesce(trim(p_tcg_live), '') = '' then raise exception 'Di tu usuario de TCG Live.'; end if;

  select * into v_torneo from tournaments where id = p_torneo for update;
  if not found then raise exception 'Torneo no encontrado.'; end if;

  if coalesce(v_torneo.is_private, false) then
    select trim(code) into v_codigo from tournament_join_codes where tournament_id = p_torneo;
    if coalesce(v_codigo, '') = '' then
      raise exception 'Este torneo pide código para entrar y todavía no tiene ninguno: pídeselo a quien lo organiza.';
    end if;
    if coalesce(trim(p_codigo), '') = '' then
      raise exception 'Este torneo pide un código para entrar.';
    end if;
    if lower(trim(p_codigo)) <> lower(v_codigo) then
      raise exception 'El código no es correcto.';
    end if;
  end if;

  if v_torneo.status <> 'registration_open' and not (
    v_torneo.format = 'league'
    and v_torneo.status in ('registration_closed', 'in_progress')
    and exists (
      select 1 from generate_series(1, torneos_num_jornadas(p_torneo)) as j(n)
      where not torneos_jornada_con_rondas(p_torneo, j.n)
        and not exists (select 1 from tournament_matchday_closures c where c.tournament_id = p_torneo and c.matchday = j.n)
    )
  ) then
    raise exception 'Las inscripciones no están abiertas.';
  end if;
  if exists (select 1 from tournament_registrations where tournament_id = p_torneo and user_id = auth.uid()) then
    raise exception 'Ya estás inscrito en este torneo.';
  end if;

  select count(*) into v_ocupadas
    from tournament_registrations
    where tournament_id = p_torneo and status = 'active';
  v_lleno := v_torneo.max_players is not null and v_ocupadas >= v_torneo.max_players;

  if p_cola or v_lleno then
    v_estado := 'waitlisted';
  else
    v_estado := 'active';
  end if;

  insert into tournament_registrations (tournament_id, user_id, status, tcg_live_username)
    values (p_torneo, auth.uid(), v_estado, trim(p_tcg_live))
    returning id into v_id;
  return v_id;
end $$;

--
-- Name: torneos_jornada_con_rondas(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_jornada_con_rondas(p_torneo uuid, p_jornada integer) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from rounds r join tournaments t on t.id = r.tournament_id
    where r.tournament_id = p_torneo and r.phase = 'swiss'
      and r.round_number between (p_jornada - 1) * greatest(coalesce(t.rounds_per_matchday, 1), 1) + 1
                             and p_jornada * greatest(coalesce(t.rounds_per_matchday, 1), 1)
  )
$$;

--
-- Name: torneos_juez_adjuntar_repeticion(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_juez_adjuntar_repeticion(p_partida uuid, p_repeticion text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_yo uuid := auth.uid();
  v_torneo uuid;
  v_estado text;
  v_b uuid;
begin
  if v_yo is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  select r.tournament_id, m.status, m.player_b_id into v_torneo, v_estado, v_b
    from public.tournament_matches m
    join public.rounds r on r.id = m.round_id
   where m.id = p_partida;
  if v_torneo is null then
    raise exception 'Esa mesa no existe.' using errcode = 'P0002';
  end if;
  if not (public.torneos_mando(v_torneo) or public.repeticiones_juez_de(v_torneo)) then
    raise exception 'Solo quien lleva el torneo y sus jueces añaden la repetición de una mesa.' using errcode = '42501';
  end if;
  if v_estado in ('pending', 'bye') or v_b is null then
    raise exception 'Esa mesa no tiene partida que ver (sin empezar, o un bye).' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.replays x where x.id = p_repeticion and x.user_id = v_yo) then
    raise exception 'Esa repetición no es tuya: guárdala primero.' using errcode = '42501';
  end if;
  if (select count(*) from public.tournament_match_replays t where t.match_id = p_partida and t.publica and t.replay_id <> p_repeticion) >= 3 then
    raise exception 'Caben tres repeticiones por mesa (una por partida de un BO3): quita una antes.' using errcode = 'P0001';
  end if;
  update public.replays set compartida = true where id = p_repeticion;
  insert into public.tournament_match_replays (match_id, user_id, replay_id, publica)
  values (p_partida, v_yo, p_repeticion, true)
  on conflict (match_id, replay_id) do update set publica = true;
  return true;
end;
$$;

--
-- Name: torneos_juez_quitar_repeticion(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_juez_quitar_repeticion(p_partida uuid, p_repeticion text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_torneo uuid;
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  select r.tournament_id into v_torneo
    from public.tournament_matches m
    join public.rounds r on r.id = m.round_id
   where m.id = p_partida;
  if v_torneo is null or not (public.torneos_mando(v_torneo) or public.repeticiones_juez_de(v_torneo)) then
    raise exception 'Solo quien lleva el torneo y sus jueces quitan la repetición de una mesa.' using errcode = '42501';
  end if;
  delete from public.tournament_match_replays
   where match_id = p_partida and replay_id = p_repeticion and publica;
  return found;
end;
$$;

--
-- Name: torneos_lista_jornada(uuid, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_lista_jornada(p_torneo uuid, p_jornada integer, p_texto text, p_cartas jsonb) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_t tournaments%rowtype;
begin
  if auth.uid() is null then raise exception 'Entra en tu cuenta para enviar tu lista.'; end if;
  select * into v_t from tournaments where id = p_torneo;
  if not found then raise exception 'Torneo no encontrado.'; end if;
  if v_t.format is distinct from 'league' then raise exception 'Solo las ligas tienen lista por jornada.'; end if;
  if v_t.status in ('finished', 'cancelled', 'draft') then raise exception 'La liga no admite listas ahora.'; end if;
  if p_jornada is null or p_jornada < 1 or p_jornada > torneos_num_jornadas(p_torneo) then
    raise exception 'Esa jornada no existe en esta liga.';
  end if;
  if not exists (
    select 1 from tournament_registrations r
    where r.tournament_id = p_torneo and r.user_id = auth.uid() and r.status = 'active'
  ) then
    raise exception 'Solo los inscritos de la liga envían listas.';
  end if;
  if torneos_jornada_con_rondas(p_torneo, p_jornada)
     or exists (select 1 from tournament_matchday_closures where tournament_id = p_torneo and matchday = p_jornada) then
    raise exception 'Las inscripciones de la jornada % están cerradas.', p_jornada;
  end if;
  if coalesce(trim(p_texto), '') = '' or p_cartas is null then raise exception 'La lista está vacía.'; end if;

  insert into tournament_matchday_decklists (tournament_id, user_id, matchday, raw_text, parsed_cards, submitted_at)
    values (p_torneo, auth.uid(), p_jornada, p_texto, p_cartas, now())
    on conflict (tournament_id, user_id, matchday)
    do update set raw_text = excluded.raw_text, parsed_cards = excluded.parsed_cards, submitted_at = now();
  return true;
end $$;

--
-- Name: torneos_mando(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_mando(p_torneo uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
  select public.torneos_soy_admin()
      or exists (
        select 1 from public.tournaments t
         where t.id = p_torneo and t.admin_id = auth.uid()
      )
      or public.torneos_soy_juez(p_torneo);
$$;

--
-- Name: torneos_num_jornadas(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_num_jornadas(p_torneo uuid) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select ceil(t.swiss_rounds::numeric / greatest(coalesce(t.rounds_per_matchday, 1), 1))::int
  from tournaments t where t.id = p_torneo
$$;

--
-- Name: torneos_premio_entregado(uuid, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_premio_entregado(p_torneo uuid, p_usuario uuid, p_entregado boolean) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  if not public.torneos_mando(p_torneo) then
    raise exception 'Solo quien lleva el torneo apunta los premios dados.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tournaments t where t.id = p_torneo and t.status = 'finished') then
    raise exception 'Los premios se dan con el torneo terminado.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.tournament_registrations r where r.tournament_id = p_torneo and r.user_id = p_usuario) then
    raise exception 'Esa persona no jugó este torneo.' using errcode = 'P0001';
  end if;
  if p_entregado then
    insert into public.tournament_prize_deliveries (tournament_id, user_id, delivered_by)
    values (p_torneo, p_usuario, auth.uid())
    on conflict (tournament_id, user_id) do nothing;
  else
    delete from public.tournament_prize_deliveries where tournament_id = p_torneo and user_id = p_usuario;
  end if;
  return p_entregado;
end;
$$;

--
-- Name: torneos_publicar_listas_jornada(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_publicar_listas_jornada(p_torneo uuid, p_jornada integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_n int;
begin
  if not torneos_mando(p_torneo) then raise exception 'Solo quien lleva la liga publica las listas.'; end if;
  insert into tournament_decklists (tournament_id, user_id, raw_text, parsed_cards, submitted_at, locked_at)
    select d.tournament_id, d.user_id, d.raw_text, d.parsed_cards, d.submitted_at, now()
    from tournament_matchday_decklists d
    where d.tournament_id = p_torneo and d.matchday = p_jornada
  on conflict (tournament_id, user_id)
  do update set raw_text = excluded.raw_text, parsed_cards = excluded.parsed_cards,
    submitted_at = excluded.submitted_at, locked_at = excluded.locked_at;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

--
-- Name: torneos_quitar_lista_jornada(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_quitar_lista_jornada(p_torneo uuid, p_jornada integer) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_n int;
begin
  if auth.uid() is null then raise exception 'Entra en tu cuenta.'; end if;
  if torneos_jornada_con_rondas(p_torneo, p_jornada)
     or exists (select 1 from tournament_matchday_closures where tournament_id = p_torneo and matchday = p_jornada) then
    raise exception 'Las inscripciones de la jornada % están cerradas.', p_jornada;
  end if;
  delete from tournament_matchday_decklists
    where tournament_id = p_torneo and user_id = auth.uid() and matchday = p_jornada;
  get diagnostics v_n = row_count;
  return v_n > 0;
end $$;

--
-- Name: torneos_quitar_repeticion(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_quitar_repeticion(p_partida uuid, p_repeticion text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  delete from public.tournament_match_replays
   where match_id = p_partida and replay_id = p_repeticion and user_id = auth.uid();
  return found;
end;
$$;

--
-- Name: torneos_repartir_xp(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_repartir_xp(p_torneo uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_torneo record;
  v_jugadores int;
  v_total int := 0;
begin
  -- `for update` para que dos pasadas del barredor a la vez no se pisen.
  -- Las tres condiciones son la guarda: si falta cualquiera, no hay nada
  -- que hacer y se vuelve con 0 sin tocar nada.
  select id, champion_id, podium
    into v_torneo
    from public.tournaments
   where id = p_torneo
     and status = 'finished'
     -- El podio CONGELADO es la única fuente de quién quedó dónde
     -- (lo sella sellarResultado). Si todavía no está, esto no es «no
     -- ha ganado nadie»: es «aún no se sabe», y se deja para luego.
     and podium is not null
     and xp_awarded_at is null
     for update;
  if not found then return 0; end if;

  -- Quien jugó de verdad: inscrito (aunque luego se retirara) y presente
  -- en al menos una mesa terminada.
  create temp table if not exists _jugaron (user_id uuid primary key) on commit drop;
  delete from _jugaron;
  insert into _jugaron (user_id)
  select distinct r.user_id
    from public.tournament_registrations r
   where r.tournament_id = p_torneo
     and r.status in ('active', 'dropped')
     and exists (
       select 1
         from public.tournament_matches m
         join public.rounds ro on ro.id = m.round_id
        where ro.tournament_id = p_torneo
          and m.status in ('finished', 'forfeit_a', 'forfeit_b', 'forfeit_both')
          and r.user_id in (m.player_a_id, m.player_b_id)
     );

  select count(*) into v_jugadores from _jugaron;

  if v_jugadores >= 4 then
    with premios as (
      select j.user_id,
             30
               + case when j.user_id = any (
                   select (jsonb_array_elements_text(v_torneo.podium))::uuid
                 ) then 40 else 0 end
               + case when j.user_id = v_torneo.champion_id then 80 else 0 end as amount,
             case when j.user_id = v_torneo.champion_id then 'campeon'
                  when j.user_id = any (
                    select (jsonb_array_elements_text(v_torneo.podium))::uuid
                  ) then 'podio'
                  else 'jugado' end as motivo
        from _jugaron j
    ),
    -- Aquí está la idempotencia: lo que ya estaba no vuelve a entrar, y
    -- `returning` solo devuelve lo que se ha metido de VERDAD.
    metidos as (
      insert into public.tournament_xp_awards (tournament_id, user_id, amount, motivo)
      select p_torneo, user_id, amount, motivo from premios
      on conflict (tournament_id, user_id) do nothing
      returning user_id, amount
    ),
    sumado as (
      update public.user_profiles u
         set total_xp = coalesce(u.total_xp, 0) + m.amount,
             -- Y el nivel con el XP nuevo, en el MISMO update: si se
             -- dejara para otra pasada, entre las dos habría alguien con
             -- 4.000 puntos y la chapa de Novato.
             level = public.nivel_de_xp(coalesce(u.total_xp, 0) + m.amount)
        from metidos m
       where u.id = m.user_id
      returning m.amount
    )
    select coalesce(sum(amount), 0) into v_total from sumado;
  end if;

  update public.tournaments set xp_awarded_at = now() where id = p_torneo;
  return v_total;
end;
$$;

--
-- Name: torneos_reportar(uuid, text, smallint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_reportar(p_partida uuid, p_resultado text, p_juego smallint DEFAULT 0) RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_m tournament_matches%rowtype;
  v_bo smallint;
  v_mio match_reports%rowtype;
  v_rival match_reports%rowtype;
  v_res text;
  v_ganador uuid;
  v_a text;
  v_b text;
  v_juego_res text;
  v_ga int := 0;
  v_gb int := 0;
  v_jugados int := 0;
  v_fila record;
begin
  if p_resultado not in ('win','loss','draw') then raise exception 'Resultado inválido.'; end if;
  if p_juego is null or p_juego < 0 or p_juego > 3 then raise exception 'Partida inválida.'; end if;

  select * into v_m from tournament_matches where id = p_partida for update;
  if not found then raise exception 'Mesa no encontrada.'; end if;
  if auth.uid() not in (v_m.player_a_id, v_m.player_b_id) then
    raise exception 'Solo los jugadores de la mesa pueden reportar.';
  end if;
  if v_m.status not in ('active','awaiting_confirmation') then
    raise exception 'Esta mesa ya no admite reportes.';
  end if;

  -- Marcar partidas sueltas solo tiene sentido si la mesa se juega al
  -- mejor de tres. En un BO1 el match ES la partida.
  if p_juego > 0 then
    select case when r.phase = 'top_cut' then t.top_cut_bo else t.swiss_bo end
      into v_bo
      from rounds r join tournaments t on t.id = r.tournament_id
      where r.id = v_m.round_id;
    if coalesce(v_bo, 1) <> 3 then raise exception 'Esta mesa no se juega al mejor de tres.'; end if;
  end if;

  select * into v_mio from match_reports
    where match_id = p_partida and reporter_id = auth.uid() and game_number = p_juego;
  if found then
    if v_mio.result = p_resultado then return 'repetido'; end if;
    -- Enmendar el propio parte: solo mientras el rival no haya dicho lo
    -- suyo de ESA partida. Después ya está cerrada y la toca un juez.
    perform 1 from match_reports
      where match_id = p_partida and reporter_id <> auth.uid() and game_number = p_juego;
    if found then
      raise exception 'Ya reportaste un resultado distinto: llama al organizador.';
    end if;
    update match_reports set result = p_resultado, reported_at = now() where id = v_mio.id;
    return 'corregido';
  end if;

  insert into match_reports (match_id, reporter_id, result, game_number)
    values (p_partida, auth.uid(), p_resultado, p_juego);

  select * into v_rival from match_reports
    where match_id = p_partida and reporter_id <> auth.uid() and game_number = p_juego;
  if not found then
    update tournament_matches set status = 'awaiting_confirmation' where id = p_partida;
    return 'esperando';
  end if;

  -- Conciliación (misma tabla que reconcileReports del motor).
  v_a := case when v_rival.reporter_id = v_m.player_a_id then v_rival.result else p_resultado end;
  v_b := case when v_rival.reporter_id = v_m.player_b_id then v_rival.result else p_resultado end;
  if v_a = 'win' and v_b = 'loss' then v_juego_res := 'a_wins';
  elsif v_a = 'loss' and v_b = 'win' then v_juego_res := 'b_wins';
  elsif v_a = 'draw' and v_b = 'draw' then v_juego_res := 'draw';
  else
    update tournament_matches set status = 'disputed' where id = p_partida;
    return 'disputa';
  end if;

  -- BO1: la partida ES el match.
  if p_juego = 0 then
    v_res := v_juego_res;
    v_ganador := case v_res when 'a_wins' then v_m.player_a_id when 'b_wins' then v_m.player_b_id else null end;
    update tournament_matches set status = 'finished', finished_at = now() where id = p_partida;
    insert into match_results (match_id, result, winner_id, resolved_by)
      values (p_partida, v_res, v_ganador, null)
      on conflict (match_id) do nothing;
    return 'conciliado';
  end if;

  -- BO3: se recuenta la SERIE con todas las partidas ya confirmadas por
  -- los dos. Mientras no haya dos ganadas, la mesa sigue viva.
  for v_fila in
    select r.game_number,
           max(case when r.reporter_id = v_m.player_a_id then r.result end) as ra,
           max(case when r.reporter_id = v_m.player_b_id then r.result end) as rb
      from match_reports r
      where r.match_id = p_partida and r.game_number between 1 and 3
      group by r.game_number
  loop
    if v_fila.ra is null or v_fila.rb is null then continue; end if;
    if v_fila.ra = 'win' and v_fila.rb = 'loss' then v_ga := v_ga + 1; v_jugados := v_jugados + 1;
    elsif v_fila.ra = 'loss' and v_fila.rb = 'win' then v_gb := v_gb + 1; v_jugados := v_jugados + 1;
    elsif v_fila.ra = 'draw' and v_fila.rb = 'draw' then v_jugados := v_jugados + 1;
    end if;
  end loop;

  if v_ga >= 2 then v_res := 'a_wins'; v_ganador := v_m.player_a_id;
  elsif v_gb >= 2 then v_res := 'b_wins'; v_ganador := v_m.player_b_id;
  elsif v_jugados >= 3 then v_res := 'draw'; v_ganador := null;
  else
    update tournament_matches set status = 'active' where id = p_partida;
    return 'juego';
  end if;

  update tournament_matches set status = 'finished', finished_at = now() where id = p_partida;
  insert into match_results (match_id, result, winner_id, resolved_by)
    values (p_partida, v_res, v_ganador, null)
    on conflict (match_id) do nothing;
  return 'conciliado';
end $$;

--
-- Name: torneos_resolver_como_juez(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_resolver_como_juez(p_partida uuid, p_resultado text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_m tournament_matches%rowtype;
  v_torneo uuid;
  v_ronda_estado text;
  v_fase text;
  v_ganador uuid;
begin
  if p_resultado not in ('a_wins', 'b_wins', 'draw', 'forfeit_a', 'forfeit_b', 'forfeit_both') then
    raise exception 'Resultado inválido.';
  end if;

  select * into v_m from tournament_matches where id = p_partida for update;
  if not found then raise exception 'Mesa no encontrada.'; end if;
  select r.tournament_id, r.status, r.phase into v_torneo, v_ronda_estado, v_fase
    from rounds r where r.id = v_m.round_id;

  if not (torneos_mando(v_torneo) or torneos_soy_juez(v_torneo)) then
    raise exception 'Solo el organizador o un juez del torneo pueden resolver una mesa.';
  end if;
  if v_ronda_estado <> 'active' then raise exception 'Esa ronda no está en juego.'; end if;
  if v_m.status in ('finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both') then
    raise exception 'Esa mesa ya está cerrada: corregirla es cosa del organizador.';
  end if;
  if v_m.player_b_id is null then raise exception 'Un bye no se resuelve.'; end if;
  -- En el corte se juega a ganar: no hay empate (tanda 206).
  if p_resultado = 'draw' and v_fase = 'top_cut' then
    raise exception 'En el top cut no hay empates.';
  end if;

  v_ganador := case
    when p_resultado in ('a_wins', 'forfeit_b') then v_m.player_a_id
    when p_resultado in ('b_wins', 'forfeit_a') then v_m.player_b_id
    else null
  end;

  update tournament_matches
     set status = case when p_resultado like 'forfeit%' then p_resultado else 'finished' end,
         finished_at = now()
   where id = p_partida;

  insert into match_results (match_id, result, winner_id, resolved_by)
  values (p_partida, p_resultado, v_ganador, auth.uid())
  on conflict (match_id) do update
    set result = excluded.result, winner_id = excluded.winner_id,
        resolved_by = excluded.resolved_by, resolved_at = now();
  return true;
end $$;

--
-- Name: torneos_solo_admin_marca_oficial(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_solo_admin_marca_oficial() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if auth.uid() is not null and not public.torneos_soy_admin_del_sitio() then
    new.is_official := coalesce(old.is_official, false);
  end if;
  return new;
end;
$$;

--
-- Name: torneos_soy_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_soy_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from user_profiles p
    where p.id = auth.uid()
      and (p.is_admin or coalesce(p.is_tournament_admin, false))
  )
$$;

--
-- Name: torneos_soy_admin_del_sitio(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_soy_admin_del_sitio() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin)
$$;

--
-- Name: torneos_soy_juez(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_soy_juez(t uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1 from judge_applications j
    where j.tournament_id = t and j.user_id = auth.uid() and j.status = 'approved'
  )
$$;

--
-- Name: torneos_tablon_escribir(uuid, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.torneos_tablon_escribir(p_torneo uuid, p_texto text, p_avisar boolean DEFAULT true, p_auto boolean DEFAULT false) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_yo uuid := auth.uid();
  v_texto text := btrim(coalesce(p_texto, ''));
  v_id uuid;
  v_nombre text;
  v_slug text;
begin
  if v_yo is null then
    raise exception 'Hace falta iniciar sesión.' using errcode = '28000';
  end if;
  if not (public.torneos_mando(p_torneo) or public.repeticiones_juez_de(p_torneo)) then
    raise exception 'Solo quien lleva el torneo y sus jueces escriben en el tablón.' using errcode = '42501';
  end if;
  if char_length(v_texto) < 1 or char_length(v_texto) > 500 then
    raise exception 'Un aviso tiene entre 1 y 500 letras.' using errcode = '22023';
  end if;
  select t.name, t.slug into v_nombre, v_slug from public.tournaments t where t.id = p_torneo;
  if v_nombre is null then
    raise exception 'Ese torneo no existe.' using errcode = 'P0002';
  end if;

  insert into public.tournament_updates (tournament_id, author_id, kind, body)
  values (p_torneo, case when p_auto then null else v_yo end, case when p_auto then 'auto' else 'aviso' end, v_texto)
  returning id into v_id;

  -- El aviso a los inscritos: solo los avisos humanos, y solo a quien no
  -- lo tenga apagado. Quien escribe no se avisa a sí mismo.
  if p_avisar and not p_auto then
    insert into public.user_notifications (recipient_id, type, title, body, link)
    select r.user_id, 'torneo_aviso', 'Aviso del torneo — ' || v_nombre, v_texto, '/torneo?slug=' || v_slug
      from public.tournament_registrations r
      join public.user_profiles p on p.id = r.user_id
     where r.tournament_id = p_torneo
       and r.status = 'active'
       and r.user_id <> v_yo
       and not (coalesce(p.notification_prefs_disabled, '{}'::text[]) @> array['torneo_aviso']);
  end if;

  return v_id;
end;
$$;

--
-- Name: tp_de_version(text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tp_de_version(p_variante text, p_normal_market numeric, p_normal_low numeric, p_holo_market numeric, p_holo_low numeric, p_reverse_market numeric, p_reverse_low numeric, p_primera_market numeric, p_primera_low numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select case p_variante
    when 'reverse' then coalesce(nullif(p_reverse_market, 0), nullif(p_reverse_low, 0), nullif(p_holo_market, 0), nullif(p_holo_low, 0), nullif(p_normal_market, 0), nullif(p_normal_low, 0))
    when 'holo' then coalesce(nullif(p_holo_market, 0), nullif(p_holo_low, 0), nullif(p_normal_market, 0), nullif(p_normal_low, 0))
    when 'primera' then coalesce(nullif(p_primera_market, 0), nullif(p_primera_low, 0), nullif(p_holo_market, 0), nullif(p_holo_low, 0), nullif(p_normal_market, 0), nullif(p_normal_low, 0))
    else coalesce(nullif(p_normal_market, 0), nullif(p_normal_low, 0), nullif(p_holo_market, 0), nullif(p_holo_low, 0))
  end;
$$;

--
-- Name: url_de_imagen_segura(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.url_de_imagen_segura(p_url text) RETURNS boolean
    LANGUAGE sql IMMUTABLE
    AS $_$
  select p_url is null or p_url ~ '^https://[^[:space:]"''()<>\\`]+$'
$_$;

--
-- Name: user_albums_tocar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_albums_tocar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  new.user_id := old.user_id;
  return new;
end;
$$;

--
-- Name: user_albums_tope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_albums_tope() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (select count(*) from public.user_albums where user_id = new.user_id) >= 100 then
    raise exception 'Has llegado al máximo de 100 álbumes.';
  end if;
  return new;
end;
$$;

--
-- Name: user_collection_tocar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_collection_tocar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  -- El dueño no se cambia: una actualización que intente pasarle la
  -- línea a otra cuenta se queda con el de siempre.
  new.user_id := old.user_id;
  return new;
end;
$$;

--
-- Name: user_collection_tope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_collection_tope() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (select count(*) from public.user_collection where user_id = new.user_id) >= 20000 then
    raise exception 'Has llegado al máximo de 20.000 líneas en tu colección.';
  end if;
  return new;
end;
$$;

--
-- Name: user_decks_tocar(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_decks_tocar() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
begin
  new.updated_at := now();
  -- El dueño no se cambia nunca: una actualización que intente
  -- pasarle el mazo a otra cuenta se queda con el dueño de siempre.
  new.user_id := old.user_id;
  return new;
end;
$$;

--
-- Name: user_decks_tope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_decks_tope() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (select count(*) from public.user_decks where user_id = new.user_id) >= 300 then
    raise exception 'Has llegado al máximo de 300 mazos guardados. Borra alguno para guardar más.';
  end if;
  return new;
end;
$$;

--
-- Name: user_wants_tope(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_wants_tope() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
begin
  if (select count(*) from public.user_wants where user_id = new.user_id) >= 2000 then
    raise exception 'Has llegado al máximo de 2.000 cartas en tu lista de búsqueda.';
  end if;
  return new;
end;
$$;

--
-- Name: valor_de_copia(public.user_collection, public.tcg_card_prices); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valor_de_copia(c public.user_collection, pr public.tcg_card_prices) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
  select case
    when coalesce((c).valor_manual, 0) = 0
     and public.valor_gradeado((c).gradeo, (pr).cm_gradeadas, (pr).ebay_gradeadas) is not null
    then public.valor_gradeado((c).gradeo, (pr).cm_gradeadas, (pr).ebay_gradeadas) * greatest(coalesce((c).cantidad, 1), 0)
    else public.valor_de_linea(
      (c).valor_manual, (c).cantidad, (c).variante, (c).idioma,
      (pr).cm_low_es, (pr).cm_low_en, (pr).cm_low_de, (pr).cm_low_fr, (pr).cm_low_it, (pr).cm_low_ja,
      (pr).cm_trend, (pr).cm_avg30, (pr).cm_low,
      (pr).cm_trend_holo, (pr).cm_avg30_holo, (pr).cm_low_holo,
      (pr).tp_market_eur,
      (pr).tp_normal_market, (pr).tp_normal_low, (pr).tp_holo_market, (pr).tp_holo_low,
      (pr).tp_reverse_market, (pr).tp_reverse_low, (pr).tp_primera_market, (pr).tp_primera_low)
  end
$$;

--
-- Name: valor_de_linea(numeric, integer, text, numeric, numeric, numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valor_de_linea(p_valor_manual numeric, p_cantidad integer, p_variante text, p_trend numeric, p_avg30 numeric, p_low numeric, p_trend_holo numeric, p_avg30_holo numeric, p_low_holo numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  select coalesce(
    nullif(p_valor_manual, 0),
    -- La variante `reverse` va por sus cifras... y si no las tiene, por
    -- las normales (tanda 375): un reverso sin precio propio no vale
    -- cero, vale por lo menos lo que vale la carta.
    case when p_variante = 'reverse'
         then coalesce(nullif(p_trend_holo, 0), nullif(p_avg30_holo, 0), nullif(p_low_holo, 0))
    end,
    nullif(p_trend, 0), nullif(p_avg30, 0), nullif(p_low, 0),
    0
  ) * greatest(coalesce(p_cantidad, 1), 0);
$$;

--
-- Name: valor_de_linea(numeric, integer, text, text, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valor_de_linea(p_valor_manual numeric, p_cantidad integer, p_variante text, p_idioma text, p_low_es numeric, p_low_en numeric, p_low_de numeric, p_low_fr numeric, p_low_it numeric, p_low_ja numeric, p_trend numeric, p_avg30 numeric, p_low numeric, p_trend_holo numeric, p_avg30_holo numeric, p_low_holo numeric, p_tp_market_eur numeric, p_tp_normal_market numeric DEFAULT NULL::numeric, p_tp_normal_low numeric DEFAULT NULL::numeric, p_tp_holo_market numeric DEFAULT NULL::numeric, p_tp_holo_low numeric DEFAULT NULL::numeric, p_tp_reverse_market numeric DEFAULT NULL::numeric, p_tp_reverse_low numeric DEFAULT NULL::numeric, p_tp_primera_market numeric DEFAULT NULL::numeric, p_tp_primera_low numeric DEFAULT NULL::numeric) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $$
  with cifras as (
    select
      nullif(case p_idioma
               when 'es' then p_low_es
               when 'en' then p_low_en
               when 'de' then p_low_de
               when 'fr' then p_low_fr
               when 'it' then p_low_it
               when 'ja' then p_low_ja
             end, 0) as del_idioma,
      coalesce(
        case when p_variante = 'reverse'
             then coalesce(nullif(p_trend_holo, 0), nullif(p_avg30_holo, 0), nullif(p_low_holo, 0))
        end,
        nullif(p_low, 0), nullif(p_trend, 0), nullif(p_avg30, 0)
      ) as general,
      public.tp_de_version(p_variante,
        p_tp_normal_market, p_tp_normal_low, p_tp_holo_market, p_tp_holo_low,
        p_tp_reverse_market, p_tp_reverse_low, p_tp_primera_market, p_tp_primera_low) as usd
  )
  select coalesce(
    nullif(p_valor_manual, 0),
    del_idioma,
    case when general is not null and not public.emparejamiento_dudoso(general, usd) then general end,
    nullif(p_tp_market_eur, 0),
    round(usd * public.eur_por_usd(), 2),
    general,
    0
  ) * greatest(coalesce(p_cantidad, 1), 0)
  from cifras;
$$;

--
-- Name: valor_gradeado(text, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.valor_gradeado(p_gradeo text, p_cm jsonb, p_ebay jsonb) RETURNS numeric
    LANGUAGE sql IMMUTABLE
    AS $_$
  with g as (
    select lower(split_part(btrim(p_gradeo), ' ', 1)) as casa,
           btrim(substr(btrim(p_gradeo), strpos(btrim(p_gradeo), ' ') + 1)) as nota
     where strpos(btrim(coalesce(p_gradeo, '')), ' ') > 1
  ),
  n as (
    select casa, nota, nota::numeric as num from g where nota ~ '^[0-9]+(\.[0-9]+)?$'
  ),
  -- Las claves de Cardmarket llevan la casa delante («psa10») y las de
  -- eBay van peladas («10»): se comparan sin la casa y por su valor.
  cm as (
    select case when jsonb_typeof(e.value) = 'number' then (e.value)::text::numeric end as v, e.key
      from n, jsonb_each(case when jsonb_typeof(p_cm) = 'object' and jsonb_typeof(p_cm -> n.casa) = 'object' then p_cm -> n.casa else '{}'::jsonb end) e
     where case when regexp_replace(lower(e.key), '^' || n.casa, '') ~ '^[0-9]+(\.[0-9]+)?$'
                then regexp_replace(lower(e.key), '^' || n.casa, '')::numeric = n.num
                else regexp_replace(lower(e.key), '^' || n.casa, '') = n.nota end
  ),
  eb as (
    select case when jsonb_typeof(e.value -> 'median_price') = 'number' then (e.value ->> 'median_price')::numeric end as v, e.key
      from n, jsonb_each(case when jsonb_typeof(p_ebay) = 'object' and jsonb_typeof(p_ebay -> n.casa) = 'object' then p_ebay -> n.casa else '{}'::jsonb end) e
     where case when regexp_replace(lower(e.key), '^' || n.casa, '') ~ '^[0-9]+(\.[0-9]+)?$'
                then regexp_replace(lower(e.key), '^' || n.casa, '')::numeric = n.num
                else regexp_replace(lower(e.key), '^' || n.casa, '') = n.nota end
  )
  select coalesce(
    (select v from cm where v > 0 order by key limit 1),
    (select round(v * public.eur_por_usd(), 2) from eb where v > 0 order by key limit 1)
  );
$_$;

--
-- Name: vitales_resumen(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.vitales_resumen(p_dias integer DEFAULT 7) RETURNS TABLE(path text, visitas bigint, lcp_p75 integer, inp_p75 integer, cls_p75 numeric, movil_pct integer)
    LANGUAGE sql STABLE
    SET search_path TO 'public'
    AS $$
  select
    v.path,
    count(*) as visitas,
    (percentile_cont(0.75) within group (order by v.lcp_ms))::integer as lcp_p75,
    (percentile_cont(0.75) within group (order by v.inp_ms))::integer as inp_p75,
    round((percentile_cont(0.75) within group (order by v.cls_mil))::numeric / 1000, 3) as cls_p75,
    (100 * avg(case when v.movil then 1 else 0 end))::integer as movil_pct
  from page_vitals v
  where v.created_at > now() - make_interval(days => greatest(1, least(p_dias, 90)))
  group by v.path
  order by count(*) desc
  limit 50
$$;

--
-- Name: xp_autor_por_agradecimiento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.xp_autor_por_agradecimiento() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  perform public.dar_xp_al_autor(new.guide_id, new.user_id, 5);
  return new;
end;
$$;

--
-- Name: xp_autor_por_lectura(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.xp_autor_por_lectura() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if new.read_at is not null and (tg_op = 'INSERT' or old.read_at is null) then
    perform public.dar_xp_al_autor(new.guide_id, new.user_id, 2);
  end if;
  return new;
end;
$$;

--
-- Name: xp_por_mensaje_de_foro(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.xp_por_mensaje_de_foro() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
declare
  v_texto text;
  v_hoy integer;
  v_abre_tema boolean;
begin
  if new.author_id is null then
    return new;
  end if;

  -- El cuerpo viene en HTML; lo que cuenta es el texto que se lee.
  v_texto := btrim(regexp_replace(coalesce(new.body_html, ''), '<[^>]*>', ' ', 'g'));
  if length(v_texto) < 80 then
    return new;
  end if;

  select count(*) into v_hoy
    from forum_posts p
   where p.author_id = new.author_id
     and p.created_at >= date_trunc('day', now())
     and p.id <> new.id;
  if v_hoy >= 10 then
    return new;
  end if;

  -- El primer mensaje de un tema es el tema. No hace falta guardar quién
  -- lo abrió: es el único mensaje sin otro anterior.
  select not exists (
    select 1 from forum_posts p where p.thread_id = new.thread_id and p.id <> new.id
  ) into v_abre_tema;

  update user_profiles
     set total_xp = coalesce(total_xp, 0) + case when v_abre_tema then 5 else 2 end
   where id = new.author_id;

  return new;
end;
$$;

--
-- Name: xp_por_sugerencia_aceptada(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.xp_por_sugerencia_aceptada() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_catalog'
    AS $$
begin
  if new.status = 'accepted' and coalesce(old.status, '') <> 'accepted' and new.author_id is not null then
    update user_profiles set total_xp = coalesce(total_xp, 0) + 10 where id = new.author_id;
  end if;
  return new;
end;
$$;

--
-- Name: xp_sumar(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.xp_sumar(p_cuanto integer) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_total int;
  v_hoy int;
  v_tope constant int := 2000;
  v_suma int;
begin
  if auth.uid() is null then
    raise exception 'hay que tener sesión para sumar XP';
  end if;
  if p_cuanto is null or p_cuanto <= 0 or p_cuanto > 500 then
    raise exception 'premio de XP fuera de rango: %', p_cuanto;
  end if;

  -- Lo que queda de hoy. Pasado el tope no se suma, pero se contesta el
  -- total: el cliente no tiene por qué romperse por un premio que no entra.
  insert into public.xp_diario (user_id, dia, sumado)
  values (auth.uid(), current_date, 0)
  on conflict (user_id, dia) do nothing;
  select sumado into v_hoy from public.xp_diario where user_id = auth.uid() and dia = current_date for update;
  v_suma := greatest(0, least(p_cuanto, v_tope - coalesce(v_hoy, 0)));

  if v_suma > 0 then
    update public.xp_diario set sumado = sumado + v_suma where user_id = auth.uid() and dia = current_date;
  end if;

  update public.user_profiles
     set total_xp = coalesce(total_xp, 0) + v_suma,
         level = public.nivel_de_xp(coalesce(total_xp, 0) + v_suma)
   where id = auth.uid()
   returning total_xp into v_total;

  if v_total is null then
    raise exception 'no hay perfil para %', auth.uid();
  end if;
  return v_total;
end;
$$;

--
-- Name: account_deletion_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_deletion_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    borrar_at timestamp with time zone,
    CONSTRAINT account_deletion_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'done'::text, 'dismissed'::text, 'cancelled'::text])))
);

--
-- Name: achievement_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievement_definitions (
    id text NOT NULL,
    title text,
    description text,
    emoji text,
    icon_url text,
    condition jsonb,
    rarity text,
    xp_reward integer DEFAULT 0,
    is_active boolean DEFAULT true,
    cover_image text,
    objetivo text
);

--
-- Name: adviento_casillas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adviento_casillas (
    user_id uuid NOT NULL,
    anio integer NOT NULL,
    dia integer NOT NULL,
    abierta_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT adviento_casillas_dia_check CHECK (((dia >= 1) AND (dia <= 24)))
);

--
-- Name: app_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_feedback (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    body text NOT NULL,
    page_url text,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT app_feedback_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewed'::text, 'dismissed'::text])))
);

--
-- Name: aviso_cifras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aviso_cifras (
    aviso_id uuid NOT NULL,
    dia date NOT NULL,
    vistos integer DEFAULT 0 NOT NULL,
    clics integer DEFAULT 0 NOT NULL,
    cerrados integer DEFAULT 0 NOT NULL
);

--
-- Name: aviso_participantes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aviso_participantes (
    aviso_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: avisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avisos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tipo text DEFAULT 'novedad'::text NOT NULL,
    titulo text NOT NULL,
    texto text,
    imagen text,
    boton_texto text,
    boton_enlace text,
    participar boolean DEFAULT false NOT NULL,
    enlace_texto text,
    enlace text,
    sitios text[] DEFAULT '{franja}'::text[] NOT NULL,
    cuenta_atras boolean DEFAULT false NOT NULL,
    recordar boolean DEFAULT false NOT NULL,
    publico text DEFAULT 'todos'::text NOT NULL,
    desde timestamp with time zone,
    hasta timestamp with time zone,
    publicado boolean DEFAULT false NOT NULL,
    publicado_at timestamp with time zone,
    avisado_at timestamp with time zone,
    recordado_at timestamp with time zone,
    ganador_id uuid,
    sorteado_at timestamp with time zone,
    creado_por uuid DEFAULT auth.uid(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT avisos_enlaces_ok CHECK ((((boton_enlace IS NULL) OR (boton_enlace ~ '^(/[^/]|/$|https://)'::text)) AND ((enlace IS NULL) OR (enlace ~ '^(/[^/]|/$|https://)'::text)) AND ((imagen IS NULL) OR (imagen ~ '^https://'::text)))),
    CONSTRAINT avisos_fechas_ok CHECK (((desde IS NULL) OR (hasta IS NULL) OR (hasta > desde))),
    CONSTRAINT avisos_publico_ok CHECK ((publico = ANY (ARRAY['todos'::text, 'cuenta'::text, 'sin_cuenta'::text, 'movil'::text]))),
    CONSTRAINT avisos_sitios_ok CHECK (((cardinality(sitios) >= 1) AND (sitios <@ ARRAY['popup'::text, 'franja'::text, 'inicio'::text, 'campanita'::text]))),
    CONSTRAINT avisos_texto_ok CHECK (((texto IS NULL) OR (char_length(texto) <= 500))),
    CONSTRAINT avisos_tipo_ok CHECK ((tipo = ANY (ARRAY['concurso'::text, 'novedad'::text, 'evento'::text, 'aviso'::text, 'mantenimiento'::text]))),
    CONSTRAINT avisos_titulo_ok CHECK (((char_length(btrim(titulo)) >= 1) AND (char_length(btrim(titulo)) <= 160)))
);

--
-- Name: avisos_enviados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.avisos_enviados (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    titulo text NOT NULL,
    cuerpo text,
    enlace text,
    personas integer DEFAULT 0 NOT NULL,
    por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: busquedas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.busquedas (
    id bigint NOT NULL,
    q text NOT NULL,
    resultados integer DEFAULT 0 NOT NULL,
    donde text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT busquedas_donde_check CHECK (((donde IS NULL) OR (char_length(donde) <= 60))),
    CONSTRAINT busquedas_q_check CHECK (((char_length(q) >= 2) AND (char_length(q) <= 80))),
    CONSTRAINT busquedas_resultados_check CHECK ((resultados >= 0))
);

--
-- Name: busquedas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.busquedas ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.busquedas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: calendario_claves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.calendario_claves (
    user_id uuid NOT NULL,
    clave text NOT NULL,
    torneos boolean DEFAULT true NOT NULL,
    eventos boolean DEFAULT true NOT NULL,
    lanzamientos boolean DEFAULT false NOT NULL,
    creada_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: carta_del_dia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.carta_del_dia (
    day date NOT NULL,
    card_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text,
    name text,
    description text,
    emoji text,
    order_pos integer,
    guide_count integer DEFAULT 0,
    cover_image text,
    icon_image text,
    pokemon integer
);

--
-- Name: client_errors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    message text NOT NULL,
    stack text,
    page_url text,
    user_agent text,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT client_errors_status_check CHECK ((status = ANY (ARRAY['new'::text, 'reviewed'::text, 'dismissed'::text])))
);

--
-- Name: collab_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collab_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    roles text[] DEFAULT '{}'::text[] NOT NULL,
    horas text NOT NULL,
    experiencia text,
    por_que text,
    muestra text,
    status text DEFAULT 'nueva'::text NOT NULL,
    nota_admin text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT collab_applications_horas_check CHECK ((horas = ANY (ARRAY['poca'::text, 'media'::text, 'mucha'::text]))),
    CONSTRAINT collab_applications_largos_check CHECK (((array_length(roles, 1) IS NULL) OR (array_length(roles, 1) <= 6))),
    CONSTRAINT collab_applications_status_check CHECK ((status = ANY (ARRAY['nueva'::text, 'hablando'::text, 'aceptada'::text, 'descartada'::text])))
);

--
-- Name: collection_favorite_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_favorite_sets (
    user_id uuid NOT NULL,
    set_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: collection_folder_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_folder_cards (
    folder_id uuid NOT NULL,
    line_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: collection_folders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.collection_folders (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    parent_id uuid,
    nombre text NOT NULL,
    icono text,
    dex_id integer,
    emoji text,
    color text,
    orden integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: content_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    reporter_id uuid NOT NULL,
    content_type text NOT NULL,
    content_id uuid NOT NULL,
    reason text,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT content_reports_content_type_check CHECK ((content_type = ANY (ARRAY['guide'::text, 'profile_comment'::text, 'guide_comment'::text, 'profile_review'::text, 'private_message'::text, 'forum_post'::text]))),
    CONSTRAINT content_reports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'reviewed'::text, 'dismissed'::text])))
);

--
-- Name: conversation_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversation_participants (
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    last_read_at timestamp with time zone,
    fijada_at timestamp with time zone,
    archivada_at timestamp with time zone
);

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.conversations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: correo_textos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.correo_textos (
    tipo text NOT NULL,
    asunto text,
    intro text,
    cta text,
    pie text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    por uuid
);

--
-- Name: course_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    guide_id uuid NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    correct integer DEFAULT 0 NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    medal text,
    duration_ms integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT course_attempts_correct_sano CHECK (((correct >= 0) AND (correct <= total))),
    CONSTRAINT course_attempts_duracion_sana CHECK (((duration_ms IS NULL) OR (duration_ms >= 0))),
    CONSTRAINT course_attempts_medalla_valida CHECK (((medal IS NULL) OR (medal = ANY (ARRAY['bronce'::text, 'plata'::text, 'oro'::text])))),
    CONSTRAINT course_attempts_score_sano CHECK (((score >= 0) AND (score <= ((total * 30) + 500)))),
    CONSTRAINT course_attempts_total_sano CHECK (((total >= 0) AND (total <= 200)))
);

--
-- Name: course_review_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_review_queue (
    user_id uuid NOT NULL,
    guide_id uuid NOT NULL,
    question_key text NOT NULL,
    block jsonb NOT NULL,
    failed_at timestamp with time zone DEFAULT now() NOT NULL,
    review_after timestamp with time zone DEFAULT (now() + '2 days'::interval) NOT NULL,
    times_failed integer DEFAULT 1 NOT NULL
);

--
-- Name: daily_challenge_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_challenge_results (
    user_id uuid NOT NULL,
    day date NOT NULL,
    correct integer DEFAULT 0 NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT daily_correct_sano CHECK (((correct >= 0) AND (correct <= total))),
    CONSTRAINT daily_score_sano CHECK (((score >= 0) AND (score <= ((total * 30) + 500)))),
    CONSTRAINT daily_total_sano CHECK (((total >= 0) AND (total <= 20)))
);

--
-- Name: email_outbox; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_outbox (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    type text NOT NULL,
    subject text NOT NULL,
    preview text,
    link text,
    thread_key text,
    status text DEFAULT 'pending'::text NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    last_error text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    claimed_at timestamp with time zone,
    CONSTRAINT email_outbox_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sending'::text, 'sent'::text, 'failed'::text])))
);

--
-- Name: enlaces_cortos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enlaces_cortos (
    id text NOT NULL,
    tipo text NOT NULL,
    carga text NOT NULL,
    huella text NOT NULL,
    quien text,
    creado_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT enlaces_cortos_carga_check CHECK (((char_length(carga) >= 8) AND (char_length(carga) <= 60000))),
    CONSTRAINT enlaces_cortos_tipo_check CHECK ((tipo = ANY (ARRAY['repeticion'::text, 'posicion'::text])))
);

--
-- Name: enlaces_rotos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enlaces_rotos (
    id bigint NOT NULL,
    ruta text NOT NULL,
    desde text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT enlaces_rotos_desde_check CHECK (((desde IS NULL) OR (char_length(desde) <= 200))),
    CONSTRAINT enlaces_rotos_ruta_check CHECK (((char_length(ruta) >= 1) AND (char_length(ruta) <= 200)))
);

--
-- Name: enlaces_rotos_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public.enlaces_rotos ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.enlaces_rotos_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);

--
-- Name: evento_asistentes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.evento_asistentes (
    evento_id uuid NOT NULL,
    user_id uuid NOT NULL,
    oculto boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: forum_boards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_boards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    section_id uuid NOT NULL,
    parent_id uuid,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    "position" integer DEFAULT 0 NOT NULL,
    post_policy text DEFAULT 'todos'::text NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT forum_boards_post_policy_check CHECK ((post_policy = ANY (ARRAY['todos'::text, 'staff'::text])))
);

--
-- Name: forum_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    author_id uuid,
    body_html text NOT NULL,
    reply_to_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    edited_at timestamp with time zone,
    search_norm text GENERATED ALWAYS AS (public.plegar_texto(regexp_replace(COALESCE(body_html, ''::text), '<[^>]*>'::text, ' '::text, 'g'::text))) STORED,
    oculto_spam_at timestamp with time zone
);

--
-- Name: forum_threads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_threads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    board_id uuid NOT NULL,
    author_id uuid,
    title text NOT NULL,
    prefix text,
    is_pinned boolean DEFAULT false NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    view_count integer DEFAULT 0 NOT NULL,
    post_count integer DEFAULT 0 NOT NULL,
    last_post_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_post_author_id uuid,
    search_norm text GENERATED ALWAYS AS (public.plegar_texto(((COALESCE(title, ''::text) || ' '::text) || COALESCE(prefix, ''::text)))) STORED,
    solved_post_id uuid,
    de_pokedoc boolean DEFAULT false NOT NULL,
    CONSTRAINT forum_threads_de_pokedoc_sin_autor CHECK (((NOT de_pokedoc) OR (author_id IS NULL)))
);

--
-- Name: forum_boards_resumen; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.forum_boards_resumen WITH (security_invoker='true') AS
 WITH RECURSIVE descendientes AS (
         SELECT b_1.id AS board_id,
            b_1.id AS hijo_id
           FROM public.forum_boards b_1
        UNION ALL
         SELECT d.board_id,
            h.id
           FROM (descendientes d
             JOIN public.forum_boards h ON ((h.parent_id = d.hijo_id)))
        )
 SELECT b.id,
    b.section_id,
    b.parent_id,
    b.name,
    b.slug,
    b.description,
    b."position",
    b.post_policy,
    b.is_hidden,
    b.created_at,
    COALESCE(n.temas, (0)::bigint) AS thread_count,
    COALESCE(n.mensajes, (0)::bigint) AS post_count,
    u.last_thread_id,
    u.last_thread_title,
    u.last_post_at,
    u.last_post_author_id
   FROM ((public.forum_boards b
     LEFT JOIN LATERAL ( SELECT count(DISTINCT t.id) AS temas,
            count(p.id) AS mensajes
           FROM ((descendientes d
             JOIN public.forum_threads t ON ((t.board_id = d.hijo_id)))
             LEFT JOIN public.forum_posts p ON ((p.thread_id = t.id)))
          WHERE (d.board_id = b.id)) n ON (true))
     LEFT JOIN LATERAL ( SELECT t.id AS last_thread_id,
            t.title AS last_thread_title,
            p.created_at AS last_post_at,
            p.author_id AS last_post_author_id
           FROM ((descendientes d
             JOIN public.forum_threads t ON ((t.board_id = d.hijo_id)))
             JOIN public.forum_posts p ON ((p.thread_id = t.id)))
          WHERE (d.board_id = b.id)
          ORDER BY p.created_at DESC
         LIMIT 1) u ON (true));

--
-- Name: forum_poll_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_poll_options (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    thread_id uuid NOT NULL,
    label text NOT NULL,
    order_pos integer DEFAULT 0 NOT NULL
);

--
-- Name: forum_poll_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_poll_votes (
    option_id uuid NOT NULL,
    user_id uuid NOT NULL,
    thread_id uuid NOT NULL,
    multiple boolean NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: forum_polls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_polls (
    thread_id uuid NOT NULL,
    question text NOT NULL,
    multiple boolean DEFAULT false NOT NULL,
    closes_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: forum_post_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_post_likes (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: forum_post_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_post_reactions (
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT forum_post_reactions_kind_check CHECK ((kind = ANY (ARRAY['like'::text, 'love'::text, 'laugh'::text, 'wow'::text])))
);

--
-- Name: forum_sections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_sections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    "position" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: forum_solucion_xp; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_solucion_xp (
    thread_id uuid NOT NULL,
    post_id uuid,
    autor uuid,
    dado_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: forum_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_subscriptions (
    user_id uuid NOT NULL,
    thread_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: forum_thread_reads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.forum_thread_reads (
    user_id uuid NOT NULL,
    thread_id uuid NOT NULL,
    last_read_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: guide_collections; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_collections (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    slug text,
    emoji text,
    description text,
    category_id uuid,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: guide_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    guide_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reply_to_id uuid
);

--
-- Name: guide_helpful; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_helpful (
    guide_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: guide_pro_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_pro_content (
    guide_id uuid NOT NULL,
    blocks jsonb DEFAULT '[]'::jsonb NOT NULL,
    published_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: guide_request_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_request_votes (
    request_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: guide_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    detail text,
    requester_id uuid,
    category_id uuid,
    fulfilled_guide_id uuid,
    closed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: guide_requests_con_votos; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.guide_requests_con_votos AS
 SELECT id,
    title,
    detail,
    requester_id,
    category_id,
    fulfilled_guide_id,
    closed_at,
    created_at,
    ( SELECT count(*) AS count
           FROM public.guide_request_votes v
          WHERE (v.request_id = r.id)) AS votos
   FROM public.guide_requests r;

--
-- Name: guide_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    guide_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    rating integer NOT NULL,
    body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT guide_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

--
-- Name: guide_routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_routes (
    guide_id uuid NOT NULL,
    route_id uuid NOT NULL,
    "position" integer
);

--
-- Name: guide_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guide_suggestions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    guide_id uuid NOT NULL,
    author_id uuid,
    quote text,
    body text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT guide_suggestions_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'rejected'::text])))
);

--
-- Name: guides; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.guides (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text,
    title text,
    description text,
    category_id uuid,
    blocks jsonb,
    is_pro boolean DEFAULT false,
    xp_reward integer DEFAULT 0,
    estimated_mins integer,
    tags text[],
    cover_emoji text,
    cover_image text,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    reference_blocks jsonb,
    reference_unlocked_by_default boolean DEFAULT true,
    has_reference_blocks boolean DEFAULT false,
    route_ids uuid[],
    level text,
    view_count integer DEFAULT 0,
    collection_id uuid,
    collection_order integer,
    guide_rarity text,
    search_content text,
    author_id uuid,
    review_status text DEFAULT 'approved'::text NOT NULL,
    rejection_reason text,
    submitted_at timestamp with time zone,
    has_pro_content boolean DEFAULT false NOT NULL,
    search_norm text GENERATED ALWAYS AS (public.plegar_texto(((((COALESCE(title, ''::text) || ' '::text) || COALESCE(description, ''::text)) || ' '::text) || COALESCE(search_content, ''::text)))) STORED,
    kind text DEFAULT 'guide'::text NOT NULL,
    updated_at timestamp with time zone,
    forum_thread_id uuid,
    telegram_sent_at timestamp with time zone,
    x_sent_at timestamp with time zone,
    x_post_id text,
    og_image text,
    tambien_en_url text,
    tambien_en_nombre text,
    CONSTRAINT guides_kind_valido CHECK ((kind = ANY (ARRAY['guide'::text, 'news'::text]))),
    CONSTRAINT guides_review_status_check CHECK ((review_status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text, 'rejected'::text])))
);

--
-- Name: home_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.home_config (
    id integer NOT NULL,
    blocks jsonb,
    updated_at timestamp with time zone DEFAULT now()
);

--
-- Name: judge_applications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.judge_applications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    applied_at timestamp with time zone DEFAULT now() NOT NULL,
    decided_at timestamp with time zone,
    decided_by uuid,
    CONSTRAINT judge_applications_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);

--
-- Name: judge_calls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.judge_calls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    match_id uuid NOT NULL,
    created_by uuid NOT NULL,
    assigned_judge_id uuid,
    status text DEFAULT 'open'::text NOT NULL,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    notified_at timestamp with time zone,
    CONSTRAINT judge_calls_status_check CHECK ((status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text])))
);

ALTER TABLE ONLY public.judge_calls REPLICA IDENTITY FULL;

--
-- Name: judge_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.judge_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    judge_call_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT judge_messages_message_check CHECK ((char_length(message) <= 2000))
);

--
-- Name: learning_paths; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.learning_paths (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text,
    title text,
    description text,
    emoji text,
    guide_ids uuid[],
    is_featured boolean DEFAULT false
);

--
-- Name: logros_a_mano; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.logros_a_mano (
    id bigint NOT NULL,
    user_id uuid NOT NULL,
    logro_id text NOT NULL,
    accion text NOT NULL,
    motivo text,
    por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT logros_a_mano_accion_check CHECK ((accion = ANY (ARRAY['dar'::text, 'quitar'::text])))
);

--
-- Name: logros_a_mano_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.logros_a_mano_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: logros_a_mano_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.logros_a_mano_id_seq OWNED BY public.logros_a_mano.id;

--
-- Name: mas_caro_del_dia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mas_caro_del_dia (
    day date NOT NULL,
    card_ids text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: match_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    mi_mazo text NOT NULL,
    rival_mazo text NOT NULL,
    mi_mazo_nombre text NOT NULL,
    rival_mazo_nombre text NOT NULL,
    resultado text NOT NULL,
    donde text,
    notas text,
    jugada_el date DEFAULT ((now() AT TIME ZONE 'utc'::text))::date NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    tipo text DEFAULT 'normal'::text NOT NULL,
    torneo_id uuid,
    replay_id text,
    user_deck_id uuid,
    formato text,
    juegos text,
    salida text,
    CONSTRAINT match_log_formato_ok CHECK (((formato IS NULL) OR (formato = ANY (ARRAY['bo1'::text, 'bo3'::text])))),
    CONSTRAINT match_log_juegos_ok CHECK (((juegos IS NULL) OR ((juegos ~ '^[WLT]{1,3}$'::text) AND ((formato = 'bo3'::text) OR (length(juegos) = 1))))),
    CONSTRAINT match_log_resultado_check CHECK ((resultado = ANY (ARRAY['win'::text, 'loss'::text, 'draw'::text]))),
    CONSTRAINT match_log_salida_ok CHECK (((salida IS NULL) OR ((juegos IS NOT NULL) AND (salida ~ '^[12-]{1,3}$'::text) AND (length(salida) = length(juegos))))),
    CONSTRAINT match_log_tipo_check CHECK ((tipo = ANY (ARRAY['normal'::text, 'id'::text, 'no_show'::text, 'bye'::text])))
);

--
-- Name: match_log_ajustes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_log_ajustes (
    user_id uuid DEFAULT auth.uid() NOT NULL,
    user_deck_id uuid,
    mi_mazo text,
    mi_mazo_nombre text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT match_log_ajustes_mazo_entero CHECK (((mi_mazo IS NULL) = (mi_mazo_nombre IS NULL))),
    CONSTRAINT match_log_ajustes_mi_mazo_check CHECK (((mi_mazo IS NULL) OR ((char_length(mi_mazo) >= 1) AND (char_length(mi_mazo) <= 200)))),
    CONSTRAINT match_log_ajustes_mi_mazo_nombre_check CHECK (((mi_mazo_nombre IS NULL) OR ((char_length(mi_mazo_nombre) >= 1) AND (char_length(mi_mazo_nombre) <= 200))))
);

--
-- Name: match_log_torneos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_log_torneos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    nombre text NOT NULL,
    donde text,
    mi_mazo text,
    mi_mazo_nombre text,
    jugado_el date DEFAULT ((now() AT TIME ZONE 'utc'::text))::date NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cerrado_el timestamp with time zone,
    user_deck_id uuid,
    puesto integer,
    jugadores integer,
    CONSTRAINT match_log_torneos_jugadores_ok CHECK (((jugadores IS NULL) OR ((jugadores >= 2) AND (jugadores <= 99999)))),
    CONSTRAINT match_log_torneos_puesto_cabe CHECK (((puesto IS NULL) OR (jugadores IS NULL) OR (puesto <= jugadores))),
    CONSTRAINT match_log_torneos_puesto_ok CHECK (((puesto IS NULL) OR ((puesto >= 1) AND (puesto <= 9999))))
);

--
-- Name: match_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    message text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT match_messages_message_check CHECK ((char_length(message) <= 2000))
);

--
-- Name: match_reports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    reporter_id uuid NOT NULL,
    result text NOT NULL,
    score text,
    reported_at timestamp with time zone DEFAULT now() NOT NULL,
    game_number smallint DEFAULT 0 NOT NULL,
    CONSTRAINT match_reports_game_number_check CHECK (((game_number >= 0) AND (game_number <= 3))),
    CONSTRAINT match_reports_result_check CHECK ((result = ANY (ARRAY['win'::text, 'loss'::text, 'draw'::text])))
);

--
-- Name: match_results; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_results (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id uuid NOT NULL,
    result text NOT NULL,
    winner_id uuid,
    score text,
    resolved_by uuid,
    resolved_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT match_results_result_check CHECK ((result = ANY (ARRAY['a_wins'::text, 'b_wins'::text, 'draw'::text, 'bye'::text, 'forfeit_a'::text, 'forfeit_b'::text, 'forfeit_both'::text])))
);

--
-- Name: meta_arquetipos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_arquetipos (
    id text NOT NULL,
    nombre text NOT NULL,
    iconos text[] DEFAULT '{}'::text[] NOT NULL,
    visto_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: meta_cartas_dia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_cartas_dia (
    dia date NOT NULL,
    arquetipo text NOT NULL,
    seccion text NOT NULL,
    clave text NOT NULL,
    nombre text NOT NULL,
    set_codigo text DEFAULT ''::text NOT NULL,
    numero text DEFAULT ''::text NOT NULL,
    mazos integer DEFAULT 0 NOT NULL,
    copias integer DEFAULT 0 NOT NULL,
    CONSTRAINT meta_cartas_dia_seccion_check CHECK ((seccion = ANY (ARRAY['pokemon'::text, 'trainer'::text, 'energy'::text])))
);

--
-- Name: meta_guias; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_guias (
    arquetipo text NOT NULL,
    guide_id uuid NOT NULL,
    added_by uuid DEFAULT auth.uid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: meta_resultados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_resultados (
    torneo_id text NOT NULL,
    jugador text NOT NULL,
    arquetipo text NOT NULL,
    puesto integer,
    victorias integer DEFAULT 0 NOT NULL,
    derrotas integer DEFAULT 0 NOT NULL,
    empates integer DEFAULT 0 NOT NULL,
    abandono integer,
    con_lista boolean DEFAULT false NOT NULL,
    nombre_jugador text,
    pais text,
    lista jsonb,
    enlace text
);

--
-- Name: meta_torneos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meta_torneos (
    id text NOT NULL,
    nombre text NOT NULL,
    fecha timestamp with time zone NOT NULL,
    jugadores integer DEFAULT 0 NOT NULL,
    organizador integer,
    clasificados integer DEFAULT 0 NOT NULL,
    con_lista integer DEFAULT 0 NOT NULL,
    leido_at timestamp with time zone DEFAULT now() NOT NULL,
    fuente text DEFAULT 'online'::text NOT NULL,
    tipo text,
    enlace text,
    CONSTRAINT meta_torneos_fuente CHECK ((fuente = ANY (ARRAY['online'::text, 'oficial'::text, 'pokedoc'::text])))
);

--
-- Name: moderaciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.moderaciones (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    que text NOT NULL,
    motivo text,
    hasta timestamp with time zone,
    por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    quitada_at timestamp with time zone,
    quitada_por uuid,
    CONSTRAINT moderaciones_que_check CHECK ((que = ANY (ARRAY['silencio'::text, 'baneo'::text])))
);

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text,
    body text,
    data jsonb,
    target text DEFAULT 'all'::text,
    status text DEFAULT 'draft'::text,
    scheduled_at timestamp with time zone,
    sent_at timestamp with time zone,
    sent_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: online_now; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.online_now (
    token text NOT NULL,
    user_id uuid,
    last_seen timestamp with time zone DEFAULT now() NOT NULL,
    thread_id uuid
);

--
-- Name: page_views; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_views (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    path text NOT NULL,
    user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    is_bot boolean,
    origen text,
    campana text,
    aparato text,
    modo text,
    primera_del_dia boolean,
    primera_en_app boolean,
    nueva_visita boolean,
    plataforma text,
    CONSTRAINT page_views_aparato_valido CHECK (((aparato IS NULL) OR (aparato = ANY (ARRAY['movil'::text, 'tablet'::text, 'pc'::text])))),
    CONSTRAINT page_views_campana_largo CHECK (((campana IS NULL) OR (char_length(campana) <= 40))),
    CONSTRAINT page_views_modo_valido CHECK (((modo IS NULL) OR (modo = ANY (ARRAY['app'::text, 'web'::text])))),
    CONSTRAINT page_views_origen_largo CHECK (((origen IS NULL) OR (char_length(origen) <= 60))),
    CONSTRAINT page_views_plataforma_valida CHECK (((plataforma IS NULL) OR (plataforma = ANY (ARRAY['ios'::text, 'android'::text, 'otro'::text]))))
);

--
-- Name: page_vitals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.page_vitals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    path text NOT NULL,
    lcp_ms integer,
    inp_ms integer,
    cls_mil integer,
    movil boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT page_vitals_cls_mil_check CHECK (((cls_mil >= 0) AND (cls_mil <= 100000))),
    CONSTRAINT page_vitals_inp_ms_check CHECK (((inp_ms >= 0) AND (inp_ms <= 60000))),
    CONSTRAINT page_vitals_lcp_ms_check CHECK (((lcp_ms >= 0) AND (lcp_ms <= 120000))),
    CONSTRAINT page_vitals_path_check CHECK ((char_length(path) <= 200))
);

--
-- Name: pairing_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pairing_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    player_low_id uuid NOT NULL,
    player_high_id uuid NOT NULL,
    round_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: private_message_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.private_message_reactions (
    message_id uuid NOT NULL,
    conversation_id uuid NOT NULL,
    user_id uuid NOT NULL,
    kind text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT private_message_reactions_kind_check CHECK ((kind = ANY (ARRAY['like'::text, 'love'::text, 'laugh'::text, 'wow'::text])))
);

--
-- Name: private_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.private_messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    conversation_id uuid NOT NULL,
    sender_id uuid NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    adjuntos jsonb DEFAULT '[]'::jsonb NOT NULL,
    deleted_at timestamp with time zone,
    reply_to_id uuid,
    CONSTRAINT private_messages_adjuntos_lista CHECK (((jsonb_typeof(adjuntos) = 'array'::text) AND (jsonb_array_length(adjuntos) <= 4)))
);

--
-- Name: profile_reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profile_reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profile_id uuid NOT NULL,
    reviewer_id uuid NOT NULL,
    rating integer NOT NULL,
    body text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profile_reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

--
-- Name: push_subscriptions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.push_subscriptions (
    endpoint text NOT NULL,
    user_id uuid NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: question_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.question_stats (
    guide_id uuid NOT NULL,
    question_key text NOT NULL,
    times_answered integer DEFAULT 0 NOT NULL,
    times_correct integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: replay_puzzle_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.replay_puzzle_answers (
    puzzle_id text NOT NULL,
    user_id uuid NOT NULL,
    opcion integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: replay_puzzles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.replay_puzzles (
    id text DEFAULT substr(md5(((random())::text || (clock_timestamp())::text)), 1, 10) NOT NULL,
    replay_id text NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    foto integer NOT NULL,
    pregunta text NOT NULL,
    opciones text[] NOT NULL,
    correcta integer NOT NULL,
    explicacion text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT replay_puzzles_correcta CHECK (((correcta >= 0) AND (correcta < cardinality(opciones)))),
    CONSTRAINT replay_puzzles_explicacion CHECK (((char_length(explicacion) >= 3) AND (char_length(explicacion) <= 1000))),
    CONSTRAINT replay_puzzles_foto CHECK (((foto >= 1) AND (foto <= 5000))),
    CONSTRAINT replay_puzzles_opciones CHECK ((((cardinality(opciones) >= 2) AND (cardinality(opciones) <= 4)) AND (array_position(opciones, NULL::text) IS NULL) AND (char_length(array_to_string(opciones, ''::text)) <= 480))),
    CONSTRAINT replay_puzzles_pregunta CHECK (((char_length(pregunta) >= 3) AND (char_length(pregunta) <= 200)))
);

--
-- Name: replays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.replays (
    id text DEFAULT substr(md5(((random())::text || (clock_timestamp())::text)), 1, 10) NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    titulo text DEFAULT 'Repetición'::text NOT NULL,
    registro text NOT NULL,
    registro_md5 text GENERATED ALWAYS AS (md5(registro)) STORED,
    jugador_a text,
    jugador_b text,
    ganador text,
    turnos integer,
    compartida boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    mazo_a text,
    mazo_b text,
    notas jsonb DEFAULT '[]'::jsonb NOT NULL,
    publica boolean DEFAULT false NOT NULL,
    arquetipos text[],
    publicada_at timestamp with time zone,
    CONSTRAINT replays_arquetipos CHECK (((arquetipos IS NULL) OR (((cardinality(arquetipos) >= 1) AND (cardinality(arquetipos) <= 2)) AND (array_to_string(arquetipos, ','::text) ~ '^[a-z0-9][a-z0-9-]{0,79}(,[a-z0-9][a-z0-9-]{0,79})?$'::text)))),
    CONSTRAINT replays_jugadores CHECK (((char_length(COALESCE(jugador_a, ''::text)) <= 40) AND (char_length(COALESCE(jugador_b, ''::text)) <= 40) AND (char_length(COALESCE(ganador, ''::text)) <= 40))),
    CONSTRAINT replays_largo CHECK (((char_length(registro) >= 100) AND (char_length(registro) <= 200000))),
    CONSTRAINT replays_mazos CHECK (((char_length(COALESCE(mazo_a, ''::text)) <= 120) AND (char_length(COALESCE(mazo_b, ''::text)) <= 120))),
    CONSTRAINT replays_notas CHECK (public.replays_notas_validas(notas)),
    CONSTRAINT replays_titulo CHECK (((char_length(titulo) >= 1) AND (char_length(titulo) <= 120))),
    CONSTRAINT replays_turnos CHECK (((turnos IS NULL) OR ((turnos >= 0) AND (turnos <= 500))))
);

--
-- Name: retos_arbitro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retos_arbitro (
    juego text NOT NULL,
    day date NOT NULL,
    datos jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: retos_bonos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retos_bonos (
    user_id uuid NOT NULL,
    tipo text NOT NULL,
    day date NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT retos_bonos_tipo CHECK ((tipo = ANY (ARRAY['perfecto'::text, 'racha7'::text])))
);

--
-- Name: retos_llave; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retos_llave (
    id integer DEFAULT 1 NOT NULL,
    llave text NOT NULL,
    CONSTRAINT retos_llave_id_check CHECK ((id = 1))
);

--
-- Name: retos_partidas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retos_partidas (
    user_id uuid NOT NULL,
    juego text NOT NULL,
    day date NOT NULL,
    estado jsonb NOT NULL,
    guardado jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: retos_resultados; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retos_resultados (
    user_id uuid NOT NULL,
    juego text NOT NULL,
    day date NOT NULL,
    aciertos integer DEFAULT 0 NOT NULL,
    total integer DEFAULT 0 NOT NULL,
    intentos integer,
    acertada boolean DEFAULT false NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    estado jsonb,
    CONSTRAINT retos_resultados_cuentas CHECK ((((total >= 0) AND (total <= 20)) AND ((aciertos >= 0) AND (aciertos <= total)))),
    CONSTRAINT retos_resultados_estado CHECK (((estado IS NULL) OR ((jsonb_typeof(estado) = 'object'::text) AND (octet_length((estado)::text) <= 8000)))),
    CONSTRAINT retos_resultados_intentos CHECK (((intentos IS NULL) OR ((intentos >= 0) AND (intentos <= 99)))),
    CONSTRAINT retos_resultados_juego CHECK ((juego = ANY (ARRAY['reto'::text, 'carta'::text, 'caro'::text, 'silueta'::text, 'ordena'::text, 'expansion'::text, 'parejas'::text]))),
    CONSTRAINT retos_resultados_xp CHECK (((xp >= 0) AND (xp <= 100)))
);

--
-- Name: retos_reto_del_dia; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.retos_reto_del_dia (
    juego text NOT NULL,
    day date NOT NULL,
    datos jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.rounds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    round_number smallint NOT NULL,
    phase text NOT NULL,
    started_at timestamp with time zone,
    ends_at timestamp with time zone,
    closed_at timestamp with time zone,
    players_notified_at timestamp with time zone,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    checkin_warned_at timestamp with time zone,
    CONSTRAINT rounds_phase_check CHECK ((phase = ANY (ARRAY['swiss'::text, 'top_cut'::text]))),
    CONSTRAINT rounds_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'finished'::text])))
);

ALTER TABLE ONLY public.rounds REPLICA IDENTITY FULL;

--
-- Name: scrydex_estado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scrydex_estado (
    clave text NOT NULL,
    valor jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.site_settings (
    key text NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: tcg_archetypes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_archetypes (
    id text NOT NULL,
    nombre text NOT NULL,
    iconos jsonb DEFAULT '[]'::jsonb NOT NULL,
    requiere jsonb DEFAULT '[]'::jsonb NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT arquetipos_con_requisitos CHECK (((jsonb_typeof(requiere) = 'array'::text) AND (jsonb_array_length(requiere) > 0))),
    CONSTRAINT arquetipos_dos_iconos CHECK (((jsonb_typeof(iconos) = 'array'::text) AND (jsonb_array_length(iconos) <= 2)))
);

--
-- Name: tcg_card_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_card_history (
    card_id text NOT NULL,
    dia date NOT NULL,
    cm_low numeric(10,2),
    cm_low_es numeric(10,2),
    cm_low_en numeric(10,2),
    cm_low_de numeric(10,2),
    cm_low_fr numeric(10,2),
    cm_low_it numeric(10,2),
    cm_low_ja numeric(10,2),
    tp_market_eur numeric(10,2),
    origen text
);

--
-- Name: tcg_card_play; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_card_play (
    name_key text NOT NULL,
    name text NOT NULL,
    decks integer DEFAULT 0 NOT NULL,
    total_copies integer DEFAULT 0 NOT NULL,
    tournaments integer DEFAULT 0 NOT NULL,
    archetypes jsonb,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: tcg_card_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_card_versions (
    tcggo_id integer NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    card_id text NOT NULL,
    set_id text,
    numero text,
    nombre text,
    etiqueta text,
    cm_id_product integer,
    link_cm text,
    cm_low numeric,
    cm_low_en numeric,
    cm_low_de numeric,
    cm_low_fr numeric,
    cm_low_es numeric,
    cm_low_it numeric,
    cm_low_ja numeric,
    cm_avg7 numeric,
    cm_avg30 numeric,
    cm_disponibles integer,
    tp_market_eur numeric,
    tp_mid_eur numeric,
    actualizado_at timestamp with time zone DEFAULT now() NOT NULL,
    creado_at timestamp with time zone DEFAULT now() NOT NULL,
    imagen text,
    icono text,
    salio_en text,
    lanzamiento date,
    clase text,
    origen text,
    CONSTRAINT tcg_card_versions_clase_ok CHECK (((clase IS NULL) OR (clase = ANY (ARRAY['impresion'::text, 'sello'::text, 'adicional'::text])))),
    CONSTRAINT tcg_card_versions_origen_ok CHECK (((origen IS NULL) OR (origen = ANY (ARRAY['mano'::text, 'edicion'::text, 'foto'::text, 'tcgdex'::text, 'fundida'::text]))))
);

--
-- Name: tcg_card_versions_mano_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tcg_card_versions_mano_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: tcg_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_cards (
    id text NOT NULL,
    set_id text NOT NULL,
    local_id text NOT NULL,
    name text NOT NULL,
    image_path text,
    category text,
    rarity text,
    types text[],
    hp integer,
    dex_ids integer[],
    illustrator text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    regulation_mark text,
    stage text,
    evolve_from text,
    retreat integer,
    attacks jsonb,
    abilities jsonb,
    weaknesses jsonb,
    resistances jsonb,
    trainer_type text,
    energy_type text,
    suffix text,
    description text,
    variants jsonb,
    detalle_at timestamp with time zone,
    detalle_error text,
    detalle_lang text,
    name_es text,
    name_key text GENERATED ALWAYS AS (btrim(regexp_replace(public.immutable_unaccent(lower(COALESCE(name, ''::text))), '[-–—_[:space:]]+'::text, ' '::text, 'g'::text))) STORED,
    curado_v smallint DEFAULT 0 NOT NULL,
    escaneo_buscado_at timestamp with time zone,
    image_scrydex text,
    rarity_en text,
    rarity_code text,
    scrydex_at timestamp with time zone,
    name_en text,
    name_search text GENERATED ALWAYS AS (public.immutable_unaccent(lower(((((COALESCE(name, ''::text) || ' '::text) || COALESCE(name_es, ''::text)) || ' '::text) || COALESCE(name_en, ''::text))))) STORED,
    cm_id_product_propio integer,
    cm_por text,
    cm_emparejado_at timestamp with time zone,
    tp_id_product_propio integer,
    tcggo_id integer,
    image_tcggo text,
    origen text,
    tcggo_at timestamp with time zone,
    CONSTRAINT tcg_cards_market_check CHECK ((market = ANY (ARRAY['WEST'::text, 'JP'::text, 'KO'::text, 'CN'::text, 'TW'::text, 'ID'::text, 'TH'::text])))
);

--
-- Name: tcg_correcciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_correcciones (
    tabla text NOT NULL,
    id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    columna text NOT NULL,
    valor jsonb,
    anterior jsonb,
    autor uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tcg_correcciones_tabla_check CHECK ((tabla = ANY (ARRAY['tcg_sets'::text, 'tcg_cards'::text])))
);

--
-- Name: tcg_eras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_eras (
    market text NOT NULL,
    id text NOT NULL,
    nombre text NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    grupo text,
    CONSTRAINT tcg_eras_grupo CHECK (((grupo IS NULL) OR (grupo = 'otros'::text))),
    CONSTRAINT tcg_eras_id CHECK (((id ~ '^[a-z0-9][a-z0-9-]*$'::text) AND (char_length(id) <= 60))),
    CONSTRAINT tcg_eras_nombre CHECK (((char_length(nombre) >= 1) AND (char_length(nombre) <= 80)))
);

--
-- Name: tcg_product_contenido; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_product_contenido (
    product_id bigint NOT NULL,
    contenido_tipo text NOT NULL,
    contenido_id bigint NOT NULL,
    cantidad integer DEFAULT 1 NOT NULL,
    nombre text NOT NULL,
    image text,
    cm_lowest numeric,
    tp_market numeric,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tcg_product_contenido_cantidad_check CHECK (((cantidad >= 1) AND (cantidad <= 10000))),
    CONSTRAINT tcg_product_contenido_contenido_tipo_check CHECK ((contenido_tipo = ANY (ARRAY['product'::text, 'card'::text])))
);

--
-- Name: tcg_product_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_product_history (
    product_id bigint NOT NULL,
    dia date NOT NULL,
    cm_low numeric,
    cm_low_en numeric,
    tp_market_eur numeric,
    origen text DEFAULT 'tcggo'::text NOT NULL
);

--
-- Name: tcg_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_products (
    id bigint NOT NULL,
    episode_id bigint,
    lang text DEFAULT 'en'::text NOT NULL,
    name text NOT NULL,
    slug text,
    tipo text DEFAULT 'otro'::text NOT NULL,
    image text,
    cardmarket_id bigint,
    tcgplayer_id bigint,
    tcggo_url text,
    cm_lowest numeric,
    cm_lowest_eu numeric,
    cm_lowest_es numeric,
    cm_avg30 numeric,
    cm_avg7 numeric,
    cm_disponibles integer,
    release_date date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    cm_lowest_de numeric,
    cm_lowest_fr numeric,
    cm_lowest_it numeric,
    historial_at timestamp with time zone,
    market text DEFAULT 'WEST'::text NOT NULL,
    pvp_eur numeric
);

--
-- Name: tcg_repetidas_distintas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_repetidas_distintas (
    market text NOT NULL,
    set_id text NOT NULL,
    numero text NOT NULL,
    nombre text NOT NULL,
    ids text[] NOT NULL,
    autor uuid,
    creado_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: tcg_repetidas_hechas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_repetidas_hechas (
    id bigint NOT NULL,
    market text NOT NULL,
    carta text NOT NULL,
    destino text NOT NULL,
    decision text NOT NULL,
    etiqueta text,
    version_id integer,
    version_creada boolean DEFAULT false NOT NULL,
    fila jsonb NOT NULL,
    precio jsonb,
    correcciones jsonb,
    coleccion jsonb,
    deseos jsonb,
    deseos_borrados jsonb,
    avisos jsonb,
    vitrina jsonb,
    albumes jsonb,
    lapidas text[] DEFAULT '{}'::text[] NOT NULL,
    autor uuid,
    hecha_at timestamp with time zone DEFAULT now() NOT NULL,
    deshecha_at timestamp with time zone,
    versiones jsonb,
    CONSTRAINT tcg_repetidas_hechas_decision_check CHECK ((decision = ANY (ARRAY['version'::text, 'misma'::text])))
);

--
-- Name: tcg_repetidas_hechas_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.tcg_repetidas_hechas_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

--
-- Name: tcg_repetidas_hechas_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.tcg_repetidas_hechas_id_seq OWNED BY public.tcg_repetidas_hechas.id;

--
-- Name: tcg_set_idiomas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_set_idiomas (
    set_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    idiomas text[] NOT NULL
);

--
-- Name: tcg_set_idiomas_mano; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_set_idiomas_mano (
    set_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    idioma text NOT NULL,
    hay boolean NOT NULL,
    autor uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tcg_set_idiomas_mano_idioma_check CHECK ((idioma = ANY (ARRAY['es'::text, 'en'::text, 'fr'::text, 'de'::text, 'it'::text, 'pt'::text, 'nl'::text, 'ja'::text, 'ko'::text, 'zh'::text])))
);

--
-- Name: tcg_set_valor; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_set_valor (
    set_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    dia date NOT NULL,
    valor_cm numeric,
    valor_tp numeric,
    origen text DEFAULT 'tcggo'::text NOT NULL
);

--
-- Name: tcg_sets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_sets (
    id text NOT NULL,
    name text NOT NULL,
    serie_id text,
    serie_name text,
    logo_path text,
    symbol_url text,
    release_date date,
    card_count_total integer,
    card_count_official integer,
    imported_at timestamp with time zone,
    imported_cards integer DEFAULT 0 NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    tcg_online_code text,
    names_fixed_at timestamp with time zone,
    regulation_mark text,
    regulation_mark_origen text,
    curado_at timestamp with time zone,
    curado_v smallint DEFAULT 0 NOT NULL,
    logo_scrydex text,
    symbol_scrydex text,
    scrydex_id text,
    scrydex_por text,
    name_en text,
    serie_name_en text,
    orden integer,
    oculto boolean DEFAULT false NOT NULL,
    scrydex_manda boolean DEFAULT false NOT NULL,
    logo_tcggo text,
    tcggo_id integer,
    origen text,
    symbol_tcggo text,
    tcggo_gemelos jsonb,
    CONSTRAINT tcg_sets_market_check CHECK ((market = ANY (ARRAY['WEST'::text, 'JP'::text, 'KO'::text, 'CN'::text, 'TW'::text, 'ID'::text, 'TH'::text])))
);

--
-- Name: tcg_version_idioma; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tcg_version_idioma (
    set_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    variante text NOT NULL,
    idioma text NOT NULL,
    hay boolean DEFAULT false NOT NULL,
    autor uuid,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    card_id text DEFAULT ''::text NOT NULL,
    CONSTRAINT tcg_version_idioma_idioma_check CHECK ((idioma = ANY (ARRAY['es'::text, 'en'::text, 'fr'::text, 'de'::text, 'it'::text, 'pt'::text, 'nl'::text, 'ja'::text, 'ko'::text, 'zh'::text])))
);

--
-- Name: telemetria_ritmo; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.telemetria_ritmo (
    tabla text NOT NULL,
    minuto timestamp with time zone NOT NULL,
    n integer DEFAULT 0 NOT NULL
);

--
-- Name: tienda_avisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_avisos (
    tienda_id uuid NOT NULL,
    card_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    user_id uuid NOT NULL,
    avisado_el timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: tienda_cambios; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_cambios (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tienda_id uuid DEFAULT auth.uid() NOT NULL,
    venta_ticket uuid NOT NULL,
    compra_ticket uuid NOT NULL,
    entregado numeric(10,2) NOT NULL,
    recibido numeric(10,2) NOT NULL,
    diferencia numeric(10,2) NOT NULL,
    pago text,
    pct integer,
    cliente text,
    hecho_el timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tienda_cambios_cliente CHECK (((cliente IS NULL) OR ((char_length(cliente) >= 1) AND (char_length(cliente) <= 80)))),
    CONSTRAINT tienda_cambios_dinero CHECK (((entregado >= (0)::numeric) AND (recibido >= (0)::numeric))),
    CONSTRAINT tienda_cambios_pago CHECK ((((diferencia = (0)::numeric) AND (pago IS NULL)) OR ((diferencia > (0)::numeric) AND (pago = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'bizum'::text, 'paypal'::text]))) OR ((diferencia < (0)::numeric) AND (pago = ANY (ARRAY['efectivo'::text, 'bizum'::text, 'paypal'::text, 'otro'::text]))))),
    CONSTRAINT tienda_cambios_pct CHECK (((pct IS NULL) OR ((pct >= 0) AND (pct <= 200))))
);

--
-- Name: tienda_cobros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_cobros (
    tienda_id uuid NOT NULL,
    pagos text[] DEFAULT ARRAY['bizum'::text, 'paypal'::text, 'efectivo'::text] NOT NULL,
    bizum text,
    paypal text,
    minimo integer,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tienda_cobros_minimo CHECK (((minimo IS NULL) OR ((minimo >= 1) AND (minimo <= 100)))),
    CONSTRAINT tienda_cobros_pagos CHECK (((pagos <@ ARRAY['bizum'::text, 'paypal'::text, 'efectivo'::text]) AND (cardinality(pagos) >= 1))),
    CONSTRAINT tienda_cobros_textos CHECK ((((bizum IS NULL) OR (char_length(bizum) <= 40)) AND ((paypal IS NULL) OR (char_length(paypal) <= 120))))
);

--
-- Name: tienda_compras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_compras (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tienda_id uuid DEFAULT auth.uid() NOT NULL,
    ticket uuid NOT NULL,
    stock_id uuid,
    card_id text,
    market text DEFAULT 'WEST'::text NOT NULL,
    product_id bigint,
    idioma text NOT NULL,
    estado text NOT NULL,
    variante text DEFAULT 'normal'::text NOT NULL,
    gradeo text,
    unidades integer NOT NULL,
    coste numeric(10,2) NOT NULL,
    cm numeric(10,2),
    cliente text,
    comprada_el timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pago text,
    valorado numeric(10,2),
    lote_id uuid,
    de_lote uuid,
    CONSTRAINT tienda_compras_cliente CHECK (((cliente IS NULL) OR ((char_length(cliente) >= 1) AND (char_length(cliente) <= 80)))),
    CONSTRAINT tienda_compras_dinero CHECK (((coste >= (0)::numeric) AND ((cm IS NULL) OR (cm >= (0)::numeric)))),
    CONSTRAINT tienda_compras_pago CHECK (((pago IS NULL) OR (pago = ANY (ARRAY['efectivo'::text, 'bizum'::text, 'paypal'::text, 'otro'::text, 'cambio'::text])))),
    CONSTRAINT tienda_compras_que CHECK ((num_nonnulls(card_id, product_id, lote_id) = 1)),
    CONSTRAINT tienda_compras_unidades CHECK (((unidades >= 1) AND (unidades <= 99999))),
    CONSTRAINT tienda_compras_valorado CHECK (((valorado IS NULL) OR (valorado >= (0)::numeric)))
);

--
-- Name: tienda_fotos_pedidas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_fotos_pedidas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tienda_id uuid NOT NULL,
    comprador_id uuid NOT NULL,
    stock_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    atendida_at timestamp with time zone,
    como text,
    CONSTRAINT tienda_fotos_pedidas_como CHECK (((como IS NULL) OR (como = ANY (ARRAY['subidas'::text, 'quitada'::text]))))
);

--
-- Name: tienda_lotes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_lotes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tienda_id uuid DEFAULT auth.uid() NOT NULL,
    compra_ticket uuid NOT NULL,
    vale numeric(10,2),
    coste numeric(10,2) NOT NULL,
    pct integer,
    cartas integer,
    foto text,
    cliente text,
    estado text DEFAULT 'por_desglosar'::text NOT NULL,
    creado_el timestamp with time zone DEFAULT now() NOT NULL,
    desglosado_el timestamp with time zone,
    desglosadas integer,
    CONSTRAINT tienda_lotes_cartas CHECK (((cartas IS NULL) OR ((cartas >= 1) AND (cartas <= 9999)))),
    CONSTRAINT tienda_lotes_cliente CHECK (((cliente IS NULL) OR ((char_length(cliente) >= 1) AND (char_length(cliente) <= 80)))),
    CONSTRAINT tienda_lotes_dinero CHECK (((coste >= (0)::numeric) AND ((vale IS NULL) OR (vale >= (0)::numeric)))),
    CONSTRAINT tienda_lotes_estado CHECK ((estado = ANY (ARRAY['por_desglosar'::text, 'desglosado'::text]))),
    CONSTRAINT tienda_lotes_foto CHECK (((foto IS NULL) OR ((char_length(foto) >= 3) AND (char_length(foto) <= 200)))),
    CONSTRAINT tienda_lotes_pct CHECK (((pct IS NULL) OR ((pct >= 0) AND (pct <= 200))))
);

--
-- Name: tienda_ofertas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_ofertas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tienda_id uuid NOT NULL,
    comprador_id uuid NOT NULL,
    stock_id uuid,
    card_id text,
    market text,
    product_id bigint,
    idioma text,
    estado_carta text,
    variante text,
    gradeo text,
    unidades integer DEFAULT 1 NOT NULL,
    precio_tienda numeric(10,2),
    precio numeric(10,2) NOT NULL,
    turno text DEFAULT 'tienda'::text NOT NULL,
    pasos jsonb DEFAULT '[]'::jsonb NOT NULL,
    estado text DEFAULT 'abierta'::text NOT NULL,
    envio text DEFAULT 'mano'::text NOT NULL,
    envio_tipo text,
    envio_precio numeric(10,2) DEFAULT 0 NOT NULL,
    pago text NOT NULL,
    reserva_id uuid,
    reservada_hasta timestamp with time zone,
    ticket uuid,
    seguimiento text,
    caduca_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tienda_ofertas_efectivo CHECK (((pago <> 'efectivo'::text) OR (envio = 'mano'::text))),
    CONSTRAINT tienda_ofertas_envio CHECK ((envio = ANY (ARRAY['mano'::text, 'correo'::text]))),
    CONSTRAINT tienda_ofertas_estado CHECK ((estado = ANY (ARRAY['abierta'::text, 'aceptada'::text, 'pagada'::text, 'hecha'::text, 'rechazada'::text, 'retirada'::text, 'caducada'::text, 'cancelada'::text]))),
    CONSTRAINT tienda_ofertas_pago CHECK ((pago = ANY (ARRAY['bizum'::text, 'paypal'::text, 'efectivo'::text]))),
    CONSTRAINT tienda_ofertas_precio CHECK ((precio > (0)::numeric)),
    CONSTRAINT tienda_ofertas_seguimiento CHECK (((seguimiento IS NULL) OR (char_length(seguimiento) <= 80))),
    CONSTRAINT tienda_ofertas_turno CHECK ((turno = ANY (ARRAY['tienda'::text, 'comprador'::text]))),
    CONSTRAINT tienda_ofertas_unidades CHECK (((unidades >= 1) AND (unidades <= 99)))
);

--
-- Name: tienda_reservas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_reservas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tienda_id uuid DEFAULT auth.uid() NOT NULL,
    stock_id uuid NOT NULL,
    unidades integer NOT NULL,
    precio numeric(10,2),
    para text NOT NULL,
    para_usuario uuid,
    nota text,
    hasta timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tienda_reservas_precio CHECK (((precio IS NULL) OR (precio >= (0)::numeric))),
    CONSTRAINT tienda_reservas_textos CHECK ((((char_length(para) >= 1) AND (char_length(para) <= 80)) AND ((nota IS NULL) OR (char_length(nota) <= 200)))),
    CONSTRAINT tienda_reservas_unidades CHECK (((unidades >= 1) AND (unidades <= 99999)))
);

--
-- Name: tienda_solicitudes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_solicitudes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nombre text NOT NULL,
    ciudad text,
    email text NOT NULL,
    contacto text,
    web text,
    tamano text,
    estado text DEFAULT 'pendiente'::text NOT NULL,
    decidio uuid,
    decidida_el timestamp with time zone,
    token uuid,
    caduca timestamp with time zone,
    usada_el timestamp with time zone,
    usada_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    instagram text,
    CONSTRAINT tienda_solicitudes_estado CHECK ((estado = ANY (ARRAY['pendiente'::text, 'aceptada'::text, 'rechazada'::text, 'usada'::text]))),
    CONSTRAINT tienda_solicitudes_largos CHECK ((((char_length(nombre) >= 2) AND (char_length(nombre) <= 80)) AND ((ciudad IS NULL) OR ((char_length(ciudad) >= 2) AND (char_length(ciudad) <= 80))) AND ((char_length(email) >= 5) AND (char_length(email) <= 160)) AND ((contacto IS NULL) OR (char_length(contacto) <= 80)) AND ((web IS NULL) OR (char_length(web) <= 160)) AND ((instagram IS NULL) OR (instagram ~ '^[A-Za-z0-9._]{1,30}$'::text)))),
    CONSTRAINT tienda_solicitudes_tamano CHECK (((tamano IS NULL) OR (tamano = ANY (ARRAY['poca'::text, 'media'::text, 'mucha'::text]))))
);

--
-- Name: tienda_stock; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_stock (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tienda_id uuid DEFAULT auth.uid() NOT NULL,
    card_id text,
    market text DEFAULT 'WEST'::text NOT NULL,
    product_id bigint,
    idioma text DEFAULT 'es'::text NOT NULL,
    estado text DEFAULT 'NM'::text NOT NULL,
    variante text DEFAULT 'normal'::text NOT NULL,
    gradeo text,
    unidades integer DEFAULT 1 NOT NULL,
    coste numeric(10,2),
    precio numeric(10,2),
    ubicacion text,
    visible boolean DEFAULT true NOT NULL,
    notas text,
    entro_el timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    destacada boolean DEFAULT false NOT NULL,
    oferta_precio numeric(10,2),
    oferta_hasta timestamp with time zone,
    valorado numeric(10,2),
    por_poner boolean DEFAULT false NOT NULL,
    CONSTRAINT tienda_stock_dinero CHECK ((((coste IS NULL) OR (coste >= (0)::numeric)) AND ((precio IS NULL) OR (precio >= (0)::numeric)))),
    CONSTRAINT tienda_stock_estado CHECK ((estado = ANY (ARRAY['MT'::text, 'NM'::text, 'EX'::text, 'GD'::text, 'LP'::text, 'PL'::text, 'PO'::text, 'sellado'::text]))),
    CONSTRAINT tienda_stock_idioma CHECK (((char_length(idioma) >= 2) AND (char_length(idioma) <= 3))),
    CONSTRAINT tienda_stock_market CHECK ((market = ANY (ARRAY['WEST'::text, 'JP'::text]))),
    CONSTRAINT tienda_stock_oferta CHECK (((oferta_precio IS NULL) OR (oferta_precio >= (0)::numeric))),
    CONSTRAINT tienda_stock_que CHECK (((card_id IS NULL) <> (product_id IS NULL))),
    CONSTRAINT tienda_stock_textos CHECK ((((gradeo IS NULL) OR ((char_length(gradeo) >= 1) AND (char_length(gradeo) <= 20))) AND ((ubicacion IS NULL) OR (char_length(ubicacion) <= 60)) AND ((notas IS NULL) OR (char_length(notas) <= 300)))),
    CONSTRAINT tienda_stock_unidades CHECK (((unidades >= 0) AND (unidades <= 99999))),
    CONSTRAINT tienda_stock_valorado CHECK (((valorado IS NULL) OR (valorado >= (0)::numeric))),
    CONSTRAINT tienda_stock_variante CHECK (((char_length(variante) >= 1) AND (char_length(variante) <= 60)))
);

--
-- Name: tienda_stock_fotos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_stock_fotos (
    stock_id uuid NOT NULL,
    tienda_id uuid DEFAULT auth.uid() NOT NULL,
    frente text,
    dorso text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tienda_stock_fotos_dorso_suya CHECK (((dorso IS NULL) OR ((char_length(dorso) <= 300) AND (dorso ~~ ((tienda_id)::text || '/%'::text))))),
    CONSTRAINT tienda_stock_fotos_frente_suya CHECK (((frente IS NULL) OR ((char_length(frente) <= 300) AND (frente ~~ ((tienda_id)::text || '/%'::text)))))
);

--
-- Name: tienda_valor_diario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_valor_diario (
    tienda_id uuid NOT NULL,
    dia date NOT NULL,
    lineas integer DEFAULT 0 NOT NULL,
    unidades integer DEFAULT 0 NOT NULL,
    valor numeric(12,2) DEFAULT 0 NOT NULL,
    cm numeric(12,2) DEFAULT 0 NOT NULL,
    coste numeric(12,2) DEFAULT 0 NOT NULL
);

--
-- Name: tienda_ventas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_ventas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tienda_id uuid DEFAULT auth.uid() NOT NULL,
    ticket uuid NOT NULL,
    stock_id uuid,
    card_id text,
    market text DEFAULT 'WEST'::text NOT NULL,
    product_id bigint,
    idioma text NOT NULL,
    estado text NOT NULL,
    variante text DEFAULT 'normal'::text NOT NULL,
    gradeo text,
    unidades integer NOT NULL,
    precio numeric(10,2) NOT NULL,
    coste numeric(10,2),
    donde text DEFAULT 'mostrador'::text NOT NULL,
    vendida_el timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pago text,
    precio_lista numeric(10,2),
    CONSTRAINT tienda_ventas_dinero CHECK (((precio >= (0)::numeric) AND ((coste IS NULL) OR (coste >= (0)::numeric)))),
    CONSTRAINT tienda_ventas_donde CHECK ((donde = ANY (ARRAY['mostrador'::text, 'cardmarket'::text, 'evento'::text, 'otro'::text, 'pokedoc'::text]))),
    CONSTRAINT tienda_ventas_lista CHECK (((precio_lista IS NULL) OR (precio_lista >= (0)::numeric))),
    CONSTRAINT tienda_ventas_pago CHECK (((pago IS NULL) OR (pago = ANY (ARRAY['efectivo'::text, 'tarjeta'::text, 'bizum'::text, 'paypal'::text, 'cambio'::text])))),
    CONSTRAINT tienda_ventas_que CHECK (((card_id IS NULL) <> (product_id IS NULL))),
    CONSTRAINT tienda_ventas_unidades CHECK (((unidades >= 1) AND (unidades <= 99999)))
);

--
-- Name: tienda_visitas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_visitas (
    tienda_id uuid NOT NULL,
    dia date NOT NULL,
    visitas integer DEFAULT 0 NOT NULL,
    qr integer DEFAULT 0 NOT NULL
);

--
-- Name: tienda_vistas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tienda_vistas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tienda_id uuid DEFAULT auth.uid() NOT NULL,
    nombre text NOT NULL,
    filtros jsonb DEFAULT '{}'::jsonb NOT NULL,
    orden integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tienda_vistas_nombre CHECK (((char_length(nombre) >= 1) AND (char_length(nombre) <= 40)))
);

--
-- Name: tiendas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tiendas (
    user_id uuid NOT NULL,
    ciudad text,
    direccion text,
    horario text,
    web text,
    precio_visible boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    instagram text,
    de_pruebas boolean DEFAULT false NOT NULL,
    CONSTRAINT tiendas_ciudad_largo CHECK (((ciudad IS NULL) OR (char_length(ciudad) <= 80))),
    CONSTRAINT tiendas_direccion_largo CHECK (((direccion IS NULL) OR (char_length(direccion) <= 160))),
    CONSTRAINT tiendas_horario_largo CHECK (((horario IS NULL) OR (char_length(horario) <= 120))),
    CONSTRAINT tiendas_instagram_forma CHECK (((instagram IS NULL) OR (instagram ~ '^[A-Za-z0-9._]{1,30}$'::text))),
    CONSTRAINT tiendas_web_largo CHECK (((web IS NULL) OR (char_length(web) <= 160)))
);

--
-- Name: tournament_decklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_decklists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    raw_text text NOT NULL,
    parsed_cards jsonb NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    locked_at timestamp with time zone
);

--
-- Name: tournament_join_codes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_join_codes (
    tournament_id uuid NOT NULL,
    code text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: tournament_match_replays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_match_replays (
    match_id uuid NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    replay_id text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    publica boolean DEFAULT false NOT NULL
);

--
-- Name: tournament_matchday_avisos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_matchday_avisos (
    tournament_id uuid NOT NULL,
    matchday integer NOT NULL,
    canal text NOT NULL,
    sent_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tournament_matchday_avisos_canal_check CHECK ((canal = ANY (ARRAY['telegram'::text, 'campanita'::text, 'resultados'::text]))),
    CONSTRAINT tournament_matchday_avisos_matchday_check CHECK ((matchday >= 1))
);

--
-- Name: tournament_matchday_closures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_matchday_closures (
    tournament_id uuid NOT NULL,
    matchday integer NOT NULL,
    closed_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tournament_matchday_closures_matchday_check CHECK ((matchday >= 1))
);

--
-- Name: tournament_matchday_decklists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_matchday_decklists (
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    matchday integer NOT NULL,
    raw_text text NOT NULL,
    parsed_cards jsonb NOT NULL,
    submitted_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tournament_matchday_decklists_matchday_check CHECK ((matchday >= 1))
);

--
-- Name: tournament_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    round_id uuid NOT NULL,
    table_number smallint NOT NULL,
    player_a_id uuid NOT NULL,
    player_b_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    is_bye boolean DEFAULT false NOT NULL,
    check_in_a_at timestamp with time zone,
    check_in_b_at timestamp with time zone,
    finished_at timestamp with time zone,
    bracket_position smallint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    await_notified_at timestamp with time zone,
    resolved_notified_at timestamp with time zone,
    CONSTRAINT tournament_matches_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'awaiting_confirmation'::text, 'disputed'::text, 'finished'::text, 'bye'::text, 'forfeit_a'::text, 'forfeit_b'::text, 'forfeit_both'::text])))
);

ALTER TABLE ONLY public.tournament_matches REPLICA IDENTITY FULL;

--
-- Name: tournament_prize_deliveries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_prize_deliveries (
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    delivered_at timestamp with time zone DEFAULT now() NOT NULL,
    delivered_by uuid
);

--
-- Name: tournament_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_registrations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    status text DEFAULT 'active'::text NOT NULL,
    tcg_live_username text NOT NULL,
    registered_at timestamp with time zone DEFAULT now() NOT NULL,
    dropped_at timestamp with time zone,
    dropped_after_round_id uuid,
    participation_confirmed_at timestamp with time zone,
    CONSTRAINT tournament_registrations_status_check CHECK ((status = ANY (ARRAY['active'::text, 'dropped'::text, 'waitlisted'::text])))
);

--
-- Name: tournament_updates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_updates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tournament_id uuid NOT NULL,
    author_id uuid,
    kind text DEFAULT 'aviso'::text NOT NULL,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT tournament_updates_body_check CHECK (((char_length(body) >= 1) AND (char_length(body) <= 500))),
    CONSTRAINT tournament_updates_kind_check CHECK ((kind = ANY (ARRAY['aviso'::text, 'auto'::text])))
);

--
-- Name: tournament_xp_awards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournament_xp_awards (
    tournament_id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    motivo text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: tournaments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tournaments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    slug text NOT NULL,
    admin_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    start_at timestamp with time zone NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    max_players integer,
    swiss_rounds integer NOT NULL,
    round_time_minutes integer DEFAULT 30 NOT NULL,
    checkin_minutes integer DEFAULT 5 NOT NULL,
    swiss_bo integer DEFAULT 1 NOT NULL,
    top_cut_bo integer DEFAULT 3 NOT NULL,
    top_cut_size integer DEFAULT 0 NOT NULL,
    current_round_id uuid,
    pairing_seed text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    registration_notified_at timestamp with time zone,
    champion_id uuid,
    podium jsonb,
    result_announced_at timestamp with time zone,
    cancel_notified_at timestamp with time zone,
    reminder_notified_at timestamp with time zone,
    delete_after_notice_at timestamp with time zone,
    finish_notified_at timestamp with time zone,
    format text DEFAULT 'standard'::text NOT NULL,
    matchday_dates jsonb,
    show_opponent_decklists boolean DEFAULT false NOT NULL,
    image_url text,
    decklist_visibility text DEFAULT 'al_terminar'::text NOT NULL,
    banner_url text,
    is_official boolean DEFAULT false NOT NULL,
    telegram_sent_at timestamp with time zone,
    is_private boolean DEFAULT false NOT NULL,
    prizes jsonb,
    xp_awarded_at timestamp with time zone,
    rounds_per_matchday integer DEFAULT 1 NOT NULL,
    precio_entrada numeric(8,2),
    CONSTRAINT tournaments_checkin_minutes_check CHECK (((checkin_minutes >= 0) AND (checkin_minutes <= 30))),
    CONSTRAINT tournaments_decklist_visibility_check CHECK ((decklist_visibility = ANY (ARRAY['en_juego'::text, 'al_terminar'::text, 'nunca'::text]))),
    CONSTRAINT tournaments_format_check CHECK ((format = ANY (ARRAY['standard'::text, 'league'::text]))),
    CONSTRAINT tournaments_max_players_check CHECK (((max_players IS NULL) OR ((max_players >= 4) AND (max_players <= 2048)))),
    CONSTRAINT tournaments_precio_entrada_ok CHECK (((precio_entrada IS NULL) OR ((precio_entrada >= (0)::numeric) AND (precio_entrada <= (1000)::numeric)))),
    CONSTRAINT tournaments_prizes_check CHECK (((prizes IS NULL) OR public.premios_bien_formados(prizes))),
    CONSTRAINT tournaments_round_time_minutes_check CHECK (((round_time_minutes >= 5) AND (round_time_minutes <= 120))),
    CONSTRAINT tournaments_rounds_per_matchday_check CHECK (((rounds_per_matchday >= 1) AND (rounds_per_matchday <= 5))),
    CONSTRAINT tournaments_status_check CHECK ((status = ANY (ARRAY['draft'::text, 'registration_open'::text, 'registration_closed'::text, 'in_progress'::text, 'finished'::text, 'cancelled'::text]))),
    CONSTRAINT tournaments_swiss_bo_check CHECK ((swiss_bo = ANY (ARRAY[1, 3]))),
    CONSTRAINT tournaments_swiss_rounds_check CHECK (((swiss_rounds >= 1) AND (swiss_rounds <= 60))),
    CONSTRAINT tournaments_top_cut_bo_check CHECK ((top_cut_bo = ANY (ARRAY[1, 3]))),
    CONSTRAINT tournaments_top_cut_size_check CHECK ((top_cut_size = ANY (ARRAY[0, 4, 8, 16, 32, 64])))
);

--
-- Name: trade_offer_cobros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_offer_cobros (
    oferta uuid NOT NULL,
    quien uuid NOT NULL,
    como text NOT NULL,
    dato text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trade_offer_cobros_como_check CHECK ((como = ANY (ARRAY['bizum'::text, 'paypal'::text]))),
    CONSTRAINT trade_offer_cobros_dato_check CHECK (((char_length(dato) >= 3) AND (char_length(dato) <= 120)))
);

--
-- Name: trade_offer_direcciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_offer_direcciones (
    oferta uuid NOT NULL,
    quien uuid NOT NULL,
    nombre text NOT NULL,
    calle text NOT NULL,
    cp text NOT NULL,
    ciudad text NOT NULL,
    provincia text,
    telefono text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT trade_offer_direcciones_calle_check CHECK (((char_length(btrim(calle)) >= 3) AND (char_length(btrim(calle)) <= 200))),
    CONSTRAINT trade_offer_direcciones_ciudad_check CHECK (((char_length(btrim(ciudad)) >= 2) AND (char_length(btrim(ciudad)) <= 80))),
    CONSTRAINT trade_offer_direcciones_cp_check CHECK (((char_length(btrim(cp)) >= 3) AND (char_length(btrim(cp)) <= 12))),
    CONSTRAINT trade_offer_direcciones_nombre_check CHECK (((char_length(btrim(nombre)) >= 2) AND (char_length(btrim(nombre)) <= 120))),
    CONSTRAINT trade_offer_direcciones_provincia_check CHECK (((provincia IS NULL) OR (char_length(provincia) <= 80))),
    CONSTRAINT trade_offer_direcciones_telefono_check CHECK (((telefono IS NULL) OR (char_length(telefono) <= 30)))
);

--
-- Name: trade_offer_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.trade_offer_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    oferta uuid NOT NULL,
    quien uuid NOT NULL,
    linea uuid,
    card_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    idioma text DEFAULT 'es'::text NOT NULL,
    estado text DEFAULT 'NM'::text NOT NULL,
    variante text DEFAULT 'normal'::text NOT NULL,
    gradeo text,
    cantidad integer DEFAULT 1 NOT NULL,
    precio numeric(10,2),
    pedida boolean DEFAULT false NOT NULL,
    CONSTRAINT trade_offer_items_cantidad_check CHECK (((cantidad >= 1) AND (cantidad <= 99))),
    CONSTRAINT trade_offer_items_precio_check CHECK (((precio IS NULL) OR (precio >= (0)::numeric)))
);

--
-- Name: user_albums; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_albums (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    nombre text DEFAULT 'Mi álbum'::text NOT NULL,
    descripcion text,
    cartas jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    icono text,
    dex_id integer,
    emoji text,
    color text,
    tipo text DEFAULT 'binder'::text NOT NULL,
    set_id text,
    set_market text,
    set_modo text,
    rejilla text DEFAULT '3x3'::text NOT NULL,
    paginas integer,
    tapa text,
    portada text,
    estilo jsonb,
    CONSTRAINT user_albums_cartas CHECK (((jsonb_typeof(cartas) = 'array'::text) AND (jsonb_array_length(cartas) <= 1080))),
    CONSTRAINT user_albums_descripcion CHECK (((descripcion IS NULL) OR (char_length(descripcion) <= 500))),
    CONSTRAINT user_albums_nombre CHECK (((char_length(nombre) >= 1) AND (char_length(nombre) <= 80))),
    CONSTRAINT user_albums_paginas CHECK (((paginas IS NULL) OR ((paginas >= 1) AND (paginas <= 120)))),
    CONSTRAINT user_albums_rejilla CHECK ((rejilla = ANY (ARRAY['2x2'::text, '3x3'::text, '3x4'::text, '4x4'::text]))),
    CONSTRAINT user_albums_set_con_set CHECK (((tipo <> 'set'::text) OR (set_id IS NOT NULL))),
    CONSTRAINT user_albums_set_modo CHECK (((set_modo IS NULL) OR (set_modo = ANY (ARRAY['entero'::text, 'oficial'::text])))),
    CONSTRAINT user_albums_tipo CHECK ((tipo = ANY (ARRAY['set'::text, 'binder'::text])))
);

--
-- Name: user_cobros; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_cobros (
    user_id uuid DEFAULT auth.uid() NOT NULL,
    bizum text,
    paypal text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_cobros_bizum_check CHECK (((bizum IS NULL) OR (bizum ~ '^\+?[0-9 ]{9,20}$'::text))),
    CONSTRAINT user_cobros_paypal_check CHECK (((paypal IS NULL) OR ((char_length(paypal) >= 3) AND (char_length(paypal) <= 120))))
);

--
-- Name: user_collection_value; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_collection_value (
    user_id uuid NOT NULL,
    dia date NOT NULL,
    valor numeric(12,2) DEFAULT 0 NOT NULL,
    copias integer DEFAULT 0 NOT NULL,
    distintas integer DEFAULT 0 NOT NULL,
    sin_precio integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: user_cumple; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_cumple (
    user_id uuid NOT NULL,
    birthday date NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: user_decks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_decks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    name text DEFAULT 'Mazo sin nombre'::text NOT NULL,
    format text DEFAULT 'standard'::text NOT NULL,
    cards jsonb DEFAULT '[]'::jsonb NOT NULL,
    cover_card text,
    is_public boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_decks_cartas CHECK (((jsonb_typeof(cards) = 'array'::text) AND (jsonb_array_length(cards) <= 60))),
    CONSTRAINT user_decks_formato CHECK ((format = ANY (ARRAY['standard'::text, 'expanded'::text, 'libre'::text]))),
    CONSTRAINT user_decks_nombre CHECK (((char_length(name) >= 1) AND (char_length(name) <= 80)))
);

--
-- Name: user_direcciones; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_direcciones (
    user_id uuid DEFAULT auth.uid() NOT NULL,
    nombre text NOT NULL,
    calle text NOT NULL,
    cp text NOT NULL,
    ciudad text NOT NULL,
    provincia text,
    telefono text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_direcciones_calle_check CHECK (((char_length(btrim(calle)) >= 3) AND (char_length(btrim(calle)) <= 200))),
    CONSTRAINT user_direcciones_ciudad_check CHECK (((char_length(btrim(ciudad)) >= 2) AND (char_length(btrim(ciudad)) <= 80))),
    CONSTRAINT user_direcciones_cp_check CHECK (((char_length(btrim(cp)) >= 3) AND (char_length(btrim(cp)) <= 12))),
    CONSTRAINT user_direcciones_nombre_check CHECK (((char_length(btrim(nombre)) >= 2) AND (char_length(btrim(nombre)) <= 120))),
    CONSTRAINT user_direcciones_provincia_check CHECK (((provincia IS NULL) OR (char_length(provincia) <= 80))),
    CONSTRAINT user_direcciones_telefono_check CHECK (((telefono IS NULL) OR (char_length(telefono) <= 30)))
);

--
-- Name: user_follows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_follows (
    follower_id uuid NOT NULL,
    following_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_follows_no_self CHECK ((follower_id <> following_id))
);

--
-- Name: user_notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    recipient_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    body text,
    link text,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    pushed_at timestamp with time zone
);

--
-- Name: user_play_pokemon; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_play_pokemon (
    user_id uuid DEFAULT auth.uid() NOT NULL,
    player_id text,
    player_name text,
    birth_date date,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_play_pokemon_birth_date_check CHECK (((birth_date IS NULL) OR (birth_date >= '1900-01-01'::date))),
    CONSTRAINT user_play_pokemon_player_id_check CHECK (((player_id IS NULL) OR (player_id ~ '^[0-9]{1,10}$'::text))),
    CONSTRAINT user_play_pokemon_player_name_check CHECK (((player_name IS NULL) OR ((char_length(player_name) >= 1) AND (char_length(player_name) <= 80))))
);

--
-- Name: user_price_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_price_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    card_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    idioma text DEFAULT 'es'::text NOT NULL,
    tipo text NOT NULL,
    umbral numeric(10,2) NOT NULL,
    activo boolean DEFAULT true NOT NULL,
    disparado_at timestamp with time zone,
    precio_disparo numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_price_alerts_tipo_check CHECK ((tipo = ANY (ARRAY['baja'::text, 'sube'::text]))),
    CONSTRAINT user_price_alerts_umbral_check CHECK ((umbral > (0)::numeric))
);

--
-- Name: user_privado; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_privado (
    user_id uuid NOT NULL,
    saved_guides uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    referred_by uuid,
    email_unsubscribe_token uuid DEFAULT gen_random_uuid() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: user_products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_products (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    product_id bigint NOT NULL,
    cantidad integer DEFAULT 1 NOT NULL,
    pagado numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    idioma text DEFAULT 'en'::text NOT NULL,
    CONSTRAINT user_products_cantidad CHECK (((cantidad >= 1) AND (cantidad <= 999))),
    CONSTRAINT user_products_idioma_valido CHECK ((idioma = ANY (ARRAY['es'::text, 'en'::text, 'de'::text, 'fr'::text, 'it'::text, 'pt'::text, 'nl'::text, 'ja'::text, 'ko'::text, 'zh'::text])))
);

--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    id uuid NOT NULL,
    username text,
    display_name text,
    total_xp integer DEFAULT 0,
    level text DEFAULT 'Novato'::text,
    is_pro boolean DEFAULT false,
    achievements text[] DEFAULT '{}'::text[],
    unlocked_references uuid[] DEFAULT '{}'::uuid[],
    avatar_color text,
    is_admin boolean DEFAULT false,
    quiz_correct_count integer DEFAULT 0,
    push_token text,
    onboarding_completed boolean DEFAULT false,
    interests text[],
    recommended_path text,
    created_at timestamp with time zone DEFAULT now(),
    bio text,
    banner_color text,
    showcase_achievement text,
    avatar_url text,
    banner_url text,
    current_streak integer DEFAULT 0 NOT NULL,
    last_active_date date,
    notification_prefs_disabled text[] DEFAULT '{}'::text[] NOT NULL,
    is_banned boolean DEFAULT false NOT NULL,
    is_muted boolean DEFAULT false NOT NULL,
    hide_activity boolean DEFAULT false NOT NULL,
    notification_email_disabled text[] DEFAULT '{}'::text[] NOT NULL,
    search_norm text GENERATED ALWAYS AS (public.plegar_texto(((COALESCE(display_name, ''::text) || ' '::text) || COALESCE(username, ''::text)))) STORED,
    forum_title text,
    is_moderator boolean DEFAULT false NOT NULL,
    forum_read_all_at timestamp with time zone,
    forum_title_color text,
    forum_post_count integer DEFAULT 0 NOT NULL,
    forum_signature text,
    streak_shields integer DEFAULT 0 NOT NULL,
    is_tournament_admin boolean DEFAULT false NOT NULL,
    coleccion_publica boolean DEFAULT false NOT NULL,
    is_news_writer boolean DEFAULT false NOT NULL,
    retos_oculto boolean DEFAULT false NOT NULL,
    tipo text DEFAULT 'persona'::text NOT NULL,
    is_writer boolean DEFAULT false NOT NULL,
    birthday_md text,
    borrado_at timestamp with time zone,
    CONSTRAINT user_profiles_forum_signature_corta CHECK (((forum_signature IS NULL) OR (char_length(forum_signature) <= 1000))),
    CONSTRAINT user_profiles_forum_title_color_hex CHECK (((forum_title_color IS NULL) OR (forum_title_color ~ '^#[0-9a-fA-F]{6}$'::text))),
    CONSTRAINT user_profiles_tipo_valido CHECK ((tipo = ANY (ARRAY['persona'::text, 'tienda'::text])))
);

--
-- Name: user_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_progress (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    guide_id uuid,
    status text,
    xp_earned integer DEFAULT 0,
    started_at timestamp with time zone DEFAULT now(),
    completed_at timestamp with time zone,
    current_block integer DEFAULT 0,
    read_at timestamp with time zone
);

--
-- Name: user_release_alerts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_release_alerts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    clave text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    nombre text NOT NULL,
    semana boolean DEFAULT true NOT NULL,
    dia boolean DEFAULT true NOT NULL,
    preventa boolean DEFAULT false NOT NULL,
    enviados text[] DEFAULT '{}'::text[] NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_release_alerts_clave_check CHECK (((length(clave) >= 1) AND (length(clave) <= 200))),
    CONSTRAINT user_release_alerts_nombre_check CHECK (((length(nombre) >= 1) AND (length(nombre) <= 200)))
);

--
-- Name: user_showcase; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_showcase (
    user_id uuid NOT NULL,
    posicion smallint NOT NULL,
    card_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_showcase_posicion_check CHECK (((posicion >= 1) AND (posicion <= 6)))
);

--
-- Name: user_want_list_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_want_list_items (
    list_id uuid NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    card_id text NOT NULL,
    market text DEFAULT 'WEST'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: user_want_lists; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_want_lists (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    nombre text NOT NULL,
    color text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_want_lists_nombre_check CHECK (((char_length(btrim(nombre)) >= 1) AND (char_length(btrim(nombre)) <= 60)))
);

--
-- Name: user_wants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_wants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid DEFAULT auth.uid() NOT NULL,
    card_id text NOT NULL,
    idioma text,
    prioridad integer DEFAULT 1 NOT NULL,
    notas text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    variante text,
    CONSTRAINT user_wants_idioma CHECK (((idioma IS NULL) OR (idioma = ANY (ARRAY['es'::text, 'en'::text, 'fr'::text, 'de'::text, 'it'::text, 'pt'::text, 'nl'::text, 'ja'::text, 'ko'::text, 'zh'::text])))),
    CONSTRAINT user_wants_notas CHECK (((notas IS NULL) OR (char_length(notas) <= 280))),
    CONSTRAINT user_wants_prioridad CHECK (((prioridad >= 1) AND (prioridad <= 3))),
    CONSTRAINT user_wants_variante CHECK (((variante IS NULL) OR ((variante ~ '^[a-z0-9]+(-[a-z0-9]+)*$'::text) AND (length(variante) <= 40))))
);

--
-- Name: xp_diario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_diario (
    user_id uuid NOT NULL,
    dia date DEFAULT CURRENT_DATE NOT NULL,
    sumado integer DEFAULT 0 NOT NULL
);

--
-- Name: xp_mes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_mes (
    user_id uuid NOT NULL,
    mes date NOT NULL,
    xp_inicio integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

--
-- Name: logros_a_mano id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logros_a_mano ALTER COLUMN id SET DEFAULT nextval('public.logros_a_mano_id_seq'::regclass);

--
-- Name: tcg_repetidas_hechas id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_repetidas_hechas ALTER COLUMN id SET DEFAULT nextval('public.tcg_repetidas_hechas_id_seq'::regclass);

--
-- Name: account_deletion_requests account_deletion_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_pkey PRIMARY KEY (id);

--
-- Name: achievement_definitions achievement_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievement_definitions
    ADD CONSTRAINT achievement_definitions_pkey PRIMARY KEY (id);

--
-- Name: adviento_casillas adviento_casillas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adviento_casillas
    ADD CONSTRAINT adviento_casillas_pkey PRIMARY KEY (user_id, anio, dia);

--
-- Name: app_feedback app_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_feedback
    ADD CONSTRAINT app_feedback_pkey PRIMARY KEY (id);

--
-- Name: aviso_cifras aviso_cifras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_cifras
    ADD CONSTRAINT aviso_cifras_pkey PRIMARY KEY (aviso_id, dia);

--
-- Name: aviso_participantes aviso_participantes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_participantes
    ADD CONSTRAINT aviso_participantes_pkey PRIMARY KEY (aviso_id, user_id);

--
-- Name: avisos_enviados avisos_enviados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos_enviados
    ADD CONSTRAINT avisos_enviados_pkey PRIMARY KEY (id);

--
-- Name: avisos avisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT avisos_pkey PRIMARY KEY (id);

--
-- Name: busquedas busquedas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.busquedas
    ADD CONSTRAINT busquedas_pkey PRIMARY KEY (id);

--
-- Name: calendario_claves calendario_claves_clave_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendario_claves
    ADD CONSTRAINT calendario_claves_clave_key UNIQUE (clave);

--
-- Name: calendario_claves calendario_claves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendario_claves
    ADD CONSTRAINT calendario_claves_pkey PRIMARY KEY (user_id);

--
-- Name: carta_del_dia carta_del_dia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.carta_del_dia
    ADD CONSTRAINT carta_del_dia_pkey PRIMARY KEY (day);

--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);

--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_slug_key UNIQUE (slug);

--
-- Name: client_errors client_errors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_errors
    ADD CONSTRAINT client_errors_pkey PRIMARY KEY (id);

--
-- Name: collab_applications collab_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_applications
    ADD CONSTRAINT collab_applications_pkey PRIMARY KEY (id);

--
-- Name: collection_favorite_sets collection_favorite_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_favorite_sets
    ADD CONSTRAINT collection_favorite_sets_pkey PRIMARY KEY (user_id, set_id);

--
-- Name: collection_folder_cards collection_folder_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_folder_cards
    ADD CONSTRAINT collection_folder_cards_pkey PRIMARY KEY (folder_id, line_id);

--
-- Name: collection_folders collection_folders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_folders
    ADD CONSTRAINT collection_folders_pkey PRIMARY KEY (id);

--
-- Name: content_reports content_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT content_reports_pkey PRIMARY KEY (id);

--
-- Name: conversation_participants conversation_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_pkey PRIMARY KEY (conversation_id, user_id);

--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);

--
-- Name: correo_textos correo_textos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correo_textos
    ADD CONSTRAINT correo_textos_pkey PRIMARY KEY (tipo);

--
-- Name: course_attempts course_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_attempts
    ADD CONSTRAINT course_attempts_pkey PRIMARY KEY (id);

--
-- Name: course_review_queue course_review_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_review_queue
    ADD CONSTRAINT course_review_queue_pkey PRIMARY KEY (user_id, guide_id, question_key);

--
-- Name: daily_challenge_results daily_challenge_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_challenge_results
    ADD CONSTRAINT daily_challenge_results_pkey PRIMARY KEY (user_id, day);

--
-- Name: email_outbox email_outbox_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT email_outbox_pkey PRIMARY KEY (id);

--
-- Name: enlaces_cortos enlaces_cortos_huella_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enlaces_cortos
    ADD CONSTRAINT enlaces_cortos_huella_key UNIQUE (huella);

--
-- Name: enlaces_cortos enlaces_cortos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enlaces_cortos
    ADD CONSTRAINT enlaces_cortos_pkey PRIMARY KEY (id);

--
-- Name: enlaces_rotos enlaces_rotos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enlaces_rotos
    ADD CONSTRAINT enlaces_rotos_pkey PRIMARY KEY (id);

--
-- Name: evento_asistentes evento_asistentes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_asistentes
    ADD CONSTRAINT evento_asistentes_pkey PRIMARY KEY (evento_id, user_id);

--
-- Name: eventos eventos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_pkey PRIMARY KEY (id);

--
-- Name: eventos eventos_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_slug_key UNIQUE (slug);

--
-- Name: forum_boards forum_boards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_boards
    ADD CONSTRAINT forum_boards_pkey PRIMARY KEY (id);

--
-- Name: forum_boards forum_boards_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_boards
    ADD CONSTRAINT forum_boards_slug_key UNIQUE (slug);

--
-- Name: forum_poll_options forum_poll_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_poll_options
    ADD CONSTRAINT forum_poll_options_pkey PRIMARY KEY (id);

--
-- Name: forum_poll_votes forum_poll_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_poll_votes
    ADD CONSTRAINT forum_poll_votes_pkey PRIMARY KEY (option_id, user_id);

--
-- Name: forum_polls forum_polls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_polls
    ADD CONSTRAINT forum_polls_pkey PRIMARY KEY (thread_id);

--
-- Name: forum_post_likes forum_post_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_post_likes
    ADD CONSTRAINT forum_post_likes_pkey PRIMARY KEY (post_id, user_id);

--
-- Name: forum_post_reactions forum_post_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_post_reactions
    ADD CONSTRAINT forum_post_reactions_pkey PRIMARY KEY (post_id, user_id);

--
-- Name: forum_posts forum_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_posts
    ADD CONSTRAINT forum_posts_pkey PRIMARY KEY (id);

--
-- Name: forum_sections forum_sections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_sections
    ADD CONSTRAINT forum_sections_pkey PRIMARY KEY (id);

--
-- Name: forum_solucion_xp forum_solucion_xp_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_solucion_xp
    ADD CONSTRAINT forum_solucion_xp_pkey PRIMARY KEY (thread_id);

--
-- Name: forum_subscriptions forum_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_subscriptions
    ADD CONSTRAINT forum_subscriptions_pkey PRIMARY KEY (user_id, thread_id);

--
-- Name: forum_thread_reads forum_thread_reads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_thread_reads
    ADD CONSTRAINT forum_thread_reads_pkey PRIMARY KEY (user_id, thread_id);

--
-- Name: forum_threads forum_threads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_threads
    ADD CONSTRAINT forum_threads_pkey PRIMARY KEY (id);

--
-- Name: guide_collections guide_collections_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_collections
    ADD CONSTRAINT guide_collections_pkey PRIMARY KEY (id);

--
-- Name: guide_comments guide_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_comments
    ADD CONSTRAINT guide_comments_pkey PRIMARY KEY (id);

--
-- Name: guide_helpful guide_helpful_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_helpful
    ADD CONSTRAINT guide_helpful_pkey PRIMARY KEY (guide_id, user_id);

--
-- Name: guide_pro_content guide_pro_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_pro_content
    ADD CONSTRAINT guide_pro_content_pkey PRIMARY KEY (guide_id);

--
-- Name: guide_request_votes guide_request_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_request_votes
    ADD CONSTRAINT guide_request_votes_pkey PRIMARY KEY (request_id, user_id);

--
-- Name: guide_requests guide_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_requests
    ADD CONSTRAINT guide_requests_pkey PRIMARY KEY (id);

--
-- Name: guide_reviews guide_reviews_guide_id_reviewer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_reviews
    ADD CONSTRAINT guide_reviews_guide_id_reviewer_id_key UNIQUE (guide_id, reviewer_id);

--
-- Name: guide_reviews guide_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_reviews
    ADD CONSTRAINT guide_reviews_pkey PRIMARY KEY (id);

--
-- Name: guide_routes guide_routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_routes
    ADD CONSTRAINT guide_routes_pkey PRIMARY KEY (guide_id, route_id);

--
-- Name: guide_suggestions guide_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_suggestions
    ADD CONSTRAINT guide_suggestions_pkey PRIMARY KEY (id);

--
-- Name: guides guides_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_pkey PRIMARY KEY (id);

--
-- Name: guides guides_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_slug_key UNIQUE (slug);

--
-- Name: home_config home_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.home_config
    ADD CONSTRAINT home_config_pkey PRIMARY KEY (id);

--
-- Name: judge_applications judge_applications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_applications
    ADD CONSTRAINT judge_applications_pkey PRIMARY KEY (id);

--
-- Name: judge_applications judge_applications_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_applications
    ADD CONSTRAINT judge_applications_tournament_id_user_id_key UNIQUE (tournament_id, user_id);

--
-- Name: judge_calls judge_calls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_calls
    ADD CONSTRAINT judge_calls_pkey PRIMARY KEY (id);

--
-- Name: judge_messages judge_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_messages
    ADD CONSTRAINT judge_messages_pkey PRIMARY KEY (id);

--
-- Name: learning_paths learning_paths_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_paths
    ADD CONSTRAINT learning_paths_pkey PRIMARY KEY (id);

--
-- Name: learning_paths learning_paths_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.learning_paths
    ADD CONSTRAINT learning_paths_slug_key UNIQUE (slug);

--
-- Name: logros_a_mano logros_a_mano_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logros_a_mano
    ADD CONSTRAINT logros_a_mano_pkey PRIMARY KEY (id);

--
-- Name: mas_caro_del_dia mas_caro_del_dia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mas_caro_del_dia
    ADD CONSTRAINT mas_caro_del_dia_pkey PRIMARY KEY (day);

--
-- Name: match_log_ajustes match_log_ajustes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log_ajustes
    ADD CONSTRAINT match_log_ajustes_pkey PRIMARY KEY (user_id);

--
-- Name: match_log match_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log
    ADD CONSTRAINT match_log_pkey PRIMARY KEY (id);

--
-- Name: match_log_torneos match_log_torneos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log_torneos
    ADD CONSTRAINT match_log_torneos_pkey PRIMARY KEY (id);

--
-- Name: match_messages match_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_messages
    ADD CONSTRAINT match_messages_pkey PRIMARY KEY (id);

--
-- Name: match_reports match_reports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_reports
    ADD CONSTRAINT match_reports_pkey PRIMARY KEY (id);

--
-- Name: match_results match_results_match_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_match_id_key UNIQUE (match_id);

--
-- Name: match_results match_results_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_pkey PRIMARY KEY (id);

--
-- Name: meta_arquetipos meta_arquetipos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_arquetipos
    ADD CONSTRAINT meta_arquetipos_pkey PRIMARY KEY (id);

--
-- Name: meta_cartas_dia meta_cartas_dia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_cartas_dia
    ADD CONSTRAINT meta_cartas_dia_pkey PRIMARY KEY (dia, arquetipo, clave);

--
-- Name: meta_guias meta_guias_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_guias
    ADD CONSTRAINT meta_guias_pkey PRIMARY KEY (arquetipo, guide_id);

--
-- Name: meta_resultados meta_resultados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_resultados
    ADD CONSTRAINT meta_resultados_pkey PRIMARY KEY (torneo_id, jugador);

--
-- Name: meta_torneos meta_torneos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_torneos
    ADD CONSTRAINT meta_torneos_pkey PRIMARY KEY (id);

--
-- Name: moderaciones moderaciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderaciones
    ADD CONSTRAINT moderaciones_pkey PRIMARY KEY (id);

--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

--
-- Name: online_now online_now_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_now
    ADD CONSTRAINT online_now_pkey PRIMARY KEY (token);

--
-- Name: page_views page_views_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_pkey PRIMARY KEY (id);

--
-- Name: page_vitals page_vitals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_vitals
    ADD CONSTRAINT page_vitals_pkey PRIMARY KEY (id);

--
-- Name: pairing_history pairing_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairing_history
    ADD CONSTRAINT pairing_history_pkey PRIMARY KEY (id);

--
-- Name: pairing_history pairing_history_tournament_id_player_low_id_player_high_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairing_history
    ADD CONSTRAINT pairing_history_tournament_id_player_low_id_player_high_id_key UNIQUE (tournament_id, player_low_id, player_high_id);

--
-- Name: private_message_reactions private_message_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_message_reactions
    ADD CONSTRAINT private_message_reactions_pkey PRIMARY KEY (message_id, user_id);

--
-- Name: private_messages private_messages_con_algo; Type: CHECK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE public.private_messages
    ADD CONSTRAINT private_messages_con_algo CHECK (((deleted_at IS NOT NULL) OR (char_length(body) > 0) OR (jsonb_array_length(adjuntos) > 0))) NOT VALID;

--
-- Name: private_messages private_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_messages
    ADD CONSTRAINT private_messages_pkey PRIMARY KEY (id);

--
-- Name: profile_reviews profile_reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_reviews
    ADD CONSTRAINT profile_reviews_pkey PRIMARY KEY (id);

--
-- Name: profile_reviews profile_reviews_profile_id_reviewer_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_reviews
    ADD CONSTRAINT profile_reviews_profile_id_reviewer_id_key UNIQUE (profile_id, reviewer_id);

--
-- Name: push_subscriptions push_subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_pkey PRIMARY KEY (endpoint);

--
-- Name: question_stats question_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_stats
    ADD CONSTRAINT question_stats_pkey PRIMARY KEY (guide_id, question_key);

--
-- Name: replay_puzzle_answers replay_puzzle_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_puzzle_answers
    ADD CONSTRAINT replay_puzzle_answers_pkey PRIMARY KEY (puzzle_id, user_id);

--
-- Name: replay_puzzles replay_puzzles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_puzzles
    ADD CONSTRAINT replay_puzzles_pkey PRIMARY KEY (id);

--
-- Name: replays replays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replays
    ADD CONSTRAINT replays_pkey PRIMARY KEY (id);

--
-- Name: retos_arbitro retos_arbitro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retos_arbitro
    ADD CONSTRAINT retos_arbitro_pkey PRIMARY KEY (juego, day);

--
-- Name: retos_bonos retos_bonos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retos_bonos
    ADD CONSTRAINT retos_bonos_pkey PRIMARY KEY (user_id, tipo, day);

--
-- Name: retos_llave retos_llave_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retos_llave
    ADD CONSTRAINT retos_llave_pkey PRIMARY KEY (id);

--
-- Name: retos_partidas retos_partidas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retos_partidas
    ADD CONSTRAINT retos_partidas_pkey PRIMARY KEY (user_id, juego, day);

--
-- Name: retos_resultados retos_resultados_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retos_resultados
    ADD CONSTRAINT retos_resultados_pkey PRIMARY KEY (user_id, juego, day);

--
-- Name: retos_reto_del_dia retos_reto_del_dia_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retos_reto_del_dia
    ADD CONSTRAINT retos_reto_del_dia_pkey PRIMARY KEY (juego, day);

--
-- Name: rounds rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_pkey PRIMARY KEY (id);

--
-- Name: rounds rounds_tournament_id_round_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_tournament_id_round_number_key UNIQUE (tournament_id, round_number);

--
-- Name: scrydex_estado scrydex_estado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scrydex_estado
    ADD CONSTRAINT scrydex_estado_pkey PRIMARY KEY (clave);

--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.site_settings
    ADD CONSTRAINT site_settings_pkey PRIMARY KEY (key);

--
-- Name: tcg_archetypes tcg_archetypes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_archetypes
    ADD CONSTRAINT tcg_archetypes_pkey PRIMARY KEY (id);

--
-- Name: tcg_card_history tcg_card_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_card_history
    ADD CONSTRAINT tcg_card_history_pkey PRIMARY KEY (card_id, dia);

--
-- Name: tcg_card_play tcg_card_play_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_card_play
    ADD CONSTRAINT tcg_card_play_pkey PRIMARY KEY (name_key);

--
-- Name: tcg_card_prices tcg_card_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_card_prices
    ADD CONSTRAINT tcg_card_prices_pkey PRIMARY KEY (card_id);

--
-- Name: tcg_card_versions tcg_card_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_card_versions
    ADD CONSTRAINT tcg_card_versions_pkey PRIMARY KEY (tcggo_id);

--
-- Name: tcg_cards tcg_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_cards
    ADD CONSTRAINT tcg_cards_pkey PRIMARY KEY (id, market);

--
-- Name: tcg_correcciones tcg_correcciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_correcciones
    ADD CONSTRAINT tcg_correcciones_pkey PRIMARY KEY (tabla, id, market, columna);

--
-- Name: tcg_eras tcg_eras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_eras
    ADD CONSTRAINT tcg_eras_pkey PRIMARY KEY (market, id);

--
-- Name: tcg_product_contenido tcg_product_contenido_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_product_contenido
    ADD CONSTRAINT tcg_product_contenido_pkey PRIMARY KEY (product_id, contenido_tipo, contenido_id);

--
-- Name: tcg_product_history tcg_product_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_product_history
    ADD CONSTRAINT tcg_product_history_pkey PRIMARY KEY (product_id, dia);

--
-- Name: tcg_products tcg_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_products
    ADD CONSTRAINT tcg_products_pkey PRIMARY KEY (id);

--
-- Name: tcg_repetidas_distintas tcg_repetidas_distintas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_repetidas_distintas
    ADD CONSTRAINT tcg_repetidas_distintas_pkey PRIMARY KEY (market, set_id, numero, nombre);

--
-- Name: tcg_repetidas_hechas tcg_repetidas_hechas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_repetidas_hechas
    ADD CONSTRAINT tcg_repetidas_hechas_pkey PRIMARY KEY (id);

--
-- Name: tcg_set_idiomas_mano tcg_set_idiomas_mano_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_set_idiomas_mano
    ADD CONSTRAINT tcg_set_idiomas_mano_pkey PRIMARY KEY (set_id, market, idioma);

--
-- Name: tcg_set_idiomas tcg_set_idiomas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_set_idiomas
    ADD CONSTRAINT tcg_set_idiomas_pkey PRIMARY KEY (set_id, market);

--
-- Name: tcg_set_valor tcg_set_valor_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_set_valor
    ADD CONSTRAINT tcg_set_valor_pkey PRIMARY KEY (set_id, market, dia);

--
-- Name: tcg_sets tcg_sets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_sets
    ADD CONSTRAINT tcg_sets_pkey PRIMARY KEY (id, market);

--
-- Name: tcg_version_idioma tcg_version_idioma_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_version_idioma
    ADD CONSTRAINT tcg_version_idioma_pkey PRIMARY KEY (set_id, market, card_id, variante, idioma);

--
-- Name: telemetria_ritmo telemetria_ritmo_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.telemetria_ritmo
    ADD CONSTRAINT telemetria_ritmo_pkey PRIMARY KEY (tabla, minuto);

--
-- Name: tienda_avisos tienda_avisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_avisos
    ADD CONSTRAINT tienda_avisos_pkey PRIMARY KEY (tienda_id, card_id, market, user_id);

--
-- Name: tienda_cambios tienda_cambios_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_cambios
    ADD CONSTRAINT tienda_cambios_pkey PRIMARY KEY (id);

--
-- Name: tienda_cobros tienda_cobros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_cobros
    ADD CONSTRAINT tienda_cobros_pkey PRIMARY KEY (tienda_id);

--
-- Name: tienda_compras tienda_compras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_compras
    ADD CONSTRAINT tienda_compras_pkey PRIMARY KEY (id);

--
-- Name: tienda_fotos_pedidas tienda_fotos_pedidas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_fotos_pedidas
    ADD CONSTRAINT tienda_fotos_pedidas_pkey PRIMARY KEY (id);

--
-- Name: tienda_lotes tienda_lotes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_lotes
    ADD CONSTRAINT tienda_lotes_pkey PRIMARY KEY (id);

--
-- Name: tienda_ofertas tienda_ofertas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_ofertas
    ADD CONSTRAINT tienda_ofertas_pkey PRIMARY KEY (id);

--
-- Name: tienda_reservas tienda_reservas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_reservas
    ADD CONSTRAINT tienda_reservas_pkey PRIMARY KEY (id);

--
-- Name: tienda_solicitudes tienda_solicitudes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_solicitudes
    ADD CONSTRAINT tienda_solicitudes_pkey PRIMARY KEY (id);

--
-- Name: tienda_solicitudes tienda_solicitudes_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_solicitudes
    ADD CONSTRAINT tienda_solicitudes_token_key UNIQUE (token);

--
-- Name: tienda_stock_fotos tienda_stock_fotos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_stock_fotos
    ADD CONSTRAINT tienda_stock_fotos_pkey PRIMARY KEY (stock_id);

--
-- Name: tienda_stock tienda_stock_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_stock
    ADD CONSTRAINT tienda_stock_pkey PRIMARY KEY (id);

--
-- Name: tienda_valor_diario tienda_valor_diario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_valor_diario
    ADD CONSTRAINT tienda_valor_diario_pkey PRIMARY KEY (tienda_id, dia);

--
-- Name: tienda_ventas tienda_ventas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_ventas
    ADD CONSTRAINT tienda_ventas_pkey PRIMARY KEY (id);

--
-- Name: tienda_visitas tienda_visitas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_visitas
    ADD CONSTRAINT tienda_visitas_pkey PRIMARY KEY (tienda_id, dia);

--
-- Name: tienda_vistas tienda_vistas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_vistas
    ADD CONSTRAINT tienda_vistas_pkey PRIMARY KEY (id);

--
-- Name: tiendas tiendas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tiendas
    ADD CONSTRAINT tiendas_pkey PRIMARY KEY (user_id);

--
-- Name: tournament_decklists tournament_decklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_decklists
    ADD CONSTRAINT tournament_decklists_pkey PRIMARY KEY (id);

--
-- Name: tournament_decklists tournament_decklists_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_decklists
    ADD CONSTRAINT tournament_decklists_tournament_id_user_id_key UNIQUE (tournament_id, user_id);

--
-- Name: tournament_join_codes tournament_join_codes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_join_codes
    ADD CONSTRAINT tournament_join_codes_pkey PRIMARY KEY (tournament_id);

--
-- Name: tournament_match_replays tournament_match_replays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_match_replays
    ADD CONSTRAINT tournament_match_replays_pkey PRIMARY KEY (match_id, replay_id);

--
-- Name: tournament_matchday_avisos tournament_matchday_avisos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matchday_avisos
    ADD CONSTRAINT tournament_matchday_avisos_pkey PRIMARY KEY (tournament_id, matchday, canal);

--
-- Name: tournament_matchday_closures tournament_matchday_closures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matchday_closures
    ADD CONSTRAINT tournament_matchday_closures_pkey PRIMARY KEY (tournament_id, matchday);

--
-- Name: tournament_matchday_decklists tournament_matchday_decklists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matchday_decklists
    ADD CONSTRAINT tournament_matchday_decklists_pkey PRIMARY KEY (tournament_id, user_id, matchday);

--
-- Name: tournament_matches tournament_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_pkey PRIMARY KEY (id);

--
-- Name: tournament_matches tournament_matches_round_id_table_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_round_id_table_number_key UNIQUE (round_id, table_number);

--
-- Name: tournament_prize_deliveries tournament_prize_deliveries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_prize_deliveries
    ADD CONSTRAINT tournament_prize_deliveries_pkey PRIMARY KEY (tournament_id, user_id);

--
-- Name: tournament_registrations tournament_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_registrations
    ADD CONSTRAINT tournament_registrations_pkey PRIMARY KEY (id);

--
-- Name: tournament_registrations tournament_registrations_tournament_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_registrations
    ADD CONSTRAINT tournament_registrations_tournament_id_user_id_key UNIQUE (tournament_id, user_id);

--
-- Name: tournament_updates tournament_updates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_updates
    ADD CONSTRAINT tournament_updates_pkey PRIMARY KEY (id);

--
-- Name: tournament_xp_awards tournament_xp_awards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_xp_awards
    ADD CONSTRAINT tournament_xp_awards_pkey PRIMARY KEY (tournament_id, user_id);

--
-- Name: tournaments tournaments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_pkey PRIMARY KEY (id);

--
-- Name: tournaments tournaments_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_slug_key UNIQUE (slug);

--
-- Name: trade_confirmations trade_confirmations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_confirmations
    ADD CONSTRAINT trade_confirmations_pkey PRIMARY KEY (id);

--
-- Name: trade_offer_cobros trade_offer_cobros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offer_cobros
    ADD CONSTRAINT trade_offer_cobros_pkey PRIMARY KEY (oferta, quien);

--
-- Name: trade_offer_direcciones trade_offer_direcciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offer_direcciones
    ADD CONSTRAINT trade_offer_direcciones_pkey PRIMARY KEY (oferta, quien);

--
-- Name: trade_offer_items trade_offer_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offer_items
    ADD CONSTRAINT trade_offer_items_pkey PRIMARY KEY (id);

--
-- Name: trade_offers trade_offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offers
    ADD CONSTRAINT trade_offers_pkey PRIMARY KEY (id);

--
-- Name: user_albums user_albums_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_albums
    ADD CONSTRAINT user_albums_pkey PRIMARY KEY (id);

--
-- Name: user_cobros user_cobros_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cobros
    ADD CONSTRAINT user_cobros_pkey PRIMARY KEY (user_id);

--
-- Name: user_collection user_collection_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_collection
    ADD CONSTRAINT user_collection_pkey PRIMARY KEY (id);

--
-- Name: user_collection_value user_collection_value_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_collection_value
    ADD CONSTRAINT user_collection_value_pkey PRIMARY KEY (user_id, dia);

--
-- Name: user_cumple user_cumple_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cumple
    ADD CONSTRAINT user_cumple_pkey PRIMARY KEY (user_id);

--
-- Name: user_decks user_decks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_decks
    ADD CONSTRAINT user_decks_pkey PRIMARY KEY (id);

--
-- Name: user_direcciones user_direcciones_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_direcciones
    ADD CONSTRAINT user_direcciones_pkey PRIMARY KEY (user_id);

--
-- Name: user_follows user_follows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_pkey PRIMARY KEY (follower_id, following_id);

--
-- Name: user_notifications user_notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_pkey PRIMARY KEY (id);

--
-- Name: user_play_pokemon user_play_pokemon_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_play_pokemon
    ADD CONSTRAINT user_play_pokemon_pkey PRIMARY KEY (user_id);

--
-- Name: user_price_alerts user_price_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_price_alerts
    ADD CONSTRAINT user_price_alerts_pkey PRIMARY KEY (id);

--
-- Name: user_privado user_privado_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_privado
    ADD CONSTRAINT user_privado_pkey PRIMARY KEY (user_id);

--
-- Name: user_products user_products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_products
    ADD CONSTRAINT user_products_pkey PRIMARY KEY (id);

--
-- Name: user_products user_products_uno_por_idioma; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_products
    ADD CONSTRAINT user_products_uno_por_idioma UNIQUE (user_id, product_id, idioma);

--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);

--
-- Name: user_progress user_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_pkey PRIMARY KEY (id);

--
-- Name: user_progress user_progress_user_id_guide_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_guide_id_key UNIQUE (user_id, guide_id);

--
-- Name: user_release_alerts user_release_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_release_alerts
    ADD CONSTRAINT user_release_alerts_pkey PRIMARY KEY (id);

--
-- Name: user_release_alerts user_release_alerts_user_id_clave_market_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_release_alerts
    ADD CONSTRAINT user_release_alerts_user_id_clave_market_key UNIQUE (user_id, clave, market);

--
-- Name: user_showcase user_showcase_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_showcase
    ADD CONSTRAINT user_showcase_pkey PRIMARY KEY (user_id, posicion);

--
-- Name: user_want_list_items user_want_list_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_want_list_items
    ADD CONSTRAINT user_want_list_items_pkey PRIMARY KEY (list_id, card_id, market);

--
-- Name: user_want_lists user_want_lists_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_want_lists
    ADD CONSTRAINT user_want_lists_pkey PRIMARY KEY (id);

--
-- Name: user_wants user_wants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_wants
    ADD CONSTRAINT user_wants_pkey PRIMARY KEY (id);

--
-- Name: xp_diario xp_diario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_diario
    ADD CONSTRAINT xp_diario_pkey PRIMARY KEY (user_id, dia);

--
-- Name: xp_mes xp_mes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_mes
    ADD CONSTRAINT xp_mes_pkey PRIMARY KEY (user_id, mes);

--
-- Name: arquetipos_activos; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX arquetipos_activos ON public.tcg_archetypes USING btree (activo) WHERE activo;

--
-- Name: avisos_en_marcha; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX avisos_en_marcha ON public.avisos USING btree (publicado, hasta);

--
-- Name: busquedas_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX busquedas_created_at_idx ON public.busquedas USING btree (created_at);

--
-- Name: collab_applications_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collab_applications_status_idx ON public.collab_applications USING btree (status, created_at DESC);

--
-- Name: collab_applications_una_viva_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX collab_applications_una_viva_idx ON public.collab_applications USING btree (user_id) WHERE (status = ANY (ARRAY['nueva'::text, 'hablando'::text]));

--
-- Name: collection_folders_mias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX collection_folders_mias ON public.collection_folders USING btree (user_id, parent_id, orden);

--
-- Name: conversation_participants_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX conversation_participants_user_idx ON public.conversation_participants USING btree (user_id);

--
-- Name: course_attempts_guide_score_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_attempts_guide_score_idx ON public.course_attempts USING btree (guide_id, score DESC, created_at);

--
-- Name: course_attempts_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_attempts_user_idx ON public.course_attempts USING btree (user_id, guide_id, created_at DESC);

--
-- Name: course_review_queue_pendientes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX course_review_queue_pendientes_idx ON public.course_review_queue USING btree (user_id, review_after);

--
-- Name: daily_challenge_results_dia_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX daily_challenge_results_dia_idx ON public.daily_challenge_results USING btree (day, score DESC);

--
-- Name: email_outbox_pending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_outbox_pending_idx ON public.email_outbox USING btree (created_at) WHERE (status = 'pending'::text);

--
-- Name: email_outbox_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_outbox_recipient_idx ON public.email_outbox USING btree (recipient_id, created_at DESC);

--
-- Name: email_outbox_sending_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_outbox_sending_idx ON public.email_outbox USING btree (claimed_at) WHERE (status = 'sending'::text);

--
-- Name: enlaces_cortos_creado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX enlaces_cortos_creado_idx ON public.enlaces_cortos USING btree (creado_at);

--
-- Name: enlaces_cortos_quien_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX enlaces_cortos_quien_idx ON public.enlaces_cortos USING btree (quien, creado_at);

--
-- Name: enlaces_rotos_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX enlaces_rotos_created_at_idx ON public.enlaces_rotos USING btree (created_at);

--
-- Name: evento_asistentes_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX evento_asistentes_user_idx ON public.evento_asistentes USING btree (user_id);

--
-- Name: eventos_empieza_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX eventos_empieza_idx ON public.eventos USING btree (empieza);

--
-- Name: forum_boards_parent_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_boards_parent_idx ON public.forum_boards USING btree (parent_id);

--
-- Name: forum_boards_section_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_boards_section_idx ON public.forum_boards USING btree (section_id, "position");

--
-- Name: forum_poll_options_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_poll_options_thread_idx ON public.forum_poll_options USING btree (thread_id, order_pos);

--
-- Name: forum_poll_votes_option_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_poll_votes_option_idx ON public.forum_poll_votes USING btree (option_id);

--
-- Name: forum_poll_votes_una_por_persona; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX forum_poll_votes_una_por_persona ON public.forum_poll_votes USING btree (thread_id, user_id) WHERE (multiple = false);

--
-- Name: forum_polls_thread_multiple; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX forum_polls_thread_multiple ON public.forum_polls USING btree (thread_id, multiple);

--
-- Name: forum_post_likes_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_post_likes_post_idx ON public.forum_post_likes USING btree (post_id);

--
-- Name: forum_post_reactions_post_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_post_reactions_post_idx ON public.forum_post_reactions USING btree (post_id);

--
-- Name: forum_posts_author_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_posts_author_idx ON public.forum_posts USING btree (author_id, created_at DESC);

--
-- Name: forum_posts_search_norm_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_posts_search_norm_trgm_idx ON public.forum_posts USING gin (search_norm public.gin_trgm_ops);

--
-- Name: forum_posts_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_posts_thread_idx ON public.forum_posts USING btree (thread_id, created_at);

--
-- Name: forum_subscriptions_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_subscriptions_thread_idx ON public.forum_subscriptions USING btree (thread_id);

--
-- Name: forum_thread_reads_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_thread_reads_user_idx ON public.forum_thread_reads USING btree (user_id, last_read_at DESC);

--
-- Name: forum_threads_author_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_threads_author_idx ON public.forum_threads USING btree (author_id);

--
-- Name: forum_threads_board_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_threads_board_idx ON public.forum_threads USING btree (board_id, is_pinned DESC, last_post_at DESC);

--
-- Name: forum_threads_search_norm_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX forum_threads_search_norm_trgm_idx ON public.forum_threads USING gin (search_norm public.gin_trgm_ops);

--
-- Name: guide_comments_guide_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guide_comments_guide_idx ON public.guide_comments USING btree (guide_id);

--
-- Name: guide_comments_reply_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guide_comments_reply_to_idx ON public.guide_comments USING btree (reply_to_id) WHERE (reply_to_id IS NOT NULL);

--
-- Name: guide_helpful_guide_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guide_helpful_guide_idx ON public.guide_helpful USING btree (guide_id);

--
-- Name: guide_helpful_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guide_helpful_user_idx ON public.guide_helpful USING btree (user_id);

--
-- Name: guide_request_votes_request_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guide_request_votes_request_idx ON public.guide_request_votes USING btree (request_id);

--
-- Name: guide_requests_abiertas_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guide_requests_abiertas_idx ON public.guide_requests USING btree (created_at DESC) WHERE ((fulfilled_guide_id IS NULL) AND (closed_at IS NULL));

--
-- Name: guide_requests_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guide_requests_created_idx ON public.guide_requests USING btree (created_at DESC);

--
-- Name: guide_reviews_guide_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guide_reviews_guide_idx ON public.guide_reviews USING btree (guide_id);

--
-- Name: guide_suggestions_author_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guide_suggestions_author_idx ON public.guide_suggestions USING btree (author_id);

--
-- Name: guide_suggestions_guide_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guide_suggestions_guide_idx ON public.guide_suggestions USING btree (guide_id, status);

--
-- Name: guides_guias_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guides_guias_idx ON public.guides USING btree (published_at DESC) WHERE ((kind = 'guide'::text) AND (published_at IS NOT NULL));

--
-- Name: guides_noticias_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guides_noticias_idx ON public.guides USING btree (published_at DESC) WHERE ((kind = 'news'::text) AND (published_at IS NOT NULL));

--
-- Name: guides_search_norm_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guides_search_norm_trgm_idx ON public.guides USING gin (search_norm public.gin_trgm_ops);

--
-- Name: guides_telegram_pendientes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guides_telegram_pendientes_idx ON public.guides USING btree (published_at) WHERE ((kind = 'news'::text) AND (published_at IS NOT NULL) AND (telegram_sent_at IS NULL));

--
-- Name: guides_x_pendientes_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX guides_x_pendientes_idx ON public.guides USING btree (published_at) WHERE ((kind = 'news'::text) AND (published_at IS NOT NULL) AND (x_sent_at IS NULL));

--
-- Name: inscripciones_torneo_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inscripciones_torneo_estado ON public.tournament_registrations USING btree (tournament_id, status);

--
-- Name: llamadas_torneo_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX llamadas_torneo_estado ON public.judge_calls USING btree (tournament_id, status);

--
-- Name: log_torneos_mios; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX log_torneos_mios ON public.match_log_torneos USING btree (user_id, jugado_el DESC);

--
-- Name: log_torneos_por_mazo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX log_torneos_por_mazo ON public.match_log_torneos USING btree (user_deck_id) WHERE (user_deck_id IS NOT NULL);

--
-- Name: logros_a_mano_logro_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX logros_a_mano_logro_idx ON public.logros_a_mano USING btree (logro_id, created_at DESC);

--
-- Name: match_log_repeticion; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX match_log_repeticion ON public.match_log USING btree (user_id, replay_id) WHERE (replay_id IS NOT NULL);

--
-- Name: match_reports_por_juego; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX match_reports_por_juego ON public.match_reports USING btree (match_id, reporter_id, game_number);

--
-- Name: mensajes_juez_llamada; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mensajes_juez_llamada ON public.judge_messages USING btree (judge_call_id);

--
-- Name: mensajes_partida; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX mensajes_partida ON public.match_messages USING btree (match_id);

--
-- Name: meta_cartas_dia_arquetipo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meta_cartas_dia_arquetipo_idx ON public.meta_cartas_dia USING btree (arquetipo, dia);

--
-- Name: meta_guias_guia_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meta_guias_guia_idx ON public.meta_guias USING btree (guide_id);

--
-- Name: meta_resultados_arquetipo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meta_resultados_arquetipo_idx ON public.meta_resultados USING btree (arquetipo);

--
-- Name: meta_resultados_listas_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meta_resultados_listas_idx ON public.meta_resultados USING btree (arquetipo) WHERE (lista IS NOT NULL);

--
-- Name: meta_torneos_fecha_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meta_torneos_fecha_idx ON public.meta_torneos USING btree (fecha DESC);

--
-- Name: meta_torneos_fuente_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meta_torneos_fuente_idx ON public.meta_torneos USING btree (fuente, fecha DESC);

--
-- Name: moderaciones_abiertas_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderaciones_abiertas_idx ON public.moderaciones USING btree (hasta) WHERE (quitada_at IS NULL);

--
-- Name: moderaciones_usuario_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX moderaciones_usuario_idx ON public.moderaciones USING btree (user_id, created_at DESC);

--
-- Name: online_now_last_seen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX online_now_last_seen_idx ON public.online_now USING btree (last_seen);

--
-- Name: online_now_thread_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX online_now_thread_idx ON public.online_now USING btree (thread_id) WHERE (thread_id IS NOT NULL);

--
-- Name: page_views_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_views_created_at_idx ON public.page_views USING btree (created_at);

--
-- Name: page_views_primera_dia_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_views_primera_dia_idx ON public.page_views USING btree (created_at) WHERE primera_del_dia;

--
-- Name: page_vitals_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX page_vitals_created_at_idx ON public.page_vitals USING btree (created_at);

--
-- Name: partidas_de_torneo; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX partidas_de_torneo ON public.match_log USING btree (torneo_id) WHERE (torneo_id IS NOT NULL);

--
-- Name: partidas_enfrentamiento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX partidas_enfrentamiento ON public.match_log USING btree (user_id, mi_mazo, rival_mazo);

--
-- Name: partidas_mias; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX partidas_mias ON public.match_log USING btree (user_id, jugada_el DESC);

--
-- Name: partidas_por_mazo_guardado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX partidas_por_mazo_guardado ON public.match_log USING btree (user_id, user_deck_id) WHERE (user_deck_id IS NOT NULL);

--
-- Name: partidas_ronda_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX partidas_ronda_estado ON public.tournament_matches USING btree (round_id, status);

--
-- Name: private_message_reactions_conv_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX private_message_reactions_conv_idx ON public.private_message_reactions USING btree (conversation_id);

--
-- Name: private_messages_conversation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX private_messages_conversation_idx ON public.private_messages USING btree (conversation_id, created_at DESC);

--
-- Name: push_subscriptions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX push_subscriptions_user ON public.push_subscriptions USING btree (user_id);

--
-- Name: replay_puzzles_recientes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX replay_puzzles_recientes ON public.replay_puzzles USING btree (created_at DESC);

--
-- Name: replays_dueno; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX replays_dueno ON public.replays USING btree (user_id, created_at DESC);

--
-- Name: replays_dueno_registro; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX replays_dueno_registro ON public.replays USING btree (user_id, registro_md5);

--
-- Name: replays_publicas; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX replays_publicas ON public.replays USING gin (arquetipos) WHERE publica;

--
-- Name: retos_resultados_juego_dia_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX retos_resultados_juego_dia_idx ON public.retos_resultados USING btree (juego, day);

--
-- Name: rounds_torneo_estado; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX rounds_torneo_estado ON public.rounds USING btree (tournament_id, status);

--
-- Name: sets_codigo_live; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sets_codigo_live ON public.tcg_sets USING btree (tcg_online_code, market) WHERE (tcg_online_code IS NOT NULL);

--
-- Name: tcg_card_play_decks_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_card_play_decks_idx ON public.tcg_card_play USING btree (decks DESC);

--
-- Name: tcg_card_prices_revisado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_card_prices_revisado_idx ON public.tcg_card_prices USING btree (checked_at);

--
-- Name: tcg_card_versions_carta; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_card_versions_carta ON public.tcg_card_versions USING btree (card_id, market);

--
-- Name: tcg_card_versions_producto; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_card_versions_producto ON public.tcg_card_versions USING btree (cm_id_product) WHERE (origen = 'edicion'::text);

--
-- Name: tcg_card_versions_producto_tcgdex; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_card_versions_producto_tcgdex ON public.tcg_card_versions USING btree (cm_id_product) WHERE (origen = 'tcgdex'::text);

--
-- Name: tcg_card_versions_set; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_card_versions_set ON public.tcg_card_versions USING btree (set_id, market);

--
-- Name: tcg_card_versions_vieja; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_card_versions_vieja ON public.tcg_card_versions USING btree (actualizado_at);

--
-- Name: tcg_cards_cm_propio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_cm_propio_idx ON public.tcg_cards USING btree (cm_id_product_propio) WHERE (cm_id_product_propio IS NOT NULL);

--
-- Name: tcg_cards_dex_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_dex_idx ON public.tcg_cards USING gin (dex_ids);

--
-- Name: tcg_cards_escaneo_cola_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_escaneo_cola_idx ON public.tcg_cards USING btree (escaneo_buscado_at NULLS FIRST) WHERE (image_path IS NULL);

--
-- Name: tcg_cards_market_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_market_idx ON public.tcg_cards USING btree (market);

--
-- Name: tcg_cards_market_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_market_name_idx ON public.tcg_cards USING btree (market, name_search);

--
-- Name: tcg_cards_name_key_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_name_key_idx ON public.tcg_cards USING btree (name_key);

--
-- Name: tcg_cards_name_search_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_name_search_trgm_idx ON public.tcg_cards USING gin (name_search public.gin_trgm_ops);

--
-- Name: tcg_cards_rarity_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_rarity_idx ON public.tcg_cards USING btree (market, rarity);

--
-- Name: tcg_cards_regulation_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_regulation_idx ON public.tcg_cards USING btree (regulation_mark);

--
-- Name: tcg_cards_set_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_set_idx ON public.tcg_cards USING btree (set_id, local_id);

--
-- Name: tcg_cards_sin_detalle_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_sin_detalle_idx ON public.tcg_cards USING btree (set_id) WHERE ((detalle_at IS NULL) OR (detalle_lang IS NULL));

--
-- Name: tcg_cards_sin_dex_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_sin_dex_idx ON public.tcg_cards USING btree (market) WHERE (dex_ids IS NULL);

--
-- Name: tcg_cards_sin_imagen_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_sin_imagen_idx ON public.tcg_cards USING btree (market, set_id) WHERE ((image_path IS NULL) AND (curado_v < 1));

--
-- Name: tcg_cards_sin_imagen_scrydex; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_sin_imagen_scrydex ON public.tcg_cards USING btree (market) WHERE (image_scrydex IS NULL);

--
-- Name: tcg_cards_sin_scrydex; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_sin_scrydex ON public.tcg_cards USING btree (market, set_id) WHERE (scrydex_at IS NULL);

--
-- Name: tcg_cards_tcggo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_cards_tcggo_idx ON public.tcg_cards USING btree (tcggo_id) WHERE (tcggo_id IS NOT NULL);

--
-- Name: tcg_eras_orden_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_eras_orden_idx ON public.tcg_eras USING btree (market, orden);

--
-- Name: tcg_product_contenido_dentro; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_product_contenido_dentro ON public.tcg_product_contenido USING btree (contenido_tipo, contenido_id);

--
-- Name: tcg_products_episodio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_products_episodio ON public.tcg_products USING btree (episode_id);

--
-- Name: tcg_products_mercado_episodio; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_products_mercado_episodio ON public.tcg_products USING btree (market, episode_id);

--
-- Name: tcg_sets_curado_viejo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_sets_curado_viejo_idx ON public.tcg_sets USING btree (market, release_date DESC NULLS LAST) WHERE (curado_v < 1);

--
-- Name: tcg_sets_market_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_sets_market_idx ON public.tcg_sets USING btree (market);

--
-- Name: tcg_sets_orden_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_sets_orden_idx ON public.tcg_sets USING btree (market, orden);

--
-- Name: tcg_sets_sin_logo_scrydex; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tcg_sets_sin_logo_scrydex ON public.tcg_sets USING btree (market) WHERE (logo_scrydex IS NULL);

--
-- Name: tienda_cambios_compra_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tienda_cambios_compra_idx ON public.tienda_cambios USING btree (compra_ticket);

--
-- Name: tienda_cambios_tienda_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_cambios_tienda_idx ON public.tienda_cambios USING btree (tienda_id, hecho_el DESC);

--
-- Name: tienda_cambios_venta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tienda_cambios_venta_idx ON public.tienda_cambios USING btree (venta_ticket);

--
-- Name: tienda_compras_lote_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_compras_lote_idx ON public.tienda_compras USING btree (lote_id) WHERE (lote_id IS NOT NULL);

--
-- Name: tienda_compras_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_compras_ticket_idx ON public.tienda_compras USING btree (ticket);

--
-- Name: tienda_compras_tienda_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_compras_tienda_idx ON public.tienda_compras USING btree (tienda_id, comprada_el DESC);

--
-- Name: tienda_fotos_pedidas_tienda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_fotos_pedidas_tienda ON public.tienda_fotos_pedidas USING btree (tienda_id) WHERE (atendida_at IS NULL);

--
-- Name: tienda_fotos_pedidas_una; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tienda_fotos_pedidas_una ON public.tienda_fotos_pedidas USING btree (comprador_id, stock_id) WHERE (atendida_at IS NULL);

--
-- Name: tienda_lotes_por_desglosar; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_lotes_por_desglosar ON public.tienda_lotes USING btree (tienda_id) WHERE (estado = 'por_desglosar'::text);

--
-- Name: tienda_lotes_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_lotes_ticket_idx ON public.tienda_lotes USING btree (compra_ticket);

--
-- Name: tienda_lotes_tienda_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_lotes_tienda_idx ON public.tienda_lotes USING btree (tienda_id, creado_el DESC);

--
-- Name: tienda_ofertas_comprador_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_ofertas_comprador_idx ON public.tienda_ofertas USING btree (comprador_id, updated_at DESC);

--
-- Name: tienda_ofertas_tienda_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_ofertas_tienda_idx ON public.tienda_ofertas USING btree (tienda_id, estado, updated_at DESC);

--
-- Name: tienda_ofertas_una_viva; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX tienda_ofertas_una_viva ON public.tienda_ofertas USING btree (comprador_id, stock_id) WHERE (estado = 'abierta'::text);

--
-- Name: tienda_reservas_stock_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_reservas_stock_idx ON public.tienda_reservas USING btree (stock_id);

--
-- Name: tienda_reservas_tienda_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_reservas_tienda_idx ON public.tienda_reservas USING btree (tienda_id, hasta);

--
-- Name: tienda_solicitudes_creada_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_solicitudes_creada_idx ON public.tienda_solicitudes USING btree (created_at DESC);

--
-- Name: tienda_solicitudes_email_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_solicitudes_email_idx ON public.tienda_solicitudes USING btree (lower(email));

--
-- Name: tienda_stock_carta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_stock_carta_idx ON public.tienda_stock USING btree (card_id) WHERE (card_id IS NOT NULL);

--
-- Name: tienda_stock_destacadas_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_stock_destacadas_idx ON public.tienda_stock USING btree (tienda_id) WHERE destacada;

--
-- Name: tienda_stock_fotos_tienda; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_stock_fotos_tienda ON public.tienda_stock_fotos USING btree (tienda_id);

--
-- Name: tienda_stock_por_poner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_stock_por_poner ON public.tienda_stock USING btree (tienda_id) WHERE por_poner;

--
-- Name: tienda_stock_tienda_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_stock_tienda_idx ON public.tienda_stock USING btree (tienda_id, entro_el DESC);

--
-- Name: tienda_ventas_ticket_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_ventas_ticket_idx ON public.tienda_ventas USING btree (ticket);

--
-- Name: tienda_ventas_tienda_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tienda_ventas_tienda_idx ON public.tienda_ventas USING btree (tienda_id, vendida_el DESC);

--
-- Name: tmr_por_jugador; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tmr_por_jugador ON public.tournament_match_replays USING btree (match_id, user_id);

--
-- Name: tournament_updates_torneo_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tournament_updates_torneo_idx ON public.tournament_updates USING btree (tournament_id, created_at DESC);

--
-- Name: tournaments_privados; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tournaments_privados ON public.tournaments USING btree (is_private) WHERE is_private;

--
-- Name: tournaments_telegram_pendientes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tournaments_telegram_pendientes ON public.tournaments USING btree (start_at) WHERE (telegram_sent_at IS NULL);

--
-- Name: tournaments_xp_pendiente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX tournaments_xp_pendiente ON public.tournaments USING btree (status) WHERE (xp_awarded_at IS NULL);

--
-- Name: trade_confirmations_a_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_confirmations_a_idx ON public.trade_confirmations USING btree (user_a, created_at DESC);

--
-- Name: trade_confirmations_b_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_confirmations_b_idx ON public.trade_confirmations USING btree (user_b, created_at DESC);

--
-- Name: trade_offer_items_linea_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_offer_items_linea_idx ON public.trade_offer_items USING btree (linea) WHERE (linea IS NOT NULL);

--
-- Name: trade_offer_items_oferta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_offer_items_oferta_idx ON public.trade_offer_items USING btree (oferta);

--
-- Name: trade_offers_de_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_offers_de_idx ON public.trade_offers USING btree (de, created_at DESC);

--
-- Name: trade_offers_para_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX trade_offers_para_idx ON public.trade_offers USING btree (para, created_at DESC);

--
-- Name: user_albums_dueno_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_albums_dueno_idx ON public.user_albums USING btree (user_id, updated_at DESC);

--
-- Name: user_collection_cambio_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_collection_cambio_idx ON public.user_collection USING btree (card_id) WHERE (cambio > 0);

--
-- Name: user_collection_carta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_collection_carta_idx ON public.user_collection USING btree (card_id);

--
-- Name: user_collection_dueno_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_collection_dueno_idx ON public.user_collection USING btree (user_id, created_at DESC);

--
-- Name: user_collection_mercado_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_collection_mercado_idx ON public.user_collection USING btree (market, updated_at DESC) WHERE (cambio > 0);

--
-- Name: user_collection_value_dia_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_collection_value_dia_idx ON public.user_collection_value USING btree (dia);

--
-- Name: user_decks_dueno_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_decks_dueno_idx ON public.user_decks USING btree (user_id, updated_at DESC);

--
-- Name: user_decks_publicos_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_decks_publicos_idx ON public.user_decks USING btree (updated_at DESC) WHERE is_public;

--
-- Name: user_follows_follower_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_follows_follower_idx ON public.user_follows USING btree (follower_id);

--
-- Name: user_follows_following_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_follows_following_idx ON public.user_follows USING btree (following_id);

--
-- Name: user_notifications_recipient_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_notifications_recipient_idx ON public.user_notifications USING btree (recipient_id, created_at DESC);

--
-- Name: user_notifications_sin_push; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_notifications_sin_push ON public.user_notifications USING btree (created_at) WHERE (pushed_at IS NULL);

--
-- Name: user_price_alerts_activos_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_price_alerts_activos_idx ON public.user_price_alerts USING btree (card_id) WHERE activo;

--
-- Name: user_price_alerts_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_price_alerts_user_idx ON public.user_price_alerts USING btree (user_id, created_at DESC);

--
-- Name: user_privado_referred_by_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_privado_referred_by_idx ON public.user_privado USING btree (referred_by) WHERE (referred_by IS NOT NULL);

--
-- Name: user_privado_token_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_privado_token_idx ON public.user_privado USING btree (email_unsubscribe_token);

--
-- Name: user_products_mios; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_products_mios ON public.user_products USING btree (user_id);

--
-- Name: user_profiles_birthday_md_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_profiles_birthday_md_idx ON public.user_profiles USING btree (birthday_md) WHERE (birthday_md IS NOT NULL);

--
-- Name: user_profiles_search_norm_trgm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_profiles_search_norm_trgm_idx ON public.user_profiles USING gin (search_norm public.gin_trgm_ops);

--
-- Name: user_profiles_username_unique_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_profiles_username_unique_idx ON public.user_profiles USING btree (lower(username));

--
-- Name: user_progress_completed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_progress_completed_at_idx ON public.user_progress USING btree (completed_at DESC) WHERE (completed_at IS NOT NULL);

--
-- Name: user_progress_read_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_progress_read_at_idx ON public.user_progress USING btree (user_id, read_at) WHERE (read_at IS NOT NULL);

--
-- Name: user_progress_user_guide_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_progress_user_guide_key ON public.user_progress USING btree (user_id, guide_id);

--
-- Name: user_release_alerts_clave_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_release_alerts_clave_idx ON public.user_release_alerts USING btree (clave, market);

--
-- Name: user_want_list_items_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_want_list_items_user ON public.user_want_list_items USING btree (user_id);

--
-- Name: user_want_lists_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_want_lists_user ON public.user_want_lists USING btree (user_id);

--
-- Name: user_wants_carta_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_wants_carta_idx ON public.user_wants USING btree (card_id);

--
-- Name: user_wants_unico; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_wants_unico ON public.user_wants USING btree (user_id, card_id, COALESCE(idioma, '*'::text), COALESCE(variante, '*'::text));

--
-- Name: xp_mes_por_mes; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX xp_mes_por_mes ON public.xp_mes USING btree (mes);

--
-- Name: tcg_cards catalogo_correcciones_cards; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER catalogo_correcciones_cards BEFORE INSERT OR UPDATE ON public.tcg_cards FOR EACH ROW EXECUTE FUNCTION public.catalogo_aplicar_correcciones();

--
-- Name: tcg_sets catalogo_correcciones_sets; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER catalogo_correcciones_sets BEFORE INSERT OR UPDATE ON public.tcg_sets FOR EACH ROW EXECUTE FUNCTION public.catalogo_aplicar_correcciones();

--
-- Name: collab_applications collab_application_aviso; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER collab_application_aviso AFTER INSERT ON public.collab_applications FOR EACH ROW EXECUTE FUNCTION public.on_collab_application();

--
-- Name: collection_folders collection_folders_sin_ciclos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER collection_folders_sin_ciclos BEFORE INSERT OR UPDATE OF parent_id ON public.collection_folders FOR EACH ROW EXECUTE FUNCTION public.carpetas_sin_ciclos();

--
-- Name: guide_comments comment_reply_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER comment_reply_email AFTER INSERT ON public.guide_comments FOR EACH ROW EXECUTE FUNCTION public.on_comment_reply_email();

--
-- Name: course_attempts course_attempts_medalla; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER course_attempts_medalla BEFORE INSERT OR UPDATE ON public.course_attempts FOR EACH ROW EXECUTE FUNCTION public.course_attempt_medalla();

--
-- Name: forum_posts forum_post_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER forum_post_email AFTER INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.on_forum_post_email();

--
-- Name: guides guide_review_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guide_review_email AFTER INSERT OR UPDATE OF review_status ON public.guides FOR EACH ROW EXECUTE FUNCTION public.on_guide_review_email();

--
-- Name: guides guides_cuenta_del_tema; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guides_cuenta_del_tema AFTER INSERT OR DELETE OR UPDATE ON public.guides FOR EACH ROW EXECUTE FUNCTION public.guides_cuenta_del_tema();

--
-- Name: guides guides_guardar_lo_del_equipo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guides_guardar_lo_del_equipo BEFORE UPDATE ON public.guides FOR EACH ROW EXECUTE FUNCTION public.guardar_lo_que_no_es_del_autor();

--
-- Name: guides guides_marca_actualizacion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guides_marca_actualizacion BEFORE INSERT OR UPDATE ON public.guides FOR EACH ROW EXECUTE FUNCTION public.guides_marca_actualizacion();

--
-- Name: guides guides_solo_admin_publica_noticias; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guides_solo_admin_publica_noticias BEFORE INSERT OR UPDATE ON public.guides FOR EACH ROW EXECUTE FUNCTION public.guides_solo_admin_publica_noticias();

--
-- Name: guides guides_tambien_en; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER guides_tambien_en BEFORE INSERT OR UPDATE ON public.guides FOR EACH ROW EXECUTE FUNCTION public.guides_tambien_en();

--
-- Name: user_collection intercambios_avisar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER intercambios_avisar AFTER INSERT OR UPDATE OF cambio ON public.user_collection FOR EACH ROW EXECUTE FUNCTION public.intercambios_avisar();

--
-- Name: match_log_ajustes match_log_ajustes_mazo_propio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER match_log_ajustes_mazo_propio BEFORE INSERT OR UPDATE OF user_deck_id, user_id ON public.match_log_ajustes FOR EACH ROW EXECUTE FUNCTION public.match_log_mazo_propio();

--
-- Name: match_log match_log_mazo_propio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER match_log_mazo_propio BEFORE INSERT OR UPDATE OF user_deck_id, user_id ON public.match_log FOR EACH ROW EXECUTE FUNCTION public.match_log_mazo_propio();

--
-- Name: match_log_torneos match_log_torneo_arrastra; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER match_log_torneo_arrastra AFTER UPDATE ON public.match_log_torneos FOR EACH ROW EXECUTE FUNCTION public.match_log_torneo_arrastra();

--
-- Name: match_log_torneos match_log_torneos_mazo_propio; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER match_log_torneos_mazo_propio BEFORE INSERT OR UPDATE OF user_deck_id, user_id ON public.match_log_torneos FOR EACH ROW EXECUTE FUNCTION public.match_log_mazo_propio();

--
-- Name: user_follows new_follower_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER new_follower_email AFTER INSERT ON public.user_follows FOR EACH ROW EXECUTE FUNCTION public.on_new_follower_email();

--
-- Name: private_messages private_message_email; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER private_message_email AFTER INSERT ON public.private_messages FOR EACH ROW EXECUTE FUNCTION public.on_private_message_email();

--
-- Name: replays replays_tocar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER replays_tocar BEFORE UPDATE ON public.replays FOR EACH ROW EXECUTE FUNCTION public.replays_tocar();

--
-- Name: replays replays_tope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER replays_tope BEFORE INSERT ON public.replays FOR EACH ROW EXECUTE FUNCTION public.replays_tope();

--
-- Name: user_cumple trg_cumple_al_perfil; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cumple_al_perfil AFTER INSERT OR DELETE OR UPDATE ON public.user_cumple FOR EACH ROW EXECUTE FUNCTION public.cumple_al_perfil();

--
-- Name: content_reports trg_esconder_si_denuncian; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_esconder_si_denuncian AFTER INSERT ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.esconder_si_denuncian();

--
-- Name: eventos trg_eventos_uno_destacado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_eventos_uno_destacado BEFORE INSERT OR UPDATE OF destacado ON public.eventos FOR EACH ROW WHEN (new.destacado) EXECUTE FUNCTION public.eventos_uno_destacado();

--
-- Name: forum_threads trg_foro_premiar_solucion; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_foro_premiar_solucion AFTER UPDATE OF solved_post_id ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.foro_premiar_solucion();

--
-- Name: forum_posts trg_forum_contar_mensajes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_forum_contar_mensajes AFTER INSERT OR DELETE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.forum_contar_mensajes();

--
-- Name: forum_posts trg_forum_marcar_editado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_forum_marcar_editado BEFORE UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.forum_marcar_editado();

--
-- Name: forum_posts trg_forum_recontar_tema; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_forum_recontar_tema AFTER INSERT OR DELETE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.forum_recontar_tema();

--
-- Name: forum_threads trg_forum_solo_staff_modera; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_forum_solo_staff_modera BEFORE UPDATE ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.forum_solo_staff_modera();

--
-- Name: forum_posts trg_forum_suscribir_al_escribir; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_forum_suscribir_al_escribir AFTER INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.forum_suscribir_al_escribir();

--
-- Name: forum_threads trg_forum_valida_resuelto; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_forum_valida_resuelto BEFORE UPDATE OF solved_post_id ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.forum_valida_resuelto();

--
-- Name: client_errors trg_freno_client_errors; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_client_errors BEFORE INSERT ON public.client_errors FOR EACH ROW EXECUTE FUNCTION public.freno_de_telemetria('60');

--
-- Name: forum_posts trg_freno_de_cuenta_nueva; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_de_cuenta_nueva BEFORE INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.freno_de_cuenta_nueva();

--
-- Name: forum_threads trg_freno_de_cuenta_nueva; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_de_cuenta_nueva BEFORE INSERT ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.freno_de_cuenta_nueva();

--
-- Name: private_messages trg_freno_de_cuenta_nueva; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_de_cuenta_nueva BEFORE INSERT ON public.private_messages FOR EACH ROW EXECUTE FUNCTION public.freno_de_cuenta_nueva();

--
-- Name: content_reports trg_freno_de_ritmo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_de_ritmo BEFORE INSERT ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.freno_de_ritmo('reporter_id', '5', '30');

--
-- Name: forum_posts trg_freno_de_ritmo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_de_ritmo BEFORE INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.freno_de_ritmo('author_id', '6', '60');

--
-- Name: forum_threads trg_freno_de_ritmo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_de_ritmo BEFORE INSERT ON public.forum_threads FOR EACH ROW EXECUTE FUNCTION public.freno_de_ritmo('author_id', '3', '15');

--
-- Name: private_messages trg_freno_de_ritmo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_de_ritmo BEFORE INSERT ON public.private_messages FOR EACH ROW EXECUTE FUNCTION public.freno_de_ritmo('sender_id', '20', '300');

--
-- Name: user_follows trg_freno_de_ritmo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_de_ritmo BEFORE INSERT ON public.user_follows FOR EACH ROW EXECUTE FUNCTION public.freno_de_ritmo('follower_id', '20', '200');

--
-- Name: page_views trg_freno_page_views; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_page_views BEFORE INSERT ON public.page_views FOR EACH ROW EXECUTE FUNCTION public.freno_de_telemetria('300');

--
-- Name: page_vitals trg_freno_page_vitals; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_freno_page_vitals BEFORE INSERT ON public.page_vitals FOR EACH ROW EXECUTE FUNCTION public.freno_de_telemetria('120');

--
-- Name: forum_posts trg_guarda_oculto_spam; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_guarda_oculto_spam BEFORE UPDATE ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.guarda_oculto_spam();

--
-- Name: private_messages trg_mensaje_respuesta; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_mensaje_respuesta BEFORE INSERT OR UPDATE OF reply_to_id ON public.private_messages FOR EACH ROW EXECUTE FUNCTION public.mensaje_respuesta_misma_conversacion();

--
-- Name: user_profiles trg_perfil_guarda_columnas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_perfil_guarda_columnas BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.perfil_guarda_columnas();

--
-- Name: user_profiles trg_privado_al_nacer; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_privado_al_nacer AFTER INSERT ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.privado_al_nacer();

--
-- Name: user_profiles trg_solo_admin_da_titulos; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_solo_admin_da_titulos BEFORE UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.solo_admin_da_titulos();

--
-- Name: tienda_stock_fotos trg_tienda_fotos_subidas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tienda_fotos_subidas AFTER INSERT OR UPDATE OF frente, dorso ON public.tienda_stock_fotos FOR EACH ROW EXECUTE FUNCTION public.tienda_fotos_subidas();

--
-- Name: user_profiles trg_tienda_guarda_tipo; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tienda_guarda_tipo BEFORE INSERT OR UPDATE ON public.user_profiles FOR EACH ROW EXECUTE FUNCTION public.tienda_guarda_tipo();

--
-- Name: tienda_stock trg_tienda_stock_tope_destacadas; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_tienda_stock_tope_destacadas BEFORE INSERT OR UPDATE OF destacada ON public.tienda_stock FOR EACH ROW EXECUTE FUNCTION public.tienda_stock_tope_destacadas();

--
-- Name: tournaments trg_torneos_solo_admin_marca_oficial; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_torneos_solo_admin_marca_oficial BEFORE INSERT OR UPDATE ON public.tournaments FOR EACH ROW EXECUTE FUNCTION public.torneos_solo_admin_marca_oficial();

--
-- Name: guide_helpful trg_xp_autor_por_agradecimiento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_xp_autor_por_agradecimiento AFTER INSERT ON public.guide_helpful FOR EACH ROW EXECUTE FUNCTION public.xp_autor_por_agradecimiento();

--
-- Name: user_progress trg_xp_autor_por_lectura; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_xp_autor_por_lectura AFTER INSERT OR UPDATE OF read_at ON public.user_progress FOR EACH ROW EXECUTE FUNCTION public.xp_autor_por_lectura();

--
-- Name: forum_posts trg_xp_por_mensaje_de_foro; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_xp_por_mensaje_de_foro AFTER INSERT ON public.forum_posts FOR EACH ROW EXECUTE FUNCTION public.xp_por_mensaje_de_foro();

--
-- Name: guide_suggestions trg_xp_por_sugerencia_aceptada; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_xp_por_sugerencia_aceptada AFTER UPDATE OF status ON public.guide_suggestions FOR EACH ROW EXECUTE FUNCTION public.xp_por_sugerencia_aceptada();

--
-- Name: user_albums user_albums_tocar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_albums_tocar BEFORE UPDATE ON public.user_albums FOR EACH ROW EXECUTE FUNCTION public.user_albums_tocar();

--
-- Name: user_albums user_albums_tope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_albums_tope BEFORE INSERT ON public.user_albums FOR EACH ROW EXECUTE FUNCTION public.user_albums_tope();

--
-- Name: user_collection user_collection_tocar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_collection_tocar BEFORE UPDATE ON public.user_collection FOR EACH ROW EXECUTE FUNCTION public.user_collection_tocar();

--
-- Name: user_collection user_collection_tope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_collection_tope BEFORE INSERT ON public.user_collection FOR EACH ROW EXECUTE FUNCTION public.user_collection_tope();

--
-- Name: user_decks user_decks_tocar; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_decks_tocar BEFORE UPDATE ON public.user_decks FOR EACH ROW EXECUTE FUNCTION public.user_decks_tocar();

--
-- Name: user_decks user_decks_tope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_decks_tope BEFORE INSERT ON public.user_decks FOR EACH ROW EXECUTE FUNCTION public.user_decks_tope();

--
-- Name: user_wants user_wants_tope; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER user_wants_tope BEFORE INSERT ON public.user_wants FOR EACH ROW EXECUTE FUNCTION public.user_wants_tope();

--
-- Name: account_deletion_requests account_deletion_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_deletion_requests
    ADD CONSTRAINT account_deletion_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: adviento_casillas adviento_casillas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adviento_casillas
    ADD CONSTRAINT adviento_casillas_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: app_feedback app_feedback_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_feedback
    ADD CONSTRAINT app_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: aviso_cifras aviso_cifras_aviso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_cifras
    ADD CONSTRAINT aviso_cifras_aviso_id_fkey FOREIGN KEY (aviso_id) REFERENCES public.avisos(id) ON DELETE CASCADE;

--
-- Name: aviso_participantes aviso_participantes_aviso_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_participantes
    ADD CONSTRAINT aviso_participantes_aviso_id_fkey FOREIGN KEY (aviso_id) REFERENCES public.avisos(id) ON DELETE CASCADE;

--
-- Name: aviso_participantes aviso_participantes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aviso_participantes
    ADD CONSTRAINT aviso_participantes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: avisos avisos_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT avisos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: avisos_enviados avisos_enviados_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos_enviados
    ADD CONSTRAINT avisos_enviados_por_fkey FOREIGN KEY (por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: avisos avisos_ganador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.avisos
    ADD CONSTRAINT avisos_ganador_id_fkey FOREIGN KEY (ganador_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: calendario_claves calendario_claves_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.calendario_claves
    ADD CONSTRAINT calendario_claves_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: client_errors client_errors_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_errors
    ADD CONSTRAINT client_errors_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: collab_applications collab_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collab_applications
    ADD CONSTRAINT collab_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: collection_favorite_sets collection_favorite_sets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_favorite_sets
    ADD CONSTRAINT collection_favorite_sets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: collection_folder_cards collection_folder_cards_folder_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_folder_cards
    ADD CONSTRAINT collection_folder_cards_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES public.collection_folders(id) ON DELETE CASCADE;

--
-- Name: collection_folder_cards collection_folder_cards_line_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_folder_cards
    ADD CONSTRAINT collection_folder_cards_line_id_fkey FOREIGN KEY (line_id) REFERENCES public.user_collection(id) ON DELETE CASCADE;

--
-- Name: collection_folders collection_folders_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_folders
    ADD CONSTRAINT collection_folders_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.collection_folders(id) ON DELETE CASCADE;

--
-- Name: collection_folders collection_folders_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.collection_folders
    ADD CONSTRAINT collection_folders_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: content_reports content_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_reports
    ADD CONSTRAINT content_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: conversation_participants conversation_participants_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: conversation_participants conversation_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.conversation_participants
    ADD CONSTRAINT conversation_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: correo_textos correo_textos_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.correo_textos
    ADD CONSTRAINT correo_textos_por_fkey FOREIGN KEY (por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: course_attempts course_attempts_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_attempts
    ADD CONSTRAINT course_attempts_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: course_attempts course_attempts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_attempts
    ADD CONSTRAINT course_attempts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: course_review_queue course_review_queue_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_review_queue
    ADD CONSTRAINT course_review_queue_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: course_review_queue course_review_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_review_queue
    ADD CONSTRAINT course_review_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: daily_challenge_results daily_challenge_results_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_challenge_results
    ADD CONSTRAINT daily_challenge_results_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: email_outbox email_outbox_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_outbox
    ADD CONSTRAINT email_outbox_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: evento_asistentes evento_asistentes_evento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_asistentes
    ADD CONSTRAINT evento_asistentes_evento_id_fkey FOREIGN KEY (evento_id) REFERENCES public.eventos(id) ON DELETE CASCADE;

--
-- Name: evento_asistentes evento_asistentes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.evento_asistentes
    ADD CONSTRAINT evento_asistentes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: eventos eventos_creado_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_creado_por_fkey FOREIGN KEY (creado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: eventos eventos_hilo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.eventos
    ADD CONSTRAINT eventos_hilo_id_fkey FOREIGN KEY (hilo_id) REFERENCES public.forum_threads(id) ON DELETE SET NULL;

--
-- Name: forum_boards forum_boards_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_boards
    ADD CONSTRAINT forum_boards_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.forum_boards(id) ON DELETE CASCADE;

--
-- Name: forum_boards forum_boards_section_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_boards
    ADD CONSTRAINT forum_boards_section_id_fkey FOREIGN KEY (section_id) REFERENCES public.forum_sections(id) ON DELETE CASCADE;

--
-- Name: forum_poll_options forum_poll_options_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_poll_options
    ADD CONSTRAINT forum_poll_options_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.forum_polls(thread_id) ON DELETE CASCADE;

--
-- Name: forum_poll_votes forum_poll_votes_encuesta_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_poll_votes
    ADD CONSTRAINT forum_poll_votes_encuesta_fk FOREIGN KEY (thread_id, multiple) REFERENCES public.forum_polls(thread_id, multiple) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: forum_poll_votes forum_poll_votes_option_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_poll_votes
    ADD CONSTRAINT forum_poll_votes_option_id_fkey FOREIGN KEY (option_id) REFERENCES public.forum_poll_options(id) ON DELETE CASCADE;

--
-- Name: forum_poll_votes forum_poll_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_poll_votes
    ADD CONSTRAINT forum_poll_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: forum_polls forum_polls_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_polls
    ADD CONSTRAINT forum_polls_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.forum_threads(id) ON DELETE CASCADE;

--
-- Name: forum_post_likes forum_post_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_post_likes
    ADD CONSTRAINT forum_post_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forum_posts(id) ON DELETE CASCADE;

--
-- Name: forum_post_likes forum_post_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_post_likes
    ADD CONSTRAINT forum_post_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: forum_post_reactions forum_post_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_post_reactions
    ADD CONSTRAINT forum_post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.forum_posts(id) ON DELETE CASCADE;

--
-- Name: forum_post_reactions forum_post_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_post_reactions
    ADD CONSTRAINT forum_post_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: forum_posts forum_posts_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_posts
    ADD CONSTRAINT forum_posts_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: forum_posts forum_posts_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_posts
    ADD CONSTRAINT forum_posts_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.forum_posts(id) ON DELETE SET NULL;

--
-- Name: forum_posts forum_posts_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_posts
    ADD CONSTRAINT forum_posts_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.forum_threads(id) ON DELETE CASCADE;

--
-- Name: forum_solucion_xp forum_solucion_xp_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_solucion_xp
    ADD CONSTRAINT forum_solucion_xp_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.forum_threads(id) ON DELETE CASCADE;

--
-- Name: forum_subscriptions forum_subscriptions_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_subscriptions
    ADD CONSTRAINT forum_subscriptions_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.forum_threads(id) ON DELETE CASCADE;

--
-- Name: forum_subscriptions forum_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_subscriptions
    ADD CONSTRAINT forum_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: forum_thread_reads forum_thread_reads_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_thread_reads
    ADD CONSTRAINT forum_thread_reads_thread_id_fkey FOREIGN KEY (thread_id) REFERENCES public.forum_threads(id) ON DELETE CASCADE;

--
-- Name: forum_thread_reads forum_thread_reads_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_thread_reads
    ADD CONSTRAINT forum_thread_reads_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: forum_threads forum_threads_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_threads
    ADD CONSTRAINT forum_threads_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: forum_threads forum_threads_board_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_threads
    ADD CONSTRAINT forum_threads_board_id_fkey FOREIGN KEY (board_id) REFERENCES public.forum_boards(id) ON DELETE CASCADE;

--
-- Name: forum_threads forum_threads_last_post_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_threads
    ADD CONSTRAINT forum_threads_last_post_author_id_fkey FOREIGN KEY (last_post_author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: forum_threads forum_threads_solved_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.forum_threads
    ADD CONSTRAINT forum_threads_solved_post_id_fkey FOREIGN KEY (solved_post_id) REFERENCES public.forum_posts(id) ON DELETE SET NULL;

--
-- Name: guide_collections guide_collections_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_collections
    ADD CONSTRAINT guide_collections_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);

--
-- Name: guide_comments guide_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_comments
    ADD CONSTRAINT guide_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: guide_comments guide_comments_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_comments
    ADD CONSTRAINT guide_comments_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: guide_comments guide_comments_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_comments
    ADD CONSTRAINT guide_comments_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.guide_comments(id) ON DELETE SET NULL;

--
-- Name: guide_helpful guide_helpful_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_helpful
    ADD CONSTRAINT guide_helpful_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: guide_helpful guide_helpful_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_helpful
    ADD CONSTRAINT guide_helpful_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: guide_pro_content guide_pro_content_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_pro_content
    ADD CONSTRAINT guide_pro_content_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: guide_request_votes guide_request_votes_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_request_votes
    ADD CONSTRAINT guide_request_votes_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.guide_requests(id) ON DELETE CASCADE;

--
-- Name: guide_request_votes guide_request_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_request_votes
    ADD CONSTRAINT guide_request_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: guide_requests guide_requests_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_requests
    ADD CONSTRAINT guide_requests_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;

--
-- Name: guide_requests guide_requests_fulfilled_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_requests
    ADD CONSTRAINT guide_requests_fulfilled_guide_id_fkey FOREIGN KEY (fulfilled_guide_id) REFERENCES public.guides(id) ON DELETE SET NULL;

--
-- Name: guide_requests guide_requests_requester_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_requests
    ADD CONSTRAINT guide_requests_requester_id_fkey FOREIGN KEY (requester_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: guide_reviews guide_reviews_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_reviews
    ADD CONSTRAINT guide_reviews_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: guide_reviews guide_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_reviews
    ADD CONSTRAINT guide_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: guide_routes guide_routes_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_routes
    ADD CONSTRAINT guide_routes_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: guide_routes guide_routes_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_routes
    ADD CONSTRAINT guide_routes_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.learning_paths(id) ON DELETE CASCADE;

--
-- Name: guide_suggestions guide_suggestions_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_suggestions
    ADD CONSTRAINT guide_suggestions_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: guide_suggestions guide_suggestions_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guide_suggestions
    ADD CONSTRAINT guide_suggestions_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: guides guides_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: guides guides_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id);

--
-- Name: guides guides_collection_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_collection_id_fkey FOREIGN KEY (collection_id) REFERENCES public.guide_collections(id);

--
-- Name: guides guides_forum_thread_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.guides
    ADD CONSTRAINT guides_forum_thread_id_fkey FOREIGN KEY (forum_thread_id) REFERENCES public.forum_threads(id) ON DELETE SET NULL;

--
-- Name: judge_applications judge_applications_decided_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_applications
    ADD CONSTRAINT judge_applications_decided_by_fkey FOREIGN KEY (decided_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

--
-- Name: judge_applications judge_applications_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_applications
    ADD CONSTRAINT judge_applications_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: judge_applications judge_applications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_applications
    ADD CONSTRAINT judge_applications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: judge_calls judge_calls_assigned_judge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_calls
    ADD CONSTRAINT judge_calls_assigned_judge_id_fkey FOREIGN KEY (assigned_judge_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

--
-- Name: judge_calls judge_calls_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_calls
    ADD CONSTRAINT judge_calls_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: judge_calls judge_calls_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_calls
    ADD CONSTRAINT judge_calls_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE;

--
-- Name: judge_calls judge_calls_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_calls
    ADD CONSTRAINT judge_calls_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: judge_messages judge_messages_judge_call_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_messages
    ADD CONSTRAINT judge_messages_judge_call_id_fkey FOREIGN KEY (judge_call_id) REFERENCES public.judge_calls(id) ON DELETE CASCADE;

--
-- Name: judge_messages judge_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.judge_messages
    ADD CONSTRAINT judge_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: logros_a_mano logros_a_mano_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logros_a_mano
    ADD CONSTRAINT logros_a_mano_por_fkey FOREIGN KEY (por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: logros_a_mano logros_a_mano_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.logros_a_mano
    ADD CONSTRAINT logros_a_mano_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: match_log_ajustes match_log_ajustes_user_deck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log_ajustes
    ADD CONSTRAINT match_log_ajustes_user_deck_id_fkey FOREIGN KEY (user_deck_id) REFERENCES public.user_decks(id) ON DELETE SET NULL;

--
-- Name: match_log_ajustes match_log_ajustes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log_ajustes
    ADD CONSTRAINT match_log_ajustes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: match_log match_log_replay_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log
    ADD CONSTRAINT match_log_replay_id_fkey FOREIGN KEY (replay_id) REFERENCES public.replays(id) ON DELETE SET NULL;

--
-- Name: match_log match_log_torneo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log
    ADD CONSTRAINT match_log_torneo_id_fkey FOREIGN KEY (torneo_id) REFERENCES public.match_log_torneos(id) ON DELETE CASCADE;

--
-- Name: match_log_torneos match_log_torneos_user_deck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log_torneos
    ADD CONSTRAINT match_log_torneos_user_deck_id_fkey FOREIGN KEY (user_deck_id) REFERENCES public.user_decks(id) ON DELETE SET NULL;

--
-- Name: match_log_torneos match_log_torneos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log_torneos
    ADD CONSTRAINT match_log_torneos_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: match_log match_log_user_deck_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log
    ADD CONSTRAINT match_log_user_deck_id_fkey FOREIGN KEY (user_deck_id) REFERENCES public.user_decks(id) ON DELETE SET NULL;

--
-- Name: match_log match_log_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_log
    ADD CONSTRAINT match_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: match_messages match_messages_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_messages
    ADD CONSTRAINT match_messages_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE;

--
-- Name: match_messages match_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_messages
    ADD CONSTRAINT match_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: match_reports match_reports_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_reports
    ADD CONSTRAINT match_reports_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE;

--
-- Name: match_reports match_reports_reporter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_reports
    ADD CONSTRAINT match_reports_reporter_id_fkey FOREIGN KEY (reporter_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: match_results match_results_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE;

--
-- Name: match_results match_results_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

--
-- Name: match_results match_results_winner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_results
    ADD CONSTRAINT match_results_winner_id_fkey FOREIGN KEY (winner_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

--
-- Name: meta_guias meta_guias_added_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_guias
    ADD CONSTRAINT meta_guias_added_by_fkey FOREIGN KEY (added_by) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: meta_guias meta_guias_arquetipo_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_guias
    ADD CONSTRAINT meta_guias_arquetipo_fkey FOREIGN KEY (arquetipo) REFERENCES public.meta_arquetipos(id) ON DELETE CASCADE;

--
-- Name: meta_guias meta_guias_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_guias
    ADD CONSTRAINT meta_guias_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: meta_resultados meta_resultados_torneo_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meta_resultados
    ADD CONSTRAINT meta_resultados_torneo_id_fkey FOREIGN KEY (torneo_id) REFERENCES public.meta_torneos(id) ON DELETE CASCADE;

--
-- Name: moderaciones moderaciones_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderaciones
    ADD CONSTRAINT moderaciones_por_fkey FOREIGN KEY (por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: moderaciones moderaciones_quitada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderaciones
    ADD CONSTRAINT moderaciones_quitada_por_fkey FOREIGN KEY (quitada_por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: moderaciones moderaciones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.moderaciones
    ADD CONSTRAINT moderaciones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: online_now online_now_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.online_now
    ADD CONSTRAINT online_now_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: page_views page_views_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.page_views
    ADD CONSTRAINT page_views_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: pairing_history pairing_history_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairing_history
    ADD CONSTRAINT pairing_history_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;

--
-- Name: pairing_history pairing_history_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pairing_history
    ADD CONSTRAINT pairing_history_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: private_message_reactions private_message_reactions_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_message_reactions
    ADD CONSTRAINT private_message_reactions_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: private_message_reactions private_message_reactions_message_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_message_reactions
    ADD CONSTRAINT private_message_reactions_message_id_fkey FOREIGN KEY (message_id) REFERENCES public.private_messages(id) ON DELETE CASCADE;

--
-- Name: private_message_reactions private_message_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_message_reactions
    ADD CONSTRAINT private_message_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: private_messages private_messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_messages
    ADD CONSTRAINT private_messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;

--
-- Name: private_messages private_messages_reply_to_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_messages
    ADD CONSTRAINT private_messages_reply_to_id_fkey FOREIGN KEY (reply_to_id) REFERENCES public.private_messages(id) ON DELETE SET NULL;

--
-- Name: private_messages private_messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.private_messages
    ADD CONSTRAINT private_messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: profile_reviews profile_reviews_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_reviews
    ADD CONSTRAINT profile_reviews_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: profile_reviews profile_reviews_reviewer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profile_reviews
    ADD CONSTRAINT profile_reviews_reviewer_id_fkey FOREIGN KEY (reviewer_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: push_subscriptions push_subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: question_stats question_stats_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.question_stats
    ADD CONSTRAINT question_stats_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: replay_puzzle_answers replay_puzzle_answers_puzzle_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_puzzle_answers
    ADD CONSTRAINT replay_puzzle_answers_puzzle_id_fkey FOREIGN KEY (puzzle_id) REFERENCES public.replay_puzzles(id) ON DELETE CASCADE;

--
-- Name: replay_puzzle_answers replay_puzzle_answers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_puzzle_answers
    ADD CONSTRAINT replay_puzzle_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: replay_puzzles replay_puzzles_replay_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_puzzles
    ADD CONSTRAINT replay_puzzles_replay_id_fkey FOREIGN KEY (replay_id) REFERENCES public.replays(id) ON DELETE CASCADE;

--
-- Name: replay_puzzles replay_puzzles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replay_puzzles
    ADD CONSTRAINT replay_puzzles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: replays replays_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.replays
    ADD CONSTRAINT replays_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: retos_bonos retos_bonos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retos_bonos
    ADD CONSTRAINT retos_bonos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: retos_partidas retos_partidas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retos_partidas
    ADD CONSTRAINT retos_partidas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: retos_resultados retos_resultados_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.retos_resultados
    ADD CONSTRAINT retos_resultados_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: rounds rounds_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.rounds
    ADD CONSTRAINT rounds_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: tcg_cards tcg_cards_set_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_cards
    ADD CONSTRAINT tcg_cards_set_fk FOREIGN KEY (set_id, market) REFERENCES public.tcg_sets(id, market) ON UPDATE CASCADE ON DELETE CASCADE;

--
-- Name: tcg_product_contenido tcg_product_contenido_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_product_contenido
    ADD CONSTRAINT tcg_product_contenido_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.tcg_products(id) ON DELETE CASCADE;

--
-- Name: tcg_product_history tcg_product_history_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tcg_product_history
    ADD CONSTRAINT tcg_product_history_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.tcg_products(id) ON DELETE CASCADE;

--
-- Name: tienda_avisos tienda_avisos_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_avisos
    ADD CONSTRAINT tienda_avisos_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_avisos tienda_avisos_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_avisos
    ADD CONSTRAINT tienda_avisos_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_cambios tienda_cambios_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_cambios
    ADD CONSTRAINT tienda_cambios_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_cobros tienda_cobros_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_cobros
    ADD CONSTRAINT tienda_cobros_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_compras tienda_compras_de_lote_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_compras
    ADD CONSTRAINT tienda_compras_de_lote_fkey FOREIGN KEY (de_lote) REFERENCES public.tienda_lotes(id) ON DELETE SET NULL;

--
-- Name: tienda_compras tienda_compras_lote_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_compras
    ADD CONSTRAINT tienda_compras_lote_id_fkey FOREIGN KEY (lote_id) REFERENCES public.tienda_lotes(id) ON DELETE CASCADE;

--
-- Name: tienda_compras tienda_compras_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_compras
    ADD CONSTRAINT tienda_compras_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.tienda_stock(id) ON DELETE SET NULL;

--
-- Name: tienda_compras tienda_compras_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_compras
    ADD CONSTRAINT tienda_compras_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_fotos_pedidas tienda_fotos_pedidas_comprador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_fotos_pedidas
    ADD CONSTRAINT tienda_fotos_pedidas_comprador_id_fkey FOREIGN KEY (comprador_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_fotos_pedidas tienda_fotos_pedidas_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_fotos_pedidas
    ADD CONSTRAINT tienda_fotos_pedidas_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.tienda_stock(id) ON DELETE CASCADE;

--
-- Name: tienda_fotos_pedidas tienda_fotos_pedidas_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_fotos_pedidas
    ADD CONSTRAINT tienda_fotos_pedidas_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_lotes tienda_lotes_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_lotes
    ADD CONSTRAINT tienda_lotes_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_ofertas tienda_ofertas_comprador_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_ofertas
    ADD CONSTRAINT tienda_ofertas_comprador_id_fkey FOREIGN KEY (comprador_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_ofertas tienda_ofertas_reserva_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_ofertas
    ADD CONSTRAINT tienda_ofertas_reserva_id_fkey FOREIGN KEY (reserva_id) REFERENCES public.tienda_reservas(id) ON DELETE SET NULL;

--
-- Name: tienda_ofertas tienda_ofertas_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_ofertas
    ADD CONSTRAINT tienda_ofertas_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.tienda_stock(id) ON DELETE SET NULL;

--
-- Name: tienda_ofertas tienda_ofertas_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_ofertas
    ADD CONSTRAINT tienda_ofertas_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_reservas tienda_reservas_para_usuario_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_reservas
    ADD CONSTRAINT tienda_reservas_para_usuario_fkey FOREIGN KEY (para_usuario) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: tienda_reservas tienda_reservas_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_reservas
    ADD CONSTRAINT tienda_reservas_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.tienda_stock(id) ON DELETE CASCADE;

--
-- Name: tienda_reservas tienda_reservas_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_reservas
    ADD CONSTRAINT tienda_reservas_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_solicitudes tienda_solicitudes_decidio_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_solicitudes
    ADD CONSTRAINT tienda_solicitudes_decidio_fkey FOREIGN KEY (decidio) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: tienda_solicitudes tienda_solicitudes_usada_por_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_solicitudes
    ADD CONSTRAINT tienda_solicitudes_usada_por_fkey FOREIGN KEY (usada_por) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: tienda_stock_fotos tienda_stock_fotos_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_stock_fotos
    ADD CONSTRAINT tienda_stock_fotos_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.tienda_stock(id) ON DELETE CASCADE;

--
-- Name: tienda_stock_fotos tienda_stock_fotos_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_stock_fotos
    ADD CONSTRAINT tienda_stock_fotos_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_stock tienda_stock_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_stock
    ADD CONSTRAINT tienda_stock_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_valor_diario tienda_valor_diario_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_valor_diario
    ADD CONSTRAINT tienda_valor_diario_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_ventas tienda_ventas_stock_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_ventas
    ADD CONSTRAINT tienda_ventas_stock_id_fkey FOREIGN KEY (stock_id) REFERENCES public.tienda_stock(id) ON DELETE SET NULL;

--
-- Name: tienda_ventas tienda_ventas_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_ventas
    ADD CONSTRAINT tienda_ventas_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_visitas tienda_visitas_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_visitas
    ADD CONSTRAINT tienda_visitas_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tienda_vistas tienda_vistas_tienda_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tienda_vistas
    ADD CONSTRAINT tienda_vistas_tienda_id_fkey FOREIGN KEY (tienda_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tiendas tiendas_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tiendas
    ADD CONSTRAINT tiendas_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tournament_decklists tournament_decklists_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_decklists
    ADD CONSTRAINT tournament_decklists_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: tournament_decklists tournament_decklists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_decklists
    ADD CONSTRAINT tournament_decklists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: tournament_join_codes tournament_join_codes_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_join_codes
    ADD CONSTRAINT tournament_join_codes_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: tournament_match_replays tournament_match_replays_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_match_replays
    ADD CONSTRAINT tournament_match_replays_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tournament_matches(id) ON DELETE CASCADE;

--
-- Name: tournament_match_replays tournament_match_replays_replay_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_match_replays
    ADD CONSTRAINT tournament_match_replays_replay_id_fkey FOREIGN KEY (replay_id) REFERENCES public.replays(id) ON DELETE CASCADE;

--
-- Name: tournament_match_replays tournament_match_replays_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_match_replays
    ADD CONSTRAINT tournament_match_replays_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: tournament_matchday_avisos tournament_matchday_avisos_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matchday_avisos
    ADD CONSTRAINT tournament_matchday_avisos_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: tournament_matchday_closures tournament_matchday_closures_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matchday_closures
    ADD CONSTRAINT tournament_matchday_closures_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: tournament_matchday_decklists tournament_matchday_decklists_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matchday_decklists
    ADD CONSTRAINT tournament_matchday_decklists_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: tournament_matchday_decklists tournament_matchday_decklists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matchday_decklists
    ADD CONSTRAINT tournament_matchday_decklists_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: tournament_matches tournament_matches_player_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_player_a_id_fkey FOREIGN KEY (player_a_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: tournament_matches tournament_matches_player_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_player_b_id_fkey FOREIGN KEY (player_b_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: tournament_matches tournament_matches_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_matches
    ADD CONSTRAINT tournament_matches_round_id_fkey FOREIGN KEY (round_id) REFERENCES public.rounds(id) ON DELETE CASCADE;

--
-- Name: tournament_prize_deliveries tournament_prize_deliveries_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_prize_deliveries
    ADD CONSTRAINT tournament_prize_deliveries_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: tournament_registrations tournament_registrations_dropped_after_round_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_registrations
    ADD CONSTRAINT tournament_registrations_dropped_after_round_id_fkey FOREIGN KEY (dropped_after_round_id) REFERENCES public.rounds(id) ON DELETE SET NULL;

--
-- Name: tournament_registrations tournament_registrations_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_registrations
    ADD CONSTRAINT tournament_registrations_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: tournament_registrations tournament_registrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_registrations
    ADD CONSTRAINT tournament_registrations_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: tournament_updates tournament_updates_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_updates
    ADD CONSTRAINT tournament_updates_author_id_fkey FOREIGN KEY (author_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: tournament_updates tournament_updates_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_updates
    ADD CONSTRAINT tournament_updates_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: tournament_xp_awards tournament_xp_awards_tournament_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_xp_awards
    ADD CONSTRAINT tournament_xp_awards_tournament_id_fkey FOREIGN KEY (tournament_id) REFERENCES public.tournaments(id) ON DELETE CASCADE;

--
-- Name: tournament_xp_awards tournament_xp_awards_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournament_xp_awards
    ADD CONSTRAINT tournament_xp_awards_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: tournaments tournaments_admin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_admin_id_fkey FOREIGN KEY (admin_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: tournaments tournaments_champion_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_champion_id_fkey FOREIGN KEY (champion_id) REFERENCES public.user_profiles(id) ON DELETE SET NULL;

--
-- Name: tournaments tournaments_current_round_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tournaments
    ADD CONSTRAINT tournaments_current_round_fk FOREIGN KEY (current_round_id) REFERENCES public.rounds(id) ON DELETE SET NULL;

--
-- Name: trade_confirmations trade_confirmations_user_a_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_confirmations
    ADD CONSTRAINT trade_confirmations_user_a_fkey FOREIGN KEY (user_a) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: trade_confirmations trade_confirmations_user_b_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_confirmations
    ADD CONSTRAINT trade_confirmations_user_b_fkey FOREIGN KEY (user_b) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: trade_offer_cobros trade_offer_cobros_oferta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offer_cobros
    ADD CONSTRAINT trade_offer_cobros_oferta_fkey FOREIGN KEY (oferta) REFERENCES public.trade_offers(id) ON DELETE CASCADE;

--
-- Name: trade_offer_cobros trade_offer_cobros_quien_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offer_cobros
    ADD CONSTRAINT trade_offer_cobros_quien_fkey FOREIGN KEY (quien) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: trade_offer_direcciones trade_offer_direcciones_oferta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offer_direcciones
    ADD CONSTRAINT trade_offer_direcciones_oferta_fkey FOREIGN KEY (oferta) REFERENCES public.trade_offers(id) ON DELETE CASCADE;

--
-- Name: trade_offer_direcciones trade_offer_direcciones_quien_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offer_direcciones
    ADD CONSTRAINT trade_offer_direcciones_quien_fkey FOREIGN KEY (quien) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: trade_offer_items trade_offer_items_oferta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offer_items
    ADD CONSTRAINT trade_offer_items_oferta_fkey FOREIGN KEY (oferta) REFERENCES public.trade_offers(id) ON DELETE CASCADE;

--
-- Name: trade_offer_items trade_offer_items_quien_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offer_items
    ADD CONSTRAINT trade_offer_items_quien_fkey FOREIGN KEY (quien) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: trade_offers trade_offers_anterior_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offers
    ADD CONSTRAINT trade_offers_anterior_fkey FOREIGN KEY (anterior) REFERENCES public.trade_offers(id) ON DELETE SET NULL;

--
-- Name: trade_offers trade_offers_de_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offers
    ADD CONSTRAINT trade_offers_de_fkey FOREIGN KEY (de) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: trade_offers trade_offers_para_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.trade_offers
    ADD CONSTRAINT trade_offers_para_fkey FOREIGN KEY (para) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_albums user_albums_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_albums
    ADD CONSTRAINT user_albums_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_cobros user_cobros_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cobros
    ADD CONSTRAINT user_cobros_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_collection user_collection_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_collection
    ADD CONSTRAINT user_collection_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_collection_value user_collection_value_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_collection_value
    ADD CONSTRAINT user_collection_value_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_cumple user_cumple_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cumple
    ADD CONSTRAINT user_cumple_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: user_decks user_decks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_decks
    ADD CONSTRAINT user_decks_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_direcciones user_direcciones_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_direcciones
    ADD CONSTRAINT user_direcciones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_follows user_follows_follower_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_follower_id_fkey FOREIGN KEY (follower_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_follows user_follows_following_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_follows
    ADD CONSTRAINT user_follows_following_id_fkey FOREIGN KEY (following_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_notifications user_notifications_recipient_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_notifications
    ADD CONSTRAINT user_notifications_recipient_id_fkey FOREIGN KEY (recipient_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_play_pokemon user_play_pokemon_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_play_pokemon
    ADD CONSTRAINT user_play_pokemon_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: user_price_alerts user_price_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_price_alerts
    ADD CONSTRAINT user_price_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: user_privado user_privado_referred_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_privado
    ADD CONSTRAINT user_privado_referred_by_fkey FOREIGN KEY (referred_by) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: user_privado user_privado_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_privado
    ADD CONSTRAINT user_privado_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: user_products user_products_product_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_products
    ADD CONSTRAINT user_products_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.tcg_products(id) ON DELETE CASCADE;

--
-- Name: user_products user_products_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_products
    ADD CONSTRAINT user_products_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_profiles user_profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_progress user_progress_guide_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_guide_id_fkey FOREIGN KEY (guide_id) REFERENCES public.guides(id) ON DELETE CASCADE;

--
-- Name: user_progress user_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_progress
    ADD CONSTRAINT user_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: user_release_alerts user_release_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_release_alerts
    ADD CONSTRAINT user_release_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: user_showcase user_showcase_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_showcase
    ADD CONSTRAINT user_showcase_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;

--
-- Name: user_want_list_items user_want_list_items_list_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_want_list_items
    ADD CONSTRAINT user_want_list_items_list_id_fkey FOREIGN KEY (list_id) REFERENCES public.user_want_lists(id) ON DELETE CASCADE;

--
-- Name: user_want_list_items user_want_list_items_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_want_list_items
    ADD CONSTRAINT user_want_list_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_want_lists user_want_lists_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_want_lists
    ADD CONSTRAINT user_want_lists_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: user_wants user_wants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_wants
    ADD CONSTRAINT user_wants_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: xp_mes xp_mes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_mes
    ADD CONSTRAINT xp_mes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: account_deletion_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: account_deletion_requests account_deletion_requests_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_deletion_requests_admin_select ON public.account_deletion_requests FOR SELECT USING (public.is_admin());

--
-- Name: account_deletion_requests account_deletion_requests_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_deletion_requests_admin_update ON public.account_deletion_requests FOR UPDATE USING (public.is_admin());

--
-- Name: account_deletion_requests account_deletion_requests_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_deletion_requests_insert_own ON public.account_deletion_requests FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: account_deletion_requests account_deletion_requests_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY account_deletion_requests_select_own ON public.account_deletion_requests FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: adviento_casillas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adviento_casillas ENABLE ROW LEVEL SECURITY;

--
-- Name: adviento_casillas adviento_ver_las_mias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY adviento_ver_las_mias ON public.adviento_casillas FOR SELECT TO authenticated USING ((user_id = auth.uid()));

--
-- Name: match_log_ajustes ajustes_partidas_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ajustes_partidas_borrar ON public.match_log_ajustes FOR DELETE TO authenticated USING ((user_id = auth.uid()));

--
-- Name: match_log_ajustes ajustes_partidas_cambiar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ajustes_partidas_cambiar ON public.match_log_ajustes FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: match_log_ajustes ajustes_partidas_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ajustes_partidas_crear ON public.match_log_ajustes FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

--
-- Name: match_log_ajustes ajustes_partidas_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ajustes_partidas_ver ON public.match_log_ajustes FOR SELECT TO authenticated USING ((user_id = auth.uid()));

--
-- Name: app_feedback; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

--
-- Name: app_feedback app_feedback_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_feedback_admin_select ON public.app_feedback FOR SELECT USING (public.is_admin());

--
-- Name: app_feedback app_feedback_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_feedback_admin_update ON public.app_feedback FOR UPDATE USING (public.is_admin());

--
-- Name: app_feedback app_feedback_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY app_feedback_insert_own ON public.app_feedback FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: tcg_archetypes arquetipos_escribir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY arquetipos_escribir ON public.tcg_archetypes USING ((EXISTS ( SELECT 1
   FROM public.user_profiles p
  WHERE ((p.id = auth.uid()) AND p.is_admin)))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles p
  WHERE ((p.id = auth.uid()) AND p.is_admin))));

--
-- Name: tcg_archetypes arquetipos_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY arquetipos_leer ON public.tcg_archetypes FOR SELECT USING (true);

--
-- Name: aviso_cifras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aviso_cifras ENABLE ROW LEVEL SECURITY;

--
-- Name: aviso_cifras aviso_cifras_equipo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aviso_cifras_equipo ON public.aviso_cifras FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: aviso_participantes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.aviso_participantes ENABLE ROW LEVEL SECURITY;

--
-- Name: aviso_participantes aviso_participantes_mia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY aviso_participantes_mia ON public.aviso_participantes FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.is_admin()));

--
-- Name: avisos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.avisos ENABLE ROW LEVEL SECURITY;

--
-- Name: avisos avisos_en_marcha; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avisos_en_marcha ON public.avisos FOR SELECT TO anon, authenticated USING ((publicado AND ((desde IS NULL) OR (desde <= now())) AND ((hasta IS NULL) OR (hasta > now()))));

--
-- Name: avisos_enviados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.avisos_enviados ENABLE ROW LEVEL SECURITY;

--
-- Name: avisos_enviados avisos_enviados_lectura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avisos_enviados_lectura ON public.avisos_enviados FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: avisos avisos_equipo_borra; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avisos_equipo_borra ON public.avisos FOR DELETE TO authenticated USING (public.is_admin());

--
-- Name: avisos avisos_equipo_cambia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avisos_equipo_cambia ON public.avisos FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: avisos avisos_equipo_crea; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avisos_equipo_crea ON public.avisos FOR INSERT TO authenticated WITH CHECK (public.is_admin());

--
-- Name: avisos avisos_equipo_lee; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY avisos_equipo_lee ON public.avisos FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: busquedas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.busquedas ENABLE ROW LEVEL SECURITY;

--
-- Name: busquedas busquedas_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY busquedas_admin_select ON public.busquedas FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: busquedas busquedas_insert_anyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY busquedas_insert_anyone ON public.busquedas FOR INSERT TO anon, authenticated WITH CHECK (true);

--
-- Name: calendario_claves; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.calendario_claves ENABLE ROW LEVEL SECURITY;

--
-- Name: carta_del_dia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.carta_del_dia ENABLE ROW LEVEL SECURITY;

--
-- Name: client_errors; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

--
-- Name: client_errors client_errors_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_errors_admin_select ON public.client_errors FOR SELECT USING (public.is_admin());

--
-- Name: client_errors client_errors_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_errors_admin_update ON public.client_errors FOR UPDATE USING (public.is_admin());

--
-- Name: client_errors client_errors_insert_anyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY client_errors_insert_anyone ON public.client_errors FOR INSERT WITH CHECK (true);

--
-- Name: tournament_join_codes codigos_mando; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY codigos_mando ON public.tournament_join_codes USING (public.torneos_mando(tournament_id)) WITH CHECK (public.torneos_mando(tournament_id));

--
-- Name: collab_applications collab_admin_tocar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collab_admin_tocar ON public.collab_applications FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: collab_applications collab_admin_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collab_admin_ver ON public.collab_applications FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: collab_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collab_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: collab_applications collab_insert_propia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collab_insert_propia ON public.collab_applications FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

--
-- Name: collab_applications collab_ver_propia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collab_ver_propia ON public.collab_applications FOR SELECT TO authenticated USING ((auth.uid() = user_id));

--
-- Name: collection_favorite_sets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collection_favorite_sets ENABLE ROW LEVEL SECURITY;

--
-- Name: collection_folder_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collection_folder_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: collection_folder_cards collection_folder_cards_mias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collection_folder_cards_mias ON public.collection_folder_cards USING ((EXISTS ( SELECT 1
   FROM public.collection_folders f
  WHERE ((f.id = collection_folder_cards.folder_id) AND (f.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.collection_folders f
  WHERE ((f.id = collection_folder_cards.folder_id) AND (f.user_id = auth.uid())))));

--
-- Name: collection_folders; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.collection_folders ENABLE ROW LEVEL SECURITY;

--
-- Name: collection_folders collection_folders_mias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY collection_folders_mias ON public.collection_folders USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: content_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: content_reports content_reports_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_reports_admin_select ON public.content_reports FOR SELECT USING (public.is_admin());

--
-- Name: content_reports content_reports_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_reports_admin_update ON public.content_reports FOR UPDATE USING (public.is_admin());

--
-- Name: content_reports content_reports_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_reports_insert_own ON public.content_reports FOR INSERT WITH CHECK ((auth.uid() = reporter_id));

--
-- Name: conversation_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: conversation_participants conversation_participants_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_participants_insert ON public.conversation_participants FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) OR public.is_conversation_participant(conversation_id)));

--
-- Name: conversation_participants conversation_participants_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_participants_select ON public.conversation_participants FOR SELECT USING (public.is_conversation_participant(conversation_id));

--
-- Name: conversation_participants conversation_participants_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversation_participants_update ON public.conversation_participants FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: conversations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

--
-- Name: conversations conversations_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_insert ON public.conversations FOR INSERT TO authenticated WITH CHECK (true);

--
-- Name: conversations conversations_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY conversations_select ON public.conversations FOR SELECT USING (public.is_conversation_participant(id));

--
-- Name: tcg_correcciones correcciones_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY correcciones_leer ON public.tcg_correcciones FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: correo_textos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.correo_textos ENABLE ROW LEVEL SECURITY;

--
-- Name: correo_textos correo_textos_equipo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY correo_textos_equipo ON public.correo_textos TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: course_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: course_attempts course_attempts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_attempts_insert ON public.course_attempts FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: course_attempts course_attempts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_attempts_select ON public.course_attempts FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.user_profiles p
  WHERE ((p.id = course_attempts.user_id) AND (COALESCE(p.hide_activity, false) = false))))));

--
-- Name: course_review_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.course_review_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: course_review_queue course_review_queue_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY course_review_queue_own ON public.course_review_queue USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: daily_challenge_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.daily_challenge_results ENABLE ROW LEVEL SECURITY;

--
-- Name: daily_challenge_results daily_challenge_results_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_challenge_results_insert ON public.daily_challenge_results FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: daily_challenge_results daily_challenge_results_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY daily_challenge_results_select ON public.daily_challenge_results FOR SELECT USING (((auth.uid() = user_id) OR (EXISTS ( SELECT 1
   FROM public.user_profiles p
  WHERE ((p.id = daily_challenge_results.user_id) AND (COALESCE(p.hide_activity, false) = false))))));

--
-- Name: tournament_decklists decklists_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY decklists_crear ON public.tournament_decklists FOR INSERT WITH CHECK ((user_id = auth.uid()));

--
-- Name: tournament_decklists decklists_editar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY decklists_editar ON public.tournament_decklists FOR UPDATE USING ((((user_id = auth.uid()) AND (locked_at IS NULL)) OR public.torneos_mando(tournament_id))) WITH CHECK (((user_id = auth.uid()) OR public.torneos_mando(tournament_id)));

--
-- Name: tournament_decklists decklists_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY decklists_ver ON public.tournament_decklists FOR SELECT USING (((user_id = auth.uid()) OR public.torneos_mando(tournament_id) OR public.torneos_soy_juez(tournament_id) OR (EXISTS ( SELECT 1
   FROM public.tournaments t
  WHERE ((t.id = tournament_decklists.tournament_id) AND (COALESCE(t.decklist_visibility, 'al_terminar'::text) <> 'nunca'::text) AND ((t.status = 'finished'::text) OR ((COALESCE(t.decklist_visibility, 'al_terminar'::text) = 'en_juego'::text) AND (t.status = 'in_progress'::text))))))));

--
-- Name: email_outbox; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

--
-- Name: enlaces_cortos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enlaces_cortos ENABLE ROW LEVEL SECURITY;

--
-- Name: enlaces_rotos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.enlaces_rotos ENABLE ROW LEVEL SECURITY;

--
-- Name: enlaces_rotos enlaces_rotos_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enlaces_rotos_admin_select ON public.enlaces_rotos FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: enlaces_rotos enlaces_rotos_insert_anyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY enlaces_rotos_insert_anyone ON public.enlaces_rotos FOR INSERT TO anon, authenticated WITH CHECK (true);

--
-- Name: evento_asistentes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.evento_asistentes ENABLE ROW LEVEL SECURITY;

--
-- Name: evento_asistentes evento_asistentes_mias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY evento_asistentes_mias ON public.evento_asistentes FOR SELECT TO authenticated USING ((user_id = auth.uid()));

--
-- Name: eventos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

--
-- Name: eventos eventos_equipo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY eventos_equipo ON public.eventos TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: eventos eventos_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY eventos_ver ON public.eventos FOR SELECT TO anon, authenticated USING (publicado);

--
-- Name: collection_favorite_sets favoritos propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "favoritos propios" ON public.collection_favorite_sets USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: forum_boards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_boards ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_boards forum_boards_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_boards_select ON public.forum_boards FOR SELECT USING (((NOT is_hidden) OR public.is_admin()));

--
-- Name: forum_boards forum_boards_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_boards_write ON public.forum_boards USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: forum_poll_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_poll_options ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_poll_options forum_poll_options_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_poll_options_insert ON public.forum_poll_options FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.forum_threads t
  WHERE ((t.id = forum_poll_options.thread_id) AND (t.author_id = auth.uid()) AND (t.created_at > (now() - '00:05:00'::interval))))));

--
-- Name: forum_poll_options forum_poll_options_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_poll_options_select ON public.forum_poll_options FOR SELECT USING (true);

--
-- Name: forum_poll_options forum_poll_options_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_poll_options_staff ON public.forum_poll_options USING (public.is_staff()) WITH CHECK (public.is_staff());

--
-- Name: forum_poll_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_poll_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_poll_votes forum_poll_votes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_poll_votes_delete ON public.forum_poll_votes FOR DELETE USING (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.forum_polls p
  WHERE ((p.thread_id = forum_poll_votes.thread_id) AND ((p.closes_at IS NULL) OR (p.closes_at > now())))))));

--
-- Name: forum_poll_votes forum_poll_votes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_poll_votes_insert ON public.forum_poll_votes FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (NOT public.is_banned()) AND (EXISTS ( SELECT 1
   FROM (public.forum_polls p
     JOIN public.forum_poll_options o ON ((o.thread_id = p.thread_id)))
  WHERE ((o.id = forum_poll_votes.option_id) AND (p.thread_id = forum_poll_votes.thread_id) AND ((p.closes_at IS NULL) OR (p.closes_at > now())))))));

--
-- Name: forum_poll_votes forum_poll_votes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_poll_votes_select ON public.forum_poll_votes FOR SELECT USING (true);

--
-- Name: forum_polls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_polls ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_polls forum_polls_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_polls_insert ON public.forum_polls FOR INSERT WITH CHECK (((NOT public.is_banned()) AND (NOT public.is_muted()) AND (EXISTS ( SELECT 1
   FROM public.forum_threads t
  WHERE ((t.id = forum_polls.thread_id) AND (t.author_id = auth.uid()) AND (t.created_at > (now() - '00:05:00'::interval)))))));

--
-- Name: forum_polls forum_polls_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_polls_select ON public.forum_polls FOR SELECT USING (true);

--
-- Name: forum_polls forum_polls_staff; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_polls_staff ON public.forum_polls USING (public.is_staff()) WITH CHECK (public.is_staff());

--
-- Name: forum_post_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_post_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_post_likes forum_post_likes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_post_likes_delete ON public.forum_post_likes FOR DELETE USING (((auth.uid() = user_id) OR public.is_staff()));

--
-- Name: forum_post_likes forum_post_likes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_post_likes_insert ON public.forum_post_likes FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (NOT public.is_banned()) AND (auth.uid() IS DISTINCT FROM ( SELECT p.author_id
   FROM public.forum_posts p
  WHERE (p.id = forum_post_likes.post_id)))));

--
-- Name: forum_post_likes forum_post_likes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_post_likes_select ON public.forum_post_likes FOR SELECT USING (true);

--
-- Name: forum_post_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_post_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_post_reactions forum_post_reactions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_post_reactions_delete ON public.forum_post_reactions FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: forum_post_reactions forum_post_reactions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_post_reactions_insert ON public.forum_post_reactions FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (NOT public.is_banned()) AND (EXISTS ( SELECT 1
   FROM public.forum_posts p
  WHERE ((p.id = forum_post_reactions.post_id) AND (p.author_id IS DISTINCT FROM auth.uid()))))));

--
-- Name: forum_post_reactions forum_post_reactions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_post_reactions_select ON public.forum_post_reactions FOR SELECT USING (true);

--
-- Name: forum_post_reactions forum_post_reactions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_post_reactions_update ON public.forum_post_reactions FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: forum_posts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_posts forum_posts_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_posts_delete ON public.forum_posts FOR DELETE USING (((auth.uid() = author_id) OR public.is_staff()));

--
-- Name: forum_posts forum_posts_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_posts_insert ON public.forum_posts FOR INSERT WITH CHECK (((auth.uid() = author_id) AND (NOT public.is_banned()) AND (NOT public.is_muted()) AND (public.is_staff() OR (EXISTS ( SELECT 1
   FROM (public.forum_threads t
     JOIN public.forum_boards b ON ((b.id = t.board_id)))
  WHERE ((t.id = forum_posts.thread_id) AND (NOT t.is_locked) AND (NOT b.is_hidden)))))));

--
-- Name: forum_posts forum_posts_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_posts_select ON public.forum_posts FOR SELECT USING (true);

--
-- Name: forum_posts forum_posts_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_posts_update ON public.forum_posts FOR UPDATE USING (((auth.uid() = author_id) OR public.is_staff())) WITH CHECK (((auth.uid() = author_id) OR public.is_staff()));

--
-- Name: forum_sections; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_sections ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_sections forum_sections_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_sections_select ON public.forum_sections FOR SELECT USING (true);

--
-- Name: forum_sections forum_sections_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_sections_write ON public.forum_sections USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: forum_solucion_xp; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_solucion_xp ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_subscriptions forum_subscriptions_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_subscriptions_own ON public.forum_subscriptions USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: forum_thread_reads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_thread_reads ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_thread_reads forum_thread_reads_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_thread_reads_own ON public.forum_thread_reads USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: forum_threads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;

--
-- Name: forum_threads forum_threads_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_threads_delete ON public.forum_threads FOR DELETE USING ((public.is_staff() OR ((auth.uid() = author_id) AND (post_count <= 1))));

--
-- Name: forum_threads forum_threads_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_threads_insert ON public.forum_threads FOR INSERT WITH CHECK (((auth.uid() = author_id) AND (NOT public.is_banned()) AND (NOT public.is_muted()) AND (public.is_staff() OR (EXISTS ( SELECT 1
   FROM public.forum_boards b
  WHERE ((b.id = forum_threads.board_id) AND (b.post_policy = 'todos'::text) AND (NOT b.is_hidden)))) OR (public.soy_redactor_de_noticias() AND (EXISTS ( SELECT 1
   FROM public.forum_boards b
  WHERE ((b.id = forum_threads.board_id) AND (b.slug = 'noticias'::text))))))));

--
-- Name: forum_threads forum_threads_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_threads_select ON public.forum_threads FOR SELECT USING (true);

--
-- Name: forum_threads forum_threads_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY forum_threads_update ON public.forum_threads FOR UPDATE USING (((auth.uid() = author_id) OR public.is_staff())) WITH CHECK (((auth.uid() = author_id) OR public.is_staff()));

--
-- Name: guide_comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guide_comments ENABLE ROW LEVEL SECURITY;

--
-- Name: guide_comments guide_comments_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_comments_delete ON public.guide_comments FOR DELETE USING (((auth.uid() = author_id) OR public.is_admin()));

--
-- Name: guide_comments guide_comments_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_comments_insert ON public.guide_comments FOR INSERT WITH CHECK (((auth.uid() = author_id) AND (NOT public.is_banned()) AND (NOT public.is_muted())));

--
-- Name: guide_comments guide_comments_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_comments_select ON public.guide_comments FOR SELECT USING (true);

--
-- Name: guide_helpful; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guide_helpful ENABLE ROW LEVEL SECURITY;

--
-- Name: guide_helpful guide_helpful_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_helpful_delete ON public.guide_helpful FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: guide_helpful guide_helpful_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_helpful_insert ON public.guide_helpful FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (auth.uid() IS DISTINCT FROM ( SELECT g.author_id
   FROM public.guides g
  WHERE (g.id = guide_helpful.guide_id)))));

--
-- Name: guide_helpful guide_helpful_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_helpful_select ON public.guide_helpful FOR SELECT USING (true);

--
-- Name: guide_pro_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guide_pro_content ENABLE ROW LEVEL SECURITY;

--
-- Name: guide_pro_content guide_pro_content_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_pro_content_admin_all ON public.guide_pro_content USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: guide_pro_content guide_pro_content_select_pro; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_pro_content_select_pro ON public.guide_pro_content FOR SELECT USING (((published_at IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.user_profiles
  WHERE ((user_profiles.id = auth.uid()) AND (user_profiles.is_pro = true))))));

--
-- Name: guide_request_votes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guide_request_votes ENABLE ROW LEVEL SECURITY;

--
-- Name: guide_request_votes guide_request_votes_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_request_votes_delete ON public.guide_request_votes FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: guide_request_votes guide_request_votes_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_request_votes_insert ON public.guide_request_votes FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: guide_request_votes guide_request_votes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_request_votes_select ON public.guide_request_votes FOR SELECT USING (true);

--
-- Name: guide_requests; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guide_requests ENABLE ROW LEVEL SECURITY;

--
-- Name: guide_requests guide_requests_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_requests_delete ON public.guide_requests FOR DELETE USING (((auth.uid() = requester_id) OR public.is_admin()));

--
-- Name: guide_requests guide_requests_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_requests_insert ON public.guide_requests FOR INSERT WITH CHECK ((auth.uid() = requester_id));

--
-- Name: guide_requests guide_requests_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_requests_select ON public.guide_requests FOR SELECT USING (true);

--
-- Name: guide_requests guide_requests_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_requests_update ON public.guide_requests FOR UPDATE USING (((auth.uid() = requester_id) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.guides g
  WHERE (g.author_id = auth.uid()))))) WITH CHECK (((auth.uid() = requester_id) OR public.is_admin() OR ((fulfilled_guide_id IS NOT NULL) AND (auth.uid() = ( SELECT g.author_id
   FROM public.guides g
  WHERE (g.id = guide_requests.fulfilled_guide_id))))));

--
-- Name: guide_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guide_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: guide_reviews guide_reviews_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_reviews_delete ON public.guide_reviews FOR DELETE USING (((auth.uid() = reviewer_id) OR public.is_admin()));

--
-- Name: guide_reviews guide_reviews_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_reviews_insert ON public.guide_reviews FOR INSERT WITH CHECK (((auth.uid() = reviewer_id) AND (NOT public.is_banned()) AND (NOT public.is_muted())));

--
-- Name: guide_reviews guide_reviews_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_reviews_select ON public.guide_reviews FOR SELECT USING (true);

--
-- Name: guide_reviews guide_reviews_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_reviews_update ON public.guide_reviews FOR UPDATE USING ((auth.uid() = reviewer_id));

--
-- Name: guide_suggestions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.guide_suggestions ENABLE ROW LEVEL SECURITY;

--
-- Name: guide_suggestions guide_suggestions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_suggestions_delete ON public.guide_suggestions FOR DELETE USING ((((auth.uid() = author_id) AND (status = 'pending'::text)) OR public.is_admin()));

--
-- Name: guide_suggestions guide_suggestions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_suggestions_insert ON public.guide_suggestions FOR INSERT WITH CHECK (((auth.uid() = author_id) AND (auth.uid() IS DISTINCT FROM ( SELECT g.author_id
   FROM public.guides g
  WHERE (g.id = guide_suggestions.guide_id)))));

--
-- Name: guide_suggestions guide_suggestions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_suggestions_select ON public.guide_suggestions FOR SELECT USING (((status = 'accepted'::text) OR (auth.uid() = author_id) OR (auth.uid() = ( SELECT g.author_id
   FROM public.guides g
  WHERE (g.id = guide_suggestions.guide_id))) OR public.is_admin()));

--
-- Name: guide_suggestions guide_suggestions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guide_suggestions_update ON public.guide_suggestions FOR UPDATE USING (((auth.uid() = ( SELECT g.author_id
   FROM public.guides g
  WHERE (g.id = guide_suggestions.guide_id))) OR public.is_admin())) WITH CHECK (((auth.uid() = ( SELECT g.author_id
   FROM public.guides g
  WHERE (g.id = guide_suggestions.guide_id))) OR public.is_admin()));

--
-- Name: guides guides_author_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guides_author_delete ON public.guides FOR DELETE USING (((auth.uid() = author_id) AND (review_status = ANY (ARRAY['draft'::text, 'rejected'::text]))));

--
-- Name: guides guides_author_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guides_author_insert ON public.guides FOR INSERT WITH CHECK (((auth.uid() = author_id) AND (review_status = ANY (ARRAY['draft'::text, 'pending'::text])) AND (NOT public.is_banned()) AND (NOT public.is_muted())));

--
-- Name: guides guides_author_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guides_author_update ON public.guides FOR UPDATE USING (((auth.uid() = author_id) AND ((review_status = ANY (ARRAY['draft'::text, 'rejected'::text])) OR ((review_status = ANY (ARRAY['pending'::text, 'approved'::text])) AND (NOT public.is_banned()) AND (NOT public.is_muted()))))) WITH CHECK (((auth.uid() = author_id) AND (review_status = ANY (ARRAY['draft'::text, 'pending'::text, 'approved'::text]))));

--
-- Name: guides guides_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY guides_select ON public.guides FOR SELECT USING (((published_at IS NOT NULL) OR (review_status = 'pending'::text) OR (auth.uid() = author_id) OR public.is_admin()));

--
-- Name: tournament_registrations inscripciones_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inscripciones_admin ON public.tournament_registrations FOR DELETE USING (public.torneos_mando(tournament_id));

--
-- Name: tournament_registrations inscripciones_baja; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inscripciones_baja ON public.tournament_registrations FOR UPDATE USING (((user_id = auth.uid()) OR public.torneos_mando(tournament_id))) WITH CHECK (((user_id = auth.uid()) OR public.torneos_mando(tournament_id)));

--
-- Name: tournament_registrations inscripciones_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inscripciones_leer ON public.tournament_registrations FOR SELECT USING (true);

--
-- Name: tournament_registrations inscripciones_salir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY inscripciones_salir ON public.tournament_registrations FOR DELETE USING (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.tournaments t
  WHERE ((t.id = tournament_registrations.tournament_id) AND (t.status = ANY (ARRAY['draft'::text, 'registration_open'::text, 'registration_closed'::text])))))));

--
-- Name: tournament_matchday_closures jornadas_cerradas_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jornadas_cerradas_leer ON public.tournament_matchday_closures FOR SELECT USING (true);

--
-- Name: judge_applications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.judge_applications ENABLE ROW LEVEL SECURITY;

--
-- Name: judge_calls; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.judge_calls ENABLE ROW LEVEL SECURITY;

--
-- Name: judge_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.judge_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: judge_applications jueces_decidir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jueces_decidir ON public.judge_applications FOR UPDATE USING (public.torneos_mando(tournament_id)) WITH CHECK (public.torneos_mando(tournament_id));

--
-- Name: judge_applications jueces_pedir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jueces_pedir ON public.judge_applications FOR INSERT WITH CHECK (((user_id = auth.uid()) AND (status = 'pending'::text)));

--
-- Name: judge_applications jueces_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY jueces_ver ON public.judge_applications FOR SELECT USING ((auth.uid() IS NOT NULL));

--
-- Name: user_want_lists listas: las mias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "listas: las mias" ON public.user_want_lists TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: user_want_list_items listas: lo mio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "listas: lo mio" ON public.user_want_list_items TO authenticated USING ((user_id = auth.uid())) WITH CHECK (((user_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.user_want_lists l
  WHERE ((l.id = user_want_list_items.list_id) AND (l.user_id = auth.uid()))))));

--
-- Name: tournament_matchday_decklists listas_jornada_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY listas_jornada_ver ON public.tournament_matchday_decklists FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.torneos_mando(tournament_id) OR public.torneos_soy_juez(tournament_id)));

--
-- Name: judge_calls llamadas_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY llamadas_crear ON public.judge_calls FOR INSERT WITH CHECK (((created_by = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.tournament_matches m
  WHERE ((m.id = judge_calls.match_id) AND ((m.player_a_id = auth.uid()) OR (m.player_b_id = auth.uid())))))));

--
-- Name: judge_calls llamadas_resolver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY llamadas_resolver ON public.judge_calls FOR UPDATE USING ((public.torneos_mando(tournament_id) OR public.torneos_soy_juez(tournament_id))) WITH CHECK ((public.torneos_mando(tournament_id) OR public.torneos_soy_juez(tournament_id)));

--
-- Name: judge_calls llamadas_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY llamadas_ver ON public.judge_calls FOR SELECT USING (((created_by = auth.uid()) OR public.torneos_mando(tournament_id) OR public.torneos_soy_juez(tournament_id)));

--
-- Name: match_log_torneos log_torneos_solo_mios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY log_torneos_solo_mios ON public.match_log_torneos USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: logros_a_mano; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.logros_a_mano ENABLE ROW LEVEL SECURITY;

--
-- Name: logros_a_mano logros_a_mano_equipo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY logros_a_mano_equipo ON public.logros_a_mano FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: mas_caro_del_dia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mas_caro_del_dia ENABLE ROW LEVEL SECURITY;

--
-- Name: match_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_log ENABLE ROW LEVEL SECURITY;

--
-- Name: match_log_ajustes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_log_ajustes ENABLE ROW LEVEL SECURITY;

--
-- Name: match_log_torneos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_log_torneos ENABLE ROW LEVEL SECURITY;

--
-- Name: match_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: match_reports; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_reports ENABLE ROW LEVEL SECURITY;

--
-- Name: match_results; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;

--
-- Name: judge_messages mensajes_llamada; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajes_llamada ON public.judge_messages USING ((EXISTS ( SELECT 1
   FROM public.judge_calls c
  WHERE ((c.id = judge_messages.judge_call_id) AND ((c.created_by = auth.uid()) OR public.torneos_mando(c.tournament_id) OR public.torneos_soy_juez(c.tournament_id)))))) WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.judge_calls c
  WHERE ((c.id = judge_messages.judge_call_id) AND ((c.created_by = auth.uid()) OR public.torneos_mando(c.tournament_id) OR public.torneos_soy_juez(c.tournament_id)))))));

--
-- Name: match_messages mensajes_mesa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mensajes_mesa ON public.match_messages USING ((EXISTS ( SELECT 1
   FROM public.tournament_matches m
  WHERE ((m.id = match_messages.match_id) AND ((m.player_a_id = auth.uid()) OR (m.player_b_id = auth.uid()) OR public.torneos_mando(( SELECT r.tournament_id
           FROM public.rounds r
          WHERE (r.id = m.round_id))) OR public.torneos_soy_juez(( SELECT r.tournament_id
           FROM public.rounds r
          WHERE (r.id = m.round_id)))))))) WITH CHECK (((sender_id = auth.uid()) AND (EXISTS ( SELECT 1
   FROM public.tournament_matches m
  WHERE ((m.id = match_messages.match_id) AND ((m.player_a_id = auth.uid()) OR (m.player_b_id = auth.uid()) OR public.torneos_mando(( SELECT r.tournament_id
           FROM public.rounds r
          WHERE (r.id = m.round_id))) OR public.torneos_soy_juez(( SELECT r.tournament_id
           FROM public.rounds r
          WHERE (r.id = m.round_id)))))))));

--
-- Name: meta_arquetipos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_arquetipos ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_arquetipos meta_arquetipos_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_arquetipos_leer ON public.meta_arquetipos FOR SELECT USING (true);

--
-- Name: meta_cartas_dia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_cartas_dia ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_cartas_dia meta_cartas_dia_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_cartas_dia_leer ON public.meta_cartas_dia FOR SELECT USING (true);

--
-- Name: meta_guias; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_guias ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_guias meta_guias_desvincular; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_guias_desvincular ON public.meta_guias FOR DELETE USING (((auth.uid() = added_by) OR public.is_admin() OR (EXISTS ( SELECT 1
   FROM public.guides g
  WHERE ((g.id = meta_guias.guide_id) AND (g.author_id = auth.uid()))))));

--
-- Name: meta_guias meta_guias_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_guias_leer ON public.meta_guias FOR SELECT USING (true);

--
-- Name: meta_guias meta_guias_vincular; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_guias_vincular ON public.meta_guias FOR INSERT WITH CHECK (((auth.uid() = added_by) AND (NOT public.is_banned()) AND (EXISTS ( SELECT 1
   FROM public.guides g
  WHERE ((g.id = meta_guias.guide_id) AND (g.published_at IS NOT NULL) AND ((g.author_id = auth.uid()) OR public.is_admin()))))));

--
-- Name: meta_resultados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_resultados ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_resultados meta_resultados_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_resultados_leer ON public.meta_resultados FOR SELECT USING (true);

--
-- Name: meta_torneos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.meta_torneos ENABLE ROW LEVEL SECURITY;

--
-- Name: meta_torneos meta_torneos_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY meta_torneos_leer ON public.meta_torneos FOR SELECT USING (true);

--
-- Name: moderaciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.moderaciones ENABLE ROW LEVEL SECURITY;

--
-- Name: moderaciones moderaciones_lectura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY moderaciones_lectura ON public.moderaciones FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: online_now; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.online_now ENABLE ROW LEVEL SECURITY;

--
-- Name: online_now online_now_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY online_now_select ON public.online_now FOR SELECT USING (true);

--
-- Name: page_views; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

--
-- Name: page_views page_views_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY page_views_admin_select ON public.page_views FOR SELECT USING (public.is_admin());

--
-- Name: page_views page_views_insert_anyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY page_views_insert_anyone ON public.page_views FOR INSERT WITH CHECK (true);

--
-- Name: page_vitals; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.page_vitals ENABLE ROW LEVEL SECURITY;

--
-- Name: page_vitals page_vitals_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY page_vitals_admin_select ON public.page_vitals FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: page_vitals page_vitals_insert_anyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY page_vitals_insert_anyone ON public.page_vitals FOR INSERT TO anon, authenticated WITH CHECK (true);

--
-- Name: pairing_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pairing_history ENABLE ROW LEVEL SECURITY;

--
-- Name: match_log partidas_solo_mias; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY partidas_solo_mias ON public.match_log USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: user_play_pokemon play_pokemon_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY play_pokemon_borrar ON public.user_play_pokemon FOR DELETE TO authenticated USING ((user_id = auth.uid()));

--
-- Name: user_play_pokemon play_pokemon_cambiar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY play_pokemon_cambiar ON public.user_play_pokemon FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: user_play_pokemon play_pokemon_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY play_pokemon_crear ON public.user_play_pokemon FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

--
-- Name: user_play_pokemon play_pokemon_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY play_pokemon_ver ON public.user_play_pokemon FOR SELECT TO authenticated USING ((user_id = auth.uid()));

--
-- Name: tournament_prize_deliveries premios_entrega_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY premios_entrega_leer ON public.tournament_prize_deliveries FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tournaments t
  WHERE (t.id = tournament_prize_deliveries.tournament_id))));

--
-- Name: private_message_reactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.private_message_reactions ENABLE ROW LEVEL SECURITY;

--
-- Name: private_message_reactions private_message_reactions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_message_reactions_delete ON public.private_message_reactions FOR DELETE TO authenticated USING ((user_id = auth.uid()));

--
-- Name: private_message_reactions private_message_reactions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_message_reactions_insert ON public.private_message_reactions FOR INSERT TO authenticated WITH CHECK (((user_id = auth.uid()) AND public.mensaje_reaccionable(message_id, conversation_id)));

--
-- Name: private_message_reactions private_message_reactions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_message_reactions_select ON public.private_message_reactions FOR SELECT TO authenticated USING (public.is_conversation_participant(conversation_id));

--
-- Name: private_message_reactions private_message_reactions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_message_reactions_update ON public.private_message_reactions FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK (((user_id = auth.uid()) AND public.mensaje_reaccionable(message_id, conversation_id)));

--
-- Name: private_messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.private_messages ENABLE ROW LEVEL SECURITY;

--
-- Name: private_messages private_messages_admin_select_reported; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_messages_admin_select_reported ON public.private_messages FOR SELECT USING ((public.is_admin() AND (EXISTS ( SELECT 1
   FROM public.content_reports
  WHERE ((content_reports.content_type = 'private_message'::text) AND (content_reports.content_id = private_messages.id))))));

--
-- Name: private_messages private_messages_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_messages_delete ON public.private_messages FOR DELETE USING ((sender_id = auth.uid()));

--
-- Name: private_messages private_messages_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_messages_insert ON public.private_messages FOR INSERT TO authenticated WITH CHECK (((sender_id = auth.uid()) AND public.is_conversation_participant(conversation_id) AND (NOT public.is_banned()) AND (NOT public.is_muted())));

--
-- Name: private_messages private_messages_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_messages_select ON public.private_messages FOR SELECT USING (public.is_conversation_participant(conversation_id));

--
-- Name: private_messages private_messages_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY private_messages_update ON public.private_messages FOR UPDATE TO authenticated USING ((sender_id = auth.uid())) WITH CHECK ((sender_id = auth.uid()));

--
-- Name: profile_reviews; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profile_reviews ENABLE ROW LEVEL SECURITY;

--
-- Name: profile_reviews profile_reviews_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_reviews_delete ON public.profile_reviews FOR DELETE USING (((auth.uid() = reviewer_id) OR public.is_admin()));

--
-- Name: profile_reviews profile_reviews_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_reviews_insert ON public.profile_reviews FOR INSERT WITH CHECK (((auth.uid() = reviewer_id) AND (reviewer_id <> profile_id) AND (NOT public.is_banned()) AND (NOT public.is_muted())));

--
-- Name: profile_reviews profile_reviews_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_reviews_select ON public.profile_reviews FOR SELECT USING (true);

--
-- Name: profile_reviews profile_reviews_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profile_reviews_update ON public.profile_reviews FOR UPDATE USING ((auth.uid() = reviewer_id)) WITH CHECK ((auth.uid() = reviewer_id));

--
-- Name: push_subscriptions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

--
-- Name: push_subscriptions push_subscriptions_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_delete ON public.push_subscriptions FOR DELETE USING ((user_id = auth.uid()));

--
-- Name: push_subscriptions push_subscriptions_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_insert ON public.push_subscriptions FOR INSERT WITH CHECK ((user_id = auth.uid()));

--
-- Name: push_subscriptions push_subscriptions_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_select ON public.push_subscriptions FOR SELECT USING ((user_id = auth.uid()));

--
-- Name: push_subscriptions push_subscriptions_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY push_subscriptions_update ON public.push_subscriptions FOR UPDATE USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: replay_puzzles puzles_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY puzles_borrar ON public.replay_puzzles FOR DELETE USING ((user_id = auth.uid()));

--
-- Name: replay_puzzles puzles_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY puzles_leer ON public.replay_puzzles FOR SELECT USING (((user_id = auth.uid()) OR public.repeticion_compartida(replay_id)));

--
-- Name: question_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.question_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: question_stats question_stats_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY question_stats_select ON public.question_stats FOR SELECT USING (true);

--
-- Name: tcg_repetidas_distintas repetidas_distintas_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repetidas_distintas_admin ON public.tcg_repetidas_distintas FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: tcg_repetidas_hechas repetidas_hechas_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY repetidas_hechas_admin ON public.tcg_repetidas_hechas FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: replay_puzzle_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.replay_puzzle_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: replay_puzzles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.replay_puzzles ENABLE ROW LEVEL SECURITY;

--
-- Name: replays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.replays ENABLE ROW LEVEL SECURITY;

--
-- Name: replays replays_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY replays_borrar ON public.replays FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: replays replays_editar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY replays_editar ON public.replays FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: replays replays_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY replays_ver ON public.replays FOR SELECT USING ((auth.uid() = user_id));

--
-- Name: match_reports reportes_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reportes_ver ON public.match_reports FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.tournament_matches m
  WHERE ((m.id = match_reports.match_id) AND ((m.player_a_id = auth.uid()) OR (m.player_b_id = auth.uid()) OR public.torneos_mando(( SELECT r.tournament_id
           FROM public.rounds r
          WHERE (r.id = m.round_id))) OR public.torneos_soy_juez(( SELECT r.tournament_id
           FROM public.rounds r
          WHERE (r.id = m.round_id))))))));

--
-- Name: retos_arbitro; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retos_arbitro ENABLE ROW LEVEL SECURITY;

--
-- Name: retos_bonos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retos_bonos ENABLE ROW LEVEL SECURITY;

--
-- Name: retos_bonos retos_bonos_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY retos_bonos_ver ON public.retos_bonos FOR SELECT TO authenticated USING ((auth.uid() = user_id));

--
-- Name: retos_llave; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retos_llave ENABLE ROW LEVEL SECURITY;

--
-- Name: retos_partidas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retos_partidas ENABLE ROW LEVEL SECURITY;

--
-- Name: retos_resultados; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retos_resultados ENABLE ROW LEVEL SECURITY;

--
-- Name: retos_resultados retos_resultados_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY retos_resultados_ver ON public.retos_resultados FOR SELECT TO authenticated USING ((auth.uid() = user_id));

--
-- Name: retos_reto_del_dia; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.retos_reto_del_dia ENABLE ROW LEVEL SECURITY;

--
-- Name: rounds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;

--
-- Name: scrydex_estado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scrydex_estado ENABLE ROW LEVEL SECURITY;

--
-- Name: scrydex_estado scrydex_estado_lee_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY scrydex_estado_lee_admin ON public.scrydex_estado FOR SELECT TO authenticated USING (public.is_admin());

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings site_settings_escritura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_settings_escritura ON public.site_settings USING ((EXISTS ( SELECT 1
   FROM public.user_profiles p
  WHERE ((p.id = auth.uid()) AND p.is_admin)))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.user_profiles p
  WHERE ((p.id = auth.uid()) AND p.is_admin))));

--
-- Name: site_settings site_settings_lectura; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY site_settings_lectura ON public.site_settings FOR SELECT USING (true);

--
-- Name: tournament_updates tablon_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tablon_borrar ON public.tournament_updates FOR DELETE TO authenticated USING (((kind = 'aviso'::text) AND ((author_id = auth.uid()) OR public.torneos_mando(tournament_id))));

--
-- Name: tournament_updates tablon_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tablon_leer ON public.tournament_updates FOR SELECT TO anon, authenticated USING (true);

--
-- Name: tcg_archetypes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_archetypes ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_card_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_card_history ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_card_history tcg_card_history_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_card_history_ver ON public.tcg_card_history FOR SELECT USING (true);

--
-- Name: tcg_card_play; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_card_play ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_card_play tcg_card_play_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_card_play_ver ON public.tcg_card_play FOR SELECT USING (true);

--
-- Name: tcg_card_prices; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_card_prices ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_card_prices tcg_card_prices_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_card_prices_leer ON public.tcg_card_prices FOR SELECT USING (true);

--
-- Name: tcg_card_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_card_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_card_versions tcg_card_versions_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_card_versions_leer ON public.tcg_card_versions FOR SELECT TO anon, authenticated USING (true);

--
-- Name: tcg_cards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_cards ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_cards tcg_cards_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_cards_read ON public.tcg_cards FOR SELECT USING (true);

--
-- Name: tcg_cards tcg_cards_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_cards_write ON public.tcg_cards USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: tcg_correcciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_correcciones ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_eras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_eras ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_eras tcg_eras_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_eras_read ON public.tcg_eras FOR SELECT USING (true);

--
-- Name: tcg_eras tcg_eras_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_eras_write ON public.tcg_eras USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: tcg_product_contenido; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_product_contenido ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_product_contenido tcg_product_contenido_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_product_contenido_ver ON public.tcg_product_contenido FOR SELECT TO anon, authenticated USING (true);

--
-- Name: tcg_product_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_product_history ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_product_history tcg_product_history_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_product_history_ver ON public.tcg_product_history FOR SELECT TO anon, authenticated USING (true);

--
-- Name: tcg_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_products ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_products tcg_products_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_products_ver ON public.tcg_products FOR SELECT TO anon, authenticated USING (true);

--
-- Name: tcg_repetidas_distintas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_repetidas_distintas ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_repetidas_hechas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_repetidas_hechas ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_set_idiomas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_set_idiomas ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_set_idiomas tcg_set_idiomas_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_set_idiomas_leer ON public.tcg_set_idiomas FOR SELECT USING (true);

--
-- Name: tcg_set_idiomas_mano; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_set_idiomas_mano ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_set_idiomas_mano tcg_set_idiomas_mano_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_set_idiomas_mano_leer ON public.tcg_set_idiomas_mano FOR SELECT USING (true);

--
-- Name: tcg_set_valor; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_set_valor ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_set_valor tcg_set_valor_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_set_valor_ver ON public.tcg_set_valor FOR SELECT USING (true);

--
-- Name: tcg_sets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_sets ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_sets tcg_sets_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_sets_read ON public.tcg_sets FOR SELECT USING (true);

--
-- Name: tcg_sets tcg_sets_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_sets_write ON public.tcg_sets USING (public.is_admin()) WITH CHECK (public.is_admin());

--
-- Name: tcg_version_idioma; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tcg_version_idioma ENABLE ROW LEVEL SECURITY;

--
-- Name: tcg_version_idioma tcg_version_idioma_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tcg_version_idioma_leer ON public.tcg_version_idioma FOR SELECT USING (true);

--
-- Name: telemetria_ritmo; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.telemetria_ritmo ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_avisos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_avisos ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_cambios; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_cambios ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_cambios tienda_cambios_suyos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_cambios_suyos ON public.tienda_cambios FOR SELECT TO authenticated USING ((tienda_id = auth.uid()));

--
-- Name: tienda_cobros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_cobros ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_compras; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_compras ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_compras tienda_compras_suyas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_compras_suyas ON public.tienda_compras FOR SELECT TO authenticated USING (((tienda_id = auth.uid()) AND public.soy_tienda()));

--
-- Name: tienda_fotos_pedidas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_fotos_pedidas ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_fotos_pedidas tienda_fotos_pedidas_suyas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_fotos_pedidas_suyas ON public.tienda_fotos_pedidas FOR SELECT TO authenticated USING (((tienda_id = auth.uid()) OR (comprador_id = auth.uid())));

--
-- Name: tienda_lotes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_lotes ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_lotes tienda_lotes_suyos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_lotes_suyos ON public.tienda_lotes FOR SELECT TO authenticated USING ((tienda_id = auth.uid()));

--
-- Name: tienda_ofertas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_ofertas ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_ofertas tienda_ofertas_las_suyas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_ofertas_las_suyas ON public.tienda_ofertas FOR SELECT TO authenticated USING (((tienda_id = auth.uid()) OR (comprador_id = auth.uid())));

--
-- Name: tienda_reservas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_reservas ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_reservas tienda_reservas_suyas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_reservas_suyas ON public.tienda_reservas FOR SELECT TO authenticated USING (((tienda_id = auth.uid()) AND public.soy_tienda()));

--
-- Name: tienda_solicitudes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_solicitudes ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_solicitudes tienda_solicitudes_equipo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_solicitudes_equipo ON public.tienda_solicitudes FOR SELECT TO authenticated USING (COALESCE(public.is_admin(), false));

--
-- Name: tienda_stock; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_stock ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_stock_fotos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_stock_fotos ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_stock_fotos tienda_stock_fotos_cambiar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_stock_fotos_cambiar ON public.tienda_stock_fotos FOR UPDATE TO authenticated USING ((tienda_id = auth.uid())) WITH CHECK (((tienda_id = auth.uid()) AND public.tienda_foto_puedo(stock_id)));

--
-- Name: tienda_stock_fotos tienda_stock_fotos_poner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_stock_fotos_poner ON public.tienda_stock_fotos FOR INSERT TO authenticated WITH CHECK (((tienda_id = auth.uid()) AND public.tienda_foto_puedo(stock_id)));

--
-- Name: tienda_stock_fotos tienda_stock_fotos_quitar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_stock_fotos_quitar ON public.tienda_stock_fotos FOR DELETE TO authenticated USING ((tienda_id = auth.uid()));

--
-- Name: tienda_stock_fotos tienda_stock_fotos_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_stock_fotos_ver ON public.tienda_stock_fotos FOR SELECT TO anon, authenticated USING (public.tienda_foto_se_ve(stock_id));

--
-- Name: tienda_stock tienda_stock_suyo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_stock_suyo ON public.tienda_stock TO authenticated USING (((tienda_id = auth.uid()) AND public.soy_tienda())) WITH CHECK (((tienda_id = auth.uid()) AND public.soy_tienda()));

--
-- Name: tienda_valor_diario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_valor_diario ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_valor_diario tienda_valor_diario_suyo; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_valor_diario_suyo ON public.tienda_valor_diario FOR SELECT TO authenticated USING (((tienda_id = auth.uid()) AND public.soy_tienda()));

--
-- Name: tienda_ventas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_ventas ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_ventas tienda_ventas_suyas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_ventas_suyas ON public.tienda_ventas FOR SELECT TO authenticated USING (((tienda_id = auth.uid()) AND public.soy_tienda()));

--
-- Name: tienda_visitas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_visitas ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_visitas tienda_visitas_suyas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_visitas_suyas ON public.tienda_visitas FOR SELECT TO authenticated USING (((tienda_id = auth.uid()) AND public.soy_tienda()));

--
-- Name: tienda_vistas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tienda_vistas ENABLE ROW LEVEL SECURITY;

--
-- Name: tienda_vistas tienda_vistas_suyas; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tienda_vistas_suyas ON public.tienda_vistas TO authenticated USING (((tienda_id = auth.uid()) AND public.soy_tienda())) WITH CHECK (((tienda_id = auth.uid()) AND public.soy_tienda()));

--
-- Name: tiendas; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tiendas ENABLE ROW LEVEL SECURITY;

--
-- Name: tiendas tiendas_cambia_la_suya; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tiendas_cambia_la_suya ON public.tiendas FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: tiendas tiendas_se_ven; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tiendas_se_ven ON public.tiendas FOR SELECT USING (true);

--
-- Name: tournament_match_replays tmr_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tmr_ver ON public.tournament_match_replays FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.tournament_matches m
     JOIN public.rounds r ON ((r.id = m.round_id)))
  WHERE ((m.id = tournament_match_replays.match_id) AND ((m.player_a_id = auth.uid()) OR (m.player_b_id = auth.uid()) OR public.torneos_mando(r.tournament_id) OR public.repeticiones_juez_de(r.tournament_id))))));

--
-- Name: tournament_match_replays tmr_ver_de_mesa; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tmr_ver_de_mesa ON public.tournament_match_replays FOR SELECT TO anon, authenticated USING ((publica AND (EXISTS ( SELECT 1
   FROM public.tournament_matches m
  WHERE (m.id = tournament_match_replays.match_id)))));

--
-- Name: tournaments torneos_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_borrar ON public.tournaments FOR DELETE USING (((admin_id = auth.uid()) OR public.torneos_soy_admin()));

--
-- Name: match_results torneos_escribir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_escribir ON public.match_results USING ((EXISTS ( SELECT 1
   FROM (public.tournament_matches m
     JOIN public.rounds r ON ((r.id = m.round_id)))
  WHERE ((m.id = match_results.match_id) AND public.torneos_mando(r.tournament_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.tournament_matches m
     JOIN public.rounds r ON ((r.id = m.round_id)))
  WHERE ((m.id = match_results.match_id) AND public.torneos_mando(r.tournament_id)))));

--
-- Name: pairing_history torneos_escribir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_escribir ON public.pairing_history USING (public.torneos_mando(tournament_id)) WITH CHECK (public.torneos_mando(tournament_id));

--
-- Name: rounds torneos_escribir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_escribir ON public.rounds USING (public.torneos_mando(tournament_id)) WITH CHECK (public.torneos_mando(tournament_id));

--
-- Name: tournament_matches torneos_escribir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_escribir ON public.tournament_matches USING ((EXISTS ( SELECT 1
   FROM public.rounds r
  WHERE ((r.id = tournament_matches.round_id) AND public.torneos_mando(r.tournament_id))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.rounds r
  WHERE ((r.id = tournament_matches.round_id) AND public.torneos_mando(r.tournament_id)))));

--
-- Name: tournaments torneos_escribir; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_escribir ON public.tournaments USING ((public.torneos_soy_admin() OR (admin_id = auth.uid()))) WITH CHECK ((public.torneos_soy_admin() OR (admin_id = auth.uid())));

--
-- Name: tournaments torneos_juez_edita; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_juez_edita ON public.tournaments FOR UPDATE TO authenticated USING (public.torneos_soy_juez(id)) WITH CHECK (public.torneos_soy_juez(id));

--
-- Name: match_results torneos_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_leer ON public.match_results FOR SELECT USING (true);

--
-- Name: pairing_history torneos_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_leer ON public.pairing_history FOR SELECT USING ((auth.uid() IS NOT NULL));

--
-- Name: rounds torneos_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_leer ON public.rounds FOR SELECT USING (true);

--
-- Name: tournament_matches torneos_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_leer ON public.tournament_matches FOR SELECT USING (true);

--
-- Name: tournaments torneos_leer; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_leer ON public.tournaments FOR SELECT USING (((status <> 'draft'::text) OR (admin_id = auth.uid()) OR public.torneos_soy_admin()));

--
-- Name: tournaments torneos_ver_los_mios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY torneos_ver_los_mios ON public.tournaments FOR SELECT USING ((admin_id = auth.uid()));

--
-- Name: tournament_decklists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_decklists ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_join_codes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_join_codes ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_match_replays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_match_replays ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_matchday_avisos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_matchday_avisos ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_matchday_closures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_matchday_closures ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_matchday_decklists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_matchday_decklists ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_matches ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_prize_deliveries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_prize_deliveries ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_registrations ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_updates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_updates ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_xp_awards; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournament_xp_awards ENABLE ROW LEVEL SECURITY;

--
-- Name: tournament_xp_awards tournament_xp_awards_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tournament_xp_awards_ver ON public.tournament_xp_awards FOR SELECT USING (true);

--
-- Name: tournaments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_confirmations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_confirmations ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_confirmations trade_confirmations_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trade_confirmations_ver ON public.trade_confirmations FOR SELECT TO authenticated USING ((((auth.uid() = user_a) OR (auth.uid() = user_b)) OR COALESCE(( SELECT (user_profiles.is_admin OR user_profiles.is_moderator)
   FROM public.user_profiles
  WHERE (user_profiles.id = auth.uid())), false)));

--
-- Name: trade_offer_cobros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_offer_cobros ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_offer_direcciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_offer_direcciones ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_offer_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_offer_items ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_offer_items trade_offer_items_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trade_offer_items_ver ON public.trade_offer_items FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.trade_offers o
  WHERE ((o.id = trade_offer_items.oferta) AND ((auth.uid() = o.de) OR (auth.uid() = o.para))))));

--
-- Name: trade_offers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.trade_offers ENABLE ROW LEVEL SECURITY;

--
-- Name: trade_offers trade_offers_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY trade_offers_ver ON public.trade_offers FOR SELECT TO authenticated USING (((auth.uid() = de) OR (auth.uid() = para)));

--
-- Name: user_albums; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_albums ENABLE ROW LEVEL SECURITY;

--
-- Name: user_albums user_albums_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_albums_borrar ON public.user_albums FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: user_albums user_albums_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_albums_crear ON public.user_albums FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (NOT public.is_banned())));

--
-- Name: user_albums user_albums_editar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_albums_editar ON public.user_albums FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: user_albums user_albums_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_albums_ver ON public.user_albums FOR SELECT USING ((is_public OR (auth.uid() = user_id)));

--
-- Name: user_cobros; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_cobros ENABLE ROW LEVEL SECURITY;

--
-- Name: user_cobros user_cobros_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_cobros_borrar ON public.user_cobros FOR DELETE TO authenticated USING ((user_id = auth.uid()));

--
-- Name: user_cobros user_cobros_cambiar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_cobros_cambiar ON public.user_cobros FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: user_cobros user_cobros_poner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_cobros_poner ON public.user_cobros FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

--
-- Name: user_cobros user_cobros_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_cobros_ver ON public.user_cobros FOR SELECT TO authenticated USING ((user_id = auth.uid()));

--
-- Name: user_collection; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_collection ENABLE ROW LEVEL SECURITY;

--
-- Name: user_collection user_collection_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_collection_borrar ON public.user_collection FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: user_collection user_collection_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_collection_crear ON public.user_collection FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (NOT public.is_banned())));

--
-- Name: user_collection user_collection_editar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_collection_editar ON public.user_collection FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: user_collection_value; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_collection_value ENABLE ROW LEVEL SECURITY;

--
-- Name: user_collection_value user_collection_value_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_collection_value_ver ON public.user_collection_value FOR SELECT USING (((auth.uid() = user_id) OR public.coleccion_es_publica(user_id)));

--
-- Name: user_collection user_collection_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_collection_ver ON public.user_collection FOR SELECT USING (((auth.uid() = user_id) OR public.coleccion_es_publica(user_id)));

--
-- Name: user_cumple; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_cumple ENABLE ROW LEVEL SECURITY;

--
-- Name: user_cumple user_cumple_mio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_cumple_mio ON public.user_cumple TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: user_decks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_decks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_decks user_decks_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_decks_borrar ON public.user_decks FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: user_decks user_decks_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_decks_crear ON public.user_decks FOR INSERT WITH CHECK ((auth.uid() = user_id));

--
-- Name: user_decks user_decks_editar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_decks_editar ON public.user_decks FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: user_decks user_decks_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_decks_ver ON public.user_decks FOR SELECT USING ((is_public OR (auth.uid() = user_id)));

--
-- Name: user_direcciones; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_direcciones ENABLE ROW LEVEL SECURITY;

--
-- Name: user_direcciones user_direcciones_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_direcciones_borrar ON public.user_direcciones FOR DELETE TO authenticated USING ((user_id = auth.uid()));

--
-- Name: user_direcciones user_direcciones_cambiar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_direcciones_cambiar ON public.user_direcciones FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: user_direcciones user_direcciones_poner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_direcciones_poner ON public.user_direcciones FOR INSERT TO authenticated WITH CHECK ((user_id = auth.uid()));

--
-- Name: user_direcciones user_direcciones_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_direcciones_ver ON public.user_direcciones FOR SELECT TO authenticated USING ((user_id = auth.uid()));

--
-- Name: user_follows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

--
-- Name: user_follows user_follows_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follows_delete_own ON public.user_follows FOR DELETE USING ((auth.uid() = follower_id));

--
-- Name: user_follows user_follows_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follows_insert_own ON public.user_follows FOR INSERT WITH CHECK ((auth.uid() = follower_id));

--
-- Name: user_follows user_follows_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_follows_public_read ON public.user_follows FOR SELECT USING (true);

--
-- Name: user_notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: user_notifications user_notifications_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_notifications_insert ON public.user_notifications FOR INSERT WITH CHECK (((auth.uid() IS NOT NULL) AND (recipient_id <> auth.uid())));

--
-- Name: user_notifications user_notifications_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_notifications_select ON public.user_notifications FOR SELECT USING ((auth.uid() = recipient_id));

--
-- Name: user_notifications user_notifications_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_notifications_update ON public.user_notifications FOR UPDATE USING ((auth.uid() = recipient_id)) WITH CHECK ((auth.uid() = recipient_id));

--
-- Name: user_play_pokemon; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_play_pokemon ENABLE ROW LEVEL SECURITY;

--
-- Name: user_price_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_price_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: user_price_alerts user_price_alerts_propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_price_alerts_propios ON public.user_price_alerts TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: user_privado; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_privado ENABLE ROW LEVEL SECURITY;

--
-- Name: user_privado user_privado_mio; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_privado_mio ON public.user_privado FOR SELECT TO authenticated USING ((user_id = auth.uid()));

--
-- Name: user_privado user_privado_mio_cambiar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_privado_mio_cambiar ON public.user_privado FOR UPDATE TO authenticated USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));

--
-- Name: user_products; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_products ENABLE ROW LEVEL SECURITY;

--
-- Name: user_products user_products_mios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_products_mios ON public.user_products TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: user_profiles user_profiles_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_profiles_public_read ON public.user_profiles FOR SELECT USING (true);

--
-- Name: user_progress user_progress_admin_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_progress_admin_select ON public.user_progress FOR SELECT USING (public.is_admin());

--
-- Name: user_progress user_progress_public_activity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_progress_public_activity ON public.user_progress FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_profiles p
  WHERE ((p.id = user_progress.user_id) AND (p.hide_activity = false)))));

--
-- Name: user_release_alerts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_release_alerts ENABLE ROW LEVEL SECURITY;

--
-- Name: user_release_alerts user_release_alerts_propios; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_release_alerts_propios ON public.user_release_alerts TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: user_showcase; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_showcase ENABLE ROW LEVEL SECURITY;

--
-- Name: user_showcase user_showcase_propia; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_showcase_propia ON public.user_showcase TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: user_showcase user_showcase_se_ve; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_showcase_se_ve ON public.user_showcase FOR SELECT TO anon, authenticated USING (true);

--
-- Name: user_want_list_items; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_want_list_items ENABLE ROW LEVEL SECURITY;

--
-- Name: user_want_lists; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_want_lists ENABLE ROW LEVEL SECURITY;

--
-- Name: user_wants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_wants ENABLE ROW LEVEL SECURITY;

--
-- Name: user_wants user_wants_borrar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_wants_borrar ON public.user_wants FOR DELETE USING ((auth.uid() = user_id));

--
-- Name: user_wants user_wants_crear; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_wants_crear ON public.user_wants FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (NOT public.is_banned())));

--
-- Name: user_wants user_wants_editar; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_wants_editar ON public.user_wants FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

--
-- Name: user_wants user_wants_ver; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_wants_ver ON public.user_wants FOR SELECT USING (true);

--
-- Name: xp_diario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.xp_diario ENABLE ROW LEVEL SECURITY;

--
-- Name: xp_mes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.xp_mes ENABLE ROW LEVEL SECURITY;

--
-- Name: xp_mes xp_mes_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY xp_mes_select ON public.xp_mes FOR SELECT USING (true);

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

--
-- Name: FUNCTION admin_analitica(p_dias integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_analitica(p_dias integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_analitica(p_dias integer) TO authenticated;

--
-- Name: FUNCTION admin_analitica_resumen(p_dias integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_analitica_resumen(p_dias integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_analitica_resumen(p_dias integer) TO authenticated;
GRANT ALL ON FUNCTION public.admin_analitica_resumen(p_dias integer) TO service_role;

--
-- Name: FUNCTION admin_aviso_avisar(p_aviso uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_aviso_avisar(p_aviso uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_aviso_avisar(p_aviso uuid) TO authenticated;

--
-- Name: FUNCTION admin_aviso_campanita(p_titulo text, p_cuerpo text, p_enlace text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_aviso_campanita(p_titulo text, p_cuerpo text, p_enlace text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_aviso_campanita(p_titulo text, p_cuerpo text, p_enlace text) TO authenticated;

--
-- Name: FUNCTION admin_aviso_participantes(p_aviso uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_aviso_participantes(p_aviso uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_aviso_participantes(p_aviso uuid) TO authenticated;

--
-- Name: FUNCTION admin_aviso_sortear(p_aviso uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_aviso_sortear(p_aviso uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_aviso_sortear(p_aviso uuid) TO authenticated;

--
-- Name: FUNCTION admin_correo_prueba(p_tipo text, p_asunto text, p_cita text, p_enlace text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_correo_prueba(p_tipo text, p_asunto text, p_cita text, p_enlace text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_correo_prueba(p_tipo text, p_asunto text, p_cita text, p_enlace text) TO authenticated;

--
-- Name: FUNCTION admin_logro_dar(p_usuario uuid, p_logro text, p_motivo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_logro_dar(p_usuario uuid, p_logro text, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_logro_dar(p_usuario uuid, p_logro text, p_motivo text) TO authenticated;

--
-- Name: FUNCTION admin_logro_quitar(p_usuario uuid, p_logro text, p_motivo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_logro_quitar(p_usuario uuid, p_logro text, p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_logro_quitar(p_usuario uuid, p_logro text, p_motivo text) TO authenticated;

--
-- Name: FUNCTION admin_moderar(p_usuario uuid, p_que text, p_motivo text, p_dias integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_moderar(p_usuario uuid, p_que text, p_motivo text, p_dias integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_moderar(p_usuario uuid, p_que text, p_motivo text, p_dias integer) TO authenticated;

--
-- Name: FUNCTION admin_moderar_quitar(p_usuario uuid, p_que text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_moderar_quitar(p_usuario uuid, p_que text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_moderar_quitar(p_usuario uuid, p_que text) TO authenticated;

--
-- Name: FUNCTION admin_tienda_de_pruebas(p_tienda uuid, p_si boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.admin_tienda_de_pruebas(p_tienda uuid, p_si boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.admin_tienda_de_pruebas(p_tienda uuid, p_si boolean) TO authenticated;

--
-- Name: FUNCTION adviento_abrir(p_dia integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.adviento_abrir(p_dia integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.adviento_abrir(p_dia integer) TO authenticated;
GRANT ALL ON FUNCTION public.adviento_abrir(p_dia integer) TO service_role;

--
-- Name: FUNCTION aviso_apuntarme(p_aviso uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.aviso_apuntarme(p_aviso uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.aviso_apuntarme(p_aviso uuid) TO authenticated;

--
-- Name: FUNCTION aviso_contar(p_aviso uuid, p_que text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.aviso_contar(p_aviso uuid, p_que text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.aviso_contar(p_aviso uuid, p_que text) TO anon;
GRANT ALL ON FUNCTION public.aviso_contar(p_aviso uuid, p_que text) TO authenticated;

--
-- Name: FUNCTION aviso_mandar(p_aviso uuid, p_recordatorio boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.aviso_mandar(p_aviso uuid, p_recordatorio boolean) FROM PUBLIC;

--
-- Name: FUNCTION aviso_participacion(p_aviso uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.aviso_participacion(p_aviso uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.aviso_participacion(p_aviso uuid) TO anon;
GRANT ALL ON FUNCTION public.aviso_participacion(p_aviso uuid) TO authenticated;

--
-- Name: FUNCTION avisos_al_dia(p_ahora timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.avisos_al_dia(p_ahora timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.avisos_al_dia(p_ahora timestamp with time zone) TO service_role;

--
-- Name: FUNCTION calendario_cambiar_clave(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calendario_cambiar_clave() FROM PUBLIC;
GRANT ALL ON FUNCTION public.calendario_cambiar_clave() TO authenticated;

--
-- Name: FUNCTION calendario_de(p_clave text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.calendario_de(p_clave text) TO anon;
GRANT ALL ON FUNCTION public.calendario_de(p_clave text) TO authenticated;

--
-- Name: FUNCTION calendario_mio(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calendario_mio() FROM PUBLIC;
GRANT ALL ON FUNCTION public.calendario_mio() TO authenticated;

--
-- Name: FUNCTION calendario_poner(p_torneos boolean, p_eventos boolean, p_lanzamientos boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calendario_poner(p_torneos boolean, p_eventos boolean, p_lanzamientos boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.calendario_poner(p_torneos boolean, p_eventos boolean, p_lanzamientos boolean) TO authenticated;

--
-- Name: TABLE trade_offers; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.trade_offers TO authenticated;

--
-- Name: FUNCTION cambio_aceptar(p_oferta uuid, p_envio text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_aceptar(p_oferta uuid, p_envio text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_aceptar(p_oferta uuid, p_envio text) TO authenticated;

--
-- Name: FUNCTION cambio_avisar(p_oferta uuid, p_de uuid, p_para uuid, p_tipo text, p_titulo text, p_texto text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_avisar(p_oferta uuid, p_de uuid, p_para uuid, p_tipo text, p_titulo text, p_texto text) FROM PUBLIC;

--
-- Name: FUNCTION cambio_cobro_poner(p_oferta uuid, p_dato text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_cobro_poner(p_oferta uuid, p_dato text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_cobro_poner(p_oferta uuid, p_dato text) TO authenticated;

--
-- Name: FUNCTION cambio_cobros(p_ofertas uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_cobros(p_ofertas uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_cobros(p_ofertas uuid[]) TO authenticated;

--
-- Name: FUNCTION cambio_contestar(p_oferta uuid, p_accion text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_contestar(p_oferta uuid, p_accion text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_contestar(p_oferta uuid, p_accion text) TO authenticated;

--
-- Name: FUNCTION cambio_conversacion(p_a uuid, p_b uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_conversacion(p_a uuid, p_b uuid) FROM PUBLIC;

--
-- Name: FUNCTION cambio_deshacer(p_oferta uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_deshacer(p_oferta uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_deshacer(p_oferta uuid) TO authenticated;

--
-- Name: FUNCTION cambio_direccion_poner(p_oferta uuid, p_dir jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_direccion_poner(p_oferta uuid, p_dir jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_direccion_poner(p_oferta uuid, p_dir jsonb) TO authenticated;

--
-- Name: FUNCTION cambio_direcciones(p_ofertas uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_direcciones(p_ofertas uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_direcciones(p_ofertas uuid[]) TO authenticated;

--
-- Name: FUNCTION cambio_direcciones_purgar(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_direcciones_purgar() FROM PUBLIC;

--
-- Name: FUNCTION cambio_enviado(p_oferta uuid, p_seguimiento text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_enviado(p_oferta uuid, p_seguimiento text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_enviado(p_oferta uuid, p_seguimiento text) TO authenticated;

--
-- Name: FUNCTION cambio_envio_poner(p_oferta uuid, p_envio text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_envio_poner(p_oferta uuid, p_envio text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_envio_poner(p_oferta uuid, p_envio text) TO authenticated;

--
-- Name: FUNCTION cambio_envio_tarifa(p_valor numeric, p_cartas integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cambio_envio_tarifa(p_valor numeric, p_cartas integer) TO anon;
GRANT ALL ON FUNCTION public.cambio_envio_tarifa(p_valor numeric, p_cartas integer) TO authenticated;

--
-- Name: FUNCTION cambio_libres_de(p_linea uuid, p_cambio integer, p_cantidad integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_libres_de(p_linea uuid, p_cambio integer, p_cantidad integer) FROM PUBLIC;

--
-- Name: FUNCTION cambio_lo_que_da(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_lo_que_da(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_lo_que_da(p_user uuid) TO authenticated;

--
-- Name: FUNCTION cambio_lo_tengo(p_oferta uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_lo_tengo(p_oferta uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_lo_tengo(p_oferta uuid) TO authenticated;

--
-- Name: FUNCTION cambio_marcar(p_otro uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_marcar(p_otro uuid) FROM PUBLIC;

--
-- Name: FUNCTION cambio_mover(p_oferta uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_mover(p_oferta uuid) FROM PUBLIC;

--
-- Name: FUNCTION cambio_proponer(p_para uuid, p_items jsonb, p_dinero numeric, p_paga text, p_como text, p_nota text, p_anterior uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_proponer(p_para uuid, p_items jsonb, p_dinero numeric, p_paga text, p_como text, p_nota text, p_anterior uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cambio_proponer(p_para uuid, p_items jsonb, p_dinero numeric, p_paga text, p_como text, p_nota text, p_anterior uuid) TO authenticated;

--
-- Name: FUNCTION cambio_quien_cobra(p_oferta uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_quien_cobra(p_oferta uuid) FROM PUBLIC;

--
-- Name: FUNCTION cambio_recibe_algo(p_oferta uuid, p_quien uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_recibe_algo(p_oferta uuid, p_quien uuid) FROM PUBLIC;

--
-- Name: FUNCTION cambio_reservadas_linea(p_linea uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_reservadas_linea(p_linea uuid) FROM PUBLIC;

--
-- Name: FUNCTION cambio_sin_esperar(p_oferta uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cambio_sin_esperar(p_oferta uuid) FROM PUBLIC;

--
-- Name: FUNCTION cambio_valorar(p_id uuid, p_valor text, p_nota text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cambio_valorar(p_id uuid, p_valor text, p_nota text) TO authenticated;

--
-- Name: FUNCTION cambios_de(p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cambios_de(p_user uuid) TO anon;
GRANT ALL ON FUNCTION public.cambios_de(p_user uuid) TO authenticated;

--
-- Name: FUNCTION cambios_reservadas(p_cards text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.cambios_reservadas(p_cards text[]) TO anon;
GRANT ALL ON FUNCTION public.cambios_reservadas(p_cards text[]) TO authenticated;

--
-- Name: FUNCTION cardmarket_guardar_pares(p_pares jsonb, p_market text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cardmarket_guardar_pares(p_pares jsonb, p_market text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cardmarket_guardar_pares(p_pares jsonb, p_market text) TO service_role;

--
-- Name: FUNCTION carpetas_resumen(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.carpetas_resumen() FROM PUBLIC;
GRANT ALL ON FUNCTION public.carpetas_resumen() TO authenticated;
GRANT ALL ON FUNCTION public.carpetas_resumen() TO service_role;

--
-- Name: FUNCTION catalogo_borrar_carta(p_id text, p_market text, p_destino text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_borrar_carta(p_id text, p_market text, p_destino text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_borrar_carta(p_id text, p_market text, p_destino text) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_borrar_carta(p_id text, p_market text, p_destino text) TO service_role;

--
-- Name: FUNCTION catalogo_borrar_version_mano(p_tcggo_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_borrar_version_mano(p_tcggo_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_borrar_version_mano(p_tcggo_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_borrar_version_mano(p_tcggo_id integer) TO service_role;

--
-- Name: FUNCTION catalogo_corregir(p_tabla text, p_id text, p_market text, p_cambios jsonb, p_crear boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_corregir(p_tabla text, p_id text, p_market text, p_cambios jsonb, p_crear boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_corregir(p_tabla text, p_id text, p_market text, p_cambios jsonb, p_crear boolean) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_corregir(p_tabla text, p_id text, p_market text, p_cambios jsonb, p_crear boolean) TO service_role;

--
-- Name: FUNCTION catalogo_descorregir(p_tabla text, p_id text, p_market text, p_columna text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_descorregir(p_tabla text, p_id text, p_market text, p_columna text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_descorregir(p_tabla text, p_id text, p_market text, p_columna text) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_descorregir(p_tabla text, p_id text, p_market text, p_columna text) TO service_role;

--
-- Name: FUNCTION catalogo_idioma_de_set(p_set text, p_market text, p_idioma text, p_hay boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_idioma_de_set(p_set text, p_market text, p_idioma text, p_hay boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_idioma_de_set(p_set text, p_market text, p_idioma text, p_hay boolean) TO authenticated;

--
-- Name: FUNCTION catalogo_posibles_repetidas(p_market text, p_limite integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_posibles_repetidas(p_market text, p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_posibles_repetidas(p_market text, p_limite integer) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_posibles_repetidas(p_market text, p_limite integer) TO service_role;

--
-- Name: FUNCTION catalogo_quien_tiene_carta(p_id text, p_market text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_quien_tiene_carta(p_id text, p_market text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_quien_tiene_carta(p_id text, p_market text) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_quien_tiene_carta(p_id text, p_market text) TO service_role;

--
-- Name: FUNCTION catalogo_repetida_deshacer(p_hecha bigint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_repetida_deshacer(p_hecha bigint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_repetida_deshacer(p_hecha bigint) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_repetida_deshacer(p_hecha bigint) TO service_role;

--
-- Name: FUNCTION catalogo_repetida_resolver(p_carta text, p_destino text, p_market text, p_decision text, p_etiqueta text, p_clase text, p_imagen text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_repetida_resolver(p_carta text, p_destino text, p_market text, p_decision text, p_etiqueta text, p_clase text, p_imagen text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_repetida_resolver(p_carta text, p_destino text, p_market text, p_decision text, p_etiqueta text, p_clase text, p_imagen text) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_repetida_resolver(p_carta text, p_destino text, p_market text, p_decision text, p_etiqueta text, p_clase text, p_imagen text) TO service_role;

--
-- Name: FUNCTION catalogo_repetidas_distintas(p_market text, p_set text, p_numero text, p_nombre text, p_ids text[], p_quitar boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_repetidas_distintas(p_market text, p_set text, p_numero text, p_nombre text, p_ids text[], p_quitar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_repetidas_distintas(p_market text, p_set text, p_numero text, p_nombre text, p_ids text[], p_quitar boolean) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_repetidas_distintas(p_market text, p_set text, p_numero text, p_nombre text, p_ids text[], p_quitar boolean) TO service_role;

--
-- Name: FUNCTION catalogo_version_de_idioma(p_set text, p_market text, p_variante text, p_idioma text, p_hay boolean, p_carta text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_version_de_idioma(p_set text, p_market text, p_variante text, p_idioma text, p_hay boolean, p_carta text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_version_de_idioma(p_set text, p_market text, p_variante text, p_idioma text, p_hay boolean, p_carta text) TO authenticated;

--
-- Name: FUNCTION catalogo_version_foto(p_card_id text, p_market text, p_variante text, p_imagen text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_version_foto(p_card_id text, p_market text, p_variante text, p_imagen text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_version_foto(p_card_id text, p_market text, p_variante text, p_imagen text) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_version_foto(p_card_id text, p_market text, p_variante text, p_imagen text) TO service_role;

--
-- Name: FUNCTION catalogo_version_mano(p_card_id text, p_market text, p_datos jsonb, p_tcggo_id integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_version_mano(p_card_id text, p_market text, p_datos jsonb, p_tcggo_id integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_version_mano(p_card_id text, p_market text, p_datos jsonb, p_tcggo_id integer) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_version_mano(p_card_id text, p_market text, p_datos jsonb, p_tcggo_id integer) TO service_role;

--
-- Name: FUNCTION catalogo_versiones_lote(p_market text, p_cartas text[], p_etiquetas text[], p_quitar boolean, p_mover boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.catalogo_versiones_lote(p_market text, p_cartas text[], p_etiquetas text[], p_quitar boolean, p_mover boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.catalogo_versiones_lote(p_market text, p_cartas text[], p_etiquetas text[], p_quitar boolean, p_mover boolean) TO authenticated;
GRANT ALL ON FUNCTION public.catalogo_versiones_lote(p_market text, p_cartas text[], p_etiquetas text[], p_quitar boolean, p_mover boolean) TO service_role;

--
-- Name: FUNCTION cerrar_sesion(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cerrar_sesion(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cerrar_sesion(p_id uuid) TO authenticated;

--
-- Name: FUNCTION coleccion_es_publica(p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.coleccion_es_publica(p_user uuid) TO anon;
GRANT ALL ON FUNCTION public.coleccion_es_publica(p_user uuid) TO authenticated;

--
-- Name: FUNCTION coleccion_foto_diaria(p_dia date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.coleccion_foto_diaria(p_dia date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.coleccion_foto_diaria(p_dia date) TO service_role;

--
-- Name: FUNCTION coleccion_por_set(p_market text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.coleccion_por_set(p_market text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.coleccion_por_set(p_market text) TO authenticated;

--
-- Name: FUNCTION coleccion_quien_la_tiene(p_card_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.coleccion_quien_la_tiene(p_card_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.coleccion_quien_la_tiene(p_card_id text) TO authenticated;
GRANT ALL ON FUNCTION public.coleccion_quien_la_tiene(p_card_id text) TO service_role;

--
-- Name: FUNCTION coleccion_quien_la_tiene_todos(p_card_id text, p_limite integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.coleccion_quien_la_tiene_todos(p_card_id text, p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.coleccion_quien_la_tiene_todos(p_card_id text, p_limite integer) TO anon;
GRANT ALL ON FUNCTION public.coleccion_quien_la_tiene_todos(p_card_id text, p_limite integer) TO authenticated;
GRANT ALL ON FUNCTION public.coleccion_quien_la_tiene_todos(p_card_id text, p_limite integer) TO service_role;

--
-- Name: FUNCTION coleccion_seguidos_y_mis_deseos(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.coleccion_seguidos_y_mis_deseos() FROM PUBLIC;
GRANT ALL ON FUNCTION public.coleccion_seguidos_y_mis_deseos() TO authenticated;
GRANT ALL ON FUNCTION public.coleccion_seguidos_y_mis_deseos() TO service_role;

--
-- Name: FUNCTION coleccion_valor_de(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.coleccion_valor_de(p_user uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.coleccion_valor_de(p_user uuid) TO anon;
GRANT ALL ON FUNCTION public.coleccion_valor_de(p_user uuid) TO authenticated;

--
-- Name: FUNCTION course_leaderboard(p_guide_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.course_leaderboard(p_guide_id uuid, p_limit integer) TO anon;
GRANT ALL ON FUNCTION public.course_leaderboard(p_guide_id uuid, p_limit integer) TO authenticated;

--
-- Name: FUNCTION cuenta_borrado_pendiente(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cuenta_borrado_pendiente() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cuenta_borrado_pendiente() TO authenticated;

--
-- Name: FUNCTION cuenta_borrar(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cuenta_borrar(p_user uuid) FROM PUBLIC;

--
-- Name: FUNCTION cuenta_cancelar_borrado(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cuenta_cancelar_borrado() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cuenta_cancelar_borrado() TO authenticated;

--
-- Name: FUNCTION cuenta_pedir_borrado(p_motivo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cuenta_pedir_borrado(p_motivo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cuenta_pedir_borrado(p_motivo text) TO authenticated;

--
-- Name: FUNCTION cuentas_borrar_vencidas(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cuentas_borrar_vencidas() FROM PUBLIC;

--
-- Name: FUNCTION email_outbox_errores(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.email_outbox_errores() FROM PUBLIC;
GRANT ALL ON FUNCTION public.email_outbox_errores() TO authenticated;

--
-- Name: FUNCTION email_outbox_resumen(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.email_outbox_resumen() FROM PUBLIC;
GRANT ALL ON FUNCTION public.email_outbox_resumen() TO authenticated;

--
-- Name: FUNCTION enlace_corto_crear(p_tipo text, p_carga text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enlace_corto_crear(p_tipo text, p_carga text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enlace_corto_crear(p_tipo text, p_carga text) TO anon;
GRANT ALL ON FUNCTION public.enlace_corto_crear(p_tipo text, p_carga text) TO authenticated;
GRANT ALL ON FUNCTION public.enlace_corto_crear(p_tipo text, p_carga text) TO service_role;

--
-- Name: FUNCTION enlace_corto_leer(p_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enlace_corto_leer(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enlace_corto_leer(p_id text) TO anon;
GRANT ALL ON FUNCTION public.enlace_corto_leer(p_id text) TO authenticated;
GRANT ALL ON FUNCTION public.enlace_corto_leer(p_id text) TO service_role;

--
-- Name: FUNCTION enlaces_cortos_quien(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enlaces_cortos_quien() FROM PUBLIC;

--
-- Name: FUNCTION enqueue_email(p_recipient uuid, p_type text, p_subject text, p_preview text, p_link text, p_thread_key text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enqueue_email(p_recipient uuid, p_type text, p_subject text, p_preview text, p_link text, p_thread_key text) FROM PUBLIC;

--
-- Name: FUNCTION evento_ficha(p_slug text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.evento_ficha(p_slug text) TO anon;
GRANT ALL ON FUNCTION public.evento_ficha(p_slug text) TO authenticated;

--
-- Name: FUNCTION evento_hilo(p_evento uuid, p_titulo text, p_cuerpo text, p_prefijo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.evento_hilo(p_evento uuid, p_titulo text, p_cuerpo text, p_prefijo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.evento_hilo(p_evento uuid, p_titulo text, p_cuerpo text, p_prefijo text) TO authenticated;

--
-- Name: TABLE eventos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.eventos TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.eventos TO authenticated;

--
-- Name: FUNCTION evento_json(e public.eventos, p_caras integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.evento_json(e public.eventos, p_caras integer) FROM PUBLIC;

--
-- Name: FUNCTION evento_lista(p_lista uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.evento_lista(p_lista uuid) TO anon;
GRANT ALL ON FUNCTION public.evento_lista(p_lista uuid) TO authenticated;

--
-- Name: FUNCTION evento_voy(p_evento uuid, p_voy boolean, p_oculto boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.evento_voy(p_evento uuid, p_voy boolean, p_oculto boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.evento_voy(p_evento uuid, p_voy boolean, p_oculto boolean) TO authenticated;

--
-- Name: FUNCTION eventos_lista(p_desde timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.eventos_lista(p_desde timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.eventos_lista(p_desde timestamp with time zone) TO authenticated;

--
-- Name: FUNCTION foro_premiar_solucion(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.foro_premiar_solucion() FROM PUBLIC;

--
-- Name: FUNCTION foro_resumen(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.foro_resumen() FROM PUBLIC;
GRANT ALL ON FUNCTION public.foro_resumen() TO anon;
GRANT ALL ON FUNCTION public.foro_resumen() TO authenticated;

--
-- Name: FUNCTION foro_spam_revisar(p_post uuid, p_borrar boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.foro_spam_revisar(p_post uuid, p_borrar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.foro_spam_revisar(p_post uuid, p_borrar boolean) TO authenticated;

--
-- Name: FUNCTION forum_avisar_suscritos(p_thread uuid, p_post uuid, p_titulo text, p_ya_avisados uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.forum_avisar_suscritos(p_thread uuid, p_post uuid, p_titulo text, p_ya_avisados uuid[]) TO authenticated;

--
-- Name: FUNCTION forum_editar_encuesta(p_thread uuid, p_pregunta text, p_multiple boolean, p_opciones text[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.forum_editar_encuesta(p_thread uuid, p_pregunta text, p_multiple boolean, p_opciones text[]) TO authenticated;

--
-- Name: FUNCTION forum_ver_tema(p_thread uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.forum_ver_tema(p_thread uuid) TO anon;
GRANT ALL ON FUNCTION public.forum_ver_tema(p_thread uuid) TO authenticated;

--
-- Name: FUNCTION guardar_lo_que_no_es_del_autor(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.guardar_lo_que_no_es_del_autor() FROM PUBLIC;

--
-- Name: FUNCTION guides_cuenta_del_tema(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.guides_cuenta_del_tema() FROM PUBLIC;

--
-- Name: FUNCTION historial_foto_diaria(p_dia date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.historial_foto_diaria(p_dia date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.historial_foto_diaria(p_dia date) TO service_role;

--
-- Name: FUNCTION idiomas_de_set(p_set text, p_market text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.idiomas_de_set(p_set text, p_market text) TO anon;
GRANT ALL ON FUNCTION public.idiomas_de_set(p_set text, p_market text) TO authenticated;

--
-- Name: FUNCTION idiomas_de_set_calculados(p_set text, p_market text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.idiomas_de_set_calculados(p_set text, p_market text) TO anon;
GRANT ALL ON FUNCTION public.idiomas_de_set_calculados(p_set text, p_market text) TO authenticated;

--
-- Name: FUNCTION intercambios_de_carta(p_card_id text, p_limite integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.intercambios_de_carta(p_card_id text, p_limite integer) TO anon;
GRANT ALL ON FUNCTION public.intercambios_de_carta(p_card_id text, p_limite integer) TO authenticated;

--
-- Name: FUNCTION intercambios_de_persona(p_user uuid, p_limite integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.intercambios_de_persona(p_user uuid, p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.intercambios_de_persona(p_user uuid, p_limite integer) TO anon;
GRANT ALL ON FUNCTION public.intercambios_de_persona(p_user uuid, p_limite integer) TO authenticated;

--
-- Name: FUNCTION intercambios_mercado(p_market text, p_idioma text, p_texto text, p_sets text[], p_solo_mias boolean, p_orden text, p_limite integer, p_desde integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.intercambios_mercado(p_market text, p_idioma text, p_texto text, p_sets text[], p_solo_mias boolean, p_orden text, p_limite integer, p_desde integer) TO anon;
GRANT ALL ON FUNCTION public.intercambios_mercado(p_market text, p_idioma text, p_texto text, p_sets text[], p_solo_mias boolean, p_orden text, p_limite integer, p_desde integer) TO authenticated;

--
-- Name: FUNCTION intercambios_quien_busca(p_limite integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.intercambios_quien_busca(p_limite integer) TO authenticated;

--
-- Name: FUNCTION intercambios_quien_tiene(p_limite integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.intercambios_quien_tiene(p_limite integer) TO authenticated;

--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_admin() TO anon;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;

--
-- Name: FUNCTION is_staff(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.is_staff() TO anon;
GRANT ALL ON FUNCTION public.is_staff() TO authenticated;

--
-- Name: FUNCTION latido_en_linea(p_token text, p_thread uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.latido_en_linea(p_token text, p_thread uuid) TO anon;
GRANT ALL ON FUNCTION public.latido_en_linea(p_token text, p_thread uuid) TO authenticated;

--
-- Name: FUNCTION liga_listas_jornada(p_torneo uuid, p_jornada integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.liga_listas_jornada(p_torneo uuid, p_jornada integer) TO anon;
GRANT ALL ON FUNCTION public.liga_listas_jornada(p_torneo uuid, p_jornada integer) TO authenticated;

--
-- Name: FUNCTION logros_reparto(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.logros_reparto() TO anon;
GRANT ALL ON FUNCTION public.logros_reparto() TO authenticated;

--
-- Name: FUNCTION mensaje_reaccionable(p_mensaje uuid, p_conversacion uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mensaje_reaccionable(p_mensaje uuid, p_conversacion uuid) TO authenticated;

--
-- Name: FUNCTION mercado_con_tiendas(p_market text, p_idioma text, p_texto text, p_sets text[], p_solo_mias boolean, p_orden text, p_limite integer, p_desde integer, p_quien text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mercado_con_tiendas(p_market text, p_idioma text, p_texto text, p_sets text[], p_solo_mias boolean, p_orden text, p_limite integer, p_desde integer, p_quien text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.mercado_con_tiendas(p_market text, p_idioma text, p_texto text, p_sets text[], p_solo_mias boolean, p_orden text, p_limite integer, p_desde integer, p_quien text) TO anon;
GRANT ALL ON FUNCTION public.mercado_con_tiendas(p_market text, p_idioma text, p_texto text, p_sets text[], p_solo_mias boolean, p_orden text, p_limite integer, p_desde integer, p_quien text) TO authenticated;

--
-- Name: FUNCTION meta_dias(p_dias integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.meta_dias(p_dias integer) TO anon;
GRANT ALL ON FUNCTION public.meta_dias(p_dias integer) TO authenticated;

--
-- Name: FUNCTION meta_firmas(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.meta_firmas() TO anon;
GRANT ALL ON FUNCTION public.meta_firmas() TO authenticated;
GRANT ALL ON FUNCTION public.meta_firmas() TO service_role;

--
-- Name: FUNCTION meta_ingerir_torneo(p_torneo jsonb, p_clasificacion jsonb, p_top integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.meta_ingerir_torneo(p_torneo jsonb, p_clasificacion jsonb, p_top integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.meta_ingerir_torneo(p_torneo jsonb, p_clasificacion jsonb, p_top integer) TO service_role;

--
-- Name: FUNCTION meta_lista_media(p_arquetipo text, p_dias integer, p_fuente text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.meta_lista_media(p_arquetipo text, p_dias integer, p_fuente text) TO anon;
GRANT ALL ON FUNCTION public.meta_lista_media(p_arquetipo text, p_dias integer, p_fuente text) TO authenticated;

--
-- Name: FUNCTION meta_listas(p_arquetipo text, p_dias integer, p_limite integer, p_fuente text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.meta_listas(p_arquetipo text, p_dias integer, p_limite integer, p_fuente text) TO anon;
GRANT ALL ON FUNCTION public.meta_listas(p_arquetipo text, p_dias integer, p_limite integer, p_fuente text) TO authenticated;

--
-- Name: FUNCTION meta_resumen(p_dias integer, p_fuente text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.meta_resumen(p_dias integer, p_fuente text) TO anon;
GRANT ALL ON FUNCTION public.meta_resumen(p_dias integer, p_fuente text) TO authenticated;

--
-- Name: FUNCTION meta_totales(p_dias integer, p_fuente text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.meta_totales(p_dias integer, p_fuente text) TO anon;
GRANT ALL ON FUNCTION public.meta_totales(p_dias integer, p_fuente text) TO authenticated;

--
-- Name: FUNCTION mis_invitados(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mis_invitados() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mis_invitados() TO authenticated;

--
-- Name: FUNCTION mis_sesiones(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.mis_sesiones() FROM PUBLIC;
GRANT ALL ON FUNCTION public.mis_sesiones() TO authenticated;

--
-- Name: FUNCTION moderacion_al_dia(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.moderacion_al_dia() FROM PUBLIC;
GRANT ALL ON FUNCTION public.moderacion_al_dia() TO authenticated;
GRANT ALL ON FUNCTION public.moderacion_al_dia() TO service_role;

--
-- Name: FUNCTION on_collab_application(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_collab_application() FROM PUBLIC;

--
-- Name: FUNCTION on_comment_reply_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_comment_reply_email() FROM PUBLIC;

--
-- Name: FUNCTION on_forum_post_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_forum_post_email() FROM PUBLIC;

--
-- Name: FUNCTION on_guide_review_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_guide_review_email() FROM PUBLIC;

--
-- Name: FUNCTION on_new_follower_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_new_follower_email() FROM PUBLIC;

--
-- Name: FUNCTION on_private_message_email(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_private_message_email() FROM PUBLIC;

--
-- Name: FUNCTION pokedex_marcar(p_filas jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.pokedex_marcar(p_filas jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.pokedex_marcar(p_filas jsonb) TO service_role;

--
-- Name: FUNCTION pokedex_resumen(p_market text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.pokedex_resumen(p_market text) TO anon;
GRANT ALL ON FUNCTION public.pokedex_resumen(p_market text) TO authenticated;

--
-- Name: FUNCTION poner_padrino(p_padrino uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.poner_padrino(p_padrino uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.poner_padrino(p_padrino uuid) TO authenticated;

--
-- Name: FUNCTION portada_clasificacion(p_periodo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.portada_clasificacion(p_periodo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.portada_clasificacion(p_periodo text) TO anon;
GRANT ALL ON FUNCTION public.portada_clasificacion(p_periodo text) TO authenticated;

--
-- Name: FUNCTION portada_comunidad(p_limite integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.portada_comunidad(p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.portada_comunidad(p_limite integer) TO anon;
GRANT ALL ON FUNCTION public.portada_comunidad(p_limite integer) TO authenticated;

--
-- Name: FUNCTION portada_foro(p_desde timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.portada_foro(p_desde timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.portada_foro(p_desde timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.portada_foro(p_desde timestamp with time zone) TO authenticated;

--
-- Name: FUNCTION portada_hoy(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.portada_hoy() FROM PUBLIC;
GRANT ALL ON FUNCTION public.portada_hoy() TO authenticated;

--
-- Name: FUNCTION precios_pendientes(p_limite integer, p_horas integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.precios_pendientes(p_limite integer, p_horas integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.precios_pendientes(p_limite integer, p_horas integer) TO service_role;

--
-- Name: FUNCTION productos_por_expansion(p_market text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.productos_por_expansion(p_market text) TO anon;
GRANT ALL ON FUNCTION public.productos_por_expansion(p_market text) TO authenticated;

--
-- Name: FUNCTION puzles_crear(p_repeticion text, p_foto integer, p_pregunta text, p_opciones text[], p_correcta integer, p_explicacion text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.puzles_crear(p_repeticion text, p_foto integer, p_pregunta text, p_opciones text[], p_correcta integer, p_explicacion text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.puzles_crear(p_repeticion text, p_foto integer, p_pregunta text, p_opciones text[], p_correcta integer, p_explicacion text) TO authenticated;

--
-- Name: FUNCTION puzles_lista(p_limite integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.puzles_lista(p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.puzles_lista(p_limite integer) TO anon;
GRANT ALL ON FUNCTION public.puzles_lista(p_limite integer) TO authenticated;

--
-- Name: FUNCTION puzles_responder(p_puzle text, p_opcion integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.puzles_responder(p_puzle text, p_opcion integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.puzles_responder(p_puzle text, p_opcion integer) TO anon;
GRANT ALL ON FUNCTION public.puzles_responder(p_puzle text, p_opcion integer) TO authenticated;

--
-- Name: FUNCTION record_question_answer(p_guide_id uuid, p_question_key text, p_correct boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.record_question_answer(p_guide_id uuid, p_question_key text, p_correct boolean) TO authenticated;

--
-- Name: FUNCTION repeticion_compartida(p_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.repeticion_compartida(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.repeticion_compartida(p_id text) TO anon;
GRANT ALL ON FUNCTION public.repeticion_compartida(p_id text) TO authenticated;

--
-- Name: FUNCTION repeticiones_guardar(p_registro text, p_titulo text, p_jugadores text[], p_ganador text, p_turnos integer, p_compartida boolean, p_mazos text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.repeticiones_guardar(p_registro text, p_titulo text, p_jugadores text[], p_ganador text, p_turnos integer, p_compartida boolean, p_mazos text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.repeticiones_guardar(p_registro text, p_titulo text, p_jugadores text[], p_ganador text, p_turnos integer, p_compartida boolean, p_mazos text[]) TO authenticated;
GRANT ALL ON FUNCTION public.repeticiones_guardar(p_registro text, p_titulo text, p_jugadores text[], p_ganador text, p_turnos integer, p_compartida boolean, p_mazos text[]) TO service_role;

--
-- Name: FUNCTION repeticiones_juez_de(p_torneo uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.repeticiones_juez_de(p_torneo uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.repeticiones_juez_de(p_torneo uuid) TO authenticated;
GRANT ALL ON FUNCTION public.repeticiones_juez_de(p_torneo uuid) TO service_role;

--
-- Name: FUNCTION repeticiones_leer(p_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.repeticiones_leer(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.repeticiones_leer(p_id text) TO anon;
GRANT ALL ON FUNCTION public.repeticiones_leer(p_id text) TO authenticated;
GRANT ALL ON FUNCTION public.repeticiones_leer(p_id text) TO service_role;

--
-- Name: FUNCTION repeticiones_publicar(p_id text, p_publica boolean, p_arquetipos text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.repeticiones_publicar(p_id text, p_publica boolean, p_arquetipos text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.repeticiones_publicar(p_id text, p_publica boolean, p_arquetipos text[]) TO authenticated;

--
-- Name: FUNCTION repeticiones_publicas(p_arquetipo text, p_limite integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.repeticiones_publicas(p_arquetipo text, p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.repeticiones_publicas(p_arquetipo text, p_limite integer) TO anon;
GRANT ALL ON FUNCTION public.repeticiones_publicas(p_arquetipo text, p_limite integer) TO authenticated;

--
-- Name: FUNCTION repeticiones_resumen(p_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.repeticiones_resumen(p_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.repeticiones_resumen(p_id text) TO anon;
GRANT ALL ON FUNCTION public.repeticiones_resumen(p_id text) TO authenticated;
GRANT ALL ON FUNCTION public.repeticiones_resumen(p_id text) TO service_role;

--
-- Name: FUNCTION replays_tope(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.replays_tope() FROM PUBLIC;

--
-- Name: FUNCTION reputacion_de(p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.reputacion_de(p_user uuid) TO anon;
GRANT ALL ON FUNCTION public.reputacion_de(p_user uuid) TO authenticated;

--
-- Name: FUNCTION retos_carta_det(p_id text, p_r jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_carta_det(p_id text, p_r jsonb) FROM PUBLIC;

--
-- Name: FUNCTION retos_comunidad(p_dia date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_comunidad(p_dia date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.retos_comunidad(p_dia date) TO anon;
GRANT ALL ON FUNCTION public.retos_comunidad(p_dia date) TO authenticated;

--
-- Name: FUNCTION retos_dias_de(p_user uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_dias_de(p_user uuid) FROM PUBLIC;

--
-- Name: FUNCTION retos_estadisticas(p_juego text, p_dia date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_estadisticas(p_juego text, p_dia date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.retos_estadisticas(p_juego text, p_dia date) TO anon;
GRANT ALL ON FUNCTION public.retos_estadisticas(p_juego text, p_dia date) TO authenticated;

--
-- Name: FUNCTION retos_estado_inicial(p_juego text, p_dia date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_estado_inicial(p_juego text, p_dia date) FROM PUBLIC;

--
-- Name: FUNCTION retos_guardar(p_juego text, p_dia date, p_aciertos integer, p_total integer, p_intentos integer, p_acertada boolean, p_tira boolean[], p_estado jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_guardar(p_juego text, p_dia date, p_aciertos integer, p_total integer, p_intentos integer, p_acertada boolean, p_tira boolean[], p_estado jsonb) FROM PUBLIC;

--
-- Name: FUNCTION retos_jugar(p_juego text, p_dia date, p_libre integer, p_jugada jsonb, p_ficha text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_jugar(p_juego text, p_dia date, p_libre integer, p_jugada jsonb, p_ficha text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.retos_jugar(p_juego text, p_dia date, p_libre integer, p_jugada jsonb, p_ficha text) TO anon;
GRANT ALL ON FUNCTION public.retos_jugar(p_juego text, p_dia date, p_libre integer, p_jugada jsonb, p_ficha text) TO authenticated;

--
-- Name: FUNCTION retos_mis_numeros(p_dias integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_mis_numeros(p_dias integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.retos_mis_numeros(p_dias integer) TO authenticated;

--
-- Name: FUNCTION retos_mover(p_juego text, p_datos jsonb, e jsonb, j jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_mover(p_juego text, p_datos jsonb, e jsonb, j jsonb) FROM PUBLIC;

--
-- Name: FUNCTION retos_ordena_bien(p_precios jsonb, p_orden jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_ordena_bien(p_precios jsonb, p_orden jsonb) FROM PUBLIC;

--
-- Name: FUNCTION retos_racha_de(p_user uuid, p_hasta date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_racha_de(p_user uuid, p_hasta date) FROM PUBLIC;

--
-- Name: FUNCTION retos_resultado(p_juego text, e jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_resultado(p_juego text, e jsonb) FROM PUBLIC;

--
-- Name: FUNCTION retos_terminada(p_juego text, p_datos jsonb, e jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_terminada(p_juego text, p_datos jsonb, e jsonb) FROM PUBLIC;

--
-- Name: FUNCTION retos_vista(p_juego text, p_datos jsonb, e jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.retos_vista(p_juego text, p_datos jsonb, e jsonb) FROM PUBLIC;

--
-- Name: FUNCTION sesion_cumple_mfa(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sesion_cumple_mfa() TO authenticated;

--
-- Name: FUNCTION sin_freno(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.sin_freno() TO authenticated;

--
-- Name: TABLE tcg_card_prices; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tcg_card_prices TO anon;
GRANT SELECT ON TABLE public.tcg_card_prices TO authenticated;

--
-- Name: TABLE user_collection; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_collection TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_collection TO authenticated;

--
-- Name: FUNCTION sobre_cifras(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sobre_cifras() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sobre_cifras() TO anon;
GRANT ALL ON FUNCTION public.sobre_cifras() TO authenticated;

--
-- Name: FUNCTION soy_tienda(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.soy_tienda() FROM PUBLIC;
GRANT ALL ON FUNCTION public.soy_tienda() TO authenticated;

--
-- Name: FUNCTION tcggo_crear_sets(p_sets jsonb, p_market text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tcggo_crear_sets(p_sets jsonb, p_market text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tcggo_crear_sets(p_sets jsonb, p_market text) TO service_role;

--
-- Name: FUNCTION tcggo_guardar_cartas(p_cartas jsonb, p_market text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tcggo_guardar_cartas(p_cartas jsonb, p_market text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tcggo_guardar_cartas(p_cartas jsonb, p_market text) TO service_role;

--
-- Name: FUNCTION tcggo_guardar_sets(p_sets jsonb, p_market text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tcggo_guardar_sets(p_sets jsonb, p_market text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tcggo_guardar_sets(p_sets jsonb, p_market text) TO service_role;

--
-- Name: FUNCTION tienda_alta(p_token uuid, p_username text, p_nombre text, p_ciudad text, p_direccion text, p_web text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_alta(p_token uuid, p_username text, p_nombre text, p_ciudad text, p_direccion text, p_web text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_alta(p_token uuid, p_username text, p_nombre text, p_ciudad text, p_direccion text, p_web text) TO authenticated;

--
-- Name: FUNCTION tienda_apartar(p_stock uuid, p_unidades integer, p_para text, p_hasta timestamp with time zone, p_precio numeric, p_nota text, p_para_usuario uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_apartar(p_stock uuid, p_unidades integer, p_para text, p_hasta timestamp with time zone, p_precio numeric, p_nota text, p_para_usuario uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_apartar(p_stock uuid, p_unidades integer, p_para text, p_hasta timestamp with time zone, p_precio numeric, p_nota text, p_para_usuario uuid) TO authenticated;

--
-- Name: FUNCTION tienda_apuntar_valor(p_zona text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_apuntar_valor(p_zona text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_apuntar_valor(p_zona text) TO authenticated;

--
-- Name: FUNCTION tienda_avisar(p_card text, p_market text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_avisar(p_card text, p_market text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_avisar(p_card text, p_market text) TO authenticated;

--
-- Name: FUNCTION tienda_avisos_de(p_cartas jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_avisos_de(p_cartas jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_avisos_de(p_cartas jsonb) TO authenticated;

--
-- Name: FUNCTION tienda_cambio(p_te_da jsonb, p_le_das jsonb, p_pago text, p_cliente text, p_donde text, p_pct integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_cambio(p_te_da jsonb, p_le_das jsonb, p_pago text, p_cliente text, p_donde text, p_pct integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_cambio(p_te_da jsonb, p_le_das jsonb, p_pago text, p_cliente text, p_donde text, p_pct integer) TO authenticated;

--
-- Name: FUNCTION tienda_cifras(p_desde timestamp with time zone, p_hasta timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_cifras(p_desde timestamp with time zone, p_hasta timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_cifras(p_desde timestamp with time zone, p_hasta timestamp with time zone) TO authenticated;

--
-- Name: FUNCTION tienda_cobros_mios(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_cobros_mios() FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_cobros_mios() TO authenticated;

--
-- Name: FUNCTION tienda_cobros_poner(p_pagos text[], p_bizum text, p_paypal text, p_minimo integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_cobros_poner(p_pagos text[], p_bizum text, p_paypal text, p_minimo integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_cobros_poner(p_pagos text[], p_bizum text, p_paypal text, p_minimo integer) TO authenticated;

--
-- Name: FUNCTION tienda_comprar(p_lineas jsonb, p_cliente text, p_pago text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_comprar(p_lineas jsonb, p_cliente text, p_pago text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_comprar(p_lineas jsonb, p_cliente text, p_pago text) TO authenticated;

--
-- Name: FUNCTION tienda_compras_lista(p_filtros jsonb, p_desde integer, p_cuantas integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_compras_lista(p_filtros jsonb, p_desde integer, p_cuantas integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_compras_lista(p_filtros jsonb, p_desde integer, p_cuantas integer) TO authenticated;

--
-- Name: FUNCTION tienda_condiciones(p_tienda uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_condiciones(p_tienda uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_condiciones(p_tienda uuid) TO anon;
GRANT ALL ON FUNCTION public.tienda_condiciones(p_tienda uuid) TO authenticated;

--
-- Name: FUNCTION tienda_contar_visita(p_tienda uuid, p_qr boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_contar_visita(p_tienda uuid, p_qr boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_contar_visita(p_tienda uuid, p_qr boolean) TO anon;
GRANT ALL ON FUNCTION public.tienda_contar_visita(p_tienda uuid, p_qr boolean) TO authenticated;

--
-- Name: FUNCTION tienda_decidir(p_id uuid, p_aceptar boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_decidir(p_id uuid, p_aceptar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_decidir(p_id uuid, p_aceptar boolean) TO authenticated;
GRANT ALL ON FUNCTION public.tienda_decidir(p_id uuid, p_aceptar boolean) TO service_role;

--
-- Name: FUNCTION tienda_deshacer_cambio(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_deshacer_cambio(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_deshacer_cambio(p_id uuid) TO authenticated;

--
-- Name: FUNCTION tienda_deshacer_compra(p_ticket uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_deshacer_compra(p_ticket uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_deshacer_compra(p_ticket uuid) TO authenticated;

--
-- Name: FUNCTION tienda_deshacer_venta(p_ticket uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_deshacer_venta(p_ticket uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_deshacer_venta(p_ticket uuid) TO authenticated;

--
-- Name: FUNCTION tienda_escaparate(p_tienda uuid, p_filtros jsonb, p_orden text, p_desde integer, p_cuantas integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_escaparate(p_tienda uuid, p_filtros jsonb, p_orden text, p_desde integer, p_cuantas integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_escaparate(p_tienda uuid, p_filtros jsonb, p_orden text, p_desde integer, p_cuantas integer) TO anon;
GRANT ALL ON FUNCTION public.tienda_escaparate(p_tienda uuid, p_filtros jsonb, p_orden text, p_desde integer, p_cuantas integer) TO authenticated;

--
-- Name: FUNCTION tienda_foto_puedo(p_stock uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_foto_puedo(p_stock uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_foto_puedo(p_stock uuid) TO authenticated;

--
-- Name: FUNCTION tienda_foto_se_ve(p_stock uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_foto_se_ve(p_stock uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_foto_se_ve(p_stock uuid) TO anon;
GRANT ALL ON FUNCTION public.tienda_foto_se_ve(p_stock uuid) TO authenticated;

--
-- Name: FUNCTION tienda_fotos_avisar(p_stock uuid, p_de uuid, p_para uuid, p_evento text, p_titulo text, p_texto text, p_link text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_fotos_avisar(p_stock uuid, p_de uuid, p_para uuid, p_evento text, p_titulo text, p_texto text, p_link text) FROM PUBLIC;

--
-- Name: FUNCTION tienda_fotos_pedidas_lista(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_fotos_pedidas_lista() FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_fotos_pedidas_lista() TO authenticated;

--
-- Name: FUNCTION tienda_fotos_quitar(p_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_fotos_quitar(p_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_fotos_quitar(p_id uuid) TO authenticated;

--
-- Name: FUNCTION tienda_fotos_subidas(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_fotos_subidas() FROM PUBLIC;

--
-- Name: FUNCTION tienda_hoy(p_desde timestamp with time zone, p_hasta timestamp with time zone, p_antes_desde timestamp with time zone, p_antes_hasta timestamp with time zone, p_paso text, p_zona text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_hoy(p_desde timestamp with time zone, p_hasta timestamp with time zone, p_antes_desde timestamp with time zone, p_antes_hasta timestamp with time zone, p_paso text, p_zona text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_hoy(p_desde timestamp with time zone, p_hasta timestamp with time zone, p_antes_desde timestamp with time zone, p_antes_hasta timestamp with time zone, p_paso text, p_zona text) TO authenticated;

--
-- Name: FUNCTION tienda_invitacion(p_token uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_invitacion(p_token uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_invitacion(p_token uuid) TO anon;
GRANT ALL ON FUNCTION public.tienda_invitacion(p_token uuid) TO authenticated;

--
-- Name: FUNCTION tienda_lote_desglosar(p_lote uuid, p_lineas jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_lote_desglosar(p_lote uuid, p_lineas jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_lote_desglosar(p_lote uuid, p_lineas jsonb) TO authenticated;

--
-- Name: FUNCTION tienda_oferta_avisar(p_oferta uuid, p_de uuid, p_para uuid, p_evento text, p_titulo text, p_texto text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_oferta_avisar(p_oferta uuid, p_de uuid, p_para uuid, p_evento text, p_titulo text, p_texto text) FROM PUBLIC;

--
-- Name: FUNCTION tienda_oferta_con_paso(p_pasos jsonb, p_quien text, p_que text, p_precio numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_oferta_con_paso(p_pasos jsonb, p_quien text, p_que text, p_precio numeric) FROM PUBLIC;

--
-- Name: FUNCTION tienda_oferta_enviar(p_stock uuid, p_precio numeric, p_envio text, p_pago text, p_unidades integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_oferta_enviar(p_stock uuid, p_precio numeric, p_envio text, p_pago text, p_unidades integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_oferta_enviar(p_stock uuid, p_precio numeric, p_envio text, p_pago text, p_unidades integer) TO authenticated;

--
-- Name: FUNCTION tienda_oferta_paso(p_oferta uuid, p_paso text, p_seguimiento text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_oferta_paso(p_oferta uuid, p_paso text, p_seguimiento text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_oferta_paso(p_oferta uuid, p_paso text, p_seguimiento text) TO authenticated;

--
-- Name: FUNCTION tienda_oferta_responder(p_oferta uuid, p_accion text, p_precio numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_oferta_responder(p_oferta uuid, p_accion text, p_precio numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_oferta_responder(p_oferta uuid, p_accion text, p_precio numeric) TO authenticated;

--
-- Name: FUNCTION tienda_oferta_ver(p_oferta uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_oferta_ver(p_oferta uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_oferta_ver(p_oferta uuid) TO authenticated;

--
-- Name: FUNCTION tienda_ofertas_al_dia(p_tienda uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_ofertas_al_dia(p_tienda uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_ofertas_al_dia(p_tienda uuid) TO anon;
GRANT ALL ON FUNCTION public.tienda_ofertas_al_dia(p_tienda uuid) TO authenticated;

--
-- Name: FUNCTION tienda_ofertas_lista(p_que text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_ofertas_lista(p_que text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_ofertas_lista(p_que text) TO authenticated;

--
-- Name: FUNCTION tienda_pedir(p_nombre text, p_ciudad text, p_email text, p_contacto text, p_web text, p_tamano text, p_instagram text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_pedir(p_nombre text, p_ciudad text, p_email text, p_contacto text, p_web text, p_tamano text, p_instagram text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_pedir(p_nombre text, p_ciudad text, p_email text, p_contacto text, p_web text, p_tamano text, p_instagram text) TO anon;
GRANT ALL ON FUNCTION public.tienda_pedir(p_nombre text, p_ciudad text, p_email text, p_contacto text, p_web text, p_tamano text, p_instagram text) TO authenticated;

--
-- Name: FUNCTION tienda_pedir_fotos(p_stock uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_pedir_fotos(p_stock uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_pedir_fotos(p_stock uuid) TO authenticated;

--
-- Name: FUNCTION tienda_poner_a_la_venta(p_ids uuid[], p_precio numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_poner_a_la_venta(p_ids uuid[], p_precio numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_poner_a_la_venta(p_ids uuid[], p_precio numeric) TO authenticated;

--
-- Name: FUNCTION tienda_por_avisar(p_tienda uuid, p_card text, p_market text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_por_avisar(p_tienda uuid, p_card text, p_market text) FROM PUBLIC;

--
-- Name: FUNCTION tienda_precio_de(p_precio numeric, p_oferta numeric, p_hasta timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tienda_precio_de(p_precio numeric, p_oferta numeric, p_hasta timestamp with time zone) TO anon;
GRANT ALL ON FUNCTION public.tienda_precio_de(p_precio numeric, p_oferta numeric, p_hasta timestamp with time zone) TO authenticated;

--
-- Name: FUNCTION tienda_publica(p_tienda uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tienda_publica(p_tienda uuid) TO anon;
GRANT ALL ON FUNCTION public.tienda_publica(p_tienda uuid) TO authenticated;

--
-- Name: FUNCTION tienda_repartir(p_total numeric, p_lineas jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_repartir(p_total numeric, p_lineas jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_repartir(p_total numeric, p_lineas jsonb) TO authenticated;

--
-- Name: FUNCTION tienda_reserva_quitar(p_reserva uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_reserva_quitar(p_reserva uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_reserva_quitar(p_reserva uuid) TO authenticated;

--
-- Name: FUNCTION tienda_reserva_recoger(p_reserva uuid, p_precio numeric, p_donde text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_reserva_recoger(p_reserva uuid, p_precio numeric, p_donde text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_reserva_recoger(p_reserva uuid, p_precio numeric, p_donde text) TO authenticated;

--
-- Name: FUNCTION tienda_reservas_al_dia(p_tienda uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_reservas_al_dia(p_tienda uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_reservas_al_dia(p_tienda uuid) TO anon;
GRANT ALL ON FUNCTION public.tienda_reservas_al_dia(p_tienda uuid) TO authenticated;

--
-- Name: FUNCTION tienda_reservas_lista(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_reservas_lista() FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_reservas_lista() TO authenticated;

--
-- Name: FUNCTION tienda_sku(p_codigo text, p_set text, p_numero text, p_idioma text, p_estado text, p_gradeo text, p_variante text, p_producto text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tienda_sku(p_codigo text, p_set text, p_numero text, p_idioma text, p_estado text, p_gradeo text, p_variante text, p_producto text) TO anon;
GRANT ALL ON FUNCTION public.tienda_sku(p_codigo text, p_set text, p_numero text, p_idioma text, p_estado text, p_gradeo text, p_variante text, p_producto text) TO authenticated;

--
-- Name: FUNCTION tienda_sku_buscar(p_tienda uuid, p_sku text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tienda_sku_buscar(p_tienda uuid, p_sku text) TO anon;
GRANT ALL ON FUNCTION public.tienda_sku_buscar(p_tienda uuid, p_sku text) TO authenticated;

--
-- Name: FUNCTION tienda_sku_de(p_stock uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_sku_de(p_stock uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_sku_de(p_stock uuid) TO authenticated;

--
-- Name: FUNCTION tienda_sku_limpio(p text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tienda_sku_limpio(p text) TO anon;
GRANT ALL ON FUNCTION public.tienda_sku_limpio(p text) TO authenticated;

--
-- Name: FUNCTION tienda_sku_version(p text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tienda_sku_version(p text) TO anon;
GRANT ALL ON FUNCTION public.tienda_sku_version(p text) TO authenticated;

--
-- Name: FUNCTION tienda_stock_lista(p_filtros jsonb, p_orden text, p_desde integer, p_cuantas integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_stock_lista(p_filtros jsonb, p_orden text, p_desde integer, p_cuantas integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_stock_lista(p_filtros jsonb, p_orden text, p_desde integer, p_cuantas integer) TO authenticated;

--
-- Name: FUNCTION tienda_stock_precio_bloque(p_ids uuid[], p_pct numeric, p_redondeo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_stock_precio_bloque(p_ids uuid[], p_pct numeric, p_redondeo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_stock_precio_bloque(p_ids uuid[], p_pct numeric, p_redondeo text) TO authenticated;

--
-- Name: FUNCTION tienda_vender(p_lineas jsonb, p_donde text, p_pago text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_vender(p_lineas jsonb, p_donde text, p_pago text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_vender(p_lineas jsonb, p_donde text, p_pago text) TO authenticated;

--
-- Name: FUNCTION tienda_ventas_lista(p_filtros jsonb, p_desde integer, p_cuantas integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tienda_ventas_lista(p_filtros jsonb, p_desde integer, p_cuantas integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tienda_ventas_lista(p_filtros jsonb, p_desde integer, p_cuantas integer) TO authenticated;

--
-- Name: FUNCTION tiendas_agenda(p_texto text, p_ciudad text, p_con_local boolean, p_de_mi_lista boolean, p_desde integer, p_cuantas integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tiendas_agenda(p_texto text, p_ciudad text, p_con_local boolean, p_de_mi_lista boolean, p_desde integer, p_cuantas integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tiendas_agenda(p_texto text, p_ciudad text, p_con_local boolean, p_de_mi_lista boolean, p_desde integer, p_cuantas integer) TO anon;
GRANT ALL ON FUNCTION public.tiendas_agenda(p_texto text, p_ciudad text, p_con_local boolean, p_de_mi_lista boolean, p_desde integer, p_cuantas integer) TO authenticated;

--
-- Name: FUNCTION tiendas_con_la_carta(p_card_id text, p_limite integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tiendas_con_la_carta(p_card_id text, p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tiendas_con_la_carta(p_card_id text, p_limite integer) TO anon;
GRANT ALL ON FUNCTION public.tiendas_con_la_carta(p_card_id text, p_limite integer) TO authenticated;

--
-- Name: FUNCTION tiendas_con_mis_deseos(p_limite integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tiendas_con_mis_deseos(p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tiendas_con_mis_deseos(p_limite integer) TO authenticated;

--
-- Name: FUNCTION tiendas_que_tienen(p_card_id text, p_limite integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tiendas_que_tienen(p_card_id text, p_limite integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tiendas_que_tienen(p_card_id text, p_limite integer) TO anon;
GRANT ALL ON FUNCTION public.tiendas_que_tienen(p_card_id text, p_limite integer) TO authenticated;

--
-- Name: FUNCTION tiendas_recien(p_cuantas integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.tiendas_recien(p_cuantas integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.tiendas_recien(p_cuantas integer) TO anon;
GRANT ALL ON FUNCTION public.tiendas_recien(p_cuantas integer) TO authenticated;

--
-- Name: FUNCTION timbre_hay_trabajo(p_que text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.timbre_hay_trabajo(p_que text) FROM PUBLIC;

--
-- Name: FUNCTION timbre_tocar(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.timbre_tocar() FROM PUBLIC;

--
-- Name: FUNCTION torneos_adjuntar_repeticion(p_partida uuid, p_repeticion text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_adjuntar_repeticion(p_partida uuid, p_repeticion text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_adjuntar_repeticion(p_partida uuid, p_repeticion text) TO authenticated;
GRANT ALL ON FUNCTION public.torneos_adjuntar_repeticion(p_partida uuid, p_repeticion text) TO service_role;

--
-- Name: FUNCTION torneos_cerrar_jornada(p_torneo uuid, p_jornada integer, p_cerrar boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_cerrar_jornada(p_torneo uuid, p_jornada integer, p_cerrar boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_cerrar_jornada(p_torneo uuid, p_jornada integer, p_cerrar boolean) TO authenticated;

--
-- Name: FUNCTION torneos_dar_de_baja(p_inscripcion uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_dar_de_baja(p_inscripcion uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_dar_de_baja(p_inscripcion uuid) TO authenticated;

--
-- Name: FUNCTION torneos_desreportar(p_partida uuid, p_juego smallint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_desreportar(p_partida uuid, p_juego smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_desreportar(p_partida uuid, p_juego smallint) TO authenticated;

--
-- Name: FUNCTION torneos_entrar_con_codigo(p_slug text, p_codigo text, p_tcg_live text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_entrar_con_codigo(p_slug text, p_codigo text, p_tcg_live text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_entrar_con_codigo(p_slug text, p_codigo text, p_tcg_live text) TO authenticated;

--
-- Name: FUNCTION torneos_es_mio(p_torneo uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.torneos_es_mio(p_torneo uuid) TO anon;
GRANT ALL ON FUNCTION public.torneos_es_mio(p_torneo uuid) TO authenticated;

--
-- Name: FUNCTION torneos_estoy_inscrito(p_torneo uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_estoy_inscrito(p_torneo uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_estoy_inscrito(p_torneo uuid) TO anon;
GRANT ALL ON FUNCTION public.torneos_estoy_inscrito(p_torneo uuid) TO authenticated;

--
-- Name: FUNCTION torneos_inscribirse(p_torneo uuid, p_tcg_live text, p_cola boolean, p_codigo text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_inscribirse(p_torneo uuid, p_tcg_live text, p_cola boolean, p_codigo text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_inscribirse(p_torneo uuid, p_tcg_live text, p_cola boolean, p_codigo text) TO authenticated;

--
-- Name: FUNCTION torneos_jornada_con_rondas(p_torneo uuid, p_jornada integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_jornada_con_rondas(p_torneo uuid, p_jornada integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_jornada_con_rondas(p_torneo uuid, p_jornada integer) TO authenticated;
GRANT ALL ON FUNCTION public.torneos_jornada_con_rondas(p_torneo uuid, p_jornada integer) TO anon;

--
-- Name: FUNCTION torneos_juez_adjuntar_repeticion(p_partida uuid, p_repeticion text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_juez_adjuntar_repeticion(p_partida uuid, p_repeticion text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_juez_adjuntar_repeticion(p_partida uuid, p_repeticion text) TO authenticated;
GRANT ALL ON FUNCTION public.torneos_juez_adjuntar_repeticion(p_partida uuid, p_repeticion text) TO service_role;

--
-- Name: FUNCTION torneos_juez_quitar_repeticion(p_partida uuid, p_repeticion text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_juez_quitar_repeticion(p_partida uuid, p_repeticion text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_juez_quitar_repeticion(p_partida uuid, p_repeticion text) TO authenticated;
GRANT ALL ON FUNCTION public.torneos_juez_quitar_repeticion(p_partida uuid, p_repeticion text) TO service_role;

--
-- Name: FUNCTION torneos_lista_jornada(p_torneo uuid, p_jornada integer, p_texto text, p_cartas jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_lista_jornada(p_torneo uuid, p_jornada integer, p_texto text, p_cartas jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_lista_jornada(p_torneo uuid, p_jornada integer, p_texto text, p_cartas jsonb) TO authenticated;

--
-- Name: FUNCTION torneos_mando(p_torneo uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.torneos_mando(p_torneo uuid) TO anon;
GRANT ALL ON FUNCTION public.torneos_mando(p_torneo uuid) TO authenticated;

--
-- Name: FUNCTION torneos_num_jornadas(p_torneo uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_num_jornadas(p_torneo uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_num_jornadas(p_torneo uuid) TO authenticated;
GRANT ALL ON FUNCTION public.torneos_num_jornadas(p_torneo uuid) TO anon;

--
-- Name: FUNCTION torneos_premio_entregado(p_torneo uuid, p_usuario uuid, p_entregado boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_premio_entregado(p_torneo uuid, p_usuario uuid, p_entregado boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_premio_entregado(p_torneo uuid, p_usuario uuid, p_entregado boolean) TO authenticated;

--
-- Name: FUNCTION torneos_publicar_listas_jornada(p_torneo uuid, p_jornada integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_publicar_listas_jornada(p_torneo uuid, p_jornada integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_publicar_listas_jornada(p_torneo uuid, p_jornada integer) TO authenticated;

--
-- Name: FUNCTION torneos_quitar_lista_jornada(p_torneo uuid, p_jornada integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_quitar_lista_jornada(p_torneo uuid, p_jornada integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_quitar_lista_jornada(p_torneo uuid, p_jornada integer) TO authenticated;

--
-- Name: FUNCTION torneos_quitar_repeticion(p_partida uuid, p_repeticion text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_quitar_repeticion(p_partida uuid, p_repeticion text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_quitar_repeticion(p_partida uuid, p_repeticion text) TO authenticated;
GRANT ALL ON FUNCTION public.torneos_quitar_repeticion(p_partida uuid, p_repeticion text) TO service_role;

--
-- Name: FUNCTION torneos_repartir_xp(p_torneo uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_repartir_xp(p_torneo uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_repartir_xp(p_torneo uuid) TO service_role;

--
-- Name: FUNCTION torneos_reportar(p_partida uuid, p_resultado text, p_juego smallint); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_reportar(p_partida uuid, p_resultado text, p_juego smallint) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_reportar(p_partida uuid, p_resultado text, p_juego smallint) TO authenticated;

--
-- Name: FUNCTION torneos_resolver_como_juez(p_partida uuid, p_resultado text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_resolver_como_juez(p_partida uuid, p_resultado text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_resolver_como_juez(p_partida uuid, p_resultado text) TO authenticated;

--
-- Name: FUNCTION torneos_tablon_escribir(p_torneo uuid, p_texto text, p_avisar boolean, p_auto boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.torneos_tablon_escribir(p_torneo uuid, p_texto text, p_avisar boolean, p_auto boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.torneos_tablon_escribir(p_torneo uuid, p_texto text, p_avisar boolean, p_auto boolean) TO authenticated;
GRANT ALL ON FUNCTION public.torneos_tablon_escribir(p_torneo uuid, p_texto text, p_avisar boolean, p_auto boolean) TO service_role;

--
-- Name: FUNCTION vitales_resumen(p_dias integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.vitales_resumen(p_dias integer) TO authenticated;

--
-- Name: FUNCTION xp_sumar(p_cuanto integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.xp_sumar(p_cuanto integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.xp_sumar(p_cuanto integer) TO authenticated;
GRANT ALL ON FUNCTION public.xp_sumar(p_cuanto integer) TO service_role;

--
-- Name: TABLE adviento_casillas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.adviento_casillas TO authenticated;

--
-- Name: TABLE aviso_cifras; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.aviso_cifras TO authenticated;

--
-- Name: TABLE aviso_participantes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.aviso_participantes TO authenticated;

--
-- Name: TABLE avisos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.avisos TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.avisos TO authenticated;

--
-- Name: TABLE avisos_enviados; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.avisos_enviados TO authenticated;

--
-- Name: TABLE busquedas; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT ON TABLE public.busquedas TO anon;
GRANT SELECT,INSERT ON TABLE public.busquedas TO authenticated;

--
-- Name: TABLE collection_favorite_sets; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE ON TABLE public.collection_favorite_sets TO authenticated;

--
-- Name: TABLE correo_textos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.correo_textos TO authenticated;

--
-- Name: TABLE enlaces_rotos; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT ON TABLE public.enlaces_rotos TO anon;
GRANT SELECT,INSERT ON TABLE public.enlaces_rotos TO authenticated;

--
-- Name: TABLE evento_asistentes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.evento_asistentes TO authenticated;

--
-- Name: TABLE logros_a_mano; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.logros_a_mano TO authenticated;

--
-- Name: TABLE match_log_ajustes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.match_log_ajustes TO authenticated;

--
-- Name: TABLE meta_arquetipos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.meta_arquetipos TO anon;
GRANT SELECT ON TABLE public.meta_arquetipos TO authenticated;

--
-- Name: TABLE meta_cartas_dia; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.meta_cartas_dia TO anon;
GRANT SELECT ON TABLE public.meta_cartas_dia TO authenticated;

--
-- Name: TABLE meta_guias; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.meta_guias TO anon;
GRANT SELECT,INSERT,DELETE ON TABLE public.meta_guias TO authenticated;

--
-- Name: TABLE meta_resultados; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.meta_resultados TO anon;
GRANT SELECT ON TABLE public.meta_resultados TO authenticated;

--
-- Name: TABLE meta_torneos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.meta_torneos TO anon;
GRANT SELECT ON TABLE public.meta_torneos TO authenticated;

--
-- Name: TABLE moderaciones; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.moderaciones TO authenticated;

--
-- Name: TABLE page_vitals; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT ON TABLE public.page_vitals TO anon;
GRANT SELECT,INSERT ON TABLE public.page_vitals TO authenticated;

--
-- Name: TABLE private_message_reactions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.private_message_reactions TO authenticated;

--
-- Name: TABLE replay_puzzles; Type: ACL; Schema: public; Owner: -
--

GRANT DELETE ON TABLE public.replay_puzzles TO authenticated;

--
-- Name: COLUMN replay_puzzles.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.replay_puzzles TO anon;
GRANT SELECT(id) ON TABLE public.replay_puzzles TO authenticated;

--
-- Name: COLUMN replay_puzzles.replay_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(replay_id) ON TABLE public.replay_puzzles TO anon;
GRANT SELECT(replay_id) ON TABLE public.replay_puzzles TO authenticated;

--
-- Name: COLUMN replay_puzzles.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(user_id) ON TABLE public.replay_puzzles TO anon;
GRANT SELECT(user_id) ON TABLE public.replay_puzzles TO authenticated;

--
-- Name: COLUMN replay_puzzles.foto; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(foto) ON TABLE public.replay_puzzles TO anon;
GRANT SELECT(foto) ON TABLE public.replay_puzzles TO authenticated;

--
-- Name: COLUMN replay_puzzles.pregunta; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(pregunta) ON TABLE public.replay_puzzles TO anon;
GRANT SELECT(pregunta) ON TABLE public.replay_puzzles TO authenticated;

--
-- Name: COLUMN replay_puzzles.opciones; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(opciones) ON TABLE public.replay_puzzles TO anon;
GRANT SELECT(opciones) ON TABLE public.replay_puzzles TO authenticated;

--
-- Name: COLUMN replay_puzzles.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.replay_puzzles TO anon;
GRANT SELECT(created_at) ON TABLE public.replay_puzzles TO authenticated;

--
-- Name: TABLE replays; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,DELETE ON TABLE public.replays TO authenticated;

--
-- Name: COLUMN replays.titulo; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(titulo) ON TABLE public.replays TO authenticated;

--
-- Name: COLUMN replays.compartida; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(compartida) ON TABLE public.replays TO authenticated;

--
-- Name: COLUMN replays.notas; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(notas) ON TABLE public.replays TO authenticated;

--
-- Name: TABLE retos_arbitro; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.retos_arbitro TO service_role;

--
-- Name: TABLE retos_bonos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.retos_bonos TO authenticated;

--
-- Name: TABLE retos_resultados; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.retos_resultados TO authenticated;

--
-- Name: TABLE tcg_card_history; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tcg_card_history TO anon;
GRANT SELECT ON TABLE public.tcg_card_history TO authenticated;

--
-- Name: TABLE tcg_card_versions; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tcg_card_versions TO anon;
GRANT SELECT ON TABLE public.tcg_card_versions TO authenticated;

--
-- Name: TABLE tcg_correcciones; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tcg_correcciones TO authenticated;
GRANT SELECT ON TABLE public.tcg_correcciones TO service_role;

--
-- Name: TABLE tcg_set_idiomas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tcg_set_idiomas TO anon;
GRANT SELECT ON TABLE public.tcg_set_idiomas TO authenticated;

--
-- Name: TABLE tcg_set_idiomas_mano; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tcg_set_idiomas_mano TO anon;
GRANT SELECT ON TABLE public.tcg_set_idiomas_mano TO authenticated;

--
-- Name: TABLE tcg_set_valor; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tcg_set_valor TO anon;
GRANT SELECT ON TABLE public.tcg_set_valor TO authenticated;

--
-- Name: TABLE tcg_version_idioma; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tcg_version_idioma TO anon;
GRANT SELECT ON TABLE public.tcg_version_idioma TO authenticated;

--
-- Name: TABLE tienda_cambios; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_cambios TO authenticated;

--
-- Name: TABLE tienda_compras; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_compras TO authenticated;

--
-- Name: TABLE tienda_fotos_pedidas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_fotos_pedidas TO authenticated;

--
-- Name: TABLE tienda_lotes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_lotes TO authenticated;

--
-- Name: TABLE tienda_ofertas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_ofertas TO authenticated;

--
-- Name: TABLE tienda_reservas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_reservas TO authenticated;

--
-- Name: TABLE tienda_solicitudes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_solicitudes TO authenticated;

--
-- Name: TABLE tienda_stock; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tienda_stock TO authenticated;

--
-- Name: TABLE tienda_stock_fotos; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_stock_fotos TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tienda_stock_fotos TO authenticated;

--
-- Name: TABLE tienda_valor_diario; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_valor_diario TO authenticated;

--
-- Name: TABLE tienda_ventas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_ventas TO authenticated;

--
-- Name: TABLE tienda_visitas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tienda_visitas TO authenticated;

--
-- Name: TABLE tienda_vistas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tienda_vistas TO authenticated;

--
-- Name: TABLE tiendas; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tiendas TO anon;
GRANT SELECT ON TABLE public.tiendas TO authenticated;

--
-- Name: COLUMN tiendas.ciudad; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(ciudad) ON TABLE public.tiendas TO authenticated;

--
-- Name: COLUMN tiendas.direccion; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(direccion) ON TABLE public.tiendas TO authenticated;

--
-- Name: COLUMN tiendas.horario; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(horario) ON TABLE public.tiendas TO authenticated;

--
-- Name: COLUMN tiendas.web; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(web) ON TABLE public.tiendas TO authenticated;

--
-- Name: COLUMN tiendas.precio_visible; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(precio_visible) ON TABLE public.tiendas TO authenticated;

--
-- Name: COLUMN tiendas.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(updated_at) ON TABLE public.tiendas TO authenticated;

--
-- Name: COLUMN tiendas.instagram; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(instagram) ON TABLE public.tiendas TO authenticated;

--
-- Name: TABLE tournament_join_codes; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.tournament_join_codes TO authenticated;

--
-- Name: TABLE tournament_match_replays; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tournament_match_replays TO anon;
GRANT SELECT ON TABLE public.tournament_match_replays TO authenticated;

--
-- Name: TABLE tournament_matchday_closures; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tournament_matchday_closures TO anon;
GRANT SELECT ON TABLE public.tournament_matchday_closures TO authenticated;

--
-- Name: TABLE tournament_matchday_decklists; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tournament_matchday_decklists TO authenticated;

--
-- Name: TABLE tournament_prize_deliveries; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tournament_prize_deliveries TO anon;
GRANT SELECT ON TABLE public.tournament_prize_deliveries TO authenticated;

--
-- Name: COLUMN tournament_registrations.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.tournament_registrations TO anon;

--
-- Name: COLUMN tournament_registrations.tournament_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(tournament_id) ON TABLE public.tournament_registrations TO anon;

--
-- Name: COLUMN tournament_registrations.user_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(user_id) ON TABLE public.tournament_registrations TO anon;

--
-- Name: COLUMN tournament_registrations.status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(status) ON TABLE public.tournament_registrations TO anon;

--
-- Name: COLUMN tournament_registrations.registered_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(registered_at) ON TABLE public.tournament_registrations TO anon;

--
-- Name: COLUMN tournament_registrations.dropped_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(dropped_at) ON TABLE public.tournament_registrations TO anon;

--
-- Name: COLUMN tournament_registrations.dropped_after_round_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(dropped_after_round_id) ON TABLE public.tournament_registrations TO anon;

--
-- Name: TABLE tournament_updates; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.tournament_updates TO anon;
GRANT SELECT,DELETE ON TABLE public.tournament_updates TO authenticated;

--
-- Name: TABLE trade_offer_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.trade_offer_items TO authenticated;

--
-- Name: TABLE user_albums; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_albums TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_albums TO authenticated;

--
-- Name: TABLE user_cobros; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_cobros TO authenticated;

--
-- Name: TABLE user_collection_value; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_collection_value TO anon;
GRANT SELECT ON TABLE public.user_collection_value TO authenticated;

--
-- Name: TABLE user_cumple; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_cumple TO authenticated;

--
-- Name: TABLE user_decks; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_decks TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_decks TO authenticated;

--
-- Name: TABLE user_direcciones; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_direcciones TO authenticated;

--
-- Name: TABLE user_play_pokemon; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_play_pokemon TO authenticated;

--
-- Name: TABLE user_privado; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_privado TO authenticated;

--
-- Name: COLUMN user_privado.saved_guides; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(saved_guides) ON TABLE public.user_privado TO authenticated;

--
-- Name: COLUMN user_privado.updated_at; Type: ACL; Schema: public; Owner: -
--

GRANT UPDATE(updated_at) ON TABLE public.user_privado TO authenticated;

--
-- Name: TABLE user_showcase; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_showcase TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_showcase TO authenticated;

--
-- Name: TABLE user_want_list_items; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_want_list_items TO authenticated;

--
-- Name: TABLE user_want_lists; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_want_lists TO authenticated;

--
-- Name: TABLE user_wants; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT ON TABLE public.user_wants TO anon;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.user_wants TO authenticated;

--
-- PostgreSQL database dump complete
--
