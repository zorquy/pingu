import { supabase } from './supabase.js'
import { escapeHtml, getInitial, getSession, getProfile, profileUrl, avatarStyle, guideHasCourse } from './app.js'
import { renderReferenceBlocksHtml } from './block-editor.js'
import { hydrateDecks } from './cards-block.js'
import { renderRatingWidget } from './guide-rating.js'
import { initGuideForum } from './guide-forum.js'
import { markGuideRead, READ_XP } from './gamification.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'
import { MOSTRAR_PLANES } from './planes.js'
import { montarBotonHelpful } from './guide-helpful.js'
import { compartirHtml, engancharCompartir } from './compartir.js'
import { contributorBadgeHtml } from './contributor-badge.js'
import { montarSugerencia, creditosHtml } from './guide-suggestions.js'

const params = new URLSearchParams(window.location.search)
const slug = params.get('slug')

const LEVEL_LABELS = { beginner: 'Básico', intermediate: 'Intermedio', advanced: 'Avanzado' }

async function toggleSave(session, guideId, btn) {
  const profile = await getProfile(session.user.id)
  const saved = profile?.saved_guides || []
  const isSaved = saved.includes(guideId)
  const next = isSaved ? saved.filter((id) => id !== guideId) : [...saved, guideId]
  await supabase.from('user_profiles').update({ saved_guides: next }).eq('id', session.user.id)
  btn.innerHTML = isSaved ? `${icons.bookmark(14, true)} Guardado` : `${icons.bookmark(14)} Guardar`
}

// Marcar una guía como leída solo por abrirla sería regalar el XP: se
// espera a que el final del artículo entre en pantalla Y a que haya
// pasado un tiempo mínimo, para que no cuente quien baja de golpe hasta
// los comentarios.
const MIN_READ_SECONDS = 15

function setupReadTracking(session, guide) {
  if (!session) return
  const sentinel = document.getElementById('articleEndSentinel')
  if (!sentinel || typeof IntersectionObserver === 'undefined') return

  const openedAt = Date.now()
  let done = false
  let timer = null

  async function marcar() {
    if (done) return
    done = true
    observer.disconnect()
    if (timer) clearTimeout(timer)
    try {
      const esNueva = await markGuideRead(session.user.id, guide.id)
      if (esNueva) showToast(`Guía leída · +${READ_XP} XP`, 'success')
    } catch {
      // Ya queda registrado en client_errors. No se avisa al usuario:
      // ha venido a leer, no a que le demos la turra con el XP.
    }
  }

  const observer = new IntersectionObserver((entries) => {
    if (done) return
    const visible = entries.some((e) => e.isIntersecting)
    if (!visible) {
      // Ha vuelto a subir antes de tiempo: se cancela la cuenta atrás.
      if (timer) { clearTimeout(timer); timer = null }
      return
    }
    const falta = MIN_READ_SECONDS * 1000 - (Date.now() - openedAt)
    if (falta <= 0) { marcar(); return }
    // En una guía corta el final ya se ve nada más abrir, y el
    // observador NO vuelve a dispararse porque la intersección no
    // cambia. Sin este temporizador, esas guías no se marcarían nunca.
    if (!timer) timer = setTimeout(marcar, falta)
  })
  observer.observe(sentinel)
}

