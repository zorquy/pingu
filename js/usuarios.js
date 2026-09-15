import { supabase } from './supabase.js'
import { escapeHtml, getInitial, getSession, profileUrl, guideHasReference, avatarStyle } from './app.js'
import { decorateGuideCards, wireGuideCardClicks } from './guide-card.js'
import { calculateLevel, levelBadgeHtml } from './gamification.js'
import { loadActivity, renderActivityHtml } from './activity.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'
import { plegarTexto, contienePlegado } from './texto.js'
import { initPeticiones } from './peticiones.js'

let allUsers = []
// Si hay algo escrito en el buscador: manda el resultado entero, sin
// recortar a diez.
let buscando = false
let allCommunityGuides = []
let communityGuidesPage = 1

const COMMUNITY_GUIDES_PAGE_SIZE = 12

// La tarjeta de persona (tanda 301)
//
// La de antes repetía «Novato · 0 XP» en todas y las tres primeras
// llevaban marco dorado — el mismo marco de color que la 299 quitó de la
// portada. No distinguía a nadie y no decía lo único que de verdad
// importa en una lista de gente: A QUIÉN LE PREGUNTAS. Ahora lo que se
// lee es lo que ha hecho cada uno (guías y mensajes) y su racha si la
// tiene viva.
function userCardHtml(p) {
  const name = p.display_name || p.username || 'Usuario'
  const hizo = []
  if (p.approvedGuidesCount > 0) hizo.push(`${p.approvedGuidesCount} ${p.approvedGuidesCount === 1 ? 'guía' : 'guías'}`)
  if (p.mensajes > 0) hizo.push(`${p.mensajes} ${p.mensajes === 1 ? 'mensaje' : 'mensajes'}`)
  return `
    <div class="com-persona">
      <a class="com-persona-cara" href="${profileUrl(p)}" style="${avatarStyle(p)}" aria-label="${escapeHtml(name)}">${p.avatar_url ? '' : getInitial(name)}</a>
      <div class="com-persona-cuerpo">
        <a class="com-persona-nombre" href="${profileUrl(p)}">${escapeHtml(name)}</a>
        ${levelBadgeHtml(calculateLevel(p.total_xp), 11)}
        <span class="com-persona-hizo">${hizo.length ? escapeHtml(hizo.join(' · ')) : 'Acaba de llegar'}</span>
      </div>
      ${
        p.racha > 0
          ? `<span class="com-persona-racha" title="${p.racha} días seguidos">${icons.flame(12)} ${p.racha}</span>`
          : ''
      }
    </div>`
}

// Cuántas caras se enseñan de entrada (tanda 304).
//
// PINGU: «los usuarios, como ya son 200, hay que scrollear demasiado».
// Y tiene razón: 200 tarjetas son 100 filas de scroll para llegar al pie
// de la página, y las 190 de abajo no las mira nadie — están ordenadas
// por XP, así que quien busca a alguien concreto usa el buscador.
//
// Diez es lo que cabe en una pantalla sin bajar. El resto está a un
// clic y la cuenta va en el botón, para que se vea que hay más y
// cuántos: «Ver los 190 restantes» dice algo, «Ver más» no.
const GENTE_DE_ENTRADA = 10

let genteDesplegada = false

function render(list) {
  const grid = document.getElementById('userDirectoryGrid')
  const empty = document.getElementById('userDirectoryEmpty')
  const pie = document.getElementById('userDirectoryPie')
  if (pie) pie.innerHTML = ''
  if (list.length === 0) {
    grid.innerHTML = ''
    empty.innerHTML = `<p class="empty-state">No hay usuarios que coincidan con tu búsqueda.</p>`
    return
  }
  empty.innerHTML = ''

  // Buscando se ven TODOS los que coinciden: si has escrito un nombre,
  // recortar el resultado a diez y pedirte otro clic es absurdo.
  const recorta = !buscando && !genteDesplegada && list.length > GENTE_DE_ENTRADA
  const visibles = recorta ? list.slice(0, GENTE_DE_ENTRADA) : list
  grid.innerHTML = visibles.map(userCardHtml).join('')

  if (recorta && pie) {
    const faltan = list.length - GENTE_DE_ENTRADA
    pie.innerHTML = `<button type="button" class="btn-secondary com-ver-todos" id="btnVerTodaLaGente">Ver ${faltan} ${
      faltan === 1 ? 'persona más' : 'personas más'
    }</button>`
    document.getElementById('btnVerTodaLaGente').addEventListener('click', () => {
      genteDesplegada = true
      render(list)
    })
  }
}

