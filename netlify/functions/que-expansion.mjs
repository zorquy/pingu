// Las cinco rondas de «¿De qué expansión es?» (tanda 835).
//
// La primera petición del día elige cinco cartas occidentales del TCG, con
// foto y de cinco expansiones distintas a la vista, y para cada una tres
// expansiones más de su era (`opcionesDeExpansion`). Lo deja en
// `retos_reto_del_dia` (juego 'expansion') y las demás leen. Sin la
// migración se elige igual y no se guarda.
//
// Patrón inyectable: `pedir` y `guardar` se cambian en las pruebas.
//
// Y desde la 1111, la foto se PREGUNTA (`netlify/lib/fotos-reto.mjs`): una
// columna de foto llena no es una foto que exista, y el reto #91 enseñó el
// dorso en la carta 2. Con `revisar` (el navegador ha visto una sin foto),
// las rondas sin foto del día guardado se cambian por otras y se reescribe.
import { indicesDelDia } from '../../js/mas-caro.js'
import { opcionesDeExpansion, numeroDelDia, RONDAS } from '../../js/que-expansion.js'
import { esDelTCG, ID_DE_POCKET, plegarHermanos, padreDeColeccion } from '../../js/catalogo-series.js'
import { hoyUTC, segundosHastaManana, rest, libreDePeticion, CABECERAS_LIBRE } from './mas-caro.mjs'
import { diaLibre } from '../../js/retos-libre.js'
import { conFoto, sinFoto, revisarDePeticion, CABECERAS_REVISADO } from '../lib/fotos-reto.mjs'

export const JUEGO = 'expansion'
export const CANDIDATAS = 20
export const SAL = 12000
// Las cartas que sustituyen a las que no tenían foto salen de otra tirada.
export const SAL_REPARO = 62000
// Del TCG, con foto y de un set que se ve.
export const FILTRO_CARTAS = `market=eq.WEST&or=(image_path.not.is.null,image_scrydex.not.is.null,image_tcggo.not.is.null)&set_id=not.imatch.${encodeURIComponent(ID_DE_POCKET.source)}&tcg_sets.oculto=is.false`
export const COLUMNAS_CARTA = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,tcg_sets!inner(name,name_en,tcg_online_code,serie_id,oculto)'
export const COLUMNAS_SET = 'id,market,name,name_en,serie_id,release_date,logo_path,logo_scrydex,logo_tcggo,oculto,tcggo_id,card_count_official,card_count_total'

const sinTabla = (e) => /retos_reto_del_dia|42P01|PGRST205/.test(String(e?.message || e))
const enLista = (ids) => ids.map((id) => `"${String(id).replace(/"/g, '')}"`).join(',')

