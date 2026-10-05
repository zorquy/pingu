// El histórico de precios de una carta, a demanda (tanda 643).
//
// GET /.netlify/functions/tcggo-historial?card=<id>. Devuelve las filas de
// `tcg_card_history` de esa carta (una por día: mínimo de Cardmarket por
// idioma y TCGplayer en euros). Si a la carta no se le ha pedido su
// histórico a TCGGO en la última semana —o nunca—, se le pide ahora (UNA
// petición: hasta 30 fechas) y se guarda, para que la gráfica no empiece
// vacía el primer día. La foto diaria de `tcggo-precios` la va alargando
// después sin gastar nada.
//
// Es pública (es el precio de una carta, no de nadie) y por eso lleva su
// propio freno: un tope diario de peticiones a TCGGO (`TCGGO_TOPE_HISTORIAL`,
// 1.500 de serie) apuntado en `scrydex_estado` → `tcggo_historial`. Pasado
// el tope se sirve lo que haya y no se pide nada: un rastreador abriendo
// 23.000 fichas no puede gastar el plan.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_HISTORIAL.
import { cabeceras, baseDe, urlHistorial, filasDeHistorial, esLimiteDelPlan } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_historial'
export const TOPE_DIARIO = 1500
const DIAS_DE_FRESCURA = 7
const ID_VALIDO = /^[a-z0-9][a-z0-9._-]{0,60}$/i

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json' } : {}),
      ...(opciones && !ruta.startsWith('rpc/') ? { prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
      ...(opciones?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  ahora = new Date(), cardId = '',
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  if (!ID_VALIDO.test(String(cardId || ''))) return { estado: 400, cuerpo: { error: 'Falta el id de la carta.' } }
  const pedir = restImpl || ((ruta, o) => rest(ruta, clave, o))
  const guardar = guardarImpl || ((filas) => rest('tcg_card_history', clave, { method: 'POST', body: JSON.stringify(filas) }))
  const leerEstado = estadoImpl || (async () => (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]) }))
  const id = encodeURIComponent(cardId)

  let filas
  let carta
  let precio
  try {
    ;[filas, carta, precio] = await Promise.all([
      pedir(`tcg_card_history?select=dia,cm_low,cm_low_es,cm_low_en,cm_low_de,cm_low_fr,cm_low_it,cm_low_ja,tp_market_eur&card_id=eq.${id}&order=dia.asc&limit=400`),
      pedir(`tcg_cards?select=id,cm_id_product_propio&id=eq.${id}&limit=1`),
      pedir(`tcg_card_prices?select=historial_at&card_id=eq.${id}&limit=1`),
    ])
  } catch (e) {
    const m = String(e?.message || e)
    if (/tcg_card_history|42P01|historial_at|42703/.test(m)) return { estado: 200, cuerpo: { filas: [], nota: 'falta ejecutar supabase-migration-tcggo-historial.sql' } }
    return { estado: 502, cuerpo: { error: m.slice(0, 200) } }
  }
  filas = Array.isArray(filas) ? filas : []
  const idProduct = Number(carta?.[0]?.cm_id_product_propio)
  const pedidoHace = precio?.[0]?.historial_at ? (ahora.getTime() - new Date(precio[0].historial_at).getTime()) / 86_400_000 : Infinity
  const fresco = pedidoHace <= DIAS_DE_FRESCURA
  if (!carta?.length) return { estado: 404, cuerpo: { error: 'Esa carta no está en el catálogo.' } }
  if (fresco || !Number.isInteger(idProduct) || idProduct <= 0 || !env.TCGGO_API_KEY) {
    return { estado: 200, cuerpo: { filas, pedido: false, porque: fresco ? 'pedido hace menos de una semana' : !env.TCGGO_API_KEY ? 'sin clave de TCGGO' : 'sin id de Cardmarket' } }
  }

  // ── Pedir a TCGGO, con el tope diario delante ──
  const dia = ahora.toISOString().slice(0, 10)
  let estado
  try { estado = await leerEstado() } catch { estado = {} }
  estado = estado && typeof estado === 'object' ? estado : {}
  if (estado.dia !== dia) estado = { dia, peticiones: 0 }
  const tope = Math.max(1, Number(env.TCGGO_TOPE_HISTORIAL) || TOPE_DIARIO)
  if (estado.peticiones >= tope) return { estado: 200, cuerpo: { filas, pedido: false, porque: `tope diario de históricos (${tope}) alcanzado` } }
  estado.peticiones++
  try { await guardarEstado(estado) } catch { /* el contador es un freno, no un dato */ }
  const { base, host } = baseDe(env)
  const res = await fetchImpl(urlHistorial(idProduct, base), { headers: cabeceras(env.TCGGO_API_KEY, host) })
  const texto = await res.text()
  if (!res.ok) {
    return { estado: 200, cuerpo: { filas, pedido: true, porque: esLimiteDelPlan(res.status, texto) ? 'el plan de TCGGO no da más por hoy' : `TCGGO ${res.status}` } }
  }
  let datos
  try { datos = JSON.parse(texto) } catch { return { estado: 200, cuerpo: { filas, pedido: true, porque: 'TCGGO ha contestado algo que no es JSON' } } }
  const nuevas = filasDeHistorial(cardId, datos)
  try {
    if (nuevas.length) await guardar(nuevas)
    await pedir(`tcg_card_prices?card_id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ historial_at: ahora.toISOString() }), headers: { prefer: 'return=minimal' } })
  } catch (e) {
    return { estado: 200, cuerpo: { filas, pedido: true, porque: `nuestra base: ${String(e?.message || e).slice(0, 120)}` } }
  }
  // Las de la base y las nuevas, por día, sin repetir (las nuevas mandan).
  const porDia = new Map(filas.map((f) => [f.dia, f]))
  for (const n of nuevas) porDia.set(n.dia, { ...porDia.get(n.dia), ...n })
  const todas = [...porDia.values()].sort((a, b) => String(a.dia).localeCompare(String(b.dia)))
  return { estado: 200, cuerpo: { filas: todas, pedido: true, nuevas: nuevas.length } }
}

export default async (req) => {
  const json = (e, c, cache = false) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json', ...(cache ? { 'cache-control': 'public, max-age=3600' } : {}) } })
  if (req.method !== 'GET') return json(405, { error: 'Método no permitido.' })
  const url = new URL(req.url)
  try {
    const r = await procesar({ cardId: url.searchParams.get('card') || '' })
    return json(r.estado, r.cuerpo, r.estado === 200)
  } catch (e) {
    return json(502, { error: String(e?.message || e).slice(0, 300) })
  }
}
