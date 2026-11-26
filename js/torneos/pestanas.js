// Las pestañas de la ficha del torneo (tanda 1352, «Torneos como app» de
// PINGU). Salen de torneo.js, que no cabía en su presupuesto.
//
// Desde la 1375 (la versión 2 de «El torneo, renovado», PINGU: «el menú
// lateral es demasiado pequeño y poco visible») van SIEMPRE arriba, grandes
// y con icono, pegadas al bajar: en el PC una fila a lo ancho; en el móvil
// una fila de iconos con su nombre debajo. Se acabaron la columna estrecha
// del PC y la barra de abajo del móvil, y la barra de la web vuelve a verse
// dentro del torneo.
import { icons } from '../icons.js'

// Los ids no cambian desde la 413 (`?ver=jugar` sigue valiendo); los nombres
// sí. Desde la 1447 («El torneo, de nuevo», PINGU: «¿por qué la pestaña Hoy se
// llama Hoy y tiene una casa y está ahí?»): «Hoy» es «Tu mesa», «Tabla» es
// «Clasificación» y los mazos vuelven a tener pestaña («Mazos», id `meta`).
// El tercero de cada una es el nombre corto del móvil.
export const PESTANAS = {
  torneo: ['Info', 'info', 'Info'],
  jugadores: ['Jugadores', 'users', 'Jugadores'],
  jugar: ['Tu mesa', 'gamepad', 'Tu mesa'],
  rondas: ['Mesas', 'layoutGrid', 'Mesas'],
  clasificacion: ['Clasificación', 'trophy', 'Clasif.'],
  meta: ['Mazos', 'cards', 'Mazos'],
  jueces: ['Jueces', 'shield', 'Jueces'],
}
// UN orden para siempre (1447): antes cambiaba con el momento del torneo y, al
// terminar, «Hoy» acababa la cuarta. Lo que cambia es la que se ABRE
// (`pestanaDeEntrada`), no dónde está cada una. Las que no tienen nada no
// salen: antes de empezar quedan Info y Jugadores. Jueces no va en la fila:
// es el «Modo juez» de la cabecera (`pintarBotonJuez`).
const ORDEN = ['jugar', 'clasificacion', 'rondas', 'meta', 'torneo', 'jugadores']
const ORDEN_DE_PESTANAS = { antes: ORDEN, juego: ORDEN, fin: ORDEN }
// En la fila del móvil caben cinco; con más, las últimas van en «Más».
const CABEN_ABAJO = 5
const MOVIL = '(max-width: 900px)'

let f = null
let pestanaActiva = null
// `?ver=jueces` llegaba antes que los datos de jueces: la pestaña aún no
// existía y se abría otra para siempre (1345). Mientras nadie elija a mano,
// la pedida gana en cuanto aparece.
let elegidaAMano = false

export function faseDeLaFicha(torneo) {
  if (['finished', 'cancelled'].includes(torneo?.status)) return 'fin'
  if (torneo?.status === 'in_progress') return 'juego'
  return 'antes'
}

// La que se abre si nadie dice otra: Info antes de empezar; Hoy si estás
// jugando (o Mesas si no); la tabla al terminar.
function pestanaDeEntrada(fase, visibles) {
  const hay = (id) => visibles.some((p) => p.id === id)
  if (fase === 'fin') return hay('clasificacion') ? 'clasificacion' : 'torneo'
  if (fase === 'juego') return hay('jugar') ? 'jugar' : hay('rondas') ? 'rondas' : 'torneo'
  return 'torneo'
}

const $ = (id) => document.getElementById(id)
const enMovil = () => window.matchMedia?.(MOVIL).matches

// `funciones`: torneo(), pendientesDeJuez(), activos(), pintarSiCambia(el,
// html) y alAbrirInfo() (el «Leer más» de la descripción, que se mide).
export function montarPestanas(funciones) {
  f = funciones
  // «Volver al torneo» de la barra del modo juez (1447).
  document.addEventListener('click', (e) => {
    if (e.target.closest?.('[data-salir-juez]')) irAPestanaConUrl(null)
  })
  window.matchMedia?.(MOVIL).addEventListener?.('change', () => pintarPestanas(true))
  // Lo pegado cambia de alto (la pastilla del reloj sale y entra): lo que se
  // pega debajo lo lee de aquí.
  const pegado = $('torneoPegado')
  if (pegado && 'ResizeObserver' in window) {
    new ResizeObserver(() => document.documentElement.style.setProperty('--torneo-pegado-alto', `${pegado.offsetHeight}px`)).observe(pegado)
  }
}

export function pestanaAbierta() {
  return pestanaActiva
}

export function irAPestana(id) {
  pestanaActiva = id
  elegidaAMano = true
  pintarPestanas()
}

