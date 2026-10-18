// ── Rellenar lo que le falta a un set desde Scrydex (tanda 886) ──
//
// PINGU, con VSTAR Universe delante: «me metes el set de la API de TCGGO,
// pero es que ahí solo tiene a partir de la 173 y faltan todas las cartas
// básicas. Cógeme las de Scrydex, que ahí sí que están».
//
// TCGGO lista de s12a solo las 173–262 (las secretas); las 172 numeradas
// no están. La 881 lo trajo entero de TCGGO y se quedó así: 262 en la
// cuenta, 90 en la estantería. Scrydex sí tiene las 262.
//
// Esta pasada hace UNA cosa y una vez por entrada de `RELLENOS`: pide a
// Scrydex las cartas de la expansión, se queda con las que NO tenemos por
// NÚMERO y las escribe. Las que TCGGO ya trajo no se tocan (son las que
// llevan precio). Lo que entra lleva `origen = 'relleno'`, y ese origen lo
// respeta el reemplazo (`tcggo-reemplazar-set`) igual que el de mano: si
// TCGGO trae algún día esas cartas, las casa por número y las mejora; si
// no, no las borra.
//
// Frenos de la casa: cada entrada se intenta tres veces como mucho, un
// tope de créditos de Scrydex para toda la función, y parada DEFINITIVA al
// primer 401/402/403 (la suscripción se acaba este mes: lo que gaste
// después no vuelve). Cuando todo está hecho, la pasada no pide nada.
import { cabecerasDe, urlDeSonda, filaDeCartaScrydex, igualarClaves, expansionDelSet, numeroComparable } from '../lib/scrydex.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'scrydex_rellenar_set'
export const CLAVE_DECKS = 'scrydex_decks_jp'
export const VERSION = '886.1'
export const ORIGEN = 'relleno'
export const TOPE_CREDITOS = 40
export const MAXIMO_INTENTOS = 3
export const MAXIMO_PAGINAS = 6

// Qué sets se rellenan. `scrydexId` si se sabe; si no, se busca por el
// `scrydex_id` de la fila, por el nombre o por la huella (fecha + cuenta)
// en la lista de expansiones que guarda `scrydex-decks-jp`.
export const RELLENOS = [
  { clave: 's12a-jp-basicas', set: 's12a', mercado: 'JP', idioma: 'ja', scrydexId: null, motivo: 'TCGGO solo lista de la 173 en adelante; las 172 numeradas faltan' },
]

const esDeSuscripcion = (status) => status === 401 || status === 402 || status === 403

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
  if (!texto) return null
  try { return JSON.parse(texto) } catch { return null }
}

// ── Lo puro ──

// De las filas de Scrydex, las que NO tenemos por número. El número se
// compara sin ceros («001» es «1»): Scrydex escribe el impreso y TCGGO el
// pelado. Las que sí tenemos se dejan como están, con su precio.
export function cartasQueFaltan(filas, nuestras) {
  const tenemos = new Set((nuestras || []).map((c) => numeroComparable(c.local_id)).filter(Boolean))
  const vistos = new Set()
  return (filas || []).filter((f) => {
    const n = numeroComparable(f.local_id)
    if (!n || tenemos.has(n) || vistos.has(n)) return false
    vistos.add(n)
    return true
  })
}

// La expansión de Scrydex de un relleno: la escrita, o la que diga la fila
// o la lista.
export function expansionDelRelleno(relleno, set, expansiones) {
  if (relleno?.scrydexId) return { por: 'escrita', id: relleno.scrydexId }
  // La fila ya dice cuál es: no hace falta lista (ni crédito) para saberlo.
  if (set?.scrydex_id) return { por: 'fila', id: set.scrydex_id }
  const { por, expansion } = expansionDelSet(set, expansiones)
  return expansion ? { por, id: expansion.id } : { por: null, id: null }
}

