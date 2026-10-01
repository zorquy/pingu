-- ════════════════════════════════════════════════════════════════════
-- Lo que hace un JUEZ el día del torneo (tanda 394)
-- ════════════════════════════════════════════════════════════════════
--
-- PINGU: «cuando un jugador no ha hecho el check-in, que salga en un
-- apartado de los jueces para avisarle y poder darle de baja. Esa baja
-- la tiene que dar el juez, siempre».
--
-- Y ahí apareció el agujero: un juez aprobado NO podía escribir nada del
-- torneo. Las políticas de `tournament_registrations`,
-- `tournament_matches` y `match_results` piden `torneos_mando()` —admin,
-- organizador o creador— y un juez no es nada de eso. La pantalla le
-- enseñaba el «Resolver…» de cada mesa desde la tanda 207, lo elegía, la
-- base no tocaba nada SIN DAR ERROR y salía «Mesa resuelta» en verde.
--
-- No se abren las tablas al juez: se le dan dos funciones que hacen
-- EXACTAMENTE lo suyo y nada más, con la puerta escrita en un `if`.
--
--   1. torneos_dar_de_baja(inscripción): la baja de un jugador, con la
--      misma mecánica que la que se da él mismo o el «Expulsar» del
--      organizador (SPEC §6.9): su ronda en curso cuenta, la plaza no se
--      libera y deja de entrar en los pareos.
--   2. torneos_resolver_como_juez(mesa, resultado): resolver una mesa
--      VIVA. Corregir una ya cerrada sigue siendo del organizador — pisar
--      un resultado firme no es cosa de un juez (decisión de la tanda
--      que lo introdujo, pedido de Ibai del 2026-09-02).
--
-- Se ejecuta en el SQL Editor. Se puede repetir entera.

begin;

-- ------------------------------------------------------------
-- 1. Dar de baja a un jugador
-- ------------------------------------------------------------
-- Devuelve true si lo ha dado de baja y false si ya no estaba activo
-- (otro juez se adelantó, o se fue él): así el cliente distingue «hecho»
-- de «no había nada que hacer» sin confundirlo con un error.
create or replace function public.torneos_dar_de_baja(p_inscripcion uuid)
returns boolean language plpgsql security definer set search_path = public as $$
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

-- ------------------------------------------------------------
-- 2. Resolver una mesa viva
-- ------------------------------------------------------------
-- Lo mismo que hace el cliente del organizador en resolverPartida(): el
-- estado de la mesa y su fila de resultado, con el ganador según el
-- resultado (resolutionWinnerSide en js/torneos/motor.js) y quién la
-- resolvió — que es lo que hace que el barredor avise a los dos
-- jugadores de que un juez ha decidido.
create or replace function public.torneos_resolver_como_juez(p_partida uuid, p_resultado text)
returns boolean language plpgsql security definer set search_path = public as $$
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

-- Solo con cuenta. `revoke ... from public` le quita el permiso a TODOS
-- los que lo tenían por ser public (tanda 388): aquí no importa, porque
-- la única que las llama es la web con la sesión de quien pulsa.
revoke all on function public.torneos_dar_de_baja(uuid) from public;
grant execute on function public.torneos_dar_de_baja(uuid) to authenticated;
revoke all on function public.torneos_resolver_como_juez(uuid, text) from public;
grant execute on function public.torneos_resolver_como_juez(uuid, text) to authenticated;

commit;

notify pgrst, 'reload schema';
