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
