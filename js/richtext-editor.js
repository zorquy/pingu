import { showToast } from './toast.js'
import { icons } from './icons.js'
import { deckAttrValue, hydrateDecks } from './cards-block.js'
import { idDeYoutube, hydrateVideos } from './video-youtube.js'
import { openCardPicker } from './card-picker.js'
import {
  sanitizeRichText,
  COLORES_TEXTO,
  COLORES_FONDO,
  anchuraPorcentaje,
  columnasParaCartas,
  COLUMNAS_MAX,
} from './richtext-format.js'

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
    <span class="rte-blockbar-grupo" data-blockbar-ancho>
      <input type="range" min="10" max="100" step="5" value="100" data-bloque-ancho title="Anchura" />
      <span class="rte-blockbar-valor" data-bloque-valor>100%</span>
      ${b('ancho-25', '25%', 'Un cuarto de ancho')}
      ${b('ancho-50', '50%', 'Media anchura')}
      ${b('ancho-100', '100%', 'Ancho completo')}
    </span>
    <!-- Interruptor de "esto es una carta". El editor lo pone solo al
         insertar una imagen vertical, pero hace falta a mano para las
         imágenes de las guías que ya estaban escritas, y para las veces que
         se equivoque (un póster vertical no es una carta). -->
    <span class="rte-blockbar-grupo" data-blockbar-carta>
      ${b('carta', 'Tamaño carta', 'Tratarla como una carta: sale del tamaño de una carta y se junta con las de al lado')}
    </span>
    <span class="rte-blockbar-grupo">
      ${b('al-i', icons.alignLeft(14), 'A la izquierda, con el texto alrededor')}
      ${b('al-c', icons.alignCenter(14), 'Centrada')}
      ${b('al-d', icons.alignRight(14), 'A la derecha, con el texto alrededor')}
    </span>
    <!-- Poner varias imágenes en una FILA. Antes no se podía: una figura
         centrada es un bloque y se queda con la línea entera, así que
         cuatro cartas seguidas eran cuatro líneas aunque las hicieras
         pequeñas. -->
    <span class="rte-blockbar-grupo" data-blockbar-fila>
      ${b('fila-2', 'Fila de 2', 'Poner esta imagen y la siguiente en una fila de 2')}
      ${b('fila-3', '3', 'Esta y las 2 siguientes, en una fila de 3')}
      ${b('fila-4', '4', 'Esta y las 3 siguientes, en una fila de 4')}
      ${b('fila-no', 'Sacar de la fila', 'Deshacer la fila y dejar las imágenes sueltas')}
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
    <button type="button" data-action="image" title="Insertar imágenes (puedes elegir varias de una vez)">${icons.image(15)} Imagen</button>
    <button type="button" data-action="cards" title="Insertar cartas del catálogo">${icons.layers(15)} Cartas</button>
    <button type="button" data-action="video" title="Insertar un vídeo de YouTube">${icons.gamepad(15)} Vídeo</button>
    <input type="file" accept="image/*" class="rte-image-input" multiple hidden />
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

  // Dentro del editor los spoilers están SIEMPRE abiertos: un spoiler
  // cerrado sería contenido que el autor no puede ni ver ni tocar.
  // Publicados salen cerrados, porque `open` no sobrevive al saneador.
  //
  // Y no basta con abrirlos al montar: en la práctica, pulsar el resumen
  // para cambiarle el título SÍ pliega el details aunque esté en un
  // contenteditable (al contrario de lo que prometía el comentario que
  // había aquí — le pasó al admin). Se escucha el evento `toggle` (en
  // captura, porque no burbujea) y cualquier intento de plegado se
  // deshace en el acto: así el clic solo hace lo que debe, colocar el
  // cursor en el título.
  const abrirSpoilers = () => surfaceEl.querySelectorAll('details').forEach((d) => (d.open = true))
  abrirSpoilers()
  // El aspa de borrar de cada spoiler ya guardado (vestirSpoilers está
  // más abajo, con el resto del spoiler; es declaración y ya existe aquí).
  vestirSpoilers()
  const impedirPlegado = (e) => {
    if (e.target?.tagName === 'DETAILS' && !e.target.open) e.target.open = true
  }
  surfaceEl.addEventListener('toggle', impedirPlegado, true)

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
    apuntarHistorial()
    onChange(superficieVacia() ? '' : sanitizeRichText(surfaceEl.innerHTML))
  }

  // ── Deshacer y rehacer propios ──
  //
  // El Ctrl+Z del navegador solo sabe deshacer lo que entró por sus
  // propias órdenes de edición (teclear, negrita...). Todo lo que este
  // editor construye tocando el DOM —spoilers, imágenes convertidas en
  // carta, filas, listas de cartas, vídeos, mover y borrar bloques— era
  // invisible para esa pila: Ctrl+Z deshacía "solo el texto". No hay
  // forma sana de mezclar las dos pilas, así que el editor lleva la suya:
  // instantáneas del contenido en cada cambio, y Ctrl+Z/Ctrl+Y se
  // interceptan y restauran. El tecleo seguido se fusiona en una sola
  // entrada para no deshacer letra a letra.
  let historial = [surfaceEl.innerHTML]
  let indiceHist = 0
  let ultimoApunte = 0
  let tecleando = false
  let cimaEsTecleo = false
  let restaurando = false

  const apuntarHistorial = () => {
    if (restaurando) return
    const html = surfaceEl.innerHTML
    if (html === historial[indiceHist]) return
    const ahora = Date.now()
    // Rehacer muere en cuanto se escribe algo nuevo, como en cualquier
    // editor.
    historial = historial.slice(0, indiceHist + 1)
    // Solo se fusiona tecleo CON tecleo: escribir justo después de poner
    // un spoiler no puede fundirse con la entrada del spoiler, o Ctrl+Z
    // se llevaría los dos de un golpe.
    if (tecleando && cimaEsTecleo && ahora - ultimoApunte < 700) {
      historial[indiceHist] = html
    } else {
      historial.push(html)
      indiceHist++
      if (historial.length > 100) {
        historial.shift()
        indiceHist--
      }
    }
    cimaEsTecleo = tecleando
    ultimoApunte = ahora
  }

  const restaurarHistorial = (paso) => {
    const destino = indiceHist + paso
    if (destino < 0 || destino >= historial.length) return
    restaurando = true
    indiceHist = destino
    cimaEsTecleo = false
    surfaceEl.innerHTML = historial[destino]
    // Lo restaurado se deja como estaba: spoilers abiertos y vestidos,
    // listas y vídeos pintados, imágenes marcadas como ya vistas (volver
    // atrás no es volver a insertarlas).
    abrirSpoilers()
    vestirSpoilers()
    surfaceEl.querySelectorAll('img').forEach((i) => imagenesVistas.add(i))
    hydrateDecks(surfaceEl).catch(() => {})
    hydrateVideos(surfaceEl)
    deseleccionar()
    const r = document.createRange()
    r.selectNodeContents(surfaceEl)
    r.collapse(false)
    const sel = document.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(r)
    restaurando = false
    marcarVacia()
    onChange(superficieVacia() ? '' : sanitizeRichText(surfaceEl.innerHTML))
  }

  surfaceEl.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return
    const tecla = (e.key || '').toLowerCase()
    if (tecla !== 'z' && tecla !== 'y') return
    e.preventDefault()
    restaurarHistorial(tecla === 'y' || e.shiftKey ? 1 : -1)
  })
  // El "deshacer" del menú contextual y del móvil no pasa por el teclado:
  // llega como beforeinput, y también se redirige a la pila propia.
  surfaceEl.addEventListener('beforeinput', (e) => {
    if (e.inputType === 'historyUndo') {
      e.preventDefault()
      restaurarHistorial(-1)
    } else if (e.inputType === 'historyRedo') {
      e.preventDefault()
      restaurarHistorial(1)
    }
  })

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

  // Dónde viven los bloques: colgando de la superficie o, si el cursor
  // está dentro de un spoiler, colgando del <details>. Sin esa segunda
  // parada, todo lo que se insertara con el cursor dentro de un spoiler
  // subía hasta el <details> entero y caía DESPUÉS de él — fuera.
  const esContenedorDeBloques = (n) =>
    n === surfaceEl || (n?.tagName === 'DETAILS' && surfaceEl.contains(n))

  // El bloque donde está el cursor: el párrafo, el título o la figura
  // que cuelga directamente de la superficie (o del spoiler en el que
  // esté metido el cursor). Es dónde hay que meter una lista de cartas
  // para que caiga "aquí" y no dentro de un párrafo (donde el HTML no
  // la admite).
  const bloqueDelCursor = () => {
    let n = ultimoRango?.commonAncestorContainer
    if (!n || !surfaceEl.contains(n)) return null
    if (n.nodeType === 3) n = n.parentNode
    while (n && n.parentNode && !esContenedorDeBloques(n.parentNode)) n = n.parentNode
    return n && esContenedorDeBloques(n.parentNode) ? n : null
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
    surfaceEl.removeEventListener('toggle', impedirPlegado, true)
  }

  // Enter en el TÍTULO de un spoiler no puede partir el <summary> en dos
  // (un details con dos resúmenes no es nada): terminar de escribir el
  // título te baja al cuerpo, que es lo que cualquiera espera.
  surfaceEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return
    const sel = document.getSelection()
    let n = sel?.anchorNode
    if (n && n.nodeType === 3) n = n.parentNode
    const resumen = n?.closest?.('summary')
    if (!resumen || !surfaceEl.contains(resumen)) return
    e.preventDefault()
    const det = resumen.parentElement
    let cuerpo = resumen.nextElementSibling
    if (!cuerpo) {
      cuerpo = document.createElement('p')
      cuerpo.innerHTML = '<br>'
      det.appendChild(cuerpo)
    }
    const r = document.createRange()
    r.selectNodeContents(cuerpo)
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
  })

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
    // NOTA: nada de execCommand('insertHTML') aquí — se probó y Chrome
    // destroza el <details>: le arranca el <summary>, lo convierte en un
    // <span> con estilos y lo deja fuera. Se construye a mano; el
    // deshacer no se pierde porque el editor lleva su propio historial.
    const sel = document.getSelection()
    const r = sel && sel.rangeCount ? sel.getRangeAt(0) : null
    const dentro = r && !sel.isCollapsed && surfaceEl.contains(r.commonAncestorContainer) ? r.extractContents() : null

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

    const bloque = bloqueDelCursor()
    // El spoiler nace DONDE ESTÁ EL CURSOR: si el cursor va por la mitad
    // de un párrafo (o un título), el bloque se parte por ahí — lo de
    // antes queda arriba, lo de después queda debajo del spoiler. Antes
    // caía entero debajo del bloque, que se leía como "se va para abajo".
    let cola = null
    const particionable = bloque && /^(P|H2|H3)$/.test(bloque.tagName)
    if (particionable && r && bloque.contains(r.startContainer)) {
      const resto = document.createRange()
      resto.selectNodeContents(bloque)
      resto.setStart(r.startContainer, r.startOffset)
      const trozo = resto.extractContents()
      if (trozo.textContent.trim() || trozo.querySelector('img, tcg-deck, yt-video')) {
        cola = document.createElement(bloque.tagName.toLowerCase())
        cola.appendChild(trozo)
      }
    }

    if (bloque) bloque.after(det)
    else surfaceEl.appendChild(det)
    if (cola) det.after(cola)
    // Si el cursor estaba al principio, el bloque de arriba se ha quedado
    // vacío: no se deja un párrafo fantasma delante del spoiler.
    if (particionable && !bloque.textContent.trim() && !bloque.querySelector('img, tcg-deck, yt-video')) {
      bloque.remove()
    }

    // Un párrafo detrás: sin él, el cursor se queda atrapado dentro del
    // spoiler y no hay forma de seguir escribiendo debajo. Es el mismo
    // problema que ya tenían las listas de cartas. (Si la partición ha
    // dejado la cola detrás, ella misma es ese sitio.)
    if (!cola && !esParrafoVacio(det.nextElementSibling)) {
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      det.after(p)
    }

    vestirSpoilers()
    // El cursor va al cuerpo del spoiler, que es donde se quiere seguir
    // escribiendo — no al resumen.
    ponerCursorEn(cuerpo)
  }

  // El aspa de "borrar el spoiler" que lleva cada pestaña DENTRO DEL
  // EDITOR. Sin ella no había forma humana de quitar un spoiler: el
  // <details> no se deja seleccionar como un bloque. Borrarlo es seguro
  // porque el historial propio lo recupera con Ctrl+Z.
  //
  // El aspa se pinta por CSS (::before), no como texto del botón, a
  // propósito: el saneador tira los <button> pero CONSERVA su texto, y un
  // aspa escrita dentro acabaría guardada en el título del spoiler.
  function vestirSpoilers() {
    surfaceEl.querySelectorAll('details > summary').forEach((sum) => {
      if (sum.querySelector('.rte-sp-quitar')) return
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'rte-sp-quitar'
      btn.setAttribute('contenteditable', 'false')
      btn.title = 'Borrar el spoiler y su contenido (Ctrl+Z lo recupera)'
      btn.setAttribute('aria-label', 'Borrar el spoiler')
      sum.appendChild(btn)
    })
  }

  surfaceEl.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.rte-sp-quitar')
    if (!btn || !surfaceEl.contains(btn)) return
    e.preventDefault()
    const det = btn.closest('details')
    if (!det) return
    // El foco estaba en el aspa, que se va con el spoiler: se devuelve al
    // editor y el cursor al hueco — sin esto, el Ctrl+Z de "uy, no quería
    // borrarlo" ya no llegaba al editor.
    const vecino = det.nextElementSibling || det.previousElementSibling
    det.remove()
    surfaceEl.focus()
    if (vecino) ponerCursorEn(vecino)
    emit()
  })

  // ── Imagen ──
  //
  // Se pueden elegir VARIAS de una vez, y se insertan una detrás de otra.
  // Es lo que hacía falta para el caso de las cartas: cuatro cartas son
  // cuatro ficheros, y elegirlos de uno en uno era abrir el diálogo cuatro
  // veces para acabar con cuatro imágenes en cuatro líneas.
  const fileInput = toolbarEl.querySelector('.rte-image-input')
  toolbarEl.querySelector('[data-action="image"]').addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => {
    const ficheros = [...fileInput.files]
    fileInput.value = ''
    subirYColocar(ficheros)
  })

  async function subirYColocar(ficheros) {
    if (ficheros.length === 0 || !uploadImage) return
    const fallos = []
    for (const file of ficheros) {
      try {
        // De una en una a propósito: cada imagen tiene que estar colocada
        // antes de insertar la siguiente, porque la siguiente se agrupa con
        // ella si las dos son cartas.
        await insertarImagen(await uploadImage(file))
      } catch (err) {
        fallos.push(err.message)
      }
    }
    if (fallos.length === 1) showToast('No se pudo subir la imagen: ' + fallos[0])
    else if (fallos.length > 1) showToast(`No se pudieron subir ${fallos.length} imágenes: ${fallos[0]}`)
  }

  // ── Pegar imágenes ──
  //
  // Una imagen no siempre entra por el diálogo. Muchas veces se pega: desde
  // otra página (viene como <img> apuntando a esa página) o desde el
  // portapapeles (viene como fichero, de una captura). Las dos formas
  // acababan en una imagen a pelo dentro de un párrafo, sin nada del
  // tratamiento de carta — que es exactamente lo que le pasó con tres cartas
  // chinas pegadas de un foro: salieron una debajo de otra.
  //
  // La forma de una imagen no depende de cómo llegó, así que el tratamiento
  // tampoco.
  surfaceEl.addEventListener('paste', (e) => {
    const ficheros = [...(e.clipboardData?.files || [])].filter((f) => (f.type || '').startsWith('image/'))
    if (ficheros.length > 0 && uploadImage) {
      // Una captura pegada la mete el navegador como `blob:` o como base64
      // gigante, y ninguna de las dos sobrevive a guardar: al recargar
      // quedaría una imagen rota. Se sube igual que si la hubiera elegido en
      // el diálogo.
      e.preventDefault()
      subirYColocar(ficheros)
      return
    }
    // Si lo pegado trae <img> de otra página, se repasan en cuanto el
    // navegador haya acabado de pegar. Y si trae spoilers (pegar un
    // trozo de otra guía), se les pone su aspa de borrar.
    setTimeout(() => {
      repasarImagenesNuevas()
      vestirSpoilers()
    }, 0)
  })

  // Arrastrar una imagen a la caja es el mismo caso que pegarla: el navegador
  // la metería como `blob:`, que no sobrevive a guardar.
  surfaceEl.addEventListener('drop', (e) => {
    const ficheros = [...(e.dataTransfer?.files || [])].filter((f) => (f.type || '').startsWith('image/'))
    // Sólo se interviene si lo que cae son imágenes: arrastrar texto dentro
    // del propio editor tiene que seguir funcionando como siempre.
    if (ficheros.length === 0 || !uploadImage) return
    e.preventDefault()
    subirYColocar(ficheros)
  })

  // ── Una imagen con forma de carta no es una imagen cualquiera ──
  //
  // Este es el problema que arregla todo lo que viene debajo:
  //
  //   "estas cartas, intento insertarlas y no existen, no están. Entonces,
  //    es un problema para mí, porque si la carta no existe, tengo que
  //    meter imágenes, y si meto imágenes y pasa lo mismo, pues estamos en
  //    un problema"
  //
  // Una carta a ancho de artículo mide unos 950×1330: cinco seguidas son
  // cinco pantallas de scroll y nadie se lee eso. Así que al insertar se
  // mira la FORMA de la imagen y, si es más alta que ancha, se trata como
  // carta: sale del tamaño de una carta y se junta con las de al lado.
  //
  // Se mira la forma y no el nombre del fichero ni un botón, porque el
  // autor no tiene por qué saber nada de esto: sube sus cuatro cartas y
  // salen bien.

  // El alto tiene que ser al menos un 15% mayor que el ancho para contar
  // como carta (una carta real es 1,4 veces más alta que ancha, así que
  // sobra margen), y medir al menos 200 px: hay guías que usan iconos
  // pequeños verticales dentro de una frase, y esos tienen que seguir
  // fluyendo con el texto.
  const esFormaDeCarta = (m) => !!m && m.h >= m.w * 1.15 && m.h >= 200

  // Cuántas cartas se dejan juntar solas en una fila. Más de ocho ya no es
  // una fila, es un álbum, y probablemente quiera una lista de cartas.
  const CARTAS_POR_FILA_MAX = 8

  // El tamaño real de una imagen ya metida en el documento. Si tarda o
  // falla, se resuelve a null y la imagen se queda como imagen normal: lo
  // que no puede pasar es que una imagen que no carga bloquee el insertarla.
  function medida(img) {
    if (img.complete && img.naturalWidth) return Promise.resolve({ w: img.naturalWidth, h: img.naturalHeight })
    return new Promise((resolve) => {
      let hecho = false
      const acabar = () => {
        if (hecho) return
        hecho = true
        resolve(img.naturalWidth ? { w: img.naturalWidth, h: img.naturalHeight } : null)
      }
      img.addEventListener('load', acabar, { once: true })
      img.addEventListener('error', acabar, { once: true })
      setTimeout(acabar, 4000)
    })
  }

  const esParrafoVacio = (el) =>
    !!el && el.tagName === 'P' && !el.textContent.trim() && !el.querySelector('img, tcg-deck, yt-video')

  const esFiguraDeCarta = (el) => !!el && el.tagName === 'FIGURE' && el.classList.contains('rt-fig-carta')

  // Una fila a la que se le puede añadir otra carta. Se pide que la última
  // que hay dentro sea una carta: si es una fila de capturas apaisadas,
  // meterle una carta la descuadra y nadie lo ha pedido.
  function filaDeCartasAbierta(el) {
    if (!el || !el.classList?.contains('rt-fila')) return null
    const figuras = [...el.querySelectorAll(':scope > figure')]
    if (figuras.length === 0 || figuras.length >= CARTAS_POR_FILA_MAX) return null
    return esFiguraDeCarta(figuras[figuras.length - 1]) ? el : null
  }

  function insertarNodoEnCursor(nodo) {
    devolverCursor()
    const sel = document.getSelection()
    const r = sel?.rangeCount ? sel.getRangeAt(0) : null
    if (!r || !surfaceEl.contains(r.commonAncestorContainer)) {
      surfaceEl.appendChild(nodo)
      return
    }
    r.deleteContents()
    r.insertNode(nodo)
    r.setStartAfter(nodo)
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
    ultimoRango = r.cloneRange()
  }

  function ponerCursorEn(el) {
    if (!el) return
    const r = document.createRange()
    r.selectNodeContents(el)
    r.collapse(true)
    const sel = document.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(r)
    ultimoRango = r.cloneRange()
  }

  // La imagen se mete PRIMERO y se decide después, cuando ya se sabe cómo
  // es. Al revés (medir antes de insertar) una imagen lenta dejaba al autor
  // mirando una pantalla en la que no pasaba nada.
  async function insertarImagen(url) {
    const img = document.createElement('img')
    img.alt = ''
    img.src = url
    insertarNodoEnCursor(img)
    // Ya está atendida: el repaso de las pegadas no tiene que volver a
    // mirarla.
    imagenesVistas.add(img)
    emit()
    const m = await medida(img)
    // Puede haberla borrado mientras cargaba.
    if (!img.isConnected || !surfaceEl.contains(img)) return
    if (esFormaDeCarta(m)) convertirEnCarta(img)
    emit()
  }

  // Lo que hace que una imagen sea una carta. No toca el cursor a propósito:
  // al insertarla hay que moverlo detrás, y al repasar lo que se acaba de
  // pegar no, porque el cursor es de quien está escribiendo.
  function hacerCarta(img) {
    const fig = asegurarFigura(img)
    fig.classList.add('rt-fig-carta')
    // Un ancho escrito a mano ganaría a la clase, y entonces marcarla como
    // carta no se notaría.
    fig.style.removeProperty('width')
    agruparConLaAnterior(fig)
    return fig
  }

  function convertirEnCarta(img) {
    const fig = hacerCarta(img)
    // Un párrafo detrás: es donde sigue escribiendo, y es lo que hace que
    // la siguiente imagen caiga pegada a esta y entre en la misma fila.
    const caja = fig.closest('.rt-fila') || fig
    if (!esParrafoVacio(caja.nextElementSibling)) {
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      caja.after(p)
    }
    ponerCursorEn(caja.nextElementSibling)
    seleccionar(img)
  }

  // ── Repasar las imágenes que han entrado por su cuenta ──
  //
  // Las que YA ESTABAN en la guía al abrirla se marcan como vistas: cambiarle
  // la maquetación de golpe a un artículo ya escrito sería tocarlo sin que
  // nadie lo haya pedido. Para esas está el botón "Tamaño carta".
  const imagenesVistas = new WeakSet()
  surfaceEl.querySelectorAll('img').forEach((img) => imagenesVistas.add(img))

  let repasando = false
  async function repasarImagenesNuevas() {
    if (repasando) return
    repasando = true
    let algo = false
    try {
      for (const img of [...surfaceEl.querySelectorAll('img')]) {
        if (imagenesVistas.has(img)) continue
        imagenesVistas.add(img)
        // Las imágenes de una lista de cartas o de la portada de un vídeo no
        // son imágenes del artículo: las pinta el propio editor y se tiran al
        // guardar. Envolverlas en una figura reventaría el bloque.
        if (img.closest('tcg-deck, yt-video, figure')) continue
        const m = await medida(img)
        if (!img.isConnected || !surfaceEl.contains(img)) continue
        if (!esFormaDeCarta(m)) continue
        hacerCarta(img)
        algo = true
      }
    } finally {
      repasando = false
    }
    if (algo) emit()
  }

  // Si justo antes hay otra carta (o una fila de cartas), se juntan. Los
  // párrafos vacíos que el propio editor deja detrás de cada imagen no
  // cuentan como "algo en medio"; un párrafo CON texto sí, porque entonces
  // el autor ha seguido escribiendo y la imagen nueva es otra cosa.
  function agruparConLaAnterior(fig) {
    let anterior = fig.previousElementSibling
    while (esParrafoVacio(anterior)) anterior = anterior.previousElementSibling
    if (!anterior) return

    const fila = filaDeCartasAbierta(anterior)
    if (fila) {
      fila.appendChild(fig)
      recolocarColumnas(fila)
      return
    }
    if (!esFiguraDeCarta(anterior)) return

    const nueva = document.createElement('div')
    nueva.className = 'rt-fila'
    anterior.before(nueva)
    nueva.appendChild(anterior)
    nueva.appendChild(fig)
    recolocarColumnas(nueva)
  }

  function recolocarColumnas(fila) {
    const cuantas = fila.querySelectorAll(':scope > figure').length
    fila.setAttribute('data-cols', String(Math.min(COLUMNAS_MAX, columnasParaCartas(cuantas))))
  }

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
  const grupoFila = toolbarEl.querySelector('[data-blockbar-fila]')
  const grupoAncho = toolbarEl.querySelector('[data-blockbar-ancho]')
  const grupoCarta = toolbarEl.querySelector('[data-blockbar-carta]')
  const btnCarta = toolbarEl.querySelector('[data-bloque="carta"]')
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
    const fila = contenedor(el).closest?.('.rt-fila')
    // "Carta" y no "Imagen" cuando se está tratando como carta: es la única
    // pista de que la imagen mide lo que mide por eso, y de que el
    // interruptor de al lado es el que lo cambia.
    const esCarta = !esCartas && contenedor(el).classList?.contains('rt-fig-carta')
    const que = esCartas ? 'Cartas' : esCarta ? 'Carta' : 'Imagen'
    nombreBarra.textContent = fila && !esCartas ? `${que} (en fila de ${fila.getAttribute('data-cols')})` : que
    grupoPie.classList.toggle('hidden', esCartas)
    // Las filas son cosa de imágenes: una lista de cartas ya es su propia
    // rejilla.
    grupoFila?.classList.toggle('hidden', esCartas)
    grupoCarta?.classList.toggle('hidden', esCartas)
    btnCarta?.setAttribute('aria-pressed', String(!!esCarta))
    // Dentro de una fila el ancho lo pone la columna, así que el control de
    // anchura se apaga en vez de quedarse ahí sin hacer nada. Un mando que
    // no responde es peor que no tener mando.
    grupoAncho?.classList.toggle('hidden', !!fila)
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
    // La figura tiene que colgar de la superficie — o del spoiler, si la
    // imagen está dentro de uno —, no quedarse dentro del párrafo: el
    // HTML no admite un <figure> dentro de un <p>, y el navegador
    // acabaría partiendo el párrafo por su cuenta. Subir siempre hasta
    // la superficie era lo que SACABA del spoiler las imágenes con forma
    // de carta nada más pegarlas.
    let bloque = el
    while (bloque.parentNode && !esContenedorDeBloques(bloque.parentNode)) bloque = bloque.parentNode
    if (esContenedorDeBloques(bloque.parentNode) && bloque !== el) {
      bloque.after(fig)
      fig.appendChild(el)
      // La pestaña del spoiler nunca se quita, aunque quede sin texto:
      // un <details> sin <summary> deja de ser un spoiler.
      if (bloque.tagName !== 'SUMMARY' && !bloque.textContent.trim() && !bloque.querySelector('img, tcg-deck, yt-video')) bloque.remove()
    } else {
      el.replaceWith(fig)
      fig.appendChild(el)
    }
    seleccionado = el
    return fig
  }

  // ── Filas de imágenes ──
  //
  // "Esta y las siguientes en una fila de N". Se coge la figura elegida y
  // las figuras que vengan justo detrás, hasta N. Si sólo hay dos y pides
  // cuatro, sale una fila de dos: es mejor que una fila de cuatro con dos
  // huecos vacíos.
  //
  // Y si la imagen YA está en una fila, el botón cambia cuántas columnas
  // tiene esa fila, que es lo que se espera al pulsar "3" estando dentro
  // de una fila de dos.
  // Un párrafo cuyo único contenido es una imagen ES una imagen suelta,
  // aunque todavía no sea una figura. Así llegan las imágenes PEGADAS de otra
  // página, y así estaban las de las guías escritas antes de todo esto: sin
  // esto, «Fila de 3» sobre tres cartas pegadas no encontraba nada que juntar
  // y no pasaba nada al pulsarlo.
  function imagenSuelta(el) {
    if (!el || el.tagName !== 'P' || el.textContent.trim()) return null
    if (el.querySelector('tcg-deck, yt-video')) return null
    const imgs = el.querySelectorAll('img')
    return imgs.length === 1 ? imgs[0] : null
  }

  // La figura de una imagen, marcándola como carta si tiene forma de carta.
  // Aquí se puede medir sin esperar: la imagen ya está en pantalla, así que
  // el navegador ya sabe cuánto mide.
  function figuraDeImagen(img) {
    if (img.tagName !== 'IMG') return asegurarFigura(img)
    const esCarta = esFormaDeCarta({ w: img.naturalWidth, h: img.naturalHeight })
    const fig = asegurarFigura(img)
    if (esCarta) {
      fig.classList.add('rt-fig-carta')
      fig.style.removeProperty('width')
    }
    return fig
  }

  function ponerEnFila(n) {
    if (!seleccionado) return
    const fig = figuraDeImagen(seleccionado)
    const filaExistente = fig.closest('.rt-fila')
    if (filaExistente) {
      filaExistente.setAttribute('data-cols', String(n))
      return emit()
    }

    // Sólo se agrupan imágenes que sean HERMANAS y estén seguidas. Un
    // párrafo de texto en medio corta: juntar dos imágenes separadas por
    // texto movería el texto de sitio sin que nadie lo haya pedido.
    //
    // Los párrafos VACÍOS sí se saltan. No son texto: son el hueco que el
    // propio editor deja detrás de cada imagen para poder seguir
    // escribiendo. Sin esto, dos imágenes que se ven pegadas no se podían
    // juntar y el botón parecía roto.
    const aMeter = [fig]
    let siguiente = fig.nextElementSibling
    while (aMeter.length < n && siguiente) {
      if (esParrafoVacio(siguiente)) {
        siguiente = siguiente.nextElementSibling
        continue
      }
      const suelta = siguiente.tagName === 'FIGURE' ? null : imagenSuelta(siguiente)
      if (siguiente.tagName !== 'FIGURE' && !suelta) break
      const tras = siguiente.nextElementSibling
      // `figuraDeImagen` se lleva la imagen a su propia figura y deja vacío
      // el párrafo donde estaba, que se borra. `tras` se ha guardado antes
      // justamente por eso.
      aMeter.push(suelta ? figuraDeImagen(suelta) : siguiente)
      siguiente = tras
    }

    const fila = document.createElement('div')
    fila.className = 'rt-fila'
    fila.setAttribute('data-cols', String(Math.max(2, aMeter.length)))
    fig.before(fila)
    aMeter.forEach((f) => {
      // El ancho de cada figura deja de mandar dentro de la fila: lo pone
      // la columna. Se quita para que al sacarla de la fila no reaparezca
      // un 25% que ya no significa nada.
      f.style.removeProperty('width')
      f.classList.remove('rt-fig-i', 'rt-fig-d')
      fila.appendChild(f)
    })
    seleccionar(seleccionado)
    emit()
  }

  // Saca UNA figura de su fila y la deja justo detrás. Si la fila se queda
  // con una sola, deja de ser una fila y se deshace: una rejilla de dos
  // columnas con una figura dentro es un hueco vacío al lado.
  function sacarUnaDeLaFila(fig) {
    const fila = fig.closest('.rt-fila')
    if (!fila) return
    fig.classList.add('rt-fig', 'rt-fig-c')
    fila.after(fig)
    const quedan = [...fila.querySelectorAll(':scope > figure')]
    if (quedan.length >= 2) {
      recolocarColumnas(fila)
      return
    }
    quedan.forEach((f) => f.classList.add('rt-fig', 'rt-fig-c'))
    fila.replaceWith(...fila.childNodes)
  }

  function sacarDeLaFila() {
    if (!seleccionado) return
    const fila = contenedor(seleccionado).closest('.rt-fila')
    if (!fila) return
    const figuras = [...fila.children]
    figuras.forEach((f) => {
      if (f.tagName === 'FIGURE') f.classList.add('rt-fig', 'rt-fig-c')
    })
    fila.replaceWith(...figuras)
    seleccionar(seleccionado)
    emit()
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

      if (accion === 'fila-no') return sacarDeLaFila()
      if (accion.startsWith('fila-')) return ponerEnFila(Number(accion.slice(5)))

      if (accion === 'carta') {
        const yaEra = asegurarFigura(seleccionado).classList.contains('rt-fig-carta')
        if (yaEra) {
          const fig = asegurarFigura(seleccionado)
          fig.classList.remove('rt-fig-carta')
          // Dentro de una fila, una figura que ya no es carta llenaría su
          // columna y saldría más grande que sus vecinas. Se sale de la fila,
          // que es lo que se está pidiendo al quitarle el tamaño de carta.
          sacarUnaDeLaFila(fig)
        } else {
          // Marcar una a mano hace lo MISMO que al insertarla, agrupar
          // incluido: es lo que arregla una guía ya escrita en un clic por
          // imagen, sin tener que acordarse de pulsar además "Fila de 3".
          hacerCarta(seleccionado)
        }
        seleccionar(seleccionado)
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
      while (bloque.parentNode && !esContenedorDeBloques(bloque.parentNode)) bloque = bloque.parentNode
      // Dentro de un spoiler, subir y bajar mueven el bloque POR el
      // spoiler; en los bordes, lo sacan: subir con la pestaña justo
      // encima lo deja delante del spoiler, bajar al final lo deja
      // detrás. Es la manera de sacar una imagen sin cortar y pegar.
      const spoilerPadre = bloque.parentNode?.tagName === 'DETAILS' ? bloque.parentNode : null

      if (accion === 'subir') {
        const previo = bloque.previousElementSibling
        if (spoilerPadre && (!previo || previo.tagName === 'SUMMARY')) spoilerPadre.before(bloque)
        else if (previo) previo.before(bloque)
        return emit()
      }
      if (accion === 'bajar') {
        const siguiente = bloque.nextElementSibling
        if (spoilerPadre && !siguiente) spoilerPadre.after(bloque)
        else if (siguiente) siguiente.after(bloque)
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

  // El tecleo se marca para que el historial fusione las letras seguidas
  // en una sola entrada; todo lo demás (spoilers, imágenes, bloques)
  // apunta entrada propia y Ctrl+Z lo deshace de un golpe.
  surfaceEl.addEventListener('input', () => {
    tecleando = true
    emit()
    tecleando = false
  })
  surfaceEl.addEventListener('blur', emit)

  // El repaso va también aquí, y no sólo en el `paste`: una imagen puede
  // aparecer por caminos que no controlamos (pegar con el menú del
  // navegador, arrastrarla, deshacer y volver a hacer). `input` los cubre
  // todos, y para las que ya estén vistas no hace nada.
  surfaceEl.addEventListener('input', repasarImagenesNuevas)
}
