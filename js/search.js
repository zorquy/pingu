// /buscar: UN buscador para todo (718, N2). Busca a la vez en las cartas
// —con su foto y su precio—, las guías, el foro y la gente, agrupado; con
// las búsquedas de antes a mano y el escáner al lado de la caja. El motor
// es `js/buscador.js`, el mismo de la paleta de Ctrl+K.
import { icons } from './icons.js'
import { escapeHtml } from './html.js'
import { GRUPOS, buscarTodo, todoVacio, recordarBusqueda, leerRecientes, olvidarRecientes, olvidarReciente } from './buscador.js'
import { loQueAcabaDeSalir, ultimosDeseos } from './buscar-antes.js'
import { destinoDe, interiorDe, engancharFotos, baldosaDe } from './buscador-filas.js'
import { cuentaDeGrupo, esPersona, sugerenciasDeNombres, trozosDeSugerencia, EJEMPLOS_DE_BUSQUEDA } from './buscador-puro.js'
import { supabase } from './supabase.js'

const $ = (id) => document.getElementById(id)
const input = $('searchInput')
const resultados = $('searchResults')
const recientes = $('bsRecientes')
const NOMBRE = Object.fromEntries(GRUPOS)
const EN_TODO = 4
const EN_UNO = 24

$('bsLupa').innerHTML = icons.search(20)

const params = new URLSearchParams(location.search)
let grupo = NOMBRE[params.get('en')] ? params.get('en') : ''
input.value = params.get('q') || ''
// B5 (972): las cartas se buscan en UNA pantalla, Cartas › Buscar. Un enlace
// viejo a /buscar?en=cartas lleva allí con lo escrito.
const enCartas = (q) => `/cartas?ver=buscar&q=${encodeURIComponent(q)}`
if (grupo === 'cartas') location.replace(input.value.trim() ? enCartas(input.value.trim()) : '/cartas?ver=buscar')
let secuencia = 0
let temporizador = null

function pintarChips() {
  for (const b of document.querySelectorAll('#bsChips [data-grupo]')) b.setAttribute('aria-pressed', String(b.dataset.grupo === grupo))
}

// La dirección lleva lo que se busca: se puede compartir y volver atrás
// deja la búsqueda puesta.
function apuntarEnLaDireccion(q) {
  const p = new URLSearchParams()
  if (q) p.set('q', q)
  if (grupo) p.set('en', grupo)
  const nueva = `${location.pathname}${p.toString() ? `?${p}` : ''}`
  if (nueva !== location.pathname + location.search) history.replaceState(null, '', nueva)
}

