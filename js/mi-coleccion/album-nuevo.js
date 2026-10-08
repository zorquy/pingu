// «EMPEZAR UN ÁLBUM» (759, AL2 y AL3 de la ronda 3). PINGU, viendo
// Holonook: «el álbum puede ser de un set o personalizado; el del set se
// rellena solo, y el personalizado, con un pop-up para elegir el tamaño».
//
// Un diálogo y tres pasos: QUÉ tipo (set o binder), y luego lo de cada uno.
//   · Álbum de un set: eliges la expansión y si va entera (con las secretas)
//     o solo la numeración impresa; sale lleno y ordenado.
//   · Binder: nombre, bolsillos por hoja (2×2, 3×3, 3×4, 4×4), páginas (10,
//     20, 40) y el color de la tapa. Sin topes de plan: es nuestro.
//
// Lo que se crea no se escribe aquí: se le pasa a `alCrear`, que es
// albumes.js (quien sabe de la base). Aquí solo se elige.
import { escapeHtml } from '../html.js'
import { normalizeSearch } from '../texto.js'
import { atributosDeEscaneo } from '../escaneo-carta.js'
import { nombreDeSet } from '../catalogo-series.js'
import { REJILLAS, rejillaDe, TAPAS, TAPA_POR_DEFECTO } from './archivador.js'

const $ = (id) => document.getElementById(id)
export const PAGINAS = [10, 20, 40]
const MAX_SETS = 40

let opciones = null // { sets, logosDeSet, tengoDeSet, alCrear }
let estado = null

// Cuántas cartas tiene cada forma de un set. «Entero» es el total
// (numeradas + secretas + galerías, la cuenta de la 669); «oficial», la
// numeración impresa. Si son iguales o falta una, solo hay una forma.
export function formasDeSet(set) {
  const total = Number(set?.card_count_total) || 0
  const oficial = Number(set?.card_count_official) || 0
  const formas = []
  if (total || oficial) formas.push({ id: 'entero', cartas: total || oficial })
  if (oficial && total > oficial) formas.push({ id: 'oficial', cartas: oficial })
  return formas
}

// Las de la numeración impresa: número sin letras y no más allá del total
// oficial. «TG05», «SV001» o «165» de un set de 162 son secretas.
export function esDeLaNumeracion(carta, oficial) {
  const n = String(carta?.local_id ?? '').trim()
  return /^\d+$/.test(n) && Number(n) >= 1 && Number(n) <= oficial
}

export function capacidad(rejilla, paginas) {
  return rejillaDe(rejilla).porPagina * paginas
}

function pasoHtml() {
  for (const p of document.querySelectorAll('#mcAlbNuevo [data-paso]')) p.classList.toggle('hidden', p.dataset.paso !== estado.paso)
  $('mcAlbNuevoAtras').classList.toggle('hidden', estado.paso === 'tipo')
  $('mcAlbNuevoPie').classList.toggle('hidden', estado.paso === 'tipo')
  $('mcAlbNuevoTitulo').textContent = { tipo: 'Empezar un álbum', set: 'Álbum de un set', binder: 'Binder personalizado' }[estado.paso]
  if (estado.paso === 'set') pintarSets()
  if (estado.paso === 'binder') pintarBinder()
  pintarBoton()
}

function pintarBoton() {
  const b = $('mcAlbNuevoCrear')
  if (estado.paso === 'set') {
    b.disabled = !estado.set
    b.textContent = estado.set ? 'Crear el álbum' : 'Elige una expansión'
  } else {
    b.disabled = false
    b.textContent = 'Crear el binder'
  }
}

async function pintarSets() {
  const caja = $('mcAlbNuevoSets')
  const sets = await opciones.sets()
  const q = normalizeSearch($('mcAlbNuevoSetBuscar').value).trim()
  const casan = q
    ? sets.filter((s) => normalizeSearch(`${s.name || ''} ${s.name_en || ''} ${s.tcg_online_code || ''} ${s.id}`).includes(q))
    : sets
  caja.innerHTML = casan.length
    ? casan
        .slice(0, MAX_SETS)
        .map((s) => {
          const logos = opciones.logosDeSet(s)
          const anio = (String(s.release_date || '').match(/^\d{4}/) || [])[0]
          const total = Number(s.card_count_total) || Number(s.card_count_official) || 0
          const tengo = opciones.tengoDeSet(s)
          const elegido = estado.set?.id === s.id && estado.set?.market === s.market
          return `<button type="button" class="mc-albn-set" data-set="${escapeHtml(s.id)}" data-market="${escapeHtml(s.market || '')}" aria-pressed="${elegido}">
            <span class="mc-albn-set-logo">${logos.length ? `<img ${atributosDeEscaneo(logos, "this.remove()")} alt="" width="72" height="36" loading="lazy" />` : ''}</span>
            <span class="mc-albn-set-texto"><b>${escapeHtml(nombreDeSet(s) || s.id)}</b><small>${[anio, total ? `${total} cartas` : '', tengo ? `tienes ${tengo}` : ''].filter(Boolean).join(' · ')}</small></span>
          </button>`
        })
        .join('') + (casan.length > MAX_SETS ? `<p class="mc-nota">Y ${casan.length - MAX_SETS} más: escribe para afinar.</p>` : '')
    : '<p class="mc-nota">Ninguna expansión se llama así.</p>'
  pintarModos()
}

