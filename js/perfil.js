import { supabase } from './supabase.js'
import { escapeHtml, getInitial, requireAuth, signOut, uploadProfileImage, slugify, uniqueUsername, profileUrl, achievementIconHtml } from './app.js'
import { getAllAchievements, levelProgress, contributorTier } from './gamification.js'
import { NOTIFICATION_TYPES } from './notifications.js'
import { renderWall } from './wall.js'
import { showToast } from './toast.js'

let currentSession = null
let currentProfile = null
let achievementsCache = []

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
  const [{ count: completedCount }, { data: reviews }, { count: approvedGuidesCount }] = await Promise.all([
    supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('status', 'completed'),
    supabase.from('profile_reviews').select('rating').eq('profile_id', session.user.id),
    supabase
      .from('guides')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', session.user.id)
      .eq('review_status', 'approved'),
  ])

  const unlockedCount = (profile?.achievements || []).length
  const avgRating = reviews && reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null
  const tier = contributorTier(approvedGuidesCount || 0)

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
    </div>
    <div class="stat-card">
      <div class="value">${tier.emoji}</div>
      <div class="label">${tier.title}</div>
    </div>
    <div class="stat-card">
      <div class="value">🔥 ${profile?.current_streak || 0}</div>
      <div class="label">Racha (días)</div>
    </div>`
}

function achievementTileHtml(a, unlocked) {
  const isUnlocked = unlocked.includes(a.id)
  return `
      <div class="achievement-tile ${isUnlocked ? '' : 'locked'}">
        <span class="icon rarity-${a.rarity || 'bronze'}">${isUnlocked ? achievementIconHtml(a, 22) : '🔒'}</span>
        <span class="name">${escapeHtml(a.title)}</span>
      </div>`
}

async function loadAchievements(profile) {
  const unlocked = profile?.achievements || []
  const grid = document.getElementById('achievementsGrid')
  achievementsCache = await getAllAchievements()
  document.getElementById('achievementsCount').textContent = `${unlocked.length}/${achievementsCache.length}`
  document.getElementById('heroTrophyCount').textContent = unlocked.length
  grid.innerHTML = achievementsCache.map((a) => achievementTileHtml(a, unlocked)).join('')
}

document.getElementById('btnShowTrophies')?.addEventListener('click', () => {
  const unlocked = currentProfile?.achievements || []
  openModal(`
    <h3>Trofeos (${unlocked.length}/${achievementsCache.length})</h3>
    <div class="achievements-grid">${achievementsCache.map((a) => achievementTileHtml(a, unlocked)).join('')}</div>`)
})

document.getElementById('achievementsToggle')?.addEventListener('click', () => {
  document.getElementById('achievementsAccordion').classList.toggle('open')
})

// ── Pestañas del perfil ──
document.getElementById('profileTabs')?.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('profileTabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel[id^="ptab-"]').forEach((p) => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById(`ptab-${btn.dataset.ptab}`).classList.add('active')
  })
})

// ── Siguiendo / Seguidores ──
function followChipHtml(p) {
  const name = displayName(p, '')
  const avatarStyle = p.avatar_url
    ? `background-image:url('${p.avatar_url.replace(/'/g, '%27')}')`
    : `background-color:${p.avatar_color || 'var(--navy)'}`
  return `<a class="follow-avatar-chip" href="${profileUrl(p)}"><span class="mini-avatar" style="${avatarStyle}">${p.avatar_url ? '' : getInitial(name)}</span>${escapeHtml(name)}</a>`
}

let followingCache = []
let followerCache = []

async function loadFollowSummary(session) {
  const [{ data: following }, { data: followers }] = await Promise.all([
    supabase.from('user_follows').select('following_id').eq('follower_id', session.user.id),
    supabase.from('user_follows').select('follower_id').eq('following_id', session.user.id),
  ])

  document.getElementById('followingCount').textContent = following?.length || 0
  document.getElementById('followersCount').textContent = followers?.length || 0

  const followingIds = (following || []).map((f) => f.following_id)
  const followerIds = (followers || []).map((f) => f.follower_id)
  const allIds = [...new Set([...followingIds, ...followerIds])]

  let profilesById = {}
  if (allIds.length > 0) {
    const { data: profiles } = await supabase.from('user_profiles').select('id, display_name, username, avatar_url, avatar_color').in('id', allIds)
    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
  }

  followingCache = followingIds.map((id) => profilesById[id] || { id })
  followerCache = followerIds.map((id) => profilesById[id] || { id })
}

