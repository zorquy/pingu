import { supabase } from './supabase.js'
import { escapeHtml, getInitial, getSession, getProfile, profileUrl, profileParamsFromLocation, achievementIconHtml } from './app.js'
import { levelProgress, contributorTier, getAllAchievements } from './gamification.js'
import { renderWall } from './wall.js'
import { showToast } from './toast.js'
import { reportButtonHtml, wireReportButtons } from './report.js'
import { createNotification } from './notifications.js'
import { icons } from './icons.js'

const { username: usernameParam, id: idParam } = profileParamsFromLocation()
let profileId = idParam

let currentSession = null
let isViewerAdmin = false
let profile = null
let achievementsCache = []
let followingCache = []
let followerCache = []

async function resolveProfileId() {
  if (profileId) return true
  if (!usernameParam) return false
  const { data } = await supabase.from('user_profiles').select('id').ilike('username', usernameParam).maybeSingle()
  profileId = data?.id || null
  return !!profileId
}

function starsHtml(rating, size = 16) {
  return Array.from({ length: 5 })
    .map((_, i) => `<span style="font-size:${size}px; color:${i < Math.round(rating) ? 'var(--warning)' : 'var(--border)'};">★</span>`)
    .join('')
}

// ── Modal genérico (popups de Siguiendo/Seguidores/Trofeos) ──
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

async function loadHeader() {
  const { data } = await supabase.from('user_profiles').select('*').eq('id', profileId).single()
  profile = data
  if (!profile) return false

  const name = profile.display_name || profile.username || 'Usuario'
  const xp = profile.total_xp || 0
  const progress = levelProgress(xp)

  document.title = `${name} — PokeDoc`

  const banner = document.getElementById('heroBanner')
  banner.style.background = profile.banner_url
    ? `url('${profile.banner_url.replace(/'/g, '%27')}') center/cover`
    : profile.banner_color || 'var(--ice)'

  const avatar = document.getElementById('heroAvatar')
  if (profile.avatar_url) {
    avatar.style.backgroundImage = `url('${profile.avatar_url.replace(/'/g, '%27')}')`
    avatar.textContent = ''
  } else {
    avatar.style.backgroundColor = profile.avatar_color || 'var(--navy)'
    avatar.textContent = getInitial(name)
  }

  const achievements = await getAllAchievements()
  const showcase = achievements.find((a) => a.id === profile.showcase_achievement)

  document.getElementById('heroInfo').innerHTML = `
    <h2>${escapeHtml(name)}${profile.is_pro ? ' <span class="badge badge-pro">Pro</span>' : ''}</h2>
    <div class="profile-level">${progress.level} · ${xp} XP</div>
    ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
    ${showcase ? `<div class="achievement-tile" style="display:inline-flex; margin-top:8px; width:auto; flex-direction:row; gap:8px; align-items:center; padding:6px 12px;"><span class="icon rarity-${showcase.rarity || 'bronze'}" style="width:28px;height:28px;">${achievementIconHtml(showcase, 16)}</span><span class="name">${escapeHtml(showcase.title)}</span></div>` : ''}`

  return true
}

async function loadReputationAndGuides() {
  const { count: approvedCount } = await supabase
    .from('guides')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', profileId)
    .eq('review_status', 'approved')

  const { data: reviews } = await supabase.from('profile_reviews').select('rating').eq('profile_id', profileId)
  const avgRating = reviews && reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : null

  const tier = contributorTier(approvedCount || 0)

  document.getElementById('profileStats').innerHTML = `
    <div class="stat-card">
      <div class="value" style="display:flex; justify-content:center;">${tier.icon}</div>
      <div class="label">${tier.title}</div>
    </div>
    <div class="stat-card">
      <div class="value">${approvedCount || 0}</div>
      <div class="label">Guías aprobadas</div>
    </div>
    <div class="stat-card">
      <div class="value">${avgRating ? avgRating.toFixed(1) : '—'}</div>
      <div class="label">Valoración media (${reviews?.length || 0})</div>
    </div>`

  const { data: guides } = await supabase
    .from('guides')
    .select('title, slug, cover_emoji, categories(name)')
    .eq('author_id', profileId)
    .eq('review_status', 'approved')
    .order('published_at', { ascending: false })

  const container = document.getElementById('publishedGuides')
  if (!guides || guides.length === 0) {
    container.innerHTML = `<p class="empty-state">Todavía no tiene guías publicadas.</p>`
    return
  }
  container.innerHTML = guides
    .map(
      (g) => `
    <a href="/guia.html?slug=${encodeURIComponent(g.slug)}" class="completed-course-row" style="text-decoration:none; color:inherit;">
      <span>${escapeHtml(g.cover_emoji || '📘')} ${escapeHtml(g.title)}</span>
      <span class="date">${escapeHtml(g.categories?.name || '')}</span>
    </a>`
    )
    .join('')
}

