// DESEOS Y CAMBIOS, TODO HACIA ABAJO (tanda 1125, PINGU eligió la A de la
// propuesta «Todas las cartas hacia abajo», con lo recomendado: se cargan
// solas, un catálogo detrás de otro y lo mismo en las tres pestañas).
//
// La 1114 enseñaba dos filas por catálogo y «Ver las N →» al lado del
// título, que no se leía como un botón («el botoncito de ver las 190 creo
// que es pequeño»), y el orden solo ordenaba esas dos filas. Ahora es UNA
// lista: occidental y, cuando se acaba, japonés con su rótulo pegado arriba
// mientras bajas por él; arriba, «Los dos · Pokémon · Japón» para quedarse
// con uno. Al acercarse al final se trae otra tanda (48 en el PC, 24 en el
// móvil) y se AÑADE debajo, sin repintar lo de arriba.
//
// La dirección guarda el catálogo y cuántas había (`tramo=<vista>:<cat>` y
// `hasta=N`, con `replaceState`), así que volver atrás desde una carta
// deja la lista como estaba. Los enlaces de la 1114 (`tramo=…&pag=3`)
// abren ese catálogo con esas páginas ya cargadas.
import { rotuloDeCatalogo } from './rotulos-catalogo.js'
import { banderaHtml } from '../precio-vista.js'

const MOVIL = '(max-width: 599px)'
const esMovil = () => typeof matchMedia === 'function' && matchMedia(MOVIL).matches
export const porPagina = (movil = esMovil()) => (movil ? 24 : 48)
export const CATALOGOS = ['todas', 'WEST', 'JP']
const LLAVE = (vista) => `mc-lista-catalogo-${vista}`
const miles = (n) => (Number(n) || 0).toLocaleString('es-ES', { useGrouping: 'always' })

// ── La dirección y lo recordado ──
// { cat, hasta } de la dirección, o null si no habla de esta vista.
export function listaDeDireccion(vista, busqueda = typeof location === 'undefined' ? '' : location.search, pp = porPagina()) {
  const p = new URLSearchParams(busqueda)
  const [v, c] = String(p.get('tramo') || '').split(':')
  if (v !== vista) return null
  const cat = c === 'WEST' || c === 'JP' ? c : 'todas'
  const hasta = Math.floor(Number(p.get('hasta'))) || Math.floor(Number(p.get('pag'))) * pp || 0
  return { cat, hasta: Math.max(0, hasta) }
}

export function catalogoDe(vista) {
  const d = listaDeDireccion(vista)
  if (d) return d.cat
  try {
    const g = localStorage.getItem(LLAVE(vista))
    return CATALOGOS.includes(g) ? g : 'todas'
  } catch {
    return 'todas'
  }
}

export const hastaDe = (vista) => listaDeDireccion(vista)?.hasta || 0

// Lo que hay a la vista, en la dirección y sin entrada nueva en el historial:
// cargar más no es «ir a otro sitio». Lo de siempre (los dos, una tanda) no
// ensucia la dirección.
export function apuntarLista(vista, { cat = catalogoDe(vista), hasta = 0 } = {}, pp = porPagina()) {
  if (typeof location === 'undefined') return
  const url = new URL(location.href)
  url.searchParams.delete('pag')
  if (cat === 'todas' && hasta <= pp) {
    url.searchParams.delete('tramo')
    url.searchParams.delete('hasta')
  } else {
    url.searchParams.set('tramo', `${vista}:${cat}`)
    if (hasta > pp) url.searchParams.set('hasta', String(hasta))
    else url.searchParams.delete('hasta')
  }
  if (url.href !== location.href) history.replaceState(history.state, '', url)
}

export function elegirCatalogo(vista, cat) {
  try { localStorage.setItem(LLAVE(vista), cat) } catch { /* sin almacenamiento: vale para esta visita */ }
  apuntarLista(vista, { cat, hasta: 0 })
}

