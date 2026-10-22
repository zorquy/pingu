// PRECARGAR AL POSAR EL DEDO (723, X17 de la lista). Entre que el dedo toca
// un enlace y lo suelta pasan unos 100 ms, y en el ordenador entre que el
// ratón se posa y hace clic, bastante más: se aprovecha para pedir ya la
// página, y al soltar se abre desde la caché.
//
// Dos caminos. Donde el navegador entiende las «reglas de especulación»
// (Chrome), se le dice cuáles se pueden precargar y él decide cuándo
// —`moderate` es justo «al posarse»—. Donde no (Safari, Firefox), se hace a
// mano: un `<link rel="prefetch">` al tocar o al posar el ratón un rato.
//
// Solo lo del propio sitio y solo páginas: nada de /admin, /auth (abrir el
// formulario de entrar no es entrar, pero mejor no), descargas ni enlaces
// que se abren fuera. Y nada con «ahorro de datos» puesto.
//
// Desde la 985 (D y E de «Rápida al volver»), tres cosas más:
// · En Chrome, las páginas de LISTA se preparan ENTERAS (`prerender`): al
//   soltar el dedo la página ya está pintada. Solo listas que solo leen al
//   abrirse (una ficha de carta pide precios de pago; un tema se marca como
//   leído); y lo que escribe en la base espera a que la página se abra de
//   verdad (js/espera-prerender.js). Lo demás, como antes, `prefetch`.
// · En todos (el iPhone incluido, que no entiende ni las reglas ni el
//   `prefetch`), se le pide al service worker que baje la página Y sus
//   ficheros: al soltar, salen de su caché.
// · Tras la primera visita, con el teléfono quieto y SOLO EN WIFI (PINGU),
//   se guardan de antemano las secciones de la barra de abajo, una vez por
//   semana. Sin forma de saber si es wifi (Safari no lo dice), no se guarda.
// Y la baja del correo (818): es un GET que HACE algo.
const NUNCA = ['/admin', '/auth', '/.netlify/', '/reset-password', '/baja-correo']

export function sePuedePrecargar(href, origen = location.origin, aqui = location.href) {
  let u
  try {
    u = new URL(href, aqui)
  } catch {
    return false
  }
  if (u.origin !== origen || !/^https?:$/.test(u.protocol)) return false
  if (NUNCA.some((p) => u.pathname.startsWith(p))) return false
  // La misma página con otra almohadilla no es otra página.
  const actual = new URL(aqui)
  if (u.pathname === actual.pathname && u.search === actual.search) return false
  return !/\.(png|jpe?g|webp|svg|pdf|csv|zip|mp4|json)$/i.test(u.pathname)
}

// Las páginas que Chrome puede preparar enteras (985): listas que solo leen.
export const PREPARABLES = ['/', '/index.html', '/aprender', '/noticias', '/foro', '/torneos', '/meta', '/cartas', '/mi-coleccion', '/lanzamientos', '/retos', '/mazos', '/mis-partidas', '/perfil', '/usuarios', '/glosario', '/novedades']
// Las de la barra de abajo, para guardarlas de antemano en wifi (985).
export const SECCIONES = ['/', '/aprender.html', '/foro.html', '/torneos.html', '/cartas', '/mi-coleccion']
const CLAVE_SECCIONES = 'pokedoc-secciones-guardadas'
const SEMANA = 7 * 24 * 60 * 60 * 1000

const patron = (r) => ({ href_matches: { pathname: r === '/' || r.endsWith('.html') ? r : `${r}{.html}?` } })
export function reglasDeEspeculacion() {
  const fuera = NUNCA.map((p) => ({ not: { href_matches: `${p}*` } }))
  return {
    prerender: [{ where: { or: PREPARABLES.map(patron) }, eagerness: 'moderate' }],
    prefetch: [{ where: { and: [{ href_matches: '/*' }, ...fuera, { not: { or: PREPARABLES.map(patron) } }] }, eagerness: 'moderate' }],
  }
}

// ¿Toca guardar las secciones? Solo en wifi (o cable), sin ahorro de datos,
// una vez por semana.
export function tocaGuardarSecciones(conexion, ultima, ahora = Date.now()) {
  if (!conexion || conexion.saveData) return false
  if (conexion.type !== 'wifi' && conexion.type !== 'ethernet') return false
  return !(ultima && ahora - Number(ultima) < SEMANA)
}

export function montarPrecarga(doc = document, win = window) {
  if (win.navigator?.connection?.saveData) return
  const alWorker = (paginas) => win.navigator?.serviceWorker?.controller?.postMessage({ tipo: 'precargar', paginas })
  const conReglas = !!win.HTMLScriptElement?.supports?.('speculationrules')
  if (conReglas) {
    const reglas = doc.createElement('script')
    reglas.type = 'speculationrules'
    reglas.textContent = JSON.stringify(reglasDeEspeculacion())
    doc.head.appendChild(reglas)
  }
  const hechas = new Set()
  const precargar = (a) => {
    const href = a?.href
    if (!href || hechas.has(href) || a.target === '_blank' || a.hasAttribute('download') || !sePuedePrecargar(href)) return
    hechas.add(href)
    // La página y sus ficheros, a la caché del worker (también en el iPhone).
    const u = new URL(href)
    alWorker([u.pathname + u.search])
    if (conReglas) return
    const l = doc.createElement('link')
    l.rel = 'prefetch'
    l.href = href
    doc.head.appendChild(l)
  }
  doc.addEventListener('touchstart', (e) => precargar(e.target.closest?.('a[href]')), { passive: true, capture: true })
  let espera = null
  doc.addEventListener('mouseover', (e) => {
    const a = e.target.closest?.('a[href]')
    clearTimeout(espera)
    if (a) espera = win.setTimeout(() => precargar(a), 80)
  }, { passive: true })

  let ultima = null
  try { ultima = win.localStorage.getItem(CLAVE_SECCIONES) } catch {}
  if (!tocaGuardarSecciones(win.navigator?.connection, ultima)) return
  const guardar = () => {
    if (!win.navigator?.serviceWorker?.controller) return
    alWorker(SECCIONES)
    try { win.localStorage.setItem(CLAVE_SECCIONES, String(Date.now())) } catch {}
  }
  if ('requestIdleCallback' in win) win.requestIdleCallback(guardar, { timeout: 8000 })
  else win.setTimeout(guardar, 4000)
}
