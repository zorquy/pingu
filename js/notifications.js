import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'

// Crea una notificación para OTRA persona como efecto de una acción normal
// (comentar, seguir, aprobar una guía...). No hace nada si no hay
// destinatario o si el destinatario es quien realiza la acción — nadie se
// notifica a sí mismo.
export async function createNotification({ recipientId, actorId, type, title, body = null, link = null }) {
  if (!recipientId || recipientId === actorId) return
  const { error } = await supabase.from('user_notifications').insert({ recipient_id: recipientId, type, title, body, link })
  if (error) console.error('No se pudo crear la notificación:', error.message)
}

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

function notificationItemHtml(n) {
  const href = n.link || '#'
  return `
    <a class="nav-bell-item${n.read_at ? '' : ' unread'}" href="${escapeHtml(href)}" data-notif-id="${n.id}">
      <span class="nav-bell-item-title">${escapeHtml(n.title)}</span>
      ${n.body ? `<span class="nav-bell-item-body">${escapeHtml(n.body)}</span>` : ''}
      <span class="nav-bell-item-date">${timeAgo(n.created_at)}</span>
    </a>`
}

export async function renderNotificationBell(session) {
  if (!session) return
  const navRight = document.querySelector('.nav-right')
  const navUser = document.getElementById('nav-user')
  if (!navRight || !navUser || document.getElementById('navBell')) return

  const wrap = document.createElement('div')
  wrap.className = 'nav-bell-wrap'
  wrap.id = 'navBell'
  wrap.innerHTML = `
    <button type="button" class="nav-bell-btn" id="navBellBtn" aria-label="Notificaciones">
      🔔<span class="nav-bell-badge hidden" id="navBellBadge">0</span>
    </button>
    <div class="nav-bell-dropdown hidden" id="navBellDropdown">
      <div class="nav-bell-header">
        <strong>Notificaciones</strong>
        <button type="button" id="navBellMarkAll">Marcar todas como leídas</button>
      </div>
      <div id="navBellList"><p class="empty-state" style="padding:16px;">Cargando…</p></div>
    </div>`
  navRight.insertBefore(wrap, navUser)

  async function loadNotifications() {
    const { data } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('recipient_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    return data || []
  }

  function updateBadge(notifications) {
    const unreadCount = notifications.filter((n) => !n.read_at).length
    const badge = document.getElementById('navBellBadge')
    badge.textContent = unreadCount > 9 ? '9+' : String(unreadCount)
    badge.classList.toggle('hidden', unreadCount === 0)
  }

  async function refresh() {
    const notifications = await loadNotifications()
    updateBadge(notifications)
    const list = document.getElementById('navBellList')
    list.innerHTML =
      notifications.length === 0
        ? `<p class="empty-state" style="padding:16px;">No tienes notificaciones todavía.</p>`
        : notifications.map(notificationItemHtml).join('')

    list.querySelectorAll('[data-notif-id]').forEach((item) =>
      item.addEventListener('click', async (e) => {
        e.preventDefault()
        await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', item.dataset.notifId)
        const href = item.getAttribute('href')
        if (href && href !== '#') window.location.href = href
      })
    )
  }

  document.getElementById('navBellBtn').addEventListener('click', async () => {
    const dropdown = document.getElementById('navBellDropdown')
    const willShow = dropdown.classList.contains('hidden')
    dropdown.classList.toggle('hidden', !willShow)
    if (willShow) await refresh()
  })
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) document.getElementById('navBellDropdown')?.classList.add('hidden')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('navBellDropdown')?.classList.add('hidden')
  })
  document.getElementById('navBellMarkAll').addEventListener('click', async () => {
    await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', session.user.id).is('read_at', null)
    await refresh()
  })

  updateBadge(await loadNotifications())
}
