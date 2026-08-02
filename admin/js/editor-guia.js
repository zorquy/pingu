import { supabase } from '../../js/supabase.js'
import { escapeHtml, getSession, uploadGuideImage } from '../../js/app.js'
import {
  COURSE_BLOCK_DEFAULTS,
  flattenReferenceBlocksToText,
  renderCourseBlockEditor,
  renderReferenceBlocksHtml,
} from '../../js/block-editor.js'
import { initRichTextEditor, richTextToolbarHtml } from '../../js/richtext-editor.js'
import { showToast } from '../../js/toast.js'
import { icons } from '../../js/icons.js'
import { loadDraft, clearDraft, startAutosave } from '../../js/editor-autosave.js'
import { attachEmojiPicker } from '../../js/emoji-picker.js'
import { addXP } from '../../js/gamification.js'
import { createNotification } from '../../js/notifications.js'

const params = new URLSearchParams(window.location.search)
const guideId = params.get('id')

const REVIEW_STATUS_BADGE = {
  draft: '<span class="badge badge-progress">Borrador</span>',
  pending: '<span class="badge badge-pro">Pendiente de revisión</span>',
  approved: '<span class="badge badge-completed">Aprobada</span>',
  rejected: '<span class="badge badge-danger">Rechazada</span>',
}

let currentSession = null
let existingGuide = null
let categories = []
let collectionsCache = []
let pathsCache = []
let existingRoutePositions = {}
let courseBlocks = []
let refBlocks = []
let coverImageUrl = ''
let draftScope = null
let stopAutosave = () => {}
let proBlocks = []
let proActive = false
let proPublishedAt = null

function updateCoverImagePreview() {
  document.getElementById('gCoverImagePreview').src = coverImageUrl
  document.getElementById('gCoverImagePreview').classList.toggle('hidden', !coverImageUrl)
  document.getElementById('btnRemoveCoverImage').classList.toggle('hidden', !coverImageUrl)
}

function captureState() {
  return {
    title: document.getElementById('gTitle').value,
    category_id: document.getElementById('gCategory').value,
    cover_emoji: document.getElementById('gCoverEmoji').value,
    cover_image: coverImageUrl,
    description: document.getElementById('gDescription').value,
    level: document.getElementById('gLevel').value,
    refBlocks,
    courseBlocks,
    proBlocks,
    proActive,
  }
}

function applyDraftState(state) {
  document.getElementById('gTitle').value = state.title || ''
  if (state.category_id) document.getElementById('gCategory').value = state.category_id
  document.getElementById('gCoverEmoji').value = state.cover_emoji || ''
  coverImageUrl = state.cover_image || ''
  updateCoverImagePreview()
  document.getElementById('gDescription').value = state.description || ''
  document.getElementById('gLevel').value = state.level || 'beginner'
  refBlocks = state.refBlocks || []
  courseBlocks = state.courseBlocks || []
  proBlocks = state.proBlocks || []
  proActive = !!state.proActive
}

function setRefHtml(html) {
  refBlocks = html.trim() ? [{ type: 'richtext', html }] : []
  updateCourseGate()
}

function setProHtml(html) {
  proBlocks = html.trim() ? [{ type: 'richtext', html }] : []
}

function updateProStatusBadge() {
  const badge = document.getElementById('proStatusBadge')
  badge.innerHTML = proPublishedAt
    ? `<span class="badge badge-completed">${icons.checkCircle(13)} Publicada</span>`
    : '<span class="badge badge-progress">Borrador (sin publicar)</span>'
}

function renderPro() {
  document.getElementById('proActivateWrap').classList.toggle('hidden', proActive)
  document.getElementById('proEditorWrap').classList.toggle('hidden', !proActive)
  if (!proActive) return

  updateProStatusBadge()
  const toolbarEl = document.getElementById('proRteToolbar')
  toolbarEl.innerHTML = richTextToolbarHtml()
  const initialHtml = proBlocks[0]?.html || ''
  initRichTextEditor({
    toolbarEl,
    surfaceEl: document.getElementById('proRteSurface'),
    initialHtml,
    onChange: setProHtml,
    uploadImage: (file) => uploadGuideImage(currentSession.user.id, file),
  })
  setProHtml(initialHtml)
}

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
  document.getElementById('editorRoot').classList.remove('hidden')
  return session
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

async function loadCategoriesAndCollections(selectedCategoryId) {
  const [{ data: cats }, { data: cols }] = await Promise.all([
    supabase.from('categories').select('id, name').order('order_pos'),
    supabase.from('guide_collections').select('*').order('created_at'),
  ])
  categories = cats || []
  collectionsCache = cols || []

  document.getElementById('gCategory').innerHTML = categories
    .map((c) => `<option value="${c.id}" ${c.id === selectedCategoryId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`)
    .join('')

  document.getElementById('gCategory').addEventListener('change', (e) => renderCollectionOptions(e.target.value))
}

