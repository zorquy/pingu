import { supabase } from './supabase.js'
import { escapeHtml, getSession, tintClassForKey, borderTintClassForKey, categoryIconHtml } from './app.js'

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
        <div class="category-icon ${tintClassForKey(cat.id)}">${categoryIconHtml(cat, 26)}</div>
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

async function init() {
  const session = await getSession()
  await loadCategories(session)
}

init()
