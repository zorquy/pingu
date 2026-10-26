// La sonda de TCGGO de /admin (tanda 929): UNA petición y su respuesta tal
// cual, para ver lo que contesta la API sin adivinar.
//
// Desde el contenedor de Claude la red a TCGGO (y a nuestra base) está
// cerrada y la clave solo está en Netlify, así que la prueba la hace esta
// función y la pide el botón. Es la lección de la 501: un lector se escribe
// contra una respuesta de verdad, no contra una que se le parezca.
//
// Modos (`{ modo, valor }`):
//   · 'carta'      → `/cards/{id}?include_variants=1`. `valor` es el id de
//                    TCGGO o el nuestro (se busca su `tcggo_id`).
//   · 'expansion'  → `/cards?episode_id=…&include_variants=1&per_page=5`.
//   · 'lote'       → `/cards?ids=…` (hasta 20 ids separados por comas).
//   · 'episodios'  → `/episodes?page=1`: el `symbol` de cada expansión.
//   · 'producto'   → `/products/{id}?include_contained_items=1` (1026): lo
//                    que lleva dentro y en qué packs viene, tal cual.
//   · 'versiones'  → ESCRIBE (932): las versiones de una expansión entera,
//                    ahora, sin esperar a la pasada de precios. `valor` es el
//                    id de la expansión de TCGGO o el de un set nuestro. Es
//                    lo que hace la pasada, solo para esa expansión y sin
//                    tocar su estado del día (PINGU, para cerrar lo de
//                    Ascended Heroes en el foro). Una petición por página.
//   · 'duplicados' → SIN pedir nada a TCGGO: las cartas de un set nuestro
//                    (y de los que comparten su expansión de TCGGO) que se
//                    repiten por número, con de dónde sale cada una. Es para
//                    los reportes como el de Black Bolt («Escavalier 60 sale
//                    duplicado»).
// GASTA: una petición por toque (ninguna en 'duplicados').
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY (TCGGO_BASE
// opcional).
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import { baseDe, baseJpDe, cabeceras, urlCarta, urlCartasDeEpisodio, urlCartasPorIds, urlEpisodios, hayMasPaginas, separarVersiones, filasDeVariantes, filaDeLaCarta, sinVersionesRepetidas } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const MAXIMO = 60_000

async function rest(ruta, clave) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, { headers: { apikey: clave, authorization: `Bearer ${clave}` } })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

