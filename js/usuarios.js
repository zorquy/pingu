import { supabase } from './supabase.js'
import { escapeHtml, getInitial, profileUrl } from './app.js'

let allUsers = []

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

async function init() {
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

init()
