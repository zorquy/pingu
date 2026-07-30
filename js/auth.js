import { supabase } from './supabase.js'

const steps = {
  login: document.getElementById('stepLogin'),
  register: document.getElementById('stepRegister'),
  forgot: document.getElementById('stepForgot'),
}

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
    return 'Demasiados intentos seguidos. Espera un minuto e inténtalo de nuevo.'
  }
  if (msg.includes('invalid login credentials') || msg.includes('invalid_credentials')) {
    return 'Email o contraseña incorrectos.'
  }
  if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists')) {
    return 'Ya existe una cuenta con ese email. Inicia sesión en vez de crear una nueva (o usa "¿Olvidaste tu contraseña?" si te registraste antes sin contraseña).'
  }
  if (msg.includes('not confirmed')) {
    return 'Confirma tu cuenta desde el enlace que te enviamos por email antes de iniciar sesión.'
  }
  if (msg.includes('invalid format') || msg.includes('unable to validate email')) {
    return 'Revisa que el email sea correcto.'
  }
  if (msg.includes('password') && (msg.includes('short') || msg.includes('at least') || msg.includes('6 characters'))) {
    return 'La contraseña debe tener al menos 6 caracteres.'
  }
  // Sin traducción conocida: mostramos el mensaje real de Supabase en vez de
  // enmascararlo con un genérico que podría despistar sobre la causa real.
  return error?.message || 'Ha ocurrido un error. Inténtalo de nuevo.'
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function afterAuth(userId) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('username, onboarding_completed')
    .eq('id', userId)
    .single()

  window.location.href = profile?.onboarding_completed === false ? 'onboarding.html' : 'index.html'
}

async function signInWithGoogle(e) {
  const btn = e.currentTarget
  btn.disabled = true
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/index.html` },
  })
  // Si signInWithOAuth funciona, el navegador ya ha saltado a Google antes
  // de que esto se ejecute. Si seguimos aquí, ha fallado — mostramos el
  // motivo en vez de dejar el botón como "colgado" sin explicación.
  btn.disabled = false
  if (error) {
    const stepEl = btn.closest('#stepLogin, #stepRegister')
    if (stepEl) setError(stepEl, friendlyAuthError(error))
    console.error('Google sign-in error:', error)
  }
}

document.getElementById('btnGoogleLogin')?.addEventListener('click', signInWithGoogle)
document.getElementById('btnGoogleRegister')?.addEventListener('click', signInWithGoogle)

// ── Navegación entre pasos ──
document.getElementById('btnGoToRegister')?.addEventListener('click', () => showStep('register'))
document.getElementById('btnGoToForgot')?.addEventListener('click', () => showStep('forgot'))
document.getElementById('btnGoToLogin1')?.addEventListener('click', () => showStep('login'))
document.getElementById('btnGoToLogin2')?.addEventListener('click', () => showStep('login'))

// ── Login ──
const btnLogin = document.getElementById('btnLogin')

btnLogin?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim()
  const password = document.getElementById('loginPassword').value
  setError(steps.login, '')

  if (!validEmail(email) || !password) {
    setError(steps.login, 'Escribe tu email y contraseña.')
    return
  }

  btnLogin.disabled = true
  btnLogin.textContent = 'Entrando...'

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  btnLogin.disabled = false
  btnLogin.textContent = 'Entrar'

  if (error) {
    setError(steps.login, friendlyAuthError(error))
    return
  }

  await afterAuth(data.user.id)
})

// ── Registro ──
const btnRegister = document.getElementById('btnRegister')

btnRegister?.addEventListener('click', async () => {
  const name = document.getElementById('registerName').value.trim()
  const email = document.getElementById('registerEmail').value.trim()
  const password = document.getElementById('registerPassword').value
  setError(steps.register, '')

  if (name.length < 2) {
    setError(steps.register, 'Escribe tu nombre.')
    return
  }
  if (!validEmail(email)) {
    setError(steps.register, 'Revisa que el email sea correcto.')
    return
  }
  if (password.length < 6) {
    setError(steps.register, 'La contraseña debe tener al menos 6 caracteres.')
    return
  }

  btnRegister.disabled = true
  btnRegister.textContent = 'Creando cuenta...'

  const { data, error } = await supabase.auth.signUp({ email, password })

  btnRegister.disabled = false
  btnRegister.textContent = 'Crear cuenta →'

  if (error) {
    setError(steps.register, friendlyAuthError(error))
    return
  }

  if (!data.session) {
    // El proyecto de Supabase tiene activada la confirmación por email:
    // la cuenta se crea pero no hay sesión hasta que se confirme.
    setError(steps.register, '')
    steps.register.querySelector('h2').textContent = 'Revisa tu email'
    steps.register.querySelector('.subtext').textContent = 'Te hemos enviado un enlace para confirmar tu cuenta. Ábrelo y luego inicia sesión.'
    document.getElementById('registerName').closest('.form-group').classList.add('hidden')
    document.getElementById('registerEmail').closest('.form-group').classList.add('hidden')
    document.getElementById('registerPassword').closest('.form-group').classList.add('hidden')
    btnRegister.classList.add('hidden')
    document.getElementById('btnGoogleRegister').classList.add('hidden')
    return
  }

  await supabase.from('user_profiles').upsert({
    id: data.user.id,
    username: name,
    display_name: name,
    onboarding_completed: false,
  })

  window.location.href = 'onboarding.html'
})

// ── Recuperar contraseña ──
const btnSendReset = document.getElementById('btnSendReset')

btnSendReset?.addEventListener('click', async () => {
  const email = document.getElementById('forgotEmail').value.trim()
  setError(steps.forgot, '')

  if (!validEmail(email)) {
    setError(steps.forgot, 'Revisa que el email sea correcto.')
    return
  }

  btnSendReset.disabled = true
  btnSendReset.textContent = 'Enviando...'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password.html`,
  })

  btnSendReset.disabled = false
  btnSendReset.textContent = 'Enviar enlace'

  if (error) {
    setError(steps.forgot, friendlyAuthError(error))
    return
  }

  document.getElementById('forgotSuccess').classList.remove('hidden')
})
