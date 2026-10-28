// /alta-tienda: la cuenta de una tienda, con la invitación del correo
// (tanda 1067). El login y el registro de siempre no cambian: esto solo
// sirve con `?i=<token>`, y quien decide si vale es la base
// (`tienda_invitacion` y `tienda_alta`, que comprueba que el email de quien
// entra sea el de la invitación).
//
// La invitación se apunta en el navegador (`pd-alta-tienda`): la
// confirmación del correo y Google pueden volver sin la `?i=`, y el
// onboarding de siempre la mira para mandar aquí y no al de una persona.
import { supabase } from './supabase.js'
import { passwordStrengthError, slugify, uniqueUsername } from './app.js'
import { icons } from './icons.js'
import { FORMA_DE_USUARIO, MOTIVOS_DE_INVITACION as MOTIVOS, tokenDeAlta } from './tiendas-puro.js'

const $ = (id) => document.getElementById(id)
const CLAVE = 'pd-alta-tienda'
const PASOS = ['altaCargando', 'altaInvalida', 'altaCuenta', 'altaEntrar', 'altaRevisa', 'altaOtro', 'altaTienda', 'altaStock']

function ver(id) {
  for (const p of PASOS) $(p)?.classList.toggle('hidden', p !== id)
}

function leer() { try { return localStorage.getItem(CLAVE) } catch { return null } }
function apuntar(t) { try { t ? localStorage.setItem(CLAVE, t) : localStorage.removeItem(CLAVE) } catch {} }

for (const el of document.querySelectorAll('[data-icono]')) el.innerHTML = icons[el.dataset.icono]?.(20) || ''

const token = tokenDeAlta(location.search, leer())
let invitacion = null

const volverAqui = () => `${location.origin}/alta-tienda?i=${token}`

async function arrancar() {
  if (!token) {
    $('altaInvalidaMotivo').textContent = MOTIVOS.no_existe
    return ver('altaInvalida')
  }
  apuntar(token)
  const { data, error } = await supabase.rpc('tienda_invitacion', { p_token: token })
  if (error || !data?.valida) {
    if (!error) apuntar(null)
    $('altaInvalidaMotivo').textContent = error
      ? 'Ahora mismo no se puede comprobar la invitación. Vuelve a intentarlo en un rato.'
      : MOTIVOS[data?.motivo] || MOTIVOS.no_existe
    return ver('altaInvalida')
  }
  invitacion = data
  for (const el of document.querySelectorAll('[data-alta-nombre]')) el.textContent = data.nombre
  $('altaEmail').value = data.email
  $('altaEntrarEmail').value = data.email

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return ver('altaCuenta')
  if ((session.user.email || '').toLowerCase() !== String(data.email).toLowerCase()) {
    $('altaOtroEmail').textContent = session.user.email || 'otra cuenta'
    $('altaOtroInvitado').textContent = data.email
    return ver('altaOtro')
  }
  await pintarFormTienda(session)
}

async function pintarFormTienda(session) {
  $('altaNombre').value = invitacion.nombre || ''
  $('altaCiudad').value = invitacion.ciudad || ''
  $('altaWeb').value = invitacion.web || ''
  $('altaUsuario').value = await uniqueUsername(invitacion.nombre || 'tienda', session.user.id).catch(() => slugify(invitacion.nombre || ''))
  comprobarUsuario()
  ver('altaTienda')
}

// ¿Está libre ese @? Se mira al escribir; la base lo vuelve a mirar al guardar.
let pregunta = 0
async function comprobarUsuario() {
  const estado = $('altaUsuarioEstado')
  const valor = $('altaUsuario').value.trim().toLowerCase()
  const n = ++pregunta
  estado.className = 'alta-libre'
  if (!FORMA_DE_USUARIO.test(valor)) {
    estado.textContent = 'Solo letras, números y guiones (de 3 a 40).'
    estado.classList.add('mal')
    return false
  }
  const { data: { session } } = await supabase.auth.getSession()
  const { data } = await supabase.from('user_profiles').select('id').ilike('username', valor).neq('id', session?.user?.id || '').limit(1)
  if (n !== pregunta) return null
  const libre = !(data && data.length)
  estado.textContent = libre ? 'Libre' : 'Ese @ ya lo tiene otra cuenta.'
  estado.classList.add(libre ? 'bien' : 'mal')
  return libre
}
let espera = null
$('altaUsuario')?.addEventListener('input', () => {
  clearTimeout(espera)
  espera = setTimeout(comprobarUsuario, 300)
})

