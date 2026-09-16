// La tarjeta ANCHA de una guía: icono a la izquierda, dos botones a la
// derecha. La pinta UNA sola pantalla, /categoria, y por eso vive aparte
// desde la tanda 316 — con su CSS en css/categoria.css.
//
// No confundir con js/guia-tarjeta.js, que es la tarjeta VERTICAL con
// franja de color de la portada y de /aprender. Son dos formas distintas
// a propósito: en una categoría puede haber decenas de guías y se leen
// mejor en filas anchas.
import { escapeHtml, borderRarityClass, guideHasCourse, guideHasReference } from './app.js'
import { icons } from './icons.js'
import { contentIconHtml } from './content-icon.js'
import { MOSTRAR_PLANES } from './planes.js'

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
  <div class="guide-card ${borderRarityClass(guide.guide_rarity)}" data-guide-id="${guide.id}" data-author-id="${escapeHtml(guide.author_id || '')}" data-slug="${escapeHtml(guide.slug || '')}" data-has-guide="${hasGuide ? '1' : ''}" data-has-course="${hasCourse ? '1' : ''}" tabindex="0" role="link">
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
        <span data-card-medalla></span>
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

