// El precio por idioma de las versiones de UNA carta, a demanda (tanda 1028).
//
// GET /.netlify/functions/tcggo-versiones-ahora?card=<id>&market=WEST|JP.
// Devuelve las filas de `tcg_card_versions` de esa carta. Si alguna de sus
// versiones de TCGGO no se ha pedido HOY, se piden todas de una vez (UNA
// petición: `/cards?ids=…`, hasta 20) y se guardan sus precios por idioma y
// su id de producto de Cardmarket, para que la ficha enseñe «ES 25,00 €» y
// su enlace lleve a esa versión en Cardmarket con los filtros puestos.
//
// Por qué existe: la pasada de precios trae cada versión con UN precio (el
// mínimo de todos los idiomas juntos) y la de versiones por idioma (929)
// solo pide las versiones que alguien tiene APUNTADAS. La Reverse del Lugia
// de Darkness Ablaze no la tenía nadie apuntada, así que su fila decía
// «0,10 €, cualquier idioma» mientras TCGGO tenía el español a 25 € (el
// único anuncio en Cardmarket), y el enlace iba a una búsqueda por nombre.
// Es el patrón del histórico (643): se pide la primera vez que alguien abre
// la ficha, con su freno, y después lo mantiene la pasada de cada día.
//
// Es pública (es el precio de una carta, no de nadie) y lleva su freno: un
// tope diario de peticiones (`TCGGO_TOPE_VERSIONES_AHORA`, 1.500 de serie) y
// una vez al día por versión, apuntados en `scrydex_estado` →
// `tcggo_versiones_ahora`. Pasado el tope se sirve lo que haya.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_VERSIONES_AHORA.
import { cabeceras, baseDe, baseJpDe, urlCartasPorIds, POR_LOTE_DE_IDS, filaDeIdiomasDeVersion, esLimiteDelPlan } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_versiones_ahora'
export const TOPE_DIARIO = 1500
const ID_VALIDO = /^[a-z0-9][a-z0-9._-]{0,60}$/i
export const COLUMNAS = 'tcggo_id,market,card_id,set_id,etiqueta,origen,cm_id_product,link_cm,cm_low,cm_low_en,cm_low_de,cm_low_fr,cm_low_es,cm_low_it,cm_low_ja,cm_avg7,cm_avg30,cm_disponibles,tp_market_eur,tp_mid_eur,actualizado_at'

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json', prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

