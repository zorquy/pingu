import { supabase } from './supabase.js'
import { escapeHtml, getSession, tintClassForKey, borderTintClassForKey } from './app.js'

function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn')
  tabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      tabs.forEach((b) => b.classList.remove('active'))
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active')
    })
  })
}

async function loadCategories(session) {
  const list = document.getElementById('categoriesList')
  const { data: categories, error } = await supabase.from('categories').select('*').order('order_pos')

  if (error || !categories || categories.length === 0) {
    list.innerHTML = `<p class="empty-state">No hay categorías disponibles todavía.</p>`
    return
  }

  let completedByCategory = {}
  if (session) {
    const { data: progress } = await supabase
      .from('user_progress')
      .select('guide_id, status, guides(category_id)')
      .eq('user_id', session.user.id)
      .eq('status', 'completed')

    completedByCategory = (progress || []).reduce((acc, p) => {
      const catId = p.guides?.category_id
      if (catId) acc[catId] = (acc[catId] || 0) + 1
      return acc
    }, {})
  }

  list.innerHTML = categories
    .map((cat) => {
      const total = cat.guide_count ?? 0
      const done = completedByCategory[cat.id] || 0
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      return `
      <div class="category-row ${borderTintClassForKey(cat.id)}">
        <div class="category-icon ${tintClassForKey(cat.id)}" style="font-size: 26px;">${cat.emoji || '📘'}</div>
        <div class="row-info">
          <h2>${escapeHtml(cat.name)}</h2>
          <p>${escapeHtml(cat.description || '')}</p>
          <div class="progress-track"><div class="fill" style="width: ${pct}%"></div></div>
          <div class="progress-label">${done} de ${total} cursos completados</div>
          <a href="categoria.html?slug=${encodeURIComponent(cat.slug)}" class="btn-guide">Ver guías →</a>
        </div>
      </div>`
    })
    .join('')
}

async function loadPaths(session) {
  const list = document.getElementById('pathsList')
  const { data: paths, error } = await supabase
    .from('learning_paths')
    .select('*, guide_routes(count)')
    .order('is_featured', { ascending: false })
    .order('title')

  if (error || !paths || paths.length === 0) {
    list.innerHTML = `<p class="empty-state">No hay rutas disponibles todavía.</p>`
    return
  }

  let completedGuideIds = new Set()
  if (session) {
    const { data: progress } = await supabase
      .from('user_progress')
      .select('guide_id')
      .eq('user_id', session.user.id)
      .eq('status', 'completed')
    completedGuideIds = new Set((progress || []).map((p) => p.guide_id))
  }

  const rows = await Promise.all(
    paths.map(async (path) => {
      const total = path.guide_routes?.[0]?.count ?? 0
      let done = 0
      let started = false

      if (session && total > 0) {
        const { data: routeGuides } = await supabase.from('guide_routes').select('guide_id').eq('route_id', path.id)
        const ids = (routeGuides || []).map((rg) => rg.guide_id)
        done = ids.filter((id) => completedGuideIds.has(id)).length
        started = done > 0
      }

      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      const label = started ? (done === total ? 'Repasar' : 'Continuar') : 'Empezar'

      return `
      <div class="path-card ${escapeHtml(path.slug)}">
        <span class="emoji">${path.emoji || '🧭'}</span>
        <h3>${escapeHtml(path.title)}</h3>
        <p>${escapeHtml(path.description || '')}</p>
        <span class="path-meta">${total} guías${session ? ` · ${done}/${total} completadas` : ''}</span>
        ${session ? `<div class="progress-track"><div class="fill" style="width: ${pct}%"></div></div>` : ''}
        <a href="categoria.html?path=${encodeURIComponent(path.slug)}" class="btn-primary">${label}</a>
      </div>`
    })
  )

  list.innerHTML = rows.join('')
}

async function init() {
  initTabs()
  const session = await getSession()
  await Promise.all([loadCategories(session), loadPaths(session)])
}

init()
