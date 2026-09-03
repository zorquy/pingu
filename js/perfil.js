import { supabase } from './supabase.js'
import { escapeHtml, getInitial, requireAuth, signOut, uploadProfileImage, slugify, uniqueUsername, profileUrl, achievementIconHtml, avatarStyle, applyAvatarTo } from './app.js'
import { icons } from './icons.js'
import { inlineIconHtml } from './content-icon.js'
import { MOSTRAR_PLANES } from './planes.js'
import { getAllAchievements, levelProgress, contributorTier, levelLadderHtml, tierLadderHtml, levelBadgeHtml } from './gamification.js'
import { NOTIFICATION_TYPES, EMAIL_TYPES, EMAIL_TYPES_EQUIPO } from './notifications.js'
import { authorRatingSummary, starsHtml } from './guide-rating.js'
import { sugerenciasPendientes, resolverSugerencia } from './guide-suggestions.js'
import { renderWall } from './wall.js'
import { showToast } from './toast.js'
import { estadoDeGuia, ESTADOS } from './guia-estado.js'

let currentSession = null
let currentProfile = null
let achievementsCache = []

function displayName(profile, fallbackEmail) {
  return profile?.display_name || profile?.username || fallbackEmail || 'Usuario'
}

function applyHeroVisuals(profile, name) {
  const banner = document.getElementById('heroBanner')
  const bannerUrl = profile?.banner_url
  banner.style.background = bannerUrl
    ? `url('${bannerUrl.replace(/'/g, '%27')}') center/cover`
    : profile?.banner_color || 'var(--ice)'

  applyAvatarTo(document.getElementById('heroAvatar'), profile, getInitial(name))
}

async function loadProfile(session) {
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
  currentProfile = profile
  const name = displayName(profile, session.user.email)
  const xp = profile?.total_xp || 0
  const progress = levelProgress(xp)

  applyHeroVisuals(profile, name)

  document.getElementById('heroInfo').innerHTML = `
    <h2>${escapeHtml(name)}${MOSTRAR_PLANES && profile?.is_pro ? ' <span class="badge badge-pro">Pro</span>' : ''}</h2>
    <button type="button" class="profile-level" id="btnLevelInfo">${levelBadgeHtml(progress.level)} ${xp} XP</button>
    <div class="profile-xp-bar">
      <div class="progress-track"><div class="fill" style="width: ${progress.pct}%"></div></div>
      <div class="xp-label">${progress.next ? `${progress.next - xp} XP para el siguiente nivel` : 'Nivel máximo'}</div>
    </div>
    ${profile?.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}`

  document.getElementById('btnLevelInfo').addEventListener('click', () => openModal(levelLadderHtml(xp)))

  return profile
}

async function loadStats(session, profile) {
  const [{ count: completedCount }, { count: approvedGuidesCount }] = await Promise.all([
    supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', session.user.id)
      .eq('status', 'completed'),
    supabase
      .from('guides')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', session.user.id)
      .eq('review_status', 'approved'),
  ])

  // La nota es la de SUS GUÍAS, no una nota puesta a la persona.
  const { media: avgRating, total: totalNotas } = await authorRatingSummary(session.user.id)
  const tier = contributorTier(approvedGuidesCount || 0)

  montarInvitacion(profile).catch(() => {})

  document.getElementById('profileStats').innerHTML = `
    <div class="stat-card">
      <div class="value">${completedCount || 0}</div>
      <div class="label">Cursos completados</div>
    </div>
    <div class="stat-card">
      <div class="value">${profile?.quiz_correct_count || 0}</div>
      <div class="label">Preguntas acertadas</div>
    </div>
    <div class="stat-card">
      <div class="value" style="display:flex; align-items:center; justify-content:center; gap:5px;">${avgRating ? `${icons.star(18)} ${avgRating.toFixed(1)}` : '—'}</div>
      <div class="label">Nota de tus guías (${totalNotas})</div>
    </div>
    <button type="button" class="stat-card" id="btnTierInfo">
      <div class="value" style="display:flex; justify-content:center;">${tier.icon}</div>
      <div class="label">${tier.title}</div>
    </button>
    <div class="stat-card">
      <div class="value" style="display:flex; align-items:center; justify-content:center; gap:5px;">${icons.flame(18)} ${profile?.current_streak || 0}</div>
      <div class="label">Racha (días)</div>
    </div>`

  document.getElementById('btnTierInfo').addEventListener('click', () => openModal(tierLadderHtml(approvedGuidesCount || 0)))
}

function achievementTileHtml(a, unlocked) {
  const isUnlocked = unlocked.includes(a.id)
  return `
      <div class="achievement-tile ${isUnlocked ? '' : 'locked'}">
        <span class="icon rarity-${a.rarity || 'bronze'}">${isUnlocked ? achievementIconHtml(a, 22) : icons.lock(22)}</span>
        <span class="name">${escapeHtml(a.title)}</span>
      </div>`
}

async function loadAchievements(profile) {
  const unlocked = profile?.achievements || []
  const grid = document.getElementById('achievementsGrid')
  achievementsCache = await getAllAchievements()
  document.getElementById('achievementsCount').textContent = `${unlocked.length}/${achievementsCache.length}`
  document.getElementById('heroTrophyCount').textContent = unlocked.length
  grid.innerHTML = achievementsCache.map((a) => achievementTileHtml(a, unlocked)).join('')
}

