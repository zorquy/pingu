# Rigor de la tanda 234: buscar también lo que no es un Pokémon.
import subprocess, sys
SC='/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO='/home/user/pingu'
NODE='/opt/node22/bin/node'
ROTURAS = [
    ('js/torneos/selector-mazo.js', ['test-partidas-pagina.mjs'], 'deja de buscar cartas',
     "    buscarCartas(texto).then((cartas) => {", "    Promise.resolve([]).then((cartas) => {"),
    ('js/torneos/selector-mazo.js', ['test-partidas-pagina.mjs'], 'los Pokemon salen tambien como carta',
     "    if (dexDeCarta(c.name)) continue", ""),
    ('js/torneos/selector-mazo.js', ['test-partidas-pagina.mjs'], 'la misma carta sale una vez por set',
     "    if (vistos.has(clave)) continue\n    vistos.add(clave)", ""),
    ('js/torneos/selector-mazo.js', ['test-partidas-pagina.mjs'], 'una carta se pinta como si fuera sprite',
     "            ? `<img class=\"${o.esCarta ? 'es-carta' : ''}\" src=\"${escapeHtml(o.sprite)}\" alt=\"\" loading=\"lazy\" />`",
     "            ? `<img src=\"${escapeHtml(o.sprite)}\" alt=\"\" loading=\"lazy\" />`"),
    ('js/torneos/selector-mazo.js', ['test-partidas-pagina.mjs'], 'una respuesta vieja pisa a una nueva',
     "      if (mia !== busqueda || !cartas.length) return", "      if (!cartas.length) return"),
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
