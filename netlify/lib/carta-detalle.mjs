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

// El idioma de cada mercado. Aquí había una COPIA A MANO de `MERCADOS`
// vigilada por una prueba, y la prueba se separó ella sola: desde la
// tanda 438 el mapa vive en `js/mercados.js` y la guarda seguía leyendo
// `js/tcgdex.js`, donde ya no estaba —encontraba CERO claves y comparaba
// contra un objeto vacío—. Se vio en la 447.
//
// Ya no hay copia (tanda 471): `js/mercados.js` no importa NADA a
// propósito, así que se puede arrastrar a una función de Netlify tal
// cual. El nombre viejo se mantiene para no tocar los cinco sitios que
// lo piden.
import { MERCADOS } from '../../js/mercados.js'
export const IDIOMA_POR_MERCADO = MERCADOS

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

// La fecha de salida, el código de TCG Live y los dos mapeos a fila
// (`setToRow`, `cardToRow`) eran COPIAS de `js/tcgdex.js`, por lo de
// siempre: aquel fichero importa `./supabase.js` y no se puede arrastrar
// aquí. Desde la tanda 471 no hay copia — las cinco funciones son puras
// y viven en `js/catalogo-tcgdex.js`, que no importa nada del navegador.
//
// Se importan Y se reexportan: un `export … from` no crea el enlace
// local, y `fechaDeSet` y `codigoLiveDeSet` se usan aquí dentro, en
// `loQueFaltaDeUnSet`.
import { fechaDeSet, codigoLiveDeSet, setToRow, cardToRow, sinDuplicados, porImagen } from '../../js/catalogo-tcgdex.js'
export { fechaDeSet, codigoLiveDeSet, setToRow, cardToRow, sinDuplicados, porImagen }

// El mapeo de la respuesta y el idioma de la ficha se mudaron a
// `js/carta-detalle.js` en la tanda 331: los necesita también el
// navegador. Se importan Y se reexportan —un `export … from` no crea el
// enlace local y aquí se usan por dentro— igual que se hizo con
// `normalizarNombre` en la 325.
import { detalleDeCarta, IDIOMAS_DE_FICHA, urlDeCartaEnIdioma, detalleEnEspanol, imagePathFromUrl } from '../../js/carta-detalle.js'
export { detalleDeCarta, IDIOMAS_DE_FICHA, urlDeCartaEnIdioma, detalleEnEspanol, imagePathFromUrl }

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

  // ── El LOGO y las CUENTAS (tanda 380) ──
  //
  // Venían en esta misma respuesta desde el primer día y se tiraban. Es
  // lo que dejaba sin logo a Shining Legends, a la Shiny Vault, a las
  // cuatro Trainer Gallery y a la 30th Celebration.
  //
  // Y la cuenta explica un síntoma que parecía otra cosa: la 30th
  // Classic Collection «no traía ninguna carta». Las 30 estaban en la
  // base; lo que faltaba era el número, y la estantería mide con
  // `card_count_official || card_count_total || 0` — o sea «0 de 0».
  const logo = imagePathFromUrl(completo?.logo)
  if (!fila?.logo_path && logo) cambios.logo_path = logo
  if (!fila?.symbol_url && completo?.symbol) cambios.symbol_url = completo.symbol
  // `> 0` y no `!= null`: el 0 de la 30th Classic Collection es un
  // número guardado, así que con `!fila?.card_count_official` valdría —
  // pero con un `is null` NO, y prefiero que la condición diga lo que
  // significa: «no sabemos cuántas tiene».
  const total = entero(completo?.cardCount?.total)
  const oficial = entero(completo?.cardCount?.official)
  if (!(fila?.card_count_total > 0) && total) cambios.card_count_total = total
  if (!(fila?.card_count_official > 0) && oficial) cambios.card_count_official = oficial
  return cambios
}

const entero = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : null)

// Un set «incompleto» es uno al que aún NO se le ha pedido el set
// completo, y el marcador es la SERIE: el set completo la trae siempre,
// así que un set con serie es un set ya visitado. La fecha y el código
// de TCG Live se curan en esa misma visita SI TCGdex los tiene — y
// cuando no los tiene, no los va a tener mañana: los sets anteriores a
// TCG Online no tienen código, y algunas promos no traen fecha.
//
// Contarlos como «incompletos» (tanda 333, y el porqué de este cambio)
// dejaba ~100 sets imposibles de completar: la fase de sets se los
// volvía a pedir a TCGdex cada cinco minutos para siempre, nunca
// acababa, y el engorde de cartas —que iba DETRÁS de ella— no arrancó
// jamás. Con 3.676 cartas engordadas de 21.356, y ninguna en español.
export function leFaltaAlgo(fila) {
  return !fila?.serie_id || !fila?.serie_name
}