// El orden de la lista: occidental y japonés, o el elegido. `totales`:
// { WEST, JP }. Un catálogo vacío no entra.
export function ordenDe(totales, cat) {
  return ['WEST', 'JP'].filter((m) => (cat === 'todas' || cat === m) && (Number(totales[m]) || 0) > 0).map((m) => [m, Number(totales[m]) || 0])
}

// «Los dos · Pokémon · Japón», con sus cuentas: una fila entera de la
// rejilla. Solo si los dos catálogos tienen algo.
export function selectorDeCatalogoHtml(vista, totales, cat) {
  const w = Number(totales.WEST) || 0
  const j = Number(totales.JP) || 0
  if (!w || !j) return ''
  const b = (v, texto, n, bandera = '') => `<button type="button" data-lista-cat="${v}" data-lista-vista="${vista}" aria-pressed="${cat === v}">${bandera}<span>${texto}</span> <small>${miles(n)}</small></button>`
  return `<div class="mc-seg mc-seg-sueltas mc-lista-cats" role="group" aria-label="Catálogo">${b('todas', 'Los dos', w + j)}${b('WEST', 'Pokémon', w, banderaHtml('en'))}${b('JP', 'Japón', j, banderaHtml('ja'))}</div>`
}

// El catálogo tocado en el selector, o undefined si el clic no era suyo.
export function catalogoDelClic(e) {
  const b = e.target.closest?.('[data-lista-cat]')
  return b ? { vista: b.dataset.listaVista, cat: b.dataset.listaCat } : undefined
}

// ── La lista que crece ──
// `orden`: [[mercado, total], …]. `pedir(m, desde, cuantas)` devuelve las
// filas (de la base en el Mercado, un trozo del arreglo en las otras dos).
// `cargadas`: lo que ya hay, para repintar sin volver a pedir.
const vivas = new Map()
let enganchado = false
function enganchar() {
  if (enganchado || typeof document === 'undefined') return
  enganchado = true
  // «Ver más» y «Volver a intentarlo», por si el navegador no avisa al
  // llegar abajo o algo falló.
  document.addEventListener('click', (e) => {
    const b = e.target.closest?.('[data-lista-mas-boton]')
    if (!b) return
    const l = vivas.get(b.closest('[data-lista-mas]')?.dataset.listaMas)
    if (l) void l.mas()
  })
}

