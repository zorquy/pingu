# Rigor de la tanda 232: el export en español y el segundo icono.
import subprocess, sys
SC='/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO='/home/user/pingu'
NODE='/opt/node22/bin/node'

ROTURAS = [
    ('js/torneos/motor.js', ['test-decklist-idiomas.mjs'], 'vuelve a entender solo el ingles',
     "  trainer: ['trainer', 'entrenador', 'dresseur', 'allenatore', 'treinador'],\n  energy: ['energy', 'energia', 'energie'],",
     "  trainer: ['trainer'],\n  energy: ['energy'],"),
    ('js/torneos/motor.js', ['test-decklist-idiomas.mjs'], 'la cabecera no quita tildes',
     "    .replace(/[\\u0300-\\u036f]/g, '')\n    .toLowerCase()", "    .toLowerCase()"),
    ('js/torneos/motor.js', ['test-decklist-idiomas.mjs'], 'una carta que empieza por Energy abre seccion',
     "  const m = sinTildes(linea).match(/^([a-z]+)\\s*:/)", "  const m = sinTildes(linea).match(/^([a-z]+)/)"),
    ('js/torneos/motor.js', ['test-decklist-idiomas.mjs'], 'decklistUnparsed sigue con la lista vieja',
     "    if (seccionDeCabecera(line)) {", "    if (/^(pokemon|trainer|energy)\\s*:/i.test(line)) {"),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs', 'test-decklist-idiomas.mjs'], 'una sola copia vuelve a dar nombre al mazo',
     "    if ((Number(x.linea.quantity) || 0) < 2) return false", ""),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs', 'test-decklist-idiomas.mjs'], 'la preevolucion vuelve a colarse de segundo icono',
     "    if (dexPrimera && dex && dex < dexPrimera && dex >= dexPrimera - 3) return false", ""),
    ('js/torneos/arquetipos.js', ['test-torneos-22.mjs'], 'se descarta el segundo icono siempre',
     "  const segunda = candidatas.slice(1).find((x) => {", "  const segunda = [].find((x) => {"),
    ('js/torneos/cartas-decklist.js', ['test-sets-live.mjs'], 'el override del admin deja de mandar',
     "  if (overrides[clave]) {\n    setsPorCodigo.set(codigo, overrides[clave])\n    return overrides[clave]\n  }", ""),
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
