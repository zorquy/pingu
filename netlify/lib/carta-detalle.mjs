// De la respuesta de TCGdex a las columnas de `tcg_cards` (tanda 322).
//
// Vive aquí y no en `js/tcgdex.js` porque quien lo usa es una función de
// servidor, y ese fichero importa `./supabase.js`, que es del navegador.
//
// Y es una función PURA a propósito: así se prueba con una respuesta
// guardada, sin red y sin base. La parte que sí necesita red (elegir
// cartas, pedirlas, escribirlas) vive en la función programada, que es
// donde puede fallar y donde no se puede probar barato.

const API = 'https://api.tcgdex.net/v2'

// El idioma de cada mercado. Es una COPIA de `MERCADOS` en
// `js/tcgdex.js`, y las copias se separan: por eso hay una prueba que
// compara las dos y se pone roja si alguien toca una y no la otra.
// Copiarlo es más barato que partir aquel fichero en dos por un objeto
// de siete líneas, pero solo si la copia está vigilada.
export const IDIOMA_POR_MERCADO = {
  WEST: 'en',
  JP: 'ja',
  CN: 'zh-cn',
  TW: 'zh-tw',
  KO: 'ko',
  ID: 'id',
  TH: 'th',
}

export function urlDeCarta(cardId, market = 'WEST') {
  const idioma = IDIOMA_POR_MERCADO[market] || IDIOMA_POR_MERCADO.WEST
  return `${API}/${idioma}/cards/${encodeURIComponent(cardId)}`
}

// El set COMPLETO, que es el único sitio donde viene su fecha de salida:
// el listado devuelve un SetResume y ahí ese campo no está. Por eso los
// 220 sets tenían `release_date` a null.
export function urlDeSet(setId, market = 'WEST') {
  const idioma = IDIOMA_POR_MERCADO[market] || IDIOMA_POR_MERCADO.WEST
  return `${API}/${idioma}/sets/${encodeURIComponent(setId)}`
}

// Vale como fecha de Postgres, o null. Misma criba que `fecha()` en
// js/tcgdex.js: las cartas antiguas la traen vacía o a medias, y una
// cadena rara tumbaría la fila entera.
export function fechaDeSet(set) {
  const v = set?.releaseDate
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null
}

// Un entero o null.
//
// TCGdex da los PS y la retirada como número, pero algunas cartas
// antiguas los traen en texto ("70"), con sufijo ("70+") o vacíos. Una
// cadena donde Postgres espera integer tumba la fila ENTERA: la carta se
// quedaría sin engordar para siempre por culpa de un campo secundario.
function entero(valor) {
  if (valor === null || valor === undefined || valor === '') return null
  const n = Number(valor)
  return Number.isInteger(n) ? n : null
}

// Una lista, o null si el campo no venía.
//
// La diferencia importa, y es la misma lección de la barra de progreso
// de la tanda 319: `[]` afirma «esta carta no tiene ataques» y null dice
// «no se sabe». Un Entrenador no tiene ataques de verdad y TCGdex
// devuelve el campo ausente, no vacío — así que null es lo honesto.
function lista(valor) {
  return Array.isArray(valor) ? valor : null
}

// Los campos cambian según la categoría (un Entrenador no trae `hp`, una
// Energía no trae `attacks`) y el catálogo lo mantiene gente, así que en
// las cartas viejas falta de todo. Lo que no venga se queda null: nada
// de valores por defecto, que es justo lo que hace que una página afirme
// algo falso sin que nada dé error.
export function detalleDeCarta(card) {
  if (!card || typeof card !== 'object') return null
  const fila = {
    category: card.category || null,
    hp: entero(card.hp),
    types: Array.isArray(card.types) && card.types.length ? card.types : null,
    stage: card.stage || null,
    evolve_from: card.evolveFrom || null,
    retreat: entero(card.retreat),
    attacks: lista(card.attacks),
    abilities: lista(card.abilities),
    weaknesses: lista(card.weaknesses),
    resistances: lista(card.resistances),
    trainer_type: card.trainerType || null,
    energy_type: card.energyType || null,
    suffix: card.suffix || null,
    rarity: card.rarity || null,
    illustrator: card.illustrator || null,
    description: card.description || null,
    variants: card.variants && typeof card.variants === 'object' ? card.variants : null,
  }
  // La marca de regulación ya la rellenó de una vez
  // supabase-migration-cartas-marcas.sql. Esta petición la trae de paso,
  // así que las que aquel volcado no cubrió se arreglan solas — pero
  // solo se escribe SI VIENE. Ponerla a null cuando falta borraría lo
  // que ya estaba bien, y eso rompería la comprobación de reglamento de
  // las decklists sin que nadie se entere.
  if (card.regulationMark) fila.regulation_mark = card.regulationMark
  return fila
}

