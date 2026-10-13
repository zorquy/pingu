// Las VERSIONES de cada carta, desde TCGGO (tanda 807).
//
// PINGU, con el Snorlax de Plasma Storm: la web de TCGGO enseña «Standard
// 24,95 €» y «Reverse Holo 90,24 €», y aquí solo salía la normal. La API da
// cada versión como OTRA carta —la Reverse es la 43552, la normal la 12774—
// con el mismo número, el mismo `cardmarket_id` y su propio precio; pero
// la versión NO sale en el listado de la expansión (Plasma Storm da 138
// cartas, las de `cards_total`) ni en la búsqueda. Solo se llega por su id.
// Y las versiones van en bloque: 43551 Dodrio 100, 43552 Snorlax 101,
// 43553 Togepi 102 (PINGU pidió las tres).
//
// Así que esta pasada RECORRE IDS:
//   1. Hacia arriba desde el bloque conocido (43551) hasta 2.000 ids
//      seguidos sin carta.
//   2. Hacia abajo desde el 43550 hasta el 1, y se para antes si lleva
//      3.000 ids pedidos seguidos sin una sola versión: el freno no puede
//      ser «¿queda algo?» (la 510), porque abajo siempre queda.
//   3. Con todo recorrido: refresca el precio de las versiones de más de una
//      semana, y una vez a la semana vuelve a mirar por arriba (las
//      expansiones nuevas traen versiones nuevas, con ids nuevos).
// Lo que ya se sabe que es carta nuestra (su id de TCGGO está en
// `tcg_cards` o en su fila de precio) o versión guardada NO se pide: son
// consultas a nuestra base, que son gratis.
//
// Cada carta que contesta se coteja con las nuestras (`decidirVersion`): por
// su producto de Cardmarket y, si no, por su expansión; el número se exige
// siempre. Si casa con una carta nuestra cuyo id de TCGGO es OTRO, es una
// versión y se guarda en `tcg_card_versions` con sus precios. El nombre de
// la versión («Reverse Holo») no lo da la API: lo decide la web al pintarla.
//
// Los frenos de la casa: 8 peticiones por pasada, tope diario
// (`TCGGO_TOPE_VERSIONES`, 5.000 de serie: con el plan Ultra son 15.000 al
// día para todo), pausa entre peticiones (`TCGGO_PAUSA_MS`), un 429/403 del
// plan para hasta mañana, un id que falla tres veces se salta, y si falla
// NUESTRA base la pasada se corta antes de seguir pidiendo; a la tercera
// seguida, parada hasta el día siguiente. Todo queda en `scrydex_estado` →
// `tcggo_versiones`, y /admin lo enseña.
//
// La ruta de «Get card» es `/cards/{id}` (la de las fichas que pegó PINGU).
// La primera petición de todas es la 43552, que se sabe que existe: si no
// contesta, la ruta está mal y se para el día entero antes de gastar 2.000
// peticiones en ids «vacíos» que no lo son.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_VERSIONES, TCGGO_PAUSA_MS.
import { cabeceras, baseDe, urlCarta, cartaDeRespuesta, decidirVersion, filaDeVersion, esLimiteDelPlan, soloDigitos } from '../lib/tcggo.mjs'
import { PAUSA_MS } from './tcggo-emparejar.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_versiones'
export const TOPE_DIARIO = 5000
export const POR_PASADA = 8
export const INICIO = 43551
export const ID_DE_SONDA = 43552
export const VACIOS_PARA_PARAR = 2000
export const SIN_VERSION_PARA_PARAR = 3000
export const DIAS_DE_FRESCURA = 7
const VENTANA = 200
const VENTANAS_POR_PASADA = 10
const MS_DE_MARGEN = 20_000
const FALLOS_PARA_SALTAR = 3
const FALLOS_DE_BASE_PARA_PARAR = 3
const EJEMPLOS = 12

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

