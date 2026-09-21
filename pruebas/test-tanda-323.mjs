// Tanda 323 — las megas que salieron después de la última sonda.
//
// PINGU: «a la hora de registrar partidas no sale Mega-Zeraora».
//
// La lista de megas de `FORMAS_TCG` se comprobó contra la CDN el
// 2026-09-02, y todo lo que ha salido después no está. El resto del
// módulo YA sabía resolverlas —`dexDeClave` registra sola cualquier
// «Mega X» cuya X sea una especie— y por eso el sprite funcionaba desde
// el principio. Lo único que no se enteraba era el buscador del
// selector, que recorre listas fijas.
//
// La prueba se escribe contra LA FORMA del fallo y no contra Zeraora:
// «una mega que no está en la lista curada». Dentro de tres meses habrá
// otras, y una prueba que solo mire Zeraora no dirá nada de ellas.
import { buscarOpciones } from '/home/user/pingu/js/torneos/selector-mazo.js'
import { FORMAS_TCG, POKEMON_POR_DEX } from '/home/user/pingu/js/torneos/sprites-pokemon.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}

const nombres = (q) => buscarOpciones(q).map((o) => o.nombre)
const CURADAS = new Set(FORMAS_TCG.filter((f) => String(f.nombre).startsWith('Mega ')).map((f) => f.nombre))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El caso que lo destapó ──')
{
  check('«mega zeraora» la encuentra', nombres('mega zeraora').includes('Mega Zeraora'), nombres('mega zeraora').join(' | '))
  check('sin espacio también', nombres('megazeraora').includes('Mega Zeraora'))
  check('y a medio escribir', nombres('mega zera').includes('Mega Zeraora'))
  // Y la que ya funcionaba, para que el arreglo no rompa lo de antes.
  check('«zeraora» a secas sigue dando la especie', nombres('zeraora').includes('Zeraora'))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La FORMA: cualquier especie, no solo Zeraora ──')
{
  // Un puñado de especies que NO están en la lista curada. Si mañana
  // alguna entra en la lista, la prueba sigue valiendo: lo que se
  // afirma es que se encuentra, no cómo.
  const sueltas = ['Zeraora', 'Meowscarada', 'Skeledirge', 'Quaquaval', 'Annihilape', 'Baxcalibur']
  const perdidas = sueltas.filter((e) => !nombres(`mega ${e}`.toLowerCase()).includes(`Mega ${e}`))
  check(`las ${sueltas.length} se encuentran`, perdidas.length === 0, perdidas.join(', '))

  // Y todas traen sprite: sin llamar a dexDeCarta (que es quien las
  // REGISTRA) saldrían con sprite null y un hueco en la lista.
  const sinSprite = buscarOpciones('mega zeraora').filter((o) => !o.sprite)
  check('y con sprite', sinSprite.length === 0, sinSprite.map((o) => o.nombre).join(', '))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Solo sale lo que pides por su nombre ──')
{
  // El precio de sintetizar es que existen 1.025 megas posibles y casi
  // ninguna es una carta. La regla que lo hace soportable: solo salen
  // si tecleas «mega» y dos letras más, así que nadie ve «Mega
  // Caterpie» por casualidad.
  check('«caterpie» no ofrece su mega', !nombres('caterpie').includes('Mega Caterpie'), nombres('caterpie').join(' | '))
  check('«mega c» tampoco inunda', !nombres('mega c').some((n) => n === 'Mega Caterpie'))
  // Pero si la pides por su nombre, sale. Es tu mazo, no el mío.
  check('«mega caterpie» sí, si insistes', nombres('mega caterpie').includes('Mega Caterpie'))
  check('la lista sigue acotada', buscarOpciones('mega').length <= 40, String(buscarOpciones('mega').length))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Las de dos sabores no ganan una tercera falsa ──')
{
  // Charizard y Mewtwo tienen mega X y mega Y, y «Mega Charizard» a
  // secas NO ES UNA CARTA. Un filtro por nombre no lo pilla («Mega
  // Charizard» ≠ «Mega Charizard X»), así que se compara por ESPECIE.
  for (const especie of ['Charizard', 'Mewtwo']) {
    const r = nombres(`mega ${especie.toLowerCase()}`)
    check(`«mega ${especie}» no ofrece una a secas`, !r.includes(`Mega ${especie}`), r.join(' | '))
    check(`  …y sí las dos de verdad`, r.includes(`Mega ${especie} X`) && r.includes(`Mega ${especie} Y`), r.join(' | '))
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Una curada y una sintetizada son indistinguibles ──')
{
  // Si la clave de agrupación no tuviera el mismo formato, el mismo
  // mazo caería en dos casillas distintas de la matriz de
  // enfrentamientos según cuándo se apuntó. Y eso no daría error: solo
  // saldrían dos filas donde debería haber una.
  const curada = buscarOpciones('mega lopunny').find((o) => o.nombre === 'Mega Lopunny')
  const nueva = buscarOpciones('mega zeraora').find((o) => o.nombre === 'Mega Zeraora')
  check('la curada existe', Boolean(curada) && CURADAS.has('Mega Lopunny'))
  check('la sintetizada existe', Boolean(nueva) && !CURADAS.has('Mega Zeraora'))
  check('misma forma de clave', /^d:mega /.test(curada.valor) && /^d:mega /.test(nueva.valor),
    `${curada?.valor} vs ${nueva?.valor}`)
  check('mismo tipo', curada.tipo === nueva.tipo && curada.tipo === 'pokemon')
  check('las dos con sprite de mega', /-mega\.png$/.test(curada.sprite) && /-mega\.png$/.test(nueva.sprite),
    `${curada?.sprite} · ${nueva?.sprite}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Nada de duplicados ──')
{
  for (const q of ['mega', 'mega l', 'mega lopunny', 'mega charizard', 'mega zeraora']) {
    const r = nombres(q)
    check(`«${q}» sin repetidos`, new Set(r).size === r.length,
      r.filter((n, i) => r.indexOf(n) !== i).join(', '))
  }
  check('y la tabla de especies sigue entera', POKEMON_POR_DEX.length === 1025, String(POKEMON_POR_DEX.length))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