// Siempre en lo pegado de arriba (1375). La de la 1352 movía la barra al
// cuerpo (móvil) o a una columna (PC); si alguna quedó ahí, vuelve.
function colocar(nav) {
  document.documentElement.classList.remove('torneo-app')
  document.getElementById('torneoRail')?.remove()
  const pegado = $('torneoPegado')
  if (pegado && nav.parentNode !== pegado) pegado.prepend(nav)
}

function botonHtml(p, cuenta) {
  const [texto, icono, corto] = PESTANAS[p.id]
  return `<button type="button" class="seg-btn${p.id === pestanaActiva ? ' activa' : ''}" data-pestana="${p.id}"${p.id === pestanaActiva ? ' aria-current="page"' : ''}><span class="torneo-tab-ic" aria-hidden="true">${icons[icono]?.(20) || ''}</span><span class="torneo-tab-txt"><span class="torneo-tab-largo">${texto}</span><span class="torneo-tab-corto" aria-hidden="true">${corto}</span></span>${cuenta(p.id)}</button>`
}

// «Modo juez» (1447): para quien lleva o arbitra, un botón en la cabecera que
// cambia la ficha a la consola de jueces (el panel `jueces`), con los tickets
// que esperan. Dentro, la barra ámbar con «Volver al torneo».
function pintarBotonJuez(hayJueces, pendientes) {
  const sitio = document.querySelector('#torneoCabecera .torneo-ficha-cabecera')
  let b = $('btnModoJuez')
  if (!hayJueces) {
    b?.remove()
    return
  }
  if (!b && sitio) {
    b = document.createElement('button')
    b.type = 'button'
    b.id = 'btnModoJuez'
    b.className = 'torneo-modo-juez'
    b.dataset.pestana = 'jueces'
    b.addEventListener('click', () => irAPestanaConUrl(pestanaActiva === 'jueces' ? null : 'jueces'))
    sitio.prepend(b)
  }
  if (!b) return
  const dentro = pestanaActiva === 'jueces'
  const html = `${icons.shield(16)}<span class="torneo-modo-juez-txt">${dentro ? 'Salir del modo juez' : 'Modo juez'}</span>${pendientes && !dentro ? `<span class="torneo-pestana-aviso">${pendientes}<span class="sr-only"> pendiente${pendientes === 1 ? '' : 's'}</span></span>` : ''}`
  f.pintarSiCambia(b, html)
  b.classList.toggle('activa', dentro)
  b.setAttribute('aria-pressed', String(dentro))
}

// Ir a una pestaña (o, con null, a la de entrada) dejándolo en la dirección.
function irAPestanaConUrl(id) {
  pestanaActiva = id
  elegidaAMano = Boolean(id)
  const url = new URL(location.href)
  if (id) url.searchParams.set('ver', id)
  else url.searchParams.delete('ver')
  history.replaceState(null, '', url)
  pintarPestanas()
  window.scrollTo({ top: 0 })
}