function renderCollectionOptions(categoryId, selectedCollectionId) {
  const forCategory = collectionsCache.filter((c) => c.category_id === categoryId)
  document.getElementById('gCollection').innerHTML =
    `<option value="">Ninguna</option>` +
    forCategory.map((c) => `<option value="${c.id}" ${c.id === selectedCollectionId ? 'selected' : ''}>${escapeHtml(c.title)}</option>`).join('')
}

async function loadPaths(guide) {
  const { data } = await supabase.from('learning_paths').select('*').order('is_featured', { ascending: false }).order('title')
  pathsCache = data || []

  if (guide) {
    const { data: routes } = await supabase.from('guide_routes').select('route_id, position').eq('guide_id', guide.id)
    existingRoutePositions = (routes || []).reduce((acc, r) => {
      acc[r.route_id] = r.position
      return acc
    }, {})
  }

  const existingIds = guide?.route_ids || []
  document.getElementById('guideRoutesList').innerHTML = pathsCache
    .map((p) => {
      const checked = existingIds.includes(p.id)
      return `
      <div class="form-group" style="flex-direction: row; align-items: center; gap: 8px;">
        <input type="checkbox" class="gr-check" data-route-id="${p.id}" ${checked ? 'checked' : ''} />
        <span style="flex:1;">${p.emoji || ''} ${escapeHtml(p.title)}</span>
        <input type="number" class="gr-position" data-route-id="${p.id}" placeholder="Posición" style="width: 90px;" value="${existingRoutePositions[p.id] ?? 0}" />
      </div>`
    })
    .join('')
}

async function saveGuideRoutes(id, selectedRoutes) {
  await supabase.from('guide_routes').delete().eq('guide_id', id)
  if (selectedRoutes.length > 0) {
    await supabase.from('guide_routes').insert(selectedRoutes.map((r) => ({ guide_id: id, route_id: r.routeId, position: r.position })))
  }
}

async function recalcCategoryGuideCount(categoryId) {
  if (!categoryId) return
  const { count } = await supabase
    .from('guides')
    .select('*', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .not('published_at', 'is', null)
  await supabase.from('categories').update({ guide_count: count || 0 }).eq('id', categoryId)
}

async function loadExistingGuide() {
  const { data } = await supabase.from('guides').select('*').eq('id', guideId).single()
  if (!data) return
  existingGuide = data
  document.getElementById('editorTitle').textContent = 'Editar guía'

  document.getElementById('gTitle').value = data.title || ''
  document.getElementById('gSlug').value = data.slug || ''
  document.getElementById('gCoverEmoji').value = data.cover_emoji || ''
  coverImageUrl = data.cover_image || ''
  updateCoverImagePreview()
  document.getElementById('gDescription').value = data.description || ''
  document.getElementById('gLevel').value = data.level || 'beginner'
  document.getElementById('gRarity').value = data.guide_rarity || 'bronze'
  document.getElementById('gIsPro').checked = !!data.is_pro
  document.getElementById('gXpReward').value = data.xp_reward ?? 20
  document.getElementById('gMins').value = data.estimated_mins || 5
  document.getElementById('gTags').value = (data.tags || []).join(', ')
  document.getElementById('gSearchContent').value = data.search_content || ''
  document.getElementById('gPublished').checked = !!data.published_at
  document.getElementById('gRefUnlocked').checked = !!data.reference_unlocked_by_default
  document.getElementById('gCollectionOrder').value = data.collection_order ?? 0

  courseBlocks = JSON.parse(JSON.stringify(data.blocks || []))
  refBlocks = JSON.parse(JSON.stringify(data.reference_blocks || []))

  const { data: proContent } = await supabase.from('guide_pro_content').select('*').eq('guide_id', data.id).maybeSingle()
  if (proContent) {
    proActive = true
    proBlocks = proContent.blocks || []
    proPublishedAt = proContent.published_at || null
  }

  if (data.author_id) {
    const { data: author } = await supabase.from('user_profiles').select('display_name, username').eq('id', data.author_id).single()
    const authorName = author?.display_name || author?.username || 'Usuario'
    document.getElementById('submissionBanner').innerHTML = `
      <div class="admin-ai-generate" style="margin-top: 12px;">
        <span>Enviada por <strong>${escapeHtml(authorName)}</strong> ${REVIEW_STATUS_BADGE[data.review_status] || ''}</span>
        ${data.review_status === 'rejected' && data.rejection_reason ? `<span style="font-size:12px; color:#dc2626;">Motivo del rechazo: ${escapeHtml(data.rejection_reason)}</span>` : ''}
      </div>`
  }

  if (data.review_status === 'pending') {
    document.getElementById('btnApproveGuide').classList.remove('hidden')
    document.getElementById('btnRejectGuide').classList.remove('hidden')
  }
}

function buildPayload() {
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
    cover_image: coverImageUrl || null,
    description: document.getElementById('gDescription').value.trim(),
    level: document.getElementById('gLevel').value,
    guide_rarity: document.getElementById('gRarity').value,
    is_pro: document.getElementById('gIsPro').checked,
    xp_reward: Number(document.getElementById('gXpReward').value) || 20,
    estimated_mins: Number(document.getElementById('gMins').value) || 5,
    tags: document.getElementById('gTags').value.split(',').map((s) => s.trim()).filter(Boolean),
    search_content: document.getElementById('gSearchContent').value.trim(),
    published_at: published ? existingGuide?.published_at || new Date().toISOString() : null,
    reference_unlocked_by_default: document.getElementById('gRefUnlocked').checked,
    blocks: courseBlocks,
    reference_blocks: refBlocks,
    has_pro_content: !!proPublishedAt,
    route_ids: selectedRoutes.map((r) => r.routeId),
  }
  if (existingGuide?.id) payload.id = existingGuide.id
  return { payload, newCategoryId, selectedRoutes }
}

