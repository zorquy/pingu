-- ════════════════════════════════════════════════════════════════════
-- Quien crea un torneo, lo lleva (tanda 296)
-- ════════════════════════════════════════════════════════════════════
--
-- Desde la tanda 266 cualquiera con cuenta puede CREAR un torneo, y las
-- políticas del ciclo (abrir inscripciones, pareos, resultados) ya le
-- dejaban llevarlo. Pero las de alrededor —la baja de un inscrito, las
-- decklists, las solicitudes de juez, las llamadas y los dos chats—
-- seguían siendo del admin del sitio. Resultado: su torneo se le quedaba
-- a medias, y encima EN SILENCIO, porque un UPDATE que la política
-- rechaza no da error: no toca nada y vuelve como si hubiera ido bien.
--
-- Aquí se cierra eso. El criterio pasa a ser uno solo y con nombre:
--
--     torneos_mando(p_torneo) = admin del sitio
--                             O organizador (is_tournament_admin)
--                             O quien creó ESE torneo
--
-- Un solo sitio que tocar el día que el criterio cambie, y un solo
-- nombre que buscar cuando alguien se pregunte quién manda aquí.
--
-- Lo que NO entra en el mando, y sigue siendo del admin del SITIO: el
-- sello de OFICIAL de PokeDoc (disparador torneos_solo_admin_marca_oficial,
-- tanda 266) y repartir el rol de organizador (solo_admin_da_titulos).
--
-- ORDEN: ejecuta esta la ÚLTIMA de las pendientes, después de
-- torneos-chats.sql y torneos-organizadores.sql. Vuelve a escribir
-- políticas que esos ficheros también definen, así que al revés se
-- perdería lo de aquí (la seguridad no: lo de chats va incorporado).
--
-- Se ejecuta en el SQL Editor. Se puede repetir entera.

begin;

-- ------------------------------------------------------------
-- 1. Quién manda en ESTE torneo
-- ------------------------------------------------------------
-- `security definer` porque mira tournaments y user_profiles, que tienen
-- su propia RLS: sin esto, la función vería lo que ve quien pregunta y
-- respondería que no a casi todo.
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
      );
$$;

grant execute on function public.torneos_mando(uuid) to anon, authenticated;

comment on function public.torneos_mando(uuid) is
  'Quién lleva ese torneo: admin del sitio, organizador (is_tournament_admin) o quien lo creó. NO incluye marcar el torneo como oficial de PokeDoc, que es solo del admin del sitio.';

-- ------------------------------------------------------------
-- 2. El ciclo del torneo, con el criterio nuevo
-- ------------------------------------------------------------
-- Ya decían «admin o dueño» desde la tanda 266; se reescriben para que
-- digan el criterio por su nombre y no haya dos formas de lo mismo
-- conviviendo.
drop policy if exists torneos_escribir on public.tournaments;
create policy torneos_escribir on public.tournaments for all
  using (torneos_soy_admin() or admin_id = auth.uid())
  with check (torneos_soy_admin() or admin_id = auth.uid());

drop policy if exists torneos_escribir on public.rounds;
create policy torneos_escribir on public.rounds for all
  using (torneos_mando(tournament_id))
  with check (torneos_mando(tournament_id));

drop policy if exists torneos_escribir on public.tournament_matches;
create policy torneos_escribir on public.tournament_matches for all
  using (exists (
    select 1 from public.rounds r where r.id = round_id and torneos_mando(r.tournament_id)))
  with check (exists (
    select 1 from public.rounds r where r.id = round_id and torneos_mando(r.tournament_id)));

drop policy if exists torneos_escribir on public.match_results;
create policy torneos_escribir on public.match_results for all
  using (exists (
    select 1 from public.tournament_matches m join public.rounds r on r.id = m.round_id
     where m.id = match_id and torneos_mando(r.tournament_id)))
  with check (exists (
    select 1 from public.tournament_matches m join public.rounds r on r.id = m.round_id
     where m.id = match_id and torneos_mando(r.tournament_id)));

drop policy if exists torneos_escribir on public.pairing_history;
create policy torneos_escribir on public.pairing_history for all
  using (torneos_mando(tournament_id))
  with check (torneos_mando(tournament_id));

-- pairing_history se LEE con cuenta y punto (es lo que necesita el pareo
-- suizo), así que ahí no hay nada que ampliar.

-- ------------------------------------------------------------
-- 3. Los inscritos
-- ------------------------------------------------------------
-- La baja (update) se quedó fuera de la tanda 266 mientras el borrado
-- sí entró: el dueño podía EXPULSAR a alguien pero no darle de baja ni
-- confirmarle la participación. Justo las dos cosas que se hacen el día
-- del torneo.
drop policy if exists inscripciones_baja on public.tournament_registrations;
create policy inscripciones_baja on public.tournament_registrations for update
  using (user_id = auth.uid() or torneos_mando(tournament_id))
  with check (user_id = auth.uid() or torneos_mando(tournament_id));

drop policy if exists inscripciones_admin on public.tournament_registrations;
create policy inscripciones_admin on public.tournament_registrations for delete
  using (torneos_mando(tournament_id));

