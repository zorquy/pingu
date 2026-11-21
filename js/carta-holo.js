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
// Con el giroscopio, menos (1408, PINGU: «se gira la carta un poquito»): es
// un gesto que no buscas, y a 12° la ficha baila cada vez que te mueves.
const GRADOS_GIRO = 7
// Cuánto hay que inclinar el móvil, en grados, para llegar a ese tope.
const RANGO_GIRO = 18

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
    const { x, y, giro } = pendiente
    const tope = giro ? GRADOS_GIRO : GRADOS
    // De 0..1 a -1..1: el centro de la carta es el reposo.
    const dx = x * 2 - 1
    const dy = y * 2 - 1
    // El eje X se invierte a propósito: el ratón ARRIBA tiene que
    // levantar el borde de abajo, no hundirlo. Sin el signo, la carta se
    // mueve al revés que la mano y da una sensación rarísima.
    caja.style.setProperty('--holo-rx', `${(-dy * tope).toFixed(2)}deg`)
    caja.style.setProperty('--holo-ry', `${(dx * tope).toFixed(2)}deg`)
    caja.style.setProperty('--holo-x', `${(x * 100).toFixed(1)}%`)
    caja.style.setProperty('--holo-y', `${(y * 100).toFixed(1)}%`)
  }

  const pedirPintar = () => {
    if (!animando) {
      animando = true
      requestAnimationFrame(pintar)
    }
  }

  caja.addEventListener('pointermove', (e) => {
    // Con el dedo, solo mientras está apoyado (no hay «pasar por encima»).
    if (e.pointerType === 'touch' && e.buttons === 0) return
    const r = caja.getBoundingClientRect()
    if (!r.width || !r.height) return
    pendiente = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
    caja.classList.add('holo-activo')
    pedirPintar()
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

  const parar = montarGiro(caja, (p) => {
    pendiente = p
    caja.classList.toggle('holo-activo', !!p)
    if (p) pedirPintar()
  })

  // Si alguien enciende «menos movimiento» con la página abierta, el
  // efecto se va del todo en vez de quedarse a medias.
  quieto.addEventListener('change', (e) => {
    if (!e.matches) return
    parar()
    soltar()
    caja.classList.remove('holo')
    delete caja.dataset.holo
  })
}

// ── El giroscopio (tanda 1408) ──
//
// PINGU: «en el móvil, al girar el móvil, se gira la carta un poquito… en el
// ordenador sigue como ahora, con el ratón… no pongas ningún mensaje». Así que:
//
// 1. **Solo con el dedo como puntero** (`pointer: coarse`) y solo en la carta
//    GRANDE (`.carta-scan-holo`): en la rejilla el holo es del ratón y nada más.
// 2. **El reposo es como tengas el móvil**, no el móvil plano: la primera
//    lectura es la base, y la base se acerca despacio a la postura de ahora.
//    Si te recuestas, la carta vuelve sola al centro en vez de quedarse torcida.
// 3. **El dedo manda**: mientras arrastras la carta, el sensor no la toca, y al
//    soltar se coge base nueva. Fuera de la vista (ficha cerrada) tampoco.
// 4. **Sin un solo texto nuestro.** En iPhone el sensor pide permiso al sistema,
//    y Safari solo deja pedirlo tras un toque: se pide al primer toque EN LA
//    carta (`touchend`, que Safari cuenta como gesto) y solo si no ha llegado
//    ninguna lectura. El aviso es el de iOS; si dice que no, se queda el dedo,
//    como hasta ahora.
const CORTE_GIRO = 0.06

function ejesDe(e) {
  const ang = ((screen.orientation?.angle ?? window.orientation ?? 0) + 360) % 360
  if (ang === 90) return [e.beta, -e.gamma]
  if (ang === 270) return [-e.beta, e.gamma]
  if (ang === 180) return [-e.gamma, -e.beta]
  return [e.gamma, e.beta]
}

const acotar = (v) => Math.max(-1, Math.min(1, v))

function montarGiro(caja, poner) {
  const nada = () => {}
  if (!caja.classList.contains('carta-scan-holo')) return nada
  if (!window.matchMedia?.('(pointer: coarse)').matches || !('DeviceOrientationEvent' in window)) return nada

  let base = null
  let dedo = false
  let encendido = false
  let recibido = false

  const alGirar = (e) => {
    if (e.beta == null || e.gamma == null) return
    recibido = true
    if (!caja.isConnected) { apagar(); return }
    if (dedo || !caja.getClientRects().length) { base = null; return }
    const [x, y] = ejesDe(e)
    if (!base) { base = { x, y }; return }
    base.x += (x - base.x) * 0.02
    base.y += (y - base.y) * 0.02
    const dx = acotar((x - base.x) / RANGO_GIRO)
    const dy = acotar((y - base.y) / RANGO_GIRO)
    // Casi quieto = reposo: el brillo se apaga y la transición la devuelve.
    if (Math.abs(dx) < CORTE_GIRO && Math.abs(dy) < CORTE_GIRO) { poner(null); return }
    poner({ x: (dx + 1) / 2, y: (dy + 1) / 2, giro: true })
  }
  const encender = () => {
    if (encendido) return
    encendido = true
    window.addEventListener('deviceorientation', alGirar)
  }
  const apagar = () => {
    encendido = false
    window.removeEventListener('deviceorientation', alGirar)
  }

  caja.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') dedo = true })
  const levantar = () => { dedo = false; base = null }
  caja.addEventListener('pointerup', levantar)
  caja.addEventListener('pointercancel', levantar)

  // Se escucha desde ya: en Android (y en Chrome, que también trae
  // `requestPermission` y dice que sí sin preguntar) las lecturas llegan
  // solas y no se pide nada. Solo si al primer toque en la carta no ha llegado
  // ninguna —el iPhone, que las retiene hasta el permiso— se pide.
  encender()
  const permiso = window.DeviceOrientationEvent?.requestPermission
  if (typeof permiso === 'function') {
    caja.addEventListener('touchend', () => {
      if (recibido) return
      permiso.call(window.DeviceOrientationEvent).catch(() => {})
    }, { once: true })
  }
  return apagar
}
