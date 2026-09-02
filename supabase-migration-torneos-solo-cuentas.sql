-- ── Torneos SOLO CON CUENTA (2026-09-02, pedido de Ibai) ─────────────
--
-- Cierra a los ANÓNIMOS lo que la apertura (torneos-publico, tanda 252
-- y el modo escaparate de la 229) les había abierto: la sección «Jugar»
-- pasa a verse solo con sesión. La sección sigue siendo de CUALQUIER
-- cuenta — esto no devuelve nada al candado de admins.
--
-- El cliente ya redirige a /auth.html a quien no tenga sesión (con
-- vuelta al torneo tras entrar), pero un `if` en el navegador no cierra
-- nada: quien cierra es esta política. Ejecutar DESPUÉS de
-- torneos-publico.sql — pisa sus políticas de lectura a propósito.
--
-- Efecto colateral asumido: la vista previa personalizada de un enlace
-- de torneo compartido (meta-social.js usa la clave publicable) pasa a
-- la genérica del sitio — ese fichero ya está escrito para degradar
-- solo, ver su comentario «OJO CON LO QUE ESTO PUEDE Y NO PUEDE
-- ENSEÑAR».

begin;

-- El torneo mismo: leer pide sesión. Se conserva el resto de la regla
-- de torneos-publico (el borrador solo lo ve su organizador o el
-- equipo).
drop policy if exists torneos_leer on public.tournaments;
create policy torneos_leer on public.tournaments for select
  using (
    auth.uid() is not null
    and (status <> 'draft' or admin_id = auth.uid() or torneos_soy_admin())
  );

-- El directo (rondas, mesas, resultados): de `using (true)` a pedir
-- sesión.
do $$
declare t text;
begin
  foreach t in array array['rounds', 'tournament_matches', 'match_results'] loop
    execute format('drop policy if exists torneos_leer on public.%I', t);
    execute format('create policy torneos_leer on public.%I for select using (auth.uid() is not null)', t);
  end loop;
end $$;

-- Inscripciones: la lista de inscritos vuelve a pedir sesión, y el
-- permiso por COLUMNAS que torneos-publico le dio al rol `anon`
-- (el cartel público sin el usuario de TCG Live) se retira entero.
-- OJO: COLUMNAS_PUBLICAS_INSCRIPCION en js/torneos/torneo.js era el
-- acompañante de ese permiso; con la redirección del cliente ese camino
-- ya no se pisa, pero si algún día se reabre a anónimos, hay que
-- devolver las dos piezas a la vez.
drop policy if exists inscripciones_leer on public.tournament_registrations;
create policy inscripciones_leer on public.tournament_registrations for select
  using (auth.uid() is not null);
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke select on public.tournament_registrations from anon;
  end if;
end $$;

-- Decklists: la rama «se ven cuando el torneo lo permite» valía también
-- para anónimos (un torneo terminado enseñaba sus listas sin cuenta).
-- Misma regla de tres modos que torneos-publico, ahora tras la sesión.
-- La columna decklist_visibility ya existe en producción
-- (torneos-listas); si esta migración corre en una copia sin ella, la
-- variante del booleano viejo está en torneos-publico.sql.
drop policy if exists decklists_ver on public.tournament_decklists;
create policy decklists_ver on public.tournament_decklists for select
  using (
    user_id = auth.uid()
    or torneos_soy_admin()
    or torneos_soy_juez(tournament_id)
    or (
      auth.uid() is not null
      and exists (
        select 1 from public.tournaments t
        where t.id = tournament_id
          and coalesce(t.decklist_visibility, 'al_terminar') <> 'nunca'
          and (
            t.status = 'finished'
            or (coalesce(t.decklist_visibility, 'al_terminar') = 'en_juego' and t.status = 'in_progress')
          )
      )
    )
  );

commit;
