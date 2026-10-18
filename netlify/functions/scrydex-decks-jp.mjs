// LOS DECKS JAPONESES, DE SCRYDEX (883), mientras dure la suscripción.
//
// Un usuario con un わるいカイリュー (Dark Dragonite) 014/020 de 2004: no
// está en PokeDoc porque es de un deck, y TCGGO no tiene los decks
// japoneses («ya los agregarán»). TCGdex tampoco: eras enteras del japonés
// sin una carta (670, 698). PINGU: «mete de Scrydex, que sigue estando
// activa la sub este mes; así puedes meter y ya».
//
// Es la EXCEPCIÓN a la 809 («no le pide nada a Scrydex ninguna función
// programada»), acotada a propósito:
//   · solo el japonés, y solo lo que TCGGO NO tiene (lo que TCGGO tiene lo
//     trae el calco; esto no compite con él);
//   · con tope de créditos TOTAL (`TOPE_CREDITOS`) y por pasada: cuando se
//     gasta, no pide más y lo dice;
//   · un 401/402/403 (la suscripción se acabó) la PARA del todo, y la
//     vuelve a arrancar un humano borrando `parado` del estado — si se
//     reanudara sola, gastaría sin que nadie haya mirado por qué paró.
//
// Dos fases, en este orden porque la primera es GRATIS:
//   A. Lo que ya está en la base y escondido. La 698 creó de Scrydex las
//      expansiones japonesas que no teníamos, y la vuelta 3 del calco (810)
//      escondió TODO set japonés sin `tcggo_id`: los decks pueden estar ahí,
//      con sus cartas, escondidos. Si un set escondido viene de Scrydex,
//      tiene cartas y TCGGO no lo tiene, se vuelve a enseñar.
//   B. Lo que Scrydex tiene y nosotros no: su lista de expansiones
//      japonesas (una vez a la semana), menos las que casan con un set
//      nuestro y menos las que TCGGO tiene; se crean (set + cartas, un
//      crédito por cada 100 cartas), de dos en dos por pasada.
//
// Lo que se enseña o se crea aquí queda en `conservados`, y el calco
// japonés lo respeta: no lo esconde (806/810), y si un día TCGGO trae esa
// expansión, el calco la vuelca ENCIMA de ese set (entera, recolocando por
// número), así que lo que la gente apunte aquí no se pierde.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, SCRYDEX_API_KEY y
// SCRYDEX_TEAM_ID (sin las de Scrydex, se salta y lo dice).
import { cabecerasDe, urlDeSonda, filaDeCartaScrydex, igualarClaves, expansionDelSet, parcheDeSet, clave as claveDe, fecha as fechaDe } from '../lib/scrydex.mjs'
import { nombreComparable, codigoComparable } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'scrydex_decks_jp'
export const CLAVE_CALCO = 'tcggo_calco_jp'
export const MERCADO = 'JP'
export const IDIOMA = 'ja'
export const VERSION = '883.1'
// Créditos: el plan de Scrydex son 5.000 al mes. La lista son ~6 a la
// semana y cada deck uno o dos; 400 da para más de cien decks.
export const TOPE_CREDITOS = 400
export const TOPE_POR_PASADA = 12
export const POR_PASADA = 2
export const REVISAR_POR_PASADA = 20
export const MAXIMO_INTENTOS = 3
export const MAXIMO_PAGINAS_CARTAS = 8
export const DIAS_DE_LISTA = 7

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

// ¿TCGGO tiene esta expansión? Por código, por nombre inglés, o por el día
// de salida con la misma cuenta. `cosa` puede ser una expansión de Scrydex
// (`name_en`/`translation.en.name`, `code`, `release_date`, `total`) o un
// set nuestro (`name_en`, `tcg_online_code`, `release_date`,
// `card_count_total`): se leen los dos juegos de nombres.
export function laTieneTcggo(cosa, episodios) {
  if (!cosa || !Array.isArray(episodios) || !episodios.length) return false
  const codigo = codigoComparable(cosa.code || cosa.tcg_online_code)
  const nombres = [cosa.name_en, cosa.translation?.en?.name, cosa.name].map(nombreComparable).filter(Boolean)
  const fecha = fechaDe(cosa.release_date) || null
  const total = Number(cosa.total ?? cosa.card_count_total) || 0
  return episodios.some((e) => {
    if (codigo && codigoComparable(e.codigo) === codigo) return true
    const suyo = nombreComparable(e.nombre)
    if (suyo && nombres.includes(suyo)) return true
    return Boolean(fecha) && total > 0 && fechaDe(e.fecha) === fecha && [e.cartas, e.impresas].map(Number).includes(total)
  })
}

