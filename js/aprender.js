import { supabase } from './supabase.js'
import { escapeHtml, getSession, tintClassForKey, borderTintClassForKey, categoryIconHtml, guideHasCourse } from './app.js'

async function loadCategories(session) {
  const list = document.getElementById('categoriesList')
  const { data: categories, error } = await supabase.from('categories').select('*').order('order_pos')

  if (error || !categories || categories.length === 0) {
    list.innerHTML = `<p class="empty-state">No hay categorías disponibles todavía.</p>`
    return
  }

  // Se cuenta a partir de las guías publicadas y no de `guide_count`,
  // que es un contador cacheado y además no distingue qué tiene curso.
  const { data: publishedGuides } = await supabase
    .from('guides')
    .select('id, category_id, blocks')
    .not('published_at', 'is', null)

  const guides = publishedGuides || []
  const categoryOfGuide = new Map(guides.map((g) => [g.id, g.category_id]))

  const totals = {}
  for (const g of guides) {
    const t = (totals[g.category_id] = totals[g.category_id] || { guias: 0, cursos: 0, leidas: 0, hechos: 0 })
    t.guias++
    if (guideHasCourse(g)) t.cursos++
  }

  if (session) {
    // Se mapea por guide_id en vez de pedir `guides(category_id)` anidado:
    // una consulta plana es más predecible y no depende de cómo resuelva
    // PostgREST la relación.
    const { data: progress } = await supabase
      .from('user_progress')
      .select('guide_id, status, read_at')
      .eq('user_id', session.user.id)

    for (const p of progress || []) {
      const catId = categoryOfGuide.get(p.guide_id)
      if (!catId || !totals[catId]) continue
      if (p.read_at) totals[catId].leidas++
      if (p.status === 'completed') totals[catId].hechos++
    }
  }

  list.innerHTML = categories
    .map((cat) => {
      const t = totals[cat.id] || { guias: 0, cursos: 0, leidas: 0, hechos: 0 }
      // Si una guía se despublica después de leerla, el progreso guardado
      // sigue ahí: se limita para no enseñar "4 de 3".
      const leidas = Math.min(t.leidas, t.guias)
      const hechos = Math.min(t.hechos, t.cursos)
      const pct = t.guias > 0 ? Math.round((leidas / t.guias) * 100) : 0

      // La barra mide lectura, que es la acción principal de la web y la
      // única que existe en TODAS las categorías. Los cursos, cuando los
      // hay, van como línea secundaria.
      const cursosHtml =
        t.cursos > 0
          ? `<div class="progress-label subtle">${hechos} de ${t.cursos} ${t.cursos === 1 ? 'curso hecho' : 'cursos hechos'}</div>`
          : ''

      const progressHtml = !session
        ? `<div class="progress-label">${t.guias} ${t.guias === 1 ? 'guía para leer' : 'guías para leer'}</div>`
        : t.guias === 0
          ? `<div class="progress-label">Todavía sin guías</div>`
          : `<div class="progress-track"><div class="fill" style="width: ${pct}%"></div></div>
          <div class="progress-label">${leidas} de ${t.guias} ${t.guias === 1 ? 'guía leída' : 'guías leídas'}</div>
          ${cursosHtml}`
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
