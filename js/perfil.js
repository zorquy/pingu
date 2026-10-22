import { supabase } from './supabase.js'
import { escapeHtml, getInitial, requireAuth, signOut, getProfile, uploadProfileImage, slugify, uniqueUsername, profileUrl, achievementIconHtml, avatarStyle, applyAvatarTo, bannerPorDefecto } from './app.js'
import { urlParaCss } from './html.js'
import { icons } from './icons.js'
import { inlineIconHtml } from './content-icon.js'
import { MOSTRAR_PLANES } from './planes.js'
import { getAllAchievements, contributorTier, levelLadderHtml, tierLadderHtml } from './gamification.js'
import { servidoDeAutor } from './guias-servido.js'
import { sugerenciasPendientes, resolverSugerencia } from './guide-suggestions.js'
import { montarPestanias, contarPestania, abrirLaQueTengaAlgo, abrirPestania, vitrinaLista } from './perfil-pestanias.js'
import { pintarTorneosDe } from './perfil-torneos.js'
import { lineaDeQuienHtml, medalleroHtml } from './perfil-cabecera.js'
import { showToast } from './toast.js'
import { cifrasHtml, contarCartasYTorneos } from './perfil-cifras.js'
import { estadoDeGuia, ESTADOS } from './guia-estado.js'
import { atributosDeRango, COLUMNAS_RANGO } from './rangos.js'

let currentSession = null
let currentProfile = null
let achievementsCache = []

function displayName(profile, fallbackEmail) {
  return profile?.display_name || profile?.username || fallbackEmail || 'Usuario'
}

function applyHeroVisuals(profile, name) {
  const banner = document.getElementById('heroBanner')
  const bannerUrl = profile?.banner_url
  banner.style.background = urlParaCss(bannerUrl)
    ? `url('${urlParaCss(bannerUrl)}') center/cover`
    : profile?.banner_color || bannerPorDefecto(profile)
  // Igual que en la ficha de otro (tanda 263): sin foto, 160 px de color
  // liso son 160 px de nada y empujan todo lo demás hacia abajo. Aquí
  // faltaba — la tuya era la única que seguía con el hueco entero.
  banner.classList.toggle('profile-hero-banner-vacio', !bannerUrl)

  applyAvatarTo(document.getElementById('heroAvatar'), profile, getInitial(name))
}

async function loadProfile(session, { fresco = false } = {}) {
  // El mismo que ya pidió la barra (983), salvo justo después de guardar.
  const profile = await getProfile(session.user.id, { fresco })
  currentProfile = profile
  // «Ajustes» de la hoja «Tú» (748) llega con `?editar=1`: el editor se abre
  // solo, y se quita el parámetro para que recargar no lo vuelva a abrir.
  if (new URLSearchParams(window.location.search).get('editar')) {
    const limpia = new URL(window.location.href)
    limpia.searchParams.delete('editar')
    window.history.replaceState({}, '', limpia)
    setTimeout(() => document.getElementById('btnEditProfile')?.click(), 0)
  }
  const name = displayName(profile, session.user.email)
  const xp = profile?.total_xp || 0

  applyHeroVisuals(profile, name)

  document.getElementById('heroInfo').innerHTML = `
    <!-- El nombre es el <h1> de la página desde la tanda 313: era
         la única pantalla del sitio sin ninguno, y el título de una
         ficha de persona es la persona. -->
    <h1>${escapeHtml(name)}${MOSTRAR_PLANES && profile?.is_pro ? ' <span class="badge badge-pro">Pro</span>' : ''}</h1>
    ${profile?.username ? `<p class="perfil-arroba">@${escapeHtml(profile?.username)}</p>` : ''}
    ${lineaDeQuienHtml({ xp, racha: profile?.current_streak })}
    ${profile?.bio ? `<p class="profile-bio">${escapeHtml(profile.bio)}</p>` : ''}`

  document.getElementById('btnLevelInfo').addEventListener('click', () => openModal(levelLadderHtml(xp)))

  return profile
}

