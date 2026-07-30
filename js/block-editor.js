import { escapeHtml } from './app.js'
import { bbcodeToolbarHtml, wireBBCodeToolbars, parseBBCode } from './bbcode.js'

// Render de un bloque de referencia a HTML final — lo usan tanto guia.js
// (la página real) como la vista previa en vivo del editor, para que las
// dos coincidan exactamente.
export function renderReferenceBlock(block, headings = []) {
  switch (block.type) {
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

export const COURSE_BLOCK_DEFAULTS = {
  hook: { type: 'hook', emoji: '👋', headline: '', subtext: '' },
  concept: { type: 'concept', emoji: '💡', title: '', body: '', image_url: '', highlight: '' },
  warning: { type: 'warning', emoji: '⚠️', title: '', body: '', highlight: '' },
  tip: { type: 'tip', emoji: '💡', title: '', body: '', highlight: '' },
  example: { type: 'example', emoji: '📌', title: '', body: '', highlight: '' },
  quiz: { type: 'quiz', question: '', options: ['', ''], correct_index: 0, explanation: '' },
  truefalse: { type: 'truefalse', statement: '', is_true: true, explanation: '' },
  fillblank: { type: 'fillblank', before: '', after: '', options: ['', ''], correct_option: '' },
  match: { type: 'match', title: '', pairs: [{ left: '', right: '' }, { left: '', right: '' }] },
  order: { type: 'order', title: '', items: ['', '', ''] },
  checklist: { type: 'checklist', title: '', items: [''] },
  reward: { type: 'reward', next_guide_slug: '' },
}

export const REFERENCE_BLOCK_DEFAULTS = {
  heading: { type: 'heading', text: '' },
  paragraph: { type: 'paragraph', text: '' },
  image: { type: 'image', url: '', caption: '' },
  list: { type: 'list', items: [''] },
  highlight: { type: 'highlight', text: '' },
}

export const COURSE_BLOCK_LABELS = {
  hook: { icon: '👋', label: 'Enganche inicial' },
  concept: { icon: '💡', label: 'Concepto' },
  warning: { icon: '⚠️', label: 'Aviso' },
  tip: { icon: '💡', label: 'Consejo' },
  example: { icon: '📌', label: 'Ejemplo' },
  quiz: { icon: '❓', label: 'Pregunta' },
  truefalse: { icon: '✅', label: 'Verdadero o falso' },
  fillblank: { icon: '✏️', label: 'Rellenar hueco' },
  match: { icon: '🔗', label: 'Relacionar parejas' },
  order: { icon: '🔢', label: 'Ordenar pasos' },
  checklist: { icon: '☑️', label: 'Checklist' },
  reward: { icon: '🏆', label: 'Recompensa final' },
}

export const REFERENCE_BLOCK_LABELS = {
  heading: { icon: '🔠', label: 'Encabezado' },
  paragraph: { icon: '📝', label: 'Párrafo' },
  image: { icon: '🖼️', label: 'Imagen' },
  list: { icon: '📋', label: 'Lista' },
  highlight: { icon: '⭐', label: 'Destacado' },
}

export function fieldsForCourseBlock(block, i) {
  switch (block.type) {
    case 'hook':
      return `
        <input class="be-field" data-i="${i}" data-f="emoji" placeholder="Emoji" value="${escapeHtml(block.emoji || '')}" />
        <input class="be-field" data-i="${i}" data-f="headline" placeholder="Titular" value="${escapeHtml(block.headline || '')}" />
        ${bbcodeToolbarHtml(`cb-subtext-${i}`)}
        <textarea class="be-field" id="cb-subtext-${i}" data-i="${i}" data-f="subtext" placeholder="Subtexto">${escapeHtml(block.subtext || '')}</textarea>`
    case 'concept':
    case 'warning':
    case 'tip':
    case 'example':
      return `
        <input class="be-field" data-i="${i}" data-f="emoji" placeholder="Emoji" value="${escapeHtml(block.emoji || '')}" />
        <input class="be-field" data-i="${i}" data-f="title" placeholder="Título" value="${escapeHtml(block.title || '')}" />
        ${bbcodeToolbarHtml(`cb-body-${i}`)}
        <textarea class="be-field" id="cb-body-${i}" data-i="${i}" data-f="body" placeholder="Texto">${escapeHtml(block.body || '')}</textarea>
        <input class="be-field" data-i="${i}" data-f="image_url" placeholder="URL de imagen (opcional)" value="${escapeHtml(block.image_url || '')}" />
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

export function fieldsForReferenceBlock(block, i) {
  switch (block.type) {
    case 'heading':
    case 'highlight':
      return `<input class="rbe-field" data-i="${i}" data-f="text" placeholder="Texto" value="${escapeHtml(block.text || '')}" />`
    case 'paragraph':
      return `
        ${bbcodeToolbarHtml(`rb-text-${i}`)}
        <textarea class="rbe-field" id="rb-text-${i}" data-i="${i}" data-f="text" placeholder="Texto">${escapeHtml(block.text || '')}</textarea>`
    case 'image':
      return `
        <input class="rbe-field" data-i="${i}" data-f="url" placeholder="URL de imagen" value="${escapeHtml(block.url || '')}" />
        <input class="rbe-field" data-i="${i}" data-f="caption" placeholder="Descripción" value="${escapeHtml(block.caption || '')}" />`
    case 'list':
      return `<textarea class="rbe-field" data-i="${i}" data-f="items" placeholder="Items (uno por línea)">${escapeHtml((block.items || []).join('\n'))}</textarea>`
    default:
      return ''
  }
}

export function flattenReferenceBlocksToText(blocks) {
  return blocks
    .map((b) => {
      switch (b.type) {
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

export function renderCourseBlockEditor(containerEl, blocks) {
  containerEl.innerHTML = blocks
    .map(
      (b, i) => `
    <div class="block-editor-item" data-index="${i}">
      <div class="block-editor-item-header">
        <span class="block-type-icon">${COURSE_BLOCK_LABELS[b.type]?.icon || '📦'}</span>
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

  containerEl.querySelectorAll('.be-type').forEach((sel) =>
    sel.addEventListener('change', () => {
      const i = Number(sel.dataset.i)
      blocks[i] = { ...COURSE_BLOCK_DEFAULTS[sel.value] }
      renderCourseBlockEditor(containerEl, blocks)
    })
  )
  containerEl.querySelectorAll('.remove-block').forEach((btn) =>
    btn.addEventListener('click', () => {
      blocks.splice(Number(btn.dataset.i), 1)
      renderCourseBlockEditor(containerEl, blocks)
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
  makeSortable(containerEl, blocks, () => renderCourseBlockEditor(containerEl, blocks))
  wireBBCodeToolbars(containerEl)
}

export function renderReferenceBlockEditor(containerEl, blocks) {
  containerEl.innerHTML = blocks
    .map(
      (b, i) => `
    <div class="block-editor-item" data-index="${i}">
      <div class="block-editor-item-header">
        <span class="block-type-icon">${REFERENCE_BLOCK_LABELS[b.type]?.icon || '📦'}</span>
        <select class="rbe-type" data-i="${i}">
          ${Object.keys(REFERENCE_BLOCK_DEFAULTS)
            .map((t) => `<option value="${t}" ${t === b.type ? 'selected' : ''}>${escapeHtml(REFERENCE_BLOCK_LABELS[t]?.label || t)}</option>`)
            .join('')}
        </select>
        <span class="remove-block" data-i="${i}">Quitar ×</span>
      </div>
      ${fieldsForReferenceBlock(b, i)}
    </div>`
    )
    .join('')

  containerEl.querySelectorAll('.rbe-type').forEach((sel) =>
    sel.addEventListener('change', () => {
      const i = Number(sel.dataset.i)
      blocks[i] = { ...REFERENCE_BLOCK_DEFAULTS[sel.value] }
      renderReferenceBlockEditor(containerEl, blocks)
    })
  )
  containerEl.querySelectorAll('.remove-block').forEach((btn) =>
    btn.addEventListener('click', () => {
      blocks.splice(Number(btn.dataset.i), 1)
      renderReferenceBlockEditor(containerEl, blocks)
    })
  )
  containerEl.querySelectorAll('.rbe-field').forEach((input) =>
    input.addEventListener('input', () => {
      const i = Number(input.dataset.i)
      const f = input.dataset.f
      blocks[i][f] = f === 'items' ? input.value.split('\n').map((s) => s.trim()).filter(Boolean) : input.value
    })
  )
  makeSortable(containerEl, blocks, () => renderReferenceBlockEditor(containerEl, blocks))
  wireBBCodeToolbars(containerEl)
}
