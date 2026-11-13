// El catálogo desde TCGGO, cada semana (tanda 640).
//
// PINGU: «yo cogería todo de la nueva API, todo: desde los sets, las
// variantes, las promocionales de tiendas, las cartas de staff». Esta
// función recorre TODAS sus expansiones —las occidentales y las japonesas—
// y por cada carta suya:
//
//   · si ya la tenemos (por el id de Cardmarket que decidió el emparejador,
//     por su `tcgid` igual a nuestro id, o por el número dentro del set),
//     conserva NUESTRO id —la llave de las colecciones y de las URLs— y le
//     añade lo que TCGGO sabe: su id, su foto, los ids de producto si
//     faltaban, la rareza inglesa, los PS, el ilustrador;
//   · si no la tenemos, la CREA con id «tcggo-<id suyo>» en nuestro set
//     (o en un set nuevo, si la expansión tampoco existía).
//
// Lo escribe `tcggo_guardar_cartas` en la base, una sentencia por cientos
// de cartas; los sets nuevos, `tcggo_crear_sets`. Las cartas creadas
// llevan `origen = 'tcggo'` y el engorde de TCGdex no las visita.
//
// ── CADA SEMANA, EN MUCHAS PASADAS ──
//
// Una pasada son 20 s (~6 expansiones); las ~180 occidentales y las
// japonesas son unas 60 pasadas, cada cinco minutos: cinco horas, una
// vez por semana. El estado (`tcggo_catalogo`: { semana, hechos: { WEST:
// [...], JP: [...] }, episodiosJp, gasto }) dice por dónde va. Mismos
// frenos que las demás: tope diario, pausa del plan, parar en 429/403.
//
// ── LO QUE VA A SALIR (tanda 756) ──
//
// PINGU: «en lanzamientos quiero los próximos; TCGGO los tiene». Una
// expansión anunciada viene en su lista con fecha FUTURA y CERO cartas
// (Delta Reign: 2026-11-06, `cards_total: 0`, y en `/cards` solo sobres y
// cajas), y aquí una expansión de cero cartas se apuntaba sin más. Ahora,
// si su fecha es futura, se le crea su set —con nombre, código, fecha,
// logo y serie— ESCONDIDO: el catálogo no enseña una expansión vacía, el
// calendario sí (lee los escondidos futuros). Cuando TCGGO publica sus
// cartas, la lista lo dice (`cartas > 0`), la expansión deja de contar
// como hecha esa semana y sus cartas entran en ese set —por su `tcggo_id`—,
// que se enseña. Las dos listas de expansiones se piden cada día.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_DIARIO, TCGGO_PAUSA_MS.
import {
  cabeceras, baseDe, baseJpDe, urlEpisodios, urlCartasDeEpisodio, hayMasPaginas, anunciadasDe, resumirEpisodio, esLimiteDelPlan, POR_PAGINA_CARTAS,
  emparejarPorNumero, setDeEpisodio, serieDeEpisodio, filaDeSetNuevo, filaDeCartaTcggo, esCartaSuelta, separarVersiones, numeroComoLosNuestros,
} from '../lib/tcggo.mjs'
import { CLAVE_ESTADO as CLAVE_PARES, TOPE_DIARIO, PAUSA_MS } from './tcggo-emparejar.mjs'
import { setsHermanos } from '../../js/catalogo-series.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_catalogo'
const MS_DE_MARGEN = 20_000
export const DIAS_DE_EPISODIOS = 1
export const MERCADOS = ['WEST', 'JP']
// Cuántas veces se intenta escribir una expansión cuya escritura falla
// antes de saltarla (655). Ver el comentario en el `catch` de abajo.
export const MAXIMO_INTENTOS_EPISODIO = 3
// Cada vez que un arreglo deja escribir lo que fallaba, se sube y lo que
// estaba en `fallidos` se vuelve a pedir una vez.
export const REABRIR_FALLIDOS = 807
// Una expansión recién salida (1265): cuántos días se la mira por sí misma
// y cada cuántas horas, como mucho.
export const DIAS_DE_RECIEN = 14
export const HORAS_ENTRE_MIRADAS = 3
export function esRecienSalida(episodio, ahora) {
  const f = typeof episodio?.fecha === 'string' ? Date.parse(episodio.fecha.slice(0, 10) + 'T00:00:00Z') : NaN
  if (!Number.isFinite(f)) return false
  const dias = (ahora.getTime() - f) / 86_400_000
  return dias >= 0 && dias <= DIAS_DE_RECIEN
}

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

// La semana, como número: lo que hace que una pasada sepa si ya pasó.
// Lo que llega de /admin (1275): { mercado, id, set, nombre }, o null.
export function soloDe(e) {
  const id = Number(e?.id)
  if (!e || !Number.isInteger(id) || id <= 0) return null
  return { mercado: e.mercado === 'JP' ? 'JP' : 'WEST', id, set: e.set ? String(e.set) : null, nombre: String(e.nombre || '') }
}

