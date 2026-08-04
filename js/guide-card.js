// Tarjeta de guía compartida (categoría, home, guardados, perfiles).
//
// Antes esto traía además un pop-up ampliado. Se quitó: pinchar una
// tarjeta abría una ventana cuyas únicas salidas eran "Guía" y "Curso",
// los mismos dos botones que ya tiene la tarjeta. Era un clic de más que
// no acercaba al contenido.
//
// Peor aún, dentro se podía comentar y valorar una guía SIN HABERLA
// ABIERTO. Los comentarios ya viven dentro de la guía (mismo hilo, se
// pintaba en dos sitios) y la valoración se movió al final de la guía y
// del curso (js/guide-rating.js).
import { supabase } from './supabase.js'
import { escapeHtml, getSession, profileUrl, borderRarityClass, guideHasCourse, guideHasReference } from './app.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'
import { MOSTRAR_PLANES } from './planes.js'
import { starsHtml as _stars } from './guide-rating.js'

export { starsHtml } from './guide-rating.js'

export async function toggleSaved(session, guideId) {
  const { data: profile } = await supabase.from('user_profiles').select('saved_guides').eq('id', session.user.id).single()
  const saved = profile?.saved_guides || []
  const isSaved = saved.includes(guideId)
  const next = isSaved ? saved.filter((id) => id !== guideId) : [...saved, guideId]
  await supabase.from('user_profiles').update({ saved_guides: next }).eq('id', session.user.id)
  return !isSaved
}

async function getSavedIds(session) {
  if (!session) return []
  const { data: profile } = await supabase.from('user_profiles').select('saved_guides').eq('id', session.user.id).single()
  return profile?.saved_guides || []
}

async function getRatingStats(guideIds) {
  if (guideIds.length === 0) return {}
  const { data } = await supabase.from('guide_reviews').select('guide_id, rating').in('guide_id', guideIds)
  const stats = {}
  ;(data || []).forEach((r) => {
    const s = stats[r.guide_id] || { sum: 0, count: 0 }
    s.sum += r.rating
    s.count += 1
    stats[r.guide_id] = s
  })
  return stats
}

// ── Tarjeta de guía (usada en categoria.html, la home, guardados.html y
// la sección de Comunidad) ──
export function renderGuideCardHtml(guide, { statusBadge = 'none', categoryLabel = '', reviewBadge = null, isRead = false } = {}) {
  const courseLabel = statusBadge === 'completed' ? 'Repasar' : `${icons.graduationCap(15)} Curso`
  const hasCourse = guideHasCourse(guide)
  const courseBtn = hasCourse
    ? `<a href="curso.html?slug=${encodeURIComponent(guide.slug)}" class="btn-course" onclick="event.stopPropagation()">${courseLabel}</a>`
    : `<span class="btn-course" style="opacity:.4; cursor:not-allowed;">${icons.graduationCap(15)} Curso</span>`
  const hasGuide = guideHasReference(guide)
  const guideBtn = hasGuide
    ? `<a href="guia.html?slug=${encodeURIComponent(guide.slug)}" class="btn-guide" onclick="event.stopPropagation()">${icons.bookOpen(15)} Guía</a>`
    : `<span class="btn-guide" style="opacity:.4; cursor:not-allowed;">${icons.bookOpen(15)} Guía</span>`

  return `
  <div class="guide-card ${borderRarityClass(guide.guide_rarity)}" data-guide-id="${guide.id}" data-author-id="${escapeHtml(guide.author_id || '')}" data-slug="${escapeHtml(guide.slug || '')}" data-has-guide="${hasGuide ? '1' : ''}" tabindex="0" role="link">
    <div class="guide-card-icon${guide.cover_image ? ' has-cover' : ''}"${
      guide.cover_image ? ` style="background-image:url('${guide.cover_image.replace(/'/g, '%27')}')"` : ''
    }>${guide.cover_image ? '' : contentIconHtml(guide.cover_emoji, 22, 'bookOpen')}</div>
    <div class="guide-card-info">
      ${categoryLabel ? `<span class="guide-label">${escapeHtml(categoryLabel)}</span>` : ''}
      <h3 title="${escapeHtml(guide.title)}">${escapeHtml(guide.title)}</h3>
      <p title="${escapeHtml(guide.description || '')}">${escapeHtml(guide.description || '')}</p>
      <div class="guide-meta">
        ${MOSTRAR_PLANES ? `<span class="badge ${guide.is_pro ? 'badge-pro' : 'badge-free'}">${guide.is_pro ? 'Pro' : 'Gratis'}</span>` : ''}
        <span class="time-tag">${guide.estimated_mins || 5} min</span>
        <span class="rarity-chip rarity-${guide.guide_rarity || 'bronze'}">${escapeHtml(guide.guide_rarity || 'bronze')}</span>
        ${isRead ? '<span class="badge badge-read">✓ LEÍDA</span>' : ''}
        ${hasCourse && statusBadge === 'started' ? '<span class="badge badge-progress">EN PROGRESO</span>' : ''}
        ${hasCourse && statusBadge === 'completed' ? '<span class="badge badge-completed">✓ COMPLETADO</span>' : ''}
        ${reviewBadge ? `<span class="badge ${guide.review_status === 'approved' ? 'badge-completed' : 'badge-pro'}">${escapeHtml(reviewBadge)}</span>` : ''}
      </div>
      <div class="guide-card-author" data-card-author></div>
      <div class="guide-card-social">
        <button class="card-save-btn" data-card-save title="Guardar" aria-label="Guardar" onclick="event.stopPropagation()">${icons.bookmark(16)}</button>
        <span class="card-rating" data-card-rating>Sin valorar</span>
      </div>
    </div>
    <div class="guide-actions">
      ${guideBtn}
      ${courseBtn}
    </div>
  </div>`
}

