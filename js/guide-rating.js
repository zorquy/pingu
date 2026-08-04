import { supabase } from './supabase.js'
import { createNotification } from './notifications.js'
import { escapeHtml, getInitial, profileUrl, avatarStyle } from './app.js'

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

// La nota media que ha sacado lo que ESCRIBE esta persona.
//
// Sustituye a la media de `profile_reviews`, que era una nota puesta a la
// persona en sí. Esa se podía poner sin haber leído nada suyo, duplicaba
// lo que ya hace el muro, y ponerle 2 estrellas a alguien es un insulto
// mientras que ponérselas a una guía es una crítica. Esta se gana
// escribiendo, y es la que de verdad sirve para decidir si te fías de sus
// guías.
export async function authorRatingSummary(authorId) {
  if (!authorId) return { media: null, total: 0 }

  const { data: guias } = await supabase
    .from('guides')
    .select('id')
    .eq('author_id', authorId)
    .eq('review_status', 'approved')

  const ids = (guias || []).map((g) => g.id)
  if (ids.length === 0) return { media: null, total: 0 }

  const { data } = await supabase.from('guide_reviews').select('rating').in('guide_id', ids)
  const notas = data || []
  if (notas.length === 0) return { media: null, total: 0 }

  return { media: notas.reduce((s, r) => s + r.rating, 0) / notas.length, total: notas.length }
}

function haceCuanto(iso) {
  const seg = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
  if (seg < 60) return 'ahora mismo'
  const min = Math.floor(seg / 60)
  if (min < 60) return `hace ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'ayer'
  if (d < 30) return `hace ${d} días`
  const m = Math.floor(d / 30)
  return m === 1 ? 'hace un mes' : `hace ${m} meses`
}

// Quién ha valorado. Se despliega bajo el resumen al pincharlo.
//
// Estos datos ya eran públicos: la política de `guide_reviews` es
// `select using (true)`, y la media que se ve arriba se calcula leyendo
// todas las filas desde el navegador. O sea que esto no destapa nada
// nuevo — pero sí lo hace VISIBLE, que socialmente no es lo mismo. Por
// eso se respeta `hide_activity`: quien ha pedido no aparecer en los
// listados públicos sale como "Un usuario", sin enlace a su perfil. Su
// nota sigue contando para la media, así que el número de arriba y la
// lista de abajo siempre cuadran.
function listaValoradoresHtml(reviews, perfilesPorId) {
  const filas = [...reviews]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map((r) => {
      const p = perfilesPorId[r.reviewer_id]
      const oculto = !p || p.hide_activity
      const nombre = oculto ? 'Un usuario' : p.display_name || p.username || 'Un usuario'
      const avatar = `<span class="rater-avatar" style="${oculto ? '' : avatarStyle(p)}">${oculto ? '' : escapeHtml(getInitial(nombre))}</span>`
      const quien = oculto
        ? `<span class="rater-name">${escapeHtml(nombre)}</span>`
        : `<a class="rater-name" href="${profileUrl(p)}">${escapeHtml(nombre)}</a>`
      return `<li class="rater-row">
          ${avatar}
          ${quien}
          <span class="rater-stars">${starsHtml(r.rating, 13)}</span>
          <span class="rater-date">${r.created_at ? haceCuanto(r.created_at) : ''}</span>
        </li>`
    })
    .join('')
  return `<ul class="rater-list">${filas}</ul>`
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

  // Los perfiles de quienes han valorado, para poder desplegar la lista.
  // Se piden aquí y no al pinchar para que abrir sea instantáneo: son
  // pocas filas y ya se ha hecho una consulta de todas formas.
  let perfilesPorId = {}
  if (reviews.length) {
    const ids = [...new Set(reviews.map((r) => r.reviewer_id).filter(Boolean))]
    const { data: perfiles } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url, hide_activity')
      .in('id', ids)
    perfilesPorId = Object.fromEntries((perfiles || []).map((p) => [p.id, p]))
  }

  const cuantas = `${reviews.length} ${reviews.length === 1 ? 'valoración' : 'valoraciones'}`
  const resumen = avg
    ? `<button type="button" class="rating-summary" data-ver-quien aria-expanded="false" aria-controls="raterList">
         ${starsHtml(avg)} <strong>${avg.toFixed(1)}</strong> · ${cuantas}
         <span class="rating-summary-caret" aria-hidden="true">▾</span>
       </button>
       <div class="rater-panel hidden" id="raterList">${listaValoradoresHtml(reviews, perfilesPorId)}</div>`
    : `<span class="rating-summary subtle">Todavía sin valoraciones</span>`

  // Enganchar el desplegable. Se hace en una función porque el widget se
  // vuelve a pintar entero al votar, y si no habría que acordarse de
  // reengancharlo — que es justo lo que se olvida.
  const wireDesplegable = () => {
    const boton = container.querySelector('[data-ver-quien]')
    const panel = container.querySelector('#raterList')
    if (!boton || !panel) return
    boton.addEventListener('click', () => {
      const abierto = panel.classList.toggle('hidden') === false
      boton.setAttribute('aria-expanded', String(abierto))
    })
  }

  if (!session) {
    container.innerHTML = `
      <div class="rating-box">
        <h3>${titulo}</h3>
        ${resumen}
        <p class="subtext"><a href="/auth.html">Inicia sesión</a> para valorarla.</p>
      </div>`
    wireDesplegable()
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

  wireDesplegable()

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
