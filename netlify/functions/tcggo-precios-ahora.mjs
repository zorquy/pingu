// Una pasada de precios de TCGGO ahora mismo, desde /admin (tanda 589).
//
// Es la misma pasada que hace `tcggo-precios` cada diez minutos, en su
// propia puerta porque una función con `schedule` NO se puede llamar por
// HTTP: Netlify contesta 403 antes de llegar al código (se vio al pulsar
// el botón: «Error 403» sin más). Así que la programada programa y esta
// atiende al botón; las dos corren `procesar` del mismo módulo.
//
// VARIABLES DE ENTORNO: las de tcggo-precios.
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { procesar } from './tcggo-precios.mjs'

export default async (req) => {
  const json = (e, c) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' })
  if (!(await idDeAdmin(tokenDe(req)))) return json(401, { error: 'No autorizado.' })
  try {
    return json(200, await procesar())
  } catch (e) {
    return json(502, { error: String(e?.message || e).slice(0, 300) })
  }
}
