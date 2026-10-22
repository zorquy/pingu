-- ============================================================
-- Tanda 970: un juez del torneo lleva el torneo, como el organizador.
--
-- PINGU, la víspera de un torneo con dos jueces y un organizador: «los
-- jueces no tienen la opción de generar pareos ni de saltar ronda; cuando
-- pones a alguien de juez tiene que tener los mismos permisos que el
-- organizador».
--
-- Hasta ahora un juez solo podía dar de baja y resolver una mesa viva (la
-- 394), por dos funciones a medida. Todo lo demás —generar pareos, empezar,
-- cerrar o saltar una ronda, inscripciones, listas, resultados— lo decide
-- `torneos_mando()`, que solo decía «admin, organizador o quien lo creó».
--
--  1. `torneos_mando(torneo)` cuenta también al juez APROBADO de ese torneo
--     (`torneos_soy_juez`). Con eso le valen todas las políticas y funciones
--     que ya preguntan por el mando: rondas, mesas, resultados, historial de
--     cruces, inscripciones, listas, jornadas, tablón.
--  2. `tournaments`: el juez puede EDITAR su torneo (estado, ronda en curso,
--     ajustes), que es lo que escribe la ronda al empezar o acabar. Borrarlo
--     sigue siendo de quien lo creó y de los organizadores (`torneos_borrar`).
--     El sello de oficial de PokeDoc y repartir roles no cambian: son del
--     admin del sitio.
--
-- Se puede ejecutar dos veces.
-- ============================================================

begin;

create or replace function public.torneos_mando(p_torneo uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select public.torneos_soy_admin()
      or exists (
        select 1 from public.tournaments t
         where t.id = p_torneo and t.admin_id = auth.uid()
      )
      or public.torneos_soy_juez(p_torneo);
$$;

grant execute on function public.torneos_mando(uuid) to anon, authenticated;

comment on function public.torneos_mando(uuid) is
  'Quién lleva ese torneo: admin del sitio, organizador (is_tournament_admin), quien lo creó o un juez aprobado de ese torneo (970). NO incluye marcar el torneo como oficial de PokeDoc, que es solo del admin del sitio, ni borrarlo.';

drop policy if exists torneos_juez_edita on public.tournaments;
create policy torneos_juez_edita on public.tournaments for update
  to authenticated
  using (public.torneos_soy_juez(id))
  with check (public.torneos_soy_juez(id));

notify pgrst, 'reload schema';

commit;

-- ── Comprobación (el SQL Editor enseña la última) ──
-- Los jueces aprobados de los torneos que no han acabado: ellos llevan ya
-- su torneo.
select t.name as torneo, t.status, p.username as juez
from public.judge_applications j
join public.tournaments t on t.id = j.tournament_id
left join public.user_profiles p on p.id = j.user_id
where j.status = 'approved' and t.status not in ('finished', 'cancelled')
order by t.name, p.username;
