import { supabase } from './supabase.js'
import { contributorTier } from './gamification.js'
import { escapeHtml } from './html.js'

// La chapita de rango de colaborador, para ponerla junto al nombre de
// alguien allí donde le lee la gente.
//
// POR QUÉ ESTO EXISTE: el rango ("Colaborador", "Leyenda de la
// comunidad") solo se veía entrando a un perfil, y casi nadie entra a un
// perfil. Un reconocimiento que hay que ir a buscar no recompensa a
// nadie. Donde tiene sentido es en la guía y en los comentarios: en las
// dos pantallas donde a alguien lo lee gente que no lo conoce.
//
// El rango se calcula con el número de guías APROBADAS, así que hay que
// contarlas. Como en una página de comentarios pueden salir muchas
// personas, se piden todas de una vez y se recuerdan mientras dure la
// página: sin esto sería una consulta por comentario.

const cache = new Map()

export async function contributorCounts(userIds) {
  const pendientes = [...new Set((userIds || []).filter((id) => id && !cache.has(id)))]
  if (pendientes.length > 0) {
    const { data, error } = await supabase
      .from('guides')
      .select('author_id')
      .eq('review_status', 'approved')
      .in('author_id', pendientes)

    // Si la consulta falla, se apunta 0 igualmente: una chapita que no
    // sale es mejor que una página que se queda a medias.
    const cuenta = {}
    if (!error) for (const g of data || []) cuenta[g.author_id] = (cuenta[g.author_id] || 0) + 1
    for (const id of pendientes) cache.set(id, cuenta[id] || 0)
  }
  return Object.fromEntries((userIds || []).filter(Boolean).map((id) => [id, cache.get(id) || 0]))
}

export function badgeHtml(aprobadas) {
  // Con cero guías no se pone nada. "Miembro" al lado del nombre no dice
  // nada de nadie y ensucia todas las líneas de comentarios.
  if (!aprobadas) return ''
  const { title, icon } = contributorTier(aprobadas)
  return `<span class="contributor-badge" title="${escapeHtml(title)} · ${aprobadas} ${
    aprobadas === 1 ? 'guía aprobada' : 'guías aprobadas'
  }">${icon}${escapeHtml(title)}</span>`
}

export async function contributorBadgeHtml(userId) {
  if (!userId) return ''
  const cuentas = await contributorCounts([userId])
  return badgeHtml(cuentas[userId])
}
