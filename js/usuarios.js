import { supabase } from './supabase.js'
import { escapeHtml, getInitial, getSession, profileUrl } from './app.js'
import { openGuideModal, setupGuideModalClose, decorateGuideCards } from './guide-modal.js'
import { contributorTier, calculateLevel } from './gamification.js'
import { loadActivity, renderActivityHtml } from './activity.js'
import { icons } from './icons.js'

let allUsers = []
let allCommunityGuides = []
let communityGuidesPage = 1

const COMMUNITY_GUIDES_PAGE_SIZE = 12

function userCardHtml(p) {
  const name = p.display_name || p.username || 'Usuario'
  const avatarStyle = p.avatar_url
    ? `background-image:url('${p.avatar_url.replace(/'/g, '%27')}')`
    : `background-color:${p.avatar_color || 'var(--navy)'}`
  const rankBadge = p.rank <= 3 ? `${icons.trophy(14)} #${p.rank}` : `#${p.rank}`
  const tier = contributorTier(p.approvedGuidesCount || 0)
  return `
    <a class="user-card${p.rank <= 3 ? ' user-card-top' : ''}" href="${profileUrl(p)}">
      <span class="user-card-rank">${rankBadge}</span>
      <span class="user-card-avatar" style="${avatarStyle}">${p.avatar_url ? '' : getInitial(name)}</span>
      <div class="user-card-info">
        <h3>${escapeHtml(name)}</h3>
        <p>${escapeHtml(calculateLevel(p.total_xp))} · ${p.total_xp || 0} XP</p>
        ${p.approvedGuidesCount > 0 ? `<p class="subtext" style="margin:2px 0 0; display:flex; align-items:center; gap:4px;">${tier.icon} ${escapeHtml(tier.title)}</p>` : ''}
      </div>
    </a>`
}

function render(list) {
  const grid = document.getElementById('userDirectoryGrid')
  const empty = document.getElementById('userDirectoryEmpty')
  if (list.length === 0) {
    grid.innerHTML = ''
    empty.innerHTML = `<p class="empty-state">No hay usuarios que coincidan con tu búsqueda.</p>`
    return
  }
  empty.innerHTML = ''
  grid.innerHTML = list.map(userCardHtml).join('')
}

async function loadUsers() {
  const [{ data }, { data: approvedGuides }] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('id, username, display_name, level, total_xp, avatar_url, avatar_color')
      .order('total_xp', { ascending: false })
      .limit(200),
    supabase.from('guides').select('author_id').eq('review_status', 'approved').not('author_id', 'is', null),
  ])

  const approvedCountByAuthor = (approvedGuides || []).reduce((acc, g) => {
    acc[g.author_id] = (acc[g.author_id] || 0) + 1
    return acc
  }, {})

  allUsers = (data || []).map((p, i) => ({ ...p, rank: i + 1, approvedGuidesCount: approvedCountByAuthor[p.id] || 0 }))
  render(allUsers)

  document.getElementById('userSearchInput').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase()
    if (!q) {
      render(allUsers)
      return
    }
    render(allUsers.filter((p) => (p.display_name || '').toLowerCase().includes(q) || (p.username || '').toLowerCase().includes(q)))
  })
}

// Fila compacta y en horizontal — a propósito distinta de la tarjeta grande
// de guide-modal.js: aquí puede haber cientos de guías de calidad muy
// variable, así que se listan finas en vez de en tarjetas grandes.
function renderCommunityGuideRowHtml(guide) {
  return `
  <div class="community-guide-row" data-guide-id="${guide.id}">
    <div class="community-guide-row-icon">${escapeHtml(guide.cover_emoji || '📘')}</div>
    <div class="community-guide-row-info">
      <h3>${escapeHtml(guide.title)}<span class="badge community-guide-row-badge badge-pro">Pendiente</span></h3>
      <p>${guide.authorName ? `De ${escapeHtml(guide.authorName)} — ` : ''}${escapeHtml(guide.description || '')}</p>
    </div>
    <div class="community-guide-row-meta">
      <span data-card-rating>Sin valorar</span>
      <span>${guide.estimated_mins || 5} min</span>
    </div>
  </div>`
}

