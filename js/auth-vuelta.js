// La vuelta de Supabase con un fallo (tanda 1360, PINGU: «el registro está
// roto: me reenvía al home sin registrarme»). Cuando entrar con Google o el
// enlace del correo de confirmación sale mal, Supabase no avisa: devuelve a
// la dirección de vuelta (/index.html) con el motivo escrito detrás
// (#error=…&error_code=…&error_description=…). Nadie lo leía, así que quien
// se registraba aparecía en Inicio sin cuenta y sin saber por qué, y a
// nosotros no nos llegaba nada. Aquí se lee, se explica y se apunta.
//
// Sin imports: lo puro se prueba en Node y la página lo carga solo cuando
// la dirección trae un fallo.

// La cadena la captura js/supabase.js ANTES de crear el cliente, que lee
// esa misma dirección al arrancar.
export function leerVuelta(cadena) {
  const p = new URLSearchParams(String(cadena || '').replace(/^[#?]/, '').replace(/&?[#?]/g, '&'))
  const texto = (p.get('error_description') || '').replace(/\+/g, ' ').trim()
  const error = p.get('error') || ''
  const codigo = p.get('error_code') || ''
  if (!texto && !error && !codigo) return null
  return { error, codigo, texto }
}

// Lo que se le dice a la persona. Lo más común primero: el enlace del correo
// caducado o ya usado (algunos correos lo «abren» solos al revisarlo).
export function explicarVuelta(v) {
  if (!v) return ''
  const t = `${v.codigo} ${v.error} ${v.texto}`.toLowerCase()
  if (/otp_expired|expired|invalid.*link|link.*invalid/.test(t)) {
    return 'El enlace del correo ya no vale: caduca en una hora o ya se usó (algunos correos lo abren solos al revisarlo). Si ya confirmaste tu cuenta, entra con tu email y contraseña; si no, prueba a entrar y te ofreceremos mandarte otro.'
  }
  if (/signup.*(disabled|not allowed)|signups not allowed/.test(t)) {
    return 'Ahora mismo no se pueden crear cuentas nuevas. Vuelve a probar en un rato.'
  }
  if (/database error|saving new user|server_error|unexpected_failure/.test(t)) {
    return 'No hemos podido crear tu cuenta por un fallo nuestro. Ya nos ha llegado el aviso: prueba otra vez en un rato o crea la cuenta con tu email.'
  }
  if (/already|exists/.test(t)) {
    return 'Ese correo ya tiene una cuenta en PokeDoc. Entra con tu email y contraseña (o con «¿Olvidaste tu contraseña?»).'
  }
  if (/access_denied/.test(t)) {
    return 'No se ha podido entrar con Google: lo has cancelado o tu cuenta no lo permite (pasa con las de colegio o de trabajo). Prueba con otra cuenta de Google o con tu email.'
  }
  return `No hemos podido terminar de entrar${v.texto ? ` («${v.texto}»)` : ''}. Vuelve a probar o crea la cuenta con tu email.`
}

// Desde cualquier página que no sea la de entrar: a la de entrar, con el
// fallo en la dirección (la de entrar lo explica y lo apunta).
export function mandarAEntrar(cadena, win = globalThis) {
  const v = leerVuelta(cadena)
  if (!v) return false
  const q = new URLSearchParams({ vuelta: [v.error, v.codigo, v.texto].join('|').slice(0, 300) })
  win.location.replace(`/auth.html?${q}`)
  return true
}

// La de entrar recibe el fallo de las dos maneras: directo de Supabase (si
// la vuelta fue a ella) o de mandarAEntrar.
export function vueltaDeEntrar(cadena, search) {
  const directa = leerVuelta(cadena)
  if (directa) return directa
  const crudo = new URLSearchParams(search || '').get('vuelta')
  if (!crudo) return null
  const [error = '', codigo = '', ...resto] = crudo.split('|')
  const texto = resto.join('|')
  return error || codigo || texto ? { error, codigo, texto } : null
}
