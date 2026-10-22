// Cuántas veces ha servido una guía, o lo que escribe alguien (tanda 974).
//
// Desde la 974 «Me ha servido» (`guide_helpful`) es LA señal de una guía:
// la caja «¿Te ha servido? Sí / No tanto» (`guide_reviews`) se fue, porque
// preguntaba lo mismo dos veces. Lo que antes era una media de estrellas
// —en el perfil y en las filas de /usuarios— ahora es esta cuenta. Va aparte
// de guide-helpful.js para no arrastrar el botón (y sus avisos) a quien solo
// pinta números.
import { supabase } from './supabase.js'

// { guideId: n } de las guías que se piden. Las que no tienen ninguno no
// salen: «0» y «no se ha podido preguntar» se distinguen por `null`.
export async function servidoPorGuia(ids, cliente = supabase) {
  if (!ids?.length) return {}
  const { data, error } = await cliente.from('guide_helpful').select('guide_id').in('guide_id', ids)
  if (error) return null
  const cuenta = {}
  for (const f of data || []) cuenta[f.guide_id] = (cuenta[f.guide_id] || 0) + 1
  return cuenta
}

// A cuántas personas les han servido las guías publicadas de alguien.
// null = no se ha podido preguntar (no se pinta).
export async function servidoDeAutor(authorId, cliente = supabase) {
  if (!authorId) return null
  const { data: guias, error } = await cliente.from('guides').select('id').eq('author_id', authorId).eq('review_status', 'approved')
  if (error) return null
  const ids = (guias || []).map((g) => g.id)
  if (!ids.length) return 0
  const { count, error: e2 } = await cliente.from('guide_helpful').select('*', { count: 'exact', head: true }).in('guide_id', ids)
  return e2 ? null : count || 0
}

// «A 1 persona le ha servido» / «A 13 personas les ha servido».
export const frasePersonas = (n, verbo = 'servido') => (n === 1 ? `A 1 persona le ha ${verbo}` : `A ${n} personas les ha ${verbo}`)
