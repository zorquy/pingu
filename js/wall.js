import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'

async function namesForIds(ids) {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return {}
  const { data } = await supabase.from('user_profiles').select('id, display_name, username').in('id', uniqueIds)
  return Object.fromEntries((data || []).map((p) => [p.id, p.display_name || p.username || 'Usuario']))
}

export async function renderWall({
  listEl,
  formEl,
  profileId,
  currentSession,
  table = 'profile_comments',
  idField = 'profile_id',
  placeholder = 'Escribe algo en este muro...',
  emptyMessage = 'Todavía no hay nada escrito en este muro.<br>¡Sé el primero en dejar un mensaje!',
}) {
  const { data } = await supabase
    .from(table)
    .select('*')
    .eq(idField, profileId)
    .order('created_at', { ascending: false })

  const comments = data || []
  const namesById = await namesForIds(comments.map((c) => c.author_id))

  listEl.innerHTML = comments.length === 0
    ? `<div class="wall-empty">💬 ${emptyMessage}</div>`
    : comments
        .map(
          (c) => `
    <div class="my-guide-row" style="flex-direction:column; align-items:flex-start;">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <strong>${escapeHtml(namesById[c.author_id] || 'Usuario')}</strong>
        <span class="date" style="color:var(--text-dim); font-size:12px;">${new Date(c.created_at).toLocaleDateString('es-ES')}</span>
      </div>
      <p style="margin:6px 0 0; font-size:13.5px;">${escapeHtml(c.body)}</p>
      ${currentSession && (currentSession.user.id === c.author_id || currentSession.user.id === profileId) ? `<button data-delete-comment="${c.id}" style="margin-top:6px; font-size:11px; color:#dc2626; font-weight:700;">Eliminar</button>` : ''}
    </div>`
        )
        .join('')

  listEl.querySelectorAll('[data-delete-comment]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este comentario?')) return
      await supabase.from(table).delete().eq('id', btn.dataset.deleteComment)
      renderWall({ listEl, formEl, profileId, currentSession, table, idField, placeholder, emptyMessage })
    })
  )

  if (!formEl) return

  if (!currentSession) {
    formEl.innerHTML = `<p class="subtext"><a href="/auth.html" style="color:var(--navy); font-weight:700;">Inicia sesión</a> para escribir aquí.</p>`
    return
  }

  formEl.innerHTML = `
    <div class="simple-card">
      <textarea id="wallCommentBody" placeholder="${escapeHtml(placeholder)}"></textarea>
      <button class="btn-primary" id="btnSubmitWallComment" style="margin-top:8px;">Publicar</button>
    </div>`

  document.getElementById('btnSubmitWallComment').addEventListener('click', async () => {
    const body = document.getElementById('wallCommentBody').value.trim()
    if (!body) return
    await supabase.from(table).insert({ [idField]: profileId, author_id: currentSession.user.id, body })
    renderWall({ listEl, formEl, profileId, currentSession, table, idField, placeholder, emptyMessage })
  })
}
