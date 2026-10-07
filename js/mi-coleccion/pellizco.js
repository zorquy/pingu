// PELLIZCAR LA REJILLA (731, X3 de la lista): con dos dedos, abrir agranda
// las cartas (menos columnas) y cerrar las achica (más), entre 2 y 4, como
// la galería del móvil. Se recuerda en este navegador.
//
// Va con eventos táctiles por lo mismo que la ficha (720): el puntero se
// cancela en cuanto el navegador decide que el gesto es suyo. Y con dos
// dedos sobre la rejilla el gesto es NUESTRO: se le quita al navegador, que
// si no haría zoom de la página entera.
export const COLUMNAS = { min: 2, max: 4 }
const CLAVE = 'mc-columnas'

// Abrir más de un 20 % es una columna menos; cerrar otro tanto, una más.
export function columnasTrasPellizco(actual, escala) {
  const n = Math.max(COLUMNAS.min, Math.min(COLUMNAS.max, Math.round(Number(actual) || 3)))
  if (escala >= 1.2) return Math.max(COLUMNAS.min, n - 1)
  if (escala <= 1 / 1.2) return Math.min(COLUMNAS.max, n + 1)
  return n
}

export function columnasGuardadas(almacen = globalThis.localStorage) {
  try {
    const n = Number(almacen.getItem(CLAVE))
    return n >= COLUMNAS.min && n <= COLUMNAS.max ? n : null
  } catch {
    return null
  }
}

export function ponerColumnas(raiz, n, almacen = globalThis.localStorage) {
  raiz.dataset.columnas = String(n)
  raiz.style.setProperty('--mc-columnas', String(n))
  try {
    almacen.setItem(CLAVE, String(n))
  } catch {}
}

// Las columnas que se ven AHORA (sin nada guardado son las del `auto-fill`).
function columnasVistas(raiz) {
  const rejilla = raiz.querySelector('.mc-album-cuadricula, .mc-album-rejilla')
  if (!rejilla) return 3
  return getComputedStyle(rejilla).gridTemplateColumns.split(' ').filter(Boolean).length || 3
}

export function engancharPellizco(raiz, { win = window } = {}) {
  // Solo con dedos: lo elegido en el móvil no puede dejar el escritorio,
  // donde caben once, en cuatro columnas.
  if (!raiz || !win.matchMedia?.('(pointer: coarse)').matches) return
  const guardadas = columnasGuardadas()
  if (guardadas) ponerColumnas(raiz, guardadas)
  let inicio = null
  const distancia = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
  raiz.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2 && raiz.querySelector('.mc-album-cuadricula, .mc-album-rejilla')) inicio = { d: distancia(e.touches), n: Number(raiz.dataset.columnas) || columnasVistas(raiz) }
  }, { passive: true })
  raiz.addEventListener('touchmove', (e) => {
    if (!inicio || e.touches.length !== 2) return
    if (e.cancelable) e.preventDefault()
    const n = columnasTrasPellizco(inicio.n, distancia(e.touches) / inicio.d)
    if (n !== Number(raiz.dataset.columnas)) ponerColumnas(raiz, n)
  }, { passive: false })
  const soltar = () => { inicio = null }
  raiz.addEventListener('touchend', soltar)
  raiz.addEventListener('touchcancel', soltar)
}
