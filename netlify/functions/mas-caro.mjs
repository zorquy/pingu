// Las seis cartas de «¿Más caro o más barato?» (tanda 583).
//
// Como `carta-del-dia`: la primera petición del día elige y guarda en
// `mas_caro_del_dia`, y las demás leen. Se elige entre las cartas con
// precio guardado (`tcg_card_prices`, que son las que alguien de PokeDoc
// tiene), de un euro para arriba, y se comprueba en `tcg_cards` que sean
// occidentales, del TCG de verdad y con foto. Se piden más candidatas de
// las que hacen falta y se quedan las seis primeras que sirven.
//
// Patrón inyectable: `pedir` y `guardar` se cambian en las pruebas.
import { indicesDelDia, cartasQueSirven, numeroDelDia, CARTAS_POR_DIA, PRECIO_MINIMO } from '../../js/mas-caro.js'
import { ID_DE_POCKET } from '../../js/catalogo-series.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'

export const FILTRO_PRECIOS = `cm_trend=gte.${PRECIO_MINIMO}`
export const COLUMNAS_CARTA = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,rarity,rarity_en,tcg_sets(name,name_en,tcg_online_code,serie_id)'
// Cuántas candidatas se miran para quedarse con seis.
export const CANDIDATAS = 16

export const hoyUTC = () => new Date().toISOString().slice(0, 10)

export function segundosHastaManana(ahora = new Date()) {
  const manana = Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + 1)
  return Math.max(60, Math.floor((manana - ahora.getTime()) / 1000))
}

async function rest(ruta, clave, { metodo = 'GET', cuerpo = null, cabeceras = {} } = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    method: metodo,
    headers: { apikey: clave, authorization: `Bearer ${clave}`, ...(cuerpo ? { 'content-type': 'application/json' } : {}), ...cabeceras },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const rango = res.headers.get('content-range') || ''
  return { datos: metodo === 'GET' ? await res.json() : null, total: Number(rango.split('/')[1]) || null }
}

const enLista = (ids) => ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')

// Las cartas de una lista de ids, con su precio, en el orden pedido y
// sin las de Pocket (la regla de `esDelTCG`).
async function cartasConPrecio(ids, pedir) {
  if (!ids.length) return []
  const [cartas, precios] = await Promise.all([
    pedir(`tcg_cards?select=${COLUMNAS_CARTA}&id=in.(${enLista(ids)})&market=eq.WEST&set_id=not.imatch.${encodeURIComponent(ID_DE_POCKET.source)}`),
    pedir(`tcg_card_prices?select=card_id,cm_trend&card_id=in.(${enLista(ids)})`),
  ])
  const precioDe = new Map((precios.datos || []).map((p) => [p.card_id, Number(p.cm_trend)]))
  const porId = new Map((cartas.datos || []).map((c) => [c.id, c]))
  return ids.map((id) => (porId.has(id) ? { ...porId.get(id), precio: precioDe.get(id) ?? null } : null)).filter(Boolean)
}

export async function elegirMasCaro({ dia, pedir, guardar }) {
  const guardado = (await pedir(`mas_caro_del_dia?select=card_ids&day=eq.${dia}&limit=1`)).datos
  let ids = Array.isArray(guardado?.[0]?.card_ids) ? guardado[0].card_ids : null
  if (!ids?.length) {
    const { total } = await pedir(`tcg_card_prices?select=card_id&${FILTRO_PRECIOS}&limit=1`, { cabeceras: { prefer: 'count=exact' } })
    if (!total || total < CARTAS_POR_DIA) return { error: 'Todavía no hay cartas con precio suficientes.' }
    const indices = indicesDelDia(dia, total, Math.min(CANDIDATAS, total))
    const candidatas = []
    for (const i of indices) {
      const fila = (await pedir(`tcg_card_prices?select=card_id&${FILTRO_PRECIOS}&order=card_id.asc&limit=1&offset=${i}`)).datos?.[0]
      if (fila?.card_id) candidatas.push(fila.card_id)
    }
    const elegidas = cartasQueSirven(await cartasConPrecio(candidatas, pedir))
    if (elegidas.length < CARTAS_POR_DIA) return { error: 'No se han podido elegir seis cartas.' }
    ids = elegidas.map((c) => c.id)
    await guardar('mas_caro_del_dia', { day: dia, card_ids: ids })
    const otra = (await pedir(`mas_caro_del_dia?select=card_ids&day=eq.${dia}&limit=1`)).datos
    if (Array.isArray(otra?.[0]?.card_ids) && otra[0].card_ids.length) ids = otra[0].card_ids
  }
  const cartas = await cartasConPrecio(ids, pedir)
  if (cartas.length < CARTAS_POR_DIA) return { error: 'Las cartas del día ya no están en el catálogo.' }
  return { dia, numero: numeroDelDia(dia), cartas }
}

export default async () => {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  const dia = hoyUTC()
  try {
    const r = await elegirMasCaro({
      dia,
      pedir: (ruta, o = {}) => rest(ruta, clave, o),
      guardar: (tabla, fila) => rest(tabla, clave, { metodo: 'POST', cuerpo: [fila], cabeceras: { prefer: 'resolution=ignore-duplicates,return=minimal' } }),
    })
    if (r.error) return Response.json(r, { status: 503, headers: { 'cache-control': 'no-store' } })
    return Response.json(r, { headers: { 'cache-control': `public, max-age=${segundosHastaManana()}` } })
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 200) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
