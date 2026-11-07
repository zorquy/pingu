// EL MOSTRADOR (tandas 1254–1256). PINGU: «estoy en un card show… unos
// quieren comprar, otros quieren vender… el botón central debería llamarse
// otra cosa porque sería para comprar y para vender… que sea algo que se
// despliegue y que mole».
//
// El botón del centro de la barra de abajo (`Mostrador`, js/tienda-marco.js)
// abre aquí un abanico: Comprar y Vender en grande, Cambio a lo ancho (1266:
// cartas por cartas y la diferencia en dinero), «Escanear etiqueta» (Vender
// con el cursor esperando al lector) y «Caja de hoy», y debajo lo que llevas
// hoy. En el PC no hay abanico: el botón de arriba se parte en
// Comprar | Cambio | Vender.
// Comprar, Vender y la caja se abren en cualquier página de la tienda (son
// hojas), y al terminar avisan con `pokedoc:tienda-vendida` a quien pinte.
//
// También viven aquí las piezas que comparten Comprar y Vender: el conmutador
// de arriba y los botones de cómo se paga, con sus dibujos (que no van en
// icons.js: ese lo baja toda la web y cuenta en el peso de la portada).
import { escapeHtml } from './html.js'
import { hojaInyectada } from './hoja.js'
import { showToast } from './toast.js'
import { recargarSiDesajuste } from './error-log.js'
import { icons } from './icons.js'
import { euros } from './cardmarket.js'

