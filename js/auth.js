import { supabase } from './supabase.js'

const steps = {
  email: document.getElementById('stepEmail'),
  otp: document.getElementById('stepOtp'),
  name: document.getElementById('stepName'),
}

let currentEmail = ''
let resendTimer = null

function showStep(step) {
  Object.values(steps).forEach((el) => el?.classList.add('hidden'))
  steps[step]?.classList.remove('hidden')
}

function setError(stepEl, message) {
  const errorEl = stepEl.querySelector('.auth-error')
  if (errorEl) errorEl.textContent = message || ''
}

function friendlyAuthError(error) {
  const msg = (error?.message || '').toLowerCase()
  if (msg.includes('rate limit') || msg.includes('too many')) {
    return 'Has pedido demasiados códigos seguidos. Espera un minuto e inténtalo de nuevo.'
  }
  if (msg.includes('invalid') && msg.includes('otp')) {
    return 'El código no es correcto o ha caducado.'
  }
  if (msg.includes('email')) {
    return 'Revisa que el email sea correcto.'
  }
  return 'Ha ocurrido un error. Inténtalo de nuevo.'
}

// ── Paso 1: email ──
const emailInput = document.getElementById('emailInput')
const btnSendCode = document.getElementById('btnSendCode')

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

emailInput?.addEventListener('input', () => {
  btnSendCode.disabled = !validEmail(emailInput.value.trim())
})

btnSendCode?.addEventListener('click', async () => {
  const email = emailInput.value.trim()
  setError(steps.email, '')
  btnSendCode.disabled = true
  btnSendCode.textContent = 'Enviando...'

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })

  btnSendCode.textContent = 'Enviar código'

  if (error) {
    setError(steps.email, friendlyAuthError(error))
    btnSendCode.disabled = false
    return
  }

  currentEmail = email
  document.getElementById('otpEmailLabel').textContent = email
  showStep('otp')
  startResendTimer()
  document.querySelector('.otp-box')?.focus()
})

// ── Paso 2: OTP ──
const otpBoxes = Array.from(document.querySelectorAll('.otp-box'))

otpBoxes.forEach((box, i) => {
  box.addEventListener('input', () => {
    box.value = box.value.replace(/\D/g, '').slice(0, 1)
    box.classList.remove('error')
    if (box.value && i < otpBoxes.length - 1) otpBoxes[i + 1].focus()
    maybeSubmitOtp()
  })
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace' && !box.value && i > 0) {
      otpBoxes[i - 1].focus()
    }
  })
})

async function maybeSubmitOtp() {
  const code = otpBoxes.map((b) => b.value).join('')
  if (code.length !== 6) return
  setError(steps.otp, '')

  const { data, error } = await supabase.auth.verifyOtp({
    email: currentEmail,
    token: code,
    type: 'email',
  })

  if (error) {
    otpBoxes.forEach((b) => b.classList.add('error'))
    setError(steps.otp, friendlyAuthError(error))
    return
  }

  const userId = data.user.id
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('username, onboarding_completed')
    .eq('id', userId)
    .single()

  if (!profile || !profile.username) {
    showStep('name')
    return
  }

  window.location.href = profile.onboarding_completed === false ? 'onboarding.html' : 'index.html'
}

function startResendTimer() {
  const btn = document.getElementById('btnResend')
  if (!btn) return
  let seconds = 30
  btn.disabled = true
  clearInterval(resendTimer)
  const update = () => {
    btn.textContent = seconds > 0 ? `Reenviar código (${seconds}s)` : 'Reenviar código'
    btn.disabled = seconds > 0
  }
  update()
  resendTimer = setInterval(() => {
    seconds--
    update()
    if (seconds <= 0) clearInterval(resendTimer)
  }, 1000)
}

document.getElementById('btnResend')?.addEventListener('click', async () => {
  await supabase.auth.signInWithOtp({ email: currentEmail, options: { shouldCreateUser: true } })
  startResendTimer()
})

// ── Paso 3: nombre ──
const nameInput = document.getElementById('nameInput')
const btnSaveName = document.getElementById('btnSaveName')

nameInput?.addEventListener('input', () => {
  btnSaveName.disabled = nameInput.value.trim().length < 2
})

btnSaveName?.addEventListener('click', async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return

  const name = nameInput.value.trim()
  await supabase.from('user_profiles').upsert({
    id: user.id,
    username: name,
    display_name: name,
    onboarding_completed: false,
  })

  window.location.href = 'onboarding.html'
})