export async function pasada({
  env = process.env, fetchImpl = fetch, restImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  rellenos = RELLENOS, ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const sc = cabecerasDe(env)
  if (sc.faltan) return { ok: true, saltado: `faltan ${sc.faltan.join(' y ')} en Netlify` }
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const leerEstado = estadoImpl || (async (k) => (await pedir(`scrydex_estado?select=valor&clave=eq.${k}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((k, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: k, valor, updated_at: new Date().toISOString() }]) }))

  let estado
  let decks
  try {
    estado = await leerEstado(CLAVE_ESTADO)
    decks = await leerEstado(CLAVE_DECKS)
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  estado = estado && typeof estado === 'object' ? estado : {}
  for (const k of ['hechos', 'intentos']) if (!estado[k] || typeof estado[k] !== 'object') estado[k] = {}
  if (!estado.gasto || typeof estado.gasto !== 'object') estado.gasto = { creditos: 0 }
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)
  const resumen = () => ({ hechos: Object.keys(estado.hechos).length, creditos: estado.gasto.creditos })

  if (estado.parado && (!estado.parado.version || estado.parado.version === VERSION)) return { ok: true, ...resumen(), saltado: `parado (${estado.parado.fecha}): ${estado.parado.motivo}` }
  if (estado.parado) delete estado.parado

  const pendientes = rellenos.filter((r) => !estado.hechos[r.clave] && (Number(estado.intentos[r.clave]) || 0) < MAXIMO_INTENTOS)
  if (!pendientes.length) return { ok: true, ...resumen(), saltado: 'nada pendiente' }
  if (estado.gasto.creditos >= TOPE_CREDITOS) return { ok: true, ...resumen(), saltado: `tope de ${TOPE_CREDITOS} créditos gastado: no se pide más a Scrydex` }

  const scrydex = async (ruta, params) => {
    estado.gasto.creditos = (Number(estado.gasto.creditos) || 0) + 1
    const res = await fetchImpl(urlDeSonda(ruta, params), { headers: sc.cabeceras })
    const texto = await res.text()
    if (!res.ok) {
      const error = `Scrydex ${res.status}: ${texto.slice(0, 160)}`
      if (esDeSuscripcion(res.status)) estado.parado = { fecha: ahora.toISOString(), motivo: `${error} — la suscripción se ha acabado; para volver a arrancar, borra «parado» del estado` }
      return { error, status: res.status }
    }
    try { return { datos: JSON.parse(texto) } } catch { return { error: 'Scrydex ha contestado algo que no es JSON', status: res.status } }
  }
  // Un fallo cuenta como intento de ESA entrada; a la tercera se deja y se
  // enseña en /admin. Un 401/402/403 ya ha parado la función entera.
  const tropiezo = async (relleno, error, donde) => {
    const n = (Number(estado.intentos[relleno.clave]) || 0) + 1
    estado.intentos[relleno.clave] = n
    estado.ultimoError = { fecha: ahora.toISOString(), clave: relleno.clave, donde, intento: n, error }
    if (n >= MAXIMO_INTENTOS) estado.hechos[relleno.clave] = { fecha: ahora.toISOString(), estado: 'parado', error }
    await persistir()
    return { ok: false, ...resumen(), error }
  }

  // Una entrada por pasada: lo que no da tiempo se queda para la siguiente.
  const relleno = pendientes[0]
  let set
  let nuestras
  try {
    set = (await pedir(`tcg_sets?select=id,name,name_en,tcg_online_code,tcggo_id,scrydex_id,release_date,card_count_total,card_count_official&market=eq.${relleno.mercado}&id=eq.${encodeURIComponent(relleno.set)}&limit=1`))?.[0] || null
    nuestras = set ? (await pedir(`tcg_cards?select=id,local_id&market=eq.${relleno.mercado}&set_id=eq.${encodeURIComponent(relleno.set)}&limit=2000`)) || [] : []
  } catch (e) {
    return tropiezo(relleno, `nuestra base: ${String(e?.message || e).slice(0, 160)}`, 'leer')
  }
  if (!set) {
    estado.hechos[relleno.clave] = { fecha: ahora.toISOString(), estado: 'sinSet', set: relleno.set }
    await persistir()
    return { ok: true, ...resumen(), saltado: `el set ${relleno.set} (${relleno.mercado}) no existe` }
  }

  // La expansión de Scrydex: escrita, por la fila, o por la lista que
  // guarda `scrydex-decks-jp` (gratis). Sin lista, se pide la suya.
  let expansiones = Array.isArray(decks?.lista?.expansiones) ? decks.lista.expansiones : []
  let { por, id: expansionId } = expansionDelRelleno(relleno, set, expansiones)
  if (!expansionId) {
    expansiones = []
    for (let pagina = 1; pagina <= 6; pagina++) {
      const r = await scrydex(`${relleno.idioma}/expansions`, { page_size: 100, page: pagina })
      if (r.error) return tropiezo(relleno, r.error, 'lista')
      const datos = Array.isArray(r.datos?.data) ? r.datos.data : []
      for (const e of datos) expansiones.push({ id: e.id, name: e.name, name_en: e.translation?.en?.name || null, code: e.code || null, total: e.total ?? null, printed_total: e.printed_total ?? null, release_date: e.release_date || null })
      if (datos.length < 100) break
      await pausa(200)
    }
    ;({ por, id: expansionId } = expansionDelRelleno(relleno, set, expansiones))
  }
  if (!expansionId) {
    estado.hechos[relleno.clave] = { fecha: ahora.toISOString(), estado: 'sinExpansion', set: relleno.set, nota: 'Scrydex no tiene ninguna expansión que case con este set (ni por id, ni por nombre, ni por huella)' }
    await persistir()
    return { ok: true, ...resumen(), saltado: `sin expansión de Scrydex para ${relleno.set}` }
  }

  // Sus cartas, página a página.
  const cartas = []
  for (let pagina = 1; pagina <= MAXIMO_PAGINAS; pagina++) {
    const r = await scrydex(`${relleno.idioma}/cards`, { q: `expansion.id:${expansionId}`, page_size: 100, page: pagina })
    if (r.error) return tropiezo(relleno, r.error, 'cartas')
    const datos = Array.isArray(r.datos?.data) ? r.datos.data : []
    cartas.push(...datos)
    if (datos.length < 100) break
    await pausa(200)
  }
  const todas = cartas.map((c) => filaDeCartaScrydex(c, { setId: set.id, mercado: relleno.mercado, idioma: relleno.idioma, ahora })).filter(Boolean).map((f) => ({ ...f, origen: ORIGEN }))
  const faltan = igualarClaves(cartasQueFaltan(todas, nuestras))
  if (faltan.length) {
    try {
      for (let i = 0; i < faltan.length; i += 200) await pedir('tcg_cards?on_conflict=id,market', { method: 'POST', body: JSON.stringify(faltan.slice(i, i + 200)) })
      // El set apunta a su expansión de Scrydex si no lo hacía ya: así la
      // próxima vez no hace falta buscarla.
      if (!set.scrydex_id) await pedir(`tcg_sets?market=eq.${relleno.mercado}&id=eq.${encodeURIComponent(set.id)}`, { method: 'PATCH', body: JSON.stringify({ scrydex_id: expansionId }) })
    } catch (e) {
      return tropiezo(relleno, `nuestra base al escribir: ${String(e?.message || e).slice(0, 160)}`, 'escribir')
    }
  }
  delete estado.intentos[relleno.clave]
  estado.hechos[relleno.clave] = {
    fecha: ahora.toISOString(), estado: 'hecho', set: set.id, expansion: expansionId, por,
    suyas: todas.length, teniamos: nuestras.length, escritas: faltan.length,
    numeros: faltan.length ? `${faltan[0].local_id}–${faltan[faltan.length - 1].local_id}` : null,
  }
  await persistir()
  return { ok: true, ...resumen(), hecho: estado.hechos[relleno.clave], quedan: pendientes.length - 1 }
}

export default async () => {
  const r = await pasada()
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

export const config = { schedule: '4-59/10 * * * *' }
