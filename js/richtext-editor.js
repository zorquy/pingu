import DOMPurify from 'https://cdn.jsdelivr.net/npm/dompurify/+esm'
import { showToast } from './toast.js'

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'img', 'blockquote']
const ALLOWED_ATTR = ['href', 'src', 'alt', 'target', 'rel']

// Se llama tanto al guardar (aquí) como al pintar la guía ya publicada
// (renderReferenceBlock en block-editor.js) — un autor puede escribir su
// fila de `guides` directamente por la API saltándose este editor, así que
// sanear solo aquí no bastaría para evitar HTML/JS inyectado.
export function sanitizeRichText(html) {
  return DOMPurify.sanitize(html || '', { ALLOWED_TAGS, ALLOWED_ATTR })
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
  { cmd: 'createLink', icon: '🔗', title: 'Enlace', prompt: true },
]

export function richTextToolbarHtml() {
  return `
    ${TOOLBAR_ACTIONS.map((a, i) => `<button type="button" data-i="${i}" title="${a.title}">${a.icon}</button>`).join('')}
    <button type="button" data-action="image" title="Insertar imagen">🖼️ Imagen</button>
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

  surfaceEl.addEventListener('input', emit)
  surfaceEl.addEventListener('blur', emit)
}