document.getElementById('btnShowTrophies')?.addEventListener('click', () => {
  const unlocked = currentProfile?.achievements || []
  openModal(`
    <h3>Trofeos (${unlocked.length}/${achievementsCache.length})</h3>
    <div class="achievements-grid">${achievementsCache.map((a) => achievementTileHtml(a, unlocked)).join('')}</div>`)
})

document.getElementById('achievementsToggle')?.addEventListener('click', () => {
  document.getElementById('achievementsAccordion').classList.toggle('open')
})

// La actividad del foro se carga la PRIMERA vez que se abre su pestaña, y
// no al entrar al perfil: son varias consultas y la mayoría de las visitas
// no van a mirarla.
let foroCargado = false
async function cargarForoUnaVez() {
  if (foroCargado || !currentSession) return
  foroCargado = true
  const { pintarActividadDelForo } = await import('./foro-actividad.js')
  await pintarActividadDelForo(document.getElementById('foroActividad'), currentSession.user.id, { esMio: true })
}

// «Mis torneos» (tanda 236): en qué torneos de PokeDoc estás — jugando,
// apuntado o ya jugados con tu puesto. Se carga la primera vez que se
// abre la pestaña, como el foro: son dos consultas que la mayoría de
// visitas al perfil no necesita.
let torneosCargado = false
async function cargarMisTorneosUnaVez() {
  if (torneosCargado || !currentSession) return
  torneosCargado = true
  const caja = document.getElementById('misTorneos')

  const { data: inscripciones, error } = await supabase
    .from('tournament_registrations')
    .select('tournament_id, status')
    .eq('user_id', currentSession.user.id)
  if (error || !inscripciones?.length) {
    caja.innerHTML = `<p class="subtext">Todavía no estás en ningún torneo. Pásate por <a href="/torneos.html">Jugar</a> para apuntarte al próximo.</p>`
    return
  }
  const estadoInscripcion = new Map(inscripciones.map((i) => [i.tournament_id, i.status]))
  const { data: torneos } = await supabase
    .from('tournaments')
    .select('id, slug, name, status, start_at, champion_id, podium')
    .in('id', inscripciones.map((i) => i.tournament_id))
    .order('start_at', { ascending: false })

  const jugando = []
  const apuntado = []
  const jugados = []
  for (const t of torneos || []) {
    const inscrito = estadoInscripcion.get(t.id)
    if (t.status === 'finished') jugados.push(t)
    // «Jugando ahora» es solo lo que se está jugando de verdad (tanda
    // 248). Un torneo con las inscripciones cerradas todavía no ha
    // empezado: sigues APUNTADO a él, aunque ya no se pueda entrar.
    else if (t.status === 'in_progress' && inscrito !== 'dropped') jugando.push(t)
    else if (['registration_open', 'registration_closed'].includes(t.status) && inscrito !== 'dropped') apuntado.push(t)
    // Cancelados y bajas: fuera. Un torneo que no se jugó no es
    // historial de nadie.
  }

  const fila = (t, detalle) => `
    <a class="mis-torneos-fila" href="/torneo?slug=${encodeURIComponent(t.slug)}">
      <span class="mis-torneos-nombre">${escapeHtml(t.name)}</span>
      <span class="subtext">${escapeHtml(String(t.start_at || '').slice(0, 10))}</span>
      ${detalle}
    </a>`
  const puestoDe = (t) => {
    if (t.champion_id === currentSession.user.id) return '<span class="mis-torneos-puesto oro">Campeón</span>'
    const p = Array.isArray(t.podium) ? t.podium.indexOf(currentSession.user.id) : -1
    if (p > 0) return `<span class="mis-torneos-puesto">${p + 1}º</span>`
    return '<span class="mis-torneos-puesto subtext">Jugado</span>'
  }
  const grupo = (titulo, filas) =>
    filas.length ? `<h3 class="mis-torneos-grupo">${titulo}</h3>${filas.join('')}` : ''

  caja.innerHTML =
    grupo('Jugando ahora', jugando.map((t) => fila(t, '<span class="mis-torneos-puesto vivo">En juego</span>'))) +
      grupo('Apuntado', apuntado.map((t) => fila(t, `<span class="mis-torneos-puesto subtext">${estadoInscripcion.get(t.id) === 'waitlisted' ? 'En lista de espera' : 'Inscrito'}</span>`))) +
      grupo('Jugados', jugados.map((t) => fila(t, puestoDe(t)))) ||
    `<p class="subtext">Todavía no estás en ningún torneo. Pásate por <a href="/torneos.html">Jugar</a> para apuntarte al próximo.</p>`
}

// ── Pestañas del perfil ──
document.getElementById('profileTabs')?.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.getElementById('profileTabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
    document.querySelectorAll('.tab-panel[id^="ptab-"]').forEach((p) => p.classList.remove('active'))
    btn.classList.add('active')
    document.getElementById(`ptab-${btn.dataset.ptab}`).classList.add('active')
    if (btn.dataset.ptab === 'foro') cargarForoUnaVez()
    if (btn.dataset.ptab === 'torneos') cargarMisTorneosUnaVez()
  })
})

