// Los colores de UNA expansión ahora mismo, desde /admin (tanda 1419): el
// botón «Calcular ahora» de Colores. Es la misma `procesar` que la programada
// (`colores-cartas`), con `soloSet`; va en su propia puerta porque una función
// con `schedule` no se puede llamar por HTTP (Netlify da 403, la 589).
//
// VARIABLES DE ENTORNO: las de colores-cartas.
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { procesar } from './colores-cartas.mjs'

export default async (req) => {
  const json = (e, c) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' })
  if (!(await idDeAdmin(tokenDe(req)))) return json(401, { error: 'No autorizado.' })
  let cuerpo = {}
  try { cuerpo = await req.json() } catch { /* sin cuerpo */ }
  const id = String(cuerpo?.set || '').trim()
  if (!id) return json(400, { error: 'Falta la expansión.' })
  try {
    return json(200, await procesar({ soloSet: { id, market: cuerpo.market === 'JP' ? 'JP' : 'WEST' } }))
  } catch (e) {
    return json(502, { error: String(e?.message || e).slice(0, 300) })
  }
}
