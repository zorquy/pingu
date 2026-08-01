import { supabase } from './supabase.js'
import { escapeHtml, getSession, burstConfetti } from './app.js'
import { markCourseStarted, markCourseCompleted, addXP, incrementQuizCorrect } from './gamification.js'
import { parseBBCode } from './bbcode.js'

let blocks = []
let currentIndex = 0
let guide = null
let session = null
let categorySlug = null
// Un bloque de práctica ya completado no debe volver a dar XP si el
// usuario retrocede con "Anterior" y lo vuelve a acertar — sin esto,
// ir hacia atrás y hacia adelante por el mismo quiz daba XP infinito.
const completedPracticeIndices = new Set()

const stage = document.getElementById('cursoStage')
const progressFill = document.getElementById('progressFill')
const btnContinue = document.getElementById('btnContinue')
const btnBack = document.getElementById('btnBack')
const btnPrevious = document.getElementById('btnPrevious')

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function updateProgress() {
  const pct = blocks.length > 1 ? (currentIndex / (blocks.length - 1)) * 100 : 100
  progressFill.style.width = `${pct}%`
}

async function persistIndex(index) {
  if (!session) return
  await supabase
    .from('user_progress')
    .update({ current_block: index })
    .eq('user_id', session.user.id)
    .eq('guide_id', guide.id)
}

function renderHook(b) {
  return `
    <div class="block block-hook">
      <span class="block-emoji">${escapeHtml(b.emoji || '👋')}</span>
      <h1 class="block-headline">${escapeHtml(b.headline || '')}</h1>
      <p class="block-subtext">${parseBBCode(b.subtext || '')}</p>
    </div>`
}

