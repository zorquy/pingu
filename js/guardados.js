import { supabase } from './supabase.js'
import { escapeHtml, requireAuth } from './app.js'

async function loadSaved(session) {
  const list = document.getElementById('savedList')

  const { data, error } = await supabase
    .from('saved_guides')
    .select('id, guides(slug, title, emoji, estimated_mins)')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error || !data || data.length === 0) {
    list.innerHTML = `<p class="empty-state">Todavía no has guardado ninguna guía. Pulsa ☆ Guardar en cualquier guía para verla aquí.</p>`
    return
  }

  list.innerHTML = data
    .filter((row) => row.guides)
    .map(
      (row) => `
    <div class="saved-guide-row" data-id="${row.id}">
      <span style="font-size: 22px;">${row.guides.emoji || '📘'}</span>
      <div class="info">
        <h3>${escapeHtml(row.guides.title)}</h3>
        <span class="time-tag">${row.guides.estimated_mins || 5} min</span>
      </div>
      <a href="guia.html?slug=${encodeURIComponent(row.guides.slug)}" class="btn-guide">Leer →</a>
      <button class="unsave-btn" data-id="${row.id}" title="Quitar">×</button>
    </div>`
    )
    .join('')

  list.querySelectorAll('.unsave-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await supabase.from('saved_guides').delete().eq('id', btn.dataset.id)
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