// ANTES DE ESCRIBIR (B2, 1147; PINGU: «dale»). La página vacía era una
// pantalla negra: ahora, lo que buscaste (en chips, cada uno con su ×), la
// expansión que acaba de salir, ejemplos que funcionan y, con cuenta, tus
// últimas de «La quiero». Lo que llega de la red se pinta cuando llega, en
// su hueco, y si no se puede saber, su bloque no sale.
let antesVersion = 0
function pintarRecientes() {
  const v = ++antesVersion
  if (input.value.trim()) { recientes.innerHTML = ''; return }
  const lista = leerRecientes()
  recientes.innerHTML = `<div class="bs-antes">
    ${lista.length ? `<section class="bs-antes-bloque"><p class="bs-seccion">Lo que buscaste<button type="button" class="bs-borrar" id="bsOlvidar">Borrar</button></p>
      <div class="bs-antes-chips">${lista.map((t) => `<span class="bs-reciente-chip"><button type="button" class="bs-reciente" data-reciente="${escapeHtml(t)}">${icons.clock(14)}<span>${escapeHtml(t)}</span></button><button type="button" class="bs-reciente-x" data-quitar="${escapeHtml(t)}" aria-label="Quitar «${escapeHtml(t)}»">${icons.x(14)}</button></span>`).join('')}</div></section>` : ''}
    <section class="bs-antes-bloque" id="bsAcaba" hidden></section>
    <section class="bs-antes-bloque"><p class="bs-seccion">Prueba con</p>
      <div class="bs-antes-chips">${EJEMPLOS_DE_BUSQUEDA.map((t) => `<button type="button" class="chip-filtro bs-ejemplo" data-ejemplo="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('')}</div></section>
    <section class="bs-antes-bloque" id="bsDeseos" hidden></section>
  </div>`
  loQueAcabaDeSalir().then((set) => {
    const caja = $('bsAcaba')
    if (v !== antesVersion || !caja || !set) return
    caja.innerHTML = `<p class="bs-seccion">Acaba de salir</p>${fila('expansiones', set)}`
    caja.hidden = false
  }).catch(() => {})
  supabase.auth.getSession().then(({ data }) => ultimosDeseos(data?.session?.user?.id)).then((cartas) => {
    const caja = $('bsDeseos')
    if (v !== antesVersion || !caja || !cartas?.length) return
    caja.innerHTML = `<p class="bs-seccion">Tus deseos<a class="bs-borrar" href="/mi-coleccion?ver=deseos">Ver todos</a></p><div class="bs-rejilla">${cartas.map((c) => baldosaDe(c)).join('')}</div>`
    caja.hidden = false
    import('./marcas-carta.js').then((m) => m.marcarCartas(caja)).catch(() => {})
  }).catch(() => {})
}

// TE LO COMPLETA (B3, 1147): encima de los resultados, los nombres de carta
// que completan lo escrito, sacados de la misma respuesta. Tocar uno lo
// busca; la flecha lo copia a la caja sin buscar, para seguir escribiendo.
// Va EN la página y no flotando: un desplegable tapaba los filtros y el
// primer resultado, y esconderlo al perder el foco movía la página justo
// cuando el dedo bajaba a un resultado. Sale mientras se escribe y se va
// al elegir, al buscar con Intro o al tocar otra cosa que busca.
let escribiendo = false
const sugerencias = document.createElement('div')
sugerencias.className = 'bs-sugerencias'
sugerencias.id = 'bsSugerencias'
sugerencias.hidden = true
sugerencias.setAttribute('role', 'listbox')
sugerencias.setAttribute('aria-label', 'Sugerencias')
let ultimoElegido = ''
function pintarSugerencias(q, nombres) {
  const lista = escribiendo && q && q !== ultimoElegido ? sugerenciasDeNombres(nombres, q) : []
  sugerencias.innerHTML = lista.map((n) => {
    const [a, b, c] = trozosDeSugerencia(n, q)
    return `<div class="bs-sug" role="option"><button type="button" class="bs-sug-ir" data-sug="${escapeHtml(n)}">${icons.search(14)}<span><b>${escapeHtml(a)}</b><span class="bs-sug-tuyo">${escapeHtml(b)}</span><b>${escapeHtml(c)}</b></span></button><button type="button" class="bs-sug-copiar" data-copiar="${escapeHtml(n)}" aria-label="Completar con «${escapeHtml(n)}»" title="Completar">${icons.arrowUpLeft(16)}</button></div>`
  }).join('')
  sugerencias.hidden = !lista.length
}
sugerencias.addEventListener('mousedown', (e) => e.preventDefault())
sugerencias.addEventListener('click', (e) => {
  const ir = e.target.closest('[data-sug]')
  const copiar = e.target.closest('[data-copiar]')
  if (ir) {
    input.value = ir.dataset.sug
    ultimoElegido = input.value
    escribiendo = false
    recordarBusqueda(input.value)
    sugerencias.hidden = true
    input.blur()
    buscar()
  } else if (copiar) {
    input.value = `${copiar.dataset.copiar} `
    input.focus()
    buscar()
  }
})

function seccion(g, estado, q) {
  if (estado.error) {
    return `<section class="bs-grupo"><h2 class="bs-seccion">${NOMBRE[g]}</h2>
      <p class="bs-aviso">No se ha podido buscar en ${NOMBRE[g].toLowerCase()}. <button type="button" class="link-btn" data-reintentar>Reintentar</button></p></section>`
  }
  const japon = g === 'cartas' ? lineaDeJapon(estado, q) : ''
  const lista = g === 'cartas' ? estado.filas.filter((f) => f !== estado.mejor) : estado.filas
  if (!lista.length && !japon) {
    // En «Todo» un grupo sin nada no sale; si es el único que se mira,
    // sí: «ninguna carta» es la respuesta.
    return grupo ? `<p class="empty-state">Nada en ${NOMBRE[g].toLowerCase()} con «${escapeHtml(q)}».</p>` : ''
  }
  // En «Todo», las cartas en una rejilla de fotos (1146, W2).
  const filas = g === 'cartas' && !grupo && lista.length ? `<div class="bs-rejilla">${lista.map((f) => baldosaDe(f, q)).join('')}</div>` : lista.map((f) => fila(g, f, '', q)).join('')
  const mas = g === 'productos' ? masProductos(estado, q) : grupo ? '' : g === 'cartas' ? masCartas(estado, q) : estado.filas.length >= EN_TODO ? `<button type="button" class="bs-mas" data-ver="${g}">Ver más ${g === 'gente' ? 'gente' : NOMBRE[g].toLowerCase()}</button>` : ''
  // Las cartas: primero «Ver todas» en grande y DESPUÉS el japonés, en
  // pequeño (PINGU: «lo japonés es secundario»).
  return `<section class="bs-grupo"><h2 class="bs-seccion">${NOMBRE[g]}</h2>${filas}${mas}${japon}</section>`
}

const fila = (g, f, extra = '', q = '') => `<a class="bs-fila bs-${g}${extra}" href="${escapeHtml(destinoDe(g, f, q))}">${interiorDe(g, f)}</a>`

// B2 (972): la carta que lo escrito señala, arriba y en grande.
const mejorHtml = (estado, q = '') => (estado?.mejor ? `<section class="bs-grupo"><h2 class="bs-seccion">Lo más probable</h2>${fila('cartas', estado.mejor, ' bs-mejor', q)}</section>` : '')

// B3 (972): cuántas hay en el catálogo japonés, a Cartas › Buscar allí.
function lineaDeJapon(estado, q) {
  const j = estado.japon
  if (!j?.total) return ''
  return `<a class="bs-fila bs-japon" href="/cartas?catalogo=JP&amp;ver=buscar&amp;q=${encodeURIComponent(q)}"><span class="bs-texto">También en Pokémon Japón</span><span class="bs-japon-n">${j.hayMas ? `${j.total}+` : j.total} ${j.total === 1 ? 'carta' : 'cartas'} ›</span></a>`
}

// En «Todo» salen las cuatro de la expansión más nueva y el botón dice
// cuántas hay (909): «Ver más» de 4 cuando son 62 se quedaba corto. Y lleva
// DIRECTO a Cartas › Buscar con la búsqueda puesta (968, Sergio: eran tres
// pasos —«Ver todo», la chapa Cartas y «Verlas en Cartas»— para llegar a
// la misma pantalla que buscar allí).
function masCartas(estado, q) {
  // Con más de tres también: en el móvil se ven tres y la cuarta va aquí.
  if (estado.total <= Math.min(3, estado.filas.length)) return ''
  const texto = estado.hayMas ? 'Ver todas las cartas' : `Ver las ${estado.total} cartas`
  return `<a class="bs-mas bs-mas-cartas" href="${escapeHtml(enCartas(q))}">${texto}</a>`
}

// Los productos (968): «Ver más» lleva a la pestaña Productos de Cartas con
// la búsqueda puesta, que tiene su buscador y sus fichas.
function masProductos(estado, q) {
  if (!estado.hayMas) return ''
  return `<a class="bs-mas" href="/cartas?ver=productos&amp;q=${encodeURIComponent(q)}">Ver más productos</a>`
}

// B4 (972): cuántos hay en cada grupo, en su chapa. Se cuentan en «Todo» y
// se quedan mientras lo escrito no cambie.
let cuentas = { q: '', n: {} }
function pintarCuentas(q, r) {
  if (q !== cuentas.q) cuentas = { q, n: {} }
  if (!grupo) for (const [g] of GRUPOS) cuentas.n[g] = cuentaDeGrupo(r[g], g === 'cartas' ? null : EN_TODO)
  for (const b of document.querySelectorAll('#bsChips [data-grupo]')) {
    const g = b.dataset.grupo
    let n = b.querySelector('.bs-chip-n')
    const valor = g && cuentas.n[g] && cuentas.n[g] !== '0' ? cuentas.n[g] : ''
    if (!valor) { n?.remove(); continue }
    if (!n) { n = document.createElement('span'); n.className = 'bs-chip-n'; b.appendChild(n) }
    n.textContent = valor
  }
}

async function buscar() {
  const q = input.value.trim()
  const mia = ++secuencia
  apuntarEnLaDireccion(q)
  pintarRecientes()
  if (q.length < 2) {
    sugerencias.hidden = true
    resultados.innerHTML = q ? '<p class="empty-state">Escribe al menos dos letras.</p>' : ''
    return
  }
  resultados.classList.add('bs-cargando')
  const grupos = grupo ? [grupo] : GRUPOS.map(([g]) => g)
  const r = await buscarTodo(q, { limite: grupo ? EN_UNO : EN_TODO, grupos })
  if (mia !== secuencia) return
  resultados.classList.remove('bs-cargando')
  // Solo los grupos que se han preguntado: con «@» delante, la gente (B6).
  const preguntados = GRUPOS.map(([g]) => g).filter((g) => r[g])
  resultados.innerHTML = todoVacio(r)
    ? `<p class="empty-state">Nada con «${escapeHtml(q)}». Prueba con menos letras o con otra palabra.</p>`
    : grupo
      ? preguntados.map((g) => seccion(g, r[g], q)).join('')
      : // En «Todo», dos columnas en el PC (1146): las cartas a la izquierda,
        // lo demás a la derecha; en el móvil, una debajo de otra.
        `<div class="bs-todo"><div class="bs-col">${mejorHtml(r.cartas, q)}${['cartas', 'productos', 'expansiones'].filter((g) => r[g]).map((g) => seccion(g, r[g], q)).join('')}</div><div class="bs-col">${preguntados.filter((g) => !['cartas', 'productos', 'expansiones'].includes(g)).map((g) => seccion(g, r[g], q)).join('')}</div></div>`
  if (!esPersona(q)) pintarCuentas(q, r)
  resultados.prepend(sugerencias)
  pintarSugerencias(q, r.cartas?.nombres || [])
  // El punto verde de quien está en línea (1140), también aquí.
  if (r.gente?.filas?.length) import('./en-linea.js').then((m) => m.marcarEnLinea(resultados)).catch(() => {})
  // «La tienes» y «La quieres» en cada carta (943).
  import('./marcas-carta.js').then((m) => m.marcarCartas(resultados)).catch(() => {})
}

input.addEventListener('input', () => {
  escribiendo = true
  clearTimeout(temporizador)
  temporizador = setTimeout(buscar, 250)
})
$('bsForm').addEventListener('submit', (e) => {
  e.preventDefault()
  ultimoElegido = input.value.trim()
  escribiendo = false
  sugerencias.hidden = true
  recordarBusqueda(input.value)
  input.blur()
  buscar()
})
$('bsChips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-grupo]')
  if (!b) return
  // B5: las cartas, en Cartas › Buscar.
  if (b.dataset.grupo === 'cartas') {
    const q = input.value.trim()
    if (q) recordarBusqueda(q)
    location.href = q ? enCartas(q) : '/cartas?ver=buscar'
    return
  }
  grupo = b.dataset.grupo
  pintarChips()
  buscar()
})
recientes.addEventListener('click', (e) => {
  if (e.target.closest('#bsOlvidar')) {
    olvidarRecientes()
    pintarRecientes()
    return
  }
  const quitar = e.target.closest('[data-quitar]')
  if (quitar) {
    olvidarReciente(quitar.dataset.quitar)
    pintarRecientes()
    return
  }
  const r = e.target.closest('[data-reciente], [data-ejemplo]')
  if (!r) return
  input.value = r.dataset.reciente || r.dataset.ejemplo
  ultimoElegido = input.value
  escribiendo = false
  buscar()
})
resultados.addEventListener('click', (e) => {
  const ver = e.target.closest('[data-ver]')
  if (ver) {
    grupo = ver.dataset.ver
    pintarChips()
    buscar()
    window.scrollTo({ top: 0, behavior: 'instant' })
    return
  }
  if (e.target.closest('[data-reintentar]')) return void buscar()
  // Lo que se abre se recuerda: es lo que de verdad se estaba buscando.
  if (e.target.closest('.bs-fila')) recordarBusqueda(input.value)
})
engancharFotos(resultados)

pintarChips()
buscar()

// UNA SOLA CAJA EN EL PC (B1, 1147): con la barra lateral y la pastilla de
// buscar arriba (≥ 1400 px con ratón, lateral.css), la caja de esta página
// SE MUDA a la barra en lugar de la pastilla: era la misma caja dos veces, y
// escribir en la de arriba abría la paleta encima de la página de buscar. Se
// mueve el elemento de verdad, con sus manejadores (la regla de la 893), y
// vuelve a su sitio si la ventana se estrecha.
const caja = $('bsForm')
const suSitio = document.createComment('caja de buscar')
caja.before(suSitio)
const mqArriba = matchMedia('(min-width: 1400px) and (pointer: fine)')
function colocarCaja() {
  const barra = document.getElementById('navSearch')
  const arriba = !!(mqArriba.matches && barra && document.documentElement.classList.contains('con-lateral'))
  const conFoco = document.activeElement === input
  if (arriba && caja.parentElement !== barra) barra.appendChild(caja)
  else if (!arriba && caja.parentElement !== suSitio.parentElement) suSitio.after(caja)
  barra?.classList.toggle('bs-en-la-barra', arriba)
  document.documentElement.classList.toggle('bs-caja-arriba', arriba)
  if (conFoco) input.focus()
  return !!barra
}
mqArriba.addEventListener('change', colocarCaja)
if (!colocarCaja()) {
  // La barra la monta app.js después; se espera a que aparezca (y a la clase
  // de la lateral) sin quedarse mirando para siempre.
  const vigia = new MutationObserver(() => { if (colocarCaja() && document.documentElement.classList.contains('con-lateral')) vigia.disconnect() })
  vigia.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
  setTimeout(() => vigia.disconnect(), 10000)
}
