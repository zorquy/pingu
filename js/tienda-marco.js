// LA WEB DE UNA TIENDA (tanda 1071). PINGU: «que tenga este panel y ya está;
// que no pueda acceder a todo lo demás». Una cuenta de tienda no ve el
// PokeDoc de una persona: la barra de arriba, la lateral del ordenador y la
// de abajo del móvil son las de SU panel (Panel, Colección, Stock, Ventas,
// Escaparate, Mensajes y Datos), la lupa busca en su stock y el color de la sección es el suyo.
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
  // «Panel» y no «Hoy» (1074, PINGU): las cifras van por hoy, la semana, el
  // mes o el año. Su `ver` sigue siendo `hoy`, que es lo que llevan los enlaces.
  { nombre: 'Panel', ver: 'hoy', icono: 'barChart', href: '/tienda' },
  // Colección (1075): el catálogo entero con su stock, para buscar cartas por
  // expansión, Pokédex o nombre y meterlas en el stock. Es /cartas en modo
  // tienda (js/mi-coleccion.js), así que no tiene `ver`: se navega.
  { nombre: 'Colección', icono: 'layers', href: '/cartas', menu: true },
  { nombre: 'Stock', ver: 'stock', icono: 'package', href: '/tienda?ver=stock' },
  // Ofertas (1250): lo que le piden y le ofrecen, y lo reservado por una oferta.
  { nombre: 'Ofertas', ver: 'ofertas', icono: 'tag', href: '/tienda?ver=ofertas' },
  { nombre: 'Ventas', ver: 'ventas', icono: 'receipt', href: '/tienda?ver=ventas' },
  // Torneos (1331, G11): los suyos, con el editor de /torneos.
  { nombre: 'Torneos', ver: 'torneos', icono: 'trophy', href: '/tienda?ver=torneos' },
  { nombre: 'Escaparate', ver: 'escaparate', icono: 'eye', href: '/tienda?ver=escaparate' },
  { nombre: 'Mensajes', icono: 'mail', href: '/mensajes' },
  { nombre: 'Datos', ver: 'datos', icono: 'settings', href: '/tienda?ver=datos' },
]

// En la forma de las secciones de la barra (las de seccionesDeLaBarra).
// `fija`: su enlace es el que es (la «Colección» de una persona lleva a Mi
// colección con cuenta; la de una tienda, a /cartas). `menu`: en la lateral
// lleva colgadas las pestañas de su página.
const comoSeccion = (s) => ({ nombre: s.nombre, ver: s.ver, icono: s.icono, clase: s.clase, menu: s.menu, fija: true, enlaces: [{ href: s.href, texto: s.nombre }] })
export const seccionesDeTienda = () => SECCIONES_DE_TIENDA.map(comoSeccion)

// EL MOSTRADOR (1254; «Vender» desde la 1072) no es una página: en el móvil
// es el centro de la barra (cinco huecos: Ventas, Escaparate y Datos, desde la
// hoja «Tú») y abre el abanico de js/tienda-mostrador.js (Comprar, Vender,
// Cambio, Escanear, Caja de hoy); en el PC, arriba, el botón partido
// Comprar | Cambio | Vender (Cambio desde la 1266).
export const MOSTRADOR = { nombre: 'Mostrador', ver: 'mostrador', icono: 'arrowLeftRight', href: '/tienda?mostrador=1', clase: 'bm-vender bm-mostrador' }
export const seccionesDelMovil = () => ['Panel', 'Colección', 'Mostrador', 'Stock', 'Mensajes'].map((n) => comoSeccion(n === 'Mostrador' ? MOSTRADOR : SECCIONES_DE_TIENDA.find((s) => s.nombre === n)))
const DIBUJO_COMPRAR = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>'
const DIBUJO_CAMBIO = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h13l-4-4"/><path d="M17 17H4l4 4"/></svg>'
const DIBUJO_VENDER = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M4 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2"/></svg>'

export const BUSCAR_EN_STOCK = { href: '/tienda?ver=stock&buscar=1', texto: 'Busca en tu stock…' }

// Qué sección es esta página: Mensajes por su ruta, las de /tienda por su
// pestaña (sin `ver`, el Panel). Su escaparate no es ninguna.
export function seccionDeTienda(ruta, buscar) {
  const k = (String(ruta || '/').replace(/\.html$/, '').split('/').filter(Boolean)[0] || '').toLowerCase()
  if (k === 'mensajes') return 'Mensajes'
  if (k === 'cartas') return 'Colección'
  if (k === 'torneos' || k === 'torneo') return 'Torneos'
  if (k !== 'tienda') return null
  const ver = new URLSearchParams(buscar || '').get('ver') || 'hoy'
  return SECCIONES_DE_TIENDA.find((s) => s.ver === ver)?.nombre || 'Panel'
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
    // Comprar | Cambio | Vender, siempre a mano en el PC (en el móvil, el Mostrador).
    const partido = doc.createElement('span')
    partido.className = 'tdm-vender tdm-partido'
    partido.innerHTML = `<a class="tdm-p-comprar" href="/tienda?comprar=1" data-ver="comprar" title="Comprar">${DIBUJO_COMPRAR}<span>Comprar</span></a><a class="tdm-p-cambio" href="/tienda?cambio=1" data-ver="cambio" title="Cambio">${DIBUJO_CAMBIO}<span>Cambio</span></a><a class="tdm-p-vender" href="/tienda?vender=1" data-ver="vender" title="Vender">${DIBUJO_VENDER}<span>Vender</span></a>`
    derecha.insertBefore(partido, caja)
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
  // El Mostrador y sus hojas, en cualquier página de la tienda (1254). Hasta
  // que llega el módulo, sus enlaces llevan a /tienda con lo mismo.
  import('./tienda-mostrador.js').then((m) => m.engancharMostrador(doc)).catch(() => {})
}
