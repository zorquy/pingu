import { supabase } from './supabase.js'
import { escapeHtml, getSession, tintClassForKey, categoryIconHtml, guideHasCourse } from './app.js'
import { renderGuideCardHtml, decorateGuideCards, wireGuideCardClicks } from './guide-card.js'
import { inlineIconHtml } from './content-icon.js'

const params = new URLSearchParams(window.location.search)
const slug = params.get('slug')

async function buildProgressByGuide(session, guideIds) {
  if (!session || guideIds.length === 0) return {}
  const { data: progress } = await supabase
    .from('user_progress')
    .select('guide_id, status, read_at')
    .eq('user_id', session.user.id)
    .in('guide_id', guideIds)
  return (progress || []).reduce((acc, p) => {
    acc[p.guide_id] = { status: p.status, isRead: !!p.read_at }
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
    <div class="emoji-big ${tintClassForKey(category.id)}">${categoryIconHtml(category, 38)}</div>
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

  // La barra mide guías leídas sobre el total, igual que el listado de
  // Aprender: es la acción principal y existe en todas las categorías.
  // Los cursos, cuando los hay, van como línea secundaria — antes esta
  // barra dividía entre los cursos y no se sabía qué estaba midiendo,
  // porque ni siquiera tenía etiqueta.
  const courseList = guideList.filter(guideHasCourse)
  const completedCount = courseList.filter((g) => progressByGuide[g.id]?.status === 'completed').length
  const readCount = guideList.filter((g) => progressByGuide[g.id]?.isRead).length
  if (session) {
    document.getElementById('categoryProgressWrap').style.display = 'block'
    document.getElementById('categoryProgressFill').style.width = `${Math.round(
      (readCount / guideList.length) * 100
    )}%`
    const plural = guideList.length === 1 ? 'guía leída' : 'guías leídas'
    const cursos =
      courseList.length > 0
        ? ` · ${completedCount} de ${courseList.length} ${courseList.length === 1 ? 'curso hecho' : 'cursos hechos'}`
        : ''
    document.getElementById('categoryProgressLabel').textContent =
      `${readCount} de ${guideList.length} ${plural}${cursos}`
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

  const renderGuide = (g) =>
    renderGuideCardHtml(g, {
      statusBadge: progressByGuide[g.id]?.status || 'none',
      isRead: !!progressByGuide[g.id]?.isRead,
      categoryLabel: category.name,
    })

  let html = ''
  for (const col of collectionList) {
    const items = byCollection[col.id] || []
    if (items.length === 0) continue
    html += `<h2 class="section-title" style="font-size:18px; margin-top:24px;">${col.emoji ? inlineIconHtml(col.emoji, 18, 'folder') : ''}${escapeHtml(col.title)}</h2>`
    html += items.map(renderGuide).join('')
  }
  html += uncategorized.map(renderGuide).join('')

  document.getElementById('guidesList').innerHTML = html
  return session
}



async function init() {
  if (slug) {
    const session = await initCategoryMode()
    wireGuideCardClicks(document.getElementById('guidesList'))
    await decorateGuideCards(document.getElementById('guidesList'), session)
  } else {
    document.getElementById('categoryHeader').innerHTML = ''
    document.getElementById('guidesList').innerHTML = `<p class="empty-state">Categoría no encontrada.</p>`
  }
}

init()
