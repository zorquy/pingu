import { supabase } from './supabase.js'
import { escapeHtml, getSession, profileUrl, tintClassForKey, borderTintClassForKey, borderRarityClass, cardMediaHtml, categoryIconHtml, guideHasReference } from './app.js'
import { decorateGuideCards, wireGuideCardClicks } from './guide-card.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'
import { MOSTRAR_PLANES } from './planes.js'
import { loadActivity, renderActivityHtml } from './activity.js'
import { montarPrimerosPasos } from './primeros-pasos.js'

async function loadCategories() {
  const grid = document.getElementById('categoriesGrid')
  const { data, error } = await supabase.from('categories').select('*').order('order_pos')

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p class="empty-state">No hay categorías disponibles todavía.</p>`
    return
  }

  grid.innerHTML = data
    .map((cat) => {
      const icon =
        cat.cover_image && !cat.icon_image
          ? cardMediaHtml(cat.cover_image, cat.emoji)
          : `<div class="category-icon ${tintClassForKey(cat.id)}">${categoryIconHtml(cat, 22)}</div>`
      return `
    <a href="categoria.html?slug=${encodeURIComponent(cat.slug)}" class="category-card ${borderTintClassForKey(cat.id)}">
      ${icon}
      <h3>${escapeHtml(cat.name)}</h3>
      <p>${escapeHtml(cat.description || '')}</p>
      <span class="pill">${cat.guide_count ?? 0} guías</span>
    </a>`
    })
    .join('')

  const heroCategories = document.getElementById('heroStatCategories')
  if (heroCategories) heroCategories.textContent = data.length
}

async function loadHeroGuideCount() {
  const el = document.getElementById('heroStatGuides')
  if (!el) return
  const { count } = await supabase
    .from('guides')
    .select('*', { count: 'exact', head: true })
    .not('published_at', 'is', null)
  el.textContent = count || 0
}

async function loadRecent() {
  const grid = document.getElementById('recentGrid')
  const { data, error } = await supabase
    .from('guides')
    .select('*, categories(name)')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(3)

  if (error || !data || data.length === 0) {
    grid.innerHTML = `<p class="empty-state">Todavía no hay guías publicadas.</p>`
    return
  }

  grid.innerHTML = data
    .map(
      (g) => `
    <div class="recent-card ${borderRarityClass(g.guide_rarity)}" data-guide-id="${g.id}" data-author-id="${escapeHtml(g.author_id || '')}" data-slug="${escapeHtml(g.slug || '')}" data-has-guide="${guideHasReference(g) ? '1' : ''}" tabindex="0" role="link">
      ${g.cover_image ? cardMediaHtml(g.cover_image, g.cover_emoji) : `<span class="emoji">${contentIconHtml(g.cover_emoji, 32, 'bookOpen')}</span>`}
      <h3>${escapeHtml(g.title)}</h3>
      <p>${escapeHtml(g.description || '')}</p>
      <div class="meta">
        ${MOSTRAR_PLANES ? `<span class="badge ${g.is_pro ? 'badge-pro' : 'badge-free'}">${g.is_pro ? 'Pro' : 'Gratis'}</span>` : ''}
        <span class="time-tag">${g.estimated_mins || 5} min</span>
        <span class="rarity-chip rarity-${g.guide_rarity || 'bronze'}">${g.guide_rarity || 'bronze'}</span>
      </div>
      <div class="guide-card-author" data-card-author></div>
      <div class="guide-card-social">
        <button class="card-save-btn" data-card-save title="Guardar" aria-label="Guardar" onclick="event.stopPropagation()">${icons.bookmark(16)}</button>
        <span class="card-rating" data-card-rating>Sin valorar</span>
      </div>
    </div>`
    )
    .join('')

}

// Solo para quien ha iniciado sesión. Alguien que llega buscando si su
// carta es falsa no quiere ver quién se ha apuntado hoy; un miembro sí
// agradece ver que aquello está vivo.
async function loadHomeActivity(session) {
  if (!session) return
  try {
    const actividad = await loadActivity(4)
    // En la home, si no hay nada que enseñar el bloque no se abre — ni
    // para decir que está vacío ni para decir que ha fallado. Es un
    // extra de la portada, no la pantalla de actividad.
    if (actividad.eventos.length === 0) return
    document.getElementById('homeActivityFeed').innerHTML = renderActivityHtml(actividad)
    document.getElementById('homeActivity').classList.remove('hidden')
  } catch {
    // Si falla, la home se queda como siempre. No es contenido crítico.
  }
}

function setupModals() {
  document.getElementById('btnWhatIsPokeDoc')?.addEventListener('click', () => {
    document.getElementById('whatIsModal').classList.remove('hidden')
  })
  document.getElementById('whatIsModalClose')?.addEventListener('click', () => {
    document.getElementById('whatIsModal').classList.add('hidden')
  })
  document.getElementById('whatIsModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'whatIsModal') e.target.classList.add('hidden')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.getElementById('whatIsModal')?.classList.add('hidden')
  })
}

async function init() {
  setupModals()
  const session = await getSession()

  if (!session) {
    document.getElementById('signupBanner').style.display = 'block'
  }

  await Promise.all([
    loadCategories(),
    loadRecent(),
    loadHeroGuideCount(),
    loadHomeActivity(session),
    // Va dentro del mismo grupo: es una consulta corta y así no añade una
    // espera más antes de que la portada esté entera.
    montarPrimerosPasos(document.getElementById('primerosPasos'), session),
  ])
  wireGuideCardClicks(document.getElementById('recentGrid'))
  await decorateGuideCards(document.getElementById('recentGrid'), session)
}

init()

// ── La guía destacada de la semana ──
//
// La elige una persona desde /admin, no un algoritmo. Es la recompensa
// más alta que se le puede dar a quien escribe: alguien ha leído su guía
// y ha decidido ponerla en la portada.
//
// Si no hay ninguna elegida, la sección no existe — mejor eso que un
// hueco con "próximamente".
async function cargarDestacada() {
  const seccion = document.getElementById('destacadaSeccion')
  if (!seccion) return

  const { data: config } = await supabase.from('home_config').select('blocks').eq('id', 1).maybeSingle()
  const elegida = config?.blocks?.destacada
  if (!elegida?.guide_id) return

  const { data: guia } = await supabase
    .from('guides')
    .select('id, slug, title, description, cover_emoji, author_id')
    .eq('id', elegida.guide_id)
    .not('published_at', 'is', null)
    .maybeSingle()
  if (!guia) return

  let autor = null
  if (guia.author_id) {
    const { data } = await supabase.from('user_profiles').select('id, username, display_name').eq('id', guia.author_id).maybeSingle()
    autor = data
  }

  document.getElementById('destacada').innerHTML = `
    <span class="destacada-sello">${icons.star(13)} Guía destacada</span>
    <a class="destacada-titulo" href="/guia.html?slug=${encodeURIComponent(guia.slug)}">
      ${contentIconHtml(guia.cover_emoji, 22, 'bookOpen')} ${escapeHtml(guia.title)}
    </a>
    ${elegida.nota ? `<p class="destacada-nota">“${escapeHtml(elegida.nota)}”</p>` : `<p class="destacada-nota">${escapeHtml(guia.description || '')}</p>`}
    ${autor ? `<p class="destacada-autor">De <a href="${profileUrl(autor)}">${escapeHtml(autor.display_name || autor.username)}</a></p>` : ''}`
  seccion.style.display = ''
}
cargarDestacada().catch(() => {})

// ── El reto del día y el repaso ──
//
// Es lo que da motivo para volver mañana: cinco preguntas nuevas cada
// día, las mismas para todo el mundo, y las que fallaste esperándote
// unos días después.
//
// Se pinta sin bloquear el resto de la home y se calla si algo falla:
// mientras la migración de los cursos no esté aplicada, estas dos
// tarjetas simplemente no aparecen.
async function cargarReto() {
  const seccion = document.getElementById('retoSeccion')
  if (!seccion) return

  const session = await getSession()
  if (!session) return

  const [{ yaJugadoHoy, PREGUNTAS_POR_RETO }, { cuantasParaRepasar }] = await Promise.all([
    import('./reto-diario.js'),
    import('./curso-datos.js'),
  ])

  const [jugado, porRepasar] = await Promise.all([
    yaJugadoHoy(session.user.id),
    cuantasParaRepasar(session.user.id),
  ])

  const tarjetas = []
  tarjetas.push(
    jugado
      ? `<div class="reto-tarjeta reto-tarjeta-hecha">
           <span class="reto-icono">${icons.flame(20)}</span>
           <div class="reto-texto">
             <strong>Reto de hoy: ${jugado.correct} de ${jugado.total}</strong>
             <small>Mañana hay cinco preguntas nuevas.</small>
           </div>
         </div>`
      : `<a class="reto-tarjeta" href="/curso.html?reto=hoy">
           <span class="reto-icono">${icons.flame(20)}</span>
           <div class="reto-texto">
             <strong>Reto de hoy</strong>
             <small>${PREGUNTAS_POR_RETO} preguntas, las mismas para todos.</small>
           </div>
           <span class="reto-flecha">→</span>
         </a>`
  )

  if (porRepasar > 0) {
    tarjetas.push(`
      <a class="reto-tarjeta" href="/curso.html?reto=repaso">
        <span class="reto-icono">${icons.refreshCw(20)}</span>
        <div class="reto-texto">
          <strong>${porRepasar} ${porRepasar === 1 ? 'pregunta' : 'preguntas'} por repasar</strong>
          <small>De lo que fallaste hace unos días.</small>
        </div>
        <span class="reto-flecha">→</span>
      </a>`)
  }

  document.getElementById('retoTarjetas').innerHTML = tarjetas.join('')
  seccion.style.display = ''
}
cargarReto().catch(() => {})


// ── El top del mes ──
//
// La clasificación por XP total la ganan siempre los veteranos; esta es
// la liga que un recién llegado sí puede ganar: XP ganado DESDE el día 1
// del mes (total_xp − la foto de xp_mes que toma la función programada
// top-del-mes). Sin la migración o sin fotos todavía, la sección no sale.
async function cargarTopDelMes() {
  const seccion = document.getElementById('topMesSeccion')
  const hueco = document.getElementById('topMes')
  if (!seccion || !hueco) return

  const mes = `${new Date().getUTCFullYear()}-${String(new Date().getUTCMonth() + 1).padStart(2, '0')}-01`
  const { data: fotos, error } = await supabase.from('xp_mes').select('user_id, xp_inicio').eq('mes', mes).limit(2000)
  if (error || !fotos || fotos.length === 0) return

  const { data: perfiles } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, banner_color, total_xp, level')
    .limit(2000)
  if (!perfiles) return

  const inicioPorId = Object.fromEntries(fotos.map((f) => [f.user_id, f.xp_inicio || 0]))
  const filas = perfiles
    .map((p) => ({ perfil: p, ganado: Math.max(0, (p.total_xp || 0) - (inicioPorId[p.id] ?? 0)) }))
    .filter((f) => f.ganado > 0)
    .sort((a, b) => b.ganado - a.ganado)
    .slice(0, 5)
  if (filas.length === 0) return

  const MEDALLAS_PODIO = ['🥇', '🥈', '🥉']
  const CLASES_PODIO = ['top-mes-oro', 'top-mes-plata', 'top-mes-bronce']
  hueco.innerHTML = `
    <div class="top-mes-cabecera">
      <h2>Top del mes</h2>
      <p class="subtext">Quien más XP ha ganado desde el día 1. Cada mes, borrón y cuenta nueva.</p>
    </div>
    <ol class="top-mes-lista">
      ${filas
        .map(
          (f, i) => `
        <li class="top-mes-fila ${CLASES_PODIO[i] || ''}">
          <span class="top-mes-puesto">${MEDALLAS_PODIO[i] || `${i + 1}.`}</span>
          <a class="top-mes-nombre" href="/usuario/${encodeURIComponent(f.perfil.username || '')}">${escapeHtml(
            f.perfil.display_name || f.perfil.username || 'Usuario'
          )}</a>
          <strong class="top-mes-xp">+${f.ganado} XP</strong>
        </li>`
        )
        .join('')}
    </ol>`
  seccion.style.display = ''
}
cargarTopDelMes().catch(() => {})
