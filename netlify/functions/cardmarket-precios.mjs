// Los precios de Cardmarket, desde SU guía diaria (tanda 587).
//
// Cardmarket publica cada día `price_guide_6.json` (79.688 productos de
// Pokémon con tendencia, mínimo y medias): un fichero, todas las cartas.
// Para cada carta nuestra con par propio (`tcg_cards.cm_id_product_propio`,
// el que decide `cardmarket-emparejar`) se coge su entrada y se guarda en
// `tcg_card_prices` — las mismas columnas que llenaba TCGdex, con el
// producto BUENO.
//
// ── UNA VEZ AL DÍA, EN VARIAS PASADAS ──
//
// Cada hora se mira si la guía de hoy ya está hecha; si no, se baja el
// fichero (15 MB, ~2 s) y se escriben las cartas por tandas de mil hasta
// agotar el presupuesto de tiempo, apuntando en `scrydex_estado` por dónde
// va (`cardmarket_guia`: { dia, desde, hecho }). La pasada siguiente sigue
// desde ahí. Cuando acaba, marca el día y no vuelve a bajar nada hasta
// mañana: el fichero cambia una vez al día.
//
// No gasta créditos de nada: es un fichero público y nuestra base.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY.
import { URL_GUIA, filaDeGuia } from '../lib/cardmarket-catalogo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'cardmarket_guia'
const PRESUPUESTO_MS = 20_000
const POR_PAGINA = 1000

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
      ...(opciones?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

export const hoyUTC = () => new Date().toISOString().slice(0, 10)

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  reloj = () => Date.now(), hoy = hoyUTC(), mercado = 'WEST', guia = null,
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < PRESUPUESTO_MS
  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const guardar = guardarImpl || ((filas) => rest('tcg_card_prices', clave, { method: 'POST', body: JSON.stringify(filas) }))
  const leerEstado = estadoImpl || (async () => (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]) }))

  let estado
  try {
    estado = await leerEstado()
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  if (estado?.dia === hoy && estado?.hecho) return { ok: true, saltado: `la guía de ${hoy} ya está puesta`, dia: hoy }
  let desde = estado?.dia === hoy ? Number(estado.desde) || 0 : 0

  // La guía, entera, en un mapa por idProduct.
  let entradas = guia
  let creada = null
  if (!entradas) {
    const res = await fetchImpl(URL_GUIA, { headers: { accept: 'application/json' } })
    if (!res.ok) return { ok: false, error: `Cardmarket ${res.status} al bajar la guía de precios` }
    const j = await res.json()
    entradas = Array.isArray(j?.priceGuides) ? j.priceGuides : null
    creada = j?.createdAt || null
    if (!entradas) return { ok: false, error: 'La guía de Cardmarket no trae `priceGuides`' }
  }
  const porProducto = new Map(entradas.map((e) => [e.idProduct, e]))

  let escritas = 0
  let sinEntrada = 0
  let paginas = 0
  while (quedaTiempo()) {
    let cartas
    try {
      cartas = await pedir(`tcg_cards?select=id,cm_id_product_propio&market=eq.${mercado}&cm_id_product_propio=not.is.null&order=id&limit=${POR_PAGINA}&offset=${desde}`)
    } catch (e) {
      const m = String(e?.message || e)
      if (/cm_id_product_propio|42703/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-cardmarket-propio.sql' }
      return { ok: false, error: m.slice(0, 200), desde }
    }
    paginas++
    if (!cartas?.length) {
      await guardarEstado({ dia: hoy, desde, hecho: true, escritas: (estado?.dia === hoy ? Number(estado.escritas) || 0 : 0) + escritas })
      return { ok: true, dia: hoy, hecho: true, escritas, sinEntrada, paginas }
    }
    const filas = []
    for (const c of cartas) {
      const e = porProducto.get(c.cm_id_product_propio)
      if (!e) {
        sinEntrada++
        continue
      }
      filas.push(filaDeGuia(c.id, c.cm_id_product_propio, e, { creada }))
    }
    if (filas.length) {
      try {
        await guardar(filas)
      } catch (e) {
        return { ok: false, error: String(e?.message || e).slice(0, 200), desde }
      }
      escritas += filas.length
    }
    desde += cartas.length
    await guardarEstado({ dia: hoy, desde, hecho: false, escritas: (estado?.dia === hoy ? Number(estado.escritas) || 0 : 0) + escritas })
    if (cartas.length < POR_PAGINA) {
      await guardarEstado({ dia: hoy, desde, hecho: true, escritas: (estado?.dia === hoy ? Number(estado.escritas) || 0 : 0) + escritas })
      return { ok: true, dia: hoy, hecho: true, escritas, sinEntrada, paginas }
    }
  }
  return { ok: true, dia: hoy, hecho: false, escritas, sinEntrada, paginas, desde, nota: 'sin tiempo: sigue en la próxima pasada' }
}

export default async function handler() {
  const r = await procesar()
  if (!r.ok) console.warn('cardmarket-precios:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada hora, a y 23: la guía cambia una vez al día y una pasada que ya la
// tiene puesta se sale en una consulta. No gasta nada.
export const config = { schedule: '23 * * * *' }
