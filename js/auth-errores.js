// Lo que se le dice a la gente cuando Supabase Auth dice que no (tanda 1069b).
// Vivía dentro de js/auth.js, que es una página y no se puede importar, y el
// alta de tienda pintaba el error a pelo: un 5xx salía como «{}».
export function friendlyAuthError(error) {
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
  // Un 5xx de Supabase Auth llega como AuthRetryableFetchError con el
  // mensaje «{}» (supabase-js hace JSON.stringify de la Response): se pintaba
  // «{}» bajo el botón (1061). El cuerpo con el motivo se pierde ahí; en el
  // registro suele ser el correo de confirmación que no sale. Status 0, la red.
  if (error?.name === 'AuthRetryableFetchError' || msg === '{}') {
    if (!error?.status) return 'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'
    return 'Ha fallado el servidor y no hemos podido crear la cuenta. Inténtalo en unos minutos o entra con Google.'
  }
  // Sin traducción conocida: mostramos el mensaje real de Supabase en vez de
  // enmascararlo con un genérico que podría despistar sobre la causa real.
  return error?.message || 'Ha ocurrido un error. Inténtalo de nuevo.'
}
