// Los precios por idioma, desde TCGGO, cada día (tanda 589).
//
// Por cada expansión suya con la que ya hay sets emparejados (lo que dejó
// `tcggo-emparejar` en `scrydex_estado` → `tcggo_pares`), se piden sus
// cartas (100 por página) y a cada carta nuestra con ese `cardmarket_id`
// se le escribe la fila de `tcg_card_prices`: el mínimo Near Mint de
// Cardmarket en cada idioma, las medias, cuántas hay a la venta,
// TCGplayer en euros y las gradeadas. Y el primer día que pasa por cada
// expansión apunta en `tcg_sets` su logo, su id y —si los nuestros
// estaban vacíos— la fecha y el total.
//
// ── UNA VEZ AL DÍA, EN VARIAS PASADAS ──
//
// Cada cinco minutos mira qué expansiones faltan hoy y hace las que le
// quepan en 20 s (con la pausa del plan entre peticiones). El estado
// (`tcggo_precios`: { dia, hechos: [idExpansion…], gasto }) dice por
// dónde va; al acabar todas, marca el día y no pide nada más hasta
// mañana. ~300 peticiones al día en total.
//
// Los frenos son los de `tcggo-emparejar`: tope diario propio (de serie
// el del plan gratis; `TCGGO_TOPE_DIARIO` lo sube), pausa, y parar en
// 429/403. Y si TCGGO contesta una expansión sin un solo `cardmarket_id`,
// se para y lo dice: un vacío no es una respuesta.
//
// A mano desde /admin la lanza `tcggo-precios-ahora` (misma `procesar`):
// una función con `schedule` no admite llamadas por HTTP (Netlify da 403).
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_DIARIO, TCGGO_PAUSA_MS.
import {
  cabeceras, baseDe, baseJpDe, urlEpisodios, urlCartasDeEpisodio, hayMasPaginas, resumirEpisodio, esLimiteDelPlan, POR_PAGINA_CARTAS, filaDePreciosTcggo, filaDeSetTcggo,
} from '../lib/tcggo.mjs'
import { CLAVE_ESTADO as CLAVE_PARES, TOPE_DIARIO, PAUSA_MS } from './tcggo-emparejar.mjs'
// Solo la clave: importar la función sería un ciclo.
const CLAVE_CATALOGO = 'tcggo_catalogo'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_precios'
const MS_DE_MARGEN = 20_000

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