// `forzar`: el ancho ha cambiado y la barra se rehace aunque nada más cambie.
export function pintarPestanas(forzar = false) {
  if (!f) return
  const torneo = f.torneo()
  const fase = faseDeLaFicha(torneo)
  // Los inscritos: su pestaña antes de empezar; luego, al final de Info.
  const inscritos = $('torneoInscritosCaja')
  const suSitio = document.querySelector(`[data-panel="${fase === 'antes' ? 'jugadores' : 'torneo'}"]`)
  if (inscritos && suSitio && inscritos.parentNode !== suSitio) suSitio.appendChild(inscritos)
  const visibles = ORDEN_DE_PESTANAS[fase]
    .filter((id) => id !== 'jugadores' || fase === 'antes')
    .map((id) => ({ id }))
    .filter((p) => {
      const panel = document.querySelector(`[data-panel="${p.id}"]`)
      return panel && [...panel.children].some((caja) => !caja.classList.contains('hidden'))
    })
  // `?ver=meta` abre Mazos (1447); sin listas a la vista aún no hay Mazos, y
  // abre Clasificación, que es lo más cerca (como entre la 1378 y la 1447).
  const pedidaTal = new URLSearchParams(location.search).get('ver')
  const pedida = pedidaTal === 'meta' && !visibles.some((p) => p.id === 'meta') ? 'clasificacion' : pedidaTal
  // Jueces no está en la fila, pero se puede estar en él (el «Modo juez»).
  const panelJueces = document.querySelector('[data-panel="jueces"]')
  // Hay Modo juez si alguna caja del juez tiene algo (1451: la consola y su fila
  // de vistas están siempre; lo que cuenta son las cajas de dentro).
  const hayJueces = Boolean(panelJueces && [...panelJueces.querySelectorAll('#torneoJuezCifras, .torneo-juez-col > .simple-card:not(.torneo-juez-chat)')].some((caja) => !caja.classList.contains('hidden')))
  const sePuede = (id) => visibles.some((p) => p.id === id) || (id === 'jueces' && hayJueces)
  if (!pestanaActiva) pestanaActiva = sePuede(pedida) ? pedida : pestanaDeEntrada(fase, visibles)
  if (!elegidaAMano && pedida && pestanaActiva !== pedida && sePuede(pedida)) pestanaActiva = pedida
  if (!sePuede(pestanaActiva)) pestanaActiva = visibles.length ? pestanaDeEntrada(fase, visibles) : 'torneo'
  // La pestaña abierta, en la raíz: la pastilla del reloj no sale en Hoy, que
  // ya lleva el reloj grande (1343).
  document.documentElement.dataset.torneoPestana = pestanaActiva

  const nav = $('torneoPestanas')
  // Una barra con UNA sola pestaña no es una barra (tanda 310): se esconde.
  // En el modo juez tampoco: la consola tiene su barra (1447).
  const visible = visibles.length >= 2 && pestanaActiva !== 'jueces'
  nav.classList.toggle('hidden', !visible)
  colocar(nav)
  // La de jueces lleva cuántas cosas esperan (394); la de jugadores, cuántos hay.
  const pendientes = f.pendientesDeJuez()
  const activos = f.activos()
  pintarBotonJuez(hayJueces, pendientes)
  const cuenta = (id) =>
    id === 'jueces' && pendientes
      ? ` <span class="torneo-pestana-aviso">${pendientes}<span class="sr-only"> pendiente${pendientes === 1 ? '' : 's'}</span></span>`
      : id === 'jugadores' && activos
        ? ` <span class="torneo-pestana-cuenta">${activos}</span>`
        : ''
  let html
  if (enMovil() && visibles.length > CABEN_ABAJO) {
    const delante = visibles.slice(0, CABEN_ABAJO - 1)
    const resto = visibles.slice(CABEN_ABAJO - 1)
    const dentro = resto.some((p) => p.id === pestanaActiva)
    html =
      delante.map((p) => botonHtml(p, cuenta)).join('') +
      `<button type="button" class="seg-btn torneo-tab-mas${dentro ? ' activa' : ''}" aria-expanded="false" aria-controls="torneoTabMenu"><span class="torneo-tab-ic" aria-hidden="true">${icons.moreHorizontal?.(20) || ''}</span><span class="torneo-tab-txt">Más</span>${resto.some((p) => cuenta(p.id)) ? '<span class="torneo-tab-punto" aria-hidden="true"></span>' : ''}</button>` +
      `<div class="torneo-tab-menu hidden" id="torneoTabMenu">${resto.map((p) => botonHtml(p, cuenta)).join('')}</div>`
  } else {
    html = visibles.map((p) => botonHtml(p, cuenta)).join('')
  }
  // Las pestañas se repintan solo si cambian de verdad: rehacerlas mueve lo
  // de debajo. Esconder y enseñar paneles no las toca.
  const cambiaron = f.pintarSiCambia(nav, html) || forzar
  document.querySelectorAll('.torneo-panel').forEach((s) => {
    s.classList.toggle('hidden', s.dataset.panel !== pestanaActiva)
  })
  if (pestanaActiva === 'torneo') f.alAbrirInfo?.()
  if (!cambiaron) return
  const mas = nav.querySelector('.torneo-tab-mas')
  mas?.addEventListener('click', () => {
    const menu = $('torneoTabMenu')
    const abrir = menu.classList.contains('hidden')
    menu.classList.toggle('hidden', !abrir)
    mas.setAttribute('aria-expanded', String(abrir))
  })
  nav.querySelectorAll('[data-pestana]').forEach((b) =>
    b.addEventListener('click', () => {
      const antes = pestanaActiva
      pestanaActiva = b.dataset.pestana
      elegidaAMano = true
      // En la dirección, SUSTITUYENDO la entrada (859): una pestaña no es un
      // paso del historial, igual que en Mi colección (856).
      const url = new URL(location.href)
      if (pestanaActiva === pestanaDeEntrada(faseDeLaFicha(f.torneo()), visibles)) url.searchParams.delete('ver')
      else url.searchParams.set('ver', pestanaActiva)
      history.replaceState(null, '', url)
      pintarPestanas()
      // Como en una app: la pestaña nueva empieza por arriba, no a la altura
      // a la que ibas en la otra.
      const cuerpo = document.querySelector('.torneo-ficha-cuerpo')
      if (antes !== pestanaActiva && cuerpo) {
        const y = cuerpo.getBoundingClientRect().top + window.scrollY - 140
        if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y) })
      }
    })
  )
}
