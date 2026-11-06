// TIRAR HACIA ABAJO PARA REFRESCAR (732, X4 de la lista). En Safari y en
// Chrome ya existe: es del navegador. Lo que NO existe es en PokeDoc
// INSTALADA (A1), que se abre a pantalla completa y sin barra: ahí no había
// manera de recargar el foro, los avisos o un torneo en juego. Así que se
// pone solo ahí (lo monta `barra-movil.js` si la web está instalada).
//
// Desde lo alto de la página, arrastrar hacia abajo enseña una flecha que
// gira; a 80 px se suelta y recarga. Con un diálogo abierto, o si se empezó
// a desplazar algo de dentro, no hace nada. Tampoco desde la hoja «Tú»,
// que no es un diálogo y se cierra arrastrándola hacia abajo (804).
export const UMBRAL = 80

export function tocaRefrescar({ arriba, dy, dx }) {
  return arriba && dy >= UMBRAL && dy > Math.abs(dx) * 1.5
}

// ¿Empieza el dedo en algo que se desliza de lado (una fila de pestañas o
// de chips)? Ahí el gesto es de la fila, no de la página (1199: deslizar
// las pestañas de Comunidad enseñaba la Poké Ball de recargar).
export function dentroDeFilaLateral(el, win = window) {
  for (let x = el; x && x.nodeType === 1; x = x.parentElement) {
    if (x.scrollWidth > x.clientWidth + 1 && /auto|scroll/.test(win.getComputedStyle(x).overflowX)) return true
  }
  return false
}

// ¿Empieza el dedo en una caja que se desliza por DENTRO y no está arriba del
// todo (1259)? Entonces tirar hacia abajo es subir por esa caja, no recargar:
// en una conversación la página está siempre arriba y los mensajes van en su
// propia caja, así que subir a leer lo de antes enseñaba la Poké Ball y
// recargaba (PINGU: «intento ir para arriba y se recarga»).
export function dentroDeCajaQueSube(el, win = window) {
  for (let x = el; x && x.nodeType === 1 && x !== win.document?.body; x = x.parentElement) {
    if (x.scrollTop > 0 && x.scrollHeight > x.clientHeight + 1 && /auto|scroll/.test(win.getComputedStyle(x).overflowY)) return true
  }
  return false
}

export function montarTirarRefrescar({ doc = document, win = window, recargar = () => win.location.reload() } = {}) {
  const marca = doc.createElement('div')
  marca.className = 'bm-refrescar'
  marca.setAttribute('aria-hidden', 'true')
  // Una Poké Ball que se va cerrando según tiras y gira al soltar (786, MV14).
  marca.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle class="bm-bola-aro" cx="12" cy="12" r="10" pathLength="1"/><path class="bm-bola-tapa" d="M2 12a10 10 0 0 1 20 0z" fill="currentColor" stroke="none"/><path d="M2 12h7m6 0h7"/><circle cx="12" cy="12" r="3"/></svg>'
  doc.body.appendChild(marca)
  let inicio = null
  doc.addEventListener('touchstart', (e) => {
    const t = e.touches[0]
    const dentro = e.target.closest?.('dialog[open], [data-sin-refrescar], .bm-burbuja, .mc-pestanias, .nav-user-dropdown')
    inicio = e.touches.length === 1 && win.scrollY <= 0 && !dentro && !doc.querySelector('dialog[open]') && !dentroDeFilaLateral(e.target, win) && !dentroDeCajaQueSube(e.target, win) ? { x: t.clientX, y: t.clientY } : null
  }, { passive: true })
  doc.addEventListener('touchmove', (e) => {
    if (!inicio) return
    const dy = e.touches[0].clientY - inicio.y
    const dx = e.touches[0].clientX - inicio.x
    // Un gesto que va más de lado que hacia abajo no es tirar: se suelta.
    if (Math.abs(dx) > 12 && Math.abs(dx) * 1.5 > dy) {
      inicio = null
      marca.style.removeProperty('--tirado')
      marca.classList.remove('lista')
      return
    }
    if (dy <= 0 || win.scrollY > 0) return
    const parte = Math.min(1, dy / UMBRAL)
    marca.style.setProperty('--tirado', String(parte))
    marca.classList.toggle('lista', parte >= 1)
  }, { passive: true })
  doc.addEventListener('touchend', (e) => {
    if (!inicio) return
    const t = e.changedTouches[0]
    const ok = tocaRefrescar({ arriba: true, dy: t.clientY - inicio.y, dx: t.clientX - inicio.x })
    inicio = null
    marca.style.removeProperty('--tirado')
    marca.classList.remove('lista')
    if (ok) {
      marca.classList.add('recargando')
      recargar()
    }
  })
  return marca
}
