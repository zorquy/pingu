// EL VALOR DE CADA EXPANSIÓN EN EL TIEMPO (tanda 1365, la E y la F de «Lo
// nuevo de la API de TCGGO»; PINGU: «las dos, y el sellado semanal»).
//
// TCGGO abrió `/episodes/{id}/history-prices`: la suma de los mínimos de las
// cartas de una expansión día a día y, con `scope=products`, la de sus
// productos sellados. Nosotros solo teníamos ese valor desde la 646 (octubre
// de 2026), porque lo apunta la pasada de precios un día tras otro. Esta
// pasada:
//
//   · CARTAS (E): pide el último año de cada expansión UNA vez y lo mete en
//     `tcg_set_valor.valor_cm` día a día (con el último valor en los huecos,
//     `diaPorDia`). No pisa ningún día que ya tengamos: lo de la pasada de
//     precios manda.
//   · SELLADO (F): lo mismo con `scope=products` en `valor_sellado`, la
//     primera vez el año entero y después UNA VEZ A LA SEMANA desde el último
//     día guardado. La lista diaria de TCGGO no trae este total.
//
// Coste: el histórico viene en páginas de 30 fechas, así que un año son unas
// doce peticiones por expansión. Por eso va despacio: cada 20 minutos, como mucho
// `POR_PASADA` peticiones cada 20 minutos, y un tope diario
// (`TCGGO_TOPE_VALOR_HISTORICO`, 1.000 de serie, de las 15.000 del plan). Las expansiones más nuevas primero. Rellenar el pasado de
// todas lleva unos días; después solo queda la vuelta semanal del sellado.
// Lo que se paga cuenta ANTES de pedir (la 522), y un 429/403 del plan para
// hasta mañana. Estado en `scrydex_estado` → `tcggo_valor_historico`, que
// /admin lee (`PASADAS`).
//
// Sin la migración 1365 no existe `valor_sellado`: la parte de las cartas
// funciona igual y la del sellado se salta diciéndolo.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY; opcionales
// TCGGO_BASE, TCGGO_TOPE_VALOR_HISTORICO, TCGGO_PAUSA_MS.

import { cabeceras, baseDe, baseJpDe, esLimiteDelPlan, hayMasPaginas, urlValorDeEpisodio, puntosDeValor, diaPorDia } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_valor_historico'
export const TOPE_DIARIO = 1000
export const POR_PASADA = 30
export const DIAS_ATRAS = 365
export const DIAS_SELLADO = 7
// Las páginas de una expansión, como mucho (un año son ~12; con margen).
const MAX_PAGINAS = 20
const MS_DE_MARGEN = 20_000
const PAUSA_MS = 300

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

const diaDe = (d) => d.toISOString().slice(0, 10)
const restar = (ahora, dias) => diaDe(new Date(ahora.getTime() - dias * 86_400_000))

// Lo que toca hacer, en orden: primero el pasado de las CARTAS de cada
// expansión (lo más nuevo primero), después el SELLADO de las que no lo
// tienen o lo tienen de hace una semana o más. Puro.
export function trabajoPendiente(expansiones, estado, ahora = new Date()) {
  const hoy = diaDe(ahora)
  const cartas = estado?.cartas || {}
  const sellado = estado?.sellado || {}
  const sinSellado = estado?.sinSellado === hoy
  const lista = []
  // Una que falló (TCGGO no la tenía, un 500 suyo) se vuelve a mirar a la
  // semana, no en cada pasada.
  const fallida = (v) => typeof v === 'string' && v.startsWith('fallo ') && (ahora.getTime() - new Date(`${v.slice(6)}T00:00:00Z`).getTime()) / 86_400_000 >= DIAS_SELLADO
  for (const e of expansiones) if (!cartas[e.clave] || fallida(cartas[e.clave])) lista.push({ ...e, tipo: 'cartas' })
  if (!sinSellado) {
    for (const e of expansiones) {
      const ultima = sellado[e.clave]?.pedido
      if (!ultima || (ahora.getTime() - new Date(`${ultima}T00:00:00Z`).getTime()) / 86_400_000 >= DIAS_SELLADO) lista.push({ ...e, tipo: 'sellado' })
    }
  }
  return lista
}

