import { icons } from './icons.js'
import { hojaInyectada } from './hoja.js'

// La lupa de la barra. Desde la 718 abre la PALETA (`js/paleta.js`): una
// caja que busca en todo —cartas con su precio, guías, el foro, la gente—,
// lleva a cualquier página y lanza acciones. La abren también los dos
// atajos de teclado: «/» (el de los foros de toda la vida) y Ctrl+K, o
// Cmd+K en el Mac. Antes era un desplegable propio que buscaba solo guías
// y temas; ahora hay UN buscador y lo comparten /buscar y la paleta.
//
// La paleta entra por `import()` al abrirla: este módulo lo baja toda
// página y tiene que seguir siendo una lupa y dos atajos.
const abrir = (texto = '') => import('./paleta.js').then((m) => m.abrirPaleta({ texto })).catch(() => {
  // Si la paleta no llega (sin red, un fallo del módulo), la búsqueda
  // grande sigue siendo una página normal.
  location.href = '/buscar.html'
})

// PRECALENTAR (874). PINGU: «el buscador a veces es lento». Se bajaba todo
// —el módulo, sus seis importaciones y la hoja— al pulsar, y eso es lo que
// se esperaba antes de ver la caja. Ahora se piden en cuanto la página está
// en reposo (y, antes si llega antes, al posar el ratón o el foco en la
// lupa), así que al abrir ya está todo en caché: la hoja puesta y el
// módulo cargado. No cuenta en el presupuesto de la portada —es un
// `import()`— y no se hace con el ahorro de datos puesto.
let calentada = false
export function calentarPaleta() {
  if (calentada) return
  calentada = true
  import('./paleta.js').catch(() => { calentada = false })
  hojaInyectada('css/buscador.css')
}
const enReposo = (f) => (globalThis.requestIdleCallback ? requestIdleCallback(f, { timeout: 4000 }) : setTimeout(f, 2500))

export function renderNavSearch() {
  const navRight = document.querySelector('.nav-right')
  const navUser = document.getElementById('nav-user')
  if (!navRight || !navUser || document.getElementById('navSearch')) return

  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
  const wrap = document.createElement('div')
  wrap.className = 'nav-search-wrap'
  wrap.id = 'navSearch'
  wrap.innerHTML = `<button type="button" class="nav-search-btn" id="navSearchBtn" aria-label="Buscar" aria-keyshortcuts="${mac ? 'Meta+K' : 'Control+K'} /" title="Buscar (${mac ? '⌘K' : 'Ctrl+K'} o /)">${icons.search(19)}</button>`
  navRight.insertBefore(wrap, navUser)
  const boton = document.getElementById('navSearchBtn')
  boton.addEventListener('click', () => abrir())
  boton.addEventListener('pointerenter', calentarPaleta)
  boton.addEventListener('focus', calentarPaleta)
  if (!navigator.connection?.saveData) {
    if (document.readyState === 'complete') enReposo(calentarPaleta)
    else window.addEventListener('load', () => enReposo(calentarPaleta), { once: true })
  }

  let g = 0
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      // Ctrl+K vale también DENTRO de un campo: es lo que hace en todas
      // partes, y no escribe nada.
      e.preventDefault()
      abrir()
      return
    }
    // Los demás atajos, solo a pelo: sin modificadores y nunca mientras se
    // escribe en un campo o en el editor (ahí una «g» es una letra).
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const donde = e.target
    if (donde && (donde.closest?.('input, textarea, select, [contenteditable]') || donde.isContentEditable)) return
    const accion = atajo(e.key, Date.now() - g < 1200)
    g = accion?.tipo === 'g' ? Date.now() : 0
    if (!accion || accion.tipo === 'g') return
    if (accion.tipo === 'buscar') {
      e.preventDefault()
      abrir()
    } else if (accion.tipo === 'ir') {
      e.preventDefault()
      location.href = accion.a
    } else if (accion.tipo === 'pulsar') {
      const b = accion.cual()
      if (!b) return
      e.preventDefault()
      b.click()
    } else if (accion.tipo === 'ayuda') {
      e.preventDefault()
      import('./atajos.js').then((m) => m.abrirAyuda()).catch(() => {})
    }
  })
}

// LOS ATAJOS (724, D6 de la lista). «G» y una letra para ir a cada
// sección, como en Gmail o GitHub; «T» el tema; «A» añadir la carta que
// tienes abierta; «/» y Ctrl+K buscar; «?» los enseña todos. Las flechas
// para pasar de carta y Esc para cerrar ya funcionaban (422 y el propio
// `<dialog>`). Va aquí, que lo baja toda página, para que la tecla actúe
// en el momento; solo la ayuda espera a cargarse.
export const SECCIONES = { i: '/index.html', n: '/noticias', a: '/aprender.html', c: '/cartas', m: '/mi-coleccion', f: '/foro.html', j: '/torneos.html', b: '/buscar.html' }

const visible = (b) => (b && !b.hidden && !b.disabled && b.getClientRects().length ? b : null)

export function atajo(tecla, trasG = false, doc = globalThis.document) {
  const k = String(tecla || '')
  if (trasG) return SECCIONES[k.toLowerCase()] ? { tipo: 'ir', a: SECCIONES[k.toLowerCase()] } : null
  if (k === 'g' || k === 'G') return { tipo: 'g' }
  if (k === '/') return { tipo: 'buscar' }
  if (k === '?') return { tipo: 'ayuda' }
  // El tema: el botón de la barra aunque en el móvil vaya escondido (la
  // hoja «Tú», 717): pulsarlo por código no necesita verlo.
  if (k === 't' || k === 'T') return { tipo: 'pulsar', cual: () => doc.getElementById('navThemeToggle') }
  // Añadir: la ficha abierta de Mi colección, o la de /carta.
  if (k === 'a' || k === 'A') return { tipo: 'pulsar', cual: () => (doc.getElementById('mcEditor')?.open ? visible(doc.getElementById('mcEdMas')) : null) || visible(doc.getElementById('cmAnadir')) }
  return null
}
