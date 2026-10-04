// pokemontcg.io como SEGUNDA fuente de precios de Cardmarket (tanda 585).
//
// PINGU: «hay muchas cartas que no vienen con precio. Y creo que es
// porque no estamos linkando bien la carta exacta con la carta de
// Cardmarket». Las dos cosas son la misma: el precio y el enlace exacto
// salen hoy de `pricing.cardmarket` de TCGdex, y cuando TCGdex no lo
// trae de una carta —le pasa a muchas de antes de Sol y Luna, como el
// Groudon EX de Duelos Primigenios— nos quedamos sin precio Y el botón
// cae a una búsqueda por nombre («133 resultados» para una carta).
//
// pokemontcg.io publica, por carta, los precios de Cardmarket en EUROS
// (`cardmarket.prices`: trend, low, avg1/7/30 y los del reverso) y la
// URL EXACTA del producto (`cardmarket.url`, que redirige a la ficha de
// Cardmarket). Es gratis, con límite diario (más con clave:
// POKEMONTCG_API_KEY, opcional).
//
// ── POR QUÉ SE BUSCA POR CÓDIGO DE SET Y NÚMERO, Y NO POR ID ──
//
// Sus identificadores se parecen a los nuestros pero no son los nuestros:
// nuestro `sv03.5-1` (151) es su `sv3pt5-1`, nuestro `swsh3.5` es su
// `swsh35`, nuestro `me01` es su `me1`. Se puede traducir casi siempre
// (`idParaPokemontcg`), pero «casi» es la trampa de la 505: un id mal
// traducido contesta 404 y la carta se queda sin precio sin que nada
// avise. El código de TCG Live (nuestro `tcg_online_code`, su
// `set.ptcgoCode`) y el número impreso son los mismos en los dos lados,
// así que esa es la llave PRIMERA; el id traducido, el respaldo para los
// sets que no tienen código.
//
// ── LO QUE NO SE HA VISTO, NO SE AFIRMA ──
//
// Desde este contenedor no se puede preguntar a pokemontcg.io, así que la
// forma de su respuesta sale de su documentación y no de una respuesta
// pegada byte a byte (la norma de la 501 pide lo segundo). Por eso cada
// lectura es defensiva y lo que no cuadre se apunta como fallo con su
// texto, para que /admin lo enseñe y se corrija con una respuesta real.
//
// Sin dependencias: se prueba en Node.

export const BASE = 'https://api.pokemontcg.io/v2'

// `sv03.5-1` → `sv3pt5-1`; `swsh3.5-1` → `swsh35-1`; `me01-5` → `me1-5`.
// Lo que no lleva ceros ni punto se queda igual (`xy5-150`, `base1-4`).
export function idParaPokemontcg(id) {
  const [set, ...resto] = String(id || '').split('-')
  const numero = resto.join('-')
  const m = set.match(/^([a-z]+)(\d+)(\.5)?([a-z]*)$/i)
  if (!m) return id
  const [, serie, digitos, medio, cola] = m
  const n = String(Number(digitos))
  // Escarlata y Púrpura y Cénit Supremo escriben «pt5»; los demás «5».
  const mitad = medio ? (serie.toLowerCase() === 'sv' || n === '12' ? 'pt5' : '5') : ''
  return `${serie}${n}${mitad}${cola}${numero ? `-${numero}` : ''}`
}

// El número tal como lo guarda pokemontcg.io: sin ceros de delante si es
// solo dígitos («025» → «25»); con letras, tal cual («TG01», «SV001»).
export function numeroParaPokemontcg(n) {
  const s = String(n ?? '').trim()
  return /^\d+$/.test(s) ? String(Number(s)) : s
}

const comparable = (n) => String(n ?? '').trim().toLowerCase().replace(/\d+/g, (d) => String(Number(d)))

export function urlPorCodigo(codigo, numero) {
  const q = `set.ptcgoCode:${codigo} number:${numeroParaPokemontcg(numero)}`
  return `${BASE}/cards?q=${encodeURIComponent(q)}&select=id,name,number,cardmarket&pageSize=10`
}

export function urlPorId(id) {
  return `${BASE}/cards/${encodeURIComponent(idParaPokemontcg(id))}?select=id,name,number,cardmarket`
}

// `updatedAt` viene «2024/03/15»; la base quiere ISO.
export function fechaDe(texto) {
  const m = String(texto || '').match(/^(\d{4})[/-](\d{2})[/-](\d{2})/)
  return m ? `${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z` : null
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)

// De su bloque `cardmarket` a nuestra fila de `tcg_card_prices`. Si no
// trae ni cifras ni URL, null: una fila vacía no es un precio.
export function filaDePokemontcg(cardId, cardmarket, ahora = new Date()) {
  const p = cardmarket?.prices || {}
  const fila = {
    card_id: cardId,
    cm_url: typeof cardmarket?.url === 'string' && /^https?:\/\//.test(cardmarket.url) ? cardmarket.url : null,
    cm_low: num(p.lowPrice),
    cm_trend: num(p.trendPrice),
    cm_avg30: num(p.avg30),
    cm_avg7: num(p.avg7),
    cm_low_holo: num(p.reverseHoloLow),
    cm_trend_holo: num(p.reverseHoloTrend),
    cm_avg30_holo: num(p.reverseHoloAvg30),
    cm_updated: fechaDe(cardmarket?.updatedAt),
    origen: 'pokemontcg',
    checked_at: ahora.toISOString(),
  }
  const hay = fila.cm_url || fila.cm_low || fila.cm_trend || fila.cm_avg30
  return hay ? fila : null
}

// De una lista de resultados (la búsqueda por código), el que tiene
// NUESTRO número: la consulta ya filtra, pero «25» y «025» o un número
// con letras podrían traer vecinos.
export function elegirPorNumero(resultados, numero) {
  const quiero = comparable(numero)
  return (resultados || []).find((c) => comparable(c?.number) === quiero) || null
}

// Pide a pokemontcg.io el precio de UNA carta: por código y número si
// hay código; si no (o si no sale nada), por id traducido. Devuelve la
// fila, `null` si no está, y lanza si la API falla (429, 5xx): quien
// llama decide si para la pasada.
export async function precioDePokemontcg({ id, numero, codigo }, { fetchImpl = fetch, clave = null, ahora = () => new Date() } = {}) {
  const cabeceras = { accept: 'application/json', ...(clave ? { 'X-Api-Key': clave } : {}) }
  const pedir = async (url) => {
    const res = await fetchImpl(url, { headers: cabeceras })
    if (res.status === 404) return null
    if (!res.ok) {
      const e = new Error(`pokemontcg ${res.status}`)
      e.status = res.status
      throw e
    }
    return res.json()
  }
  if (codigo && numero) {
    const r = await pedir(urlPorCodigo(codigo, numero))
    const carta = elegirPorNumero(r?.data, numero)
    if (carta) return filaDePokemontcg(id, carta.cardmarket, ahora())
  }
  const r = await pedir(urlPorId(id))
  const carta = r?.data
  return carta ? filaDePokemontcg(id, carta.cardmarket, ahora()) : null
}
