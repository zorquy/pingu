// Lo privado del perfil (tanda 1306): las guías guardadas y quién te invitó.
//
// Vivían en `user_profiles`, que lee cualquiera. Desde la migración 1306
// están en `user_privado`, que solo lee su dueño, y lo de los demás va por
// funciones (`mis_invitados`, `poner_padrino`). Mientras la migración no se
// ejecute (o si tu fila aún no está), se lee y se escribe en el perfil como
// antes: la web no puede pedir una tabla antes que su migración (la 624).
//
// `privado` dice por qué camino va cada persona; quien escribe lo pide con la
// lectura, para escribir por el mismo sitio de donde ha leído.

export async function leerPrivado(supabase, userId) {
  if (!userId) return { saved_guides: [], referred_by: null, privado: false }
  const r = await supabase.from('user_privado').select('saved_guides, referred_by').eq('user_id', userId).maybeSingle()
  if (!r.error && r.data) return { saved_guides: r.data.saved_guides || [], referred_by: r.data.referred_by || null, privado: true }
  // Sin la tabla o sin tu fila: el perfil (si ya no tiene las columnas, falla y
  // es que no hay nada).
  const p = await supabase.from('user_profiles').select('saved_guides, referred_by').eq('id', userId).maybeSingle()
  // Que al perfil ya le falten las columnas (42703) es «no hay nada», no un
  // fallo: pasa con la migración puesta y una fila privada que aún no está.
  const error = p.error && p.error.code !== '42703' ? p.error : null
  return { saved_guides: (!p.error && p.data?.saved_guides) || [], referred_by: (!p.error && p.data?.referred_by) || null, privado: false, error }
}

export async function guardarGuias(supabase, userId, guias, privado) {
  const { error } = privado
    ? await supabase.from('user_privado').update({ saved_guides: guias, updated_at: new Date().toISOString() }).eq('user_id', userId)
    : await supabase.from('user_profiles').update({ saved_guides: guias }).eq('id', userId)
  return error || null
}

// Guardar o quitar una guía: lee, cambia y escribe por el mismo camino.
export async function cambiarGuardada(supabase, userId, guideId, guardar) {
  const p = await leerPrivado(supabase, userId)
  const antes = p.saved_guides || []
  const guias = guardar ? [...new Set([...antes, guideId])] : antes.filter((id) => id !== guideId)
  const error = await guardarGuias(supabase, userId, guias, p.privado)
  return { error, guias }
}

// «Una función que no existe» (sin la migración): PGRST202 o 42883.
const faltaFuncion = (e) => !!e && (e.code === 'PGRST202' || e.code === '42883' || /could not find the function|does not exist/i.test(e.message || ''))

// Quién te invitó, una sola vez. Sin la migración, como antes.
export async function ponerPadrino(supabase, userId, padrinoId) {
  const r = await supabase.rpc('poner_padrino', { p_padrino: padrinoId })
  if (!r.error) return !!r.data
  if (!faltaFuncion(r.error)) return false
  const { error } = await supabase.from('user_profiles').update({ referred_by: padrinoId }).eq('id', userId).is('referred_by', null)
  return !error
}

// A quién has invitado tú: { lista, error }. Lo público de cada uno.
export async function misInvitados(supabase, userId, { limite = null } = {}) {
  const r = await supabase.rpc('mis_invitados')
  if (!r.error) {
    const lista = Array.isArray(r.data) ? r.data : []
    return { lista: limite ? lista.slice(0, limite) : lista, total: lista.length, error: null }
  }
  if (!faltaFuncion(r.error)) return { lista: [], total: null, error: r.error }
  let q = supabase.from('user_profiles').select('id, username, display_name, avatar_url, created_at', { count: 'exact' }).eq('referred_by', userId).order('created_at', { ascending: false })
  if (limite) q = q.limit(limite)
  const { data, count, error } = await q
  return { lista: data || [], total: error ? null : count ?? (data || []).length, error: error || null }
}
