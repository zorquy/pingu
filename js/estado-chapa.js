// EL ESTADO DE UNA CARTA, PINTADO (tanda 1249, PINGU: «desde Mint hasta Poor…
// con esos colores», los de Cardmarket). Una chapa para toda la web: la
// sigla (MT, NM, EX, GD, LP, PL, PO) sobre su color, y de título el nombre y lo
// que significa. Los colores son `--estado-*` de components.css, fijos en los
// dos temas porque llevan la letra encima (como `--danger-solid`). Un sitio
// nuevo que enseñe el estado de una copia pasa por aquí, no escribe la sigla.
import { ESTADOS } from './cardmarket.js'
import { escapeHtml } from './html.js'

const POR_ID = new Map(ESTADOS.map((e) => [e.id, e]))

export const datosDeEstado = (id) => POR_ID.get(String(id || '').toUpperCase()) || null

// «Near Mint · Recién sacada del sobre»: lo que dice el título de la chapa y
// las opciones de un selector.
export function textoDeEstado(id) {
  const e = datosDeEstado(id)
  return e ? `${e.nombre} · ${e.que}` : ''
}

export function chapaDeEstadoHtml(id, { clase = '' } = {}) {
  const e = datosDeEstado(id)
  if (!e) return ''
  return `<span class="chapa-estado${clase ? ` ${clase}` : ''}" data-estado="${e.id}" title="${escapeHtml(textoDeEstado(e.id))}">${e.id}<span class="sr-only"> · ${escapeHtml(e.nombre)}</span></span>`
}