async function loadStats(session, profile) {
  // A cuántos les han servido SUS GUÍAS (974), no una nota puesta a la
  // persona; a la vez que lo demás (983).
  const [{ count: approvedGuidesCount }, { cartas, torneos }, servido] = await Promise.all([
    supabase
      .from('guides')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', session.user.id)
      .eq('review_status', 'approved'),
    contarCartasYTorneos(supabase, session.user.id),
    servidoDeAutor(session.user.id),
  ])
  const tier = contributorTier(approvedGuidesCount || 0)

  // Las cifras (867): cartas, guías y torneos; seguidores y siguiendo ya
  // vienen en el HTML. Guías y Torneos abren su pestaña.
  const lote = document.getElementById('profileStats')
  lote.innerHTML = cifrasHtml({ cartas, guias: approvedGuidesCount ?? null, servido, torneos, propia: true })
  for (const b of lote.querySelectorAll('[data-ver]')) b.addEventListener('click', () => abrirPestania(b.dataset.ver))

  // El rango NO es una cifra —es un título, con su icono— así que sube
  // a la fila de chapas, junto al nivel, en vez de desentonar entre
  // números.
  // «Miembro» (cero guías) no se enseña: solo cuando hay rango que contar.
  const hueco = document.getElementById('rangoHueco')
  if (hueco && approvedGuidesCount > 0) {
    hueco.outerHTML = `<button type="button" class="perfil-rango" id="btnTierInfo">${tier.icon}${escapeHtml(tier.title)}</button>`
    document.getElementById('btnTierInfo').addEventListener('click', () => openModal(tierLadderHtml(approvedGuidesCount || 0)))
  } else hueco?.remove()
}

function achievementTileHtml(a, unlocked) {
  const isUnlocked = unlocked.includes(a.id)
  return `
      <div class="achievement-tile ${isUnlocked ? '' : 'locked'}" data-logro="${escapeHtml(a.id)}">
        <span class="icon rarity-${a.rarity || 'bronze'}">${isUnlocked ? achievementIconHtml(a, 22) : icons.lock(22)}</span>
        <span class="name">${escapeHtml(a.title)}</span>
      </div>`
}

async function loadAchievements(profile) {
  const unlocked = profile?.achievements || []
  const grid = document.getElementById('achievementsGrid')
  achievementsCache = await getAllAchievements()
  document.getElementById('achievementsCount').textContent = `${unlocked.length} de ${achievementsCache.length}`
  grid.innerHTML = achievementsCache.map((a) => achievementTileHtml(a, unlocked)).join('')
  import('./logros-reparto.js').then((m) => m.ponerReparto(grid)).catch(() => {})
  contarPestania('medallas', unlocked.length)
  // Tu logro destacado (867): el que sale junto a tu nombre en el foro. Se
  // elige en «Editar perfil», y desde aquí se llega.
  const destacado = achievementsCache.find((a) => a.id === profile?.showcase_achievement)
  const linea = document.getElementById('logroDestacado')
  if (linea) {
    linea.hidden = false
    linea.innerHTML = destacado
      ? `<span class="icon rarity-${escapeHtml(destacado.rarity || 'bronze')}">${achievementIconHtml(destacado, 16)}</span><span>Logro destacado: <strong>${escapeHtml(destacado.title)}</strong></span><button type="button" class="link-btn" data-editar-perfil>Cambiar</button>`
      : `<span>Sin logro destacado.</span><button type="button" class="link-btn" data-editar-perfil>Elegir uno</button>`
    linea.querySelector('[data-editar-perfil]').addEventListener('click', () => document.getElementById('btnEditProfile')?.click())
  }
}

// El medallero de los cursos (867), como la píldora de Aprender: tus oros,
// platas y bronces. Sin partidas, sin medallero.
async function loadMedallero(session) {
  const caja = document.getElementById('medalleroPerfil')
  if (!caja) return
  const { medallasPorCurso } = await import('./medallero.js')
  const html = medalleroHtml(await medallasPorCurso(session.user.id))
  caja.hidden = !html
  caja.innerHTML = html
}

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

