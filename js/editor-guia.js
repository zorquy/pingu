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

// Una guía que YA está en revisión no se guarda con los mismos dos
// botones que un borrador.
//
// "Guardar borrador" la sacaría de la cola del equipo sin decírselo a
// nadie: el autor creería que ha guardado y lo que habría hecho es
// retirarla de revisión. Y "Enviar a revisión" no significa nada cuando
// ya está enviada. Así que se deja un botón solo, que guarda dejándola
// donde está.
function marcarEnRevision() {
  document.getElementById('btnSaveDraft').classList.add('hidden')
  document.getElementById('btnSubmit').textContent = 'Guardar cambios'
  const aviso = document.getElementById('editorAvisoRevision')
  aviso.textContent =
    'Esta guía está en revisión. Puedes seguir editándola: el equipo revisará la última versión que hayas guardado.'
  aviso.classList.remove('hidden')
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
  // `pending` entra aquí a propósito. Escribir una guía lleva días y
  // antes, en cuanto le dabas a "Enviar a revisión", esta página te
  // echaba a perfil.html: no podías tocarla ni para una errata. Quien la
  // mandó a medias se quedaba sin poder terminarla.
  //
  // `approved` sigue fuera: esa ya la ha leído el equipo y la está
  // leyendo la comunidad. Cambiarla por detrás sería publicar sin
  // revisar.
  if (!['draft', 'rejected', 'pending'].includes(data.review_status)) {
    window.location.href = 'perfil.html'
    return
  }
  existingGuide = data
  document.getElementById('editorTitle').textContent = 'Editar guía'
  if (data.review_status === 'pending') marcarEnRevision()
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
    // El buscador busca en `search_content`, no dentro de
    // `reference_blocks` (que es JSON y Postgres no sabe recorrer con un
    // ilike). Este editor no tiene campo para eso, ni debería tenerlo:
    // nadie va a escribir a mano una copia en plano de su propio
    // artículo. Se saca del texto de la guía al guardar.
    //
    // Sin esto, de una guía de la comunidad solo se podían encontrar el
    // título y la descripción — el artículo entero era invisible para el
    // buscador.
    search_content: flattenReferenceBlocksToText(refBlocks),
    author_id: currentSession.user.id,
    review_status: reviewStatus,
    // La fecha de envío es la del envío, no la del último guardado.
    //
    // Desde que se puede seguir editando una guía en revisión, esto
    // importa: el hilo de actividad ordena por `submitted_at` y anuncia
    // "ha enviado a revisión la guía X". Si se pisara en cada guardado,
    // alguien que se pasa la tarde puliendo su guía volvería a la
    // cabecera del hilo cada vez que le da a guardar. Se pone SOLO en el
    // salto de borrador a revisión.
    submitted_at:
      reviewStatus === 'pending' && existingGuide?.review_status !== 'pending'
        ? new Date().toISOString()
        : existingGuide?.submitted_at || null,
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
  // Una guía en revisión no puede quedarse vacía: el equipo tiene algo
  // en su cola y de repente no hay nada que leer. Pero el aviso no puede
  // ser el mismo, porque ya está enviada — decirle "antes de enviarla a
  // revisión" a quien solo está guardando no explica nada.
  if (reviewStatus === 'pending' && refBlocks.length === 0) {
    showToast(
      existingGuide?.review_status === 'pending'
        ? 'La guía no puede quedarse sin contenido mientras está en revisión.'
        : 'Añade contenido en la Guía antes de enviarla a revisión.'
    )
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

  // Se llega aquí desde una petición de guía ("Escribir esta guía"): el
  // título viene puesto para no arrancar con la página en blanco, que es
  // justo lo que frena a la gente.
  const tituloPedido = params.get('titulo')
  if (!guideId && tituloPedido) {
    document.getElementById('mgTitle').value = tituloPedido.slice(0, 120)
    const pedidaPor = params.get('peticion')
    if (pedidaPor) {
      const aviso = document.createElement('p')
      aviso.className = 'subtext editor-desde-peticion'
      aviso.textContent = 'Estás escribiendo una guía que ha pedido alguien de la comunidad. Cuando la publiques, podrás avisarles desde Comunidad → Peticiones.'
      document.getElementById('mgTitle').closest('.form-group')?.after(aviso)
    }
  }
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
