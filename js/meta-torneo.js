// /meta/torneo/<id>: la ficha de un torneo del meta (tanda 1422, PINGU eligió
// lo recomendado de «Los mazos, también por torneo»).
//
// Tres cajas: el Top 8 como podio (el campeón en grande; oro, plata y
// bronce), lo que se jugó (cuánto de cada mazo, cuántos entraron arriba y «el
// que más rindió») y la clasificación entera con chips para quedarse con un
// mazo. «Ver lista» abre la lista en un pop-up, con las mismas acciones que la
// ficha del mazo. Todo sale de `meta_torneos` y `meta_resultados`.
import { escapeHtml } from './app.js'
import { icons } from './icons.js'
import { compartirHtml, engancharCompartir } from './compartir.js'
import { pintarDecklistVisual } from './torneos/cartas-decklist.js'
import { copiarDecklist, descargarImagenDecklist } from './torneos/decklist-export.js'
import { tiposDeEspecies, TIPOS_CON_BARRA } from './meta/datos.js'
import { iconosHtml } from './meta/pintar.js'
import { entero, porcentaje, puestoOrdinal, comoDecklist, textoTcgLive, enlaceConstructor, enlaceLimitless, totalDeLista } from './meta/nucleo.js'
import { torneoPorId, clasificacionDe, conListaDe, arquetiposDe, listaDe } from './meta/torneos-datos.js'
import {
  idDeTorneoEnRuta,
  repartoDe,
  elQueMasRindio,
  resultadoDe,
  chapaDeTorneo,
  cejaDeTorneo,
  enlaceDelTorneo,
  nombreDeJugador,
  TOP,
} from './meta/torneos-nucleo.js'

const $ = (id) => document.getElementById(id)
const ID = idDeTorneoEnRuta(location.pathname, location.search)
// Cuántas filas de la clasificación se pintan de entrada y cuántas más cada vez.
const PRIMERAS = 64
const MAS = 100
// Los mazos que van como chip; el resto, detrás de «Más mazos».
const CHIPS = 6

let torneo = null
let filas = []
let arqs = new Map()
let conLista = new Set()
let tipos = new Map()
let filtro = null
let cuantas = PRIMERAS
let todosLosChips = false

const FECHA = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })

function aviso(html) {
  $('mtfAviso').innerHTML = html
  $('mtfAviso').classList.toggle('hidden', !html)
}

const nombreDeMazo = (id) => arqs.get(id)?.nombre || id
const rutaDeMazo = (id) => `/meta/${encodeURIComponent(id)}`

// «Por torneo» con el periodo y la fuente con los que se llegó.
function volver() {
  const de = new URLSearchParams(location.search)
  const q = new URLSearchParams({ ver: 'torneos' })
  for (const k of ['dias', 'fuente']) if (de.get(k)) q.set(k, de.get(k))
  $('mtfVolver').href = `/meta?${q}`
}

function pintarCabecera() {
  const c = chapaDeTorneo(torneo)
  const fecha = new Date(torneo.fecha)
  const jug = Number(torneo.jugadores) || 0
  const conocidos = filas.length
  const listas = conLista.size
  document.title = `${torneo.nombre} — Torneos del meta · PokeDoc`
  $('mtfMiga').textContent = torneo.nombre
  $('mtfCeja').textContent = cejaDeTorneo(torneo)
  $('mtfNombre').textContent = torneo.nombre
  const partes = [
    Number.isNaN(fecha.getTime()) ? '' : FECHA.format(fecha),
    `${entero(jug)} ${jug === 1 ? 'jugador' : 'jugadores'}`,
    // Si no se sabe el mazo de todos (un oficial trae solo su clasificación
    // publicada), se dice: «lo que se jugó» habla de esos.
    conocidos && conocidos < jug ? `se sabe el mazo de ${entero(conocidos)}` : '',
    listas ? `${entero(listas)} ${listas === 1 ? 'lista' : 'listas'}` : '',
  ].filter(Boolean)
  $('mtfDatos').innerHTML = `<span class="mt-chapa mt-chapa-${c.clase}">${escapeHtml(c.texto)}</span>${partes.map((p) => `<span>${escapeHtml(p)}</span>`).join('<span aria-hidden="true">·</span>')}`
  const ir = enlaceDelTorneo(torneo)
  $('mtfBotones').innerHTML = `${compartirHtml('mtfCompartir')}${ir ? `<a class="btn-primary" href="${escapeHtml(ir.url)}"${ir.fuera ? ' target="_blank" rel="noopener"' : ''}>${escapeHtml(ir.texto)}</a>` : ''}`
  engancharCompartir($('mtfCompartir'), { titulo: `${torneo.nombre} — PokeDoc`, url: `${location.origin}${location.pathname}` })
}

