// Las filas que se deslizan de lado (tanda 1359, C de «Igualar la web»):
// cuando una fila de chips no cabe, el último salía cortado por la mitad
// («Colecc», «Activida») y parecía un fallo. Aquí se le dice a cada fila
// por dónde sigue (`data-desliza`: derecha, izquierda o ambos) y el CSS
// (components.css) desvanece ese borde. Si cabe entera, no lleva nada.
//
// Las filas llegan tarde (las pintan los módulos de cada página cuando
// tienen datos) y crecen cuando llegan las cuentas, así que se miran otra
// vez en cada cambio del DOM, de uno en uno por fotograma.

export const FILAS = '.av-chips, .com-chips, .tag-chips, .nv-filtros, .torneo-pestanas-chips, .glosario-letras, .foro-vistas, .mc-mandos, .perfil-pestanas, .bs-chips, .seg'

// Por dónde sigue una fila según cuánto mide y dónde está: lo puro, para
// poder probarlo sin navegador. Un píxel de holgura por el redondeo.
export function ladoQueSigue({ scrollLeft, scrollWidth, clientWidth }) {
  if (scrollWidth <= clientWidth + 1) return ''
  const antes = scrollLeft > 1
  const despues = scrollLeft + clientWidth < scrollWidth - 1
  if (antes && despues) return 'ambos'
  return antes ? 'izquierda' : 'derecha'
}

function mirar(fila) {
  const lado = ladoQueSigue(fila)
  if (lado) fila.dataset.desliza = lado
  else delete fila.dataset.desliza
}

export function vigilarFilas(doc = document, win = window) {
  const vistas = new WeakSet()
  const tam = 'ResizeObserver' in win ? new win.ResizeObserver((es) => es.forEach((e) => mirar(e.target))) : null
  const repasar = () => {
    for (const fila of doc.querySelectorAll(FILAS)) {
      if (!vistas.has(fila)) {
        vistas.add(fila)
        fila.addEventListener('scroll', () => mirar(fila), { passive: true })
        tam?.observe(fila)
      }
      mirar(fila)
    }
  }
  let pedido = false
  const pedir = () => {
    if (pedido) return
    pedido = true
    win.requestAnimationFrame(() => { pedido = false; repasar() })
  }
  new win.MutationObserver(pedir).observe(doc.body, { childList: true, subtree: true, characterData: true })
  repasar()
}
