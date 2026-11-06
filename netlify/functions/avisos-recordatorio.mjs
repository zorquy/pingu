// La campanita de los avisos del equipo que no sale al pulsar «Publicar»
// (tanda 1260): los PROGRAMADOS cuando les llega la hora, y el «se acaba
// pronto» cuando a uno con «Recordar» le faltan menos de 30 horas. Lo hace
// entero `avisos_al_dia()` en la base (una llamada, solo entre las 10 y las
// 22 de Madrid, y cada aviso una vez: se marca antes de avisar). No pide nada
// a nadie de fuera, así que cada hora no cuesta nada.
//
// Lo que pasa se apunta en el estado (`scrydex_estado`, clave
// `avisos_al_dia`, en PASADAS): un error que solo vuelve en la respuesta no
// lo lee nadie (la 655).
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).
const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'avisos_al_dia'

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
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/avisos_al_dia`, { method: 'POST', headers: cabeceras, body: '{}' })
    const texto = await res.text()
    if (!res.ok) {
      // Sin la migración no es un fallo que gritar cada hora: es «todavía no».
      if (/PGRST202|Could not find/.test(texto)) {
        await apuntar({ hecho: true, saltado: 'falta ejecutar supabase-migration-1260-avisos.sql' })
        return { ok: true, saltado: 'falta ejecutar supabase-migration-1260-avisos.sql' }
      }
      const error = `Supabase ${res.status}: ${texto.slice(0, 200)}`
      await apuntar({ ultimoError: { error, fecha: ahora.toISOString() } })
      return { ok: false, error }
    }
    const n = Number(JSON.parse(texto))
    const avisadas = Number.isFinite(n) ? n : 0
    await apuntar({ hecho: true, avisadas })
    return { ok: true, avisadas }
  } catch (e) {
    const error = String(e?.message || e)
    await apuntar({ ultimoError: { error, fecha: ahora.toISOString() } })
    return { ok: false, error }
  }
}

export default async function handler() {
  const r = await procesar()
  if (!r.ok) console.warn('avisos-recordatorio:', JSON.stringify(r).slice(0, 400))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada hora, en el minuto 7 (no en punto: ahí se pelea todo el mundo).
export const config = { schedule: '7 * * * *' }
