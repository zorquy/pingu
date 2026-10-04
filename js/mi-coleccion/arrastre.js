// Arrastrar una carta de un bolsillo a otro (tanda 578).
//
// PINGU: «deberías poder coger una carta y arrastrarla al hueco de al
// lado o a cualquier hueco. Pero claro, si la clicas te da como para
// descargar la imagen». Lo segundo es el navegador: una `<img>` y un
// `<a>` se arrastran SOLOS, y lo que se arrastra es la foto —al soltarla
// en el escritorio se descarga—. Eso se apaga con `draggable="false"` en
// los dos y un `dragstart` cancelado aquí, por si se escapa alguno.
//
// Y el arrastre de verdad va con Pointer Events, no con la API de
// drag-and-drop de HTML: esa no funciona con el dedo en ningún móvil, y
// el álbum se mira sobre todo en el móvil.
//
// ── EL CLIC Y EL ARRASTRE EMPIEZAN IGUAL ──
//
// Los dos son un `pointerdown` sobre el mismo bolsillo, así que no se
// puede decidir al bajar: se decide al MOVER. Hasta que el puntero no se
// ha ido `umbral` píxeles no es un arrastre, y si se suelta antes es un
// clic normal (abre la ficha, o pulsa el botón que hubiera debajo). En
// cuanto es un arrastre, el clic que el navegador dispara DESPUÉS de
// soltar se traga en captura: sin eso, soltar una carta encima de otra
// abriría la ficha de la que se soltó.
//
// ── EL DEDO SOLO ARRASTRA DONDE NO HACE FALTA DESPLAZAR ──
//
// Con el ratón se arrastra siempre: mover el ratón no desplaza la página.
// Con el dedo, arrastrar y desplazar son EL MISMO gesto, y quien decide
// es `touch-action`: donde valga `none` (los bolsillos en «Ordenar y
// quitar») el dedo arrastra; donde no, el navegador se queda el gesto
// para desplazar y manda `pointercancel`, que aquí solo limpia. Quién
// puede arrastrar lo dice `puede(evento)`, que es de quien lo usa.
//
// Sin Supabase y sin saber qué es un álbum: recibe índices y los devuelve.

// Cuántos píxeles tiene que moverse el puntero para que sea un arrastre
// y no un clic con el pulso flojo.
const UMBRAL = 8

// Cuánto hay que quedarse sobre una flecha de pliego para pasar página
// con la carta en la mano.
const ESPERA_EN_BORDE = 600

// `zona` es el contenedor de los bolsillos; `elemento` es el selector de
// lo que se puede coger, con su `data-indice`; `huecos` el de los
// bolsillos vacíos sobre los que también se puede soltar; `bordes` el de
// las flechas de pliego. `alSoltar(de, a)` recibe los dos índices, o `a =
// null` si se soltó sobre un hueco vacío; `alBorde(elemento)` cuando se
// lleva un rato sobre una flecha.
export function activarArrastre(zona, { elemento, huecos, bordes, puede, alSoltar, alBorde }) {
  let inicio = null // { x, y, indice, el, pointerId }
  let fantasma = null
  let destino = null
  let enBorde = null
  let temporizadorBorde = 0
  let tragarClic = false

  // Lo que hay bajo el puntero. No se limita a la zona porque las flechas
  // de pliego viven FUERA de ella, al lado del archivador.
  function elementoBajo(x, y) {
    return document.elementFromPoint(x, y)
  }

  function marcarDestino(nuevo) {
    if (destino === nuevo) return
    destino?.classList.remove('mc-destino')
    destino = nuevo
    destino?.classList.add('mc-destino')
  }

  function vigilarBorde(borde) {
    if (enBorde === borde) return
    clearTimeout(temporizadorBorde)
    enBorde = borde
    if (!borde) return
    temporizadorBorde = setTimeout(() => {
      alBorde?.(borde)
      // El pliego se ha repintado y la carta que llevamos ya no está en
      // pantalla: la que había a medias se vuelve a marcar si ha vuelto.
      zona.querySelector(`${elemento}[data-indice="${inicio?.indice}"]`)?.classList.add('mc-arrastrando')
      enBorde = null
    }, ESPERA_EN_BORDE)
  }

  function empezar(e) {
    const caja = inicio.el
    const r = caja.getBoundingClientRect()
    fantasma = document.createElement('div')
    fantasma.className = 'mc-arrastre'
    fantasma.style.width = `${r.width}px`
    fantasma.style.height = `${r.height}px`
    const foto = caja.querySelector('img')
    if (foto) fantasma.appendChild(foto.cloneNode())
    document.body.appendChild(fantasma)
    inicio.dx = e.clientX - r.left
    inicio.dy = e.clientY - r.top
    caja.classList.add('mc-arrastrando')
    document.body.classList.add('mc-arrastrando-carta')
    try { zona.setPointerCapture(e.pointerId) } catch { /* un puntero que ya no está */ }
    mover(e)
  }

  function mover(e) {
    fantasma.style.transform = `translate(${e.clientX - inicio.dx}px, ${e.clientY - inicio.dy}px)`
    const bajo = elementoBajo(e.clientX, e.clientY)
    const caja = bajo?.closest(`${elemento}, ${huecos}`)
    marcarDestino(caja && zona.contains(caja) && !caja.classList.contains('mc-arrastrando') ? caja : null)
    vigilarBorde(bordes ? bajo?.closest(bordes) || null : null)
  }

  function limpiar() {
    clearTimeout(temporizadorBorde)
    enBorde = null
    marcarDestino(null)
    fantasma?.remove()
    fantasma = null
    zona.querySelector('.mc-arrastrando')?.classList.remove('mc-arrastrando')
    document.body.classList.remove('mc-arrastrando-carta')
    inicio = null
  }

  zona.addEventListener('dragstart', (e) => e.preventDefault())

  zona.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || inicio) return
    const el = e.target.closest(elemento)
    if (!el || !zona.contains(el)) return
    // Un botón dentro del bolsillo (quitar, mover) se pulsa, no se coge.
    if (e.target.closest('button')) return
    if (!puede(e)) return
    inicio = { x: e.clientX, y: e.clientY, indice: Number(el.dataset.indice), el, pointerId: e.pointerId }
  })

  zona.addEventListener('pointermove', (e) => {
    if (!inicio || e.pointerId !== inicio.pointerId) return
    if (!fantasma) {
      if (Math.hypot(e.clientX - inicio.x, e.clientY - inicio.y) < UMBRAL) return
      empezar(e)
    } else mover(e)
  })

  function soltar(e) {
    if (!inicio || e.pointerId !== inicio.pointerId) return
    if (!fantasma) return limpiar()
    const de = inicio.indice
    const hueco = destino
    // El clic viene en esta misma vuelta del bucle de eventos; si no
    // viniera (un puntero cancelado), la marca no puede quedarse puesta
    // para tragarse el clic siguiente de verdad.
    tragarClic = true
    setTimeout(() => { tragarClic = false }, 0)
    limpiar()
    if (!hueco) return
    const a = hueco.matches(elemento) ? Number(hueco.dataset.indice) : null
    if (a !== de) alSoltar(de, a)
  }
  zona.addEventListener('pointerup', soltar)
  zona.addEventListener('pointercancel', () => limpiar())

  // El clic que viene detrás de un arrastre no es un clic.
  zona.addEventListener('click', (e) => {
    if (!tragarClic) return
    tragarClic = false
    e.preventDefault()
    e.stopPropagation()
  }, true)
}
