import { showToast } from './toast.js'
import { icons } from './icons.js'
import { deckAttrValue, hydrateDecks } from './cards-block.js'
import { idDeYoutube, hydrateVideos } from './video-youtube.js'
import { openCardPicker } from './card-picker.js'
import { sanitizeRichText, COLORES_TEXTO, COLORES_FONDO, anchuraPorcentaje } from './richtext-format.js'

// El editor de la Documentación de una guía.
//
// Lo que se puede guardar (y por qué) está en richtext-format.js; aquí
// solo está la parte de escribir. Se re-exporta el saneador porque varios
// módulos lo importaban de este fichero.
export { sanitizeRichText }

// ── Barra principal ──
//
// `cmd` es una orden de document.execCommand. Está obsoleto y lo sabemos,
// pero es lo único que sabe partir y volver a juntar la selección cuando
// abarca varios párrafos; hacerlo a mano con Range es mucho código y
// mucho error. Lo que el navegador escriba da igual: al guardar se
// traduce a las clases de la lista cerrada (ver richtext-format.js).
const ACCIONES = [
  { cmd: 'formatBlock', arg: 'P', etiqueta: '¶', titulo: 'Párrafo' },
  { cmd: 'formatBlock', arg: 'H2', etiqueta: 'H2', titulo: 'Título' },
  { cmd: 'formatBlock', arg: 'H3', etiqueta: 'H3', titulo: 'Subtítulo' },
  { separador: true },
  { cmd: 'bold', etiqueta: '<b>B</b>', titulo: 'Negrita (Ctrl+B)' },
  { cmd: 'italic', etiqueta: '<i>I</i>', titulo: 'Cursiva (Ctrl+I)' },
  { cmd: 'underline', etiqueta: '<u>U</u>', titulo: 'Subrayado (Ctrl+U)' },
  { cmd: 'strikeThrough', etiqueta: '<s>S</s>', titulo: 'Tachado' },
  { separador: true },
  { color: 'texto', etiqueta: 'A', titulo: 'Color del texto' },
  { color: 'fondo', etiqueta: '▮', titulo: 'Resaltar' },
  { cmd: 'removeFormat', etiqueta: 'Tx', titulo: 'Limpiar formato' },
  { separador: true },
  { cmd: 'insertUnorderedList', etiqueta: '•', titulo: 'Lista' },
  { cmd: 'insertOrderedList', etiqueta: '1.', titulo: 'Lista numerada' },
  { cmd: 'formatBlock', arg: 'BLOCKQUOTE', etiqueta: '❝', titulo: 'Cita' },
  { separador: true },
  { cmd: 'justifyLeft', etiqueta: icons.alignLeft(15), titulo: 'Alinear a la izquierda' },
  { cmd: 'justifyCenter', etiqueta: icons.alignCenter(15), titulo: 'Centrar' },
  { cmd: 'justifyRight', etiqueta: icons.alignRight(15), titulo: 'Alinear a la derecha' },
  { separador: true },
  { enlace: true, etiqueta: icons.link(15), titulo: 'Insertar enlace' },
  { cmd: 'unlink', etiqueta: `${icons.link(15)}<span class="rte-tachadura">✕</span>`, titulo: 'Quitar enlace' },
  { separador: true },
  { spoiler: true, etiqueta: icons.eye(15), titulo: 'Spoiler (texto plegado)' },
]

// Lo que pone en la pestaña del spoiler mientras el autor no lo cambie.
export const SPOILER_RESUMEN = 'Spoiler'

function paletaHtml(tipo) {
  const colores = tipo === 'texto' ? COLORES_TEXTO : COLORES_FONDO
  const muestra = (c) =>
    tipo === 'texto'
      ? `<span class="rte-swatch-letra" style="color:${c.hex}">A</span>`
      : `<span class="rte-swatch-caja" style="background:${c.hex}"></span>`
  return `<div class="rte-paleta hidden" data-paleta="${tipo}">
    ${colores
      .map((c) => `<button type="button" data-color="${c.hex}" data-tipo="${tipo}" title="${c.nombre}">${muestra(c)}</button>`)
      .join('')}
  </div>`
}

