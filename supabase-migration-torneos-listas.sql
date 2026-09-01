-- ═══════════════════════════════════════════════════════════════════
-- LAS LISTAS DE LOS RIVALES, EN TRES MODOS (tanda 241)
--
-- Lo pidió Ibai: la casilla de «listas a la vista» se queda corta.
-- Tres modos de verdad:
--
--   · 'al_terminar' (lo de siempre por defecto): las listas se ven
--     cuando el torneo TERMINA — ya no hay partida que regalar.
--   · 'en_juego' (la casilla antigua marcada): lista abierta, se ven
--     desde que arranca la ronda 1.
--   · 'nunca' (NUEVO): no se ven ni al terminar. Solo el dueño, el
--     organizador y los jueces.
--
-- El booleano viejo (show_opponent_decklists) NO se borra: el cliente
-- lo mantiene en sincronía al crear/editar (true = 'en_juego') y hace
-- de respaldo para código desplegado antes que esta migración.
--
-- La política decklists_ver de torneos-publico.sql se rehace con los
-- tres modos SOLO SI esa migración ya corrió (sus funciones
-- torneos_soy_admin/juez existen). Si no —hoy la sección está en
-- pruebas y manda torneos_solo_admins—, se salta con un NOTICE:
-- torneos-publico.sql ya trae la regla de los tres modos incorporada
-- para cuando se ejecute.
--
-- Es re-ejecutable, en cualquier orden respecto a torneos-publico.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.tournaments
  add column if not exists decklist_visibility text;

-- El relleno de los torneos que ya existen, UNA vez (solo toca filas
-- sin valor, así re-ejecutar no pisa lo que alguien haya cambiado).
update public.tournaments
  set decklist_visibility = case when show_opponent_decklists then 'en_juego' else 'al_terminar' end
  where decklist_visibility is null;

alter table public.tournaments
  alter column decklist_visibility set default 'al_terminar';
alter table public.tournaments
  alter column decklist_visibility set not null;

alter table public.tournaments
  drop constraint if exists tournaments_decklist_visibility_check;
alter table public.tournaments
  add constraint tournaments_decklist_visibility_check
  check (decklist_visibility in ('en_juego', 'al_terminar', 'nunca'));

-- ── La política que de verdad manda ──
-- La regla de la tanda 230 (torneos-publico) rehecha con los tres
-- modos: el «nunca» tiene que cumplirse EN LA BASE, no solo en lo que
-- se pinta. Pero SOLO si torneos-publico ya corrió: sus funciones
-- torneos_soy_admin/juez son parte de la política, y sin ellas el
-- CREATE POLICY revienta (fue el fallo que Ibai se encontró el
-- 2026-09-01). Mientras la sección esté en pruebas, la política
-- torneos_solo_admins ya cierra las decklists a los admins, así que no
-- hay agujero por saltarse este paso.
do $$
begin
  if to_regprocedure('public.torneos_soy_admin()') is null
     or to_regprocedure('public.torneos_soy_juez(uuid)') is null then
    raise notice 'torneos-publico.sql aún no se ha ejecutado: la política decklists_ver se queda como está (ya trae los tres modos incorporados para cuando corra).';
    return;
  end if;
  drop policy if exists decklists_ver on public.tournament_decklists;
  create policy decklists_ver on public.tournament_decklists for select
    using (
      user_id = auth.uid()
      or torneos_soy_admin()
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
end $$;

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- Todos los torneos tienen modo y ninguno fuera de los tres.
select decklist_visibility, count(*) from public.tournaments group by decklist_visibility;
