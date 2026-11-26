-- Tandas 1438, 1439 y 1440 — Torneos sin atascos (la propuesta del 25-11,
-- tras el Tardeo de Testeo: 64 jugadores llenaron las 60 conexiones de la base).
--
-- Tres piezas, en un solo fichero para ejecutarlo una vez:
--
--  1438. `torneo_ciclo(id)`: lo que la ficha recarga durante una ronda (rondas,
--        mesas, resultados, reportes que puedes ver y las bajas) en UNA consulta
--        en vez de cinco. Los permisos de los reportes se miran UNA vez por
--        llamada, no fila a fila como hacía la política.
--
--  1439. El canal del torneo: cada cambio de rondas, mesas, resultados, reportes,
--        bajas, tablón, llamadas al juez, chats y el propio torneo se anuncia UNA
--        vez en el canal privado «torneo:<id>» de Realtime, con la fila dentro
--        (lo público) o solo con qué mesa ha cambiado (lo privado). Quien mira la
--        ficha aplica el cambio sin preguntar a la base. Antes cada cambio
--        despertaba las escuchas de TODOS los torneos y el servidor de tiempo
--        real comprobaba los permisos persona por persona, en la base.
--        El aviso nunca puede tumbar la escritura: si Realtime falla, se calla.
--
--  1440. `torneos_reclamar_ausencia(mesa)`: cuando vence el check-in y tu rival
--        no está, la mesa se cierra al momento con la MISMA regla que el
--        barredor (que se queda de red de seguridad). La hora la mira la base.
--        La piden las fichas de los dos jugadores y las del organizador y los
--        jueces (1445): basta con que UNA esté abierta.
--
-- Se puede ejecutar dos veces. Sin tablas temporales (tanda 631).

-- ── 1438. La ficha en una consulta ──────────────────────────────────────────

create or replace function public.torneo_ciclo(p_torneo uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_t tournaments%rowtype;
  v_mando boolean := false;
begin
  select * into v_t from tournaments where id = p_torneo;
  if not found then return null; end if;
  -- La misma puerta que la política de lectura de `tournaments`: un borrador
  -- solo lo ve quien lo creó o el admin del sitio.
  if v_t.status = 'draft' and v_t.admin_id is distinct from v_uid and not coalesce(torneos_soy_admin(), false) then
    return null;
  end if;
  if v_uid is not null then
    v_mando := coalesce(torneos_mando(p_torneo), false) or coalesce(torneos_soy_juez(p_torneo), false);
  end if;

  return jsonb_build_object(
    'rondas', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.round_number)
        from rounds r where r.tournament_id = p_torneo), '[]'::jsonb),
    'mesas', coalesce((
      select jsonb_agg(to_jsonb(m))
        from tournament_matches m join rounds r on r.id = m.round_id
       where r.tournament_id = p_torneo), '[]'::jsonb),
    'resultados', coalesce((
      select jsonb_agg(to_jsonb(x))
        from match_results x
        join tournament_matches m on m.id = x.match_id
        join rounds r on r.id = m.round_id
       where r.tournament_id = p_torneo), '[]'::jsonb),
    -- Los reportes, como la política `reportes_ver`: los de tu mesa, o todos
    -- si llevas o arbitras el torneo. Sin cuenta, ninguno.
    'reportes', case when v_uid is null then '[]'::jsonb else coalesce((
      select jsonb_agg(to_jsonb(x))
        from match_reports x
        join tournament_matches m on m.id = x.match_id
        join rounds r on r.id = m.round_id
       where r.tournament_id = p_torneo
         and (v_mando or m.player_a_id = v_uid or m.player_b_id = v_uid)), '[]'::jsonb) end,
    -- Las bajas (1436): solo las columnas que ya son públicas.
    'bajas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', i.id, 'user_id', i.user_id, 'status', i.status,
               'dropped_at', i.dropped_at, 'dropped_after_round_id', i.dropped_after_round_id))
        from tournament_registrations i where i.tournament_id = p_torneo), '[]'::jsonb)
  );
end $$;

revoke all on function public.torneo_ciclo(uuid) from public;
grant execute on function public.torneo_ciclo(uuid) to anon, authenticated;

