"""Rigor de la tanda 321 — los sprites con la CDN caída.

Ninguna de estas mutaciones da error: el manejador esconde lo que no
llega, así que romper la cadena se ve como un hueco vacío y nada más.
Es el fallo que estuvo meses latente y solo salió el día que Limitless
se cayó entera.

La primera mutación es el estado ANTERIOR a esta tanda, tal cual.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

F = 'js/torneos/sprites-pokemon.js'

MUTACIONES = [
    # ── 1. El estado de ayer: el respaldo no sale de la CDN ──
    # ESTE es el fallo. La especie base existe, pero vive en el mismo
    # sitio que se ha caído, así que no rescata nada.
    (F, 'el respaldo vuelve a quedarse dentro de Limitless',
     """  const dex = DEX_POR_URL.get(u)
  if (dex) return `${CDN_RESPALDO}/${dex}.png`
  if (u.startsWith(`${CDN_RESPALDO}/`)) return `${CDN_RESPALDO_2}/${u.slice(CDN_RESPALDO.length + 1)}`
  return null""",
     '  return null'),

    # ── 2. El tercer peldaño, borrado ──
    # Queda uno solo fuera de Limitless: si el que se cae es jsDelivr,
    # otra vez a oscuras. El bloque 3 corta los dos primeros a propósito.
    (F, 'se queda un solo origen de respaldo',
     '  if (u.startsWith(`${CDN_RESPALDO}/`)) return `${CDN_RESPALDO_2}/${u.slice(CDN_RESPALDO.length + 1)}`\n',
     ''),

    # ── 3. Los iconos de caja, que se acaban en el 898 ──
    # El candidato que se descartó: se parecen más y dejan sin sprite a
    # toda la generación que se juega. Un 404 por Pokémon moderno.
    (F, 'el respaldo pasa a los iconos de caja, que no llegan a la novena',
     "const CDN_RESPALDO = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon'",
     "const CDN_RESPALDO = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/versions/generation-viii/icons'"),
    (F, '…y el tercer peldaño, igual',
     "const CDN_RESPALDO_2 = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'",
     "const CDN_RESPALDO_2 = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons'"),

    # ── 4. La tabla, desplazada uno ──
    # Todos los respaldos darían el Pokémon de AL LADO. Es el fallo que
    # no canta a simple vista: se ve un sprite, y es el que no es.
    (F, 'el número de Pokédex del respaldo se va uno',
     '  if (s) DEX_POR_URL.set(`${CDN_SPRITES}/${s}.png`, i + 1)',
     '  if (s) DEX_POR_URL.set(`${CDN_SPRITES}/${s}.png`, i + 2)'),

    # ── 5. Una mega salta su especie base ──
    # Pierde calidad sin motivo: Limitless sí tiene el Pokémon a secas.
    (F, 'una mega se salta la especie base y cambia de origen de golpe',
     '  const base = RESPALDO_POR_URL.get(u)\n  if (base) return base\n', ''),

    # ── 6. Las formas se quedan sin su peldaño a la especie base ──
    # (La mutación que había aquí tocaba DEX_POR_URL con las formas, y
    # el rigor la dio por «sin detectar» con razón: ese registro era
    # CÓDIGO MUERTO, porque toda forma la caza antes RESPALDO_POR_URL.
    # Se quitó del código y la mutación pasó a ser esta, que sí se
    # ejecuta.)
    (F, 'las formas dejan de tener el peldaño de su especie base',
     '  if (!f.slug || !f.base || f.dex === f.base) continue',
     '  continue'),

    # ── 6 bis. Los DOS orígenes de salida, a los iconos de caja ──
    # Cambiando uno solo, los dos dejan de pedir el mismo fichero y lo
    # caza el bloque 1 sin red. Cambiando los dos, la única red es la
    # del bloque 4: los Pokémon de la novena dan 404.
    (F, 'los dos orígenes se van a los iconos de caja a la vez',
     "sprites@master/sprites/pokemon'\nconst CDN_RESPALDO_2 = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'",
     "sprites@master/sprites/pokemon/versions/generation-viii/icons'\nconst CDN_RESPALDO_2 = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-viii/icons'"),

    # ── 7. Una comilla doble dentro del atributo ──
    # Cierra el onerror a media función y el resto se lee como atributos
    # sueltos. No da error: simplemente no hay manejador.
    (F, 'el manejador lleva una comilla doble y parte el atributo',
     '"else{this.style.display=\'none\'}"', '"else{this.style.display=\\"none\\"}"'),

    # ── 8. La cadena no viaja ──
    (F, 'el atributo se queda sin la cadena',
     "  const datos = cadena.length ? ` data-respaldos=\"${cadena.join(' ')}\"` : ''",
     "  const datos = ''"),

    # ── 9. Se intenta para siempre ──
    # Sin el «else» la imagen nunca se esconde: se queda el icono roto
    # del navegador, que es la decisión contraria a la que se tomó.
    (F, 'agotada la cadena, la imagen no se esconde',
     '"else{this.style.display=\'none\'}"', '"else{}"'),

    # ── 10. Los dos peldaños de salida, el mismo ──
    # Con los dos iguales, respaldoDeSprite se devuelve a sí misma: la
    # cadena se llena de repeticiones y, sin el tope del bucle, la
    # pestaña se cuelga. Es la forma de PROBAR ese tope, porque el tope
    # en sí no se puede mutar: no hay ningún dato que lo alcance, así
    # que quitarlo no cambia nada y el rigor lo daba por «sin detectar».
    # Un límite duro contra un cuelgue es código defensivo legítimo
    # aunque hoy no lo dispare nadie — lo que no vale es fingir que una
    # mutación vacía lo prueba.
    (F, 'los dos peldaños de salida apuntan al mismo sitio',
     "const CDN_RESPALDO_2 = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon'",
     "const CDN_RESPALDO_2 = 'https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon'"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-321.mjs')
