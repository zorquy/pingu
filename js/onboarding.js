import { supabase } from './supabase.js'
import { escapeHtml, requireAuth, uniqueUsername } from './app.js'

const state = { level: null, interests: new Set(), recommendedCategory: null }
let categories = []

const LEVEL_INTRO = {
  nuevo: 'Como estás empezando, te recomendamos esta categoría:',
  intermedio: 'Con lo que ya sabes, esta categoría te viene bien:',
  experimentado: 'Para afinar los detalles, prueba esta categoría:',
}

function goToStep(n) {
  document.querySelectorAll('.onb-step').forEach((s) => s.classList.remove('active'))
  document.getElementById(`onbStep${n}`).classList.add('active')
}

async function loadCategories() {
  const { data } = await supabase.from('categories').select('id, slug, name, description, emoji').order('order_pos').limit(6)
  categories = data || []
  document.getElementById('onbInterestsGrid').innerHTML = categories
    .map((c) => `<button class="onb-interest-card" data-slug="${escapeHtml(c.slug)}">${escapeHtml(c.name)}</button>`)
    .join('')

  document.querySelectorAll('.onb-interest-card').forEach((card) => {
    card.addEventListener('click', () => {
      const slug = card.dataset.slug
      card.classList.toggle('selected')
      if (state.interests.has(slug)) state.interests.delete(slug)
      else state.interests.add(slug)
      document.getElementById('btnStep4Next').disabled = state.interests.size === 0
    })
  })
}

function showRecommendedCategory() {
  const chosenSlugs = Array.from(state.interests)
  const category = categories.find((c) => chosenSlugs.includes(c.slug)) || categories[0]
  state.recommendedCategory = category?.slug || null

  document.getElementById('onbRecommendedCategory').innerHTML = category
    ? `
      <p style="opacity:.85; font-size: 13px; margin-bottom: 4px;">${LEVEL_INTRO[state.level] || ''}</p>
      <span style="font-size: 30px;">${category.emoji || '📘'}</span>
      <h3>${escapeHtml(category.name)}</h3>
      <p>${escapeHtml(category.description || '')}</p>`
    : `<p>Todavía no hay categorías configuradas — ¡vuelve pronto!</p>`
}

async function finishOnboarding(session, name) {
  const username = await uniqueUsername(name, session.user.id)
  await supabase
    .from('user_profiles')
    .update({
      username,
      display_name: name,
      interests: Array.from(state.interests),
      recommended_path: state.recommendedCategory,
      onboarding_completed: true,
    })
    .eq('id', session.user.id)

  window.location.href = 'index.html'
}

async function init() {
  const session = await requireAuth()
  if (!session) return

  const { data: profile } = await supabase.from('user_profiles').select('display_name, username').eq('id', session.user.id).single()
  if (profile?.display_name || profile?.username) document.getElementById('onbNameInput').value = profile.display_name || profile.username

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
    showRecommendedCategory()
    goToStep(5)
  })

  document.getElementById('btnFinish').addEventListener('click', () => finishOnboarding(session, nameInput.value.trim()))
}

init()
