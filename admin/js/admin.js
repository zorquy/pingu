import { supabase } from '../../js/supabase.js'
import { escapeHtml, getSession } from '../../js/app.js'
import { invalidateAchievementsCache } from '../../js/gamification.js'

let categories = []
let guidesCache = []

// ── Access gate ──
async function checkAccess() {
  const session = await getSession()
  if (!session) {
    window.location.href = '/auth.html'
    return null
  }
  const { data: profile } = await supabase.from('user_profiles').select('is_admin').eq('id', session.user.id).single()
  if (!profile?.is_admin) {
    window.location.href = '/index.html'
    return null
  }
  document.getElementById('adminGate').classList.add('hidden')
  document.getElementById('adminLayout').classList.remove('hidden')
  return session
}

// ── Sidebar navigation ──
function initSidebar() {
  document.querySelectorAll('.admin-nav-item').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-item').forEach((b) => b.classList.remove('active'))
      document.querySelectorAll('.admin-section').forEach((s) => s.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`section-${btn.dataset.section}`).classList.add('active')
    })
  })
}

// ── Modal helpers ──
const modal = document.getElementById('adminModal')
const modalContent = document.getElementById('adminModalContent')

function openModal(html) {
  modalContent.innerHTML = html
  modal.classList.remove('hidden')
}

function closeModal() {
  modal.classList.add('hidden')
  modalContent.innerHTML = ''
}

document.getElementById('adminModalClose').addEventListener('click', closeModal)
modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal()
})

// ── Dashboard ──
async function loadDashboard() {
  const [{ count: userCount }, { count: completedCount }, { count: guideCount }] = await Promise.all([
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_progress').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
    supabase.from('guides').select('*', { count: 'exact', head: true }).not('published_at', 'is', null),
  ])

  document.getElementById('dashboardStats').innerHTML = `
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${userCount || 0}</div><div>Usuarios</div></div>
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${completedCount || 0}</div><div>Cursos completados</div></div>
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${guideCount || 0}</div><div>Guías publicadas</div></div>`
}

// ── Categories ──
async function loadCategories() {
  const { data } = await supabase.from('categories').select('*').order('order_pos')
  categories = data || []

  document.getElementById('categoriesTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Orden</th><th>Emoji</th><th>Nombre</th><th>Slug</th><th></th></tr></thead>
      <tbody>
        ${categories
          .map(
            (c) => `
          <tr>
            <td>${c.order_pos ?? ''}</td>
            <td>${c.emoji || ''}</td>
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.slug)}</td>
            <td class="admin-row-actions">
              <button data-edit="${c.id}">Editar</button>
              <button class="danger" data-delete="${c.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('#categoriesTable [data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openCategoryModal(categories.find((c) => c.id === btn.dataset.edit)))
  )
  document.querySelectorAll('#categoriesTable [data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta categoría?')) return
      await supabase.from('categories').delete().eq('id', btn.dataset.delete)
      loadCategories()
    })
  )
}

function openCategoryModal(category) {
  const c = category || { name: '', slug: '', description: '', emoji: '', icon: '', order_pos: categories.length }
  openModal(`
    <h3>${category ? 'Editar' : 'Nueva'} categoría</h3>
    <div class="form-group"><label>Nombre</label><input id="catName" value="${escapeHtml(c.name)}" /></div>
    <div class="form-group"><label>Slug</label><input id="catSlug" value="${escapeHtml(c.slug)}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="catDescription">${escapeHtml(c.description || '')}</textarea></div>
    <div class="form-group"><label>Emoji</label><input id="catEmoji" value="${escapeHtml(c.emoji || '')}" /></div>
    <div class="form-group"><label>Icono (clave SVG)</label><input id="catIcon" value="${escapeHtml(c.icon || '')}" placeholder="shield, search, tag, star, book, trophy, box, users, chart" /></div>
    <div class="form-group"><label>Orden</label><input id="catOrder" type="number" value="${c.order_pos ?? 0}" /></div>
    <button class="btn-primary btn-block" id="btnSaveCategory">Guardar</button>`)

  document.getElementById('btnSaveCategory').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('catName').value.trim(),
      slug: document.getElementById('catSlug').value.trim(),
      description: document.getElementById('catDescription').value.trim(),
      emoji: document.getElementById('catEmoji').value.trim(),
      icon: document.getElementById('catIcon').value.trim(),
      order_pos: Number(document.getElementById('catOrder').value) || 0,
    }
    if (c.id) payload.id = c.id
    await supabase.from('categories').upsert(payload)
    closeModal()
    loadCategories()
  })
}

document.getElementById('btnNewCategory').addEventListener('click', () => openCategoryModal(null))

// ── Guides ──
async function loadGuides() {
  const { data } = await supabase.from('guides').select('*, categories(name)').order('order_pos')
  guidesCache = data || []

  document.getElementById('guidesTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Título</th><th>Categoría</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        ${guidesCache
          .map(
            (g) => `
          <tr>
            <td>${g.emoji || ''} ${escapeHtml(g.title)}</td>
            <td>${escapeHtml(g.categories?.name || '—')}</td>
            <td>${g.published_at ? '<span class="badge badge-completed">Publicada</span>' : '<span class="badge badge-progress">Borrador</span>'}</td>
            <td class="admin-row-actions">
              <button data-edit="${g.id}">Editar</button>
              <button class="danger" data-delete="${g.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('#guidesTable [data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openGuideModal(guidesCache.find((g) => g.id === btn.dataset.edit)))
  )
  document.querySelectorAll('#guidesTable [data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta guía?')) return
      await supabase.from('guides').delete().eq('id', btn.dataset.delete)
      loadGuides()
    })
  )
}

