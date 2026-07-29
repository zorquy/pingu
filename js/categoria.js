import { supabase } from './supabase.js'
import { escapeHtml, getSession } from './app.js'

const params = new URLSearchParams(window.location.search)
const slug = params.get('slug')

function renderGuideCard(guide, statusInfo) {
  const courseLabel = statusInfo.status === 'completed' ? 'Repasar' : '🎓 Curso'
  return `
  <div class="guide-card">
    <div class="guide-card-icon">${guide.emoji || '📘'}</div>
    <div class="guide-card-info">
      <span class="guide-label">${escapeHtml(guide.categoryName || '')}</span>
      <h3>${escapeHtml(guide.title)}</h3>
      <p>${escapeHtml(guide.description || '')}</p>
      <div class="guide-meta">
        <span class="badge ${guide.badge === 'Pro' ? 'badge-pro' : 'badge-free'}">${guide.badge || 'Gratis'}</span>
        <span class="time-tag">${guide.estimated_mins || 5} min</span>
        ${statusInfo.status === 'started' ? '<span class="badge badge-progress">EN PROGRESO</span>' : ''}
        ${statusInfo.status === 'completed' ? '<span class="badge badge-completed">✓ COMPLETADO</span>' : ''}
      </div>
    </div>
    <div class="guide-actions">
      <a href="curso.html?slug=${encodeURIComponent(guide.slug)}" class="btn-course">${courseLabel}</a>
      <a href="guia.html?slug=${encodeURIComponent(guide.slug)}" class="btn-guide">📄 Guía</a>
    </div>
  </div>`
}

async function init() {
  if (!slug) {
    document.getElementById('guidesList').innerHTML = `<p class="empty-state">Categoría no encontrada.</p>`
    return
  }

  const { data: category, error } = await supabase.from('categories').select('*').eq('slug', slug).single()

  if (error || !category) {
    document.getElementById('guidesList').innerHTML = `<p class="empty-state">Categoría no encontrada.</p>`
    return
  }

  document.title = `${category.name} — PokeDoc`
  document.getElementById('breadcrumbCurrent').textContent = category.name
  document.getElementById('categoryHeader').innerHTML = `
    <div class="emoji-big">${category.emoji || '📘'}</div>
    <div>
      <h1>${escapeHtml(category.name)}</h1>
      <p>${escapeHtml(category.description || '')}</p>
    </div>`

  const { data: guides } = await supabase
    .from('guides')
    .select('*')
    .eq('category_id', category.id)
    .not('published_at', 'is', null)
    .order('order_pos', { ascending: true })

  const guideList = guides || []

  const session = await getSession()
  let progressByGuide = {}
  if (session && guideList.length > 0) {
    const { data: progress } = await supabase
      .from('user_progress')
      .select('guide_id, status')
      .eq('user_id', session.user.id)
      .in('guide_id', guideList.map((g) => g.id))
    progressByGuide = (progress || []).reduce((acc, p) => {
      acc[p.guide_id] = p.status
      return acc
    }, {})
  }

  if (guideList.length === 0) {
    document.getElementById('guidesList').innerHTML = `<p class="empty-state">Todavía no hay guías en esta categoría.</p>`
    return
  }

  const completedCount = guideList.filter((g) => progressByGuide[g.id] === 'completed').length
  if (session) {
    const track = document.getElementById('categoryProgressTrack')
    track.style.display = 'block'
    document.getElementById('categoryProgressFill').style.width = `${Math.round(
      (completedCount / guideList.length) * 100
    )}%`
  }

  document.getElementById('guidesList').innerHTML = guideList
    .map((g) =>
      renderGuideCard({ ...g, categoryName: category.name }, { status: progressByGuide[g.id] || 'none' })
    )
    .join('')
}

init()
