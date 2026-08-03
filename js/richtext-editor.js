import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify/+esm'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { parseDeckIds, deckAttrValue, hydrateDecks } from './cards-block.js'
import { openCardPicker } from './card-picker.js'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'blockquote', 'tcg-deck']
const ALLOWED_ATTR = ['href', 'src', 'alt', 'target', 'rel', 'data-cards']

// Se llama tanto al guardar (aquí) como al pintar la guía ya publicada
// (renderReferenceBlock en block-editor.js) — un autor puede escribir su
// fila de `guides` directamente por la API saltándose este editor, así que
// sanear solo aquí no bastaría para evitar HTML/JS inyectado.
export function sanitizeRichText(html) {
  const limpio = DOMPurify.sanitize(html || '', {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Con ALLOWED_ATTR explícito, DOMPurify seguiría dejando pasar
    // CUALQUIER data-*. Se apaga y se permite solo el nuestro.
    ALLOW_DATA_ATTR: false,
  })
  if (!limpio.includes('tcg-deck') || typeof DOMParser === 'undefined') return limpio

  // Un <tcg-deck> guarda SOLO los identificadores de las cartas. Lo que
  // tenga dentro se tira siempre: en el editor se rellena con las cartas
  // para que el autor las vea, y sin esto esa vista previa acabaría
  // guardada dentro de la guía — congelando nombres e imágenes que deben
  // salir siempre de la base.
  const doc = new DOMParser().parseFromString(limpio, 'text/html')
  doc.querySelectorAll('tcg-deck').forEach((el) => {
    const ids = parseDeckIds(el.getAttribute('data-cards'))
    el.textContent = ''
    if (ids.length === 0) el.remove()
    else el.setAttribute('data-cards', ids.join(','))
  })
  return doc.body.innerHTML
}

const TOOLBAR_ACTIONS = [
  { cmd: 'bold', icon: 'B', title: 'Negrita' },
  { cmd: 'italic', icon: 'I', title: 'Cursiva' },
  { cmd: 'underline', icon: 'U', title: 'Subrayado' },
  { cmd: 'formatBlock', arg: 'H2', icon: 'H2', title: 'Título' },
  { cmd: 'formatBlock', arg: 'H3', icon: 'H3', title: 'Subtítulo' },
  { cmd: 'formatBlock', arg: 'P', icon: '¶', title: 'Párrafo' },
  { cmd: 'insertUnorderedList', icon: '•', title: 'Lista' },
  { cmd: 'insertOrderedList', icon: '1.', title: 'Lista numerada' },
  { cmd: 'createLink', icon: icons.link(15), title: 'Enlace', prompt: true },
]

export function richTextToolbarHtml() {
  return `
    ${TOOLBAR_ACTIONS.map((a, i) => `<button type="button" data-i="${i}" title="${a.title}">${a.icon}</button>`).join('')}
    <button type="button" data-action="image" title="Insertar imagen">${icons.image(15)} Imagen</button>
    <button type="button" data-action="cards" title="Insertar cartas del catálogo">${icons.layers(15)} Cartas</button>
    <input type="file" accept="image/*" class="rte-image-input" hidden />`
}

// toolbarEl y surfaceEl ya deben estar en el DOM (con richTextToolbarHtml()
// como contenido del primero). uploadImage(file) debe devolver la URL pública.
export function initRichTextEditor({ toolbarEl, surfaceEl, initialHtml, onChange, uploadImage }) {
  surfaceEl.innerHTML = sanitizeRichText(initialHtml)
  surfaceEl.setAttribute('contenteditable', 'true')

  const emit = () => onChange(sanitizeRichText(surfaceEl.innerHTML))

  toolbarEl.querySelectorAll('button[data-i]').forEach((btn) => {
    const action = TOOLBAR_ACTIONS[Number(btn.dataset.i)]
    btn.addEventListener('click', () => {
      surfaceEl.focus()
      if (action.prompt) {
        const url = window.prompt('URL del enlace (https://...)')
        if (!url || !/^https?:\/\//i.test(url)) return
        document.execCommand('createLink', false, url)
      } else {
        document.execCommand(action.cmd, false, action.arg)
      }
      emit()
    })
  })

  const fileInput = toolbarEl.querySelector('.rte-image-input')
  toolbarEl.querySelector('[data-action="image"]').addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0]
    fileInput.value = ''
    if (!file || !uploadImage) return
    try {
      const url = await uploadImage(file)
      surfaceEl.focus()
      document.execCommand('insertImage', false, url)
      emit()
    } catch (err) {
      showToast('No se pudo subir la imagen: ' + err.message)
    }
  })

  // ── Cartas ──
  // La lista se inserta como <tcg-deck data-cards="...">, y acto seguido
  // se rellena para que el autor la vea. Ese relleno NO se guarda: lo
  // vacía sanitizeRichText en cada emit().
  const btnCartas = toolbarEl.querySelector('[data-action="cards"]')
  if (btnCartas) {
    btnCartas.addEventListener('click', async () => {
      const ids = await openCardPicker()
      if (!ids || ids.length === 0) return
      const bloque = document.createElement('tcg-deck')
      bloque.setAttribute('data-cards', deckAttrValue(ids))
      // contenteditable=false para que no se pueda escribir dentro ni
      // romper la lista con el cursor.
      bloque.setAttribute('contenteditable', 'false')
      surfaceEl.appendChild(bloque)
      // Un párrafo detrás, si no el cursor se queda atrapado al final y
      // no hay forma de seguir escribiendo debajo de la lista.
      const p = document.createElement('p')
      p.innerHTML = '<br>'
      surfaceEl.appendChild(p)
      await hydrateDecks(surfaceEl)
      emit()
    })
  }

  // Al abrir el editor con una guía que ya tenía listas, hay que
  // pintarlas: en la fila guardada están vacías por definición.
  hydrateDecks(surfaceEl).catch(() => {})

  surfaceEl.addEventListener('input', emit)
  surfaceEl.addEventListener('blur', emit)
}
