import { supabase } from './supabase.js'
import { atributosDeRango, COLUMNAS_RANGO } from './rangos.js'
import { escapeHtml, getInitial, getSession, profileUrl, avatarStyle } from './app.js'
import { guideHasReference } from './guia-contenido.js'
import { decorateGuideCards, wireGuideCardClicks } from './guide-card.js'
import { calculateLevel, levelBadgeHtml } from './gamification.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'
import { plegarTexto, contienePlegado } from './texto.js'
import { initPeticiones } from './peticiones.js'
import { rachaVisible } from './racha-visible.js'
import { tiendasDePruebas } from './tiendas-fantasma.js'
import { sinFantasmas } from './tiendas-puro.js'

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
  const hizo = loQueHace(p)
  return `
    <div class="com-persona" data-user-id="${escapeHtml(p.id || '')}">
      <span class="com-persona-franja" style="${avatarStyle(p)}" aria-hidden="true"></span>
      <a class="com-persona-cara" href="${profileUrl(p)}" style="${avatarStyle(p)}" aria-label="${escapeHtml(name)}" data-en-linea="${escapeHtml(p.id || '')}">${p.avatar_url ? '' : getInitial(name)}</a>
      <div class="com-persona-cuerpo">
        <a class="com-persona-nombre" href="${profileUrl(p)}"${atributosDeRango(p)}>${escapeHtml(name)}</a>
        ${levelBadgeHtml(calculateLevel(p.total_xp), 11)}
        <span class="com-persona-hizo">${escapeHtml(hizo)}</span>
      </div>
      ${
        p.racha > 0
          ? `<span class="com-persona-racha" title="${p.racha} días seguidos">${icons.flame(12)} ${p.racha}</span>`
          : ''
      }
    </div>`
}

// Lo que hace aquí cada uno, en UNA frase (1216, la propuesta del repaso:
// «Javi tiene 7 cartas que buscas», «Sergio.M ha escrito una guía»). Va
// primero lo que te sirve a ti (tiene cartas que buscas), luego lo que ha
// hecho, y «Hoy por aquí» antes que nada. Puro.
export function loQueHace(p, hoy = new Date().toISOString().slice(0, 10)) {
  if (p.teDa > 0) return `Tiene ${p.teDa} ${p.teDa === 1 ? 'carta que buscas' : 'cartas que buscas'}`
  if (p.approvedGuidesCount > 0) return p.approvedGuidesCount === 1 ? 'Ha escrito una guía' : `Ha escrito ${p.approvedGuidesCount} guías`
  if (p.racha >= 7) return `Lleva ${p.racha} días seguidos`
  if (p.mensajes > 0) return `${p.mensajes} ${p.mensajes === 1 ? 'mensaje' : 'mensajes'} en el foro`
  if (p.last_active_date === hoy) return 'Hoy por aquí'
  return 'Acaba de llegar'
}