// Llegar con la pestaña puesta: /perfil.html#torneos, #guides, #foro…
//
// Antes esto solo entendía `#torneos` y cualquier otro hash se ignoraba
// en silencio. Se notó con el aviso de «te sugieren una corrección»
// (tanda 253), que enlaza a `#guides`: pulsabas la campanita, caías en
// el Muro y no había ni rastro de la corrección — PINGU: «me ha llevado
// a mi perfil y ya».
//
// Genérico y no una lista de casos: cualquier pestaña que exista se abre
// por su nombre, así que el siguiente aviso que enlace aquí ya funciona
// sin tocar nada. Se comprueba contra los botones que HAY, que además es
// lo que impide que un hash inventado deje la página sin ninguna
// pestaña activa.
const pestanaDelHash = window.location.hash.replace('#', '')
if (pestanaDelHash) {
  // Se BUSCA entre los botones que hay en vez de meter el texto del
  // hash dentro de un selector. Con un selector habría que escaparlo, y
  // escapar es defenderse de algo que puede colarse; aquí directamente
  // no hay dónde colar nada, que es más barato de leer y no se puede
  // olvidar el día que alguien toque esta línea.
  const boton = [...document.querySelectorAll('#profileTabs .tab-btn')].find((b) => b.dataset.ptab === pestanaDelHash)
  boton?.click()
}

// ── Siguiendo / Seguidores ──
function followChipHtml(p) {
  const name = displayName(p, '')
  const estiloAvatar = avatarStyle(p)
  return `<a class="follow-avatar-chip" href="${profileUrl(p)}"><span class="mini-avatar" style="${estiloAvatar}">${p.avatar_url ? '' : getInitial(name)}</span>${escapeHtml(name)}</a>`
}

let followingCache = []
let followerCache = []

async function loadFollowSummary(session) {
  const [{ data: following }, { data: followers }] = await Promise.all([
    supabase.from('user_follows').select('following_id').eq('follower_id', session.user.id),
    supabase.from('user_follows').select('follower_id').eq('following_id', session.user.id),
  ])

  document.getElementById('followingCount').textContent = following?.length || 0
  document.getElementById('followersCount').textContent = followers?.length || 0

  const followingIds = (following || []).map((f) => f.following_id)
  const followerIds = (followers || []).map((f) => f.follower_id)
  const allIds = [...new Set([...followingIds, ...followerIds])]

  let profilesById = {}
  if (allIds.length > 0) {
    const { data: profiles } = await supabase.from('user_profiles').select('id, display_name, username, avatar_url').in('id', allIds)
    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
  }

  followingCache = followingIds.map((id) => profilesById[id] || { id })
  followerCache = followerIds.map((id) => profilesById[id] || { id })
}

function openFollowListModal(title, list, emptyMessage) {
  openModal(`
    <h3>${title}</h3>
    <div class="follow-avatar-row">${list.length ? list.map(followChipHtml).join('') : `<p class="empty-state">${emptyMessage}</p>`}</div>`)
}

document.getElementById('btnShowFollowing')?.addEventListener('click', () =>
  openFollowListModal('Siguiendo', followingCache, 'Todavía no sigues a nadie.')
)
document.getElementById('btnShowFollowers')?.addEventListener('click', () =>
  openFollowListModal('Seguidores', followerCache, 'Todavía no tienes seguidores.')
)

async function loadCompletedCourses(session) {
  const { data } = await supabase
    .from('user_progress')
    .select('completed_at, guides(title)')
    .eq('user_id', session.user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  const container = document.getElementById('completedCourses')
  if (!data || data.length === 0) {
    container.innerHTML = `<p class="empty-state">Todavía no has completado ningún curso.</p>`
    return
  }

  container.innerHTML = data
    .filter((row) => row.guides)
    .map(
      (row) => `
    <div class="completed-course-row">
      <span>${escapeHtml(row.guides.title)}</span>
      <span class="date">${new Date(row.completed_at).toLocaleDateString('es-ES')}</span>
    </div>`
    )
    .join('')
}

// ── Foto y banner ──
document.getElementById('btnEditBanner')?.addEventListener('click', (e) => {
  e.stopPropagation()
  document.getElementById('bannerFileInput').click()
})
document.getElementById('btnEditAvatar')?.addEventListener('click', (e) => {
  e.stopPropagation()
  document.getElementById('avatarFileInput').click()
})

document.getElementById('bannerFileInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const url = await uploadProfileImage(currentSession.user.id, file, 'banner')
    await supabase.from('user_profiles').update({ banner_url: url }).eq('id', currentSession.user.id)
    currentProfile = { ...currentProfile, banner_url: url }
    applyHeroVisuals(currentProfile, displayName(currentProfile, currentSession.user.email))
  } catch (err) {
    showToast('No se pudo subir la imagen: ' + err.message)
  }
})

document.getElementById('avatarFileInput')?.addEventListener('change', async (e) => {
  const file = e.target.files[0]
  e.target.value = ''
  if (!file) return
  try {
    const url = await uploadProfileImage(currentSession.user.id, file, 'avatar')
    await supabase.from('user_profiles').update({ avatar_url: url }).eq('id', currentSession.user.id)
    currentProfile = { ...currentProfile, avatar_url: url }
    applyHeroVisuals(currentProfile, displayName(currentProfile, currentSession.user.email))
  } catch (err) {
    showToast('No se pudo subir la imagen: ' + err.message)
  }
})

// ── Mis guías ──
let myGuidesCache = []

// Cómo le va a cada guía: lecturas, guardados, comentarios, valoración y
// agradecimientos.
//
// POR QUÉ ESTO IMPORTA: `guides.view_count` se lleva incrementando en
// cada visita desde siempre, y no se enseñaba en ningún sitio. El autor
// no sabía si su guía la habían leído 3 personas o 300. Escribir era
// tirar algo a un pozo, y eso es lo que hace que nadie escriba la
// segunda.
//
// Los números salen de la función `guide_author_stats` de
// supabase-migration-recompensas-autor.sql: una sola consulta, y con la
// comprobación de que quien pregunta es el autor hecha en la base.
async function loadGuideStats(userId) {
  const { data, error } = await supabase.rpc('guide_author_stats', { p_author: userId })
  // Sin la migración puesta, simplemente no hay números. El resto del
  // panel funciona igual.
  if (error) return {}
  return Object.fromEntries((data || []).map((r) => [r.guide_id, r]))
}

