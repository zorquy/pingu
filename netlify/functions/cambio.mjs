// El cambio del día para «precios en tu moneda» (tanda 1330, G9). La web lo
// pide UNA vez al día por navegador y lo guarda (js/moneda.js); aquí se cachea
// en la CDN medio día, así que la función casi no corre. Primero
// open.er-api.com (gratis y sin clave, trae los pesos de Latinoamérica) y, si
// no contesta, el BCE vía Frankfurter (solo dólar y peso mexicano).
import { MONEDAS } from '../../js/moneda.js'

const PEDIDAS = Object.keys(MONEDAS).filter((m) => m !== 'EUR')

export function tasasDe(json) {
  const r = json?.rates || {}
  const tasas = {}
  for (const m of PEDIDAS) if (Number(r[m]) > 0) tasas[m] = Number(r[m])
  return tasas
}

export async function responder(_req, { fetchImpl = fetch, ahora = new Date() } = {}) {
  const fuentes = [
    ['open.er-api.com', 'https://open.er-api.com/v6/latest/EUR'],
    ['BCE', `https://api.frankfurter.app/latest?from=EUR&to=${PEDIDAS.join(',')}`],
  ]
  for (const [fuente, url] of fuentes) {
    const res = await fetchImpl(url, { headers: { accept: 'application/json' } }).catch(() => null)
    if (!res?.ok) continue
    const tasas = tasasDe(await res.json().catch(() => null))
    if (!Object.keys(tasas).length) continue
    return new Response(JSON.stringify({ fecha: ahora.toISOString().slice(0, 10), fuente, tasas }), {
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=3600',
        'netlify-cdn-cache-control': 'public, s-maxage=43200, stale-while-revalidate=86400',
      },
    })
  }
  // Sin cambio: la web sigue en euros, que es lo que dice Cardmarket.
  return new Response(JSON.stringify({ error: 'Sin cambio ahora mismo.' }), { status: 503, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
}

export default (req) => responder(req)

export const config = { rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } }
