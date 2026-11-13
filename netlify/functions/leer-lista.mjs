// Leer una CAPTURA de la lista de un set (1300, «Pegar lista» de /admin →
// Colecciones). Solo para administradores. Lo que devuelve es TEXTO, línea a
// línea: el panel lo pone en la caja de «Pegar texto», donde se puede corregir
// antes de nada, y lo entiende `filasDeLista` (admin/js/lista-set-puro.js).
//
// El lector es el del escáner de cartas (leer-carta.mjs, OCR.space): la MISMA
// clave (`OCR_API_KEY`) y el mismo plan gratuito, sin gastar nada más. Con
// `isTable`, OCR.space devuelve cada fila de una tabla en su línea, que es lo
// que hace falta para una lista de cartas. Su plan gratuito no pasa de 1 MB por
// imagen: el panel la comprime antes.
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { laClave, clavesALaVista, NOMBRES_CLAVE, IDIOMAS } from './leer-carta.mjs'

const OCR_URL = 'https://api.ocr.space/parse/image'
export const LIMITE_LISTA = 1024 * 1024

const json = (estado, cuerpo) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export async function responder(req, { env = process.env, fetchImpl = fetch, esAdmin = (t) => idDeAdmin(t, fetchImpl) } = {}) {
  if (req.method !== 'POST') return json(405, { error: 'Solo POST.' })
  if (!(await esAdmin(tokenDe(req)))) return json(401, { error: 'Solo para administradores.' })
  let cuerpo
  try { cuerpo = await req.json() } catch { return json(400, { error: 'No he podido leer la petición.' }) }
  const imagen = String(cuerpo?.imagen || '')
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(imagen)) return json(400, { error: 'Falta la captura.' })
  if (imagen.length > LIMITE_LISTA * 1.37) return json(413, { error: 'La captura es demasiado grande (más de 1 MB).' })
  const { clave } = laClave(env)
  if (!clave) {
    const ala = clavesALaVista(env)
    return json(503, {
      error: 'El lector de capturas no está configurado: falta la clave OCR_API_KEY en Netlify (la misma del escáner de cartas). Mientras, pega el texto.',
      detalle: ala.length ? `Llegan: ${ala.join(', ')}. Vale cualquiera de ${NOMBRES_CLAVE.join(', ')}.` : '',
      sinConfigurar: true,
    })
  }
  const cfg = IDIOMAS[String(cuerpo?.idioma || 'en')] || IDIOMAS.en
  const form = new URLSearchParams()
  form.set('base64Image', imagen)
  form.set('language', cfg.lang)
  form.set('OCREngine', String(cfg.motor))
  form.set('isTable', 'true')
  form.set('scale', 'true')
  form.set('isOverlayRequired', 'false')
  try {
    const res = await fetchImpl(OCR_URL, {
      method: 'POST',
      headers: { apikey: clave, 'content-type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return json(502, { error: `El lector contestó ${res.status}.` })
    const datos = await res.json()
    if (datos?.IsErroredOnProcessing) return json(502, { error: [].concat(datos.ErrorMessage || 'Error del lector').join(' ') })
    const texto = (datos?.ParsedResults || []).map((p) => p?.ParsedText || '').join('\n')
      .split(/\r?\n/).map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim()).join('\n')
    return json(200, { texto })
  } catch (e) {
    return json(504, { error: `El lector no ha contestado a tiempo (${String(e?.message || e).slice(0, 80)}).` })
  }
}

export default (req) => responder(req)

// Tope por persona (tanda 1313, S7): leer una lista pegada o fotografiada.
// Pasado el tope, Netlify contesta 429 sin despertar la función (no se
// paga). Por IP: cada uno el suyo.
export const config = { rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] } }
