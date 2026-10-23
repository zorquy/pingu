// Las seis cartas de «Parejas» (tanda 989). Como «Ordena por precio»: las
// elige la PRIMERA petición de cada día y las deja en `retos_reto_del_dia`
// (juego 'parejas') para que todo el mundo juegue las mismas; el sitio de
// cada una en la mesa sale de la fecha (js/parejas.js). Con `libre` (988), una
// partida libre: su día, sin leer ni escribir la tabla.
//
// Las que pueden salir son las de «¿Qué carta es?» (Pokémon occidentales con
// foto y rareza, sin TCG Pocket) y con nombres distintos: dos Pikachu
// distintos en la misma mesa harían de una pareja un acertijo.
import { indicesDelDia } from '../../js/mas-caro.js'
import { numeroDelDia, PAREJAS } from '../../js/parejas.js'
import { diaLibre } from '../../js/retos-libre.js'
import { FILTRO_ELEGIBLES } from './carta-del-dia.mjs'
import { hoyUTC, segundosHastaManana, rest, libreDePeticion, CABECERAS_LIBRE } from './mas-caro.mjs'

export const JUEGO = 'parejas'
export const CANDIDATAS = 24
export const SAL = 15500
export const COLUMNAS_CARTA = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,rarity,rarity_en,tcg_sets(name,name_en,tcg_online_code,serie_id)'

const sinTabla = (e) => /retos_reto_del_dia|42P01|PGRST205/.test(String(e?.message || e))
const enLista = (ids) => ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')
const clave = (c) => String(c?.name_en || c?.name || '').toLowerCase().replace(/\s+(ex|gx|v|vmax|vstar)$/i, '').trim()

// De las candidatas, las primeras PAREJAS con nombre distinto, en su orden.
export function cartasQueSirven(candidatas, n = PAREJAS) {
  const fuera = []
  const vistos = new Set()
  for (const c of candidatas || []) {
    const k = clave(c)
    if (!c?.id || !k || vistos.has(k)) continue
    if (!c.image_path && !c.image_scrydex && !c.image_tcggo) continue
    vistos.add(k)
    fuera.push(c)
    if (fuera.length >= n) break
  }
  return fuera
}

async function cartasDe(ids, pedir) {
  if (!ids.length) return []
  const filas = (await pedir(`tcg_cards?select=${COLUMNAS_CARTA}&market=eq.WEST&id=in.(${enLista(ids)})`)).datos || []
  const porId = new Map(filas.map((c) => [c.id, c]))
  return ids.map((id) => porId.get(id)).filter(Boolean)
}

export async function elegirParejas({ dia, pedir, guardar, libre = null }) {
  if (libre) dia = diaLibre(libre)
  let ids = null
  if (!libre) try {
    const g = (await pedir(`retos_reto_del_dia?select=datos&juego=eq.${JUEGO}&day=eq.${dia}&limit=1`)).datos
    ids = Array.isArray(g?.[0]?.datos?.card_ids) ? g[0].datos.card_ids : null
  } catch (e) {
    if (!sinTabla(e)) throw e
  }
  if (!ids?.length) {
    const { total } = await pedir(`tcg_cards?select=id&${FILTRO_ELEGIBLES}&limit=1`, { cabeceras: { prefer: 'count=exact' } })
    if (!total || total < PAREJAS) return { error: 'No hay cartas para elegir.' }
    const candidatas = []
    for (const i of indicesDelDia(dia, total, Math.min(CANDIDATAS, total), SAL)) {
      const fila = (await pedir(`tcg_cards?select=id&${FILTRO_ELEGIBLES}&order=id.asc&limit=1&offset=${i}`)).datos?.[0]
      if (fila?.id) candidatas.push(fila.id)
    }
    const elegidas = cartasQueSirven(await cartasDe(candidatas, pedir))
    if (elegidas.length < PAREJAS) return { error: 'No se han podido elegir seis cartas.' }
    ids = elegidas.map((c) => c.id)
    if (!libre) try {
      await guardar('retos_reto_del_dia', { juego: JUEGO, day: dia, datos: { card_ids: ids } })
      const otra = (await pedir(`retos_reto_del_dia?select=datos&juego=eq.${JUEGO}&day=eq.${dia}&limit=1`)).datos
      if (Array.isArray(otra?.[0]?.datos?.card_ids) && otra[0].datos.card_ids.length) ids = otra[0].datos.card_ids
    } catch (e) {
      if (!sinTabla(e)) throw e
    }
  }
  const cartas = await cartasDe(ids, pedir)
  if (cartas.length < PAREJAS) return { error: 'Las cartas del día ya no están en el catálogo.' }
  return libre ? { dia, libre, cartas } : { dia, numero: numeroDelDia(dia), cartas }
}

export default async (req) => {
  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!claveServicio) return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  const libre = libreDePeticion(req)
  try {
    const r = await elegirParejas({
      dia: hoyUTC(),
      libre,
      pedir: (ruta, o = {}) => rest(ruta, claveServicio, o),
      guardar: (tabla, fila) => rest(tabla, claveServicio, { metodo: 'POST', cuerpo: [fila], cabeceras: { prefer: 'resolution=ignore-duplicates,return=minimal' } }),
    })
    if (r.error) return Response.json(r, { status: 503, headers: { 'cache-control': 'no-store' } })
    return Response.json(r, { headers: libre ? CABECERAS_LIBRE : { 'cache-control': `public, max-age=${segundosHastaManana()}` } })
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 200) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