// ── Los números de la comunidad (tanda 301) ──
//
// Lo primero que se ve al entrar, y lo único que demuestra que aquí hay
// gente: la página lo daba por supuesto y no lo decía en ningún sitio.
// Son cuatro consultas de CUENTA (head: true), así que no se trae ni una
// fila. Cada una se pinta por su cuenta: si una falla, las otras tres
// salen igual — y la que falla se queda con su guion, que es la verdad.
async function cargarCifras() {
  const poner = (id, n) => {
    const e = document.getElementById(id)
    if (e && n != null) e.textContent = new Intl.NumberFormat('es-ES').format(n)
  }
  const desde = new Date(Date.now() - 7 * 86400e3).toISOString()
  const ayer = new Date(Date.now() - 86400e3).toISOString().slice(0, 10)
  const cuenta = async (f) => {
    try {
      const { count, error } = await f()
      return error ? null : count
    } catch {
      return null
    }
  }
  const [miembros, mensajes, guias, rachas] = await Promise.all([
    cuenta(() => supabase.from('user_profiles').select('id', { count: 'exact', head: true })),
    cuenta(() => supabase.from('forum_posts').select('id', { count: 'exact', head: true }).gte('created_at', desde)),
    cuenta(() =>
      supabase.from('guides').select('id', { count: 'exact', head: true }).not('author_id', 'is', null).not('published_at', 'is', null)
    ),
    // Racha VIVA: la de quien entró hoy o ayer. Sin el filtro de fecha se
    // contarían rachas de gente que no aparece desde hace meses, que es
    // justo lo contrario de lo que el número promete.
    cuenta(() =>
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gt('current_streak', 0).gte('last_active_date', ayer)
    ),
  ])
  poner('cifraMiembros', miembros)
  poner('cifraMensajes', mensajes)
  poner('cifraGuias', guias)
  poner('cifraRachas', rachas)
  const chip = document.getElementById('chipGente')
  if (chip && miembros != null) chip.textContent = new Intl.NumberFormat('es-ES').format(miembros)
}

// ── El podio del mes ──
//
// Mismo cálculo que el «Top del mes» de la portada: la XP GANADA desde
// el día 1, que sale de restar la foto de `xp_mes` al total de hoy. Un
// podio por XP TOTAL premiaría a quien lleva aquí más tiempo y no a
// quien está aportando ahora — y entonces no daría motivo a nadie para
// aparecer, que es justo lo que se busca.
//
// Si la tabla no está o nadie ha ganado XP este mes, no sale: un podio
// vacío no es un podio.
async function cargarPodio(perfiles) {
  const hueco = document.getElementById('comPodio')
  if (!hueco || !perfiles?.length) return
  try {
    const hoy = new Date()
    const mes = `${hoy.getUTCFullYear()}-${String(hoy.getUTCMonth() + 1).padStart(2, '0')}-01`
    const { data: fotos, error } = await supabase.from('xp_mes').select('user_id, xp_inicio').eq('mes', mes).limit(2000)
    if (error || !fotos?.length) return
    const inicio = Object.fromEntries(fotos.map((f) => [f.user_id, f.xp_inicio || 0]))
    const tres = perfiles
      .map((p) => ({ p, ganado: Math.max(0, (p.total_xp || 0) - (inicio[p.id] ?? 0)) }))
      .filter((f) => f.ganado > 0)
      .sort((a, b) => b.ganado - a.ganado)
      .slice(0, 3)
    if (!tres.length) return

    const MEDALLAS = ['Oro', 'Plata', 'Bronce']
    const mesLargo = hoy.toLocaleDateString('es-ES', { month: 'long' })
    hueco.innerHTML = `
      <section class="com-podio">
        <span class="com-podio-rotulo">${icons.trophy(14)} El top de ${escapeHtml(mesLargo)}</span>
        <h2>Quién más ha aportado este mes</h2>
        <div class="com-podio-tres">
          ${tres
            .map(
              ({ p, ganado }, i) => `
            <a class="com-puesto com-puesto-${i + 1}" href="${profileUrl(p)}">
              <span class="com-puesto-medalla">${icons.medal(14)} ${MEDALLAS[i]}</span>
              <span class="com-puesto-cara" style="${avatarStyle(p)}">${p.avatar_url ? '' : getInitial(p.display_name || p.username || '?')}</span>
              <span class="com-puesto-nombre">${escapeHtml(p.display_name || p.username || 'Usuario')}</span>
              <span class="com-puesto-xp">+${new Intl.NumberFormat('es-ES').format(ganado)} XP este mes</span>
            </a>`
            )
            .join('')}
        </div>
      </section>`
  } catch {
    // El podio es un extra. Si falla, la lista de gente sale igual.
  }
}

