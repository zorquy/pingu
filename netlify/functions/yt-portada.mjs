// La miniatura de un vídeo de YouTube, servida por NOSOTROS (tanda 276).
//
// EL PROBLEMA. La portada del vídeo era un cuadro azul con un botón de
// play: funcional, pero no dice de qué va el vídeo y se ve triste.
// PINGU quería la portada de verdad, que además es lo que hace que
// apetezca pulsar.
//
// POR QUÉ NO SE PIDE Y YA. Porque la política de privacidad de la web
// promete, en negrita, que «mientras no lo reproduzcas, a YouTube no se
// le pide absolutamente nada». Un <img src="https://i.ytimg.com/..."> en
// cada guía con vídeo convertiría esa frase en mentira: el navegador de
// cada visitante hablaría con Google —con su IP y su referer— sin haber
// pulsado nada.
//
// LA SOLUCIÓN. La imagen la pide ESTE servidor y se la damos ya servida.
// El navegador de quien lee solo habla con pokedoc.es. Google ve una
// petición nuestra por vídeo y por caché, no una por visitante. La
// promesa se mantiene entera, y encima se puede contar mejor: la
// miniatura la servimos nosotros.
//
// Y de paso: al ser del mismo dominio, no depende de que nadie tenga
// bloqueado i.ytimg.com, que hoy es la mitad de la gente con un
// bloqueador puesto.

const ID_VALIDO = /^[A-Za-z0-9_-]{11}$/

// De mejor a peor. `maxresdefault` no existe para todos los vídeos —solo
// para los que se subieron en alta— y YouTube devuelve 404; `hqdefault`
// existe SIEMPRE, así que es la última parada y no hace falta más red
// detrás.
//
// `hqdefault` viene en 4:3 con bandas negras arriba y abajo; se recortan
// en el CSS con `object-fit: cover`, que es lo que hace que las dos se
// vean igual de bien en una caja 16:9.
const TAMANOS = ['maxresdefault', 'hqdefault']

// Un año y sin revalidar. La miniatura de un vídeo no cambia, y esto es
// lo que hace que Google reciba una petición por vídeo en vez de una por
// visita: el borde de Netlify la guarda y ya no vuelve a preguntar.
const CACHE = 'public, max-age=31536000, immutable'

export async function traerMiniatura(id, { fetchImpl = fetch } = {}) {
  for (const tamano of TAMANOS) {
    try {
      const res = await fetchImpl(`https://i.ytimg.com/vi/${id}/${tamano}.jpg`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      // YouTube devuelve 200 con una imagen gris de 120x90 cuando no
      // tiene la que le pides. Se cuela por el `res.ok`, así que se mira
      // el tamaño: la de verdad pesa decenas de kilobytes.
      const datos = await res.arrayBuffer()
      if (datos.byteLength < 2000) continue
      return { datos, tipo: res.headers.get('content-type') || 'image/jpeg' }
    } catch {
      // Se prueba la siguiente; si no hay más, se responde sin imagen.
    }
  }
  return null
}

export default async (request) => {
  const id = new URL(request.url).searchParams.get('v')
  // El identificador se comprueba carácter a carácter ANTES de meterlo en
  // una dirección. Sin esto, esto sería un proxy abierto: cualquiera
  // podría pedirle a nuestro servidor que se descargue lo que quisiera.
  if (!ID_VALIDO.test(String(id || ''))) {
    return new Response('Identificador de vídeo no válido', { status: 400 })
  }

  const imagen = await traerMiniatura(id)
  if (!imagen) {
    // Sin miniatura no se rompe nada: el <img> se esconde solo y debajo
    // sigue estando la portada de siempre, la que dibujamos nosotros.
    // 404 y no 500 a propósito — no es un error del servidor, es que ese
    // vídeo no tiene portada que dar.
    return new Response('Sin miniatura', { status: 404, headers: { 'cache-control': 'public, max-age=3600' } })
  }

  return new Response(imagen.datos, {
    headers: { 'content-type': imagen.tipo, 'cache-control': CACHE },
  })
}
