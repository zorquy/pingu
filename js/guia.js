import { supabase } from './supabase.js'
import { escapeHtml, getSession, getProfile, profileUrl } from './app.js'
import { parseBBCode } from './bbcode.js'

const params = new URLSearchParams(window.location.search)
const slug = params.get('slug')

const LEVEL_LABELS = { beginner: 'Básico', intermediate: 'Intermedio', advanced: 'Avanzado' }

function renderReferenceBlock(block, headings) {
  switch (block.type) {
    case 'heading': {
      const id = `section-${headings.length}`
      headings.push({ id, text: block.text })
      return `<h2 id="${id}">${escapeHtml(block.text || '')}</h2>`
    }
    case 'paragraph':
      return `<p>${parseBBCode(block.text || '')}</p>`
    case 'image':
      return `<img src="${block.url}" alt="${escapeHtml(block.caption || '')}" onerror="this.style.display='none'">`
    case 'list':
      return `<ul>${(block.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
    case 'highlight':
      return `<div class="block-highlight">${parseBBCode(block.text || '')}</div>`
    default:
      return ''
  }
}

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

  let authorHtml = ''
  if (guide.author_id) {
    const { data: author } = await supabase
      .from('user_profiles')
      .select('id, display_name, username')
      .eq('id', guide.author_id)
      .single()
    const authorName = author?.display_name || author?.username || 'un colaborador'
    authorHtml = `<p class="subtext" style="margin-top:-4px;">Guía enviada por <a href="${profileUrl(author)}" style="color:var(--navy); font-weight:700;">${escapeHtml(authorName)}</a></p>`
  }

  const session = await getSession()
  const profile = session ? await getProfile(session.user.id) : null

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
    bodyHtml = guide.reference_blocks.map((b) => renderReferenceBlock(b, headings)).join('')
  }

  main.innerHTML = `
    <div class="breadcrumb">
      <a href="index.html">Inicio</a> <span>›</span>
      <a href="categoria.html?slug=${encodeURIComponent(guide.categories?.slug || '')}">${escapeHtml(guide.categories?.name || '')}</a>
      <span>›</span> <span>${escapeHtml(guide.title)}</span>
    </div>
    <div class="article-header">
      <span class="emoji-big">${guide.cover_emoji || '📘'}</span>
      <span class="guide-label">${escapeHtml(guide.categories?.name || '')}</span>
      <h1>${escapeHtml(guide.title)}</h1>
      <p class="lead">${escapeHtml(guide.description || '')}</p>
      ${authorHtml}
      <div class="article-meta">
        <span class="time-tag">${guide.estimated_mins || 5} min</span>
        <span class="time-tag">${LEVEL_LABELS[guide.level] || 'Básico'}</span>
        <span class="rarity-chip rarity-${guide.guide_rarity || 'bronze'}">${escapeHtml(guide.guide_rarity || 'bronze')}</span>
        <span class="badge ${guide.is_pro ? 'badge-pro' : 'badge-free'}">${guide.is_pro ? 'Pro' : 'Gratis'}</span>
        <button class="btn-secondary" id="btnSave" style="margin-left: auto; padding: 6px 12px; font-size: 13px;">☆ Guardar</button>
      </div>
    </div>
    <div class="article-body">${bodyHtml}</div>
    <div class="article-cta">
      <p>¿Quieres aprenderlo paso a paso?</p>
      <a href="curso.html?slug=${encodeURIComponent(guide.slug)}" class="btn-primary">Hacer el curso →</a>
    </div>`

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
}

init()
