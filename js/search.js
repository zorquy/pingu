// /buscar: UN buscador para todo (718, N2). Busca a la vez en las cartas
// —con su foto y su precio—, las guías, el foro y la gente, agrupado; con
// las búsquedas de antes a mano y el escáner al lado de la caja. El motor
// es `js/buscador.js`, el mismo de la paleta de Ctrl+K.
import { icons } from './icons.js'
import { escapeHtml } from './html.js'
import { GRUPOS, buscarTodo, todoVacio, recordarBusqueda, leerRecientes, olvidarRecientes } from './buscador.js'
import { destinoDe, interiorDe, engancharFotos } from './buscador-filas.js'

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
  if (!estado.filas.length) {
    // En «Todo» un grupo sin nada no sale; si es el único que se mira,
    // sí: «ninguna carta» es la respuesta.
    return grupo ? `<p class="empty-state">Nada en ${NOMBRE[g].toLowerCase()} con «${escapeHtml(q)}».</p>` : ''
  }
  const filas = estado.filas.map((f) => `<a class="bs-fila bs-${g}" href="${escapeHtml(destinoDe(g, f))}">${interiorDe(g, f)}</a>`).join('')
  const mas = !grupo && estado.filas.length >= EN_TODO ? `<button type="button" class="bs-mas" data-ver="${g}">Ver más ${g === 'gente' ? 'gente' : NOMBRE[g].toLowerCase()}</button>` : ''
  return `<section class="bs-grupo"><h2 class="bs-seccion">${NOMBRE[g]}</h2>${filas}${mas}</section>`
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
  resultados.innerHTML = todoVacio(r)
    ? `<p class="empty-state">Nada con «${escapeHtml(q)}». Prueba con menos letras o con otra palabra.</p>`
    : grupos.map((g) => seccion(g, r[g], q)).join('')
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