// ── El podio ──
function puestoHtml(f, i) {
  const a = arqs.get(f.arquetipo)
  const clase = i === 0 ? ' mtf-p1' : i === 1 ? ' mtf-p2' : Number(f.puesto) === 3 ? ' mtf-p3' : ''
  const quien = [nombreDeJugador(f), f.pais].filter(Boolean).join(' · ')
  const etiqueta = i === 0 ? `${puestoOrdinal(f.puesto)} · Campeón` : puestoOrdinal(f.puesto)
  return `
    <div class="mtf-puesto${clase}">
      <span class="mtf-num">${escapeHtml(etiqueta)}</span>
      ${iconosHtml(a?.iconos)}
      <a class="mtf-mazo" href="${escapeHtml(rutaDeMazo(f.arquetipo))}">${escapeHtml(nombreDeMazo(f.arquetipo))}</a>
      ${quien ? `<span class="mtf-quien">${escapeHtml(quien)}</span>` : ''}
      ${resultadoDe(f) ? `<span class="mtf-rec">${resultadoDe(f)}</span>` : ''}
      ${conLista.has(f.jugador) ? `<button type="button" class="mtf-ver" data-lista="${escapeHtml(f.jugador)}">Ver lista</button>` : ''}
    </div>`
}

function pintarPodio() {
  const caja = $('mtfPodio')
  caja.removeAttribute('aria-busy')
  const top = filas.filter((f) => Number(f.puesto) >= 1 && Number(f.puesto) <= TOP).sort((a, b) => a.puesto - b.puesto)
  caja.innerHTML = top.length ? top.map(puestoHtml).join('') : '<p class="mtf-vacio">Este torneo no trae puestos todavía.</p>'
  caja.style.minHeight = top.length ? '' : 'auto'
}

// ── Lo que se jugó ──
let repartoEntero = false
function pintarReparto() {
  const rep = repartoDe(filas)
  const total = filas.filter((f) => f.arquetipo).length
  $('mtfJugoCuantos').textContent = total ? `${entero(total)} mazos` : ''
  if (!rep.length) {
    $('mtfReparto').innerHTML = '<p class="mtf-vacio">No se sabe qué jugó nadie en este torneo.</p>'
    return
  }
  const maximo = rep[0].n
  const visibles = repartoEntero ? rep : rep.slice(0, 8)
  const fila = (r) => {
    const tipo = TIPOS_CON_BARRA.has(tipos.get(r.arquetipo)) ? tipos.get(r.arquetipo) : null
    return `
      <li>
        ${iconosHtml((arqs.get(r.arquetipo)?.iconos || []).slice(0, 1))}
        <span class="mtf-reparto-nombre">
          <a href="${escapeHtml(rutaDeMazo(r.arquetipo))}">${escapeHtml(nombreDeMazo(r.arquetipo))}</a>
          <span class="meta-barra"${tipo ? ` data-tipo="${escapeHtml(tipo)}"` : ''} aria-hidden="true"><i style="--ancho:${Math.max(2, Math.round((r.n / maximo) * 100))}%"></i></span>
        </span>
        <span class="mtf-pct" title="${entero(r.n)} ${r.n === 1 ? 'mazo' : 'mazos'}">${porcentaje(r.cuota)}</span>
        <span class="mtf-t8${r.top ? ' mtf-t8-si' : ''}">${r.top ? `${r.top} en el Top` : '—'}</span>
      </li>`
  }
  const rinde = elQueMasRindio(rep)
  const resto = rep.slice(8)
  const restoCuota = resto.reduce((s, r) => s + r.cuota, 0)
  $('mtfReparto').innerHTML = `
    <ul class="mtf-reparto">${visibles.map(fila).join('')}</ul>
    ${rinde ? `<p class="mtf-rindio">El que más rindió: ${escapeHtml(nombreDeMazo(rinde.arquetipo))}, con el ${porcentaje(rinde.cuota)} de los mazos y ${rinde.top} de ${Math.min(TOP, rinde.enTop)} en el Top.</p>` : ''}
    ${resto.length && !repartoEntero ? `<p class="mtf-resto">El resto, ${porcentaje(restoCuota)}, en ${resto.length} ${resto.length === 1 ? 'mazo' : 'mazos'} más. <button type="button" class="mtf-ver" data-reparto-entero>Ver todos</button></p>` : ''}`
}

