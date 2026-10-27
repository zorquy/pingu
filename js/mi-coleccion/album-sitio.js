// DÓNDE CAE UNA CARTA EN UN ÁLBUM (tanda 1052, PINGU: «desde el pop-up de
// una carta no puedes añadir a un álbum»). Lo puro de «En tus álbumes»: en
// qué álbumes está ya, en qué página, y dónde iría en cada binder. Sin DOM
// ni base: lo usan la ficha de Mi colección, /carta y el pop-up de toda la
// web (js/en-tus-albumes.js), y se prueba en Node.
//
// Un álbum es una lista de bolsillos: `{ id, v?, m? }` es una carta (con su
// versión y su catálogo si no es el occidental) y `{}` un hueco en medio
// (760). La carta nueva va al PRIMER hueco libre, como dentro del álbum
// (`añadirAlAbierto` en albumes.js), y si no hay, detrás de la última.
import { rejillaDe } from './album-forma.js'

// Un álbum no pasa de aquí (lo comparte albumes.js).
export const MAX_CARTAS = 1080

const esHueco = (c) => !c?.id
export const esDeSet = (a) => a?.tipo === 'set' && Boolean(a.set_id)
const bolsillos = (a) => (Array.isArray(a?.cartas) ? a.cartas : [])

export function sitioLibre(album) {
  const cartas = bolsillos(album)
  const i = cartas.findIndex(esHueco)
  return i >= 0 ? i : cartas.length
}

// Lo que cabe: sus páginas por sus bolsillos (un binder de 20 páginas de
// 3×3 son 180, como el de verdad). Un álbum sin páginas, el tope.
export function capacidadDe(album) {
  const n = Number(album?.paginas) || 0
  return n > 0 ? Math.min(MAX_CARTAS, rejillaDe(album.rejilla).porPagina * n) : MAX_CARTAS
}

// El bolsillo donde está la carta (cualquier versión), o -1.
export function dondeEsta(album, cardId) {
  return bolsillos(album).findIndex((c) => c?.id === cardId)
}

// Página y hueco de un bolsillo, contando desde 1, como se dice.
export function lugarDe(album, i) {
  const { porPagina } = rejillaDe(album?.rejilla)
  return { pagina: Math.floor(i / porPagina) + 1, hueco: (i % porPagina) + 1 }
}

// Lo que se guarda en el bolsillo: la versión si se sabe y el catálogo si no
// es el occidental (767), como al elegirla desde el buscador del álbum.
export function bolsilloDe(carta, variante = null) {
  const b = { id: carta.id }
  if (variante) b.v = variante
  if (carta.market && carta.market !== 'WEST') b.m = carta.market
  return b
}

// La lista nueva de bolsillos con la carta en el primer hueco libre.
export function conLaCarta(album, bolsillo) {
  const r = [...bolsillos(album)]
  const i = sitioLibre(album)
  while (r.length < i) r.push({})
  r[i] = bolsillo
  return r
}

// Todo lo que pinta «En tus álbumes» de una carta:
//  · `conElla`: los álbumes donde ya está (binders y el de su expansión),
//    con la página, para ir directo.
//  · `opciones`: los binders, cada uno con lo que pasaría al elegirlo —
//    `ya` (está, en la pág. N), `va` (iría a la pág. N, hueco M) o `lleno`—.
//    Los álbumes de set no se ofrecen: son su expansión, y la carta de otra
//    no pinta nada dentro.
//  · `suSet`: el álbum de SU expansión, si lo tienes (va aparte).
export function resumenParaCarta(albumes, carta) {
  const conElla = []
  const opciones = []
  let suSet = null
  for (const a of albumes || []) {
    const i = dondeEsta(a, carta.id)
    if (esDeSet(a)) {
      const mismo = a.set_id === carta.set_id && (a.set_market || 'WEST') === (carta.market || 'WEST')
      if (i >= 0) conElla.push({ album: a, ...lugarDe(a, i) })
      if (mismo || i >= 0) suSet = suSet || { album: a, dentro: i >= 0, ...(i >= 0 ? lugarDe(a, i) : {}) }
      continue
    }
    if (i >= 0) {
      const l = lugarDe(a, i)
      conElla.push({ album: a, ...l })
      opciones.push({ album: a, estado: 'ya', ...l })
      continue
    }
    const sitio = sitioLibre(a)
    if (sitio >= capacidadDe(a)) opciones.push({ album: a, estado: 'lleno' })
    else opciones.push({ album: a, estado: 'va', ...lugarDe(a, sitio) })
  }
  return { conElla, opciones, suSet }
}

// Ir a un álbum abierto por su página y su bolsillo (cuentan desde 1); el
// álbum se abre ahí y el bolsillo se señala (`entrar` en albumes.js).
export function enlaceAAlbum(id, pagina = null, hueco = null) {
  const p = new URLSearchParams({ ver: 'carpetas', album: id })
  if (pagina) p.set('pag', String(pagina))
  if (pagina && hueco) p.set('hueco', String(hueco))
  return `/mi-coleccion?${p}`
}

// Lo que dice cada opción, debajo del nombre.
export function textoDeOpcion(o) {
  if (o.estado === 'ya') return `Ya está · pág. ${o.pagina}`
  if (o.estado === 'lleno') return 'Lleno: no le cabe otra'
  return `Va en la pág. ${o.pagina}, hueco ${o.hueco}`
}
