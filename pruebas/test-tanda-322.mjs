// Tanda 322 — el detalle de una carta, de TCGdex a nuestras columnas.
//
// Se prueba SIN RED y SIN BASE a propósito: `detalleDeCarta` es pura, y
// esa fue la razón de sacarla de la función programada. Lo que sí toca
// red (elegir cartas, pedirlas, escribirlas) no se puede probar barato,
// así que el trato es: toda la lógica que se pueda mover a la parte pura
// se mueve, y así la parte que no se prueba es lo más tonta posible.
//
// Las respuestas de ejemplo están escritas a mano con la forma que
// documenta TCGdex. **No se han comprobado contra la API de verdad**
// (el contenedor no sale a internet), así que esta prueba afirma que
// mapeamos bien LO QUE CREEMOS que llega — no que TCGdex mande eso.
// Esa segunda mitad la tiene que confirmar la primera pasada real.
import { detalleDeCarta, urlDeCarta, IDIOMA_POR_MERCADO } from '/home/user/pingu/netlify/lib/carta-detalle.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}

// Un Pokémon completo, con todo lo que una carta moderna trae.
const POKEMON = {
  id: 'sv5-36', localId: '36', name: 'Ceruledge ex', category: 'Pokemon',
  hp: 270, types: ['Fire'], stage: 'Stage1', evolveFrom: 'Charcadet',
  retreat: 2, rarity: 'Double rare', illustrator: 'Shin Nagasawa',
  regulationMark: 'H', suffix: 'EX',
  attacks: [
    { cost: ['Fire'], name: 'Abyssal Flames', effect: 'This attack does 20 more damage…', damage: '30+' },
    { cost: ['Fire', 'Psychic', 'Metal'], name: 'Raging Amethyst', effect: 'Discard all Energy…', damage: '280' },
  ],
  weaknesses: [{ type: 'Water', value: '×2' }],
  variants: { normal: false, reverse: false, holo: true, firstEdition: false },
}

