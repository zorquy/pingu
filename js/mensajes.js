import { supabase } from './supabase.js'
import { escapeHtml, getInitial, requireAuth, profileUrl, avatarStyle } from './app.js'
import { listConversations, loadThreadMessages, markConversationRead, sendMessage, deleteMessage, getOtherParticipant, findOrCreateConversation, isParticipant } from './messages.js'
import { reportButtonHtml, wireReportButtons } from './report.js'
import { icons } from './icons.js'
import { conVueltaAtras, terminoParaFiltro } from './busqueda.js'
import { perfilesMencionados, enlazarMenciones, porNombre } from './menciones.js'

const root = document.getElementById('messagesRoot')
const params = new URLSearchParams(window.location.search)

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'ahora mismo'
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `hace ${days} d`
  return new Date(iso).toLocaleDateString('es-ES')
}

async function renderInbox(session) {
  root.innerHTML = `
    <div class="page-header" style="padding-top: 8px;">
      <h1>Mensajes</h1>
      <p>Tus conversaciones privadas. <a href="/mensajes.html?new=1" style="display:inline-flex; align-items:center; gap:4px;">${icons.edit(13)} Nueva conversación</a></p>
    </div>
    <div id="inboxList"><div class="skeleton" style="height:70px; margin-bottom:12px;"></div></div>`

  const list = await listConversations(session.user.id)
  const listEl = document.getElementById('inboxList')
  listEl.innerHTML =
    list.length === 0
      ? `<p class="empty-state">Todavía no tienes conversaciones. Busca a alguien en <a href="/usuarios.html">Comunidad</a> y escríbele desde su perfil, o <a href="/mensajes.html?new=1">empieza una conversación nueva</a>.</p>`
      : list
          .map((c) => {
            const p = c.otherProfile
            const name = p?.display_name || p?.username || 'Usuario'
            return `
      <a class="my-guide-row" href="/mensajes.html?c=${c.conversationId}" style="text-decoration:none; align-items:center; gap:12px;">
        <span class="mini-avatar" style="width:44px; height:44px; font-size:16px; flex-shrink:0; ${avatarStyle(p)}">${p?.avatar_url ? '' : getInitial(name)}</span>
        <div style="flex:1; min-width:0;">
          <strong style="${c.unread ? 'color:var(--navy);' : ''}">${escapeHtml(name)}</strong>
          <p class="subtext" style="margin:2px 0 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${c.lastMessage ? escapeHtml(c.lastMessage.body) : ''}</p>
        </div>
        ${c.lastMessage ? `<span class="date" style="color:var(--text-dim); font-size:12px; flex-shrink:0;">${timeAgo(c.lastMessage.created_at)}</span>` : ''}
      </a>`
          })
          .join('')
}

async function renderNewConversation(session) {
  root.innerHTML = `
    <div class="page-header" style="padding-top: 8px;">
      <h1>Nueva conversación</h1>
      <p><a href="/mensajes.html">← Volver a mensajes</a></p>
    </div>
    <div class="search-input-wrap"><input type="text" id="newMsgSearch" class="search-input" placeholder="Buscar por nombre de usuario…" /></div>
    <div id="newMsgResults"></div>`

  document.getElementById('newMsgSearch').addEventListener('input', async (e) => {
    const q = e.target.value.trim()
    const resultsEl = document.getElementById('newMsgResults')
    if (!q) {
      resultsEl.innerHTML = ''
      return
    }
    // Buscar "jesus" tiene que encontrar a "Jesús": se compara contra la
    // columna plegada, y si la migración de acentos todavía no está
    // puesta se busca como antes (ver js/busqueda.js).
    const base = () =>
      supabase.from('user_profiles').select('id, username, display_name, avatar_url').neq('id', session.user.id)
    const { data } = await conVueltaAtras(
      () => base().ilike('search_norm', `%${terminoParaFiltro(q)}%`).limit(10),
      () => base().or(`display_name.ilike.%${q}%,username.ilike.%${q}%`).limit(10)
    )
    const results = data || []
    resultsEl.innerHTML =
      results.length === 0
        ? `<p class="empty-state">Nadie coincide con esa búsqueda.</p>`
        : results
            .map((p) => {
              const name = p.display_name || p.username || 'Usuario'
              return `
        <button type="button" class="my-guide-row" data-user-id="${p.id}" style="width:100%; text-align:left; align-items:center; gap:12px;">
          <span class="mini-avatar" style="width:36px; height:36px; font-size:14px; flex-shrink:0; ${avatarStyle(p)}">${p.avatar_url ? '' : getInitial(name)}</span>
          <strong>${escapeHtml(name)}</strong>
        </button>`
            })
            .join('')

    let starting = false
    resultsEl.querySelectorAll('[data-user-id]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (starting) return
        starting = true
        const conversationId = await findOrCreateConversation(session.user.id, btn.dataset.userId)
        window.location.href = `/mensajes.html?c=${conversationId}`
      })
    )
  })
}