function openFollowListModal(title, list, emptyMessage) {
  openModal(`
    <h3>${title}</h3>
    <div class="follow-avatar-row">${list.length ? list.map(followChipHtml).join('') : `<p class="empty-state">${emptyMessage}</p>`}</div>`)
}

document.getElementById('btnShowFollowing')?.addEventListener('click', () =>
  openFollowListModal('Siguiendo', followingCache, 'Todavía no sigues a nadie.')
)
document.getElementById('btnShowFollowers')?.addEventListener('click', () =>
  openFollowListModal('Seguidores', followerCache, 'Todavía no tienes seguidores.')
)

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
    showToast('No se pudo subir la imagen: ' + err.message)
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
    showToast('No se pudo subir la imagen: ' + err.message)
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
        <span>${escapeHtml(g.cover_emoji || '📘')} ${escapeHtml(g.title || 'Sin título')}</span>
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
    btn.addEventListener('click', () => (window.location.href = `editor-guia.html?id=${btn.dataset.edit}`))
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
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal?.classList.contains('hidden')) closeModal()
})

document.getElementById('btnNewMyGuide')?.addEventListener('click', () => (window.location.href = 'editor-guia.html'))

// ── Editar biografía ──
document.getElementById('btnEditProfile')?.addEventListener('click', () => {
  const BANNER_COLORS = ['var(--ice)', 'var(--navy)', 'var(--indigo)', 'var(--success)', 'var(--warning)', 'var(--pink)']
  const unlocked = currentProfile?.achievements || []
  const unlockedAchievements = achievementsCache.filter((a) => unlocked.includes(a.id))

  openModal(`
    <h3>Editar perfil</h3>
    <div class="form-group">
      <label>Nombre de usuario (para tu enlace público)</label>
      <input id="peUsername" value="${escapeHtml(currentProfile?.username || '')}" placeholder="tu-nombre-de-usuario" />
      <p class="subtext" id="peUsernamePreview" style="margin:0;"></p>
      <p class="subtext" id="peUsernameError" style="margin:0; color:#dc2626; display:none;">Ese nombre de usuario ya está en uso, prueba con otro.</p>
    </div>
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
    <div class="form-group">
      <label>Notificaciones que quieres recibir</label>
      ${Object.entries(NOTIFICATION_TYPES)
        .map(([type, label]) => {
          const disabled = (currentProfile?.notification_prefs_disabled || []).includes(type)
          return `<label class="checkbox-row"><input type="checkbox" data-notif-pref="${type}" ${disabled ? '' : 'checked'} /> ${escapeHtml(label)}</label>`
        })
        .join('')}
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

  const usernameInput = document.getElementById('peUsername')
  const usernamePreview = document.getElementById('peUsernamePreview')
  function updateUsernamePreview() {
    usernamePreview.textContent = `pokedocpingu.netlify.app/usuario/${slugify(usernameInput.value) || '…'}`
  }
  updateUsernamePreview()
  usernameInput.addEventListener('input', updateUsernamePreview)

  document.getElementById('btnSaveProfileEdit').addEventListener('click', async () => {
    const usernameError = document.getElementById('peUsernameError')
    usernameError.style.display = 'none'

    const desiredUsername = slugify(usernameInput.value) || currentProfile?.username
    if (desiredUsername !== currentProfile?.username) {
      const { data: taken } = await supabase.from('user_profiles').select('id').ilike('username', desiredUsername).neq('id', currentSession.user.id).maybeSingle()
      if (taken) {
        usernameError.style.display = 'block'
        return
      }
    }

    const notificationPrefsDisabled = Array.from(modalContent.querySelectorAll('[data-notif-pref]'))
      .filter((cb) => !cb.checked)
      .map((cb) => cb.dataset.notifPref)

    const payload = {
      username: desiredUsername,
      bio: document.getElementById('peBio').value.trim(),
      banner_color: selectedBanner,
      showcase_achievement: document.getElementById('peShowcase').value || null,
      notification_prefs_disabled: notificationPrefsDisabled,
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
  await Promise.all([loadStats(session, profile), loadCompletedCourses(session), loadMyGuides(session), loadWall(session), loadFollowSummary(session)])
  await loadAchievements(profile)

  document.getElementById('btnLogout').addEventListener('click', signOut)
}

init()
