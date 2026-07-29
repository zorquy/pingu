import { supabase } from './supabase.js'

// Los logros en sí (nombre, icono, XP, condición) se gestionan desde /admin
// en la tabla `achievements`. condition_type: 'completed_count' | 'total_xp'.
let achievementsCache = null

export async function getAllAchievements() {
  if (achievementsCache) return achievementsCache
  const { data } = await supabase.from('achievements').select('*').order('order_pos')
  achievementsCache = data || []
  return achievementsCache
}

export function invalidateAchievementsCache() {
  achievementsCache = null
}

export function calculateLevel(xp) {
  if (xp >= 1500) return 'Maestro'
  if (xp >= 700) return 'Experto'
  if (xp >= 300) return 'Coleccionista'
  if (xp >= 100) return 'Entrenador'
  return 'Novato'
}

export const LEVEL_THRESHOLDS = [
  { level: 'Novato', min: 0, next: 100 },
  { level: 'Entrenador', min: 100, next: 300 },
  { level: 'Coleccionista', min: 300, next: 700 },
  { level: 'Experto', min: 700, next: 1500 },
  { level: 'Maestro', min: 1500, next: null },
]

export function levelProgress(xp) {
  const current = LEVEL_THRESHOLDS.find((l) => l.next === null || xp < l.next) || LEVEL_THRESHOLDS[0]
  if (current.next === null) return { ...current, pct: 100 }
  const pct = Math.min(100, Math.round(((xp - current.min) / (current.next - current.min)) * 100))
  return { ...current, pct }
}

export async function addXP(userId, amount) {
  if (!amount) return
  const { data } = await supabase.from('user_profiles').select('total_xp').eq('id', userId).single()

  const newXP = (data?.total_xp || 0) + amount
  const newLevel = calculateLevel(newXP)

  await supabase.from('user_profiles').update({ total_xp: newXP, level: newLevel }).eq('id', userId)

  await checkAchievements(userId)
  return newXP
}

export async function markCourseStarted(userId, guideId) {
  await supabase.from('user_progress').upsert(
    {
      user_id: userId,
      guide_id: guideId,
      status: 'started',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,guide_id' }
  )
}

export async function markCourseCompleted(userId, guideId, xpEarned = 20) {
  await supabase.from('user_progress').upsert(
    {
      user_id: userId,
      guide_id: guideId,
      status: 'completed',
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      xp_earned: xpEarned,
    },
    { onConflict: 'user_id,guide_id' }
  )

  await addXP(userId, xpEarned)
  await checkAchievements(userId)
}

export async function checkAchievements(userId) {
  const [{ count: completedCount }, { data: profile }, achievements] = await Promise.all([
    supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed'),
    supabase.from('user_profiles').select('total_xp, achievements').eq('id', userId).single(),
    getAllAchievements(),
  ])

  if (!profile) return []

  const unlocked = profile.achievements || []
  const newlyUnlocked = []

  for (const a of achievements) {
    if (unlocked.includes(a.key)) continue
    const value = a.condition_type === 'total_xp' ? profile.total_xp : completedCount || 0
    if (value >= a.condition_value) newlyUnlocked.push(a)
  }

  if (newlyUnlocked.length > 0) {
    await supabase
      .from('user_profiles')
      .update({ achievements: [...unlocked, ...newlyUnlocked.map((a) => a.key)] })
      .eq('id', userId)

    const bonusXp = newlyUnlocked.reduce((sum, a) => sum + (a.xp_reward || 0), 0)
    if (bonusXp > 0) await addXP(userId, bonusXp)

    showAchievementModal(newlyUnlocked[0])
  }

  return newlyUnlocked.map((a) => a.key)
}

export function showAchievementModal(achievement) {
  if (!achievement) return

  let modal = document.getElementById('achievementModal')
  if (!modal) {
    modal = document.createElement('div')
    modal.id = 'achievementModal'
    modal.className = 'achievement-modal'
    modal.innerHTML = `
      <div class="achievement-card">
        <div class="achievement-icon" id="achievementIcon"></div>
        <h3 id="achievementName"></h3>
        <p id="achievementDesc"></p>
        <div class="achievement-xp">+<span id="achievementXP"></span> XP</div>
        <button class="btn-primary btn-block" id="achievementCloseBtn">¡Genial!</button>
      </div>`
    document.body.appendChild(modal)
    modal.querySelector('#achievementCloseBtn').addEventListener('click', closeAchievementModal)
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAchievementModal()
    })
  }

  modal.querySelector('#achievementIcon').textContent = achievement.icon || '🏆'
  modal.querySelector('#achievementName').textContent = achievement.name
  modal.querySelector('#achievementDesc').textContent = achievement.description || ''
  modal.querySelector('#achievementXP').textContent = achievement.xp_reward || 0
  modal.classList.remove('hidden')
}

export function closeAchievementModal() {
  const modal = document.getElementById('achievementModal')
  if (modal) modal.classList.add('hidden')
}