function statsHtml(s) {
  if (!s) return ''
  const publicada = !!s.published_at
  if (!publicada) return ''

  // Con todo a cero no se pinta nada. Enseñarle "0 lecturas · 0
  // guardados" a alguien que acaba de publicar desanima más que no poner
  // nada; en cuanto haya una lectura, aparece.
  const total = (s.lecturas || 0) + Number(s.guardados || 0) + Number(s.comentarios || 0) + Number(s.agradecimientos || 0)
  if (total === 0) {
    return `<p class="my-guide-stats my-guide-stats-vacio">Publicada hace poco — todavía no ha pasado nada por aquí.</p>`
  }

  const trozo = (n, uno, varios) => (Number(n) > 0 ? `<span><strong>${n}</strong> ${Number(n) === 1 ? uno : varios}</span>` : '')
  return `
    <p class="my-guide-stats">
      ${trozo(s.lecturas, 'lectura', 'lecturas')}
      ${trozo(s.agradecimientos, 'gracias', 'gracias')}
      ${trozo(s.guardados, 'guardado', 'guardados')}
      ${trozo(s.comentarios, 'comentario', 'comentarios')}
      ${s.nota ? `<span>${starsHtml(Number(s.nota), 12)} <strong>${s.nota}</strong></span>` : ''}
    </p>`
}

async function loadMyGuides(session) {
  const [{ data }, stats] = await Promise.all([
    supabase
      .from('guides')
      // `published_at` hace falta para no volver a decir "Publicada" de
      // algo que no lo está: `review_status` solo no lo sabe.
      .select('id, title, slug, cover_emoji, review_status, published_at, rejection_reason, categories(name)')
      .eq('author_id', session.user.id)
      .order('submitted_at', { ascending: false, nullsFirst: false }),
    loadGuideStats(session.user.id),
  ])

  myGuidesCache = data || []
  // Lo que le han sugerido corregir. Se pide de una vez para todas sus
  // guías; sin la migración puesta devuelve vacío y no se enseña nada.
  const sugerencias = await sugerenciasPendientes(myGuidesCache.map((g) => g.id)).catch(() => ({}))
  const container = document.getElementById('myGuidesList')

  if (myGuidesCache.length === 0) {
    // El enlace a las peticiones va justo aquí, y no en un menú: quien
    // mira este panel vacío es exactamente quien se ha planteado escribir
    // algo y no sabe de qué.
    container.innerHTML = `<p class="empty-state">Todavía no has creado ninguna guía. Anímate a compartir lo que sabes.<br>
      ¿No sabes de qué? <a href="/usuarios.html#peticiones">Mira lo que está pidiendo la gente</a>.</p>`
    return
  }

  container.innerHTML = myGuidesCache
    .map((g) => {
      const status = estadoDeGuia(g)
      // Editar y borrar dejaron de ir juntos. Una guía en revisión SÍ se
      // puede seguir editando —terminarla no puede depender de que el
      // equipo la rechace— pero no se puede borrar: está en la cola de
      // alguien, y que desaparezca mientras la están leyendo es peor que
      // tener que pedir que la quiten. La política de RLS dice lo mismo
      // (ver supabase-migration-editar-en-revision.sql).
      //
      // Y una PUBLICADA también, desde el 10 de agosto: si no, su autor
      // no puede ni corregir una errata, y tampoco puede sugerir una
      // corrección (ese formulario se le esconde al autor). Borrarla
      // sigue sin poder ser: la gente la tiene guardada y puede estar
      // enlazada desde fuera.
      const canEdit = ['draft', 'rejected', 'pending', 'approved'].includes(g.review_status)
      const canDelete = g.review_status === 'draft' || g.review_status === 'rejected'
      return `
      <div class="my-guide-row">
        <span class="my-guide-title" title="${escapeHtml(g.title || 'Sin título')}">${inlineIconHtml(g.cover_emoji, 16, 'bookOpen')}${escapeHtml(g.title || 'Sin título')}</span>
        <span class="badge ${status.clase}">${escapeHtml(status.texto)}</span>
        <span class="my-guide-actions">
          ${
            // "Ver" para todas, publicadas o no. Una guía sin publicar no
            // tiene tarjeta en ninguna parte de la web, así que sin este
            // enlace no había forma de abrirla ni para releerla.
            g.slug
              ? `<a class="my-guide-ver" href="/guia?slug=${encodeURIComponent(g.slug)}">${status === ESTADOS.publicada ? 'Ver' : 'Vista previa'}</a>`
              : ''
          }
          ${canEdit ? `<button data-edit="${g.id}">Editar</button>` : ''}
          ${canDelete ? `<button class="danger" data-delete="${g.id}">Eliminar</button>` : ''}
        </span>
        ${g.review_status === 'rejected' && g.rejection_reason ? `<p class="my-guide-reason">Motivo del rechazo: ${escapeHtml(g.rejection_reason)}</p>` : ''}
        ${statsHtml(stats[g.id])}
        ${
          (sugerencias[g.id] || []).length
            ? `<button type="button" class="my-guide-sugerencias" data-sugerencias="${g.id}">
                 ${icons.flag(13)} ${sugerencias[g.id].length} ${sugerencias[g.id].length === 1 ? 'corrección sugerida' : 'correcciones sugeridas'}
               </button>`
            : ''
        }
      </div>`
    })
    .join('')

  container.querySelectorAll('[data-sugerencias]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const guia = myGuidesCache.find((g) => g.id === btn.dataset.sugerencias)
      abrirSugerencias(guia, sugerencias[btn.dataset.sugerencias] || [], session)
    })
  )

  // Si has llegado desde la campanita, el panel se abre solo: el aviso
  // era de UNA corrección concreta y hacerte buscarla entre tus guías es
  // dejar el trabajo a medias (tanda 253).
  //
  // Va aquí, al final de pintar, porque necesita la guía ya cargada. Y
  // se limpia el parámetro de la URL: si no, recargar volvería a abrir
  // el panel de algo que a lo mejor ya has resuelto.
  const pedida = new URLSearchParams(window.location.search).get('sugerencias')
  if (pedida && (sugerencias[pedida] || []).length) {
    const guia = myGuidesCache.find((g) => g.id === pedida)
    if (guia) {
      abrirSugerencias(guia, sugerencias[pedida], session)
      const limpia = new URL(window.location.href)
      limpia.searchParams.delete('sugerencias')
      window.history.replaceState({}, '', limpia)
    }
  }

  container.querySelectorAll('[data-edit]').forEach((btn) =>
    btn.addEventListener('click', () => (window.location.href = `editor-guia.html?id=${btn.dataset.edit}`))
  )
  container.querySelectorAll('[data-delete]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta guía? No se puede deshacer.')) return
      await supabase.from('guides').delete().eq('id', btn.dataset.delete)
      loadMyGuides(currentSession)
    })
  )
}

