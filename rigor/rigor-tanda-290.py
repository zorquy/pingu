"""Rigor de la tanda 290 (el motor de pareos deja de rendirse). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

# CUATRO MUTACIONES QUITADAS A PROPÓSITO, y merece la pena anotar por qué:
#
#   · «el último grupo impar vuelve a rendirse»: ese caso NO EXISTE. El
#     pool es par y el float-down deja pares todos los grupos anteriores,
#     así que el último también lo es. Era código muerto ya en la SPEC y
#     este rigor lo destapó al no poder provocarlo ni con mil torneos.
#     Se quitó del motor en vez de fingir que se prueba.
#   · «sienta a un jugador consigo mismo» y «el pool impar se cuela»: son
#     guardas redundantes — `usados` y la propia búsqueda ya lo impiden.
#   · «el rescate ignora los puntos»: medido, no cambia el reparto. El
#     pool llega ordenado por ranking, así que la cercanía de índice hace
#     ese trabajo sola. Está razonado en motor.js; inventar un umbral que
#     separase 4249 de 4367 sería una prueba de mentira.

MUTACIONES = [
    ('js/torneos/motor.js', 'vuelve el fallo: el rescate no existe',
     "  const rescate = emparejarTodo(ordenDelPool, puntosDe, grupoDe, history)", "  const rescate = null"),

    ('js/torneos/motor.js', 'sin último recurso: una ronda imposible tumba el torneo',
     "  const conRepes = emparejarTodo(ordenDelPool, puntosDe, grupoDe, history, { permitirRepetir: true })",
     "  const conRepes = null"),

    ('js/torneos/motor.js', 'se rescata SIEMPRE y se cambia el pareo de los torneos normales',
     "    if (completo) return { pairings, byePlayerId }", "    if (false) return { pairings, byePlayerId }"),

    ('js/torneos/motor.js', 'las mesas repetidas no se cuentan',
     "        .map((m, i) => (m.repetido ? { tableNumber: i + 1, playerAId: m.playerAId, playerBId: m.playerBId } : null))",
     "        .map(() => null)"),

    ('js/torneos/motor.js', 'el rescate se salta el historial y repite cruces sin avisar',
     "      if (repetido && !permitirRepetir) continue", "      if (false) continue"),

    ('js/torneos/motor.js', 'las mesas se numeran mal',
     "    mesas.map((m, i) => ({ tableNumber: i + 1, playerAId: m.playerAId, playerBId: m.playerBId }))",
     "    mesas.map((m) => ({ tableNumber: 1, playerAId: m.playerAId, playerBId: m.playerBId }))"),

    ('js/torneos/motor.js', 'el bye deja de respetar a quien ya lo tuvo',
     "      if (pool[i].byesReceived === 0) {", "      if (true) {"),

    ('js/torneos/ronda.js', 'las mesas que repiten cruce ya no se avisan',
     "  const repes = plan.repetidos || []", "  const repes = []"),
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
        prueba = 'test-torneos-15.mjs' if 'ronda.js' in fichero else 'test-tanda-290.mjs'
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-290.mjs')], capture_output=True, text=True, cwd=SC)
        open(ruta, 'w').write(base)
        if r.returncode == 0:
            print(f'❌ SIN DETECTAR: {nombre}', flush=True)
            sin_detectar.append(nombre)
        else:
            print(f'✅ detectada: {nombre}', flush=True)
finally:
    for ruta, contenido in originales.items():
        open(ruta, 'w').write(contenido)

if sin_detectar:
    print(f'\n❌ {len(sin_detectar)} sin detectar:')
    for n in sin_detectar:
        print('  -', n)
    sys.exit(1)
print(f'\n✅ Las {len(MUTACIONES)} mutaciones detectadas')
