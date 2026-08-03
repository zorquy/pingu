import { supabase } from './supabase.js'
import { escapeHtml, getSession, tintClassForKey, borderTintClassForKey, categoryIconHtml, guideHasCourse } from './app.js'

async function loadCategories(session) {
  const list = document.getElementById('categoriesList')
  const { data: categories, error } = await supabase.from('categories').select('*').order('order_pos')

  if (error || !categories || categories.length === 0) {
    list.innerHTML = `<p class="empty-state">No hay categorías disponibles todavía.</p>`
    return
  }

  // El denominador no es `guide_count` (todas las guías publicadas de la
  // categoría), sino solo las que de verdad tienen curso.
  const { data: publishedGuides } = await supabase
    .from('guides')
    .select('id, category_id, blocks')
    .not('published_at', 'is', null)

  const coursesByCategory = (publishedGuides || []).reduce((acc, g) => {
    if (guideHasCourse(g)) acc[g.category_id] = (acc[g.category_id] || 0) + 1
    return acc
  }, {})

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
      const total = coursesByCategory[cat.id] || 0
      // Si una guía pierde su curso después de que alguien lo complete, el
      // progreso guardado sigue ahí: se limita para no enseñar "2 de 1".
      const done = Math.min(completedByCategory[cat.id] || 0, total)
      const pct = total > 0 ? Math.round((done / total) * 100) : 0
      // Una categoría solo de lectura no tiene nada que completar, así que
      // en vez de una barra vacía al 0% se dice cuántas guías hay.
      const progressHtml =
        total > 0
          ? `<div class="progress-track"><div class="fill" style="width: ${pct}%"></div></div>
          <div class="progress-label">${done} de ${total} ${total === 1 ? 'curso completado' : 'cursos completados'}</div>`
          : `<div class="progress-label">${cat.guide_count ?? 0} ${(cat.guide_count ?? 0) === 1 ? 'guía para leer' : 'guías para leer'}</div>`
      return `
      <div class="category-row ${borderTintClassForKey(cat.id)}">
        <div class="category-icon ${tintClassForKey(cat.id)}">${categoryIconHtml(cat, 26)}</div>
        <div class="row-info">
          <h2>${escapeHtml(cat.name)}</h2>
          <p>${escapeHtml(cat.description || '')}</p>
          ${progressHtml}
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
