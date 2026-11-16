-- ─────────────────────────────────────────────────────────────────────
-- LAS JORNADAS JUGADAS DE UNA LIGA CUENTAN COMO TORNEOS (tanda 1379).
--
-- PINGU: «al no cerrarse la liga, no se están teniendo en cuenta las
-- estadísticas de nada. Si esa jornada se ha cerrado, la lista debería ser
-- pública, y tendría que contar como que se ha jugado: cada jornada de liga
-- funciona como un torneo individual».
--
-- Hasta aquí las listas de cada jornada (`tournament_matchday_decklists`)
-- solo las leían su dueño, quien lleva la liga y los jueces, y el meta solo
-- miraba torneos TERMINADOS: una liga de diez semanas no aparecía en ningún
-- sitio hasta la última jornada.
--
-- Desde aquí, la lista de una jornada YA JUGADA (todas sus rondas suizas
-- cerradas y alguna empezada: una jornada saltada no se jugó) se ve como la
-- de un torneo terminado, con la misma regla de `decklist_visibility`:
-- nunca con 'nunca'. Una jornada con las inscripciones cerradas pero SIN
-- jugar sigue cerrada: enseñar las listas antes de jugar sería darle ventaja
-- al rival.
--
-- Es re-ejecutable y sin tablas temporales (tanda 631).
-- ─────────────────────────────────────────────────────────────────────
begin;

-- ¿Se jugó la jornada n de esta liga? Lo mismo que «hecha» en
-- js/torneos/liga-en-curso.js (`jornadasDeLiga`), que es la que cuenta las
-- jornadas en la web: todas sus rondas existen y están cerradas, y alguna
-- llegó a empezar (si ninguna empezó, se saltó: 833).
create or replace function public.torneos_jornada_jugada(p_torneo uuid, p_jornada integer)
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select coalesce((
    select count(*) >= greatest(coalesce(t.rounds_per_matchday, 1), 1)
           and bool_and(r.status = 'finished')
           and bool_or(r.started_at is not null)
    from tournaments t
    join rounds r on r.tournament_id = t.id and r.phase = 'swiss'
     and r.round_number between (p_jornada - 1) * greatest(coalesce(t.rounds_per_matchday, 1), 1) + 1
                            and p_jornada * greatest(coalesce(t.rounds_per_matchday, 1), 1)
    where t.id = p_torneo and t.format = 'league'
    group by t.rounds_per_matchday
  ), false)
$$;

revoke all on function public.torneos_jornada_jugada(uuid, integer) from public;
grant execute on function public.torneos_jornada_jugada(uuid, integer) to anon, authenticated;

-- La política nueva se SUMA a la de siempre (listas_jornada_ver: tu lista,
-- quien lleva la liga y los jueces): en PostgreSQL las políticas de SELECT se
-- unen con OR.
drop policy if exists listas_jornada_jugada_ver on public.tournament_matchday_decklists;
create policy listas_jornada_jugada_ver on public.tournament_matchday_decklists
  for select to anon, authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = tournament_matchday_decklists.tournament_id
        and coalesce(t.decklist_visibility, 'al_terminar') <> 'nunca'
    )
    and public.torneos_jornada_jugada(tournament_id, matchday)
  );

-- Quien mira sin cuenta (y la función del meta, que lee con la clave pública)
-- necesita poder pedir la tabla; la política decide qué filas.
grant select on public.tournament_matchday_decklists to anon;

commit;