let saving = false

async function notifyFollowersOfNewGuide(authorId, title, slug) {
  const { data: followers } = await supabase.from('user_follows').select('follower_id').eq('following_id', authorId)
  for (const f of followers || []) {
    await createNotification({
      recipientId: f.follower_id,
      actorId: authorId,
      type: 'followed_guide_published',
      title: 'Nueva guía publicada',
      body: title,
      link: `/guia.html?slug=${slug}`,
    })
  }
}

async function persistGuide(extraFields = {}) {
  if (saving) return
  saving = true
  document.getElementById('btnSaveGuide').disabled = true
  document.getElementById('btnApproveGuide').disabled = true

  const wasApproved = existingGuide?.review_status === 'approved'
  const authorId = existingGuide?.author_id || null

  const { payload, newCategoryId, selectedRoutes } = buildPayload()
  Object.assign(payload, extraFields)

  const { data: saved, error } = await supabase.from('guides').upsert(payload).select('id').single()
  if (error) {
    showToast('No se pudo guardar la guía: ' + error.message)
    saving = false
    document.getElementById('btnSaveGuide').disabled = false
    document.getElementById('btnApproveGuide').disabled = false
    return
  }
  const id = saved?.id || existingGuide?.id
  if (id) await saveGuideRoutes(id, selectedRoutes)
  if (id && proActive) {
    await supabase.from('guide_pro_content').upsert({ guide_id: id, blocks: proBlocks, published_at: proPublishedAt }, { onConflict: 'guide_id' })
  }

  // Recompensa al autor de la comunidad la primera vez que se aprueba su
  // guía (no en cada guardado posterior) — mismo XP que ya se le da al
  // dar el curso, para que publicar también cuente como progreso.
  if (extraFields.review_status === 'approved' && !wasApproved && authorId) {
    await addXP(authorId, payload.xp_reward)
    await createNotification({
      recipientId: authorId,
      actorId: currentSession.user.id,
      type: 'guide_approved',
      title: 'Tu guía ha sido aprobada',
      body: payload.title,
      link: `/guia.html?slug=${payload.slug}`,
    })
    await notifyFollowersOfNewGuide(authorId, payload.title, payload.slug)
  }

  await recalcCategoryGuideCount(newCategoryId)
  if (existingGuide?.category_id && existingGuide.category_id !== newCategoryId) await recalcCategoryGuideCount(existingGuide.category_id)

  stopAutosave()
  clearDraft(draftScope)
  window.location.href = 'index.html'
}