-- ── 1439. El canal del torneo ───────────────────────────────────────────────

create or replace function public.torneo_difundir()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  r record;
  v_torneo uuid;
  v_fila jsonb;
begin
  if TG_OP = 'DELETE' then r := OLD; else r := NEW; end if;

  -- Cada tabla dice de qué torneo es y qué se cuenta. Lo público va entero
  -- (rondas, mesas, resultados: la política de lectura es `true`); de lo
  -- privado solo QUÉ mesa o qué llamada ha cambiado, y quien pueda verlo lo
  -- pide (con `torneo_ciclo` o con su chat).
  case TG_TABLE_NAME
    when 'tournaments' then
      v_torneo := r.id;
      v_fila := jsonb_build_object('id', r.id, 'status', r.status, 'current_round_id', r.current_round_id);
    when 'rounds' then
      v_torneo := r.tournament_id;
      v_fila := to_jsonb(r);
    when 'tournament_matches' then
      select x.tournament_id into v_torneo from rounds x where x.id = r.round_id;
      v_fila := to_jsonb(r);
    when 'match_results' then
      select x.tournament_id into v_torneo from tournament_matches m join rounds x on x.id = m.round_id where m.id = r.match_id;
      v_fila := to_jsonb(r);
    when 'match_reports' then
      select x.tournament_id into v_torneo from tournament_matches m join rounds x on x.id = m.round_id where m.id = r.match_id;
      v_fila := jsonb_build_object('match_id', r.match_id);
    when 'match_messages' then
      select x.tournament_id into v_torneo from tournament_matches m join rounds x on x.id = m.round_id where m.id = r.match_id;
      v_fila := jsonb_build_object('match_id', r.match_id);
    when 'tournament_registrations' then
      v_torneo := r.tournament_id;
      v_fila := jsonb_build_object('id', r.id, 'user_id', r.user_id, 'status', r.status,
                                   'dropped_at', r.dropped_at, 'dropped_after_round_id', r.dropped_after_round_id);
    when 'tournament_updates' then
      v_torneo := r.tournament_id;
      v_fila := jsonb_build_object('id', r.id);
    when 'judge_calls' then
      v_torneo := r.tournament_id;
      v_fila := jsonb_build_object('id', r.id, 'match_id', r.match_id, 'created_by', r.created_by, 'status', r.status);
    when 'judge_messages' then
      select c.tournament_id into v_torneo from judge_calls c where c.id = r.judge_call_id;
      v_fila := jsonb_build_object('judge_call_id', r.judge_call_id);
    else
      return null;
  end case;

  if v_torneo is null then return null; end if;

  -- El aviso es un adorno de la escritura, no parte de ella: si Realtime no
  -- está o falla, la mesa se guarda igual y la ficha se entera por su sondeo.
  begin
    perform realtime.send(
      jsonb_build_object('t', TG_TABLE_NAME, 'op', TG_OP, 'fila', v_fila),
      'cambio',
      'torneo:' || v_torneo::text,
      true
    );
  exception when others then
    null;
  end;
  return null;
end $$;

revoke all on function public.torneo_difundir() from public, anon, authenticated;

-- Los disparadores, uno por tabla (AFTER y por fila: el aviso sale cuando la
-- escritura ya está hecha).
drop trigger if exists torneo_difundir on public.tournaments;
create trigger torneo_difundir after update of status, current_round_id on public.tournaments
  for each row execute function public.torneo_difundir();

drop trigger if exists torneo_difundir on public.rounds;
create trigger torneo_difundir after insert or update or delete on public.rounds
  for each row execute function public.torneo_difundir();

drop trigger if exists torneo_difundir on public.tournament_matches;
create trigger torneo_difundir after insert or update or delete on public.tournament_matches
  for each row execute function public.torneo_difundir();

drop trigger if exists torneo_difundir on public.match_results;
create trigger torneo_difundir after insert or update or delete on public.match_results
  for each row execute function public.torneo_difundir();

drop trigger if exists torneo_difundir on public.match_reports;
create trigger torneo_difundir after insert or update or delete on public.match_reports
  for each row execute function public.torneo_difundir();

