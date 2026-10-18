import { supabase } from './supabase.js'
import { authorRatingSummary } from './guide-rating.js'
import { escapeHtml, getInitial, getSession, getProfile, profileUrl, profileParamsFromLocation, achievementIconHtml, avatarStyle, applyAvatarTo, bannerPorDefecto } from './app.js'
import { urlParaCss } from './html.js'
import { contributorTier, getAllAchievements, levelLadderHtml, tierLadderHtml } from './gamification.js'
import { pintarTorneosDe } from './perfil-torneos.js'
import { lineaDeQuienHtml, medalleroHtml } from './perfil-cabecera.js'
import { showToast } from './toast.js'
import { cifrasHtml, contarCartasYTorneos } from './perfil-cifras.js'
import { createNotification } from './notifications.js'
import { icons } from './icons.js'
import { inlineIconHtml } from './content-icon.js'
import { MOSTRAR_PLANES } from './planes.js'
import { montarPestanias, contarPestania, abrirLaQueTengaAlgo, abrirPestania, vitrinaLista } from './perfil-pestanias.js'
import { atributosDeRango, COLUMNAS_RANGO } from './rangos.js'

const { username: usernameParam, id: idParam } = profileParamsFromLocation()
let profileId = idParam

let currentSession = null
let isViewerAdmin = false
let profile = null
let achievementsCache = []
let followingCache = []
let followerCache = []

async function resolveProfileId() {
  if (profileId) return true
  if (!usernameParam) return false
  const { data } = await supabase.from('user_profiles').select('id').ilike('username', usernameParam).maybeSingle()
  profileId = data?.id || null
  return !!profileId
}

// ── Modal genérico (popups de Siguiendo/Seguidores/Trofeos) ──
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

async function loadHeader() {
  const { data } = await supabase.from('user_profiles').select('*').eq('id', profileId).single()
  profile = data
  if (!profile) return false

  const name = profile.display_name || profile.username || 'Usuario'
  const miga = document.getElementById('migaNombre')
  if (miga) miga.textContent = name
  const xp = profile.total_xp || 0

  document.title = `${name} — PokeDoc`

  const banner = document.getElementById('heroBanner')
  banner.style.background = urlParaCss(profile.banner_url)
    ? `url('${urlParaCss(profile.banner_url)}') center/cover`
    : profile.banner_color || bannerPorDefecto(profile)
  // Sin imagen, 160 px de color liso son 160 px de nada: la cabecera se
  // veía medio vacía y todo lo de debajo empezaba muy abajo. Con foto se
  // quedan los 160 —ahí sí hay algo que enseñar—; sin ella baja a 96.
  banner.classList.toggle('profile-hero-banner-vacio', !profile.banner_url)

  applyAvatarTo(document.getElementById('heroAvatar'), profile, getInitial(name))

  const achievements = await getAllAchievements()
  const showcase = achievements.find((a) => a.id === profile.showcase_achievement)

  document.getElementById('heroInfo').innerHTML = `
    <!-- El nombre es el <h1> de la página desde la tanda 313: era
         la única pantalla del sitio sin ninguno, y el título de una
         ficha de persona es la persona. -->
    <h1>${escapeHtml(name)}${MOSTRAR_PLANES && profile.is_pro ? ' <span class="badge badge-pro">Pro</span>' : ''}</h1>
    ${profile.username ? `<p class="perfil-arroba">@${escapeHtml(profile.username)}</p>` : ''}
    ${lineaDeQuienHtml({ xp, racha: profile.current_streak })}
    ${profile.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}
    ${showcase ? `<div class="achievement-tile perfil-logro-chapa"><span class="icon rarity-${showcase.rarity || 'bronze'}">${achievementIconHtml(showcase, 16)}</span><span class="name">${escapeHtml(showcase.title)}</span></div>` : ''}`

  document.getElementById('btnLevelInfo').addEventListener('click', () => openModal(levelLadderHtml(xp)))

  return true
}

