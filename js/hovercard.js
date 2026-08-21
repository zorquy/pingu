import { supabase } from './supabase.js'
import { escapeHtml, getInitial, avatarStyle, getSession } from './app.js'

// La tarjetita al posar el ratón sobre el nombre de alguien: avatar,
// nivel, mensajes del foro y el botón de seguir, sin ir a su perfil.
// Como en GitHub o Discourse.
//
// Es solo de ratón: se engancha únicamente donde hay hover de verdad
// (en el móvil, tocar un nombre ya lleva al perfil, que es lo suyo).
// Escucha delegada sobre el documento entero: vale para cualquier
// enlace de usuario que se pinte después.

const RUTA_USUARIO = /\/usuario\/([^/?#]+)|[?&]u=([^&#]+)/

let tarjeta = null
let temporizadorAbrir = null
let temporizadorCerrar = null
const cache = new Map()

async function perfilDe(username) {
  if (cache.has(username)) return cache.get(username)
  const { data } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, avatar_url, level, total_xp, forum_post_count, bio')
    .ilike('username', username)
    .limit(1)
  const perfil = data?.[0] || null
  cache.set(username, perfil)
  return perfil
}

function cerrar() {
  clearTimeout(temporizadorAbrir)
  temporizadorCerrar = setTimeout(() => {
    tarjeta?.remove()
    tarjeta = null
  }, 200)
}

async function abrir(enlace, username) {
  const [perfil, { levelBadgeHtml }, sesion] = await Promise.all([
    perfilDe(username),
    import('./gamification.js'),
    getSession(),
  ])
  // Mientras se cargaba, el ratón puede haberse ido a otra parte.
  if (!perfil || !enlace.isConnected || !enlace.matches(':hover')) return

  tarjeta?.remove()
  tarjeta = document.createElement('div')
  tarjeta.className = 'hovercard'
  const nombre = perfil.display_name || perfil.username
  const esOtro = sesion && sesion.user.id !== perfil.id
  tarjeta.innerHTML = `
    <span class="hovercard-avatar" style="${avatarStyle(perfil)}">${perfil.avatar_url ? '' : escapeHtml(getInitial(nombre))}</span>
    <div class="hovercard-datos">
      <a class="hovercard-nombre" href="/usuario/${encodeURIComponent(perfil.username)}">${escapeHtml(nombre)}</a>
      <span class="hovercard-linea">${levelBadgeHtml(perfil.level, 11)} · ${perfil.total_xp || 0} XP</span>
      ${Number.isFinite(perfil.forum_post_count) ? `<span class="hovercard-linea subtext">Mensajes en el foro: ${perfil.forum_post_count}</span>` : ''}
      ${perfil.bio ? `<span class="hovercard-bio">${escapeHtml(perfil.bio).slice(0, 90)}</span>` : ''}
      ${esOtro ? `<button type="button" class="btn-secondary hovercard-seguir" data-uid="${escapeHtml(perfil.id)}">Seguir</button>` : ''}
    </div>`

  // Debajo del enlace, sin salirse por la derecha.
  const caja = enlace.getBoundingClientRect()
  document.body.appendChild(tarjeta)
  const ancho = tarjeta.offsetWidth || 280
  tarjeta.style.left = `${Math.max(8, Math.min(window.innerWidth - ancho - 8, caja.left + window.scrollX))}px`
  tarjeta.style.top = `${caja.bottom + window.scrollY + 6}px`

  tarjeta.addEventListener('mouseenter', () => clearTimeout(temporizadorCerrar))
  tarjeta.addEventListener('mouseleave', cerrar)

  const btn = tarjeta.querySelector('.hovercard-seguir')
  if (btn && esOtro) {
    // El estado real se mira al abrir, no antes: la tarjeta sale ya y el
    // botón se corrige solo si hacía falta.
    supabase
      .from('user_follows')
      .select('follower_id')
      .eq('follower_id', sesion.user.id)
      .eq('following_id', perfil.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) btn.textContent = 'Siguiendo'
      })
      .catch(() => {})
    btn.addEventListener('click', async () => {
      const sigo = btn.textContent === 'Siguiendo'
      btn.disabled = true
      const { error } = sigo
        ? await supabase.from('user_follows').delete().eq('follower_id', sesion.user.id).eq('following_id', perfil.id)
        : await supabase.from('user_follows').insert({ follower_id: sesion.user.id, following_id: perfil.id })
      btn.disabled = false
      if (!error) btn.textContent = sigo ? 'Seguir' : 'Siguiendo'
    })
  }
}

export function engancharTarjetasDeUsuario() {
  if (!window.matchMedia('(hover: hover)').matches) return
  document.addEventListener('mouseover', (e) => {
    const enlace = e.target.closest?.('a[href]')
    if (!enlace || tarjeta?.contains(enlace)) return
    const m = RUTA_USUARIO.exec(enlace.getAttribute('href') || '')
    if (!m) return
    const username = decodeURIComponent(m[1] || m[2])
    clearTimeout(temporizadorAbrir)
    clearTimeout(temporizadorCerrar)
    temporizadorAbrir = setTimeout(() => abrir(enlace, username).catch(() => {}), 350)
  })
  document.addEventListener('mouseout', (e) => {
    const enlace = e.target.closest?.('a[href]')
    if (enlace && RUTA_USUARIO.test(enlace.getAttribute('href') || '')) cerrar()
  })
}
