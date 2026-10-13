// ARRASTRAR UNA HOJA HACIA ABAJO PARA CERRARLA (804). PINGU: «cuando abres
// el perfil se despliega desde abajo, pero para salir parece que puedes
// desplegarlo hacia abajo con el dedo, y no puedes: tienes que clicar
// fuera». La rayita de arriba (`.tu-tirador`) prometía un gesto que no
// existía. Vale para TODAS las hojas del móvil: la «Tú» y los diálogos que
// la 705 sube desde abajo (filtros, ficha, añadir, ordenar…).
//
// Solo se arrastra cuando la hoja está arriba del todo (si tiene algo que
// desplazar, el dedo desplaza) y el gesto es más vertical que horizontal
// (un deslizador o una fila que se mueve de lado siguen siendo suyos).
// Se cierra pasado un cuarto de la hoja o con un tirón rápido; si no,
// vuelve a su sitio. Lo monta barra-movil.js: el escritorio no lo baja.

// Las hojas: la «Tú» y los diálogos que en el móvil suben desde abajo.
export const HOJAS = '#navUserDropdown:not(.hidden), dialog[open].mc-bandeja, dialog[open].mc-panel-filtros, dialog[open].mc-editor, dialog[open].mc-dlg-adorno, dialog[open].foro-elegir'
// Lo que el dedo usa para otra cosa.
const SUYO = 'input[type="range"], textarea, select, [contenteditable="true"], [data-sin-arrastre]'

// ¿Se cierra al soltar? Puro: lo recorrido, lo que mide la hoja y la
// velocidad del final (px/ms).
export function tocaCerrar({ dy, alto, velocidad = 0 }) {
  if (dy <= 0) return false
  return dy >= Math.min(140, alto * 0.25) || (dy >= 24 && velocidad >= 0.8)
}

export function montarArrastreDeHojas({ doc = document, win = window } = {}) {
  let g = null
  const quieto = () => win.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const cerrarHoja = (hoja) => {
    if (hoja.tagName === 'DIALOG') hoja.close()
    else hoja.classList.add('hidden')
  }
  const soltar = (hoja, cerrar) => {
    const limpiar = () => {
      hoja.style.removeProperty('transform')
      hoja.style.removeProperty('transition')
    }
    if (quieto()) {
      if (cerrar) cerrarHoja(hoja)
      limpiar()
      return
    }
    hoja.style.transition = 'transform 0.2s ease-out'
    hoja.style.transform = cerrar ? 'translateY(100%)' : 'translateY(0)'
    // `transitionend` no llega si la pestaña está en segundo plano: el
    // temporizador lo remata igual (la lección de la 313).
    let hecho = false
    const fin = () => {
      if (hecho) return
      hecho = true
      if (cerrar) cerrarHoja(hoja)
      limpiar()
    }
    hoja.addEventListener('transitionend', fin, { once: true })
    win.setTimeout(fin, 260)
  }

  doc.addEventListener('touchstart', (e) => {
    g = null
    if (e.touches.length !== 1) return
    const hoja = e.target.closest?.(HOJAS)
    if (!hoja || e.target.closest(SUYO)) return
    const t = e.touches[0]
    g = { hoja, x: t.clientX, y: t.clientY, dy: 0, arrastrando: false, ultimo: { y: t.clientY, t: e.timeStamp }, velocidad: 0 }
  }, { passive: true })

  doc.addEventListener('touchmove', (e) => {
    if (!g) return
    const t = e.touches[0]
    const dy = t.clientY - g.y
    const dx = t.clientX - g.x
    if (!g.arrastrando) {
      if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return
      // Hacia arriba, de lado, o con algo que desplazar dentro: no es suyo.
      if (dy <= 0 || Math.abs(dx) > dy || g.hoja.scrollTop > 0 || dentroDesplazado(e.target, g.hoja)) {
        g = null
        return
      }
      g.arrastrando = true
    }
    e.preventDefault()
    g.dy = Math.max(0, dy)
    // Un toque llega cada ~16 ms; con menos, la velocidad sería infinita.
    g.velocidad = (t.clientY - g.ultimo.y) / Math.max(16, e.timeStamp - g.ultimo.t)
    g.ultimo = { y: t.clientY, t: e.timeStamp }
    g.hoja.style.transition = 'none'
    g.hoja.style.transform = `translateY(${g.dy}px)`
  }, { passive: false })

  const acabar = () => {
    if (!g) return
    const { hoja, arrastrando, dy, velocidad } = g
    g = null
    if (!arrastrando) return
    soltar(hoja, tocaCerrar({ dy, alto: hoja.getBoundingClientRect().height, velocidad }))
  }
  doc.addEventListener('touchend', acabar)
  doc.addEventListener('touchcancel', () => {
    if (g?.arrastrando) soltar(g.hoja, false)
    g = null
  })
}

// Un trozo de la hoja con su propio desplazamiento que no está arriba: el
// dedo le pertenece a él.
function dentroDesplazado(nodo, hoja) {
  for (let n = nodo; n && n !== hoja; n = n.parentElement) {
    if (n.scrollTop > 0 && n.scrollHeight > n.clientHeight) return true
  }
  return false
}
