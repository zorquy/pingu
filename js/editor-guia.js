import { supabase } from './supabase.js'
import { escapeHtml, requireAuth, slugify } from './app.js'
import {
  renderCourseBlockEditor,
  renderReferenceBlockEditor,
  renderReferenceBlocksHtml,
  flattenReferenceBlocksToText,
  COURSE_BLOCK_DEFAULTS,
  REFERENCE_BLOCK_DEFAULTS,
} from './block-editor.js'

const params = new URLSearchParams(window.location.search)
const guideId = params.get('id')

let currentSession = null
let existingGuide = null
let courseBlocks = []
let refBlocks = []

async function loadCategoriesForSelect(selectedId) {
  const { data } = await supabase.from('categories').select('id, name').order('order_pos')
  const categories = data || []
  document.getElementById('mgCategory').innerHTML = categories
    .map((c) => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
    .join('')
  return categories
}

function updateCourseGate() {
  const locked = refBlocks.length === 0
  document.getElementById('courseLockedNotice').classList.toggle('hidden', !locked)
  document.getElementById('courseBlockEditorContent').classList.toggle('hidden', locked)
  document.getElementById('btnToggleRefPreview').classList.toggle('hidden', locked)
  if (locked) document.getElementById('refPreviewPanel').classList.add('hidden')
}

function updateLivePreview() {
  const html = renderReferenceBlocksHtml(refBlocks)
  document.getElementById('refLivePreview').innerHTML =
    html || `<p class="empty-state" style="padding: 20px 0;">Empieza a escribir para ver aquí cómo va quedando.</p>`
}

function renderRef() {
  renderReferenceBlockEditor(document.getElementById('refBlockEditorList'), refBlocks)
  updateLivePreview()
}

function renderCourse() {
  renderCourseBlockEditor(document.getElementById('blockEditorList'), courseBlocks)
}

async function loadExistingGuide(session) {
  const { data, error } = await supabase.from('guides').select('*').eq('id', guideId).single()
  if (error || !data || data.author_id !== session.user.id) {
    window.location.href = 'perfil.html'
    return
  }
  if (!['draft', 'rejected'].includes(data.review_status)) {
    window.location.href = 'perfil.html'
    return
  }
  existingGuide = data
  document.getElementById('editorTitle').textContent = 'Editar guía'
  document.getElementById('mgTitle').value = data.title || ''
  document.getElementById('mgCoverEmoji').value = data.cover_emoji || ''
  document.getElementById('mgDescription').value = data.description || ''
  document.getElementById('mgLevel').value = data.level || 'beginner'
  courseBlocks = JSON.parse(JSON.stringify(data.blocks || []))
  refBlocks = JSON.parse(JSON.stringify(data.reference_blocks || []))
}

function buildPayload(reviewStatus) {
  const title = document.getElementById('mgTitle').value.trim()
  return {
    title,
    slug: existingGuide?.slug || `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`,
    category_id: document.getElementById('mgCategory').value,
    cover_emoji: document.getElementById('mgCoverEmoji').value.trim(),
    description: document.getElementById('mgDescription').value.trim(),
    level: document.getElementById('mgLevel').value,
    blocks: courseBlocks,
    reference_blocks: refBlocks,
    has_reference_blocks: refBlocks.length > 0,
    author_id: currentSession.user.id,
    review_status: reviewStatus,
    submitted_at: reviewStatus === 'pending' ? new Date().toISOString() : existingGuide?.submitted_at || null,
    estimated_mins: existingGuide?.estimated_mins || 5,
    xp_reward: existingGuide?.xp_reward || 20,
    guide_rarity: existingGuide?.guide_rarity || 'bronze',
    is_pro: false,
    tags: existingGuide?.tags || [],
  }
}

async function save(reviewStatus) {
  const title = document.getElementById('mgTitle').value.trim()
  if (!title) {
    alert('Ponle un título a tu guía antes de guardar.')
    return
  }
  if (reviewStatus === 'pending' && refBlocks.length === 0) {
    alert('Añade contenido en Documentación antes de enviar la guía a revisión.')
    return
  }
  if (reviewStatus === 'pending' && courseBlocks.length === 0) {
    alert('Añade al menos un bloque al curso interactivo antes de enviarlo a revisión.')
    return
  }

  const payload = buildPayload(reviewStatus)
  if (existingGuide?.id) payload.id = existingGuide.id

  const { error } = await supabase.from('guides').upsert(payload)
  if (error) {
    alert('No se pudo guardar la guía: ' + error.message)
    return
  }
  window.location.href = 'perfil.html'
}

function wireTabs() {
  document.getElementById('editorTabs').querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('editorTabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
      document.querySelectorAll('.tab-panel[id^="etab-"]').forEach((p) => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`etab-${btn.dataset.etab}`).classList.add('active')
    })
  })
}

async function init() {
  currentSession = await requireAuth()
  if (!currentSession) return

  wireTabs()

  if (guideId) await loadExistingGuide(currentSession)
  await loadCategoriesForSelect(existingGuide?.category_id)

  renderRef()
  renderCourse()
  updateCourseGate()

  const refListEl = document.getElementById('refBlockEditorList')
  new MutationObserver(updateCourseGate).observe(refListEl, { childList: true })
  ;['input', 'change', 'click', 'drop'].forEach((evt) => refListEl.addEventListener(evt, updateLivePreview))

  document.getElementById('btnAddRefBlock').addEventListener('click', () => {
    refBlocks.push({ ...REFERENCE_BLOCK_DEFAULTS.paragraph })
    renderRef()
  })

  document.getElementById('btnAddCourseBlock').addEventListener('click', () => {
    courseBlocks.push({ ...COURSE_BLOCK_DEFAULTS.concept })
    renderCourse()
  })

  document.getElementById('btnToggleRefPreview').addEventListener('click', () => {
    const panel = document.getElementById('refPreviewPanel')
    const willShow = panel.classList.contains('hidden')
    if (willShow) {
      panel.textContent = flattenReferenceBlocksToText(refBlocks) || 'La documentación todavía no tiene texto.'
    }
    panel.classList.toggle('hidden', !willShow)
  })

  document.getElementById('btnSaveDraft').addEventListener('click', () => save('draft'))
  document.getElementById('btnSubmit').addEventListener('click', () => save('pending'))
}

init()
