// La página de «Colabora» (tanda 361).
//
// PokeDoc lo lleva PINGU solo, y eso tiene techo: más gente escribiendo
// y organizando es más comunidad, y una comunidad pequeña crece por la
// gente que ya está dentro.
//
// ── Por qué pide sesión ──
//
// Un formulario de fuera te da un nombre. Este te da un nombre CON SU
// HISTORIAL —lo que ha escrito en el foro, los torneos que ha jugado,
// cuánto lleva aquí—, que es exactamente lo que hace falta para decidir
// a quién se le dice que sí. Y filtra de paso: quien no se registra para
// escribirte, tampoco iba a durar.
import { supabase } from './supabase.js'
import { getSession } from './app.js'
import { showToast } from './toast.js'
import { escapeHtml } from './html.js'

const $ = (id) => document.getElementById(id)

// Los mismos de la lista de arriba de la página. Se pintan desde aquí
// para que la lista de puestos y las casillas no puedan discrepar: una
// casilla que no está entre los puestos es una promesa que nadie
// recuerda haber hecho.
const PUESTOS = [
  ['noticias', 'Escribir noticias'],
  ['guias', 'Escribir guías'],
  ['torneos', 'Organizar torneos'],
  ['foro', 'Echar una mano en el foro'],
  ['redes', 'Diseño y redes'],
  ['otra', 'Otra cosa'],
]

function pintarRoles() {
  const caja = $('colaboraRoles')
  if (!caja) return
  caja.innerHTML = PUESTOS.map(
    ([valor, texto]) =>
      `<label class="colabora-opcion"><input type="checkbox" value="${valor}" /> <span>${texto}</span></label>`
  ).join('')
}

function rolesElegidos() {
  return [...document.querySelectorAll('#colaboraRoles input:checked')].map((i) => i.value)
}

function ver(id, visible) {
  $(id)?.classList.toggle('hidden', !visible)
}

// CADA PUESTO CON SU BOTÓN (1153, D3). Antes eran seis tarjetas de texto y
// para apuntarse había que bajar al formulario y marcar otra vez lo mismo.
// «Apuntarme» marca su casilla y baja; sin cuenta, baja al «Entra primero»
// y la vuelta lleva lo elegido (`?quiere=`), que se marca al volver.
const URL_COLABORA = '/colabora'
function apuntar(valor) {
  const casilla = document.querySelector(`#colaboraRoles input[value="${CSS.escape(valor)}"]`)
  const form = $('colaboraForm')
  if (casilla && form && !form.classList.contains('hidden')) {
    casilla.checked = true
    form.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    casilla.focus({ preventScroll: true })
    return
  }
  const destino = ['colaboraEntrar', 'colaboraYaEsta'].map($).find((x) => x && !x.classList.contains('hidden')) || $('colaboraFormTitulo')
  destino?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  const btn = $('colaboraEntrarBtn')
  if (btn && !$('colaboraEntrar')?.classList.contains('hidden')) btn.href = `/auth.html?volver=${encodeURIComponent(`${URL_COLABORA}?quiere=${valor}#colaboraFormTitulo`)}`
}

// Los temas del último mes sin una sola respuesta: la ayuda que se puede
// dar YA. Solo se pintan si hay alguno (no es un «0 temas» decorativo).
async function pintarSinRespuesta() {
  const caja = $('colaboraSinRespuesta')
  if (!caja) return
  const desde = new Date(Date.now() - 30 * 864e5).toISOString()
  const { data, error } = await supabase
    .from('forum_threads')
    .select('id, title')
    .lte('post_count', 1)
    .gte('created_at', desde)
    .order('created_at', { ascending: false })
    .limit(3)
  if (error || !data?.length) return
  caja.innerHTML = `<p class="colabora-vivo">${data.length === 1 ? 'Un tema espera respuesta' : 'Estos temas esperan respuesta'}:</p>
    <ul>${data.map((t) => `<li><a href="/tema/${encodeURIComponent(t.id)}">${escapeHtml(t.title)}</a></li>`).join('')}</ul>`
  caja.hidden = false
}

async function arrancar() {
  pintarRoles()
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-apuntar]')
    if (b) apuntar(b.dataset.apuntar)
  })
  void pintarSinRespuesta().catch(() => {})

  const session = await getSession()
  if (!session?.user) {
    // Con la vuelta puesta: quien entra a registrarse acaba otra vez
    // aquí, no en la portada.
    const btn = $('colaboraEntrarBtn')
    if (btn) btn.href = `/auth.html?volver=${encodeURIComponent(URL_COLABORA)}`
    // Crear un torneo pide cuenta: al registro, y de vuelta al formulario.
    const crear = $('colaboraCrearTorneo')
    if (crear) crear.href = `/auth.html?registro=1&volver=${encodeURIComponent('/torneos.html?crear=1')}`
    ver('colaboraEntrar', true)
    return
  }

  // ¿Ya mandó una? La política deja ver la suya, y la base solo admite
  // UNA viva por persona: vale más decirlo antes que dejar que el envío
  // falle con un error de índice que no significa nada para quien lo lee.
  const { data: mias } = await supabase
    .from('collab_applications')
    .select('id,status')
    .eq('user_id', session.user.id)
    .in('status', ['nueva', 'hablando'])
    .limit(1)
  if (mias?.length) {
    ver('colaboraYaEsta', true)
    return
  }

  ver('colaboraForm', true)
  // Lo que se eligió antes de entrar (`?quiere=`), ya marcado.
  const quiere = new URLSearchParams(location.search).get('quiere')
  if (quiere) document.querySelector(`#colaboraRoles input[value="${CSS.escape(quiere)}"]`)?.click()
  $('colaboraForm').addEventListener('submit', (e) => {
    e.preventDefault()
    enviar(session.user.id).catch(() => showToast('No se ha podido enviar. Inténtalo en un rato.'))
  })
}

async function enviar(userId) {
  const roles = rolesElegidos()
  const muestra = $('colaboraMuestra').value.trim()

  // Dos comprobaciones y ni una más. Un formulario de voluntarios que
  // exige seis campos es un formulario que nadie termina.
  if (!roles.length) {
    showToast('Marca al menos una cosa que te gustaría llevar.')
    return
  }
  if (muestra.length < 40) {
    showToast('Escríbenos unas líneas tuyas: es lo que más nos dice de ti.')
    return
  }

  const boton = $('colaboraEnviar')
  boton.disabled = true
  const { error } = await supabase.from('collab_applications').insert({
    user_id: userId,
    roles,
    horas: $('colaboraHoras').value,
    experiencia: $('colaboraExperiencia').value.trim() || null,
    por_que: $('colaboraPorQue').value.trim() || null,
    muestra,
  })
  boton.disabled = false

  if (error) {
    // El índice de «una viva por persona» salta si alguien abre dos
    // pestañas. No es un fallo: es que ya está enviada.
    if (/duplicate key|una_viva/i.test(error.message || '')) {
      ver('colaboraForm', false)
      ver('colaboraYaEsta', true)
      return
    }
    // Y si la migración no está puesta, la tabla no existe: se dice, en
    // vez de dejar a la persona pulsando un botón que no hace nada.
    showToast(
      /collab_applications/.test(error.message || '')
        ? 'Esto todavía no está listo del todo. Escríbenos por el foro mientras tanto.'
        : 'No se ha podido enviar: ' + error.message
    )
    return
  }

  ver('colaboraForm', false)
  ver('colaboraGracias', true)
}

arrancar().catch(() => {})