// Con `libre` (988), una partida libre: el día suyo, sin la tabla del día.
export async function elegirExpansion({ dia, pedir, guardar, actualizar = null, libre = null, revisar = false, probar }) {
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
  // Hasta `cuantas` cartas nuevas con foto, cada una de una expansión que no
  // esté ya en `ocupadas`. Las candidatas se piden a la vez y en su orden.
  const nuevas = async (cuantas, { sal = SAL, ocupadas = [], fuera = [] } = {}) => {
    const { total } = await pedir(`tcg_cards?select=id,tcg_sets!inner(oculto)&${FILTRO_CARTAS}&limit=1`, { cabeceras: { prefer: 'count=exact' } })
    if (!total) return []
    const filas = await Promise.all(indicesDelDia(dia, total, Math.min(CANDIDATAS, total), sal)
      .map((i) => pedir(`tcg_cards?select=${COLUMNAS_CARTA}&${FILTRO_CARTAS}&order=id.asc&limit=1&offset=${i}`).then((r) => r.datos?.[0] || null)))
    const usadas = [...ocupadas]
    const elegidas = []
    for (const c of await conFoto(filas.filter((c) => c?.id && !fuera.includes(c.id)), { probar })) {
      if (elegidas.length >= cuantas) break
      const e = expansionDe(c.set_id)
      if (!e || usadas.includes(e)) continue
      usadas.push(e)
      elegidas.push(c)
    }
    return elegidas
  }
  let rondas = null
  let datos = null
  // Revisado (`revisar`): las que siguen sin foto aunque se haya intentado
  // cambiarlas. El navegador solo cierra el reto si esto no está vacío.
  let quedanSinFoto = []
  if (!libre) try {
    const g = (await pedir(`retos_reto_del_dia?select=datos&juego=eq.${JUEGO}&day=eq.${dia}&limit=1`)).datos
    datos = g?.[0]?.datos || null
    rondas = Array.isArray(datos?.rondas) ? datos.rondas : null
  } catch (e) {
    if (!sinTabla(e)) throw e
  }
  if (!rondas?.length) {
    const elegidas = await nuevas(RONDAS)
    if (elegidas.length < RONDAS) return { error: 'No se han podido elegir cinco cartas.' }
    rondas = elegidas.map((c, r) => ({ card_id: c.id, set_ids: opcionesDeExpansion(expansionDe(c.set_id), sets, dia, r).map((s) => s.id) }))
    if (!libre) try {
      await guardar('retos_reto_del_dia', { juego: JUEGO, day: dia, datos: { rondas } })
      const otra = (await pedir(`retos_reto_del_dia?select=datos&juego=eq.${JUEGO}&day=eq.${dia}&limit=1`)).datos
      if (Array.isArray(otra?.[0]?.datos?.rondas) && otra[0].datos.rondas.length) rondas = otra[0].datos.rondas
    } catch (e) {
      if (!sinTabla(e)) throw e
    }
  } else if (revisar && actualizar) {
    // El día guardado, revisado: cada ronda sin foto (o cuya carta ya no
    // está) se cambia en su sitio, y las demás se quedan como estaban —quien
    // ya contestó la 1 la tiene bien contestada—.
    const actuales = (await pedir(`tcg_cards?select=${COLUMNAS_CARTA}&market=eq.WEST&id=in.(${enLista(rondas.map((r) => r.card_id))})`)).datos || []
    const malas = new Set(await sinFoto(actuales, { probar }))
    const hay = new Set(actuales.map((c) => c.id))
    const cambiar = rondas.map((r, i) => (malas.has(r.card_id) || !hay.has(r.card_id) ? i : -1)).filter((i) => i >= 0)
    if (cambiar.length) {
      const quedan = rondas.filter((_, i) => !cambiar.includes(i))
      const porId = new Map(actuales.map((c) => [c.id, c]))
      const otras = await nuevas(cambiar.length, { sal: SAL_REPARO, ocupadas: quedan.map((r) => expansionDe(porId.get(r.card_id)?.set_id)).filter(Boolean), fuera: rondas.map((r) => r.card_id) })
      if (otras.length === cambiar.length) {
        rondas = rondas.map((r, i) => {
          const k = cambiar.indexOf(i)
          return k < 0 ? r : { card_id: otras[k].id, set_ids: opcionesDeExpansion(expansionDe(otras[k].set_id), sets, dia, i).map((s) => s.id) }
        })
        try {
          await actualizar('retos_reto_del_dia', `juego=eq.${JUEGO}&day=eq.${dia}`, { datos: { ...(datos || {}), rondas, cambiadas: [...(datos?.cambiadas || []), ...cambiar] } })
        } catch (e) {
          if (!sinTabla(e)) throw e
        }
      } else quedanSinFoto = [...malas]
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
  return libre ? { dia, libre, rondas: fuera } : { dia, numero: numeroDelDia(dia), rondas: fuera, ...(revisar ? { sinFoto: quedanSinFoto } : {}) }
}

export default async (req) => {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return Response.json({ error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' }, { status: 500 })
  const libre = libreDePeticion(req)
  const revisar = !libre && revisarDePeticion(req)
  try {
    const r = await elegirExpansion({
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