// «Tiene N cartas que buscas» (1216): con sesión, los mismos datos de Cruces
// (`intercambios_quien_tiene`, una consulta), contados por persona.
async function ponerLoQueTeDan(lista) {
  const sesion = await getSession().catch(() => null)
  if (!sesion) return false
  const { quienTiene } = await import('./mi-coleccion/cambios.js')
  const filas = await quienTiene().catch(() => [])
  const porPersona = new Map()
  for (const f of filas) {
    if (!f?.user_id || f.user_id === sesion.user.id) continue
    if (!porPersona.has(f.user_id)) porPersona.set(f.user_id, new Set())
    porPersona.get(f.user_id).add(f.card_id)
  }
  if (!porPersona.size) return false
  for (const p of lista) p.teDa = porPersona.get(p.id)?.size || 0
  return true
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
  // El punto verde de quien está en línea (1140).
  import('./en-linea.js').then((m) => m.marcarEnLinea(grid)).catch(() => {})
  import('./gente-vitrinas.js').then(({ pintarVitrinasDeGente }) => pintarVitrinasDeGente(grid)).catch(() => {})

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
    if (e && n != null) e.textContent = new Intl.NumberFormat('es-ES', { useGrouping: 'always' }).format(n)
  }
  const ayer = new Date(Date.now() - 86400e3).toISOString().slice(0, 10)
  const cuenta = async (f) => {
    try {
      const { count, error } = await f()
      return error ? null : count
    } catch {
      return null
    }
  }
  // Las cuatro de la propuesta del repaso (1216): miembros, por aquí hoy,
  // guías y rachas. «Por aquí hoy» la pone `cargarLateral`, que ya la cuenta
  // exacta (1169); «mensajes» salió de la banda (el foro dice los suyos).
  const [miembros, guias, rachas] = await Promise.all([
    cuenta(() => supabase.from('user_profiles').select('id', { count: 'exact', head: true })),
    // Solo GUÍAS: las noticias viven en la misma tabla (`kind = 'news'`) y la
    // cifra las contaba como guías escritas por la gente (1137).
    cuenta(() =>
      supabase.from('guides').select('id', { count: 'exact', head: true }).eq('kind', 'guide').not('author_id', 'is', null).not('published_at', 'is', null)
    ),
    // Racha VIVA: la de quien entró hoy o ayer. Sin el filtro de fecha se
    // contarían rachas de gente que no aparece desde hace meses, que es
    // justo lo contrario de lo que el número promete.
    cuenta(() =>
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }).gte('current_streak', 2).gte('last_active_date', ayer)
    ),
  ])
  poner('cifraMiembros', miembros)
  poner('cifraGuias', guias)
  poner('cifraRachas', rachas)
  const chip = document.getElementById('chipGente')
  if (chip && miembros != null) chip.textContent = new Intl.NumberFormat('es-ES', { useGrouping: 'always' }).format(miembros)
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

    // En la banda de arriba (1209): las tres caras sobre su peana, el
    // primero en medio. Antes era una tira azul que se desplegaba (1165).
    const mesLargo = hoy.toLocaleDateString('es-ES', { month: 'long' })
    const nombreDe = (p) => p.display_name || p.username || 'Usuario'
    const puesto = ({ p, ganado }, i) => `<a class="banda-s-puesto banda-s-puesto-${i + 1}" href="${profileUrl(p)}" title="${escapeHtml(`${nombreDe(p)}: +${new Intl.NumberFormat('es-ES', { useGrouping: 'always' }).format(ganado)} XP en ${mesLargo}`)}">
        <span class="banda-s-puesto-cara" style="${avatarStyle(p)}">${p.avatar_url ? '' : getInitial(nombreDe(p))}</span>
        <span class="banda-s-puesto-nombre">${escapeHtml(nombreDe(p))}</span>
        <span class="banda-s-puesto-xp">+${new Intl.NumberFormat('es-ES', { useGrouping: 'always' }).format(ganado)} XP</span>
        <span class="banda-s-peana">${i + 1}</span>
      </a>`
    // El orden de un podio: el segundo, el primero y el tercero.
    const orden = [1, 0, 2].filter((i) => tres[i])
    hueco.innerHTML = `<div class="banda-s-podio" role="list" aria-label="El top de ${escapeHtml(mesLargo)}">${orden.map((i) => `<span role="listitem">${puesto(tres[i], i)}</span>`).join('')}</div>`
  } catch {
    // El podio es un extra. Si falla, la lista de gente sale igual.
  }
}