const COURSE_BLOCK_DEFAULTS = {
  hook: { type: 'hook', emoji: '👋', headline: '', subtext: '' },
  concept: { type: 'concept', emoji: '💡', title: '', body: '', image_url: '', highlight: '' },
  warning: { type: 'warning', emoji: '⚠️', title: '', body: '', highlight: '' },
  tip: { type: 'tip', emoji: '💡', title: '', body: '', highlight: '' },
  example: { type: 'example', emoji: '📌', title: '', body: '', highlight: '' },
  quiz: { type: 'quiz', question: '', options: ['', ''], correct_index: 0, explanation: '' },
  checklist: { type: 'checklist', title: '', items: [''] },
  reward: { type: 'reward', xp: 20, next_guide_slug: '' },
}

const REFERENCE_BLOCK_DEFAULTS = {
  heading: { type: 'heading', text: '' },
  paragraph: { type: 'paragraph', text: '' },
  image: { type: 'image', url: '', caption: '' },
  list: { type: 'list', items: [''] },
  highlight: { type: 'highlight', text: '' },
}

function fieldsForCourseBlock(block, i) {
  switch (block.type) {
    case 'hook':
      return `
        <input class="be-field" data-i="${i}" data-f="emoji" placeholder="Emoji" value="${escapeHtml(block.emoji || '')}" />
        <input class="be-field" data-i="${i}" data-f="headline" placeholder="Titular" value="${escapeHtml(block.headline || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="subtext" placeholder="Subtexto">${escapeHtml(block.subtext || '')}</textarea>`
    case 'concept':
    case 'warning':
    case 'tip':
    case 'example':
      return `
        <input class="be-field" data-i="${i}" data-f="emoji" placeholder="Emoji" value="${escapeHtml(block.emoji || '')}" />
        <input class="be-field" data-i="${i}" data-f="title" placeholder="Título" value="${escapeHtml(block.title || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="body" placeholder="Texto">${escapeHtml(block.body || '')}</textarea>
        <input class="be-field" data-i="${i}" data-f="image_url" placeholder="URL de imagen (opcional)" value="${escapeHtml(block.image_url || '')}" />
        <input class="be-field" data-i="${i}" data-f="highlight" placeholder="Destacado (opcional)" value="${escapeHtml(block.highlight || '')}" />`
    case 'quiz':
      return `
        <input class="be-field" data-i="${i}" data-f="question" placeholder="Pregunta" value="${escapeHtml(block.question || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="options" placeholder="Opciones (una por línea)">${escapeHtml((block.options || []).join('\n'))}</textarea>
        <input class="be-field" data-i="${i}" data-f="correct_index" type="number" placeholder="Índice de la correcta (0, 1, 2...)" value="${block.correct_index ?? 0}" />
        <textarea class="be-field" data-i="${i}" data-f="explanation" placeholder="Explicación">${escapeHtml(block.explanation || '')}</textarea>`
    case 'checklist':
      return `
        <input class="be-field" data-i="${i}" data-f="title" placeholder="Título" value="${escapeHtml(block.title || '')}" />
        <textarea class="be-field" data-i="${i}" data-f="items" placeholder="Items (uno por línea)">${escapeHtml((block.items || []).join('\n'))}</textarea>`
    case 'reward':
      return `
        <input class="be-field" data-i="${i}" data-f="xp" type="number" placeholder="XP" value="${block.xp ?? 20}" />
        <input class="be-field" data-i="${i}" data-f="next_guide_slug" placeholder="Slug del siguiente curso (opcional)" value="${escapeHtml(block.next_guide_slug || '')}" />`
    default:
      return ''
  }
}

