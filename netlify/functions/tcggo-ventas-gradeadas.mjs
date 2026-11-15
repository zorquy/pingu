// Las últimas ventas de una carta GRADEADA en eBay, a demanda (tanda 1364,
// la C de «Lo nuevo de la API de TCGGO», aprobada por PINGU).
//
// GET /.netlify/functions/tcggo-ventas-gradeadas?card=<id>. Devuelve las
// ventas guardadas en `tcg_card_ventas_gradeadas` (casa, nota, precio en
// euros, fecha, título y anuncio). Si no se le han pedido a TCGGO en la
// última semana —o nunca—, se le piden ahora: UNA petición
// (`/ebay-sold-offers`, 30 ventas) y se guardan.
//
// Es el patrón del histórico (643): pública, y con sus frenos, porque cada
// petición se paga. Tres:
//   · solo cartas que VALEN algo: con el mínimo de Cardmarket (o su media de
//     30 días) por debajo de 20 € no se pide (PINGU, 2026-11-15: «20 €»).
//     Casi nadie gradea una carta de 2 €, y serían miles de peticiones para
//     contestar «no hay ventas»;
//   · la web solo llama al ABRIR «Gradeadas» en la ficha, no al pintarla;
//   · un tope diario (`TCGGO_TOPE_VENTAS`, 400 de serie) apuntado en
//     `scrydex_estado` → `tcggo_ventas_gradeadas`, que /admin enseña.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_VENTAS.

import { cabeceras, baseDe, baseJpDe, urlVentasGradeadas, ventasDe, esLimiteDelPlan } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_ventas_gradeadas'
export const TOPE_DIARIO = 400
export const DIAS_DE_FRESCURA = 7
// Desde cuánto vale la pena preguntar (en euros).
export const PRECIO_MINIMO = 20
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

const numero = (v) => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null)

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  ahora = new Date(), cardId = '',
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  if (!ID_VALIDO.test(String(cardId || ''))) return { estado: 400, cuerpo: { error: 'Falta el id de la carta.' } }
  const pedir = restImpl || ((ruta, o) => rest(ruta, clave, o))
  const leerEstado = estadoImpl || (async () => (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]) }))
  const id = encodeURIComponent(cardId)

  let guardadas
  let carta
  let precio
  try {
    ;[guardadas, carta, precio] = await Promise.all([
      pedir(`tcg_card_ventas_gradeadas?select=ventas,pedido_at&card_id=eq.${id}&limit=1`),
      pedir(`tcg_cards?select=id,market,tcggo_id,cm_id_product_propio&id=eq.${id}&limit=1`),
      pedir(`tcg_card_prices?select=cm_low,cm_avg30&card_id=eq.${id}&limit=1`),
    ])
  } catch (e) {
    const m = String(e?.message || e)
    if (/tcg_card_ventas_gradeadas|42P01|PGRST205/.test(m)) return { estado: 200, cuerpo: { ventas: [], pedido: false, porque: 'falta ejecutar supabase-migration-1364-ventas-gradeadas.sql' } }
    return { estado: 502, cuerpo: { error: m.slice(0, 200) } }
  }
  const fila = guardadas?.[0] || null
  const ventas = Array.isArray(fila?.ventas) ? fila.ventas : []
  if (!carta?.length) return { estado: 404, cuerpo: { error: 'Esa carta no está en el catálogo.' } }
  const pedidoHace = fila?.pedido_at ? (ahora.getTime() - new Date(fila.pedido_at).getTime()) / 86_400_000 : Infinity
  if (pedidoHace <= DIAS_DE_FRESCURA) return { estado: 200, cuerpo: { ventas, pedido: false, porque: 'pedido hace menos de una semana', pedidoAt: fila.pedido_at } }

  const valor = Math.max(numero(precio?.[0]?.cm_low) || 0, numero(precio?.[0]?.cm_avg30) || 0)
  if (valor < PRECIO_MINIMO) return { estado: 200, cuerpo: { ventas, pedido: false, porque: `vale menos de ${PRECIO_MINIMO} €` } }
  const tcggoId = Number(carta[0].tcggo_id)
  const idProduct = Number(carta[0].cm_id_product_propio)
  const { base, host } = baseDe(env)
  const url = urlVentasGradeadas({ tcggoId, idProduct }, carta[0].market === 'JP' ? baseJpDe(base) : base)
  if (!url || !env.TCGGO_API_KEY) return { estado: 200, cuerpo: { ventas, pedido: false, porque: !env.TCGGO_API_KEY ? 'sin clave de TCGGO' : 'sin id de TCGGO ni de Cardmarket' } }

  // ── Pedir a TCGGO, con el tope diario delante ──
  const dia = ahora.toISOString().slice(0, 10)
  let estado
  try { estado = await leerEstado() } catch { estado = {} }
  estado = estado && typeof estado === 'object' ? estado : {}
  if (estado.dia !== dia) estado = { dia, peticiones: 0, conVentas: 0 }
  const tope = Math.max(1, Number(env.TCGGO_TOPE_VENTAS) || TOPE_DIARIO)
  if (estado.peticiones >= tope) return { estado: 200, cuerpo: { ventas, pedido: false, porque: `tope diario de ventas gradeadas (${tope}) alcanzado` } }
  // Lo que se paga cuenta ANTES de pedir (la 522): si después falla algo
  // nuestro, la petición ya está contada.
  estado.peticiones++
  try { await guardarEstado(estado) } catch { /* el contador es un freno, no un dato */ }
  const res = await fetchImpl(url, { headers: cabeceras(env.TCGGO_API_KEY, host) })
  const texto = await res.text()
  if (!res.ok) {
    const porque = esLimiteDelPlan(res.status, texto) ? 'el plan de TCGGO no da más por hoy' : `TCGGO ${res.status}`
    estado.ultimoError = { fecha: ahora.toISOString(), carta: cardId, error: porque }
    try { await guardarEstado(estado) } catch { /* idem */ }
    return { estado: 200, cuerpo: { ventas, pedido: true, porque } }
  }
  let nuevas
  try { nuevas = ventasDe(JSON.parse(texto)) } catch { return { estado: 200, cuerpo: { ventas, pedido: true, porque: 'TCGGO ha contestado algo que no es JSON' } } }
  // Se guarda también una lista VACÍA: «no hay ventas» es una respuesta, y
  // sin apuntarla se volvería a pagar en cada visita.
  try {
    await pedir('tcg_card_ventas_gradeadas', { method: 'POST', body: JSON.stringify([{ card_id: cardId, market: carta[0].market || 'WEST', ventas: nuevas, pedido_at: ahora.toISOString() }]) })
  } catch (e) {
    return { estado: 200, cuerpo: { ventas: nuevas, pedido: true, porque: `nuestra base: ${String(e?.message || e).slice(0, 120)}` } }
  }
  if (nuevas.length) {
    estado.conVentas = (estado.conVentas || 0) + 1
    try { await guardarEstado(estado) } catch { /* idem */ }
  }
  return { estado: 200, cuerpo: { ventas: nuevas, pedido: true, pedidoAt: ahora.toISOString() } }
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

// Tope por persona, como el histórico (1313, S7): pasado, Netlify contesta
// 429 sin despertar la función.
export const config = { rateLimit: { windowLimit: 30, windowSize: 60, aggregateBy: ['ip', 'domain'] } }