function renderConceptLike(b, extraClass, label) {
  return `
    <div class="block ${extraClass}">
      <div class="block-header">
        <span>${escapeHtml(b.emoji || '')}</span>
        <span class="block-label">${label}</span>
      </div>
      ${b.image_url ? `<img src="${escapeHtml(b.image_url)}" class="block-image" onerror="this.style.display='none'">` : ''}
      <h2 class="block-title">${escapeHtml(b.title || '')}</h2>
      <p class="block-body">${parseBBCode(b.body || '')}</p>
      ${b.highlight ? `<div class="block-highlight">${parseBBCode(b.highlight)}</div>` : ''}
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

function renderTrueFalse(b) {
  return `
    <div class="block block-quiz block-truefalse">
      <div class="block-header quiz-header">
        <span class="block-label">¿VERDADERO O FALSO? +5 XP</span>
      </div>
      <h2 class="block-question">${escapeHtml(b.statement || '')}</h2>
      <div class="tf-options">
        <button class="tf-option" data-value="true">✅ Verdadero</button>
        <button class="tf-option" data-value="false">❌ Falso</button>
      </div>
      <div class="quiz-explanation hidden">${escapeHtml(b.explanation || '')}</div>
    </div>`
}

function renderFillBlank(b) {
  const options = (b.options || [])
    .map((opt) => `<button class="fillblank-option" data-value="${escapeHtml(opt)}">${escapeHtml(opt)}</button>`)
    .join('')
  return `
    <div class="block block-quiz block-fillblank">
      <div class="block-header quiz-header">
        <span class="block-label">RELLENA EL HUECO +5 XP</span>
      </div>
      <p class="fillblank-sentence">
        ${escapeHtml(b.before || '')} <span class="fillblank-slot" id="fillblankSlot">＿＿＿＿</span> ${escapeHtml(b.after || '')}
      </p>
      <div class="fillblank-options">${options}</div>
      <div class="quiz-explanation hidden">${escapeHtml(b.explanation || '')}</div>
    </div>`
}

function renderMatch(b) {
  const pairs = b.pairs || []
  const lefts = pairs.map((p, i) => ({ text: p.left, i }))
  const rights = shuffle(pairs.map((p, i) => ({ text: p.right, i })))
  const leftHtml = lefts.map((l) => `<button class="match-item" data-side="left" data-pair="${l.i}">${escapeHtml(l.text)}</button>`).join('')
  const rightHtml = rights.map((r) => `<button class="match-item" data-side="right" data-pair="${r.i}">${escapeHtml(r.text)}</button>`).join('')
  return `
    <div class="block block-quiz block-match">
      <div class="block-header quiz-header">
        <span class="block-label">RELACIONA LAS PAREJAS +5 XP</span>
      </div>
      <h2 class="block-question">${escapeHtml(b.title || 'Une cada término con su pareja')}</h2>
      <div class="match-columns">
        <div class="match-col">${leftHtml}</div>
        <div class="match-col">${rightHtml}</div>
      </div>
    </div>`
}

function renderOrder(b) {
  const items = b.items || []
  const bank = shuffle(items.map((text, i) => ({ text, i })))
  const bankHtml = bank.map((item) => `<button class="order-chip" data-index="${item.i}">${escapeHtml(item.text)}</button>`).join('')
  return `
    <div class="block block-quiz block-order">
      <div class="block-header quiz-header">
        <span class="block-label">ORDENA LOS PASOS +5 XP</span>
      </div>
      <h2 class="block-question">${escapeHtml(b.title || 'Toca los pasos en el orden correcto')}</h2>
      <div class="order-answer" id="orderAnswer"></div>
      <div class="order-bank" id="orderBank">${bankHtml}</div>
      <p class="order-feedback hidden" id="orderFeedback">Ese orden no es correcto — quita algún paso y prueba otra vez.</p>
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
      <div class="card-stack on-navy" aria-hidden="true">
        <span class="tcg-card c1"></span>
        <span class="tcg-card c2"></span>
        <span class="tcg-card c3"></span>
      </div>
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
    case 'truefalse':
      return renderTrueFalse(block)
    case 'fillblank':
      return renderFillBlank(block)
    case 'match':
      return renderMatch(block)
    case 'order':
      return renderOrder(block)
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

function markPracticeCorrect() {
  if (session && !completedPracticeIndices.has(currentIndex)) {
    completedPracticeIndices.add(currentIndex)
    addXP(session.user.id, 5)
    incrementQuizCorrect(session.user.id)
  }
  btnContinue.disabled = false
  btnContinue.classList.remove('disabled')
}

function setupQuiz(block) {
  stage.querySelectorAll('.quiz-option').forEach((btn) => {
    btn.addEventListener('click', function onClick() {
      const selected = parseInt(this.dataset.index, 10)
      const isCorrect = selected === block.correct_index

      stage.querySelectorAll('.quiz-option').forEach((b, i) => {
        b.disabled = true
        if (i === block.correct_index) b.classList.add('correct')
        if (i === selected && !isCorrect) b.classList.add('incorrect')
      })

      showExplanation(isCorrect, block.explanation)
      if (isCorrect) markPracticeCorrect()
      else {
        btnContinue.disabled = false
        btnContinue.classList.remove('disabled')
      }
    })
  })
}

function setupTrueFalse(block) {
  stage.querySelectorAll('.tf-option').forEach((btn) => {
    btn.addEventListener('click', function onClick() {
      const selected = this.dataset.value === 'true'
      const isCorrect = selected === !!block.is_true

      stage.querySelectorAll('.tf-option').forEach((b) => {
        b.disabled = true
        const isTrueBtn = b.dataset.value === 'true'
        if (isTrueBtn === !!block.is_true) b.classList.add('correct')
        else if (b === this && !isCorrect) b.classList.add('incorrect')
      })

      showExplanation(isCorrect, block.explanation)
      if (isCorrect) markPracticeCorrect()
      else {
        btnContinue.disabled = false
        btnContinue.classList.remove('disabled')
      }
    })
  })
}

function setupFillBlank(block) {
  const slot = document.getElementById('fillblankSlot')
  stage.querySelectorAll('.fillblank-option').forEach((btn) => {
    btn.addEventListener('click', function onClick() {
      const selected = this.dataset.value
      const isCorrect = selected === block.correct_option

      stage.querySelectorAll('.fillblank-option').forEach((b) => {
        b.disabled = true
        if (b.dataset.value === block.correct_option) b.classList.add('correct')
        if (b === this && !isCorrect) b.classList.add('incorrect')
      })

      if (slot) slot.textContent = selected

      showExplanation(isCorrect, block.explanation)
      if (isCorrect) markPracticeCorrect()
      else {
        btnContinue.disabled = false
        btnContinue.classList.remove('disabled')
      }
    })
  })
}

function setupMatch(block) {
  const total = (block.pairs || []).length
  let matchedCount = 0
  let selectedLeft = null

  stage.querySelectorAll('.match-item').forEach((item) => {
    item.addEventListener('click', function onClick() {
      if (this.classList.contains('matched')) return

      if (this.dataset.side === 'left') {
        stage.querySelectorAll('.match-item[data-side="left"]').forEach((el) => el.classList.remove('selected'))
        this.classList.add('selected')
        selectedLeft = this
        return
      }

      if (!selectedLeft) return

      const isCorrect = selectedLeft.dataset.pair === this.dataset.pair
      if (isCorrect) {
        selectedLeft.classList.remove('selected')
        selectedLeft.classList.add('matched')
        this.classList.add('matched')
        selectedLeft = null
        matchedCount++
        if (matchedCount === total) {
          markPracticeCorrect()
        }
      } else {
        const wrongLeft = selectedLeft
        const wrongRight = this
        wrongRight.classList.add('wrong')
        wrongLeft.classList.add('wrong')
        setTimeout(() => {
          wrongRight.classList.remove('wrong')
          wrongLeft.classList.remove('wrong', 'selected')
        }, 400)
        selectedLeft = null
      }
    })
  })
}

function setupOrder(block) {
  const correctOrder = (block.items || []).map((_, i) => i)
  const answerEl = document.getElementById('orderAnswer')
  const bankEl = document.getElementById('orderBank')
  const feedbackEl = document.getElementById('orderFeedback')
  const current = []

  function renderAnswer() {
    answerEl.innerHTML = current
      .map((idx) => `<button class="order-chip placed" data-index="${idx}">${escapeHtml(block.items[idx])}</button>`)
      .join('')
    answerEl.querySelectorAll('.order-chip').forEach((chip) => {
      chip.addEventListener('click', function onClick() {
        const idx = parseInt(this.dataset.index, 10)
        current.splice(current.indexOf(idx), 1)
        feedbackEl.classList.add('hidden')
        renderAnswer()
        renderBank()
        btnContinue.disabled = true
        btnContinue.classList.add('disabled')
      })
    })
  }

  function renderBank() {
    bankEl.querySelectorAll('.order-chip').forEach((chip) => {
      const idx = parseInt(chip.dataset.index, 10)
      chip.classList.toggle('hidden', current.includes(idx))
    })
  }

  bankEl.querySelectorAll('.order-chip').forEach((chip) => {
    chip.addEventListener('click', function onClick() {
      const idx = parseInt(this.dataset.index, 10)
      if (current.includes(idx)) return
      current.push(idx)
      renderAnswer()
      renderBank()

      if (current.length === correctOrder.length) {
        const isCorrect = current.every((v, i) => v === correctOrder[i])
        if (isCorrect) {
          markPracticeCorrect()
        } else {
          feedbackEl.classList.remove('hidden')
        }
      }
    })
  })
}

function showExplanation(isCorrect, explanation) {
  const explanationEl = stage.querySelector('.quiz-explanation')
  if (!explanationEl) return
  explanationEl.textContent = `${isCorrect ? '¡Correcto! ' : '¡Casi! '}${explanation || ''}`
  explanationEl.classList.remove('hidden')
}

const PRACTICE_TYPES = ['quiz', 'truefalse', 'fillblank', 'match', 'order']

async function setupBlockLogic(block) {
  if (PRACTICE_TYPES.includes(block.type)) {
    btnContinue.disabled = true
    btnContinue.classList.add('disabled')
  }

  if (block.type === 'quiz') {
    setupQuiz(block)
  } else if (block.type === 'truefalse') {
    setupTrueFalse(block)
  } else if (block.type === 'fillblank') {
    setupFillBlank(block)
  } else if (block.type === 'match') {
    setupMatch(block)
  } else if (block.type === 'order') {
    setupOrder(block)
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
    const xp = guide.xp_reward || 20
    animateXP(xp)
    burstConfetti()

    if (session) {
      await markCourseCompleted(session.user.id, guide.id, xp)
    }
  } else {
    btnContinue.disabled = false
    btnContinue.classList.remove('disabled')
  }
}

function renderBlock(index, direction = 'forward') {
  const block = blocks[index]
  btnContinue.style.display = ''
  btnContinue.textContent = index === blocks.length - 1 ? 'Finalizar' : 'Continuar →'
  btnPrevious.classList.toggle('hidden', index === 0 || block.type === 'reward')

  const outClass = direction === 'forward' ? 'slide-out-left' : 'slide-out-right'
  const inClass = direction === 'forward' ? 'slide-in-right' : 'slide-in-left'

  stage.classList.add(outClass)

  setTimeout(() => {
    stage.innerHTML = getBlockHTML(block)
    stage.classList.remove(outClass)
    stage.classList.add(inClass)
    setTimeout(() => stage.classList.remove(inClass), 300)

    updateProgress()
    setupBlockLogic(block)
  }, 300)
}

function renderLocked(message) {
  stage.innerHTML = `
    <div class="block" style="text-align: center;">
      <span style="font-size: 40px;">🔒</span>
      <h2>Contenido Pro</h2>
      <p class="block-body">${escapeHtml(message)}</p>
    </div>`
  btnContinue.style.display = 'none'
  btnPrevious.classList.add('hidden')
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

  supabase.from('guides').update({ view_count: (guide.view_count || 0) + 1 }).eq('id', guide.id)

  if (guide.is_pro) {
    let isPro = false
    if (session) {
      const { data: profile } = await supabase.from('user_profiles').select('is_pro').eq('id', session.user.id).single()
      isPro = !!profile?.is_pro
    }
    if (!isPro) {
      renderLocked(session ? 'Este curso es exclusivo para usuarios Pro.' : 'Inicia sesión con una cuenta Pro para acceder a este curso.')
      return
    }
  }

  currentIndex = 0

  if (session) {
    const { data: existing } = await supabase
      .from('user_progress')
      .select('status, current_block')
      .eq('user_id', session.user.id)
      .eq('guide_id', guide.id)
      .maybeSingle()

    if (existing && existing.status === 'started' && existing.current_block) {
      currentIndex = Math.min(existing.current_block, blocks.length - 1)
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
    renderBlock(currentIndex, 'forward')
  }
})

btnPrevious.addEventListener('click', () => {
  if (currentIndex === 0) return
  currentIndex--
  persistIndex(currentIndex)
  renderBlock(currentIndex, 'backward')
})

btnBack.addEventListener('click', () => {
  if (window.history.length > 1) {
    window.history.back()
  } else {
    window.location.href = categorySlug ? `categoria.html?slug=${encodeURIComponent(categorySlug)}` : 'aprender.html'
  }
})

loadCourse()
