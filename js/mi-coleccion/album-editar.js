// La hoja «Editar álbum» (tanda 1032, pedida por la gente: «un menú para
// editar nombre, carátula… editar un poco todo, y también borrarlo»). Todo
// lo que un álbum tiene de suyo en UN sitio. Desde la 1050 con dos pestañas:
// Aspecto (color, acabado, ventana y portada, hojas, cierre y bolsillos, con
// la vista previa al lado) y Datos (nombre, descripción, público y borrar).
// Entra por `import()` desde albumes.js: la abren el ⋯ de una baldosa
// (Datos) y «Personalizar» de dentro (Aspecto).
import { escapeHtml } from '../html.js'
import { cadenaDeEscaneo, atributosDeEscaneo } from '../escaneo-carta.js'
import { nombreDeCarta } from '../catalogo-series.js'
import { TAPAS, TAPA_POR_DEFECTO, REJILLAS, rejillaDe, estiloDe } from './archivador.js'

const $ = (id) => document.getElementById(id)
// Las portadas que se ofrecen: las primeras cartas del álbum con ficha. Un
// álbum de set de 250 cartas no cabe en una tira: con 40 hay de sobra.
const PORTADAS_MAX = 40
const PAGINAS_MAX = 120

// El estilo entero de un álbum, con la ventana (que `estiloDe` no mira: es
// de la tapa, no del dibujo de dentro).
export function estiloCompleto(estilo) {
  return { ...estiloDe(estilo), ventana: estilo?.ventana === 'no' ? 'no' : 'si' }
}

// Lo que cambia respecto a la fila, y solo eso: una corrección sobre una
// columna sin tocar no se escribe (la 885 en pequeño). Una columna que la
// fila no trae (la base sin su migración) no se escribe nunca.
export function cambiosDelEditor(album, { nombre, descripcion, tapa, portada, is_public, estilo, rejilla }) {
  const c = {}
  const n = String(nombre || '').trim().slice(0, 80) || 'Mi álbum'
  if (n !== album.nombre) c.nombre = n
  const d = String(descripcion || '').slice(0, 500) || null
  if (d !== (album.descripcion || null)) c.descripcion = d
  if ('tapa' in album && tapa && TAPAS.some((t) => t.id === tapa) && tapa !== (album.tapa || null)) c.tapa = tapa
  if ('portada' in album && (portada || null) !== (album.portada || null)) c.portada = portada || null
  if (Boolean(is_public) !== Boolean(album.is_public)) c.is_public = Boolean(is_public)
  if ('estilo' in album && estilo) {
    const nuevo = estiloCompleto(estilo)
    const antes = estiloCompleto(album.estilo)
    if (Object.keys(nuevo).some((k) => nuevo[k] !== antes[k])) c.estilo = nuevo
  }
  // Los bolsillos (1050): cambiar de 3×3 a 4×4 no mueve ninguna carta de su
  // orden; si con menos por página ya no caben en las páginas que tenía, el
  // binder crece hasta que quepan (nunca se corta).
  if ('rejilla' in album && rejilla && REJILLAS.some((r) => r.id === rejilla) && rejilla !== (album.rejilla || '3x3')) {
    c.rejilla = rejilla
    if (album.paginas) {
      const cartas = Array.isArray(album.cartas) ? album.cartas : []
      let ultima = -1
      cartas.forEach((x, i) => { if (x?.id) ultima = i })
      const hacen = Math.ceil((ultima + 1) / rejillaDe(rejilla).porPagina)
      if (hacen > album.paginas) c.paginas = Math.min(PAGINAS_MAX, hacen)
    }
  }
  return c
}

function portadaHtml(c, puesta) {
  const escaneo = c.set_id ? atributosDeEscaneo(cadenaDeEscaneo(c)) : null
  const nombre = nombreDeCarta(c) || c.id
  return `<button type="button" class="mc-albe-portada" data-portada="${escapeHtml(c.id)}" aria-pressed="${puesta === c.id}" title="${escapeHtml(nombre)}" aria-label="${escapeHtml(nombre)}">${escaneo ? `<img ${escaneo} alt="" width="245" height="342" loading="lazy" />` : `<span>${escapeHtml(nombre)}</span>`}</button>`
}

let enganchado = false
let abierta = null // { album, alGuardar, alBorrar, vistaPrevia }

// Los grupos de botones de un valor (acabado, hojas, cierre, ventana,
// bolsillos): el que vale va apretado.
const GRUPOS = { mcAlbEditAcabado: 'acabadoOp', mcAlbEditHojas: 'hojasOp', mcAlbEditCierre: 'cierreOp', mcAlbEditVentana: 'ventanaOp', mcAlbEditRejilla: 'rejilla' }
function apretar(id, valor) {
  for (const b of $(id).querySelectorAll('button')) b.setAttribute('aria-pressed', String(b.dataset[GRUPOS[id]] === valor))
}
const apretado = (id) => $(id).querySelector('[aria-pressed="true"]')?.dataset[GRUPOS[id]] || null

function pestania(cual) {
  for (const b of $('mcAlbEditPestanias').querySelectorAll('[data-albe-pestania]')) b.setAttribute('aria-pressed', String(b.dataset.albePestania === cual))
  for (const p of $('mcAlbEdit').querySelectorAll('[data-albe-panel]')) p.hidden = p.dataset.albePanel !== cual
}

