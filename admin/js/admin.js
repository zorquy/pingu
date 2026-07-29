import { supabase } from '../../js/supabase.js'
import { escapeHtml, getSession } from '../../js/app.js'
import { invalidateAchievementsCache } from '../../js/gamification.js'

let categories = []
let guidesCache = []
let collectionsCache = []
let pathsCache = []

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
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${completedCount || 0}</div><div>Cursos completados *</div></div>
    <div class="admin-card"><div class="value" style="font-size:28px;font-weight:800;color:var(--navy);">${guideCount || 0}</div><div>Guías publicadas</div></div>
    <p style="grid-column: 1/-1; font-size: 12px; color: var(--text-mid);">* Por las políticas RLS actuales de <code>user_progress</code> (solo <code>auth.uid() = user_id</code>, sin excepción para admins), esta cifra solo cuenta tus propios cursos completados, no los de todos los usuarios. Para un total real haría falta añadir una política de lectura para admins en esa tabla.</p>`
}

// ── Categories ──
async function recalcCategoryGuideCount(categoryId) {
  if (!categoryId) return
  const { count } = await supabase
    .from('guides')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .not('published_at', 'is', null)
  await supabase.from('categories').update({ guide_count: count || 0 }).eq('id', categoryId)
}

async function loadCategories() {
  const { data } = await supabase.from('categories').select('*').order('order_pos')
  categories = data || []

  document.getElementById('categoriesTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Orden</th><th>Emoji</th><th>Nombre</th><th>Slug</th><th>Guías</th><th></th></tr></thead>
      <tbody>
        ${categories
          .map(
            (c) => `
          <tr>
            <td>${c.order_pos ?? ''}</td>
            <td>${c.emoji || ''}</td>
            <td>${escapeHtml(c.name)}</td>
            <td>${escapeHtml(c.slug)}</td>
            <td>${c.guide_count ?? 0}</td>
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
  const c = category || { name: '', slug: '', description: '', emoji: '', cover_image: '', order_pos: categories.length }
  openModal(`
    <h3>${category ? 'Editar' : 'Nueva'} categoría</h3>
    <div class="form-group"><label>Nombre</label><input id="catName" value="${escapeHtml(c.name)}" /></div>
    <div class="form-group"><label>Slug</label><input id="catSlug" value="${escapeHtml(c.slug)}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="catDescription">${escapeHtml(c.description || '')}</textarea></div>
    <div class="form-group"><label>Emoji</label><input id="catEmoji" value="${escapeHtml(c.emoji || '')}" /></div>
    <div class="form-group"><label>Imagen de portada (URL)</label><input id="catCoverImage" value="${escapeHtml(c.cover_image || '')}" /></div>
    <div class="form-group"><label>Orden</label><input id="catOrder" type="number" value="${c.order_pos ?? 0}" /></div>
    <button class="btn-primary btn-block" id="btnSaveCategory">Guardar</button>`)

  document.getElementById('btnSaveCategory').addEventListener('click', async () => {
    const payload = {
      name: document.getElementById('catName').value.trim(),
      slug: document.getElementById('catSlug').value.trim(),
      description: document.getElementById('catDescription').value.trim(),
      emoji: document.getElementById('catEmoji').value.trim(),
      cover_image: document.getElementById('catCoverImage').value.trim() || null,
      order_pos: Number(document.getElementById('catOrder').value) || 0,
    }
    if (c.id) payload.id = c.id
    await supabase.from('categories').upsert(payload)
    closeModal()
    loadCategories()
  })
}

document.getElementById('btnNewCategory').addEventListener('click', () => openCategoryModal(null))

// ── Guide collections ──
async function loadCollections() {
  const { data } = await supabase.from('guide_collections').select('*, categories(name)').order('created_at')
  collectionsCache = data || []

  document.getElementById('collectionsTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Emoji</th><th>Título</th><th>Categoría</th><th>Slug</th><th></th></tr></thead>
      <tbody>
        ${collectionsCache
          .map(
            (col) => `
          <tr>
            <td>${col.emoji || ''}</td>
            <td>${escapeHtml(col.title)}</td>
            <td>${escapeHtml(col.categories?.name || '—')}</td>
            <td>${escapeHtml(col.slug)}</td>
            <td class="admin-row-actions">
              <button data-edit="${col.id}">Editar</button>
              <button class="danger" data-delete="${col.id}">Eliminar</button>
            </td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>`

  document.querySelectorAll('#collectionsTable [data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openCollectionModal(collectionsCache.find((c) => c.id === btn.dataset.edit)))
  )
  document.querySelectorAll('#collectionsTable [data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta colección? Las guías dentro no se eliminan, solo quedan sin colección.')) return
      await supabase.from('guide_collections').delete().eq('id', btn.dataset.delete)
      loadCollections()
    })
  )
}

