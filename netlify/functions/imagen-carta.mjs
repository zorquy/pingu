// La foto de una carta, servida por NOSOTROS con permiso CORS (tanda 566),
// para la imagen de «Mis 9 cartas».
//
// Es el mismo problema y la misma solución que /sprite (tanda 425) y
// /escaneo (413): la imagen se dibuja en un <canvas>, y un canvas al que
// se le pinta una imagen de otro dominio sin permiso ya no se puede
// guardar. El navegador prueba PRIMERO la dirección directa —si el CDN da
// permiso, esto no se llama y no cuesta nada— y solo cae aquí si no.
//
// NO ES UN PROXY ABIERTO: solo se sirven direcciones de los tres sitios de
// donde la web ya saca las fotos de las cartas. Cualquier otra, 404.
const SITIOS = ['assets.tcgdex.net', 'images.scrydex.com', 'limitlesstcg.nyc3.cdn.digitaloceanspaces.com']

// Un año: la foto de una carta no cambia.
const CACHE = 'public, max-age=31536000, immutable'

export const CABECERAS_ORIGEN = { 'user-agent': 'PokeDoc/1.0 (+https://pokedoc.es)', accept: 'image/webp,image/png,image/*;q=0.8' }

export function esDireccionPermitida(u) {
  try {
    const url = new URL(String(u ?? ''))
    return url.protocol === 'https:' && SITIOS.includes(url.hostname)
  } catch {
    return false
  }
}

export async function traerFoto(u, { fetchImpl = fetch, alFallar = () => {} } = {}) {
  if (!esDireccionPermitida(u)) {
    alFallar('direccion')
    return null
  }
  try {
    const res = await fetchImpl(u, { headers: CABECERAS_ORIGEN, signal: AbortSignal.timeout(8000) })
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

export default async (request) => {
  let motivo = 'desconocido'
  const foto = await traerFoto(new URL(request.url).searchParams.get('u'), { alFallar: (m) => (motivo = m) })
  if (!foto) {
    return new Response('Sin foto', { status: 404, headers: { 'cache-control': 'public, max-age=3600', 'x-motivo': motivo } })
  }
  return new Response(foto.datos, {
    headers: { 'content-type': foto.tipo, 'cache-control': CACHE, 'access-control-allow-origin': '*' },
  })
}
