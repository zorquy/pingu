// ¿Quién llama a esta función, y es admin del sitio? (tanda 500)
//
// Una función de Netlify es una URL PÚBLICA. Si llama a una API de pago,
// cualquiera que la descubra gasta nuestra cuenta — por eso
// `generate-course` lo comprueba desde el primer día, con su porqué al
// lado: «si no, cualquiera con la URL podría generar cursos gratis a costa
// de la cuenta del proyecto».
//
// ── POR QUÉ VIVE AQUÍ Y NO COPIADO EN CADA FUNCIÓN ──
//
// Porque ya había DOS copias y YA HABÍAN DIVERGIDO: `requireAdminUserId`
// en `generate-course.mjs` devuelve el id y no acepta `fetchImpl`;
// `esAdmin` en `telegram-mandar.mjs` devuelve un booleano y sí lo acepta.
// La de Scrydex habría sido la tercera. La norma de la 471 es exactamente
// ésta: no copiar es mejor que una copia vigilada, y lo puro se muda a un
// fichero que no importa nada para que lo usen todos.
//
// NO se migran aquí las otras dos: son camino de seguridad en producción y
// NINGUNA prueba las cubría. Primero existe esto, probado; después se
// migran a conciencia. Queda apuntado en la bitácora.
//
// ── POR QUÉ NO HACE FALTA LA CLAVE DE SERVICIO ──
//
// `/auth/v1/user` valida el JWT con la clave pública, y `is_admin` de
// `user_profiles` es de lectura pública. Así que esto comprueba contra el
// propio Supabase en vez de fiarse de NADA que mande el cliente: el token
// se usa para preguntar quién es, no se le cree lo que diga ser.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

// El id de quien llama SI es admin, y `null` si no lo es o no se sabe.
//
// Devuelve el ID y no un booleano a propósito: quien solo quiera saber si
// sí o no, pregunta por `!!id`, pero el que necesite apuntar QUIÉN hizo
// algo lo tiene sin pedirlo otra vez. Al revés no se puede.
export async function idDeAdmin(token, fetchImpl = fetch) {
  const limpio = String(token || '').replace(/^Bearer\s+/i, '').trim()
  if (!limpio) return null
  try {
    const userRes = await fetchImpl(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { authorization: `Bearer ${limpio}`, apikey: SUPABASE_ANON_KEY },
    })
    if (!userRes.ok) return null
    const user = await userRes.json()
    if (!user?.id) return null

    const perfilRes = await fetchImpl(
      `${SUPABASE_URL}/rest/v1/user_profiles?id=eq.${encodeURIComponent(user.id)}&select=is_admin`,
      { headers: { apikey: SUPABASE_ANON_KEY, authorization: `Bearer ${limpio}` } }
    )
    if (!perfilRes.ok) return null
    const [perfil] = await perfilRes.json()
    return perfil?.is_admin ? user.id : null
  } catch {
    // Un corte de red NO es un permiso. Si no se puede comprobar, no se
    // pasa: lo contrario convertiría una caída de Supabase en barra libre.
    return null
  }
}

// El token que trae una petición, de su cabecera `authorization`.
export function tokenDe(req) {
  return (req?.headers?.get?.('authorization') || '').replace(/^Bearer\s+/i, '')
}
