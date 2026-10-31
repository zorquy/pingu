import { supabase } from './supabase.js'
import { pareceRobot } from './page-views.js'

// Quién está en línea AHORA, invitados incluidos.
//
// El lateral del foro ya decía quién ha pasado hoy, pero solo con cuenta:
// los curiosos sin registrar eran invisibles, y en una web recién abierta
// son la mayoría. Ver "12 invitados en línea" le dice a quien entra que
// esto está vivo — el clásico "Usuarios en línea" de los foros de siempre.
//
// Cómo funciona sin perfilar a nadie:
//
//   - Cada pestaña genera un token aleatorio y lo guarda en
//     sessionStorage, que MUERE al cerrar la pestaña. No es localStorage a
//     propósito: un identificador que sobrevive días es un rastreador; uno
//     que vive lo que la pestaña, no.
//   - En cada carga de página se manda un latido con ese token (una
//     función de la base lo apunta con la hora; con sesión, también quién).
//   - "En línea" es tener un latido en los últimos minutos.
//
// Los robots no laten: Google ejecuta JavaScript al indexar (por eso
// existe pareceRobot) y sin este filtro los "invitados en línea" serían
// sobre todo el rastreador dando vueltas.

export const VENTANA_MINUTOS = 15
const CLAVE = 'pokedoc-en-linea'

function tokenDePestana() {
  try {
    let token = sessionStorage.getItem(CLAVE)
    if (!token) {
      token = crypto.randomUUID()
      sessionStorage.setItem(CLAVE, token)
    }
    return token
  } catch {
    // Modo privado con el almacenamiento capado: sin latido y en paz.
    return null
  }
}

// En qué tema está esta pestaña, si está en alguno. Es la misma lectura
// de ruta que hace temaDeLaRuta() en foro-comun.js; se repite aquí a
// propósito para que el latido no arrastre el módulo del foro a TODAS las
// páginas de la web.
function temaActual() {
  try {
    const enLaRuta = window.location.pathname.match(/\/tema\/([^/?#]+)/)
    if (enLaRuta) return decodeURIComponent(enLaRuta[1])
    if (window.location.pathname.includes('/tema')) return new URLSearchParams(window.location.search).get('t')
    return null
  } catch {
    return null
  }
}

export async function latidoEnLinea() {
  if (pareceRobot()) return
  const token = tokenDePestana()
  if (!token) return
  try {
    // El latido apunta también en qué tema estás (para el "leyendo ahora
    // este tema"); en cualquier otra página va a null y la función lo
    // SOBRESCRIBE — salir de un tema no puede dejarte "leyéndolo".
    //
    // Si la migración no está ejecutada, la función no existe y esto
    // falla en silencio: la web entera no puede depender de un contador.
    const { error } = await supabase.rpc('latido_en_linea', { p_token: token, p_thread: temaActual() })
    // Entre desplegar la web y ejecutar foro-extras, la función vieja
    // solo acepta el token: se reintenta sin el tema para que el
    // contador de en línea no se apague en ese rato.
    if (error) await supabase.rpc('latido_en_linea', { p_token: token })
  } catch {}
}

// Quién está leyendo UN tema ahora: mismo criterio que quienEstaEnLinea,
// filtrado por el tema. Devuelve null si no se puede saber.
export async function quienLeeElTema(threadId) {
  if (!threadId) return null
  try {
    const desde = new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('online_now')
      .select('token, user_id')
      .eq('thread_id', threadId)
      .gt('last_seen', desde)
    if (error) return null
    const miembros = [...new Set((data || []).map((f) => f.user_id).filter(Boolean))]
    const invitados = (data || []).filter((f) => !f.user_id).length
    return { miembros, invitados, total: miembros.length + invitados }
  } catch {
    return null
  }
}

// Devuelve null si no se puede saber (migración sin ejecutar), que NO es
// lo mismo que "no hay nadie": con null el panel no se enseña.
export async function quienEstaEnLinea() {
  try {
    const desde = new Date(Date.now() - VENTANA_MINUTOS * 60 * 1000).toISOString()
    const { data, error } = await supabase.from('online_now').select('token, user_id').gt('last_seen', desde)
    if (error) return null
    // Un miembro con tres pestañas abiertas es UNA persona; un invitado
    // no se puede juntar con nada (no hay identidad), así que cada
    // pestaña suya cuenta como uno — igual que en cualquier foro.
    const miembros = [...new Set((data || []).map((f) => f.user_id).filter(Boolean))]
    const invitados = (data || []).filter((f) => !f.user_id).length
    return { miembros, invitados, total: miembros.length + invitados }
  } catch {
    return null
  }
}

// EL PUNTO VERDE FUERA DEL FORO (1140, PINGU: «¿hay alguna manera de poner un
// puntito verde en la gente que está online?»). Ya existía en los mensajes
// de un tema (tema.js, `marcarConectados`); ahora cualquier avatar que lleve
// `data-en-linea="<id>"` se marca: los mensajes privados, Gente y el perfil.
// Una consulta de quién está por página (la de siempre, `online_now`) y otra
// para no señalar a quien esconde su actividad en Ajustes. Devuelve los ids
// marcados, o null si no se puede saber.
let conectadosP = null
export async function marcarEnLinea(raiz = document) {
  const els = [...raiz.querySelectorAll('[data-en-linea]')]
  if (!els.length) return []
  conectadosP ||= quienEstaEnLinea().then((r) => (r ? new Set(r.miembros) : null))
  const conectados = await conectadosP
  if (!conectados) return null
  const candidatos = [...new Set(els.map((e) => e.dataset.enLinea).filter((id) => conectados.has(id)))]
  let ocultos = new Set()
  if (candidatos.length) {
    const { data } = await supabase.from('user_profiles').select('id, hide_activity').in('id', candidatos)
    ocultos = new Set((data || []).filter((p) => p.hide_activity).map((p) => p.id))
  }
  const marcados = candidatos.filter((id) => !ocultos.has(id))
  for (const e of els) {
    const on = marcados.includes(e.dataset.enLinea)
    e.classList.toggle('avatar-conectado', on)
    if (on && !e.title) e.title = 'En línea ahora'
  }
  return marcados
}
