// LA WEB DE UNA TIENDA (tanda 1071). PINGU: «que tenga este panel y ya está;
// que no pueda acceder a todo lo demás». Una cuenta de tienda no ve el
// PokeDoc de una persona: la barra de arriba, la lateral del ordenador y la
// de abajo del móvil son las de SU panel (Hoy, Stock, Escaparate, Mensajes y
// Datos), la lupa busca en su stock y el color de la sección es el suyo.
//
// Entra por `import()` desde app.js solo cuando el perfil es de tienda: una
// persona no baja ni un byte. Las barras son las de siempre (barra-movil.js
// y barra-lateral.js) con estas secciones: no hay una tercera barra que
// mantener. Lo que no puede abrir lo decide js/tienda-puertas.js.
import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'

// `ver` es la pestaña de /tienda: con ella, cambiar de sección no recarga
// (tienda.js) y las barras saben cuál marcar.
export const SECCIONES_DE_TIENDA = [
  { nombre: 'Hoy', ver: 'hoy', icono: 'barChart', href: '/tienda' },
  { nombre: 'Stock', ver: 'stock', icono: 'package', href: '/tienda?ver=stock' },
  { nombre: 'Ventas', ver: 'ventas', icono: 'receipt', href: '/tienda?ver=ventas' },
  { nombre: 'Escaparate', ver: 'escaparate', icono: 'eye', href: '/tienda?ver=escaparate' },
  { nombre: 'Mensajes', icono: 'mail', href: '/mensajes' },
  { nombre: 'Datos', ver: 'datos', icono: 'settings', href: '/tienda?ver=datos' },
]

// En la forma de las secciones de la barra (las de seccionesDeLaBarra).
const comoSeccion = (s) => ({ nombre: s.nombre, ver: s.ver, icono: s.icono, clase: s.clase, enlaces: [{ href: s.href, texto: s.nombre }] })
export const seccionesDeTienda = () => SECCIONES_DE_TIENDA.map(comoSeccion)

// VENDER (1072) no es una página: es la hoja de js/tienda-vender.js. En el
// móvil va en el centro de la barra (cinco huecos: Ventas y Datos, desde la
// hoja «Tú»); en el PC, como botón arriba.
export const VENDER = { nombre: 'Vender', ver: 'vender', icono: 'coins', href: '/tienda?vender=1', clase: 'bm-vender' }
export const seccionesDelMovil = () => ['Hoy', 'Stock', 'Vender', 'Escaparate', 'Mensajes'].map((n) => comoSeccion(n === 'Vender' ? VENDER : SECCIONES_DE_TIENDA.find((s) => s.nombre === n)))

export const BUSCAR_EN_STOCK = { href: '/tienda?ver=stock&buscar=1', texto: 'Busca en tu stock…' }

// Qué sección es esta página: Mensajes por su ruta, las de /tienda por su
// pestaña (sin `ver`, Hoy). Su escaparate no es ninguna.
export function seccionDeTienda(ruta, buscar) {
  const k = (String(ruta || '/').replace(/\.html$/, '').split('/').filter(Boolean)[0] || '').toLowerCase()
  if (k === 'mensajes') return 'Mensajes'
  if (k !== 'tienda') return null
  const ver = new URLSearchParams(buscar || '').get('ver') || 'hoy'
  return SECCIONES_DE_TIENDA.find((s) => s.ver === ver)?.nombre || 'Hoy'
}

export function enlacesHtml(actual) {
  return SECCIONES_DE_TIENDA.map((s) => `<a href="${s.href}"${s.ver ? ` data-ver="${s.ver}"` : ''}${s.nombre === actual ? ' aria-current="page"' : ''}>${s.nombre}</a>`).join('')
}

// Marcar la pestaña (su `ver`) en todas las barras a la vez: tienda.js la
// cambia sin recargar y lo avisa con `pokedoc:tienda-ver`.
export function marcarSeccion(ver, doc = document) {
  for (const a of doc.querySelectorAll('.nav-links a, .nav-menu-mobile a, .bm a, .lat-seccion-enlace')) {
    const si = Boolean(ver) && a.dataset.ver === ver
    if (si) a.setAttribute('aria-current', 'page')
    else a.removeAttribute('aria-current')
    a.closest('.lat-seccion')?.classList.toggle('lat-activa', si)
  }
}

export function montarMarcoDeTienda({ doc = document, win = window } = {}) {
  const raiz = doc.documentElement
  if (raiz.classList.contains('es-tienda')) return
  raiz.classList.add('es-tienda')
  raiz.dataset.seccion = 'tienda'
  // Sus páginas son su panel, no hojas de otra sección: sin cabecera de «volver».
  raiz.removeAttribute('data-detalle')
  hojaInyectada('css/tienda-marco.css')
  const actual = seccionDeTienda(win.location.pathname, win.location.search)

  for (const a of doc.querySelectorAll('.nav-logo')) a.setAttribute('href', '/tienda')
  const links = doc.querySelector('.nav-links')
  if (links) links.innerHTML = enlacesHtml(actual)
  const menu = doc.getElementById('navMobileMenu')
  if (menu) menu.innerHTML = enlacesHtml(actual)

  // La lupa: al buscador del stock. Ctrl+K, igual que en el resto de la web.
  const derecha = doc.querySelector('.nav-right')
  const yo = doc.getElementById('nav-user')
  if (derecha && yo && !doc.getElementById('navSearch')) {
    const caja = doc.createElement('div')
    caja.className = 'nav-search-wrap'
    caja.id = 'navSearch'
    caja.innerHTML = `<a class="nav-search-btn" id="navSearchBtn" href="${BUSCAR_EN_STOCK.href}" data-ver="stock" data-buscar aria-label="Buscar en tu stock" title="Buscar en tu stock (Ctrl+K)">${icons.search(19)}</a>`
    derecha.insertBefore(caja, yo)
    // Vender, siempre a mano en el PC (en el móvil va en la barra de abajo).
    const vender = doc.createElement('a')
    vender.className = 'btn-primary tdm-vender'
    vender.href = VENDER.href
    vender.dataset.ver = 'vender'
    vender.innerHTML = `${icons.coins(18)}<span>Vender</span>`
    derecha.insertBefore(vender, caja)
  }
  doc.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      doc.getElementById('navSearchBtn')?.click()
    }
  })

  const secciones = seccionesDeTienda()
  if (win.matchMedia?.('(max-width: 900px)').matches) {
    import('./barra-movil.js').then((m) => m.montarBarraMovil({ conSesion: true, secciones: seccionesDelMovil(), actual, detalle: false, buscar: BUSCAR_EN_STOCK })).catch(() => {})
  } else if (win.matchMedia?.('(min-width: 1400px) and (pointer: fine)').matches) {
    import('./barra-lateral.js').then((m) => m.montarBarraLateral({ conSesion: true, secciones, actual, buscarTexto: BUSCAR_EN_STOCK.texto, yoTexto: 'Tu tienda', apoyar: false })).catch(() => {})
  }
  doc.addEventListener('pokedoc:tienda-ver', (e) => marcarSeccion(e.detail))
}
