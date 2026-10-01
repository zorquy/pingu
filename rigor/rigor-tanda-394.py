"""Rigor de la tanda 394 — lo que pidió PINGU para los torneos.

El contador de mesas, la caja de «Sin check-in» con su baja a mano, las
dos funciones del juez, los arquetipos sin recuadro y la lista en su
ventana. Casi nada de esto da error al romperse: un contador que cuenta
el bye dice 1/8 con buena cara, una baja que no pide confirmación se da
igual, y un juez que escribe directo recibe «hecho» de una base que no
ha tocado nada. Por eso cada mutación rompe el ORIGEN, no una guarda.

Las de la migración las ve la prueba contra PostgreSQL (sql-jueces.sql)
si hay uno en /var/tmp:5433; sin él, solo las ve la lectura del SQL.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

M = 'js/torneos/mesas.js'
R = 'js/torneos/ronda.js'
J = 'js/torneos/jueces.js'
S = 'supabase-migration-torneos-jueces.sql'

MUTACIONES = [
    # ── 1. El contador ──
    (M, 'el bye cuenta como mesa terminada',
     "const esMesaDeVerdad = (m) => Boolean(m?.player_a_id && m?.player_b_id) && m.status !== 'bye'",
     "const esMesaDeVerdad = (m) => Boolean(m?.player_a_id)"),
    # La barra solo se repinta si cambia lo que se compara: sin el
    # contador en la cuenta, una mesa que termina no se ve hasta que
    # cambia otra cosa. Es «sin recargar» roto sin que nada falle.
    (R, 'el contador no entra en lo que decide repintar la barra',
     "  const html = `${rotulo}|${titular}|${der}|${mesasHtml}`",
     "  const html = `${rotulo}|${titular}|${der}`"),

    # ── 2. Quién sale en «Sin check-in» ──
    (M, 'quien reportó sale como si no hubiera venido',
     "      if (l.listo || reporto.has(`${m.id}:${l.id}`)) continue",
     "      if (l.listo) continue"),
    (M, 'quien ya está de baja sigue saliendo',
     "      if (!insc || insc.status !== 'active') continue",
     "      if (!insc) continue"),
    (M, 'una mesa jugada con resultado señala a sus jugadores',
     "    if (m.round_id !== ronda.id || !esMesaDeVerdad(m) || m.status === 'finished') continue",
     "    if (m.round_id !== ronda.id || !esMesaDeVerdad(m)) continue"),
    (J, 'el plazo no se cierra nunca',
     '  const cerrado = Date.now() >= cierre',
     '  const cerrado = false'),

    # ── 3. La baja, a mano y con cuidado ──
    (J, 'la baja se da al primer toque',
     "  if (boton.dataset.confirmar !== '1') {",
     "  if (false) {"),
    # Un juez sin la función se cae al update directo: en la web de
    # verdad la base se lo rechaza en silencio y la pantalla dice «hecho».
    (J, 'un juez sin la migración prueba el camino viejo',
     "    if (!mando()) {\n      showToast(avisoDeMigracion('supabase-migration-torneos-jueces.sql'), 'error')",
     "    if (false) {\n      showToast(avisoDeMigracion('supabase-migration-torneos-jueces.sql'), 'error')"),
    (J, 'la pestaña de jueces no avisa de nada',
     '  return faltanCheckin.length + llamadas.filter',
     '  return 0 * faltanCheckin.length + 0 * llamadas.filter'),

    # ── 4. Resolver como juez ──
    (R, 'un juez resuelve por el update que la base le rechaza',
     "  if (!mando()) {\n    const { error } = await supabase.rpc('torneos_resolver_como_juez'",
     "  if (false) {\n    const { error } = await supabase.rpc('torneos_resolver_como_juez'"),

    # ── 5. La migración ──
    (S, 'la baja sigue siendo solo de quien manda',
     'if not (torneos_mando(v_insc.tournament_id) or torneos_soy_juez(v_insc.tournament_id)) then',
     'if not (torneos_mando(v_insc.tournament_id)) then'),
    (S, 'resolver queda abierto a cualquiera con cuenta',
     'if not (torneos_mando(v_torneo) or torneos_soy_juez(v_torneo)) then',
     'if false then'),
    (S, 'el juez puede corregir una mesa ya cerrada',
     "  if v_m.status in ('finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both') then",
     "  if false then"),

    # ── 6. Los arquetipos ──
    ('css/torneos.css', 'vuelve el recuadro dorado',
     '.torneo-arquetipo-sin-catalogar .torneo-arquetipo-nombre {',
     '.torneo-arquetipo-sin-catalogar .torneo-arquetipo-icono { outline: 1px dashed var(--warning); }\n'
     '.torneo-arquetipo-sin-catalogar .torneo-arquetipo-nombre {'),

    # ── 7. La lista en su ventana ──
    (R, 'la ventana no se abre',
     "  overlay.classList.remove('hidden')\n  // Arriba del todo cada vez",
     "  // Arriba del todo cada vez"),
    (R, 'Escape no la cierra',
     "if (e.key === 'Escape' && !overlay.classList.contains('hidden')) cerrarLista()",
     "if (e.key === 'Escape' && !overlay.classList.contains('hidden')) void 0"),
    (R, 'el foco no vuelve a «Ver lista»',
     '  if (focoAntesDeLista?.isConnected) focoAntesDeLista.focus()',
     ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-394.mjs')