// ── Pestañas del perfil ──
document.getElementById('profileTabs')?.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('profileTabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel[id^="ptab-"]').forEach((p) => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById(`ptab-${btn.dataset.ptab}`).classList.add('active')
  })
})

// ── Mensaje privado ──
function loadMessageButton() {
  const btn = document.getElementById('btnMessageUser')
  if (!currentSession || currentSession.user.id === profileId) {
    btn.classList.add('hidden')
    return
  }
  btn.classList.remove('hidden')
  btn.href = `/mensajes.html?with=${profileId}`
}

// ── Seguir / Dejar de seguir ──
async function loadFollowButton() {
  const btn = document.getElementById('btnFollowToggle')
  if (!currentSession || currentSession.user.id === profileId) {
    btn.classList.add('hidden')
    return
  }
  btn.classList.remove('hidden')

  const { data } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('follower_id', currentSession.user.id)
    .eq('following_id', profileId)
    .maybeSingle()

  let isFollowing = !!data
  function render() {
    btn.textContent = isFollowing ? 'Dejar de seguir' : '+ Seguir'
    btn.classList.toggle('btn-primary', !isFollowing)
    btn.classList.toggle('btn-outline', isFollowing)
  }
  render()

  btn.onclick = async () => {
    btn.disabled = true
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', currentSession.user.id).eq('following_id', profileId)
    } else {
      await supabase.from('user_follows').insert({ follower_id: currentSession.user.id, following_id: profileId })
      const follower = await getProfile(currentSession.user.id)
      await createNotification({
        recipientId: profileId,
        actorId: currentSession.user.id,
        type: 'new_follower',
        title: 'Nuevo seguidor',
        body: follower?.display_name || follower?.username || 'Alguien',
        link: follower ? profileUrl(follower) : '/usuarios.html',
      })
    }
    isFollowing = !isFollowing
    render()
    btn.disabled = false
    await loadFollowSummary()
  }
}

function followChipHtml(p) {
  const name = p.display_name || p.username || 'Usuario'
  const avatarStyle = p.avatar_url
    ? `background-image:url('${p.avatar_url.replace(/'/g, '%27')}')`
    : `background-color:${p.avatar_color || 'var(--navy)'}`
  return `<a class="follow-avatar-chip" href="${profileUrl(p)}"><span class="mini-avatar" style="${avatarStyle}">${p.avatar_url ? '' : getInitial(name)}</span>${escapeHtml(name)}</a>`
}

function openFollowListModal(title, list, emptyMessage) {
  openModal(`
    <h3>${title}</h3>
    <div class="follow-avatar-row">${list.length ? list.map(followChipHtml).join('') : `<p class="empty-state">${emptyMessage}</p>`}</div>`)
}

document.getElementById('btnShowFollowing')?.addEventListener('click', () =>
  openFollowListModal('Siguiendo', followingCache, 'Todavía no sigue a nadie.')
)
document.getElementById('btnShowFollowers')?.addEventListener('click', () =>
  openFollowListModal('Seguidores', followerCache, 'Todavía no tiene seguidores.')
)

