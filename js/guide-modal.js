import { supabase } from './supabase.js'
import { escapeHtml, getSession, getProfile, getInitial, profileUrl, borderRarityClass, guideHasCourse } from './app.js'
import { renderWall } from './wall.js'
import { reportButtonHtml, wireReportButtons } from './report.js'
import { createNotification } from './notifications.js'
import { icons } from './icons.js'

export function starsHtml(rating, size = 16) {
  return Array.from({ length: 5 })
    .map((_, i) => `<span style="font-size:${size}px; color:${i < Math.round(rating) ? 'var(--warning)' : 'var(--border)'};">★</span>`)
    .join('')
}

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
export function renderGuideCardHtml(guide, { statusBadge = 'none', categoryLabel = '', reviewBadge = null } = {}) {
  const courseLabel = statusBadge === 'completed' ? 'Repasar' : `${icons.graduationCap(15)} Curso`
  const hasCourse = guideHasCourse(guide)
  const courseBtn = hasCourse
    ? `<a href="curso.html?slug=${encodeURIComponent(guide.slug)}" class="btn-course" onclick="event.stopPropagation()">${courseLabel}</a>`
    : `<span class="btn-course" style="opacity:.4; cursor:not-allowed;">${icons.graduationCap(15)} Curso</span>`
  const guideBtn = guide.has_reference_blocks
    ? `<a href="guia.html?slug=${encodeURIComponent(guide.slug)}" class="btn-guide" onclick="event.stopPropagation()">${icons.bookOpen(15)} Guía</a>`
    : `<span class="btn-guide" style="opacity:.4; cursor:not-allowed;">${icons.bookOpen(15)} Guía</span>`

  return `
  <div class="guide-card ${borderRarityClass(guide.guide_rarity)}" data-guide-id="${guide.id}">
    <div class="guide-card-icon">${escapeHtml(guide.cover_emoji || '📘')}</div>
    <div class="guide-card-info">
      ${categoryLabel ? `<span class="guide-label">${escapeHtml(categoryLabel)}</span>` : ''}
      <h3 title="${escapeHtml(guide.title)}">${escapeHtml(guide.title)}</h3>
      <p title="${escapeHtml(guide.description || '')}">${escapeHtml(guide.description || '')}</p>
      <div class="guide-meta">
        <span class="badge ${guide.is_pro ? 'badge-pro' : 'badge-free'}">${guide.is_pro ? 'Pro' : 'Gratis'}</span>
        <span class="time-tag">${guide.estimated_mins || 5} min</span>
        <span class="rarity-chip rarity-${guide.guide_rarity || 'bronze'}">${escapeHtml(guide.guide_rarity || 'bronze')}</span>
        ${hasCourse && statusBadge === 'started' ? '<span class="badge badge-progress">EN PROGRESO</span>' : ''}
        ${hasCourse && statusBadge === 'completed' ? '<span class="badge badge-completed">✓ COMPLETADO</span>' : ''}
        ${reviewBadge ? `<span class="badge ${guide.review_status === 'approved' ? 'badge-completed' : 'badge-pro'}">${escapeHtml(reviewBadge)}</span>` : ''}
      </div>
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
export async function decorateGuideCards(containerEl, session) {
  const cards = Array.from(containerEl.querySelectorAll('[data-guide-id]'))
  const ids = cards.map((c) => c.dataset.guideId)
  if (ids.length === 0) return

  const [stats, savedIds] = await Promise.all([getRatingStats(ids), getSavedIds(session)])

  cards.forEach((card) => {
    const id = card.dataset.guideId
    const ratingEl = card.querySelector('[data-card-rating]')
    if (ratingEl) {
      const s = stats[id]
      ratingEl.innerHTML = s ? `${starsHtml(s.sum / s.count, 12)} ${(s.sum / s.count).toFixed(1)}` : 'Sin valorar'
    }

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

// ── Widget de valoración (solo estrellas, dentro del modal) ──
async function loadRatingWidget(guideId, session, container, guide = null) {
  const { data } = await supabase.from('guide_reviews').select('*').eq('guide_id', guideId)
  const reviews = data || []
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null

  const summary = `<div class="guide-modal-rating-summary">${
    avg ? `${starsHtml(avg)} ${avg.toFixed(1)} (${reviews.length})` : 'Todavía sin valoraciones — ¡sé el primero!'
  }</div>`

  if (!session) {
    container.innerHTML = `${summary}<p class="subtext"><a href="auth.html" style="color:var(--navy); font-weight:700;">Inicia sesión</a> para valorar esta guía.</p>`
    return
  }

  const mine = reviews.find((r) => r.reviewer_id === session.user.id)
  let selected = mine?.rating || 0

  container.innerHTML = `
    ${summary}
    <div class="star-picker" id="guideStarPicker">
      ${[1, 2, 3, 4, 5].map((v) => `<span class="star-pick" data-value="${v}">★</span>`).join('')}
    </div>`

  function renderStars() {
    container.querySelectorAll('.star-pick').forEach((s) => s.classList.toggle('selected', Number(s.dataset.value) <= selected))
  }
  renderStars()

  container.querySelectorAll('.star-pick').forEach((s) =>
    s.addEventListener('click', async () => {
      selected = Number(s.dataset.value)
      renderStars()
      const isNewRating = !mine
      await supabase
        .from('guide_reviews')
        .upsert({ guide_id: guideId, reviewer_id: session.user.id, rating: selected }, { onConflict: 'guide_id,reviewer_id' })
      if (isNewRating && guide?.author_id) {
        await createNotification({
          recipientId: guide.author_id,
          actorId: session.user.id,
          type: 'guide_rating',
          title: 'Nueva valoración en tu guía',
          body: `${'★'.repeat(selected)} en "${guide.title}"`,
          link: `/guia.html?slug=${guide.slug}`,
        })
      }
      await loadRatingWidget(guideId, session, container, guide)
    })
  )
}

// ── Modal ampliado ──
export async function openGuideModal(guideId) {
  const modal = document.getElementById('guideModal')
  const content = document.getElementById('guideModalContent')
  if (!modal || !content) return

  content.innerHTML = `<p class="empty-state">Cargando…</p>`
  modal.classList.remove('hidden')

  const [{ data: guide }, session] = await Promise.all([
    supabase.from('guides').select('*, categories(name)').eq('id', guideId).single(),
    getSession(),
  ])
  const viewerProfile = session ? await getProfile(session.user.id) : null

  if (!guide) {
    content.innerHTML = `<p class="empty-state">Guía no encontrada.</p>`
    return
  }

  let author = null
  if (guide.author_id) {
    const { data } = await supabase
      .from('user_profiles')
      .select('id, display_name, username, avatar_url, avatar_color')
      .eq('id', guide.author_id)
      .single()
    author = data
  }

  const authorName = author ? author.display_name || author.username || 'un colaborador' : null
  const authorAvatarStyle = author?.avatar_url
    ? `background-image:url('${author.avatar_url.replace(/'/g, '%27')}')`
    : `background-color:${author?.avatar_color || 'var(--navy)'}`

  const authorHtml = author
    ? `
    <div class="guide-modal-author">
      <span class="mini-avatar" style="width:36px; height:36px; font-size:14px; ${authorAvatarStyle}">${author.avatar_url ? '' : getInitial(authorName)}</span>
      <div>
        <span class="subtext" style="margin:0; display:block;">Creador</span>
        <a href="${profileUrl(author)}" style="font-weight:700; color:var(--navy);">${escapeHtml(authorName)}</a>
      </div>
    </div>`
    : `
    <div class="guide-modal-author">
      <span class="mini-avatar" style="width:36px; height:36px; background-color:var(--navy); color:var(--white); display:flex; align-items:center; justify-content:center;">${icons.shield(18)}</span>
      <div>
        <span class="subtext" style="margin:0; display:block;">Creador</span>
        <span style="font-weight:700;">Guía oficial de PokeDoc</span>
      </div>
    </div>`

  const bannerStyle = guide.cover_image
    ? `background:url('${guide.cover_image.replace(/'/g, '%27')}') center/cover;`
    : `background:var(--ice);`

  let isSaved = false
  if (session) {
    const savedIds = await getSavedIds(session)
    isSaved = savedIds.includes(guide.id)
  }

  content.innerHTML = `
    <div class="guide-modal-banner" style="${bannerStyle}">${!guide.cover_image ? `<span class="guide-modal-banner-emoji">${escapeHtml(guide.cover_emoji || '📘')}</span>` : ''}</div>
    ${
      guide.review_status === 'pending'
        ? `<p class="subtext" style="background:var(--ice); padding:8px 12px; border-radius:var(--radius-sm); margin-bottom:10px; display:flex; align-items:center; gap:6px;">${icons.clock(14)} Guía de la comunidad pendiente de revisión — todavía no la ha comprobado el equipo de PokeDoc.</p>`
        : ''
    }
    <span class="guide-label">${escapeHtml(guide.categories?.name || '')}</span>
    <h3>${escapeHtml(guide.title)}</h3>
    <p class="guide-modal-desc">${escapeHtml(guide.description || '')}</p>
    <div class="guide-meta" style="margin-bottom:14px;">
      <span class="badge ${guide.is_pro ? 'badge-pro' : 'badge-free'}">${guide.is_pro ? 'Pro' : 'Gratis'}</span>
      <span class="time-tag">${guide.estimated_mins || 5} min</span>
      <span class="rarity-chip rarity-${guide.guide_rarity || 'bronze'}">${escapeHtml(guide.guide_rarity || 'bronze')}</span>
    </div>
    ${authorHtml}
    <div class="guide-modal-rating" id="guideModalRating"></div>
    <div class="modal-actions" style="flex-direction:row; margin-top:16px; align-items:center;">
      <button class="btn-outline" id="guideModalSaveBtn">${icons.bookmark(16, isSaved)} ${isSaved ? 'Guardado' : 'Guardar'}</button>
      ${
        guide.has_reference_blocks
          ? `<a href="guia.html?slug=${encodeURIComponent(guide.slug)}" class="btn-guide">${icons.bookOpen(16)} Guía</a>`
          : `<span class="btn-guide" style="opacity:.4; cursor:not-allowed;">${icons.bookOpen(16)} Guía</span>`
      }
      ${
        guideHasCourse(guide)
          ? `<a href="curso.html?slug=${encodeURIComponent(guide.slug)}" class="btn-course">${icons.graduationCap(16)} Curso</a>`
          : `<span class="btn-course" style="opacity:.4; cursor:not-allowed;">${icons.graduationCap(16)} Curso</span>`
      }
      ${session ? `<span style="margin-left:auto;">${reportButtonHtml('guide', guide.id)}</span>` : ''}
    </div>
    <h3 style="margin-top:20px;">Comentarios</h3>
    <div id="guideModalCommentsForm" style="margin-bottom:12px;"></div>
    <div id="guideModalCommentsList"></div>`

  const saveBtn = document.getElementById('guideModalSaveBtn')
  if (!session) {
    saveBtn.addEventListener('click', () => (window.location.href = 'auth.html'))
  } else {
    saveBtn.classList.toggle('is-saved', isSaved)
    saveBtn.addEventListener('click', async () => {
      const nowSaved = await toggleSaved(session, guide.id)
      saveBtn.innerHTML = `${icons.bookmark(16, nowSaved)} ${nowSaved ? 'Guardado' : 'Guardar'}`
      saveBtn.classList.toggle('is-saved', nowSaved)
    })
  }

  wireReportButtons(content, session)
  await loadRatingWidget(guide.id, session, document.getElementById('guideModalRating'), guide)
  await renderWall({
    listEl: document.getElementById('guideModalCommentsList'),
    formEl: document.getElementById('guideModalCommentsForm'),
    profileId: guide.id,
    currentSession: session,
    table: 'guide_comments',
    idField: 'guide_id',
    placeholder: 'Comenta esta guía...',
    emptyMessage: 'Todavía no hay comentarios en esta guía.<br>¡Sé el primero en comentar!',
    isAdmin: !!viewerProfile?.is_admin,
  })
}

export function setupGuideModalClose(onClose) {
  const close = () => {
    document.getElementById('guideModal').classList.add('hidden')
    onClose?.()
  }
  document.getElementById('guideModalClose')?.addEventListener('click', close)
  document.getElementById('guideModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'guideModal') close()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !document.getElementById('guideModal')?.classList.contains('hidden')) close()
  })
}
