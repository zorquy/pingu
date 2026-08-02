import { supabase } from './supabase.js'
import { passwordStrengthError } from './app.js'

const stepReset = document.getElementById('stepReset')
const stepInvalid = document.getElementById('stepInvalid')

function setError(message) {
  const el = stepReset.querySelector('.auth-error')
  if (el) el.textContent = message || ''
}

// El enlace del email deja a Supabase establecer una sesión de recuperación
// automáticamente al cargar la página. Si no llega en unos segundos, el
// enlace era inválido o ya había caducado.
let recoveryReady = false

supabase.auth.onAuthStateChange((event) => {
  if (event === 'PASSWORD_RECOVERY') recoveryReady = true
})

setTimeout(async () => {
  if (recoveryReady) return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) {
    stepReset.classList.add('hidden')
    stepInvalid.classList.remove('hidden')
  }
}, 2500)

const btnSavePassword = document.getElementById('btnSavePassword')

btnSavePassword?.addEventListener('click', async () => {
  const password = document.getElementById('newPassword').value
  setError('')

  const pwError = passwordStrengthError(password)
  if (pwError) {
    setError(pwError)
    return
  }

  btnSavePassword.disabled = true
  btnSavePassword.textContent = 'Guardando...'

  const { error } = await supabase.auth.updateUser({ password })

  btnSavePassword.disabled = false
  btnSavePassword.textContent = 'Guardar contraseña'

  if (error) {
    const msg = (error.message || '').toLowerCase()
    setError(
      msg.includes('password') && (msg.includes('short') || msg.includes('character') || msg.includes('weak'))
        ? 'La contraseña debe tener al menos 8 caracteres, con mayúsculas, minúsculas, números y símbolos.'
        : 'No se pudo guardar la contraseña. Pide un enlace nuevo e inténtalo otra vez.'
    )
    return
  }

  window.location.href = 'perfil.html'
})
