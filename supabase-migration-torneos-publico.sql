-- ═══════════════════════════════════════════════════════════════════
-- TORNEOS ABIERTOS AL PÚBLICO — ⚠️ NO EJECUTAR TODAVÍA ⚠️
--
-- Este script se ejecuta EL DÍA DEL LANZAMIENTO de los torneos, cuando
-- los admins den el visto bueno (mientras tanto, todo sigue cerrado por
-- las políticas solo-admins de supabase-migration-torneos.sql). Va en
-- dos partes:
--
--   1. Tres RPC con SECURITY DEFINER que mueven al servidor la lógica
--      que hoy corre en el navegador confiando en que quien la ejecuta
--      es admin: el CUPO de inscripción (con lock de fila, como el
--      original), la CONCILIACIÓN de reportes y el ATENDER del juez.
--      El cliente tendrá que pasarse a supabase.rpc(...) en la tanda de
--      apertura — está apuntado en BITACORA.md.
--
--   2. La RLS FINA que sustituye al candado global: lo público se lee,
--      lo propio se escribe, y las decklists ajenas solo las ven
--      organizador y jueces.
--
--   3. (tanda 228) Lo que ve alguien SIN CUENTA al abrir un enlace
--      compartido: el cartel del torneo, quién está inscrito, las mesas
--      en juego y la clasificación. NO ve decklists, ni chats, ni
--      jueces, ni el usuario de TCG Live de nadie — esto último por
--      permisos de columna, no por la interfaz.
--
-- Es re-ejecutable (drop if exists + create or replace).
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── Ayudantes ──────────────────────────────────────────────────────

create or replace function public.torneos_soy_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_profiles p where p.id = auth.uid() and p.is_admin)
$$;

create or replace function public.torneos_soy_juez(t uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from judge_applications j
    where j.tournament_id = t and j.user_id = auth.uid() and j.status = 'approved'
  )
$$;

-- ── RPC 1: inscribirse con el cupo bajo lock (SPEC §8.1) ───────────

