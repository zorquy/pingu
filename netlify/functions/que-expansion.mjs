// Las cinco rondas de «¿De qué expansión es?» (tanda 835).
//
// La primera petición del día elige cinco cartas occidentales del TCG, con
// foto y de cinco expansiones distintas a la vista, y para cada una tres
// expansiones más de su era (`opcionesDeExpansion`). Lo deja en
// `retos_reto_del_dia` (juego 'expansion') y las demás leen. Sin la
// migración se elige igual y no se guarda.
//
// Patrón inyectable: `pedir` y `guardar` se cambian en las pruebas.
import { indicesDelDia } from '../../js/mas-caro.js'
import { opcionesDeExpansion, numeroDelDia, RONDAS } from '../../js/que-expansion.js'
import { esDelTCG, ID_DE_POCKET, plegarHermanos, padreDeColeccion } from '../../js/catalogo-series.js'
import { hoyUTC, segundosHastaManana, rest, libreDePeticion, CABECERAS_LIBRE } from './mas-caro.mjs'
import { diaLibre } from '../../js/retos-libre.js'

export const JUEGO = 'expansion'
export const CANDIDATAS = 20
export const SAL = 12000
// Del TCG, con foto y de un set que se ve.
export const FILTRO_CARTAS = `market=eq.WEST&or=(image_path.not.is.null,image_scrydex.not.is.null,image_tcggo.not.is.null)&set_id=not.imatch.${encodeURIComponent(ID_DE_POCKET.source)}&tcg_sets.oculto=is.false`
export const COLUMNAS_CARTA = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,tcg_sets!inner(name,name_en,tcg_online_code,serie_id,oculto)'
export const COLUMNAS_SET = 'id,market,name,name_en,serie_id,release_date,logo_path,logo_scrydex,logo_tcggo,oculto,tcggo_id,card_count_official,card_count_total'

const sinTabla = (e) => /retos_reto_del_dia|42P01|PGRST205/.test(String(e?.message || e))
const enLista = (ids) => ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')

// Con `libre` (988), una partida libre: el día suyo, sin la tabla del día.
export async function elegirExpansion({ dia, pedir, guardar, libre = null }) {
  if (libre) dia = diaLibre(libre)
  const todos = ((await pedir(`tcg_sets?select=${COLUMNAS_SET}&market=eq.WEST&oculto=is.false&limit=1000`)).datos || []).filter(esDelTCG)
  // LAS EXPANSIONES COMO LAS ENSEÑA LA WEB (976): plegadas. Sin esto una
  // Trainer Gallery era una opción más, al lado de su expansión y de las
  // otras Trainer Gallery —«Silver Tempest Trainer Gallery» y «Lost Origin
  // Trainer Gallery» parecían la misma—, y la carta de una galería tenía
  // por respuesta buena una colección que en /cartas no existe sola.
  const sets = plegarHermanos(todos.map((s) => ({ ...s })))
  const porId = new Map(sets.map((s) => [String(s.id).toLowerCase(), s]))
  // La expansión en la que se ve un set: la suya si va dentro de otra.
  const expansionDe = (id) => {
    const padre = padreDeColeccion(id)
    return (padre && porId.get(padre)) || porId.get(String(id ?? '').toLowerCase()) || null
  }
  let rondas = null
  if (!libre) try {
    const g = (await pedir(`retos_reto_del_dia?select=datos&juego=eq.${JUEGO}&day=eq.${dia}&limit=1`)).datos
    rondas = Array.isArray(g?.[0]?.datos?.rondas) ? g[0].datos.rondas : null
  } catch (e) {
    if (!sinTabla(e)) throw e
  }
  if (!rondas?.length) {
    const { total } = await pedir(`tcg_cards?select=id,tcg_sets!inner(oculto)&${FILTRO_CARTAS}&limit=1`, { cabeceras: { prefer: 'count=exact' } })
    if (!total) return { error: 'No hay cartas para elegir.' }
    const elegidas = []
    for (const i of indicesDelDia(dia, total, Math.min(CANDIDATAS, total), SAL)) {
      if (elegidas.length >= RONDAS) break
      const c = (await pedir(`tcg_cards?select=id,set_id,tcg_sets!inner(oculto)&${FILTRO_CARTAS}&order=id.asc&limit=1&offset=${i}`)).datos?.[0]
      if (!c?.id || !expansionDe(c.set_id) || elegidas.some((x) => expansionDe(x.set_id) === expansionDe(c.set_id))) continue
      elegidas.push(c)
    }
    if (elegidas.length < RONDAS) return { error: 'No se han podido elegir cinco cartas.' }
    rondas = elegidas.map((c, r) => ({ card_id: c.id, set_ids: opcionesDeExpansion(expansionDe(c.set_id), sets, dia, r).map((s) => s.id) }))
    if (!libre) try {
      await guardar('retos_reto_del_dia', { juego: JUEGO, day: dia, datos: { rondas } })
      const otra = (await pedir(`retos_reto_del_dia?select=datos&juego=eq.${JUEGO}&day=eq.${dia}&limit=1`)).datos
      if (Array.isArray(otra?.[0]?.datos?.rondas) && otra[0].datos.rondas.length) rondas = otra[0].datos.rondas
    } catch (e) {
      if (!sinTabla(e)) throw e
    }
  }
  const cartas = (await pedir(`tcg_cards?select=${COLUMNAS_CARTA}&market=eq.WEST&id=in.(${enLista(rondas.map((r) => r.card_id))})`)).datos || []
  const cartaPorId = new Map(cartas.map((c) => [c.id, c]))
  // Lo guardado antes de la 976 puede traer una galería y su expansión como
  // dos opciones: al leer, cada una se cambia por la expansión en la que se
  // ve y se quitan las repetidas. `set_id` es la respuesta buena.
  const fuera = rondas
    .map((r) => {
      const carta = cartaPorId.get(r.card_id)
      const buena = carta ? expansionDe(carta.set_id) : null
      const opciones = []
      for (const s of (r.set_ids || []).map(expansionDe)) if (s && !opciones.includes(s)) opciones.push(s)
      return { carta, set_id: buena?.id || null, opciones }
    })
    .filter((r) => r.carta && r.set_id && r.opciones.length >= 2 && r.opciones.some((s) => s.id === r.set_id))
  if (fuera.length < RONDAS) return { error: 'Las cartas del día ya no están en el catálogo.' }
  return libre ? { dia, libre, rondas: fuera } : { dia, numero: numeroDelDia(dia), rondas: fuera }
}

export default async (req) => {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  const libre = libreDePeticion(req)
  try {
    const r = await elegirExpansion({
      dia: hoyUTC(),
      libre,
      pedir: (ruta, o = {}) => rest(ruta, clave, o),
      guardar: (tabla, fila) => rest(tabla, clave, { metodo: 'POST', cuerpo: [fila], cabeceras: { prefer: 'resolution=ignore-duplicates,return=minimal' } }),
    })
    if (r.error) return Response.json(r, { status: 503, headers: { 'cache-control': 'no-store' } })
    return Response.json(r, { headers: libre ? CABECERAS_LIBRE : { 'cache-control': `public, max-age=${segundosHastaManana()}` } })
  } catch (err) {
    return Response.json({ error: String(err?.message || err).slice(0, 200) }, { status: 502, headers: { 'cache-control': 'no-store' } })
  }
}
