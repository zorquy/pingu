import { supabase } from './supabase.js'
import { escapeHtml, getSession, tintClassForKey } from './app.js'
import { openGuideModal, setupGuideModalClose, renderGuideCardHtml, decorateGuideCards } from './guide-modal.js'

const params = new URLSearchParams(window.location.search)
const slug = params.get('slug')

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
    document.getElementById('categoryHeader').innerHTML = ''
    document.getElementById('guidesList').innerHTML = `<p class="empty-state">Categoría no encontrada.</p>`
    return null
  }

  document.title = `${category.name} — PokeDoc`
  document.getElementById('breadcrumbCurrent').textContent = category.name
  document.getElementById('categoryHeader').innerHTML = `
    <div class="emoji-big ${tintClassForKey(category.id)}">${category.emoji || '📘'}</div>
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
    return null
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

  const renderGuide = (g) => renderGuideCardHtml(g, { statusBadge: progressByGuide[g.id] || 'none', categoryLabel: category.name })

  let html = ''
  for (const col of collectionList) {
    const items = byCollection[col.id] || []
    if (items.length === 0) continue
    html += `<h2 class="section-title" style="font-size:18px; margin-top:24px;">${col.emoji || ''} ${escapeHtml(col.title)}</h2>`
    html += items.map(renderGuide).join('')
  }
  html += uncategorized.map(renderGuide).join('')

  document.getElementById('guidesList').innerHTML = html
  return session
}

function wireGuideCardClicks() {
  document.getElementById('guidesList').querySelectorAll('[data-guide-id]').forEach((card) => {
    card.addEventListener('click', () => openGuideModal(card.dataset.guideId))
  })
}

async function init() {
  setupGuideModalClose()
  if (slug) {
    const session = await initCategoryMode()
    wireGuideCardClicks()
    await decorateGuideCards(document.getElementById('guidesList'), session)
  } else {
    document.getElementById('categoryHeader').innerHTML = ''
    document.getElementById('guidesList').innerHTML = `<p class="empty-state">Categoría no encontrada.</p>`
  }
}

init()
