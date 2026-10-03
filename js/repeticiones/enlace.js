// El enlace que LLEVA la partida dentro (tanda 480).
//
// Sin cuenta (o sin la migración puesta), compartir no puede guardar nada
// en la base: el enlace se lleva el registro entero, comprimido, detrás de
// un `#`. Lo de detrás del `#` no sale del navegador — ni siquiera llega a
// nuestro servidor —, así que la partida va de quien la manda a quien la
// abre sin pasar por ningún sitio.
//
// Un registro de 10 KB queda en unos 3: largo, pero cabe. Con cuenta el
// enlace sale corto (/repeticiones?r=…), y la pantalla lo dice.
//
// Sin DOM: se prueba en Node, que tiene los mismos CompressionStream.

const PREFIJO = 'p='
// Sin compresión en el navegador (muy viejo), el texto tal cual: más
// largo, pero se abre igual.
const PREFIJO_PLANO = 't='

function aBase64Url(bytes) {
  let bin = ''
  // A trozos: `String.fromCharCode(...bytes)` revienta la pila con un
  // registro largo.
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function deBase64Url(texto) {
  const b64 = texto.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

async function pasarPor(bytes, transformador) {
  const flujo = new Blob([bytes]).stream().pipeThrough(transformador)
  return new Uint8Array(await new Response(flujo).arrayBuffer())
}

// El registro → lo que va detrás del `#`.
export async function empaquetar(registro) {
  const bytes = new TextEncoder().encode(String(registro || ''))
  if (typeof CompressionStream !== 'function') return PREFIJO_PLANO + aBase64Url(bytes)
  return PREFIJO + aBase64Url(await pasarPor(bytes, new CompressionStream('deflate-raw')))
}

// Lo de detrás del `#` → el registro, o null si no es un enlace de
// repetición (o viene roto: pegado a medias, cortado por un chat…).
export async function desempaquetar(hash) {
  const h = String(hash || '').replace(/^#/, '')
  try {
    if (h.startsWith(PREFIJO_PLANO)) return new TextDecoder().decode(deBase64Url(h.slice(PREFIJO_PLANO.length)))
    if (!h.startsWith(PREFIJO)) return null
    if (typeof DecompressionStream !== 'function') throw new Error('sin descompresor')
    const bytes = await pasarPor(deBase64Url(h.slice(PREFIJO.length)), new DecompressionStream('deflate-raw'))
    return new TextDecoder().decode(bytes)
  } catch {
    return null
  }
}

export const esEnlaceDeRepeticion = (hash) => /^#?(p|t)=/.test(String(hash || ''))