create or replace function public.torneos_inscribirse(p_torneo uuid, p_tcg_live text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_torneo tournaments%rowtype;
  v_ocupadas int;
  v_id uuid;
begin
  if auth.uid() is null then raise exception 'Inicia sesión para inscribirte.'; end if;
  if coalesce(trim(p_tcg_live), '') = '' then raise exception 'Di tu usuario de TCG Live.'; end if;

  -- El lock de fila serializa el recuento: dos inscripciones a la vez
  -- ya no pueden rebasar las plazas.
  select * into v_torneo from tournaments where id = p_torneo for update;
  if not found then raise exception 'Torneo no encontrado.'; end if;
  if v_torneo.status <> 'registration_open' then
    raise exception 'Las inscripciones no están abiertas.';
  end if;
  if exists (select 1 from tournament_registrations where tournament_id = p_torneo and user_id = auth.uid()) then
    raise exception 'Ya estás inscrito en este torneo.';
  end if;
  select count(*) into v_ocupadas
    from tournament_registrations
    where tournament_id = p_torneo and status = 'active';
  if v_ocupadas >= v_torneo.max_players then raise exception 'Torneo lleno.'; end if;

  insert into tournament_registrations (tournament_id, user_id, status, tcg_live_username)
    values (p_torneo, auth.uid(), 'active', trim(p_tcg_live))
    returning id into v_id;
  return v_id;
end $$;

-- ── RPC 2: reportar con conciliación en el servidor (SPEC §6.5) ────

create or replace function public.torneos_reportar(p_partida uuid, p_resultado text)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_m tournament_matches%rowtype;
  v_mio match_reports%rowtype;
  v_rival match_reports%rowtype;
  v_res text;
  v_ganador uuid;
  v_a text;
  v_b text;
begin
  if p_resultado not in ('win','loss','draw') then raise exception 'Resultado inválido.'; end if;

  select * into v_m from tournament_matches where id = p_partida for update;
  if not found then raise exception 'Mesa no encontrada.'; end if;
  if auth.uid() not in (v_m.player_a_id, v_m.player_b_id) then
    raise exception 'Solo los jugadores de la mesa pueden reportar.';
  end if;
  if v_m.status not in ('active','awaiting_confirmation') then
    raise exception 'Esta mesa ya no admite reportes.';
  end if;

  select * into v_mio from match_reports where match_id = p_partida and reporter_id = auth.uid();
  if found then
    if v_mio.result = p_resultado then return 'repetido'; end if;
    raise exception 'Ya reportaste un resultado distinto: llama al organizador.';
  end if;

  insert into match_reports (match_id, reporter_id, result) values (p_partida, auth.uid(), p_resultado);

  select * into v_rival from match_reports
    where match_id = p_partida and reporter_id <> auth.uid();
  if not found then
    update tournament_matches set status = 'awaiting_confirmation' where id = p_partida;
    return 'esperando';
  end if;

  -- Conciliación (misma tabla que reconcileReports del motor).
  v_a := case when v_rival.reporter_id = v_m.player_a_id then v_rival.result else p_resultado end;
  v_b := case when v_rival.reporter_id = v_m.player_b_id then v_rival.result else p_resultado end;
  if v_a = 'win' and v_b = 'loss' then v_res := 'a_wins'; v_ganador := v_m.player_a_id;
  elsif v_a = 'loss' and v_b = 'win' then v_res := 'b_wins'; v_ganador := v_m.player_b_id;
  elsif v_a = 'draw' and v_b = 'draw' then v_res := 'draw'; v_ganador := null;
  else
    update tournament_matches set status = 'disputed' where id = p_partida;
    return 'disputa';
  end if;

  update tournament_matches set status = 'finished', finished_at = now() where id = p_partida;
  insert into match_results (match_id, result, winner_id, resolved_by)
    values (p_partida, v_res, v_ganador, null)
    on conflict (match_id) do nothing;
  return 'conciliado';
end $$;

-- ── RPC 3: atender una llamada bajo candado (SPEC §10.2) ───────────

create or replace function public.torneos_atender_llamada(p_llamada uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_torneo uuid;
begin
  select tournament_id into v_torneo from judge_calls where id = p_llamada;
  if not found then raise exception 'Llamada no encontrada.'; end if;
  if not (torneos_soy_admin() or torneos_soy_juez(v_torneo)) then
    raise exception 'Solo jueces aprobados u organizadores atienden llamadas.';
  end if;
  update judge_calls
    set status = 'in_progress', assigned_judge_id = auth.uid()
    where id = p_llamada and status = 'open';
  return found; -- false = otro juez se adelantó
end $$;

-- ── La RLS fina que sustituye al candado solo-admins ───────────────

do $$
declare t text;
begin
  foreach t in array array[
    'tournaments', 'rounds', 'tournament_registrations', 'judge_applications',
    'tournament_decklists', 'tournament_matches', 'match_reports',
    'match_results', 'pairing_history', 'judge_calls', 'judge_messages',
    'match_messages'
  ] loop
    execute format('drop policy if exists torneos_solo_admins on public.%I', t);
  end loop;
end $$;

-- Lo público del torneo: cualquiera con sesión lo lee (los borradores,
-- solo los admins); escribe solo el admin.
drop policy if exists torneos_leer on public.tournaments;
-- El `admin_id = auth.uid()` no es un adorno: quien creó el torneo tiene
-- que ver hasta su propio BORRADOR (si no, no puede ni abrirlo ni
-- borrarlo — para borrar con un `where`, Postgres pide poder leer la
-- fila).
-- Sin `auth.uid() is not null` a propósito (tanda 228): un enlace
-- compartido tiene que enseñar el torneo a quien todavía no tiene
-- cuenta, que es justo la persona a la que queremos convencer. El
-- BORRADOR sigue siendo privado de su organizador.
create policy torneos_leer on public.tournaments for select
  using (status <> 'draft' or admin_id = auth.uid() or torneos_soy_admin());
drop policy if exists torneos_escribir on public.tournaments;
create policy torneos_escribir on public.tournaments for all
  using (torneos_soy_admin()) with check (torneos_soy_admin());
-- Borrar (tanda 222): además del admin del sitio, quien creó el torneo.
-- Va aparte de `torneos_escribir` a propósito: el resto de escrituras
-- (abrir inscripciones, generar pareos) siguen siendo del admin.
drop policy if exists torneos_borrar on public.tournaments;
create policy torneos_borrar on public.tournaments for delete
  using (admin_id = auth.uid() or torneos_soy_admin());

-- Lo que forma el DIRECTO del torneo (rondas, mesas y resultados) se
-- lee sin cuenta: es lo que hace que un enlace compartido valga algo.
-- pairing_history NO: son los cruces ya jugados, solo los usa el pareo
-- suizo del organizador y no pinta nada en un escaparate.
do $$
declare t text;
begin
  foreach t in array array['rounds', 'tournament_matches', 'match_results'] loop
    execute format('drop policy if exists torneos_leer on public.%I', t);
    execute format('create policy torneos_leer on public.%I for select using (true)', t);
    execute format('drop policy if exists torneos_escribir on public.%I', t);
    execute format(
      'create policy torneos_escribir on public.%I for all using (torneos_soy_admin()) with check (torneos_soy_admin())', t);
  end loop;
end $$;

drop policy if exists torneos_leer on public.pairing_history;
create policy torneos_leer on public.pairing_history for select using (auth.uid() is not null);
drop policy if exists torneos_escribir on public.pairing_history;
create policy torneos_escribir on public.pairing_history for all
  using (torneos_soy_admin()) with check (torneos_soy_admin());

-- Inscripciones: se leen (la lista de inscritos es pública dentro del
-- torneo); se CREAN solo por la RPC (security definer, sin política de
-- insert directa); la baja la firma el propio jugador o el admin.
drop policy if exists inscripciones_leer on public.tournament_registrations;
create policy inscripciones_leer on public.tournament_registrations for select
  using (true);

-- EL USUARIO DE TCG LIVE NO SALE A INTERNET.
--
-- La RLS es por FILAS: si un anónimo puede leer la fila, la lee entera,
-- con el nombre con el que esa persona juega dentro. Esconderlo en el
-- JavaScript no esconde nada — la respuesta de la API lo trae igual.
-- Lo que sí lo impide es un permiso por COLUMNA, que es esto:
-- `anon` pierde el select sobre la tabla y lo recupera solo sobre las
-- columnas que son cartel público.
--
-- OJO AL DESINCRONIZARLO: un `select *` de un anónimo sobre una tabla
-- con una columna prohibida no devuelve esa columna vacía, FALLA ENTERO.
-- Por eso js/torneos/torneo.js pide una lista explícita de columnas
-- cuando no hay sesión (COLUMNAS_PUBLICAS_INSCRIPCION). Si aquí se
-- añade o se quita una columna, allí también.
-- El `if exists` es por si esto se ejecuta en una base que no sea la de
-- Supabase (una copia local, una prueba): sin el rol `anon` la orden
-- reventaría y se llevaría por delante la transacción entera.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke select on public.tournament_registrations from anon;
    grant select (
      id, tournament_id, user_id, status, registered_at, dropped_at, dropped_after_round_id
    ) on public.tournament_registrations to anon;
  end if;
end $$;
drop policy if exists inscripciones_baja on public.tournament_registrations;
create policy inscripciones_baja on public.tournament_registrations for update
  using (user_id = auth.uid() or torneos_soy_admin())
  with check (user_id = auth.uid() or torneos_soy_admin());
drop policy if exists inscripciones_admin on public.tournament_registrations;
create policy inscripciones_admin on public.tournament_registrations for delete
  using (torneos_soy_admin());

-- Decklists: el dueño la lleva (y solo mientras no esté sellada);
-- la VEN el dueño, el admin y los jueces aprobados. Nadie más.
drop policy if exists decklists_ver on public.tournament_decklists;
create policy decklists_ver on public.tournament_decklists for select
  using (user_id = auth.uid() or torneos_soy_admin() or torneos_soy_juez(tournament_id));
drop policy if exists decklists_crear on public.tournament_decklists;
create policy decklists_crear on public.tournament_decklists for insert
  with check (user_id = auth.uid());
drop policy if exists decklists_editar on public.tournament_decklists;
create policy decklists_editar on public.tournament_decklists for update
  using ((user_id = auth.uid() and locked_at is null) or torneos_soy_admin())
  with check (user_id = auth.uid() or torneos_soy_admin());

-- Reportes: los crean las RPC; los leen los jugadores de la mesa, el
-- admin y los jueces (la pantalla de disputa los necesita).
drop policy if exists reportes_ver on public.match_reports;
create policy reportes_ver on public.match_reports for select
  using (
    torneos_soy_admin()
    or exists (
      select 1 from tournament_matches m
      where m.id = match_id
        and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid()
             or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))
    )
  );

