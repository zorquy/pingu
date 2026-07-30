import { supabase } from './supabase.js'
import { escapeHtml, getSession, tintClassForKey, borderTintClassForKey, borderRarityClass, cardMediaHtml } from './app.js'
import { getAllAchievements } from './gamification.js'
import { openGuideModal, setupGuideModalClose } from './guide-modal.js'

function startOfWeekIso() {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  monday.setHours(0, 0, 0, 0)
  return monday.toISOString()
}

async function loadContinue(session) {
  const section = document.getElementById('continueSection')
  if (!session) return

  const { data } = await supabase
    .from('user_progress')
    .select('*, guides(title, slug, blocks)')
    .eq('user_id', session.user.id)
    .eq('status', 'started')
    .order('started_at', { ascending: false })
    .limit(1)

  const item = data?.[0]
  if (!item || !item.guides) return

  const totalBlocks = Array.isArray(item.guides.blocks) ? item.guides.blocks.length : 1
  const pct = Math.min(100, Math.round(((item.current_block || 0) / Math.max(totalBlocks - 1, 1)) * 100))

  document.getElementById('continueTitle').textContent = item.guides.title
  document.getElementById('continueFill').style.width = `${pct}%`
  document.getElementById('continueBtn').href = `curso.html?slug=${encodeURIComponent(item.guides.slug)}`
  section.style.display = 'block'
}

async function loadCategories() {
  const grid = document.getElementById('categoriesGrid')
  const { data, error } = await supabase.from('categories').select('*').order('order_pos')

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p class="empty-state">No hay categorías disponibles todavía.</p>`
    return
  }

  grid.innerHTML = data
    .map((cat) => {
      const icon = cat.cover_image
        ? cardMediaHtml(cat.cover_image, cat.emoji)
        : `<div class="category-icon ${tintClassForKey(cat.id)}" style="font-size: 22px;">${cat.emoji || '📘'}</div>`
      return `
    <a href="categoria.html?slug=${encodeURIComponent(cat.slug)}" class="category-card ${borderTintClassForKey(cat.id)}">
      ${icon}
      <h3>${escapeHtml(cat.name)}</h3>
      <p>${escapeHtml(cat.description || '')}</p>
      <span class="pill">${cat.guide_count ?? 0} guías</span>
    </a>`
    })
    .join('')

  const heroCategories = document.getElementById('heroStatCategories')
  if (heroCategories) heroCategories.textContent = data.length
}

async function loadHeroGuideCount() {
  const el = document.getElementById('heroStatGuides')
  if (!el) return
  const { count } = await supabase
    .from('guides')
    .select('*', { count: 'exact', head: true })
    .not('published_at', 'is', null)
  el.textContent = count || 0
}

async function loadRecent() {
  const grid = document.getElementById('recentGrid')
  const { data, error } = await supabase
    .from('guides')
    .select('*, categories(name)')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(3)

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p class="empty-state">Todavía no hay guías publicadas.</p>`
    return
  }

  grid.innerHTML = data
    .map(
      (g) => `
    <div class="recent-card ${borderRarityClass(g.guide_rarity)}" data-guide-id="${g.id}">
      ${g.cover_image ? cardMediaHtml(g.cover_image, g.cover_emoji) : `<span class="emoji">${g.cover_emoji || '📘'}</span>`}
      <h3>${escapeHtml(g.title)}</h3>
      <p>${escapeHtml(g.description || '')}</p>
      <div class="meta">
        <span class="badge ${g.is_pro ? 'badge-pro' : 'badge-free'}">${g.is_pro ? 'Pro' : 'Gratis'}</span>
        <span class="time-tag">${g.estimated_mins || 5} min</span>
        <span class="rarity-chip rarity-${g.guide_rarity || 'bronze'}">${g.guide_rarity || 'bronze'}</span>
      </div>
    </div>`
    )
    .join('')

  grid.querySelectorAll('.recent-card').forEach((card) => {
    card.addEventListener('click', () => openGuideModal(card.dataset.guideId))
  })
}

async function loadStats(session) {
  if (!session) return
  const section = document.getElementById('statsSection')

  const { data: weekProgress } = await supabase
    .from('user_progress')
    .select('xp_earned')
    .eq('user_id', session.user.id)
    .eq('status', 'completed')
    .gte('completed_at', startOfWeekIso())

  const weekXP = (weekProgress || []).reduce((sum, p) => sum + (p.xp_earned || 0), 0)

  const { count: completedCount } = await supabase
    .from('user_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('status', 'completed')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('achievements')
    .eq('id', session.user.id)
    .single()

  const unlocked = profile?.achievements || []
  const allAchievements = await getAllAchievements()
  const next = allAchievements.find((a) => !unlocked.includes(a.id))

  document.getElementById('statWeekXP').textContent = weekXP
  document.getElementById('statCompleted').textContent = completedCount || 0
  document.getElementById('statNextAchievement').textContent = next ? next.title : '¡Todos!'
  section.style.display = 'block'
}

function setupModals() {
  setupGuideModalClose()
  document.getElementById('btnWhatIsPokeDoc')?.addEventListener('click', () => {
    document.getElementById('whatIsModal').classList.remove('hidden')
  })
  document.getElementById('whatIsModalClose')?.addEventListener('click', () => {
    document.getElementById('whatIsModal').classList.add('hidden')
  })
  document.getElementById('whatIsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'whatIsModal') e.target.classList.add('hidden')
  })
}

async function init() {
  setupModals()
  const session = await getSession()

  if (!session) {
    document.getElementById('signupBanner').style.display = 'block'
  }

  await Promise.all([loadContinue(session), loadCategories(), loadRecent(), loadStats(session), loadHeroGuideCount()])
}

init()
