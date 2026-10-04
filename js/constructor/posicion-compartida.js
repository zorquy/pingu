// Compartir una POSICIÓN del laboratorio con un enlace (tanda 515).
//
// PINGU, de la lista de ideas: «un enlace que lleve la mesa tal cual: los
// dos mazos, las manos, la banca, el daño… y quien lo abre sigue jugando
// desde ahí». Para preguntar «¿qué harías aquí?» sin capturas.
//
// El enlace LLEVA la posición dentro, comprimida detrás de un `#`, como el
// de las repeticiones sin cuenta (repeticiones/enlace.js): no se guarda en
// ningún sitio y lo de detrás del `#` ni siquiera llega a nuestro servidor.
// Lo que viaja:
//
//   · los mazos, carta a carta y EN SU ORDEN: el motor numera cada copia
//     física por el orden de las entradas (a1, a2…), y el estado solo
//     guarda esos números. Otro orden sería otra mesa.
//   · de cada carta, su id y además su nombre y su tipo: si el catálogo ya
//     no la tiene (o es la «Carta sin ver» de una repetición), se juega con
//     eso en vez de romper la mesa.
//   · el estado del motor tal cual (es de objetos y listas planos: el mismo
//     que se clona para deshacer), sin los registros, que son lo que más
//     pesa y no hacen falta para seguir jugando.
//
// Sin DOM: se prueba en Node, que tiene los mismos CompressionStream.

const PREFIJO = 'pos='
const VERSION = 1

function aBase64Url(bytes) {
  let bin = ''
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

const sinRegistro = (s) => ({ ...s, registro: [] })

// `posicion`: { tipo: 'mesa' | 'muneco', nombres, mazos: [{ nombre,
// entradas: [{ carta, n }] }], estado } — con mesa, el estado es { a, b, m }
// (los dos lados y la mesa); contra el muñeco, el de la partida.
export function compactar(posicion) {
  const mesa = posicion.tipo === 'mesa'
  const e = posicion.estado
  return {
    v: VERSION,
    t: mesa ? 'mesa' : 'muneco',
    n: mesa ? posicion.nombres.slice(0, 2) : null,
    z: posicion.mazos.map((m) => ({
      n: String(m.nombre || ''),
      c: m.entradas.map((x) => [x.carta.id, x.n, x.carta.name || '', x.carta.name_es || '', x.carta.category || '']),
    })),
    // Con mesa el registro es UNO, el de la mesa (los lados le pasan el
    // suyo: partida.js, `log`), así que es ese el que se vacía.
    e: mesa ? { ...e, m: sinRegistro(e.m) } : sinRegistro(e),
  }
}

// Lo que se comprueba al abrir: que tenga la forma de una posición. Un
// enlace cortado por un chat ya no descomprime; esto es para uno que
// descomprime pero no es lo que dice ser.
export function esPosicion(x) {
  if (!x || x.v !== VERSION || !['mesa', 'muneco'].includes(x.t) || !Array.isArray(x.z)) return false
  const mazoBueno = (m) => m && Array.isArray(m.c) && m.c.length > 0 && m.c.every((c) => Array.isArray(c) && typeof c[0] === 'string' && Number.isInteger(c[1]) && c[1] > 0 && c[1] <= 60)
  const ladoBueno = (s) => s && Array.isArray(s.mazo) && Array.isArray(s.mano) && Array.isArray(s.banca) && Array.isArray(s.premios) && Array.isArray(s.descarte)
  if (x.t === 'mesa') return x.z.length === 2 && x.z.every(mazoBueno) && ladoBueno(x.e?.a) && ladoBueno(x.e?.b) && x.e.m && typeof x.e.m.fase === 'string' && Array.isArray(x.n)
  return x.z.length === 1 && mazoBueno(x.z[0]) && ladoBueno(x.e)
}

// Lo compacto → lo que entiende el laboratorio, con las cartas que el
// catálogo devuelva (`catalogo`: id → carta) y las demás como vinieron.
export function expandir(x, catalogo = new Map()) {
  return {
    tipo: x.t,
    nombres: x.n,
    mazos: x.z.map((m) => ({
      nombre: m.n,
      entradas: m.c.map(([id, n, name, nameEs, category]) => ({ n, carta: catalogo.get(id) || { id, name, name_es: nameEs || name, category } })),
    })),
    estado: x.e,
  }
}

// Los ids que hay que pedir al catálogo: los de verdad. «sin-ver» y
// «suelta:…» son cartas que se inventa una repetición y no están en él.
export const idsDelCatalogo = (x) => [...new Set(x.z.flatMap((m) => m.c.map((c) => c[0])))].filter((id) => id !== 'sin-ver' && !id.startsWith('suelta:'))

// La posición → lo que va detrás del `#`.
export async function empaquetarPosicion(posicion) {
  const bytes = new TextEncoder().encode(JSON.stringify(compactar(posicion)))
  if (typeof CompressionStream !== 'function') throw new Error('Este navegador no sabe comprimir: prueba con uno al día.')
  return PREFIJO + aBase64Url(await pasarPor(bytes, new CompressionStream('deflate-raw')))
}

// Lo de detrás del `#` → la posición compacta, o null si no es un enlace de
// posición o viene roto.
export async function desempaquetarPosicion(hash) {
  const h = String(hash || '').replace(/^#/, '')
  if (!h.startsWith(PREFIJO)) return null
  try {
    const bytes = await pasarPor(deBase64Url(h.slice(PREFIJO.length)), new DecompressionStream('deflate-raw'))
    const x = JSON.parse(new TextDecoder().decode(bytes))
    return esPosicion(x) ? x : null
  } catch {
    return null
  }
}

export const esEnlaceDePosicion = (hash) => String(hash || '').replace(/^#/, '').startsWith(PREFIJO)
