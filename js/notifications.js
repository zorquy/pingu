import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { icons } from './icons.js'
import { anotarEnPestania } from './pestania.js'

// Crea una notificación para OTRA persona como efecto de una acción normal
// (comentar, seguir, aprobar una guía...). No hace nada si no hay
// destinatario o si el destinatario es quien realiza la acción — nadie se
// notifica a sí mismo.
export const NOTIFICATION_TYPES = {
  guide_comment: 'Comentarios en tus guías',
  comment_reply: 'Respuestas a tus comentarios',
  guide_rating: 'Valoraciones en tus guías',
  guide_helpful: 'Cuando a alguien le sirve tu guía',
  guide_suggestion: 'Correcciones que te sugieren',
  guide_suggestion_accepted: 'Cuando aceptan tu corrección',
  guide_request_fulfilled: 'Cuando se escribe una guía que pediste',
  forum_reply: 'Respuestas en tus temas del foro',
  forum_reaction: 'Reacciones a tus mensajes del foro',
  new_follower: 'Nuevos seguidores',
  wall_comment: 'Comentarios en tu muro',
  followed_guide_published: 'Guías nuevas de quien sigues',
  guide_approved: 'Tu guía ha sido aprobada',
  guide_rejected: 'Tu guía ha sido rechazada',
  // Torneos (tanda 224). Los avisos de torneo salían por push y por
  // correo pero NO dejaban rastro aquí, que es el único canal que le
  // funciona a todo el mundo: no hay que conceder permisos ni depende
  // de que el correo esté bien configurado.
  torneo_ronda: 'Cuando empieza tu ronda de torneo',
  torneo_partida: 'Tu partida: check-in, rival que reporta, mesa resuelta',
  torneo_final: 'Cuando termina un torneo que has jugado',
  torneo_cancelado: 'Si se cancela un torneo en el que estás',
  torneo_recordatorio: 'Aviso de que tu torneo va a empezar',
  torneo_plaza: 'Cuando la lista de espera te da plaza',
  torneo_apertura: 'Torneos nuevos con inscripciones abiertas',
  // Solo le llega a quien organiza o arbitra un torneo.
  torneo_juez: 'Cuando llaman a un juez en un torneo tuyo',
}