// El estado de una pasada nueva, o el de siempre con lo que le falte.
export function estadoInicial(e = {}) {
  const v = e && typeof e === 'object' ? e : {}
  return {
    ...v,
    subiendo: { siguiente: INICIO, vaciosSeguidos: 0, acabado: false, ...(v.subiendo || {}) },
    bajando: { siguiente: INICIO - 1, sinVersionSeguidos: 0, acabado: false, ...(v.bajando || {}) },
    reintentar: Array.isArray(v.reintentar) ? v.reintentar : [],
    fallos: v.fallos && typeof v.fallos === 'object' ? v.fallos : {},
    cuentas: v.cuentas && typeof v.cuentas === 'object' ? v.cuentas : {},
    ejemplos: v.ejemplos && typeof v.ejemplos === 'object' ? v.ejemplos : {},
  }
}

// De una ventana de ids, los que hay que pedir: en el orden del recorrido y
// sin los que ya conocemos.
export function idsPorPedir(desde, sentido, conocidos, cuantos, { hasta = 1 } = {}) {
  const ids = []
  let id = desde
  let ultimo = null
  for (let i = 0; i < VENTANA && ids.length < cuantos && (sentido > 0 || id >= hasta); i++, id += sentido) {
    ultimo = id
    if (!conocidos.has(id)) ids.push(id)
  }
  // Hasta dónde se ha llegado: lo saltado por conocido también cuenta.
  return { ids, siguiente: ultimo == null ? desde : ultimo + sentido }
}

