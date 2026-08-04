import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { icons } from './icons.js'

// Crea una notificación para OTRA persona como efecto de una acción normal
// (comentar, seguir, aprobar una guía...). No hace nada si no hay
// destinatario o si el destinatario es quien realiza la acción — nadie se
// notifica a sí mismo.
export const NOTIFICATION_TYPES = {
  guide_comment: 'Comentarios en tus guías',
  comment_reply: 'Respuestas a tus comentarios',
  guide_rating: 'Valoraciones en tus guías',
  new_follower: 'Nuevos seguidores',
  wall_comment: 'Comentarios en tu muro',
  followed_guide_published: 'Guías nuevas de quien sigues',
  guide_approved: 'Tu guía ha sido aprobada',
  guide_rejected: 'Tu guía ha sido rechazada',
}

// De qué se avisa TAMBIÉN por correo.
//
// Es una lista corta a propósito. Un correo se justifica cuando la cosa
// es personal, conversacional y se pierde si no la ves: un mensaje
// privado sin contestar mata la conversación, y una respuesta que no ves
// deja el hilo muerto. Lo demás (valoraciones, seguidores, guías nuevas)
// es interesante pero no urgente, y llenar la bandeja con eso es lo que
// hace que la gente se dé de baja de todo, incluido lo que sí le
// importaba.
//
// Quien manda de verdad son los disparadores de
// `supabase-migration-correo-avisos.sql`: esta lista es para pintar las
// casillas del perfil y para la página de baja. Si algún día se añade un
// tipo, hay que tocar los dos sitios.
//
// `private_message` no está en NOTIFICATION_TYPES porque los mensajes no
// pasan por la campanita: tienen su propio icono en la barra.
export const EMAIL_TYPES = {
  private_message: 'Mensajes privados',
  comment_reply: 'Respuestas a tus comentarios',
}

export async function createNotification({ recipientId, actorId, type, title, body = null, link = null }) {
  if (!recipientId || recipientId === actorId) return
  const { data: recipient } = await supabase.from('user_profiles').select('notification_prefs_disabled').eq('id', recipientId).single()
  if ((recipient?.notification_prefs_disabled || []).includes(type)) return
  const { error } = await supabase.from('user_notifications').insert({ recipient_id: recipientId, type, title, body, link })
  if (error) console.error('No se pudo crear la notificación:', error.message)
}

// Quién debe enterarse de un comentario en una guía.
//
// Dos agujeros que había:
//
//  1. Las guías OFICIALES tienen `author_id` a null (se crearon con SQL,
//     no las escribió una cuenta). Como no había destinatario, un
//     comentario en ellas no avisaba a NADIE — ni al equipo. Y son
//     justamente las guías que más se comentan. Ahora avisa a los
//     administradores.
//
//  2. Responder a un comentario avisaba al autor de la GUÍA, no a la
//     persona a la que respondías. Quien preguntaba algo no se enteraba
//     de que le habían contestado.
async function adminIds() {
  const { data, error } = await supabase.from('user_profiles').select('id').eq('is_admin', true)
  if (error) return []
  return (data || []).map((p) => p.id)
}

export async function notifyGuideComment({ guideAuthorId, actorId, guideTitle, guideSlug, replyToAuthorId = null }) {
  const link = `/guia.html?slug=${guideSlug}`
  const enviados = new Set([actorId])

  // La respuesta va primero: si alguien es a la vez el autor de la guía y
  // la persona a la que respondes, el aviso útil es "te han respondido",
  // no "han comentado en tu guía".
  if (replyToAuthorId && !enviados.has(replyToAuthorId)) {
    enviados.add(replyToAuthorId)
    await createNotification({
      recipientId: replyToAuthorId,
      actorId,
      type: 'comment_reply',
      title: 'Te han respondido a un comentario',
      body: guideTitle,
      link,
    })
  }

  // Sin autor es una guía oficial: la lleva el equipo.
  const destinos = guideAuthorId ? [guideAuthorId] : await adminIds()
  for (const id of destinos) {
    if (enviados.has(id)) continue
    enviados.add(id)
    await createNotification({
      recipientId: id,
      actorId,
      type: 'guide_comment',
      title: guideAuthorId ? 'Nuevo comentario en tu guía' : 'Nuevo comentario en una guía de PokeDoc',
      body: guideTitle,
      link,
    })
  }
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
      ${icons.bell(19)}<span class="nav-bell-badge hidden" id="navBellBadge">0</span>
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
      // Solo las SIN LEER. Antes se listaban las 20 últimas leídas o no,
      // así que la campanita se quedaba con los mismos avisos para
      // siempre: leías cinco "nuevo comentario" y seguían ahí. Ahora, al
      // leer una, desaparece de la lista.
      //
      // No se borran de la base: siguen ahí por si algún día hace falta
      // un historial. Lo que cambia es qué enseña la campanita.
      .is('read_at', null)
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
        ? `<p class="empty-state" style="padding:16px;">Estás al día. No tienes avisos sin leer.</p>`
        : notifications.map(notificationItemHtml).join('')

    list.querySelectorAll('[data-notif-id]').forEach((item) =>
      item.addEventListener('click', async (e) => {
        e.preventDefault()
        await supabase.from('user_notifications').update({ read_at: new Date().toISOString() }).eq('id', item.dataset.notifId)
        const href = item.getAttribute('href')
        if (href && href !== '#') {
          window.location.href = href
          return
        }
        // Sin enlace no hay navegación, así que hay que repintar aquí
        // para que el aviso desaparezca de verdad.
        await refresh()
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