// Las versiones de TCGGO de la carta: las que tienen su id (las a mano y las
// ediciones de Wizards no se pueden pedir).
export const versionesDeTcggo = (filas) => (filas || []).filter((f) => Number.isInteger(Number(f?.tcggo_id)) && Number(f.tcggo_id) > 0 && !['mano', 'edicion', 'tcgdex'].includes(f.origen || ''))

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  ahora = new Date(), cardId = '', market = 'WEST',
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  if (!ID_VALIDO.test(String(cardId || ''))) return { estado: 400, cuerpo: { error: 'Falta el id de la carta.' } }
  const mercado = market === 'JP' ? 'JP' : 'WEST'
  const pedir = restImpl || ((ruta, o) => rest(ruta, clave, o))
  const guardar = guardarImpl || ((filas) => rest('tcg_card_versions', clave, { method: 'POST', body: JSON.stringify(filas) }))
  const leerEstado = estadoImpl || (async () => (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]) }))
  const id = encodeURIComponent(cardId)
  const leerFilas = () => pedir(`tcg_card_versions?select=${COLUMNAS}&card_id=eq.${id}&market=eq.${mercado}&order=tcggo_id&limit=100`)

  let filas
  try {
    filas = (await leerFilas()) || []
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|tcg_card_versions/.test(m)) return { estado: 200, cuerpo: { filas: [], nota: 'falta la migración de las versiones (807)' } }
    return { estado: 502, cuerpo: { error: m.slice(0, 200) } }
  }
  const suyas = versionesDeTcggo(filas)
  if (!suyas.length) return { estado: 200, cuerpo: { filas, pedido: false, porque: 'sin versiones de TCGGO' } }
  if (!env.TCGGO_API_KEY) return { estado: 200, cuerpo: { filas, pedido: false, porque: 'sin clave de TCGGO' } }

  // ── El freno: una vez al día por versión, y el tope diario ──
  const dia = ahora.toISOString().slice(0, 10)
  let estado
  try { estado = await leerEstado() } catch { estado = {} }
  estado = estado && typeof estado === 'object' ? estado : {}
  if (estado.dia !== dia) estado = { dia, peticiones: 0, hechas: [] }
  if (!Array.isArray(estado.hechas)) estado.hechas = []
  // Los frenos de TODO el día van antes que el de esta carta: el motivo que
  // se cuenta es el que de verdad impide pedir.
  if (estado.planBloqueado === dia) return { estado: 200, cuerpo: { filas, pedido: false, porque: 'el plan de TCGGO no da más por hoy' } }
  const tope = Math.max(1, Number(env.TCGGO_TOPE_VERSIONES_AHORA) || TOPE_DIARIO)
  if (estado.peticiones >= tope) return { estado: 200, cuerpo: { filas, pedido: false, porque: `tope diario (${tope}) alcanzado` } }
  const hechas = new Set(estado.hechas.map(Number))
  const ids = suyas.map((f) => Number(f.tcggo_id)).filter((x) => !hechas.has(x)).slice(0, POR_LOTE_DE_IDS)
  if (!ids.length) return { estado: 200, cuerpo: { filas, pedido: false, porque: 'pedidas hoy' } }
  estado.peticiones++
  // Se apuntan ANTES de pedir (la 665: lo que se dispara se apaga antes):
  // una respuesta rara no puede volver a gastar cada vez que se abre la ficha.
  estado.hechas.push(...ids)
  if (estado.hechas.length > 20000) estado.hechas = estado.hechas.slice(-20000)
  try { await guardarEstado(estado) } catch { /* el contador es un freno, no un dato */ }

  const { base, host } = baseDe(env)
  const res = await fetchImpl(urlCartasPorIds(ids, mercado === 'JP' ? baseJpDe(base) : base), { headers: cabeceras(env.TCGGO_API_KEY, host) })
  const texto = await res.text()
  if (!res.ok) {
    if (esLimiteDelPlan(res.status, texto)) {
      estado.planBloqueado = dia
      try { await guardarEstado(estado) } catch { /* igual */ }
      return { estado: 200, cuerpo: { filas, pedido: true, porque: 'el plan de TCGGO no da más por hoy' } }
    }
    return { estado: 200, cuerpo: { filas, pedido: true, porque: `TCGGO ${res.status}` } }
  }
  let cartas
  try { cartas = JSON.parse(texto)?.data } catch { cartas = null }
  if (!Array.isArray(cartas)) return { estado: 200, cuerpo: { filas, pedido: true, porque: 'TCGGO ha contestado algo que no es JSON' } }
  const nuevas = []
  for (const c of cartas) {
    if (!ids.includes(Number(c?.id))) continue
    nuevas.push(filaDeIdiomasDeVersion(c, { cardId, market: mercado, ahora }))
  }
  try {
    if (nuevas.length) await guardar(nuevas)
  } catch (e) {
    return { estado: 200, cuerpo: { filas, pedido: true, porque: `nuestra base: ${String(e?.message || e).slice(0, 120)}` } }
  }
  // Lo guardado, tal como queda (con la etiqueta y lo demás que no se tocó).
  try { filas = (await leerFilas()) || filas } catch { /* se sirve lo de antes */ }
  return { estado: 200, cuerpo: { filas, pedido: true, nuevas: nuevas.length } }
}

export default async (req) => {
  const json = (e, c) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'GET') return json(405, { error: 'Método no permitido.' })
  const url = new URL(req.url)
  try {
    const r = await procesar({ cardId: url.searchParams.get('card') || '', market: url.searchParams.get('market') || 'WEST' })
    return json(r.estado, r.cuerpo)
  } catch (e) {
    return json(502, { error: String(e?.message || e).slice(0, 300) })
  }
}