// Los sets nuestros escondidos que vinieron de Scrydex y TCGGO no tiene:
// candidatos a volver a enseñarse (fase A). Si tienen cartas lo mira la
// pasada, que es lo único que cuesta una consulta.
export function setsEscondidosQueVolver(sets, episodios, conservados = {}) {
  return (sets || []).filter((s) => s && s.oculto && s.scrydex_id && s.tcggo_id == null && !conservados[s.id] && !laTieneTcggo(s, episodios))
}

// Las expansiones de Scrydex que no son ningún set nuestro ni las tiene
// TCGGO (fase B). Un set nuestro «es» una expansión suya por `scrydex_id`,
// por nombre, o por la huella (`expansionDelSet`, la de la 505).
export function expansionesQueFaltan(expansiones, sets, episodios, creados = {}) {
  const casadas = new Set()
  for (const s of sets || []) {
    if (s?.scrydex_id) casadas.add(s.scrydex_id)
    const e = expansionDelSet(s, expansiones)?.expansion
    if (e) casadas.add(e.id)
  }
  const nombres = new Set((sets || []).flatMap((s) => [claveDe(s?.name_en), claveDe(s?.name)]).filter(Boolean))
  return (expansiones || []).filter((e) => e?.id && !casadas.has(e.id) && !creados[e.id] && !nombres.has(claveDe(e.name_en)) && !nombres.has(claveDe(e.name)) && Number(e.total) !== 0 && !laTieneTcggo(e, episodios))
}

// La fila del set nuevo. A la vista desde el principio: lo que se crea
// aquí se crea con sus cartas en la misma pasada.
export function filaDeSetDeScrydex(expansion, mercado, sets = []) {
  const serieK = claveDe(expansion.series)
  const deSerie = serieK ? (sets || []).find((s) => s.serie_id && (claveDe(s.serie_name_en) === serieK || claveDe(s.serie_name) === serieK)) : null
  return {
    id: expansion.id, market: mercado,
    name: expansion.name || expansion.name_en || expansion.id,
    name_en: expansion.name_en || expansion.translation?.en?.name || null,
    release_date: fechaDe(expansion.release_date) || null,
    card_count_total: Number(expansion.total) > 0 ? Number(expansion.total) : null,
    card_count_official: Number(expansion.printed_total) > 0 ? Number(expansion.printed_total) : null,
    serie_id: deSerie?.serie_id || null, serie_name: deSerie?.serie_name || null, serie_name_en: deSerie?.serie_name_en || expansion.series || null,
    logo_scrydex: typeof expansion.logo === 'string' && expansion.logo ? expansion.logo : null,
    symbol_scrydex: typeof expansion.symbol === 'string' && expansion.symbol ? expansion.symbol : null,
    scrydex_id: expansion.id, scrydex_por: 'decks', oculto: false,
  }
}

const resumirExpansion = (e) => ({ id: e.id, name: e.name, name_en: e.translation?.en?.name || null, series: e.series || null, code: e.code || null, total: e.total ?? null, printed_total: e.printed_total ?? null, release_date: e.release_date || null, logo: e.logo || null, symbol: e.symbol || null })

