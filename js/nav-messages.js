import { escapeHtml } from './app.js'
import { listConversations } from './messages.js'
import { icons } from './icons.js'

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

function conversationItemHtml(c) {
  const name = c.otherProfile?.display_name || c.otherProfile?.username || 'Usuario'
  const snippet = c.lastMessage ? c.lastMessage.body.slice(0, 60) : ''
  return `
    <a class="nav-bell-item${c.unread ? ' unread' : ''}" href="/mensajes.html?c=${c.conversationId}">
      <span class="nav-bell-item-title">${escapeHtml(name)}</span>
      ${snippet ? `<span class="nav-bell-item-body">${escapeHtml(snippet)}</span>` : ''}
      ${c.lastMessage ? `<span class="nav-bell-item-date">${timeAgo(c.lastMessage.created_at)}</span>` : ''}
    </a>`
}

export async function renderNavMessages(session) {
  const navRight = document.querySelector('.nav-right')
  const navUser = document.getElementById('nav-user')
  if (!navRight || !navUser || document.getElementById('navMsg')) return

  const wrap = document.createElement('div')
  wrap.className = 'nav-bell-wrap'
  wrap.id = 'navMsg'
  wrap.innerHTML = `
    <button type="button" class="nav-bell-btn" id="navMsgBtn" aria-label="Mensajes">
      ${icons.mail(19)}<span class="nav-bell-badge hidden" id="navMsgBadge">0</span>
    </button>
    <div class="nav-bell-dropdown hidden" id="navMsgDropdown">
      <div class="nav-bell-header">
        <strong>Conversaciones</strong>
        <a href="/mensajes.html">Ver todo…</a>
      </div>
      <div id="navMsgList"><p class="empty-state" style="padding:16px;">Cargando…</p></div>
      <div class="nav-bell-header" style="border-top:1px solid var(--border); border-bottom:none;">
        <a href="/mensajes.html?new=1" style="display:flex; align-items:center; gap:6px;">${icons.edit(14)} Iniciar una nueva conversación</a>
      </div>
    </div>`
  navRight.insertBefore(wrap, navUser)

  async function loadConversations() {
    return listConversations(session.user.id)
  }

  function updateBadge(list) {
    const unreadCount = list.filter((c) => c.unread).length
    const badge = document.getElementById('navMsgBadge')
    badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount)
    badge.classList.toggle('hidden', unreadCount === 0)
  }

  async function refresh() {
    const list = await loadConversations()
    updateBadge(list)
    const listEl = document.getElementById('navMsgList')
    const recent = list.slice(0, 8)
    listEl.innerHTML =
      recent.length === 0
        ? `<p class="empty-state" style="padding:16px;">No hay conversaciones recientes.</p>`
        : recent.map(conversationItemHtml).join('')
  }

  document.getElementById('navMsgBtn').addEventListener('click', async () => {
    const dropdown = document.getElementById('navMsgDropdown')
    const willShow = dropdown.classList.contains('hidden')
    dropdown.classList.toggle('hidden', !willShow)
    if (willShow) await refresh()
  })
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) document.getElementById('navMsgDropdown')?.classList.add('hidden')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('navMsgDropdown')?.classList.add('hidden')
  })

  updateBadge(await loadConversations())
}