const sumar = (estado, tipo, n = 1) => { estado.cuentas[tipo] = (Number(estado.cuentas[tipo]) || 0) + n }
const apuntarEjemplo = (estado, tipo, x) => {
  const l = Array.isArray(estado.ejemplos[tipo]) ? estado.ejemplos[tipo] : []
  estado.ejemplos[tipo] = [x, ...l].slice(0, EJEMPLOS)
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarImpl = null, borrarImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  reloj = () => Date.now(), ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) return { ok: true, saltado: 'falta TCGGO_API_KEY en Netlify' }
  const pausaMs = env.TCGGO_PAUSA_MS !== undefined && env.TCGGO_PAUSA_MS !== '' && Number(env.TCGGO_PAUSA_MS) >= 0 ? Number(env.TCGGO_PAUSA_MS) : PAUSA_MS
  const topeDiario = Math.max(1, Number(env.TCGGO_TOPE_VERSIONES) || TOPE_DIARIO)
  const { base, host } = baseDe(env)
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN
  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const guardar = guardarImpl || ((filas) => rest('tcg_card_versions', clave, { method: 'POST', body: JSON.stringify(filas) }))
  const borrar = borrarImpl || ((id) => rest(`tcg_card_versions?tcggo_id=eq.${id}`, clave, { method: 'DELETE', headers: { prefer: 'return=minimal' } }))
  const leerEstado = estadoImpl || (async () => (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]) }))
  const dia = ahora.toISOString().slice(0, 10)

  let estado
  try {
    estado = estadoInicial(await leerEstado())
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  if (estado.parado?.dia === dia) return { ok: true, saltado: `parado hoy: ${estado.parado.motivo}` }
  if (estado.planBloqueado?.dia === dia) return { ok: true, saltado: `el plan de TCGGO no da más hoy: ${estado.planBloqueado.motivo}` }
  if (estado.gasto?.dia !== dia) estado.gasto = { dia, peticiones: 0 }
  const persistir = async () => { try { await guardarEstado(estado) } catch { /* el estado se vuelve a escribir en la pasada siguiente */ } }

  // Un fallo de NUESTRA base corta la pasada (la 526: saltar es para el
  // fallo del otro). A la tercera seguida, parada hasta mañana.
  const falloDeBase = async (donde, e) => {
    estado.fallosBase = (Number(estado.fallosBase) || 0) + 1
    estado.ultimoError = { fecha: ahora.toISOString(), donde, error: String(e?.message || e).slice(0, 200) }
    if (/tcg_card_versions|42P01/.test(estado.ultimoError.error)) {
      estado.parado = { dia, motivo: 'falta ejecutar supabase-migration-versiones.sql' }
    } else if (estado.fallosBase >= FALLOS_DE_BASE_PARA_PARAR) {
      estado.parado = { dia, motivo: `nuestra base ha fallado ${estado.fallosBase} veces seguidas (${donde}): ${estado.ultimoError.error}` }
    }
    await persistir()
    return { ok: false, error: `${donde}: ${estado.ultimoError.error}`, ...(estado.parado ? { parado: estado.parado.motivo } : {}) }
  }

  // ── Una petición a TCGGO, contada antes de hacerla ──
  let pedidasAhora = 0
  const pedirCarta = async (id) => {
    if (pedidasAhora) await pausa(pausaMs)
    pedidasAhora++
    estado.gasto.peticiones++
    sumar(estado, 'pedidas')
    let res
    try {
      res = await fetchImpl(urlCarta(id, base), { headers: cabeceras(claveTcggo, host) })
    } catch (e) {
      return { tipo: 'fallo', error: String(e?.message || e).slice(0, 160) }
    }
    const texto = await res.text()
    if (esLimiteDelPlan(res.status, texto)) return { tipo: 'plan', error: `TCGGO ${res.status}: ${texto.slice(0, 120)}` }
    if (res.status === 404) return { tipo: 'vacia' }
    if (!res.ok) return { tipo: 'fallo', error: `TCGGO ${res.status}: ${texto.slice(0, 120)}` }
    let datos
    try { datos = JSON.parse(texto) } catch { return { tipo: 'fallo', error: 'TCGGO ha contestado algo que no es JSON' } }
    const carta = cartaDeRespuesta(datos)
    return carta ? { tipo: 'carta', carta } : { tipo: 'vacia' }
  }
  const quedaGasto = () => estado.gasto.peticiones < topeDiario && pedidasAhora < POR_PASADA

  // ── La ruta, comprobada con un id que se sabe que existe ──
  if (!estado.sonda) {
    const r = await pedirCarta(ID_DE_SONDA)
    if (r.tipo === 'plan') { estado.planBloqueado = { dia, motivo: r.error }; await persistir(); return { ok: true, parado: r.error } }
    if (r.tipo !== 'carta') {
      estado.parado = { dia, motivo: `la ruta de «Get card» (${urlCarta(ID_DE_SONDA, base)}) no ha devuelto la 43552: ${r.error || 'vacía'}` }
      await persistir()
      return { ok: true, parado: estado.parado.motivo }
    }
    estado.sonda = { fecha: ahora.toISOString(), ruta: urlCarta('{id}', base) }
  }

  // Reabrir el recorrido de arriba una vez a la semana, con todo recorrido.
  const hace = (iso) => (iso ? (ahora.getTime() - new Date(iso).getTime()) / 86_400_000 : Infinity)
  if (estado.subiendo.acabado && estado.bajando.acabado && hace(estado.subiendo.acabadoAt) >= DIAS_DE_FRESCURA) {
    estado.subiendo = { ...estado.subiendo, acabado: false, vaciosSeguidos: 0, siguiente: Math.max(INICIO, (Number(estado.maxVisto) || 0) + 1), reabierto: ahora.toISOString() }
  }

  // ── Lo que se pide en esta pasada ──
  const modo = !estado.subiendo.acabado ? 'subiendo' : !estado.bajando.acabado ? 'bajando' : 'refresco'
  let lote = []
  let refresco = []
  try {
    if (modo === 'refresco') {
      const limite = new Date(ahora.getTime() - DIAS_DE_FRESCURA * 86_400_000).toISOString()
      refresco = (await pedir(`tcg_card_versions?select=tcggo_id,card_id,set_id&actualizado_at=lt.${limite}&order=actualizado_at.asc&limit=${POR_PASADA}`)) || []
    } else {
      // Los que fallaron antes van primero.
      lote = estado.reintentar.filter((id) => (Number(estado.fallos[id]) || 0) < FALLOS_PARA_SALTAR).slice(0, POR_PASADA)
      const tramo = estado[modo]
      const sentido = modo === 'subiendo' ? 1 : -1
      for (let v = 0; v < VENTANAS_POR_PASADA && lote.length < POR_PASADA && !(sentido < 0 && tramo.siguiente < 1); v++) {
        const a = sentido > 0 ? tramo.siguiente : Math.max(1, tramo.siguiente - VENTANA + 1)
        const b = sentido > 0 ? tramo.siguiente + VENTANA - 1 : tramo.siguiente
        const conocidos = await conocidosEntre(pedir, a, b)
        const { ids, siguiente } = idsPorPedir(tramo.siguiente, sentido, conocidos, POR_PASADA - lote.length)
        // Lo que ya es carta nuestra existe: no cuenta como hueco arriba.
        if (sentido > 0 && conocidos.size) {
          const visto = [...conocidos].filter((id) => id < siguiente)
          if (visto.length) { tramo.vaciosSeguidos = 0; estado.maxVisto = Math.max(Number(estado.maxVisto) || 0, ...visto) }
        }
        lote.push(...ids)
        tramo.siguiente = siguiente
      }
      if (sentido < 0 && tramo.siguiente < 1 && !lote.length) { tramo.acabado = true; tramo.acabadoAt = ahora.toISOString(); tramo.porque = 'llegó al 1' }
    }
  } catch (e) {
    return falloDeBase('leyendo lo que ya conocemos', e)
  }

  // ── Pedir ──
  const encontradas = []
  const vistas = []
  let plan = null
  for (const id of modo === 'refresco' ? refresco.map((r) => r.tcggo_id) : lote) {
    if (!quedaGasto() || !quedaTiempo()) break
    const r = await pedirCarta(id)
    if (r.tipo === 'plan') { plan = r.error; break }
    vistas.push(id)
    if (r.tipo === 'fallo') {
      estado.fallos[id] = (Number(estado.fallos[id]) || 0) + 1
      estado.ultimoError = { fecha: ahora.toISOString(), donde: `TCGGO ${id}`, error: r.error }
      if (estado.fallos[id] >= FALLOS_PARA_SALTAR) {
        sumar(estado, 'saltadas'); delete estado.fallos[id]
        estado.reintentar = estado.reintentar.filter((x) => x !== id)
        if (modo === 'refresco') { try { await borrar(id); sumar(estado, 'retiradas') } catch (e) { return falloDeBase('retirando una versión', e) } }
      } else if (modo !== 'refresco' && !estado.reintentar.includes(id)) estado.reintentar.push(id)
      continue
    }
    delete estado.fallos[id]
    estado.reintentar = estado.reintentar.filter((x) => x !== id)
    if (r.tipo === 'vacia') {
      sumar(estado, 'vacias')
      if (modo === 'subiendo') estado.subiendo.vaciosSeguidos++
      if (modo === 'bajando') estado.bajando.sinVersionSeguidos++
      // Una versión que ya no existe en TCGGO se quita (y se cuenta).
      if (modo === 'refresco') { try { await borrar(id); sumar(estado, 'retiradas') } catch (e) { return falloDeBase('retirando una versión', e) } }
      continue
    }
    if (modo === 'subiendo') { estado.subiendo.vaciosSeguidos = 0; estado.maxVisto = Math.max(Number(estado.maxVisto) || 0, id) }
    encontradas.push(r.carta)
  }
  if (plan) estado.planBloqueado = { dia, motivo: plan }
  // Lo que se sacó del recorrido y no dio tiempo (o gasto) a pedir no se
  // pierde: va delante en la pasada siguiente.
  const aplazar = (ids) => { for (const id of ids) if (!estado.reintentar.includes(id)) estado.reintentar.push(id) }
  if (modo !== 'refresco') aplazar(lote.filter((id) => !vistas.includes(id)))

  // ── Cotejar con las nuestras y guardar ──
  let filas = []
  try {
    if (encontradas.length) {
      const candidatas = await candidatasDe(pedir, encontradas)
      for (const suya of encontradas) {
        const fijada = modo === 'refresco' ? refresco.find((r) => r.tcggo_id === suya.id) : null
        // En el refresco la carta ya está decidida: solo se renueva el precio.
        const d = fijada ? { tipo: 'version', carta: { id: fijada.card_id, set_id: fijada.set_id } } : decidirVersion(suya, candidatas.get(suya.id) || [])
        if (modo === 'bajando') estado.bajando.sinVersionSeguidos = d.tipo === 'version' ? 0 : estado.bajando.sinVersionSeguidos + 1
        if (d.tipo === 'version') {
          filas.push(filaDeVersion(suya, d.carta, { ahora }))
          if (!fijada) apuntarEjemplo(estado, 'version', { id: suya.id, carta: d.carta.id, nombre: suya.name, numero: suya.card_number })
          sumar(estado, fijada ? 'refrescadas' : 'versiones')
        } else {
          sumar(estado, d.tipo)
          if (d.tipo !== 'principal') apuntarEjemplo(estado, d.tipo, { id: suya.id, nombre: suya.name, numero: suya.card_number, expansion: suya.episode?.name || null, ...(d.carta ? { carta: d.carta.id } : {}), ...(d.porque ? { porque: d.porque } : {}) })
        }
      }
      if (filas.length) await guardar(filas)
    }
  } catch (e) {
    // Lo pedido se vuelve a pedir: sin cotejar, no se sabe qué era.
    if (modo !== 'refresco') aplazar(encontradas.map((c) => c.id))
    return falloDeBase('cotejando y guardando', e)
  }
  estado.fallosBase = 0

  // ── ¿Se acabó un recorrido? ──
  if (modo === 'subiendo' && estado.subiendo.vaciosSeguidos >= VACIOS_PARA_PARAR) {
    estado.subiendo = { ...estado.subiendo, acabado: true, acabadoAt: ahora.toISOString(), porque: `${VACIOS_PARA_PARAR} ids seguidos sin carta` }
  }
  if (modo === 'bajando' && !estado.bajando.acabado && estado.bajando.sinVersionSeguidos >= SIN_VERSION_PARA_PARAR) {
    estado.bajando = { ...estado.bajando, acabado: true, acabadoAt: ahora.toISOString(), porque: `${SIN_VERSION_PARA_PARAR} ids pedidos seguidos sin una versión` }
  }
  if (modo === 'bajando' && !estado.bajando.acabado && estado.bajando.siguiente < 1 && !estado.reintentar.length) {
    estado.bajando = { ...estado.bajando, acabado: true, acabadoAt: ahora.toISOString(), porque: 'llegó al 1' }
  }
  estado.ultimaPasada = { fecha: ahora.toISOString(), modo, pedidas: pedidasAhora, guardadas: filas.length }
  await persistir()
  return {
    ok: true, modo, pedidas: pedidasAhora, vistas: vistas.length, guardadas: filas.length, peticionesHoy: estado.gasto.peticiones,
    ...(plan ? { parado: plan } : {}),
    ...(modo === 'refresco' && !refresco.length ? { nota: 'todo recorrido y todas las versiones al día' } : {}),
  }
}