// De qué se avisa TAMBIÉN por correo.
//
// Es una lista corta a propósito. Un correo se justifica cuando la cosa
// es personal y se pierde si no la ves: un mensaje privado sin contestar
// mata la conversación, y una respuesta que no ves deja el hilo muerto.
// Lo que es interesante pero no urgente (valoraciones, guías nuevas de
// quien sigues) se queda en la campanita: llenar la bandeja con eso es lo
// que hace que la gente se dé de baja de TODO, incluido lo que sí le
// importaba.
//
// `new_follower` es el caso de en medio, y entra con una condición: va
// AGRUPADO por destinatario (clave `follow:<a-quien>`), así que son como
// mucho un correo cada media hora por muchos seguidores que lleguen. Sin
// esa agrupación no estaría aquí.
//
// Quien manda de verdad son los disparadores de
// `supabase-migration-correo-avisos.sql`,
// `supabase-migration-correo-foro.sql` y
// `supabase-migration-correo-seguidores.sql`: esta lista es para pintar
// las casillas del perfil. Si algún día se añade un tipo hay que tocar
// TRES sitios: la migración que lo encola, esta lista, y NOMBRES en
// netlify/functions/baja-correo.mjs.
//
// `private_message` no está en NOTIFICATION_TYPES porque los mensajes no
// pasan por la campanita: tienen su propio icono en la barra.
//
// `forum_mention` tampoco está: en la campanita, que te mencionen llega
// como `forum_reply` con otro título. Por correo sí se separan, porque
// "avísame solo si me llaman por mi nombre" es una preferencia que mucha
// gente quiere y con un solo tipo no se puede expresar.
export const EMAIL_TYPES = {
  private_message: 'Mensajes privados',
  comment_reply: 'Respuestas a tus comentarios',
  forum_reply: 'Respuestas en temas que sigues',
  forum_mention: 'Cuando te mencionan con @tunombre',
  new_follower: 'Seguidores nuevos',
  // Escribir una guía cuesta días, y hasta que el equipo la mira no hay
  // ninguna señal. Estos dos son el final de esa espera: sin correo hay
  // que entrar a la web a mirar por si acaso.
  guide_approved: 'Cuando se aprueba tu guía',
  guide_rejected: 'Cuando tu guía necesita cambios',
  weekly_digest: 'El resumen semanal de la comunidad',
  // Torneos (tanda 223). Hasta ahora estos avisos salían SOLO por push,
  // que en un iPhone sin la web instalada como app no existe: quien se
  // apuntaba a un torneo podía no enterarse ni de que su ronda había
  // empezado. Van en seis casillas y no en una porque no molestan lo
  // mismo — el de la partida llega en mitad del juego y el de la
  // apertura es casi promoción — y quien quiera apagar solo ese puede.
  // A estos NO los encola un disparador de la base sino el barredor
  // (netlify/functions/torneos-barredor.mjs), que es quien se entera de
  // que la ronda ha empezado o el torneo se ha cancelado.
  torneo_partida: 'Tu partida: rival que reporta, mesa resuelta',
  torneo_recordatorio: 'Aviso de que tu torneo va a empezar',
  torneo_cancelado: 'Si se cancela un torneo en el que estás',
  torneo_plaza: 'Cuando la lista de espera te da plaza',
  torneo_ronda: 'Cuando empieza tu ronda',
  // `torneo_apertura` ya no está: desde el 2026-09-02 la apertura de un
  // torneo NO manda correo a nadie (era un email a toda la comunidad
  // por cada torneo que abría — spam). El anuncio queda en campanita y
  // push; los correos de torneos son solo para quien está apuntado. El
  // tipo sigue existiendo en baja-correo.mjs para que el enlace de baja
  // de los correos ya enviados no apague todo lo demás.
  torneo_final: 'Cuando termina un torneo que has jugado',
  torneo_juez: 'Cuando llaman a un juez en un torneo tuyo',
}

// Lo que solo le llega al equipo.
//
// Va en una lista aparte porque no tiene sentido enseñarle a un miembro
// normal una casilla para algo que no va a recibir nunca. Pero el tipo
// SÍ tiene que existir en la baja de un clic
// (netlify/functions/baja-correo.mjs): si no lo reconociera, el enlace
// de "darse de baja" de ese correo le apagaría al del equipo TODOS los
// demás avisos de golpe.
export const EMAIL_TYPES_EQUIPO = {
  guide_submitted: 'Guías nuevas para revisar',
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
    // Y el mismo número, al título de la pestaña: se ve sin estar aquí.
    anotarEnPestania('avisos', unreadCount)
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

  // ── En vivo (tanda 227) ──
  // La campanita era el sitio donde más cantaba que la web no fuera en
  // tiempo real: te escribían y no te enterabas hasta recargar. Ahora
  // la base avisa. Se filtra por destinatario para no recibir los
  // avisos de los demás — la RLS ya lo impediría, pero pedirlo así
  // ahorra que el servidor evalúe y descarte cada uno.
  //
  // Sin sondeo de respaldo aquí a propósito: la campanita ya se refresca
  // sola al abrirla, así que lo peor que puede pasar si el websocket no
  // conecta es exactamente lo de antes de esta tanda.
  const { escuchar } = await import('./vivo.js')
  escuchar({
    nombre: `campanita-${session.user.id}`,
    tablas: [
      { tabla: 'user_notifications', filtro: `recipient_id=eq.${session.user.id}`, evento: 'INSERT' },
    ],
    alCambiar: () => refresh(),
  })
}
