// Tanda 530 — los logos JAPONESES, que son los que de verdad no existían.
//
// De los 341 sets asiáticos, probando el fichero a mano en TCGdex existe
// UNO. La sonda de la 528 contestó que Scrydex tiene 231 expansiones
// japonesas CON logo y símbolo, así que la biblioteca japonesa puede dejar
// de estar desnuda.
//
// EL FIXTURE ES SU RESPUESTA, byte por byte (norma de la 501): es la
// primera expansión que devolvió `ja/expansions` el 2026-10-04.
import { emparejarSets, veredictoDelPar, idSinIdioma, filaDeSetConScrydex } from '/home/user/pingu/netlify/lib/scrydex.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const SUYA = {
  id: 'mf_ja',
  code: 'MF',
  logo: 'https://images.scrydex.com/pokemon/mf_ja-logo/logo',
  name: '30th セレブレーション プレミアムデッキセット エーフィ・ブラッキー',
  total: 49,
  series: 'Mega Evolution',
  symbol: 'https://images.scrydex.com/pokemon/mf_ja-symbol/symbol',
  language: 'Japanese',
  translation: { en: { name: '30th Celebration Premium Deck Set: Espeon & Umbreon' } },
  release_date: '2026/09/16',
  language_code: 'JA',
  printed_total: 40,
  is_online_only: false,
}

console.log('── 1. Su id lleva el idioma pegado ──')
{
  check('`mf_ja` es nuestro `mf`', idSinIdioma('mf_ja') === 'mf', idSinIdioma('mf_ja'))
  check('y `sv1a_ja` nuestro `sv1a`', idSinIdioma('SV1a_ja') === 'SV1a', idSinIdioma('SV1a_ja'))
  // Solo el SUFIJO: un `_` en medio no se toca, que normalizar no es
  // recortar a ciegas.
  check('un `_` en medio se queda', idSinIdioma('a_b_ja') === 'a_b', idSinIdioma('a_b_ja'))
  check('y un id sin idioma no cambia', idSinIdioma('me02.5') === 'me02.5', idSinIdioma('me02.5'))
  check('ni se inventa nada con un id vacío', idSinIdioma(null) === '', JSON.stringify(idSinIdioma(null)))
}

console.log('── 2. Emparejar: nuestro `mf` con su `mf_ja` ──')
{
  // Nuestro set japonés, como lo deja TCGdex: SIN fecha ni cuentas en
  // muchos casos (la 322 encontró esas columnas vacías), que es justo el
  // caso en el que manda el rescate por id.
  const nuestro = { id: 'mf', market: 'JP', name: '30th セレブレーション プレミアムデッキセット エーフィ・ブラッキー' }
  const { pares, sueltos } = emparejarSets([nuestro], [SUYA], {})
  check('casa', pares.length === 1, JSON.stringify({ pares: pares.length, sueltos }))
  check('  …y dice por qué', pares[0]?.por === 'id idéntico', pares[0]?.por)
  // Y sin el recorte del idioma no casaría ninguno, que era el fallo que
  // esta tanda viene a evitar.
  const comoAntes = emparejarSets([{ id: 'mf_otro', market: 'JP' }], [SUYA], {})
  check('un id que no es el suyo NO casa', comoAntes.pares.length === 0, JSON.stringify(comoAntes.pares))
}

console.log('── 3. Confirmar sale GRATIS en japonés ──')
{
  // Los dos catálogos publican el nombre del set EN JAPONÉS, así que
  // comparar no cruza idiomas — que es lo que estropeaba el nombre de la
  // carta en el occidental (tanda 505).
  const v = veredictoDelPar({
    nuestra: {},
    nuestroSet: { id: 'mf', name: SUYA.name },
    suya: { expansion: SUYA },
  })
  check('confirmado', v.veredicto === 'confirmado', JSON.stringify(v))
  check('  …por el nombre del set', v.por === 'el nombre del set', v.por)
  // Y NO rechaza cuando no coincide: dos catálogos pueden rotular el mismo
  // set de maneras distintas, así que un nombre que no casa no concluye
  // nada (la lección de la 505, otra vez).
  const d = veredictoDelPar({
    nuestra: {},
    nuestroSet: { id: 'mf', name: 'Otro nombre' },
    suya: { expansion: { ...SUYA, code: null } },
  })
  check('un nombre que discrepa NO rechaza', d.veredicto !== 'rechazado', JSON.stringify(d))
  // Lo que sí decide sigue decidiendo: la Pokédex.
  const r = veredictoDelPar({
    nuestra: { dex_ids: [25] },
    nuestroSet: { id: 'mf', name: SUYA.name },
    suya: { expansion: SUYA, national_pokedex_numbers: [196, 197] },
  })
  check('y la Pokédex sigue pudiendo rechazar', r.veredicto === 'rechazado', JSON.stringify(r))
}

console.log('── 4. Lo que se escribe, y lo que NO ──')
{
  const nuestro = { id: 'mf', market: 'JP', name: SUYA.name, logo_path: 'sv/mf/logo', card_count_official: 0 }
  const fila = filaDeSetConScrydex(nuestro, SUYA, 'el nombre del set')
  check('el logo japonés, que es a lo que veníamos', fila.logo_scrydex === SUYA.logo, fila.logo_scrydex)
  check('  …y el símbolo', fila.symbol_scrydex === SUYA.symbol, fila.symbol_scrydex)
  check('con quién casó y por qué', fila.scrydex_id === 'mf_ja' && fila.scrydex_por === 'el nombre del set', JSON.stringify(fila))
  // NO SE PISA LO NUESTRO: el logo de TCGdex se queda como respaldo, y un
  // CERO es un valor (tanda 508).
  check('no toca nuestro `logo_path`', !('logo_path' in fila), JSON.stringify(Object.keys(fila)))
  check('y un `card_count_official` a 0 no se pisa', fila.card_count_official === 0, JSON.stringify(fila.card_count_official))
  // La clave primaria entera, que en `tcg_sets` es (id, market): sin
  // `market` esto escribiría en el set OCCIDENTAL con el mismo id, porque
  // el japonés comparte identificadores con el inglés (tanda 437).
  check('lleva el mercado, que es media clave primaria', fila.market === 'JP', fila.market)
  check('  …y el nombre, que es `not null` (la lección de la 526)', fila.name === SUYA.name, fila.name)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