function fieldsForReferenceBlock(block, i) {
  switch (block.type) {
    case 'heading':
    case 'highlight':
      return `<input class="rbe-field" data-i="${i}" data-f="text" placeholder="Texto" value="${escapeHtml(block.text || '')}" />`
    case 'paragraph':
      return `<textarea class="rbe-field" data-i="${i}" data-f="text" placeholder="Texto">${escapeHtml(block.text || '')}</textarea>`
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

function makeSortable(containerEl, list, onChange) {
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

function renderCourseBlockEditor(blocks) {
  const el = document.getElementById('blockEditorList')
  el.innerHTML = blocks
    .map(
      (b, i) => `
    <div class="block-editor-item" data-index="${i}">
      <div class="block-editor-item-header">
        <select class="be-type" data-i="${i}">
          ${Object.keys(COURSE_BLOCK_DEFAULTS)
            .map((t) => `<option value="${t}" ${t === b.type ? 'selected' : ''}>${t}</option>`)
            .join('')}
        </select>
        <span class="remove-block" data-i="${i}">Quitar ×</span>
      </div>
      ${fieldsForCourseBlock(b, i)}
    </div>`
    )
    .join('')

  el.querySelectorAll('.be-type').forEach((sel) =>
    sel.addEventListener('change', () => {
      const i = Number(sel.dataset.i)
      blocks[i] = { ...COURSE_BLOCK_DEFAULTS[sel.value] }
      renderCourseBlockEditor(blocks)
    })
  )
  el.querySelectorAll('.remove-block').forEach((btn) =>
    btn.addEventListener('click', () => {
      blocks.splice(Number(btn.dataset.i), 1)
      renderCourseBlockEditor(blocks)
    })
  )
  el.querySelectorAll('.be-field').forEach((input) =>
    input.addEventListener('input', () => {
      const i = Number(input.dataset.i)
      const f = input.dataset.f
      if (f === 'options' || f === 'items') {
        blocks[i][f] = input.value.split('\n').map((s) => s.trim()).filter(Boolean)
      } else if (f === 'correct_index' || f === 'xp') {
        blocks[i][f] = Number(input.value) || 0
      } else {
        blocks[i][f] = input.value
      }
    })
  )
  makeSortable(el, blocks, () => renderCourseBlockEditor(blocks))
}

function renderReferenceBlockEditor(blocks) {
  const el = document.getElementById('refBlockEditorList')
  el.innerHTML = blocks
    .map(
      (b, i) => `
    <div class="block-editor-item" data-index="${i}">
      <div class="block-editor-item-header">
        <select class="rbe-type" data-i="${i}">
          ${Object.keys(REFERENCE_BLOCK_DEFAULTS)
            .map((t) => `<option value="${t}" ${t === b.type ? 'selected' : ''}>${t}</option>`)
            .join('')}
        </select>
        <span class="remove-block" data-i="${i}">Quitar ×</span>
      </div>
      ${fieldsForReferenceBlock(b, i)}
    </div>`
    )
    .join('')

  el.querySelectorAll('.rbe-type').forEach((sel) =>
    sel.addEventListener('change', () => {
      const i = Number(sel.dataset.i)
      blocks[i] = { ...REFERENCE_BLOCK_DEFAULTS[sel.value] }
      renderReferenceBlockEditor(blocks)
    })
  )
  el.querySelectorAll('.remove-block').forEach((btn) =>
    btn.addEventListener('click', () => {
      blocks.splice(Number(btn.dataset.i), 1)
      renderReferenceBlockEditor(blocks)
    })
  )
  el.querySelectorAll('.rbe-field').forEach((input) =>
    input.addEventListener('input', () => {
      const i = Number(input.dataset.i)
      const f = input.dataset.f
      blocks[i][f] = f === 'items' ? input.value.split('\n').map((s) => s.trim()).filter(Boolean) : input.value
    })
  )
  makeSortable(el, blocks, () => renderReferenceBlockEditor(blocks))
}

function openGuideModal(guide) {
  const g = guide || {
    title: '',
    slug: '',
    description: '',
    category_id: categories[0]?.id || '',
    emoji: '',
    estimated_mins: 5,
    level: 'Básico',
    badge: 'Gratis',
    order_pos: guidesCache.length,
    tags: [],
    search_content: '',
    published_at: null,
    blocks: [],
    reference_blocks: [],
  }

  const courseBlocks = JSON.parse(JSON.stringify(g.blocks || []))
  const refBlocks = JSON.parse(JSON.stringify(g.reference_blocks || []))

  openModal(`
    <h3>${guide ? 'Editar' : 'Nueva'} guía</h3>
    <div class="form-group"><label>Título</label><input id="gTitle" value="${escapeHtml(g.title)}" /></div>
    <div class="form-group"><label>Slug</label><input id="gSlug" value="${escapeHtml(g.slug)}" /></div>
    <div class="form-group"><label>Categoría</label>
      <select id="gCategory">${categories.map((c) => `<option value="${c.id}" ${c.id === g.category_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
    </div>
    <div class="form-group"><label>Emoji</label><input id="gEmoji" value="${escapeHtml(g.emoji || '')}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="gDescription">${escapeHtml(g.description || '')}</textarea></div>
    <div class="form-group"><label>Nivel</label>
      <select id="gLevel">
        ${['Básico', 'Intermedio', 'Avanzado'].map((l) => `<option ${l === g.level ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Badge</label>
      <select id="gBadge">
        <option ${g.badge === 'Gratis' ? 'selected' : ''}>Gratis</option>
        <option ${g.badge === 'Pro' ? 'selected' : ''}>Pro</option>
      </select>
    </div>
    <div class="form-group"><label>Minutos estimados</label><input id="gMins" type="number" value="${g.estimated_mins || 5}" /></div>
    <div class="form-group"><label>Orden</label><input id="gOrder" type="number" value="${g.order_pos ?? 0}" /></div>
    <div class="form-group"><label>Tags (separados por coma)</label><input id="gTags" value="${escapeHtml((g.tags || []).join(', '))}" /></div>
    <div class="form-group"><label>Contenido de búsqueda</label><textarea id="gSearchContent">${escapeHtml(g.search_content || '')}</textarea></div>
    <div class="form-group">
      <label><input type="checkbox" id="gPublished" ${g.published_at ? 'checked' : ''} /> Publicada</label>
    </div>

    <h4 style="margin: 16px 0 8px; font-weight: 800;">Bloques del curso</h4>
    <div id="blockEditorList"></div>
    <button class="btn-secondary" id="btnAddCourseBlock" style="margin-bottom: 16px;">+ Añadir bloque</button>

    <h4 style="margin: 16px 0 8px; font-weight: 800;">Bloques de referencia (guía)</h4>
    <div id="refBlockEditorList"></div>
    <button class="btn-secondary" id="btnAddRefBlock" style="margin-bottom: 16px;">+ Añadir bloque</button>

    <button class="btn-primary btn-block" id="btnSaveGuide">Guardar</button>`)

  renderCourseBlockEditor(courseBlocks)
  renderReferenceBlockEditor(refBlocks)

  document.getElementById('btnAddCourseBlock').addEventListener('click', () => {
    courseBlocks.push({ ...COURSE_BLOCK_DEFAULTS.concept })
    renderCourseBlockEditor(courseBlocks)
  })
  document.getElementById('btnAddRefBlock').addEventListener('click', () => {
    refBlocks.push({ ...REFERENCE_BLOCK_DEFAULTS.paragraph })
    renderReferenceBlockEditor(refBlocks)
  })

  document.getElementById('btnSaveGuide').addEventListener('click', async () => {
    const published = document.getElementById('gPublished').checked
    const payload = {
      title: document.getElementById('gTitle').value.trim(),
      slug: document.getElementById('gSlug').value.trim(),
      category_id: document.getElementById('gCategory').value,
      emoji: document.getElementById('gEmoji').value.trim(),
      description: document.getElementById('gDescription').value.trim(),
      level: document.getElementById('gLevel').value,
      badge: document.getElementById('gBadge').value,
      estimated_mins: Number(document.getElementById('gMins').value) || 5,
      order_pos: Number(document.getElementById('gOrder').value) || 0,
      tags: document.getElementById('gTags').value.split(',').map((s) => s.trim()).filter(Boolean),
      search_content: document.getElementById('gSearchContent').value.trim(),
      published_at: published ? g.published_at || new Date().toISOString() : null,
      blocks: courseBlocks,
      reference_blocks: refBlocks,
    }
    if (g.id) payload.id = g.id
    await supabase.from('guides').upsert(payload)
    closeModal()
    loadGuides()
  })
}

document.getElementById('btnNewGuide').addEventListener('click', () => openGuideModal(null))

// ── Learning paths ──
async function loadPaths() {
  const { data } = await supabase.from('learning_paths').select('*').order('order_pos')
  const paths = data || []

  document.getElementById('pathsTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Emoji</th><th>Nombre</th><th>Slug</th><th></th></tr></thead>
      <tbody>
        ${paths
          .map(
            (p) => `
          <tr>
            <td>${p.emoji || ''}</td>
            <td>${escapeHtml(p.name || p.title || '')}</td>
            <td>${escapeHtml(p.slug)}</td>
            <td class="admin-row-actions">
              <button data-edit="${p.id}">Editar</button>
              <button class="danger" data-delete="${p.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('#pathsTable [data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openPathModal(paths.find((p) => p.id === btn.dataset.edit)))
  )
  document.querySelectorAll('#pathsTable [data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta ruta?')) return
      await supabase.from('learning_paths').delete().eq('id', btn.dataset.delete)
      loadPaths()
    })
  )
}

function openPathModal(path) {
  const p = path || { name: '', slug: '', description: '', emoji: '', order_pos: 0 }
  openModal(`
    <h3>${path ? 'Editar' : 'Nueva'} ruta</h3>
    <div class="form-group"><label>Nombre</label><input id="pName" value="${escapeHtml(p.name || '')}" /></div>
    <div class="form-group"><label>Slug (usa uno de los 5 estilos: beginner_path, anti_scam_path, smart_buying_path, card_value_path, collecting_mastery_path)</label><input id="pSlug" value="${escapeHtml(p.slug)}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="pDescription">${escapeHtml(p.description || '')}</textarea></div>
    <div class="form-group"><label>Emoji</label><input id="pEmoji" value="${escapeHtml(p.emoji || '')}" /></div>
    <div class="form-group"><label>Orden</label><input id="pOrder" type="number" value="${p.order_pos ?? 0}" /></div>
    <button class="btn-primary btn-block" id="btnSavePath">Guardar</button>`)

  document.getElementById('btnSavePath').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('pName').value.trim(),
      slug: document.getElementById('pSlug').value.trim(),
      description: document.getElementById('pDescription').value.trim(),
      emoji: document.getElementById('pEmoji').value.trim(),
      order_pos: Number(document.getElementById('pOrder').value) || 0,
    }
    if (p.id) payload.id = p.id
    await supabase.from('learning_paths').upsert(payload)
    closeModal()
    loadPaths()
  })
}

document.getElementById('btnNewPath').addEventListener('click', () => openPathModal(null))

// ── Achievements ──
async function loadAchievements() {
  const { data } = await supabase.from('achievements').select('*').order('order_pos')
  const achievements = data || []

  document.getElementById('achievementsTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Icono</th><th>Nombre</th><th>Condición</th><th>XP</th><th></th></tr></thead>
      <tbody>
        ${achievements
          .map(
            (a) => `
          <tr>
            <td>${a.icon || '🏆'}</td>
            <td>${escapeHtml(a.name)}</td>
            <td>${a.condition_type === 'total_xp' ? `XP ≥ ${a.condition_value}` : `Cursos completados ≥ ${a.condition_value}`}</td>
            <td>${a.xp_reward || 0}</td>
            <td class="admin-row-actions">
              <button data-edit="${a.id}">Editar</button>
              <button class="danger" data-delete="${a.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('#achievementsTable [data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openAchievementModal(achievements.find((a) => a.id === btn.dataset.edit)))
  )
  document.querySelectorAll('#achievementsTable [data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este logro?')) return
      await supabase.from('achievements').delete().eq('id', btn.dataset.delete)
      invalidateAchievementsCache()
      loadAchievements()
    })
  )
}

function openAchievementModal(achievement) {
  const a = achievement || {
    key: '',
    name: '',
    description: '',
    icon: '🏆',
    xp_reward: 0,
    condition_type: 'completed_count',
    condition_value: 1,
    order_pos: 0,
  }
  openModal(`
    <h3>${achievement ? 'Editar' : 'Nuevo'} logro</h3>
    <div class="form-group"><label>Clave única</label><input id="aKey" value="${escapeHtml(a.key)}" placeholder="first_course" /></div>
    <div class="form-group"><label>Nombre</label><input id="aName" value="${escapeHtml(a.name)}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="aDescription">${escapeHtml(a.description || '')}</textarea></div>
    <div class="form-group"><label>Icono (emoji)</label><input id="aIcon" value="${escapeHtml(a.icon || '')}" /></div>
    <div class="form-group"><label>Tipo de condición</label>
      <select id="aConditionType">
        <option value="completed_count" ${a.condition_type === 'completed_count' ? 'selected' : ''}>Cursos completados</option>
        <option value="total_xp" ${a.condition_type === 'total_xp' ? 'selected' : ''}>XP total</option>
      </select>
    </div>
    <div class="form-group"><label>Valor de la condición</label><input id="aConditionValue" type="number" value="${a.condition_value ?? 1}" /></div>
    <div class="form-group"><label>XP de recompensa</label><input id="aXpReward" type="number" value="${a.xp_reward ?? 0}" /></div>
    <div class="form-group"><label>Orden</label><input id="aOrder" type="number" value="${a.order_pos ?? 0}" /></div>
    <button class="btn-primary btn-block" id="btnSaveAchievement">Guardar</button>`)

  document.getElementById('btnSaveAchievement').addEventListener('click', async () => {
    const payload = {
      key: document.getElementById('aKey').value.trim(),
      name: document.getElementById('aName').value.trim(),
      description: document.getElementById('aDescription').value.trim(),
      icon: document.getElementById('aIcon').value.trim(),
      condition_type: document.getElementById('aConditionType').value,
      condition_value: Number(document.getElementById('aConditionValue').value) || 0,
      xp_reward: Number(document.getElementById('aXpReward').value) || 0,
      order_pos: Number(document.getElementById('aOrder').value) || 0,
    }
    if (a.id) payload.id = a.id
    await supabase.from('achievements').upsert(payload)
    invalidateAchievementsCache()
    closeModal()
    loadAchievements()
  })
}

document.getElementById('btnNewAchievement').addEventListener('click', () => openAchievementModal(null))

// ── Users ──
async function loadUsers() {
  const { data } = await supabase
    .from('user_profiles')
    .select('id, username, total_xp, level, is_admin')
    .order('total_xp', { ascending: false })
  const users = data || []

  document.getElementById('usersTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Nombre</th><th>Nivel</th><th>XP</th><th>Admin</th><th></th></tr></thead>
      <tbody>
        ${users
          .map(
            (u) => `
          <tr>
            <td>${escapeHtml(u.username || u.id)}</td>
            <td>${escapeHtml(u.level || 'Novato')}</td>
            <td>${u.total_xp || 0}</td>
            <td>${u.is_admin ? '✓' : ''}</td>
            <td class="admin-row-actions">
              <button data-toggle-admin="${u.id}" data-current="${u.is_admin ? '1' : '0'}">${u.is_admin ? 'Quitar admin' : 'Hacer admin'}</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('[data-toggle-admin]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const makeAdmin = btn.dataset.current !== '1'
      await supabase.from('user_profiles').update({ is_admin: makeAdmin }).eq('id', btn.dataset.toggleAdmin)
      loadUsers()
    })
  )
}

// ── Notifications ──
async function loadNotifications() {
  const { data } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(20)
  const notifications = data || []

  document.getElementById('notificationsTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Título</th><th>Mensaje</th><th>Enviada</th></tr></thead>
      <tbody>
        ${notifications
          .map(
            (n) => `
          <tr>
            <td>${escapeHtml(n.title)}</td>
            <td>${escapeHtml(n.message)}</td>
            <td>${new Date(n.created_at).toLocaleString('es-ES')}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`
}

document.getElementById('btnSendNotification').addEventListener('click', async () => {
  const title = document.getElementById('notifTitle').value.trim()
  const message = document.getElementById('notifMessage').value.trim()
  if (!title || !message) return
  await supabase.from('notifications').insert({ title, message, target: 'all' })
  document.getElementById('notifTitle').value = ''
  document.getElementById('notifMessage').value = ''
  loadNotifications()
})

// ── Images (Supabase Storage) ──
async function loadImages() {
  const { data, error } = await supabase.storage.from('images').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
  const grid = document.getElementById('imagesGrid')

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p class="empty-state">No hay imágenes todavía.</p>`
    return
  }

  grid.innerHTML = data
    .filter((f) => f.name && !f.name.endsWith('/'))
    .map((f) => {
      const { data: pub } = supabase.storage.from('images').getPublicUrl(f.name)
      return `
      <div class="admin-image-tile" data-url="${pub.publicUrl}">
        <img src="${pub.publicUrl}" loading="lazy" />
        <div class="fname">${escapeHtml(f.name)}</div>
      </div>`
    })
    .join('')

  grid.querySelectorAll('.admin-image-tile').forEach((tile) =>
    tile.addEventListener('click', () => {
      navigator.clipboard?.writeText(tile.dataset.url)
      alert(`URL copiada:\n${tile.dataset.url}`)
    })
  )
}

document.getElementById('imageUploadInput').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (!file) return
  const path = `${Date.now()}-${file.name}`
  const { error } = await supabase.storage.from('images').upload(path, file)
  if (error) {
    alert('Error al subir la imagen: ' + error.message)
    return
  }
  e.target.value = ''
  loadImages()
})

// ── Init ──
async function init() {
  const session = await checkAccess()
  if (!session) return

  initSidebar()
  await loadCategories()
  await Promise.all([
    loadDashboard(),
    loadGuides(),
    loadPaths(),
    loadAchievements(),
    loadUsers(),
    loadNotifications(),
    loadImages(),
  ])
}

init()
