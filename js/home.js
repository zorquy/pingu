import { supabase } from './supabase.js'
import { escapeHtml, getSession, tintClassForKey, borderTintClassForKey, borderRarityClass, cardMediaHtml, categoryIconHtml, guideHasReference } from './app.js'
import { decorateGuideCards, wireGuideCardClicks } from './guide-card.js'
import { icons } from './icons.js'
import { loadActivity, renderActivityHtml } from './activity.js'

async function loadCategories() {
  const grid = document.getElementById('categoriesGrid')
  const { data, error } = await supabase.from('categories').select('*').order('order_pos')

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p class="empty-state">No hay categorías disponibles todavía.</p>`
    return
  }

  grid.innerHTML = data
    .map((cat) => {
      const icon =
        cat.cover_image && !cat.icon_image
          ? cardMediaHtml(cat.cover_image, cat.emoji)
          : `<div class="category-icon ${tintClassForKey(cat.id)}">${categoryIconHtml(cat, 22)}</div>`
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
    <div class="recent-card ${borderRarityClass(g.guide_rarity)}" data-guide-id="${g.id}" data-author-id="${escapeHtml(g.author_id || '')}" data-slug="${escapeHtml(g.slug || '')}" data-has-guide="${guideHasReference(g) ? '1' : ''}" tabindex="0" role="link">
      ${g.cover_image ? cardMediaHtml(g.cover_image, g.cover_emoji) : `<span class="emoji">${escapeHtml(g.cover_emoji || '📘')}</span>`}
      <h3>${escapeHtml(g.title)}</h3>
      <p>${escapeHtml(g.description || '')}</p>
      <div class="meta">
        <span class="badge ${g.is_pro ? 'badge-pro' : 'badge-free'}">${g.is_pro ? 'Pro' : 'Gratis'}</span>
        <span class="time-tag">${g.estimated_mins || 5} min</span>
        <span class="rarity-chip rarity-${g.guide_rarity || 'bronze'}">${g.guide_rarity || 'bronze'}</span>
      </div>
      <div class="guide-card-author" data-card-author></div>
      <div class="guide-card-social">
        <button class="card-save-btn" data-card-save title="Guardar" aria-label="Guardar" onclick="event.stopPropagation()">${icons.bookmark(16)}</button>
        <span class="card-rating" data-card-rating>Sin valorar</span>
      </div>
    </div>`
    )
    .join('')

}

// Solo para quien ha iniciado sesión. Alguien que llega buscando si su
// carta es falsa no quiere ver quién se ha apuntado hoy; un miembro sí
// agradece ver que aquello está vivo.
async function loadHomeActivity(session) {
  if (!session) return
  try {
    const eventos = await loadActivity(4)
    if (eventos.length === 0) return
    document.getElementById('homeActivityFeed').innerHTML = renderActivityHtml(eventos)
    document.getElementById('homeActivity').classList.remove('hidden')
  } catch {
    // Si falla, la home se queda como siempre. No es contenido crítico.
  }
}

function setupModals() {
  document.getElementById('btnWhatIsPokeDoc')?.addEventListener('click', () => {
    document.getElementById('whatIsModal').classList.remove('hidden')
  })
  document.getElementById('whatIsModalClose')?.addEventListener('click', () => {
    document.getElementById('whatIsModal').classList.add('hidden')
  })
  document.getElementById('whatIsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'whatIsModal') e.target.classList.add('hidden')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('whatIsModal')?.classList.add('hidden')
  })
}

async function init() {
  setupModals()
  const session = await getSession()

  if (!session) {
    document.getElementById('signupBanner').style.display = 'block'
  }

  await Promise.all([loadCategories(), loadRecent(), loadHeroGuideCount(), loadHomeActivity(session)])
  wireGuideCardClicks(document.getElementById('recentGrid'))
  await decorateGuideCards(document.getElementById('recentGrid'), session)
}

init()
