// Nuestro propio emparejamiento con Cardmarket (tanda 587).
//
// TCGdex casa cada carta con un producto de Cardmarket y lo hace mal a lo
// grande (su issue #2325: «lo hizo un script, el catálogo de Cardmarket es
// horrible, lo estamos corrigiendo a mano»). El Groudon-EX de Duelos
// Primigenios (PRC 150, ~200 €) traía el Groudon común (PRC 84, 2 €).
//
// Cardmarket publica cada día dos ficheros abiertos, sin clave:
//
//   · productCatalog/productList/products_singles_6.json — 74.620 productos
//     de Pokémon: `idProduct`, `name` («Groudon EX [Rip Claw | Massive
//     Rend]»: el nombre y, entre corchetes, los ataques), `idExpansion`.
//     NI el número de carta NI el nombre de la expansión.
//   · productCatalog/priceGuide/price_guide_6.json — 79.688 precios:
//     `idProduct`, avg/low/trend/avg1/avg7/avg30 y los mismos «-holo».
//     Es EXACTAMENTE lo que TCGdex nos sirve (el 273615 trae los mismos
//     0,15 / 2,06 / 1,34).
//
// ── CÓMO SE CRUZA SIN NÚMERO ──
//
// Medido sobre el fichero entero: dentro de una expansión los `idProduct`
// van, casi siempre, EN EL ORDEN DE NUMERACIÓN de las cartas (Primal
// Clash: 273532 es la 1, 273615 la 84, 273681 la 150). «Casi»: en 324 de
// 785 expansiones la secuencia es perfecta; en las demás hay tarjetas de
// código delante, cartas añadidas después fuera de sitio, secretas al
// final. Así que no se cruza por posición a pelo: se ALINEAN las dos
// listas —las nuestras por número, las suyas por id— con la subsecuencia
// común más larga de NOMBRES (lo que hace un `diff`). Lo que está en
// orden casa aunque falten o sobren cosas en medio; y dos cartas con el
// mismo nombre y los mismos ataques (Chien-Pao ex normal y su ilustración
// especial) caen cada una en la suya porque el orden las separa. Lo que
// no entra en la alineación se intenta por nombre + ataques, si es único.
//
// Y qué expansión suya es cada set nuestro se decide por los nombres: el
// set cuyos nombres coinciden más con los de una expansión es esa (una
// huella de 150 nombres no se parece a ninguna otra).
//
// Sin red y sin base: recibe listas y devuelve pares. Se prueba en Node
// con los ficheros reales de Cardmarket (pruebas/fixtures/cardmarket-*).
import { normalizeSearch } from '../../js/texto.js'

export const URL_PRODUCTOS = 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json'
export const URL_GUIA = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json'

// Lo que hay en el catálogo y no es una carta.
const NO_ES_CARTA = /^(\d+x )?(Live|Online) Code Card\b/i

export const esCarta = (p) => !!p?.name && !NO_ES_CARTA.test(p.name)

// «Groudon EX [Rip Claw | Massive Rend]» → «Groudon EX»; «Feraligatr
// (Theme Deck)» → «Feraligatr».
export function nombreBase(nombre) {
  return String(nombre || '').replace(/\s*\[.*$/, '').replace(/\s*\([^)]*\)\s*$/, '').trim()
}

// Los ataques entre corchetes, en orden: «[Rip Claw | Massive Rend]».
export function ataquesDe(nombre) {
  const m = String(nombre || '').match(/\[([^\]]*)\]/)
  if (!m) return []
  return m[1].split('|').map((a) => a.trim()).filter(Boolean)
}

// Para comparar: minúsculas, sin tildes, el guion de «Groudon-EX» fuera,
// «Pokémon» = «Pokemon». Nada más: dos nombres que solo se diferencian en
// eso son la misma carta.
export function plegar(texto) {
  return normalizeSearch(String(texto || '').replace(/-/g, ' ')).replace(/\s+/g, ' ').trim()
}

const claveAtaques = (lista) => (lista || []).map(plegar).join('|')