// ── La clasificación ──
function pintarChips() {
  const rep = repartoDe(filas)
  if (rep.length < 2) {
    $('mtfChips').innerHTML = ''
    return
  }
  const chip = (id, texto) => `<button type="button" class="mtf-chip" data-mazo="${escapeHtml(id || '')}" aria-pressed="${(filtro || '') === (id || '')}">${escapeHtml(texto)}</button>`
  const enChips = todosLosChips ? rep : rep.slice(0, CHIPS)
  // El elegido se ve siempre, aunque esté entre «los demás».
  if (filtro && !enChips.some((r) => r.arquetipo === filtro)) enChips.push(rep.find((r) => r.arquetipo === filtro))
  $('mtfChips').innerHTML = [
    chip(null, 'Todos'),
    ...enChips.filter(Boolean).map((r) => chip(r.arquetipo, nombreDeMazo(r.arquetipo))),
    rep.length > CHIPS && !todosLosChips ? `<button type="button" class="mtf-chip" data-mas-chips>+ ${rep.length - CHIPS} mazos</button>` : '',
  ].join('')
}

function filaHtml(f, corte) {
  const nombre = nombreDeJugador(f)
  return `
    <li class="mtf-fila${corte ? ' mtf-corte' : ''}">
      <span class="mtf-n">${f.puesto ? escapeHtml(String(f.puesto)) : '—'}</span>
      <span class="mtf-jugador${nombre ? '' : ' mtf-anonimo'}">${nombre ? escapeHtml(nombre) : '<span aria-label="Sin nombre">—</span>'}</span>
      <span class="mtf-pais">${escapeHtml(f.pais || '')}</span>
      <span class="mtf-mazo-fila">${iconosHtml((arqs.get(f.arquetipo)?.iconos || []).slice(0, 1))}<a href="${escapeHtml(rutaDeMazo(f.arquetipo))}">${escapeHtml(nombreDeMazo(f.arquetipo))}</a></span>
      <span class="mtf-rec">${resultadoDe(f)}</span>
      <span class="mtf-lista">${conLista.has(f.jugador) ? `<button type="button" class="mtf-ver" data-lista="${escapeHtml(f.jugador)}">Ver lista</button>` : '<span class="mtf-sin">sin lista</span>'}</span>
    </li>`
}

function pintarClasificacion() {
  const lista = filtro ? filas.filter((f) => f.arquetipo === filtro) : filas
  $('mtfClasCuantos').textContent = filas.length ? `${entero(filas.length)} con mazo · ${entero(conLista.size)} con lista` : ''
  const vistas = lista.slice(0, cuantas)
  const cab = '<li class="mtf-fila mtf-fila-cab" aria-hidden="true"><span>#</span><span>Jugador</span><span>País</span><span>Mazo</span><span>Récord</span><span></span></li>'
  // La raya dorada va debajo del 8.º (sin filtro: con él, el corte no se lee).
  $('mtfFilas').innerHTML = vistas.length
    ? cab + vistas.map((f, i) => filaHtml(f, !filtro && Number(f.puesto) <= TOP && Number(vistas[i + 1]?.puesto) > TOP)).join('')
    : '<li class="mtf-vacio">No hay jugadores con ese mazo.</li>'
  const quedan = lista.length - vistas.length
  $('mtfMas').innerHTML = quedan > 0 ? `<button type="button" class="btn-secondary" data-mas-filas>Ver ${entero(Math.min(quedan, MAS))} más</button>` : ''
}

