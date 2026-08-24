import { supabase } from './supabase.js'
import { escapeHtml, getSession, profileUrl, tintClassForKey, borderTintClassForKey, borderRarityClass, cardMediaHtml, categoryIconHtml, guideHasReference } from './app.js'
import { decorateGuideCards, wireGuideCardClicks } from './guide-card.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'
import { MOSTRAR_PLANES } from './planes.js'
import { loadActivity, renderActivityHtml } from './activity.js'
import { montarPrimerosPasos } from './primeros-pasos.js'
import { haceCuanto, nombreDe, perfilesPorId, urlTema, avatarHtml } from './foro-comun.js'
import { clasificacionSemanal } from './liga.js'

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

// Los números que hablan de personas: cuánta gente hay y cuánto se ha
// hablado esta semana. Si algo falla se quedan los guiones del HTML —
// mejor un guion que un cero mentiroso.
async function cargarNumerosComunidad() {
  const elMiembros = document.getElementById('heroStatMiembros')
  const elMensajes = document.getElementById('heroStatMensajes')
  if (!elMiembros && !elMensajes) return
  try {
    const desde = new Date(Date.now() - 7 * 86400e3).toISOString()
    const [{ count: miembros }, { count: mensajes }] = await Promise.all([
      supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      supabase.from('forum_posts').select('id', { count: 'exact', head: true }).gte('created_at', desde),
    ])
    if (elMiembros && miembros != null) elMiembros.textContent = miembros
    if (elMensajes && mensajes != null) elMensajes.textContent = mensajes
  } catch {}
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

// ── Lo último del foro, para TODO el mundo ──
//
// Es la prueba de vida de la portada: los temas son públicos, y un
// visitante que ve «hace 20 min» entiende al momento que aquí hay gente
// hablando hoy — que es justo lo que ninguna lista de guías puede
// demostrar. Si el foro está vacío o algo falla, la sección no sale.
async function cargarForoVivo() {
  const seccion = document.getElementById('foroVivoSeccion')
  const hueco = document.getElementById('foroVivo')
  if (!seccion || !hueco) return

  const { data: temas, error } = await supabase
    .from('forum_threads')
    .select('id, title, post_count, created_at, last_post_at, author_id, last_post_author_id')
    .order('last_post_at', { ascending: false })
    .limit(4)
  if (error || !temas || temas.length === 0) return

  const perfiles = await perfilesPorId(temas.flatMap((t) => [t.last_post_author_id, t.author_id]))

  hueco.innerHTML = `
    <div class="foro-vivo-cabecera">
      <div>
        <h2>Ahora en el foro</h2>
        <p class="subtext">De lo que se está hablando hoy. Entra y participa.</p>
      </div>
      <a class="btn-secondary foro-vivo-boton" href="/foro">Ver el foro →</a>
    </div>
    <ul class="foro-vivo-lista">
      ${temas
        .map((t) => {
          // La cara de quien habló último: es lo que hace que la lista
          // parezca gente y no un índice.
          const perfil = perfiles[t.last_post_author_id] || perfiles[t.author_id]
          const quien = nombreDe(perfil) || 'Alguien'
          const mensajes = t.post_count || 1
          return `
        <li class="foro-vivo-fila">
          ${avatarHtml(perfil, 34)}
          <div class="foro-vivo-texto">
            <a class="foro-vivo-titulo" href="${urlTema(t.id)}">${escapeHtml(t.title)}</a>
            <span class="subtext foro-vivo-meta">${escapeHtml(quien)} · ${haceCuanto(t.last_post_at || t.created_at)} · ${mensajes} ${
              mensajes === 1 ? 'mensaje' : 'mensajes'
            }</span>
          </div>
        </li>`
        })
        .join('')}
    </ul>`
  seccion.style.display = ''
}

// ── La bienvenida del miembro ──
//
// Con sesión, el hero de marketing sobra: quien entra cada día no
// necesita que le expliquen qué es PokeDoc. En su lugar, una barra
// compacta con su nombre, su racha y su nivel — y la portada útil
// (reto, top del mes, foro) queda una pantalla más arriba.
async function cargarBienvenida(session) {
  if (!session) return
  const seccion = document.getElementById('bienvenidaSeccion')
  const hueco = document.getElementById('bienvenida')
  if (!seccion || !hueco) return
  try {
    const [{ data: profile }, { calculateLevel, levelBadgeHtml }] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, username, display_name, avatar_url, current_streak, total_xp')
        .eq('id', session.user.id)
        .maybeSingle(),
      import('./gamification.js'),
    ])
    if (!profile) return

    const nombre = profile.display_name || profile.username || ''
    const racha = profile.current_streak || 0
    hueco.innerHTML = `
      ${avatarHtml(profile, 44)}
      <div class="bienvenida-texto">
        <strong>Hola${nombre ? `, ${escapeHtml(nombre)}` : ''}</strong>
        <span class="subtext">Tu reto y lo último de la comunidad, aquí abajo.</span>
      </div>
      <div class="bienvenida-chips">
        ${racha > 0 ? `<span class="bienvenida-chip">${icons.flame(14)} ${racha} ${racha === 1 ? 'día' : 'días'}</span>` : ''}
        ${levelBadgeHtml(calculateLevel(profile.total_xp || 0))}
        <a class="btn-secondary bienvenida-perfil" href="perfil.html">Tu perfil →</a>
      </div>`
    // El hero se esconde SOLO cuando la bienvenida está lista: si algo
    // de arriba fallara, la portada de siempre sigue entera. La clase
    // del body compacta el aire de arriba: los 76px de .page-content
    // están pensados para el hero de marketing, y con la bienvenida
    // como primer bloque sobraban (se notaba sobre todo en móvil).
    document.querySelector('.hero')?.style.setProperty('display', 'none')
    document.body.classList.add('portada-compacta')
    seccion.style.display = ''
  } catch {}
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
    cargarNumerosComunidad(),
    cargarForoVivo(),
    cargarBienvenida(session),
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

  // Al visitante también se le enseña el reto: es la mecánica más
  // enganchosa de la web y estaba escondida detrás de la sesión. El clic
  // lleva al registro — el gancho de volver mañana empieza a trabajar
  // antes de que exista la cuenta.
  if (!session) {
    // El «5» es PREGUNTAS_POR_RETO (js/reto-diario.js), a mano a
    // propósito: importar el módulo solo por un número le cargaría al
    // visitante el motor del curso entero, y la portada tiene
    // presupuesto de peso (test-carga).
    document.getElementById('retoTarjetas').innerHTML = `
      <a class="reto-tarjeta" href="auth.html">
        <span class="reto-icono">${icons.flame(20)}</span>
        <div class="reto-texto">
          <strong>Reto de hoy</strong>
          <small>5 preguntas diarias, las mismas para todos. Crea tu cuenta y juega.</small>
        </div>
        <span class="reto-flecha">→</span>
      </a>`
    seccion.style.display = ''
    return
  }

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