$('altaVerEntrar')?.addEventListener('click', () => ver('altaEntrar'))
$('altaVerCuenta')?.addEventListener('click', () => ver('altaCuenta'))

$('altaGoogle')?.addEventListener('click', async (e) => {
  e.currentTarget.disabled = true
  const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: volverAqui() } })
  e.currentTarget.disabled = false
  if (error) $('altaCuentaError').textContent = error.message
})

$('altaCrear')?.addEventListener('click', async () => {
  const error = $('altaCuentaError')
  error.textContent = ''
  const password = $('altaPassword').value
  const mal = passwordStrengthError(password)
  if (mal) {
    error.textContent = mal
    return
  }
  const boton = $('altaCrear')
  boton.disabled = true
  boton.textContent = 'Creando…'
  const { data, error: fallo } = await supabase.auth.signUp({
    email: invitacion.email,
    password,
    options: { emailRedirectTo: volverAqui() },
  })
  boton.disabled = false
  boton.textContent = 'Crear la cuenta →'
  if (fallo) {
    error.textContent = /already|registered|exists/i.test(fallo.message || '')
      ? 'Ya hay una cuenta con este email. Si la creaste tú para la tienda, entra; si es tu cuenta personal, pide la tienda con otro email.'
      : fallo.message || 'No se ha podido crear la cuenta.'
    return
  }
  if (!data.session) return ver('altaRevisa')
  await pintarFormTienda(data.session)
})

$('altaEntrarBtn')?.addEventListener('click', async () => {
  const error = $('altaEntrarError')
  error.textContent = ''
  const { data, error: fallo } = await supabase.auth.signInWithPassword({ email: invitacion.email, password: $('altaEntrarPassword').value })
  if (fallo) {
    error.textContent = /invalid/i.test(fallo.message || '') ? 'Contraseña incorrecta.' : fallo.message
    return
  }
  await pintarFormTienda(data.session)
})

$('altaSalir')?.addEventListener('click', async () => {
  await supabase.auth.signOut()
  ver('altaCuenta')
})

// Quien abrió una invitación que no era suya no se queda atado a ella: el
// onboarding de siempre la miraría y lo mandaría aquí cada vez.
$('altaOlvidar')?.addEventListener('click', () => {
  apuntar(null)
  location.href = '/'
})

$('altaTienda')?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const error = $('altaTiendaError')
  error.textContent = ''
  const nombre = $('altaNombre').value.trim()
  const usuario = $('altaUsuario').value.trim().toLowerCase()
  if (nombre.length < 2) {
    error.textContent = 'Escribe el nombre de la tienda.'
    return
  }
  if (!FORMA_DE_USUARIO.test(usuario)) {
    error.textContent = 'Tu @ solo puede llevar letras, números y guiones (de 3 a 40).'
    return
  }
  const boton = $('altaGuardar')
  boton.disabled = true
  const { data, error: fallo } = await supabase.rpc('tienda_alta', {
    p_token: token,
    p_username: usuario,
    p_nombre: nombre,
    p_ciudad: $('altaCiudad').value.trim() || null,
    p_direccion: $('altaDireccion').value.trim() || null,
    p_web: $('altaWeb').value.trim() || null,
  })
  boton.disabled = false
  if (fallo) {
    error.textContent = fallo.message || 'No se ha podido guardar.'
    return
  }
  apuntar(null)
  $('altaPerfil').href = `/usuario/${encodeURIComponent(data?.username || usuario)}`
  ver('altaStock')
})

arrancar().catch(() => {
  $('altaInvalidaMotivo').textContent = 'Ahora mismo no se puede comprobar la invitación. Vuelve a intentarlo en un rato.'
  ver('altaInvalida')
})