const trazo = (d) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${d}</svg>`
export const DIBUJOS = {
  efectivo: trazo('<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 10v4M18 10v4"/>'),
  tarjeta: trazo('<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>'),
  bizum: trazo('<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/>'),
  paypal: trazo('<path d="M7 20 9 4h6a4 4 0 0 1 0 8h-4l-1 8"/>'),
  otro: trazo('<path d="M7 7h10M7 12h10M7 17h6"/>'),
  comprar: trazo('<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>'),
  vender: trazo('<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/>'),
  cambio: trazo('<path d="M7 7h13l-4-4"/><path d="M17 17H4l4 4"/>'),
  escanear: trazo('<path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M7 8v8M10 8v8M13 8v8M17 8v8"/>'),
}

// «Comprar · Cambio · Vender» arriba de las hojas: pasar de una a otra sin
// cerrar el mostrador. Cambio (1266) es la hoja de Comprar en otro modo.
export const MODOS = [['comprar', 'Comprar'], ['cambio', 'Cambio'], ['vender', 'Vender']]
export const modoHtml = (actual) => `<div class="tdm-modo" role="group" aria-label="Comprar, cambio o vender">${MODOS.map(([v, t]) => `<button type="button" data-modo="${v}" aria-pressed="${v === actual}">${t}</button>`).join('')}</div>`

// Los botones de cómo se paga (uno siempre elegido).
export const pagosHtml = (lista, actual, titulo) => `<div class="tdm-pagos-caja"><p class="tdm-etq">${escapeHtml(titulo)}</p><div class="tdm-pagos" role="group" aria-label="${escapeHtml(titulo)}">${lista.map(([v, t]) => `<button type="button" data-pago="${v}" aria-pressed="${v === actual}">${DIBUJOS[v] || ''}<span>${t}</span></button>`).join('')}</div></div>`

// Lo último elegido, por navegador (en un evento no cambia en todo el día).
export function recordado(clave, valido, porDefecto) {
  try {
    const v = localStorage.getItem(clave)
    return valido.includes(v) ? v : porDefecto
  } catch {
    return porDefecto
  }
}
export function recordar(clave, valor) {
  try { localStorage.setItem(clave, valor) } catch {}
}

const avisar = () => document.dispatchEvent(new CustomEvent('pokedoc:tienda-vendida'))
const fallo = (que) => (e) => {
  if (recargarSiDesajuste(e)) return
  showToast(`No se ha podido abrir ${que}. Recarga la página.`, 'error')
}

export function abrirVenderRapido(opciones = {}) {
  cerrarAbanico()
  return import('./tienda-vender.js').then((m) => m.abrirVender({ alTerminar: avisar, ...opciones })).catch(fallo('Vender'))
}
export function abrirComprarRapido(opciones = {}) {
  cerrarAbanico()
  return import('./tienda-comprar.js').then((m) => m.abrirComprar({ alTerminar: avisar, ...opciones })).catch(fallo('Comprar'))
}
export function abrirCambioRapido(opciones = {}) {
  cerrarAbanico()
  return import('./tienda-comprar.js').then((m) => m.abrirComprar({ alTerminar: avisar, ...opciones, modo: 'cambio' })).catch(fallo('Cambio'))
}
export function abrirCajaDeHoy() {
  cerrarAbanico()
  return import('./tienda-caja.js').then((m) => m.abrirCaja()).catch(fallo('la caja'))
}

// ── El abanico (móvil) ──
let abanico = null
let iconoAntes = ''

const plantilla = (html) => {
  const t = document.createElement('template')
  t.innerHTML = html.trim()
  return t.content.firstChild
}

function boton() {
  return document.querySelector('.bm a[data-ver="mostrador"]')
}

export function cerrarAbanico() {
  if (!abanico) return
  abanico.remove()
  abanico = null
  document.documentElement.classList.remove('tdm-abierto')
  const b = boton()
  if (b) {
    b.setAttribute('aria-expanded', 'false')
    b.querySelector('span').textContent = 'Mostrador'
    if (iconoAntes) b.querySelector('svg')?.replaceWith(plantilla(iconoAntes))
  }
}

export function abrirMostrador() {
  if (abanico) return cerrarAbanico()
  hojaInyectada('css/tienda-mostrador.css')
  abanico = document.createElement('div')
  abanico.className = 'tdm-abanico'
  abanico.innerHTML = `
    <div class="tdm-velo" data-tdm="cerrar"></div>
    <div class="tdm-panel" role="dialog" aria-modal="false" aria-label="Mostrador">
      <div class="tdm-dos">
        <button type="button" class="tdm-gran tdm-gran-comprar" data-tdm="comprar">${DIBUJOS.comprar}<span><b>Comprar</b><small>Te venden cartas: tasa y entra al stock</small></span></button>
        <button type="button" class="tdm-gran tdm-gran-vender" data-tdm="vender">${DIBUJOS.vender}<span><b>Vender</b><small>Te compran: de tu stock, al momento</small></span></button>
      </div>
      <button type="button" class="tdm-gran tdm-gran-cambio" data-tdm="cambio">${DIBUJOS.cambio}<span><b>Cambio</b><small>Cartas por cartas, y la diferencia en dinero</small></span></button>
      <div class="tdm-finas">
        <button type="button" data-tdm="escanear">${DIBUJOS.escanear}<span>Escanear etiqueta</span></button>
        <button type="button" data-tdm="caja">${icons.receipt(18)}<span>Caja de hoy</span></button>
      </div>
      <p class="tdm-hoy" data-tdm-hoy><span>Hoy: …</span></p>
    </div>`
  document.body.appendChild(abanico)
  document.documentElement.classList.add('tdm-abierto')
  const b = boton()
  if (b) {
    b.setAttribute('aria-expanded', 'true')
    b.querySelector('span').textContent = 'Cerrar'
    // Abierto, el círculo es una «×» (el icono de siempre vuelve al cerrar).
    const svg = b.querySelector('svg')
    if (svg) {
      iconoAntes = svg.outerHTML
      svg.replaceWith(plantilla(icons.x(24)))
    }
  }
  abanico.addEventListener('click', (e) => {
    const t = e.target.closest('[data-tdm]')
    if (!t) return
    const que = t.dataset.tdm
    if (que === 'cerrar') return cerrarAbanico()
    if (que === 'comprar') return abrirComprarRapido()
    if (que === 'vender') return abrirVenderRapido()
    if (que === 'cambio') return abrirCambioRapido()
    if (que === 'escanear') return abrirVenderRapido({ escanear: true })
    if (que === 'caja') return abrirCajaDeHoy()
  })
  abanico.querySelector('[data-tdm="comprar"]').focus({ preventScroll: true })
  // Lo de hoy, de la caja (1256): si no llega, la línea se va.
  const linea = abanico.querySelector('[data-tdm-hoy]')
  import('./tienda-caja.js')
    .then((m) => m.cajaDeHoy())
    .then((c) => {
      if (!linea.isConnected) return
      linea.innerHTML = `<span>Hoy: <b>${c.ventas} ${c.ventas === 1 ? 'venta' : 'ventas'} · ${euros(c.vendido)}</b></span><span><b>${c.compras} ${c.compras === 1 ? 'compra' : 'compras'} · ${euros(c.comprado)}</b></span>`
    })
    .catch(() => linea.remove())
}

// El botón del centro (y lo que lleve `data-ver` de mostrador, comprar,
// cambio, vender o caja) en cualquier página de la tienda: sin navegar.
export function engancharMostrador(doc = document) {
  doc.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-ver="mostrador"], a[data-ver="comprar"], a[data-ver="vender"], a[data-ver="cambio"], a[data-ver="caja"]')
    if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return
    e.preventDefault()
    if (a.dataset.ver === 'mostrador') return abrirMostrador()
    if (a.dataset.ver === 'comprar') return abrirComprarRapido()
    if (a.dataset.ver === 'cambio') return abrirCambioRapido()
    if (a.dataset.ver === 'caja') return abrirCajaDeHoy()
    return abrirVenderRapido()
  })
  doc.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && abanico) cerrarAbanico()
  })
}
