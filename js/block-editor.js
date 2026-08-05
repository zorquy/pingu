import { escapeHtml } from './app.js'
import { bbcodeToolbarHtml, wireBBCodeToolbars, parseBBCode } from './bbcode.js'
import { sanitizeRichText } from './richtext-format.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { attachEmojiPicker } from './emoji-picker.js'

// Render de un bloque de referencia a HTML final — lo usan tanto guia.js
// (la página real) como la vista previa en vivo del editor, para que las
// dos coincidan exactamente. `richtext` es el tipo nuevo (editor WYSIWYG);
// los demás son de guías antiguas creadas con el editor de bloques previo.
export function renderReferenceBlock(block, headings = []) {
  switch (block.type) {
    case 'richtext': {
      const clean = sanitizeRichText(block.html || '')
      if (typeof DOMParser === 'undefined') return clean
      const doc = new DOMParser().parseFromString(clean, 'text/html')
      doc.querySelectorAll('h2, h3').forEach((h) => {
        const id = `section-${headings.length}`
        h.id = id
        headings.push({ id, text: h.textContent })
      })
      return doc.body.innerHTML
    }
    case 'heading': {
      const id = `section-${headings.length}`
      headings.push({ id, text: block.text })
      return `<h2 id="${id}">${escapeHtml(block.text || '')}</h2>`
    }
    case 'paragraph':
      return `<p>${parseBBCode(block.text || '')}</p>`
    case 'image':
      return block.url ? `<img src="${block.url}" alt="${escapeHtml(block.caption || '')}" onerror="this.style.display='none'">` : ''
    case 'list':
      return `<ul>${(block.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
    case 'highlight':
      return `<div class="block-highlight">${parseBBCode(block.text || '')}</div>`
    default:
      return ''
  }
}

export function renderReferenceBlocksHtml(blocks, headings = []) {
  return (blocks || []).map((b) => renderReferenceBlock(b, headings)).join('')
}

// El campo se sigue llamando `emoji` porque así se llama en los bloques
// ya guardados en la base y renombrarlo obligaría a migrar contenido de
// otra gente; lo que cambia es lo que se guarda dentro: el nombre de un
// icono ('sparkles') en vez del carácter. Los bloques antiguos siguen
// teniendo su emoji y se pintan igual, traducidos al vuelo.
export const COURSE_BLOCK_DEFAULTS = {
  hook: { type: 'hook', emoji: 'sparkles', headline: '', subtext: '' },
  concept: { type: 'concept', emoji: 'lightbulb', title: '', body: '', image_url: '', highlight: '' },
  warning: { type: 'warning', emoji: 'triangleAlert', title: '', body: '', highlight: '' },
  tip: { type: 'tip', emoji: 'lightbulb', title: '', body: '', highlight: '' },
  example: { type: 'example', emoji: 'pin', title: '', body: '', highlight: '' },
  quiz: { type: 'quiz', question: '', options: ['', ''], correct_index: 0, explanation: '' },
  truefalse: { type: 'truefalse', statement: '', is_true: true, explanation: '' },
  fillblank: { type: 'fillblank', before: '', after: '', options: ['', ''], correct_option: '' },
  match: { type: 'match', title: '', pairs: [{ left: '', right: '' }, { left: '', right: '' }] },
  order: { type: 'order', title: '', items: ['', '', ''] },
  checklist: { type: 'checklist', title: '', items: [''] },
  reward: { type: 'reward', next_guide_slug: '' },
}

export const COURSE_BLOCK_LABELS = {
  hook: { icon: icons.zap(16), label: 'Enganche inicial' },
  concept: { icon: icons.lightbulb(16), label: 'Concepto' },
  warning: { icon: icons.triangleAlert(16), label: 'Aviso' },
  tip: { icon: icons.lightbulb(16), label: 'Consejo' },
  example: { icon: icons.pin(16), label: 'Ejemplo' },
  quiz: { icon: icons.helpCircle(16), label: 'Pregunta' },
  truefalse: { icon: icons.checkCircle(16), label: 'Verdadero o falso' },
  fillblank: { icon: icons.edit(16), label: 'Rellenar hueco' },
  match: { icon: icons.link(16), label: 'Relacionar parejas' },
  order: { icon: icons.listOrdered(16), label: 'Ordenar pasos' },
  checklist: { icon: icons.checkSquare(16), label: 'Checklist' },
  reward: { icon: icons.trophy(16), label: 'Recompensa final' },
}

export function fieldsForCourseBlock(block, i) {
  switch (block.type) {
    case 'hook':
      return `
        <input class="be-field" data-i="${i}" data-f="emoji" placeholder="Icono" value="${escapeHtml(block.emoji || '')}" />
        <input class="be-field" data-i="${i}" data-f="headline" placeholder="Titular" value="${escapeHtml(block.headline || '')}" />
        ${bbcodeToolbarHtml(`cb-subtext-${i}`)}
        <textarea class="be-field" id="cb-subtext-${i}" data-i="${i}" data-f="subtext" placeholder="Subtexto">${escapeHtml(block.subtext || '')}</textarea>`
    case 'concept':
    case 'warning':
    case 'tip':
    case 'example':
      return `
        <input class="be-field" data-i="${i}" data-f="emoji" placeholder="Icono" value="${escapeHtml(block.emoji || '')}" />
        <input class="be-field" data-i="${i}" data-f="title" placeholder="Título" value="${escapeHtml(block.title || '')}" />
        ${bbcodeToolbarHtml(`cb-body-${i}`)}
        <textarea class="be-field" id="cb-body-${i}" data-i="${i}" data-f="body" placeholder="Texto">${escapeHtml(block.body || '')}</textarea>
        <div class="be-image-row">
          <input class="be-field" data-i="${i}" data-f="image_url" placeholder="Sin imagen" value="${escapeHtml(block.image_url || '')}" readonly />
          <button type="button" class="btn-outline be-upload-image" data-i="${i}">${icons.upload(15)} Subir imagen</button>
          <input type="file" accept="image/*" class="be-image-file" data-i="${i}" hidden />
        </div>
        <input class="be-field" data-i="${i}" data-f="highlight" placeholder="Destacado (opcional)" value="${escapeHtml(block.highlight || '')}" />`
    case 'quiz':
      return `
        <input class="be-field" data-i="${i}" data-f="question" placeholder="Pregunta" value="${escapeHtml(block.question || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="options" placeholder="Opciones (una por línea)">${escapeHtml((block.options || []).join('\n'))}</textarea>
        <input class="be-field" data-i="${i}" data-f="correct_index" type="number" placeholder="Índice de la correcta (0, 1, 2...)" value="${block.correct_index ?? 0}" />
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación">${escapeHtml(block.explanation || '')}</textarea>`
    case 'truefalse':
      return `
        <input class="be-field" data-i="${i}" data-f="statement" placeholder="Afirmación" value="${escapeHtml(block.statement || '')}" />
        <select class="be-field" data-i="${i}" data-f="is_true">
          <option value="true" ${block.is_true ? 'selected' : ''}>Verdadero</option>
          <option value="false" ${!block.is_true ? 'selected' : ''}>Falso</option>
        </select>
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación">${escapeHtml(block.explanation || '')}</textarea>`
    case 'fillblank':
      return `
        <input class="be-field" data-i="${i}" data-f="before" placeholder="Texto antes del hueco" value="${escapeHtml(block.before || '')}" />
        <input class="be-field" data-i="${i}" data-f="after" placeholder="Texto después del hueco" value="${escapeHtml(block.after || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="options" placeholder="Opciones (una por línea)">${escapeHtml((block.options || []).join('\n'))}</textarea>
        <input class="be-field" data-i="${i}" data-f="correct_option" placeholder="Opción correcta (texto exacto)" value="${escapeHtml(block.correct_option || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación">${escapeHtml(block.explanation || '')}</textarea>`
    case 'match':
      return `
        <input class="be-field" data-i="${i}" data-f="title" placeholder="Título (opcional)" value="${escapeHtml(block.title || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="pairs" placeholder="Una pareja por línea: término :: definición">${escapeHtml((block.pairs || []).map((p) => `${p.left} :: ${p.right}`).join('\n'))}</textarea>`
    case 'order':
      return `
        <input class="be-field" data-i="${i}" data-f="title" placeholder="Título (opcional)" value="${escapeHtml(block.title || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="items" placeholder="Pasos en el orden correcto (uno por línea)">${escapeHtml((block.items || []).join('\n'))}</textarea>`
    case 'checklist':
      return `
        <input class="be-field" data-i="${i}" data-f="title" placeholder="Título" value="${escapeHtml(block.title || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="items" placeholder="Items (uno por línea)">${escapeHtml((block.items || []).join('\n'))}</textarea>`
    case 'reward':
      return `
        <p style="font-size:12px; color:var(--text-mid); margin: -4px 0 4px;">El XP de este curso se controla con el campo "XP de recompensa" de arriba, no aquí.</p>
        <input class="be-field" data-i="${i}" data-f="next_guide_slug" placeholder="Slug del siguiente curso (opcional)" value="${escapeHtml(block.next_guide_slug || '')}" />`
    default:
      return ''
  }
}

