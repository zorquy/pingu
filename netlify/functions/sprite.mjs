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

// Quiénes somos, sin disfrazarnos: un servidor que pide un dibujo. Va desde
// la tanda 511, cuando se midió que /sprite daba 404 a TODO en producción
// mientras la CDN contestaba al navegador.
export const CABECERAS_ORIGEN = { 'user-agent': 'PokeDoc/1.0 (+https://pokedoc.es)', accept: 'image/png,image/*;q=0.8' }

// `alFallar(motivo)`: por qué no ha salido, para la cabecera `x-motivo` del
// 404. Sin ella un 404 de aquí no distingue «la CDN dice que no» de «la CDN
// no contesta» de «nos ha mandado una página», y eso es lo que hizo falta
// saber cuando dejó de funcionar.
export async function traerSprite(nombre, { fetchImpl = fetch, alFallar = () => {} } = {}) {
  const n = String(nombre ?? '')
  if (n.length > 40 || !NOMBRE_VALIDO.test(n)) {
    alFallar('nombre')
    return null
  }
  try {
    const res = await fetchImpl(`${CDN_SPRITES}/${n}.png`, { headers: CABECERAS_ORIGEN, signal: AbortSignal.timeout(6000) })
    if (!res.ok) {
      alFallar(`origen ${res.status}`)
      return null
    }
    const tipo = res.headers.get('content-type') || ''
    if (!/^image\//.test(tipo)) {
      alFallar(`tipo ${tipo || 'ninguno'}`)
      return null
    }
    return { datos: await res.arrayBuffer(), tipo }
  } catch (err) {
    alFallar(err?.name === 'TimeoutError' ? 'tiempo' : 'red')
    return null
  }
}

// El nombre, de la consulta o de la ruta (tanda 633): la reescritura de
// netlify.toml pone `?n=`, pero la función recibe la dirección ORIGINAL
// (`/sprite/charizard`) y la consulta venía vacía — todas contestaban 404
// («nombre»). Lo mismo que /escaneo.
export function nombreDeSprite(direccion) {
  const url = new URL(direccion, 'https://pokedoc.es')
  const ruta = url.pathname.match(/^\/sprite\/([^/]+)\/?$/)
  let deRuta = null
  try { deRuta = ruta ? decodeURIComponent(ruta[1]) : null } catch {}
  return url.searchParams.get('n') || deRuta
}

export default async (request) => {
  // /sprite/<NOMBRE>, que netlify.toml reescribe a ?n=.
  let motivo = 'desconocido'
  const sprite = await traerSprite(nombreDeSprite(request.url), { alFallar: (m) => (motivo = m) })
  if (!sprite) {
    return new Response('Sin sprite', { status: 404, headers: { 'cache-control': 'public, max-age=3600', 'x-motivo': motivo } })
  }
  return new Response(sprite.datos, { headers: { 'content-type': sprite.tipo, 'cache-control': CACHE } })
}
