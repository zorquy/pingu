import { supabase } from './supabase.js'
import { escapeHtml, profileUrl } from './app.js'
import { reportButtonHtml, wireReportButtons } from './report.js'
import { createNotification } from './notifications.js'

const REPORT_TYPE_BY_TABLE = {
  profile_comments: 'profile_comment',
  guide_comments: 'guide_comment',
}

async function profilesForIds(ids) {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return {}
  const { data } = await supabase.from('user_profiles').select('id, display_name, username').in('id', uniqueIds)
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

function withQueryParam(url, key, value) {
  return url + (url.includes('?') ? '&' : '?') + `${key}=${encodeURIComponent(value)}`
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
  isAdmin = false,
}) {
  const { data } = await supabase
    .from(table)
    .select('*')
    .eq(idField, profileId)
    .order('created_at', { ascending: false })

  const comments = data || []
  const profilesById = await profilesForIds(comments.map((c) => c.author_id))
  const isProfileWall = table === 'profile_comments'

  listEl.innerHTML = comments.length === 0
    ? `<div class="wall-empty">💬 ${emptyMessage}</div>`
    : comments
        .map((c) => {
          const authorProfile = profilesById[c.author_id]
          const authorName = authorProfile?.display_name || authorProfile?.username || 'Usuario'
          const canReply = isProfileWall && currentSession && currentSession.user.id !== c.author_id && authorProfile
          const replyHref = canReply ? withQueryParam(profileUrl(authorProfile), 'reply_to', c.id) : null
          return `
    <div class="my-guide-row" style="flex-direction:column; align-items:flex-start;">
      <div style="display:flex; justify-content:space-between; width:100%;">
        <strong>${escapeHtml(authorName)}</strong>
        <span class="date" style="color:var(--text-dim); font-size:12px;">${new Date(c.created_at).toLocaleDateString('es-ES')}</span>
      </div>
      <p style="margin:6px 0 0; font-size:13.5px;">${escapeHtml(c.body)}</p>
      <div style="display:flex; gap:10px; margin-top:6px;">
        ${currentSession && (currentSession.user.id === c.author_id || currentSession.user.id === profileId || isAdmin) ? `<button data-delete-comment="${c.id}" style="font-size:11px; color:#dc2626; font-weight:700;">Eliminar</button>` : ''}
        ${canReply ? `<a href="${replyHref}" style="font-size:11px; color:var(--text-dim); font-weight:700;">Responder</a>` : ''}
        ${currentSession && currentSession.user.id !== c.author_id ? reportButtonHtml(REPORT_TYPE_BY_TABLE[table] || 'profile_comment', c.id) : ''}
      </div>
    </div>`
        })
        .join('')

  listEl.querySelectorAll('[data-delete-comment]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este comentario?')) return
      await supabase.from(table).delete().eq('id', btn.dataset.deleteComment)
      renderWall({ listEl, formEl, profileId, currentSession, table, idField, placeholder, emptyMessage, isAdmin })
    })
  )
  wireReportButtons(listEl, currentSession)

  if (!formEl) return

  if (!currentSession) {
    formEl.innerHTML = `<p class="subtext"><a href="/auth.html" style="color:var(--navy); font-weight:700;">Inicia sesión</a> para escribir aquí.</p>`
    return
  }

  const replyToId = isProfileWall ? new URLSearchParams(window.location.search).get('reply_to') : null
  const replyTarget = replyToId ? comments.find((c) => c.id === replyToId) : null
  const replyTargetName = replyTarget ? profilesById[replyTarget.author_id]?.display_name || profilesById[replyTarget.author_id]?.username || 'Usuario' : null

  formEl.innerHTML = `
    ${replyTarget ? `<div class="forum-reply-banner">Respondiendo a <strong>${escapeHtml(replyTargetName)}</strong>: “${escapeHtml(replyTarget.body.slice(0, 80))}” <button type="button" id="btnCancelWallReply">Cancelar</button></div>` : ''}
    <div class="simple-card">
      <textarea id="wallCommentBody" placeholder="${escapeHtml(placeholder)}"></textarea>
      <button class="btn-primary" id="btnSubmitWallComment" style="margin-top:8px;">Publicar</button>
    </div>`

  if (replyTarget) document.getElementById('wallCommentBody').focus()
  document.getElementById('btnCancelWallReply')?.addEventListener('click', () => {
    const url = new URL(window.location.href)
    url.searchParams.delete('reply_to')
    window.history.replaceState({}, '', url)
    renderWall({ listEl, formEl, profileId, currentSession, table, idField, placeholder, emptyMessage, isAdmin })
  })

  document.getElementById('btnSubmitWallComment').addEventListener('click', async () => {
    const body = document.getElementById('wallCommentBody').value.trim()
    if (!body) return
    await supabase.from(table).insert({ [idField]: profileId, author_id: currentSession.user.id, body })

    if (isProfileWall) {
      await createNotification({
        recipientId: profileId,
        actorId: currentSession.user.id,
        type: 'wall_comment',
        title: 'Nuevo comentario en tu muro',
        body,
        link: '/perfil.html',
      })
    } else {
      const { data: guideForNotif } = await supabase.from('guides').select('author_id, title, slug').eq('id', profileId).single()
      if (guideForNotif) {
        await createNotification({
          recipientId: guideForNotif.author_id,
          actorId: currentSession.user.id,
          type: 'guide_comment',
          title: 'Nuevo comentario en tu guía',
          body: guideForNotif.title,
          link: `/guia.html?slug=${guideForNotif.slug}`,
        })
      }
    }

    if (replyToId) {
      const url = new URL(window.location.href)
      url.searchParams.delete('reply_to')
      window.history.replaceState({}, '', url)
    }
    renderWall({ listEl, formEl, profileId, currentSession, table, idField, placeholder, emptyMessage, isAdmin })
  })
}