export const semanaDe = (fecha) => Math.floor(fecha.getTime() / (7 * 86_400_000))

// Las filas NUEVAS que no han llegado a la base (1290): qué ids no están
// después de escribir y cuáles tienen lápida. Por trozos, que un `in.(…)`
// muy largo no cabe en la dirección.
export async function nuevasSinEscribir(pedir, filasNuevas, mercado) {
  const estan = new Set()
  const lapidas = new Set()
  for (let i = 0; i < filasNuevas.length; i += 80) {
    const ids = filasNuevas.slice(i, i + 80).map((f) => `"${encodeURIComponent(f.id)}"`).join(',')
    for (const x of (await pedir(`tcg_cards?select=id&market=eq.${mercado}&id=in.(${ids})`)) || []) estan.add(x.id)
    for (const x of (await pedir(`tcg_correcciones?select=id&tabla=eq.tcg_cards&columna=eq.__borrada&market=eq.${mercado}&id=in.(${ids})`)) || []) lapidas.add(x.id)
  }
  return filasNuevas.filter((f) => !estan.has(f.id)).map((f) => ({ id: f.id, numero: f.local_id || '', nombre: f.name || '', lapida: lapidas.has(f.id) }))
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarCartasImpl = null, crearSetsImpl = null, nombrarSetImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  reloj = () => Date.now(), ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)), peticiones = 60,
  soloEpisodio = null,
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  // «Actualizar desde TCGGO» de /admin → Colecciones (1275): UNA expansión,
  // aunque esté hecha esta semana, con la lista guardada (o sin ella) y sin
  // pedir ninguna otra. Lo demás es la pasada de siempre.
  const solo = soloDe(soloEpisodio)
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) return { ok: true, saltado: 'falta TCGGO_API_KEY en Netlify' }
  const pausaMs = env.TCGGO_PAUSA_MS !== undefined && env.TCGGO_PAUSA_MS !== '' && Number(env.TCGGO_PAUSA_MS) >= 0 ? Number(env.TCGGO_PAUSA_MS) : PAUSA_MS
  const topeDiario = Math.max(1, Number(env.TCGGO_TOPE_DIARIO) || TOPE_DIARIO)
  const tope = Math.max(1, Math.min(60, Number(peticiones) || 60))
  const { base, host } = baseDe(env)
  const bases = { WEST: base, JP: baseJpDe(base) }
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const guardarCartas = guardarCartasImpl || ((filas, mercado) => rest('rpc/tcggo_guardar_cartas', clave, { method: 'POST', body: JSON.stringify({ p_cartas: filas, p_market: mercado }) }))
  const crearSets = crearSetsImpl || ((filas, mercado) => rest('rpc/tcggo_crear_sets', clave, { method: 'POST', body: JSON.stringify({ p_sets: filas, p_market: mercado }) }))
  // EL NOMBRE INGLÉS DE UN SET QUE NO LO TIENE (659). IBAI: «algunas
  // colecciones no tienen nombre en inglés». TCGdex lo trae a veces y a
  // veces no; TCGGO nombra todas sus expansiones en inglés, y aquí se
  // tiene delante la expansión de cada set nuestro. Solo se rellena lo
  // vacío, por REST con la clave de servicio (sin SQL nuevo), y si falla
  // no para nada: es un rótulo, no una carta.
  const nombrarSet = nombrarSetImpl || ((setId, mercado, nombre) => rest(`tcg_sets?market=eq.${mercado}&id=eq.${encodeURIComponent(setId)}`, clave, { method: 'PATCH', body: JSON.stringify({ name_en: nombre }) }))
  const leerEstado = estadoImpl || (async (claveEstado) => (await pedir(`scrydex_estado?select=valor&clave=eq.${claveEstado}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((claveEstado, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: claveEstado, valor, updated_at: new Date().toISOString() }]) }))
  const dia = ahora.toISOString().slice(0, 10)
  const semana = semanaDe(ahora)

  let pares
  let estado
  try {
    pares = await leerEstado(CLAVE_PARES)
    estado = await leerEstado(CLAVE_ESTADO)
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  estado = estado && typeof estado === 'object' ? estado : {}
  if (estado.semana !== semana) estado = { ...estado, semana, hechos: {}, hecho: false, fallidos: {} }
  if (!estado.hechos || typeof estado.hechos !== 'object') estado.hechos = {}
  for (const m of MERCADOS) if (!Array.isArray(estado.hechos[m])) estado.hechos[m] = []
  // Lo que falló por las filas repetidas (807) se vuelve a intentar UNA
  // vez, ya con el arreglo, sin esperar a la semana que viene.
  if (estado.reabiertosFallidos !== REABRIR_FALLIDOS && estado.fallidos && typeof estado.fallidos === 'object') {
    for (const m of MERCADOS) {
      for (const id of Object.keys(estado.fallidos[m] || {})) {
        estado.hechos[m] = estado.hechos[m].filter((x) => String(x) !== String(id))
        delete estado.fallidos[m][id]
        estado.hecho = false
      }
    }
    estado.reabiertosFallidos = REABRIR_FALLIDOS
  }
  // LO QUE HA IDO MAL, APUNTADO (655). PINGU abrió el «Expansion Pack»
  // japonés —set creado, «0 de 102»— y dentro no había ni una carta. Esta
  // función solo creaba el set si TCGGO le había dado cartas, así que las
  // cartas se pidieron y NO se escribieron, y nada lo decía: un error al
  // escribir volvía como respuesta de la función (que nadie lee) sin
  // apuntarse, y una escritura que escribe CERO filas ni siquiera era un
  // error. Desde aquí las dos cosas quedan en el estado —`fallidos`,
  // `vacios`, `ultimoError`— y /admin las enseña.
  if (!estado.fallidos || typeof estado.fallidos !== 'object') estado.fallidos = {}
  if (!estado.vacios || typeof estado.vacios !== 'object') estado.vacios = {}
  for (const m of MERCADOS) {
    if (!estado.fallidos[m] || typeof estado.fallidos[m] !== 'object') estado.fallidos[m] = {}
    if (!estado.vacios[m] || typeof estado.vacios[m] !== 'object') estado.vacios[m] = {}
  }
  // De qué sets nuestros cuelga cada expansión suya, por mercado: lo lee
  // `tcggo-precios` para el japonés (lo occidental lo sabe por los pares).
  if (!estado.setsPorEpisodio || typeof estado.setsPorEpisodio !== 'object') estado.setsPorEpisodio = {}
  for (const m of MERCADOS) if (!estado.setsPorEpisodio[m] || typeof estado.setsPorEpisodio[m] !== 'object') estado.setsPorEpisodio[m] = {}
  if (estado.gasto?.dia !== dia) estado.gasto = { dia, peticiones: 0 }
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)

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

  // ── Las expansiones de cada mercado ──
  // Las occidentales ya las tiene el emparejador; las japonesas se piden
  // aquí (y se guardan una semana), reanudando página a página.
  const episodiosDe = async (mercado) => {
    // Sin la lista del emparejador no se inventa nada: se espera a que corra.
    if (mercado === 'WEST') return Array.isArray(pares?.episodios?.lista) && pares.episodios.lista.length ? pares.episodios.lista : null
    const cache = estado.episodiosJp
    const edad = cache?.fecha ? (ahora.getTime() - new Date(cache.fecha).getTime()) / 86_400_000 : Infinity
    if (Array.isArray(cache?.lista) && edad <= DIAS_DE_EPISODIOS) return cache.lista
    const enCurso = Array.isArray(estado.episodiosJpEnCurso?.lista) ? estado.episodiosJpEnCurso : null
    const lista = enCurso ? [...enCurso.lista] : []
    let pagina = enCurso ? Number(enCurso.siguientePagina) || 1 : 1
    for (;;) {
      const r = await pedirTcggo(urlEpisodios(pagina, bases.JP))
      if (!r.datos) {
        estado.episodiosJpEnCurso = { lista, siguientePagina: pagina }
        await persistir()
        return null
      }
      for (const e of r.datos.data || []) lista.push(resumirEpisodio(e))
      if (!hayMasPaginas(r.datos) || !(r.datos.data || []).length) break
      pagina++
    }
    estado.episodiosJp = { fecha: ahora.toISOString(), lista }
    delete estado.episodiosJpEnCurso
    await persistir()
    return lista
  }

  const resumen = (extra = {}) => ({
    ok: true, semana, dia, peticionesEstaPasada: gastadas, peticionesHoy: estado.gasto.peticiones, topeDiario, pausaMs, puerta: base,
    hechas: Object.fromEntries(MERCADOS.map((m) => [m, estado.hechos[m].length])), parado,
    fallidos: Object.fromEntries(MERCADOS.map((m) => [m, Object.keys(estado.fallidos[m]).length])),
    vacios: Object.fromEntries(MERCADOS.map((m) => [m, Object.keys(estado.vacios[m]).length])),
    ultimoError: estado.ultimoError || null, ...extra,
  })

  const esteTurno = []
  let escritas = 0
  let creadas = 0
  let setsCreados = 0
  let nombrados = 0
  let quedanTotal = 0
  for (const mercado of MERCADOS) {
    if (parado || gastadas >= tope || !quedaTiempo()) break
    if (solo && mercado !== solo.mercado) continue
    // Con una sola expansión no se pide la lista japonesa (son páginas): vale
    // la guardada, y si no la trae, la expansión con lo que se sabe de ella.
    const episodios = solo
      ? ((mercado === 'WEST' ? pares?.episodios?.lista : estado.episodiosJp?.lista) || [])
      : await episodiosDe(mercado)
    if (!episodios) { quedanTotal += 1; continue }
    // Nuestros sets de ese mercado, y de qué expansión cuelga cada uno
    // (en WEST lo dijo el emparejador; en JP se decide aquí por el código).
    let sets
    try {
      sets = (await pedir(`tcg_sets?select=id,name,name_en,tcg_online_code,serie_id,serie_name,serie_name_en,tcggo_id,oculto&market=eq.${mercado}&limit=2000`)) || []
    } catch (e) {
      return { ...resumen(), ok: false, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
    }
    const setsPorEpisodio = new Map()
    if (mercado === 'WEST') {
      for (const [setId, h] of Object.entries(pares?.hechos || {})) {
        if (!h || h.sospechoso || !Number.isInteger(h.episodio)) continue
        if (!setsPorEpisodio.has(h.episodio)) setsPorEpisodio.set(h.episodio, [])
        setsPorEpisodio.get(h.episodio).push(setId)
      }
    }
    const idsNuestros = new Set(sets.map((s) => s.id))
    // Las que se apuntaron VACÍAS y ya traen cartas (756) vuelven a estar
    // pendientes: es la expansión que acaba de salir.
    if (!estado.vacias || typeof estado.vacias !== 'object') estado.vacias = {}
    if (!Array.isArray(estado.vacias[mercado])) estado.vacias[mercado] = []
    // Y una RECIÉN SALIDA se mira por sí misma (1265, PINGU: «ha salido
    // Dominio Delta pero en PokeDoc no sale»): la lista se pide una vez al
    // día y su cuenta de cartas llega tarde, así que en sus primeros
    // `DIAS_DE_RECIEN` se le piden las cartas directamente, como mucho cada
    // `HORAS_ENTRE_MIRADAS` (una petición por mirada: ~8 al día, dos semanas).
    if (!estado.miradas || typeof estado.miradas !== 'object') estado.miradas = {}
    if (!estado.miradas[mercado] || typeof estado.miradas[mercado] !== 'object') estado.miradas[mercado] = {}
    const porMirar = new Set(estado.vacias[mercado].filter((id) => {
      const e = episodios.find((x) => x.id === id)
      if (!e) return false
      const ultima = estado.miradas[mercado][id] ? new Date(estado.miradas[mercado][id]).getTime() : 0
      if (ahora.getTime() - ultima < HORAS_ENTRE_MIRADAS * 3_600_000) return false
      return e.cartas > 0 || esRecienSalida(e, ahora)
    }))
    if (porMirar.size) {
      estado.hechos[mercado] = estado.hechos[mercado].filter((id) => !porMirar.has(id))
      estado.vacias[mercado] = estado.vacias[mercado].filter((id) => !porMirar.has(id))
    }
    // El set que ya lleva su expansión (756): el de una futura que se creó
    // vacía, o el de un calco japonés que casó por la huella.
    const porTcggoId = (id) => sets.filter((s) => Number(s.tcggo_id) === id).map((s) => s.id)
    if (solo) {
      estado.hechos[mercado] = estado.hechos[mercado].filter((id) => id !== solo.id)
      estado.vacias[mercado] = estado.vacias[mercado].filter((id) => id !== solo.id)
    }
    const pendientes = solo
      ? [episodios.find((e) => e.id === solo.id) || { id: solo.id, nombre: solo.nombre, codigo: null, cartas: null, fecha: null }]
      : episodios.filter((e) => !estado.hechos[mercado].includes(e.id))
    quedanTotal += pendientes.length
    for (const episodio of pendientes) {
      if (parado || gastadas >= tope || !quedaTiempo()) break
      // Una expansión que su lista da con CERO cartas (las Trainer Gallery,
      // las energías) se apunta sin pedirla: no hay nada que casar.
      if (episodio.cartas === 0 && !porMirar.has(episodio.id) && !solo) {
        // Si es FUTURA, su set, escondido, para el calendario (756).
        let proxima = null
        if (typeof episodio.fecha === 'string' && episodio.fecha.slice(0, 10) > dia) {
          const yaEsta = porTcggoId(episodio.id)[0] || setDeEpisodio(episodio, sets).set?.id || null
          proxima = { set: yaEsta, creado: false }
          if (!yaEsta) {
            const fila = filaDeSetNuevo(episodio, idsNuestros, serieDeEpisodio(episodio, sets, mercado === 'JP' ? episodios : null))
            try {
              const n = Number(await crearSets([fila], mercado)) || 0
              if (n) await pedir(`tcg_sets?market=eq.${mercado}&id=eq.${encodeURIComponent(fila.id)}`, { method: 'PATCH', body: JSON.stringify({ oculto: true }) })
              setsCreados += n
            } catch (e) {
              const m = String(e?.message || e)
              if (/tcggo_crear_sets|42883|PGRST202/.test(m)) return { ...resumen(), saltado: 'falta ejecutar supabase-migration-tcggo-catalogo.sql (tcggo_crear_sets)' }
              return { ...resumen(), ok: false, error: `nuestra base al crear el set de una próxima (${episodio.nombre}): ${m.slice(0, 160)}` }
            }
            idsNuestros.add(fila.id)
            sets.push({ id: fila.id, name: fila.name, name_en: fila.name_en, tcg_online_code: fila.tcg_online_code, serie_id: fila.serie_id, serie_name: fila.serie_name, serie_name_en: fila.serie_name_en, tcggo_id: episodio.id, oculto: true })
            proxima = { set: fila.id, creado: true }
          }
        }
        estado.hechos[mercado].push(episodio.id)
        if (!estado.vacias[mercado].includes(episodio.id)) estado.vacias[mercado].push(episodio.id)
        esteTurno.push({ mercado, episodio: episodio.id, nombre: episodio.nombre, suyas: 0, nota: proxima ? `próxima (${episodio.fecha.slice(0, 10)})` : 'vacía', ...(proxima ? { set: proxima.set, setCreado: proxima.creado } : {}) })
        await persistir()
        continue
      }
      // Sus cartas, enteras — y solo las CARTAS: lo que no es «singles»
      // (sobres, cajas) se aparta antes de casar nada.
      const suyas = []
      let descartadas = 0
      let pagina = 1
      let completo = false
      // Cada carta una vez (por su id de TCGGO): una página que se repite
      // entre dos peticiones no puede meter la misma dos veces.
      const vistas = new Set()
      const meter = (s) => {
        if (s?.id == null || vistas.has(s.id)) return false
        vistas.add(s.id)
        if (esCartaSuelta(s)) suyas.push(s)
        else descartadas++
        return true
      }
      let anunciadas = null
      // Lo que contestó TCGGO a cada petición de la lista (1291c): con el
      // botón, el panel lo enseña tal cual. Las MEP seguían en 139 con la
      // 1291b subida y sin esto no había forma de saber qué le llegaba al
      // servidor (el playground de PINGU daba 164).
      const pedidas = []
      const apuntar = (pp, pag, r) => {
        if (pedidas.length < 20) pedidas.push({ pp, pag, n: (r?.datos?.data || []).length, dice: anunciadasDe(r?.datos), total: Number(r?.datos?.paging?.total) || null, fin: r?.fin || null })
      }
      // Con el botón, cada petición de la lista lleva su `fresco` (1291d); si
      // TCGGO lo rechazara (un 4xx que no es del plan), se pide como siempre.
      let fresco = solo ? ahora.getTime() || Date.now() : null
      const pedirLista = async (pag, porPagina) => {
        if (fresco) {
          const antes = parado
          const r = await pedirTcggo(urlCartasDeEpisodio(episodio.id, pag, bases[mercado], { porPagina, fresco }))
          if (r.datos || r.fin !== 'error' || /plan no da/.test(parado || '')) return r
          parado = antes
          fresco = null
        }
        return pedirTcggo(urlCartasDeEpisodio(episodio.id, pag, bases[mercado], { porPagina }))
      }
      for (;;) {
        const r = await pedirLista(pagina, POR_PAGINA_CARTAS)
        apuntar(POR_PAGINA_CARTAS, pagina, r)
        if (!r.datos) break
        { const a = anunciadasDe(r.datos); if (a != null) anunciadas = Math.max(anunciadas ?? 0, a) }
        for (const s of r.datos.data || []) meter(s)
        if (!hayMasPaginas(r.datos) || (r.datos.data || []).length < POR_PAGINA_CARTAS) { completo = true; break }
        pagina++
      }
      if (!completo) break
      // LA LISTA QUE DA MENOS DE LO QUE ANUNCIA (1291). PINGU, con las MEP:
      // TCGGO dice `results: 164` (pidiendo de 20 en 20, salen todas) y al
      // botón le llegaron 139 de 100 en 100: las 25 que faltaban eran las
      // promos más nuevas (MEP 111 Masquerain…), y no había forma de verlo.
      // Si lo recibido no llega a lo anunciado, se pide otra vez de 20 en 20
      // (como su web) y se añade lo que no estaba. Solo cuando falta algo: una
      // expansión que cuadra no gasta ni una petición más.
      //
      // Y la cuenta de la lista de 100 puede no avisar (1291b): TCGGO guarda
      // cada dirección por su lado, y la de 100 en 100 puede ser una foto vieja
      // que dice `results: 139` de sus 139. Por eso, al pulsar el botón de un
      // set y en las expansiones que se están mirando (recién salidas), se
      // pregunta además la primera página de 20, que es la que su web enseña:
      // UNA petición, y si anuncia más, la pasada de 20 en 20 entera.
      const recibidas = vistas.size
      let recuperadas = 0
      let desde = 1
      if (solo || porMirar.has(episodio.id)) {
        const r = await pedirLista(1, 20)
        apuntar(20, 1, r)
        if (r.datos) {
          anunciadas = Math.max(anunciadas ?? 0, anunciadasDe(r.datos) ?? 0) || null
          for (const s of r.datos.data || []) if (meter(s)) recuperadas++
          if (!hayMasPaginas(r.datos)) desde = Infinity
          else desde = 2
        }
      }
      if (anunciadas && vistas.size < anunciadas) {
        for (let p = desde; p <= 40; p++) {
          const r = await pedirLista(p, 20)
          apuntar(20, p, r)
          if (!r.datos) break
          for (const s of r.datos.data || []) if (meter(s)) recuperadas++
          if (!hayMasPaginas(r.datos) || !(r.datos.data || []).length || vistas.size >= anunciadas) break
        }
      }
      if (porMirar.has(episodio.id)) estado.miradas[mercado][episodio.id] = ahora.toISOString()
      // Las versiones de una carta (806) cuentan como UNA: sin esto la
      // Reverse Holo entraba como carta nueva al lado de la normal.
      const { principales, versiones } = separarVersiones(suyas)
      suyas.length = 0
      suyas.push(...principales)
      if (versiones.length) estado.versiones = { ...(estado.versiones || {}), [`${mercado}:${episodio.id}`]: versiones.length }
      // A qué set nuestro van: el emparejado, o el que case por código /
      // nombre, o uno nuevo.
      let destinos = setsPorEpisodio.get(episodio.id) || []
      if (!destinos.length) destinos = porTcggoId(episodio.id)
      // El set desde el que se pulsó, si nada más lo dice: nunca uno nuevo.
      if (!destinos.length && solo?.set && idsNuestros.has(solo.set)) destinos = [solo.set]
      let setNuevo = null
      if (!destinos.length) {
        const r = setDeEpisodio(episodio, sets)
        if (r.set) destinos = [r.set.id]
        else if (suyas.length) {
          setNuevo = filaDeSetNuevo(episodio, idsNuestros, serieDeEpisodio(episodio, sets, mercado === 'JP' ? episodios : null))
          try {
            setsCreados += Number(await crearSets([setNuevo], mercado)) || 0
          } catch (e) {
            const m = String(e?.message || e)
            if (/tcggo_crear_sets|42883|PGRST202/.test(m)) return { ...resumen(), saltado: 'falta ejecutar supabase-migration-tcggo-catalogo.sql (tcggo_crear_sets)' }
            return { ...resumen(), ok: false, error: `nuestra base al crear el set: ${m.slice(0, 160)}` }
          }
          idsNuestros.add(setNuevo.id)
          sets.push({ id: setNuevo.id, name: setNuevo.name, name_en: setNuevo.name_en, tcg_online_code: setNuevo.tcg_online_code, serie_id: setNuevo.serie_id, serie_name: setNuevo.serie_name, serie_name_en: setNuevo.serie_name_en })
          destinos = [setNuevo.id]
        }
      }
      // Y los sets HERMANOS del destino (853): la Trainer Gallery, la
      // Galarian Gallery, la Shiny Vault. TCGGO las trae dentro de la
      // expansión y nosotros las tenemos aparte; sin esto, sus cartas no
      // casaban con nada y se creaban en el set principal, al lado de las
      // de TCGdex — «sale el Pikachu dos veces» (PINGU, Lost Origin).
      for (const h of setsHermanos(destinos[0], idsNuestros)) if (!destinos.includes(h)) destinos.push(h)
      if (!suyas.length) {
        estado.hechos[mercado].push(episodio.id)
        // Sin cartas sueltas todavía (solo sobres y cajas): sigue en las
        // vacías, para volver a mirarla, en vez de darla por hecha toda la
        // semana (1265).
        if (!estado.vacias[mercado].includes(episodio.id)) estado.vacias[mercado].push(episodio.id)
        esteTurno.push({ mercado, episodio: episodio.id, nombre: episodio.nombre, suyas: 0, nota: 'vacía' })
        await persistir()
        continue
      }
      // Los sets destino sin nombre inglés se rotulan con el de su
      // expansión (659). Solo el PRIMERO: en una expansión con varios sets
      // nuestros los demás son galerías con su propio nombre.
      const sinIngles = sets.find((s) => s.id === destinos[0] && !String(s.name_en || '').trim() && String(episodio.nombre || '').trim())
      if (sinIngles) {
        try {
          await nombrarSet(sinIngles.id, mercado, String(episodio.nombre).trim())
          sinIngles.name_en = String(episodio.nombre).trim()
          nombrados++
        } catch {
          // Un rótulo que no se pudo poner no para el catálogo.
        }
      }
      // Nuestras cartas de esos sets.
      let nuestras
      try {
        nuestras = (await pedir(`tcg_cards?select=id,set_id,local_id,name,name_en,cm_id_product_propio,tcggo_id&market=eq.${mercado}&set_id=in.(${destinos.map((s) => `"${encodeURIComponent(s)}"`).join(',')})&limit=5000`)) || []
      } catch (e) {
        return { ...resumen(), ok: false, error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
      }
      // 0. La nuestra que YA lleva su id de TCGGO es ella (807). Sin esto,
      //    otra suya con el mismo producto de Cardmarket se quedaba con
      //    nuestra «tcggo-X», la X de verdad salía como carta nueva con el
      //    MISMO id y el lote entero rebotaba (21000: «ON CONFLICT DO
      //    UPDATE command cannot affect row a second time»): Neo Discovery
      //    llevaba así desde el 8 de octubre, tres intentos cada semana.
      const porTcggo = new Map()
      for (const c of nuestras) if (Number.isInteger(Number(c.tcggo_id)) && Number(c.tcggo_id) > 0) porTcggo.set(Number(c.tcggo_id), c)
      // 1. Por el id de Cardmarket que ya tienen (los pares del emparejador).
      const porProducto = new Map()
      for (const c of nuestras) if (c.cm_id_product_propio) porProducto.set(Number(c.cm_id_product_propio), c)
      const filas = []
      const usadas = new Set()
      const sinCasar = []
      const pendientes = []
      for (const s of suyas) {
        const n = porTcggo.get(Number(s.id))
        if (n && !usadas.has(n.id)) {
          usadas.add(n.id)
          filas.push(filaDeCartaTcggo(s, { setId: n.set_id, nuestra: n }))
        } else pendientes.push(s)
      }
      for (const s of pendientes) {
        const n = porProducto.get(Number(s.cardmarket_id))
        if (n && !usadas.has(n.id)) {
          usadas.add(n.id)
          filas.push(filaDeCartaTcggo(s, { setId: n.set_id, nuestra: n }))
        } else sinCasar.push(s)
      }
      // 2. Lo que queda, por tcgid / número / dígitos contra las nuestras
      //    que quedan (en cada set destino).
      const libres = nuestras.filter((c) => !usadas.has(c.id))
      const r = emparejarPorNumero(libres, sinCasar)
      const suyaPorId = new Map(sinCasar.map((s) => [s.id, s]))
      for (const p of r.pares) {
        const n = libres.find((c) => c.id === p.id)
        const s = suyaPorId.get(p.tcggoId)
        if (!n || !s) continue
        usadas.add(n.id)
        suyaPorId.delete(p.tcggoId)
        filas.push(filaDeCartaTcggo(s, { setId: n.set_id, nuestra: n }))
      }
      // 3. Las suyas que no son ninguna nuestra: nuevas, en el set destino
      //    (el primero: en una expansión con varios sets nuestros, los
      //    demás son galerías que ya casaron por número).
      let nuevas = 0
      const filasNuevas = []
      // Su número como los nuestros (1291): TCGGO escribe «MEP 111» y las
      // nuestras de ese set van «111»; con su número, la 996 ya hizo
      // repetidas («SVP 205»). Solo si lo de delante es el CÓDIGO de la
      // expansión: un «TG01» no es un «001».
      const numerosDestino = nuestras.filter((c) => c.set_id === destinos[0]).map((c) => c.local_id)
      const codigo = String(episodio.codigo || '').trim().toUpperCase()
      const comoLosNuestros = (numero) => {
        const prefijo = String(numero || '').trim().match(/^([A-Za-z]+)[\s-]*\d+$/)?.[1]?.toUpperCase()
        return codigo && prefijo === codigo ? numeroComoLosNuestros(numero, numerosDestino) : numero
      }
      for (const s of suyaPorId.values()) {
        const f = filaDeCartaTcggo(s, { setId: destinos[0] })
        f.local_id = comoLosNuestros(f.local_id)
        filas.push(f)
        filasNuevas.push(f)
        nuevas++
      }
      // Y una sentencia no puede llevar dos filas con el mismo id: la
      // primera manda (la casada con una nuestra va antes que la nueva).
      const vistasId = new Set()
      const sinRepetir = filas.filter((f) => (vistasId.has(f.id) ? false : (vistasId.add(f.id), true)))
      if (sinRepetir.length < filas.length) estado.repetidas = { ...(estado.repetidas || {}), [`${mercado}:${episodio.id}`]: filas.length - sinRepetir.length }
      filas.length = 0
      filas.push(...sinRepetir)
      let escritasAqui = 0
      try {
        for (let k = 0; k < filas.length; k += 300) escritasAqui += Number(await guardarCartas(filas.slice(k, k + 300), mercado)) || 0
      } catch (e) {
        const m = String(e?.message || e)
        if (/tcggo_guardar_cartas|42883|PGRST202/.test(m)) return { ...resumen(), saltado: 'falta ejecutar supabase-migration-tcggo-catalogo.sql (tcggo_guardar_cartas)' }
        // UNA EXPANSIÓN QUE NO SE DEJA ESCRIBIR NO BLOQUEA EL CATÁLOGO
        // (655). Antes, el error volvía sin apuntarse y la pasada
        // siguiente volvía a pedir la MISMA expansión a TCGGO: dos
        // peticiones cada cinco minutos para no escribir nada, y las
        // expansiones de detrás sin llegar nunca (la 522: lo que viene
        // después de pagar cuenta como intento). Se apunta con su error,
        // la pasada se para —es nuestra base la que falla (la 526)— y a la
        // tercera vez se salta esa expansión y se sigue con las demás.
        const f = estado.fallidos[mercado][episodio.id] || { intentos: 0 }
        f.intentos += 1
        f.error = m.slice(0, 200)
        f.nombre = episodio.nombre
        f.fecha = ahora.toISOString()
        estado.fallidos[mercado][episodio.id] = f
        estado.ultimoError = { mercado, episodio: episodio.id, nombre: episodio.nombre, error: m.slice(0, 200), fecha: ahora.toISOString(), intentos: f.intentos }
        if (f.intentos >= MAXIMO_INTENTOS_EPISODIO) {
          estado.hechos[mercado].push(episodio.id)
          esteTurno.push({ mercado, episodio: episodio.id, nombre: episodio.nombre, suyas: suyas.length, fallido: f.error, intentos: f.intentos })
          await persistir()
          continue
        }
        await persistir()
        return { ...resumen(), ok: false, error: `nuestra base al escribir cartas (${mercado} #${episodio.id} ${episodio.nombre}, intento ${f.intentos} de ${MAXIMO_INTENTOS_EPISODIO}): ${m.slice(0, 160)}` }
      }
      escritas += escritasAqui
      // Un destino escondido que ya tiene cartas se enseña (756): la
      // próxima que acaba de salir, o un cascarón que se ha llenado.
      if (escritasAqui) {
        for (const s of sets.filter((x) => destinos.includes(x.id) && x.oculto)) {
          try {
            await pedir(`tcg_sets?market=eq.${mercado}&id=eq.${encodeURIComponent(s.id)}`, { method: 'PATCH', body: JSON.stringify({ oculto: false }) })
            s.oculto = false
          } catch { /* la semana que viene */ }
        }
      }
      // Y una escritura que escribe CERO filas de una lista que no está
      // vacía se apunta: no es un error, y es justo por eso que hay que
      // decirlo. (Si escribe alguna, deja de contar como vacía.)
      if (filas.length && !escritasAqui) estado.vacios[mercado][episodio.id] = { nombre: episodio.nombre, filas: filas.length, sets: destinos, fecha: ahora.toISOString() }
      else delete estado.vacios[mercado][episodio.id]
      // LAS NUEVAS QUE LA BASE NO HA QUERIDO (1290). PINGU, con las MEP: «me
      // dice que sí, que me he traído cartas… no se las ha traído». El
      // disparador de las correcciones se salta SIN ERROR la fila de una
      // carta con lápida (`__borrada`, 934: se borró en /admin o se juntó
      // como repetida), y el panel decía «34 nuevas; 105 escritas» sin decir
      // cuáles faltaban ni por qué. Si se ha escrito menos de lo mandado, se
      // mira (gratis, nuestra base) qué nuevas no están y cuáles tienen
      // lápida, y va en el turno.
      let noEscritas = null
      if (filasNuevas.length && escritasAqui < filas.length) noEscritas = await nuevasSinEscribir(pedir, filasNuevas, mercado).catch(() => null)
      creadas += nuevas - (noEscritas?.length || 0)
      estado.setsPorEpisodio[mercado][episodio.id] = destinos
      estado.hechos[mercado].push(episodio.id)
      esteTurno.push({ mercado, episodio: episodio.id, nombre: episodio.nombre, sets: destinos, setNuevo: setNuevo?.id || null, suyas: suyas.length, descartadas, nuestras: nuestras.length, casadas: filas.length - nuevas, nuevas, escritas: escritasAqui, nuestrasSinSuya: nuestras.length - usadas.size, ...(anunciadas != null && recibidas < anunciadas ? { anunciadas, recibidas, recuperadas } : {}), ...(solo ? { pedidas } : {}), ...(noEscritas?.length ? { noEscritas: noEscritas.slice(0, 60), noEscritasTotal: noEscritas.length } : {}) })
      await persistir()
    }
  }
  // ¿Queda algo esta semana?
  let quedan = 0
  for (const mercado of MERCADOS) {
    const lista = mercado === 'WEST' ? (pares?.episodios?.lista || null) : (estado.episodiosJp?.lista || null)
    if (!lista || !lista.length) { quedan += 1; continue }
    quedan += lista.filter((e) => !estado.hechos[mercado].includes(e.id)).length
  }
  if (!quedan && !parado) estado.hecho = true
  await persistir()
  return resumen({ hecho: !quedan && !parado, quedan, escritas, creadas, setsCreados, nombrados, esteTurno, ...(quedan && !parado ? { nota: 'sigue en la próxima pasada' } : {}) })
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('tcggo-catalogo:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada cinco minutos, a y 2 (para no coincidir con la de precios): con la
// semana hecha, una pasada es leer el estado y nada más.
// Más espaciada desde la 1310 (C1 del plan): cada despertar se paga aunque
// no haya nada que hacer, y esta termina su trabajo antes. SCHEMA 1310.
export const config = { schedule: '2-59/15 * * * *' }
