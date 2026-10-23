// ── «Posibles repetidas»: lo que se decide sin pantalla (tanda 987) ──
//
// La base junta las cartas de una colección con el mismo número y el mismo
// nombre (`catalogo_posibles_repetidas`); aquí se dice qué tienen en común,
// qué se sugiere y qué nombre de versión vale. Lo que se ve en la foto
// (el «STAFF» impreso) no lo sabe ningún campo: decide quien mira.
import { varianteDeEtiqueta, esClasica } from '../../js/mi-coleccion/variantes.js'
import { normalizeSearch } from '../../js/texto.js'

// Los nombres que se ofrecen con un toque; «Otra…» deja escribir.
export const ETIQUETAS = ['Staff', 'Prerelease', 'Sello de evento', 'Pokémon Center']

// Los ataques, como la huella de una reimpresión (carta-nucleo.js): nombre,
// daño y coste, sin el texto (cambia entre erratas). Aquí y no importando
// aquella: carta-nucleo arrastra las clases de la ficha a /admin (la 299).
function ataquesDe(c) {
  const lista = Array.isArray(c?.attacks) ? c.attacks : []
  if (!lista.length) return null
  return lista.map((a) => [normalizeSearch(String(a?.name || '')), String(a?.damage ?? ''), (Array.isArray(a?.cost) ? a.cost : []).join('+')].join('/')).sort().join('|')
}

export const claveDeGrupo = (g) => `${g.market}|${g.set_id}|${g.numero}|${g.nombre}`

// El producto de Cardmarket de una fila de la lista: el suyo, o el del precio.
export const productoDe = (c) => Number(c?.cm_id_product_propio || c?.precio?.cm_id_product) || null

// Lo que se compara, en el orden en que se lee. `coincide`: true, false, o
// null cuando a una de las dos le falta el dato (no se sabe no es un no).
export function senalesDelPar(a, b) {
  const s = [
    { clave: 'numero', texto: 'Mismo número', coincide: true },
    { clave: 'nombre', texto: 'Mismo nombre', coincide: true },
  ]
  const ha = Number(a?.hp) || null
  const hb = Number(b?.hp) || null
  s.push(ha && hb
    ? { clave: 'ps', texto: ha === hb ? `Mismos PS (${ha})` : `PS distintos (${ha} y ${hb})`, coincide: ha === hb }
    : { clave: 'ps', texto: 'Sin PS que comparar', coincide: null })
  const fa = ataquesDe(a)
  const fb = ataquesDe(b)
  s.push(fa && fb
    ? { clave: 'ataques', texto: fa === fb ? 'Mismos ataques' : 'Ataques distintos', coincide: fa === fb }
    : { clave: 'ataques', texto: 'Sin ataques que comparar', coincide: null })
  const ia = String(a?.illustrator || '').trim().toLowerCase()
  const ib = String(b?.illustrator || '').trim().toLowerCase()
  s.push(ia && ib
    ? { clave: 'ilustrador', texto: ia === ib ? 'Mismo ilustrador' : 'Otro ilustrador', coincide: ia === ib }
    : { clave: 'ilustrador', texto: 'Sin ilustrador que comparar', coincide: null })
  // El producto no es una señal de «la misma carta» o «no»: dos productos es
  // justo lo que tiene una versión aparte (la Staff), y uno solo, dos filas
  // de lo mismo.
  const pa = productoDe(a)
  const pb = productoDe(b)
  s.push(pa && pb
    ? { clave: 'producto', texto: pa === pb ? 'Mismo producto de Cardmarket' : 'Otro producto de Cardmarket', coincide: pa === pb, aviso: true }
    : { clave: 'producto', texto: 'Sin producto que comparar', coincide: null, aviso: true })
  return s
}

// Con el mismo producto, son dos filas de una carta; con otro, una versión.
export function sugerencia(a, b) {
  const pa = productoDe(a)
  const pb = productoDe(b)
  return pa && pb && pa === pb ? 'misma' : 'version'
}

// Un nombre de versión vale si no es una de las de siempre (la base dice lo
// mismo: «Ese nombre es el de una versión de siempre»).
export function etiquetaValida(texto) {
  const t = String(texto || '').trim()
  if (!t || t.length > 40) return false
  return !esClasica(varianteDeEtiqueta(t))
}

// La principal: la elegida a mano, o la primera (la base las da con la que
// ya teníamos delante: TCGdex, luego a mano, luego TCGGO por antigüedad).
export function principalDe(grupo, elegida = null) {
  const ids = (grupo?.cartas || []).map((c) => c.id)
  return elegida && ids.includes(elegida) ? elegida : ids[0] || null
}

export const claseDe = (cuenta) => (cuenta ? 'impresion' : 'sello')

const EUROS = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' })
export function precioCorto(c) {
  const v = Number(c?.precio?.cm_low_es ?? c?.precio?.cm_low)
  return Number.isFinite(v) && v > 0 ? EUROS.format(v) : 'sin precio'
}

export function quienLaTiene(c) {
  const n = Number(c?.personas) || 0
  if (!n) return 'nadie la tiene'
  return n === 1 ? '1 persona la tiene' : `${n} personas la tienen`
}

// El buscador de la caja: por la colección o por la carta.
export function filtrarGrupos(grupos, texto) {
  const t = String(texto || '').trim().toLowerCase()
  if (!t) return grupos || []
  return (grupos || []).filter((g) => [g.set?.name, g.set?.name_en, g.set_id, ...(g.cartas || []).flatMap((c) => [c.name, c.name_es, c.id])]
    .some((x) => String(x || '').toLowerCase().includes(t)))
}
