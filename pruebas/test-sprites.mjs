import { POKEMON_POR_DEX, POKEMON_APLASTADOS, dexDeCarta, urlDeSprite, spriteDeCarta } from '/home/user/pingu/js/torneos/sprites-pokemon.js'

// Tanda 231: de «Dragapult ex» a su minisprite, como en Limitless.
//
// La tabla es GENERADA, así que lo que hay que vigilar no es la tabla en
// sí, sino que siga estando alineada (el número de Pokédex es la
// posición) y que el nombre de una CARTA sepa encontrar su especie —
// que es donde están todas las trampas: sufijos, formas regionales y
// entrenadores delante del nombre.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

console.log('\n── 1. La tabla está entera y alineada ──')
{
  check('trae las nueve generaciones', POKEMON_POR_DEX.length === 1025, String(POKEMON_POR_DEX.length))
  // Un desplazamiento de uno daría el Pokémon de al lado en TODOS los
  // sprites, y eso no canta a simple vista. Se ancla por los extremos y
  // por unos cuantos de en medio.
  check('el 1 es Bulbasaur', POKEMON_POR_DEX[0] === 'Bulbasaur', POKEMON_POR_DEX[0])
  check('el 25 es Pikachu', POKEMON_POR_DEX[24] === 'Pikachu', POKEMON_POR_DEX[24])
  check('el 150 es Mewtwo', POKEMON_POR_DEX[149] === 'Mewtwo', POKEMON_POR_DEX[149])
  check('el 887 es Dragapult', POKEMON_POR_DEX[886] === 'Dragapult', POKEMON_POR_DEX[886])
  check('el 1025 es Pecharunt', POKEMON_POR_DEX[1024] === 'Pecharunt', POKEMON_POR_DEX[1024])
  // Los nombres se guardan COMO SE ESCRIBEN (tanda 233), para que el
  // buscador de mazos enseñe «Iron Valiant» y no «Ironvaliant». La
  // versión aplastada, que es con la que se busca, va aparte.
  check('con su nombre de verdad', POKEMON_POR_DEX[1005] === 'Iron Valiant', POKEMON_POR_DEX[1005])
  check('y la versión aplastada, alineada', POKEMON_APLASTADOS.length === POKEMON_POR_DEX.length)
  check('están todas normalizadas', POKEMON_APLASTADOS.every((n) => /^[a-z0-9]+$/.test(n)),
    POKEMON_APLASTADOS.find((n) => !/^[a-z0-9]+$/.test(n)) || '')
}

console.log('\n── 2. El nombre de la carta encuentra su especie ──')
{
  check('a secas', dexDeCarta('Gardevoir') === 282)
  check('con «ex» detrás', dexDeCarta('Dragapult ex') === 887)
  check('con «V»', dexDeCarta('Ho-Oh V') === 250)
  check('con «VMAX»', dexDeCarta('Charizard VMAX') === 6)
  // Desde la novena generación el entrenador va DELANTE del nombre, que
  // es justo el caso que rompe una lista de sufijos.
  check('con el entrenador delante', dexDeCarta("Iono's Bellibolt") === 939, String(dexDeCarta("Iono's Bellibolt")))
  check('un nombre de dos palabras', dexDeCarta('Iron Valiant ex') === 1006, String(dexDeCarta('Iron Valiant ex')))
  check('y de los más nuevos', dexDeCarta('Raging Bolt ex') === 1021, String(dexDeCarta('Raging Bolt ex')))
  // Los raros de puntuación: si la normalización no coincide con la que
  // generó la tabla, estos son los primeros que fallan.
  check('con apóstrofo', dexDeCarta("Farfetch'd") === 83, String(dexDeCarta("Farfetch'd")))
  check('con punto', dexDeCarta('Mr. Mime') === 122, String(dexDeCarta('Mr. Mime')))
  check('con guion', dexDeCarta('Porygon-Z') === 474, String(dexDeCarta('Porygon-Z')))
  check('con tilde', dexDeCarta('Flabébé') === 669, String(dexDeCarta('Flabébé')))
  check('con dos puntos', dexDeCarta('Type: Null') === 772, String(dexDeCarta('Type: Null')))
}

console.log('\n── 3. Lo que NO es un Pokémon no tiene sprite ──')
{
  // Y eso está bien: se queda con la miniatura de la carta, que para un
  // objeto es lo que hay que enseñar.
  for (const trainer of ['Crushing Hammer', "Professor's Research", "Boss's Orders", 'Rare Candy', 'Nest Ball', 'Ultra Ball', 'Iono', 'Artazon']) {
    check(`«${trainer}» no tiene sprite`, dexDeCarta(trainer) === null, String(dexDeCarta(trainer)))
  }
  check('ni un nombre vacío', dexDeCarta('') === null)
  check('ni un nulo', dexDeCarta(null) === null)
}

console.log('\n── 4. La forma regional cae en su especie ──')
{
  // Documentado a propósito: sale el Ninetales de Kanto y no el de
  // Alola. Especie correcta, forma equivocada — para reconocer un mazo
  // de un vistazo sirve, y las formas viven en números que esta tabla
  // no trae.
  check('«Alolan Ninetales» da Ninetales', dexDeCarta('Alolan Ninetales') === 38, String(dexDeCarta('Alolan Ninetales')))
  check('«Hisuian Zoroark» da Zoroark', dexDeCarta('Hisuian Zoroark') === 571, String(dexDeCarta('Hisuian Zoroark')))
}

console.log('\n── 5. La URL ──')
{
  const url = spriteDeCarta('Dragapult ex')
  check('apunta a la CDN de jsDelivr', url?.startsWith('https://cdn.jsdelivr.net/gh/PokeAPI/sprites'), url)
  check('con el número correcto', url?.endsWith('/887.png'), url)
  // Los sprites de la quinta generación (en píxel) solo llegan al 649, y
  // media meta de hoy es de la octava y la novena: usarlos dejaría sin
  // icono justo a los Pokémon que interesan.
  check('NO usa los de la quinta generación', !url?.includes('generation-v'), url)
  check('sin número no hay URL', urlDeSprite(null) === null)
  check('y un Trainer tampoco', spriteDeCarta('Crushing Hammer') === null)
}

console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
