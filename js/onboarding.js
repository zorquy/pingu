import { supabase } from './supabase.js'
import { escapeHtml, requireAuth } from './app.js'

const state = { level: null, interests: new Set() }
let categories = []

const PATH_BY_LEVEL = {
  nuevo: { slug: 'beginner_path', name: 'Primeros pasos', emoji: '🌱', desc: 'Los fundamentos para empezar con buen pie.' },
  intermedio: { slug: 'smart_buying_path', name: 'Compra con cabeza', emoji: '🧠', desc: 'Aprende a comprar y detectar cartas falsas.' },
  experimentado: { slug: 'card_value_path', name: 'Valor de las cartas', emoji: '💎', desc: 'Domina rarezas, grading y valor de mercado.' },
}

function goToStep(n) {
  document.querySelectorAll('.onb-step').forEach((s) => s.classList.remove('active'))
  document.getElementById(`onbStep${n}`).classList.add('active')
}

async function loadCategories() {
  const { data } = await supabase.from('categories').select('id, name, slug').order('order_pos').limit(6)
  categories = data || []
  document.getElementById('onbInterestsGrid').innerHTML = categories
    .map((c) => `<button class="onb-interest-card" data-id="${c.id}">${escapeHtml(c.name)}</button>`)
    .join('')

  document.querySelectorAll('.onb-interest-card').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.id
      card.classList.toggle('selected')
      if (state.interests.has(id)) state.interests.delete(id)
      else state.interests.add(id)
      document.getElementById('btnStep4Next').disabled = state.interests.size === 0
    })
  })
}

function showRecommendedPath() {
  const path = PATH_BY_LEVEL[state.level] || PATH_BY_LEVEL.nuevo
  document.getElementById('onbRecommendedPath').innerHTML = `
    <span style="font-size: 30px;">${path.emoji}</span>
    <h3>${escapeHtml(path.name)}</h3>
    <p>${escapeHtml(path.desc)}</p>`
}

async function finishOnboarding(session, name) {
  await supabase
    .from('user_profiles')
    .update({
      username: name,
      experience_level: state.level,
      interests: Array.from(state.interests),
      onboarding_completed: true,
    })
    .eq('id', session.user.id)

  window.location.href = 'index.html'
}

async function init() {
  const session = await requireAuth()
  if (!session) return

  const { data: profile } = await supabase.from('user_profiles').select('username').eq('id', session.user.id).single()
  if (profile?.username) document.getElementById('onbNameInput').value = profile.username

  await loadCategories()

  document.getElementById('btnStep1Next').addEventListener('click', () => goToStep(2))

  const nameInput = document.getElementById('onbNameInput')
  const btnStep2Next = document.getElementById('btnStep2Next')
  btnStep2Next.disabled = nameInput.value.trim().length < 2
  nameInput.addEventListener('input', () => {
    btnStep2Next.disabled = nameInput.value.trim().length < 2
  })
  btnStep2Next.addEventListener('click', () => goToStep(3))

  document.querySelectorAll('#onbLevelOptions .onb-option-card').forEach((card) => {
    card.addEventListener('click', () => {
      document.querySelectorAll('#onbLevelOptions .onb-option-card').forEach((c) => c.classList.remove('selected'))
      card.classList.add('selected')
      state.level = card.dataset.value
      document.getElementById('btnStep3Next').disabled = false
    })
  })
  document.getElementById('btnStep3Next').addEventListener('click', () => goToStep(4))

  document.getElementById('btnStep4Next').addEventListener('click', () => {
    showRecommendedPath()
    goToStep(5)
  })

  document.getElementById('btnFinish').addEventListener('click', () => finishOnboarding(session, nameInput.value.trim()))
}

init()
