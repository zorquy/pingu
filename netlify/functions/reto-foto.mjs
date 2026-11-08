// La foto de un reto, servida por PokeDoc ya borrosa o en silueta (tanda
// 1268). La dirección va CIFRADA (netlify/lib/reto-secreto.mjs): de dónde
// sale y qué se le hace va dentro, así que ni la dirección dice de qué carta
// es ni la imagen que se arrastra o se abre en otra pestaña sale nítida.
//
// No es un proxy abierto: solo se sirve lo que una función nuestra ha
// cifrado. Lo que no se abre, 404.
import sharp from 'sharp'
import { abrir } from '../lib/reto-secreto.mjs'
import { CABECERAS_ORIGEN } from './imagen-carta.mjs'

// La carta se ve a 340 px como mucho (css/carta-del-dia.css): a ese ancho se
// desenfoca, y el desenfoque en píxeles es el mismo que pintaba el CSS.
export const ANCHO = 340
// La silueta, como la pintaba css/quien-es.css: borrosa (14), menos (6), nítida.
export const DESENFOQUE_SILUETA = { 1: 14, 2: 6, 3: 0 }
const CACHE = 'public, max-age=31536000, immutable'

async function traer(urls, fetchImpl) {
  for (const u of urls || []) {
    try {
      const res = await fetchImpl(u, { headers: CABECERAS_ORIGEN, signal: AbortSignal.timeout(8000) })
      if (!res.ok || !/^image\//.test(res.headers.get('content-type') || '')) continue
      return Buffer.from(await res.arrayBuffer())
    } catch {
      // la siguiente
    }
  }
  return null
}

// Lo que se le hace a la foto. Siempre se vuelve a codificar: así no viaja
// nada de la original (ni sus metadatos).
export async function transformar(buf, e = null) {
  if (e?.s) {
    // La silueta: el contorno (el canal alfa) en negro.
    const { data, info } = await sharp(buf).resize({ width: ANCHO, withoutEnlargement: true }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    for (let i = 0; i < data.length; i += 4) { data[i] = 0; data[i + 1] = 0; data[i + 2] = 0 }
    const px = DESENFOQUE_SILUETA[e.s] ?? 0
    let img = sharp(data, { raw: info })
    if (px > 0) img = img.blur(px)
    return img.webp({ quality: 80, alphaQuality: 80 }).toBuffer()
  }
  if (e?.d) return sharp(buf).resize({ width: ANCHO }).blur(Math.max(0.3, Number(e.d))).webp({ quality: 70 }).toBuffer()
  return sharp(buf).webp({ quality: 82 }).toBuffer()
}

export async function servirFoto(token, { clave, fetchImpl = fetch } = {}) {
  const spec = abrir(token, clave)
  if (!spec || !Array.isArray(spec.u) || !spec.u.length) return { estado: 404, motivo: 'ficha' }
  const buf = await traer(spec.u, fetchImpl)
  if (!buf) return { estado: 404, motivo: 'origen' }
  try {
    return { estado: 200, datos: await transformar(buf, spec.e || null) }
  } catch {
    return { estado: 404, motivo: 'imagen' }
  }
}

export default async (req) => {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return new Response('Sin clave', { status: 500 })
  const r = await servirFoto(new URL(req.url).searchParams.get('f'), { clave })
  if (r.estado !== 200) return new Response('Sin foto', { status: 404, headers: { 'cache-control': 'public, max-age=600', 'x-motivo': r.motivo } })
  return new Response(r.datos, { headers: { 'content-type': 'image/webp', 'cache-control': CACHE, 'netlify-cdn-cache-control': `${CACHE}, durable` } })
}
