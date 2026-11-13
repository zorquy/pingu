// Tu calendario de PokeDoc (tanda 1321, P7 del plan): /cal/<clave>.ics.
// Google Calendar o el del iPhone lo piden cada pocas horas; la clave es la
// única llave (64 cifras al azar, se cambia en Ajustes › Calendario). Va
// detrás de una reescritura, así que lee la RUTA (la 633).
import { icsDeCalendario } from '../../js/calendario-puro.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
// La pública: `calendario_de` se puede llamar sin cuenta (la clave es la llave).
const ANON = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

export const claveDeRuta = (ruta) => (/^\/cal\/([0-9a-f]{32,128})\.ics$/.exec(ruta || '') || [])[1] || null

export async function responder(req, { fetchImpl = fetch, ahora = new Date() } = {}) {
  const clave = claveDeRuta(new URL(req.url).pathname)
  if (!clave) return new Response('No existe.', { status: 404 })
  const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/calendario_de`, {
    method: 'POST',
    headers: { apikey: ANON, authorization: `Bearer ${ANON}`, 'content-type': 'application/json' },
    body: JSON.stringify({ p_clave: clave }),
  }).catch(() => null)
  if (!res) return new Response('No se ha podido preguntar.', { status: 503 })
  if (!res.ok) return new Response('No se ha podido preguntar.', { status: 503 })
  const datos = await res.json().catch(() => null)
  if (!datos) return new Response('No existe.', { status: 404 })
  return new Response(icsDeCalendario(datos, { ahora }), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'inline; filename="pokedoc.ics"',
      // Privado: es de una persona. Media hora basta (los calendarios miran
      // cada pocas horas).
      'cache-control': 'private, max-age=1800',
      'x-robots-tag': 'noindex',
    },
  })
}

export default (req) => responder(req)

export const config = { rateLimit: { windowLimit: 60, windowSize: 60, aggregateBy: ['ip', 'domain'] } }