// ── Quién anda por aquí hoy, y lo último que ha pasado ──
async function cargarLateral(perfiles) {
  const hoy = new Date().toISOString().slice(0, 10)
  const activos = (perfiles || []).filter((p) => p.last_active_date === hoy)
  // El NÚMERO es la cuenta exacta de la base (1169): `perfiles` son los 200
  // con más XP, y contar los de hoy entre ellos se quedaba corto en cuanto
  // había más de 200 miembros. Si la cuenta falla, vale la de la lista.
  const total = await supabase
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('last_active_date', hoy)
    .then(({ count, error }) => (error || count == null ? activos.length : count))
    .catch(() => activos.length)
  // La misma cuenta, como cifra de la banda (1216, de la propuesta): con el
  // punto verde que late, que se vea desde arriba que hay gente.
  const vivo = document.getElementById('cifraHoy')
  if (vivo) vivo.textContent = new Intl.NumberFormat('es-ES', { useGrouping: 'always' }).format(Math.max(total, activos.length))
  const caja = document.getElementById('comHoy')
  // Se recoge sola si no hay nadie: «0 personas hoy» es peor que no
  // decir nada.
  if (caja && (activos.length || total)) {
    const CARAS = 7
    caja.innerHTML = `
      <h3>Por aquí hoy · ${Math.max(total, activos.length)}</h3>
      <div class="com-monton">
        ${activos
          .slice(0, CARAS)
          .map(
            (p) => `<a class="com-monton-cara" href="${profileUrl(p)}" style="${avatarStyle(p)}" title="${escapeHtml(
              p.display_name || p.username || 'Usuario'
            )}">${p.avatar_url ? '' : getInitial(p.display_name || p.username || '?')}</a>`
          )
          .join('')}
        ${Math.max(total, activos.length) > CARAS ? `<span class="com-monton-cara com-monton-mas">+${Math.max(total, activos.length) - CARAS}</span>` : ''}
      </div>
      <a class="btn-secondary com-boton-ancho" href="/foro">Preséntate en el foro</a>`
    caja.classList.remove('hidden')
  }

  // Con el molde de la portada (845): lo mismo que la pestaña Actividad.
  const ultimo = document.getElementById('comUltimo')
  if (!ultimo) return
  try {
    const { montarUltimo } = await import('./comunidad-sucesos.js')
    await montarUltimo(ultimo, 5)
  } catch {
    ultimo.innerHTML = '<p class="subtext" style="margin:0">No hemos podido cargar la actividad.</p>'
  }
}

async function loadUsers() {
  const [{ data }, { data: approvedGuides }, { data: mensajes }, fantasmas] = await Promise.all([
    supabase
      .from('user_profiles')
      // Y el rango (tanda 386): sin estas dos columnas todo el
      // directorio saldría en azul y parecería que no hay ni un admin.
      .select(`id, username, display_name, level, total_xp, avatar_url, banner_color, current_streak, last_active_date, ${COLUMNAS_RANGO}`)
      .order('total_xp', { ascending: false })
      .limit(200),
    supabase.from('guides').select('author_id').eq('review_status', 'approved').not('author_id', 'is', null),
    // Cuántos mensajes ha escrito cada uno: es la mitad del «qué ha
    // hecho» de la tarjeta. Se trae SOLO la columna del autor y se
    // cuenta aquí — una consulta, no doscientas.
    supabase.from('forum_posts').select('author_id').not('author_id', 'is', null).limit(20000),
    // La tienda de pruebas no sale en Gente (1245).
    tiendasDePruebas(),
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

  allUsers = sinFantasmas(data, fantasmas).map((p, i) => ({
    ...p,
    rank: i + 1,
    approvedGuidesCount: guiasPorAutor[p.id] || 0,
    mensajes: mensajesPorAutor[p.id] || 0,
    racha: rachaVisible(p),
  }))
  render(allUsers)
  ponerLoQueTeDan(allUsers).then((hay) => { if (hay && !buscando) render(allUsers) }).catch(() => {})
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
      <span data-card-rating></span>
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
    // sin rango: el autor de una guía de la comunidad sale como texto
    // dentro de la descripción («De Ash — …»), sin enlace al perfil
    // (tanda 386).
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
  colocarLupa(nombre)

  if (recordar) history.replaceState(null, '', `#${nombre}`)

  // Se cargan la primera vez que se abren, no al entrar en la página: son
  // varias consultas y la mayoría de visitas no las miran.
  if (nombre === 'activity') cargarActividad()
  if (nombre === 'peticiones') cargarPeticiones()
  return true
}

// En el PC (1165, M1) la caja de buscar va en la fila de las pestañas, a la
// derecha, y solo con «Gente» abierta (es la que busca); en el móvil se queda
// en su panel. Se mueve el campo de verdad, con sus manejadores.
const pantallaAncha = typeof matchMedia === 'function' ? matchMedia('(min-width: 901px)') : { matches: false, addEventListener() {} }
function colocarLupa(nombre = document.querySelector('#communityTabs .active')?.dataset.ctab || 'users') {
  const campo = document.getElementById('userSearchInput')
  const caja = campo?.closest('.search-input-wrap')
  const chips = document.getElementById('communityTabs')
  const panel = document.getElementById('ctab-users')
  if (!caja || !chips || !panel) return
  if (pantallaAncha.matches) {
    if (caja.parentElement !== chips) chips.append(caja)
    caja.hidden = nombre !== 'users'
  } else {
    if (caja.parentElement !== panel) panel.insertBefore(caja, document.getElementById('userDirectoryEmpty'))
    caja.hidden = false
  }
}
pantallaAncha.addEventListener?.('change', () => colocarLupa())

function wireTabs() {
  colocarLupa()
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

// Antes de init(): si la página llega con #activity, init() abre esa pestaña
// y cargarActividad() lee esto. Declarada más abajo, era un ReferenceError.
let actividadCargada = false

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


async function cargarActividad() {
  if (actividadCargada) return
  actividadCargada = true
  const cont = document.getElementById('activityFeed')
  cont.innerHTML = `<div class="skeleton" style="height: 90px;"></div>`
  // Lo mismo que la portada y más (845): filtros por tipo y «Ver más».
  try {
    const { montarActividad } = await import('./comunidad-sucesos.js')
    await montarActividad(cont)
  } catch {
    actividadCargada = false
    cont.innerHTML = `<p class="empty-state">No hemos podido cargar la actividad. Vuelve a intentarlo.</p>`
  }
}
