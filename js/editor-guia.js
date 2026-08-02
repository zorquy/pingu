import { supabase } from './supabase.js'
import { escapeHtml, requireAuth, slugify, uploadGuideImage } from './app.js'
import {
  renderCourseBlockEditor,
  renderReferenceBlocksHtml,
  flattenReferenceBlocksToText,
  COURSE_BLOCK_DEFAULTS,
} from './block-editor.js'
import { initRichTextEditor, richTextToolbarHtml } from './richtext-editor.js'
import { showToast } from './toast.js'
import { loadDraft, clearDraft, startAutosave } from './editor-autosave.js'
import { attachEmojiPicker } from './emoji-picker.js'

const params = new URLSearchParams(window.location.search)
const guideId = params.get('id')

let currentSession = null
let existingGuide = null
let courseBlocks = []
let refBlocks = []
let coverImageUrl = ''
let draftScope = null
let stopAutosave = () => {}

function updateCoverImagePreview() {
  document.getElementById('mgCoverImagePreview').src = coverImageUrl
  document.getElementById('mgCoverImagePreview').classList.toggle('hidden', !coverImageUrl)
  document.getElementById('btnRemoveCoverImage').classList.toggle('hidden', !coverImageUrl)
}

function captureState() {
  return {
    title: document.getElementById('mgTitle').value,
    category_id: document.getElementById('mgCategory').value,
    cover_emoji: document.getElementById('mgCoverEmoji').value,
    cover_image: coverImageUrl,
    description: document.getElementById('mgDescription').value,
    level: document.getElementById('mgLevel').value,
    refBlocks,
    courseBlocks,
  }
}

function applyDraftState(state) {
  document.getElementById('mgTitle').value = state.title || ''
  if (state.category_id) document.getElementById('mgCategory').value = state.category_id
  document.getElementById('mgCoverEmoji').value = state.cover_emoji || ''
  coverImageUrl = state.cover_image || ''
  updateCoverImagePreview()
  document.getElementById('mgDescription').value = state.description || ''
  document.getElementById('mgLevel').value = state.level || 'beginner'
  refBlocks = state.refBlocks || []
  courseBlocks = state.courseBlocks || []
}

function setRefHtml(html) {
  refBlocks = html.trim() ? [{ type: 'richtext', html }] : []
  updateCourseGate()
}

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

function renderRef() {
  const toolbarEl = document.getElementById('refRteToolbar')
  toolbarEl.innerHTML = richTextToolbarHtml()
  // Si la guía es de antes del editor WYSIWYG, tenía varios bloques
  // (encabezado/párrafo/imagen...); los convertimos una vez a HTML para
  // seguir editándolos en la superficie continua nueva.
  const initialHtml = refBlocks.length === 1 && refBlocks[0].type === 'richtext' ? refBlocks[0].html : renderReferenceBlocksHtml(refBlocks)
  initRichTextEditor({
    toolbarEl,
    surfaceEl: document.getElementById('refRteSurface'),
    initialHtml,
    onChange: setRefHtml,
    uploadImage: (file) => uploadGuideImage(currentSession.user.id, file),
  })
  setRefHtml(initialHtml)
}

function renderCourse() {
  renderCourseBlockEditor(document.getElementById('blockEditorList'), courseBlocks, (file) => uploadGuideImage(currentSession.user.id, file))
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
  coverImageUrl = data.cover_image || ''
  updateCoverImagePreview()
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
    cover_image: coverImageUrl || null,
    description: document.getElementById('mgDescription').value.trim(),
    level: document.getElementById('mgLevel').value,
    blocks: courseBlocks,
    reference_blocks: refBlocks,
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

let saving = false

async function save(reviewStatus) {
  if (saving) return
  const title = document.getElementById('mgTitle').value.trim()
  if (!title) {
    showToast('Ponle un título a tu guía antes de guardar.')
    return
  }
  if (reviewStatus === 'pending' && refBlocks.length === 0) {
    showToast('Añade contenido en la Guía antes de enviarla a revisión.')
    return
  }

  saving = true
  document.getElementById('btnSaveDraft').disabled = true
  document.getElementById('btnSubmit').disabled = true

  const payload = buildPayload(reviewStatus)
  if (existingGuide?.id) payload.id = existingGuide.id

  const { error } = await supabase.from('guides').upsert(payload)
  if (error) {
    showToast('No se pudo guardar la guía: ' + error.message)
    saving = false
    document.getElementById('btnSaveDraft').disabled = false
    document.getElementById('btnSubmit').disabled = false
    return
  }
  stopAutosave()
  clearDraft(draftScope)
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
  attachEmojiPicker(document.getElementById('mgCoverEmoji'))

  if (guideId) await loadExistingGuide(currentSession)
  await loadCategoriesForSelect(existingGuide?.category_id)

  draftScope = `${currentSession.user.id}:${guideId || 'new'}`
  const draft = loadDraft(draftScope)
  if (draft && confirm('Hay un borrador sin guardar de esta guía (autoguardado). ¿Quieres recuperarlo?')) {
    applyDraftState(draft.data)
  }

  renderRef()
  renderCourse()
  updateCourseGate()
  stopAutosave = startAutosave(draftScope, captureState)

  document.getElementById('btnAddCourseBlock').addEventListener('click', () => {
    courseBlocks.push({ ...COURSE_BLOCK_DEFAULTS.concept })
    renderCourse()
  })

  document.getElementById('btnUploadCoverImage').addEventListener('click', () => document.getElementById('mgCoverImageFile').click())
  document.getElementById('mgCoverImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file) return
    try {
      coverImageUrl = await uploadGuideImage(currentSession.user.id, file)
      updateCoverImagePreview()
    } catch (err) {
      showToast('No se pudo subir la imagen: ' + err.message)
    }
  })
  document.getElementById('btnRemoveCoverImage').addEventListener('click', () => {
    coverImageUrl = ''
    updateCoverImagePreview()
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