function pintar(album, cartaDe, esBinder) {
  $('mcAlbEditNombre').value = album.nombre || ''
  $('mcAlbEditDescripcion').value = album.descripcion || ''
  $('mcAlbEditPublico').checked = Boolean(album.is_public)
  // El color, para todos desde la 1050 (antes solo un binder: el de un set
  // llevaba el logo); el estilo y los bolsillos, si la fila los trae.
  $('mcAlbEditTapasBloque').classList.toggle('hidden', !('tapa' in album))
  const tapa = album.tapa || TAPA_POR_DEFECTO
  $('mcAlbEditTapas').innerHTML = TAPAS.map((t) => `<button type="button" class="mc-tapa" data-tapa="${t.id}" aria-pressed="${t.id === tapa}" title="${escapeHtml(t.nombre)}"><span class="sr-only">${escapeHtml(t.nombre)}</span></button>`).join('')
  const conEstilo = 'estilo' in album
  for (const el of $('mcAlbEdit').querySelectorAll('.mc-albe-estilo')) el.classList.toggle('hidden', !conEstilo)
  const e = estiloCompleto(album.estilo)
  apretar('mcAlbEditAcabado', e.acabado)
  apretar('mcAlbEditHojas', e.hojas)
  apretar('mcAlbEditCierre', e.cierre)
  apretar('mcAlbEditVentana', e.ventana)
  $('mcAlbEditRejillaBloque').classList.toggle('hidden', !('rejilla' in album))
  $('mcAlbEditRejilla').innerHTML = REJILLAS.map((r) => `<button type="button" data-rejilla="${r.id}" aria-pressed="${r.id === (album.rejilla || '3x3')}">${r.columnas}×${r.filas}</button>`).join('')
  // La portada (764): una carta del álbum, o ninguna (la primera).
  const conPortada = 'portada' in album
  const cartas = (Array.isArray(album.cartas) ? album.cartas : []).map((c) => c?.id && cartaDe(c.id)).filter(Boolean)
  const unicas = [...new Map(cartas.map((c) => [c.id, c])).values()].slice(0, PORTADAS_MAX)
  $('mcAlbEditPortadas').classList.toggle('hidden', !conPortada || !unicas.length)
  $('mcAlbEditPortadas').innerHTML = `<button type="button" class="mc-albe-portada mc-albe-ninguna" data-portada="" aria-pressed="${!album.portada}">Ninguna</button>${unicas.map((c) => portadaHtml(c, album.portada || null)).join('')}`
  $('mcAlbEditVentanaBloque').classList.toggle('hidden', !conEstilo && (!conPortada || !unicas.length))
  $('mcAlbEditTitulo').textContent = esBinder ? 'Editar binder' : 'Editar álbum'
}

function leer() {
  return {
    nombre: $('mcAlbEditNombre').value,
    descripcion: $('mcAlbEditDescripcion').value,
    tapa: $('mcAlbEditTapas').querySelector('[aria-pressed="true"]')?.dataset.tapa || null,
    portada: $('mcAlbEditPortadas').querySelector('[aria-pressed="true"]')?.dataset.portada || null,
    is_public: $('mcAlbEditPublico').checked,
    estilo: { acabado: apretado('mcAlbEditAcabado'), hojas: apretado('mcAlbEditHojas'), cierre: apretado('mcAlbEditCierre'), ventana: apretado('mcAlbEditVentana') },
    rejilla: apretado('mcAlbEditRejilla'),
  }
}

// La vista previa cambia con cada toque: es el álbum con lo que hay puesto
// en la hoja, pintado por quien pinta el de verdad.
function repintarVista() {
  if (!abierta?.vistaPrevia) return
  const l = leer()
  const borrador = { ...abierta.album, nombre: l.nombre.trim() || 'Mi álbum', tapa: l.tapa || abierta.album.tapa, portada: l.portada, rejilla: l.rejilla || abierta.album.rejilla, estilo: estiloCompleto(l.estilo) }
  $('mcAlbEditVista').innerHTML = abierta.vistaPrevia(borrador)
}

function enganchar() {
  if (enganchado) return
  enganchado = true
  const dlg = $('mcAlbEdit')
  $('mcAlbEditCerrar').addEventListener('click', () => dlg.close())
  $('mcAlbEditCancelar').addEventListener('click', () => dlg.close())
  // Un clic en el fondo cierra (como el de «Empezar un álbum»).
  dlg.addEventListener('click', (e) => {
    const c = dlg.getBoundingClientRect()
    if (e.target === dlg && (e.clientX < c.left || e.clientX > c.right || e.clientY < c.top || e.clientY > c.bottom)) dlg.close()
  })
  $('mcAlbEditPestanias').addEventListener('click', (e) => {
    const b = e.target.closest('[data-albe-pestania]')
    if (b) pestania(b.dataset.albePestania)
  })
  for (const id of ['mcAlbEditTapas', 'mcAlbEditPortadas', ...Object.keys(GRUPOS)]) {
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('[aria-pressed]')
      if (!b) return
      for (const otro of $(id).querySelectorAll('[aria-pressed]')) otro.setAttribute('aria-pressed', String(otro === b))
      repintarVista()
    })
  }
  $('mcAlbEditNombre').addEventListener('input', repintarVista)
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
// hoja se queda abierta y quien llama enseña el error. `vistaPrevia(álbum)`
// devuelve el HTML del álbum con lo puesto; `cual`, la pestaña que se abre.
export function abrirEditorDeAlbum({ album, cartaDe = () => null, esBinder = false, alGuardar, alBorrar, vistaPrevia = null, cual = 'datos' }) {
  if (!$('mcAlbEdit') || !album) return false
  enganchar()
  abierta = { album, alGuardar, alBorrar, vistaPrevia }
  pintar(album, cartaDe, esBinder)
  pestania(cual === 'aspecto' ? 'aspecto' : 'datos')
  repintarVista()
  $('mcAlbEdit').showModal()
  if (cual === 'aspecto') $('mcAlbEditPestanias').querySelector('[aria-pressed="true"]').focus()
  else $('mcAlbEditNombre').focus()
  return true
}

