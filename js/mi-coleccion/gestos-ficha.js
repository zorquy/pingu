// LA FICHA SE MANEJA CON EL DEDO (720: N5 y N6 de la lista, elegidas por
// PINGU). Para ver la carta de al lado había que acertar con la flechita
// de arriba; ahora:
//
//  · N5 — deslizar a un lado pasa a la carta de al lado (la misma que la
//    flecha: `abrirVecino`), arrastrar la hoja hacia abajo la cierra y
//    hacia arriba la abre entera.
//  · N6 — al abrirla desde la rejilla, la carta CRECE desde su hueco hasta
//    la ficha, con las transiciones de vista del navegador. Sin ellas, o
//    con «menos movimiento», se abre sin animar.
//
// Va con eventos TÁCTILES y no de puntero a propósito: un `pointermove`
// deja de llegar (llega un `pointercancel`) en cuanto el navegador decide
// que el dedo desplaza la hoja, y entonces no hay forma de saber cuánto
// se ha arrastrado. Los táctiles siguen llegando.

// Los umbrales, en píxeles. Un gesto que no llega no hace nada: con el
// dedo se tiembla, y un temblor no puede cambiar de carta.
export const UMBRAL = { lado: 60, cerrar: 110, subir: 60 }

// Qué ha sido el gesto. Pura, para poder probarla sin dedo.
// `arriba`: si la hoja estaba en lo alto al empezar. Arrastrar hacia abajo
// a media hoja es leer, no cerrar.
export function decidirGesto({ dx, dy }, { arriba = true } = {}) {
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  // Claramente de lado: más del doble de lo que se ha movido en vertical
  // (con la mitad, al bajar leyendo en diagonal saltaba de carta).
  if (ax >= UMBRAL.lado && ax > ay * 2) return dx < 0 ? 'siguiente' : 'anterior'
  if (arriba && ay > ax * 1.5) {
    if (dy >= UMBRAL.cerrar) return 'cerrar'
    if (dy <= -UMBRAL.subir) return 'subir'
  }
  return null
}

// Donde el dedo hace OTRA cosa: escribir, elegir en un desplegable, o
// leer la gráfica, que se lee arrastrando a lo ancho (661, F3).
const AJENO = 'input, textarea, select, [contenteditable], .mc-ed-historial, #mcEdHistorial, .mc-editor-campos'

// Lo que se desliza de lado por dentro (las tarjetas de precio, las chapas):
// ahí el dedo de lado mueve ESO, no cambia de carta (920, PINGU: «te pasa a
// la siguiente carta, no te pasa el precio»). Abajo sigue cerrando.
export function seDesplazaDeLado(el, hasta, { win = window } = {}) {
  for (let n = el; n && n !== hasta && n.nodeType === 1; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth + 1 && /auto|scroll/.test(win.getComputedStyle(n).overflowX)) return true
  }
  return false
}

// Con una HOJA DENTRO abierta (921: la versión o tus copias, en el móvil),
// el dedo es de ella: abajo la cierra a ella y no a la ficha, y de lado no
// pasa de carta. `acciones.subhoja()` dice cuál está abierta; tocar su velo
// también cuenta como tocarla.
export function engancharGestos(hoja, acciones, { win = window } = {}) {
  let inicio = null
  let tira = false
  hoja.addEventListener('touchstart', (e) => {
    const sub = acciones.subhoja?.() || null
    if (e.touches.length !== 1 || e.target.closest?.(AJENO) || (sub && !sub.contains(e.target) && !e.target.closest?.('.mc-subvelo'))) {
      inicio = null
      return
    }
    const t = e.touches[0]
    const movil = sub || hoja
    inicio = { x: t.clientX, y: t.clientY, arriba: movil.scrollTop <= 0, deLado: Boolean(sub) || seDesplazaDeLado(e.target, hoja, { win }), sub }
    tira = false
  }, { passive: true })
  hoja.addEventListener('touchmove', (e) => {
    if (!inicio) return
    const t = e.touches[0]
    const dy = t.clientY - inicio.y
    const dx = t.clientX - inicio.x
    // Hacia abajo y desde arriba: la hoja SIGUE al dedo, que es lo que dice
    // que soltarla la va a cerrar. Se le quita el gesto al navegador solo
    // aquí (para todo lo demás, la hoja se desplaza como siempre).
    if (inicio.arriba && dy > 0 && dy > Math.abs(dx)) {
      tira = true
      if (e.cancelable) e.preventDefault()
      ;(inicio.sub || hoja).style.transform = `translateY(${Math.round(dy)}px)`
    }
  }, { passive: false })
  const soltar = (e) => {
    if (!inicio) return
    const t = e.changedTouches[0]
    let gesto = decidirGesto({ dx: t.clientX - inicio.x, dy: t.clientY - inicio.y }, { arriba: inicio.arriba })
    if (inicio.deLado && (gesto === 'anterior' || gesto === 'siguiente')) gesto = null
    const sub = inicio.sub
    inicio = null
    if (tira) (sub || hoja).style.transform = ''
    tira = false
    if (sub) {
      if (gesto === 'cerrar') acciones.cerrarSub?.()
      return
    }
    if (gesto) acciones[gesto]?.()
  }
  hoja.addEventListener('touchend', soltar)
  hoja.addEventListener('touchcancel', () => {
    if (inicio?.sub) inicio.sub.style.transform = ''
    inicio = null
    hoja.style.transform = ''
  })
}

