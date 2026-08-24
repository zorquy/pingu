// El medallero de los cursos: la mejor medalla de cada persona en cada
// curso, leída de course_attempts (la medalla la pone el disparador de
// la base al guardar la partida, ver supabase-migration-cursos-juego).
//
// Como toda la capa de datos del juego, aquí nada lanza: sin migración,
// sin sesión o sin partidas se devuelve vacío y quien pinta no pinta.
import { supabase } from './supabase.js'
import { icons } from './icons.js'

const PESO = { oro: 3, plata: 2, bronce: 1 }

export function mejorMedalla(a, b) {
  return (PESO[b] || 0) > (PESO[a] || 0) ? b : a
}

// La mejor medalla de ESTA persona en cada curso: { guide_id: 'oro' }.
export async function medallasPorCurso(userId) {
  if (!userId) return {}
  try {
    const { data, error } = await supabase
      .from('course_attempts')
      .select('guide_id, medal')
      .eq('user_id', userId)
      .not('medal', 'is', null)
      .limit(1000)
    if (error || !data) return {}
    const por = {}
    for (const f of data) por[f.guide_id] = mejorMedalla(por[f.guide_id], f.medal)
    return por
  } catch {
    return {}
  }
}

// Cuántos cursos DISTINTOS tiene en oro cada una de estas personas:
// { user_id: 3 }. Para la columna del autor del foro. Las partidas son
// públicas (salvo actividad oculta), así que esto funciona con
// cualquiera, no solo con uno mismo.
export async function orosPorUsuario(userIds) {
  const unicos = [...new Set((userIds || []).filter(Boolean))]
  if (!unicos.length) return {}
  try {
    const { data, error } = await supabase
      .from('course_attempts')
      .select('user_id, guide_id')
      .eq('medal', 'oro')
      .in('user_id', unicos)
      .limit(2000)
    if (error || !data) return {}
    const cursosPor = {}
    for (const f of data) (cursosPor[f.user_id] = cursosPor[f.user_id] || new Set()).add(f.guide_id)
    return Object.fromEntries(unicos.map((u) => [u, cursosPor[u] ? cursosPor[u].size : 0]))
  } catch {
    return {}
  }
}

const NOMBRE = { oro: 'Oro', plata: 'Plata', bronce: 'Bronce' }

export function chipMedallaHtml(medalla, tam = 12) {
  if (!medalla || !NOMBRE[medalla]) return ''
  return `<span class="medalla-chip medalla-${medalla}" title="Tu mejor medalla en este curso">${icons.trophy(tam)} ${NOMBRE[medalla]}</span>`
}