// Barra que aparece al seleccionar una imagen o una lista de cartas.
// Vive dentro de la barra de herramientas (que es pegajosa), y no
// flotando sobre el contenido: así no se va de sitio al hacer scroll ni
// tapa lo que estás mirando, y en el móvil se llega a ella igual.
function barraBloqueHtml() {
  const b = (accion, etiqueta, titulo) => `<button type="button" data-bloque="${accion}" title="${titulo}">${etiqueta}</button>`
  return `<div class="rte-blockbar hidden" data-blockbar>
    <span class="rte-blockbar-nombre" data-blockbar-nombre>Imagen</span>
    <span class="rte-blockbar-grupo">
      <input type="range" min="10" max="100" step="5" value="100" data-bloque-ancho title="Anchura" />
      <span class="rte-blockbar-valor" data-bloque-valor>100%</span>
    </span>
    <span class="rte-blockbar-grupo">
      ${b('ancho-25', '25%', 'Un cuarto de ancho')}
      ${b('ancho-50', '50%', 'Media anchura')}
      ${b('ancho-100', '100%', 'Ancho completo')}
    </span>
    <span class="rte-blockbar-grupo">
      ${b('al-i', icons.alignLeft(14), 'A la izquierda, con el texto alrededor')}
      ${b('al-c', icons.alignCenter(14), 'Centrada')}
      ${b('al-d', icons.alignRight(14), 'A la derecha, con el texto alrededor')}
    </span>
    <span class="rte-blockbar-grupo" data-blockbar-pie>
      ${b('pie', 'Pie de foto', 'Añadir o editar el pie de foto')}
    </span>
    <span class="rte-blockbar-grupo">
      ${b('subir', '↑', 'Mover arriba')}
      ${b('bajar', '↓', 'Mover abajo')}
      ${b('borrar', '✕', 'Quitar')}
    </span>
  </div>`
}

export function richTextToolbarHtml() {
  const botones = ACCIONES.map((a, i) => {
    if (a.separador) return '<span class="rte-sep" aria-hidden="true"></span>'
    if (a.color) {
      return `<span class="rte-color-wrap">
        <button type="button" data-i="${i}" title="${a.titulo}" class="rte-color-btn">${a.etiqueta}</button>
        ${paletaHtml(a.color)}
      </span>`
    }
    return `<button type="button" data-i="${i}" title="${a.titulo}">${a.etiqueta}</button>`
  }).join('')

  return `<div class="rte-tools">
    ${botones}
    <span class="rte-sep" aria-hidden="true"></span>
    <button type="button" data-action="image" title="Insertar imagen">${icons.image(15)} Imagen</button>
    <button type="button" data-action="cards" title="Insertar cartas del catálogo">${icons.layers(15)} Cartas</button>
    <button type="button" data-action="video" title="Insertar un vídeo de YouTube">${icons.gamepad(15)} Vídeo</button>
    <input type="file" accept="image/*" class="rte-image-input" hidden />
  </div>
  ${barraBloqueHtml()}`
}

