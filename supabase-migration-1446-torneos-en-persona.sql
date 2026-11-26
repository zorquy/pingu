-- Tandas 1446–1448 — Torneos en persona (la propuesta «Torneos en persona»,
-- PINGU, 26-11: las tres maneras de apuntarse a elegir, quien llega sin cuenta
-- se la hace en la puerta, los resultados los apuntan los dos jugadores y los
-- puede crear todo el mundo).
--
-- Un torneo puede ser ONLINE (lo de siempre, en TCG Live) o EN PERSONA (en una
-- tienda o un evento, en mesa). En persona:
--   · tiene un SITIO y una DIRECCIÓN, que salen en la ficha con «Cómo llegar»;
--   · no se pide el usuario de TCG Live a nadie;
--   · no hay check-in: lo hace la PUERTA. Quien organiza da ENTRADA a cada
--     jugador (escaneando su QR o buscando su @usuario) y, al empezar, juega
--     solo quien ha entrado.
--   · y se elige cómo se apunta la gente (`inscripcion`):
--       pedir        piden plaza desde casa y en la puerta se les da entrada
--       organizador  nadie se apunta solo: los mete quien organiza al llegar
--       libre        se apuntan solos, como uno online, sin puerta
--
-- Se puede ejecutar dos veces. Sin tablas temporales (tanda 631).

-- ── Las columnas ────────────────────────────────────────────────────────────

alter table public.tournaments add column if not exists modalidad text not null default 'online';
alter table public.tournaments add column if not exists lugar text;
alter table public.tournaments add column if not exists direccion text;
alter table public.tournaments add column if not exists inscripcion text not null default 'libre';

alter table public.tournaments drop constraint if exists tournaments_modalidad_check;
alter table public.tournaments add constraint tournaments_modalidad_check
  check (modalidad in ('online', 'presencial'));
alter table public.tournaments drop constraint if exists tournaments_inscripcion_check;
alter table public.tournaments add constraint tournaments_inscripcion_check
  check (inscripcion in ('pedir', 'organizador', 'libre'));
alter table public.tournaments drop constraint if exists tournaments_lugar_largo;
alter table public.tournaments add constraint tournaments_lugar_largo
  check (lugar is null or char_length(lugar) <= 80);
alter table public.tournaments drop constraint if exists tournaments_direccion_largo;
alter table public.tournaments add constraint tournaments_direccion_largo
  check (direccion is null or char_length(direccion) <= 160);

-- Quién ha pasado por la puerta, cuándo y quién le dio entrada.
alter table public.tournament_registrations add column if not exists entrada_at timestamptz;
alter table public.tournament_registrations add column if not exists entrada_por uuid;

-- ── Apuntarse: en persona, sin TCG Live; con «organizador», no se puede ─────
--
-- La misma función de siempre (la de supabase-migration-torneos-rondas-jornada
-- y torneos-codigo), con dos cambios al principio.

