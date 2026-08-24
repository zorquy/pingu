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
  // Los tres de cartas guardan SOLO identificadores de TCGdex, igual que
  // las listas de cartas de las guías: el dibujo lo monta la web leyendo
  // `tcg_cards`.
  cartaquiz: { type: 'cartaquiz', question: '', card_ids: [], correct_id: '', explanation: '' },
  zonas: { type: 'zonas', question: '', image_url: '', zones: [], explanation: '' },
  clasifica: { type: 'clasifica', title: '', buckets: ['', ''], cards: [], explanation: '' },
  intruso: { type: 'intruso', question: '', card_ids: [], intruso_id: '', explanation: '' },
  desliza: { type: 'desliza', title: '', afirmaciones: [{ text: '', es_verdad: true }], explanation: '' },
  memoria: { type: 'memoria', title: '', card_ids: [], explanation: '' },
  escribe: { type: 'escribe', question: '', answers: [''], explanation: '' },
  diferencias: { type: 'diferencias', question: '', image_left_url: '', image_url: '', zones: [], explanation: '' },
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
  cartaquiz: { icon: icons.cards(16), label: 'Elegir la carta' },
  zonas: { icon: icons.scan(16), label: 'Encontrar el fallo' },
  clasifica: { icon: icons.layers(16), label: 'Clasificar cartas' },
  intruso: { icon: icons.eye(16), label: 'El intruso' },
  desliza: { icon: icons.gamepad(16), label: 'Desliza: ¿verdadero o falso?' },
  memoria: { icon: icons.target(16), label: 'Memoria (parejas)' },
  escribe: { icon: icons.edit(16), label: 'Escribe la respuesta' },
  diferencias: { icon: icons.image(16), label: 'Las diferencias (dos imágenes)' },
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
    case 'cartaquiz':
      return `
        <input class="be-field" data-i="${i}" data-f="question" placeholder="Pregunta (¿cuál es la falsa?)" value="${escapeHtml(block.question || '')}" />
        <div class="be-cartas-row">
          <textarea class="be-field" data-i="${i}" data-f="card_ids" placeholder="Identificadores de carta, uno por línea (swsh3-136)">${escapeHtml((block.card_ids || []).join('\n'))}</textarea>
          <button type="button" class="btn-outline be-buscar-cartas" data-i="${i}" data-campo="card_ids">${icons.search(15)} Buscar cartas</button>
        </div>
        <input class="be-field" data-i="${i}" data-f="correct_id" placeholder="Identificador de la carta correcta" value="${escapeHtml(block.correct_id || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación">${escapeHtml(block.explanation || '')}</textarea>`
    case 'zonas':
      return `
        <input class="be-field" data-i="${i}" data-f="question" placeholder="Enunciado (toca el canto de la carta)" value="${escapeHtml(block.question || '')}" />
        <div class="be-image-row">
          <input class="be-field" data-i="${i}" data-f="image_url" placeholder="Sin imagen" value="${escapeHtml(block.image_url || '')}" readonly />
          <button type="button" class="btn-outline be-upload-image" data-i="${i}">${icons.upload(15)} Subir imagen</button>
          <input type="file" accept="image/*" class="be-image-file" data-i="${i}" hidden />
        </div>
        ${
          block.image_url
            ? `<p class="be-ayuda">Pincha en la imagen para marcar la zona buena. Vuelve a pinchar en una marca para quitarla.</p>
               <div class="be-zonas" data-i="${i}">
                 <img src="${escapeHtml(block.image_url)}" alt="" draggable="false" />
                 ${(block.zones || [])
                   .map(
                     (z, zi) =>
                       `<span class="be-zona" data-i="${i}" data-z="${zi}" style="left:${z.x}%; top:${z.y}%; width:${(z.r || 10) * 2}%; height:${(z.r || 10) * 2}%"></span>`
                   )
                   .join('')}
               </div>`
            : '<p class="be-ayuda">Sube una imagen para poder marcar dónde está el fallo.</p>'
        }
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación">${escapeHtml(block.explanation || '')}</textarea>`
    case 'clasifica':
      return `
        <input class="be-field" data-i="${i}" data-f="title" placeholder="Enunciado (pon cada carta en su rareza)" value="${escapeHtml(block.title || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="buckets" placeholder="Montones, uno por línea (Común / Rara / Ultra rara)">${escapeHtml((block.buckets || []).join('\n'))}</textarea>
        <div class="be-cartas-row">
          <textarea class="be-field" data-i="${i}" data-f="cards" placeholder="Una carta por línea: swsh3-136 :: Rara">${escapeHtml((block.cards || []).map((c) => `${c.id} :: ${c.bucket}`).join('\n'))}</textarea>
          <button type="button" class="btn-outline be-buscar-cartas" data-i="${i}" data-campo="cards">${icons.search(15)} Buscar cartas</button>
        </div>
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación">${escapeHtml(block.explanation || '')}</textarea>`
    case 'intruso':
      return `
        <input class="be-field" data-i="${i}" data-f="question" placeholder="Pregunta (¿cuál NO encaja?)" value="${escapeHtml(block.question || '')}" />
        <div class="be-cartas-row">
          <textarea class="be-field" data-i="${i}" data-f="card_ids" placeholder="Identificadores de carta, uno por línea (swsh3-136)">${escapeHtml((block.card_ids || []).join('\n'))}</textarea>
          <button type="button" class="btn-outline be-buscar-cartas" data-i="${i}" data-campo="card_ids">${icons.search(15)} Buscar cartas</button>
        </div>
        <input class="be-field" data-i="${i}" data-f="intruso_id" placeholder="Identificador de la carta INTRUSA" value="${escapeHtml(block.intruso_id || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación (por qué no encaja)">${escapeHtml(block.explanation || '')}</textarea>`
    case 'desliza':
      return `
        <input class="be-field" data-i="${i}" data-f="title" placeholder="Enunciado (opcional)" value="${escapeHtml(block.title || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="afirmaciones" placeholder="Una afirmación por línea: texto :: v  (o :: f si es falsa)">${escapeHtml(
          (block.afirmaciones || []).map((a) => `${a.text} :: ${a.es_verdad ? 'v' : 'f'}`).join('\n')
        )}</textarea>
        <p class="be-ayuda">Se juegan de una en una, deslizando. El bloque se acierta si no se falla ninguna.</p>
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación">${escapeHtml(block.explanation || '')}</textarea>`
    case 'memoria':
      return `
        <input class="be-field" data-i="${i}" data-f="title" placeholder="Enunciado (encuentra las parejas)" value="${escapeHtml(block.title || '')}" />
        <div class="be-cartas-row">
          <textarea class="be-field" data-i="${i}" data-f="card_ids" placeholder="De 3 a 6 identificadores de carta, uno por línea">${escapeHtml((block.card_ids || []).join('\n'))}</textarea>
          <button type="button" class="btn-outline be-buscar-cartas" data-i="${i}" data-campo="card_ids">${icons.search(15)} Buscar cartas</button>
        </div>
        <p class="be-ayuda">Cada carta sale dos veces, boca abajo. Se acierta terminando sin pasarse del margen de fallos (uno por pareja).</p>
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación (opcional)">${escapeHtml(block.explanation || '')}</textarea>`
    case 'escribe':
      return `
        <input class="be-field" data-i="${i}" data-f="question" placeholder="Pregunta (se responde escribiendo)" value="${escapeHtml(block.question || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="answers" placeholder="Respuestas aceptadas, una por línea (acentos y mayúsculas dan igual)">${escapeHtml(
          (block.answers || []).join('\n')
        )}</textarea>
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación">${escapeHtml(block.explanation || '')}</textarea>`
    case 'diferencias':
      return `
        <input class="be-field" data-i="${i}" data-f="question" placeholder="Enunciado (encuentra las diferencias)" value="${escapeHtml(block.question || '')}" />
        <p class="be-ayuda">Imagen A: la original (por ejemplo, la carta auténtica).</p>
        <div class="be-image-row">
          <input class="be-field" data-i="${i}" data-f="image_left_url" placeholder="Sin imagen A" value="${escapeHtml(block.image_left_url || '')}" readonly />
          <button type="button" class="btn-outline be-upload-image" data-i="${i}" data-campo="image_left_url">${icons.upload(15)} Subir imagen A</button>
          <input type="file" accept="image/*" class="be-image-file" data-i="${i}" data-campo="image_left_url" hidden />
        </div>
        <p class="be-ayuda">Imagen B: la de las diferencias. Súbela y marca cada diferencia pinchando.</p>
        <div class="be-image-row">
          <input class="be-field" data-i="${i}" data-f="image_url" placeholder="Sin imagen B" value="${escapeHtml(block.image_url || '')}" readonly />
          <button type="button" class="btn-outline be-upload-image" data-i="${i}" data-campo="image_url">${icons.upload(15)} Subir imagen B</button>
          <input type="file" accept="image/*" class="be-image-file" data-i="${i}" data-campo="image_url" hidden />
        </div>
        ${
          block.image_url
            ? `<div class="be-zonas" data-i="${i}">
                 <img src="${escapeHtml(block.image_url)}" alt="" draggable="false" />
                 ${(block.zones || [])
                   .map(
                     (z, zi) =>
                       `<span class="be-zona" data-i="${i}" data-z="${zi}" style="left:${z.x}%; top:${z.y}%; width:${(z.r || 10) * 2}%; height:${(z.r || 10) * 2}%"></span>`
                   )
                   .join('')}
               </div>`
            : ''
        }
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación">${escapeHtml(block.explanation || '')}</textarea>`
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
      if (f === 'options' || f === 'items' || f === 'buckets' || f === 'card_ids' || f === 'answers') {
        blocks[i][f] = input.value.split('\n').map((s) => s.trim()).filter(Boolean)
      } else if (f === 'cards') {
        // "swsh3-136 :: Rara" por línea. El montón se compara luego con
        // los de `buckets`, así que tiene que escribirse igual.
        blocks[i][f] = input.value
          .split('\n')
          .map((line) => {
            const [id, bucket] = line.split('::').map((s) => (s || '').trim())
            return { id: id || '', bucket: bucket || '' }
          })
          .filter((c) => c.id)
      } else if (f === 'correct_index') {
        blocks[i][f] = Number(input.value) || 0
      } else if (f === 'is_true') {
        blocks[i][f] = input.value === 'true'
      } else if (f === 'afirmaciones') {
        // "texto :: v" o "texto :: f" por línea. Sin marca, verdadera:
        // es lo que uno espera al teclear rápido.
        blocks[i][f] = input.value
          .split('\n')
          .map((line) => {
            const [text, marca] = line.split('::').map((s) => (s || '').trim())
            return { text: text || '', es_verdad: !/^f/i.test(marca || 'v') }
          })
          .filter((a) => a.text)
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
      // A qué campo va la imagen. Sin data-campo es `image_url`, como
      // siempre; «las diferencias» tiene DOS imágenes y distingue la
      // segunda con data-campo en el botón y en su input de fichero.
      const campo = btn.dataset.campo || 'image_url'
      const fileInput =
        containerEl.querySelector(`.be-image-file[data-i="${i}"][data-campo="${campo}"]`) ||
        containerEl.querySelector(`.be-image-file[data-i="${i}"]:not([data-campo])`)
      if (!fileInput) return
      btn.addEventListener('click', () => fileInput.click())
      fileInput.addEventListener('change', async () => {
        const file = fileInput.files[0]
        fileInput.value = ''
        if (!file) return
        try {
          const url = await uploadImage(file)
          blocks[i][campo] = url
          renderCourseBlockEditor(containerEl, blocks, uploadImage)
        } catch (err) {
          showToast('No se pudo subir la imagen: ' + err.message)
        }
      })
    })
  }
  // Buscar cartas sin salir del editor. Se añaden al final del campo,
  // que es lo que espera quien acaba de escribir tres a mano.
  containerEl.querySelectorAll('.be-buscar-cartas').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const i = Number(btn.dataset.i)
      const campo = btn.dataset.campo
      const { openCardPicker } = await import('./card-picker.js')
      const ids = await openCardPicker()
      if (!ids || !ids.length) return
      if (campo === 'card_ids') {
        blocks[i].card_ids = [...(blocks[i].card_ids || []), ...ids]
      } else {
        // Sin montón: lo pone el autor después. Meterlas con uno
        // inventado sería peor, porque parecería que ya está hecho.
        blocks[i].cards = [...(blocks[i].cards || []), ...ids.map((id) => ({ id, bucket: '' }))]
      }
      renderCourseBlockEditor(containerEl, blocks, uploadImage)
    })
  )

  // Marcar la zona buena pinchando en la imagen. Se guarda en tanto por
  // ciento, no en píxeles: la imagen se ve a otro tamaño en el móvil, en
  // el editor y en el curso.
  const RADIO_ZONA = 9
  containerEl.querySelectorAll('.be-zonas').forEach((lienzo) => {
    const i = Number(lienzo.dataset.i)
    const img = lienzo.querySelector('img')
    if (!img) return
    img.addEventListener('click', (e) => {
      const caja = img.getBoundingClientRect()
      const x = Math.round(((e.clientX - caja.left) / caja.width) * 1000) / 10
      const y = Math.round(((e.clientY - caja.top) / caja.height) * 1000) / 10
      blocks[i].zones = [...(blocks[i].zones || []), { x, y, r: RADIO_ZONA }]
      renderCourseBlockEditor(containerEl, blocks, uploadImage)
    })
    lienzo.querySelectorAll('.be-zona').forEach((marca) =>
      marca.addEventListener('click', (e) => {
        // La marca es hermana de la imagen, no hija, así que el clic no
        // llega al manejador de la imagen por sí solo. Esto es por si
        // algún día el manejador se cuelga de `.be-zonas` en vez del
        // <img>: entonces sí haría falta.
        e.stopPropagation()
        blocks[i].zones = (blocks[i].zones || []).filter((_, zi) => zi !== Number(marca.dataset.z))
        renderCourseBlockEditor(containerEl, blocks, uploadImage)
      })
    )
  })

  makeSortable(containerEl, blocks, () => renderCourseBlockEditor(containerEl, blocks, uploadImage))
  wireBBCodeToolbars(containerEl)
}
