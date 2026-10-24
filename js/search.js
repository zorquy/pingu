// /buscar: UN buscador para todo (718, N2). Busca a la vez en las cartas
// —con su foto y su precio—, las guías, el foro y la gente, agrupado; con
// las búsquedas de antes a mano y el escáner al lado de la caja. El motor
// es `js/buscador.js`, el mismo de la paleta de Ctrl+K.
import { icons } from './icons.js'
import { escapeHtml } from './html.js'
import { GRUPOS, buscarTodo, todoVacio, recordarBusqueda, leerRecientes, olvidarRecientes } from './buscador.js'
import { destinoDe, interiorDe, engancharFotos } from './buscador-filas.js'
import { cuentaDeGrupo, esPersona } from './buscador-puro.js'

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

function pintarRecientes() {
  const lista = input.value.trim() ? [] : leerRecientes()
  recientes.innerHTML = lista.length
    ? `<div class="bs-recientes"><p class="bs-seccion">Lo que buscaste<button type="button" class="bs-borrar" id="bsOlvidar">Borrar</button></p>
        ${lista.map((t) => `<button type="button" class="bs-reciente" data-reciente="${escapeHtml(t)}">${icons.clock(16)}<span>${escapeHtml(t)}</span></button>`).join('')}</div>`
    : ''
}

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
  const filas = lista.map((f) => fila(g, f, '', q)).join('') + japon
  const mas = g === 'productos' ? masProductos(estado, q) : grupo ? '' : g === 'cartas' ? masCartas(estado, q) : estado.filas.length >= EN_TODO ? `<button type="button" class="bs-mas" data-ver="${g}">Ver más ${g === 'gente' ? 'gente' : NOMBRE[g].toLowerCase()}</button>` : ''
  return `<section class="bs-grupo"><h2 class="bs-seccion">${NOMBRE[g]}</h2>${filas}${mas}</section>`
}

const fila = (g, f, extra = '', q = '') => `<a class="bs-fila bs-${g}${extra}" href="${escapeHtml(destinoDe(g, f, q))}">${interiorDe(g, f)}</a>`

// B2 (972): la carta que lo escrito señala, arriba y en grande.
const mejorHtml = (estado, q = '') => (estado?.mejor ? `<section class="bs-grupo"><h2 class="bs-seccion">Lo más probable</h2>${fila('cartas', estado.mejor, ' bs-mejor', q)}</section>` : '')

// B3 (972): cuántas hay en el catálogo japonés, a Cartas › Buscar allí.
function lineaDeJapon(estado, q) {
  const j = estado.japon
  if (!j?.total) return ''
  return `<a class="bs-fila bs-japon" href="/cartas?catalogo=JP&amp;ver=buscar&amp;q=${encodeURIComponent(q)}"><span class="bs-texto"><b>También en Pokémon Japón</b></span><span>${j.hayMas ? `${j.total}+` : j.total} ${j.total === 1 ? 'carta' : 'cartas'} ›</span></a>`
}

// En «Todo» salen las cuatro de la expansión más nueva y el botón dice
// cuántas hay (909): «Ver más» de 4 cuando son 62 se quedaba corto. Y lleva
// DIRECTO a Cartas › Buscar con la búsqueda puesta (968, Sergio: eran tres
// pasos —«Ver todo», la chapa Cartas y «Verlas en Cartas»— para llegar a
// la misma pantalla que buscar allí).
function masCartas(estado, q) {
  if (estado.total <= estado.filas.length) return ''
  const texto = estado.hayMas ? 'Ver todas las cartas' : `Ver las ${estado.total} cartas`
  return `<a class="bs-mas" href="${escapeHtml(enCartas(q))}">${texto}</a>`
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
    : (grupo ? '' : mejorHtml(r.cartas, q)) + preguntados.map((g) => seccion(g, r[g], q)).join('')
  if (!esPersona(q)) pintarCuentas(q, r)
  // «La tienes» y «La quieres» en cada carta (943).
  import('./marcas-carta.js').then((m) => m.marcarCartas(resultados)).catch(() => {})
}

input.addEventListener('input', () => {
  clearTimeout(temporizador)
  temporizador = setTimeout(buscar, 250)
})
$('bsForm').addEventListener('submit', (e) => {
  e.preventDefault()
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
  const r = e.target.closest('[data-reciente]')
  if (!r) return
  input.value = r.dataset.reciente
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