// ── Quién anda por aquí hoy, y lo último que ha pasado ──
async function cargarLateral(perfiles) {
  const hoy = new Date().toISOString().slice(0, 10)
  const activos = (perfiles || []).filter((p) => p.last_active_date === hoy)
  const caja = document.getElementById('comHoy')
  // Se recoge sola si no hay nadie: «0 personas hoy» es peor que no
  // decir nada.
  if (caja && activos.length) {
    const CARAS = 7
    caja.innerHTML = `
      <h3>Por aquí hoy · ${activos.length}</h3>
      <div class="com-monton">
        ${activos
          .slice(0, CARAS)
          .map(
            (p) => `<a class="com-monton-cara" href="${profileUrl(p)}" style="${avatarStyle(p)}" title="${escapeHtml(
              p.display_name || p.username || 'Usuario'
            )}">${p.avatar_url ? '' : getInitial(p.display_name || p.username || '?')}</a>`
          )
          .join('')}
        ${activos.length > CARAS ? `<span class="com-monton-cara com-monton-mas">+${activos.length - CARAS}</span>` : ''}
      </div>
      <a class="btn-secondary com-boton-ancho" href="/foro">Preséntate en el foro</a>`
    caja.classList.remove('hidden')
  }

  const ultimo = document.getElementById('comUltimo')
  if (!ultimo) return
  try {
    const actividad = await loadActivity(5)
    ultimo.innerHTML = actividad.eventos.length
      ? renderActivityHtml(actividad)
      : '<p class="subtext" style="margin:0">Todavía no ha pasado nada por aquí.</p>'
  } catch {
    ultimo.innerHTML = '<p class="subtext" style="margin:0">No hemos podido cargar la actividad.</p>'
  }
}

async function loadUsers() {
  const [{ data }, { data: approvedGuides }, { data: mensajes }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, username, display_name, level, total_xp, avatar_url, banner_color, current_streak, last_active_date')
      .order('total_xp', { ascending: false })
      .limit(200),
    supabase.from('guides').select('author_id').eq('review_status', 'approved').not('author_id', 'is', null),
    // Cuántos mensajes ha escrito cada uno: es la mitad del «qué ha
    // hecho» de la tarjeta. Se trae SOLO la columna del autor y se
    // cuenta aquí — una consulta, no doscientas.
    supabase.from('forum_posts').select('author_id').not('author_id', 'is', null).limit(20000),
  ])

  // Se comprueba que sea un ARRAY y no solo que exista: entre que se
  // despliega y alguien ejecuta una migración, una tabla puede no estar,
  // y entonces lo que vuelve no es una lista. Sin esto, una tabla que
  // falta tumbaba la lista de gente ENTERA — y la lista de gente es la
  // página.
  const porAutor = (filas) =>
    (Array.isArray(filas) ? filas : []).reduce((acc, f) => {
      acc[f.author_id] = (acc[f.author_id] || 0) + 1
      return acc
    }, {})
  const guiasPorAutor = porAutor(approvedGuides)
  const mensajesPorAutor = porAutor(mensajes)

  allUsers = (Array.isArray(data) ? data : []).map((p, i) => ({
    ...p,
    rank: i + 1,
    approvedGuidesCount: guiasPorAutor[p.id] || 0,
    mensajes: mensajesPorAutor[p.id] || 0,
    racha: p.current_streak || 0,
  }))
  render(allUsers)
  cargarPodio(allUsers)
  cargarLateral(allUsers)

  document.getElementById('userSearchInput').addEventListener('input', (e) => {
    // Se filtra sobre la lista ya cargada, así que el plegado de acentos
    // se hace aquí en el navegador: "jesus" encuentra a "Jesús".
    const q = plegarTexto(e.target.value.trim())
    buscando = Boolean(q)
    if (!q) {
      render(allUsers)
      return
    }
    render(allUsers.filter((p) => contienePlegado(p.display_name, q) || contienePlegado(p.username, q)))
  })
}

// Fila compacta y en horizontal — a propósito distinta de la tarjeta grande
// de guide-card.js: aquí puede haber cientos de guías de calidad muy
// variable, así que se listan finas en vez de en tarjetas grandes.
function renderCommunityGuideRowHtml(guide) {
  return `
  <div class="community-guide-row" data-guide-id="${guide.id}" data-slug="${escapeHtml(guide.slug || '')}" data-has-guide="${guideHasReference(guide) ? '1' : ''}" tabindex="0" role="link">
    <div class="community-guide-row-icon">${contentIconHtml(guide.cover_emoji, 20, 'bookOpen')}</div>
    <div class="community-guide-row-info">
      <h3>${escapeHtml(guide.title)}<span class="badge community-guide-row-badge badge-pro">Pendiente</span></h3>
      <p>${guide.authorName ? `De ${escapeHtml(guide.authorName)} — ` : ''}${escapeHtml(guide.description || '')}</p>
    </div>
    <div class="community-guide-row-meta">
      <span data-card-rating>Sin valorar</span>
      <span>${guide.estimated_mins || 5} min</span>
    </div>
  </div>`
}

// ── Guías de la comunidad pendientes de revisión (las aprobadas ya
// viven en su categoría normal, con su autor atribuido — no hace
// falta duplicarlas aquí) ──
function renderCommunityGuides(list, session, page = 1) {
  const grid = document.getElementById('communityGuidesGrid')
  const empty = document.getElementById('communityGuidesEmpty')
  const paginationEl = document.getElementById('communityGuidesPagination')
  if (list.length === 0) {
    grid.innerHTML = ''
    paginationEl.innerHTML = ''
    empty.innerHTML = `<p class="empty-state">Todavía no hay guías de la comunidad que coincidan con tu búsqueda.</p>`
    return
  }
  empty.innerHTML = ''

  const totalPages = Math.max(1, Math.ceil(list.length / COMMUNITY_GUIDES_PAGE_SIZE))
  communityGuidesPage = Math.min(Math.max(1, page), totalPages)
  const from = (communityGuidesPage - 1) * COMMUNITY_GUIDES_PAGE_SIZE
  const pageItems = list.slice(from, from + COMMUNITY_GUIDES_PAGE_SIZE)

  grid.innerHTML = pageItems.map(renderCommunityGuideRowHtml).join('')

  grid.querySelectorAll('[data-guide-id]').forEach((card) => {
  })
  wireGuideCardClicks(grid)
  decorateGuideCards(grid, session)

  paginationEl.innerHTML =
    totalPages > 1
      ? `<div class="forum-pagination">
        <button class="btn-outline" id="communityGuidesPrevPage" ${communityGuidesPage <= 1 ? 'disabled' : ''}>← Anterior</button>
        <span>Página ${communityGuidesPage} de ${totalPages}</span>
        <button class="btn-outline" id="communityGuidesNextPage" ${communityGuidesPage >= totalPages ? 'disabled' : ''}>Siguiente →</button>
      </div>`
      : ''
  paginationEl.querySelector('#communityGuidesPrevPage')?.addEventListener('click', () => renderCommunityGuides(list, session, communityGuidesPage - 1))
  paginationEl.querySelector('#communityGuidesNextPage')?.addEventListener('click', () => renderCommunityGuides(list, session, communityGuidesPage + 1))
}

async function loadCommunityGuides(session) {
  const { data: guides } = await supabase
    .from('guides')
    .select('*, categories(name)')
    .not('author_id', 'is', null)
    .eq('review_status', 'pending')
    .order('submitted_at', { ascending: true })

  const list = guides || []
  const authorIds = [...new Set(list.map((g) => g.author_id))]
  let authorsById = {}
  if (authorIds.length > 0) {
    const { data: authors } = await supabase.from('user_profiles').select('id, display_name, username').in('id', authorIds)
    authorsById = Object.fromEntries((authors || []).map((a) => [a.id, a]))
  }

  allCommunityGuides = list.map((g) => {
    const author = authorsById[g.author_id]
    return { ...g, authorName: author?.display_name || author?.username || 'un colaborador' }
  })
  renderCommunityGuides(allCommunityGuides, session)
  const chipG = document.getElementById('chipGuias')
  if (chipG) chipG.textContent = String(allCommunityGuides.length)

  document.getElementById('communityGuideSearchInput').addEventListener('input', (e) => {
    const q = plegarTexto(e.target.value.trim())
    if (!q) {
      renderCommunityGuides(allCommunityGuides, session, 1)
      return
    }
    renderCommunityGuides(
      allCommunityGuides.filter(
        (g) => contienePlegado(g.title, q) || contienePlegado(g.description, q) || contienePlegado(g.authorName, q)
      ),
      session,
      1
    )
  })
}

// La pestaña abierta se guarda en la dirección (#usuarios, #peticiones...).
//
// Antes no se guardaba en ningún sitio: abrías Usuarios, recargabas, y
// volvías a Guías de la comunidad. Con el ancla, recargar te deja donde
// estabas, el botón de atrás funciona y además se puede pasar el enlace
// de una pestaña concreta a alguien.
//
// Se usa replaceState y no pushState a propósito: si cada clic en una
// pestaña dejara una entrada en el historial, salir de la página a base
// de "atrás" obligaría a recorrer todas las pestañas que hubieras
// mirado.
function abrirPestana(nombre, { recordar = true } = {}) {
  const btn = document.querySelector(`#communityTabs [data-ctab="${nombre}"]`)
  if (!btn) return false

  document.getElementById('communityTabs').querySelectorAll('[data-ctab]').forEach((b) => b.classList.remove('active'))
  document.querySelectorAll('.tab-panel[id^="ctab-"]').forEach((p) => p.classList.remove('active'))
  btn.classList.add('active')
  document.getElementById(`ctab-${nombre}`).classList.add('active')

  if (recordar) history.replaceState(null, '', `#${nombre}`)

  // Se cargan la primera vez que se abren, no al entrar en la página: son
  // varias consultas y la mayoría de visitas no las miran.
  if (nombre === 'activity') cargarActividad()
  if (nombre === 'peticiones') cargarPeticiones()
  return true
}

