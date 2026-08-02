import { supabase } from './supabase.js'
import { burstConfetti, achievementIconHtml } from './app.js'
import { icons } from './icons.js'

// Los logros se gestionan desde /admin en la tabla `achievement_definitions`.
// `condition` es jsonb: { type: 'completed_guides_count' | 'total_xp' | 'quiz_correct_count', count: number }
let achievementsCache = null

export async function getAllAchievements() {
  if (achievementsCache) return achievementsCache
  const { data } = await supabase
    .from('achievement_definitions')
    .select('*')
    .eq('is_active', true)
    .order('xp_reward')
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

// Reputación de colaborador, basada en cuántas guías/cursos ha aprobado
// la moderación (no en XP, que ya mide el progreso como estudiante).
export function contributorTier(approvedGuidesCount) {
  if (approvedGuidesCount >= 10) return { title: 'Leyenda de la comunidad', icon: icons.crown(16) }
  if (approvedGuidesCount >= 5) return { title: 'Colaborador destacado', icon: icons.star(16) }
  if (approvedGuidesCount >= 1) return { title: 'Colaborador', icon: icons.sprout(16) }
  return { title: 'Miembro', icon: icons.user(16) }
}

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

export async function incrementQuizCorrect(userId) {
  const { data } = await supabase.from('user_profiles').select('quiz_correct_count').eq('id', userId).single()
  await supabase
    .from('user_profiles')
    .update({ quiz_correct_count: (data?.quiz_correct_count || 0) + 1 })
    .eq('id', userId)
  await checkAchievements(userId)
}

const STREAK_BONUS_XP = 5

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function yesterdayISO() {
  return new Date(Date.now() - 86400_000).toISOString().slice(0, 10)
}

// Racha diaria: la primera vez que alguien entra cada día suma un pequeño
// bonus de XP y avanza el contador (o lo reinicia a 1 si dejó pasar un día
// sin entrar). Idempotente dentro del mismo día — entrar varias veces el
// mismo día no vuelve a sumar nada.
export async function checkDailyStreak(userId) {
  const { data: profile } = await supabase.from('user_profiles').select('current_streak, last_active_date').eq('id', userId).single()
  if (!profile) return

  const today = todayISO()
  if (profile.last_active_date === today) return

  const newStreak = profile.last_active_date === yesterdayISO() ? (profile.current_streak || 0) + 1 : 1
  await supabase.from('user_profiles').update({ current_streak: newStreak, last_active_date: today }).eq('id', userId)
  await addXP(userId, STREAK_BONUS_XP)
}

export async function markCourseStarted(userId, guideId) {
  await supabase.from('user_progress').upsert(
    {
      user_id: userId,
      guide_id: guideId,
      status: 'started',
      started_at: new Date().toISOString(),
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
      xp_earned: xpEarned,
    },
    { onConflict: 'user_id,guide_id' }
  )

  await addXP(userId, xpEarned)
  await checkAchievements(userId)
}

function achievementValue(condition, stats) {
  switch (condition?.type) {
    case 'total_xp':
      return stats.totalXp
    case 'quiz_correct_count':
      return stats.quizCorrectCount
    case 'approved_guides_count':
      return stats.approvedGuidesCount
    case 'completed_guides_count':
    default:
      return stats.completedCount
  }
}

export async function checkAchievements(userId) {
  const [{ count: completedCount }, { count: approvedGuidesCount }, { data: profile }, achievements] = await Promise.all([
    supabase
      .from('user_progress')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('status', 'completed'),
    supabase
      .from('guides')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', userId)
      .eq('review_status', 'approved'),
    supabase
      .from('user_profiles')
      .select('total_xp, achievements, quiz_correct_count')
      .eq('id', userId)
      .single(),
    getAllAchievements(),
  ])

  if (!profile) return []

  const unlocked = profile.achievements || []
  const stats = {
    completedCount: completedCount || 0,
    totalXp: profile.total_xp || 0,
    quizCorrectCount: profile.quiz_correct_count || 0,
    approvedGuidesCount: approvedGuidesCount || 0,
  }
  const newlyUnlocked = []

  for (const a of achievements) {
    if (unlocked.includes(a.id)) continue
    const value = achievementValue(a.condition, stats)
    const threshold = a.condition?.count ?? Infinity
    if (value >= threshold) newlyUnlocked.push(a)
  }

  if (newlyUnlocked.length > 0) {
    await supabase
      .from('user_profiles')
      .update({ achievements: [...unlocked, ...newlyUnlocked.map((a) => a.id)] })
      .eq('id', userId)

    const bonusXp = newlyUnlocked.reduce((sum, a) => sum + (a.xp_reward || 0), 0)
    if (bonusXp > 0) await addXP(userId, bonusXp)

    showAchievementModal(newlyUnlocked[0])
  }

  return newlyUnlocked.map((a) => a.id)
}

export function showAchievementModal(achievement) {
  if (!achievement) return

  burstConfetti()

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
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !modal.classList.contains('hidden')) closeAchievementModal()
    })
  }

  const iconEl = modal.querySelector('#achievementIcon')
  iconEl.innerHTML = achievementIconHtml(achievement, 42)
  iconEl.className = `achievement-icon rarity-${achievement.rarity || 'bronze'}`
  modal.querySelector('#achievementName').textContent = achievement.title
  modal.querySelector('#achievementDesc').textContent = achievement.description || ''
  modal.querySelector('#achievementXP').textContent = achievement.xp_reward || 0
  modal.classList.remove('hidden')
}

export function closeAchievementModal() {
  const modal = document.getElementById('achievementModal')
  if (modal) modal.classList.add('hidden')
}