function openCollectionModal(collection) {
  const col = collection || { title: '', slug: '', emoji: '', description: '', category_id: categories[0]?.id || '' }
  openModal(`
    <h3>${collection ? 'Editar' : 'Nueva'} colección</h3>
    <div class="form-group"><label>Título</label><input id="colTitle" value="${escapeHtml(col.title)}" /></div>
    <div class="form-group"><label>Slug</label><input id="colSlug" value="${escapeHtml(col.slug)}" /></div>
    <div class="form-group"><label>Emoji</label><input id="colEmoji" value="${escapeHtml(col.emoji || '')}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="colDescription">${escapeHtml(col.description || '')}</textarea></div>
    <div class="form-group"><label>Categoría</label>
      <select id="colCategory">${categories.map((c) => `<option value="${c.id}" ${c.id === col.category_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
    </div>
    <button class="btn-primary btn-block" id="btnSaveCollection">Guardar</button>`)

  document.getElementById('btnSaveCollection').addEventListener('click', async () => {
    const payload = {
      title: document.getElementById('colTitle').value.trim(),
      slug: document.getElementById('colSlug').value.trim(),
      emoji: document.getElementById('colEmoji').value.trim(),
      description: document.getElementById('colDescription').value.trim(),
      category_id: document.getElementById('colCategory').value,
    }
    if (col.id) payload.id = col.id
    await supabase.from('guide_collections').upsert(payload)
    closeModal()
    loadCollections()
  })
}

document.getElementById('btnNewCollection').addEventListener('click', () => openCollectionModal(null))

// ── Guides ──
async function loadGuides() {
  const { data } = await supabase.from('guides').select('*, categories(name)').order('created_at', { ascending: false })
  guidesCache = data || []

  document.getElementById('guidesTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Título</th><th>Categoría</th><th>Estado</th><th></th></tr></thead>
      <tbody>
        ${guidesCache
          .map(
            (g) => `
          <tr>
            <td>${g.cover_emoji || ''} ${escapeHtml(g.title)}${g.is_pro ? ' <span class="badge badge-pro">Pro</span>' : ''}</td>
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
      const g = guidesCache.find((x) => x.id === btn.dataset.delete)
      await supabase.from('guides').delete().eq('id', btn.dataset.delete)
      await recalcCategoryGuideCount(g?.category_id)
      loadGuides()
      loadCategories()
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
  truefalse: { type: 'truefalse', statement: '', is_true: true, explanation: '' },
  fillblank: { type: 'fillblank', before: '', after: '', options: ['', ''], correct_option: '' },
  match: { type: 'match', title: '', pairs: [{ left: '', right: '' }, { left: '', right: '' }] },
  order: { type: 'order', title: '', items: ['', '', ''] },
  checklist: { type: 'checklist', title: '', items: [''] },
  reward: { type: 'reward', next_guide_slug: '' },
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

async function saveGuideRoutes(guideId, selectedRoutes) {
  await supabase.from('guide_routes').delete().eq('guide_id', guideId)
  if (selectedRoutes.length > 0) {
    await supabase.from('guide_routes').insert(
      selectedRoutes.map((r) => ({ guide_id: guideId, route_id: r.routeId, position: r.position }))
    )
  }
}

async function openGuideModal(guide) {
  let existingPositions = {}
  if (guide) {
    const { data: routes } = await supabase.from('guide_routes').select('route_id, position').eq('guide_id', guide.id)
    existingPositions = (routes || []).reduce((acc, r) => {
      acc[r.route_id] = r.position
      return acc
    }, {})
  }

  const g = guide || {
    title: '',
    slug: '',
    description: '',
    category_id: categories[0]?.id || '',
    cover_emoji: '',
    cover_image: '',
    estimated_mins: 5,
    level: 'beginner',
    guide_rarity: 'bronze',
    is_pro: false,
    xp_reward: 20,
    tags: [],
    search_content: '',
    published_at: null,
    blocks: [],
    reference_blocks: [],
    reference_unlocked_by_default: false,
    collection_id: '',
    collection_order: 0,
  }

  const courseBlocks = JSON.parse(JSON.stringify(g.blocks || []))
  const refBlocks = JSON.parse(JSON.stringify(g.reference_blocks || []))
  const collectionsForCategory = collectionsCache.filter((c) => c.category_id === g.category_id)

  openModal(`
    <h3>${guide ? 'Editar' : 'Nueva'} guía</h3>
    <div class="tabs" id="guideModalTabs">
      <button class="tab-btn active" data-gtab="general">General</button>
      <button class="tab-btn" data-gtab="course">Bloques del curso</button>
      <button class="tab-btn" data-gtab="reference">Guía de referencia</button>
      <button class="tab-btn" data-gtab="routes">Rutas</button>
    </div>

    <div class="tab-panel active" id="gtab-general">
      <div class="form-group"><label>Título</label><input id="gTitle" value="${escapeHtml(g.title)}" /></div>
      <div class="form-group"><label>Slug</label><input id="gSlug" value="${escapeHtml(g.slug)}" /></div>
      <div class="form-group"><label>Categoría</label>
        <select id="gCategory">${categories.map((c) => `<option value="${c.id}" ${c.id === g.category_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Colección (opcional)</label>
        <select id="gCollection">
          <option value="">Ninguna</option>
          ${collectionsForCategory.map((c) => `<option value="${c.id}" ${c.id === g.collection_id ? 'selected' : ''}>${escapeHtml(c.title)}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Orden dentro de la colección</label><input id="gCollectionOrder" type="number" value="${g.collection_order ?? 0}" /></div>
      <div class="form-group"><label>Emoji de portada</label><input id="gCoverEmoji" value="${escapeHtml(g.cover_emoji || '')}" /></div>
      <div class="form-group"><label>Imagen de portada (URL)</label><input id="gCoverImage" value="${escapeHtml(g.cover_image || '')}" /></div>
      <div class="form-group"><label>Descripción</label><textarea id="gDescription">${escapeHtml(g.description || '')}</textarea></div>
      <div class="form-group"><label>Nivel</label>
        <select id="gLevel">
          <option value="beginner" ${g.level === 'beginner' ? 'selected' : ''}>Básico</option>
          <option value="intermediate" ${g.level === 'intermediate' ? 'selected' : ''}>Intermedio</option>
          <option value="advanced" ${g.level === 'advanced' ? 'selected' : ''}>Avanzado</option>
        </select>
      </div>
      <div class="form-group"><label>Rareza</label>
        <select id="gRarity">
          ${['bronze', 'silver', 'gold', 'platinum'].map((r) => `<option value="${r}" ${g.guide_rarity === r ? 'selected' : ''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label><input type="checkbox" id="gIsPro" ${g.is_pro ? 'checked' : ''} /> Contenido Pro</label></div>
      <div class="form-group"><label>XP de recompensa (al completar el curso)</label><input id="gXpReward" type="number" value="${g.xp_reward ?? 20}" /></div>
      <div class="form-group"><label>Minutos estimados</label><input id="gMins" type="number" value="${g.estimated_mins || 5}" /></div>
      <div class="form-group"><label>Tags (separados por coma)</label><input id="gTags" value="${escapeHtml((g.tags || []).join(', '))}" /></div>
      <div class="form-group"><label>Contenido de búsqueda</label><textarea id="gSearchContent">${escapeHtml(g.search_content || '')}</textarea></div>
      <div class="form-group">
        <label><input type="checkbox" id="gPublished" ${g.published_at ? 'checked' : ''} /> Publicada</label>
      </div>
      <div class="form-group">
        <label><input type="checkbox" id="gRefUnlocked" ${g.reference_unlocked_by_default ? 'checked' : ''} /> Guía de referencia desbloqueada por defecto (si no, hay que completar el curso primero)</label>
      </div>
    </div>

    <div class="tab-panel" id="gtab-course">
      <div id="blockEditorList"></div>
      <button class="btn-secondary" id="btnAddCourseBlock">+ Añadir bloque</button>
    </div>

    <div class="tab-panel" id="gtab-reference">
      <div id="refBlockEditorList"></div>
      <button class="btn-secondary" id="btnAddRefBlock">+ Añadir bloque</button>
    </div>

    <div class="tab-panel" id="gtab-routes">
      <div id="guideRoutesList">
        ${pathsCache
          .map((p) => {
            const existing = (g.route_ids || []).includes(p.id)
            return `
          <div class="form-group" style="flex-direction: row; align-items: center; gap: 8px;">
            <input type="checkbox" class="gr-check" data-route-id="${p.id}" ${existing ? 'checked' : ''} />
            <span style="flex:1;">${p.emoji || ''} ${escapeHtml(p.title)}</span>
            <input type="number" class="gr-position" data-route-id="${p.id}" placeholder="Posición" style="width: 90px;" value="${existingPositions[p.id] ?? 0}" />
          </div>`
          })
          .join('')}
      </div>
    </div>

    <button class="btn-primary btn-block" id="btnSaveGuide" style="margin-top: 16px;">Guardar</button>`)

  document.getElementById('guideModalTabs').querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('guideModalTabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
      modalContent.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`gtab-${btn.dataset.gtab}`).classList.add('active')
    })
  })

  renderCourseBlockEditor(courseBlocks)
  renderReferenceBlockEditor(refBlocks)

  document.getElementById('gCategory').addEventListener('change', (e) => {
    const newCollections = collectionsCache.filter((c) => c.category_id === e.target.value)
    document.getElementById('gCollection').innerHTML =
      `<option value="">Ninguna</option>` +
      newCollections.map((c) => `<option value="${c.id}">${escapeHtml(c.title)}</option>`).join('')
  })

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
    const newCategoryId = document.getElementById('gCategory').value
    const collectionId = document.getElementById('gCollection').value || null

    const selectedRoutes = Array.from(document.querySelectorAll('.gr-check:checked')).map((chk) => ({
      routeId: chk.dataset.routeId,
      position: Number(document.querySelector(`.gr-position[data-route-id="${chk.dataset.routeId}"]`)?.value) || 0,
    }))

    const payload = {
      title: document.getElementById('gTitle').value.trim(),
      slug: document.getElementById('gSlug').value.trim(),
      category_id: newCategoryId,
      collection_id: collectionId,
      collection_order: Number(document.getElementById('gCollectionOrder').value) || 0,
      cover_emoji: document.getElementById('gCoverEmoji').value.trim(),
      cover_image: document.getElementById('gCoverImage').value.trim() || null,
      description: document.getElementById('gDescription').value.trim(),
      level: document.getElementById('gLevel').value,
      guide_rarity: document.getElementById('gRarity').value,
      is_pro: document.getElementById('gIsPro').checked,
      xp_reward: Number(document.getElementById('gXpReward').value) || 20,
      estimated_mins: Number(document.getElementById('gMins').value) || 5,
      tags: document.getElementById('gTags').value.split(',').map((s) => s.trim()).filter(Boolean),
      search_content: document.getElementById('gSearchContent').value.trim(),
      published_at: published ? g.published_at || new Date().toISOString() : null,
      reference_unlocked_by_default: document.getElementById('gRefUnlocked').checked,
      blocks: courseBlocks,
      reference_blocks: refBlocks,
      has_reference_blocks: refBlocks.length > 0,
      route_ids: selectedRoutes.map((r) => r.routeId),
    }
    if (g.id) payload.id = g.id

    const { data: saved } = await supabase.from('guides').upsert(payload).select('id').single()
    const guideId = saved?.id || g.id
    if (guideId) await saveGuideRoutes(guideId, selectedRoutes)

    await recalcCategoryGuideCount(newCategoryId)
    if (g.category_id && g.category_id !== newCategoryId) await recalcCategoryGuideCount(g.category_id)

    closeModal()
    loadGuides()
    loadCategories()
  })
}

document.getElementById('btnNewGuide').addEventListener('click', () => openGuideModal(null))

// ── Learning paths ──
async function loadPaths() {
  const { data } = await supabase
    .from('learning_paths')
    .select('*')
    .order('is_featured', { ascending: false })
    .order('title')
  pathsCache = data || []

  document.getElementById('pathsTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Emoji</th><th>Título</th><th>Slug</th><th>Destacada</th><th></th></tr></thead>
      <tbody>
        ${pathsCache
          .map(
            (p) => `
          <tr>
            <td>${p.emoji || ''}</td>
            <td>${escapeHtml(p.title)}</td>
            <td>${escapeHtml(p.slug)}</td>
            <td>${p.is_featured ? '✓' : ''}</td>
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
    btn.addEventListener('click', () => openPathModal(pathsCache.find((p) => p.id === btn.dataset.edit)))
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
  const p = path || { title: '', slug: '', description: '', emoji: '', is_featured: false }
  openModal(`
    <h3>${path ? 'Editar' : 'Nueva'} ruta</h3>
    <div class="form-group"><label>Título</label><input id="pTitle" value="${escapeHtml(p.title || '')}" /></div>
    <div class="form-group"><label>Slug</label><input id="pSlug" value="${escapeHtml(p.slug)}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="pDescription">${escapeHtml(p.description || '')}</textarea></div>
    <div class="form-group"><label>Emoji</label><input id="pEmoji" value="${escapeHtml(p.emoji || '')}" /></div>
    <div class="form-group"><label><input type="checkbox" id="pFeatured" ${p.is_featured ? 'checked' : ''} /> Destacada (se recomienda en el onboarding)</label></div>
    <button class="btn-primary btn-block" id="btnSavePath">Guardar</button>`)

  document.getElementById('btnSavePath').addEventListener('click', async () => {
    const payload = {
      title: document.getElementById('pTitle').value.trim(),
      slug: document.getElementById('pSlug').value.trim(),
      description: document.getElementById('pDescription').value.trim(),
      emoji: document.getElementById('pEmoji').value.trim(),
      is_featured: document.getElementById('pFeatured').checked,
    }
    if (p.id) payload.id = p.id
    await supabase.from('learning_paths').upsert(payload)
    closeModal()
    loadPaths()
  })
}

document.getElementById('btnNewPath').addEventListener('click', () => openPathModal(null))

// ── Achievements ──
const CONDITION_LABELS = {
  completed_guides_count: 'Cursos completados',
  total_xp: 'XP total',
  quiz_correct_count: 'Preguntas acertadas',
}

async function loadAchievements() {
  const { data } = await supabase.from('achievement_definitions').select('*').order('xp_reward')
  const achievements = data || []

  document.getElementById('achievementsTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Icono</th><th>Título</th><th>Rareza</th><th>Condición</th><th>XP</th><th>Activo</th><th></th></tr></thead>
      <tbody>
        ${achievements
          .map(
            (a) => `
          <tr>
            <td>${a.emoji || '🏆'}</td>
            <td>${escapeHtml(a.title)}</td>
            <td><span class="rarity-chip rarity-${a.rarity || 'bronze'}">${escapeHtml(a.rarity || 'bronze')}</span></td>
            <td>${CONDITION_LABELS[a.condition?.type] || a.condition?.type || '—'} ≥ ${a.condition?.count ?? '—'}</td>
            <td>${a.xp_reward || 0}</td>
            <td>${a.is_active ? '✓' : ''}</td>
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
      await supabase.from('achievement_definitions').delete().eq('id', btn.dataset.delete)
      invalidateAchievementsCache()
      loadAchievements()
    })
  )
}

function openAchievementModal(achievement) {
  const a = achievement || {
    id: '',
    title: '',
    description: '',
    emoji: '🏆',
    icon_url: '',
    cover_image: '',
    rarity: 'bronze',
    xp_reward: 50,
    is_active: true,
    condition: { type: 'completed_guides_count', count: 1 },
  }
  openModal(`
    <h3>${achievement ? 'Editar' : 'Nuevo'} logro</h3>
    <div class="form-group"><label>Clave única (id)</label><input id="aId" value="${escapeHtml(a.id)}" placeholder="first_course" ${achievement ? 'disabled' : ''} /></div>
    <div class="form-group"><label>Título</label><input id="aTitle" value="${escapeHtml(a.title)}" /></div>
    <div class="form-group"><label>Descripción</label><textarea id="aDescription">${escapeHtml(a.description || '')}</textarea></div>
    <div class="form-group"><label>Emoji</label><input id="aEmoji" value="${escapeHtml(a.emoji || '')}" /></div>
    <div class="form-group"><label>Icono (URL, opcional)</label><input id="aIconUrl" value="${escapeHtml(a.icon_url || '')}" /></div>
    <div class="form-group"><label>Imagen de portada (URL, opcional)</label><input id="aCoverImage" value="${escapeHtml(a.cover_image || '')}" /></div>
    <div class="form-group"><label>Rareza</label>
      <select id="aRarity">
        ${['bronze', 'silver', 'gold', 'platinum'].map((r) => `<option value="${r}" ${a.rarity === r ? 'selected' : ''}>${r}</option>`).join('')}
      </select>
    </div>
    <div class="form-group"><label>Tipo de condición</label>
      <select id="aConditionType">
        <option value="completed_guides_count" ${a.condition?.type === 'completed_guides_count' ? 'selected' : ''}>Cursos completados</option>
        <option value="total_xp" ${a.condition?.type === 'total_xp' ? 'selected' : ''}>XP total</option>
        <option value="quiz_correct_count" ${a.condition?.type === 'quiz_correct_count' ? 'selected' : ''}>Preguntas acertadas</option>
      </select>
    </div>
    <div class="form-group"><label>Valor de la condición</label><input id="aConditionCount" type="number" value="${a.condition?.count ?? 1}" /></div>
    <div class="form-group"><label>XP de recompensa</label><input id="aXpReward" type="number" value="${a.xp_reward ?? 50}" /></div>
    <div class="form-group"><label><input type="checkbox" id="aIsActive" ${a.is_active ? 'checked' : ''} /> Activo</label></div>
    <button class="btn-primary btn-block" id="btnSaveAchievement">Guardar</button>`)

  document.getElementById('btnSaveAchievement').addEventListener('click', async () => {
    const payload = {
      title: document.getElementById('aTitle').value.trim(),
      description: document.getElementById('aDescription').value.trim(),
      emoji: document.getElementById('aEmoji').value.trim(),
      icon_url: document.getElementById('aIconUrl').value.trim() || null,
      cover_image: document.getElementById('aCoverImage').value.trim() || null,
      rarity: document.getElementById('aRarity').value,
      condition: {
        type: document.getElementById('aConditionType').value,
        count: Number(document.getElementById('aConditionCount').value) || 0,
      },
      xp_reward: Number(document.getElementById('aXpReward').value) || 0,
      is_active: document.getElementById('aIsActive').checked,
    }
    if (achievement) {
      payload.id = a.id
    } else {
      const newId = document.getElementById('aId').value.trim()
      if (!newId) return
      payload.id = newId
    }
    await supabase.from('achievement_definitions').upsert(payload)
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
    .select('id, username, display_name, total_xp, level, is_admin, is_pro')
    .order('total_xp', { ascending: false })
  const users = data || []

  document.getElementById('usersTable').innerHTML = `
    <table class="admin-table">
      <thead><tr><th>Nombre</th><th>Nivel</th><th>XP</th><th>Admin</th><th>Pro</th><th></th></tr></thead>
      <tbody>
        ${users
          .map(
            (u) => `
          <tr>
            <td>${escapeHtml(u.display_name || u.username || u.id)}</td>
            <td>${escapeHtml(u.level || 'Novato')}</td>
            <td>${u.total_xp || 0}</td>
            <td>${u.is_admin ? '✓' : ''}</td>
            <td>${u.is_pro ? '✓' : ''}</td>
            <td class="admin-row-actions">
              <button data-toggle-admin="${u.id}" data-current="${u.is_admin ? '1' : '0'}">${u.is_admin ? 'Quitar admin' : 'Hacer admin'}</button>
              <button data-toggle-pro="${u.id}" data-current="${u.is_pro ? '1' : '0'}">${u.is_pro ? 'Quitar Pro' : 'Hacer Pro'}</button>
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
  document.querySelectorAll('[data-toggle-pro]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const makePro = btn.dataset.current !== '1'
      await supabase.from('user_profiles').update({ is_pro: makePro }).eq('id', btn.dataset.togglePro)
      loadUsers()
    })
  )
}

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
  await Promise.all([loadCollections(), loadPaths()])
  await Promise.all([loadDashboard(), loadGuides(), loadAchievements(), loadUsers(), loadImages()])
}

init()