create or replace function public.torneos_inscribirse(p_torneo uuid, p_tcg_live text, p_cola boolean default false, p_codigo text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_torneo tournaments%rowtype;
  v_codigo text;
  v_ocupadas int;
  v_lleno boolean;
  v_estado text;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para inscribirte.'; end if;

  select * into v_torneo from tournaments where id = p_torneo for update;
  if not found then raise exception 'Torneo no encontrado.'; end if;

  -- En persona se juega en mesa: el usuario de TCG Live no se pide (1446).
  if v_torneo.modalidad is distinct from 'presencial' and coalesce(trim(p_tcg_live), '') = '' then
    raise exception 'Di tu usuario de TCG Live.';
  end if;
  if v_torneo.modalidad = 'presencial' and v_torneo.inscripcion = 'organizador' then
    raise exception 'En este torneo te apunta quien lo organiza, cuando llegas.';
  end if;

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
    values (p_torneo, auth.uid(), v_estado, coalesce(trim(p_tcg_live), ''))
    returning id into v_id;
  return v_id;
end $$;

revoke all on function public.torneos_inscribirse(uuid, text, boolean, text) from public;
grant execute on function public.torneos_inscribirse(uuid, text, boolean, text) to authenticated;

-- ── La puerta ───────────────────────────────────────────────────────────────
--
-- Dar entrada a alguien: quien lleva el torneo (organizador o juez), en un
-- torneo en persona sin terminar. Si ya estaba apuntado, se le marca la entrada
-- (y si estaba en la cola y hay sitio, pasa a jugar). Si no, entra igual si hay
-- plaza: es quien llega sin haberla pedido. Devuelve qué ha pasado:
--   'entrada'    se le ha dado ahora
--   'ya_estaba'  ya había entrado
--   'nuevo'      no estaba apuntado y se le ha apuntado con la entrada dada
create or replace function public.torneos_dar_entrada(p_torneo uuid, p_usuario uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_t tournaments%rowtype;
  v_i tournament_registrations%rowtype;
  v_ocupadas int;
begin
  if auth.uid() is null or not coalesce(torneos_mando(p_torneo), false) then
    raise exception 'Solo quien lleva el torneo da entrada.';
  end if;
  select * into v_t from tournaments where id = p_torneo for update;
  if not found then raise exception 'Torneo no encontrado.'; end if;
  if v_t.modalidad is distinct from 'presencial' then raise exception 'Este torneo es online: no tiene puerta.'; end if;
  if v_t.status in ('finished', 'cancelled') then raise exception 'El torneo ya ha terminado.'; end if;
  if not exists (select 1 from user_profiles where id = p_usuario) then raise exception 'No existe esa cuenta.'; end if;

  select count(*) into v_ocupadas from tournament_registrations where tournament_id = p_torneo and status = 'active';

  select * into v_i from tournament_registrations where tournament_id = p_torneo and user_id = p_usuario for update;
  if found then
    if v_i.status = 'dropped' then raise exception 'Se retiró del torneo: ya no puede volver a entrar.'; end if;
    if v_i.entrada_at is not null and v_i.status = 'active' then return 'ya_estaba'; end if;
    if v_i.status = 'waitlisted' and v_t.max_players is not null and v_ocupadas >= v_t.max_players then
      raise exception 'No quedan plazas: está en la lista de espera.';
    end if;
    update tournament_registrations
       set entrada_at = now(), entrada_por = auth.uid(), status = 'active'
     where id = v_i.id;
    return 'entrada';
  end if;

  if v_t.max_players is not null and v_ocupadas >= v_t.max_players then
    raise exception 'No quedan plazas.';
  end if;
  insert into tournament_registrations (tournament_id, user_id, status, tcg_live_username, entrada_at, entrada_por)
    values (p_torneo, p_usuario, 'active', '', now(), auth.uid());
  return 'nuevo';
end $$;

revoke all on function public.torneos_dar_entrada(uuid, uuid) from public, anon;
grant execute on function public.torneos_dar_entrada(uuid, uuid) to authenticated;

-- Quitar la entrada (se la diste a quien no era). Antes de empezar.
create or replace function public.torneos_quitar_entrada(p_torneo uuid, p_usuario uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if auth.uid() is null or not coalesce(torneos_mando(p_torneo), false) then
    raise exception 'Solo quien lleva el torneo quita la entrada.';
  end if;
  if exists (select 1 from rounds where tournament_id = p_torneo) then
    raise exception 'El torneo ya ha empezado.';
  end if;
  update tournament_registrations set entrada_at = null, entrada_por = null
   where tournament_id = p_torneo and user_id = p_usuario;
  return found;
end $$;

revoke all on function public.torneos_quitar_entrada(uuid, uuid) from public, anon;
grant execute on function public.torneos_quitar_entrada(uuid, uuid) to authenticated;

-- Cerrar la puerta: al empezar, quien pidió plaza y no ha entrado se queda
-- fuera (como una baja antes de la ronda 1). Solo en persona con puerta
-- («pedir» u «organizador»); con «libre» no hace nada. Devuelve cuántos.
create or replace function public.torneos_cerrar_puerta(p_torneo uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_t tournaments%rowtype;
  v_n integer;
begin
  if auth.uid() is null or not coalesce(torneos_mando(p_torneo), false) then
    raise exception 'Solo quien lleva el torneo cierra la puerta.';
  end if;
  select * into v_t from tournaments where id = p_torneo;
  if not found then raise exception 'Torneo no encontrado.'; end if;
  if v_t.modalidad is distinct from 'presencial' or v_t.inscripcion = 'libre' then return 0; end if;
  update tournament_registrations
     set status = 'dropped', dropped_at = now(), dropped_after_round_id = null
   where tournament_id = p_torneo and status in ('active', 'waitlisted') and entrada_at is null;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

revoke all on function public.torneos_cerrar_puerta(uuid) from public, anon;
grant execute on function public.torneos_cerrar_puerta(uuid) to authenticated;

-- ── El canal del torneo cuenta también la entrada (1438 + 1446) ─────────────
--
-- La misma función de la 1438 con un dato más en las inscripciones: si ha
-- entrado (sí o no, sin la hora), para que la puerta se vea en vivo en el móvil
-- de los demás jueces.
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
                                   'dropped_at', r.dropped_at, 'dropped_after_round_id', r.dropped_after_round_id,
                                   'entro', r.entrada_at is not null);
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
