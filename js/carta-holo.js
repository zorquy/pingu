// El escaneo de una carta, que se mueve (tanda 368).
//
// Lo pidió PINGU: «he visto un efecto así como de la carta moviéndose
// holográfico y tal, tipo en 3D. Eso estaría muy guay».
//
// Qué hace: la carta se inclina siguiendo al ratón, como si la tuvieras
// en la mano, y por encima corre un brillo y una banda de color que se
// desplazan al revés que la inclinación — que es lo que hace que parezca
// una superficie reflectante y no una foto girando.
//
// ── Tres decisiones que no son de gusto ──
//
// 1. **Con ratón, y con el dedo desde la 783 (MV1).** Hasta entonces era
//    solo ratón, porque el giro se llevaba por delante el desplazamiento.
//    PINGU eligió que el gesto sea de la carta: en la ficha grande lleva
//    `touch-action: none` y la página se mueve tocando fuera. En la
//    rejilla sigue siendo solo con ratón (ahí el dedo es para desplazarse).
//
// 2. **Apagado con «menos movimiento» puesto**, aquí y en el CSS. Aquí
//    porque si no seguiríamos escuchando el ratón y escribiendo
//    variables para nada; en el CSS porque es donde vive la transición
//    de vuelta al reposo, y una cosa sin la otra deja la mitad del
//    efecto viva (CLAUDE.md).
//
// 3. **Las cuentas van en un `requestAnimationFrame`.** `pointermove`
//    llega muchas más veces por segundo que las que pinta la pantalla, y
//    escribir el `style` en cada una es trabajo que se tira. Se guarda
//    la última posición y se escribe una vez por fotograma.

// Cuánto se inclina, en grados, en el borde. Más de esto y deja de
// parecer una carta en la mano para parecer una puerta abriéndose.
// 12 desde la 783 (MV1), con la vuelta en rebote: sigue pareciendo una carta.
const GRADOS = 12

export function montarHolo(caja) {
  if (!caja || caja.dataset.holo) return
  // `matchMedia` y no una comprobación suelta: el ajuste del sistema se
  // puede cambiar con la página abierta, y así nos enteramos.
  const quieto = window.matchMedia('(prefers-reduced-motion: reduce)')
  // Con el dedo también desde la 783 (MV1): tocar y arrastrar inclina la
  // carta. El toque que abre el visor sigue siendo un `click`, que no se
  // toca; y si el navegador decide que es un desplazamiento de la página,
  // manda `pointercancel` y la carta vuelve a su sitio.
  if (quieto.matches) return
  caja.dataset.holo = '1'
  caja.classList.add('holo')

  let pendiente = null
  let animando = false

  const pintar = () => {
    animando = false
    if (!pendiente) return
    const { x, y } = pendiente
    // De 0..1 a -1..1: el centro de la carta es el reposo.
    const dx = x * 2 - 1
    const dy = y * 2 - 1
    // El eje X se invierte a propósito: el ratón ARRIBA tiene que
    // levantar el borde de abajo, no hundirlo. Sin el signo, la carta se
    // mueve al revés que la mano y da una sensación rarísima.
    caja.style.setProperty('--holo-rx', `${(-dy * GRADOS).toFixed(2)}deg`)
    caja.style.setProperty('--holo-ry', `${(dx * GRADOS).toFixed(2)}deg`)
    caja.style.setProperty('--holo-x', `${(x * 100).toFixed(1)}%`)
    caja.style.setProperty('--holo-y', `${(y * 100).toFixed(1)}%`)
  }

  caja.addEventListener('pointermove', (e) => {
    // Con el dedo, solo mientras está apoyado (no hay «pasar por encima»).
    if (e.pointerType === 'touch' && e.buttons === 0) return
    const r = caja.getBoundingClientRect()
    if (!r.width || !r.height) return
    pendiente = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
    caja.classList.add('holo-activo')
    if (!animando) {
      animando = true
      requestAnimationFrame(pintar)
    }
  })

  // Al salir se vuelve al reposo quitando la clase, no poniendo los
  // valores a cero a mano: así la transición del CSS hace la vuelta, y
  // las variables se quedan donde estaban por si vuelves a entrar por el
  // mismo sitio.
  const soltar = () => {
    pendiente = null
    caja.classList.remove('holo-activo')
  }
  caja.addEventListener('pointerleave', soltar)
  caja.addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') soltar() })
  caja.addEventListener('pointercancel', soltar)
  caja.addEventListener('blur', soltar, true)

  // Si alguien enciende «menos movimiento» con la página abierta, el
  // efecto se va del todo en vez de quedarse a medias.
  quieto.addEventListener('change', (e) => {
    if (!e.matches) return
    soltar()
    caja.classList.remove('holo')
    delete caja.dataset.holo
  })
}
