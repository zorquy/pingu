import { supabase } from './supabase.js'
import { escapeHtml, getInitial, requireAuth, signOut, uploadProfileImage } from './app.js'
import { getAllAchievements, levelProgress } from './gamification.js'
import { renderCourseBlockEditor, renderReferenceBlockEditor } from './block-editor.js'
import { renderWall } from './wall.js'

let currentSession = null
let currentProfile = null
let categoriesCache = []
let achievementsCache = []

function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

const REVIEW_STATUS_LABELS = {
  draft: { text: 'Borrador', badgeClass: 'badge-progress' },
  pending: { text: 'Pendiente de revisión', badgeClass: 'badge-pro' },
  approved: { text: 'Publicada', badgeClass: 'badge-completed' },
  rejected: { text: 'Rechazada', badgeClass: 'badge-danger' },
}

function displayName(profile, fallbackEmail) {
  return profile?.display_name || profile?.username || fallbackEmail || 'Usuario'
}

function applyHeroVisuals(profile, name) {
  const banner = document.getElementById('heroBanner')
  const bannerUrl = profile?.banner_url
  banner.style.background = bannerUrl
    ? `url('${bannerUrl.replace(/'/g, '%27')}') center/cover`
    : profile?.banner_color || 'var(--ice)'

  const avatar = document.getElementById('heroAvatar')
  const avatarUrl = profile?.avatar_url
  if (avatarUrl) {
    avatar.style.backgroundImage = `url('${avatarUrl.replace(/'/g, '%27')}')`
    avatar.textContent = ''
  } else {
    avatar.style.backgroundImage = 'none'
    avatar.style.backgroundColor = profile?.avatar_color || 'var(--navy)'
    avatar.textContent = getInitial(name)
  }
}

async function loadProfile(session) {
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
  currentProfile = profile
  const name = displayName(profile, session.user.email)
  const xp = profile?.total_xp || 0
  const progress = levelProgress(xp)

  applyHeroVisuals(profile, name)

  document.getElementById('heroInfo').innerHTML = `
    <h2>${escapeHtml(name)}${profile?.is_pro ? ' <span class="badge badge-pro">Pro</span>' : ''}</h2>
    <div class="profile-level">${progress.level} · ${xp} XP</div>
    <div class="profile-xp-bar">
      <div class="progress-track"><div class="fill" style="width: ${progress.pct}%"></div></div>
      <div class="xp-label">${progress.next ? `${progress.next - xp} XP para el siguiente nivel` : 'Nivel máximo'}</div>
    </div>
    ${profile?.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}`

  return profile
}

async function loadStats(session, profile) {
  const [{ count: completedCount }, { data: reviews }] = await Promise.all([
    supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('status', 'completed'),
    supabase.from('profile_reviews').select('rating').eq('profile_id', session.user.id),
  ])

  const unlockedCount = (profile?.achievements || []).length
  const avgRating = reviews && reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null

  document.getElementById('profileStats').innerHTML = `
    <div class="stat-card">
      <div class="value">${completedCount || 0}</div>
      <div class="label">Cursos completados</div>
    </div>
    <div class="stat-card">
      <div class="value">${unlockedCount}</div>
      <div class="label">Logros</div>
    </div>
    <div class="stat-card">
      <div class="value">${profile?.quiz_correct_count || 0}</div>
      <div class="label">Preguntas acertadas</div>
    </div>
    <div class="stat-card">
      <div class="value">${avgRating ? `⭐ ${avgRating.toFixed(1)}` : '—'}</div>
      <div class="label">Valoración (${reviews?.length || 0})</div>
    </div>`
}

async function loadAchievements(profile) {
  const unlocked = profile?.achievements || []
  const grid = document.getElementById('achievementsGrid')
  achievementsCache = await getAllAchievements()
  document.getElementById('achievementsCount').textContent = `${unlocked.length}/${achievementsCache.length}`
  grid.innerHTML = achievementsCache
    .map((a) => {
      const isUnlocked = unlocked.includes(a.id)
      return `
      <div class="achievement-tile ${isUnlocked ? '' : 'locked'}">
        <span class="icon rarity-${a.rarity || 'bronze'}">${isUnlocked ? a.emoji || '🏆' : '🔒'}</span>
        <span class="name">${escapeHtml(a.title)}</span>
      </div>`
    })
    .join('')
}

