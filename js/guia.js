import { supabase } from './supabase.js'
import { escapeHtml, getInitial, getSession, getProfile, profileUrl, avatarStyle } from './app.js'
import { renderReferenceBlocksHtml } from './block-editor.js'
import { hydrateDecks } from './cards-block.js'
import { renderRatingWidget } from './guide-rating.js'
import { initGuideForum } from './guide-forum.js'
import { markGuideRead, READ_XP } from './gamification.js'
import { showToast } from './toast.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'

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
  const opHeaderHtml = `
    <div class="guide-author">
      ${
        author
          ? `<a class="mini-avatar" href="${profileUrl(author)}" style="width:36px; height:36px; font-size:14px; ${authorAvatarStyle}">${author.avatar_url ? '' : getInitial(authorName)}</a>`
          : `<span class="mini-avatar" style="width:36px; height:36px; background-color:var(--navy); color:var(--white); display:flex; align-items:center; justify-content:center;">${icons.shield(18)}</span>`
      }
      <div>
        <span class="subtext" style="margin:0; display:block;">${author ? 'Publicada por' : 'Guía oficial de'}</span>
        ${author ? `<a href="${profileUrl(author)}" style="font-weight:700; color:var(--navy);">${escapeHtml(authorName)}</a>` : `<strong>${escapeHtml(authorName)}</strong>`}
      </div>
    </div>`

  const session = await getSession()
  const profile = session ? await getProfile(session.user.id) : null
  const proContent = guide.has_pro_content
    ? (await supabase.from('guide_pro_content').select('*').eq('guide_id', guide.id).maybeSingle()).data
    : null

  const hasContent = Array.isArray(guide.reference_blocks) && guide.reference_blocks.length > 0

  const headings = []
  const bodyHtml = hasContent
    ? renderReferenceBlocksHtml(guide.reference_blocks, headings)
    : `<p>${escapeHtml(guide.description || 'Esta guía todavía no tiene contenido de referencia.')}</p>`

  const proBodyHtml = guide.has_pro_content
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
          ? `<p class="subtext" style="background:var(--ice); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:10px; display:flex; align-items:center; gap:6px;">${icons.clock(14)} Guía de la comunidad pendiente de revisión — todavía no la ha comprobado el equipo de PokeDoc.</p>`
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
        <span class="badge ${guide.is_pro ? 'badge-pro' : 'badge-free'}">${guide.is_pro ? 'Pro' : 'Gratis'}</span>
        <button class="btn-secondary" id="btnSave" style="margin-left: auto; padding: 6px 12px; font-size: 13px;">${icons.bookmark(14)} Guardar</button>
      </div>
    </div>
    ${
      guide.has_pro_content
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