// ── ¿Hay que ir a mirar este set? (tanda 343) ──
//
// Las dos versiones anteriores preguntaban «¿le falta ESTE dato?», y esa
// pregunta no puede distinguir «no lo hemos pedido» de «TCGdex no lo
// tiene». Las dos fallaron por ese lado, cada una hacia su lado:
//
//   · Hasta la 333, la condición incluía el código de TCG Live. Los sets
//     anteriores a TCG Online no tienen ninguno, así que se quedaban
//     «incompletos» para siempre: la fase no acababa nunca y el engorde
//     no arrancaba jamás.
//   · Desde la 333 mira solo la serie, y eso rompió el cerrojo — pero el
//     código dejó de curarse EN SILENCIO. Un set que ya tenía serie no
//     se volvía a visitar aunque le faltara. Por eso /cartas enseñaba
//     ME05 y SV08 donde la gente dice PBL y SSP.
//
// `curado_at` responde a otra cosa: «¿hemos ido a mirar?». Un set
// visitado se queda con lo que TCGdex tenga —código incluido, o sin él
// si no existe— y no se vuelve a pedir. La fase termina SIEMPRE, que era
// lo que la 333 quería, y el código se cura, que era lo que se perdió.
//
// Y mientras la migración no esté puesta la columna no viaja, así que se
// usa la regla vieja: `'curado_at' in fila` distingue «la columna no
// está» de «está y vale null», que es justo la confusión que esto viene
// a quitar.
// La VERSIÓN del curador (tanda 380). Sube cuando aprende a quedarse
// con un campo nuevo que ya venía en la respuesta: entonces cada fila
// visitada por una versión anterior se revisita UNA vez.
//
// Por qué una versión y no «¿le falta el logo?»: porque hay sets cuyo
// logo TCGdex no tiene, y esa pregunta no distingue «no lo hemos
// pedido» de «no existe» — se volverían a pedir para siempre. Es
// EXACTAMENTE el cerrojo de la 333, que dejó el engorde sin arrancar
// jamás. La pregunta que sí se puede contestar es «¿le preguntamos con
// lo que sabemos hoy?».
export const VERSION_CURADO = 1

export function faltaVisitar(fila) {
  // Sin la columna (migración sin ejecutar) se comporta como antes: el
  // curador nuevo no puede exigir una columna que todavía no está.
  if (fila && 'curado_v' in fila && (fila.curado_v ?? 0) < VERSION_CURADO) return true
  if (fila && 'curado_at' in fila) return !fila.curado_at
  return leFaltaAlgo(fila)
}


// ── Qué nombres hay que devolver al inglés (tanda 335) ──
//
// Entre la 330 y la 335 el engorde en español escribía el nombre
// traducido ENCIMA de `tcg_cards.name`, que es la CLAVE con la que se
// cruzan el agregado de `tcg_card_play`, el resolutor de decklists y la
// huella de las reimpresiones. El español está a salvo en `name_es`; el
// inglés hay que volver a pedirlo, y viene en el LISTADO del set.
//
// Esto es la parte PURA —decidir qué filas hay que escribir— y vive
// aquí por lo mismo que `loQueFaltaDeUnSet`: se prueba con una
// respuesta guardada, sin red y sin base.
//
// Dos cribas que no son cosmética:
//
//   · solo las que YA están en nuestra tabla. Se escribe con un
//     `merge-duplicates`, y un identificador que no exista no daría
//     error: INSERTARÍA una fila a medias, sin set y sin imagen.
//   · solo las que están mal de verdad. Iono se llama Iono en los dos
//     idiomas, y reescribirla sería gastar la pasada en no cambiar
//     nada.
export function nombresPorArreglar(nuestras, completo, market = 'WEST') {
  const porId = new Map(
    (Array.isArray(completo?.cards) ? completo.cards : [])
      .filter((c) => c?.id && typeof c.name === 'string' && c.name.trim())
      .map((c) => [String(c.id), c.name.trim()])
  )
  if (!porId.size) return []
  return (Array.isArray(nuestras) ? nuestras : [])
    .filter((c) => porId.has(String(c?.id)) && porId.get(String(c.id)) !== c.name)
    .map((c) => ({ id: c.id, market, name: porId.get(String(c.id)) }))
}

// ── La marca de regulación de un SET (tanda 339) ──
//
// Es propiedad del set y no de cada carta: todas las de un mismo set
// llevan la misma letra. TCGdex no la trae para algunos —el `30th`, sin
// ir más lejos—, y sin ella la ficha dice «No es legal en Estándar» de
// una carta que sí lo es, que es peor que no decir nada.
//
// Esto NO adivina cuando no hace falta: `regulation_mark` en el set ya
// viene resuelto de la migración (que se lo preguntó a sus propias
// cartas). Esta función es solo para los sets NUEVOS, que llegan sin
// ninguna carta con marca. Y deduce de datos nuestros —el set anterior
// más cercano— y no de una lista de fechas escrita a mano, que es lo que
// se queda viejo.
//
// Devuelve null cuando NO hay que tocar nada, que son tres casos:
//   · el set ya tiene marca,
//   · la puso un humano (`mano` manda sobre cualquier deducción),
//   · o es anterior a que las marcas existieran, y ahí el null no es un
//     hueco: es la verdad, y esas cartas no son legales en Estándar.
//
// `sets` llega ordenado de más nuevo a más viejo, que es como lo deja
// `setsPorPrioridad`.
export function marcaHeredada(set, sets) {
  if (!set || set.regulation_mark || set.regulation_mark_origen === 'mano') return null
  if (!set.release_date) return null
  const conMarca = sets.filter((s) => s.regulation_mark && s.release_date)
  if (!conMarca.length) return null
  const primera = conMarca.reduce((a, b) => (a.release_date <= b.release_date ? a : b))
  if (set.release_date < primera.release_date) return null
  // El anterior más cercano que ya tiene marca. Se recorre en vez de
  // fiarse del orden de la lista: si algún día llega sin ordenar, esto
  // sigue dando lo mismo.
  const anteriores = conMarca.filter((s) => s.release_date <= set.release_date)
  if (!anteriores.length) return null
  return anteriores.reduce((a, b) => (a.release_date >= b.release_date ? a : b)).regulation_mark || null
}
