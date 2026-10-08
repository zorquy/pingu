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

// Lo mismo que /sprite (tanda 511): quién pide, sin disfrazarse, y por qué
// no ha salido, en la cabecera `x-motivo` del 404.
const CABECERAS_ORIGEN = { 'user-agent': 'PokeDoc/1.0 (+https://pokedoc.es)', accept: 'image/png,image/*;q=0.8' }

export async function traerEscaneo(set, numero, { fetchImpl = fetch, alFallar = () => {} } = {}) {
  const url = imagenDeLimitless(set, numero)
  if (!url) {
    alFallar('carta')
    return null
  }
  try {
    const res = await fetchImpl(url, { headers: CABECERAS_ORIGEN, signal: AbortSignal.timeout(6000) })
    if (!res.ok) {
      alFallar(`origen ${res.status}`)
      return null
    }
    const tipo = res.headers.get('content-type') || ''
    // Solo imágenes: si la CDN devolviera una página de error con un 200,
    // no se la pasamos al lienzo.
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

// De dónde salen el set y el número (tanda 633). La reescritura de
// netlify.toml los pone en `?set=&n=`… pero la función recibe la dirección
// ORIGINAL (`/escaneo/TWM/151`), sin esa consulta: `searchParams` venía
// vacío, cada petición contestaba 404 («carta») y la imagen exportada de un
// mazo se pintaba entera con el respaldo de TCGdex —y la carta que TCGdex
// no tiene en inglés (Hassel, TWM 151) salía como una caja con su nombre—.
// Se lee de la ruta, y la consulta queda para quien llame a la función a
// pelo.
export function parametrosDeEscaneo(direccion) {
  const url = new URL(direccion, 'https://pokedoc.es')
  const ruta = url.pathname.match(/^\/escaneo\/([^/]+)\/([^/]+)\/?$/)
  const leer = (t) => { try { return decodeURIComponent(t) } catch { return '' } }
  return {
    set: url.searchParams.get('set') || (ruta ? leer(ruta[1]) : null),
    numero: url.searchParams.get('n') || (ruta ? leer(ruta[2]) : null),
  }
}

export default async (request) => {
  // /escaneo/<SET>/<NÚMERO>, que netlify.toml reescribe a ?set=&n=.
  const { set, numero } = parametrosDeEscaneo(request.url)
  let motivo = 'desconocido'
  const escaneo = await traerEscaneo(set, numero, { alFallar: (m) => (motivo = m) })
  if (!escaneo) {
    return new Response('Sin escaneo', { status: 404, headers: { 'cache-control': 'public, max-age=3600', 'x-motivo': motivo } })
  }
  return new Response(escaneo.datos, { headers: { 'content-type': escaneo.tipo, 'cache-control': CACHE } })
}
