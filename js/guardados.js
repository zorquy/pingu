import { supabase } from './supabase.js'
import { escapeHtml, requireAuth, guideHasReference } from './app.js'
import { decorateGuideCards } from './guide-card.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'

async function loadSaved(session) {
  const list = document.getElementById('savedList')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('saved_guides')
    .eq('id', session.user.id)
    .single()

  const savedIds = profile?.saved_guides || []
  if (savedIds.length === 0) {
    list.innerHTML = `<p class="empty-state" style="display:flex; align-items:center; justify-content:center; gap:5px; flex-wrap:wrap;">Todavía no has guardado ninguna guía. Pulsa ${icons.bookmark(14)} Guardar en cualquier guía para verla aquí.</p>`
    return
  }

  const { data: guides } = await supabase
    .from('guides')
    .select('id, slug, title, cover_emoji, estimated_mins, blocks, reference_blocks')
    .in('id', savedIds)

  if (!guides || guides.length === 0) {
    list.innerHTML = `<p class="empty-state">Todavía no has guardado ninguna guía.</p>`
    return
  }

  list.innerHTML = guides
    .map(
      (g) => `
    <div class="saved-guide-row" data-guide-id="${g.id}" data-slug="${escapeHtml(g.slug || '')}" data-has-guide="${guideHasReference(g) ? '1' : ''}" style="cursor:pointer;">
      <span class="saved-guide-icon">${contentIconHtml(g.cover_emoji, 22, 'bookOpen')}</span>
      <div class="info">
        <h3>${escapeHtml(g.title)}</h3>
        <span class="time-tag">${g.estimated_mins || 5} min</span>
        <span class="card-rating" data-card-rating>Sin valorar</span>
      </div>
      <button class="unsave-btn" data-id="${g.id}" title="Quitar" aria-label="Quitar de guardados">×</button>
    </div>`
    )
    .join('')

  // Las filas de Guardados tienen maqueta propia (no la tarjeta
  // compartida), así que su clic se ata aquí.
  list.querySelectorAll('.saved-guide-row').forEach((row) => {
    const slug = row.dataset.slug
    if (!slug) return
    // Igual que las demás tarjetas: a la guía si la tiene, si no al curso.
    const destino = row.dataset.hasGuide
      ? `guia.html?slug=${encodeURIComponent(slug)}`
      : `curso.html?slug=${encodeURIComponent(slug)}`
    row.addEventListener('click', () => { window.location.href = destino })
  })

  await decorateGuideCards(list, session)

  list.querySelectorAll('.unsave-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation()
      const { data: current } = await supabase
        .from('user_profiles')
        .select('saved_guides')
        .eq('id', session.user.id)
        .single()
      const next = (current?.saved_guides || []).filter((id) => id !== btn.dataset.id)
      await supabase.from('user_profiles').update({ saved_guides: next }).eq('id', session.user.id)

      btn.closest('.saved-guide-row').remove()
      if (!list.querySelector('.saved-guide-row')) {
        list.innerHTML = `<p class="empty-state">Todavía no has guardado ninguna guía.</p>`
      }
    })
  })
}

async function init() {
  const session = await requireAuth()
  if (!session) return
  await loadSaved(session)
}

init()
