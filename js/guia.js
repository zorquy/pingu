import { supabase } from './supabase.js'
import { escapeHtml, getSession } from './app.js'

const params = new URLSearchParams(window.location.search)
const slug = params.get('slug')

function renderReferenceBlock(block, headings) {
  switch (block.type) {
    case 'heading': {
      const id = `section-${headings.length}`
      headings.push({ id, text: block.text })
      return `<h2 id="${id}">${escapeHtml(block.text || '')}</h2>`
    }
    case 'paragraph':
      return `<p>${escapeHtml(block.text || '')}</p>`
    case 'image':
      return `<img src="${block.url}" alt="${escapeHtml(block.caption || '')}" onerror="this.style.display='none'">`
    case 'list':
      return `<ul>${(block.items || []).map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`
    case 'highlight':
      return `<div class="block-highlight">${escapeHtml(block.text || '')}</div>`
    default:
      return ''
  }
}

async function toggleSave(session, guideId, btn) {
  const { data: existing } = await supabase
    .from('saved_guides')
    .select('id')
    .eq('user_id', session.user.id)
    .eq('guide_id', guideId)
    .maybeSingle()

  if (existing) {
    await supabase.from('saved_guides').delete().eq('id', existing.id)
    btn.textContent = '☆ Guardar'
  } else {
    await supabase.from('saved_guides').insert({ user_id: session.user.id, guide_id: guideId })
    btn.textContent = '★ Guardado'
  }
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

  const headings = []
  const bodyHtml = Array.isArray(guide.reference_blocks) && guide.reference_blocks.length > 0
    ? guide.reference_blocks.map((b) => renderReferenceBlock(b, headings)).join('')
    : `<p>${escapeHtml(guide.description || 'Esta guía todavía no tiene contenido de referencia.')}</p>`

  main.innerHTML = `
    <div class="breadcrumb">
      <a href="index.html">Inicio</a> <span>›</span>
      <a href="categoria.html?slug=${encodeURIComponent(guide.categories?.slug || '')}">${escapeHtml(guide.categories?.name || '')}</a>
      <span>›</span> <span>${escapeHtml(guide.title)}</span>
    </div>
    <div class="article-header">
      <span class="emoji-big">${guide.emoji || '📘'}</span>
      <span class="guide-label">${escapeHtml(guide.categories?.name || '')}</span>
      <h1>${escapeHtml(guide.title)}</h1>
      <p class="lead">${escapeHtml(guide.description || '')}</p>
      <div class="article-meta">
        <span class="time-tag">${guide.estimated_mins || 5} min</span>
        <span class="time-tag">${escapeHtml(guide.level || 'Básico')}</span>
        <span class="badge ${guide.badge === 'Pro' ? 'badge-pro' : 'badge-free'}">${guide.badge || 'Gratis'}</span>
        <button class="btn-secondary" id="btnSave" style="margin-left: auto; padding: 6px 12px; font-size: 13px;">☆ Guardar</button>
      </div>
    </div>
    <div class="article-body">${bodyHtml}</div>
    <div class="article-cta">
      <p>¿Quieres aprenderlo paso a paso?</p>
      <a href="curso.html?slug=${encodeURIComponent(guide.slug)}" class="btn-primary">Hacer el curso →</a>
    </div>`

  if (headings.length > 0) {
    document.getElementById('articleSidebar').innerHTML = `
      <h4>En esta guía</h4>
      ${headings.map((h) => `<a href="#${h.id}">${escapeHtml(h.text)}</a>`).join('')}`
  }

  const session = await getSession()
  const btnSave = document.getElementById('btnSave')
  if (!session) {
    btnSave.addEventListener('click', () => (window.location.href = 'auth.html'))
  } else {
    const { data: existing } = await supabase
      .from('saved_guides')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('guide_id', guide.id)
      .maybeSingle()
    if (existing) btnSave.textContent = '★ Guardado'
    btnSave.addEventListener('click', () => toggleSave(session, guide.id, btnSave))
  }
}

init()
