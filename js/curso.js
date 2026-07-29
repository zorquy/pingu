import { supabase } from './supabase.js'
import { escapeHtml, getSession } from './app.js'
import { markCourseStarted, markCourseCompleted, addXP } from './gamification.js'

let blocks = []
let currentIndex = 0
let guide = null
let session = null
let categorySlug = null

const stage = document.getElementById('cursoStage')
const progressFill = document.getElementById('progressFill')
const btnContinue = document.getElementById('btnContinue')
const btnBack = document.getElementById('btnBack')

function updateProgress() {
  const pct = blocks.length > 1 ? (currentIndex / (blocks.length - 1)) * 100 : 100
  progressFill.style.width = `${pct}%`
}

async function persistIndex(index) {
  if (!session) return
  await supabase
    .from('user_progress')
    .update({ current_block_index: index, updated_at: new Date().toISOString() })
    .eq('user_id', session.user.id)
    .eq('guide_id', guide.id)
}

function renderHook(b) {
  return `
    <div class="block block-hook">
      <span class="block-emoji">${b.emoji || '👋'}</span>
      <h1 class="block-headline">${escapeHtml(b.headline || '')}</h1>
      <p class="block-subtext">${escapeHtml(b.subtext || '')}</p>
    </div>`
}

function renderConceptLike(b, extraClass, label) {
  return `
    <div class="block ${extraClass}">
      <div class="block-header">
        <span>${b.emoji || ''}</span>
        <span class="block-label">${label}</span>
      </div>
      ${b.image_url ? `<img src="${b.image_url}" class="block-image" onerror="this.style.display='none'">` : ''}
      <h2 class="block-title">${escapeHtml(b.title || '')}</h2>
      <p class="block-body">${escapeHtml(b.body || '')}</p>
      ${b.highlight ? `<div class="block-highlight">${escapeHtml(b.highlight)}</div>` : ''}
    </div>`
}

function renderQuiz(b) {
  const options = (b.options || [])
    .map((opt, i) => `<button class="quiz-option" data-index="${i}">${escapeHtml(opt)}</button>`)
    .join('')
  return `
    <div class="block block-quiz">
      <div class="block-header quiz-header">
        <span class="block-label">PREGUNTA +5 XP</span>
      </div>
      <h2 class="block-question">${escapeHtml(b.question || '')}</h2>
      <div class="quiz-options">${options}</div>
      <div class="quiz-explanation hidden">${escapeHtml(b.explanation || '')}</div>
    </div>`
}

function renderChecklist(b) {
  const items = (b.items || [])
    .map((item, i) => `
      <li class="checklist-item" data-index="${i}">
        <div class="checkbox"></div>
        <span>${escapeHtml(item)}</span>
      </li>`)
    .join('')
  return `
    <div class="block block-checklist">
      <h2>${escapeHtml(b.title || '')}</h2>
      <ul class="checklist">${items}</ul>
    </div>`
}

function renderReward(b) {
  return `
    <div class="block block-reward">
      <div class="reward-trophy">🏆</div>
      <h2>¡Curso completado!</h2>
      <div class="xp-display"><span id="xpCounter">0</span> XP</div>
      ${!session ? '<p style="color: var(--ice); font-size: 13px;">Crea una cuenta para guardar tu progreso y XP.</p>' : ''}
      <div class="reward-actions">
        ${b.next_guide_slug ? `<a href="curso.html?slug=${encodeURIComponent(b.next_guide_slug)}" class="btn-primary">Siguiente curso →</a>` : ''}
        <a href="index.html" class="btn-secondary">Volver al inicio</a>
      </div>
    </div>`
}

function getBlockHTML(block) {
  switch (block.type) {
    case 'hook':
      return renderHook(block)
    case 'concept':
      return renderConceptLike(block, 'block-concept', 'CONCEPTO')
    case 'warning':
      return renderConceptLike(block, 'block-warning', '⚠️ CUIDADO')
    case 'tip':
      return renderConceptLike(block, 'block-tip', '💡 CONSEJO')
    case 'example':
      return renderConceptLike(block, 'block-example', '📌 EJEMPLO')
    case 'quiz':
      return renderQuiz(block)
    case 'checklist':
      return renderChecklist(block)
    case 'reward':
      return renderReward(block)
    default:
      return `<div class="block"><p>Bloque desconocido.</p></div>`
  }
}

