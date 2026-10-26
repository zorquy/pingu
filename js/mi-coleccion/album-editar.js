// La hoja «Editar álbum» (tanda 1032, pedida por la gente: «un menú para
// editar nombre, carátula… editar un poco todo, y también borrarlo»). Todo
// lo que un álbum tiene de suyo en UN sitio: nombre, descripción, color de
// la tapa (solo un binder), portada (una de sus cartas) y si es público; y
// abajo, borrarlo. Entra por `import()` desde albumes.js: la abre el ⋯ de
// una baldosa y el botón «Editar álbum» de dentro.
import { escapeHtml } from '../html.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { nombreDeCarta } from '../catalogo-series.js'
import { TAPAS, TAPA_POR_DEFECTO } from './archivador.js'

const $ = (id) => document.getElementById(id)
// Las portadas que se ofrecen: las primeras cartas del álbum con ficha. Un
// álbum de set de 250 cartas no cabe en una tira: con 40 hay de sobra.
const PORTADAS_MAX = 40

// Lo que cambia respecto a la fila, y solo eso: una corrección sobre una
// columna sin tocar no se escribe (la 885 en pequeño).
export function cambiosDelEditor(album, { nombre, descripcion, tapa, portada, is_public }) {
  const c = {}
  const n = String(nombre || '').trim().slice(0, 80) || 'Mi álbum'
  if (n !== album.nombre) c.nombre = n
  const d = String(descripcion || '').slice(0, 500) || null
  if (d !== (album.descripcion || null)) c.descripcion = d
  if ('tapa' in album && tapa && TAPAS.some((t) => t.id === tapa) && tapa !== (album.tapa || null)) c.tapa = tapa
  if ('portada' in album && (portada || null) !== (album.portada || null)) c.portada = portada || null
  if (Boolean(is_public) !== Boolean(album.is_public)) c.is_public = Boolean(is_public)
  return c
}

function portadaHtml(c, puesta) {
  const escaneo = c.set_id ? atributosDeEscaneo(cadenaDeEscaneo(c)) : null
  const nombre = nombreDeCarta(c) || c.id
  return `<button type="button" class="mc-albe-portada" data-portada="${escapeHtml(c.id)}" aria-pressed="${puesta === c.id}" title="${escapeHtml(nombre)}" aria-label="${escapeHtml(nombre)}">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : `<span>${escapeHtml(nombre)}</span>`}</button>`
}

let enganchado = false
let abierta = null // { album, alGuardar, alBorrar }

function pintar(album, cartaDe, esBinder) {
  $('mcAlbEditNombre').value = album.nombre || ''
  $('mcAlbEditDescripcion').value = album.descripcion || ''
  $('mcAlbEditPublico').checked = Boolean(album.is_public)
  // La tapa: solo un binder la tiene (759); un álbum de set lleva el logo.
  const conTapa = esBinder && 'tapa' in album
  $('mcAlbEditTapasBloque').classList.toggle('hidden', !conTapa)
  const tapa = album.tapa || TAPA_POR_DEFECTO
  $('mcAlbEditTapas').innerHTML = TAPAS.map((t) => `<button type="button" class="mc-tapa" data-tapa="${t.id}" aria-pressed="${t.id === tapa}" title="${escapeHtml(t.nombre)}"><span class="sr-only">${escapeHtml(t.nombre)}</span></button>`).join('')
  // La portada (764): una carta del álbum, o ninguna (la hojita de cuatro).
  const conPortada = 'portada' in album
  const cartas = (Array.isArray(album.cartas) ? album.cartas : []).map((c) => c?.id && cartaDe(c.id)).filter(Boolean)
  const unicas = [...new Map(cartas.map((c) => [c.id, c])).values()].slice(0, PORTADAS_MAX)
  $('mcAlbEditPortadasBloque').classList.toggle('hidden', !conPortada || !unicas.length)
  $('mcAlbEditPortadas').innerHTML = `<button type="button" class="mc-albe-portada mc-albe-ninguna" data-portada="" aria-pressed="${!album.portada}">Ninguna</button>${unicas.map((c) => portadaHtml(c, album.portada || null)).join('')}`
  $('mcAlbEditTitulo').textContent = esBinder ? 'Editar binder' : 'Editar álbum'
}

function leer() {
  return {
    nombre: $('mcAlbEditNombre').value,
    descripcion: $('mcAlbEditDescripcion').value,
    tapa: $('mcAlbEditTapas').querySelector('[aria-pressed="true"]')?.dataset.tapa || null,
    portada: $('mcAlbEditPortadas').querySelector('[aria-pressed="true"]')?.dataset.portada || null,
    is_public: $('mcAlbEditPublico').checked,
  }
}

function enganchar() {
  if (enganchado) return
  enganchado = true
  const dlg = $('mcAlbEdit')
  $('mcAlbEditCerrar').addEventListener('click', () => dlg.close())
  // Un clic en el fondo cierra (como el de «Empezar un álbum»).
  dlg.addEventListener('click', (e) => {
    const c = dlg.getBoundingClientRect()
    if (e.target === dlg && (e.clientX < c.left || e.clientX > c.right || e.clientY < c.top || e.clientY > c.bottom)) dlg.close()
  })
  for (const id of ['mcAlbEditTapas', 'mcAlbEditPortadas']) {
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('[aria-pressed]')
      if (!b) return
      for (const otro of $(id).querySelectorAll('[aria-pressed]')) otro.setAttribute('aria-pressed', String(otro === b))
    })
  }
  $('mcAlbEditForm').addEventListener('submit', async (e) => {
    e.preventDefault()
    if (!abierta) return
    const cambios = cambiosDelEditor(abierta.album, leer())
    const b = $('mcAlbEditGuardar')
    b.disabled = true
    try {
      if (Object.keys(cambios).length) await abierta.alGuardar(cambios)
      dlg.close()
    } finally {
      b.disabled = false
    }
  })
  $('mcAlbEditBorrar').addEventListener('click', async () => {
    if (!abierta) return
    // confirm() a propósito, como en /mazos: no se puede deshacer.
    if (!window.confirm(`¿Borrar el álbum «${abierta.album.nombre}»? Tus cartas no se tocan.`)) return
    const b = $('mcAlbEditBorrar')
    b.disabled = true
    try {
      await abierta.alBorrar()
      dlg.close()
    } finally {
      b.disabled = false
    }
  })
  dlg.addEventListener('close', () => { abierta = null })
}

// `cartaDe(id)` da la ficha de una carta del álbum (o null). `alGuardar`
// recibe SOLO lo que cambia; `alBorrar`, nada. Los dos pueden lanzar: la
// hoja se queda abierta y quien llama enseña el error.
export function abrirEditorDeAlbum({ album, cartaDe = () => null, esBinder = false, alGuardar, alBorrar }) {
  if (!$('mcAlbEdit') || !album) return false
  enganchar()
  abierta = { album, alGuardar, alBorrar }
  pintar(album, cartaDe, esBinder)
  $('mcAlbEdit').showModal()
  $('mcAlbEditNombre').focus()
  return true
}