function wireTabs() {
  // El botón de la lateral abre la pestaña de peticiones en vez de dejar
  // el ancla suelto: sin esto el navegador salta al final de la página y
  // no pasa nada más.
  document.querySelector('[data-ir-peticiones]')?.addEventListener('click', (e) => {
    e.preventDefault()
    abrirPestana('peticiones')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  })
  document.getElementById('communityTabs')?.querySelectorAll('[data-ctab]').forEach((btn) => {
    btn.addEventListener('click', () => abrirPestana(btn.dataset.ctab))
  })
  // Volver atrás/adelante también cambia de pestaña.
  window.addEventListener('hashchange', () => {
    const nombre = window.location.hash.replace('#', '')
    if (nombre) abrirPestana(nombre, { recordar: false })
  })
}

let peticionesCargadas = false
async function cargarPeticiones() {
  if (peticionesCargadas) return
  peticionesCargadas = true
  initPeticiones(document.getElementById('peticionesPanel'), await getSession())
}

async function init() {
  wireTabs()
  // Con qué pestaña se llega: la del ancla si la hay (por recargar, por
  // el botón de atrás, o por un enlace como el de "¿No sabes de qué
  // escribir?"), y si no la de siempre.
  const pedida = window.location.hash.replace('#', '')
  if (pedida) abrirPestana(pedida, { recordar: false })
  const session = await getSession()
  await Promise.all([cargarCifras(), loadUsers(), loadCommunityGuides(session)])
}

init()


let actividadCargada = false

async function cargarActividad() {
  if (actividadCargada) return
  actividadCargada = true
  const cont = document.getElementById('activityFeed')
  cont.innerHTML = `<div class="skeleton" style="height: 90px;"></div>`
  try {
    cont.innerHTML = renderActivityHtml(await loadActivity(30))
  } catch {
    actividadCargada = false
    cont.innerHTML = `<p class="empty-state">No hemos podido cargar la actividad. Vuelve a intentarlo.</p>`
  }
}