-- Solicitudes de juez: cada cual la suya; decide el admin.
drop policy if exists jueces_ver on public.judge_applications;
create policy jueces_ver on public.judge_applications for select using (auth.uid() is not null);
drop policy if exists jueces_pedir on public.judge_applications;
create policy jueces_pedir on public.judge_applications for insert
  with check (user_id = auth.uid() and status = 'pending');
drop policy if exists jueces_decidir on public.judge_applications;
create policy jueces_decidir on public.judge_applications for update
  using (torneos_soy_admin()) with check (torneos_soy_admin());

-- Llamadas al juez: las crea un jugador para su mesa; las ven y
-- resuelven implicados, jueces y admin. Atender va por RPC.
drop policy if exists llamadas_ver on public.judge_calls;
create policy llamadas_ver on public.judge_calls for select
  using (created_by = auth.uid() or torneos_soy_admin() or torneos_soy_juez(tournament_id));
drop policy if exists llamadas_crear on public.judge_calls;
create policy llamadas_crear on public.judge_calls for insert
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from tournament_matches m
      where m.id = match_id and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid())
    )
  );
drop policy if exists llamadas_resolver on public.judge_calls;
create policy llamadas_resolver on public.judge_calls for update
  using (torneos_soy_admin() or torneos_soy_juez(tournament_id))
  with check (torneos_soy_admin() or torneos_soy_juez(tournament_id));

-- Chat de la llamada: los de la llamada (creador, jueces, admin).
drop policy if exists mensajes_llamada on public.judge_messages;
create policy mensajes_llamada on public.judge_messages for all
  using (
    exists (
      select 1 from judge_calls c
      where c.id = judge_call_id
        and (c.created_by = auth.uid() or torneos_soy_admin() or torneos_soy_juez(c.tournament_id))
    )
  )
  with check (sender_id = auth.uid());

-- Chat de la mesa: sus dos jugadores, jueces y admin.
drop policy if exists mensajes_mesa on public.match_messages;
create policy mensajes_mesa on public.match_messages for all
  using (
    exists (
      select 1 from tournament_matches m
      where m.id = match_id
        and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid()
             or torneos_soy_admin()
             or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))
    )
  )
  with check (sender_id = auth.uid());

commit;