// Las versiones, como las guarda la pasada de precios: upsert por su id.
async function guardarVersionesRest(filas, clave) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/tcg_card_versions`, {
    method: 'POST',
    headers: { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(filas),
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

export const MAXIMO_PAGINAS_VERSIONES = 15

// Las versiones de una expansión entera (932). Puro salvo lo que se le pasa.
export async function versionesDeExpansion({ episodio, mercado, raiz, host, claveTcggo, fetchImpl, pedir, guardar, ahora = new Date() }) {
  const sets = (await pedir(`tcg_sets?select=id&market=eq.${mercado}&tcggo_id=eq.${episodio}`)) || []
  if (!sets.length) return { error: `Ningún set nuestro del catálogo ${mercado} apunta a la expansión ${episodio} de TCGGO.` }
  const suyas = []
  let peticiones = 0
  for (let pagina = 1; pagina <= MAXIMO_PAGINAS_VERSIONES; pagina++) {
    const res = await fetchImpl(urlCartasDeEpisodio(episodio, pagina, raiz, { versiones: true }), { headers: cabeceras(claveTcggo, host) })
    peticiones++
    const texto = await res.text()
    if (!res.ok) return { error: `TCGGO ${res.status}: ${texto.slice(0, 160)}`, peticiones }
    const datos = JSON.parse(texto)
    suyas.push(...(datos.data || []))
    if (!hayMasPaginas(datos) || !(datos.data || []).length) break
  }
  const { principales } = separarVersiones(suyas)
  // Nuestras cartas, a trozos (la 808: 1.000 filas y sin error).
  const lista = sets.map((s) => `"${encodeURIComponent(s.id)}"`).join(',')
  const nuestras = []
  for (let desde = 0; desde < 20_000; desde += 1000) {
    const trozo = (await pedir(`tcg_cards?select=id,set_id,cm_id_product_propio,tcggo_id&market=eq.${mercado}&set_id=in.(${lista})&order=id&offset=${desde}&limit=1000`)) || []
    nuestras.push(...trozo)
    if (trozo.length < 1000) break
  }
  // Como la pasada: por su id de TCGGO y, si no, por el producto de Cardmarket.
  const porTcggo = new Map(principales.map((s) => [Number(s.id), s]))
  const porCm = new Map(principales.filter((s) => Number(s.cardmarket_id) > 0).map((s) => [Number(s.cardmarket_id), s]))
  const filas = []
  let emparejadas = 0
  for (const c of nuestras) {
    const s = porTcggo.get(Number(c.tcggo_id)) || porCm.get(Number(c.cm_id_product_propio))
    if (!s) continue
    emparejadas++
    filas.push(...filaDeLaCarta(s, c, { ahora, mercado }), ...filasDeVariantes(s, c, { ahora, mercado }))
  }
  const unicas = sinVersionesRepetidas(filas)
  for (let k = 0; k < unicas.length; k += 500) await guardar(unicas.slice(k, k + 500))
  return {
    episodio, sets: sets.map((s) => s.id), peticiones, suyas: principales.length,
    conVersiones: principales.filter((s) => Array.isArray(s.variants) && s.variants.length).length,
    nuestras: nuestras.length, emparejadas, escritas: unicas.length,
  }
}

// Las repetidas por número, de las filas de unas cartas. Puro.
export function repetidasPorNumero(cartas) {
  const por = new Map()
  for (const c of cartas || []) {
    const n = String(c?.local_id ?? '').replace(/^0+(?=\d)/, '').toLowerCase()
    if (!n) continue
    if (!por.has(n)) por.set(n, [])
    por.get(n).push(c)
  }
  return [...por.entries()].filter(([, l]) => l.length > 1).map(([numero, l]) => ({ numero, cartas: l }))
}

export async function sondear({ modo, valor, mercado = 'WEST' }, { env = process.env, fetchImpl = fetch, pedir = null, guardarVersiones = null, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  const base = pedir || ((ruta) => rest(ruta, clave))
  const v = String(valor || '').trim()
  if (modo === 'duplicados') {
    if (!v) return { error: 'Escribe el id de un set nuestro (p. ej. sv10.5b).' }
    const sets = await base(`tcg_sets?select=id,name,market,tcggo_id,origen&market=eq.${mercado}&id=eq.${encodeURIComponent(v)}`)
    const set = sets?.[0]
    if (!set) return { error: `No hay un set ${v} en el catálogo ${mercado}.` }
    const hermanos = set.tcggo_id ? await base(`tcg_sets?select=id,name,origen,oculto,tcggo_id&market=eq.${mercado}&tcggo_id=eq.${set.tcggo_id}`) : [set]
    const ids = [...new Set([set.id, ...(hermanos || []).map((s) => s.id)])]
    const cartas = await base(`tcg_cards?select=id,set_id,local_id,name,origen,tcggo_id,cm_id_product_propio&market=eq.${mercado}&set_id=in.(${ids.map((x) => `"${encodeURIComponent(x)}"`).join(',')})&order=local_id&limit=1000`)
    return { modo, set, sets: hermanos, cartas: cartas?.length || 0, repetidas: repetidasPorNumero(cartas) }
  }
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) return { error: 'Falta TCGGO_API_KEY en Netlify.' }
  const { base: b, host } = baseDe(env)
  const raiz = mercado === 'JP' ? baseJpDe(b) : b
  if (modo === 'versiones') {
    let episodio = /^\d+$/.test(v) ? Number(v) : null
    if (!episodio && v) episodio = Number((await base(`tcg_sets?select=tcggo_id&market=eq.${mercado}&id=eq.${encodeURIComponent(v)}&limit=1`))?.[0]?.tcggo_id) || null
    if (!episodio) return { error: `No sé la expansión de TCGGO de «${v || '(vacío)'}»: escribe su número o el id de un set nuestro emparejado.` }
    const r = await versionesDeExpansion({ episodio, mercado, raiz, host, claveTcggo, fetchImpl, pedir: base, guardar: guardarVersiones || ((f) => guardarVersionesRest(f, clave)), ahora })
    return { modo, ...r }
  }
  let url
  if (modo === 'carta') {
    let id = /^\d+$/.test(v) ? v : ''
    if (!id && v) {
      const filas = await base(`tcg_card_prices?select=tcggo_id&card_id=eq.${encodeURIComponent(v)}&limit=1`)
      id = filas?.[0]?.tcggo_id ? String(filas[0].tcggo_id) : ''
    }
    if (!id) return { error: `No sé el id de TCGGO de ${v || '(vacío)'}: escribe el número de TCGGO.` }
    url = `${urlCarta(id, raiz)}?include_variants=1`
  } else if (modo === 'expansion') {
    if (!/^\d+$/.test(v)) return { error: 'Escribe el id de la expansión de TCGGO (un número).' }
    url = urlCartasDeEpisodio(v, 1, raiz, { versiones: true }).replace(/per_page=\d+/, 'per_page=5')
  } else if (modo === 'lote') {
    const ids = v.split(/[\s,]+/).filter((x) => /^\d+$/.test(x))
    if (!ids.length) return { error: 'Escribe ids de TCGGO separados por comas.' }
    url = urlCartasPorIds(ids, raiz)
  } else if (modo === 'episodios') {
    url = urlEpisodios(1, raiz)
  } else if (modo === 'producto') {
    // 1026: un producto con lo que lleva dentro y en qué viene, tal cual.
    if (!/^\d+$/.test(v)) return { error: 'Escribe el id de TCGGO del producto (un número).' }
    url = `${raiz}/products/${v}?include_contained_items=1`
  } else {
    return { error: `Modo desconocido: ${modo}` }
  }
  const res = await fetchImpl(url, { headers: cabeceras(claveTcggo, host) })
  const texto = await res.text()
  return { modo, url: url.replace(/^https?:\/\/[^/]+/, ''), estado: res.status, cuerpo: texto.slice(0, MAXIMO), recortado: texto.length > MAXIMO }
}

export default async (req) => {
  const json = (e, c) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' })
  if (!(await idDeAdmin(tokenDe(req)))) return json(401, { error: 'No autorizado.' })
  try {
    const cuerpo = await req.json().catch(() => ({}))
    return json(200, await sondear(cuerpo))
  } catch (e) {
    return json(502, { error: String(e?.message || e).slice(0, 300) })
  }
}