// Torneos (236; desde la 867 en js/perfil-torneos.js, con el palmarés).
// Se pinta la primera vez que se abre la pestaña.
let torneosCargado = false
async function cargarMisTorneosUnaVez() {
  if (torneosCargado || !currentSession) return
  torneosCargado = true
  await pintarTorneosDe(document.getElementById('misTorneos'), { userId: currentSession.user.id, propia: true, logros: currentProfile?.achievements || [] })
}

// ── Pestañas del perfil ──
// (tanda 308: la mecánica vive en js/perfil-pestanias.js, que comparten
// esta página y la ficha de otra persona.)
montarPestanias({
  propia: true,
  alAbrir: (cual) => {
    if (cual === 'foro') cargarForoUnaVez()
    if (cual === 'torneos') cargarMisTorneosUnaVez()
  },
})

// ── Siguiendo / Seguidores ──
function followChipHtml(p) {
  const name = displayName(p, '')
  const estiloAvatar = avatarStyle(p)
  return `<a class="follow-avatar-chip" href="${profileUrl(p)}"${atributosDeRango(p)}><span class="mini-avatar" style="${estiloAvatar}">${p.avatar_url ? '' : getInitial(name)}</span>${escapeHtml(name)}</a>`
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
    const { data: profiles } = await supabase.from('user_profiles').select(`id, display_name, username, avatar_url, ${COLUMNAS_RANGO}`).in('id', allIds)
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

  // Solo si hay alguno (867): es un historial, no un hueco que llenar.
  const container = document.getElementById('completedCourses')
  if (!data || data.length === 0) return
  container.hidden = false
  container.innerHTML = `<h2 class="section-title">Cursos hechos</h2>` + data
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
      ${Number(s.agradecimientos) > 0 ? `<span>A <strong>${s.agradecimientos}</strong> ${Number(s.agradecimientos) === 1 ? 'le ha' : 'les ha'} servido</span>` : ''}
      ${trozo(s.guardados, 'guardado', 'guardados')}
      ${trozo(s.comentarios, 'comentario', 'comentarios')}
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
    btn.addEventListener('click', () => (window.location.href = `/editor-guia.html?id=${btn.dataset.edit}`))
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
        // La sugerencia se va de la lista YA (899, R6); si la base dice que
        // no, vuelve a su sitio.
        const donde = lista.indexOf(s)
        lista.splice(donde, 1)
        pintar()
        const { error } = await resolverSugerencia(s, acepta, guia.title, guia.slug)
        if (error) {
          lista.splice(donde, 0, s)
          pintar()
          showToast('No se ha podido guardar: ' + error.message, 'error')
          return
        }
        showToast(acepta ? 'Aceptada. Se le ha avisado y aparece acreditado en la guía.' : 'Descartada.', 'success')
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

// ── Editar perfil (867: solo lo que ven los demás) ──
//
// Nombre, usuario, sobre ti, firma del foro, color de cabecera y logro
// destacado. Los avisos, el cumpleaños, Play! Pokémon y la privacidad son
// cómo funciona tu cuenta, no cómo te ven: viven en /ajustes.
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
      <p class="subtext" id="peUsernameError" style="margin:0; color:var(--danger); display:none;">Ese nombre de usuario ya está en uso, prueba con otro.</p>
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
    <p class="subtext">Los avisos, tu cuenta y la privacidad están en <a href="/ajustes">Ajustes</a>.</p>
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

    const payload = {
      display_name: document.getElementById('peDisplayName').value.trim() || null,
      username: desiredUsername,
      bio: document.getElementById('peBio').value.trim(),
      banner_color: selectedBanner,
      showcase_achievement: document.getElementById('peShowcase').value || null,
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
    // Si una columna aún no existe (la web desplegada antes de ejecutar
    // su migración — forum_signature), el update falla ENTERO: se reintenta
    // sin ella para no bloquear el resto del perfil.
    let intento = { ...payload }
    let { error } = await supabase.from('user_profiles').update(intento).eq('id', currentSession.user.id)
    if (error && /forum_signature/.test(error.message || '')) {
      delete intento.forum_signature
      ;({ error } = await supabase.from('user_profiles').update(intento).eq('id', currentSession.user.id))
    }
    if (error) {
      showToast('No se pudo guardar el perfil: ' + error.message)
      return
    }
    closeModal()
    currentProfile = { ...currentProfile, ...payload }
    await loadProfile(currentSession, { fresco: true })
    loadAchievements(currentProfile)
  })
})

