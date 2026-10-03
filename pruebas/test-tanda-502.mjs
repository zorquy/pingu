// Tanda 502 — las cartas de Scrydex, con su respuesta real delante.
//
// La norma de la 501, cobrada: el fixture ES la respuesta, pegada byte por
// byte, no una que se le parezca. Esto es lo que devolvió
// `cards?page_size=1` el 2026-10-04.
import { numeroComparable, imagenDeCarta, cartaDeScrydex, huellaDeSet, emparejarSets, CAMPOS_SUYOS } from '/home/user/pingu/netlify/lib/scrydex.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const REAL = JSON.parse(String.raw`{"data":[{"id":"me55c-58","name":"Pikachu","supertype":"Pokémon","subtypes":["Basic"],"types":["Lightning"],"hp":"40","evolves_from":[],"abilities":[],"attacks":[{"cost":["Colorless"],"converted_energy_cost":1,"name":"Gnaw","text":null,"damage":"10"},{"cost":["Lightning","Colorless"],"converted_energy_cost":2,"name":"Thunder Jolt","text":"Flip a coin. If tails, Pikachu does 10 damage to itself.","damage":"30"}],"weaknesses":[{"type":"Fighting","value":"×2"}],"resistances":[],"retreat_cost":["Colorless"],"converted_retreat_cost":1,"rules":[],"number":"58","printed_number":"58/102","additional_numbers":[],"rarity":"Common","rarity_code":"C","artist":"Mitsuhiro Arita","national_pokedex_numbers":[25],"regulation_mark":null,"legalities":[],"flavor_text":null,"images":[{"type":"front","small":"https://images.scrydex.com/pokemon/me55c-58/small","medium":"https://images.scrydex.com/pokemon/me55c-58/medium","large":"https://images.scrydex.com/pokemon/me55c-58/large"}],"expansion":{"id":"me55c","name":"30th Celebration: Classic Collection","series":"Mega Evolution","code":"30C","total":30,"printed_total":null,"language":"English","language_code":"EN","release_date":"2026/09/16","is_online_only":false,"logo":"https://images.scrydex.com/pokemon/me55c-logo/logo","symbol":"https://images.scrydex.com/pokemon/me55c-symbol/symbol"},"language":"English","language_code":"EN","expansion_sort_order":1,"variants":[{"name":"holofoil","images":[],"marketplaces":[{"name":"tcgplayer","product_id":"716194","purchase_url":"https://scrydex.com/pokemon/cards/me55c-58/purchase?type=tcgplayer&variant=holofoil"}],"prices":[]}]}],"page":1,"page_size":1,"count":1,"total_count":47481}`)
const CARTA = REAL.data[0]

console.log('── 1. EL NÚMERO: la trampa que da cero coincidencias sin dar error ──')
//
// Nuestro `local_id` sale tal cual de TCGdex, que en japonés escribe
// «001». El suyo es «58», sin rellenar. Cruzar las cartas por ese campo a
// pelo deja el set emparejado, las cartas dentro, y NI UNA casando.
{
  check('«001» y «1» son el mismo número', numeroComparable('001') === numeroComparable('1'), `${numeroComparable('001')} / ${numeroComparable('1')}`)
  check('«58» se queda como está', numeroComparable('58') === '58')
  check('«007» es «7»', numeroComparable('007') === '7')
  // Y los que NO son solo dígitos, que son muchos: promos, galería, Unown.
  check('«TG01» → «tg1»', numeroComparable('TG01') === 'tg1')
  check('«SV001» → «sv1»', numeroComparable('SV001') === 'sv1')
  check('«SWSH284» aguanta', numeroComparable('SWSH284') === 'swsh284')
  check('«H1» no pierde nada', numeroComparable('H1') === 'h1')
  check('la caja da igual', numeroComparable('tg01') === numeroComparable('TG01'))
  // Un número que es solo ceros se queda en «0» y NO en nada: «0» y «» son
  // cosas distintas, y confundirlas casaría cualquier carta sin número.
  check('«000» es «0», no vacío', numeroComparable('000') === '0')
  check('lo vacío sigue vacío', numeroComparable('') === '' && numeroComparable(null) === '')
  // Dos cartas DISTINTAS no pueden acabar iguales.
  check('«1» y «10» siguen siendo distintas', numeroComparable('1') !== numeroComparable('10'))
  check('«TG01» y «TG10» también', numeroComparable('TG01') !== numeroComparable('TG10'))
}

