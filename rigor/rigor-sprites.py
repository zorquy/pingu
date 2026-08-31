# Rigor de los minisprites (tanda 231).
import subprocess, sys
SC='/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO='/home/user/pingu'
NODE='/opt/node22/bin/node'

ROTURAS = [
    ('js/torneos/sprites-pokemon.js', ['test-sprites.mjs', 'test-torneos-23.mjs'], 'la tabla se desplaza un puesto',
     "  if (!DEX_POR_NOMBRE.has(POKEMON_POR_DEX[i])) DEX_POR_NOMBRE.set(POKEMON_POR_DEX[i], i + 1)",
     "  if (!DEX_POR_NOMBRE.has(POKEMON_POR_DEX[i])) DEX_POR_NOMBRE.set(POKEMON_POR_DEX[i], i + 2)"),
    ('js/torneos/sprites-pokemon.js', ['test-sprites.mjs'], 'la normalizacion deja de quitar puntuacion',
     "    .replace(/[^a-z0-9]/g, '')", "    .replace(/ /g, '')"),
    ('js/torneos/sprites-pokemon.js', ['test-sprites.mjs'], 'solo se prueba el nombre entero (sin sufijos)',
     "  for (let largo = palabras.length; largo >= 1; largo--) {", "  for (let largo = palabras.length; largo >= palabras.length; largo--) {"),
    # «Del trozo más corto al más largo» NO se rompe aquí a propósito:
    # con nombres de cartas de verdad da el MISMO resultado, porque no
    # hay ninguna especie cuyo nombre sea una palabra suelta dentro del
    # nombre de otra («Iron Valiant» no contiene ninguna especie llamada
    # «Iron» ni «Valiant»). Se deja el orden de largo a corto porque es
    # el defensivo, pero mutarlo no enseñaría nada: la prueba seguiría
    # en verde con razón, no por estar mal escrita.
    ('js/torneos/sprites-pokemon.js', ['test-sprites.mjs'], 'se usan los sprites de la 5a generacion',
     "const CDN_SPRITES = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon'",
     "const CDN_SPRITES = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/versions/generation-v/black-white'"),
    ('js/torneos/cartas-decklist.js', ['test-torneos-23.mjs'], 'la chapa vuelve a pintar cartas y no sprites',
     "      const directo = l.name ? spriteDeCarta(l.name) : null\n      if (directo && !spritesRotos.has(directo)) return { url: directo, nombre: l.name, sprite: true }",
     ""),
    ('js/torneos/cartas-decklist.js', ['test-torneos-23.mjs'], 'un icono roto se queda como hueco',
     "          img.remove()\n          if (!chapa.querySelector('.torneo-arquetipo-icono')) {\n            chapa.classList.remove('torneo-arquetipo-con-iconos')\n          }",
     "          /* nada */"),
]

def sinc(): subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True)
fallos = []
for rel, pruebas, nombre, viejo, nuevo in ROTURAS:
    ruta = f'{REPO}/{rel}'
    o = open(ruta, encoding='utf-8').read()
    if viejo not in o:
        fallos.append(nombre); print(f'!! {nombre}: no se encuentra el trozo'); continue
    open(ruta,'w',encoding='utf-8').write(o.replace(viejo, nuevo, 1))
    try:
        sinc()
        det = any(subprocess.run([NODE, f'{SC}/{p}'], capture_output=True, text=True).returncode != 0 for p in pruebas)
    finally:
        open(ruta,'w',encoding='utf-8').write(o)
    print(('detectada     ' if det else 'NO DETECTADA  ') + nombre)
    if not det: fallos.append(nombre)
sinc()
print(f'\n{len(ROTURAS)-len(fallos)}/{len(ROTURAS)} detectadas')
sys.exit(1 if fallos else 0)