async function loadReputationAndGuides() {
  const { count: approvedCount } = await supabase
    .from('guides')
    .select('*', { count: 'exact', head: true })
    .eq('author_id', profileId)
    .eq('review_status', 'approved')

  // La nota es la que ha sacado lo que ESCRIBE, no una nota puesta a la
  // persona: eso último se quitó (ver SCHEMA.md).
  const { media: avgRating, total: totalNotas } = await authorRatingSummary(profileId)

  const tier = contributorTier(approvedCount || 0)

  // Las cifras (867), las mismas que en tu perfil; Guías y Torneos abren
  // su pestaña. Seguidores y siguiendo ya vienen en el HTML.
  const { cartas, torneos } = await contarCartasYTorneos(supabase, profileId)
  const lote = document.getElementById('profileStats')
  lote.innerHTML = cifrasHtml({ cartas, guias: approvedCount ?? null, nota: avgRating, votos: totalNotas, torneos })
  for (const b of lote.querySelectorAll('[data-ver]')) b.addEventListener('click', () => abrirPestania(b.dataset.ver))
  contarPestania('torneos', torneos || 0)

  // El rango NO es una cifra —es un título, con su icono— así que sube
  // a la fila de chapas, junto al nivel, en vez de desentonar entre
  // números.
  // «Miembro» (cero guías) no se enseña: solo cuando hay rango que contar.
  const hueco = document.getElementById('rangoHueco')
  if (hueco && approvedCount > 0) {
    hueco.outerHTML = `<button type="button" class="perfil-rango" id="btnTierInfo">${tier.icon}${escapeHtml(tier.title)}</button>`
    document.getElementById('btnTierInfo').addEventListener('click', () => openModal(tierLadderHtml(approvedCount || 0)))
  } else hueco?.remove()

  const { data: guides } = await supabase
    .from('guides')
    .select('title, slug, cover_emoji, categories(name)')
    .eq('author_id', profileId)
    .eq('review_status', 'approved')
    .order('published_at', { ascending: false })

  contarPestania('guides', approvedCount || 0)

  const container = document.getElementById('publishedGuides')
  if (!guides || guides.length === 0) {
    container.innerHTML = `<p class="empty-state">Todavía no tiene guías publicadas.</p>`
    return
  }
  container.innerHTML = guides
    .map(
      (g) => `
    <a href="/guia/${encodeURIComponent(g.slug)}" class="completed-course-row" style="text-decoration:none; color:inherit;">
      <span>${inlineIconHtml(g.cover_emoji, 16, 'bookOpen')}${escapeHtml(g.title)}</span>
      <span class="date">${escapeHtml(g.categories?.name || '')}</span>
    </a>`
    )
    .join('')
}

// La actividad del foro se carga la PRIMERA vez que se abre su pestaña, y
// no al entrar al perfil: son varias consultas y la mayoría de las visitas
// no van a mirarla.
let foroCargado = false
async function cargarForoUnaVez() {
  if (foroCargado || !profileId) return
  foroCargado = true
  const { pintarActividadDelForo } = await import('./foro-actividad.js')
  await pintarActividadDelForo(document.getElementById('foroActividad'), profileId, { esMio: false })
}

// Los torneos (867, js/perfil-torneos.js): el palmarés y en cuáles está,
// la primera vez que se abre la pestaña.
let torneosCargado = false
async function cargarTorneosUnaVez() {
  if (torneosCargado || !profileId) return
  torneosCargado = true
  await pintarTorneosDe(document.getElementById('misTorneos'), { userId: profileId, propia: false, logros: profile?.achievements || [] })
}

// ── Pestañas del perfil (tanda 308: en js/perfil-pestanias.js) ──
montarPestanias({
  alAbrir: (cual) => {
    if (cual === 'foro') cargarForoUnaVez()
    if (cual === 'torneos') cargarTorneosUnaVez()
  },
})

