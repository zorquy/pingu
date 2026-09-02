import { supabase } from './supabase.js'
import { uniqueUsername, passwordStrengthError } from './app.js'
import { showToast } from './toast.js'

const steps = {
  login: document.getElementById('stepLogin'),
  register: document.getElementById('stepRegister'),
  forgot: document.getElementById('stepForgot'),
}

function showStep(step) {
  Object.values(steps).forEach((el) => el?.classList.add('hidden'))
  steps[step]?.classList.remove('hidden')
}

if (new URLSearchParams(window.location.search).get('banned') === '1') {
  setError(steps.login, 'Esta cuenta ha sido suspendida. Si crees que es un error, contáctanos.')
}

// Llegar DIRECTO al registro (?registro=1): lo usa el escaparate de
// torneos — a quien quiere apuntarse sin cuenta se le trae al
// formulario de crearla, no al login (pedido de Ibai, 2026-09-02). El
// `volver` de la URL sigue funcionando igual al terminar.
if (new URLSearchParams(window.location.search).get('registro') === '1') {
  showStep('register')
}

// El enlace de invitación (/r/<usuario> redirige aquí con ?r=). Se
// apunta en el navegador y lo consume el onboarding al terminar: así
// sobrevive al viaje por el registro, la confirmación de correo y el
// OAuth de Google, que pierden la query por el camino.
try {
  const padrino = new URLSearchParams(window.location.search).get('r')
  if (padrino && /^[a-z0-9_-]{1,40}$/i.test(padrino)) localStorage.setItem('pokedoc-referido', padrino)
} catch {}

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
  if (msg.includes('password') && (msg.includes('short') || msg.includes('character') || msg.includes('weak'))) {
    return 'La contraseña debe tener al menos 8 caracteres, con mayúsculas, minúsculas, números y símbolos.'
  }
  // Sin traducción conocida: mostramos el mensaje real de Supabase en vez de
  // enmascararlo con un genérico que podría despistar sobre la causa real.
  return error?.message || 'Ha ocurrido un error. Inténtalo de nuevo.'
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

// A dónde se vuelve tras entrar. Sirve para los enlaces compartidos
// (tanda 229): quien abre un torneo sin cuenta y entra, vuelve AL
// TORNEO y no a la portada.
//
// Solo se aceptan rutas de esta misma web: tiene que empezar por una
// barra y NO por dos (ni por barra-contrabarra), que es como se cuela un
// «//evil.com» que el navegador entiende como otro dominio. Cualquier
// otra cosa se ignora y se va a la portada de siempre.
export function destinoTrasEntrar(bruto) {
  const v = String(bruto ?? '')
  if (!v.startsWith('/') || v.startsWith('//') || v.startsWith('/\\')) return 'index.html'
  return v
}

async function afterAuth(userId) {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('username, onboarding_completed')
    .eq('id', userId)
    .single()

  // El onboarding manda sobre la vuelta: quien aún no lo ha hecho pasa
  // por ahí igualmente.
  if (profile?.onboarding_completed === false) {
    window.location.href = 'onboarding.html'
    return
  }
  window.location.href = destinoTrasEntrar(new URLSearchParams(window.location.search).get('volver'))
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

const btnResendConfirmation = document.getElementById('btnResendConfirmation')

btnLogin?.addEventListener('click', async () => {
  const email = document.getElementById('loginEmail').value.trim()
  const password = document.getElementById('loginPassword').value
  setError(steps.login, '')
  btnResendConfirmation.classList.add('hidden')

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
    if ((error.message || '').toLowerCase().includes('not confirmed')) {
      btnResendConfirmation.dataset.email = email
      btnResendConfirmation.classList.remove('hidden')
    }
    return
  }

  await afterAuth(data.user.id)
})

btnResendConfirmation?.addEventListener('click', async () => {
  const email = btnResendConfirmation.dataset.email
  btnResendConfirmation.disabled = true
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: `${window.location.origin}/index.html` },
  })
  btnResendConfirmation.disabled = false
  showToast(error ? friendlyAuthError(error) : 'Te hemos reenviado el enlace de confirmación.', error ? 'error' : 'success')
})

// ── Registro ──
const btnRegister = document.getElementById('btnRegister')

function showFakeRegisterSuccess() {
  setError(steps.register, '')
  steps.register.querySelector('h2').textContent = 'Revisa tu email'
  steps.register.querySelector('.subtext').textContent = 'Te hemos enviado un enlace para confirmar tu cuenta. Ábrelo y luego inicia sesión.'
  document.getElementById('registerName').closest('.form-group').classList.add('hidden')
  document.getElementById('registerEmail').closest('.form-group').classList.add('hidden')
  document.getElementById('registerPassword').closest('.form-group').classList.add('hidden')
  btnRegister.classList.add('hidden')
  document.getElementById('btnGoogleRegister').classList.add('hidden')
}

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
  const pwError = passwordStrengthError(password)
  if (pwError) {
    setError(steps.register, pwError)
    return
  }

  // Honeypot anti-bot: un campo invisible para personas (ver auth.html) que
  // solo un bot rellenaría. Si viene relleno, se finge éxito sin llegar a
  // crear ninguna cuenta ni gastar un intento real contra Supabase — así el
  // bot no aprende que se le ha detectado y no insiste con más variantes.
  if (document.getElementById('registerWebsite')?.value) {
    showFakeRegisterSuccess()
    return
  }

  btnRegister.disabled = true
  btnRegister.textContent = 'Creando cuenta...'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Sin esto, el enlace del email de confirmación vuelve al "Site URL"
    // del proyecto de Supabase (el dominio de Netlify) en vez de al
    // dominio desde el que la persona se ha registrado.
    options: { emailRedirectTo: `${window.location.origin}/index.html` },
  })

  btnRegister.disabled = false
  btnRegister.textContent = 'Crear cuenta →'

  if (error) {
    setError(steps.register, friendlyAuthError(error))
    return
  }

  if (!data.session) {
    // El proyecto de Supabase tiene activada la confirmación por email:
    // la cuenta se crea pero no hay sesión hasta que se confirme.
    showFakeRegisterSuccess()
    return
  }

  const username = await uniqueUsername(name, data.user.id)
  const { error: profileError } = await supabase.from('user_profiles').upsert({
    id: data.user.id,
    username,
    display_name: name,
    onboarding_completed: false,
  })

  if (profileError) {
    setError(steps.register, friendlyAuthError(profileError))
    return
  }

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
