// Los avisos de torneos que ya NO existen (tanda 1406).
//
// Un torneo creado por error abrió inscripciones, el barredor mandó «Inscripciones
// abiertas» a TODA la comunidad, y el torneo se borró. El aviso no: se quedó sin
// leer, con su número en Jugar y en Torneos para todo el mundo, y llevaba a una
// ficha que ya no existe, así que no había forma de leerlo. Al entrar en Jugar
// (/torneos), los avisos de torneos que ya no se pueden ver se dan por leídos.
// La migración 1406 los borra en la base y, desde ella, se borran solos al
// borrar el torneo; esto es lo que lo arregla YA, sin esperarla, y lo que tapa
// un torneo que vuelve a borrador (deja de verse).

// El barredor enlaza con `new URL('/torneo?slug=' + encodeURIComponent(slug))`.
const SLUG = /\/torneo\?slug=([^&#]+)/

export function slugDeAviso(aviso) {
  const m = SLUG.exec(aviso?.link || '')
  if (!m) return null
  try {
    return decodeURIComponent(m[1])
  } catch {
    return m[1]
  }
}

export const esAvisoDeTorneo = (a) => /^(torneo|tournament)_/.test(a?.type || '')

// Los que apuntan a un torneo que no está entre los que existen.
export function huerfanos(avisos, slugsQueExisten) {
  const hay = new Set(slugsQueExisten)
  return (avisos || []).filter((a) => {
    if (a.read_at || !esAvisoDeTorneo(a)) return false
    const slug = slugDeAviso(a)
    return slug != null && !hay.has(slug)
  })
}

export async function leerAvisosHuerfanos(supabase, userId) {
  if (!userId) return []
  const { data: avisos, error } = await supabase
    .from('user_notifications')
    .select('id, type, link, read_at')
    .eq('recipient_id', userId)
    .is('read_at', null)
    .or('type.like.torneo_*,type.like.tournament_*')
    .limit(200)
  if (error || !avisos?.length) return []
  const slugs = [...new Set(avisos.map(slugDeAviso).filter(Boolean))]
  if (!slugs.length) return []
  // Lo que la RLS deja ver: un borrador ajeno tampoco se puede abrir.
  const { data: torneos, error: e2 } = await supabase.from('tournaments').select('slug').in('slug', slugs)
  // Sin la lista no se sabe qué existe: no se marca nada a ciegas.
  if (e2 || !Array.isArray(torneos)) return []
  const sobran = huerfanos(avisos, torneos.map((t) => t.slug))
  if (!sobran.length) return []
  const ids = sobran.map((a) => a.id)
  const { error: e3 } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .in('id', ids)
  if (e3) return []
  quitarDeLaCampana(ids)
  return ids
}

// La campana y los números de la barra leen `window.__pdAvisos`
// (notifications.js). Puede que aún no los haya traído —va por su lado—, y si
// los trae ANTES de que se marquen aquí, llegarían con estos dentro: por eso se
// quitan ahora y también cada vez que la campana los vuelva a dejar.
function quitarDeLaCampana(ids) {
  const fuera = new Set(ids)
  const limpiar = () => {
    const antes = window.__pdAvisos || []
    if (!antes.some((a) => fuera.has(a.id))) return
    window.__pdAvisos = antes.filter((a) => !fuera.has(a.id))
    window.dispatchEvent(new Event('pd-avisos-cambiados'))
  }
  limpiar()
  window.addEventListener('pd-avisos', limpiar)
}
