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

// El mapeo de la respuesta y el idioma de la ficha se mudaron a
// `js/carta-detalle.js` en la tanda 331: los necesita también el
// navegador. Se importan Y se reexportan —un `export … from` no crea el
// enlace local y aquí se usan por dentro— igual que se hizo con
// `normalizarNombre` en la 325.
import { detalleDeCarta, IDIOMAS_DE_FICHA, urlDeCartaEnIdioma, detalleEnEspanol } from '../../js/carta-detalle.js'
export { detalleDeCarta, IDIOMAS_DE_FICHA, urlDeCartaEnIdioma, detalleEnEspanol }

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