// Revisar las correcciones que te han sugerido.
//
// "Aceptar" NO cambia el texto de la guía: quiere decir "tienes razón y
// ya lo he arreglado". Por eso el botón lo dice así y no "aplicar" — que
// haría pensar que el cambio se hace solo.
function abrirSugerencias(guia, lista, session) {
  if (!guia) return
  const overlay = document.createElement('div')
  overlay.className = 'modal-overlay'
  overlay.innerHTML = `
    <div class="modal-box modal-box-wide" role="dialog" aria-modal="true" aria-label="Correcciones sugeridas">
      <button type="button" class="modal-close" data-cerrar aria-label="Cerrar">×</button>
      <h3>Correcciones sugeridas</h3>
      <p class="subtext">En <strong>${escapeHtml(guia.title || 'tu guía')}</strong>. Aceptar no cambia el texto —
        quiere decir "tienes razón, ya lo he arreglado", y acredita a quien avisó.</p>
      <div id="listaSugerencias"></div>
    </div>`
  document.body.appendChild(overlay)

  const cerrar = () => overlay.remove()
  overlay.querySelector('[data-cerrar]').addEventListener('click', cerrar)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) cerrar()
  })
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') {
      cerrar()
      document.removeEventListener('keydown', esc)
    }
  })

  const lista_el = overlay.querySelector('#listaSugerencias')
  const pintar = () => {
    if (lista.length === 0) {
      lista_el.innerHTML = `<p class="empty-state">No queda ninguna pendiente.</p>`
      return
    }
    lista_el.innerHTML = lista
      .map(
        (s) => `
      <div class="sugerencia-item" data-id="${s.id}">
        ${s.quote ? `<p class="sugerencia-cita">“${escapeHtml(s.quote)}”</p>` : ''}
        <p class="sugerencia-cuerpo">${escapeHtml(s.body)}</p>
        <div class="sugerencia-item-acciones">
          <button type="button" class="btn-primary" data-aceptar="${s.id}">Aceptar</button>
          <button type="button" class="btn-secondary" data-descartar="${s.id}">Descartar</button>
        </div>
      </div>`
      )
      .join('')

    lista_el.querySelectorAll('[data-aceptar], [data-descartar]').forEach((btn) =>
      btn.addEventListener('click', async () => {
        const id = btn.dataset.aceptar || btn.dataset.descartar
        const acepta = !!btn.dataset.aceptar
        const s = lista.find((x) => x.id === id)
        btn.disabled = true
        const { error } = await resolverSugerencia(s, acepta, guia.title, guia.slug)
        if (error) {
          btn.disabled = false
          showToast('No se ha podido guardar: ' + error.message)
          return
        }
        lista.splice(lista.indexOf(s), 1)
        showToast(acepta ? 'Aceptada. Se le ha avisado y aparece acreditado en la guía.' : 'Descartada.', 'success')
        pintar()
        if (lista.length === 0) loadMyGuides(session)
      })
    )
  }
  pintar()
}

const modal = document.getElementById('profileModal')
const modalContent = document.getElementById('profileModalContent')

function openModal(html) {
  modalContent.innerHTML = html
  modal.classList.remove('hidden')
}

function closeModal() {
  modal.classList.add('hidden')
  modalContent.innerHTML = ''
}

document.getElementById('profileModalClose')?.addEventListener('click', closeModal)
modal?.addEventListener('click', (e) => {
  if (e.target === modal) closeModal()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modal?.classList.contains('hidden')) closeModal()
})

document.getElementById('btnNewMyGuide')?.addEventListener('click', () => (window.location.href = 'editor-guia.html'))

