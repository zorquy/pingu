// «Traer ahora lo que falta de TCGdex», de /admin → Colecciones (tanda 1159).
//
// PINGU: «las MEP no salen todavía, ¿puedes forzarlo para traer todos los
// datos de ese set ahora?». La pasada programada (`tcgdex-rellenar-set`)
// trabaja una vez por semana y, si falla tres veces, se para; y una
// función programada de Netlify no se puede llamar por su URL. Esto hace
// la MISMA pasada al momento para un relleno de la lista
// (js/rellenos-tcgdex.js), sin mirar si toca ni los intentos, contesta qué
// ha visto y escrito (y qué se ha saltado porque ya estaba en otro set), y
// vacía la copia de la CDN para que la web lo enseñe ya. Solo para
// administradores, por POST.
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { purgarEtiquetas } from '../lib/purgar.mjs'
import { ETIQUETA_CACHE } from './sets.mjs'
import { pasada } from './tcgdex-rellenar-set.mjs'

export async function traerAhora(req, { env = process.env, fetchImpl = fetch, esAdmin = (t) => idDeAdmin(t, fetchImpl), pasadaImpl = pasada, purgarImpl = purgarEtiquetas } = {}) {
  const json = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
  if (req.method !== 'POST') return json(405, { ok: false, error: 'Método no permitido' })
  if (!(await esAdmin(tokenDe(req)))) return json(401, { ok: false, error: 'Solo para administradores.' })
  const cuerpo = await req.json().catch(() => ({}))
  const clave = String(cuerpo?.clave || '').slice(0, 60)
  if (!clave) return json(400, { ok: false, error: 'Falta qué relleno.' })
  const r = await pasadaImpl({ env, forzar: true, clave })
  // Que la web lo enseñe ya: la estantería y las cartas de cada set salen
  // de una copia de la CDN con la etiqueta `sets` (978).
  let web = null
  if (r?.ok && r.hecho?.escritas) web = await purgarImpl([ETIQUETA_CACHE], { env, fetchImpl }).catch((e) => ({ ok: false, error: String(e?.message || e) }))
  return json(r?.ok ? 200 : 502, { ...r, web })
}

export default (req) => traerAhora(req)