// Un Entrenador: sin PS, sin tipos, sin ataques. La mitad de los campos
// NO VIENEN — y ahí es donde un mapeo descuidado inventa ceros.
const ENTRENADOR = {
  id: 'sv5-161', localId: '161', name: 'Lost City', category: 'Trainer',
  trainerType: 'Stadium', rarity: 'Uncommon', illustrator: 'Oswaldo KATO',
  regulationMark: 'H',
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Un Pokémon con todo ──')
{
  const f = detalleDeCarta(POKEMON)
  check('categoría', f.category === 'Pokemon', f.category)
  check('PS como número', f.hp === 270 && typeof f.hp === 'number', String(f.hp))
  check('tipos', Array.isArray(f.types) && f.types[0] === 'Fire', JSON.stringify(f.types))
  check('fase y de qué evoluciona', f.stage === 'Stage1' && f.evolve_from === 'Charcadet')
  check('retirada como número', f.retreat === 2 && typeof f.retreat === 'number')
  check('los dos ataques, con su coste', f.attacks?.length === 2 && f.attacks[1].cost.length === 3)
  check('rareza e ilustrador', f.rarity === 'Double rare' && f.illustrator === 'Shin Nagasawa')
  check('el apellido del nombre', f.suffix === 'EX', f.suffix)
  check('la marca de regulación', f.regulation_mark === 'H', f.regulation_mark)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Un Entrenador: lo que no viene se queda SIN SABER ──')
{
  // Esta es la que importa. Un mapeo que ponga `hp: 0` o `attacks: []`
  // convierte «no lo sé» en una afirmación, y la página dirá que un
  // Estadio tiene 0 PS. Es la lección de la tanda 319 otra vez.
  const f = detalleDeCarta(ENTRENADOR)
  check('los PS son null, no 0', f.hp === null, JSON.stringify(f.hp))
  check('los ataques son null, no []', f.attacks === null, JSON.stringify(f.attacks))
  check('los tipos son null, no []', f.types === null, JSON.stringify(f.types))
  check('la retirada es null, no 0', f.retreat === null, JSON.stringify(f.retreat))
  check('y sí trae lo suyo', f.trainer_type === 'Stadium' && f.category === 'Trainer')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Basura de entrada, sin tumbar la fila ──')
{
  // Las cartas viejas del catálogo traen los números en texto o con
  // sufijo. Una cadena donde Postgres espera integer tumba la fila
  // ENTERA: la carta se quedaría sin engordar para siempre por un campo
  // de adorno, y eso no daría error en ninguna parte visible.
  const raros = detalleDeCarta({ id: 'x', category: 'Pokemon', hp: '70', retreat: '1' })
  check('un PS en texto no se cuela como texto', raros.hp === null || typeof raros.hp === 'number', JSON.stringify(raros.hp))
  const peor = detalleDeCarta({ id: 'x', category: 'Pokemon', hp: '70+', retreat: {} })
  check('un PS con sufijo se descarta', peor.hp === null, JSON.stringify(peor.hp))
  check('una retirada que es un objeto se descarta', peor.retreat === null, JSON.stringify(peor.retreat))
  check('sin carta, null y no una fila vacía', detalleDeCarta(null) === null)
  check('con una cadena, tampoco', detalleDeCarta('sv5-36') === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La marca de regulación NO se borra ──')
{
  // La rellenó de una vez un SQL de 8.300 líneas. Si esta función la
  // escribe a null cuando TCGdex no la manda, se cargaría la
  // comprobación de reglamento de las decklists — y en silencio.
  const sinMarca = detalleDeCarta({ id: 'x', category: 'Pokemon', name: 'Vieja' })
  check('si no viene, ni se menciona', !('regulation_mark' in sinMarca), JSON.stringify(sinMarca.regulation_mark))
  const conMarca = detalleDeCarta({ id: 'x', category: 'Pokemon', regulationMark: 'I' })
  check('si viene, se guarda', conMarca.regulation_mark === 'I')
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La URL, y el mapa de idiomas que está copiado ──')
{
  check('la URL lleva el idioma del mercado', urlDeCarta('sv5-36', 'WEST') === 'https://api.tcgdex.net/v2/en/cards/sv5-36', urlDeCarta('sv5-36', 'WEST'))
  check('un mercado desconocido cae al occidental', urlDeCarta('x', 'ZZ').includes('/en/'), urlDeCarta('x', 'ZZ'))
  check('el identificador va escapado', urlDeCarta('a b', 'WEST').includes('a%20b'))

  // `IDIOMA_POR_MERCADO` es una COPIA de `MERCADOS` en js/tcgdex.js,
  // porque aquel fichero importa ./supabase.js y no se puede arrastrar a
  // una función de Netlify. Una copia sin vigilar se separa: el día que
  // alguien añada un mercado en un sitio y no en el otro, las cartas de
  // ese mercado se pedirían en inglés sin que nada diera error.
  //
  // Se lee el fichero como TEXTO en vez de importarlo, justamente porque
  // importarlo arrastraría ./supabase.js y esta prueba dejaría de correr
  // en Node.
  const fuente = readFileSync('/home/user/pingu/js/tcgdex.js', 'utf8')
  const bloque = fuente.match(/export const MERCADOS = \{([\s\S]*?)\n\}/)?.[1] ?? ''
  const original = {}
  for (const [, k, v] of bloque.matchAll(/(\w+):\s*'([^']+)'/g)) original[k] = v
  check('se ha encontrado el original', Object.keys(original).length >= 7, String(Object.keys(original).length))
  const distintos = Object.keys({ ...original, ...IDIOMA_POR_MERCADO })
    .filter((k) => original[k] !== IDIOMA_POR_MERCADO[k])
  check('la copia no se ha separado del original', distintos.length === 0,
    distintos.map((k) => `${k}: ${original[k]} vs ${IDIOMA_POR_MERCADO[k]}`).join(' | '))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
