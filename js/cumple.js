// El cumpleaños de una persona (tanda 1304). La fecha entera vive en
// `user_cumple`, que solo lee su dueño; en el perfil público queda solo el
// mes y el día (`birthday_md`, para que el foro felicite a quien cumple hoy).
// Hasta la 1304 estaba en `user_profiles.birthday`, que lee cualquiera, AÑO
// incluido. Sin la migración, la tabla no existe y se sigue por el camino de
// antes (`privado: false`), para no dejar Ajustes roto entre medias.

export async function leerCumple(supabase, userId, perfil = null) {
  const { data, error } = await supabase.from('user_cumple').select('birthday').eq('user_id', userId).maybeSingle()
  if (!error) return { fecha: data?.birthday || '', privado: true }
  return { fecha: perfil?.birthday || '', privado: false }
}

// Vacío = quitarlo. Devuelve el error de la base, o null.
export async function guardarCumple(supabase, userId, fecha, privado) {
  if (!privado) {
    const { error } = await supabase.from('user_profiles').update({ birthday: fecha || null }).eq('id', userId)
    return error || null
  }
  const { error } = fecha
    ? await supabase.from('user_cumple').upsert({ user_id: userId, birthday: fecha, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    : await supabase.from('user_cumple').delete().eq('user_id', userId)
  return error || null
}
