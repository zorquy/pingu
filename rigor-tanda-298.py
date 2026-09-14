"""Rigor de la tanda 298 (la ficha y las rondas). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
R = 'js/torneos/ronda.js'
T = 'js/torneos/torneo.js'
CSS = 'css/torneos.css'
HTML = 'torneo.html'

MUTACIONES = [
    # ── La cabecera ──
    (T, 'la cabecera no dice quién organiza',
     "  textoSiCambia($('torneoMeta'), torneo.is_official ? 'Organiza el equipo de PokeDoc' : organizadorTexto())",
     "  textoSiCambia($('torneoMeta'), '')"),

    (T, 'los datos vuelven a ser cuatro cajas iguales',
     '    .map(([icono, texto]) => `<div class="torneo-dato">${icono}<span>${escapeHtml(texto)}</span></div>`)',
     '    .map(([icono, texto]) => `<div class="torneo-formato-dato">${icono}<span>${escapeHtml(texto)}</span></div>`)'),

    (T, 'el torneo oficial pierde su sello en la ficha',
     "  if (torneo.is_official) {", "  if (false) {"),

    # ── La barra viva ──
    (R, 'la barra viva no dice por qué ronda va',
     "  const rotulo = `${fase} ${ronda.round_number}${ronda.phase === 'top_cut' || !total ? '' : ` de ${total}`}`",
     "  const rotulo = 'En marcha'"),

    (R, 'la barra viva no dice contra quién juegas',
     "    titular = `Tu partida contra ${nombreDe(rivalId)}`",
     "    titular = 'Tienes partida'"),

    (R, 'la barra te pide el check-in que ya hiciste',
     "    if (!miListo) der = '<span class=\"torneo-viva-pide\">Te falta el check-in</span>'",
     "    der = '<span class=\"torneo-viva-pide\">Te falta el check-in</span>'"),

    (R, 'la barra viva no avisa de que falta tu rival',
     "    else if (!rivalListo) der = `<span class=\"torneo-viva-espera\">${escapeHtml(nombreDe(rivalId))} aún no ha hecho check-in</span>`",
     "    else if (false) der = ''"),

    (R, 'la barra viva se queda aunque no haya ronda',
     "    $('torneoBarraViva')?.classList.add('hidden')", "    // sin esconder la barra"),

    (R, 'el anillo no se vacía: siempre dice que queda todo',
     "      const queda = total > 0 ? Math.max(0, Math.min(1, (fin - ya) / total)) : 0",
     "      const queda = 1"),

    (CSS, 'la barra viva deja de ir pegada arriba',
     ".torneo-viva {\n  position: sticky;\n  top: 0;", ".torneo-viva {\n  position: static;\n  top: 0;"),

    # ── El tablero ──
    (R, 'el marcador de la serie desaparece del duelo',
     "  const serie = bo === 3 ? serieBo3(juegosDeMesa(mia).confirmados) : null",
     "  const serie = null"),

    (R, 'el marcador no marca quién va ganando',
     '<b class="${mias > suyas ? \'gana\' : \'\'}">${mias}</b><i>—</i><b class="${suyas > mias ? \'gana\' : \'\'}">${suyas}</b>',
     '<b>${mias}</b><i>—</i><b>${suyas}</b>'),

    (R, 'el check-in del rival se pierde del tablero',
     "      ${jugador(rivalNombre, chapaDe(rivalId) || `<span class=\"subtext\">${escapeHtml(rival?.tcg_live_username || '—')}</span>`, rivalListo, rivalNombre.slice(0, 1), colorDeNombre(rivalNombre))}",
     "      ${jugador(rivalNombre, '', true, rivalNombre.slice(0, 1), colorDeNombre(rivalNombre))}"),

    # ── El BO3 ──
    (R, 'las casillas del BO3 no dicen por el color cómo fueron',
     "  const clase = confirmados[n] ? `cerrada ${comoFue(confirmados[n], soyA)}` : abierta ? 'activa' : ''",
     "  const clase = confirmados[n] ? 'cerrada' : ''"),

    (R, 'el color de la casilla se saca del TEXTO, no del resultado',
     "  if (resultado === 'draw') return 'tablas'\n  return (resultado === 'a_wins') === soyA ? 'ganada' : 'perdida'",
     "  return 'tablas'"),

    (CSS, 'los botones vuelven a salirse de su casilla en el móvil',
     "  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n\n.torneo-bo3-cerrada {",
     "  display: flex;\n  flex-direction: column;\n  gap: 6px;\n}\n.torneo-bo3-juego { flex-wrap: wrap; height: 90px; }\n\n.torneo-bo3-cerrada {"),

    # ── Las mesas ──
    (R, 'la mesa que juegas deja de estar marcada',
     "      const esMia = Boolean(yo && (m.player_a_id === yo || m.player_b_id === yo))",
     "      const esMia = false"),

    (R, 'en una mesa cerrada no se ve quién ganó',
     "      const ganaA = terminal && (res?.winner_id === m.player_a_id || m.status === 'bye' || m.status === 'forfeit_b')",
     "      const ganaA = false"),

    # ── La línea de tiempo ──
    (R, 'la línea de tiempo se queda sin el reloj de la ronda viva',
     "    reloj: Boolean(r && r.status === 'active' && r.ends_at),",
     "    reloj: false,"),

    (R, 'la ronda que se juega no destaca en la línea',
     "    clase: !r ? '' : r.status === 'active' ? 'viva' : r.status === 'finished' ? 'fin' : 'lista',",
     "    clase: '',"),

    # ── La clasificación ──
    (R, 'los tres primeros pierden su medalla',
     "      const medalla = i < 3 ? ` torneo-pos-${i + 1}` : ''", "      const medalla = ''"),

    (R, 'tu fila deja de estar marcada en la clasificación',
     "      <tr class=\"${e.playerId === miId() ? 'torneo-fila-yo' : ''}\">", "      <tr>"),

    # ── Y que no se lleve por delante lo que ya había ──
    (R, 'el organizador se queda sin resolver una mesa',
     "        (puedeResolver && !terminal) || (puedeCorregir && terminal && m.status !== 'bye')", "        false"),

    (HTML, 'la ficha se queda sin la barra viva',
     '    <div class="torneo-viva hidden" id="torneoBarraViva">',
     '    <div class="torneo-viva hidden" id="torneoBarraVivaQueNoEs">'),
]

originales = {}
sin_detectar = []
try:
    for fichero, nombre, viejo, nuevo in MUTACIONES:
        ruta = os.path.join(REPO, fichero)
        if ruta not in originales:
            originales[ruta] = open(ruta).read()
        base = originales[ruta]
        if base.count(viejo) != 1:
            print(f'⚠️  ANCLA MALA ({base.count(viejo)} veces) en {fichero}: {nombre}', flush=True)
            sin_detectar.append(f'{nombre} (ancla mala)')
            continue
        open(ruta, 'w').write(base.replace(viejo, nuevo))
        subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-298.mjs')], capture_output=True, text=True, cwd=SC)
        open(ruta, 'w').write(base)
        if r.returncode == 0:
            print(f'❌ SIN DETECTAR: {nombre}', flush=True)
            sin_detectar.append(nombre)
        else:
            print(f'✅ detectada: {nombre}', flush=True)
finally:
    for ruta, contenido in originales.items():
        open(ruta, 'w').write(contenido)
    subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)

if sin_detectar:
    print(f'\n❌ {len(sin_detectar)} sin detectar:')
    for n in sin_detectar:
        print('  -', n)
    sys.exit(1)
print(f'\n✅ Las {len(MUTACIONES)} mutaciones detectadas')
