// La bienvenida en tres pasos (tanda 581). El porqué, en SCHEMA.md.
//
// Lo que se guarda: el nombre, qué te trae (`interests`, que antes eran
// categorías del blog y ahora son «coleccionar / jugar / aprender») y
// `onboarding_completed`. Y lo que cambia de verdad: no acaba en la
// portada, acaba en LO QUE HAS ELEGIDO HACER.
import { supabase } from './supabase.js'
import { requireAuth, uniqueUsername, suggestedNameFromSession } from './app.js'
import { icons } from './icons.js'

const $ = (id) => document.getElementById(id)
const elegido = new Set()

// Qué acción va primero según lo que te trae: la primera que hayas
// marcado manda. Si marcas las tres, coleccionar: es lo que esta web
// hace que ninguna otra en español.
const ORDEN = ['coleccionar', 'jugar', 'aprender']

function goToStep(n) {
  document.querySelectorAll('.onb-step').forEach((s) => s.classList.remove('active'))
  $(`onbStep${n}`).classList.add('active')
  document.querySelectorAll('.onb-paso').forEach((p) => {
    const suyo = Number(p.dataset.paso)
    p.classList.toggle('activo', suyo === n)
    p.classList.toggle('hecho', suyo < n)
  })
  $('onbStep1').classList.toggle('active', n === 1)
}

function ordenarAcciones() {
  const caja = $('onbAcciones')
  const primera = ORDEN.find((o) => elegido.has(o)) || ORDEN[0]
  const botones = [...caja.querySelectorAll('.onb-accion')]
  botones.sort((a, b) => (a.dataset.para === primera ? -1 : b.dataset.para === primera ? 1 : 0))
  for (const b of botones) {
    b.classList.toggle('recomendada', b.dataset.para === primera)
    caja.appendChild(b)
  }
}

async function guardarPerfil(session, name) {
  const username = await uniqueUsername(name, session.user.id)
  // upsert y no update: quien entra con Google puede no tener todavía
  // fila en user_profiles, y un update no crearía ninguna.
  const { error } = await supabase.from('user_profiles').upsert({
    id: session.user.id,
    username,
    display_name: name,
    interests: [...elegido],
    recommended_path: null,
    onboarding_completed: true,
  })
  if (error) throw error
  await apuntarPadrino(session)
}

// Si esta cuenta llegó por un enlace de invitación (/r/<usuario>, que
// auth.js dejó apuntado en el navegador), aquí se hace efectivo: la
// columna referred_by queda mirando al padrino, UNA sola vez. Los
// premios los reparte el sistema de trofeos, cada cual en su sesión: el
// invitado ya mismo (checkAchievements aquí) y el padrino la próxima
// vez que entre. Sin la migración de referidos, no pasa nada.
async function apuntarPadrino(session) {
  let padrino = null
  try {
    padrino = localStorage.getItem('pokedoc-referido')
  } catch {}
  if (!padrino) return
  try {
    localStorage.removeItem('pokedoc-referido')
    const { data: quien } = await supabase
      .from('user_profiles')
      .select('id')
      .ilike('username', padrino)
      .neq('id', session.user.id)
      .maybeSingle()
    if (!quien?.id) return
    const { error } = await supabase
      .from('user_profiles')
      .update({ referred_by: quien.id })
      .eq('id', session.user.id)
      .is('referred_by', null)
    if (!error) {
      const { checkAchievements } = await import('./gamification.js')
      await checkAchievements(session.user.id).catch(() => {})
    }
  } catch {
    // Sin migración de referidos, o sin red: el registro sigue igual.
  }
}

async function init() {
  // Los iconos de las tarjetas: cada página pinta los suyos (no hay un
  // pintor global de `data-icono`).
  for (const el of document.querySelectorAll('[data-icono]')) el.innerHTML = icons[el.dataset.icono]?.(20) || ''
  const session = await requireAuth()
  if (!session) return

  // sin rango: es MI perfil durante la bienvenida, para saludarme por mi
  // nombre (tanda 386).
  const { data: profile } = await supabase.from('user_profiles').select('display_name, username').eq('id', session.user.id).maybeSingle()
  const nameInput = $('onbNameInput')
  // Si ya hay nombre guardado se respeta; si no, se sugiere el de la
  // cuenta con la que ha entrado (Google lo manda en user_metadata).
  nameInput.value = profile?.display_name || profile?.username || suggestedNameFromSession(session)

  $('btnStep1Next').addEventListener('click', () => goToStep(2))

  const btn2 = $('btnStep2Next')
  btn2.disabled = nameInput.value.trim().length < 2
  nameInput.addEventListener('input', () => {
    btn2.disabled = nameInput.value.trim().length < 2
  })
  btn2.addEventListener('click', () => goToStep(3))

  $('onbQue').addEventListener('click', (e) => {
    const b = e.target.closest('.onb-option-card')
    if (!b) return
    const v = b.dataset.value
    if (elegido.has(v)) elegido.delete(v)
    else elegido.add(v)
    b.setAttribute('aria-pressed', String(elegido.has(v)))
    $('btnStep3Next').disabled = elegido.size === 0
  })
  $('btnStep3Next').addEventListener('click', () => {
    ordenarAcciones()
    goToStep(4)
  })

  // Cualquier salida guarda el perfil y se va adonde diga el botón.
  let saliendo = false
  $('onbStep4').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ir]')
    if (!b || saliendo) return
    saliendo = true
    for (const x of $('onbStep4').querySelectorAll('[data-ir]')) x.disabled = true
    try {
      await guardarPerfil(session, nameInput.value.trim())
      window.location.href = b.dataset.ir
    } catch {
      const { showToast } = await import('./toast.js')
      showToast('No hemos podido guardar tu perfil. Inténtalo otra vez.')
      saliendo = false
      for (const x of $('onbStep4').querySelectorAll('[data-ir]')) x.disabled = false
    }
  })
}

init()
