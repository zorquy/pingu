// Qué sets del catálogo son el juego de cartas DE VERDAD (tanda 328).
//
// TCGdex sirve en la misma API el TCG de toda la vida y **Pokémon TCG
// Pocket**, que es un juego distinto con cartas distintas y que aquí no
// pinta nada: quien busca una carta para su mazo no quiere encontrarse
// una del móvil mezclada — ni en el índice, ni en «otras versiones», ni
// (lo peor) en el resolutor de decklists.
//
// ── DOS CAMINOS, Y EL SEGUNDO ES EL QUE FUNCIONA ──
//
// La primera versión de esto miraba solo `serie_id = 'tcgp'`, que es
// como los marca TCGdex. En la base de PokeDoc **los catorce sets de
// Pocket tienen `serie_id` a NULL**, así que ese filtro no echaba a
// ninguno. Y la prueba pasaba en verde porque el fixture lo había
// escrito yo con la serie puesta: probaba el código contra mi invento,
// no contra los datos de verdad.
//
// Así que también por el IDENTIFICADOR. Pocket numera sus sets con UNA
// letra y un número: A1, A1a, A2b, A3, B1, B2a… Los del TCG de mesa
// llevan siempre dos letras o más antes del número (`base1`, `swsh3`,
// `sv5`, `xy7`, `hgss2`, `col1`), así que no se pisan.
//
// Módulo suelto y sin dependencias para que puedan usarlo las tres
// mitades: el navegador, la función del borde y el sitemap.
export const SERIES_FUERA = ['tcgp']

// A1, A1a, A2b, B1, B2a… Una letra, dígitos, y como mucho otra letra.
export const ID_DE_POCKET = /^[AB]\d+[a-z]?$/i

// `serie_id` a null NO es motivo para echar a un set: las colecciones
// viejas de Wizards lo traen vacío y son el TCG más TCG que hay — y,
// como se vio, los de Pocket también lo traen vacío. Por eso la serie
// sola no decide nada y hace falta mirar además el identificador.
export function esDelTCG(set) {
  const serie = set?.serie_id
  if (serie && SERIES_FUERA.includes(String(serie))) return false
  if (ID_DE_POCKET.test(String(set?.id ?? ''))) return false
  return true
}

// ── Sets que en realidad son EL MISMO set (tanda 347) ──
//
// PINGU: «30th Celebration y la Classics son el mismo set, no hace falta
// que me lo separes». TCGdex lo tiene partido en dos identificadores,
// pero para quien entra es una colección: una fila en la lista y una
// página con las cartas de las dos.
//
// La regla es un PREFIJO y no una lista de identificadores, porque
// TCGdex todavía no ha dicho cómo va a llamar a la siguiente entrega del
// mismo set — y una lista a mano se queda vieja el día que salga (la
// lección de la 323).
export const COLECCIONES_JUNTAS = [{ padre: '30th', prefijo: '30th' }]

// Si este set es parte de otro, cuál. `null` si es él mismo.
export function padreDeColeccion(id) {
  const x = String(id ?? '').toLowerCase()
  for (const { padre, prefijo } of COLECCIONES_JUNTAS) {
    if (x !== padre && x.startsWith(prefijo)) return padre
  }
  return null
}

// Y al revés: este set, ¿se lleva las cartas de otros?
export function prefijoDeColeccion(id) {
  const x = String(id ?? '').toLowerCase()
  return COLECCIONES_JUNTAS.find((c) => c.padre === x)?.prefijo || null
}