drop trigger if exists torneo_difundir on public.match_messages;
create trigger torneo_difundir after insert on public.match_messages
  for each row execute function public.torneo_difundir();

drop trigger if exists torneo_difundir on public.tournament_registrations;
create trigger torneo_difundir after insert or update or delete on public.tournament_registrations
  for each row execute function public.torneo_difundir();

drop trigger if exists torneo_difundir on public.tournament_updates;
create trigger torneo_difundir after insert or update or delete on public.tournament_updates
  for each row execute function public.torneo_difundir();

drop trigger if exists torneo_difundir on public.judge_calls;
create trigger torneo_difundir after insert or update on public.judge_calls
  for each row execute function public.torneo_difundir();

drop trigger if exists torneo_difundir on public.judge_messages;
create trigger torneo_difundir after insert on public.judge_messages
  for each row execute function public.torneo_difundir();

-- Quién escucha el canal: cualquiera (con cuenta o sin ella) puede LEER los
-- avisos de un torneo, como puede ver su ficha. Nadie puede MANDAR: el canal es
-- privado y no hay política de escritura, así que un aviso falso desde el
-- navegador no entra. (Lo privado no viaja: solo qué mesa ha cambiado.)
drop policy if exists torneos_canal_leer on realtime.messages;
create policy torneos_canal_leer on realtime.messages
  for select to anon, authenticated
  using (realtime.topic() like 'torneo:%' and realtime.messages.extension = 'broadcast');

-- ── 1440. Sin check-in, la victoria al momento ──────────────────────────────

create or replace function public.torneos_reclamar_ausencia(p_partida uuid)
returns text
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_m tournament_matches%rowtype;
  v_r rounds%rowtype;
  v_min int;
  v_status text;
  v_ganador uuid;
begin
  select * into v_m from tournament_matches where id = p_partida for update;
  if not found then raise exception 'Mesa no encontrada.'; end if;
  select * into v_r from rounds where id = v_m.round_id;
  -- Los dos jugadores, y quien lleva o arbitra el torneo (1445): el que vino
  -- puede tener el móvil bloqueado, y el organizador suele tener la ficha
  -- abierta en el PC. La regla es la misma la pida quien la pida.
  if auth.uid() is null or (auth.uid() not in (v_m.player_a_id, v_m.player_b_id)
     and not coalesce(torneos_mando(v_r.tournament_id), false)
     and not coalesce(torneos_soy_juez(v_r.tournament_id), false)) then
    raise exception 'Solo los jugadores de la mesa o quien lleva el torneo.';
  end if;
  -- Ya cerrada (el barredor o el rival llegaron antes): se dice cómo quedó.
  if v_m.status <> 'active' then return v_m.status; end if;

  if v_r.status is distinct from 'active' or v_r.started_at is null then return 'pronto'; end if;
  select coalesce(checkin_minutes, 0) into v_min from tournaments where id = v_r.tournament_id;
  -- Sin ventana de check-in no se cierra nada desde aquí: lo decide el barredor.
  if v_min <= 0 then return 'sin_checkin'; end if;
  if now() <= v_r.started_at + make_interval(mins => v_min) then return 'pronto'; end if;
  if v_m.check_in_a_at is not null and v_m.check_in_b_at is not null then return 'presentes'; end if;

  -- La regla del barredor (forfeitPorCheckin, SPEC §6.4).
  if v_m.check_in_a_at is not null then
    v_status := 'forfeit_b'; v_ganador := v_m.player_a_id;
  elsif v_m.check_in_b_at is not null then
    v_status := 'forfeit_a'; v_ganador := v_m.player_b_id;
  else
    v_status := 'forfeit_both'; v_ganador := null;
  end if;

  update tournament_matches set status = v_status, finished_at = now() where id = p_partida;
  insert into match_results (match_id, result, winner_id, resolved_by, score)
  values (p_partida, v_status, v_ganador, null, 'check_in')
  on conflict (match_id) do nothing;
  return v_status;
end $$;

revoke all on function public.torneos_reclamar_ausencia(uuid) from public, anon;
grant execute on function public.torneos_reclamar_ausencia(uuid) to authenticated;