-- ------------------------------------------------------------
-- 4. Las decklists
-- ------------------------------------------------------------
-- Quien lleva el torneo necesita ver las listas para hacer deck check y
-- para resolver una disputa. Es exactamente lo que ya podía el admin: lo
-- único que cambia es QUIÉN cuenta como «quien lleva el torneo».
--
-- La regla de visibilidad para TODOS LOS DEMÁS se copia tal cual de
-- torneos-listas.sql, carácter a carácter. Es la que hace que una lista
-- ajena se vea exactamente cuando el torneo lo permite (terminado, o de
-- lista abierta en juego) — si esto se desalinea, se ven mazos que no se
-- deberían ver, y el fallo no da la cara.
drop policy if exists decklists_ver on public.tournament_decklists;
create policy decklists_ver on public.tournament_decklists for select
  using (
    user_id = auth.uid()
    or torneos_mando(tournament_id)
    or torneos_soy_juez(tournament_id)
    or exists (
      select 1 from public.tournaments t
      where t.id = tournament_id
        and coalesce(t.decklist_visibility, 'al_terminar') <> 'nunca'
        and (
          t.status = 'finished'
          or (coalesce(t.decklist_visibility, 'al_terminar') = 'en_juego' and t.status = 'in_progress')
        )
    )
  );

drop policy if exists decklists_editar on public.tournament_decklists;
create policy decklists_editar on public.tournament_decklists for update
  using ((user_id = auth.uid() and locked_at is null) or torneos_mando(tournament_id))
  with check (user_id = auth.uid() or torneos_mando(tournament_id));

-- ------------------------------------------------------------
-- 5. Los jueces de SU torneo
-- ------------------------------------------------------------
-- Quien lleva el torneo nombra a sus jueces. Si esto no está, monta el
-- torneo pero no puede repartir el trabajo del día.
drop policy if exists jueces_decidir on public.judge_applications;
create policy jueces_decidir on public.judge_applications for update
  using (torneos_mando(tournament_id))
  with check (torneos_mando(tournament_id));

-- ------------------------------------------------------------
-- 6. Las llamadas al juez, y sus dos chats
-- ------------------------------------------------------------
drop policy if exists llamadas_ver on public.judge_calls;
create policy llamadas_ver on public.judge_calls for select
  using (created_by = auth.uid() or torneos_mando(tournament_id) or torneos_soy_juez(tournament_id));

drop policy if exists llamadas_resolver on public.judge_calls;
create policy llamadas_resolver on public.judge_calls for update
  using (torneos_mando(tournament_id) or torneos_soy_juez(tournament_id))
  with check (torneos_mando(tournament_id) or torneos_soy_juez(tournament_id));

-- Los dos chats llevan INCORPORADO el arreglo de torneos-chats.sql (la
-- tanda 294): el `with check` repite la MISMA condición que el `using`
-- además de la firma. En Postgres un INSERT no mira el `using`, así que
-- sin esa repetición cualquiera con cuenta escribe en la mesa de dos
-- desconocidos. Si copias estas políticas a otro sitio, cópialas con sus
-- dos mitades.
drop policy if exists mensajes_mesa on public.match_messages;
create policy mensajes_mesa on public.match_messages for all
  using (
    exists (
      select 1 from tournament_matches m
      where m.id = match_id
        and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid()
             or torneos_mando((select r.tournament_id from rounds r where r.id = m.round_id))
             or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))
    )
  )
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from tournament_matches m
      where m.id = match_id
        and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid()
             or torneos_mando((select r.tournament_id from rounds r where r.id = m.round_id))
             or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))
    )
  );

drop policy if exists mensajes_llamada on public.judge_messages;
create policy mensajes_llamada on public.judge_messages for all
  using (
    exists (
      select 1 from judge_calls c
      where c.id = judge_call_id
        and (c.created_by = auth.uid() or torneos_mando(c.tournament_id) or torneos_soy_juez(c.tournament_id))
    )
  )
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from judge_calls c
      where c.id = judge_call_id
        and (c.created_by = auth.uid() or torneos_mando(c.tournament_id) or torneos_soy_juez(c.tournament_id))
    )
  );

-- ------------------------------------------------------------
-- 7. Los reportes de las mesas
-- ------------------------------------------------------------
-- La pantalla de disputa los necesita: sin esto, quien lleva el torneo
-- ve que hay disputa pero no lo que cada uno dijo.
drop policy if exists reportes_ver on public.match_reports;
create policy reportes_ver on public.match_reports for select
  using (
    exists (
      select 1 from tournament_matches m
      where m.id = match_id
        and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid()
             or torneos_mando((select r.tournament_id from rounds r where r.id = m.round_id))
             or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))
    )
  );

-- ------------------------------------------------------------
-- 8. Atender una llamada (RPC)
-- ------------------------------------------------------------
-- La función es `security definer`, así que la RLS no la para: la puerta
-- es este `if`. Había que abrirla aquí también.
create or replace function public.torneos_atender_llamada(p_llamada uuid)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_torneo uuid;
begin
  select tournament_id into v_torneo from judge_calls where id = p_llamada;
  if not found then raise exception 'Llamada no encontrada.'; end if;
  if not (torneos_mando(v_torneo) or torneos_soy_juez(v_torneo)) then
    raise exception 'Solo jueces aprobados u organizadores atienden llamadas.';
  end if;
  update judge_calls
    set status = 'in_progress', assigned_judge_id = auth.uid()
    where id = p_llamada and status = 'open';
  return found; -- false = otro juez se adelantó
end $$;

commit;

notify pgrst, 'reload schema';

-- ────────────────────────────────────────────────────────────────────
-- Comprobación rápida (opcional)
-- ────────────────────────────────────────────────────────────────────
-- Debe salir torneos_mando en todas estas:
-- select tablename, policyname from pg_policies
--  where schemaname = 'public'
--    and qual like '%torneos_mando%'
--  order by tablename, policyname;