// La carta entra por el lado del que viene. Con un temporizador detrás y
// no con `animationend`: con «menos movimiento» la animación no corre, el
// evento no llega y la clase se quedaría puesta (la 313).
export function entrarPorElLado(el, paso, { win = window } = {}) {
  if (!el) return
  el.classList.remove('mc-entra-izquierda', 'mc-entra-derecha')
  void el.offsetWidth
  el.classList.add(paso > 0 ? 'mc-entra-derecha' : 'mc-entra-izquierda')
  win.setTimeout(() => el.classList.remove('mc-entra-izquierda', 'mc-entra-derecha'), 400)
}

// N6: la carta crece desde su hueco. `abrir` pinta la ficha; dentro de la
// transición se le pasa el nombre de la carta de la rejilla a la de la
// ficha, que es lo que hace que el navegador anime la una hasta la otra.
let ultimoOrigen = null

export function crecerDesde(origen, abrir, { doc = document, win = window, destino: selDestino = '#mcEdFoto img' } = {}) {
  const quieto = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ultimoOrigen = origen || null
  if (!origen || quieto || typeof doc.startViewTransition !== 'function') return abrir()
  origen.style.viewTransitionName = 'mc-carta-que-crece'
  let destino = null
  const t = doc.startViewTransition(() => {
    origen.style.viewTransitionName = ''
    abrir()
    destino = doc.querySelector(selDestino)
    if (destino) destino.style.viewTransitionName = 'mc-carta-que-crece'
  })
  // Al acabar —o al fallar: una transición se puede saltar— el nombre se
  // quita. Dos elementos con el mismo nombre a la vez rompen la SIGUIENTE.
  const limpiar = () => {
    origen.style.viewTransitionName = ''
    if (destino) destino.style.viewTransitionName = ''
  }
  t.finished.then(limpiar, limpiar)
  // Una saltada rechaza `ready`, y sin esto sale en el registro de errores (910).
  t.ready.catch(() => {})
  return t
}

// Y al cerrar, VUELVE (796, MV12): la foto de la ficha encoge hasta el hueco
// del que salió, si ese hueco sigue en la página y a la vista. Si no —la
// rejilla se repintó, o la carta quedó fuera de pantalla—, se cierra sin más:
// volar hacia un sitio que no se ve es peor que no volar.
export function volverAlHueco(cerrar, { doc = document, win = window } = {}) {
  const origen = ultimoOrigen
  ultimoOrigen = null
  const desde = doc.querySelector('#mcEdFoto img')
  const quieto = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  if (!origen?.isConnected || !desde || quieto || typeof doc.startViewTransition !== 'function') return cerrar()
  const r = origen.getBoundingClientRect()
  if (!r.width || r.bottom < 0 || r.top > win.innerHeight) return cerrar()
  desde.style.viewTransitionName = 'mc-carta-que-crece'
  const t = doc.startViewTransition(() => {
    desde.style.viewTransitionName = ''
    cerrar()
    origen.style.viewTransitionName = 'mc-carta-que-crece'
  })
  const limpiar = () => {
    desde.style.viewTransitionName = ''
    origen.style.viewTransitionName = ''
  }
  t.finished.then(limpiar, limpiar)
  // Una saltada rechaza `ready`, y sin esto sale en el registro de errores (910).
  t.ready.catch(() => {})
  return t
}
