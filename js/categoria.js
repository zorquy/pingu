import { supabase } from './supabase.js'
import { escapeHtml, getSession } from './app.js'
import { rarityColor } from './gamification.js'

const params = new URLSearchParams(window.location.search)
const slug = params.get('slug')
const pathSlug = params.get('path')

function renderGuideCard(guide, statusInfo) {
  const courseLabel = statusInfo.status === 'completed' ? 'Repasar' : '🎓 Curso'
  const guideBtn = guide.has_reference_blocks
    ? `<a href="guia.html?slug=${encodeURIComponent(guide.slug)}" class="btn-guide">📄 Guía</a>`
    : `<span class="btn-guide" style="opacity:.4; cursor:not-allowed;">📄 Guía</span>`

  return `
  <div class="guide-card">
    <div class="guide-card-icon">${guide.cover_emoji || '📘'}</div>
    <div class="guide-card-info">
      <span class="guide-label">${escapeHtml(guide.categoryName || '')}</span>
      <h3>${escapeHtml(guide.title)}</h3>
      <p>${escapeHtml(guide.description || '')}</p>
      <div class="guide-meta">
        <span class="badge ${guide.is_pro ? 'badge-pro' : 'badge-free'}">${guide.is_pro ? 'Pro' : 'Gratis'}</span>
        <span class="time-tag">${guide.estimated_mins || 5} min</span>
        <span class="time-tag" style="color:${rarityColor(guide.guide_rarity)}">● ${escapeHtml(guide.guide_rarity || 'bronze')}</span>
        ${statusInfo.status === 'started' ? '<span class="badge badge-progress">EN PROGRESO</span>' : ''}
        ${statusInfo.status === 'completed' ? '<span class="badge badge-completed">✓ COMPLETADO</span>' : ''}
      </div>
    </div>
    <div class="guide-actions">
      <a href="curso.html?slug=${encodeURIComponent(guide.slug)}" class="btn-course">${courseLabel}</a>
      ${guideBtn}
    </div>
  </div>`
}

async function buildProgressByGuide(session, guideIds) {
  if (!session || guideIds.length === 0) return {}
  const { data: progress } = await supabase
    .from('user_progress')
    .select('guide_id, status')
    .eq('user_id', session.user.id)
    .in('guide_id', guideIds)
  return (progress || []).reduce((acc, p) => {
    acc[p.guide_id] = p.status
    return acc
  }, {})
}

async function initCategoryMode() {
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

  const [{ data: guides }, { data: collections }] = await Promise.all([
    supabase
      .from('guides')
      .select('*')
      .eq('category_id', category.id)
      .not('published_at', 'is', null)
      .order('collection_order', { ascending: true }),
    supabase.from('guide_collections').select('*').eq('category_id', category.id),
  ])

  const guideList = guides || []
  if (guideList.length === 0) {
    document.getElementById('guidesList').innerHTML = `<p class="empty-state">Todavía no hay guías en esta categoría.</p>`
    return
  }

  const session = await getSession()
  const progressByGuide = await buildProgressByGuide(session, guideList.map((g) => g.id))

  const completedCount = guideList.filter((g) => progressByGuide[g.id] === 'completed').length
  if (session) {
    const track = document.getElementById('categoryProgressTrack')
    track.style.display = 'block'
    document.getElementById('categoryProgressFill').style.width = `${Math.round(
      (completedCount / guideList.length) * 100
    )}%`
  }

  const collectionList = collections || []
  const byCollection = {}
  const uncategorized = []
  for (const g of guideList) {
    if (g.collection_id) {
      byCollection[g.collection_id] = byCollection[g.collection_id] || []
      byCollection[g.collection_id].push(g)
    } else {
      uncategorized.push(g)
    }
  }

  const renderGuide = (g) => renderGuideCard({ ...g, categoryName: category.name }, { status: progressByGuide[g.id] || 'none' })

  let html = ''
  for (const col of collectionList) {
    const items = byCollection[col.id] || []
    if (items.length === 0) continue
    html += `<h2 class="section-title" style="font-size:18px; margin-top:24px;">${col.emoji || ''} ${escapeHtml(col.title)}</h2>`
    html += items.map(renderGuide).join('')
  }
  html += uncategorized.map(renderGuide).join('')

  document.getElementById('guidesList').innerHTML = html
}

async function initPathMode() {
  const { data: path, error } = await supabase.from('learning_paths').select('*').eq('slug', pathSlug).single()

  if (error || !path) {
    document.getElementById('guidesList').innerHTML = `<p class="empty-state">Ruta no encontrada.</p>`
    return
  }

  document.title = `${path.title} — PokeDoc`
  document.getElementById('breadcrumbCurrent').textContent = path.title
  document.getElementById('categoryHeader').innerHTML = `
    <div class="emoji-big">${path.emoji || '🧭'}</div>
    <div>
      <h1>${escapeHtml(path.title)}</h1>
      <p>${escapeHtml(path.description || '')}</p>
    </div>`

  const { data: routeGuides } = await supabase
    .from('guide_routes')
    .select('position, guides(*, categories(name))')
    .eq('route_id', path.id)
    .order('position', { ascending: true })

  const guideList = (routeGuides || []).filter((rg) => rg.guides).map((rg) => ({ ...rg.guides, categoryName: rg.guides.categories?.name }))

  if (guideList.length === 0) {
    document.getElementById('guidesList').innerHTML = `<p class="empty-state">Esta ruta todavía no tiene guías.</p>`
    return
  }

  const session = await getSession()
  const progressByGuide = await buildProgressByGuide(session, guideList.map((g) => g.id))

  const completedCount = guideList.filter((g) => progressByGuide[g.id] === 'completed').length
  if (session) {
    const track = document.getElementById('categoryProgressTrack')
    track.style.display = 'block'
    document.getElementById('categoryProgressFill').style.width = `${Math.round(
      (completedCount / guideList.length) * 100
    )}%`
  }

  document.getElementById('guidesList').innerHTML = guideList
    .map((g) => renderGuideCard(g, { status: progressByGuide[g.id] || 'none' }))
    .join('')
}

async function init() {
  if (pathSlug) {
    await initPathMode()
  } else if (slug) {
    await initCategoryMode()
  } else {
    document.getElementById('guidesList').innerHTML = `<p class="empty-state">Categoría no encontrada.</p>`
  }
}

init()
