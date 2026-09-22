// De la respuesta de TCGdex a las columnas de `tcg_cards`.
//
// Vivía en `netlify/lib/carta-detalle.mjs` y se muda aquí en la tanda
// 331 porque lo necesita TAMBIÉN el navegador: cuando alguien abre una
// carta que la tarea programada todavía no ha engordado, la ficha se la
// pide a TCGdex en el momento y la pinta igual. Una petición, y solo
// para la carta que alguien ha abierto de verdad — que es exactamente
// donde vale la pena gastarla.
//
// Sigue siendo PURA y sin un solo import: así la usan las dos mitades
// (el navegador y la función de Netlify, que la reexporta) sin copiarla.
// Es lo mismo que se hizo con `js/carta-nucleo.js` en la 324.

const API = 'https://api.tcgdex.net/v2'

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