async function loadFollowSummary() {
  const [{ data: following }, { data: followers }] = await Promise.all([
    supabase.from('user_follows').select('following_id').eq('follower_id', profileId),
    supabase.from('user_follows').select('follower_id').eq('following_id', profileId),
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

// ── Trofeos ──
function achievementTileHtml(a, unlocked) {
  const isUnlocked = unlocked.includes(a.id)
  return `
      <div class="achievement-tile ${isUnlocked ? '' : 'locked'}">
        <span class="icon rarity-${a.rarity || 'bronze'}">${isUnlocked ? achievementIconHtml(a, 22) : icons.lock(22)}</span>
        <span class="name">${escapeHtml(a.title)}</span>
      </div>`
}

async function loadAchievementsGrid() {
  const unlocked = profile?.achievements || []
  achievementsCache = await getAllAchievements()
  document.getElementById('heroTrophyCount').textContent = unlocked.length
  document.getElementById('achievementsGrid').innerHTML = achievementsCache.map((a) => achievementTileHtml(a, unlocked)).join('')
}

document.getElementById('btnShowTrophies')?.addEventListener('click', () => {
  const unlocked = profile?.achievements || []
  openModal(`
    <h3>Trofeos (${unlocked.length}/${achievementsCache.length})</h3>
    <div class="achievements-grid">${achievementsCache.map((a) => achievementTileHtml(a, unlocked)).join('')}</div>`)
})

async function namesForIds(ids) {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return {}
  const { data } = await supabase.from('user_profiles').select('id, display_name, username').in('id', uniqueIds)
  return Object.fromEntries((data || []).map((p) => [p.id, p.display_name || p.username || 'Usuario']))
}

// ── Reseñas ──
async function loadReviews() {
  const { data } = await supabase.from('profile_reviews').select('*').eq('profile_id', profileId).order('created_at', { ascending: false })
  const reviews = data || []
  const namesById = await namesForIds(reviews.map((r) => r.reviewer_id))

  const container = document.getElementById('reviewsList')
  container.innerHTML = reviews.length === 0
    ? `<p class="empty-state">Todavía no tiene reseñas.</p>`
    : reviews
        .map(
          (r) => `
    <div class="my-guide-row" style="flex-direction:column; align-items:flex-start;">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <strong>${escapeHtml(namesById[r.reviewer_id] || 'Usuario')}</strong>
        <span>${starsHtml(r.rating)}</span>
      </div>
      ${r.body ? `<p style="margin:6px 0 0; font-size:13.5px; color:var(--text-mid);">${escapeHtml(r.body)}</p>` : ''}
      ${currentSession && currentSession.user.id !== r.reviewer_id ? `<div style="margin-top:6px;">${reportButtonHtml('profile_review', r.id)}</div>` : ''}
    </div>`
        )
        .join('')

  wireReportButtons(container, currentSession)

  const formContainer = document.getElementById('reviewForm')
  if (!currentSession) {
    formContainer.innerHTML = `<p class="subtext"><a href="/auth.html" style="color:var(--navy); font-weight:700;">Inicia sesión</a> para dejar una reseña.</p>`
    return
  }
  if (currentSession.user.id === profileId) {
    formContainer.innerHTML = ''
    return
  }

  const myReview = reviews.find((r) => r.reviewer_id === currentSession.user.id)
  let selectedRating = myReview?.rating || 0

  formContainer.innerHTML = `
    <div class="simple-card">
      <div class="star-picker" id="starPicker">
        ${[1, 2, 3, 4, 5].map((v) => `<span class="star-pick" data-value="${v}">★</span>`).join('')}
      </div>
      <textarea id="reviewBody" placeholder="Escribe una reseña (opcional)">${escapeHtml(myReview?.body || '')}</textarea>
      <button class="btn-primary" id="btnSubmitReview" style="margin-top:8px;">${myReview ? 'Actualizar reseña' : 'Enviar reseña'}</button>
    </div>`

  function renderStars() {
    document.querySelectorAll('.star-pick').forEach((s) => {
      s.classList.toggle('selected', Number(s.dataset.value) <= selectedRating)
    })
  }
  renderStars()

  document.querySelectorAll('.star-pick').forEach((s) =>
    s.addEventListener('click', () => {
      selectedRating = Number(s.dataset.value)
      renderStars()
    })
  )

  document.getElementById('btnSubmitReview').addEventListener('click', async () => {
    if (!selectedRating) {
      showToast('Elige una valoración de 1 a 5 estrellas.')
      return
    }
    const body = document.getElementById('reviewBody').value.trim()
    const isNewReview = !myReview
    await supabase
      .from('profile_reviews')
      .upsert({ profile_id: profileId, reviewer_id: currentSession.user.id, rating: selectedRating, body }, { onConflict: 'profile_id,reviewer_id' })
    if (isNewReview) {
      await createNotification({
        recipientId: profileId,
        actorId: currentSession.user.id,
        type: 'profile_rating',
        title: 'Nueva reseña en tu perfil',
        body: `${'★'.repeat(selectedRating)}${body ? ' — ' + body : ''}`,
        link: '/perfil.html',
      })
    }
    await Promise.all([loadReviews(), loadReputationAndGuides()])
  })
}

// ── Muro ──
function loadComments() {
  return renderWall({
    listEl: document.getElementById('commentsList'),
    formEl: document.getElementById('commentForm'),
    profileId,
    currentSession,
    isAdmin: isViewerAdmin,
  })
}

async function init() {
  const found = await resolveProfileId()
  if (!found) {
    document.querySelector('main').innerHTML = `<p class="empty-state">Usuario no encontrado.</p>`
    return
  }

  currentSession = await getSession()
  isViewerAdmin = currentSession ? !!(await getProfile(currentSession.user.id))?.is_admin : false

  const ok = await loadHeader()
  if (!ok) {
    document.querySelector('main').innerHTML = `<p class="empty-state">Usuario no encontrado.</p>`
    return
  }

  loadMessageButton()
  await Promise.all([loadReputationAndGuides(), loadReviews(), loadComments(), loadFollowButton(), loadFollowSummary(), loadAchievementsGrid()])
}

init()
