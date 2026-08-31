# Rigor de la tanda 230: arquetipos, visibilidad de listas y registro de
# partidas. Cada rotura tiene que hacer fallar la prueba que le toca.
import subprocess, sys
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
NODE = '/opt/node22/bin/node'

# (fichero, pruebas que deberían pillarlo, nombre, viejo, nuevo)
ROTURAS = [
    # ── Arquetipos: la regla ──
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs'], 'no gana el arquetipo mas especifico',
     "candidatos.sort((a, b) => b.requiere.length - a.requiere.length || String(a.id).localeCompare(String(b.id)))",
     "candidatos.sort((a, b) => a.requiere.length - b.requiere.length || String(a.id).localeCompare(String(b.id)))"),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs'], 'un arquetipo desactivado sigue identificando',
     ".filter((a) => a?.activo !== false && Array.isArray(a?.requiere) && a.requiere.length > 0)",
     ".filter((a) => Array.isArray(a?.requiere) && a.requiere.length > 0)"),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs'], 'uno sin requisitos casa con TODOS los mazos',
     "&& a.requiere.length > 0)", ")"),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs', 'test-torneos-23.mjs'], 'los basicos vuelven a dar nombre al mazo',
     "  const buenas = puntuadas.filter((x) => x.puntos > 0)", "  const buenas = []"),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs'], 'el ex deja de mandar sobre las copias',
     "if (/\\bex\\b|\\bV\\b|\\bVMAX\\b|\\bVSTAR\\b|\\bGX\\b/i.test(nombre)) puntos += 10", ""),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs'], 'el orden del export decide los iconos',
     "|| String(a.linea.name).localeCompare(String(b.linea.name)))", ")"),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs'], 'un requisito solo vale por nombre exacto',
     "return nombres.length > 0 && nombres.includes(normalizarNombre(l.name))",
     "return nombres.length > 0 && nombres.includes(String(l.name))"),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs'], 'la clave agrupa por nombre y no por id',
     "return arq.id ? `a:${arq.id}` : `d:${normalizarNombre(arq.nombre)}`",
     "return `d:${normalizarNombre(arq.nombre)}`"),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs'], 'las energias definen el mazo',
     "return [...(parsed?.pokemon || []), ...(parsed?.trainer || [])]",
     "return [...(parsed?.pokemon || []), ...(parsed?.trainer || []), ...(parsed?.energy || [])]"),
    # ── La visibilidad, que es lo que no puede fallar ──
    ('js/torneos/ronda.js', ['test-torneos-23.mjs'], 'las chapas salen con la lista CERRADA en juego',
     "  if (ctx.torneo.status === 'finished') return true\n  return ctx.torneo.show_opponent_decklists === true && ctx.torneo.status === 'in_progress'",
     "  return ['in_progress', 'finished'].includes(ctx.torneo.status)"),
    ('js/torneos/ronda.js', ['test-torneos-23.mjs'], 'las listas no se ven ni al TERMINAR',
     "  if (ctx.torneo.status === 'finished') return true\n", "  "),
    ('js/torneos/ronda.js', ['test-torneos-23.mjs'], 'se piden arquetipos aunque no puedan verse',
     "  if (!puedenVerseLasListas()) {\n    arquetipos = new Map()\n    return\n  }", ""),
    ('js/torneos/ronda.js', ['test-torneos-23.mjs'], 'el catalogo deja de mandar sobre la deduccion',
     "nuevo.set(d.user_id, arquetipoDeMazo(d.parsed_cards, catalogoArquetipos))",
     "nuevo.set(d.user_id, arquetipoDeMazo(d.parsed_cards, []))"),
    # ── La matriz ──
    ('js/matriz-partidas.js', ['test-partidas.mjs'], 'el resultado se lee siempre desde el lado A',
     "  if (resultadoMesa === 'a_wins') return soyA ? 'win' : 'loss'", "  if (resultadoMesa === 'a_wins') return 'win'"),
    ('js/matriz-partidas.js', ['test-partidas.mjs'], 'el empate cuenta como derrota',
     "return (casilla.ganadas + casilla.empatadas * 0.5) / casilla.total", "return casilla.ganadas / casilla.total"),
    ('js/matriz-partidas.js', ['test-partidas.mjs'], 'sin partidas dice 0% en vez de nada',
     "  if (!casilla || !casilla.total) return null", "  if (!casilla || !casilla.total) return 0"),
    ('js/matriz-partidas.js', ['test-partidas.mjs'], 'las columnas se ordenan alfabeticamente',
     "    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))",
     "    .sort((a, b) => String(a[0]).localeCompare(String(b[0])))"),
    ('js/matriz-partidas.js', ['test-partidas.mjs'], 'una partida a medias se cuela en la cuenta',
     "    if (!p?.mio || !p?.rival || !p?.resultado) continue", "    if (!p) continue"),
    ('js/matriz-partidas.js', ['test-partidas.mjs'], 'un enfrentamiento de una partida manda en el resumen',
     "      if (casilla.total < minimo) continue", ""),
    # ── La página ──
    # El filtro de bye de mis-partidas.js NO se mutila aquí a propósito:
    # está doblemente protegido (miResultado no sabe qué es «bye» y
    # devuelve null), así que romperlo no cambia nada y la rotura no
    # enseñaría nada. Se rompe el guardia que SÍ manda:
    ('js/matriz-partidas.js', ['test-partidas.mjs', 'test-partidas-pagina.mjs'], 'el bye cuenta como victoria',
     "  if (resultadoMesa === 'draw') return 'draw'",
     "  if (resultadoMesa === 'bye') return 'win'\n  if (resultadoMesa === 'draw') return 'draw'"),
    ('js/mis-partidas.js', ['test-partidas-pagina.mjs'], 'una partida sin saber el mazo rival se cuela',
     "    if (!mio || !rival) continue", ""),
    ('js/mis-partidas.js', ['test-partidas-pagina.mjs'], 'lo apuntado a mano se guarda sin clave',
     "    mi_mazo: claveDeNombre(mio),", "    mi_mazo: mio,"),
    ('js/mis-partidas.js', ['test-partidas-pagina.mjs'], 'sin sesion se pinta la tabla igual',
     "  if (!session) {\n    $('partidasContenido').classList.add('hidden')\n    $('partidasSinCuenta').classList.remove('hidden')\n    return\n  }",
     "  if (!session) session = { user: { id: 'nadie' } }"),
    ('js/mis-partidas.js', ['test-partidas-pagina.mjs'], 'las de torneo dejan de sumarse a las de fuera',
     "  todas = [...deTorneos, ...apuntadas]", "  todas = [...apuntadas]"),
]

def sincronizar():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True)

fallos = []
for rel, pruebas, nombre, viejo, nuevo in ROTURAS:
    ruta = f'{REPO}/{rel}'
    original = open(ruta, encoding='utf-8').read()
    if viejo not in original:
        fallos.append(nombre); print(f'!! {nombre}: no se encuentra el trozo'); continue
    open(ruta, 'w', encoding='utf-8').write(original.replace(viejo, nuevo, 1))
    try:
        sincronizar()
        detectada = any(
            subprocess.run([NODE, f'{SC}/{p}'], capture_output=True, text=True).returncode != 0
            for p in pruebas
        )
    finally:
        open(ruta, 'w', encoding='utf-8').write(original)
    print(('detectada     ' if detectada else 'NO DETECTADA  ') + nombre)
    if not detectada: fallos.append(nombre)

sincronizar()
print(f'\n{len(ROTURAS) - len(fallos)}/{len(ROTURAS)} detectadas')
sys.exit(1 if fallos else 0)