export function flattenReferenceBlocksToText(blocks) {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'richtext':
          return (b.html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        case 'heading':
          return `## ${b.text || ''}`
        case 'paragraph':
        case 'highlight':
          return b.text || ''
        case 'list':
          return (b.items || []).map((i) => `- ${i}`).join('\n')
        case 'image':
          return b.caption ? `[Imagen: ${b.caption}]` : ''
        default:
          return ''
      }
    })
    .filter(Boolean)
    .join('\n\n')
}

export function makeSortable(containerEl, list, onChange) {
  let dragIndex = null
  containerEl.querySelectorAll('.block-editor-item').forEach((el) => {
    el.setAttribute('draggable', 'true')
    el.addEventListener('dragstart', () => {
      dragIndex = Number(el.dataset.index)
      el.classList.add('dragging')
    })
    el.addEventListener('dragend', () => el.classList.remove('dragging'))
    el.addEventListener('dragover', (e) => e.preventDefault())
    el.addEventListener('drop', (e) => {
      e.preventDefault()
      const dropIndex = Number(el.dataset.index)
      if (dragIndex === null || dragIndex === dropIndex) return
      const [moved] = list.splice(dragIndex, 1)
      list.splice(dropIndex, 0, moved)
      onChange()
    })
  })
}

export function renderCourseBlockEditor(containerEl, blocks, uploadImage) {
  containerEl.innerHTML = blocks
    .map(
      (b, i) => `
    <div class="block-editor-item" data-index="${i}">
      <div class="block-editor-item-header">
        <span class="block-type-icon">${COURSE_BLOCK_LABELS[b.type]?.icon || icons.package(16)}</span>
        <select class="be-type" data-i="${i}">
          ${Object.keys(COURSE_BLOCK_DEFAULTS)
            .map((t) => `<option value="${t}" ${t === b.type ? 'selected' : ''}>${escapeHtml(COURSE_BLOCK_LABELS[t]?.label || t)}</option>`)
            .join('')}
        </select>
        <span class="remove-block" data-i="${i}">Quitar ×</span>
      </div>
      ${fieldsForCourseBlock(b, i)}
    </div>`
    )
    .join('')

  // Cada campo de icono lleva su propio selector. Va aquí y no dentro de
  // fieldsForCourseBlock porque el editor se repinta entero (cambiar de
  // tipo, quitar un bloque) y los <input> son nodos nuevos cada vez.
  containerEl.querySelectorAll('.be-field[data-f="emoji"]').forEach((input) => attachEmojiPicker(input))

  containerEl.querySelectorAll('.be-type').forEach((sel) =>
    sel.addEventListener('change', () => {
      const i = Number(sel.dataset.i)
      blocks[i] = { ...COURSE_BLOCK_DEFAULTS[sel.value] }
      renderCourseBlockEditor(containerEl, blocks, uploadImage)
    })
  )
  containerEl.querySelectorAll('.remove-block').forEach((btn) =>
    btn.addEventListener('click', () => {
      blocks.splice(Number(btn.dataset.i), 1)
      renderCourseBlockEditor(containerEl, blocks, uploadImage)
    })
  )
  containerEl.querySelectorAll('.be-field').forEach((input) =>
    input.addEventListener('input', () => {
      const i = Number(input.dataset.i)
      const f = input.dataset.f
      if (f === 'options' || f === 'items') {
        blocks[i][f] = input.value.split('\n').map((s) => s.trim()).filter(Boolean)
      } else if (f === 'correct_index') {
        blocks[i][f] = Number(input.value) || 0
      } else if (f === 'is_true') {
        blocks[i][f] = input.value === 'true'
      } else if (f === 'pairs') {
        blocks[i][f] = input.value
          .split('\n')
          .map((line) => {
            const [left, right] = line.split('::').map((s) => (s || '').trim())
            return { left: left || '', right: right || '' }
          })
          .filter((p) => p.left || p.right)
      } else {
        blocks[i][f] = input.value
      }
    })
  )
  if (uploadImage) {
    containerEl.querySelectorAll('.be-upload-image').forEach((btn) => {
      const i = Number(btn.dataset.i)
      const fileInput = containerEl.querySelector(`.be-image-file[data-i="${i}"]`)
      btn.addEventListener('click', () => fileInput.click())
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0]
        fileInput.value = ''
        if (!file) return
        try {
          const url = await uploadImage(file)
          blocks[i].image_url = url
          renderCourseBlockEditor(containerEl, blocks, uploadImage)
        } catch (err) {
          showToast('No se pudo subir la imagen: ' + err.message)
        }
      })
    })
  }
  makeSortable(containerEl, blocks, () => renderCourseBlockEditor(containerEl, blocks, uploadImage))
  wireBBCodeToolbars(containerEl)
}
