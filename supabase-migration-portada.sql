-- La portada nueva (tanda 844): la CLASIFICACIÓN de la semana y del mes con
-- la XP de los seis retos, y lo que pasa en la COMUNIDAD que hasta ahora no
-- se apuntaba en ninguna parte (días perfectos, mazos compartidos, campeones
-- de torneo y colecciones completas).
--
-- Se puede ejecutar más de una vez. Necesita la de la 835
-- (supabase-migration-retos-xp.sql) y la de la 842
-- (supabase-migration-retos-comunidad.sql), aunque la columna de la 842 se
-- vuelve a pedir aquí por si acaso.
--
-- PRIVACIDAD, la misma de la 842: con nombre sale todo el mundo menos quien
-- tiene `retos_oculto` (en la clasificación) o `hide_activity` (en las dos).
-- Una colección completa solo sale si la colección es pública
-- (`coleccion_publica`). Lo tuyo te lo dice a ti siempre.

alter table public.user_profiles add column if not exists retos_oculto boolean not null default false;

-- ── La clasificación: 'semana' (de lunes a hoy) o 'mes' (del día 1 a hoy) ──
-- La XP de cada día es la de `retos_resultados` más sus bonos, como en /retos.
create or replace function public.portada_clasificacion(p_periodo text default 'semana')
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
revoke all on function public.portada_clasificacion(text) from public;
grant execute on function public.portada_clasificacion(text) to anon, authenticated;

-- ── Lo que pasa en la comunidad y no se apuntaba ──
-- Ocho clases de suceso, los más nuevos primero (la portada enseña seis;
-- la pestaña Actividad de /usuarios, hasta 60 — la 845):
--   perfecto    · hizo los seis retos de un día (el bono 'perfecto' de la 835)
--   mazo        · tiene un mazo público, el último que tocó
--   campeon     · ganó un torneo terminado
--   coleccion   · completó una expansión (todas sus cartas numeradas), solo
--                 con la colección pública
--   inscripcion · se apuntó a un torneo (845)
--   sigue       · empezó a seguir a alguien; los dos tienen que salir (845)
--   respuesta   · respondió en un tema del foro, uno por tema y persona (845)
--   cambio      · tiene cartas marcadas «para cambiar», las de 14 días (845)
create or replace function public.portada_comunidad(p_limite int default 12)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
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
$$;
revoke all on function public.portada_comunidad(int) from public;
grant execute on function public.portada_comunidad(int) to anon, authenticated;
