// Buscar una carta en el catálogo de Cardmarket (tanda 1159).
//
// PINGU: «en /admin hay un campo que pone Id de producto en Cardmarket.
// ¿De dónde saco yo el id? Yo tengo el enlace». El enlace de una carta en
// Cardmarket no lleva el número; está en la dirección de su foto o en el
// código de la página. Para no ir a buscarlo a mano carta a carta (las 18
// del pack de McDonald's), /admin lo busca en el catálogo abierto que
// Cardmarket publica cada día:
//
//   productCatalog/productList/products_singles_6.json — ~75.000 cartas de
//   Pokémon con `idProduct`, `name` («Charmander [Ember]»: el nombre y,
//   entre corchetes, los ataques) e `idExpansion`. NI el número NI el
//   nombre de la expansión (lo midió la 587).
//
// Sin el nombre de la expansión, «Charmander» son cientos de resultados
// que no se distinguen. Dos cosas ayudan a elegir: cada resultado lleva su
// precio de la guía diaria y el enlace a SU página (`?idProduct=N`, que
// Cardmarket redirige a la carta), y las cartas de la misma expansión de
// Cardmarket que las HERMANAS del set (las que ya tienen su id) salen
// primero. Con el primer id puesto a mano, las otras 17 caen arriba solas.
//
// Lo puro vive aquí (se prueba con trozos reales de los dos ficheros); la
// función solo descarga y contesta.
import { normalizeSearch } from '../../js/texto.js'

export const URL_PRODUCTOS = 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json'
export const TOPE = 60

// Lo que hay en el catálogo y no es una carta.
const NO_ES_CARTA = /^(\d+x )?(Live|Online) Code Card\b/i
export const esCarta = (p) => !!p?.name && !NO_ES_CARTA.test(p.name)

// «Groudon EX [Rip Claw | Massive Rend]» → «Groudon EX»; «Feraligatr
// (Theme Deck)» → «Feraligatr».
export function nombreBase(nombre) {
  return String(nombre || '').replace(/\s*\[.*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
}

// Los ataques entre corchetes, en orden.
export function ataquesDe(nombre) {
  const m = String(nombre || '').match(/\[([^\]]*)\]/)
  if (!m) return []
  return m[1].split('|').map((a) => a.trim()).filter(Boolean)
}

// Para comparar: minúsculas, sin tildes, «Pokémon» = «Pokemon», el guion
// y el apóstrofo fuera («Team Rocket's» = «team rockets»).
export function plegar(texto) {
  return normalizeSearch(String(texto || '').replace(/[-'’.]/g, (c) => (c === '-' ? ' ' : ''))).replace(/\s+/g, ' ').trim()
}

// El enlace a la página de una carta por su id (el mismo que usa la web,
// js/productos.js): Cardmarket lo redirige a la carta.
export const enlaceDeProducto = (id) => `https://www.cardmarket.com/es/Pokemon/Products?idProduct=${id}`

// Lo que cuesta, de la entrada de la guía: el mínimo y la tendencia, y los
// de la holo si los hay. Un 0 de Cardmarket es «no hay», no gratis.
export function precioDeGuia(e) {
  if (!e) return null
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
  const p = { low: n(e.low), trend: n(e.trend), lowHolo: n(e['low-holo']), trendHolo: n(e['trend-holo']) }
  return Object.values(p).some((v) => v != null) ? p : null
}

// La búsqueda. `cerca`: ids de producto de las hermanas del set (las que ya
// tienen el suyo); sus expansiones de Cardmarket mandan delante.
export function buscar(productos, consulta, { cerca = [], guia = null, tope = TOPE } = {}) {
  const q = plegar(consulta)
  const terminos = q.split(' ').filter(Boolean)
  if (!terminos.length) return { total: 0, resultados: [], expansionesCerca: [] }
  const lista = Array.isArray(productos) ? productos : []
  const porId = new Map(lista.map((p) => [Number(p.idProduct), p]))
  const expCerca = new Set(cerca.map((id) => porId.get(Number(id))?.idExpansion).filter((x) => x != null))

  // Un número suelto en la consulta es un id: «903676» lo encuentra tal
  // cual (para comprobar uno que ya está puesto).
  const comoId = /^\d+$/.test(q) ? porId.get(Number(q)) : null
  const casan = []
  for (const p of lista) {
    if (!esCarta(p)) continue
    const base = plegar(nombreBase(p.name))
    const todo = plegar(p.name)
    if (p === comoId || terminos.every((t) => todo.includes(t))) {
      const misma = expCerca.has(p.idExpansion)
      const puntos = (p === comoId ? 100 : 0) + (misma ? 20 : 0) + (base === q ? 4 : base.startsWith(q) ? 2 : 0) + (terminos.every((t) => base.includes(t)) ? 1 : 0)
      casan.push({ p, puntos, misma })
    }
  }
  casan.sort((a, b) => b.puntos - a.puntos || Number(a.p.idExpansion) - Number(b.p.idExpansion) || Number(a.p.idProduct) - Number(b.p.idProduct))
  const resultados = casan.slice(0, tope).map(({ p, misma }) => ({
    idProduct: Number(p.idProduct),
    nombre: nombreBase(p.name),
    ataques: ataquesDe(p.name),
    idExpansion: p.idExpansion ?? null,
    misma,
    precio: precioDeGuia(guia?.get?.(Number(p.idProduct))),
    enlace: enlaceDeProducto(Number(p.idProduct)),
  }))
  return { total: casan.length, resultados, expansionesCerca: [...expCerca] }
}

// La guía, de lista a mapa por id.
export function mapaDeGuia(entradas) {
  const m = new Map()
  for (const e of Array.isArray(entradas) ? entradas : []) if (e?.idProduct != null) m.set(Number(e.idProduct), e)
  return m
}
