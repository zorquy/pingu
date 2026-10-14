"""Rigor de la tanda 834 — la decklist oficial de Play! Pokémon.

Cada mutación rompe el ORIGEN: la categoría por año, la abreviatura de
las promos, la codificación WinAnsi, el escapado del flujo, la
actualización incremental, las básicas juntas, el diálogo (relleno desde
tu perfil, guardar solo si cambia, Player ID con letras) y la tabla
privada."""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

DO = 'js/decklist-oficial.js'
HO = 'js/constructor/hoja-oficial.js'
PP = 'js/play-pokemon.js'
PE = 'js/perfil.js'
MIG = 'supabase-migration-play-pokemon.sql'

MUTACIONES = [
    (DO, 'Junior desde 2013', "  if (anio >= temporada - 12) return 'junior'", "  if (anio >= temporada - 13) return 'junior'"),
    (DO, 'las promos SV salen como PR', "const PROMOS_DE_LA_HOJA = { 'PR-SV': 'SVP', 'PR-ME': 'MEP' }", "const PROMOS_DE_LA_HOJA = { 'PR-ME': 'MEP' }"),
    (DO, 'el ’ se pierde', "'’': 0x92, ", ""),
    (DO, 'los paréntesis no se escapan', "c === 40 || c === 41 || c === 92 ? '\\\\' + String.fromCharCode(c)", "c === 92 ? '\\\\' + String.fromCharCode(c)"),
    (DO, 'la xref apunta un byte antes', "  const offsetObjeto = bytes.length + inicio.length", "  const offsetObjeto = bytes.length + inicio.length - 1"),
    (DO, 'sin /Prev (se pierde la plantilla)', "${id ? ` /ID ${id}` : ''} /Prev ${prev} >>", "${id ? ` /ID ${id}` : ''} >>"),
    (DO, 'las básicas no se juntan', "    if (ya) ya.n += e.n\n    else energias.push({ n: e.n, nombre: nom })", "    energias.push({ n: e.n, nombre: nom })"),
    (DO, 'los Pokémon sin marca de regulación', "      reg: String(e.carta.regulation_mark || '').trim().toUpperCase().slice(0, 1),", "      reg: '',"),
    (HO, 'no se rellena desde el perfil', "    if (guardados.player_id && vacio('cmHojaPlayerId')) $('cmHojaPlayerId').value = guardados.player_id", ""),
    (HO, 'se guarda aunque no haya cambiado', "  if (antes.nombre === ahora.nombre && antes.playerId === ahora.playerId && antes.nacimiento === ahora.nacimiento) return", ""),
    (HO, 'un Player ID con letras pasa', "  if (d.playerId && !limpiarPlayerId(d.playerId)) {", "  if (false) {"),
    (HO, 'sin la migración se intenta guardar igual', "  if (!userId || !$('cmHojaRecordar').checked || guardados === null) return", "  if (!userId || !$('cmHojaRecordar').checked) return"),
    (PP, 'la tabla que falta no se distingue', "  if (error) return { estado: faltaLaTablaPlay(error) ? 'falta' : 'error', fila: null }", "  if (error) return { estado: 'error', fila: null }"),
    (PE, 'el perfil no guarda el Player ID', "        const errorPlay = await guardarDatosPlay(currentSession.user.id, nuevo)", "        const errorPlay = null"),
    (MIG, 'cualquiera lee los datos de otro', "create policy play_pokemon_ver on public.user_play_pokemon for select to authenticated\n  using (user_id = auth.uid());", "create policy play_pokemon_ver on public.user_play_pokemon for select to authenticated\n  using (true);"),
    (MIG, 'se escribe la fila de otro', "create policy play_pokemon_crear on public.user_play_pokemon for insert to authenticated\n  with check (user_id = auth.uid());", "create policy play_pokemon_crear on public.user_play_pokemon for insert to authenticated\n  with check (true);"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-834.mjs')
