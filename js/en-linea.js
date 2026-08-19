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

export async function latidoEnLinea() {
  if (pareceRobot()) return
  const token = tokenDePestana()
  if (!token) return
  try {
    // Si la migración no está ejecutada, la función no existe y esto
    // falla en silencio: la web entera no puede depender de un contador.
    await supabase.rpc('latido_en_linea', { p_token: token })
  } catch {}
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
