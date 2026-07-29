import { supabase } from './supabase.js'
import { escapeHtml, getInitial, requireAuth, signOut } from './app.js'
import { getAllAchievements, levelProgress } from './gamification.js'

async function loadProfile(session) {
  const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single()
  const name = profile?.username || session.user.email
  const xp = profile?.total_xp || 0
  const progress = levelProgress(xp)

  document.getElementById('profileHeader').innerHTML = `
    <div class="profile-avatar">${getInitial(name)}</div>
    <div>
      <h2>${escapeHtml(name)}</h2>
      <div class="profile-level">${progress.level} · ${xp} XP</div>
      <div class="profile-xp-bar">
        <div class="progress-track"><div class="fill" style="width: ${progress.pct}%"></div></div>
        <div class="xp-label">${progress.next ? `${progress.next - xp} XP para el siguiente nivel` : 'Nivel máximo'}</div>
      </div>
    </div>`

  return profile
}

async function loadStats(session, profile) {
  const { count: completedCount } = await supabase
    .from('user_progress')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', session.user.id)
    .eq('status', 'completed')

  const unlockedCount = (profile?.achievements || []).length

  document.getElementById('profileStats').innerHTML = `
    <div class="stat-card">
      <div class="value">${completedCount || 0}</div>
      <div class="label">Cursos completados</div>
    </div>
    <div class="stat-card">
      <div class="value">${unlockedCount}</div>
      <div class="label">Logros desbloqueados</div>
    </div>
    <div class="stat-card">
      <div class="value">${profile?.total_xp || 0}</div>
      <div class="label">XP total</div>
    </div>`
}

async function loadAchievements(profile) {
  const unlocked = profile?.achievements || []
  const grid = document.getElementById('achievementsGrid')
  const achievements = await getAllAchievements()
  grid.innerHTML = achievements
    .map((a) => {
      const isUnlocked = unlocked.includes(a.key)
      return `
      <div class="achievement-tile ${isUnlocked ? '' : 'locked'}">
        <span class="icon">${isUnlocked ? a.icon || '🏆' : '🔒'}</span>
        <span class="name">${escapeHtml(a.name)}</span>
      </div>`
    })
    .join('')
}

async function loadCompletedCourses(session) {
  const { data } = await supabase
    .from('user_progress')
    .select('completed_at, guides(title)')
    .eq('user_id', session.user.id)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })

  const container = document.getElementById('completedCourses')
  if (!data || data.length === 0) {
    container.innerHTML = `<p class="empty-state">Todavía no has completado ningún curso.</p>`
    return
  }

  container.innerHTML = data
    .filter((row) => row.guides)
    .map(
      (row) => `
    <div class="completed-course-row">
      <span>${escapeHtml(row.guides.title)}</span>
      <span class="date">${new Date(row.completed_at).toLocaleDateString('es-ES')}</span>
    </div>`
    )
    .join('')
}

async function init() {
  const session = await requireAuth()
  if (!session) return

  const profile = await loadProfile(session)
  await Promise.all([loadStats(session, profile), loadCompletedCourses(session)])
  loadAchievements(profile)

  document.getElementById('btnLogout').addEventListener('click', signOut)
}

init()
