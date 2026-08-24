// La foto del XP al empezar el mes (tabla xp_mes): corre a diario y, a
// quien todavía no tenga foto ESTE mes, se la toma (xp_inicio = su XP
// total de ahora). El "top del mes" que pinta la portada es
// total_xp − xp_inicio: cuánto ha ganado cada cual desde el día 1.
//
// Correr a diario (y no solo el día 1) tiene dos motivos: los recién
// registrados entran al top con foto 0 en cuanto pasa la siguiente
// pasada, y si una pasada falla, la de mañana lo arregla sola.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (la tabla no tiene
// políticas de escritura: solo escribe esta función). Sin la clave, no
// hace nada y lo dice.

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

function servicio(clave) {
  return { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
}

async function restReal(ruta, clave, opciones = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...opciones,
    headers: { ...servicio(clave), ...(opciones.headers || {}) },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.status === 204 ? null : res.json()
}

export function mesActual(ahora = new Date()) {
  return `${ahora.getUTCFullYear()}-${String(ahora.getUTCMonth() + 1).padStart(2, '0')}-01`
}

export async function procesar({ env = process.env, rest = restReal, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: true, saltado: 'sin SUPABASE_SERVICE_ROLE_KEY: no se hace nada' }

  const mes = mesActual(ahora)
  const [conFoto, perfiles] = await Promise.all([
    rest(`xp_mes?mes=eq.${mes}&select=user_id&limit=10000`, clave),
    rest(`user_profiles?select=id,total_xp&limit=10000`, clave),
  ])
  const yaHechos = new Set((conFoto || []).map((f) => f.user_id))
  const nuevos = (perfiles || [])
    .filter((p) => p.id && !yaHechos.has(p.id))
    .map((p) => ({ user_id: p.id, mes, xp_inicio: p.total_xp || 0 }))

  if (nuevos.length === 0) return { ok: true, mes, fotos: 0 }

  await rest(`xp_mes?on_conflict=user_id,mes`, clave, {
    method: 'POST',
    // Si dos pasadas se pisan, la clave primaria (user_id, mes) haría
    // fallar el lote entero; con resolution=ignore-duplicates la fila
    // repetida se ignora y las demás entran.
    headers: { prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify(nuevos),
  })
  return { ok: true, mes, fotos: nuevos.length }
}

export default async function handler() {
  const resultado = await procesar()
  return new Response(JSON.stringify(resultado), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

export const config = { schedule: '43 3 * * *' }