console.log('\n── 2. La imagen, de la lista y por su tipo ──')
{
  check('saca la grande', imagenDeCarta(CARTA) === 'https://images.scrydex.com/pokemon/me55c-58/large')
  check('  …y la pequeña si se pide', imagenDeCarta(CARTA, 'small') === 'https://images.scrydex.com/pokemon/me55c-58/small')
  // POR `type`, NO POR POSICIÓN: que hoy la primera sea la cara no quiere
  // decir que mañana no venga primero un reverso.
  const alReves = { images: [{ type: 'back', large: 'https://x/back' }, { type: 'front', large: 'https://x/front' }] }
  check('coge la CARA aunque no sea la primera', imagenDeCarta(alReves) === 'https://x/front')
  check('sin cara, no se inventa', imagenDeCarta({ images: [{ type: 'back', large: 'https://x/b' }] }) === null)
  check('sin imágenes tampoco', imagenDeCarta({ images: [] }) === null && imagenDeCarta({}) === null)
  // Y nada que no sea https: una URL rara guardada es una foto rota que
  // nadie distingue de una buena.
  check('lo que no sea https no entra', imagenDeCarta({ images: [{ type: 'front', large: 'javascript:alert(1)' }] }) === null)
  check('ni un hueco', imagenDeCarta({ images: [{ type: 'front', large: null }] }) === null)
}

console.log('\n── 3. Lo que de una carta suya nos sirve ──')
{
  const f = cartaDeScrydex(CARTA)
  check('la imagen', f.imagen_url === 'https://images.scrydex.com/pokemon/me55c-58/large')
  check('la rareza', f.rarity === 'Common')
  check('el ilustrador, que ellos llaman `artist`', f.illustrator === 'Mitsuhiro Arita')
  // EL REGALO: `national_pokedex_numbers` es nuestro `dex_ids`, el que la
  // tanda 483 tuvo que ir a buscar carta a carta para que la Pokédex
  // japonesa no saliera vacía.
  check('`national_pokedex_numbers` es nuestro `dex_ids`', JSON.stringify(f.dex_ids) === '[25]', JSON.stringify(f.dex_ids))
  // `supertype` viene con tilde y nuestra `category` es la canónica
  // inglesa, que es con la que se CRUZA (tandas 334 y 335).
  check('«Pokémon» se guarda sin tilde, que es la clave', f.category === 'Pokemon', f.category)
  // LO QUE NO VIENE NO SE ESCRIBE: `regulation_mark` es null aquí, y
  // mandarlo a null borraría el que ya tuviéramos curado (la 487).
  check('`regulation_mark` a null NO se manda', !('regulation_mark' in f), JSON.stringify(Object.keys(f)))
  check('ni se inventa `dex_ids` cuando no hay', !('dex_ids' in cartaDeScrydex({ name: 'x' })))
  check('nada no revienta', cartaDeScrydex(null) === null && cartaDeScrydex('x') === null)
}

console.log('\n── 4. La expansión viene DENTRO de cada carta ──')
//
// Así que pedir cartas trae de paso con qué emparejar su set: no hacen
// falta dos pasadas.
{
  const h = huellaDeSet(CARTA.expansion, CAMPOS_SUYOS)
  check('se le saca la huella al vuelo', h.fecha === '2026-09-16' && h.total === 30 && h.codigo === '30C', JSON.stringify(h))
  const nuestro = { id: '30th', name: '30th Anniversary Classic Collection', release_date: '2026-09-16', card_count_total: 30 }
  const r = emparejarSets([nuestro], [CARTA.expansion], { suyos: CAMPOS_SUYOS })
  check('  …y empareja con el nuestro', r.pares.length === 1, JSON.stringify(r.sueltos))
}

console.log('\n── 5. Y el id de una carta suya se arma con el del set ──')
{
  check('`me55c-58` es expansión + número', CARTA.id === `${CARTA.expansion.id}-${CARTA.number}`)
  // O sea que, emparejado el set, las cartas se piden sin adivinar nada.
  check('47.481 cartas en total, que es su catálogo entero', REAL.total_count === 47481)
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