export const hoyUTC = () => new Date().toISOString().slice(0, 10)

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarImpl = null, guardarSetsImpl = null, fotoImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  reloj = () => Date.now(), ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)),
  peticiones = 60,
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) return { ok: true, saltado: 'falta TCGGO_API_KEY en Netlify' }
  const pausaMs = env.TCGGO_PAUSA_MS !== undefined && env.TCGGO_PAUSA_MS !== '' && Number(env.TCGGO_PAUSA_MS) >= 0 ? Number(env.TCGGO_PAUSA_MS) : PAUSA_MS
  const topeDiario = Math.max(1, Number(env.TCGGO_TOPE_DIARIO) || TOPE_DIARIO)
  const tope = Math.max(1, Math.min(60, Number(peticiones) || 60))
  const { base, host } = baseDe(env)
  const bases = { WEST: base, JP: baseJpDe(base) }
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN
  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const guardar = guardarImpl || ((filas) => rest('tcg_card_prices', clave, { method: 'POST', body: JSON.stringify(filas) }))
  const guardarSets = guardarSetsImpl || ((sets, mercado = 'WEST') => rest('rpc/tcggo_guardar_sets', clave, { method: 'POST', body: JSON.stringify({ p_sets: sets, p_market: mercado }) }))
  // La foto del histórico (643): una fila de hoy por carta que alguien tiene.
  const foto = fotoImpl || ((d) => rest('rpc/historial_foto_diaria', clave, { method: 'POST', body: JSON.stringify({ p_dia: d }) }))
  const leerEstado = estadoImpl || (async (claveEstado) => (await pedir(`scrydex_estado?select=valor&clave=eq.${claveEstado}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((claveEstado, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: claveEstado, valor, updated_at: new Date().toISOString() }]) }))
  const dia = ahora.toISOString().slice(0, 10)

  // ── Los dos estados: los pares (qué set es qué expansión) y el nuestro ──
  let pares
  let catalogo
  let estado
  try {
    pares = await leerEstado(CLAVE_PARES)
    catalogo = await leerEstado(CLAVE_CATALOGO)
    estado = await leerEstado(CLAVE_ESTADO)
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  const hechosPares = pares?.hechos && typeof pares.hechos === 'object' ? pares.hechos : {}
  const episodios = Array.isArray(pares?.episodios?.lista) ? pares.episodios.lista : []
  if (!Object.keys(hechosPares).length) return { ok: true, saltado: 'todavía no hay sets emparejados con TCGGO (/admin → Cartas → Emparejar con TCGGO)' }

  estado = estado && typeof estado === 'object' ? estado : {}
  if (estado.dia !== dia) estado = { ...estado, dia, hechos: [], hechosJp: [], setsApuntados: false }
  if (!Array.isArray(estado.hechos)) estado.hechos = []
  if (!Array.isArray(estado.hechosJp)) estado.hechosJp = []
  if (estado.gasto?.dia !== dia) estado.gasto = { dia, peticiones: 0 }
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)

  // Qué sets nuestros cuelgan de cada expansión suya (varios pueden: Crown
  // Zenith y su Galarian Gallery). Los sospechosos, fuera.
  const setsPorEpisodio = new Map()
  for (const [setId, h] of Object.entries(hechosPares)) {
    if (!h || h.sospechoso || !Number.isInteger(h.episodio)) continue
    if (!setsPorEpisodio.has(h.episodio)) setsPorEpisodio.set(h.episodio, [])
    setsPorEpisodio.get(h.episodio).push(setId)
  }
  // Y las japonesas (642): las que `tcggo-catalogo` ha casado con un set.
  const setsPorEpisodioJp = new Map()
  for (const [id, sets] of Object.entries(catalogo?.setsPorEpisodio?.JP || {})) {
    if (Array.isArray(sets) && sets.length) setsPorEpisodioJp.set(Number(id), sets)
  }
  const pendientes = [...setsPorEpisodio.keys()].filter((id) => !estado.hechos.includes(id))
  const pendientesJp = [...setsPorEpisodioJp.keys()].filter((id) => !estado.hechosJp.includes(id))
  if (!pendientes.length && !pendientesJp.length) {
    if (!estado.hecho) { estado.hecho = true; await persistir() }
    return { ok: true, dia, hecho: true, saltado: `los precios de ${dia} ya están puestos`, episodios: setsPorEpisodio.size + setsPorEpisodioJp.size }
  }
  estado.hecho = false

  // ── Pedir a TCGGO, contando ──
  let gastadas = 0
  let parado = null
  const pedirTcggo = async (url) => {
    if (gastadas >= tope) return { fin: 'tope' }
    if (estado.gasto.peticiones >= topeDiario) {
      parado = `tope diario: hoy ya van ${estado.gasto.peticiones} peticiones de ${topeDiario}`
      return { fin: 'dia' }
    }
    if (!quedaTiempo()) return { fin: 'tiempo' }
    if (gastadas && pausaMs) await pausa(pausaMs)
    gastadas++
    estado.gasto.peticiones++
    const res = await fetchImpl(url, { headers: cabeceras(claveTcggo, host) })
    const texto = await res.text()
    if (!res.ok) {
      parado = esLimiteDelPlan(res.status, texto) ? `RapidAPI ${res.status}: el plan no da más por ahora` : `TCGGO ${res.status}: ${texto.slice(0, 160)}`
      return { fin: 'error' }
    }
    try {
      return { datos: JSON.parse(texto) }
    } catch {
      parado = 'TCGGO ha contestado algo que no es JSON'
      return { fin: 'error' }
    }
  }

  // ── Los sets: logo, fecha y total, una vez al día ──
  // La lista de expansiones en el estado de los pares puede no traer el
  // logo (se guardó antes de la 589): entonces se vuelve a pedir, que son
  // nueve peticiones una vez a la semana.
  let setsApuntados = 0
  if (!estado.setsApuntados) {
    let lista = episodios
    if (lista.length && !lista.some((e) => e.logo)) {
      const nueva = []
      let pagina = 1
      let completa = false
      for (;;) {
        const r = await pedirTcggo(urlEpisodios(pagina, base))
        if (!r.datos) break
        for (const e of r.datos.data || []) nueva.push(resumirEpisodio(e))
        if (!hayMasPaginas(r.datos) || !(r.datos.data || []).length) { completa = true; break }
        pagina++
      }
      if (completa) {
        lista = nueva
        pares.episodios = { fecha: ahora.toISOString(), lista }
        try { await guardarEstado(CLAVE_PARES, pares) } catch { /* se vuelve a pedir la próxima */ }
      } else lista = []
    }
    if (lista.length) {
      const porId = new Map(lista.map((e) => [e.id, e]))
      const filas = []
      for (const [idEpisodio, sets] of setsPorEpisodio) {
        const e = porId.get(idEpisodio)
        if (!e) continue
        for (const setId of sets) filas.push(filaDeSetTcggo(setId, e))
      }
      if (filas.length) {
        try {
          setsApuntados = Number(await guardarSets(filas, 'WEST')) || 0
          estado.setsApuntados = true
        } catch (e) {
          const m = String(e?.message || e)
          if (/tcggo_guardar_sets|42883|PGRST202/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-tcggo-precios.sql (tcggo_guardar_sets)' }
          return { ok: false, error: m.slice(0, 200) }
        }
      }
    }
    // Y los sets JAPONESES (646), con la lista que guarda el catálogo: su
    // valor sale igual, y si la lista es de antes de la 646 va sin él.
    const listaJp = Array.isArray(catalogo?.episodiosJp?.lista) ? catalogo.episodiosJp.lista : []
    if (listaJp.length && setsPorEpisodioJp.size) {
      const porIdJp = new Map(listaJp.map((e) => [e.id, e]))
      const filasJp = []
      for (const [idEpisodio, sets] of setsPorEpisodioJp) {
        const e = porIdJp.get(idEpisodio)
        if (!e) continue
        for (const setId of sets) filasJp.push(filaDeSetTcggo(setId, e))
      }
      if (filasJp.length) {
        try {
          setsApuntados += Number(await guardarSets(filasJp, 'JP')) || 0
        } catch { /* los japoneses no paran la pasada de precios */ }
      }
    }
    await persistir()
  }

  // ── Expansión a expansión: primero las occidentales, luego las japonesas ──
  let escritas = 0
  let sinPar = 0
  const hechasAhora = []
  const tandas = [
    { mercado: 'WEST', pendientes, mapa: setsPorEpisodio, hechos: estado.hechos },
    { mercado: 'JP', pendientes: pendientesJp, mapa: setsPorEpisodioJp, hechos: estado.hechosJp },
  ]
  for (const { mercado, pendientes: lista, mapa, hechos } of tandas) for (const idEpisodio of lista) {
    if (parado || gastadas >= tope || !quedaTiempo()) break
    const suyas = []
    let pagina = 1
    let completo = false
    for (;;) {
      const r = await pedirTcggo(urlCartasDeEpisodio(idEpisodio, pagina, bases[mercado]))
      if (!r.datos) break
      suyas.push(...(r.datos.data || []))
      if (!hayMasPaginas(r.datos) || (r.datos.data || []).length < POR_PAGINA_CARTAS) { completo = true; break }
      pagina++
    }
    if (!completo) break
    if (suyas.length && !suyas.some((s) => s.cardmarket_id)) {
      parado = `TCGGO devuelve la expansión ${idEpisodio} sin cardmarket_id: no se escribe nada`
      break
    }
    const porProducto = new Map()
    for (const s of suyas) {
      const id = Number(s.cardmarket_id)
      if (Number.isInteger(id) && id > 0 && !porProducto.has(id)) porProducto.set(id, s)
    }
    // Nuestras cartas de los sets que cuelgan de esta expansión.
    const sets = mapa.get(idEpisodio) || []
    let cartas
    try {
      cartas = await pedir(`tcg_cards?select=id,cm_id_product_propio&market=eq.${mercado}&cm_id_product_propio=not.is.null&set_id=in.(${sets.map((s) => `"${encodeURIComponent(s)}"`).join(',')})&limit=5000`)
    } catch (e) {
      return { ok: false, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}`, dia }
    }
    const filas = []
    for (const c of cartas || []) {
      const s = porProducto.get(Number(c.cm_id_product_propio))
      if (!s) { sinPar++; continue }
      filas.push(filaDePreciosTcggo(c.id, s, { ahora, mercado }))
    }
    if (filas.length) {
      try {
        for (let k = 0; k < filas.length; k += 500) await guardar(filas.slice(k, k + 500))
      } catch (e) {
        const m = String(e?.message || e)
        if (/cm_low_es|PGRST204|42703/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-tcggo-precios.sql', dia }
        return { ok: false, error: `nuestra base al escribir: ${m.slice(0, 160)}`, dia }
      }
      escritas += filas.length
    }
    hechos.push(idEpisodio)
    hechasAhora.push({ mercado, episodio: idEpisodio, sets, suyas: suyas.length, nuestras: (cartas || []).length, escritas: filas.length })
    await persistir()
  }
  const quedan = [...setsPorEpisodio.keys()].filter((id) => !estado.hechos.includes(id)).length + [...setsPorEpisodioJp.keys()].filter((id) => !estado.hechosJp.includes(id)).length
  let fotoHistorial = null
  if (!quedan && !parado) {
    estado.hecho = true
    // Con el día entero escrito, la foto del histórico: cero peticiones.
    // Si falta su migración, se dice y no pasa nada más.
    try {
      fotoHistorial = Number(await foto(dia)) || 0
    } catch (e) {
      fotoHistorial = /historial_foto_diaria|42883|PGRST202/.test(String(e?.message || e)) ? 'falta ejecutar supabase-migration-tcggo-historial.sql' : String(e?.message || e).slice(0, 120)
    }
  }
  await persistir()
  return {
    ok: true, dia, hecho: !quedan && !parado, fotoHistorial, peticionesEstaPasada: gastadas, peticionesHoy: estado.gasto.peticiones, topeDiario, pausaMs, puerta: base,
    episodios: setsPorEpisodio.size + setsPorEpisodioJp.size, hechasHoy: estado.hechos.length + estado.hechosJp.length, quedan, escritas, sinPar, setsApuntados, hechasAhora, parado,
    ...(quedan && !parado ? { nota: 'sin tiempo o sin peticiones: sigue en la próxima pasada' } : {}),
  }
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('tcggo-precios:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada cinco minutos: cuando el día está hecho, una pasada es una lectura
// del estado y nada más. Medido el 2026-10-05: en 20 s caben ~6
// expansiones (lo que tarda no es TCGGO, son las tres idas a nuestra base
// por expansión), así que las ~170 son ~28 pasadas: dos horas y media
// solas, o nueve minutos desde el botón de /admin, que las encadena.
export const config = { schedule: '*/5 * * * *' }
