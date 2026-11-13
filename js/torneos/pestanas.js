// Las pestañas de la ficha del torneo (tanda 1352, «Torneos como app» de
// PINGU). Salen de torneo.js, que no cabía en su presupuesto, y además
// deciden DÓNDE van, que depende del ancho:
//
//  - móvil (≤ 900 px): son la barra de abajo. La de la web (Inicio,
//    Aprender…) se esconde mientras estás dentro del torneo, y se sale con
//    la flecha de la cabecera. PINGU lo eligió así: dos barras abajo se
//    comen media pantalla.
//  - PC (≥ 1.100 px): una columna a la izquierda, con el tablón a la derecha.
//  - entre medias, como hasta ahora: la fila pegada arriba.
//
// El elemento es UNO y se MUEVE (norma 893): nada de pintar dos menús.
import { icons } from '../icons.js'

// Los ids no cambian desde la 413 (`?ver=jugar` sigue valiendo); los nombres
// sí: «Mi mesa» es «Hoy», «Rondas» son «Mesas» y «Clasificación» es «Tabla».
export const PESTANAS = {
  torneo: ['Info', 'info'],
  jugadores: ['Jugadores', 'users'],
  jugar: ['Hoy', 'home'],
  rondas: ['Mesas', 'layoutGrid'],
  clasificacion: ['Tabla', 'trophy'],
  meta: ['Meta', 'barChart'],
  jueces: ['Jueces', 'shield'],
}
const ORDEN_DE_PESTANAS = {
  antes: ['torneo', 'jugadores', 'jugar', 'rondas', 'clasificacion', 'meta', 'jueces'],
  juego: ['jugar', 'rondas', 'clasificacion', 'meta', 'torneo', 'jueces'],
  fin: ['clasificacion', 'rondas', 'meta', 'torneo', 'jugar', 'jueces'],
}
// En la barra de abajo caben cinco; con más, las últimas van en «Más».
const CABEN_ABAJO = 5
const MOVIL = '(max-width: 900px)'
const ANCHO = '(min-width: 1100px)'

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
const enAncho = () => window.matchMedia?.(ANCHO).matches

// `funciones`: torneo(), pendientesDeJuez(), activos(), pintarSiCambia(el,
// html) y alAbrirInfo() (el «Leer más» de la descripción, que se mide).
export function montarPestanas(funciones) {
  f = funciones
  for (const q of [MOVIL, ANCHO]) window.matchMedia?.(q).addEventListener?.('change', () => pintarPestanas(true))
  // La columna del PC se pega debajo de lo pegado arriba, que cambia de alto
  // (la pastilla del reloj sale y entra).
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

function colocar(nav, visible) {
  const raiz = document.documentElement
  const movil = enMovil()
  raiz.classList.toggle('torneo-app', Boolean(movil && visible))
  const pegado = $('torneoPegado')
  const cuerpo = document.querySelector('.torneo-ficha-cuerpo')
  if (movil) {
    if (nav.parentNode !== document.body) document.body.appendChild(nav)
  } else if (enAncho() && cuerpo) {
    let rail = $('torneoRail')
    if (!rail) {
      rail = document.createElement('div')
      rail.id = 'torneoRail'
      rail.className = 'torneo-rail'
      cuerpo.prepend(rail)
    }
    if (nav.parentNode !== rail) rail.appendChild(nav)
  } else if (pegado && nav.parentNode !== pegado) {
    pegado.prepend(nav)
  }
}

function botonHtml(p, cuenta) {
  const [texto, icono] = PESTANAS[p.id]
  return `<button type="button" class="seg-btn${p.id === pestanaActiva ? ' activa' : ''}" data-pestana="${p.id}"${p.id === pestanaActiva ? ' aria-current="page"' : ''}><span class="torneo-tab-ic" aria-hidden="true">${icons[icono]?.(20) || ''}</span><span class="torneo-tab-txt">${texto}</span>${cuenta(p.id)}</button>`
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
    .map((id) => ({ id }))
    .filter((p) => {
      const panel = document.querySelector(`[data-panel="${p.id}"]`)
      return panel && [...panel.children].some((caja) => !caja.classList.contains('hidden'))
    })
  const pedida = new URLSearchParams(location.search).get('ver')
  if (!pestanaActiva) pestanaActiva = visibles.some((p) => p.id === pedida) ? pedida : pestanaDeEntrada(fase, visibles)
  if (!elegidaAMano && pedida && pestanaActiva !== pedida && visibles.some((p) => p.id === pedida)) pestanaActiva = pedida
  if (!visibles.some((p) => p.id === pestanaActiva)) pestanaActiva = visibles[0]?.id || 'torneo'
  // La pestaña abierta, en la raíz: la pastilla del reloj no sale en Hoy, que
  // ya lleva el reloj grande (1343).
  document.documentElement.dataset.torneoPestana = pestanaActiva

  const nav = $('torneoPestanas')
  // Una barra con UNA sola pestaña no es una barra (tanda 310): se esconde,
  // y en el móvil vuelve la de la web.
  const visible = visibles.length >= 2
  nav.classList.toggle('hidden', !visible)
  colocar(nav, visible)
  // La de jueces lleva cuántas cosas esperan (394); la de jugadores, cuántos hay.
  const pendientes = f.pendientesDeJuez()
  const activos = f.activos()
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
