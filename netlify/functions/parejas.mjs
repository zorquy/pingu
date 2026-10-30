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
import { conFoto, sinFoto, revisarDePeticion, CABECERAS_REVISADO } from '../lib/fotos-reto.mjs'

export const JUEGO = 'parejas'
export const CANDIDATAS = 24
export const SAL = 15500
// Si una del día no tiene foto (1111), las seis se eligen de nuevo con otra sal.
export const SAL_REPARO = 65500
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

// Cuántas cartas pueden salir: contarlas es lo más lento de elegir, y el
// número apenas cambia en un día, así que una función ya caliente lo reusa.
let cuenta = null
export async function cuantasHay(pedir, ahora = Date.now()) {
  if (cuenta && ahora - cuenta.cuando < 6 * 3600e3) return cuenta.total
  const { total } = await pedir(`tcg_cards?select=id&${FILTRO_ELEGIBLES}&limit=1`, { cabeceras: { prefer: 'count=exact' } })
  if (total) cuenta = { total, cuando: ahora }
  return total
}
export const olvidarCuenta = () => { cuenta = null }

export async function elegirParejas({ dia, pedir, guardar, actualizar = null, libre = null, revisar = false, probar }) {
  if (libre) dia = diaLibre(libre)
  // Seis con foto de verdad (1111), o null si no salen.
  const elegirIds = async (sal, fuera = []) => {
    const total = await cuantasHay(pedir)
    if (!total || total < PAREJAS) return null
    // A la vez (990): una detrás de otra eran 24 viajes a la base, varios
    // segundos de espera cada vez que tocaba elegir (la primera partida del
    // día y cada «Jugar otra vez»).
    const filas = await Promise.all(indicesDelDia(dia, total, Math.min(CANDIDATAS, total), sal)
      .map((i) => pedir(`tcg_cards?select=id&${FILTRO_ELEGIBLES}&order=id.asc&limit=1&offset=${i}`).then((r) => r.datos?.[0]?.id || null)))
    const candidatas = filas.filter((id) => id && !fuera.includes(id))
    const elegidas = cartasQueSirven(await conFoto(await cartasDe(candidatas, pedir), { probar, pedir }))
    return elegidas.length < PAREJAS ? null : elegidas.map((c) => c.id)
  }
  let ids = null
  let datos = null
  let quedanSinFoto = []
  if (!libre) try {
    const g = (await pedir(`retos_reto_del_dia?select=datos&juego=eq.${JUEGO}&day=eq.${dia}&limit=1`)).datos
    datos = g?.[0]?.datos || null
    ids = Array.isArray(datos?.card_ids) ? datos.card_ids : null
  } catch (e) {
    if (!sinTabla(e)) throw e
  }
  if (ids?.length && revisar && actualizar) {
    // Revisado (1111): si alguna no tiene foto, la mesa entera es otra.
    const actuales = await cartasDe(ids, pedir)
    const malas = await sinFoto(actuales, { probar, pedir })
    if (actuales.length < PAREJAS || malas.length) {
      const otras = await elegirIds(SAL_REPARO, ids)
      if (!otras) quedanSinFoto = malas
      if (otras) {
        ids = otras
        try { await actualizar('retos_reto_del_dia', `juego=eq.${JUEGO}&day=eq.${dia}`, { datos: { ...(datos || {}), card_ids: ids, cambiadas: true } }) } catch (e) { if (!sinTabla(e)) throw e }
      }
    }
  }
  if (!ids?.length) {
    ids = await elegirIds(SAL)
    if (!ids) return { error: 'No se han podido elegir seis cartas.' }
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
  return libre ? { dia, libre, cartas } : { dia, numero: numeroDelDia(dia), cartas, ...(revisar ? { sinFoto: quedanSinFoto } : {}) }
}

export default async (req) => {
  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!claveServicio) return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  const libre = libreDePeticion(req)
  const revisar = !libre && revisarDePeticion(req)
  try {
    const r = await elegirParejas({
      dia: hoyUTC(),
      libre,
      pedir: (ruta, o = {}) => rest(ruta, claveServicio, o),
      guardar: (tabla, fila) => rest(tabla, claveServicio, { metodo: 'POST', cuerpo: [fila], cabeceras: { prefer: 'resolution=ignore-duplicates,return=minimal' } }),
      actualizar: (tabla, filtro, cambios) => rest(`${tabla}?${filtro}`, claveServicio, { metodo: 'PATCH', cuerpo: cambios, cabeceras: { prefer: 'return=minimal' } }),
      revisar,
    })
    if (r.error) return Response.json(r, { status: 503, headers: { 'cache-control': 'no-store' } })
    // Las del día son las mismas para todo el mundo hasta medianoche: que las
    // sirva la CDN y no la función (990).
    const hasta = segundosHastaManana()
    return Response.json(r, { headers: libre ? CABECERAS_LIBRE : revisar ? CABECERAS_REVISADO : { 'cache-control': `public, max-age=${hasta}`, 'netlify-cdn-cache-control': `public, durable, max-age=${hasta}` } })
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 200) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
