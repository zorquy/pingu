// Hoy, en tarjetas (tanda 1376, la versión 2 de «El torneo, renovado»; PINGU
// eligió que la lista se pegue en una VENTANA). En la pestaña ya no está el
// cuadro de texto enorme de «Tu decklist»: hay una tarjeta pequeña con tu mazo
// (sus dos Pokémon, de dónde es la lista y «Cambiar») y la caja de siempre
// vive dentro de un <dialog> que se abre con ese botón, con «Mandar mi lista»
// o con «Enviar lista» de tus jornadas. Los ids de dentro no cambian, así que
// guardar, «Usar un mazo del constructor» y exportar siguen igual.
//
// Fuera de torneo.js porque ese fichero tiene presupuesto (la 895).
import { icons } from '../icons.js'
import { escapeHtml } from '../html.js'
import { deducirIconos } from './arquetipos.js'
import { spriteDeCarta, atributosDeRespaldo } from './sprites-pokemon.js'

// El nombre de una lista sin catálogo: sus dos Pokémon, como en Mis partidas.
export function nombreDeLista(parsed) {
  return deducirIconos(parsed)
    .map((i) => i.nombre)
    .filter(Boolean)
    .join(' ')
}

const ventana = () => document.getElementById('torneoListaVentana')

// Se engancha una vez: la X, tocar fuera y Escape (este lo da el navegador).
export function montarVentanaLista() {
  const v = ventana()
  if (!v || v.dataset.montada) return
  v.dataset.montada = '1'
  const x = document.getElementById('torneoListaCerrar')
  if (x) {
    x.innerHTML = icons.x?.(18) || ''
    x.addEventListener('click', () => v.close())
  }
  // Tocar el fondo (el propio <dialog>, fuera de la caja) la cierra.
  v.addEventListener('click', (e) => {
    if (e.target === v) v.close()
  })
}

export function abrirVentanaLista() {
  const v = ventana()
  if (!v) return
  if (!v.open) v.showModal?.()
  // Sin lista, al cuadro de texto; con lista, se ve primero la lista.
  const texto = document.getElementById('decklistTexto')
  if (texto && !texto.value.trim() && !texto.readOnly) texto.focus({ preventScroll: true })
}

export function cerrarVentanaLista() {
  if (ventana()?.open) ventana().close()
}

// La tarjeta «Tu mazo». `datos`: { visible, parsed, sub, boton }; `pintar` es
// pintarSiCambia (la ficha se refresca cada 10 s y rehacer movería la página).
export function pintarTuMazo(datos, pintar) {
  const caja = document.getElementById('torneoMazoCaja')
  if (!caja) return
  caja.classList.toggle('hidden', !datos?.visible)
  if (!datos?.visible) return
  const conCartas = Boolean(datos.parsed?.pokemon?.length)
  const nombre = conCartas ? nombreDeLista(datos.parsed) : ''
  const urls = conCartas ? deducirIconos(datos.parsed).map((i) => spriteDeCarta(i.nombre)).filter(Boolean) : []
  const dibujo = urls.length
    ? `<span class="torneo-mazo-sprites" aria-hidden="true">${urls.map((u) => `<img src="${escapeHtml(u)}" alt="" width="56" height="56" loading="lazy"${atributosDeRespaldo(u)} />`).join('')}</span>`
    : `<span class="torneo-mazo-sprites vacio" aria-hidden="true">${icons.cards?.(26) || ''}</span>`
  pintar(
    caja,
    `${dibujo}
    <span class="torneo-mazo-texto"><b>${escapeHtml(nombre || (conCartas ? 'Tu lista' : 'Sin lista'))}</b><span>${escapeHtml(datos.sub || '')}</span></span>
    <button type="button" class="${conCartas ? 'link-btn' : 'btn-primary'} torneo-mazo-boton" data-abrir-lista>${escapeHtml(datos.boton || 'Ver')}</button>`
  )
}

// Un clic en cualquier [data-abrir-lista] de la ficha abre la ventana (la
// tarjeta se repinta, así que se escucha en el documento, una vez).
export function engancharAbrirLista() {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-abrir-lista]')) abrirVentanaLista()
  })
}
