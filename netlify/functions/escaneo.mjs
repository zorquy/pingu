// El escaneo de una carta de la CDN de Limitless, servido por NOSOTROS
// (tanda 413), para la IMAGEN que se exporta de un mazo.
//
// EL PROBLEMA. La imagen se dibuja en un <canvas>, y un canvas al que se
// le pinta una imagen de otro dominio sin permiso (CORS) queda «manchado»:
// ya no se puede convertir en PNG. Los escaneos de TCGdex sí traen el
// permiso; los de Limitless NO (comprobado desde pokedoc.es el
// 2026-10-01: `fetch(..., {mode: 'cors'})` falla). Y Limitless es justo
// el sitio que tiene las cartas que TCGdex no tiene: las promos de Mega
// Evolución, las energías del 30 aniversario, los sets recién salidos.
//
// LA SOLUCIÓN. Desde el mismo dominio no hay CORS que valga: el navegador
// pide /escaneo/MEP/10 a pokedoc.es y esto se lo trae de Limitless.
//
// NO ES UN PROXY ABIERTO: solo acepta un código de set y un número, los
// valida y monta la dirección él mismo con la MISMA función que usa el
// resto del sitio (imagenDeLimitless). No hay forma de pedirle otra cosa.
import { imagenDeLimitless } from '../../js/escaneo-carta.js'

// Un año: el escaneo de una carta no cambia, y así Limitless recibe una
// petición por carta y no una por cada imagen que se exporta.
const CACHE = 'public, max-age=31536000, immutable'

export async function traerEscaneo(set, numero, { fetchImpl = fetch } = {}) {
  const url = imagenDeLimitless(set, numero)
  if (!url) return null
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const tipo = res.headers.get('content-type') || ''
    // Solo imágenes: si la CDN devolviera una página de error con un 200,
    // no se la pasamos al lienzo.
    if (!/^image\//.test(tipo)) return null
    return { datos: await res.arrayBuffer(), tipo }
  } catch {
    return null
  }
}

export default async (request) => {
  // /escaneo/<SET>/<NÚMERO>, que netlify.toml reescribe a ?set=&n=.
  const p = new URL(request.url).searchParams
  const escaneo = await traerEscaneo(p.get('set'), p.get('n'))
  if (!escaneo) {
    return new Response('Sin escaneo', { status: 404, headers: { 'cache-control': 'public, max-age=3600' } })
  }
  return new Response(escaneo.datos, { headers: { 'content-type': escaneo.tipo, 'cache-control': CACHE } })
}
