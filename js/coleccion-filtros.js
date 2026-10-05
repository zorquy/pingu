// Los filtros de una expansión por dentro (tanda 647), sin DOM: qué
// opciones ofrecer —solo las que de verdad hay en esta colección—, si una
// carta pasa, y en qué orden salen. Lo usa /coleccion y se prueba en Node.
//
// PINGU: «toda la información de los filtros, la rareza de esa carta, si
// tiene otros prints (normal, reverse, master ball)… como la API». Lo que
// la API no da por carta (las impresiones) sale de `variants` (TCGdex).
import { rarezaDeCarta } from './rarezas-nombres.js'
import { rangoDeCarta } from './rareza-escala.js'
import { variantesDeCarta } from './mi-coleccion/variantes.js'
import { normalizeSearch } from './texto.js'
import { nombresDeCartaParaBuscar, nombreDeCarta } from './catalogo-series.js'

// Los tramos de precio, en euros: lo que cuesta una común, una rara, una
// que ya duele, una cara. Fijos y pocos: un filtro de precio con diez
// tramos es un formulario.
export const RANGOS_DE_PRECIO = [
  { id: 'hasta1', nombre: 'Hasta 1 €', min: 0, max: 1 },
  { id: '1a5', nombre: '1 – 5 €', min: 1, max: 5 },
  { id: '5a20', nombre: '5 – 20 €', min: 5, max: 20 },
  { id: '20a100', nombre: '20 – 100 €', min: 20, max: 100 },
  { id: 'mas100', nombre: 'Más de 100 €', min: 100, max: Infinity },
]

export const ORDENES = [
  { id: 'numero', nombre: 'Número' },
  { id: 'precio', nombre: 'Precio, de más a menos' },
  { id: 'rareza', nombre: 'Rareza, de más a menos' },
  { id: 'nombre', nombre: 'Nombre' },
]

// Las impresiones que tiene una carta, en corto («N», «RH»…). Sin saberlo
// no se afirma ninguna: una marca es una afirmación sobre lo impreso.
export function impresionesDe(carta) {
  if (!carta?.variants || typeof carta.variants !== 'object') return []
  return variantesDeCarta(carta, []).map((v) => ({ id: v.nuestro, corto: v.corto, nombre: v.nombre }))
}

// Las opciones de cada filtro, sacadas de las cartas que hay. Una opción
// que no filtrara nada sería una promesa falsa; y con una sola opción el
// desplegable sobra (quien lo monta lo esconde si `.length < 2`).
export function opcionesDeFiltros(cartas, precios = new Map()) {
  const rarezas = new Map()
  const tipos = new Set()
  const impresiones = new Map()
  const ilustradores = new Set()
  let conPrecio = 0
  for (const c of cartas || []) {
    const r = rarezaDeCarta(c)
    if (r) rarezas.set(r, rangoDeCarta(c) ?? -1)
    for (const t of c.types || []) tipos.add(t)
    for (const i of impresionesDe(c)) impresiones.set(i.id, i)
    if (typeof c.illustrator === 'string' && c.illustrator.trim()) ilustradores.add(c.illustrator.trim())
    if (precios.get(c.id) > 0) conPrecio++
  }
  return {
    // De más rara a menos: es como se buscan («las ilustración especial»).
    rarezas: [...rarezas.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([r]) => r),
    tipos: [...tipos],
    impresiones: [...impresiones.values()],
    ilustradores: [...ilustradores].sort((a, b) => a.localeCompare(b, 'es')),
    precios: conPrecio ? RANGOS_DE_PRECIO : [],
  }
}

// ¿Pasa esta carta? `f` es lo elegido: { texto, rareza, tipo, impresion,
// ilustrador, precio, soloFaltan }; `ctx` lo que hace falta para contestar:
// { precios: Map id→€, tengo: Set de ids }.
export function cumpleFiltros(carta, f = {}, ctx = {}) {
  if (f.rareza && rarezaDeCarta(carta) !== f.rareza) return false
  if (f.tipo && !(carta.types || []).includes(f.tipo)) return false
  if (f.impresion && !impresionesDe(carta).some((i) => i.id === f.impresion)) return false
  if (f.ilustrador && String(carta.illustrator || '').trim() !== f.ilustrador) return false
  if (f.precio) {
    const rango = RANGOS_DE_PRECIO.find((r) => r.id === f.precio)
    const p = ctx.precios?.get?.(carta.id)
    // Sin precio no se sabe en qué tramo va: fuera de todos, no dentro
    // del más bajo.
    if (!rango || !(p > 0) || p < rango.min || p >= rango.max) return false
  }
  if (f.soloFaltan && ctx.tengo?.has?.(carta.id)) return false
  if (f.texto) {
    const busca = normalizeSearch(`${nombresDeCartaParaBuscar(carta)} ${carta.local_id || ''}`)
    if (!busca.includes(f.texto)) return false
  }
  return true
}

// El número impreso, como se ordena en una colección: por su parte
// numérica y, a igual número, por el texto («TG12» tras «160»).
const numeroDe = (c) => {
  const m = String(c?.local_id || '').match(/\d+/)
  return m ? Number(m[0]) : Number.MAX_SAFE_INTEGER
}
// Los que llevan letras delante («TG12», «SV107») van DETRÁS de los
// numerados a secas: son la galería o el cofre, que la colección imprime
// al final.
const conLetras = (c) => (/^\d/.test(String(c?.local_id || '')) ? 0 : 1)

export function ordenarCartas(cartas, orden = 'numero', ctx = {}) {
  const lista = [...(cartas || [])]
  const precio = (c) => ctx.precios?.get?.(c.id) || 0
  const porNumero = (a, b) => String(a.set_id || '').localeCompare(String(b.set_id || '')) || conLetras(a) - conLetras(b) || numeroDe(a) - numeroDe(b) || String(a.local_id || '').localeCompare(String(b.local_id || ''))
  if (orden === 'precio') return lista.sort((a, b) => precio(b) - precio(a) || porNumero(a, b))
  if (orden === 'rareza') return lista.sort((a, b) => (rangoDeCarta(b) ?? -1) - (rangoDeCarta(a) ?? -1) || porNumero(a, b))
  // El nombre que se enseña es el de `nombreDeCarta` (la regla de la 546):
  // un `name_es || name` a mano se separa de ella sin dar error.
  if (orden === 'nombre') return lista.sort((a, b) => nombreDeCarta(a).localeCompare(nombreDeCarta(b), 'es') || porNumero(a, b))
  return lista.sort(porNumero)
}
