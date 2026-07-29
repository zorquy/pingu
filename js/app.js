import { supabase } from './supabase.js'

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

export async function requireAuth() {
  const session = await getSession()
  if (!session) {
    window.location.href = 'auth.html'
    return null
  }
  return session
}

export async function signOut() {
  await supabase.auth.signOut()
  window.location.href = 'index.html'
}

async function renderNavUser(session) {
  const el = document.getElementById('nav-user')
  if (!el) return

  if (!session) {
    el.innerHTML = `<a href="auth.html" class="btn-primary">Entrar</a>`
    return
  }

  const profile = await getProfile(session.user.id)
  const name = profile?.display_name || profile?.username || session.user.email
  const color = profile?.avatar_color || 'var(--navy)'
  el.innerHTML = `<a href="perfil.html" class="nav-user-avatar" style="background:${color}" title="${escapeHtml(name)}">${getInitial(name)}</a>`
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
  const session = await getSession()
  renderNavUser(session)
  return session
}

// Se ejecuta en cuanto se importa este módulo en cualquier página.
initNavbar()