function pintarModos() {
  const caja = $('mcAlbNuevoModo')
  const formas = estado.set ? formasDeSet(estado.set) : []
  if (!formas.some((f) => f.id === estado.modo)) estado.modo = formas[0]?.id || 'entero'
  caja.classList.toggle('hidden', formas.length < 2)
  const texto = { entero: 'El set entero', oficial: 'Solo la numeración' }
  const ayuda = { entero: 'con las secretas', oficial: 'sin las secretas' }
  caja.innerHTML = formas
    .map((f) => `<button type="button" class="mc-albn-opcion" data-modo="${f.id}" aria-pressed="${estado.modo === f.id}"><b>${texto[f.id]}</b><small>${f.cartas} cartas · ${ayuda[f.id]}</small></button>`)
    .join('')
}

// El dibujo de los bolsillos de cada opción: se elige mirando, como en una
// tienda, y no leyendo «3×4».
function miniRejilla(r) {
  return `<span class="mc-albn-mini" style="--cols:${r.columnas}" aria-hidden="true">${'<i></i>'.repeat(r.columnas * r.filas)}</span>`
}

function pintarBinder() {
  $('mcAlbNuevoRejilla').innerHTML = REJILLAS.map(
    (r) => `<button type="button" class="mc-albn-opcion mc-albn-rejilla" data-rejilla="${r.id}" aria-pressed="${estado.rejilla === r.id}">${miniRejilla(r)}<b>${r.columnas}×${r.filas}</b><small>${r.columnas * r.filas} por hoja</small></button>`
  ).join('')
  $('mcAlbNuevoPaginas').innerHTML = PAGINAS.map(
    (n) => `<button type="button" class="mc-albn-opcion" data-paginas="${n}" aria-pressed="${estado.paginas === n}"><b>${n}</b><small>páginas</small></button>`
  ).join('')
  $('mcAlbNuevoTapas').innerHTML = TAPAS.map(
    (t) => `<button type="button" class="mc-tapa" data-tapa="${t.id}" aria-pressed="${estado.tapa === t.id}" title="${escapeHtml(t.nombre)}"><span class="sr-only">${escapeHtml(t.nombre)}</span></button>`
  ).join('')
  $('mcAlbNuevoVista').dataset.tapa = estado.tapa
  $('mcAlbNuevoVista').innerHTML = miniRejilla(rejillaDe(estado.rejilla))
  $('mcAlbNuevoCabe').textContent = `Caben ${capacidad(estado.rejilla, estado.paginas)} cartas.`
}

export function iniciarAlbumNuevo(o) {
  opciones = o
  const dlg = $('mcAlbNuevo')
  if (!dlg) return
  $('mcAlbNuevoCerrar').addEventListener('click', () => dlg.close())
  $('mcAlbNuevoAtras').addEventListener('click', () => {
    estado.paso = 'tipo'
    pasoHtml()
  })
  dlg.addEventListener('click', (e) => {
    const tipo = e.target.closest('[data-tipo]')
    if (tipo) {
      estado.paso = tipo.dataset.tipo
      return pasoHtml()
    }
    const set = e.target.closest('[data-set]')
    if (set) {
      void opciones.sets().then((sets) => {
        estado.set = sets.find((s) => s.id === set.dataset.set && (s.market || '') === set.dataset.market) || null
        for (const b of $('mcAlbNuevoSets').querySelectorAll('[data-set]')) b.setAttribute('aria-pressed', String(b === set))
        pintarModos()
        pintarBoton()
      })
      return
    }
    const modo = e.target.closest('[data-modo]')
    if (modo) {
      estado.modo = modo.dataset.modo
      return pintarModos()
    }
    const r = e.target.closest('[data-rejilla]')
    if (r) {
      estado.rejilla = r.dataset.rejilla
      return pintarBinder()
    }
    const p = e.target.closest('[data-paginas]')
    if (p) {
      estado.paginas = Number(p.dataset.paginas)
      return pintarBinder()
    }
    const t = e.target.closest('#mcAlbNuevoTapas [data-tapa]')
    if (t) {
      estado.tapa = t.dataset.tapa
      return pintarBinder()
    }
    // Pulsar fuera cierra, como las demás ventanas de la pantalla.
    if (e.target === dlg) {
      const c = dlg.getBoundingClientRect()
      if (e.clientX < c.left || e.clientX > c.right || e.clientY < c.top || e.clientY > c.bottom) dlg.close()
    }
  })
  let espera = null
  $('mcAlbNuevoSetBuscar').addEventListener('input', () => {
    clearTimeout(espera)
    espera = setTimeout(pintarSets, 150)
  })
  $('mcAlbNuevoForm').addEventListener('submit', (e) => {
    e.preventDefault()
    const pedido =
      estado.paso === 'set'
        ? estado.set && { tipo: 'set', set: estado.set, modo: estado.modo }
        : { tipo: 'binder', nombre: $('mcAlbNuevoNombre').value.trim().slice(0, 80) || 'Mi binder', rejilla: estado.rejilla, paginas: estado.paginas, tapa: estado.tapa }
    if (!pedido) return
    dlg.close()
    opciones.alCrear(pedido)
  })
}

export function abrirAlbumNuevo() {
  estado = { paso: 'tipo', set: null, modo: 'entero', rejilla: '3x3', paginas: 20, tapa: TAPA_POR_DEFECTO }
  $('mcAlbNuevoSetBuscar').value = ''
  $('mcAlbNuevoNombre').value = ''
  pasoHtml()
  $('mcAlbNuevo').showModal()
}
