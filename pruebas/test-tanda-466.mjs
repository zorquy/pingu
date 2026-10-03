// Tanda 466 — dos tarjetas que decían lo mismo.
//
// En la cabecera de la Pokédex hay «El que más tienes» y «El que menos».
// Mientras todas tus especies tengan una carta —o sea, al empezar, que es
// justo cuando más gente lo mira— **son el mismo Pokémon con el mismo
// número**, así que la cabecera enseñaba dos cajas idénticas una al lado
// de la otra.
//
// No es un fallo que dé error: las dos cifras son correctas. Es que dos
// cajas que dicen lo mismo no son dos datos, son uno repetido — y PINGU
// pidió sencillez: «si hay cosas que no son necesarias, prefiero que las
// quites».
//
// La prueba mira las DOS caras, que es lo que hace que la regla valga:
// cuando coinciden sale una, y cuando no coinciden salen las dos.
import { resumenDePokedex, cabeceraHtml } from '/home/user/pingu/js/mi-coleccion/pokedex.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const cabecera = (mio) => cabeceraHtml(resumenDePokedex({ mio: new Map(mio), totales: new Map(), total: 1025 }), { nombreDe: (d) => ({ 1: 'Bulbasaur', 4: 'Charmander', 7: 'Squirtle' })[d] || ('#' + d) })
const cuantas = (html) => (html.match(/mc-pdx-caja/g) || []).length

console.log('\n── 1. Cuando el que más y el que menos son el mismo ──')
{
  // Tres especies, una carta de cada: el más y el menos son el mismo.
  const h = cabecera([[1, 1], [4, 1], [7, 1]])
  check('sale una sola tarjeta además de «Registrados»', cuantas(h) === 2, String(cuantas(h)))
  check('  …y es la del que más tienes', /El que más tienes/.test(h) && !/El que menos/.test(h))
}

console.log('\n── 2. Y cuando son distintos, salen las dos ──')
{
  const h = cabecera([[1, 3], [4, 1], [7, 2]])
  check('salen las tres tarjetas', cuantas(h) === 3, String(cuantas(h)))
  check('  …el que más y el que menos', /El que más tienes/.test(h) && /El que menos/.test(h))
  // Y son Pokémon DISTINTOS: si salieran los dos con el mismo nombre, la
  // regla estaría puesta pero no serviría de nada.
  // Sin el pie de «Registrados» («de 1.025»), que no es un nombre: con él
  // dentro, tres cadenas distintas pasarían la comprobación aunque los dos
  // Pokémon fueran el mismo.
  const nombres = [...h.matchAll(/mc-pdx-pie">([^<]+)</g)].map((m) => m[1]).filter((n) => !/^de /.test(n))
  check('  …y de dos Pokémon distintos', nombres.length === 2 && new Set(nombres).size === 2, nombres.join(' | '))
}

console.log('\n── 3. Con la Pokédex vacía no se inventa ninguna ──')
{
  // null y no {dex: 0}: enseñar a Bulbasaur con un 0 sería inventarlo.
  const h = cabecera([])
  check('solo «Registrados»', cuantas(h) === 1, String(cuantas(h)))
  check('  …y dice cero', /mc-pdx-cifra">0</.test(h))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
