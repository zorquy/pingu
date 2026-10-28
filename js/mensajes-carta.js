// «Me interesa» (tanda 1080): una carta del escaparate de una tienda dentro
// de una conversación. Quien la pregunta la lleva puesta en el cuadro de
// escribir y sale en el mensaje con su foto, lo que era y el precio que tenía
// cuando escribió; la tienda ve «Vender esta carta», que abre Vender con esa
// línea de SU stock.
//
// Lo del adjunto lo escribe quien manda el mensaje, así que no se le cree
// nada que importe: la foto sale del catálogo por `card_id`, nada se pinta
// sin escapar, y Vender busca la línea en el stock de la tienda por su id
// (la política solo le deja ver la suya). Entra por `import()` desde
// mensajes.js solo si hay una carta que pintar.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { showToast } from './toast.js'
import { euros } from './cardmarket.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from './escaneo-carta.js'
import { nombreDeCarta } from './catalogo-series.js'
import { rutaDeCarta } from './carta-ruta.js'
import { rutaDeProducto } from './productos.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'
import { COLUMNAS_CARTA_DE_SET } from './mi-coleccion/columnas-set.js'
import { adjuntoDeCarta } from './mensajes-puro.js'

const cartas = new Map()
const productos = new Map()

// Las fotos y los nombres del catálogo, una vez por carta.
export async function completar(adjuntos) {
  for (const market of ['WEST', 'JP']) {
    const ids = [...new Set(adjuntos.filter((a) => a.card_id && (a.market || 'WEST') === market && !cartas.has(a.card_id)).map((a) => String(a.card_id)))]
    if (!ids.length) continue
    const { data } = await supabase.from('tcg_cards').select(COLUMNAS_CARTA_DE_SET).eq('market', market).in('id', ids.slice(0, 100))
    for (const c of data || []) cartas.set(c.id, c)
  }
  const prod = [...new Set(adjuntos.filter((a) => a.product_id && !productos.has(String(a.product_id))).map((a) => Number(a.product_id)).filter(Number.isFinite))]
  if (prod.length) {
    const { data } = await supabase.from('tcg_products').select('id,name,image').in('id', prod.slice(0, 100))
    for (const p of data || []) productos.set(String(p.id), p)
  }
}

function detalleDe(a) {
  if (a.product_id) return 'Sellado'
  return [String(a.idioma || '').toUpperCase(), a.estado, a.variante && a.variante !== 'normal' ? nombreDeVariante(a.variante) : null].filter(Boolean).join(' · ')
}

// `pendiente`: la que está en el cuadro de escribir, con su «quitar».
export function cartaHtml(a, { miId = null, mia = false, pendiente = false } = {}) {
  const c = a.card_id ? cartas.get(a.card_id) : null
  const p = a.product_id ? productos.get(String(a.product_id)) : null
  const nombre = c ? nombreDeCarta(c) : p?.name || a.nombre || 'Carta'
  const foto = c ? atributosDeEscaneo(cadenaDeEscaneo(c)) : p?.image ? `src="${escapeHtml(p.image)}" onerror="this.remove()"` : null
  const href = c ? rutaDeCarta(c) : a.product_id ? rutaDeProducto({ id: a.product_id }) : null
  const precio = Number(a.precio)
  const cuando = pendiente ? '' : mia ? ' <small>cuando escribiste</small>' : ' <small>cuando escribió</small>'
  return `<div class="msg-carta${pendiente ? ' msg-carta-pendiente' : ''}">
    <a class="msg-carta-foto${a.product_id ? ' msg-carta-producto' : ''}"${href ? ` href="${escapeHtml(href)}"` : ''} aria-label="${escapeHtml(nombre)}">${foto ? `<img ${foto} alt="" width="245" height="342" loading="lazy" />` : ''}</a>
    <span class="msg-carta-texto">
      <small class="msg-carta-que">${pendiente ? 'Vas a preguntar por' : mia ? 'Te interesa' : 'Le interesa'}</small>
      <strong>${escapeHtml(nombre)}</strong>
      <span>${escapeHtml(detalleDe(a))}</span>
      ${Number.isFinite(precio) && a.precio != null ? `<span class="msg-carta-precio">${escapeHtml(euros(precio))}${cuando}</span>` : ''}
      ${!pendiente && miId && a.tienda === miId ? `<button type="button" class="btn-primary msg-carta-vender" data-vender-carta="${escapeHtml(a.stock_id)}">Vender esta carta</button>` : ''}
    </span>
    ${pendiente ? '<button type="button" class="msg-carta-quitar" data-quitar-carta aria-label="No mandar la carta">×</button>' : ''}
  </div>`
}

// La línea del escaparate que se pregunta (`?carta=` de «Me interesa»). Sin
// la migración 1079 el escaparate no filtra por id y devolvería otra: se
// comprueba que es ESA.
export async function prepararCarta(tiendaId, stockId) {
  const { data, error } = await supabase.rpc('tienda_escaparate', { p_tienda: tiendaId, p_filtros: { id: stockId }, p_orden: 'recientes', p_desde: 0, p_cuantas: 1 })
  const linea = !error && data?.filas?.[0]
  if (!linea || String(linea.id) !== String(stockId)) return null
  const a = adjuntoDeCarta(linea, tiendaId)
  await completar([a]).catch(() => {})
  return a
}

// «Vender esta carta»: la línea de verdad, del stock de la tienda.
export async function venderDesdeMensaje(stockId, adjunto) {
  const { data, error } = await supabase.from('tienda_stock').select('*').eq('id', stockId).maybeSingle()
  if (error || !data) return showToast('Esa carta ya no está en tu stock.', 'error')
  if (!(data.unidades > 0)) return showToast('No te quedan unidades de esa carta.', 'error')
  const c = data.card_id ? cartas.get(data.card_id) : null
  const fila = { ...data, nombre: (c && nombreDeCarta(c)) || adjunto?.nombre || '', set_id: c?.set_id || null, numero: c?.local_id || null }
  const { abrirVender } = await import('./tienda-vender.js')
  abrirVender({ filas: [fila] })
}
