// Las otras versiones de una carta en Cardmarket (tanda 822, PO2; la fase 2
// de la 807). `tcggo-versiones` las guarda en `tcg_card_versions` colgadas de
// NUESTRA carta, cada una con sus precios y su enlace.
//
// Desde la 861 cada versión lleva nombre: el que da TCGGO cuando lo da
// (`etiqueta`: «Energy Symbol Pattern», «Quick Ball», los patrones de Mega
// Evolution) y, si no, la Reverse Holo cuando es la única (en un set viejo
// es lo único que Cardmarket vende aparte dentro del mismo producto), o
// «Versión N». La Standard —esta carta— va la primera con su precio. El
// enlace de cada versión es el de TCGGO, que abre Cardmarket con el filtro
// puesto. Sin versiones, el bloque no sale.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { euros, enlaceCardmarket } from './cardmarket.js'

// El precio de una versión: el mínimo en español y, si no, el general.
export function precioDeVersion(v) {
  for (const x of [v?.cm_low_es, v?.cm_low]) {
    const n = Number(x)
    if (x != null && Number.isFinite(n) && n > 0) return n
  }
  return null
}

export function enlaceDeVersion(v) {
  if (/^https:\/\/www\.tcggo\.com\/external\/cm\/\d+$/.test(String(v?.link_cm || ''))) return v.link_cm
  // Si no, el producto de Cardmarket, con el enlace de siempre.
  const id = Number(v?.cm_id_product)
  return Number.isInteger(id) && id > 0 ? enlaceCardmarket({ idProduct: id }) : null
}

// El nombre de una versión (861). `variants` son las impresiones de TCGdex
// de la carta: si dice que NO hay reverse, la única sin nombre no lo es.
export function etiquetaDe(v, i, { total = 1, variants = null } = {}) {
  if (typeof v?.etiqueta === 'string' && v.etiqueta.trim()) return v.etiqueta.trim()
  if (total === 1 && variants?.reverse !== false) return 'Reverse Holo'
  return `Versión ${i + 2}`
}

const cifra = (precio) => (precio == null ? 'sin precio' : escapeHtml(euros(precio)))

export function versionesHtml(versiones, { variants = null, precioPrincipal = null } = {}) {
  const lista = versiones || []
  if (!lista.length) return ''
  const filas = lista.map((v, i) => {
    const enlace = enlaceDeVersion(v)
    const cuerpo = `<span class="cv-nombre">${escapeHtml(etiquetaDe(v, i, { total: lista.length, variants }))}</span><span class="cv-precio">${cifra(precioDeVersion(v))}</span>`
    return enlace
      ? `<li><a class="cv-fila" href="${escapeHtml(enlace)}" target="_blank" rel="noopener noreferrer">${cuerpo}</a></li>`
      : `<li><span class="cv-fila">${cuerpo}</span></li>`
  })
  return `<h3 class="cv-titulo">Versiones en Cardmarket</h3>
    <p class="cv-nota">Cada versión con su precio mínimo. El enlace la abre en Cardmarket con el filtro puesto.</p>
    <ul class="cv-lista"><li><span class="cv-fila cv-principal"><span class="cv-nombre">Standard</span><span class="cv-precio">${cifra(precioPrincipal)}</span></span></li>${filas.join('')}</ul>`
}

// `precio` es la fila de precio de la carta (la Standard); `variants`, sus
// impresiones de TCGdex.
export async function pintarVersiones(carta, caja, { cliente = supabase, precio = null, variants = null } = {}) {
  if (!caja || !carta?.id) return
  const { data, error } = await cliente
    .from('tcg_card_versions')
    .select('tcggo_id, card_id, etiqueta, cm_id_product, link_cm, cm_low, cm_low_es')
    .eq('card_id', carta.id)
    .eq('market', carta.market || 'WEST')
    .order('tcggo_id')
    .limit(12)
  // Sin tabla (la migración de la 807) o sin versiones, no hay nada que decir.
  if (error || !data?.length) return
  caja.innerHTML = versionesHtml(data, { variants: variants ?? carta.variants ?? null, precioPrincipal: precioDeVersion(precio) })
  caja.classList.remove('hidden')
}