async function renderThread(session, conversationId) {
  const [amIParticipant, otherProfile] = await Promise.all([
    isParticipant(conversationId, session.user.id),
    getOtherParticipant(conversationId, session.user.id),
  ])
  if (!amIParticipant || !otherProfile) {
    root.innerHTML = `<p class="empty-state">No se encontró esa conversación.<br><a href="/mensajes.html">← Volver a mensajes</a></p>`
    return
  }

  await markConversationRead(conversationId, session.user.id)

  const name = otherProfile.display_name || otherProfile.username || 'Usuario'
  root.innerHTML = `
    <div class="page-header" style="padding-top: 8px; display:flex; align-items:center; gap:12px;">
      <a href="/mensajes.html" style="font-weight:700; color:var(--text-dim);">←</a>
      <a class="mini-avatar" href="${profileUrl(otherProfile)}" style="width:40px; height:40px; font-size:15px; ${avatarStyle(otherProfile)}">${otherProfile.avatar_url ? '' : getInitial(name)}</a>
      <h1 style="margin:0; font-size:20px;"><a href="${profileUrl(otherProfile)}" style="color:var(--text);">${escapeHtml(name)}</a></h1>
    </div>
    <div id="threadMessages" style="display:flex; flex-direction:column; gap:8px; margin:16px 0;"></div>
    <div class="simple-card">
      <textarea id="msgBody" placeholder="Escribe un mensaje…"></textarea>
      <button class="btn-primary" id="btnSendMsg" style="margin-top:8px;">Enviar</button>
    </div>`

  async function refreshMessages() {
    const messages = await loadThreadMessages(conversationId)
    const el = document.getElementById('threadMessages')
    // Los @nombre de la conversación se enlazan al perfil, pero AQUÍ NO
    // SE AVISA A NADIE.
    //
    // Mencionar a alguien en una conversación privada no puede mandarle
    // un aviso: le llegaría "te han mencionado" por un mensaje que no
    // puede leer, y le diría que dos personas están hablando de él. El
    // enlace sí tiene sentido —"habla con @jesus" y lo abres— porque no
    // sale de la pantalla.
    const mencionados = porNombre(
      await perfilesMencionados(messages.map((m) => escapeHtml(m.body || '')).join(' '))
    )

    el.innerHTML =
      messages.length === 0
        ? `<p class="empty-state">Todavía no hay mensajes. ¡Escribe el primero!</p>`
        : messages
            .map((m) => {
              const mine = m.sender_id === session.user.id
              return `
        <div style="align-self:${mine ? 'flex-end' : 'flex-start'}; max-width:75%; background:${mine ? 'var(--navy)' : 'var(--ice)'}; color:${mine ? 'var(--white)' : 'var(--text)'}; padding:8px 12px; border-radius:var(--radius-md);">
          <p style="margin:0; font-size:13.5px; white-space:pre-wrap;">${enlazarMenciones(escapeHtml(m.body), mencionados)}</p>
          <div style="display:flex; align-items:center; gap:8px; margin-top:2px;">
            <span style="font-size:10.5px; opacity:0.7;">${timeAgo(m.created_at)}</span>
            ${mine ? `<button type="button" data-delete-msg="${m.id}" style="font-size:10.5px; opacity:0.7; text-decoration:underline;">Eliminar</button>` : reportButtonHtml('private_message', m.id)}
          </div>
        </div>`
            })
            .join('')
    el.querySelectorAll('[data-delete-msg]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        if (!confirm('¿Eliminar este mensaje?')) return
        await deleteMessage(btn.dataset.deleteMsg)
        await refreshMessages()
      })
    )
    wireReportButtons(el, session)
  }
  await refreshMessages()

  import('./mencion-autocompletar.js')
    .then((m) => m.engancharAutocompletarMenciones(document.getElementById('msgBody')))
    .catch(() => {})

  let sending = false
  document.getElementById('btnSendMsg').addEventListener('click', async () => {
    if (sending) return
    const body = document.getElementById('msgBody').value.trim()
    if (!body) return
    sending = true
    const btn = document.getElementById('btnSendMsg')
    btn.disabled = true
    await sendMessage(conversationId, session.user.id, body)
    document.getElementById('msgBody').value = ''
    await refreshMessages()
    sending = false
    btn.disabled = false
  })
}

async function init() {
  const session = await requireAuth()
  if (!session) return

  const withUserId = params.get('with')
  const conversationId = params.get('c')
  const isNew = params.get('new')

  if (withUserId === session.user.id) {
    window.location.href = '/mensajes.html'
    return
  }

  if (withUserId) {
    root.innerHTML = `<p class="empty-state">Cargando…</p>`
    const newConversationId = await findOrCreateConversation(session.user.id, withUserId)
    window.history.replaceState({}, '', `/mensajes.html?c=${newConversationId}`)
    await renderThread(session, newConversationId)
  } else if (conversationId) {
    await renderThread(session, conversationId)
  } else if (isNew) {
    await renderNewConversation(session)
  } else {
    await renderInbox(session)
  }
}

init()