// Los ids de TCGGO entre a y b que ya sabemos qué son: cartas nuestras
// occidentales (por la carta o por su fila de precio) y versiones guardadas.
async function conocidosEntre(pedir, a, b) {
  const rango = `tcggo_id=gte.${a}&tcggo_id=lte.${b}`
  const [cartas, versiones, precios] = await Promise.all([
    pedir(`tcg_cards?select=tcggo_id&market=eq.WEST&${rango}&limit=1000`),
    pedir(`tcg_card_versions?select=tcggo_id&${rango}&limit=1000`),
    pedir(`tcg_card_prices?select=tcggo_id,card_id&${rango}&limit=1000`),
  ])
  const ids = new Set([...(cartas || []), ...(versiones || [])].map((f) => Number(f.tcggo_id)))
  // La fila de precio no dice de qué catálogo es (el japonés tiene sus
  // propios ids de TCGGO): solo cuenta si la carta es occidental.
  const deP = (precios || []).filter((p) => p.card_id && !ids.has(Number(p.tcggo_id)))
  if (deP.length) {
    const west = new Set(((await pedir(`tcg_cards?select=id&market=eq.WEST&id=in.(${deP.map((p) => `"${encodeURIComponent(p.card_id)}"`).join(',')})&limit=1000`)) || []).map((c) => c.id))
    for (const p of deP) if (west.has(p.card_id)) ids.add(Number(p.tcggo_id))
  }
  return ids
}

