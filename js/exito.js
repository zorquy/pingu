// ALGO HA SALIDO BIEN (tanda 1317, A3 del plan). Instalar PokeDoc se ofrece
// justo después de un buen momento —tu carta número 10, acabar un reto,
// apuntarte a un torneo— y no al llegar, que es cuando tapa. Quien hace la
// cosa avisa aquí y quien ofrece (`instalar.js`, solo en el móvil) escucha;
// el aviso queda también en la sesión del navegador por si la página cambia
// justo después (inscribirse recarga la ficha).
export const EXITO_PENDIENTE = 'pd-exito-pendiente'

export function avisarExito(motivo, win = globalThis.window) {
  if (!win) return
  try { win.sessionStorage.setItem(EXITO_PENDIENTE, motivo) } catch {}
  try { win.dispatchEvent(new win.CustomEvent('pd-exito', { detail: { motivo } })) } catch {}
}

// Tu carta número 10: se cuenta una vez por añadido hasta llegar, y después
// ya no se pregunta nunca más (una llave en el navegador).
const DIEZ = 'pd-exito-10-cartas'
export async function exitoDeColeccion(supabase, userId, win = globalThis.window) {
  try {
    if (!win || !userId || win.localStorage.getItem(DIEZ)) return
    const { count, error } = await supabase.from('user_collection').select('id', { count: 'exact', head: true }).eq('user_id', userId)
    if (error || (count || 0) < 10) return
    win.localStorage.setItem(DIEZ, '1')
    avisarExito('cartas', win)
  } catch {}
}