// ── La liga de la semana ──
//
// La clasificación del reto diario de lunes a domingo (js/liga.js, sin
// tabla propia: se agrega en el navegador). Se enseña a todo el mundo
// —es la prueba de que aquí se juega— pero la línea de «tú vas N.º»
// solo con sesión. Sin resultados esta semana, la sección no sale.
async function cargarLiga(session) {
  const seccion = document.getElementById('ligaSeccion')
  const hueco = document.getElementById('liga')
  if (!seccion || !hueco) return

  const filas = await clasificacionSemanal()
  if (!filas.length) return

  const { data: perfiles } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, banner_color')
    .in('id', filas.slice(0, 30).map((f) => f.user_id))
  const perfilPor = Object.fromEntries((perfiles || []).map((p) => [p.id, p]))

  const CLASES_PODIO = ['top-mes-oro', 'top-mes-plata', 'top-mes-bronce']
  // El podio va con el icono de medalla tintado, no con el emoji 🥇: la
  // norma de la casa (iconos SVG en la UI, test-iconos-contenido vigila).
  const puestoHtml = (i) =>
    i < 3
      ? `<span class="top-mes-puesto podio podio-${i + 1}">${icons.medal(15)}</span>`
      : `<span class="top-mes-puesto">${i + 1}.</span>`
  const filaHtml = (f, i) => {
    const perfil = perfilPor[f.user_id]
    const soyYo = session && f.user_id === session.user.id
    return `
      <li class="top-mes-fila ${CLASES_PODIO[i] || ''} ${soyYo ? 'liga-yo' : ''}">
        ${puestoHtml(i)}
        ${avatarHtml(perfil, 26)}
        <a class="top-mes-nombre" href="/usuario/${encodeURIComponent(perfil?.username || '')}">${escapeHtml(
          perfil?.display_name || perfil?.username || 'Usuario'
        )}</a>
        <strong class="top-mes-xp">${f.puntos} pts</strong>
      </li>`
  }

  const miPuesto = session ? filas.findIndex((f) => f.user_id === session.user.id) : -1
  const pintar = (todas) => {
    const visibles = todas ? filas : filas.slice(0, 5)
    hueco.innerHTML = `
      <div class="top-mes-cabecera">
        <h2>Liga de la semana</h2>
        <p class="subtext">Los puntos del reto diario, de lunes a domingo. El lunes, borrón y cuenta nueva.</p>
      </div>
      <ol class="top-mes-lista">${visibles.map(filaHtml).join('')}</ol>
      ${
        // Tu puesto, cuando no estás entre los visibles: para eso se
        // mira la liga. Si aún no has jugado esta semana, la invitación.
        session && miPuesto >= visibles.length
          ? `<p class="liga-mi-puesto">Tú vas ${miPuesto + 1}.º con ${filas[miPuesto].puntos} pts</p>`
          : session && miPuesto === -1
            ? `<p class="liga-mi-puesto">Esta semana todavía no puntúas — <a href="/curso.html?reto=hoy">juega el reto de hoy</a></p>`
            : ''
      }
      ${
        filas.length > 5
          ? `<button type="button" class="link-btn liga-ver-todos" id="ligaVerTodos">${todas ? 'Ver menos' : `Ver los ${filas.length} de la semana`}</button>`
          : ''
      }`
    document.getElementById('ligaVerTodos')?.addEventListener('click', () => pintar(!todas))
  }
  pintar(false)
  seccion.style.display = ''
}

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

  const CLASES_PODIO = ['top-mes-oro', 'top-mes-plata', 'top-mes-bronce']
  // Mismo podio de medalla SVG que la liga (la norma de los iconos).
  const puestoHtml = (i) =>
    i < 3
      ? `<span class="top-mes-puesto podio podio-${i + 1}">${icons.medal(15)}</span>`
      : `<span class="top-mes-puesto">${i + 1}.</span>`
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
          ${puestoHtml(i)}
          ${avatarHtml(f.perfil, 26)}
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
getSession().then((s) => cargarLiga(s)).catch(() => {})
