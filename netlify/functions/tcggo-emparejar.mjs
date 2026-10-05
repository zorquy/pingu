// Emparejar nuestras cartas con Cardmarket por TCGGO (tanda 588).
//
// Lo llama /admin → Cartas, «Emparejar con TCGGO». Para cada set nuestro
// busca su expansión en TCGGO (por el código de TCG Live, o por el nombre),
// pide sus cartas (100 por página) y casa cada una por NÚMERO; el
// `cardmarket_id` que trae cada carta suya se escribe en
// `tcg_cards.cm_id_product_propio` (la columna de la 587, por la misma
// función `cardmarket_guardar_pares`). Desde ahí, `cardmarket-precios`
// pone el precio bueno con la guía diaria gratuita de Cardmarket: TCGGO
// solo se paga UNA vez por set, no cada día.
//
// ── EL PLAN ES DE PAGO POR PETICIONES, ASÍ QUE SE CUENTAN ──
//
// El plan Basic de RapidAPI da 100 peticiones al DÍA y 30 por minuto, y
// COBRA las que pasen de 100 (0,005 $ cada una). Por eso hay dos frenos
// que no dependen de que «quede trabajo» (la lección de la 510: cuando el
// trabajo pendiente nunca llega a cero, el freno cuenta intentos): un tope
// diario en el estado (`TOPE_DIARIO`, 95) y una pausa entre peticiones
// (`PAUSA_MS`, 2,1 s: 28 por minuto como mucho). Los dos valen para el
// plan GRATIS, que es el que no puede fallar hacia arriba; con un plan de
// pago se suben por variables de entorno (TCGGO_TOPE_DIARIO y
// TCGGO_PAUSA_MS: PINGU está en Ultra, 15.000 al día y 300 por minuto, o
// sea 14.000 y 250). Y cada llamada recibe además su propio tope
// (`peticiones`, acotado a lo que cabe en 20 s con esa pausa) y para al
// llegar, al acabarse el tiempo, o si RapidAPI contesta que el plan se ha
// agotado (429 / 403): seguir pidiendo sería seguir gastando sin escribir. Lo hecho queda
// apuntado set a set en `scrydex_estado` (`tcggo_pares`), así que la
// llamada siguiente sigue por el primer set sin hacer, y la lista de
// expansiones suyas (9 páginas) se guarda una semana. Lo que no se vuelve
// a pedir: un set ya hecho (salvo `reiniciar`) y un set que no se pudo
// casar con ninguna expansión (se apunta con el motivo y se enseña).
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY; opcionales
// TCGGO_BASE (la puerta de RapidAPI, ver netlify/lib/tcggo.mjs) y
// TCGGO_TOPE_DIARIO.
import { idDeAdmin, tokenDe } from '../lib/admin.mjs'
import {
  cabeceras, baseDe, urlEpisodios, urlCartasDeEpisodio, hayMasPaginas, resumirEpisodio, episodioDeSet, emparejarPorNumero, esLimiteDelPlan, POR_PAGINA_CARTAS,
} from '../lib/tcggo.mjs'
import { CLAVE_ESTADO as CLAVE_GUIA } from './cardmarket-precios.mjs'
import { ID_DE_POCKET } from '../../js/catalogo-series.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_pares'
const MS_DE_MARGEN = 20_000
const DIAS_DE_EPISODIOS = 7
export const PETICIONES_POR_DEFECTO = 8
export const PETICIONES_MAXIMO = 60
export const TOPE_DIARIO = 95
// Entre petición y petición: 30 por minuto es el límite del plan gratis.
export const PAUSA_MS = 2_100
// Cuántas caben en una llamada con esa pausa (el margen son 20 s).
export const cabenEnUnaLlamada = (pausaMs) => Math.max(1, Math.min(PETICIONES_MAXIMO, Math.floor(19_000 / Math.max(1, pausaMs))))

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    ...(opciones || {}),
    headers: {
      apikey: clave,
      authorization: `Bearer ${clave}`,
      ...(opciones ? { 'content-type': 'application/json' } : {}),
      // El upsert del estado va por la clave primaria; a una RPC no se le
      // pide `return=minimal`, que se comería el número de filas que devuelve.
      ...(opciones && !ruta.startsWith('rpc/') ? { prefer: 'resolution=merge-duplicates,return=minimal' } : {}),
      ...(opciones?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const texto = await res.text()
  return texto ? JSON.parse(texto) : null
}

const diaDe = (fecha) => fecha.toISOString().slice(0, 10)

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  reloj = () => Date.now(), ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)),
  mercado = 'WEST', peticiones = PETICIONES_POR_DEFECTO, reiniciar = false, soloSets = null,
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { estado: 500, cuerpo: { error: 'Falta SUPABASE_SERVICE_ROLE_KEY.' } }
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) return { estado: 409, cuerpo: { error: 'Falta TCGGO_API_KEY en las variables de Netlify (la clave de RapidAPI).' } }
  const pausaMs = Math.max(0, Number(env.TCGGO_PAUSA_MS) >= 0 && env.TCGGO_PAUSA_MS !== undefined && env.TCGGO_PAUSA_MS !== '' ? Number(env.TCGGO_PAUSA_MS) : PAUSA_MS)
  const tope = Math.max(1, Math.min(cabenEnUnaLlamada(pausaMs), Number(peticiones) || PETICIONES_POR_DEFECTO))
  const topeDiario = Math.max(1, Number(env.TCGGO_TOPE_DIARIO) || TOPE_DIARIO)
  const { base, host } = baseDe(env)
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN
  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const guardar = guardarImpl || ((pares) => rest('rpc/cardmarket_guardar_pares', clave, { method: 'POST', body: JSON.stringify({ p_pares: pares, p_market: mercado }) }))
  const leerEstado = estadoImpl || (async () => (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((claveEstado, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: claveEstado, valor, updated_at: new Date().toISOString() }]) }))

  // ── El estado: qué hay hecho y cuánto se ha gastado ──
  let estado
  try {
    estado = await leerEstado()
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { estado: 409, cuerpo: { error: 'Falta la migración supabase-migration-scrydex-cartas.sql (scrydex_estado).' } }
    return { estado: 502, cuerpo: { error: m.slice(0, 200) } }
  }
  estado = estado && typeof estado === 'object' ? estado : {}
  if (reiniciar) estado = { ...estado, hechos: {}, sinEpisodio: {} }
  estado.hechos = estado.hechos && typeof estado.hechos === 'object' ? estado.hechos : {}
  estado.sinEpisodio = estado.sinEpisodio && typeof estado.sinEpisodio === 'object' ? estado.sinEpisodio : {}
  const dia = diaDe(ahora)
  if (estado.gasto?.dia !== dia) estado.gasto = { dia, peticiones: 0 }

  // ── Pedir a TCGGO, contando ──
  let gastadas = 0
  let parado = null
  const pedirTcggo = async (url) => {
    if (gastadas >= tope) return { fin: 'tope' }
    if (estado.gasto.peticiones >= topeDiario) {
      parado = `tope diario: hoy ya van ${estado.gasto.peticiones} peticiones de ${topeDiario} (el plan da 100 al día y cobra las de más). Mañana sigue solo.`
      return { fin: 'dia' }
    }
    if (!quedaTiempo()) return { fin: 'tiempo' }
    if (gastadas && pausaMs) await pausa(pausaMs)
    gastadas++
    estado.gasto.peticiones++
    const res = await fetchImpl(url, { headers: cabeceras(claveTcggo, host) })
    const texto = await res.text()
    if (!res.ok) {
      if (esLimiteDelPlan(res.status, texto)) {
        parado = `RapidAPI ${res.status}: el plan no da más por ahora (${texto.slice(0, 120)})`
        return { fin: 'plan' }
      }
      parado = `TCGGO ${res.status}: ${texto.slice(0, 160)}`
      return { fin: 'error' }
    }
    try {
      return { datos: JSON.parse(texto) }
    } catch {
      parado = 'TCGGO ha contestado algo que no es JSON'
      return { fin: 'error' }
    }
  }

  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)
  const esteTurno = []
  let escritas = 0
  let hayQueRefrescarLaGuia = false

  // ── Sus expansiones, una semana en el estado ──
  const edadDias = estado.episodios?.fecha ? (ahora.getTime() - new Date(estado.episodios.fecha).getTime()) / 86_400_000 : Infinity
  if (!Array.isArray(estado.episodios?.lista) || edadDias > DIAS_DE_EPISODIOS || reiniciar) {
    // Se reanuda por donde se quedó la llamada anterior (la lista a medias
    // no vale para decidir, pero sí para no volver a pedir sus páginas).
    const enCurso = !reiniciar && Array.isArray(estado.episodiosEnCurso?.lista) ? estado.episodiosEnCurso : null
    const lista = enCurso ? [...enCurso.lista] : []
    let pagina = enCurso ? Number(enCurso.siguientePagina) || 1 : 1
    let completa = false
    for (;;) {
      const r = await pedirTcggo(urlEpisodios(pagina, base))
      if (!r.datos) break
      for (const e of r.datos.data || []) lista.push(resumirEpisodio(e))
      if (!hayMasPaginas(r.datos) || !(r.datos.data || []).length) {
        completa = true
        break
      }
      pagina++
    }
    if (!completa) {
      // A medias no vale para decidir: una lista corta diría «ese set no
      // existe» de sets que sí existen. Se guarda aparte, para seguir.
      estado.episodiosEnCurso = { lista, siguientePagina: pagina }
      await persistir()
      return { estado: 200, cuerpo: { ...resumen(), siguiente: !parado, nota: parado ? 'la lista de expansiones se ha quedado a medias' : 'no ha dado tiempo (o peticiones) a bajar la lista de expansiones entera: vuelve a llamar' } }
    }
    estado.episodios = { fecha: ahora.toISOString(), lista }
    delete estado.episodiosEnCurso
    await persistir()
  }
  const episodios = estado.episodios.lista

  // ── Nuestros sets, los más nuevos primero ──
  let sets
  try {
    sets = await pedir(`tcg_sets?select=id,name,name_en,tcg_online_code,release_date,card_count_total&market=eq.${mercado}&order=release_date.desc.nullslast,id&limit=1000`)
  } catch (e) {
    return { estado: 502, cuerpo: { error: String(e?.message || e).slice(0, 200) } }
  }
  sets = (sets || []).filter((s) => !ID_DE_POCKET.test(String(s.id)))
  // «Solo estos sets»: se repiten aunque estén hechos (para rehacer uno
  // que salió mal sin volver a pedir los 177).
  const solo = Array.isArray(soloSets) && soloSets.length ? new Set(soloSets.map((x) => String(x).trim().toLowerCase()).filter(Boolean)) : null
  const idsNuestros = new Set(sets.map((s) => String(s.id).toLowerCase()))
  const pendientes = solo
    ? sets.filter((s) => solo.has(String(s.id).toLowerCase()))
    : sets.filter((s) => !estado.hechos[s.id] && !estado.sinEpisodio[s.id])

  for (const set of pendientes) {
    if (parado || gastadas >= tope || !quedaTiempo()) break
    const { episodio, por, porque } = episodioDeSet(set, episodios)
    if (!episodio) {
      estado.sinEpisodio[set.id] = { porque, nombre: set.name, codigo: set.tcg_online_code || null, fecha: ahora.toISOString() }
      esteTurno.push({ set: set.id, nombre: set.name, codigo: set.tcg_online_code || null, sinEpisodio: porque })
      continue
    }
    // Sus cartas, página a página. Si no caben en lo que queda, este set
    // no se apunta como hecho: se vuelve a pedir entero la próxima vez
    // (una página sola no es un set).
    const suyas = []
    let pagina = 1
    let completo = false
    for (;;) {
      const r = await pedirTcggo(urlCartasDeEpisodio(episodio.id, pagina, base))
      if (!r.datos) break
      suyas.push(...(r.datos.data || []))
      if (!hayMasPaginas(r.datos) || (r.datos.data || []).length < POR_PAGINA_CARTAS) {
        completo = true
        break
      }
      pagina++
    }
    if (!completo) break
    if (suyas.length && !suyas.some((s) => s.cardmarket_id)) {
      // Una respuesta sin un solo id no es «ninguna casa»: es que el
      // campo no viene. Se para y se enseña, no se apunta como hecho.
      parado = `TCGGO devuelve las cartas de «${episodio.nombre}» sin cardmarket_id: no se puede emparejar nada`
      break
    }
    let cartas
    try {
      cartas = await pedir(`tcg_cards?select=id,local_id,cm_id_product_propio&market=eq.${mercado}&set_id=eq.${encodeURIComponent(set.id)}&limit=2000`)
    } catch (e) {
      const m = String(e?.message || e)
      if (/cm_id_product_propio|42703/.test(m)) return { estado: 409, cuerpo: { error: 'Falta la migración supabase-migration-cardmarket-propio.sql. Ejecútala y vuelve.' } }
      parado = `nuestra base: ${m.slice(0, 160)}`
      break
    }
    const r = emparejarPorNumero(cartas || [], suyas, { setId: set.id })
    // La guarda: si las cartas suyas dicen ser de OTRO set nuestro (el
    // prefijo de su tcgid es el id de otro set de nuestra lista), la
    // expansión no es esta aunque el código casara. Es lo que habría parado
    // ex7 → Rising Rivals (sus cartas llevaban «pl2-…»).
    const ajeno = r.prefijoDominante && r.prefijoDominante !== String(set.id).toLowerCase() && idsNuestros.has(r.prefijoDominante) ? r.prefijoDominante : null
    const cambian = ajeno ? [] : r.pares.filter((p) => (cartas || []).find((c) => c.id === p.id)?.cm_id_product_propio !== p.idProduct)
    if (cambian.length) {
      try {
        for (let k = 0; k < cambian.length; k += 500) {
          const n = await guardar(cambian.slice(k, k + 500).map((p) => ({ id: p.id, id_product: p.idProduct, por: 'tcggo' })))
          escritas += Number(n) || 0
        }
      } catch (e) {
        parado = `nuestra base al escribir: ${String(e?.message || e).slice(0, 160)}`
        break
      }
      hayQueRefrescarLaGuia = true
    }
    const fila = {
      set: set.id, nombre: set.name, codigo: set.tcg_online_code || null, episodio: episodio.id, episodioNombre: episodio.nombre, por,
      nuestras: (cartas || []).length, suyas: suyas.length, pares: r.pares.length, sinPar: r.sinPar.length, sobran: r.sobran, escritas: cambian.length,
      porTcgid: r.pares.filter((p) => p.por === 'tcgid').length, porDigitos: r.pares.filter((p) => p.por === 'digitos').length,
      ejemplosSinPar: r.sinPar.slice(0, 5).map((s) => `${s.numero}: ${s.porque}`),
      ...(r.sinPar.length && r.ejemplosSuyos.length ? { numerosSuyosLibres: r.ejemplosSuyos } : {}),
      ...(ajeno ? { SOSPECHOSO: `sus cartas llevan el id de nuestro set «${ajeno}», no de «${set.id}»: no se escribe` } : {}),
    }
    estado.hechos[set.id] = { episodio: episodio.id, pares: r.pares.length, sinPar: r.sinPar.length, fecha: ahora.toISOString(), ...(ajeno ? { sospechoso: ajeno } : {}) }
    esteTurno.push(fila)
    await persistir()
  }
  await persistir()

  // Que la guía de precios vuelva a pasar hoy por las cartas que acaban de
  // ganar par: si ya había marcado el día como hecho, no volvería hasta
  // mañana. Se reabre y la pasada de la próxima hora las rellena.
  if (hayQueRefrescarLaGuia) {
    try {
      await guardarEstado(CLAVE_GUIA, { dia: ahora.toISOString().slice(0, 10), desde: 0, hecho: false, reabierta_por: 'tcggo-emparejar' })
    } catch { /* no es grave: mañana pasa igual */ }
  }

  function resumen() {
    const hechos = Object.keys(estado.hechos).length
    const sinEpisodio = Object.entries(estado.sinEpisodio).map(([id, v]) => ({ set: id, nombre: v.nombre, codigo: v.codigo, porque: v.porque }))
    return {
      puerta: base,
      pausaMs,
      peticionesEstaLlamada: gastadas,
      tope,
      peticionesHoy: estado.gasto.peticiones,
      topeDiario,
      episodios: estado.episodios?.lista?.length || 0,
      episodiosDe: estado.episodios?.fecha || null,
      setsHechos: hechos,
      setsSinEpisodio: sinEpisodio.length,
      sinEpisodio,
      esteTurno,
      escritas,
      parado,
    }
  }
  const res = resumen()
  const quedan = sets.filter((s) => !estado.hechos[s.id] && !estado.sinEpisodio[s.id]).length
  return { estado: 200, cuerpo: { ...res, nuestrosSets: sets.length, setsPendientes: quedan, siguiente: quedan > 0 && !parado } }
}

export default async (req) => {
  const json = (e, c) => new Response(JSON.stringify(c), { status: e, headers: { 'content-type': 'application/json' } })
  if (req.method !== 'POST') return json(405, { error: 'Método no permitido.' })
  if (!(await idDeAdmin(tokenDe(req)))) return json(401, { error: 'No autorizado.' })
  let cuerpo = {}
  try { cuerpo = await req.json() } catch { cuerpo = {} }
  try {
    const r = await procesar({ mercado: cuerpo.mercado || 'WEST', peticiones: cuerpo.peticiones, reiniciar: cuerpo.reiniciar === true, soloSets: Array.isArray(cuerpo.sets) ? cuerpo.sets.slice(0, 50) : null })
    return json(r.estado, r.cuerpo)
  } catch (e) {
    return json(502, { error: String(e?.message || e).slice(0, 300) })
  }
}