// Las expansiones: una por (catálogo, id de TCGGO), con los sets nuestros que
// cuelgan de ella. Las más nuevas primero (son las que más se miran).
export function expansionesDe(sets) {
  const m = new Map()
  for (const s of sets || []) {
    const id = Number(s?.tcggo_id)
    if (!Number.isInteger(id) || id <= 0 || !s?.id) continue
    const market = s.market || 'WEST'
    const clave = `${market}:${id}`
    if (!m.has(clave)) m.set(clave, { clave, market, tcggoId: id, sets: [], fecha: '' })
    const e = m.get(clave)
    e.sets.push(s.id)
    if (String(s.release_date || '') > e.fecha) e.fecha = String(s.release_date || '')
  }
  return [...m.values()].sort((a, b) => b.fecha.localeCompare(a.fecha) || a.clave.localeCompare(b.clave))
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  ahora = new Date(), reloj = () => Date.now(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: true, saltado: 'falta SUPABASE_SERVICE_ROLE_KEY' }
  if (!env.TCGGO_API_KEY) return { ok: true, saltado: 'falta TCGGO_API_KEY en Netlify' }
  const pedir = restImpl || ((ruta, o) => rest(ruta, clave, o))
  const leerEstado = estadoImpl || (async () => (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]) }))
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN
  const pausaMs = env.TCGGO_PAUSA_MS !== undefined && env.TCGGO_PAUSA_MS !== '' && Number(env.TCGGO_PAUSA_MS) >= 0 ? Number(env.TCGGO_PAUSA_MS) : PAUSA_MS
  const hoy = diaDe(ahora)

  let estado
  try { estado = await leerEstado() } catch (e) { return { ok: false, error: String(e?.message || e).slice(0, 200) } }
  estado = estado && typeof estado === 'object' ? estado : {}
  estado.cartas = estado.cartas || {}
  estado.sellado = estado.sellado || {}
  if (estado.dia !== hoy) Object.assign(estado, { dia: hoy, peticiones: 0 })
  const persistir = () => guardarEstado(estado).catch(() => {})
  if (estado.planBloqueado?.dia === hoy) return { ok: true, saltado: 'el plan de TCGGO no da más por hoy' }
  const tope = Math.max(1, Number(env.TCGGO_TOPE_VALOR_HISTORICO) || TOPE_DIARIO)

  let sets
  try {
    sets = (await pedir('tcg_sets?select=id,market,tcggo_id,release_date&tcggo_id=not.is.null&limit=3000')) || []
  } catch (e) {
    return { ok: false, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
  }
  const pendientes = trabajoPendiente(expansionesDe(sets), estado, ahora)
  // La que se quedó a medias va la primera, y sigue por su página (no se
  // vuelve a pagar lo ya pedido).
  const enCurso = estado.enCurso && pendientes.find((t) => t.clave === estado.enCurso.clave && t.tipo === estado.enCurso.tipo)
  if (enCurso) pendientes.splice(pendientes.indexOf(enCurso), 1), pendientes.unshift(enCurso)
  else delete estado.enCurso
  const hechas = []
  let gastadas = 0
  const { base, host } = baseDe(env)
  for (const tarea of pendientes) {
    if (gastadas >= POR_PASADA || estado.peticiones >= tope || !quedaTiempo()) break
    const baseDelCatalogo = tarea.market === 'JP' ? baseJpDe(base) : base
    const productos = tarea.tipo === 'sellado'
    // La primera vez, el último año; el sellado, después, desde un día antes
    // de lo último guardado (el último día se rehace: puede haber cambiado).
    const ultimo = productos ? estado.sellado[tarea.clave]?.hasta : null
    const sigue = estado.enCurso?.clave === tarea.clave && estado.enCurso?.tipo === tarea.tipo ? estado.enCurso : null
    const desde = sigue?.desde || (ultimo ? restar(new Date(`${ultimo}T00:00:00Z`), 1) : restar(ahora, DIAS_ATRAS))
    const puntos = Array.isArray(sigue?.puntos) ? [...sigue.puntos] : []
    let fallo = null
    for (let pagina = sigue?.pagina || 1; pagina <= MAX_PAGINAS; pagina++) {
      if (estado.peticiones >= tope || gastadas >= POR_PASADA || !quedaTiempo()) {
        estado.enCurso = { clave: tarea.clave, tipo: tarea.tipo, desde, pagina, puntos }
        fallo = 'a medias'
        break
      }
      estado.peticiones++
      gastadas++
      await persistir()
      const res = await fetchImpl(urlValorDeEpisodio(tarea.tcggoId, { desde, pagina, productos }, baseDelCatalogo), { headers: cabeceras(env.TCGGO_API_KEY, host) })
      const texto = await res.text()
      if (!res.ok) {
        if (esLimiteDelPlan(res.status, texto)) {
          estado.planBloqueado = { dia: hoy, motivo: `TCGGO ${res.status}` }
          await persistir()
          return { ok: true, parado: 'el plan de TCGGO no da más por hoy', hechas, gastadas }
        }
        fallo = `TCGGO ${res.status}`
        break
      }
      let datos
      try { datos = JSON.parse(texto) } catch { fallo = 'TCGGO ha contestado algo que no es JSON'; break }
      puntos.push(...puntosDeValor(datos))
      if (!hayMasPaginas(datos)) break
      if (pausaMs) await pausa(pausaMs)
    }
    if (fallo) {
      // A medias no se escribe (un trozo de año parecería el año entero): se
      // guarda lo pedido en `enCurso` y la pasada siguiente sigue por ahí. Un
      // fallo de TCGGO se apunta y esa expansión se intenta otro día.
      if (fallo !== 'a medias') {
        delete estado.enCurso
        estado.ultimoError = { fecha: ahora.toISOString(), expansion: tarea.clave, tipo: tarea.tipo, error: fallo }
        // Para no repetirla cada pasada: se da por mirada hoy.
        if (productos) estado.sellado[tarea.clave] = { ...(estado.sellado[tarea.clave] || {}), pedido: hoy }
        else estado.cartas[tarea.clave] = `fallo ${hoy}`
      }
      await persistir()
      if (fallo === 'a medias') break
      continue
    }
    delete estado.enCurso
    const dias = diaPorDia(puntos)
    try {
      if (productos) {
        const filas = tarea.sets.flatMap((setId) => dias.filter((d) => d.cm).map((d) => ({ set_id: setId, market: tarea.market, dia: d.dia, valor_sellado: d.cm })))
        for (let k = 0; k < filas.length; k += 500) await pedir('tcg_set_valor', { method: 'POST', body: JSON.stringify(filas.slice(k, k + 500)) })
        estado.sellado[tarea.clave] = { pedido: hoy, hasta: dias.length ? dias[dias.length - 1].dia : ultimo || null, dias: dias.length }
      } else {
        // Los días que ya tenemos con cifra no se tocan: manda la pasada de
        // precios (es el valor de ese día, no una muestra rellenada).
        const filas = []
        for (const setId of tarea.sets) {
          const ya = new Set(((await pedir(`tcg_set_valor?select=dia&set_id=eq.${encodeURIComponent(setId)}&market=eq.${tarea.market}&valor_cm=not.is.null&dia=gte.${desde}&limit=1000`)) || []).map((f) => String(f.dia).slice(0, 10)))
          for (const d of dias) if (d.cm && !ya.has(d.dia)) filas.push({ set_id: setId, market: tarea.market, dia: d.dia, valor_cm: d.cm, valor_tp: d.tp, origen: 'tcggo-historico' })
        }
        for (let k = 0; k < filas.length; k += 500) await pedir('tcg_set_valor', { method: 'POST', body: JSON.stringify(filas.slice(k, k + 500)) })
        estado.cartas[tarea.clave] = hoy
      }
      hechas.push({ expansion: tarea.clave, tipo: tarea.tipo, dias: dias.length })
    } catch (e) {
      const m = String(e?.message || e)
      // Sin la columna del sellado (la migración 1365), hoy no se hace más
      // sellado; las cartas siguen.
      if (productos && /valor_sellado|PGRST204|42703/.test(m)) { estado.sinSellado = hoy; estado.ultimoError = { fecha: ahora.toISOString(), error: 'falta ejecutar supabase-migration-1365-valor-de-expansiones.sql (valor_sellado)' }; await persistir(); continue }
      estado.ultimoError = { fecha: ahora.toISOString(), expansion: tarea.clave, tipo: tarea.tipo, error: `nuestra base: ${m.slice(0, 160)}` }
      await persistir()
      return { ok: false, error: estado.ultimoError.error, hechas, gastadas }
    }
    await persistir()
  }
  const quedan = trabajoPendiente(expansionesDe(sets), estado, ahora).length
  estado.hecho = quedan === 0
  estado.quedan = quedan
  await persistir()
  return { ok: true, hechas, gastadas, peticionesHoy: estado.peticiones, quedan }
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('tcggo-valor-historico:', JSON.stringify(r).slice(0, 600))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada 20 minutos, a los 11, 31 y 51 (lejos de la de precios y del
// catálogo): 72 despertares al día. Con todo hecho, una pasada lee el estado y
// su lista de sets y se va; el resto del tiempo, la vuelta semanal del sellado.
export const config = { schedule: '11-59/20 * * * *' }
