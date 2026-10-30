// Las cuatro cartas de «Ordena por precio» (tanda 835).
//
// Como `mas-caro`: la primera petición del día elige entre las cartas con
// precio guardado y lo deja en `retos_reto_del_dia` (juego 'ordena'), y las
// demás leen. Con otra sal, para que no salgan las mismas que en «Más caro».
// Sin la migración (la tabla no existe) se elige igual y no se guarda: con
// la misma semilla sale lo mismo mientras no cambie la lista de precios.
//
// Patrón inyectable: `pedir` y `guardar` se cambian en las pruebas.
import { indicesDelDia } from '../../js/mas-caro.js'
import { cartasQueSirven, numeroDelDia, CARTAS } from '../../js/ordena-precio.js'
import { FILTRO_PRECIOS, cartasConPrecio, hoyUTC, segundosHastaManana, rest, libreDePeticion, CABECERAS_LIBRE } from './mas-caro.mjs'
import { diaLibre } from '../../js/retos-libre.js'
import { conFoto, sinFoto, revisarDePeticion, CABECERAS_REVISADO } from '../lib/fotos-reto.mjs'

export const JUEGO = 'ordena'
export const CANDIDATAS = 24
export const SAL = 9000
// Si una del día no tiene foto (1111), las cuatro se eligen de nuevo con otra sal.
export const SAL_REPARO = 59000

const sinTabla = (e) => /retos_reto_del_dia|42P01|PGRST205/.test(String(e?.message || e))

// Con `libre` (988), una partida libre: el día suyo, sin la tabla del día.
export async function elegirOrdena({ dia, pedir, guardar, actualizar = null, libre = null, revisar = false, probar }) {
  if (libre) dia = diaLibre(libre)
  // Cuatro con foto de verdad (1111); null si no hay precios, [] si no salen.
  const elegirIds = async (sal, fuera = []) => {
    const { total } = await pedir(`tcg_card_prices?select=card_id&${FILTRO_PRECIOS}&limit=1`, { cabeceras: { prefer: 'count=exact' } })
    if (!total || total < CARTAS) return null
    const candidatas = []
    for (const i of indicesDelDia(dia, total, Math.min(CANDIDATAS, total), sal)) {
      const fila = (await pedir(`tcg_card_prices?select=card_id&${FILTRO_PRECIOS}&order=card_id.asc&limit=1&offset=${i}`)).datos?.[0]
      if (fila?.card_id && !fuera.includes(fila.card_id)) candidatas.push(fila.card_id)
    }
    const elegidas = cartasQueSirven(await conFoto(await cartasConPrecio(candidatas, pedir), { probar }))
    return elegidas.length < CARTAS ? [] : elegidas.map((c) => c.id)
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
    // Revisado (1111): si alguna no tiene foto, las cuatro son otras.
    const actuales = await cartasConPrecio(ids, pedir)
    const malas = await sinFoto(actuales, { probar })
    if (actuales.length < CARTAS || malas.length) {
      const otras = await elegirIds(SAL_REPARO, ids)
      if (!otras?.length) quedanSinFoto = malas
      if (otras?.length) {
        ids = otras
        try { await actualizar('retos_reto_del_dia', `juego=eq.${JUEGO}&day=eq.${dia}`, { datos: { ...(datos || {}), card_ids: ids, cambiadas: true } }) } catch (e) { if (!sinTabla(e)) throw e }
      }
    }
  }
  if (!ids?.length) {
    ids = await elegirIds(SAL)
    if (!ids) return { error: 'Todavía no hay cartas con precio suficientes.' }
    if (!ids.length) return { error: 'No se han podido elegir cuatro cartas.' }
    if (!libre) try {
      await guardar('retos_reto_del_dia', { juego: JUEGO, day: dia, datos: { card_ids: ids } })
      const otra = (await pedir(`retos_reto_del_dia?select=datos&juego=eq.${JUEGO}&day=eq.${dia}&limit=1`)).datos
      if (Array.isArray(otra?.[0]?.datos?.card_ids) && otra[0].datos.card_ids.length) ids = otra[0].datos.card_ids
    } catch (e) {
      if (!sinTabla(e)) throw e
    }
  }
  const cartas = await cartasConPrecio(ids, pedir)
  if (cartas.length < CARTAS) return { error: 'Las cartas del día ya no están en el catálogo.' }
  return libre ? { dia, libre, cartas } : { dia, numero: numeroDelDia(dia), cartas, ...(revisar ? { sinFoto: quedanSinFoto } : {}) }
}

export default async (req) => {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  const libre = libreDePeticion(req)
  const revisar = !libre && revisarDePeticion(req)
  try {
    const r = await elegirOrdena({
      dia: hoyUTC(),
      libre,
      pedir: (ruta, o = {}) => rest(ruta, clave, o),
      guardar: (tabla, fila) => rest(tabla, clave, { metodo: 'POST', cuerpo: [fila], cabeceras: { prefer: 'resolution=ignore-duplicates,return=minimal' } }),
      actualizar: (tabla, filtro, cambios) => rest(`${tabla}?${filtro}`, clave, { metodo: 'PATCH', cuerpo: cambios, cabeceras: { prefer: 'return=minimal' } }),
      revisar,
    })
    if (r.error) return Response.json(r, { status: 503, headers: { 'cache-control': 'no-store' } })
    return Response.json(r, { headers: libre ? CABECERAS_LIBRE : revisar ? CABECERAS_REVISADO : { 'cache-control': `public, max-age=${segundosHastaManana()}` } })
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 200) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