document.getElementById('achievementsToggle')?.addEventListener('click', () => {
  document.getElementById('achievementsAccordion').classList.toggle('open')
})

async function loadCompletedCourses(session) {
  const { data } = await supabase
    .from('user_progress')
    .select('completed_at, guides(title)')
    .eq('user_id', session.user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  const container = document.getElementById('completedCourses')
  if (!data || data.length === 0) {
    container.innerHTML = `<p class="empty-state">Todavía no has completado ningún curso.</p>`
    return
  }

  container.innerHTML = data
    .filter((row) => row.guides)
    .map(
      (row) => `
    <div class="completed-course-row">
      <span>${escapeHtml(row.guides.title)}</span>
      <span class="date">${new Date(row.completed_at).toLocaleDateString('es-ES')}</span>
    </div>`
    )
    .join('')
}

// ── Foto y banner ──
document.getElementById('btnEditBanner')?.addEventListener('click', (e) => {
  e.stopPropagation()
  document.getElementById('bannerFileInput').click()
})
document.getElementById('btnEditAvatar')?.addEventListener('click', (e) => {
  e.stopPropagation()
  document.getElementById('avatarFileInput').click()
})

document.getElementById('bannerFileInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const url = await uploadProfileImage(currentSession.user.id, file, 'banner')
    await supabase.from('user_profiles').update({ banner_url: url }).eq('id', currentSession.user.id)
    currentProfile = { ...currentProfile, banner_url: url }
    applyHeroVisuals(currentProfile, displayName(currentProfile, currentSession.user.email))
  } catch (err) {
    alert('No se pudo subir la imagen: ' + err.message)
  }
})

document.getElementById('avatarFileInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const url = await uploadProfileImage(currentSession.user.id, file, 'avatar')
    await supabase.from('user_profiles').update({ avatar_url: url }).eq('id', currentSession.user.id)
    currentProfile = { ...currentProfile, avatar_url: url }
    applyHeroVisuals(currentProfile, displayName(currentProfile, currentSession.user.email))
  } catch (err) {
    alert('No se pudo subir la imagen: ' + err.message)
  }
})

// ── Mis guías ──
let myGuidesCache = []

async function loadMyGuides(session) {
  const { data } = await supabase
    .from('guides')
    .select('id, title, cover_emoji, review_status, rejection_reason, categories(name)')
    .eq('author_id', session.user.id)
    .order('submitted_at', { ascending: false, nullsFirst: false })

  myGuidesCache = data || []
  const container = document.getElementById('myGuidesList')

  if (myGuidesCache.length === 0) {
    container.innerHTML = `<p class="empty-state">Todavía no has creado ninguna guía. Anímate a compartir lo que sabes.</p>`
    return
  }

  container.innerHTML = myGuidesCache
    .map((g) => {
      const status = REVIEW_STATUS_LABELS[g.review_status] || REVIEW_STATUS_LABELS.draft
      const canEdit = g.review_status === 'draft' || g.review_status === 'rejected'
      return `
      <div class="my-guide-row">
        <span>${g.cover_emoji || '📘'} ${escapeHtml(g.title || 'Sin título')}</span>
        <span class="badge ${status.badgeClass}">${status.text}</span>
        <span class="my-guide-actions">
          ${canEdit ? `<button data-edit="${g.id}">Editar</button>` : ''}
          ${canEdit ? `<button class="danger" data-delete="${g.id}">Eliminar</button>` : ''}
        </span>
        ${g.review_status === 'rejected' && g.rejection_reason ? `<p class="my-guide-reason">Motivo del rechazo: ${escapeHtml(g.rejection_reason)}</p>` : ''}
      </div>`
    })
    .join('')

  container.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => openMyGuideModal(myGuidesCache.find((g) => g.id === btn.dataset.edit)))
  )
  container.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta guía? No se puede deshacer.')) return
      await supabase.from('guides').delete().eq('id', btn.dataset.delete)
      loadMyGuides(currentSession)
    })
  )
}

const modal = document.getElementById('profileModal')
const modalContent = document.getElementById('profileModalContent')

function openModal(html) {
  modalContent.innerHTML = html
  modal.classList.remove('hidden')
}

function closeModal() {
  modal.classList.add('hidden')
  modalContent.innerHTML = ''
}

document.getElementById('profileModalClose')?.addEventListener('click', closeModal)
modal?.addEventListener('click', (e) => {
  if (e.target === modal) closeModal()
})

