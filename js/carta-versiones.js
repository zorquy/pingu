// Las otras versiones de una carta en Cardmarket (tanda 822, PO2; la fase 2
// de la 807). `tcggo-versiones` las guarda en `tcg_card_versions` colgadas de
// NUESTRA carta, cada una con sus precios y su enlace.
//
// TCGGO no dice QUÉ versión es (la Reverse del Snorlax de Plasma Storm es
// «Snorlax» a secas, la 807): por eso no se le pone un nombre inventado. Se
// numeran y el enlace —el de TCGGO, que abre Cardmarket con el filtro de la
// versión puesto— es el que dice cuál es. Sin versiones, el bloque no sale.
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

export function versionesHtml(versiones) {
  const filas = (versiones || []).map((v, i) => {
    const precio = precioDeVersion(v)
    const enlace = enlaceDeVersion(v)
    const cuerpo = `<span class="cv-nombre">Versión ${i + 2}</span><span class="cv-precio">${precio == null ? 'sin precio' : escapeHtml(euros(precio))}</span>`
    return enlace
      ? `<li><a class="cv-fila" href="${escapeHtml(enlace)}" target="_blank" rel="noopener noreferrer">${cuerpo}</a></li>`
      : `<li><span class="cv-fila">${cuerpo}</span></li>`
  })
  if (!filas.length) return ''
  return `<h3 class="cv-titulo">Otras versiones en Cardmarket</h3>
    <p class="cv-nota">Cardmarket vende esta carta en ${filas.length + 1} versiones (reverse, sellada…). Cuál es cada una lo dice su página: el enlace la abre con el filtro puesto.</p>
    <ul class="cv-lista">${filas.join('')}</ul>`
}

export async function pintarVersiones(carta, caja, { cliente = supabase } = {}) {
  if (!caja || !carta?.id) return
  const { data, error } = await cliente
    .from('tcg_card_versions')
    .select('tcggo_id, card_id, cm_id_product, link_cm, cm_low, cm_low_es')
    .eq('card_id', carta.id)
    .eq('market', carta.market || 'WEST')
    .order('tcggo_id')
    .limit(12)
  // Sin tabla (la migración de la 807) o sin versiones, no hay nada que decir.
  if (error || !data?.length) return
  caja.innerHTML = versionesHtml(data)
  caja.classList.remove('hidden')
}
