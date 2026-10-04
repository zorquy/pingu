// Tanda 529 — las tres rarezas que sacó la primera pasada grande.
//
// Con 14.833 cartas visitadas, el informe de /admin pasó de 11 rarezas a
// 24 y señaló tres sin traducir: «Trainer Gallery Rare Holo» (32 cartas),
// «Rare Prism Star» (5) y «Rare ACE» (1).
//
// Las tres son MECANISMOS con nombre oficial en español, que es lo que las
// diferencia de una traducción inventada: «Prism Star» se publicó aquí
// como Prisma Estelar y va impreso en la carta; la Trainer Gallery de
// Espada y Escudo se rotuló Galería de Entrenadores; y «Rare ACE» es la
// rareza de los ACE SPEC de Negro y Blanco — el mismo mecanismo que hoy
// llaman «ACE SPEC Rare».
import { rarezaEs, rarezaConocida } from '/home/user/pingu/js/rarezas-nombres.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Las tres que faltaban ──')
{
  check('Prism Star es Prisma Estelar', rarezaEs('Rare Prism Star') === 'Rara Prisma Estelar', rarezaEs('Rare Prism Star'))
  check('Trainer Gallery es Galería de Entrenadores',
    rarezaEs('Trainer Gallery Rare Holo') === 'Rara Holo Galería de Entrenadores', rarezaEs('Trainer Gallery Rare Holo'))
  // Las dos épocas del mismo mecanismo van al MISMO sitio: quien filtra
  // por sus AS TÁCTICO los quiere todos, no los de una era.
  check('«Rare ACE» va con los ACE SPEC', rarezaEs('Rare ACE') === rarezaEs('ACE SPEC Rare'), `${rarezaEs('Rare ACE')} / ${rarezaEs('ACE SPEC Rare')}`)
}

console.log('── 2. LAS 24 QUE HAY EN LA BASE, de verdad ──')
{
  // Copiadas del informe del 2026-10-04 con 14.833 cartas visitadas. No es
  // una lista de cortesía: es lo que su catálogo ha devuelto, y por eso
  // vale como fixture (norma de la 501).
  const LAS_24 = [
    'Uncommon', 'Common', 'Promo', 'Rare Ultra', 'Rare', 'Rare Holo',
    'Trainer Gallery Rare Holo', 'Rare Secret', 'Ultra Rare', 'ACE SPEC Rare',
    'Rare Rainbow', 'Hyper Rare', 'Rare Holo EX', 'Special Illustration Rare',
    'Rare Shiny', 'Rare Holo V', 'Illustration Rare', 'Rare BREAK',
    'Rare Prism Star', 'Rare Holo VMAX', 'Double Rare', 'Shiny Rare',
    'Rare ACE', 'Rare Holo VSTAR',
  ]
  const sin = LAS_24.filter((r) => !rarezaConocida(r))
  check('ninguna se queda en inglés', sin.length === 0, sin.join(', '))
  // Y ninguna se traduce a cadena vacía ni a «Sin rareza», que sería peor
  // que el inglés: diría que la carta no tiene rareza.
  const vacias = LAS_24.filter((r) => !rarezaEs(r) || rarezaEs(r) === 'Sin rareza')
  check('ni a «Sin rareza»', vacias.length === 0, vacias.join(', '))
  // SU CATÁLOGO ESCRIBE LAS MISMAS RAREZAS DE DOS MANERAS, y se ve en esa
  // lista: «Rare Ultra» (66) y «Ultra Rare» (27) son la misma, igual que
  // «Rare Shiny» (10) y «Shiny Rare» (2). Las dos formas tienen que llevar
  // al MISMO rótulo o el filtro parte las cartas en dos montones.
  check('«Rare Ultra» y «Ultra Rare» son la misma', rarezaEs('Rare Ultra') === rarezaEs('Ultra Rare'), `${rarezaEs('Rare Ultra')} / ${rarezaEs('Ultra Rare')}`)
  check('«Rare Shiny» y «Shiny Rare» también', rarezaEs('Rare Shiny') === rarezaEs('Shiny Rare'), `${rarezaEs('Rare Shiny')} / ${rarezaEs('Shiny Rare')}`)
}

console.log('── 3. Y lo que no se conoce se sigue diciendo ──')
{
  // La lista «sin traducir» tiene que seguir sirviendo: si perdona lo que
  // no conoce, la próxima rareza nueva no la ve nadie.
  check('una rareza nueva no se conoce', !rarezaConocida('Rare Lo Que Saquen'))
  check('  …y sale en inglés tal cual', rarezaEs('Rare Lo Que Saquen') === 'Rare Lo Que Saquen')
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
