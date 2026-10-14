-- «Hoy en PokeDoc» en /retos (tanda 842): cuánta gente ha jugado hoy, quién
-- lleva más XP de retos, cómo va cada reto, los últimos 14 días y la racha
-- más larga. Y la opción de no salir con nombre.
--
-- Se puede ejecutar más de una vez. Necesita la de la 835
-- (supabase-migration-retos-xp.sql): lee `retos_resultados`, `retos_bonos`
-- y `retos_racha_de`.
--
-- PRIVACIDAD (PINGU, 2026-10-14): con nombre sale todo el mundo MENOS quien
-- marque «no salir en la lista de los retos» (`retos_oculto`) o tenga puesta
-- la de ocultar su actividad (`hide_activity`). Esas personas se cuentan en
-- los números, sin nombre. Lo tuyo (puesto, XP) te lo dice a ti siempre.

alter table public.user_profiles add column if not exists retos_oculto boolean not null default false;
comment on column public.user_profiles.retos_oculto is
  'No salir con nombre en «Hoy en PokeDoc» de /retos (842). Se cuenta igual en los números.';

create or replace function public.retos_comunidad(p_dia date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
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
revoke all on function public.retos_comunidad(date) from public;
grant execute on function public.retos_comunidad(date) to anon, authenticated;
