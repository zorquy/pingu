// DESEOS Y CAMBIOS POR PÁGINAS (tanda 1114, PINGU eligió la A de la
// propuesta «El Mercado por páginas», y «sí, haz lo mismo» en La quiero y
// Las que doy).
//
// Antes cada catálogo era un tramo largo (60 en el Mercado, todas en las
// otras dos) y el «Ver más» del Mercado, debajo del japonés, traía 60 más de
// LOS DOS: las occidentales nuevas caían arriba, fuera de la vista, y el
// botón parecía solo del japonés. Ahora:
//   · el ESCAPARATE: de cada catálogo, lo que cabe en dos filas, y en su
//     rótulo «Ver las N →»;
//   · un TRAMO: ese catálogo entero, por páginas (48 en el PC, 24 en el
//     móvil), con el paginador del foro arriba y abajo y «← Todas».
// El tramo va en la dirección (`tramo=<vista>:<WEST|JP>&pag=N`), así que
// «atrás» vuelve donde estabas y se puede mandar la página 3. Cada vista
// solo lee el suyo: `?catalogo=` ya era otra cosa (la 656).
import { paginacionHtml } from '../paginacion.js'
import { rotuloDeCatalogo, porCatalogo } from './rotulos-catalogo.js'
import { icons } from '../icons.js'

export const FILAS_ESCAPARATE = 2
const MOVIL = '(max-width: 599px)'
const esMovil = () => typeof matchMedia === 'function' && matchMedia(MOVIL).matches
export const porPagina = (movil = esMovil()) => (movil ? 24 : 48)

// Cuántas columnas tiene la rejilla de baldosas (`.mc-mercado-rejilla`:
// tres en el móvil; en el PC, `auto-fill` de 140 px con 12 de hueco) al
// ancho de `caja`. Se mide la caja y no la rejilla: la rejilla se vuelve a
// crear en cada pintado y la primera vez todavía no existe.
export function columnasPara(ancho, movil = esMovil()) {
  if (movil) return 3
  return Math.max(1, Math.floor((Number(ancho) + 12) / (140 + 12)))
}
export const enEscaparate = (caja, movil = esMovil()) => FILAS_ESCAPARATE * columnasPara(caja?.clientWidth || 1000, movil)

// ── La dirección ──
export function tramoDeDireccion(vista, busqueda = location.search) {
  const p = new URLSearchParams(busqueda)
  const [v, m] = String(p.get('tramo') || '').split(':')
  if (v !== vista || !['WEST', 'JP'].includes(m)) return null
  return { market: m, pagina: Math.max(1, Math.floor(Number(p.get('pag'))) || 1) }
}
export function irATramo(vista, tramo, { push = true } = {}) {
  const url = new URL(location.href)
  if (tramo) {
    url.searchParams.set('tramo', `${vista}:${tramo.market}`)
    if (tramo.pagina > 1) url.searchParams.set('pag', String(tramo.pagina))
    else url.searchParams.delete('pag')
  } else {
    url.searchParams.delete('tramo')
    url.searchParams.delete('pag')
  }
  if (url.href === location.href) return
  if (push) history.pushState(null, '', url)
  else history.replaceState(null, '', url)
}

// ── Lo que se pinta (puro: la rejilla lo mete en su HTML) ──

// El rótulo del escaparate: el de siempre y, si hay más de las que se ven,
// «Ver las N →».
export function rotuloConVerHtml(m, total, vistas) {
  const n = Number(total) || 0
  const ver = n > vistas ? `<button type="button" class="mc-tramo-ver" data-tramo-ver="${m}">Ver ${n === 1 ? 'la' : 'las'} ${n.toLocaleString('es-ES', { useGrouping: 'always' })} ${icons.chevronRight(14)}</button>` : ''
  return rotuloDeCatalogo(m, n).replace('</h3>', `${ver}</h3>`)
}

// Arriba de un tramo: «← Todas», su rótulo y el paginador.
export function cabeceraDeTramoHtml(m, total, pagina, paginas) {
  return `<div class="mc-tramo-cab"><button type="button" class="mc-tramo-volver" data-tramo-volver aria-label="Volver a los dos catálogos">${icons.chevronRight(16)}<span>Todas</span></button>${rotuloDeCatalogo(m, total)}</div>${paginacionHtml(pagina, paginas, { arriba: true })}`
}
export const pieDeTramoHtml = (pagina, paginas) => paginacionHtml(pagina, paginas)

export const paginasDe = (total, pp = porPagina()) => Math.max(1, Math.ceil((Number(total) || 0) / pp))

// Una lista que ya está entera en el navegador (La quiero, Las que doy):
// escaparate o tramo, con los mismos rótulos que `conRotulos`.
// Devuelve { html, tramo } (el tramo con la página ya ajustada al total).
export function tramosHtml({ vista, items, mercadoDe, pintar, caja, busqueda, movil = esMovil() }) {
  const tramos = porCatalogo(items, mercadoDe)
  const pedido = tramoDeDireccion(vista, busqueda)
  const enUno = pedido && tramos.find(([m]) => m === pedido.market)
  if (enUno) {
    const lista = enUno[1]
    const pp = porPagina(movil)
    const paginas = paginasDe(lista.length, pp)
    const pagina = Math.min(pedido.pagina, paginas)
    const trozo = lista.slice((pagina - 1) * pp, pagina * pp)
    return { tramo: { market: pedido.market, pagina }, html: `${cabeceraDeTramoHtml(pedido.market, lista.length, pagina, paginas)}${trozo.map(pintar).join('')}${pieDeTramoHtml(pagina, paginas)}` }
  }
  const caben = enEscaparate(caja, movil)
  // Un catálogo que cabe entero: como antes, sin rótulo.
  if (tramos.length < 2 && items.length <= caben) return { tramo: null, html: items.map(pintar).join('') }
  return { tramo: null, html: tramos.map(([m, l]) => `${rotuloConVerHtml(m, l.length, Math.min(caben, l.length))}${l.slice(0, caben).map(pintar).join('')}`).join('') }
}

// Lo que se toca: «Ver las N», «← Todas» y las páginas. Devuelve el tramo
// nuevo (o `null` para volver al escaparate) o `undefined` si no era nuestro.
export function tramoDelClic(e, actual) {
  const ver = e.target.closest('[data-tramo-ver]')
  if (ver) return { market: ver.dataset.tramoVer, pagina: 1 }
  if (e.target.closest('[data-tramo-volver]')) return null
  const p = e.target.closest('.paginacion [data-pagina]')
  if (p && actual) return { market: actual.market, pagina: Number(p.dataset.pagina) || 1 }
  return undefined
}

// Al cambiar de página, la vista sube a lo de arriba del tramo.
export function subirA(el) {
  if (!el) return
  const arriba = el.getBoundingClientRect().top + scrollY - 96
  if (arriba < scrollY) scrollTo({ top: Math.max(0, arriba), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
}
