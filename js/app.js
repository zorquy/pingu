import { supabase } from './supabase.js'
import { icons } from './icons.js'

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function getInitial(name) {
  if (!name) return '?'
  return name.trim().charAt(0).toUpperCase()
}

const TINT_COUNT = 5

function tintIndexForKey(key) {
  const str = String(key ?? '')
  let hash = 0
  for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0
  return hash % TINT_COUNT
}

export function tintClassForKey(key) {
  return `icon-tint-${tintIndexForKey(key)}`
}

export function borderTintClassForKey(key) {
  return `border-tint-${tintIndexForKey(key)}`
}

export function borderRarityClass(rarity) {
  return `border-rarity-${rarity || 'bronze'}`
}

export function cardMediaHtml(imageUrl, emoji) {
  if (!imageUrl) return ''
  return `<div class="card-media" style="background-image:url('${imageUrl.replace(/'/g, '%27')}')"><span class="card-media-badge">${escapeHtml(emoji || '📘')}</span></div>`
}

const CONFETTI_COLORS = ['var(--navy)', 'var(--indigo)', 'var(--warning)', 'var(--success)', 'var(--pink)', 'var(--ice-dark)']
let confettiStyleInjected = false

export function burstConfetti(count = 28) {
  if (!confettiStyleInjected) {
    const style = document.createElement('style')
    style.textContent = `
      .confetti-piece {
        position: fixed;
        top: -12px;
        width: 8px;
        height: 14px;
        border-radius: 2px;
        pointer-events: none;
        z-index: 400;
        animation-name: confettiFall;
        animation-timing-function: linear;
        animation-fill-mode: forwards;
      }
      @keyframes confettiFall {
        to { transform: translateY(105vh) rotate(600deg); opacity: 0.3; }
      }
    `
    document.head.appendChild(style)
    confettiStyleInjected = true
  }

  for (let i = 0; i < count; i++) {
    const piece = document.createElement('div')
    piece.className = 'confetti-piece'
    piece.style.left = `${Math.random() * 100}vw`
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length]
    const duration = 2.2 + Math.random() * 1.2
    const delay = Math.random() * 0.3
    piece.style.animationDuration = `${duration}s`
    piece.style.animationDelay = `${delay}s`
    document.body.appendChild(piece)
    setTimeout(() => piece.remove(), (duration + delay) * 1000 + 150)
  }
}

export function slugify(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80)
}

export function profileUrl(p) {
  return p?.username ? `/usuario/${encodeURIComponent(p.username)}` : `/usuario.html?id=${p?.id}`
}

