// TIRAR HACIA ABAJO PARA REFRESCAR (732, X4 de la lista). En Safari y en
// Chrome ya existe: es del navegador. Lo que NO existe es en PokeDoc
// INSTALADA (A1), que se abre a pantalla completa y sin barra: ahí no había
// manera de recargar el foro, los avisos o un torneo en juego. Así que se
// pone solo ahí (lo monta `barra-movil.js` si la web está instalada).
//
// Desde lo alto de la página, arrastrar hacia abajo enseña una flecha que
// gira; a 80 px se suelta y recarga. Con un diálogo abierto, o si se empezó
// a desplazar algo de dentro, no hace nada.
export const UMBRAL = 80

export function tocaRefrescar({ arriba, dy, dx }) {
  return arriba && dy >= UMBRAL && dy > Math.abs(dx) * 1.5
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
    const dentro = e.target.closest?.('dialog[open], [data-sin-refrescar], .bm-burbuja, .mc-pestanias')
    inicio = e.touches.length === 1 && win.scrollY <= 0 && !dentro && !doc.querySelector('dialog[open]') ? { x: t.clientX, y: t.clientY } : null
  }, { passive: true })
  doc.addEventListener('touchmove', (e) => {
    if (!inicio) return
    const dy = e.touches[0].clientY - inicio.y
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
