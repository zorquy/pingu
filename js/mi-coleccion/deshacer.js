// AÑADIDA, CON «DESHACER» (712, C7). PINGU eligió el aviso con deshacer:
// al añadir desde la rejilla un toque de más no tenía vuelta atrás, y el
// aviso de arriba a la derecha decía «añadida» y se iba.
//
// Lo que se deshace sale de lo que DEVOLVIÓ la base, no de lo que hay en
// memoria: `datos.anadir` mete una línea nueva o le suma copias a la que ya
// tenías con la misma clave (idioma, estado, versión). Si la línea vuelve
// con MÁS copias de las que se pidieron, es que se sumaron a otra, y
// deshacer es quitar esas copias; si no, la línea es nueva y deshacer es
// borrarla. Fiarse de la memoria fallaría justo cuando la misma carta entró
// desde otro dispositivo después de cargar la página.
export function comoDeshacer(pedida, nueva) {
  const pedidas = Math.max(1, Number(pedida?.cantidad) || 1)
  const quedan = Number(nueva?.cantidad) || 0
  if (!nueva?.id) return null
  if (quedan > pedidas) return { tipo: 'bajar', id: nueva.id, cantidad: quedan - pedidas }
  return { tipo: 'borrar', id: nueva.id }
}

// El aviso, abajo y encima de la burbuja. Uno a la vez: el nuevo quita al
// anterior (deshacer siempre es de lo ÚLTIMO). Se va por temporizador y no
// al acabar una animación: con «menos movimiento» la animación no corre y
// `animationend` no llega nunca (313).
let vivo = null
export function capaDeArriba(doc = document) {
  try {
    return [...doc.querySelectorAll('dialog[open]')].reverse().find((d) => d.matches(':modal')) || doc.body
  } catch {
    return doc.body
  }
}

export function avisoConDeshacer({ html, alDeshacer, segundos = 6, doc = document }) {
  vivo?.quitar()
  const el = doc.createElement('div')
  el.className = 'mc-deshacer'
  el.setAttribute('role', 'status')
  // La barra de abajo dice cuánto le queda, y pasar el dedo o el ratón por
  // encima la para, a ella y al temporizador (780, MV11).
  el.innerHTML = `<span class="mc-deshacer-texto">${html}</span><button type="button" class="mc-deshacer-boton">Deshacer</button><span class="mc-deshacer-tiempo" style="animation-duration:${segundos}s" aria-hidden="true"></span>`
  // Dentro de la ficha si está abierta (757): un `<dialog>` modal deja
  // INERTE todo lo de fuera, y sumar una copia desde la ficha —el único
  // camino para una que ya tienes— sacaba un «Deshacer» que no se podía
  // pulsar, sin ningún error.
  capaDeArriba(doc).appendChild(el)
  let hecho = false
  const quitar = () => {
    clearTimeout(t)
    el.remove()
    if (vivo?.el === el) vivo = null
  }
  let queda = segundos * 1000
  let desde = Date.now()
  let t = setTimeout(quitar, queda)
  el.addEventListener('pointerenter', () => {
    clearTimeout(t)
    queda -= Date.now() - desde
    el.classList.add('parado')
  })
  el.addEventListener('pointerleave', () => {
    desde = Date.now()
    t = setTimeout(quitar, Math.max(1500, queda))
    el.classList.remove('parado')
  })
  el.querySelector('button').addEventListener('click', async () => {
    if (hecho) return
    hecho = true
    el.querySelector('button').disabled = true
    try {
      await alDeshacer()
    } finally {
      quitar()
    }
  })
  vivo = { el, quitar }
  return vivo
}