// Las cartas nuestras que pueden ser cada carta suya: por su producto de
// Cardmarket y, si por ahí no sale ninguna con su número, por su expansión.
async function candidatasDe(pedir, suyas) {
  const productos = [...new Set(suyas.map((s) => Number(s.cardmarket_id)).filter((n) => Number.isInteger(n) && n > 0))]
  const COLS = 'id,set_id,local_id,tcggo_id,cm_id_product_propio'
  const porProducto = productos.length ? (await pedir(`tcg_cards?select=${COLS}&market=eq.WEST&cm_id_product_propio=in.(${productos.join(',')})&limit=1000`)) || [] : []
  // Y las que tienen el producto solo en su fila de precio.
  const deprecio = productos.length ? (await pedir(`tcg_card_prices?select=card_id&cm_id_product=in.(${productos.join(',')})&limit=1000`)) || [] : []
  const faltan = deprecio.map((p) => p.card_id).filter((id) => id && !porProducto.some((c) => c.id === id))
  const extra = faltan.length ? (await pedir(`tcg_cards?select=${COLS}&market=eq.WEST&id=in.(${faltan.map((id) => `"${encodeURIComponent(id)}"`).join(',')})&limit=1000`)) || [] : []
  const cartas = [...porProducto, ...extra]

  // Las que no casan por producto: por la expansión (set con su tcggo_id).
  const sinPar = suyas.filter((s) => !cartas.some((c) => soloDigitos(c.local_id) === soloDigitos(s.card_number) && Number(c.cm_id_product_propio) === Number(s.cardmarket_id)))
  const episodios = [...new Set(sinPar.map((s) => Number(s.episode?.id)).filter((n) => Number.isInteger(n) && n > 0))]
  const setsDe = new Map()
  if (episodios.length) {
    const sets = (await pedir(`tcg_sets?select=id,tcggo_id&market=eq.WEST&tcggo_id=in.(${episodios.join(',')})&limit=200`)) || []
    for (const s of sets) setsDe.set(Number(s.tcggo_id), (setsDe.get(Number(s.tcggo_id)) || []).concat([s.id]))
    const todos = [...new Set(sets.map((s) => s.id))]
    if (todos.length) {
      const delSet = (await pedir(`tcg_cards?select=${COLS}&market=eq.WEST&set_id=in.(${todos.map((id) => `"${encodeURIComponent(id)}"`).join(',')})&limit=5000`)) || []
      const numeros = new Set(sinPar.map((s) => soloDigitos(s.card_number)))
      for (const c of delSet) if (numeros.has(soloDigitos(c.local_id)) && !cartas.some((x) => x.id === c.id)) cartas.push(c)
    }
  }

  // El id de TCGGO con el que ya conocemos cada carta: el de su fila de
  // precio (con el que se le pone precio) y, si no, el de la carta.
  const ids = cartas.map((c) => c.id)
  const precios = ids.length ? (await pedir(`tcg_card_prices?select=card_id,tcggo_id,cm_id_product&card_id=in.(${ids.map((id) => `"${encodeURIComponent(id)}"`).join(',')})&limit=1000`)) || [] : []
  const precioDe = new Map(precios.map((p) => [p.card_id, p]))
  const nuestras = cartas.map((c) => ({
    id: c.id, set_id: c.set_id, local_id: c.local_id,
    producto: Number(c.cm_id_product_propio) || Number(precioDe.get(c.id)?.cm_id_product) || null,
    principal: Number(precioDe.get(c.id)?.tcggo_id) || Number(c.tcggo_id) || null,
  }))
  const out = new Map()
  for (const s of suyas) {
    const producto = Number(s.cardmarket_id)
    const sets = setsDe.get(Number(s.episode?.id)) || []
    out.set(s.id, nuestras.filter((c) => (producto && c.producto === producto) || sets.includes(c.set_id)))
  }
  return out
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('tcggo-versiones:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada dos minutos, en los minutos pares (el calco japonés va en los
// impares). Coste: 8 peticiones × 30 pasadas por hora × 24 = 5.760 al día
// como mucho, y el tope diario lo deja en 5.000: el recorrido entero (unos
// 45.000 ids, menos los que ya son cartas nuestras) son unos diez días.
// Recorrido, una pasada es el refresco semanal de lo guardado.
export const config = { schedule: '0-58/2 * * * *' }