// ── Lo que solo viene en el SET COMPLETO (tanda 329) ──
//
// La consulta que ejecutó PINGU el 2026-09-22 lo dejó sin discusión:
// **los 210 sets tienen `serie_id` y `serie_name` a NULL**, y solo 112
// tienen código de TCG Live.
//
// Es otra vez lo de la tanda 322 y no lo apliqué: `fetchSets` corre
// sobre el LISTADO, que es un «SetResume», y allí no está ni la serie,
// ni el código, ni la fecha. Lo peor no es que falten tres columnas: es
// que `fetchSets` FILTRABA Pokémon TCG Pocket con `s.serie?.id`, así que
// ese filtro no ha funcionado nunca — por eso entraron los catorce sets
// de Pocket que hubo que borrar a mano.
//
// La regla, tercera vez que se paga: si una columna sale de un set,
// pregúntate si viene en el LISTADO o solo en el set completo.
export function serieDeSet(set) {
  const id = set?.serie?.id
  const nombre = set?.serie?.name
  return {
    serie_id: typeof id === 'string' && id.trim() ? id.trim() : null,
    serie_name: typeof nombre === 'string' && nombre.trim() ? nombre.trim() : null,
  }
}

// El código de TCG Live («TWM», «30C»), normalizado. Es COPIA de
// `codigoLiveDeSet` en js/tcgdex.js, vigilada por la misma prueba que
// vigila el mapa de idiomas: aquel fichero importa `./supabase.js` y no
// se puede arrastrar a una función de servidor.
export function codigoLiveDeSet(set) {
  const bruto = set?.tcgOnline
  if (typeof bruto !== 'string') return null
  const limpio = bruto.trim().toUpperCase()
  return /^[A-Z0-9]{2,6}$/.test(limpio) ? limpio : null
}

// Lo que le falta a una fila de `tcg_sets`, mirando el set completo.
// Devuelve SOLO lo que hay que escribir: si no falta nada, un objeto
// vacío, y entonces no se gasta un PATCH.
//
// Nunca escribe null encima de algo: un campo que la API no manda no
// puede borrar lo que ya estaba bien. Es la misma cautela que ya lleva
// el código de TCG Live desde la 233.
export function loQueFaltaDeUnSet(fila, completo) {
  const cambios = {}
  const fecha = fechaDeSet(completo)
  if (!fila?.release_date && fecha) cambios.release_date = fecha
  const { serie_id, serie_name } = serieDeSet(completo)
  if (!fila?.serie_id && serie_id) cambios.serie_id = serie_id
  if (!fila?.serie_name && serie_name) cambios.serie_name = serie_name
  const codigo = codigoLiveDeSet(completo)
  if (!fila?.tcg_online_code && codigo) cambios.tcg_online_code = codigo
  return cambios
}

export function leFaltaAlgo(fila) {
  return !fila?.release_date || !fila?.serie_id || !fila?.serie_name || !fila?.tcg_online_code
}

// ── El idioma de la ficha (tanda 330) ──
//
// El catálogo occidental se IMPORTA en inglés a propósito, pero eso es
// una decisión sobre el listado, donde lo único que hay es el nombre. El
// texto de los ataques viene en la petición POR CARTA, que hacemos
// igual: pedirla en español no cuesta ni una petición más, cuesta
// pedirla en otro idioma.
//
// El orden importa. Primero español, y si esa carta no está traducida
// —TCGdex no tiene las anteriores a 2011—, inglés. Al revés no tendría
// sentido, y quedarse solo en español dejaría media ficha vacía.
export const IDIOMAS_DE_FICHA = ['es', 'en']

export function urlDeCartaEnIdioma(cardId, idioma) {
  return `${API}/${idioma}/cards/${encodeURIComponent(cardId)}`
}

// Pide la carta en español y cae a inglés. Devuelve TAMBIÉN en qué
// idioma vino, que es lo que se guarda en `detalle_lang`: sin eso, una
// carta traducida y una que no lo está son indistinguibles, y
// reintentarlo dentro de un año costaría reengordar las 23.000.
//
// `pedir` se inyecta para poder probar esto sin red.
export async function detalleEnEspanol(cardId, pedir) {
  for (const idioma of IDIOMAS_DE_FICHA) {
    const carta = await pedir(urlDeCartaEnIdioma(cardId, idioma))
    if (!carta) continue
    const fila = detalleDeCarta(carta)
    if (!fila) continue
    // El NOMBRE también viene traducido, y es lo primero que se lee.
    // Se devuelve aparte porque `detalleDeCarta` no lo toca: la columna
    // `name` la escribe la importación y aquí se pisa solo si de verdad
    // ha llegado algo.
    const nombre = typeof carta.name === 'string' && carta.name.trim() ? carta.name.trim() : null
    return { fila, idioma, nombre }
  }
  return null
}
