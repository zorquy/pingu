-- Tanda 1470 — Sin check-in no hay resultado (Manso, vía PINGU: «si no haces
-- el check-in y pasan esos 5 minutos o lo que esté estipulado, que no te deje
-- dar a victoria o derrota porque ya has perdido por no hacer el check-in.
-- Es automático eso»).
--
-- Hasta ahora la mesa caía por incomparecencia cuando pasaba el barredor (cada
-- minuto) o cuando una ficha abierta llamaba a torneos_reclamar_ausencia; en
-- ese rato, quien NO había hecho check-in podía aún pulsar Victoria y su parte
-- entraba. Desde aquí, torneos_reportar mira la ventana antes de apuntar nada:
-- vencida con un check-in sin hacer, cierra la mesa con la misma regla
-- (forfeit_a, forfeit_b o forfeit_both, con score check_in) y devuelve
-- 'sin_checkin' sin apuntar el parte.
--
-- La función es la de producción (supabase-esquema-actual.sql) con ese bloque
-- añadido después de comprobar el estado de la mesa; el resto no cambia.
-- Se puede ejecutar más de una vez.

create or replace function public.torneos_reportar(p_partida uuid, p_resultado text, p_juego smallint default 0)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
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
  v_r rounds%rowtype;
  v_min int;
  v_cae text;
  v_gana uuid;
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

  -- 1470: SIN CHECK-IN NO HAY RESULTADO. Vencida la ventana de check-in con
  -- el de alguno sin hacer, la mesa ya está decidida por incomparecencia: se
  -- cierra aquí con la regla del barredor (forfeitPorCheckin) y de
  -- torneos_reclamar_ausencia, y el parte NO se apunta. Solo con la mesa
  -- activa, como el barredor; una mesa esperando confirmación siguió adelante
  -- con los dos presentes.
  if v_m.status = 'active' and v_m.player_b_id is not null then
    select * into v_r from rounds where id = v_m.round_id;
    select coalesce(checkin_minutes, 0) into v_min from tournaments where id = v_r.tournament_id;
    if v_min > 0 and v_r.status = 'active' and v_r.started_at is not null
       and now() > v_r.started_at + make_interval(mins => v_min)
       and (v_m.check_in_a_at is null or v_m.check_in_b_at is null) then
      if v_m.check_in_a_at is not null then
        v_cae := 'forfeit_b'; v_gana := v_m.player_a_id;
      elsif v_m.check_in_b_at is not null then
        v_cae := 'forfeit_a'; v_gana := v_m.player_b_id;
      else
        v_cae := 'forfeit_both'; v_gana := null;
      end if;
      update tournament_matches set status = v_cae, finished_at = now() where id = p_partida;
      insert into match_results (match_id, result, winner_id, resolved_by, score)
        values (p_partida, v_cae, v_gana, null, 'check_in')
        on conflict (match_id) do nothing;
      return 'sin_checkin';
    end if;
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

revoke all on function public.torneos_reportar(uuid, text, smallint) from public, anon;
grant execute on function public.torneos_reportar(uuid, text, smallint) to authenticated;
