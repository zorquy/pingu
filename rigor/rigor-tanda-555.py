"""Rigor de la tanda 555 — la repetición de una MESA, en «Rondas».

Lo que se rompe aquí no da error: una repetición de mesa que no ve quien
no tiene cuenta (la consulta entera se cae, o ni se pregunta), un botón
que se ofrece a quien no es o donde no hay partida, un aviso que no sale
la segunda vez, o una puerta de la base que deja pasar. Cada mutación
rompe el ORIGEN de una puerta (tanda 314); las de la base se cazan con la
prueba contra PostgreSQL, que corre la migración mutada.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

RON = 'js/torneos/ronda.js'
DAT = 'js/repeticiones/datos.js'
MIG = 'supabase-migration-torneos-repeticiones-de-mesa.sql'
VIE = 'supabase-migration-repeticiones.sql'

MUTACIONES = [
    # Quién la ve, en la página
    (RON, 'las de mesa solo para quien juega, lleva o arbitra', '      repeticionesDePartidas(idsPartidas),\n',
     '      necesitaReportes ? repeticionesDePartidas(idsPartidas) : Promise.resolve([]),\n'),
    (RON, 'las de mesa se pintan además como de jugador', '  const reps = todas.filter((r) => !r.publica)\n', '  const reps = todas\n'),
    # El botón de los jueces
    (RON, 'cualquiera tiene el botón', '  const juez = Boolean(mando() || ctx.esJuez)\n', '  const juez = true\n'),
    (RON, 'se ofrece una cuarta', '  const puedeAnadir = juez && hayPartida && publicas.length < 3 && !repeticionesMesas.sinDeMesa',
     '  const puedeAnadir = juez && hayPartida && !repeticionesMesas.sinDeMesa'),
    (RON, 'sin la migración se ofrece igual', '  const puedeAnadir = juez && hayPartida && publicas.length < 3 && !repeticionesMesas.sinDeMesa',
     '  const puedeAnadir = juez && hayPartida && publicas.length < 3'),
    (RON, 'un bye ofrece añadir', '  const deMesa = deMesaHtml(m, todas.filter((r) => r.publica), hayPartida && enRondas)',
     '  const deMesa = deMesaHtml(m, todas.filter((r) => r.publica), enRondas)'),
    (RON, 'el formulario sale también en «Tu partida»', '  const deMesa = deMesaHtml(m, todas.filter((r) => r.publica), hayPartida && enRondas)',
     '  const deMesa = deMesaHtml(m, todas.filter((r) => r.publica), hayPartida)'),
    (RON, '«Quitar» no sale para el juez', '        juez ? ` <button type="button" class="link-btn" data-quitar-de-mesa=',
     '        false ? ` <button type="button" class="link-btn" data-quitar-de-mesa='),
    # Pegar, avisar, guardar
    (RON, 'no avisa si los nombres no casan', '    if (!casan && !formDeMesa.aviso) {', '    if (false) {'),
    (RON, 'el mismo aviso otra vez se cree pintado', "        olvidarPintado('mesas')\n", ''),
    (RON, 'lo pegado se pierde al repintar', "    area.value = formDeMesa.texto || ''\n", "    area.value = ''\n"),
    (RON, 'se guarda sin compartir', '      turnos: lectura.eventos.filter((e) => e.tipo === \'turno\').length,\n      compartida: true,\n',
     '      turnos: lectura.eventos.filter((e) => e.tipo === \'turno\').length,\n      compartida: false,\n'),
    (RON, 'se añade por la función del jugador', '    await adjuntarDeMesa(m.id, fila.id)\n', '    await adjuntarATorneo(m.id, fila.id)\n'),
    (RON, 'el título no dice la mesa', "ronda ? `Ronda ${ronda.round_number}` : '', `Mesa ${m.table_number}`,", "ronda ? `Ronda ${ronda.round_number}` : '',"),
    # Lo que se le pide a la base
    (DAT, 'sin la columna no se pregunta otra vez', '  if (error && migracionVieja(error)) {\n    ;({ data, error } = await pedir(', '  if (false) {\n    ;({ data, error } = await pedir('),
    (DAT, 'quitar no dice cuál', "'torneos_juez_quitar_repeticion', { p_partida: partidaId, p_repeticion: replayId }", "'torneos_juez_quitar_repeticion', { p_partida: partidaId }"),
    # La base
    (MIG, 'la política de jugador sigue para todo el mundo', 'alter policy tmr_ver on public.tournament_match_replays to authenticated;\n', ''),
    (MIG, 'sin permiso de leer sin cuenta', 'grant select on table public.tournament_match_replays to anon, authenticated;\n', 'grant select on table public.tournament_match_replays to authenticated;\n'),
    (MIG, 'se ve aunque la mesa no', 'using (publica and exists (select 1 from public.tournament_matches m where m.id = match_id));', 'using (publica);'),
    (MIG, 'se ven también las de jugador', 'using (publica and exists', 'using (true and exists'),
    (MIG, 'la añade cualquiera con cuenta', "  if not (public.torneos_mando(v_torneo) or public.repeticiones_juez_de(v_torneo)) then\n    raise exception 'Solo quien lleva el torneo y sus jueces añaden",
     "  if false then\n    raise exception 'Solo quien lleva el torneo y sus jueces añaden"),
    (MIG, 'a un bye o una pendiente', "  if v_estado in ('pending', 'bye') or v_b is null then", '  if false then'),
    (MIG, 'con la repetición de otro', 'where x.id = p_repeticion and x.user_id = v_yo', 'where x.id = p_repeticion'),
    (MIG, 'sin tope', 't.publica and t.replay_id <> p_repeticion) >= 3 then', 't.publica and t.replay_id <> p_repeticion) >= 99 then'),
    (MIG, 'añadirla no la comparte', '  update public.replays set compartida = true where id = p_repeticion;\n', ''),
    (MIG, 'quitar se lleva las de jugador', '   where match_id = p_partida and replay_id = p_repeticion and publica;', '   where match_id = p_partida and replay_id = p_repeticion;'),
    (MIG, 'la quita cualquiera con cuenta', "  if v_torneo is null or not (public.torneos_mando(v_torneo) or public.repeticiones_juez_de(v_torneo)) then", '  if v_torneo is null then'),
    (VIE, 'la de la 496, otra vez para todo el mundo', 'create policy tmr_ver on public.tournament_match_replays for select to authenticated using (', 'create policy tmr_ver on public.tournament_match_replays for select using ('),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-555.mjs')
