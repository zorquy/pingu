// La píldora que se desliza (tanda 784, MV5). Detrás de los botones de un
// control de pastillas (`.seg`) y de la burbuja de Mi colección va UNA
// píldora que se mueve y cambia de ancho hasta la activa, en vez de que la
// activa cambie de golpe. La activa sigue llevando su clase o su
// `aria-pressed`: la píldora solo la dibuja, no decide nada. Y la activa
// conserva su fondo: solo lo suelta mientras la píldora viaja (`.viajando`),
// así que en reposo se lee igual con píldora que sin ella.
const GRUPOS = [
  ['.seg', ".seg-btn[aria-pressed='true'], .seg-btn.activa"],
  ['.mc-pestanias', '.mc-pestania.activa'],
]

function montar(caja, activa) {
  if (caja.dataset.pildora) return
  caja.dataset.pildora = '1'
  const p = document.createElement('span')
  p.className = 'pildora'
  p.setAttribute('aria-hidden', 'true')
  caja.prepend(p)
  caja.classList.add('con-pildora')
  let ultima = null, viaje = null
  const mover = () => {
    const a = caja.querySelector(activa)
    if (a && ultima && a !== ultima && p.classList.contains('lista')) {
      caja.classList.add('viajando')
      clearTimeout(viaje)
      viaje = setTimeout(() => caja.classList.remove('viajando'), 300)
    }
    // Si el control no cabe y se desliza, la activa se centra al cambiar
    // (788, PA10b: «Cruces» se quedaba fuera de la vista en el móvil).
    if (a && a !== ultima && caja.scrollWidth > caja.clientWidth + 1) {
      const rc0 = caja.getBoundingClientRect(), ra0 = a.getBoundingClientRect()
      caja.scrollLeft = Math.max(0, ra0.left - rc0.left + caja.scrollLeft - (caja.clientWidth - ra0.width) / 2)
    }
    ultima = a
    if (!a || !a.offsetWidth) { p.style.opacity = '0'; return }
    // Por las cajas y no por `offsetLeft`: la burbuja es `fixed` en el móvil y
    // la columna del PC no, y `offsetLeft` se mide contra quien toque.
    const rc = caja.getBoundingClientRect(), ra = a.getBoundingClientRect()
    p.style.opacity = '1'
    p.style.width = `${ra.width}px`
    p.style.height = `${ra.height}px`
    p.style.borderRadius = getComputedStyle(a).borderRadius
    p.style.transform = `translate(${ra.left - rc.left + caja.scrollLeft - caja.clientLeft}px, ${ra.top - rc.top + caja.scrollTop - caja.clientTop}px)`
  }
  mover()
  // La primera colocación, sin viaje; a partir de ahí, deslizándose.
  requestAnimationFrame(() => p.classList.add('lista'))
  new MutationObserver(mover).observe(caja, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-pressed'] })
  if ('ResizeObserver' in window) new ResizeObserver(mover).observe(caja)
}

export function vigilarPildoras(raiz = document.body) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const buscar = (n) => {
    for (const [sel, activa] of GRUPOS) {
      if (n.matches?.(sel)) montar(n, activa)
      n.querySelectorAll?.(sel).forEach((c) => montar(c, activa))
    }
  }
  buscar(raiz)
  new MutationObserver((cambios) => cambios.forEach((c) => c.addedNodes.forEach((n) => n.nodeType === 1 && buscar(n))))
    .observe(raiz, { childList: true, subtree: true })
}
