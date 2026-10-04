"""Rigor de la tanda 515 — compartir una posición del laboratorio.

Lo que se rompe aquí no da error: una mesa que se abre con otras cartas en
otro sitio, un enlace que se lleva de más o de menos, o uno roto que abre
una mesa a medias. Cada mutación rompe el ORIGEN.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

POS = 'js/constructor/posicion-compartida.js'
LAB = 'js/constructor/laboratorio.js'
CON = 'js/constructor.js'

MUTACIONES = [
    (POS, 'los registros viajan enteros', 'const sinRegistro = (s) => ({ ...s, registro: [] })', 'const sinRegistro = (s) => s'),
    (POS, 'el mazo viaja en otro orden',
     "      c: m.entradas.map((x) => [x.carta.id,", "      c: [...m.entradas].reverse().map((x) => [x.carta.id,"),
    (POS, 'una carta sin catálogo pierde su tipo',
     "carta: catalogo.get(id) || { id, name, name_es: nameEs || name, category } })),", "carta: catalogo.get(id) || { id, name, name_es: nameEs || name } })),"),
    (POS, 'las cartas del catálogo no se usan', 'carta: catalogo.get(id) || {', 'carta: null || {'),
    (POS, 'al catálogo se le piden las inventadas',
     ".filter((id) => id !== 'sin-ver' && !id.startsWith('suelta:'))", ''),
    (POS, 'un lado sin forma de mesa pasa',
     '  const ladoBueno = (s) => s && Array.isArray(s.mazo) &&', '  const ladoBueno = (s) => true || Array.isArray(s.mazo) &&'),
    (POS, 'lo que descomprime se abre sin mirar', '    return esPosicion(x) ? x : null', '    return x'),
    (LAB, 'con mesa no se coloca nada',
     'colocar: (mesa) => mesa.restaurar(structuredClone(posicion.estado)), aviso,', 'colocar: () => null, aviso,'),
    (LAB, 'el registro no dice de dónde sale',
     'colocar: (mesa) => mesa.restaurar(structuredClone(posicion.estado)), aviso,', 'colocar: (mesa) => mesa.restaurar(structuredClone(posicion.estado)), aviso: \'\','),
    (LAB, 'contra el muñeco se empieza de cero', '  L.partida.s = structuredClone(posicion.estado)\n', ''),
    (LAB, 'la ventana dice que lleva lo que no lleva',
     "  const quien = L.mesa ? 'los dos mazos y las dos manos' : 'tu mazo, tu mano y el muñeco'",
     "  const quien = 'los dos mazos y las dos manos'"),
    (LAB, 'el enlace no lleva la mesa detrás del #', '/constructor#${await empaquetarPosicion(posicion)}', '/constructor?${await empaquetarPosicion(posicion)}'),
    (LAB, 'compartir con mesa se lleva solo un lado',
     "    return { tipo: 'mesa', nombres: [a.nombreJugador, b.nombreJugador], mazos: L.mazos,", "    return { tipo: 'muneco', nombres: [a.nombreJugador, b.nombreJugador], mazos: L.mazos,"),
    (CON, 'el constructor no mira el enlace', "  else if (location.hash.startsWith('#pos=')) {", '  else if (false) {'),
    (CON, 'no se piden las cartas al catálogo',
     '  const catalogo = await cartasPorIds(P.idsDelCatalogo(x)).catch(() => new Map())', '  const catalogo = new Map()'),
    (CON, 'un enlace roto abre algo igual',
     "  if (!x) return showToast('El enlace de la posición está roto o incompleto: ¿se cortó al copiarlo?', 'error')", '  if (!x) return'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-515.mjs')