async function loadCategoriesForSelect() {
  if (categoriesCache.length > 0) return categoriesCache
  const { data } = await supabase.from('categories').select('id, name').order('order_pos')
  categoriesCache = data || []
  return categoriesCache
}

async function openMyGuideModal(guide) {
  const categories = await loadCategoriesForSelect()

  const g = guide || {
    title: '',
    slug: '',
    category_id: categories[0]?.id || '',
    cover_emoji: '',
    description: '',
    level: 'beginner',
    blocks: [],
    reference_blocks: [],
  }

  const courseBlocks = JSON.parse(JSON.stringify(g.blocks || []))
  const refBlocks = JSON.parse(JSON.stringify(g.reference_blocks || []))

  openModal(`
    <h3>${guide ? 'Editar guía' : 'Nueva guía'}</h3>
    <div class="tabs" id="myGuideTabs">
      <button class="tab-btn active" data-mtab="general">General</button>
      <button class="tab-btn" data-mtab="course">Bloques del curso</button>
      <button class="tab-btn" data-mtab="reference">Guía de referencia</button>
    </div>

    <div class="tab-panel active" id="mtab-general">
      <div class="form-group"><label>Título</label><input id="mgTitle" value="${escapeHtml(g.title)}" /></div>
      <div class="form-group"><label>Categoría</label>
        <select id="mgCategory">${categories.map((c) => `<option value="${c.id}" ${c.id === g.category_id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Emoji de portada</label><input id="mgCoverEmoji" value="${escapeHtml(g.cover_emoji || '')}" /></div>
      <div class="form-group"><label>Descripción</label><textarea id="mgDescription">${escapeHtml(g.description || '')}</textarea></div>
      <div class="form-group"><label>Nivel</label>
        <select id="mgLevel">
          <option value="beginner" ${g.level === 'beginner' ? 'selected' : ''}>Básico</option>
          <option value="intermediate" ${g.level === 'intermediate' ? 'selected' : ''}>Intermedio</option>
          <option value="advanced" ${g.level === 'advanced' ? 'selected' : ''}>Avanzado</option>
        </select>
      </div>
      <p class="subtext">La rareza, el XP y si se destaca en la web los decide el equipo de moderación al aprobarla.</p>
    </div>

    <div class="tab-panel" id="mtab-course">
      <div id="myBlockEditorList"></div>
      <button class="btn-secondary" id="btnAddMyCourseBlock">+ Añadir bloque</button>
    </div>

    <div class="tab-panel" id="mtab-reference">
      <div id="myRefBlockEditorList"></div>
      <button class="btn-secondary" id="btnAddMyRefBlock">+ Añadir bloque</button>
    </div>

    <div class="modal-actions" style="flex-direction: row; margin-top: 16px;">
      <button class="btn-outline" id="btnSaveMyGuideDraft" style="flex:1;">Guardar borrador</button>
      <button class="btn-primary" id="btnSubmitMyGuide" style="flex:1;">Enviar a revisión</button>
    </div>`)

  document.getElementById('myGuideTabs').querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('myGuideTabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
      modalContent.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`mtab-${btn.dataset.mtab}`).classList.add('active')
    })
  })

  renderCourseBlockEditor(document.getElementById('myBlockEditorList'), courseBlocks)
  renderReferenceBlockEditor(document.getElementById('myRefBlockEditorList'), refBlocks)

  document.getElementById('btnAddMyCourseBlock').addEventListener('click', () => {
    courseBlocks.push({ type: 'concept', emoji: '💡', title: '', body: '', image_url: '', highlight: '' })
    renderCourseBlockEditor(document.getElementById('myBlockEditorList'), courseBlocks)
  })
  document.getElementById('btnAddMyRefBlock').addEventListener('click', () => {
    refBlocks.push({ type: 'paragraph', text: '' })
    renderReferenceBlockEditor(document.getElementById('myRefBlockEditorList'), refBlocks)
  })

  async function buildPayload(reviewStatus) {
    const title = document.getElementById('mgTitle').value.trim()
    return {
      title,
      slug: guide?.slug || `${slugify(title)}-${Math.random().toString(36).slice(2, 6)}`,
      category_id: document.getElementById('mgCategory').value,
      cover_emoji: document.getElementById('mgCoverEmoji').value.trim(),
      description: document.getElementById('mgDescription').value.trim(),
      level: document.getElementById('mgLevel').value,
      blocks: courseBlocks,
      reference_blocks: refBlocks,
      has_reference_blocks: refBlocks.length > 0,
      author_id: currentSession.user.id,
      review_status: reviewStatus,
      submitted_at: reviewStatus === 'pending' ? new Date().toISOString() : guide?.submitted_at || null,
      estimated_mins: guide?.estimated_mins || 5,
      xp_reward: guide?.xp_reward || 20,
      guide_rarity: guide?.guide_rarity || 'bronze',
      is_pro: false,
      tags: guide?.tags || [],
    }
  }

  async function save(reviewStatus) {
    const title = document.getElementById('mgTitle').value.trim()
    if (!title) {
      alert('Ponle un título a tu guía antes de guardar.')
      return
    }
    if (reviewStatus === 'pending' && courseBlocks.length === 0) {
      alert('Añade al menos un bloque al curso antes de enviarlo a revisión.')
      return
    }

    const payload = await buildPayload(reviewStatus)
    if (guide?.id) payload.id = guide.id

    const { error } = await supabase.from('guides').upsert(payload)
    if (error) {
      alert('No se pudo guardar la guía: ' + error.message)
      return
    }
    closeModal()
    loadMyGuides(currentSession)
  }

  document.getElementById('btnSaveMyGuideDraft').addEventListener('click', () => save('draft'))
  document.getElementById('btnSubmitMyGuide').addEventListener('click', () => save('pending'))
}

document.getElementById('btnNewMyGuide')?.addEventListener('click', () => openMyGuideModal(null))

// ── Editar biografía ──
document.getElementById('btnEditProfile')?.addEventListener('click', () => {
  const BANNER_COLORS = ['var(--ice)', 'var(--navy)', 'var(--indigo)', 'var(--success)', 'var(--warning)', 'var(--pink)']
  const unlocked = currentProfile?.achievements || []
  const unlockedAchievements = achievementsCache.filter((a) => unlocked.includes(a.id))

  openModal(`
    <h3>Editar biografía</h3>
    <div class="form-group"><label>Sobre ti</label><textarea id="peBio" placeholder="Cuéntanos algo sobre ti...">${escapeHtml(currentProfile?.bio || '')}</textarea></div>
    <div class="form-group">
      <label>Color de tu cabecera (si no subes una imagen de banner)</label>
      <div class="color-swatch-row" id="peBannerSwatches">
        ${BANNER_COLORS.map((c) => `<span class="color-swatch ${c === (currentProfile?.banner_color || 'var(--ice)') ? 'selected' : ''}" data-color="${c}" style="background:${c}"></span>`).join('')}
      </div>
    </div>
    <div class="form-group">
      <label>Logro destacado en tu perfil</label>
      <select id="peShowcase">
        <option value="">Ninguno</option>
        ${unlockedAchievements.map((a) => `<option value="${a.id}" ${a.id === currentProfile?.showcase_achievement ? 'selected' : ''}>${escapeHtml(a.title)}</option>`).join('')}
      </select>
    </div>
    <button class="btn-primary btn-block" id="btnSaveProfileEdit">Guardar</button>`)

  let selectedBanner = currentProfile?.banner_color || 'var(--ice)'
  modalContent.querySelectorAll('.color-swatch').forEach((sw) =>
    sw.addEventListener('click', () => {
      modalContent.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'))
      sw.classList.add('selected')
      selectedBanner = sw.dataset.color
    })
  )

  document.getElementById('btnSaveProfileEdit').addEventListener('click', async () => {
    const payload = {
      bio: document.getElementById('peBio').value.trim(),
      banner_color: selectedBanner,
      showcase_achievement: document.getElementById('peShowcase').value || null,
    }
    await supabase.from('user_profiles').update(payload).eq('id', currentSession.user.id)
    closeModal()
    currentProfile = { ...currentProfile, ...payload }
    loadProfile(currentSession)
  })
})

async function loadWall(session) {
  await renderWall({
    listEl: document.getElementById('commentsList'),
    formEl: document.getElementById('commentForm'),
    profileId: session.user.id,
    currentSession: session,
  })
}

async function init() {
  const session = await requireAuth()
  if (!session) return
  currentSession = session

  const profile = await loadProfile(session)
  await Promise.all([loadStats(session, profile), loadCompletedCourses(session), loadMyGuides(session), loadWall(session)])
  await loadAchievements(profile)

  document.getElementById('btnLogout').addEventListener('click', signOut)
}

init()