// ── La lista de un jugador ──
async function abrirLista(jugador) {
  const f = filas.find((x) => x.jugador === jugador)
  if (!f) return
  const d = $('mtfLista')
  const mazo = nombreDeMazo(f.arquetipo)
  const quien = nombreDeJugador(f)
  $('mtfListaTitulo').textContent = `${mazo} · ${puestoOrdinal(f.puesto)}${quien ? ` · ${quien}` : ''}`
  const cuerpo = $('mtfListaCuerpo')
  cuerpo.innerHTML = '<p class="subtext">Cargando la lista…</p>'
  if (!d.open) d.showModal()
  try {
    const r = await listaDe(ID, jugador)
    if (!r?.lista) {
      cuerpo.innerHTML = '<p class="subtext">Esta lista ya no está guardada.</p>'
      return
    }
    const ver = r.enlace || (torneo.fuente === 'online' ? enlaceLimitless(ID, jugador) : null)
    cuerpo.innerHTML = `
      <div class="mtf-dialogo-acciones">
        <button type="button" class="btn-primary" data-copiar>Copiar para TCG Live</button>
        <a class="btn-secondary" href="${escapeHtml(enlaceConstructor(r.lista, mazo))}">Abrir en el constructor</a>
        <a class="btn-secondary" href="${escapeHtml(enlaceConstructor(r.lista, mazo, { laboratorio: true }))}">Probar en el laboratorio</a>
        <button type="button" class="btn-secondary" data-imagen>Descargar imagen</button>
        ${ver ? `<a class="link-btn" href="${escapeHtml(ver)}"${/^https?:/.test(ver) ? ' target="_blank" rel="noopener"' : ''}>${torneo.fuente === 'pokedoc' ? 'Ver el torneo' : 'Ver en Limitless'}</a>` : ''}
      </div>
      <p class="subtext">${totalDeLista(r.lista)} cartas.</p>
      <div class="mtf-dialogo-cartas"></div>`
    cuerpo.querySelector('[data-copiar]').addEventListener('click', () => copiarDecklist(textoTcgLive(r.lista)))
    cuerpo.querySelector('[data-imagen]').addEventListener('click', () => descargarImagenDecklist(`${mazo} — ${quien || 'lista'}`, comoDecklist(r.lista)))
    await pintarDecklistVisual(cuerpo.querySelector('.mtf-dialogo-cartas'), comoDecklist(r.lista))
  } catch (err) {
    cuerpo.innerHTML = `<p class="meta-aviso">${escapeHtml(err.message)}</p>`
  }
}

function enganchar() {
  $('mtfContenido').addEventListener('click', (e) => {
    const l = e.target.closest('[data-lista]')
    if (l) return void abrirLista(l.dataset.lista)
    const chip = e.target.closest('[data-mazo]')
    if (chip) {
      filtro = chip.dataset.mazo || null
      cuantas = PRIMERAS
      pintarChips()
      pintarClasificacion()
      return
    }
    if (e.target.closest('[data-mas-chips]')) {
      todosLosChips = true
      pintarChips()
      return
    }
    if (e.target.closest('[data-mas-filas]')) {
      cuantas += MAS
      pintarClasificacion()
      return
    }
    if (e.target.closest('[data-reparto-entero]')) {
      repartoEntero = true
      pintarReparto()
    }
  })
  const d = $('mtfLista')
  $('mtfListaCerrar').innerHTML = icons.x(18)
  $('mtfListaCerrar').addEventListener('click', () => d.close())
  // Tocar fuera (en el fondo del pop-up) también cierra.
  d.addEventListener('click', (e) => { if (e.target === d) d.close() })
}

async function iniciar() {
  volver()
  enganchar()
  if (!ID) {
    $('mtfContenido').hidden = true
    aviso('<p>Falta el torneo en la dirección. <a href="/meta?ver=torneos">Ver todos los torneos</a>.</p>')
    return
  }
  try {
    torneo = await torneoPorId(ID)
    if (!torneo) {
      $('mtfContenido').hidden = true
      $('mtfNombre').textContent = 'Torneo no encontrado'
      aviso('<p>Este torneo no está en el meta: puede que sea muy antiguo o que la dirección esté mal. <a href="/meta?ver=torneos">Ver los torneos</a>.</p>')
      return
    }
    ;[filas, conLista] = await Promise.all([clasificacionDe(ID), conListaDe(ID)])
    arqs = await arquetiposDe(filas.map((f) => f.arquetipo))
    tipos = tiposDeEspecies([...arqs.values()].map((a) => ({ arquetipo: a.id, iconos: a.iconos })))
    pintarCabecera()
    pintarPodio()
    pintarReparto()
    pintarChips()
    pintarClasificacion()
  } catch (err) {
    $('mtfPodio').removeAttribute('aria-busy')
    aviso(`<p>${escapeHtml(err.message)}</p>`)
  }
}

iniciar()