// Lo que se compara de cada lado: nombre plegado y ataques plegados. Dos
// cartas CASAN si el nombre es el mismo y, cuando los dos lados traen
// ataques, los ataques también.
function casan(a, b) {
  if (a.clave !== b.clave) return false
  if (a.ataques && b.ataques) return a.ataques === b.ataques
  return true
}

// Nuestras cartas, preparadas: por número (los numéricos primero, en
// orden; TG01 y compañía después, por texto).
export function prepararNuestras(cartas) {
  return (cartas || [])
    .map((c) => {
      const nombres = Array.isArray(c.attacks) ? c.attacks.map((a) => a?.name).filter(Boolean) : []
      return {
        id: c.id,
        numero: String(c.local_id ?? ''),
        nombre: c.name || '',
        clave: plegar(c.name),
        ataques: nombres.length ? claveAtaques(nombres) : null,
      }
    })
    .sort((a, b) => {
      const na = /^\d+$/.test(a.numero) ? Number(a.numero) : Infinity
      const nb = /^\d+$/.test(b.numero) ? Number(b.numero) : Infinity
      return na - nb || a.numero.localeCompare(b.numero)
    })
}

// Los productos de una expansión, preparados: solo cartas, por id.
export function prepararSuyos(productos) {
  return (productos || [])
    .filter(esCarta)
    .map((p) => {
      const ataques = ataquesDe(p.name)
      return { idProduct: p.idProduct, nombre: nombreBase(p.name), clave: plegar(nombreBase(p.name)), ataques: ataques.length ? claveAtaques(ataques) : null }
    })
    .sort((a, b) => a.idProduct - b.idProduct)
}

// Agrupa el catálogo entero por expansión, ya preparado.
export function porExpansion(productos) {
  const grupos = new Map()
  for (const p of productos || []) {
    if (!grupos.has(p.idExpansion)) grupos.set(p.idExpansion, [])
    grupos.get(p.idExpansion).push(p)
  }
  const fuera = new Map()
  for (const [id, lista] of grupos) fuera.set(id, prepararSuyos(lista))
  return fuera
}

// La subsecuencia común más larga entre las dos listas, con `casan` como
// igualdad. Devuelve pares de índices [i, j] en orden. O(n·m): con ~300
// por lado son 90.000 celdas, nada.
export function alinear(nuestras, suyos) {
  const n = nuestras.length
  const m = suyos.length
  if (!n || !m) return []
  // Tabla de longitudes, de atrás hacia delante.
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = casan(nuestras[i], suyos[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
    }
  }
  const pares = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (casan(nuestras[i], suyos[j])) {
      pares.push([i, j])
      i++
      j++
    } else if (L[i + 1][j] >= L[i][j + 1]) i++
    else j++
  }
  return pares
}

