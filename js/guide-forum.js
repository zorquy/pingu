import { supabase } from './supabase.js'
import { escapeHtml, getInitial, profileUrl, avatarStyle } from './app.js'
import { showToast } from './toast.js'
import { reportButtonHtml, wireReportButtons } from './report.js'
import { contributorCounts, badgeHtml } from './contributor-badge.js'
import { notifyGuideComment } from './notifications.js'

// 20 y no 10. Con 10, una guía con 12 comentarios ya se parte en dos
// páginas, y los DOS más nuevos quedan escondidos en la segunda — que es
// la que nadie pincha. Justo lo contrario de lo que quieres en una
// comunidad que empieza. Con el volumen actual, esto significa que casi
// nunca se pagina.
const PAGE_SIZE = 20

async function profilesByIds(ids) {
  const uniqueIds = [...new Set(ids)]
  if (uniqueIds.length === 0) return {}
  const { data } = await supabase.from('user_profiles').select('id, display_name, username, avatar_url').in('id', uniqueIds)
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

function snippet(text, len = 90) {
  const clean = (text || '').trim()
  return clean.length > len ? clean.slice(0, len) + '…' : clean
}

// Comentarios de guía estilo foro: paginado, con citar/responder. La
// documentación de arriba hace de "post principal" — esto pinta solo los
// comentarios de los usuarios debajo.
export function initGuideForum({ containerEl, guideId, currentSession, isAdmin = false, guideAuthorId = null, guideTitle = '', guideSlug = '' }) {
  let replyingTo = null

  function updatePageInUrl(page) {
    const url = new URL(window.location.href)
    if (page > 1) url.searchParams.set('page', String(page))
    else url.searchParams.delete('page')
    window.history.replaceState({}, '', url)
  }

  async function render(page) {
    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const [{ count }, { data: comments }] = await Promise.all([
      supabase.from('guide_comments').select('*', { count: 'exact', head: true }).eq('guide_id', guideId),
      supabase.from('guide_comments').select('*').eq('guide_id', guideId).order('created_at', { ascending: true }).range(from, to),
    ])

    const list = comments || []
    const totalPages = Math.max(1, Math.ceil((count || 0) / PAGE_SIZE))
    page = Math.min(Math.max(1, page), totalPages)
    updatePageInUrl(page)

    const replyIds = [...new Set(list.map((c) => c.reply_to_id).filter(Boolean))]
    const [profilesById, parentsById] = await Promise.all([
      profilesByIds(list.map((c) => c.author_id)),
      replyIds.length > 0
        ? supabase
            .from('guide_comments')
            .select('id, author_id, body')
            .in('id', replyIds)
            .then(({ data }) => Object.fromEntries((data || []).map((p) => [p.id, p])))
        : Promise.resolve({}),
    ])
    const parentAuthors = await profilesByIds(Object.values(parentsById).map((p) => p.author_id))

    // El rango de colaborador de cada persona que aparece en la página.
    // Se piden todos de una vez: una consulta por comentario sería una
    // barbaridad en un hilo largo.
    const rangos = await contributorCounts([
      ...Object.keys(profilesById),
      ...Object.keys(parentAuthors),
    ])

    function authorName(id) {
      const p = profilesById[id] || parentAuthors[id]
      return p?.display_name || p?.username || 'Usuario'
    }

    function commentHtml(c) {
      const profile = profilesById[c.author_id]
      const name = authorName(c.author_id)
      const parent = c.reply_to_id ? parentsById[c.reply_to_id] : null
      return `
      <div class="forum-post">
        <a class="mini-avatar" href="${profile ? profileUrl(profile) : '#'}" style="width:44px; height:44px; font-size:16px; ${avatarStyle(profile)}">${profile?.avatar_url ? '' : getInitial(name)}</a>
        <div class="forum-post-body">
          <div class="forum-post-header">
            <a href="${profile ? profileUrl(profile) : '#'}" class="forum-post-author">${escapeHtml(name)}</a>${badgeHtml(rangos[c.author_id])}
            <span class="forum-post-date">${new Date(c.created_at).toLocaleString('es-ES')}</span>
          </div>
          ${parent ? `<div class="forum-quote">En respuesta a <strong>${escapeHtml(authorName(parent.author_id))}</strong>: “${escapeHtml(snippet(parent.body))}”</div>` : ''}
          <p class="forum-post-text">${escapeHtml(c.body)}</p>
          <div class="forum-post-actions">
            ${currentSession ? `<button class="forum-reply-btn" data-reply-id="${c.id}" data-reply-name="${escapeHtml(name)}" data-reply-author="${escapeHtml(c.author_id || '')}">↩ Responder</button>` : ''}
            ${currentSession && (currentSession.user.id === c.author_id || isAdmin) ? `<button class="forum-delete-btn" data-delete-id="${c.id}">Eliminar</button>` : ''}
            ${currentSession && currentSession.user.id !== c.author_id ? reportButtonHtml('guide_comment', c.id) : ''}
          </div>
        </div>
      </div>`
    }

    containerEl.innerHTML = `
      <div id="forumPostsList">
        ${list.length === 0 ? `<p class="empty-state">Todavía no hay comentarios. ¡Sé el primero!</p>` : list.map(commentHtml).join('')}
      </div>
      ${
        totalPages > 1
          ? `<div class="forum-pagination">
        <button class="btn-outline" id="forumPrevPage" ${page <= 1 ? 'disabled' : ''}>← Anterior</button>
        <span>Página ${page} de ${totalPages}</span>
        <button class="btn-outline" id="forumNextPage" ${page >= totalPages ? 'disabled' : ''}>Siguiente →</button>
      </div>`
          : ''
      }
      <div id="forumReplyBanner"></div>
      <div id="forumCommentForm" style="margin-top:12px;"></div>`

    containerEl.querySelector('#forumPrevPage')?.addEventListener('click', () => render(page - 1))
    containerEl.querySelector('#forumNextPage')?.addEventListener('click', () => render(page + 1))

    containerEl.querySelectorAll('.forum-reply-btn').forEach((btn) =>
      btn.addEventListener('click', () => {
        replyingTo = { id: btn.dataset.replyId, name: btn.dataset.replyName, authorId: btn.dataset.replyAuthor || null }
        renderReplyBanner()
        document.getElementById('forumCommentBody')?.focus()
      })
    )

    containerEl.querySelectorAll('.forum-delete-btn').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este comentario?')) return
        await supabase.from('guide_comments').delete().eq('id', btn.dataset.deleteId)
        render(page)
      })
    )

    wireReportButtons(containerEl, currentSession)

    function renderReplyBanner() {
      const banner = document.getElementById('forumReplyBanner')
      if (!banner) return
      banner.innerHTML = replyingTo
        ? `<div class="forum-reply-banner">Respondiendo a <strong>${escapeHtml(replyingTo.name)}</strong> <button type="button" id="forumCancelReply">Cancelar</button></div>`
        : ''
      document.getElementById('forumCancelReply')?.addEventListener('click', () => {
        replyingTo = null
        renderReplyBanner()
      })
    }

    const formEl = document.getElementById('forumCommentForm')
    if (!currentSession) {
      formEl.innerHTML = `<p class="subtext"><a href="/auth.html" style="color:var(--navy); font-weight:700;">Inicia sesión</a> para comentar.</p>`
      return
    }
    formEl.innerHTML = `
      <div class="simple-card">
        <textarea id="forumCommentBody" placeholder="Escribe un comentario..."></textarea>
        <button class="btn-primary" id="btnSubmitForumComment" style="margin-top:8px;">Publicar</button>
      </div>`
    document.getElementById('btnSubmitForumComment').addEventListener('click', async () => {
      const body = document.getElementById('forumCommentBody').value.trim()
      if (!body) return
      const { error } = await supabase
        .from('guide_comments')
        .insert({ guide_id: guideId, author_id: currentSession.user.id, body, reply_to_id: replyingTo?.id || null })
      if (error) {
        showToast('No se pudo publicar el comentario: ' + error.message)
        return
      }
      // El aviso no puede tumbar el comentario, que ya está guardado.
      await notifyGuideComment({
        guideAuthorId,
        actorId: currentSession.user.id,
        guideTitle,
        guideSlug,
        replyToAuthorId: replyingTo?.authorId || null,
      }).catch((err) => console.error('No se pudo avisar del comentario:', err.message))
      replyingTo = null
      const newCount = (count || 0) + 1
      render(Math.max(1, Math.ceil(newCount / PAGE_SIZE)))
    })
  }

  const initialPage = Math.max(1, parseInt(new URLSearchParams(window.location.search).get('page') || '1', 10) || 1)
  render(initialPage)
}