// Las dos pestañas que se PINTAN con pereza necesitan su número antes
// de abrirse: para la chapa y para decidir cuál se abre. Son consultas
// de cabecera (`head: true`), sin filas.
async function contarElForo(session) {
  const { contarActividadDelForo } = await import('./foro-actividad.js')
  contarPestania('foro', await contarActividadDelForo(session.user.id))
}

async function contarMisTorneos(session) {
  const { count } = await supabase
    .from('tournament_registrations')
    .select('tournament_id', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
  contarPestania('torneos', count || 0)
}

async function init() {
  const session = await requireAuth()
  if (!session) return
  currentSession = session

  const profile = await loadProfile(session)
  // Lo de abajo solo necesita el perfil, no lo uno de lo otro: todo a la vez
  // (983). Antes los logros esperaban a las cifras, y la vitrina, a los logros.
  // Lo que das y lo que buscas (887): tu pestaña Cambios, siempre.
  import('./perfil-cambios.js').then((m) => m.pintarCambiosDe(document.getElementById('perfilCambios'), { ...(currentProfile || {}), id: session.user.id }, session, { propia: true })).catch(() => {})
  // Debajo, tu colección (944): lo último que has añadido, y si es privada,
  // que lo diga y deje hacerla pública.
  import('./perfil-coleccion.js').then((m) => m.pintarColeccionDe(document.getElementById('perfilColeccion'), { ...(currentProfile || {}), id: session.user.id }, { propia: true, avisar: showToast })).catch(() => {})
  // La vitrina (743): la tuya, con «Elegir cartas»; su pestaña se abre en
  // cuanto existe (867: aunque esté vacía, que invita a elegir).
  import('./vitrina.js')
    .then((m) => m.montarVitrina(document.getElementById('perfilVitrina'), session.user.id, { propia: true, avisar: showToast, usuario: currentProfile?.username || '' }))
    .then((r) => vitrinaLista({ visible: r?.estado === 'ok', conCartas: r?.estado === 'ok' && r.cartas.length > 0 }))
    .catch(() => vitrinaLista({ visible: false, conCartas: false }))
  await Promise.all([
    loadStats(session, profile),
    loadCompletedCourses(session),
    loadMyGuides(session),
    loadFollowSummary(session),
    contarElForo(session),
    contarMisTorneos(session),
    loadMedallero(session),
    loadAchievements(profile),
  ])
  // Si se llegó con la pestaña de torneos puesta, el clic corrió ANTES de
  // tener sesión y la carga se quedó esperando: ahora que la hay, va.
  if (document.getElementById('ptab-torneos')?.classList.contains('active')) cargarMisTorneosUnaVez()
  abrirLaQueTengaAlgo()
}

// Compartir tu perfil (867): la dirección pública, con la hoja del sistema
// donde la hay y al portapapeles donde no.
document.getElementById('btnCompartirPerfil')?.addEventListener('click', async () => {
  const url = new URL(profileUrl(currentProfile || {}), window.location.origin).href
  const name = displayName(currentProfile, '')
  try {
    if (navigator.share) await navigator.share({ title: `${name} en PokeDoc`, url })
    else {
      await navigator.clipboard.writeText(url)
      showToast('Enlace copiado.', 'success')
    }
  } catch {}
})

init()
