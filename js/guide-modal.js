import { supabase } from './supabase.js'
import { escapeHtml, getSession, profileUrl } from './app.js'

function starsHtml(rating, size = 16) {
  return Array.from({ length: 5 })
    .map((_, i) => `<span style="font-size:${size}px; color:${i < Math.round(rating) ? 'var(--warning)' : 'var(--border)'};">★</span>`)
    .join('')
}

async function toggleSaved(session, guideId, btn) {
  const { data: profile } = await supabase.from('user_profiles').select('saved_guides').eq('id', session.user.id).single()
  const saved = profile?.saved_guides || []
  const isSaved = saved.includes(guideId)
  const next = isSaved ? saved.filter((id) => id !== guideId) : [...saved, guideId]
  await supabase.from('user_profiles').update({ saved_guides: next }).eq('id', session.user.id)
  btn.textContent = isSaved ? '☆ Guardar' : '★ Guardado'
  btn.classList.toggle('is-saved', !isSaved)
}

async function loadReviews(guideId, session, container) {
  const { data } = await supabase.from('guide_reviews').select('*').eq('guide_id', guideId).order('created_at', { ascending: false })
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
    </div>
    <textarea id="guideReviewBody" placeholder="Comenta esta guía (opcional)">${escapeHtml(mine?.body || '')}</textarea>
    <button class="btn-secondary" id="btnSubmitGuideReview" style="margin-top:8px;">${mine ? 'Actualizar valoración' : 'Valorar'}</button>`

  function renderStars() {
    container.querySelectorAll('.star-pick').forEach((s) => s.classList.toggle('selected', Number(s.dataset.value) <= selected))
  }
  renderStars()

  container.querySelectorAll('.star-pick').forEach((s) =>
    s.addEventListener('click', () => {
      selected = Number(s.dataset.value)
      renderStars()
    })
  )

  container.querySelector('#btnSubmitGuideReview').addEventListener('click', async () => {
    if (!selected) {
      alert('Elige una valoración de 1 a 5 estrellas.')
      return
    }
    const body = container.querySelector('#guideReviewBody').value.trim()
    await supabase
      .from('guide_reviews')
      .upsert({ guide_id: guideId, reviewer_id: session.user.id, rating: selected, body }, { onConflict: 'guide_id,reviewer_id' })
    await loadReviews(guideId, session, container)
  })
}

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

  if (!guide) {
    content.innerHTML = `<p class="empty-state">Guía no encontrada.</p>`
    return
  }

  let authorHtml = ''
  if (guide.author_id) {
    const { data: author } = await supabase.from('user_profiles').select('id, display_name, username').eq('id', guide.author_id).single()
    if (author) {
      const name = author.display_name || author.username || 'un colaborador'
      authorHtml = `<p class="subtext">Creada por <a href="${profileUrl(author)}" style="color:var(--navy); font-weight:700;">${escapeHtml(name)}</a></p>`
    }
  }

  let isSaved = false
  if (session) {
    const { data: profile } = await supabase.from('user_profiles').select('saved_guides').eq('id', session.user.id).single()
    isSaved = (profile?.saved_guides || []).includes(guide.id)
  }

  content.innerHTML = `
    <div class="guide-modal-header">
      <span class="guide-modal-icon">${guide.cover_emoji || '📘'}</span>
      <div>
        <span class="guide-label">${escapeHtml(guide.categories?.name || '')}</span>
        <h3>${escapeHtml(guide.title)}</h3>
      </div>
    </div>
    <p class="guide-modal-desc">${escapeHtml(guide.description || '')}</p>
    <div class="guide-meta" style="margin-bottom:16px;">
      <span class="badge ${guide.is_pro ? 'badge-pro' : 'badge-free'}">${guide.is_pro ? 'Pro' : 'Gratis'}</span>
      <span class="time-tag">${guide.estimated_mins || 5} min</span>
      <span class="rarity-chip rarity-${guide.guide_rarity || 'bronze'}">${escapeHtml(guide.guide_rarity || 'bronze')}</span>
    </div>
    ${authorHtml}
    <div class="guide-modal-rating" id="guideModalRating"></div>
    <div class="modal-actions" style="flex-direction:row; margin-top:16px;">
      <button class="btn-outline" id="guideModalSaveBtn">${isSaved ? '★ Guardado' : '☆ Guardar'}</button>
      <a href="curso.html?slug=${encodeURIComponent(guide.slug)}" class="btn-course">🎓 Curso</a>
      ${
        guide.has_reference_blocks
          ? `<a href="guia.html?slug=${encodeURIComponent(guide.slug)}" class="btn-guide">📖 Documentación</a>`
          : `<span class="btn-guide" style="opacity:.4; cursor:not-allowed;">📖 Documentación</span>`
      }
    </div>`

  const saveBtn = document.getElementById('guideModalSaveBtn')
  if (!session) {
    saveBtn.addEventListener('click', () => (window.location.href = 'auth.html'))
  } else {
    saveBtn.classList.toggle('is-saved', isSaved)
    saveBtn.addEventListener('click', () => toggleSaved(session, guide.id, saveBtn))
  }

  await loadReviews(guide.id, session, document.getElementById('guideModalRating'))
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
}
