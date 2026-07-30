import { supabase } from './supabase.js'
import { escapeHtml, getInitial, getSession } from './app.js'
import { levelProgress, contributorTier, getAllAchievements } from './gamification.js'

const params = new URLSearchParams(window.location.search)
const profileId = params.get('id')

let currentSession = null
let profile = null

function starsHtml(rating, size = 16) {
  return Array.from({ length: 5 })
    .map((_, i) => `<span style="font-size:${size}px; color:${i < Math.round(rating) ? 'var(--warning)' : 'var(--border)'};">★</span>`)
    .join('')
}

async function loadHeader() {
  const { data } = await supabase.from('user_profiles').select('*').eq('id', profileId).single()
  profile = data
  if (!profile) return false

  const name = profile.display_name || profile.username || 'Usuario'
  const xp = profile.total_xp || 0
  const progress = levelProgress(xp)
  const avatarColor = profile.avatar_color || 'var(--navy)'
  const bannerColor = profile.banner_color || 'var(--ice)'

  const achievements = await getAllAchievements()
  const showcase = achievements.find((a) => a.id === profile.showcase_achievement)

  document.title = `${name} — PokeDoc`

  document.getElementById('profileHeader').innerHTML = `
    <div class="profile-banner" style="background:${bannerColor}"></div>
    <div class="profile-avatar" style="background:${avatarColor}">${getInitial(name)}</div>
    <div class="profile-info">
      <h2>${escapeHtml(name)}${profile.is_pro ? ' <span class="badge badge-pro">Pro</span>' : ''}</h2>
      <div class="profile-level">${progress.level} · ${xp} XP</div>
      ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
      ${showcase ? `<div class="achievement-tile" style="display:inline-flex; margin-top:8px; width:auto; flex-direction:row; gap:8px; align-items:center; padding:6px 12px;"><span class="icon rarity-${showcase.rarity || 'bronze'}" style="width:28px;height:28px;font-size:16px;">${showcase.emoji || '🏆'}</span><span class="name">${escapeHtml(showcase.title)}</span></div>` : ''}
    </div>`

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
      <div class="value">${tier.emoji}</div>
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
    <a href="guia.html?slug=${encodeURIComponent(g.slug)}" class="completed-course-row" style="text-decoration:none; color:inherit;">
      <span>${g.cover_emoji || '📘'} ${escapeHtml(g.title)}</span>
      <span class="date">${escapeHtml(g.categories?.name || '')}</span>
    </a>`
    )
    .join('')
}

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
    </div>`
        )
        .join('')

  const formContainer = document.getElementById('reviewForm')
  if (!currentSession) {
    formContainer.innerHTML = `<p class="subtext"><a href="auth.html" style="color:var(--navy); font-weight:700;">Inicia sesión</a> para dejar una reseña.</p>`
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
      alert('Elige una valoración de 1 a 5 estrellas.')
      return
    }
    const body = document.getElementById('reviewBody').value.trim()
    await supabase
      .from('profile_reviews')
      .upsert({ profile_id: profileId, reviewer_id: currentSession.user.id, rating: selectedRating, body }, { onConflict: 'profile_id,reviewer_id' })
    await Promise.all([loadReviews(), loadReputationAndGuides()])
  })
}

// ── Muro ──
async function loadComments() {
  const { data } = await supabase.from('profile_comments').select('*').eq('profile_id', profileId).order('created_at', { ascending: false })
  const comments = data || []
  const namesById = await namesForIds(comments.map((c) => c.author_id))

  const container = document.getElementById('commentsList')
  container.innerHTML = comments.length === 0
    ? `<p class="empty-state">Todavía no hay nada escrito en este muro.</p>`
    : comments
        .map(
          (c) => `
    <div class="my-guide-row" style="flex-direction:column; align-items:flex-start;">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <strong>${escapeHtml(namesById[c.author_id] || 'Usuario')}</strong>
        <span class="date" style="color:var(--text-dim); font-size:12px;">${new Date(c.created_at).toLocaleDateString('es-ES')}</span>
      </div>
      <p style="margin:6px 0 0; font-size:13.5px;">${escapeHtml(c.body)}</p>
      ${currentSession && (currentSession.user.id === c.author_id || currentSession.user.id === profileId) ? `<button class="my-guide-actions" data-delete-comment="${c.id}" style="margin-top:6px; font-size:11px; color:#dc2626; font-weight:700;">Eliminar</button>` : ''}
    </div>`
        )
        .join('')

  container.querySelectorAll('[data-delete-comment]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este comentario?')) return
      await supabase.from('profile_comments').delete().eq('id', btn.dataset.deleteComment)
      loadComments()
    })
  )

  const formContainer = document.getElementById('commentForm')
  if (!currentSession) {
    formContainer.innerHTML = `<p class="subtext"><a href="auth.html" style="color:var(--navy); font-weight:700;">Inicia sesión</a> para escribir en este muro.</p>`
    return
  }

  formContainer.innerHTML = `
    <div class="simple-card">
      <textarea id="commentBody" placeholder="Escribe algo en este muro..."></textarea>
      <button class="btn-primary" id="btnSubmitComment" style="margin-top:8px;">Publicar</button>
    </div>`

  document.getElementById('btnSubmitComment').addEventListener('click', async () => {
    const body = document.getElementById('commentBody').value.trim()
    if (!body) return
    await supabase.from('profile_comments').insert({ profile_id: profileId, author_id: currentSession.user.id, body })
    loadComments()
  })
}

async function init() {
  if (!profileId) {
    document.querySelector('main').innerHTML = `<p class="empty-state">Usuario no encontrado.</p>`
    return
  }

  currentSession = await getSession()

  const ok = await loadHeader()
  if (!ok) {
    document.querySelector('main').innerHTML = `<p class="empty-state">Usuario no encontrado.</p>`
    return
  }

  await Promise.all([loadReputationAndGuides(), loadReviews(), loadComments()])
}

init()
