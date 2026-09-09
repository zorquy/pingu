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

// La parrilla del botón de emojis. Son CONTENIDO (van al texto, como los
// de las reacciones), no interfaz — la interfaz va con iconos SVG. Lista
// corta y curada: caras, manos y el atrezzo del sitio; para todo lo demás
// está el selector del sistema operativo.
const EMOJIS = [
  '😀', '😄', '😂', '🤣', '😊', '😉', '😍', '😎',
  '🤔', '😅', '🙃', '😇', '😴', '😢', '😭', '😡',
  '🤯', '😱', '🥳', '🤝', '👍', '👎', '👏', '🙏',
  '💪', '👀', '❤️', '💙', '💛', '💔', '🔥', '✨',
  '⭐', '⚡', '💧', '🌱', '🎉', '🏆', '🎯', '🎲',
]

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
    <span class="rte-color-wrap">
      <button type="button" data-action="emoji" title="Insertar un emoji">${icons.smile(15)}</button>
      <div class="rte-paleta rte-paleta-emojis hidden" data-paleta="emojis">
        ${EMOJIS.map((e) => `<button type="button" data-emoji="${e}">${e}</button>`).join('')}
      </div>
    </span>
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
    sanearEstructura()
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

  // Solo los botones CON color: la paleta de emojis comparte la clase
  // rte-paleta (y el cierre al pinchar fuera), pero no es un color.
  toolbarEl.querySelectorAll('.rte-paleta button[data-color]').forEach((btn) => {
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

  // ── Emojis ──
  //
  // Se insertan como TEXTO con insertText: pasan por la pila de entrada
  // normal, así que el historial los apunta y el saneador los deja pasar
  // como cualquier otra letra. Valen también en el título de un spoiler.
  const btnEmoji = toolbarEl.querySelector('[data-action="emoji"]')
  if (btnEmoji) {
    btnEmoji.addEventListener('click', (e) => {
      e.preventDefault()
      const paleta = btnEmoji.parentElement.querySelector('.rte-paleta-emojis')
      const abierta = !paleta.classList.contains('hidden')
      cerrarPaletas()
      paleta.classList.toggle('hidden', abierta)
    })
  }
  toolbarEl.querySelectorAll('.rte-paleta button[data-emoji]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault()
      cerrarPaletas()
      devolverCursor()
      if (!ordenSilenciosa('insertText', btn.dataset.emoji)) {
        // Reserva por si insertText no está: el mismo camino manual que
        // usan las imágenes.
        insertarNodoEnCursor(document.createTextNode(btn.dataset.emoji))
      }
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

  // ── Red de seguridad estructural ──
  //
  // El contenteditable del navegador no sabe qué es un spoiler y lo
  // rompe de formas que ninguna escucha puede cubrir del todo. La peor,
  // vista en producción: Enter con el cursor "suelto" entre bloques de
  // un <details> (justo después de una fila de cartas) hace que Chrome
  // PARTA el details en dos — y la segunda mitad nace sin <summary>, así
  // que el navegador le pinta su marcador por defecto ("Detalles"), un
  // bloque fantasma que no se puede ni seleccionar ni borrar.
  //
  // Las escuchas de teclado de abajo evitan los caminos conocidos; esto
  // repara CUALQUIER estado inválido en cuanto aparece, venga por donde
  // venga (una tecla rara, un pegado, un arrastre). Se ejecuta en cada
  // emit, así que un bloque fantasma no llega a verse.
  function sanearEstructura() {
    let toco = false
    for (const det of [...surfaceEl.querySelectorAll('details')]) {
      if (det.closest('tcg-deck, yt-video')) continue
      // Un details sin pestaña no es un spoiler: es el fantasma de arriba.
      // Su contenido (si lo tiene) se saca fuera, y él desaparece.
      const pestañas = [...det.children].filter((c) => c.tagName === 'SUMMARY')
      if (pestañas.length === 0) {
        det.replaceWith(...det.childNodes)
        toco = true
        continue
      }
      // La pestaña va la primera; si un pegado o un borrado la descoloca,
      // se recoloca.
      if (det.firstElementChild !== pestañas[0]) {
        det.prepend(pestañas[0])
        toco = true
      }
      // Un details con dos pestañas no es nada: las de más se vuelven párrafos.
      for (const extra of pestañas.slice(1)) {
        extra.querySelector(':scope > .rte-sp-quitar')?.remove()
        const p = document.createElement('p')
        p.append(...extra.childNodes)
        if (!p.textContent.trim() && !p.querySelector('img, tcg-deck, yt-video')) p.innerHTML = '<br>'
        extra.replaceWith(p)
        toco = true
      }
    }
    // Una pestaña huérfana (fuera de un details) tampoco es nada.
    for (const sum of [...surfaceEl.querySelectorAll('summary')]) {
      if (sum.parentElement?.tagName === 'DETAILS' || sum.closest('tcg-deck, yt-video')) continue
      sum.querySelector(':scope > .rte-sp-quitar')?.remove()
      const p = document.createElement('p')
      p.append(...sum.childNodes)
      if (!p.textContent.trim() && !p.querySelector('img, tcg-deck, yt-video')) p.innerHTML = '<br>'
      sum.replaceWith(p)
      toco = true
    }
    // Una fila sin figuras es un hueco; con una sola, un hueco al lado.
    for (const fila of [...surfaceEl.querySelectorAll('.rt-fila')]) {
      if (fila.closest('tcg-deck, yt-video')) continue
      const figs = fila.querySelectorAll(':scope > figure')
      if (figs.length === 0) {
        fila.remove()
        toco = true
      } else if (figs.length === 1) {
        figs[0].classList.add('rt-fig', 'rt-fig-c')
        fila.replaceWith(...fila.childNodes)
        toco = true
      }
    }
    // Una figura sin imagen dentro no es una figura: es texto metido en
    // una caja que no le corresponde. Pasaba al seleccionar toda la guía y
    // escribir encima: el navegador vaciaba la figura pero la dejaba ahí, y
    // lo tecleado acababa DENTRO de ella. Lo que hubiera se conserva como
    // párrafo — borrar lo escrito por alguien, nunca.
    for (const fig of [...surfaceEl.querySelectorAll('figure')]) {
      if (fig.closest('tcg-deck, yt-video')) continue
      if (fig.querySelector('img, tcg-deck, yt-video')) continue
      const p = document.createElement('p')
      const texto = fig.textContent.trim()
      if (texto) p.textContent = texto
      else p.innerHTML = '<br>'
      // Si el cursor estaba dentro —y lo está, porque esto pasa MIENTRAS
      // escribes—, se lleva al párrafo nuevo. Sin esto las letras salían
      // desordenadas: la primera se quedaba en su sitio y las siguientes
      // se escribían delante.
      const sel = document.getSelection()
      const teniaElCursor = sel?.rangeCount ? fig.contains(sel.getRangeAt(0).startContainer) : false
      fig.replaceWith(p)
      if (teniaElCursor) ponerCursorAlFinalDe(p)
      toco = true
    }
    // Borrarlo todo no puede dejar la superficie sin su párrafo semilla
    // (pasaba al quitar con el aspa el único spoiler del texto).
    if (!surfaceEl.firstElementChild && !surfaceEl.textContent.trim()) {
      surfaceEl.innerHTML = '<p><br></p>'
      toco = true
    }
    // Si el artículo TERMINA en una pieza, no hay dónde poner el cursor
    // para seguir escribiendo: se deja un párrafo detrás. Es lo mismo que
    // hacen los editores de Medium o WordPress por la misma razón.
    const ultimo = surfaceEl.lastElementChild
    if (ultimo && esBloqueOpaco(ultimo)) {
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      surfaceEl.appendChild(p)
      toco = true
    }
    vestirPiezas()
    if (toco) vestirSpoilers()
    return toco
  }

  // ── Las fronteras del spoiler son paredes, no membranas ──
  //
  // El borrado del navegador FUNDE bloques a través de cualquier borde:
  // Backspace al principio del cuerpo metía el cuerpo EN la pestaña,
  // Supr al final de la pestaña se tragaba el cuerpo, y Backspace justo
  // debajo de un spoiler teletransportaba el párrafo adentro. Aquí el
  // cursor CRUZA la frontera pero nunca arrastra contenido a través:
  // para meter o sacar algo están las flechas de mover bloque y el
  // cortar y pegar de siempre.
  const esBloqueOpaco = (el) =>
    !!el && (el.classList?.contains('rt-fila') || /^(FIGURE|TCG-DECK|YT-VIDEO|HR)$/.test(el.tagName))

  // ── Una imagen es una PIEZA, no un párrafo (tanda 268) ──
  //
  // Las listas de cartas y los vídeos ya eran `contenteditable="false"`
  // desde que se hicieron. Las imágenes no, y por eso se portaban tan
  // mal: para el navegador una <figure> editable es un bloque de texto
  // más, y hacía con ella lo que hace con un párrafo.
  //
  //   - Backspace al principio del párrafo de debajo se llevaba por
  //     delante EL PÁRRAFO ENTERO. Escribías un texto debajo de tus
  //     cartas, tocabas Backspace en el sitio equivocado y desaparecía.
  //   - Seleccionar todo y escribir encima dejaba la guía entera DENTRO
  //     de una <figure>, con letras perdidas y cambiadas de orden.
  //   - Pinchar entre dos cartas de una fila y escribir: lo escrito se
  //     perdía sin dejar rastro.
  //
  // Eso no se arregla caso por caso: la pieza tiene que ser una pieza.
  // Es lo que hacen Medium, Notion y el editor de WordPress —el bloque
  // de imagen no se puede pisar con el cursor, y lo único que se escribe
  // dentro es el pie de foto—, y aquí ya estaba hecho para las cartas y
  // los vídeos: esto lo único que hace es tratar las imágenes igual.
  //
  // El atributo NO se guarda con la guía: no está en la lista blanca del
  // saneador, así que se cae al salir. Vive sólo mientras editas.
  function vestirPiezas() {
    for (const pieza of surfaceEl.querySelectorAll('figure, .rt-fila')) {
      if (pieza.closest('tcg-deck, yt-video')) continue
      if (pieza.getAttribute('contenteditable') !== 'false') pieza.setAttribute('contenteditable', 'false')
    }
    // El pie de foto es la excepción: es lo único de dentro que se
    // escribe, así que se vuelve a abrir a mano.
    for (const pie of surfaceEl.querySelectorAll('figure > figcaption')) {
      if (pie.getAttribute('contenteditable') !== 'true') pie.setAttribute('contenteditable', 'true')
    }
  }

  // La imagen que representa a una pieza, para poder elegirla con la
  // barra de bloque. De una fila, la de un extremo: al llegar por arriba
  // interesa la última, y al llegar por abajo la primera.
  const imagenDeLaPieza = (pieza, cual = 'primera') => {
    if (!pieza) return null
    if (pieza.tagName === 'TCG-DECK') return pieza
    const imgs = [...pieza.querySelectorAll('img')]
    if (imgs.length === 0) return null
    return cual === 'ultima' ? imgs[imgs.length - 1] : imgs[0]
  }

  // Una fila con un hueco menos. Si el número de columnas que se eligió
  // ya no cabe, se ajusta; al revés no se toca — quitar una carta de una
  // fila de 3 que tenía cuatro dentro no tiene por qué cambiar nada.
  const encogerColumnas = (fila) => {
    if (!fila) return
    const figs = fila.querySelectorAll(':scope > figure').length
    const cols = parseInt(fila.getAttribute('data-cols'), 10) || figs
    if (figs >= 2 && cols > figs) fila.setAttribute('data-cols', String(figs))
  }

  const bloqueDe = (nodo) => {
    let n = nodo
    if (n.nodeType === 3) n = n.parentNode
    if (!n || esContenedorDeBloques(n)) return null
    while (n.parentNode && !esContenedorDeBloques(n.parentNode)) n = n.parentNode
    return esContenedorDeBloques(n.parentNode) ? n : null
  }

  // ¿Está el cursor al principio (o al final) de este bloque? Se mira el
  // CONTENIDO entre el borde y el cursor, no los offsets: un <br> inicial
  // o el aspa de la pestaña (que no llevan texto) no cuentan.
  const trozoVacio = (q) => q.toString() === '' && !q.cloneContents().querySelector('img, tcg-deck, yt-video, figure')
  const alPrincipioDe = (el, r) => {
    const q = document.createRange()
    q.selectNodeContents(el)
    q.setEnd(r.startContainer, r.startOffset)
    return trozoVacio(q)
  }
  const alFinalDe = (el, r) => {
    const q = document.createRange()
    q.selectNodeContents(el)
    q.setStart(r.startContainer, r.startOffset)
    return trozoVacio(q)
  }

  const ponerCursorAlFinalDe = (el) => {
    if (!el) return
    const r = document.createRange()
    const aspa = el.tagName === 'SUMMARY' ? el.querySelector(':scope > .rte-sp-quitar') : null
    if (aspa) r.setEnd(el, [...el.childNodes].indexOf(aspa))
    else {
      r.selectNodeContents(el)
    }
    r.collapse(false)
    const sel = document.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(r)
    ultimoRango = r.cloneRange()
  }

  // ── Borrar lo que abarca la selección cuando el navegador no quiere ──
  //
  // En cuanto la selección toca una pieza que no es editable, el navegador
  // se planta: ni borra ni escribe encima. Se queda TODO como estaba y
  // parece que el editor se ha colgado (seleccionar el artículo entero y
  // teclear encima no hacía nada).
  //
  // `deleteContents` de un rango es una operación del DOM, no de edición:
  // no le importa quién es editable y quién no, así que sí se lleva la
  // fila. Devuelve `true` si ha tenido que encargarse él.
  function borrarSeleccionAMano() {
    const sel = document.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false
    const r = sel.getRangeAt(0)
    if (!surfaceEl.contains(r.commonAncestorContainer)) return false
    const piezas = [...surfaceEl.querySelectorAll('.rt-fila, figure, tcg-deck, yt-video')]
    // Si no hay ninguna pieza por medio, el navegador ya sabe hacerlo solo
    // y lo hace mejor (respeta formatos, listas, el historial nativo).
    if (!piezas.some((pieza) => r.intersectsNode(pieza))) return false
    r.deleteContents()
    r.collapse(true)
    sel.removeAllRanges()
    sel.addRange(r)
    sanearEstructura()
    // Si no ha quedado sitio donde escribir, el saneo ha repuesto el
    // párrafo semilla: el cursor va a él.
    if (!surfaceEl.contains(document.getSelection()?.anchorNode || null)) {
      ponerCursorEn(surfaceEl.querySelector('p') || surfaceEl.firstElementChild)
    }
    return true
  }

  // Escribir encima de una selección así: primero se quita a mano lo
  // seleccionado y luego el navegador escribe donde queda el cursor.
  surfaceEl.addEventListener('beforeinput', (e) => {
    if (!e.inputType?.startsWith('insert')) return
    borrarSeleccionAMano()
  })

  surfaceEl.addEventListener('keydown', (e) => {
    // ── Ctrl+A ──
    //
    // Con la primera cosa del artículo no editable —una imagen, una fila
    // de cartas—, el «seleccionar todo» del navegador no selecciona NADA:
    // se planta en el primer sitio donde no puede escribir y se rinde. Así
    // que se hace a mano, que además es exacto: de la primera letra a la
    // última.
    if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === 'a' || e.key === 'A')) {
      const s = document.getSelection()
      if (!s) return
      // Dentro de un pie de foto, «seleccionar todo» es el pie, no el
      // artículo entero: ahí el navegador ya acierta.
      let donde = s.anchorNode
      if (donde?.nodeType === 3) donde = donde.parentNode
      if (donde?.closest?.('figcaption')) return
      e.preventDefault()
      const todo = document.createRange()
      todo.selectNodeContents(surfaceEl)
      s.removeAllRanges()
      s.addRange(todo)
      return
    }
    if (e.key !== 'Enter' && e.key !== 'Backspace' && e.key !== 'Delete') return
    if (e.isComposing || e.defaultPrevented) return
    const sel = document.getSelection()
    if (!sel || sel.rangeCount === 0) return
    // Con algo seleccionado, borrar es borrar la selección (nativo y
    // correcto). El Enter sí se mira: escribir un pie de foto lo deja
    // seleccionado, y Enter sobre esa selección partía el pie en dos.
    if (!sel.isCollapsed && (e.key === 'Backspace' || e.key === 'Delete') && borrarSeleccionAMano()) {
      e.preventDefault()
      emit()
      return
    }
    if (!sel.isCollapsed && e.key !== 'Enter') return
    const r = sel.getRangeAt(0)
    if (!surfaceEl.contains(r.startContainer)) return

    let n = r.startContainer
    if (n.nodeType === 3) n = n.parentNode
    const sobreContenedor = esContenedorDeBloques(n) ? n : null
    const bloque = sobreContenedor ? null : bloqueDe(n)
    if (!sobreContenedor && !bloque) return
    const padre = bloque?.parentNode

    if (e.key === 'Enter') {
      // El Enter en la pestaña ya lo lleva la escucha de arriba. Con
      // Ctrl no es un salto de párrafo, y el Shift+Enter (salto de
      // línea) solo se toca donde un <br> suelto haría daño: con el
      // cursor directamente sobre el contenedor.
      if (e.ctrlKey || e.metaKey) return
      if (e.shiftKey && !sobreContenedor) return
      if (n.closest?.('summary')) return

      // Cursor "suelto" entre bloques, o dentro de un bloque que no es de
      // texto (una fila, una figura — Enter en el pie de foto incluido):
      // el Enter nativo aquí es el que parte el <details> en dos. Se
      // inserta un párrafo a mano, donde está el cursor.
      if (sobreContenedor || esBloqueOpaco(bloque)) {
        e.preventDefault()
        if (!sel.isCollapsed) r.deleteContents()
        const p = document.createElement('p')
        p.innerHTML = '<br>'
        if (bloque) {
          bloque.after(p)
        } else if (r.startContainer === sobreContenedor) {
          const hijos = sobreContenedor.childNodes
          let antes = hijos[Math.min(r.startOffset, hijos.length) - 1] || null
          // La pestaña siempre queda delante: en un spoiler, "al
          // principio" es justo después de ella.
          if (sobreContenedor.tagName === 'DETAILS' && !antes) antes = sobreContenedor.firstElementChild
          if (antes) antes.after(p)
          else sobreContenedor.appendChild(p)
        } else if (r.startContainer.nodeType === 3 && r.startContainer.parentNode === sobreContenedor) {
          // Texto suelto colgando directamente del contenedor: el
          // párrafo nuevo va justo detrás de él.
          r.startContainer.after(p)
        } else {
          sobreContenedor.appendChild(p)
        }
        ponerCursorEn(p)
        emit()
        return
      }

      // Enter en el párrafo vacío del FINAL del spoiler = salir de él,
      // como el doble Enter que cierra una lista. Sin esto no había
      // manera obvia de "terminar" el spoiler y seguir escribiendo debajo.
      if (
        padre?.tagName === 'DETAILS' &&
        esParrafoVacio(bloque) &&
        !bloque.nextElementSibling &&
        bloque.previousElementSibling?.tagName !== 'SUMMARY'
      ) {
        e.preventDefault()
        padre.after(bloque)
        ponerCursorEn(bloque)
        emit()
        return
      }
      return
    }

    if (e.key === 'Backspace') {
      if (!bloque || !alPrincipioDe(bloque, r)) return
      // Al principio de la pestaña: no fundirla con lo de fuera.
      if (bloque.tagName === 'SUMMARY') {
        e.preventDefault()
        ponerCursorAlFinalDe(padre.previousElementSibling)
        return
      }
      // Al principio del primer bloque del cuerpo: no meterlo en la
      // pestaña. Un párrafo vacío de más sí se quita, si no es el único.
      if (padre?.tagName === 'DETAILS' && bloque.previousElementSibling?.tagName === 'SUMMARY') {
        e.preventDefault()
        const pestaña = bloque.previousElementSibling
        if (esParrafoVacio(bloque) && bloque.nextElementSibling) {
          bloque.remove()
          emit()
        }
        ponerCursorAlFinalDe(pestaña)
        return
      }
      // Justo debajo de una imagen o de una fila de cartas.
      //
      // Aquí el navegador se comía el PÁRRAFO ENTERO —el texto que
      // hubieras escrito debajo de las cartas, desaparecido de un
      // Backspace—. Ahora la primera pulsación ELIGE la pieza de arriba
      // (sale su barra, con su aspa) y no borra nada; la segunda, ya con
      // la pieza elegida, sí la quita. Dos pasos, como en Notion: la
      // primera te enseña qué vas a borrar.
      const previo = bloque.previousElementSibling
      if (esBloqueOpaco(previo)) {
        e.preventDefault()
        const yaElegida = seleccionado && previo.contains(contenedor(seleccionado))
        if (yaElegida) {
          previo.remove()
          deseleccionar()
          emit()
          return
        }
        // El párrafo vacío sí se va: es lo que estás pidiendo al borrar
        // hacia atrás desde una línea en blanco.
        if (esParrafoVacio(bloque) && (bloque.nextElementSibling || bloque.previousElementSibling)) {
          bloque.remove()
          emit()
        }
        seleccionar(imagenDeLaPieza(previo, 'ultima') || previo)
        return
      }
      if (previo?.tagName === 'DETAILS') {
        e.preventDefault()
        if (esParrafoVacio(bloque) && bloque.nextElementSibling) {
          bloque.remove()
          emit()
        }
        const cuerpo = [...previo.children].filter((c) => c.tagName !== 'SUMMARY')
        ponerCursorAlFinalDe(cuerpo[cuerpo.length - 1] || previo.firstElementChild)
        return
      }
      return
    }

    // Supr: el espejo exacto del Backspace.
    if (!bloque || !alFinalDe(bloque, r)) return
    if (bloque.tagName === 'SUMMARY') {
      e.preventDefault()
      let cuerpo = bloque.nextElementSibling
      if (!cuerpo) {
        cuerpo = document.createElement('p')
        cuerpo.innerHTML = '<br>'
        padre.appendChild(cuerpo)
      }
      ponerCursorEn(cuerpo)
      return
    }
    if (padre?.tagName === 'DETAILS' && !bloque.nextElementSibling) {
      e.preventDefault()
      const fuera = padre.nextElementSibling
      if (fuera?.tagName === 'DETAILS') ponerCursorEn(fuera.querySelector(':scope > summary') || fuera)
      else if (fuera) ponerCursorEn(fuera)
      return
    }
    const siguiente = bloque.nextElementSibling
    // El espejo del Backspace: Supr al final del párrafo que va justo
    // encima de una imagen la elige, y la segunda vez la quita.
    if (esBloqueOpaco(siguiente)) {
      e.preventDefault()
      const yaElegida = seleccionado && siguiente.contains(contenedor(seleccionado))
      if (yaElegida) {
        siguiente.remove()
        deseleccionar()
        emit()
        return
      }
      seleccionar(imagenDeLaPieza(siguiente) || siguiente)
      return
    }
    if (siguiente?.tagName === 'DETAILS') {
      e.preventDefault()
      ponerCursorEn(siguiente.querySelector(':scope > summary') || siguiente)
    }
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
    // Si era lo único que había, el saneo del emit acaba de reponer el
    // párrafo semilla: el cursor va a él.
    if (!vecino) ponerCursorEn(surfaceEl.firstElementChild)
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

  // Un párrafo que sólo lleva imágenes NO es un párrafo con texto: es una
  // pila de imágenes, y cada una de ellas es un bloque. Así llegan las que
  // se pegan de otra web —tres cartas seguidas caen dentro del MISMO <p>—
  // y las que se suben de golpe. Devuelve sus imágenes en orden, o nada si
  // el bloque no es de esos.
  function imagenesDeBloque(el) {
    if (!el || el.tagName !== 'P' || el.textContent.trim()) return []
    if (el.querySelector('tcg-deck, yt-video, figure')) return []
    return [...el.querySelectorAll('img')]
  }

  // Desmonta ese párrafo: una figura por imagen, EN ORDEN, y el párrafo
  // fuera. Hay que hacerlo ANTES de tocar cualquiera de esas imágenes.
  // Sacándolas de una en una —que es lo que hacía `asegurarFigura`— la
  // figura nueva caía DETRÁS del párrafo, con las otras todavía dentro:
  // tres cartas pegadas de una web salían del revés (3, 2, 1), cada una en
  // su línea, y ninguna se juntaba con la de al lado.
  function desmontarParrafoDeImagenes(p) {
    const imgs = imagenesDeBloque(p)
    if (imgs.length === 0) return []
    const figuras = imgs.map((img) => {
      const fig = document.createElement('figure')
      fig.className = 'rt-fig rt-fig-c'
      // Sólo se marca como carta lo que ya se puede medir. Una imagen que
      // aún no ha cargado se queda como figura normal y el repaso de
      // imágenes nuevas la marcará cuando sepa cuánto mide.
      if (esFormaDeCarta({ w: img.naturalWidth, h: img.naturalHeight })) fig.classList.add('rt-fig-carta')
      fig.appendChild(img)
      return fig
    })
    p.replaceWith(...figuras)
    return figuras
  }

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
      // Se recogen TODAS antes de tocar ninguna. Tratándolas sobre la
      // marcha, convertir la primera desmonta su párrafo y mueve de sitio a
      // las que venían detrás: el recorrido se perdía y salían del revés.
      const nuevas = [...surfaceEl.querySelectorAll('img')].filter((img) => {
        if (imagenesVistas.has(img)) return false
        imagenesVistas.add(img)
        // Las imágenes de una lista de cartas o de la portada de un vídeo no
        // son imágenes del artículo: las pinta el propio editor y se tiran al
        // guardar. Envolverlas en una figura reventaría el bloque.
        return !img.closest('tcg-deck, yt-video, figure')
      })
      for (const img of nuevas) {
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

  // Las filas cuyas columnas ha elegido una persona con los botones. No se
  // guarda en el HTML a propósito —`data-cols` ya lleva el número—: es para
  // que añadir otra carta a una fila de 3 no la devuelva sola a 4 columnas,
  // que era otra de las veces en que el editor «hacía lo que le daba la
  // gana» después de haberle dicho lo que se quería.
  const columnasAMano = new WeakSet()

  function recolocarColumnas(fila) {
    if (columnasAMano.has(fila)) return
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
  const btnSubir = toolbarEl.querySelector('[data-bloque="subir"]')
  const btnBajar = toolbarEl.querySelector('[data-bloque="bajar"]')
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
    // Dentro de una fila, «arriba» y «abajo» son «antes» y «después» EN LA
    // FILA: las flechas mueven la carta de sitio entre sus compañeras, así
    // que dicen lo que hacen en vez de apuntar a un sitio que no existe.
    const enFila = !!fila && !esCartas
    if (btnSubir) {
      btnSubir.textContent = enFila ? '←' : '↑'
      btnSubir.title = enFila ? 'Mover una posición antes en la fila (en el borde, sacarla de la fila)' : 'Mover arriba'
    }
    if (btnBajar) {
      btnBajar.textContent = enFila ? '→' : '↓'
      btnBajar.title = enFila ? 'Mover una posición después en la fila (en el borde, sacarla de la fila)' : 'Mover abajo'
    }
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

    // Varias imágenes en el mismo párrafo: se desmonta ENTERO y en orden.
    // Sacar sólo la que se ha tocado la dejaba debajo de sus compañeras.
    if (el.tagName === 'IMG' && imagenesDeBloque(bloqueDe(el)).length > 1) {
      desmontarParrafoDeImagenes(bloqueDe(el))
      seleccionado = el
      return el.closest('figure')
    }

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

  // Las imágenes que entrarían en la fila, en orden y SIN tocar nada
  // todavía. Se cuentan antes de mover nada a propósito: con menos de dos
  // no hay fila, y lo que NO puede pasar es dejar el documento a medias.
  // Era justo lo que hacía antes: sacaba la imagen elegida de su párrafo,
  // la dejaba caer DEBAJO de las demás y encima avisaba de que no había
  // nada que juntar —«se pone abajo en vez de en la fila»—.
  //
  // Cuenta como «seguida» lo que de verdad se ve seguido: una figura, un
  // párrafo de sólo imágenes (aunque lleve varias dentro) y los párrafos
  // vacíos que el propio editor deja de hueco. Un párrafo CON texto corta:
  // juntar dos imágenes separadas por texto movería el texto de sitio sin
  // que nadie lo haya pedido.
  function candidatasParaFila(n) {
    const lista = []
    const fig = seleccionado.closest?.('figure')
    const bloque = fig || bloqueDe(seleccionado)
    if (!bloque) return lista

    if (fig) lista.push(fig)
    else {
      const hermanas = imagenesDeBloque(bloque)
      const desde = hermanas.indexOf(seleccionado)
      // Una imagen metida en un párrafo con texto va sola: la fila empieza
      // en ella, pero sus vecinas de línea son texto, no imágenes.
      if (desde < 0) lista.push(seleccionado)
      else for (const img of hermanas.slice(desde)) if (lista.length < n) lista.push(img)
    }

    let sig = bloque.nextElementSibling
    while (lista.length < n && sig) {
      if (esParrafoVacio(sig)) {
        sig = sig.nextElementSibling
        continue
      }
      if (sig.tagName === 'FIGURE') {
        lista.push(sig)
        sig = sig.nextElementSibling
        continue
      }
      const imgs = imagenesDeBloque(sig)
      if (imgs.length === 0) break
      for (const img of imgs) if (lista.length < n) lista.push(img)
      sig = sig.nextElementSibling
    }
    return lista
  }

  function ponerEnFila(n) {
    if (!seleccionado) return

    // Si ya está en una fila, el botón cambia cuántas columnas tiene esa
    // fila: es lo que se espera al pulsar «3» estando dentro de una de dos.
    const filaExistente = contenedor(seleccionado).closest('.rt-fila')
    if (filaExistente) {
      filaExistente.setAttribute('data-cols', String(n))
      columnasAMano.add(filaExistente)
      return emit()
    }

    // Si sólo hay dos y pides cuatro, sale una fila de dos: es mejor que
    // una fila de cuatro con dos huecos vacíos.
    const elegidas = candidatasParaFila(n)
    if (elegidas.length < 2) {
      showToast('Para hacer una fila hace falta otra imagen justo detrás, sin texto en medio.')
      return
    }

    // Primero se desmontan los párrafos de sólo imágenes: al acabar, cada
    // elegida está en su propia figura y en su sitio, que es lo que hace
    // falta para tener DÓNDE plantar la fila.
    const parrafos = new Set(elegidas.filter((e) => e.tagName === 'IMG').map((img) => bloqueDe(img)))
    parrafos.forEach(desmontarParrafoDeImagenes)
    const figuras = elegidas.map((e) => (e.tagName === 'FIGURE' ? e : e.closest('figure') || figuraDeImagen(e)))

    const fila = document.createElement('div')
    fila.className = 'rt-fila'
    fila.setAttribute('data-cols', String(Math.max(2, figuras.length)))
    columnasAMano.add(fila)
    figuras[0].before(fila)
    figuras.forEach((f) => {
      // El ancho de cada figura deja de mandar dentro de la fila: lo pone
      // la columna. Se quita para que al sacarla de la fila no reaparezca
      // un 25% que ya no significa nada.
      f.style.removeProperty('width')
      f.classList.remove('rt-fig-i', 'rt-fig-d')
      fila.appendChild(f)
    })

    // Un párrafo detrás de la fila, y el cursor dentro. El párrafo en el que
    // estaba escribiendo se ha ido con las imágenes, y sin esto la selección
    // se cae al principio de la superficie: lo siguiente que escribes o
    // insertas aparece ARRIBA DEL TODO en vez de debajo de la fila.
    if (!esParrafoVacio(fila.nextElementSibling)) {
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      fila.after(p)
    }
    ponerCursorEn(fila.nextElementSibling)
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
          // Editable YA, antes de enfocarlo: el repaso que se lo pone a
          // todos corre al final del `emit`, y para entonces ya se habría
          // intentado escribir en algo que no admitía cursor.
          pie.setAttribute('contenteditable', 'true')
          fig.appendChild(pie)
        }
        // Se deja el texto seleccionado para poder escribir encima sin
        // tener que borrarlo antes.
        // La figura es una pieza no editable y el pie es la única isla
        // que sí lo es: hay que enfocar EL PIE. Enfocando la superficie,
        // el cursor no llegaba a entrar y lo que escribías se perdía.
        pie.focus()
        const r = document.createRange()
        r.selectNodeContents(pie)
        const sel = document.getSelection()
        sel.removeAllRanges()
        sel.addRange(r)
        return emit()
      }

      const caja = contenedor(seleccionado)

      // ── Dentro de una fila, ↑ y ↓ mueven la CARTA, no la fila ──
      //
      // Antes subían hasta el bloque de arriba del todo, que dentro de una
      // fila es la fila entera: pulsabas la flecha con una carta elegida y
      // no pasaba nada, o se movía la fila completa. Ordenar las cartas de
      // una fila era imposible.
      //
      // En los extremos la carta SALE de la fila, delante o detrás. Es la
      // manera de sacar una sola sin deshacerla entera, y sigue leyéndose
      // como «muévela una posición antes / después».
      const filaDeLaCaja = caja.tagName === 'FIGURE' ? caja.parentElement?.closest?.('.rt-fila') : null
      if (filaDeLaCaja && (accion === 'subir' || accion === 'bajar')) {
        const hermanas = [...filaDeLaCaja.querySelectorAll(':scope > figure')]
        const i = hermanas.indexOf(caja)
        const alPrincipio = accion === 'subir' && i <= 0
        const alFinal = accion === 'bajar' && i >= hermanas.length - 1
        if (alPrincipio || alFinal) {
          caja.classList.add('rt-fig', 'rt-fig-c')
          if (alPrincipio) filaDeLaCaja.before(caja)
          else filaDeLaCaja.after(caja)
          encogerColumnas(filaDeLaCaja)
        } else if (accion === 'subir') {
          hermanas[i - 1].before(caja)
        } else {
          hermanas[i + 1].after(caja)
        }
        seleccionar(seleccionado)
        return emit()
      }

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
        // La fila de la que sale se queda con un hueco: si el número de
        // columnas ya no cabe, se ajusta. Sin esto, quitar una carta de
        // una fila de tres dejaba un vacío en su sitio.
        const suFila = caja.parentElement?.closest?.('.rt-fila')
        caja.remove()
        encogerColumnas(suFila)
        deseleccionar()
        return emit()
      }
    })
  })

  // El cursor a un sitio donde de verdad se pueda escribir, el más cercano
  // a esta pieza. Hace falta porque una pieza no es editable: pinchar en
  // el hueco que queda entre dos cartas de una fila dejaba el cursor en
  // tierra de nadie y lo que escribías DESAPARECÍA.
  //
  // Y va ARRIBA o ABAJO según por dónde hayas pinchado, comparando con la
  // mitad de la pieza. Es lo que resuelve el callejón sin salida de un
  // artículo que EMPIEZA por una imagen: sin esto no había manera de
  // poner el cursor por encima para escribir la entradilla.
  function cursorJuntoA(pieza, arriba, crear = true) {
    // Pinchar en una pieza no da el foco a la superficie —la pieza no es
    // editable—, y sin foco el cursor que se coloque aquí no vale para
    // nada: el Ctrl+A siguiente selecciona la página entera y lo que
    // escribas no llega. Se lo damos a mano.
    surfaceEl.focus()
    const vecino = arriba ? pieza.previousElementSibling : pieza.nextElementSibling
    if (vecino && !esBloqueOpaco(vecino)) {
      return arriba ? ponerCursorAlFinalDe(vecino) : ponerCursorEn(vecino)
    }
    // Sin sitio al lado, se hace uno... salvo cuando esto viene de pinchar
    // en la propia imagen: ahí lo que quieres es elegirla, y aparecerte un
    // párrafo en blanco de la nada sería el editor haciendo cosas raras
    // otra vez. Se busca entonces por el otro lado, y si tampoco, nada.
    if (!crear) {
      const otro = arriba ? pieza.nextElementSibling : pieza.previousElementSibling
      if (otro && !esBloqueOpaco(otro)) return arriba ? ponerCursorEn(otro) : ponerCursorAlFinalDe(otro)
      return
    }
    const p = document.createElement('p')
    p.innerHTML = '<br>'
    if (arriba) pieza.before(p)
    else pieza.after(p)
    ponerCursorEn(p)
    emit()
  }

  surfaceEl.addEventListener('click', (e) => {
    // Pinchar en el pie de foto también cuenta como seleccionar la
    // imagen: si no, la barra desaparecía justo al ir a escribir el pie.
    if (e.target.closest?.('figcaption')) return
    const figura = e.target.closest?.('figure')
    const el = e.target.closest?.('img, tcg-deck') || figura?.querySelector('img')
    if (el && surfaceEl.contains(el)) {
      seleccionar(el)
      return
    }
    deseleccionar()
  })

  // La pieza de bloque a la que pertenece un nodo: la de ARRIBA DEL TODO,
  // no la figura suelta. Dentro de una fila la figura es hija de la fila,
  // y meter un párrafo detrás de ella lo metería DENTRO de la rejilla.
  const piezaDeBloque = (nodo) => {
    const b = bloqueDe(nodo)
    return b && esBloqueOpaco(b) && surfaceEl.contains(b) ? b : null
  }

  // El cursor se coloca en el MOUSEDOWN, no en el click.
  //
  // Esperando al click ya es tarde: el navegador ha tratado la pulsación
  // sobre algo que no es editable y ha dejado la selección VACÍA, así que
  // colocarlo después no servía de nada — y el Ctrl+A siguiente
  // seleccionaba la página entera, botones de la barra incluidos.
  surfaceEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    // El pie de foto sí es editable: ahí manda el navegador.
    if (e.target.closest?.('figcaption')) return
    const pieza = piezaDeBloque(e.target)
    if (!pieza) return
    e.preventDefault()
    const caja = pieza.getBoundingClientRect()
    // Pinchando en la IMAGEN lo que se quiere es elegirla (de eso se
    // encarga el `click`); aquí sólo se deja el cursor en un sitio válido
    // para que el teclado siga funcionando, sin inventarse párrafos.
    const enLaImagen = !!e.target.closest?.('img, tcg-deck')
    cursorJuntoA(pieza, e.clientY < caja.top + caja.height / 2, !enLaImagen)
  })

  // El repaso de estructura, también AL ABRIR y no sólo al escribir.
  //
  // Una guía guardada llega con sus figuras y sus filas tal cual, y hasta
  // que no tocabas una tecla no eran piezas: el primer Backspace sobre una
  // guía recién abierta seguía comiéndose el párrafo. Va aquí abajo, con
  // todo ya definido, y sin `emit` a propósito — abrir una guía no es
  // cambiarla.
  sanearEstructura()

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
