// Tanda 534 — ocho filas más que son subconjuntos de su set, y un
// duplicado de TCGdex.
//
// Salieron de la exportación del catálogo que mandó PINGU, leyéndola
// entera. Son la misma decisión que él ya tomó dos veces —la Radiant
// Collection dentro de Legendary Treasures, la Unown dentro de Unseen
// Forces—: subconjuntos con numeración propia DENTRO de su set (TG01-TG30,
// SV01-SV94, GG01-GG70).
//
// Y las Trainer Gallery traen además un fallo de TCGdex que se ve a simple
// vista en la exportación: **están DOS VECES**, con dos identificadores, el
// mismo nombre, la misma fecha y las mismas 30 cartas.
//
// ── LO QUE PODÍA SALIR MAL, Y ES LO QUE MÁS VIGILA ESTA PRUEBA ──
//
// Que un PADRE acabe siendo hijo de otro. `swsh12` es Silver Tempest y
// `swsh12.5` es Crown Zenith: dos sets distintos cuyos identificadores se
// parecen muchísimo. Una regla escrita a ojo podría tragarse Crown Zenith
// dentro de Silver Tempest, y eso no da ningún error: desaparece una
// colección de 160 cartas de la lista.
import { padreDeColeccion, idsDeColeccion, COLECCIONES_JUNTAS } from '/home/user/pingu/js/catalogo-series.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Los subconjuntos van dentro de su set ──')
{
  const esperadas = [
    ['sma', 'sm115'],            // Hidden Fates Shiny Vault
    ['swsh4.5sv', 'swsh4.5'],    // Shining Fates Shiny Vault
    ['swsh12.5gg', 'swsh12.5'],  // Crown Zenith Galarian Gallery
    ['cel25cc', 'cel25'],        // Celebrations Classic Collection
  ]
  for (const [hijo, padre] of esperadas) {
    check(`«${hijo}» va dentro de «${padre}»`, padreDeColeccion(hijo) === padre, padreDeColeccion(hijo))
  }
}

console.log('── 2. Las Trainer Gallery, que además estaban DUPLICADAS ──')
{
  const pares = [['swsh9', 'swsh9tg', 'swsh9.5tg'], ['swsh10', 'swsh10tg', 'swsh10.5tg'],
    ['swsh11', 'swsh11tg', 'swsh11.5tg'], ['swsh12', 'swsh12tg', 'swsh12.5tg']]
  for (const [padre, a, b] of pares) {
    check(`las dos de «${padre}» van dentro`, padreDeColeccion(a) === padre && padreDeColeccion(b) === padre,
      `${padreDeColeccion(a)} / ${padreDeColeccion(b)}`)
  }
  check('y la página del padre se lleva las tres',
    JSON.stringify(idsDeColeccion('swsh9')) === '["swsh9","swsh9tg","swsh9.5tg"]', JSON.stringify(idsDeColeccion('swsh9')))
}

console.log('── 3. NINGÚN PADRE ES HIJO DE OTRO ──')
{
  // Es lo que más duele si sale mal y no da ningún error: una colección
  // entera desaparece de la lista porque se plegó en la que no era.
  const padres = COLECCIONES_JUNTAS.map((c) => c.padre)
  const tragados = padres.filter((p) => padreDeColeccion(p) !== null)
  check('ningún padre se pliega en otro', tragados.length === 0, tragados.join(', '))
  // Y los tres sets cuyo identificador se parece a uno plegado, uno a uno:
  // Crown Zenith contra Silver Tempest es el que casi pasa.
  check('Crown Zenith sigue siendo suyo', padreDeColeccion('swsh12.5') === null, padreDeColeccion('swsh12.5'))
  check('Pokémon GO también', padreDeColeccion('swsh10.5') === null, padreDeColeccion('swsh10.5'))
  check('y 151', padreDeColeccion('sv03.5') === null, padreDeColeccion('sv03.5'))
  check('y Shining Fates no se cae dentro de Vivid Voltage', padreDeColeccion('swsh4.5') === null, padreDeColeccion('swsh4.5'))
  // Un hijo no puede estar en dos sitios: eso sería una lista que se
  // contradice y gana el que esté antes, que es una forma elegante de
  // tener un fallo que depende del orden.
  const todos = COLECCIONES_JUNTAS.flatMap((c) => c.hijos || [])
  check('ningún hijo sale dos veces', new Set(todos).size === todos.length, todos.join(', '))
  // Ni un padre puede estar escrito dos veces.
  check('ningún padre sale dos veces', new Set(padres).size === padres.length, padres.join(', '))
}

console.log('── 4. Y los sets normales siguen siendo filas ──')
{
  for (const id of ['sm8', 'swsh7', 'sv08', 'xy12', 'g1', 'dc1', 'sve', 'mfb']) {
    check(`«${id}» no se pliega en nadie`, padreDeColeccion(id) === null, padreDeColeccion(id))
  }
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