async function init() {
  const session = await checkAccess()
  if (!session) return
  currentSession = session

  wireTabs()
  attachEmojiPicker(document.getElementById('gCoverEmoji'))

  if (guideId) await loadExistingGuide()
  await loadCategoriesAndCollections(existingGuide?.category_id)
  renderCollectionOptions(existingGuide?.category_id || categories[0]?.id, existingGuide?.collection_id)
  await loadPaths(existingGuide)

  draftScope = `${currentSession.user.id}:${guideId || 'new'}`
  const draft = loadDraft(draftScope)
  if (draft && confirm('Hay un borrador sin guardar de esta guía (autoguardado). ¿Quieres recuperarlo?')) {
    applyDraftState(draft.data)
  }

  renderRef()
  renderCourse()
  renderPro()
  updateCourseGate()
  stopAutosave = startAutosave(draftScope, captureState)

  document.getElementById('btnUploadCoverImage').addEventListener('click', () => document.getElementById('gCoverImageFile').click())
  document.getElementById('gCoverImageFile').addEventListener('change', async (e) => {
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

  document.getElementById('btnActivatePro').addEventListener('click', () => {
    const initialHtml = refBlocks[0]?.type === 'richtext' ? refBlocks[0].html : renderReferenceBlocksHtml(refBlocks)
    proBlocks = initialHtml.trim() ? [{ type: 'richtext', html: initialHtml }] : []
    proActive = true
    renderPro()
  })

  document.getElementById('btnPublishPro').addEventListener('click', async () => {
    if (!existingGuide?.id) {
      showToast('Guarda la guía primero antes de publicar la Guía Pro.')
      return
    }
    proPublishedAt = new Date().toISOString()
    await supabase.from('guide_pro_content').upsert({ guide_id: existingGuide.id, blocks: proBlocks, published_at: proPublishedAt }, { onConflict: 'guide_id' })
    await supabase.from('guides').update({ has_pro_content: true }).eq('id', existingGuide.id)
    updateProStatusBadge()
    showToast('Guía Pro publicada.', 'success')
  })

  document.getElementById('btnUnpublishPro').addEventListener('click', async () => {
    if (!existingGuide?.id) return
    proPublishedAt = null
    await supabase.from('guide_pro_content').update({ published_at: null }).eq('guide_id', existingGuide.id)
    await supabase.from('guides').update({ has_pro_content: false }).eq('id', existingGuide.id)
    updateProStatusBadge()
    showToast('Guía Pro despublicada — ya no es visible para los usuarios Pro.', 'success')
  })

  document.getElementById('btnAddCourseBlock').addEventListener('click', () => {
    courseBlocks.push({ ...COURSE_BLOCK_DEFAULTS.concept })
    renderCourse()
  })

  document.getElementById('btnToggleRefPreview').addEventListener('click', () => {
    const panel = document.getElementById('refPreviewPanel')
    const willShow = panel.classList.contains('hidden')
    if (willShow) panel.textContent = flattenReferenceBlocksToText(refBlocks) || 'La documentación todavía no tiene texto.'
    panel.classList.toggle('hidden', !willShow)
  })

  document.getElementById('btnGenerateCourseAI').addEventListener('click', async (e) => {
    const btn = e.currentTarget
    const title = document.getElementById('gTitle').value.trim()
    const description = document.getElementById('gDescription').value.trim()
    const referenceText = flattenReferenceBlocksToText(refBlocks)

    if (!title || !referenceText) {
      showToast('Rellena el título y la Guía antes de generar el curso con IA.')
      return
    }
    if (courseBlocks.length > 0 && !confirm(`Esto reemplazará los ${courseBlocks.length} bloques actuales del curso por los generados. ¿Continuar?`)) {
      return
    }

    const originalLabel = btn.textContent
    btn.disabled = true
    btn.textContent = 'Generando…'
    try {
      const res = await fetch('/.netlify/functions/generate-course', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${currentSession.access_token}` },
        body: JSON.stringify({ title, description, referenceText, blockCount: 7 }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Error desconocido')
      courseBlocks.splice(0, courseBlocks.length, ...result.blocks)
      renderCourse()
    } catch (err) {
      showToast('No se pudo generar el curso con IA: ' + err.message)
    } finally {
      btn.disabled = false
      btn.textContent = originalLabel
    }
  })

  document.getElementById('btnSaveGuide').addEventListener('click', () => persistGuide())
  document.getElementById('btnApproveGuide').addEventListener('click', () =>
    persistGuide({ review_status: 'approved', published_at: new Date().toISOString() })
  )
  document.getElementById('btnRejectGuide').addEventListener('click', async () => {
    const reason = window.prompt('¿Por qué se rechaza esta guía? (se le mostrará al autor)')
    if (reason === null) return
    await supabase.from('guides').update({ review_status: 'rejected', rejection_reason: reason }).eq('id', existingGuide.id)
    if (existingGuide.author_id) {
      await createNotification({
        recipientId: existingGuide.author_id,
        actorId: currentSession.user.id,
        type: 'guide_rejected',
        title: 'Tu guía ha sido rechazada',
        body: reason,
        link: '/perfil.html',
      })
    }
    stopAutosave()
    clearDraft(draftScope)
    window.location.href = 'index.html'
  })
}

init()