// Rellena el estado de guardado y la valoración media de las tarjetas ya
// pintadas en containerEl (deben tener data-guide-id), y engancha el botón
// de guardar rápido. No toca el click de abrir el modal — eso lo hace cada
// página, ya que varía según cómo esté montada la lista.
// Quién ha escrito cada guía. En una web sobre detectar falsificaciones
// la autoría pesa: no es lo mismo un consejo del equipo que uno de
// alguien que se registró ayer. Antes solo se veía abriendo el pop-up.
async function autoresPorId(ids) {
  const unicos = [...new Set(ids.filter(Boolean))]
  if (unicos.length === 0) return {}
  const { data } = await supabase.from('user_profiles').select('id, username, display_name').in('id', unicos)
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

function autorHtml(autor) {
  if (!autor) return `<span class="autor-oficial">${icons.shield(13)} Guía oficial</span>`
  const nombre = autor.display_name || autor.username || 'un colaborador'
  return `<a href="${profileUrl(autor)}" class="autor-link" onclick="event.stopPropagation()">${icons.user(13)} ${escapeHtml(nombre)}</a>`
}

export async function decorateGuideCards(containerEl, session) {
  const cards = Array.from(containerEl.querySelectorAll('[data-guide-id]'))
  const ids = cards.map((c) => c.dataset.guideId)
  if (ids.length === 0) return

  const autorIds = cards.map((c) => c.dataset.authorId).filter(Boolean)
  const [stats, savedIds, autores] = await Promise.all([getRatingStats(ids), getSavedIds(session), autoresPorId(autorIds)])

  cards.forEach((card) => {
    const id = card.dataset.guideId
    const ratingEl = card.querySelector('[data-card-rating]')
    if (ratingEl) {
      const s = stats[id]
      ratingEl.innerHTML = s ? `${_stars(s.sum / s.count, 12)} ${(s.sum / s.count).toFixed(1)}` : 'Sin valorar'
    }

    const autorEl = card.querySelector('[data-card-author]')
    if (autorEl) autorEl.innerHTML = autorHtml(autores[card.dataset.authorId] || null)

    const saveBtn = card.querySelector('[data-card-save]')
    if (!saveBtn) return
    const isSaved = savedIds.includes(id)
    saveBtn.innerHTML = icons.bookmark(16, isSaved)
    saveBtn.setAttribute('aria-label', isSaved ? 'Quitar de guardados' : 'Guardar')
    saveBtn.classList.toggle('is-saved', isSaved)
    saveBtn.addEventListener('click', async (e) => {
      e.stopPropagation()
      if (!session) {
        window.location.href = 'auth.html'
        return
      }
      const nowSaved = await toggleSaved(session, id)
      saveBtn.innerHTML = icons.bookmark(16, nowSaved)
      saveBtn.setAttribute('aria-label', nowSaved ? 'Quitar de guardados' : 'Guardar')
      saveBtn.classList.toggle('is-saved', nowSaved)
    })
  })
}


// Pinchar una tarjeta lleva DIRECTO al contenido. Antes abría un pop-up
// cuyas dos salidas eran los mismos botones que la propia tarjeta ya
// tiene, así que solo añadía un clic.
//
// Va a la guía si la tiene; si es solo curso, al curso. Una tarjeta sin
// ninguna de las dos no lleva a ningún sitio y no debe fingir que sí.
export function wireGuideCardClicks(containerEl) {
  containerEl.querySelectorAll('[data-guide-id]').forEach((card) => {
    const slug = card.dataset.slug
    if (!slug) return
    const destino = card.dataset.hasGuide
      ? `guia.html?slug=${encodeURIComponent(slug)}`
      : `curso.html?slug=${encodeURIComponent(slug)}`
    const ir = () => { window.location.href = destino }
    card.addEventListener('click', ir)
    // Con teclado: la tarjeta es un enlace a efectos prácticos.
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        ir()
      }
    })
  })
}
