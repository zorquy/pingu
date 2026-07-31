import { supabase } from './supabase.js'
import { escapeHtml, getInitial, getSession, getProfile, profileUrl } from './app.js'
import { renderReferenceBlocksHtml } from './block-editor.js'
import { initGuideForum } from './guide-forum.js'

const params = new URLSearchParams(window.location.search)
const slug = params.get('slug')

const LEVEL_LABELS = { beginner: 'Básico', intermediate: 'Intermedio', advanced: 'Avanzado' }

async function toggleSave(session, guideId, btn) {
  const profile = await getProfile(session.user.id)
  const saved = profile?.saved_guides || []
  const isSaved = saved.includes(guideId)
  const next = isSaved ? saved.filter((id) => id !== guideId) : [...saved, guideId]
  await supabase.from('user_profiles').update({ saved_guides: next }).eq('id', session.user.id)
  btn.textContent = isSaved ? '☆ Guardar' : '★ Guardado'
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
      .select('id, display_name, username, avatar_url, avatar_color')
      .eq('id', guide.author_id)
      .single()
    author = data
  }
  const authorName = author ? author.display_name || author.username || 'un colaborador' : 'PokeDoc'
  const authorAvatarStyle = author?.avatar_url
    ? `background-image:url('${author.avatar_url.replace(/'/g, '%27')}')`
    : `background-color:${author?.avatar_color || 'var(--navy)'}`
  const opHeaderHtml = `
    <div class="guide-modal-author">
      ${
        author
          ? `<a class="mini-avatar" href="${profileUrl(author)}" style="width:36px; height:36px; font-size:14px; ${authorAvatarStyle}">${author.avatar_url ? '' : getInitial(authorName)}</a>`
          : `<span class="mini-avatar" style="width:36px; height:36px; font-size:16px; background-color:var(--navy);">🛡️</span>`
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

  const isUnlocked =
    guide.reference_unlocked_by_default || (profile?.unlocked_references || []).includes(guide.id)
  const hasContent = Array.isArray(guide.reference_blocks) && guide.reference_blocks.length > 0

  const headings = []
  let bodyHtml
  if (!hasContent) {
    bodyHtml = `<p>${escapeHtml(guide.description || 'Esta guía todavía no tiene contenido de referencia.')}</p>`
  } else if (!isUnlocked) {
    bodyHtml = `
      <div class="empty-state" style="border: 1px dashed var(--border); border-radius: var(--radius-lg); padding: 32px;">
        <span style="font-size: 32px;">🔒</span>
        <p style="margin-top: 8px;">Completa el curso de esta guía para desbloquear el artículo de referencia.</p>
      </div>`
  } else {
    bodyHtml = renderReferenceBlocksHtml(guide.reference_blocks, headings)
  }

  const proBodyHtml = guide.has_pro_content
    ? proContent
      ? renderReferenceBlocksHtml(proContent.blocks)
      : `
      <div class="empty-state pro-paywall">
        <span style="font-size: 32px;">🌟</span>
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
          ? `<p class="subtext" style="background:var(--ice); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:10px;">🕓 Guía de la comunidad pendiente de revisión — todavía no la ha comprobado el equipo de PokeDoc.</p>`
          : ''
      }
      <span class="emoji-big">${escapeHtml(guide.cover_emoji || '📘')}</span>
      <span class="guide-label">${escapeHtml(guide.categories?.name || '')}</span>
      <h1>${escapeHtml(guide.title)}</h1>
      <p class="lead">${escapeHtml(guide.description || '')}</p>
      ${opHeaderHtml}
      <div class="article-meta">
        <span class="time-tag">${guide.estimated_mins || 5} min</span>
        <span class="time-tag">${LEVEL_LABELS[guide.level] || 'Básico'}</span>
        <span class="rarity-chip rarity-${guide.guide_rarity || 'bronze'}">${escapeHtml(guide.guide_rarity || 'bronze')}</span>
        <span class="badge ${guide.is_pro ? 'badge-pro' : 'badge-free'}">${guide.is_pro ? 'Pro' : 'Gratis'}</span>
        <button class="btn-secondary" id="btnSave" style="margin-left: auto; padding: 6px 12px; font-size: 13px;">☆ Guardar</button>
      </div>
    </div>
    ${
      guide.has_pro_content
        ? `
    <div class="tabs" id="articleTabs">
      <button class="tab-btn active" data-atab="docu">📖 Documentación</button>
      <button class="tab-btn" data-atab="pro">🌟 Guía Pro</button>
    </div>
    <div class="tab-panel active" id="atab-docu"><div class="article-body">${bodyHtml}</div></div>
    <div class="tab-panel" id="atab-pro"><div class="article-body">${proBodyHtml}</div></div>`
        : `<div class="article-body">${bodyHtml}</div>`
    }
    <section class="guide-forum">
      <h2 class="section-title">💬 Comentarios</h2>
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

  if (headings.length > 0 && isUnlocked) {
    document.getElementById('articleSidebar').innerHTML = `
      <h4>En esta guía</h4>
      ${headings.map((h) => `<a href="#${h.id}">${escapeHtml(h.text)}</a>`).join('')}`
  }

  const btnSave = document.getElementById('btnSave')
  if (!session) {
    btnSave.addEventListener('click', () => (window.location.href = 'auth.html'))
  } else {
    if ((profile?.saved_guides || []).includes(guide.id)) btnSave.textContent = '★ Guardado'
    btnSave.addEventListener('click', () => toggleSave(session, guide.id, btnSave))
  }

  initGuideForum({ containerEl: document.getElementById('forumContainer'), guideId: guide.id, currentSession: session })
}

init()
