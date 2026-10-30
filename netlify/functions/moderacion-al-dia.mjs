// Levanta los silencios y baneos que ya han caducado (tanda 1121).
//
// Desde /admin → Usuarios se silencia o se banea con una duración («7
// días»), y lo que lo hace cumplir son las columnas de siempre (is_muted,
// is_banned). Algo tiene que volver a ponerlas a false cuando se acaba el
// plazo: `moderacion_al_dia()` en la base, que hace la cuenta entera en una
// llamada. No pide nada a nadie de fuera, así que cada hora no cuesta nada;
// y como mucho, alguien sale de un silencio una hora tarde.
//
// Lo que pasa se apunta en el estado (`scrydex_estado`, clave
// `moderacion_al_dia`, en PASADAS): un error que solo vuelve en la
// respuesta no lo lee nadie (la 655).
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).
const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'moderacion_al_dia'

export async function procesar({ env = process.env, fetchImpl = fetch, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const cabeceras = { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
  const apuntar = (valor) =>
    fetchImpl(`${SUPABASE_URL}/rest/v1/scrydex_estado`, {
      method: 'POST',
      headers: { ...cabeceras, prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify([{ clave: CLAVE_ESTADO, valor: { ...valor, ultimaPasada: ahora.toISOString() }, updated_at: ahora.toISOString() }]),
    }).catch(() => {})
  try {
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/moderacion_al_dia`, { method: 'POST', headers: cabeceras, body: '{}' })
    const texto = await res.text()
    if (!res.ok) {
      // Sin la migración no es un fallo que gritar cada hora: es «todavía no».
      if (/PGRST202|Could not find/.test(texto)) {
        await apuntar({ hecho: true, saltado: 'falta ejecutar supabase-migration-1121-moderacion.sql' })
        return { ok: true, saltado: 'falta ejecutar supabase-migration-1121-moderacion.sql' }
      }
      const error = `Supabase ${res.status}: ${texto.slice(0, 200)}`
      await apuntar({ ultimoError: { error, fecha: ahora.toISOString() } })
      return { ok: false, error }
    }
    const n = Number(JSON.parse(texto))
    const levantadas = Number.isFinite(n) ? n : 0
    await apuntar({ hecho: true, levantadas })
    return { ok: true, levantadas }
  } catch (e) {
    const error = String(e?.message || e)
    await apuntar({ ultimoError: { error, fecha: ahora.toISOString() } })
    return { ok: false, error }
  }
}

export default async function handler() {
  const r = await procesar()
  if (!r.ok) console.warn('moderacion-al-dia:', JSON.stringify(r).slice(0, 400))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada hora, en el minuto 23 (no en punto: ahí se pelea todo el mundo).
export const config = { schedule: '23 * * * *' }
