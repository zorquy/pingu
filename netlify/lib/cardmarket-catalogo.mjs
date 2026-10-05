// La guía diaria de precios de Cardmarket (tanda 587, podada en la 588).
//
// Cardmarket publica cada día un fichero abierto, sin clave:
//
//   productCatalog/priceGuide/price_guide_6.json — 79.688 precios de
//   Pokémon: `idProduct`, avg/low/trend/avg1/avg7/avg30 y los mismos
//   «-holo». Es EXACTAMENTE lo que TCGdex nos sirve (el 273615 trae los
//   mismos 0,15 / 2,06 / 1,34): el fallo de TCGdex no está en el precio,
//   está en QUÉ producto le cuelga a cada carta (su issue #2325).
//
// Qué producto es cada carta nuestra lo decide `tcg_cards.cm_id_product_
// propio`, que desde la 588 escribe `tcggo-emparejar` (TCGGO lo trae
// carta a carta). La 587 lo intentó deducir del catálogo de productos
// —por el orden de los ids y por nombres— y en la vida real casaba un
// 15 % en los sets modernos (los ataques nuestros están en español, los
// nombres a veces también, y las expansiones repetidas empataban); ese
// código se quitó. Aquí queda solo lo que la guía diaria necesita.
export const URL_GUIA = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json'

// De una entrada de la guía a nuestra fila de `tcg_card_prices` (las
// mismas columnas que `filaDePrecio` de js/cardmarket.js saca de TCGdex,
// porque es el mismo dato).
export function filaDeGuia(cardId, idProduct, entrada, { creada = null, ahora = new Date() } = {}) {
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
  return {
    card_id: cardId,
    cm_id_product: idProduct,
    cm_low: n(entrada?.low),
    cm_trend: n(entrada?.trend),
    cm_avg30: n(entrada?.avg30),
    cm_avg7: n(entrada?.avg7),
    cm_low_holo: n(entrada?.['low-holo']),
    cm_trend_holo: n(entrada?.['trend-holo']),
    cm_avg30_holo: n(entrada?.['avg30-holo']),
    cm_updated: creada ? new Date(creada).toISOString() : ahora.toISOString(),
    origen: 'cardmarket-guia',
    checked_at: ahora.toISOString(),
  }
}