// ── Editar biografía ──
document.getElementById('btnEditProfile')?.addEventListener('click', () => {
  const BANNER_COLORS = ['var(--ice)', 'var(--navy)', 'var(--indigo)', 'var(--success)', 'var(--warning)', 'var(--pink)']
  const unlocked = currentProfile?.achievements || []
  const unlockedAchievements = achievementsCache.filter((a) => unlocked.includes(a.id))

  openModal(`
    <h3>Editar perfil</h3>
    <div class="form-group">
      <label>Nombre visible</label>
      <input id="peDisplayName" value="${escapeHtml(currentProfile?.display_name || '')}" placeholder="Cómo quieres que te vean" />
    </div>
    <div class="form-group">
      <label>Nombre de usuario (para tu enlace público)</label>
      <input id="peUsername" value="${escapeHtml(currentProfile?.username || '')}" placeholder="tu-nombre-de-usuario" />
      <p class="subtext" id="peUsernamePreview" style="margin:0;"></p>
      <p class="subtext" id="peUsernameError" style="margin:0; color:#dc2626; display:none;">Ese nombre de usuario ya está en uso, prueba con otro.</p>
    </div>
    <div class="form-group"><label>Sobre ti</label><textarea id="peBio" placeholder="Cuéntanos algo sobre ti...">${escapeHtml(currentProfile?.bio || '')}</textarea></div>
    <div class="form-group">
      <label>Firma del foro</label>
      <p class="subtext" style="margin:0 0 6px;">Sale al pie de tus mensajes del foro. El mismo editor que los mensajes:
      texto con formato, enlaces o una imagen — con límites: 240 letras, y en el foro la firma se recorta a su altura
      (si pones más, dentro de la firma se hace scroll).</p>
      <div class="rte-wrap rte-compacta">
        <div class="rte-toolbar" id="firmaBarra"></div>
        <div class="rte-surface" id="firmaCuerpo"></div>
      </div>
    </div>
    ${
      // Este color es el de la CABECERA (el banner), no el del avatar. Si
      // ya hay una imagen de banner subida no pinta nada, así que ni se
      // enseña: era la parte del formulario que más confundía.
      currentProfile?.banner_url
        ? ''
        : `<div class="form-group">
      <label>Color de tu cabecera</label>
      <p class="subtext" style="margin:0 0 6px;">Se usa mientras no subas una imagen de cabecera.</p>
      <div class="color-swatch-row" id="peBannerSwatches">
        ${BANNER_COLORS.map((c) => `<span class="color-swatch ${c === (currentProfile?.banner_color || 'var(--ice)') ? 'selected' : ''}" data-color="${c}" style="background:${c}"></span>`).join('')}
      </div>
    </div>`
    }
    <div class="form-group">
      <label>Logro destacado en tu perfil</label>
      <select id="peShowcase">
        <option value="">Ninguno</option>
        ${unlockedAchievements.map((a) => `<option value="${a.id}" ${a.id === currentProfile?.showcase_achievement ? 'selected' : ''}>${escapeHtml(a.title)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Avisos en la campanita</label>
      ${Object.entries(NOTIFICATION_TYPES)
        .map(([type, label]) => {
          const disabled = (currentProfile?.notification_prefs_disabled || []).includes(type)
          return `<label class="checkbox-row"><input type="checkbox" data-notif-pref="${type}" ${disabled ? '' : 'checked'} /> ${escapeHtml(label)}</label>`
        })
        .join('')}
    </div>
    <div class="form-group">
      <label>Avisos por correo</label>
      <p class="subtext" style="margin:0 0 6px;">Solo te escribimos cuando alguien se dirige a ti directamente. Aunque lo desactives, lo seguirás viendo al entrar en la web.</p>
      ${Object.entries({
        ...EMAIL_TYPES,
        // Los del equipo solo se le enseñan al equipo: al resto le
        // saldría una casilla para algo que no va a recibir nunca.
        ...(currentProfile?.is_admin ? EMAIL_TYPES_EQUIPO : {}),
      })
        .map(([type, label]) => {
          const disabled = (currentProfile?.notification_email_disabled || []).includes(type)
          return `<label class="checkbox-row"><input type="checkbox" data-email-pref="${type}" ${disabled ? '' : 'checked'} /> ${escapeHtml(label)}</label>`
        })
        .join('')}
    </div>
    <div class="form-group">
      <label>Avisos en este dispositivo (push)</label>
      <p class="subtext" style="margin:0 0 6px;">Los avisos de la campanita, en el escritorio o el móvil aunque PokeDoc esté cerrado. Se activa POR dispositivo: este interruptor manda solo en el navegador donde lo toques.</p>
      <div id="pePushZona"><p class="subtext">Comprobando este navegador…</p></div>
    </div>
    <div class="form-group">
      <label>Cumpleaños (opcional)</label>
      <input type="date" id="peBirthday" value="${escapeHtml(currentProfile?.birthday || '')}" />
      <p class="subtext" style="margin:2px 0 0;">Si lo pones, el día señalado el foro te felicita en «El foro en números». Bórralo cuando quieras.</p>
    </div>
    <div class="form-group">
      <label>Privacidad</label>
      <label class="checkbox-row"><input type="checkbox" id="peHideActivity" ${currentProfile?.hide_activity ? 'checked' : ''} /> No mostrar mi actividad en Comunidad</label>
      <p class="subtext" style="margin:2px 0 0;">Si lo activas, lo que leas y los cursos que hagas dejan de aparecer en el hilo de actividad y dejan de ser visibles para el resto.</p>
    </div>
    <button class="btn-primary btn-block" id="btnSaveProfileEdit">Guardar</button>`)

  // La firma usa el MISMO editor que los mensajes del foro (a demanda:
  // casi nadie que edita su perfil va a tocar la firma). Los límites de
  // verdad no están aquí: el saneador al guardar, la restricción de la
  // base y el recorte de altura del CSS en el foro.
  let firmaHtml = currentProfile?.forum_signature || ''
  ;(async () => {
    try {
      const { richTextToolbarHtml, initRichTextEditor } = await import('./richtext-editor.js')
      const { uploadGuideImage } = await import('./app.js')
      const barra = document.getElementById('firmaBarra')
      const superficie = document.getElementById('firmaCuerpo')
      if (!barra || !superficie) return
      barra.innerHTML = richTextToolbarHtml()
      initRichTextEditor({
        toolbarEl: barra,
        surfaceEl: superficie,
        initialHtml: firmaHtml,
        placeholder: 'Ej: Busco cartas de Lugia · Colecciono desde el 99',
        onChange: (html) => {
          firmaHtml = html
        },
        uploadImage: (file) => uploadGuideImage(currentSession.user.id, file),
      })
    } catch {}
  })()

  // El interruptor de push, con su estado real. Va aparte del Guardar
  // del formulario: suscribirse pide permiso al navegador y escribe su
  // propia fila — no es un campo del perfil.
  ;(async () => {
    const zona = document.getElementById('pePushZona')
    if (!zona) return
    try {
      const push = await import('./push.js')
      const pintarZona = async () => {
        const { soportado, permiso, suscrito } = await push.estadoPush()
        if (!soportado) {
          zona.innerHTML = `<p class="subtext">Este navegador no soporta notificaciones push.</p>`
          return
        }
        if (permiso === 'denied' && !suscrito) {
          zona.innerHTML = `<p class="subtext">Las notificaciones están bloqueadas para PokeDoc en los ajustes del navegador. Desbloquéalas ahí y vuelve.</p>`
          return
        }
        zona.innerHTML = `<button type="button" class="btn-secondary" id="btnPushToggle">${
          suscrito ? 'Desactivar los avisos en este dispositivo' : 'Activar los avisos en este dispositivo'
        }</button>`
        document.getElementById('btnPushToggle').addEventListener('click', async () => {
          const r = suscrito ? await push.desactivarPush() : await push.activarPush(currentSession.user.id)
          if (r.ok) showToast(suscrito ? 'Avisos desactivados en este dispositivo.' : '¡Hecho! Te avisaremos por aquí.', 'success')
          else showToast(r.motivo || 'No se ha podido cambiar.')
          await pintarZona()
        })
      }
      await pintarZona()
    } catch {
      zona.innerHTML = `<p class="subtext">No se ha podido comprobar el estado de los avisos.</p>`
    }
  })()

  let selectedBanner = currentProfile?.banner_color || 'var(--ice)'
  modalContent.querySelectorAll('.color-swatch').forEach((sw) =>
    sw.addEventListener('click', () => {
      modalContent.querySelectorAll('.color-swatch').forEach((s) => s.classList.remove('selected'))
      sw.classList.add('selected')
      selectedBanner = sw.dataset.color
    })
  )

  const usernameInput = document.getElementById('peUsername')
  const usernamePreview = document.getElementById('peUsernamePreview')
  function updateUsernamePreview() {
    // El dominio sale de dónde estás, no escrito a mano: si no, la vista
    // previa enseñaba el subdominio de Netlify aunque estuvieras en
    // pokedoc.es.
    usernamePreview.textContent = `${window.location.host}/usuario/${slugify(usernameInput.value) || '…'}`
  }
  updateUsernamePreview()
  usernameInput.addEventListener('input', updateUsernamePreview)

  document.getElementById('btnSaveProfileEdit').addEventListener('click', async () => {
    const usernameError = document.getElementById('peUsernameError')
    usernameError.style.display = 'none'

    const desiredUsername = slugify(usernameInput.value) || currentProfile?.username
    if (desiredUsername !== currentProfile?.username) {
      const { data: taken } = await supabase.from('user_profiles').select('id').ilike('username', desiredUsername).neq('id', currentSession.user.id).maybeSingle()
      if (taken) {
        usernameError.style.display = 'block'
        return
      }
    }

    const notificationPrefsDisabled = Array.from(modalContent.querySelectorAll('[data-notif-pref]'))
      .filter((cb) => !cb.checked)
      .map((cb) => cb.dataset.notifPref)

    // Columna aparte de la campanita: "quiero el aviso pero no el correo"
    // es la preferencia más común y con un solo array no se puede decir.
    const notificationEmailDisabled = Array.from(modalContent.querySelectorAll('[data-email-pref]'))
      .filter((cb) => !cb.checked)
      .map((cb) => cb.dataset.emailPref)

    const payload = {
      display_name: document.getElementById('peDisplayName').value.trim() || null,
      username: desiredUsername,
      bio: document.getElementById('peBio').value.trim(),
      banner_color: selectedBanner,
      showcase_achievement: document.getElementById('peShowcase').value || null,
      notification_prefs_disabled: notificationPrefsDisabled,
      notification_email_disabled: notificationEmailDisabled,
      hide_activity: document.getElementById('peHideActivity').checked,
    }

    // La firma se guarda SANEADA, con el mismo saneador que los mensajes
    // del foro: lo que entra aquí acaba pintado en cada mensaje de esa
    // persona. Y con dos topes que avisan en vez de recortar en silencio:
    // el texto visible (240 letras) y el HTML entero (1.000, que también
    // impone la base) — una imagen del editor ya ocupa unos 150.
    const { sanitizeRichText } = await import('./richtext-format.js')
    const firmaLimpia = sanitizeRichText(firmaHtml || '')
    const firmaTexto = firmaLimpia.replace(/<[^>]*>/g, '').trim()
    if (firmaTexto.length > 240) {
      showToast('La firma es demasiado larga: 240 letras como mucho.')
      return
    }
    if (firmaLimpia.length > 1000) {
      showToast('La firma es demasiado grande. Con una imagen y una línea de texto va sobrada.')
      return
    }
    payload.forum_signature = firmaTexto || /<img|<tcg/.test(firmaLimpia) ? firmaLimpia : null
    // El cumpleaños es opcional: vacío = quitarlo (null).
    payload.birthday = document.getElementById('peBirthday')?.value || null
    // Si una columna aún no existe (la web desplegada antes de ejecutar
    // su migración — forum_signature o birthday), el update falla ENTERO:
    // se reintenta quitando la columna que el error nombra, las veces
    // que haga falta, para no bloquear el resto del perfil.
    let intento = { ...payload }
    let { error } = await supabase.from('user_profiles').update(intento).eq('id', currentSession.user.id)
    for (const columna of ['forum_signature', 'birthday']) {
      if (error && new RegExp(columna).test(error.message || '')) {
        delete intento[columna]
        ;({ error } = await supabase.from('user_profiles').update(intento).eq('id', currentSession.user.id))
      }
    }
    if (error) {
      showToast('No se pudo guardar el perfil: ' + error.message)
      return
    }
    closeModal()
    currentProfile = { ...currentProfile, ...payload }
    loadProfile(currentSession)
  })
})

async function loadWall(session) {
  await renderWall({
    listEl: document.getElementById('commentsList'),
    formEl: document.getElementById('commentForm'),
    profileId: session.user.id,
    currentSession: session,
  })
}

async function loadAccountDeletionStatus(session) {
  const { data } = await supabase
    .from('account_deletion_requests')
    .select('status')
    .eq('user_id', session.user.id)
    .eq('status', 'pending')
    .maybeSingle()

  const btn = document.getElementById('btnRequestAccountDeletion')
  const statusEl = document.getElementById('deleteAccountStatus')
  if (data) {
    btn.classList.add('hidden')
    statusEl.textContent = 'Ya tienes una solicitud de borrado pendiente de revisión.'
  } else {
    btn.classList.remove('hidden')
    statusEl.textContent = ''
  }
}

async function init() {
  const session = await requireAuth()
  if (!session) return
  currentSession = session

  // Si se llegó con #torneos, el click de abajo corrió ANTES de tener
  // sesión y la carga se quedó esperando: ahora que la hay, va.
  if (document.getElementById('ptab-torneos')?.classList.contains('active')) cargarMisTorneosUnaVez()

  const profile = await loadProfile(session)
  await Promise.all([loadStats(session, profile), loadCompletedCourses(session), loadMyGuides(session), loadWall(session), loadFollowSummary(session)])
  await loadAchievements(profile)
  await loadAccountDeletionStatus(session)

  document.getElementById('btnLogout').addEventListener('click', signOut)
  document.getElementById('btnRequestAccountDeletion').addEventListener('click', async () => {
    if (
      !confirm(
        'Vas a solicitar el borrado de tu cuenta y de tus datos. No se borra al instante — el equipo lo revisa y lo confirma a mano. ¿Continuar?'
      )
    )
      return
    const { error } = await supabase.from('account_deletion_requests').insert({ user_id: session.user.id, status: 'pending' })
    showToast(error ? 'No se pudo enviar la solicitud: ' + error.message : 'Solicitud enviada. Te confirmaremos cuando esté procesada.', error ? 'error' : 'success')
    if (!error) await loadAccountDeletionStatus(session)
  })
}

init()


// ── Invita a un amigo ──
//
// Tu enlace personal (/r/<usuario>) y cuánta gente ha llegado con él.
// Quien se registre con tu enlace te cuenta como invitado en cuanto
// termina su onboarding, y los trofeos de Embajador llegan solos (los
// comprueba tu propia sesión). Sin la migración de referidos, la
// tarjeta sale igual — solo que el contador no puede contar.
async function montarInvitacion(profile) {
  if (!profile?.username) return
  const stats = document.getElementById('profileStats')
  if (!stats || document.getElementById('panelInvitar')) return

  const enlace = `${window.location.origin}/r/${encodeURIComponent(profile.username)}`
  let traidos = null
  try {
    const { count, error } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', currentSession.user.id)
    if (!error) traidos = count || 0
  } catch {}

  const panel = document.createElement('div')
  panel.className = 'simple-card panel-invitar'
  panel.id = 'panelInvitar'
  panel.innerHTML = `
    <div class="panel-invitar-texto">
      <h3>${icons.users(18)} Invita a un amigo</h3>
      <p class="subtext">Comparte tu enlace: quien se una con él y tú os lleváis trofeos y XP.${
        traidos === null ? '' : ` Has traído a <strong>${traidos}</strong> ${traidos === 1 ? 'persona' : 'personas'}.`
      }</p>
    </div>
    <div class="panel-invitar-enlace">
      <code id="enlaceInvitar">${escapeHtml(enlace)}</code>
      <button type="button" class="btn-secondary" id="btnCopiarInvitar">Copiar</button>
    </div>`
  stats.after(panel)

  document.getElementById('btnCopiarInvitar').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(enlace)
      showToast('Enlace copiado. ¡A repartirlo!', 'success')
    } catch {
      showToast('No se ha podido copiar. Selecciónalo a mano.')
    }
  })
}