// ── Mensaje privado ──
function loadMessageButton() {
  const btn = document.getElementById('btnMessageUser')
  if (!currentSession || currentSession.user.id === profileId) {
    btn.classList.add('hidden')
    return
  }
  btn.classList.remove('hidden')
  btn.href = `/mensajes.html?with=${profileId}`
}

// ── Seguir / Dejar de seguir ──
async function loadFollowButton() {
  const btn = document.getElementById('btnFollowToggle')
  if (!currentSession || currentSession.user.id === profileId) {
    btn.classList.add('hidden')
    return
  }
  btn.classList.remove('hidden')

  const { data } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('follower_id', currentSession.user.id)
    .eq('following_id', profileId)
    .maybeSingle()

  let isFollowing = !!data
  function render() {
    btn.textContent = isFollowing ? 'Dejar de seguir' : '+ Seguir'
    btn.classList.toggle('btn-primary', !isFollowing)
    btn.classList.toggle('btn-outline', isFollowing)
  }
  render()

  btn.onclick = async () => {
    btn.disabled = true
    if (isFollowing) {
      await supabase.from('user_follows').delete().eq('follower_id', currentSession.user.id).eq('following_id', profileId)
    } else {
      await supabase.from('user_follows').insert({ follower_id: currentSession.user.id, following_id: profileId })
      const follower = await getProfile(currentSession.user.id)
      await createNotification({
        recipientId: profileId,
        actorId: currentSession.user.id,
        type: 'new_follower',
        title: 'Nuevo seguidor',
        body: follower?.display_name || follower?.username || 'Alguien',
        link: follower ? profileUrl(follower) : '/usuarios.html',
      })
    }
    isFollowing = !isFollowing
    render()
    btn.disabled = false
    await loadFollowSummary()
  }
}

function followChipHtml(p) {
  const name = p.display_name || p.username || 'Usuario'
  const estiloAvatar = avatarStyle(p)
  return `<a class="follow-avatar-chip" href="${profileUrl(p)}"${atributosDeRango(p)}><span class="mini-avatar" style="${estiloAvatar}">${p.avatar_url ? '' : getInitial(name)}</span>${escapeHtml(name)}</a>`
}

function openFollowListModal(title, list, emptyMessage) {
  openModal(`
    <h3>${title}</h3>
    <div class="follow-avatar-row">${list.length ? list.map(followChipHtml).join('') : `<p class="empty-state">${emptyMessage}</p>`}</div>`)
}

document.getElementById('btnShowFollowing')?.addEventListener('click', () =>
  openFollowListModal('Siguiendo', followingCache, 'Todavía no sigue a nadie.')
)
document.getElementById('btnShowFollowers')?.addEventListener('click', () =>
  openFollowListModal('Seguidores', followerCache, 'Todavía no tiene seguidores.')
)

async function loadFollowSummary() {
  const [{ data: following }, { data: followers }] = await Promise.all([
    supabase.from('user_follows').select('following_id').eq('follower_id', profileId),
    supabase.from('user_follows').select('follower_id').eq('following_id', profileId),
  ])

  document.getElementById('followingCount').textContent = following?.length || 0
  document.getElementById('followersCount').textContent = followers?.length || 0

  const followingIds = (following || []).map((f) => f.following_id)
  const followerIds = (followers || []).map((f) => f.follower_id)
  const allIds = [...new Set([...followingIds, ...followerIds])]

  let profilesById = {}
  if (allIds.length > 0) {
    const { data: profiles } = await supabase.from('user_profiles').select(`id, display_name, username, avatar_url, ${COLUMNAS_RANGO}`).in('id', allIds)
    profilesById = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
  }

  followingCache = followingIds.map((id) => profilesById[id] || { id })
  followerCache = followerIds.map((id) => profilesById[id] || { id })
}

// ── Trofeos ──
function achievementTileHtml(a, unlocked) {
  const isUnlocked = unlocked.includes(a.id)
  return `
      <div class="achievement-tile ${isUnlocked ? '' : 'locked'}" data-logro="${escapeHtml(a.id)}">
        <span class="icon rarity-${a.rarity || 'bronze'}">${isUnlocked ? achievementIconHtml(a, 22) : icons.lock(22)}</span>
        <span class="name">${escapeHtml(a.title)}</span>
      </div>`
}

