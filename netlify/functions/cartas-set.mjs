// Las cartas y las versiones de un set, servidas desde la CDN (tanda 978,
// propuesta «Que cargue al momento»).
//
// POR QUÉ. Abrir una expansión en /mi-coleccion o /cartas pedía a Supabase
// sus cartas y sus versiones: dos consultas iguales para todo el mundo, que
// cambian cuando escribe una pasada del catálogo o alguien corrige algo en
// /admin. Como la estantería (813), la CDN de Netlify guarda una respuesta
// por set y la sirve cerca de quien la pide.
//
// Se llama a pelo (`/.netlify/functions/cartas-set?market=WEST&sets=sm11,sm11tg`)
// y no detrás de una reescritura: una reescritura no le pasa la consulta a una
// función v2 (la 633). Quien la llama tiene su respaldo directo a Supabase.
//
// Solo lee filas públicas, con la clave publicable (la de js/supabase.js).
// Lleva la MISMA etiqueta que la estantería: lo que /admin tira al guardar
// (`sets-purgar`, que ya llama Colecciones y desde la 978 el editor de cartas)
// tira las dos.
import { MERCADOS } from '../../js/mercados.js'
import { COLUMNAS_CARTA_DE_SET, COLUMNAS_VERSION, COLUMNAS_A_MANO, faltanColumnasAMano, esIdDeSet } from '../../js/mi-coleccion/columnas-set.js'
import { CABECERAS } from './sets.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

// Una expansión plegada son pocos sets (el 30 aniversario, dos; Hidden Fates
// con su Shiny Vault, dos). Más de ocho no es una expansión: es otra cosa.
export const MAX_SETS = 8
const TROZO = 1000
let sinColumnasAMano = false

export function pedidoDe(url) {
  const u = new URL(url)
  const mercado = String(u.searchParams.get('market') || '').trim()
  const sets = [...new Set(String(u.searchParams.get('sets') || '').split(',').map((x) => x.trim()).filter(Boolean))]
  if (!Object.prototype.hasOwnProperty.call(MERCADOS, mercado)) return null
  if (!sets.length || sets.length > MAX_SETS || !sets.every(esIdDeSet)) return null
  return { mercado, sets }
}

const enLista = (ids) => ids.map((id) => `"${id}"`).join(',')

async function pedir(ruta, fetchImpl) {
  const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) {
    const texto = await res.text().catch(() => '')
    const e = new Error(`supabase ${res.status}`)
    e.texto = texto
    throw e
  }
  return res.json()
}

export async function leerCartasDeSets({ mercado, sets }, { fetchImpl = fetch } = {}) {
  // Un set no pasa de mil cartas; varios se piden a la vez, uno por petición,
  // para que ninguno roce el corte de Supabase (la 808).
  const porSet = await Promise.all(sets.map((id) =>
    pedir(`tcg_cards?select=${COLUMNAS_CARTA_DE_SET}&market=eq.${mercado}&set_id=eq.${encodeURIComponent(id)}&limit=${TROZO}`, fetchImpl)))
  const versiones = []
  for (let desde = 0; desde < 20 * TROZO; desde += TROZO) {
    const columnas = sinColumnasAMano ? COLUMNAS_VERSION : COLUMNAS_VERSION + COLUMNAS_A_MANO
    let trozo
    try {
      trozo = await pedir(`tcg_card_versions?select=${columnas}&market=eq.${mercado}&set_id=in.(${encodeURIComponent(enLista(sets))})&order=tcggo_id.asc&offset=${desde}&limit=${TROZO}`, fetchImpl)
    } catch (e) {
      if (!sinColumnasAMano && faltanColumnasAMano(e.texto)) { sinColumnasAMano = true; desde -= TROZO; continue }
      // Sin la tabla de versiones (la migración de la 807 sin ejecutar), sin
      // versiones: es lo mismo que hace la web.
      break
    }
    versiones.push(...trozo)
    if (trozo.length < TROZO) break
  }
  return { cartas: porSet.flat(), versiones }
}

export async function responder(req, { fetchImpl = fetch } = {}) {
  const pedido = pedidoDe(req.url)
  if (!pedido) return new Response(JSON.stringify({ error: 'market o sets' }), { status: 400, headers: { 'content-type': 'application/json' } })
  try {
    const r = await leerCartasDeSets(pedido, { fetchImpl })
    return new Response(JSON.stringify({ ...r, generado: new Date().toISOString() }), { status: 200, headers: CABECERAS })
  } catch (e) {
    // Un fallo NO se guarda en la CDN: la siguiente petición lo vuelve a intentar.
    return new Response(JSON.stringify({ error: String(e?.message || e).slice(0, 160) }), { status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
  }
}

export default (req) => responder(req)