export function listaQueCrece({ vista, orden, pedir, pintar, cargadas = {}, pp = porPagina(), alCrecer = null }) {
  enganchar()
  const total = Object.fromEntries(orden)
  const hechas = Object.fromEntries(orden.map(([m]) => [m, [...(cargadas[m] || [])]]))
  const conRotulo = orden.length > 1
  let pidiendo = null
  let fallo = false
  let observador = null
  let centinela = null
  let muerta = false

  const contadas = () => orden.reduce((n, [m]) => n + hechas[m].length, 0)
  const quedan = () => orden.some(([m]) => hechas[m].length < total[m])
  // El rótulo se queda pegado arriba mientras bajas por su catálogo.
  const rotulo = (m) => (conRotulo ? rotuloDeCatalogo(m, total[m]).replace('class="mc-catalogo-rotulo"', 'class="mc-catalogo-rotulo mc-rotulo-pegado"') : '')
  const pieHtml = () => {
    if (fallo) return `<div class="mc-lista-mas" data-lista-mas="${vista}"><p>No se han podido traer más.</p><button type="button" class="btn-secondary" data-lista-mas-boton>Volver a intentarlo</button></div>`
    if (quedan()) return `<div class="mc-lista-mas" data-lista-mas="${vista}" aria-live="polite"><span class="mc-lista-cargando" aria-hidden="true"><i></i><i></i><i></i></span><button type="button" class="btn-secondary" data-lista-mas-boton>Ver más</button></div>`
    const n = contadas()
    return n > pp ? `<p class="mc-lista-fin" data-lista-mas="${vista}">Ya están todas · ${miles(n)}</p>` : ''
  }

  function html() {
    let s = ''
    for (const [m] of orden) if (hechas[m].length) s += rotulo(m) + hechas[m].map(pintar).join('')
    return s + pieHtml()
  }

  function armar(raiz) {
    observador?.disconnect()
    if (muerta) return
    centinela = raiz?.querySelector?.(`[data-lista-mas="${vista}"]`) || null
    if (!centinela || fallo || !quedan() || typeof IntersectionObserver === 'undefined') return
    // Antes de llegar: con 800 px de margen, la tanda siguiente ya está al
    // asomarse el final. Si después de añadir sigue a la vista (pantallas
    // altas), el observador vuelve a avisar y se trae otra.
    observador = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) void mas() }, { rootMargin: '0px 0px 800px 0px' })
    observador.observe(centinela)
    // Con el observador puesto, «Ver más» sobra: llega sola.
    centinela.classList.add('sola')
  }

  async function mas(n = pp) {
    if (pidiendo || muerta) return pidiendo
    pidiendo = (async () => {
      let trozo = ''
      let quiere = n
      fallo = false
      centinela?.classList.add('trayendo')
      try {
        for (const [m] of orden) {
          if (quiere <= 0) break
          const ya = hechas[m].length
          if (ya >= total[m]) continue
          const nuevas = await pedir(m, ya, Math.min(quiere, total[m] - ya))
          if (muerta) return
          // La base dice que no hay más (alguien ha quitado cartas mientras
          // bajabas): ese catálogo se da por acabado, sin quedarse pidiendo.
          if (!nuevas?.length) { total[m] = ya; continue }
          if (!ya) trozo += rotulo(m)
          hechas[m].push(...nuevas)
          trozo += nuevas.map(pintar).join('')
          quiere -= nuevas.length
        }
      } catch {
        fallo = true
      }
      if (muerta || !centinela?.isConnected) return
      const padre = centinela.parentElement
      centinela.insertAdjacentHTML('beforebegin', trozo)
      centinela.insertAdjacentHTML('beforebegin', pieHtml())
      centinela.remove()
      armar(padre)
      apuntarLista(vista, { hasta: contadas() }, pp)
      alCrecer?.(cargadasAhora())
    })().finally(() => { pidiendo = null })
    return pidiendo
  }

  const cargadasAhora = () => Object.fromEntries(orden.map(([m]) => [m, hechas[m]]))
  const lista = {
    html, armar, mas, contadas, quedan,
    cargadas: cargadasAhora,
    morir() { muerta = true; observador?.disconnect(); if (vivas.get(vista) === lista) vivas.delete(vista) },
  }
  vivas.get(vista)?.morir()
  vivas.set(vista, lista)
  return lista
}

// Para La quiero y Las que doy, que tienen la lista entera en el navegador:
// pinta las `hasta` primeras (o una tanda) y deja la lista lista para crecer
// en cuanto el HTML esté puesto (`armarLista(vista, caja)`).
export function listaLocalHtml({ vista, items, mercadoDe, pintar, totales = null, alCrecer = null }) {
  const por = { WEST: [], JP: [] }
  for (const x of items) por[mercadoDe(x) === 'JP' ? 'JP' : 'WEST'].push(x)
  const cuentas = totales || { WEST: por.WEST.length, JP: por.JP.length }
  let cat = catalogoDe(vista)
  // Un catálogo elegido que se ha quedado vacío: los dos.
  if (cat !== 'todas' && !cuentas[cat]) cat = 'todas'
  const orden = ordenDe({ WEST: por.WEST.length, JP: por.JP.length }, cat)
  const pp = porPagina()
  const quiero = Math.max(pp, hastaDe(vista))
  const cargadas = {}
  let resto = quiero
  for (const [m] of orden) {
    cargadas[m] = por[m].slice(0, Math.max(0, resto))
    resto -= cargadas[m].length
  }
  const lista = listaQueCrece({ vista, orden, pp, cargadas, pintar, alCrecer, pedir: async (m, desde, n) => por[m].slice(desde, desde + n) })
  return { lista, html: `${selectorDeCatalogoHtml(vista, cuentas, cat)}${lista.html()}` }
}
