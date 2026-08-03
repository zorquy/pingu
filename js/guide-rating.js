import { supabase } from './supabase.js'
import { createNotification } from './notifications.js'

// Valorar una guía.
//
// Antes esto vivía SOLO dentro del pop-up de la tarjeta, o sea que solo
// se podía valorar desde donde NO habías leído nada, y no desde la guía
// ni al terminar el curso. El resultado se veía en la web: todas las
// guías con 5.0, porque una estrella dada de pasada al hojear no
// distingue una guía buena de una mala.
//
// Ahora aparece al final de la guía y al final del curso: cuando ya te
// has ganado la opinión.

export function starsHtml(rating, size = 16) {
  return Array.from({ length: 5 })
    .map((_, i) => `<span style="font-size:${size}px; color:${i < Math.round(rating) ? 'var(--warning)' : 'var(--border)'};">★</span>`)
    .join('')
}

export async function renderRatingWidget(container, { guideId, session, guide = null, titulo = '¿Te ha servido esta guía?' }) {
  if (!container) return

  const { data, error } = await supabase.from('guide_reviews').select('*').eq('guide_id', guideId)
  if (error) {
    container.innerHTML = ''
    return
  }
  const reviews = data || []
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : null

  const resumen = avg
    ? `<span class="rating-summary">${starsHtml(avg)} <strong>${avg.toFixed(1)}</strong> · ${reviews.length} valoración(es)</span>`
    : `<span class="rating-summary subtle">Todavía sin valoraciones</span>`

  if (!session) {
    container.innerHTML = `
      <div class="rating-box">
        <h3>${titulo}</h3>
        ${resumen}
        <p class="subtext"><a href="/auth.html">Inicia sesión</a> para valorarla.</p>
      </div>`
    return
  }

  const mia = reviews.find((r) => r.reviewer_id === session.user.id)
  let elegida = mia?.rating || 0

  container.innerHTML = `
    <div class="rating-box">
      <h3>${titulo}</h3>
      <div class="star-picker" role="group" aria-label="Valorar de 1 a 5 estrellas">
        ${[1, 2, 3, 4, 5]
          .map((v) => `<button type="button" class="star-pick" data-value="${v}" aria-label="${v} estrella(s)">★</button>`)
          .join('')}
      </div>
      ${resumen}
      <p class="rating-hint" data-rating-hint>${mia ? 'Ya la has valorado. Puedes cambiar tu nota.' : ''}</p>
    </div>`

  const pintar = () => {
    container.querySelectorAll('.star-pick').forEach((s) => s.classList.toggle('selected', Number(s.dataset.value) <= elegida))
  }
  pintar()

  container.querySelectorAll('.star-pick').forEach((boton) =>
    boton.addEventListener('click', async () => {
      elegida = Number(boton.dataset.value)
      pintar()
      const esNueva = !mia
      const { error: errGuardar } = await supabase
        .from('guide_reviews')
        .upsert({ guide_id: guideId, reviewer_id: session.user.id, rating: elegida }, { onConflict: 'guide_id,reviewer_id' })
      if (errGuardar) {
        container.querySelector('[data-rating-hint]').textContent = `No se ha podido guardar: ${errGuardar.message}`
        return
      }
      if (esNueva && guide?.author_id) {
        await createNotification({
          recipientId: guide.author_id,
          actorId: session.user.id,
          type: 'guide_rating',
          title: 'Nueva valoración en tu guía',
          body: `${'★'.repeat(elegida)} en "${guide.title}"`,
          link: `/guia.html?slug=${guide.slug}`,
        }).catch(() => {})
      }
      await renderRatingWidget(container, { guideId, session, guide, titulo })
    })
  )
}
