// «En tiendas» (tanda 1069): las tiendas que tienen una carta, la más
// barata primero, para la ficha de una carta y la del Mercado. Lo cuenta la
// base (`tiendas_que_tienen`): solo lo visible y con unidades, nunca el
// coste, y sin precio si la tienda no lo enseña. Sin la migración, o sin
// ninguna tienda, el bloque no sale: «ninguna tienda» no se dice mientras
// apenas haya tiendas.
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { euros } from './cardmarket.js'
import { nombreDeVariante } from './mi-coleccion/variantes.js'

export async function tiendasQueTienen(cardId) {
  if (!cardId) return []
  const { data, error } = await supabase.rpc('tiendas_que_tienen', { p_card_id: cardId, p_limite: 12 })
  return error ? [] : data || []
}

// La URL del perfil de la tienda, con la carta a la vista.
export const enlaceDeTienda = (t, cardId = null) => `/usuario/${encodeURIComponent(t.username || '')}${cardId ? `?carta=${encodeURIComponent(cardId)}` : ''}`

export function enTiendasHtml(tiendas, cardId) {
  if (!tiendas?.length) return ''
  const fila = (t) => {
    const nombre = t.display_name || t.username || 'Tienda'
    const detalle = [String(t.idioma || '').toUpperCase(), t.estado, t.variante && t.variante !== 'normal' ? nombreDeVariante(t.variante) : null, t.gradeo].filter(Boolean).join(' · ')
    return `<a class="ent-fila" href="${escapeHtml(enlaceDeTienda(t, cardId))}">
      <span class="ent-logo" aria-hidden="true">${escapeHtml(nombre.slice(0, 1).toUpperCase())}</span>
      <span class="ent-quien"><strong>${escapeHtml(nombre)}</strong><small>${escapeHtml([t.ciudad, detalle].filter(Boolean).join(' · '))}</small></span>
      <span class="ent-precio">${t.precio == null ? '<small>Pregunta en la tienda</small>' : escapeHtml(euros(t.precio))}${t.de_tu_lista ? '<small class="ent-tuya">de tu lista</small>' : ''}</span>
    </a>`
  }
  return `<h3 class="ent-titulo">En tiendas</h3><div class="ent-lista">${tiendas.map(fila).join('')}</div>`
}

// Pinta el bloque en `caja` si hay alguna tienda; `sigue()` dice si la ficha
// sigue siendo la de esa carta cuando llega la respuesta (la 663).
export async function pintarEnTiendas(caja, cardId, { sigue = () => true } = {}) {
  if (!caja) return
  caja.hidden = true
  const tiendas = await tiendasQueTienen(cardId)
  if (!sigue() || !tiendas.length) return
  await hojaInyectada('css/en-tiendas.css')
  caja.innerHTML = enTiendasHtml(tiendas, cardId)
  caja.hidden = false
}
