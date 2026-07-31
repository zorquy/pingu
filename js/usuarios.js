import { supabase } from './supabase.js'
import { escapeHtml, getInitial, getSession, profileUrl } from './app.js'
import { openGuideModal, setupGuideModalClose, renderGuideCardHtml, decorateGuideCards } from './guide-modal.js'

let allUsers = []
let allCommunityGuides = []

const RANK_MEDALS = { 1: '🥇', 2: '🥈', 3: '🥉' }

function userCardHtml(p) {
  const name = p.display_name || p.username || 'Usuario'
  const avatarStyle = p.avatar_url
    ? `background-image:url('${p.avatar_url.replace(/'/g, '%27')}')`
    : `background-color:${p.avatar_color || 'var(--navy)'}`
  const rankBadge = RANK_MEDALS[p.rank] || `#${p.rank}`
  return `
    <a class="user-card${p.rank <= 3 ? ' user-card-top' : ''}" href="${profileUrl(p)}">
      <span class="user-card-rank">${rankBadge}</span>
      <span class="user-card-avatar" style="${avatarStyle}">${p.avatar_url ? '' : getInitial(name)}</span>
      <div class="user-card-info">
        <h3>${escapeHtml(name)}</h3>
        <p>${p.level ? escapeHtml(p.level) + ' · ' : ''}${p.total_xp || 0} XP</p>
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
  const { data } = await supabase
    .from('user_profiles')
    .select('id, username, display_name, level, total_xp, avatar_url, avatar_color')
    .order('total_xp', { ascending: false })
    .limit(200)

  allUsers = (data || []).map((p, i) => ({ ...p, rank: i + 1 }))
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

// ── Guías de la comunidad (pendientes de revisión + ya aprobadas) ──
function renderCommunityGuides(list, session) {
  const grid = document.getElementById('communityGuidesGrid')
  const empty = document.getElementById('communityGuidesEmpty')
  if (list.length === 0) {
    grid.innerHTML = ''
    empty.innerHTML = `<p class="empty-state">Todavía no hay guías de la comunidad que coincidan con tu búsqueda.</p>`
    return
  }
  empty.innerHTML = ''
  grid.innerHTML = list
    .map((g) =>
      renderGuideCardHtml(g, {
        categoryLabel: g.categories?.name || '',
        authorName: g.authorName,
        reviewBadge: g.review_status === 'approved' ? '✓ Aprobada' : 'Pendiente de revisión',
      })
    )
    .join('')

  grid.querySelectorAll('[data-guide-id]').forEach((card) => {
    card.addEventListener('click', () => openGuideModal(card.dataset.guideId))
  })
  decorateGuideCards(grid, session)
}

async function loadCommunityGuides(session) {
  const { data: guides } = await supabase
    .from('guides')
    .select('*, categories(name)')
    .not('author_id', 'is', null)
    .in('review_status', ['pending', 'approved'])
    .order('submitted_at', { ascending: false })

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
      renderCommunityGuides(allCommunityGuides, session)
      return
    }
    renderCommunityGuides(
      allCommunityGuides.filter(
        (g) =>
          (g.title || '').toLowerCase().includes(q) ||
          (g.description || '').toLowerCase().includes(q) ||
          (g.authorName || '').toLowerCase().includes(q)
      ),
      session
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
