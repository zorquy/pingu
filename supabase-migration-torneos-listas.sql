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
-- OJO: ejecutar DESPUÉS de supabase-migration-torneos-publico.sql —
-- esta migración REHACE su política decklists_ver (usa sus funciones
-- torneos_soy_admin / torneos_soy_juez).
--
-- Es re-ejecutable.
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
-- se pinta. Mismo esqueleto que la original.
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

commit;

-- ── Comprobación ───────────────────────────────────────────────────
-- Todos los torneos tienen modo y ninguno fuera de los tres.
select decklist_visibility, count(*) from public.tournaments group by decklist_visibility;