async function init() {
  const main = document.getElementById('articleMain')
  if (!slug) {
    main.innerHTML = `<p class="empty-state">Guía no encontrada.</p>`
    return
  }

  const { data: guide, error } = await supabase
    .from('guides')
    .select('*, categories(name, slug)')
    .eq('slug', slug)
    .single()

  if (error || !guide) {
    main.innerHTML = `<p class="empty-state">Guía no encontrada.</p>`
    return
  }

  document.title = `${guide.title} — PokeDoc`
  supabase.from('guides').update({ view_count: (guide.view_count || 0) + 1 }).eq('id', guide.id)

  let author = null
  if (guide.author_id) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, display_name, username, avatar_url')
      .eq('id', guide.author_id)
      .single()
    author = data
  }
  const authorName = author ? author.display_name || author.username || 'un colaborador' : 'PokeDoc'
  const authorAvatarStyle = avatarStyle(author)
  // El rango de colaborador se enseña AQUÍ, junto al nombre, y no solo
  // en el perfil: el reconocimiento que hay que ir a buscar no
  // recompensa a nadie. Esta es la única pantalla donde a un autor lo
  // lee gente que no lo conoce.
  const authorBadge = author ? await contributorBadgeHtml(author.id) : ''
  // Quién ha ayudado a mejorarla. Va aquí, junto a la firma, porque es
  // donde se mira quién está detrás de lo que estás leyendo.
  const creditos = await creditosHtml(guide.id).catch(() => '')
  const opHeaderHtml = `
    <div class="guide-author">
      ${
        author
          ? `<a class="mini-avatar" href="${profileUrl(author)}" style="width:36px; height:36px; font-size:14px; ${authorAvatarStyle}">${author.avatar_url ? '' : getInitial(authorName)}</a>`
          : `<span class="mini-avatar" style="width:36px; height:36px; background-color:var(--navy); color:var(--white); display:flex; align-items:center; justify-content:center;">${icons.shield(18)}</span>`
      }
      <div>
        <span class="subtext" style="margin:0; display:block;">${
          // "Publicada por" es falso mientras está en revisión: no está
          // publicada. Se dice lo que sí es cierto — que la ha escrito.
          author ? (guide.review_status === 'pending' ? 'Escrita por' : 'Publicada por') : 'Guía oficial de'
        }</span>
        ${author ? `<a href="${profileUrl(author)}" style="font-weight:700; color:var(--navy);">${escapeHtml(authorName)}</a>${authorBadge}` : `<strong>${escapeHtml(authorName)}</strong>`}
      </div>
    </div>
    ${creditos}`

  const session = await getSession()
  const profile = session ? await getProfile(session.user.id) : null
  // ¿La está mirando quien la escribió? Se usa para ofrecerle seguir
  // editándola desde aquí mismo.
  const esMia = !!(session && guide.author_id && guide.author_id === session.user.id)
  // `mostrarPro` manda sobre todo lo de esta guía: si los planes están
  // ocultos no hay pestaña, no hay muro y ni siquiera se pide el contenido
  // Pro a la base — una consulta menos por visita.
  const mostrarPro = MOSTRAR_PLANES && guide.has_pro_content
  const proContent = mostrarPro
    ? (await supabase.from('guide_pro_content').select('*').eq('guide_id', guide.id).maybeSingle()).data
    : null

  const hasContent = Array.isArray(guide.reference_blocks) && guide.reference_blocks.length > 0
  // Las dos mitades de una guía —la teoría y el curso— viven en páginas
  // distintas y hasta ahora no se enlazaban entre sí: se leía la guía y
  // no había manera de enterarse de que existía un curso encima.
  const hayCurso = guideHasCourse(guide)

  const headings = []
  const bodyHtml = hasContent
    ? renderReferenceBlocksHtml(guide.reference_blocks, headings)
    : `<p>${escapeHtml(guide.description || 'Esta guía todavía no tiene contenido de referencia.')}</p>`

  const proBodyHtml = mostrarPro
    ? proContent
      ? renderReferenceBlocksHtml(proContent.blocks)
      : `
      <div class="empty-state pro-paywall">
        <span style="display:flex; justify-content:center;">${icons.star(32)}</span>
        <p style="margin-top: 8px;">Este contenido es exclusivo para usuarios Pro: ejemplos, consejos y trucos avanzados aparte de la documentación gratuita.</p>
        ${session ? '' : `<a href="auth.html" class="btn-primary" style="margin-top:12px;">Inicia sesión</a>`}
      </div>`
    : ''

  main.innerHTML = `
    <div class="breadcrumb">
      <a href="index.html">Inicio</a> <span>›</span>
      <a href="categoria.html?slug=${encodeURIComponent(guide.categories?.slug || '')}">${escapeHtml(guide.categories?.name || '')}</a>
      <span>›</span> <span>${escapeHtml(guide.title)}</span>
    </div>
    <div class="article-header">
      ${
        guide.review_status === 'pending'
          ? `<p class="subtext guia-aviso-pendiente">${icons.clock(14)} <span>Guía de la comunidad pendiente de revisión — todavía no la ha comprobado el equipo de PokeDoc.</span>${
              // Si quien la está mirando es quien la escribió, el aviso
              // deja de ser solo información y se convierte en el sitio
              // desde el que seguir. Es la pantalla donde el autor
              // relee lo que lleva escrito, así que es donde tiene que
              // estar el botón — no escondido en su perfil.
              esMia
                ? `<a class="btn-secondary guia-seguir-editando" href="editor-guia.html?id=${encodeURIComponent(guide.id)}">${icons.edit(14)} Seguir editando</a>`
                : ''
            }</p>`
          : ''
      }
      <span class="emoji-big">${contentIconHtml(guide.cover_emoji, 40, 'bookOpen')}</span>
      <span class="guide-label">${escapeHtml(guide.categories?.name || '')}</span>
      <h1>${escapeHtml(guide.title)}</h1>
      <p class="lead">${escapeHtml(guide.description || '')}</p>
      ${opHeaderHtml}
      <div class="article-meta">
        <span class="time-tag">${guide.estimated_mins || 5} min</span>
        <span class="time-tag">${LEVEL_LABELS[guide.level] || 'Básico'}</span>
        <span class="rarity-chip rarity-${guide.guide_rarity || 'bronze'}">${escapeHtml(guide.guide_rarity || 'bronze')}</span>
        ${MOSTRAR_PLANES ? `<span class="badge ${guide.is_pro ? 'badge-pro' : 'badge-free'}">${guide.is_pro ? 'Pro' : 'Gratis'}</span>` : ''}
        <!-- Los botones van en su propio grupo, no sueltos entre las
             etiquetas. Sueltos, el "margin-left: auto" lo llevaba solo
             Guardar: en cuanto la línea no cabía, Compartir se caía a la
             línea de abajo él solo y con el tamaño de botón grande. El
             grupo se envuelve entero o no se envuelve. -->
        <div class="guia-acciones">
          <button class="btn-secondary" id="btnSave">${icons.bookmark(14)} Guardar</button>
          ${
            // Compartir va aquí, junto a Guardar, y se le enseña también
            // a quien no tiene cuenta: es justo quien acaba de llegar de
            // fuera y quiere pasársela a alguien.
            compartirHtml('btnCompartir', { clase: 'btn-secondary' })
          }
          ${
            // Arriba va DISCRETO, junto a Guardar: quien ya sabe que
            // quiere el curso lo encuentra sin leerse la teoría entera, y
            // a quien viene a leer no le tapa nada. La llamada de verdad
            // va abajo, al terminar de leer.
            //
            // `guia-ir-al-curso` ya no lleva estilo propio —el tamaño lo
            // da el grupo—, pero la clase se queda: es el asidero por el
            // que encuentra este botón test-guia-curso.mjs.
            hayCurso
              ? `<a class="btn-secondary guia-ir-al-curso" href="curso.html?slug=${encodeURIComponent(guide.slug)}">${icons.zap(14)} Hacer el curso</a>`
              : ''
          }
        </div>
      </div>
    </div>
    ${
      mostrarPro
        ? `
    <div class="tabs" id="articleTabs">
      <button class="tab-btn active" data-atab="docu">${icons.bookOpen(15)} Básico</button>
      <button class="tab-btn" data-atab="pro">${icons.star(15)} Guía Pro</button>
    </div>
    <div class="tab-panel active" id="atab-docu"><div class="article-body">${bodyHtml}</div></div>
    <div class="tab-panel" id="atab-pro"><div class="article-body">${proBodyHtml}</div></div>`
        : `<div class="article-body">${bodyHtml}</div>`
    }
    <div id="articleEndSentinel" aria-hidden="true"></div>
    ${
      // Al terminar de leer, la pregunta que toca. Va ANTES de "me ha
      // servido" y de las estrellas a propósito: acabas de leer y lo
      // siguiente que quieres hacer es ponerlo a prueba, no puntuar.
      hayCurso
        ? `
    <div class="guia-cta-curso">
      <div>
        <h2>¿Te ha servido? Ponlo a prueba</h2>
        <p class="subtext">Esta guía tiene curso: preguntas, racha y medalla. Se tarda ${guide.estimated_mins || 5} minutos.</p>
      </div>
      <a class="btn-primary" href="curso.html?slug=${encodeURIComponent(guide.slug)}">${icons.zap(15)} Hacer el curso</a>
    </div>`
        : ''
    }
    <div id="guideHelpful"></div>
    <div id="guideSuggestion"></div>
    <div id="guideRating"></div>
    <div id="guideWriteInvite"></div>
    <section class="guide-forum">
      <h2 class="section-title">${icons.messageSquare(18)} Comentarios</h2>
      <div id="forumContainer"></div>
    </section>`

  document.getElementById('articleTabs')?.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('articleTabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
      document.querySelectorAll('.tab-panel[id^="atab-"]').forEach((p) => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`atab-${btn.dataset.atab}`).classList.add('active')
    })
  })

  // Las listas de cartas se guardan solo como identificadores; aquí se
  // rellenan con los datos de nuestra tabla. Va con .catch() porque una
  // lista que no cargue no puede tumbar el resto de la guía.
  hydrateDecks(main).catch(() => {})

  // "Me ha servido" va ANTES de las estrellas, y es a propósito: es lo
  // que va a pulsar la mayoría. Pedir una nota de 1 a 5 nada más
  // terminar de leer es pedir un juicio; esto solo pide un gracias.
  montarBotonHelpful(document.getElementById('guideHelpful'), guide, session).catch(() => {})

  // Sugerir una corrección va DESPUÉS de agradecer, y en tono menor: la
  // mayoría viene a leer, no a corregir. Pero quien ve un fallo lo ve
  // justo aquí, al terminar.
  montarSugerencia(document.getElementById('guideSuggestion'), guide, session).catch(() => {})

  // La valoración va al FINAL, después de haber leído. Antes solo se
  // podía valorar desde el pop-up de la tarjeta, o sea sin leer nada.
  renderRatingWidget(document.getElementById('guideRating'), {
    guideId: guide.id,
    session,
    guide,
  }).catch(() => {})

  // Invitación a escribir, al terminar de leer.
  //
  // Va aquí y no en un banner de la home porque el momento importa: quien
  // acaba de leerse una guía entera sobre un tema es justo quien puede
  // pensar "pues de esto yo sé otra cosa". En la home, la misma frase le
  // llega a alguien que todavía no sabe ni de qué va el sitio.
  //
  // Se le enseña solo a quien ha iniciado sesión: a quien está de paso,
  // pedirle que escriba una guía antes de tener cuenta es pedirle dos
  // cosas a la vez, y no hace ninguna.
  const invitacion = document.getElementById('guideWriteInvite')
  if (invitacion && session) {
    invitacion.innerHTML = `
      <p class="write-invite">
        ${icons.edit(14)} ¿Sabes algo que no está en PokeDoc?
        <a href="/editor-guia.html">Escribe tu propia guía</a> — no hace falta
        terminarla de una sentada, se guarda sola.
      </p>`
  }

  if (headings.length > 0) {
    document.getElementById('articleSidebar').innerHTML = `
      <h4>En esta guía</h4>
      ${headings.map((h) => `<a href="#${h.id}">${escapeHtml(h.text)}</a>`).join('')}`
  }

  const btnSave = document.getElementById('btnSave')
  if (!session) {
    btnSave.addEventListener('click', () => (window.location.href = 'auth.html'))
  } else {
    if ((profile?.saved_guides || []).includes(guide.id)) btnSave.innerHTML = `${icons.bookmark(14, true)} Guardado`
    btnSave.addEventListener('click', () => toggleSave(session, guide.id, btnSave))
  }

  engancharCompartir(document.getElementById('btnCompartir'), { titulo: guide.title })

  setupReadTracking(session, guide)

  initGuideForum({
    containerEl: document.getElementById('forumContainer'),
    guideId: guide.id,
    currentSession: session,
    isAdmin: !!profile?.is_admin,
    guideAuthorId: guide.author_id,
    guideTitle: guide.title,
    guideSlug: guide.slug,
  })
}

init()