// Empareja las cartas de UN set con los productos de UNA expansión.
//
// Devuelve `pares` (nuestro id → idProduct, y por qué), `sinPar` (las
// nuestras que no han encontrado producto, con el motivo) y cuántos
// productos suyos sobran. `confianza` es la parte de nuestras cartas que
// ha casado por orden: por debajo de la mitad, la expansión probablemente
// no es esta.
export function emparejarSet(cartas, productos) {
  const nuestras = prepararNuestras(cartas)
  const suyos = Array.isArray(productos) && productos.length && 'clave' in productos[0] ? productos : prepararSuyos(productos)
  const pares = []
  const usadosN = new Set()
  const usadosS = new Set()
  for (const [i, j] of alinear(nuestras, suyos)) {
    pares.push({ id: nuestras[i].id, numero: nuestras[i].numero, idProduct: suyos[j].idProduct, por: 'orden' })
    usadosN.add(i)
    usadosS.add(j)
  }
  const porOrden = pares.length
  // Lo que queda, por nombre + ataques si es único en los dos lados; si
  // no, por nombre a secas si es único en los dos lados.
  const restoN = nuestras.map((c, i) => [c, i]).filter(([, i]) => !usadosN.has(i))
  const restoS = suyos.map((p, j) => [p, j]).filter(([, j]) => !usadosS.has(j))
  const sinPar = []
  for (const [c, i] of restoN) {
    const conAtaques = c.ataques ? restoS.filter(([p, j]) => !usadosS.has(j) && p.clave === c.clave && p.ataques === c.ataques) : []
    const mismosN = c.ataques ? restoN.filter(([x, k]) => !usadosN.has(k) && x.clave === c.clave && x.ataques === c.ataques) : []
    if (conAtaques.length === 1 && mismosN.length === 1) {
      pares.push({ id: c.id, numero: c.numero, idProduct: conAtaques[0][0].idProduct, por: 'nombre+ataques' })
      usadosN.add(i)
      usadosS.add(conAtaques[0][1])
      continue
    }
    const porNombre = restoS.filter(([p, j]) => !usadosS.has(j) && p.clave === c.clave)
    const mismosNombre = restoN.filter(([x, k]) => !usadosN.has(k) && x.clave === c.clave)
    if (porNombre.length === 1 && mismosNombre.length === 1) {
      pares.push({ id: c.id, numero: c.numero, idProduct: porNombre[0][0].idProduct, por: 'nombre' })
      usadosN.add(i)
      usadosS.add(porNombre[0][1])
      continue
    }
    sinPar.push({ id: c.id, numero: c.numero, nombre: c.nombre, porque: porNombre.length ? `${porNombre.length} productos con ese nombre y ${mismosNombre.length} cartas nuestras: no se puede elegir` : 'ningún producto con ese nombre' })
  }
  pares.sort((a, b) => (/^\d+$/.test(a.numero) && /^\d+$/.test(b.numero) ? Number(a.numero) - Number(b.numero) : a.numero.localeCompare(b.numero)))
  return {
    pares,
    sinPar,
    sobran: suyos.length - usadosS.size,
    confianza: nuestras.length ? porOrden / nuestras.length : 0,
  }
}

// Qué expansión suya es un set nuestro: la que más nombres comparte. Se
// devuelven las mejores con su puntuación, y `elegida` solo si la primera
// se lleva claramente de la segunda — dos expansiones con la mitad de los
// nombres en común (una reimpresión, una colección especial) no se pueden
// distinguir por nombres, y entonces no se elige: mejor sin pareja que
// con la equivocada.
export function expansionDeSet(cartas, expansiones, { minimo = 0.5, ventaja = 0.15 } = {}) {
  const nuestras = new Set(prepararNuestras(cartas).map((c) => c.clave).filter(Boolean))
  if (!nuestras.size) return { elegida: null, candidatas: [] }
  const candidatas = []
  for (const [idExpansion, suyos] of expansiones) {
    const suyas = new Set(suyos.map((p) => p.clave))
    let comunes = 0
    for (const k of nuestras) if (suyas.has(k)) comunes++
    const puntos = comunes / nuestras.size
    if (puntos > 0) candidatas.push({ idExpansion, puntos: Math.round(puntos * 1000) / 1000, comunes, suyas: suyos.length })
  }
  candidatas.sort((a, b) => b.puntos - a.puntos || Math.abs(a.suyas - nuestras.size) - Math.abs(b.suyas - nuestras.size))
  const [a, b] = candidatas
  const elegida = a && a.puntos >= minimo && (!b || a.puntos - b.puntos >= ventaja) ? a.idExpansion : null
  return { elegida, candidatas: candidatas.slice(0, 3) }
}

// De una entrada de la guía a nuestra fila de `tcg_card_prices` (las
// mismas columnas que `filaDePrecio` de js/cardmarket.js saca de TCGdex,
// porque es el mismo dato).
export function filaDeGuia(cardId, idProduct, entrada, { creada = null, ahora = new Date() } = {}) {
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
  return {
    card_id: cardId,
    cm_id_product: idProduct,
    cm_low: n(entrada?.low),
    cm_trend: n(entrada?.trend),
    cm_avg30: n(entrada?.avg30),
    cm_avg7: n(entrada?.avg7),
    cm_low_holo: n(entrada?.['low-holo']),
    cm_trend_holo: n(entrada?.['trend-holo']),
    cm_avg30_holo: n(entrada?.['avg30-holo']),
    cm_updated: creada ? new Date(creada).toISOString() : ahora.toISOString(),
    origen: 'cardmarket-guia',
    checked_at: ahora.toISOString(),
  }
}
