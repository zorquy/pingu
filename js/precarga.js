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
const NUNCA = ['/admin', '/auth', '/.netlify/', '/reset-password']

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

export function montarPrecarga(doc = document, win = window) {
  if (win.navigator?.connection?.saveData) return
  if (win.HTMLScriptElement?.supports?.('speculationrules')) {
    const reglas = doc.createElement('script')
    reglas.type = 'speculationrules'
    reglas.textContent = JSON.stringify({
      prefetch: [{
        where: { and: [{ href_matches: '/*' }, ...NUNCA.map((p) => ({ not: { href_matches: `${p}*` } }))] },
        eagerness: 'moderate',
      }],
    })
    doc.head.appendChild(reglas)
    return
  }
  const hechas = new Set()
  const precargar = (a) => {
    const href = a?.href
    if (!href || hechas.has(href) || a.target === '_blank' || a.hasAttribute('download') || !sePuedePrecargar(href)) return
    hechas.add(href)
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
}
