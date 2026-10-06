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
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_DIARIO, TCGGO_PAUSA_MS.
import {
  cabeceras, baseDe, baseJpDe, urlEpisodios, urlCartasDeEpisodio, hayMasPaginas, resumirEpisodio, esLimiteDelPlan, POR_PAGINA_CARTAS,
  emparejarPorNumero, setDeEpisodio, serieDeEpisodio, filaDeSetNuevo, filaDeCartaTcggo, esCartaSuelta,
} from '../lib/tcggo.mjs'
import { CLAVE_ESTADO as CLAVE_PARES, TOPE_DIARIO, PAUSA_MS } from './tcggo-emparejar.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_catalogo'
const MS_DE_MARGEN = 20_000
const DIAS_DE_EPISODIOS = 7
export const MERCADOS = ['WEST', 'JP']
// Cuántas veces se intenta escribir una expansión cuya escritura falla
// antes de saltarla (655). Ver el comentario en el `catch` de abajo.
export const MAXIMO_INTENTOS_EPISODIO = 3

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
export const semanaDe = (fecha) => Math.floor(fecha.getTime() / (7 * 86_400_000))

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarCartasImpl = null, crearSetsImpl = null, nombrarSetImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  reloj = () => Date.now(), ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)), peticiones = 60,
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
    const episodios = await episodiosDe(mercado)
    if (!episodios) { quedanTotal += 1; continue }
    // Nuestros sets de ese mercado, y de qué expansión cuelga cada uno
    // (en WEST lo dijo el emparejador; en JP se decide aquí por el código).
    let sets
    try {
      sets = (await pedir(`tcg_sets?select=id,name,name_en,tcg_online_code,serie_id,serie_name,serie_name_en&market=eq.${mercado}&limit=2000`)) || []
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
    const pendientes = episodios.filter((e) => !estado.hechos[mercado].includes(e.id))
    quedanTotal += pendientes.length
    for (const episodio of pendientes) {
      if (parado || gastadas >= tope || !quedaTiempo()) break
      // Una expansión que su lista da con CERO cartas (las Trainer Gallery,
      // las energías) se apunta sin pedirla: no hay nada que casar.
      if (episodio.cartas === 0) {
        estado.hechos[mercado].push(episodio.id)
        esteTurno.push({ mercado, episodio: episodio.id, nombre: episodio.nombre, suyas: 0, nota: 'vacía' })
        await persistir()
        continue
      }
      // Sus cartas, enteras — y solo las CARTAS: lo que no es «singles»
      // (sobres, cajas) se aparta antes de casar nada.
      const suyas = []
      let descartadas = 0
      let pagina = 1
      let completo = false
      for (;;) {
        const r = await pedirTcggo(urlCartasDeEpisodio(episodio.id, pagina, bases[mercado]))
        if (!r.datos) break
        for (const s of r.datos.data || []) {
          if (esCartaSuelta(s)) suyas.push(s)
          else descartadas++
        }
        if (!hayMasPaginas(r.datos) || (r.datos.data || []).length < POR_PAGINA_CARTAS) { completo = true; break }
        pagina++
      }
      if (!completo) break
      // A qué set nuestro van: el emparejado, o el que case por código /
      // nombre, o uno nuevo.
      let destinos = setsPorEpisodio.get(episodio.id) || []
      let setNuevo = null
      if (!destinos.length) {
        const r = setDeEpisodio(episodio, sets)
        if (r.set) destinos = [r.set.id]
        else if (suyas.length) {
          setNuevo = filaDeSetNuevo(episodio, idsNuestros, serieDeEpisodio(episodio, sets))
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
      if (!suyas.length) {
        estado.hechos[mercado].push(episodio.id)
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
      // 1. Por el id de Cardmarket que ya tienen (los pares del emparejador).
      const porProducto = new Map()
      for (const c of nuestras) if (c.cm_id_product_propio) porProducto.set(Number(c.cm_id_product_propio), c)
      const filas = []
      const usadas = new Set()
      const sinCasar = []
      for (const s of suyas) {
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
      for (const s of suyaPorId.values()) {
        filas.push(filaDeCartaTcggo(s, { setId: destinos[0] }))
        nuevas++
      }
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
      // Y una escritura que escribe CERO filas de una lista que no está
      // vacía se apunta: no es un error, y es justo por eso que hay que
      // decirlo. (Si escribe alguna, deja de contar como vacía.)
      if (filas.length && !escritasAqui) estado.vacios[mercado][episodio.id] = { nombre: episodio.nombre, filas: filas.length, sets: destinos, fecha: ahora.toISOString() }
      else delete estado.vacios[mercado][episodio.id]
      creadas += nuevas
      estado.setsPorEpisodio[mercado][episodio.id] = destinos
      estado.hechos[mercado].push(episodio.id)
      esteTurno.push({ mercado, episodio: episodio.id, nombre: episodio.nombre, sets: destinos, setNuevo: setNuevo?.id || null, suyas: suyas.length, descartadas, nuestras: nuestras.length, casadas: filas.length - nuevas, nuevas, escritas: escritasAqui, nuestrasSinSuya: nuestras.length - usadas.size })
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
export const config = { schedule: '2-59/5 * * * *' }