function animateXP(target) {
  const el = document.getElementById('xpCounter')
  if (!el) return
  let current = 0
  const interval = setInterval(() => {
    current += 2
    if (current >= target) {
      el.textContent = target
      clearInterval(interval)
    } else {
      el.textContent = current
    }
  }, 30)
}

async function setupBlockLogic(block) {
  if (block.type === 'quiz') {
    btnContinue.disabled = true
    btnContinue.classList.add('disabled')

    stage.querySelectorAll('.quiz-option').forEach((btn) => {
      btn.addEventListener('click', function onClick() {
        const selected = parseInt(this.dataset.index, 10)
        const isCorrect = selected === block.correct_index

        stage.querySelectorAll('.quiz-option').forEach((b, i) => {
          b.disabled = true
          if (i === block.correct_index) b.classList.add('correct')
          if (i === selected && !isCorrect) b.classList.add('incorrect')
        })

        stage.querySelector('.quiz-explanation')?.classList.remove('hidden')

        if (isCorrect && session) {
          addXP(session.user.id, 5)
        }

        btnContinue.disabled = false
        btnContinue.classList.remove('disabled')
      })
    })
  } else if (block.type === 'checklist') {
    btnContinue.disabled = true
    btnContinue.classList.add('disabled')

    const items = stage.querySelectorAll('.checklist-item')
    items.forEach((item) => {
      item.addEventListener('click', () => {
        item.classList.toggle('checked')
        const allChecked = Array.from(items).every((i) => i.classList.contains('checked'))
        btnContinue.disabled = !allChecked
        btnContinue.classList.toggle('disabled', !allChecked)
      })
    })
  } else if (block.type === 'reward') {
    btnContinue.style.display = 'none'
    const xp = block.xp || 20
    animateXP(xp)

    if (session) {
      await markCourseCompleted(session.user.id, guide.id, xp)
    }
  } else {
    btnContinue.disabled = false
    btnContinue.classList.remove('disabled')
  }
}

function renderBlock(index) {
  const block = blocks[index]
  btnContinue.style.display = ''
  btnContinue.textContent = index === blocks.length - 1 ? 'Finalizar' : 'Continuar →'

  stage.classList.add('slide-out-left')

  setTimeout(() => {
    stage.innerHTML = getBlockHTML(block)
    stage.classList.remove('slide-out-left')
    stage.classList.add('slide-in-right')
    setTimeout(() => stage.classList.remove('slide-in-right'), 300)

    updateProgress()
    setupBlockLogic(block)
  }, 300)
}

async function loadCourse() {
  const slug = new URLSearchParams(window.location.search).get('slug')
  if (!slug) {
    stage.innerHTML = `<p class="empty-state">Curso no encontrado.</p>`
    btnContinue.style.display = 'none'
    return
  }

  const { data, error } = await supabase
    .from('guides')
    .select('*, categories(slug)')
    .eq('slug', slug)
    .single()

  if (error || !data || !Array.isArray(data.blocks) || data.blocks.length === 0) {
    stage.innerHTML = `<p class="empty-state">Este curso todavía no está disponible.</p>`
    btnContinue.style.display = 'none'
    return
  }

  guide = data
  blocks = data.blocks
  categorySlug = data.categories?.slug || null
  session = await getSession()

  currentIndex = 0

  if (session) {
    const { data: existing } = await supabase
      .from('user_progress')
      .select('status, current_block_index')
      .eq('user_id', session.user.id)
      .eq('guide_id', guide.id)
      .maybeSingle()

    if (existing && existing.status === 'started' && existing.current_block_index) {
      currentIndex = Math.min(existing.current_block_index, blocks.length - 1)
    }

    await markCourseStarted(session.user.id, guide.id)
    if (currentIndex > 0) await persistIndex(currentIndex)
  }

  renderBlock(currentIndex)
}

btnContinue.addEventListener('click', () => {
  if (btnContinue.disabled) return
  if (currentIndex < blocks.length - 1) {
    currentIndex++
    persistIndex(currentIndex)
    renderBlock(currentIndex)
  }
})

btnBack.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    window.location.href = categorySlug ? `categoria.html?slug=${encodeURIComponent(categorySlug)}` : 'aprender.html'
  }
})

loadCourse()
