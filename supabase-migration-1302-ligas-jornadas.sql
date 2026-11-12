-- Tanda 1302 — los avisos de cada JORNADA de una liga (PINGU eligió la J1 de
-- «Ligas y jornadas»: «estamos por la jornada 6… no se están enviando al
-- Telegram avisos porque no es un torneo nuevo»).
--
-- La víspera de cada jornada sale a Telegram y a la campanita de los
-- inscritos, y al cerrarse sale a Telegram con los tres primeros. Cada aviso
-- UNA vez: esta tabla apunta cuál se ha mandado (por liga, jornada y canal).
-- La escribe y la lee solo la función programada `ligas-jornadas`, con la
-- clave de servicio, así que tiene RLS y ninguna política: nadie más la ve.
--
-- Re-ejecutable, y cada sentencia vale por sí sola (tanda 631).

create table if not exists public.tournament_matchday_avisos (
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  matchday int not null check (matchday >= 1),
  canal text not null check (canal in ('telegram', 'campanita', 'resultados')),
  sent_at timestamptz not null default now(),
  primary key (tournament_id, matchday, canal)
);

alter table public.tournament_matchday_avisos enable row level security;

-- Cuántos han mandado ya su lista para una jornada (la franja «Ligas en
-- curso» de /torneos: «18 de 24 ya han mandado lista»). Las listas de una
-- jornada sin empezar solo las ve su dueño y quien lleva la liga (la RLS de
-- tournament_matchday_decklists), y así debe seguir: esto da el NÚMERO, nada
-- de quién ni con qué.
create or replace function public.liga_listas_jornada(p_torneo uuid, p_jornada int)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int
  from tournament_matchday_decklists d
  join tournament_registrations r
    on r.tournament_id = d.tournament_id and r.user_id = d.user_id and r.status = 'active'
  where d.tournament_id = p_torneo and d.matchday = p_jornada
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    grant execute on function public.liga_listas_jornada(uuid, int) to anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    grant execute on function public.liga_listas_jornada(uuid, int) to authenticated;
  end if;
end $$;