// toolbarEl y surfaceEl ya deben estar en el DOM (con richTextToolbarHtml()
// como contenido del primero). uploadImage(file) debe devolver la URL pública.
export function initRichTextEditor({ toolbarEl, surfaceEl, initialHtml, onChange, uploadImage, placeholder }) {
  // Volver a montar el editor sobre la misma superficie no puede dejar
  // colgando las escuchas del anterior. Se guardan EN la superficie y no
  // en una variable del módulo porque el panel de admin monta dos
  // editores en la misma página (Documentación y Guía Pro): con una
  // variable suelta, el segundo desconectaba al primero.
  surfaceEl.__rteSoltar?.()

  surfaceEl.innerHTML = sanitizeRichText(initialHtml)
  surfaceEl.setAttribute('contenteditable', 'true')

  // Dentro del editor los spoilers se abren todos. No es un capricho:
  // dentro de un contenteditable, pulsar el resumen coloca el cursor en
  // vez de plegar, así que un spoiler cerrado sería contenido que el
  // autor no puede ni ver ni tocar. Publicados salen cerrados, porque
  // `open` no sobrevive al saneador.
  const abrirSpoilers = () => surfaceEl.querySelectorAll('details').forEach((d) => (d.open = true))
  abrirSpoilers()

  // Una superficie vacía arranca con un párrafo de verdad.
  //
  // Sin esto, lo primero que escribes queda como texto suelto colgando
  // de la superficie, sin <p> alrededor. Se ve igual, pero no es un
  // bloque: no se puede alinear, y "subir/bajar" una imagen no tiene
  // contra qué intercambiarla, así que el primer párrafo del artículo se
  // comportaba distinto a todos los demás.
  if (!surfaceEl.firstElementChild && !surfaceEl.textContent.trim()) {
    surfaceEl.innerHTML = '<p><br></p>'
  }

  // Enter crea <p> y no <div>, y se apagan los tiradores de
  // redimensionado que pinta Firefox por su cuenta: compiten con la
  // barra de abajo y escriben `width="320"` en píxeles, que no es lo que
  // guarda esta web.
  const ordenSilenciosa = (cmd, arg) => {
    try {
      return document.execCommand(cmd, false, arg)
    } catch {
      return false
    }
  }
  ordenSilenciosa('defaultParagraphSeparator', 'p')
  ordenSilenciosa('enableObjectResizing', false)

  // `styleWithCSS` se enciende SOLO para lo que lo necesita.
  //
  // Con él encendido, el navegador escribe negrita y cursiva como
  // <span style="font-weight: bold"> en vez de <strong>/<em>. Como el
  // saneador tira los estilos, eso se perdía al guardar: se veía
  // mientras escribías y desaparecía al recargar. Apagado, esas órdenes
  // generan etiquetas de verdad; encendido, el color y la alineación
  // generan estilos que sí se saben traducir a clases.
  const NECESITAN_CSS = new Set(['justifyLeft', 'justifyCenter', 'justifyRight'])

  // Una guía "vacía" tiene que guardarse vacía. El párrafo semilla de
  // arriba, o el <p><br></p> que deja el navegador al borrarlo todo,
  // parecen contenido: sin esto, una guía sin escribir nada contaría
  // como escrita y se podría enviar a revisión.
  const superficieVacia = () => !surfaceEl.textContent.trim() && !surfaceEl.querySelector('img, tcg-deck, yt-video')

  // El texto de ayuda de una superficie vacía.
  //
  // No vale `:empty` en CSS: una superficie "vacía" nunca lo está de
  // verdad — lleva dentro el <p><br></p> semilla de aquí arriba. Se marca
  // con una clase, que ya sabemos calcular bien.
  const marcarVacia = () => surfaceEl.classList.toggle('rte-vacia', superficieVacia())
  if (placeholder) surfaceEl.dataset.placeholder = placeholder
  marcarVacia()

  const emit = () => {
    marcarVacia()
    onChange(superficieVacia() ? '' : sanitizeRichText(surfaceEl.innerHTML))
  }

  // ── Dónde estaba el cursor ──
  //
  // Pulsar un botón de la barra saca el foco de la superficie y borra la
  // selección. Sin esto, "insertar cartas" no tenía forma de saber dónde
  // querías ponerlas y las dejaba al final del artículo.
  let ultimoRango = null
  const recordarCursor = () => {
    const sel = document.getSelection()
    if (!sel || sel.rangeCount === 0) return
    const r = sel.getRangeAt(0)
    if (surfaceEl.contains(r.commonAncestorContainer)) ultimoRango = r.cloneRange()
  }
  document.addEventListener('selectionchange', recordarCursor)

  const devolverCursor = () => {
    surfaceEl.focus()
    if (!ultimoRango || !surfaceEl.contains(ultimoRango.commonAncestorContainer)) return false
    const sel = document.getSelection()
    sel.removeAllRanges()
    sel.addRange(ultimoRango)
    return true
  }

  // El bloque de primer nivel donde está el cursor: el párrafo, el
  // título o la figura que cuelga directamente de la superficie. Es
  // dónde hay que meter una lista de cartas para que caiga "aquí" y no
  // dentro de un párrafo (donde el HTML no la admite).
  const bloqueDelCursor = () => {
    let n = ultimoRango?.commonAncestorContainer
    if (!n || !surfaceEl.contains(n)) return null
    if (n.nodeType === 3) n = n.parentNode
    while (n && n.parentNode && n.parentNode !== surfaceEl) n = n.parentNode
    return n && n.parentNode === surfaceEl ? n : null
  }

  // ── Barra principal ──
  const cerrarPaletas = () => toolbarEl.querySelectorAll('.rte-paleta').forEach((p) => p.classList.add('hidden'))

  toolbarEl.querySelectorAll('button[data-i]').forEach((btn) => {
    const accion = ACCIONES[Number(btn.dataset.i)]
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      if (accion.color) {
        const paleta = btn.parentElement.querySelector('.rte-paleta')
        const abierta = !paleta.classList.contains('hidden')
        cerrarPaletas()
        paleta.classList.toggle('hidden', abierta)
        return
      }
      cerrarPaletas()
      devolverCursor()
      if (accion.enlace) {
        ponerEnlace()
      } else if (accion.spoiler) {
        ponerSpoiler()
      } else {
        ordenSilenciosa('styleWithCSS', NECESITAN_CSS.has(accion.cmd))
        ordenSilenciosa(accion.cmd, accion.arg)
      }
      emit()
    })
  })

  toolbarEl.querySelectorAll('.rte-paleta button').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      cerrarPaletas()
      devolverCursor()
      ordenSilenciosa('styleWithCSS', true)
      if (btn.dataset.tipo === 'texto') ordenSilenciosa('foreColor', btn.dataset.color)
      // hiliteColor es el nombre en casi todos los navegadores; backColor
      // es el de reserva.
      else if (!ordenSilenciosa('hiliteColor', btn.dataset.color)) ordenSilenciosa('backColor', btn.dataset.color)
      emit()
    })
  })

  const cerrarAlPincharFuera = (e) => {
    if (!toolbarEl.contains(e.target)) cerrarPaletas()
  }
  document.addEventListener('click', cerrarAlPincharFuera)

  surfaceEl.__rteSoltar = () => {
    document.removeEventListener('selectionchange', recordarCursor)
    document.removeEventListener('click', cerrarAlPincharFuera)
  }

  function ponerEnlace() {
    const sel = document.getSelection()
    const texto = sel && !sel.isCollapsed ? sel.toString().trim() : ''
    // Si lo seleccionado ya parece una dirección, se ofrece como
    // sugerencia: es el caso de pegar una URL y querer enlazarla.
    const sugerencia = /^https?:\/\//i.test(texto) ? texto : 'https://'
    const url = window.prompt('URL del enlace', sugerencia)
    if (!url || !/^https?:\/\//i.test(url)) return

    if (texto) {
      ordenSilenciosa('createLink', url)
      return
    }

    // Sin nada seleccionado no hay a qué pegarle el enlace, así que se
    // escribe la propia dirección y se enlaza eso. Antes, en ese caso,
    // no pasaba absolutamente nada.
    if (!sel || sel.rangeCount === 0) return
    const nodo = document.createTextNode(url)
    sel.getRangeAt(0).insertNode(nodo)
    const r = document.createRange()
    r.selectNode(nodo)
    sel.removeAllRanges()
    sel.addRange(r)
    ordenSilenciosa('createLink', url)
    sel.collapseToEnd()
  }

  // ── Spoiler ──
  //
  // Un <details> con su <summary>: se pliega y se despliega solo, sin
  // una línea de JavaScript, y responde igual al teclado que al ratón.
  //
  // Dentro del editor se deja SIEMPRE abierto, para que el autor vea y
  // pueda tocar lo que hay dentro. Publicado sale siempre cerrado, que
  // es lo que se pide al poner un spoiler: el atributo `open` no está en
  // la lista del saneador, así que se cae al guardar (ver
  // js/richtext-format.js).
  function ponerSpoiler() {
    const sel = document.getSelection()
    const dentro = sel && !sel.isCollapsed ? sel.getRangeAt(0).extractContents() : null

    const det = document.createElement('details')
    det.open = true
    const sum = document.createElement('summary')
    sum.textContent = SPOILER_RESUMEN
    det.appendChild(sum)

    const cuerpo = document.createElement('p')
    // Lo que estuviera seleccionado se mete dentro; si no había nada,
    // un párrafo vacío donde escribir.
    if (dentro && dentro.textContent.trim()) cuerpo.appendChild(dentro)
    else cuerpo.innerHTML = '<br>'
    det.appendChild(cuerpo)

    const donde = bloqueDelCursor()
    if (donde) donde.after(det)
    else surfaceEl.appendChild(det)

    // Un párrafo detrás: sin él, el cursor se queda atrapado dentro del
    // spoiler y no hay forma de seguir escribiendo debajo. Es el mismo
    // problema que ya tenían las listas de cartas.
    const p = document.createElement('p')
    p.innerHTML = '<br>'
    det.after(p)

    // El cursor va al cuerpo del spoiler, que es donde se quiere seguir
    // escribiendo — no al resumen.
    const r = document.createRange()
    r.selectNodeContents(cuerpo)
    r.collapse(true)
    sel?.removeAllRanges()
    sel?.addRange(r)
  }

  // ── Imagen ──
  const fileInput = toolbarEl.querySelector('.rte-image-input')
  toolbarEl.querySelector('[data-action="image"]').addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0]
    fileInput.value = ''
    if (!file || !uploadImage) return
    try {
      const url = await uploadImage(file)
      devolverCursor()
      ordenSilenciosa('insertImage', url)
      emit()
    } catch (err) {
      showToast('No se pudo subir la imagen: ' + err.message)
    }
  })

  // ── Vídeo de YouTube ──
  //
  // Se pide el enlace y se guarda SOLO el identificador. El iframe no lo
  // escribe el autor en ningún momento — ver js/video-youtube.js.
  const btnVideo = toolbarEl.querySelector('[data-action="video"]')
  if (btnVideo) {
    btnVideo.addEventListener('click', () => {
      const donde = bloqueDelCursor()
      const pegado = window.prompt('Pega el enlace del vídeo de YouTube:')
      if (pegado === null) return
      const id = idDeYoutube(pegado)
      if (!id) {
        showToast('Ese enlace no parece de YouTube. Copia la dirección del vídeo y vuelve a intentarlo.')
        return
      }
      const bloque = document.createElement('yt-video')
      bloque.setAttribute('data-yt', id)
      bloque.setAttribute('contenteditable', 'false')
      if (donde) donde.after(bloque)
      else surfaceEl.appendChild(bloque)

      // Un párrafo detrás, o el cursor se queda atrapado debajo del
      // vídeo y no hay forma de seguir escribiendo.
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      bloque.after(p)
      hydrateVideos(surfaceEl)
      emit()
    })
  }

  // ── Cartas ──
  // La lista se inserta como <tcg-deck data-cards="...">, y acto seguido
  // se rellena para que el autor la vea. Ese relleno NO se guarda: lo
  // vacía sanitizeRichText en cada emit().
  const btnCartas = toolbarEl.querySelector('[data-action="cards"]')
  if (btnCartas) {
    btnCartas.addEventListener('click', async () => {
      const donde = bloqueDelCursor()
      const ids = await openCardPicker()
      if (!ids || ids.length === 0) return
      const bloque = document.createElement('tcg-deck')
      bloque.setAttribute('data-cards', deckAttrValue(ids))
      // contenteditable=false para que no se pueda escribir dentro ni
      // romper la lista con el cursor.
      bloque.setAttribute('contenteditable', 'false')

      // Va justo DEBAJO del párrafo donde estaba el cursor. Antes se
      // añadía siempre al final del artículo, que era el motivo de que
      // no hubiera forma de ponerla en su sitio.
      if (donde) donde.after(bloque)
      else surfaceEl.appendChild(bloque)

      // Un párrafo detrás, si no el cursor se queda atrapado y no hay
      // forma de seguir escribiendo debajo de la lista.
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      bloque.after(p)

      await hydrateDecks(surfaceEl)
      hydrateVideos(surfaceEl)
      seleccionar(bloque)
      emit()
    })
  }

  // ── Barra del bloque seleccionado (imagen o lista de cartas) ──
  const barra = toolbarEl.querySelector('[data-blockbar]')
  const nombreBarra = toolbarEl.querySelector('[data-blockbar-nombre]')
  const grupoPie = toolbarEl.querySelector('[data-blockbar-pie]')
  const rango = toolbarEl.querySelector('[data-bloque-ancho]')
  const valorRango = toolbarEl.querySelector('[data-bloque-valor]')
  let seleccionado = null

  const deseleccionar = () => {
    surfaceEl.querySelectorAll('.rt-sel').forEach((el) => el.classList.remove('rt-sel'))
    seleccionado = null
    barra?.classList.add('hidden')
  }

  function seleccionar(el) {
    deseleccionar()
    if (!el) return
    seleccionado = el
    el.classList.add('rt-sel')
    const esCartas = el.tagName === 'TCG-DECK'
    nombreBarra.textContent = esCartas ? 'Cartas' : 'Imagen'
    grupoPie.classList.toggle('hidden', esCartas)
    const ancho = anchuraPorcentaje(contenedor(el).style.width) || 100
    rango.value = String(ancho)
    valorRango.textContent = `${ancho}%`
    barra.classList.remove('hidden')
  }

  // Una imagen suelta se envuelve en <figure> la primera vez que se le
  // toca el tamaño, la colocación o el pie. NO al insertarla: hay guías
  // que usan imágenes pequeñas como símbolos dentro de una frase, y
  // convertirlas en figura las sacaría de la línea.
  function contenedor(el) {
    if (el.tagName === 'TCG-DECK') return el
    return el.closest('figure') || el
  }

  function asegurarFigura(el) {
    if (el.tagName === 'TCG-DECK') return el
    const yaEsta = el.closest('figure')
    if (yaEsta) return yaEsta

    const fig = document.createElement('figure')
    fig.className = 'rt-fig rt-fig-c'
    // La figura tiene que colgar de la superficie, no quedarse dentro
    // del párrafo: el HTML no admite un <figure> dentro de un <p>, y el
    // navegador acabaría partiendo el párrafo por su cuenta.
    let bloque = el
    while (bloque.parentNode && bloque.parentNode !== surfaceEl) bloque = bloque.parentNode
    if (bloque.parentNode === surfaceEl && bloque !== el) {
      bloque.after(fig)
      fig.appendChild(el)
      if (!bloque.textContent.trim() && !bloque.querySelector('img, tcg-deck, yt-video')) bloque.remove()
    } else {
      el.replaceWith(fig)
      fig.appendChild(el)
    }
    seleccionado = el
    return fig
  }

  const aplicarAncho = (n) => {
    if (!seleccionado) return
    const caja = asegurarFigura(seleccionado)
    caja.style.width = `${n}%`
    if (caja.tagName === 'FIGURE' && !caja.classList.contains('rt-fig')) caja.classList.add('rt-fig')
    rango.value = String(n)
    valorRango.textContent = `${n}%`
    emit()
  }

  rango?.addEventListener('input', () => {
    valorRango.textContent = `${rango.value}%`
    if (!seleccionado) return
    const caja = asegurarFigura(seleccionado)
    caja.style.width = `${rango.value}%`
  })
  rango?.addEventListener('change', () => aplicarAncho(Number(rango.value)))

  barra?.querySelectorAll('button[data-bloque]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      if (!seleccionado) return
      const accion = btn.dataset.bloque

      if (accion.startsWith('ancho-')) return aplicarAncho(Number(accion.slice(6)))

      if (accion.startsWith('al-')) {
        const caja = asegurarFigura(seleccionado)
        caja.classList.remove('rt-fig-i', 'rt-fig-c', 'rt-fig-d')
        caja.classList.add(`rt-fig-${accion.slice(3)}`)
        if (caja.tagName === 'FIGURE') caja.classList.add('rt-fig')
        return emit()
      }

      if (accion === 'pie') {
        const fig = asegurarFigura(seleccionado)
        let pie = fig.querySelector('figcaption')
        if (!pie) {
          pie = document.createElement('figcaption')
          pie.textContent = 'Pie de foto'
          fig.appendChild(pie)
        }
        // Se deja el texto seleccionado para poder escribir encima sin
        // tener que borrarlo antes.
        const r = document.createRange()
        r.selectNodeContents(pie)
        const sel = document.getSelection()
        sel.removeAllRanges()
        sel.addRange(r)
        surfaceEl.focus()
        return emit()
      }

      const caja = contenedor(seleccionado)
      let bloque = caja
      while (bloque.parentNode && bloque.parentNode !== surfaceEl) bloque = bloque.parentNode

      if (accion === 'subir' && bloque.previousElementSibling) {
        bloque.previousElementSibling.before(bloque)
        return emit()
      }
      if (accion === 'bajar' && bloque.nextElementSibling) {
        bloque.nextElementSibling.after(bloque)
        return emit()
      }
      if (accion === 'borrar') {
        caja.remove()
        deseleccionar()
        return emit()
      }
    })
  })

  surfaceEl.addEventListener('click', (e) => {
    // Pinchar en el pie de foto también cuenta como seleccionar la
    // imagen: si no, la barra desaparecía justo al ir a escribir el pie.
    const figura = e.target.closest?.('figure')
    const el = e.target.closest?.('img, tcg-deck') || figura?.querySelector('img')
    if (el && surfaceEl.contains(el)) seleccionar(el)
    else deseleccionar()
  })

  // Al abrir el editor con una guía que ya tenía listas, hay que
  // pintarlas: en la fila guardada están vacías por definición.
  hydrateDecks(surfaceEl).catch(() => {})
  hydrateVideos(surfaceEl)

  surfaceEl.addEventListener('input', emit)
  surfaceEl.addEventListener('blur', emit)
}