// ── La pasada ──
export async function pasada({
  env = process.env, fetchImpl = fetch, restImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const sc = cabecerasDe(env)
  if (sc.faltan) return { ok: true, saltado: `faltan ${sc.faltan.join(' y ')} en Netlify` }
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const leerEstado = estadoImpl || (async (k) => (await pedir(`scrydex_estado?select=valor&clave=eq.${k}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((k, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: k, valor, updated_at: new Date().toISOString() }]) }))

  let estado
  let calco
  try {
    estado = await leerEstado(CLAVE_ESTADO)
    calco = await leerEstado(CLAVE_CALCO)
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  estado = estado && typeof estado === 'object' ? estado : {}
  for (const k of ['conservados', 'creados', 'revisados', 'intentos']) if (!estado[k] || typeof estado[k] !== 'object') estado[k] = {}
  if (!estado.gasto || typeof estado.gasto !== 'object') estado.gasto = { creditos: 0 }
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)
  const resumen = () => ({ conservados: Object.keys(estado.conservados).length, creados: Object.values(estado.creados).filter((c) => c.estado === 'creado').length, creditos: estado.gasto.creditos })

  // Parado por Scrydex: para siempre, hasta que un humano lo quite. Parado
  // por nuestra base: hasta la versión siguiente.
  if (estado.parado && (!estado.parado.version || estado.parado.version === VERSION)) return { ok: true, ...resumen(), saltado: `parado (${estado.parado.fecha}): ${estado.parado.motivo}` }
  if (estado.parado) delete estado.parado
  // Los episodios de TCGGO: lo que TCGGO tiene no es cosa de esta función.
  const episodios = Array.isArray(calco?.lista?.episodios) ? calco.lista.episodios : []
  if (!episodios.length) return { ok: true, ...resumen(), saltado: 'sin la lista de expansiones de TCGGO (tcggo_calco_jp): sin ella no se sabe qué falta' }

  let sets
  try {
    sets = (await pedir(`tcg_sets?select=id,name,name_en,tcg_online_code,serie_id,serie_name,serie_name_en,tcggo_id,scrydex_id,scrydex_por,oculto,release_date,card_count_total,card_count_official&market=eq.${MERCADO}&limit=2000`)) || []
  } catch (e) {
    return { ok: false, ...resumen(), error: `nuestra base: ${String(e?.message || e).slice(0, 160)}` }
  }

  // ── A. Lo escondido que vino de Scrydex y TCGGO no tiene: a la vista ──
  const vueltos = []
  const candidatos = setsEscondidosQueVolver(sets, episodios, estado.conservados).filter((s) => !estado.revisados[s.id]).slice(0, REVISAR_POR_PASADA)
  for (const s of candidatos) {
    let alguna
    try {
      alguna = (await pedir(`tcg_cards?select=id&market=eq.${MERCADO}&set_id=eq.${encodeURIComponent(s.id)}&limit=1`)) || []
    } catch (e) {
      await persistir()
      return { ok: false, ...resumen(), error: `nuestra base (${s.id}): ${String(e?.message || e).slice(0, 160)}` }
    }
    if (!alguna.length) {
      estado.revisados[s.id] = { fecha: ahora.toISOString(), estado: 'vacio' }
      continue
    }
    try {
      await pedir(`tcg_sets?market=eq.${MERCADO}&id=eq.${encodeURIComponent(s.id)}`, { method: 'PATCH', body: JSON.stringify({ oculto: false }) })
    } catch (e) {
      estado.parado = { fecha: ahora.toISOString(), motivo: `nuestra base al enseñar ${s.id}: ${String(e?.message || e).slice(0, 160)}`, version: VERSION }
      await persistir()
      return { ok: false, ...resumen(), error: estado.parado.motivo }
    }
    estado.conservados[s.id] = { fecha: ahora.toISOString(), por: 'vuelto', nombre: s.name_en || s.name || s.id }
    estado.revisados[s.id] = { fecha: ahora.toISOString(), estado: 'vuelto' }
    vueltos.push(s.id)
  }
  if (vueltos.length) await persistir()

  // ── B. Lo que Scrydex tiene y nosotros no ──
  if (estado.gasto.creditos >= TOPE_CREDITOS) {
    await persistir()
    return { ok: true, ...resumen(), vueltos, saltado: `tope de ${TOPE_CREDITOS} créditos gastado: no se pide más a Scrydex` }
  }
  let gastadosAhora = 0
  const scrydex = async (ruta, params) => {
    estado.gasto.creditos = (Number(estado.gasto.creditos) || 0) + 1
    gastadosAhora++
    const res = await fetchImpl(urlDeSonda(ruta, params), { headers: sc.cabeceras })
    const texto = await res.text()
    if (!res.ok) {
      const error = `Scrydex ${res.status}: ${texto.slice(0, 160)}`
      if (esDeSuscripcion(res.status)) estado.parado = { fecha: ahora.toISOString(), motivo: `${error} — la suscripción se ha acabado; para volver a arrancar, borra «parado» del estado` }
      return { error, status: res.status }
    }
    try { return { datos: JSON.parse(texto) } } catch { return { error: 'Scrydex ha contestado algo que no es JSON', status: res.status } }
  }

  // B1. Su lista, una vez a la semana.
  const edad = estado.lista?.fecha ? (ahora.getTime() - new Date(estado.lista.fecha).getTime()) / 86_400_000 : Infinity
  if (!Array.isArray(estado.lista?.expansiones) || edad > DIAS_DE_LISTA) {
    const expansiones = []
    for (let pagina = 1; pagina <= 6; pagina++) {
      const r = await scrydex(`${IDIOMA}/expansions`, { page_size: 100, page: pagina })
      if (r.error) {
        estado.ultimoError = { fecha: ahora.toISOString(), donde: 'lista', error: r.error }
        await persistir()
        return { ok: false, ...resumen(), vueltos, error: r.error }
      }
      const datos = Array.isArray(r.datos?.data) ? r.datos.data : []
      for (const e of datos) expansiones.push(resumirExpansion(e))
      if (datos.length < 100) break
      await pausa(200)
    }
    estado.lista = { fecha: ahora.toISOString(), expansiones }
    await persistir()
  }
  const expansiones = estado.lista.expansiones

  // B2. Las que faltan, de dos en dos.
  const faltan = expansionesQueFaltan(expansiones, sets, episodios, estado.creados)
  estado.faltan = { fecha: ahora.toISOString(), cuantas: faltan.length, lista: faltan.slice(0, 60).map((e) => ({ id: e.id, nombre: e.name_en || e.name, total: e.total })) }
  const creadas = []
  for (const expansion of faltan.slice(0, POR_PASADA)) {
    if (gastadosAhora >= TOPE_POR_PASADA || estado.gasto.creditos >= TOPE_CREDITOS) break
    const cartas = []
    let fallo = null
    for (let pagina = 1; pagina <= MAXIMO_PAGINAS_CARTAS; pagina++) {
      const r = await scrydex(`${IDIOMA}/cards`, { q: `expansion.id:${expansion.id}`, page_size: 100, page: pagina })
      if (r.error) { fallo = r; break }
      const datos = Array.isArray(r.datos?.data) ? r.datos.data : []
      cartas.push(...datos)
      if (datos.length < 100) break
      await pausa(200)
    }
    if (fallo) {
      // Un 401/402/403 ya ha parado la función; lo demás cuenta como
      // intento de ESTA expansión y a la tercera se deja.
      const n = (Number(estado.intentos[expansion.id]) || 0) + 1
      estado.intentos[expansion.id] = n
      estado.ultimoError = { fecha: ahora.toISOString(), expansion: expansion.id, intento: n, error: fallo.error }
      if (n >= MAXIMO_INTENTOS) estado.creados[expansion.id] = { fecha: ahora.toISOString(), estado: 'parado', error: fallo.error }
      await persistir()
      return { ok: false, ...resumen(), vueltos, creadas, error: fallo.error }
    }
    const filas = igualarClaves(cartas.map((c) => filaDeCartaScrydex(c, { setId: expansion.id, mercado: MERCADO, idioma: IDIOMA, ahora })).filter(Boolean))
    if (!filas.length) {
      estado.creados[expansion.id] = { fecha: ahora.toISOString(), estado: 'vaciaEnScrydex', nombre: expansion.name_en || expansion.name }
      await persistir()
      continue
    }
    const fila = filaDeSetDeScrydex(expansion, MERCADO, sets)
    try {
      await pedir('tcg_sets', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([fila]) })
      for (let i = 0; i < filas.length; i += 200) await pedir('tcg_cards?on_conflict=id,market', { method: 'POST', body: JSON.stringify(filas.slice(i, i + 200)) })
      await pedir(`tcg_sets?market=eq.${MERCADO}&id=eq.${encodeURIComponent(fila.id)}`, { method: 'PATCH', body: JSON.stringify({ ...parcheDeSet(fila, expansion), scrydex_por: 'decks' }) })
    } catch (e) {
      estado.parado = { fecha: ahora.toISOString(), motivo: `nuestra base al crear ${expansion.id}: ${String(e?.message || e).slice(0, 160)}`, version: VERSION }
      await persistir()
      return { ok: false, ...resumen(), vueltos, creadas, error: estado.parado.motivo }
    }
    delete estado.intentos[expansion.id]
    estado.creados[expansion.id] = { fecha: ahora.toISOString(), estado: 'creado', nombre: expansion.name_en || expansion.name, cartas: filas.length }
    estado.conservados[expansion.id] = { fecha: ahora.toISOString(), por: 'creado', nombre: expansion.name_en || expansion.name, cartas: filas.length }
    sets.push({ ...fila })
    creadas.push({ id: expansion.id, nombre: expansion.name_en || expansion.name, cartas: filas.length })
  }
  await persistir()
  return { ok: true, ...resumen(), vueltos, creadas, faltan: faltan.length - creadas.length, hecho: !faltan.length }
}

export default async () => {
  const r = await pasada()
  if (!r.ok) console.warn('scrydex-decks-jp:', JSON.stringify(r).slice(0, 400))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada diez minutos; con todo hecho es leer dos estados y una consulta.
export const config = { schedule: '7-59/10 * * * *' }
