// El minisprite de un Pokémon de la CDN de Limitless, servido por
// NOSOTROS (tanda 425), para la IMAGEN del meta de un torneo.
//
// Es el mismo problema y la misma solución que /escaneo (tanda 413): la
// imagen se dibuja en un <canvas>, y un canvas al que se le pinta una
// imagen de otro dominio sin permiso (CORS) ya no se puede guardar. Los
// sprites de r2.limitlesstcg.net no traen ese permiso (comprobado desde
// pokedoc.es el 2026-10-01), y son los que la web enseña en las chapas de
// los arquetipos: la imagen del meta tiene que enseñar LOS MISMOS.
//
// NO ES UN PROXY ABIERTO: solo acepta un nombre de sprite (letras
// minúsculas, números y guiones) y monta la dirección él mismo con la CDN
// de siempre (CDN_SPRITES, la misma constante que usa la web).
import { CDN_SPRITES } from '../../js/torneos/sprites-pokemon.js'

// Un año: el dibujo de un sprite no cambia.
const CACHE = 'public, max-age=31536000, immutable'

export const NOMBRE_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export async function traerSprite(nombre, { fetchImpl = fetch } = {}) {
  const n = String(nombre ?? '')
  if (n.length > 40 || !NOMBRE_VALIDO.test(n)) return null
  try {
    const res = await fetchImpl(`${CDN_SPRITES}/${n}.png`, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const tipo = res.headers.get('content-type') || ''
    if (!/^image\//.test(tipo)) return null
    return { datos: await res.arrayBuffer(), tipo }
  } catch {
    return null
  }
}

export default async (request) => {
  // /sprite/<NOMBRE>, que netlify.toml reescribe a ?n=.
  const sprite = await traerSprite(new URL(request.url).searchParams.get('n'))
  if (!sprite) {
    return new Response('Sin sprite', { status: 404, headers: { 'cache-control': 'public, max-age=3600' } })
  }
  return new Response(sprite.datos, { headers: { 'content-type': sprite.tipo, 'cache-control': CACHE } })
}
