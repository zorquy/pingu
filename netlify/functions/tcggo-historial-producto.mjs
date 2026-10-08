// El histórico de precios de un PRODUCTO sellado, a demanda (tanda 769).
//
// GET /.netlify/functions/tcggo-historial-producto?product=<id>. Es la de
// las cartas (`tcggo-historial`, la 643) para un producto: devuelve las
// filas de `tcg_product_history` y, si no se le ha pedido su histórico a
// TCGGO en la última semana —o nunca—, se le pide ahora (UNA petición: hasta
// 30 fechas, por su id de Cardmarket) y se guarda. Así la gráfica de la
// ficha no empieza vacía el primer día.
//
// Pública, y por eso con su propio freno: un tope diario de peticiones
// (`TCGGO_TOPE_HISTORIAL_PRODUCTOS`, 300 de serie) apuntado en
// `scrydex_estado` → `tcggo_historial_productos`. Pasado el tope se sirve
// lo que haya. Sin la migración (supabase-migration-productos-ficha.sql),
// devuelve una lista vacía y lo dice: no gasta nada.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_HISTORIAL_PRODUCTOS.
import { cabeceras, baseDe, urlHistorial, filasDeHistorial, esLimiteDelPlan } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_historial_productos'
export const TOPE_DIARIO = 300
const DIAS_DE_FRESCURA = 7
const COLUMNAS = 'dia,cm_low,cm_low_en,tp_market_eur'

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

// Las filas de las cartas, con la llave del producto: el histórico de TCGGO
// es el mismo para los dos (va por id de Cardmarket). Solo el mínimo de
// Cardmarket (también como `cm_low_en`, que es la línea que dibuja la
// gráfica con el rótulo «Cardmarket») y TCGplayer: lo que viene por país
// la gráfica lo rotularía como idiomas.
export function filasDeProducto(productId, respuesta) {
  return filasDeHistorial('x', respuesta)
    .map((f) => ({ product_id: Number(productId), dia: f.dia, cm_low: f.cm_low, cm_low_en: f.cm_low, tp_market_eur: f.tp_market_eur, origen: 'tcggo' }))
    .filter((f) => f.cm_low || f.tp_market_eur)
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  ahora = new Date(), productId = '',
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  const id = Number(productId)
  if (!Number.isInteger(id) || id <= 0) return { estado: 400, cuerpo: { error: 'Falta el id del producto.' } }
  const pedir = restImpl || ((ruta, o) => rest(ruta, clave, o))
  const guardar = guardarImpl || ((filas) => rest('tcg_product_history', clave, { method: 'POST', body: JSON.stringify(filas) }))
  const leerEstado = estadoImpl || (async () => (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]) }))

  let filas
  let producto
  try {
    ;[filas, producto] = await Promise.all([
      pedir(`tcg_product_history?select=${COLUMNAS}&product_id=eq.${id}&order=dia.asc&limit=400`),
      pedir(`tcg_products?select=id,cardmarket_id,historial_at&id=eq.${id}&limit=1`),
    ])
  } catch (e) {
    const m = String(e?.message || e)
    if (/tcg_product_history|42P01|historial_at|42703/.test(m)) return { estado: 200, cuerpo: { filas: [], nota: 'falta ejecutar supabase-migration-productos-ficha.sql' } }
    return { estado: 502, cuerpo: { error: m.slice(0, 200) } }
  }
  filas = Array.isArray(filas) ? filas : []
  const p = producto?.[0]
  if (!p) return { estado: 404, cuerpo: { error: 'Ese producto no está en el catálogo.' } }
  const idCm = Number(p.cardmarket_id)
  const pedidoHace = p.historial_at ? (ahora.getTime() - new Date(p.historial_at).getTime()) / 86_400_000 : Infinity
  const fresco = pedidoHace <= DIAS_DE_FRESCURA
  if (fresco || !Number.isInteger(idCm) || idCm <= 0 || !env.TCGGO_API_KEY) {
    return { estado: 200, cuerpo: { filas, pedido: false, porque: fresco ? 'pedido hace menos de una semana' : !env.TCGGO_API_KEY ? 'sin clave de TCGGO' : 'sin id de Cardmarket' } }
  }

  // ── Pedir a TCGGO, con el tope diario DELANTE (la 522: se cuenta desde
  // donde se paga) ──
  const dia = ahora.toISOString().slice(0, 10)
  let estado
  try { estado = await leerEstado() } catch { estado = {} }
  estado = estado && typeof estado === 'object' ? estado : {}
  if (estado.dia !== dia) estado = { dia, peticiones: 0 }
  const tope = Math.max(1, Number(env.TCGGO_TOPE_HISTORIAL_PRODUCTOS) || TOPE_DIARIO)
  if (estado.peticiones >= tope) return { estado: 200, cuerpo: { filas, pedido: false, porque: `tope diario de históricos de productos (${tope}) alcanzado` } }
  estado.peticiones++
  try { await guardarEstado(estado) } catch { /* el contador es un freno, no un dato */ }
  const { base, host } = baseDe(env)
  const res = await fetchImpl(urlHistorial(idCm, base), { headers: cabeceras(env.TCGGO_API_KEY, host) })
  const texto = await res.text()
  if (!res.ok) return { estado: 200, cuerpo: { filas, pedido: true, porque: esLimiteDelPlan(res.status, texto) ? 'el plan de TCGGO no da más por hoy' : `TCGGO ${res.status}` } }
  let datos
  try { datos = JSON.parse(texto) } catch { return { estado: 200, cuerpo: { filas, pedido: true, porque: 'TCGGO ha contestado algo que no es JSON' } } }
  const nuevas = filasDeProducto(id, datos)
  try {
    if (nuevas.length) await guardar(nuevas)
    await pedir(`tcg_products?id=eq.${id}`, { method: 'PATCH', body: JSON.stringify({ historial_at: ahora.toISOString() }), headers: { prefer: 'return=minimal' } })
  } catch (e) {
    return { estado: 200, cuerpo: { filas, pedido: true, porque: `nuestra base: ${String(e?.message || e).slice(0, 120)}` } }
  }
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
    const r = await procesar({ productId: url.searchParams.get('product') || '' })
    return json(r.estado, r.cuerpo, r.estado === 200)
  } catch (e) {
    return json(502, { error: String(e?.message || e).slice(0, 300) })
  }
}
