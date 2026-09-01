# Rigor de la tanda 233: códigos automáticos, buscador de mazo y los
# resultados que no son partida.
import subprocess, sys
SC='/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO='/home/user/pingu'
NODE='/opt/node22/bin/node'

ROTURAS = [
    # ── Códigos de set automáticos ──
    ('js/torneos/cartas-decklist.js', ['test-sets-live.mjs'], 'deja de mirar el codigo de la base',
     "      .eq('tcg_online_code', clave)", "      .eq('tcg_online_code', 'NUNCA')"),
    ('js/torneos/cartas-decklist.js', ['test-sets-live.mjs'], 'lo asignado a mano deja de mandar',
     "  if (overrides[clave]) {\n    setsPorCodigo.set(codigo, overrides[clave])\n    return overrides[clave]\n  }", ""),
    ('js/torneos/cartas-decklist.js', ['test-sets-live.mjs'], 'se cae la red de la tabla escrita a mano',
     "    const nombre = nombreDeSetLive(clave)", "    const nombre = null"),
    ('js/tcgdex.js', ['test-tcgdex-codigo.mjs'], 'el codigo de set se guarda sin validar',
     "  return /^[A-Z0-9]{2,6}$/.test(limpio) ? limpio : null", "  return limpio"),
    ('js/tcgdex.js', ['test-tcgdex-codigo.mjs'], 'el listado pisa el codigo con null',
     "  const codigo = codigoLiveDeSet(set)\n  if (codigo) fila.tcg_online_code = codigo",
     "  fila.tcg_online_code = codigoLiveDeSet(set)"),
    # ── El buscador de mazo ──
    ('js/torneos/selector-mazo.js', ['test-selector-mazo.mjs'], 'lo que empieza deja de ir delante',
     "      Number(b.empieza) - Number(a.empieza) ||", ""),
    ('js/torneos/selector-mazo.js', ['test-selector-mazo.mjs'], 'los catalogados dejan de mandar',
     "      (a.tipo === b.tipo ? 0 : a.tipo === 'arquetipo' ? -1 : 1) ||", ""),
    ('js/torneos/selector-mazo.js', ['test-selector-mazo.mjs'], 'la lista deja de estar acotada',
     "  return opciones.slice(0, limite)", "  return opciones"),
    ('js/torneos/selector-mazo.js', ['test-selector-mazo.mjs'], 'la clave del mazo cambia de forma',
     "      valor: `d:${POKEMON_POR_DEX[i].toLowerCase()}`,", "      valor: POKEMON_POR_DEX[i],"),
    ('js/torneos/selector-mazo.js', ['test-selector-mazo.mjs'], 'la busqueda no ignora la puntuacion',
     "    .replace(/[^a-z0-9]/g, '')\n  if (!q) return []", "\n  if (!q) return []"),
    # ── Lo que no es una partida ──
    ('js/mis-partidas.js', ['test-partidas-pagina.mjs'], 'el bye entra en la matriz',
     "  const m = construirMatriz(partidas.filter((p) => !['bye', 'no_show'].includes(p.tipo)))",
     "  const m = construirMatriz(partidas)"),
    ('js/mis-partidas.js', ['test-partidas-pagina.mjs'], 'el ID deja de ser un empate',
     "    resultado: tipoElegido === 'id' ? 'draw' : tipoElegido === 'normal' ? $('partidaResultado').value : 'win',",
     "    resultado: $('partidaResultado').value,"),
    ('js/mis-partidas.js', ['test-partidas-pagina.mjs'], 'un bye exige mazo rival',
     "  const necesitaRival = tipoElegido !== 'bye'", "  const necesitaRival = true"),
    ('js/mis-partidas.js', ['test-partidas-pagina.mjs'], 'los dos Pokemon no se juntan en un mazo',
     "    nombre: catalogado ? catalogado.nombre : partes.map((p) => p.nombre).join(' '),",
     "    nombre: catalogado ? catalogado.nombre : partes[0].nombre,"),
    ('js/mis-partidas.js', ['test-partidas-pagina.mjs'], 'tu mazo se limpia tambien al guardar',
     "  selectores.rival1?.limpiar()\n  selectores.rival2?.limpiar()",
     "  for (const s of Object.values(selectores)) s?.limpiar()"),
]

def sinc(): subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True)
fallos=[]
for rel, pruebas, nombre, viejo, nuevo in ROTURAS:
    ruta=f'{REPO}/{rel}'; o=open(ruta,encoding='utf-8').read()
    if viejo not in o:
        fallos.append(nombre); print(f'!! {nombre}: no se encuentra el trozo'); continue
    open(ruta,'w',encoding='utf-8').write(o.replace(viejo,nuevo,1))
    try:
        sinc()
        det = any(subprocess.run([NODE, f'{SC}/{p}'], capture_output=True, text=True).returncode != 0 for p in pruebas)
    finally:
        open(ruta,'w',encoding='utf-8').write(o)
    print(('detectada     ' if det else 'NO DETECTADA  ')+nombre)
    if not det: fallos.append(nombre)
sinc()
print(f'\n{len(ROTURAS)-len(fallos)}/{len(ROTURAS)} detectadas')
sys.exit(1 if fallos else 0)
