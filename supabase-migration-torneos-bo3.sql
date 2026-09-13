-- Resultados partida a partida en BO3 (tanda 291).
--
-- Lo pidió PINGU tras arbitrar un torneo al mejor de tres: jugando un
-- BO3, lo que la gente quiere marcar es CADA PARTIDA, no el resultado
-- final calculado de cabeza. Y con dos ganadas la tercera tiene que
-- cerrarse sola, porque no se juega.
--
-- ── CÓMO ──
--
-- No hay tabla nueva. `match_reports` gana una columna `game_number`:
--
--   0 = el resultado del MATCH entero (lo de siempre; es lo que usa un
--       BO1 y lo que tienen todas las filas que ya existen).
--   1, 2, 3 = cada partida de la serie.
--
-- Y el resultado del match NO se guarda aparte: se DEDUCE de los juegos
-- confirmados, igual que los arquetipos se deducen de la decklist
-- (tanda 230). Es lo que hace que no se pueda desincronizar — no hay dos
-- sitios que puedan decir cosas distintas.
--
-- Ejecutar en el SQL Editor de Supabase. Se puede repetir entera.

alter table public.match_reports
  add column if not exists game_number smallint not null default 0;

alter table public.match_reports
  drop constraint if exists match_reports_game_number_check;
alter table public.match_reports
  add constraint match_reports_game_number_check check (game_number between 0 and 3);

comment on column public.match_reports.game_number is
  '0 = resultado del match entero (BO1). 1-3 = cada partida de un BO3.';

-- El candado de antes era «un reporte por persona y mesa». Ahora es «uno
-- por persona, mesa y partida»: si no, la segunda partida de un BO3
-- chocaría con la primera.
alter table public.match_reports drop constraint if exists match_reports_match_id_reporter_id_key;
drop index if exists match_reports_match_id_reporter_id_key;
create unique index if not exists match_reports_por_juego
  on public.match_reports (match_id, reporter_id, game_number);

-- La de antes se QUITA, no se deja al lado.
--
-- `create or replace` con una firma distinta no reemplaza: crea una
-- SOBRECARGA. Y con `p_juego` teniendo valor por defecto, una llamada de
-- dos argumentos encajaría en las dos y Postgres respondería «function
-- is not unique» — o sea que dejar la vieja rompería el reporte entero.
drop function if exists public.torneos_reportar(uuid, text);

-- ── RPC: reportar, ahora con número de partida ──
--
-- Cambios respecto a la de la tanda 252:
--
--   · `p_juego`: 0 el match entero, 1-3 una partida de la serie.
--   · SE PUEDE CORREGIR el propio reporte mientras el rival no haya
--     reportado ESA partida. No es «deshacer» nada: es enmendar tu parte
--     antes de que valga. En cuanto los dos coincidís, la partida queda
--     cerrada y ya solo la toca un juez.
--   · Al confirmarse una partida se mira la SERIE entera, y solo cuando
--     alguien llega a dos (o se juegan las tres) se cierra la mesa.
create or replace function public.torneos_reportar(p_partida uuid, p_resultado text, p_juego smallint default 0)
returns text language plpgsql security definer set search_path = public as $$
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

-- ── RPC: retirar el propio reporte de una partida ──
--
-- Solo el tuyo, y solo mientras el rival no haya dicho lo suyo de esa
-- partida. Es la misma regla de arriba por la otra puerta: lo que aún no
-- vale se puede quitar; lo acordado, no.
create or replace function public.torneos_desreportar(p_partida uuid, p_juego smallint default 0)
returns text language plpgsql security definer set search_path = public as $$
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

revoke all on function public.torneos_reportar(uuid, text, smallint) from public;
grant execute on function public.torneos_reportar(uuid, text, smallint) to authenticated;
revoke all on function public.torneos_desreportar(uuid, smallint) from public;
grant execute on function public.torneos_desreportar(uuid, smallint) to authenticated;

notify pgrst, 'reload schema';