// ── Guías de la comunidad pendientes de revisión (las aprobadas ya
// viven en su categoría normal, con su autor atribuido — no hace
// falta duplicarlas aquí) ──
function renderCommunityGuides(list, session, page = 1) {
  const grid = document.getElementById('communityGuidesGrid')
  const empty = document.getElementById('communityGuidesEmpty')
  const paginationEl = document.getElementById('communityGuidesPagination')
  if (list.length === 0) {
    grid.innerHTML = ''
    paginationEl.innerHTML = ''
    empty.innerHTML = `<p class="empty-state">Todavía no hay guías de la comunidad que coincidan con tu búsqueda.</p>`
    return
  }
  empty.innerHTML = ''

  const totalPages = Math.max(1, Math.ceil(list.length / COMMUNITY_GUIDES_PAGE_SIZE))
  communityGuidesPage = Math.min(Math.max(1, page), totalPages)
  const from = (communityGuidesPage - 1) * COMMUNITY_GUIDES_PAGE_SIZE
  const pageItems = list.slice(from, from + COMMUNITY_GUIDES_PAGE_SIZE)

  grid.innerHTML = pageItems.map(renderCommunityGuideRowHtml).join('')

  grid.querySelectorAll('[data-guide-id]').forEach((card) => {
    card.addEventListener('click', () => openGuideModal(card.dataset.guideId))
  })
  decorateGuideCards(grid, session)

  paginationEl.innerHTML =
    totalPages > 1
      ? `<div class="forum-pagination">
        <button class="btn-outline" id="communityGuidesPrevPage" ${communityGuidesPage <= 1 ? 'disabled' : ''}>← Anterior</button>
        <span>Página ${communityGuidesPage} de ${totalPages}</span>
        <button class="btn-outline" id="communityGuidesNextPage" ${communityGuidesPage >= totalPages ? 'disabled' : ''}>Siguiente →</button>
      </div>`
      : ''
  paginationEl.querySelector('#communityGuidesPrevPage')?.addEventListener('click', () => renderCommunityGuides(list, session, communityGuidesPage - 1))
  paginationEl.querySelector('#communityGuidesNextPage')?.addEventListener('click', () => renderCommunityGuides(list, session, communityGuidesPage + 1))
}

async function loadCommunityGuides(session) {
  const { data: guides } = await supabase
    .from('guides')
    .select('*, categories(name)')
    .not('author_id', 'is', null)
    .eq('review_status', 'pending')
    .order('submitted_at', { ascending: true })

  const list = guides || []
  const authorIds = [...new Set(list.map((g) => g.author_id))]
  let authorsById = {}
  if (authorIds.length > 0) {
    const { data: authors } = await supabase.from('user_profiles').select('id, display_name, username').in('id', authorIds)
    authorsById = Object.fromEntries((authors || []).map((a) => [a.id, a]))
  }

  allCommunityGuides = list.map((g) => {
    const author = authorsById[g.author_id]
    return { ...g, authorName: author?.display_name || author?.username || 'un colaborador' }
  })
  renderCommunityGuides(allCommunityGuides, session)

  document.getElementById('communityGuideSearchInput').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase()
    if (!q) {
      renderCommunityGuides(allCommunityGuides, session, 1)
      return
    }
    renderCommunityGuides(
      allCommunityGuides.filter(
        (g) =>
          (g.title || '').toLowerCase().includes(q) ||
          (g.description || '').toLowerCase().includes(q) ||
          (g.authorName || '').toLowerCase().includes(q)
      ),
      session,
      1
    )
  })
}

function wireTabs() {
  document.getElementById('communityTabs')?.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('communityTabs').querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'))
      document.querySelectorAll('.tab-panel[id^="ctab-"]').forEach((p) => p.classList.remove('active'))
      btn.classList.add('active')
      document.getElementById(`ctab-${btn.dataset.ctab}`).classList.add('active')
      // Se carga la primera vez que se abre la pestaña, no al entrar en la
      // página: son cuatro consultas y la mayoría de visitas no la miran.
      if (btn.dataset.ctab === 'activity') cargarActividad()
    })
  })
}

async function init() {
  wireTabs()
  setupGuideModalClose()
  const session = await getSession()
  await Promise.all([loadUsers(), loadCommunityGuides(session)])
}

init()


let actividadCargada = false

async function cargarActividad() {
  if (actividadCargada) return
  actividadCargada = true
  const cont = document.getElementById('activityFeed')
  cont.innerHTML = `<div class="skeleton" style="height: 90px;"></div>`
  try {
    cont.innerHTML = renderActivityHtml(await loadActivity(30))
  } catch {
    actividadCargada = false
    cont.innerHTML = `<p class="empty-state">No hemos podido cargar la actividad. Vuelve a intentarlo.</p>`
  }
}