async function loadAchievementsGrid() {
  const unlocked = profile?.achievements || []
  achievementsCache = await getAllAchievements()
  document.getElementById('achievementsCount').textContent = `${unlocked.length} de ${achievementsCache.length}`
  contarPestania('medallas', unlocked.length)
  document.getElementById('achievementsGrid').innerHTML = achievementsCache.map((a) => achievementTileHtml(a, unlocked)).join('')
  import('./logros-reparto.js').then((m) => m.ponerReparto(document.getElementById('achievementsGrid'))).catch(() => {})
}

// El medallero de los cursos (867): sus oros, platas y bronces. Las
// partidas son públicas (salvo actividad oculta), así que se puede contar.
async function loadMedallero() {
  const caja = document.getElementById('medalleroPerfil')
  if (!caja) return
  const { medallasPorCurso } = await import('./medallero.js')
  const html = medalleroHtml(await medallasPorCurso(profileId))
  caja.hidden = !html
  caja.innerHTML = html
}

async function init() {
  const found = await resolveProfileId()
  if (!found) {
    document.querySelector('main').innerHTML = `<p class="empty-state">Usuario no encontrado.</p>`
    return
  }

  currentSession = await getSession()
  isViewerAdmin = currentSession ? !!(await getProfile(currentSession.user.id))?.is_admin : false

  const ok = await loadHeader()
  if (!ok) {
    document.querySelector('main').innerHTML = `<p class="empty-state">Usuario no encontrado.</p>`
    return
  }

  loadMessageButton()
  // «12 cambios · todos bien» (795, NU4): sin cambios o sin la migración, nada.
  import('./cambios-hechos.js').then(async (m) => {
    const t = m.textoDeConfianza(await m.cambiosDe(profile.id))
    if (t) document.getElementById('heroInfo')?.insertAdjacentHTML('beforeend', `<p class="perfil-confianza">${escapeHtml(t)}</p>`)
  }).catch(() => {})
  if (new URLSearchParams(location.search).has('cruce')) {
    import('./cruce-persona.js').then((m) => m.pintarCruce(document.getElementById('perfilCruce'), profile, currentSession)).catch(() => {})
  }
  // Lo que da y lo que busca (887): la pestaña Cambios y la chapa de arriba.
  import('./perfil-cambios.js').then((m) => m.pintarCambiosDe(document.getElementById('perfilCambios'), profile, currentSession)).catch(() => {})
  await Promise.all([loadReputationAndGuides(), loadFollowButton(), loadFollowSummary(), loadAchievementsGrid(), loadMedallero(), contarElForo()])
  if (document.getElementById('ptab-torneos')?.classList.contains('active')) cargarTorneosUnaVez()
  // La vitrina (743), la de esta persona: solo lo que hay.
  // Y su nivel (752): sale si hay algo que enseñar y se abre si tiene cartas.
  import('./vitrina.js')
    .then((m) => m.montarVitrina(document.getElementById('perfilVitrina'), profile?.id || profileId))
    .then((r) => vitrinaLista({ visible: r?.estado === 'ok' && (r.cartas.length > 0), conCartas: r?.estado === 'ok' && r.cartas.length > 0 }))
    .catch(() => vitrinaLista({ visible: false, conCartas: false }))

  // Con las cuentas ya puestas, se abre la que tenga algo — y solo si
  // quien mira no ha tocado nada todavía ni ha llegado con un #hash.
  abrirLaQueTengaAlgo()
}

// La pestaña «Foro» se PINTA con pereza (son varias consultas), pero su
// número hace falta antes: para la chapa y para decidir qué se abre.
async function contarElForo() {
  const { contarActividadDelForo } = await import('./foro-actividad.js')
  contarPestania('foro', await contarActividadDelForo(profileId))
}

init()
