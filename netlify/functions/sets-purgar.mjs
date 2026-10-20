// /admin → Colecciones llama aquí después de guardar (tanda 908): vacía la
// copia de la estantería que guarda la CDN para que la web enseñe el
// cambio al momento. Solo para administradores: vaciar la caché sin motivo
// obligaría a pedir los sets a Supabase en cada visita.
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { purgarEtiquetas } from '../lib/purgar.mjs'
import { ETIQUETA_CACHE } from './sets.mjs'

export async function purgar(req, { env = process.env, fetchImpl = fetch, esAdmin = (t) => idDeAdmin(t, fetchImpl) } = {}) {
  const responder = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
  if (req.method !== 'POST') return responder(405, { error: 'Método no permitido' })
  if (!(await esAdmin(tokenDe(req)))) return responder(401, { error: 'No autorizado.' })
  const r = await purgarEtiquetas([ETIQUETA_CACHE], { env, fetchImpl })
  return responder(r.ok ? 200 : 502, r)
}

export default (req) => purgar(req)