// El redirect de netlify.toml reescribe /usuario/<nombre> a
// /usuario.html?u=<nombre> en el servidor sin tocar la URL del navegador,
// así que el username no aparece en window.location.search — hay que
// sacarlo de la ruta. Se mantiene ?u=/?id= como alternativa por si se
// entra directo a usuario.html (o en local, donde no hay redirects).
export function profileParamsFromLocation() {
  const params = new URLSearchParams(window.location.search)
  const pathMatch = window.location.pathname.match(/\/usuario\/([^/?#]+)/)
  return {
    username: pathMatch ? decodeURIComponent(pathMatch[1]) : params.get('u'),
    id: params.get('id'),
  }
}

export async function uniqueUsername(base, excludeUserId) {
  const clean = slugify(base) || 'user'
  let query = supabase.from('user_profiles').select('username').ilike('username', `${clean}%`)
  if (excludeUserId) query = query.neq('id', excludeUserId)
  const { data } = await query
  const taken = new Set((data || []).map((r) => (r.username || '').toLowerCase()))
  if (!taken.has(clean)) return clean
  let i = 2
  while (taken.has(`${clean}-${i}`)) i++
  return `${clean}-${i}`
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getProfile(userId) {
  const { data } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return data
}

const MAX_IMAGE_MB = 5

export function validateImageFile(file, maxMB = MAX_IMAGE_MB) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Ese archivo no es una imagen.')
  }
  if (file.size > maxMB * 1024 * 1024) {
    throw new Error(`La imagen pesa demasiado (máximo ${maxMB} MB).`)
  }
}

export async function uploadProfileImage(userId, file, kind) {
  validateImageFile(file)
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${userId}/${kind}-${Date.now()}.${ext}`
  const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from('avatars').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadGuideImage(userId, file) {
  validateImageFile(file)
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const { error } = await supabase.storage.from('guide-images').upload(path, file)
  if (error) throw error
  const { data } = supabase.storage.from('guide-images').getPublicUrl(path)
  return data.publicUrl
}

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    window.location.href = '/auth.html'
    return null
  }
  return session
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = '/index.html'
}

async function renderNavUser(session) {
  const el = document.getElementById('nav-user')
  if (!el) return

  if (!session) {
    el.innerHTML = `<a href="/auth.html" class="btn-primary">Entrar</a>`
    return
  }

  const profile = await getProfile(session.user.id)
  const name = profile?.display_name || profile?.username || session.user.email
  const avatarStyle = profile?.avatar_url
    ? `background-image:url('${profile.avatar_url.replace(/'/g, '%27')}')`
    : `background-color:${profile?.avatar_color || 'var(--navy)'}`

  el.innerHTML = `
    <div class="nav-user-wrap" id="navUserWrap">
      <button type="button" class="nav-user-avatar" id="navUserBtn" style="${avatarStyle}" aria-label="Tu cuenta" title="${escapeHtml(name)}">${profile?.avatar_url ? '' : getInitial(name)}</button>
      <div class="nav-user-dropdown hidden" id="navUserDropdown"></div>
    </div>`

  const wrap = document.getElementById('navUserWrap')
  const dropdown = document.getElementById('navUserDropdown')
  let loaded = false

  async function loadDropdown() {
    const [{ contributorTier }, { count: approvedGuidesCount }] = await Promise.all([
      import('./gamification.js'),
      supabase
        .from('guides')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', session.user.id)
        .eq('review_status', 'approved'),
    ])
    const tier = contributorTier(approvedGuidesCount || 0)

    dropdown.innerHTML = `
      <div class="nav-user-header">
        <span class="nav-user-avatar-lg" style="${avatarStyle}">${profile?.avatar_url ? '' : getInitial(name)}</span>
        <div>
          <strong>${escapeHtml(name)}</strong>
          ${profile?.username ? `<span class="subtext">@${escapeHtml(profile.username)}</span>` : ''}
        </div>
      </div>
      <div class="nav-user-stats">
        <div><strong>${profile?.total_xp || 0}</strong><span>XP</span></div>
        <div><strong>${escapeHtml(profile?.level || 'Novato')}</strong><span>Nivel</span></div>
        ${(profile?.current_streak || 0) > 0 ? `<div><strong>🔥 ${profile.current_streak}</strong><span>Racha</span></div>` : ''}
        ${(approvedGuidesCount || 0) > 0 ? `<div><strong>${tier.emoji}</strong><span>${escapeHtml(tier.title)}</span></div>` : ''}
      </div>
      <div class="nav-user-links">
        <a href="/perfil.html">${icons.user(16)} Mi perfil</a>
        <a href="/guardados.html">${icons.star(16)} Guardados</a>
        <button type="button" id="navFeedbackBtn">💬 Enviar feedback</button>
        <button type="button" id="navUserSignOut">${icons.logOut(16)} Cerrar sesión</button>
      </div>`

    document.getElementById('navUserSignOut').addEventListener('click', signOut)
    document.getElementById('navFeedbackBtn').addEventListener('click', async () => {
      dropdown.classList.add('hidden')
      const { openFeedbackModal } = await import('./feedback.js')
      openFeedbackModal()
    })
  }

  document.getElementById('navUserBtn').addEventListener('click', async () => {
    const willShow = dropdown.classList.contains('hidden')
    dropdown.classList.toggle('hidden', !willShow)
    if (willShow && !loaded) {
      loaded = true
      await loadDropdown()
    }
  })
  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) dropdown.classList.add('hidden')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dropdown.classList.add('hidden')
  })
}

function hideBuscarNavLink() {
  document.querySelectorAll('.nav-links a[href="buscar.html"]').forEach((a) => a.remove())
}

function initScrollShadow() {
  const navbar = document.getElementById('navbar')
  if (!navbar) return
  const onScroll = () => {
    if (window.scrollY > 20) {
      navbar.classList.add('scrolled')
    } else {
      navbar.classList.remove('scrolled')
    }
  }
  window.addEventListener('scroll', onScroll)
  onScroll()
}

function initMobileMenu() {
  const toggle = document.getElementById('navToggle')
  const menu = document.getElementById('navMobileMenu')
  if (!toggle || !menu) return
  toggle.addEventListener('click', () => {
    menu.classList.toggle('open')
  })
}

function markActiveLink() {
  const page = window.location.pathname.split('/').pop() || 'index.html'
  document.querySelectorAll('.nav-links a, .nav-menu-mobile a').forEach((a) => {
    const href = a.getAttribute('href')
    if (href === page) a.classList.add('active')
  })
}

export async function initNavbar() {
  initScrollShadow()
  initMobileMenu()
  markActiveLink()
  hideBuscarNavLink()
  const session = await getSession()
  if (session) {
    // No se espera a que termine — en el 99% de las cargas de página no
    // hace nada (ya se contó hoy), así que no debería frenar el resto de
    // la navbar.
    import('./gamification.js').then(({ checkDailyStreak }) => checkDailyStreak(session.user.id))
  }
  renderNavUser(session)
  const { renderNavSearch } = await import('./nav-search.js')
  renderNavSearch()
  const { renderThemeToggle } = await import('./theme.js')
  renderThemeToggle()
  if (session) {
    const { renderNavMessages } = await import('./nav-messages.js')
    renderNavMessages(session)
    const { renderNotificationBell } = await import('./notifications.js')
    renderNotificationBell(session)
  }
  return session
}

// Se ejecuta en cuanto se importa este módulo en cualquier página.
initNavbar()
