// El precio POR IDIOMA de las versiones que alguien tiene (tanda 929).
//
// La pasada de precios trae ya cada versión con `include_variants=1`, pero
// con UN solo precio, el mínimo de todos los idiomas juntos (lo dice su
// documentación: «slim CM lows»). Y desde la 900 una copia vale lo que vale
// en SU idioma: una Reverse española no puede valorarse con el precio de la
// italiana más barata. El precio de cada idioma sí lo da la carta pedida por
// su id, y la «batch lookup» (`/cards?ids=`) da 20 de una vez.
//
// Pedirlo para todas sería pedir el catálogo entero otra vez. Así que solo
// las versiones que ALGUIEN TIENE (PINGU: «adelante con lo recomendado»):
//   1. de `user_collection`, las copias que no son la normal (gratis);
//   2. de `tcg_card_versions`, la fila de esa versión de esa carta (gratis),
//      casando su etiqueta con nuestra versión (`varianteDeEtiqueta`);
//   3. las que no se han pedido HOY, de 20 en 20, y se escribe solo lo de
//      precio (`merge-duplicates`: la etiqueta y el resto se quedan).
//
// Los frenos de la casa: unas pocas peticiones por pasada, tope diario
// (`TCGGO_TOPE_IDIOMAS`, 300 de serie = 6.000 versiones), pausa entre
// peticiones, un 429/403 del plan para hasta mañana, un lote que falla tres
// veces se salta hasta mañana, y si falla NUESTRA base se para la pasada
// antes de pedir nada más (la 522: lo que gasta va después de lo gratis).
// Lo hecho cada día queda en `scrydex_estado` → `tcggo_versiones_idioma`.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY, TCGGO_API_KEY;
// opcionales TCGGO_BASE, TCGGO_TOPE_IDIOMAS, TCGGO_PAUSA_MS.
import { cabeceras, baseDe, baseJpDe, urlCartasPorIds, POR_LOTE_DE_IDS, filaDeIdiomasDeVersion, esLimiteDelPlan } from '../lib/tcggo.mjs'
import { varianteDeEtiqueta } from '../../js/mi-coleccion/variantes.js'
import { PAUSA_MS } from './tcggo-emparejar.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'tcggo_versiones_idioma'
export const TOPE_DIARIO = 300
export const POR_PASADA = 6
const FALLOS_PARA_SALTAR = 3
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

// Las versiones que alguien tiene, de las copias y las filas de versión: una
// por id de TCGGO, con su carta y su mercado. Puro: se prueba solo.
export function versionesQueAlguienTiene(copias, filas) {
  const quiere = new Set()
  for (const l of copias || []) {
    const v = String(l?.variante || 'normal')
    if (!l?.card_id || v === 'normal') continue
    quiere.add(`${l.card_id}|${l.market || 'WEST'}|${v}`)
  }
  const salen = new Map()
  for (const f of filas || []) {
    const id = Number(f?.tcggo_id)
    if (!Number.isInteger(id) || id <= 0 || !f.card_id) continue
    if (quiere.has(`${f.card_id}|${f.market || 'WEST'}|${varianteDeEtiqueta(f.etiqueta)}`)) salen.set(id, { tcggo_id: id, card_id: f.card_id, market: f.market || 'WEST' })
  }
  return [...salen.values()]
}

// Los lotes de esta pasada: por mercado (la puerta japonesa es otra), de 20
// en 20, sin lo hecho hoy ni lo que se salta.
export function lotesPorPedir(versiones, { hechos = [], saltar = [], cuantos = POR_PASADA } = {}) {
  const fuera = new Set([...hechos, ...saltar].map(Number))
  const lotes = []
  for (const mercado of ['WEST', 'JP']) {
    const ids = versiones.filter((v) => v.market === mercado && !fuera.has(v.tcggo_id)).map((v) => v.tcggo_id)
    for (let i = 0; i < ids.length && lotes.length < cuantos; i += POR_LOTE_DE_IDS) lotes.push({ mercado, ids: ids.slice(i, i + POR_LOTE_DE_IDS) })
  }
  return lotes
}

export async function procesar({
  env = process.env, fetchImpl = fetch, restImpl = null, guardarImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  reloj = () => Date.now(), ahora = new Date(), pausa = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const claveTcggo = env.TCGGO_API_KEY
  if (!claveTcggo) return { ok: true, saltado: 'falta TCGGO_API_KEY en Netlify' }
  const pausaMs = env.TCGGO_PAUSA_MS !== undefined && env.TCGGO_PAUSA_MS !== '' && Number(env.TCGGO_PAUSA_MS) >= 0 ? Number(env.TCGGO_PAUSA_MS) : PAUSA_MS
  const topeDiario = Math.max(1, Number(env.TCGGO_TOPE_IDIOMAS) || TOPE_DIARIO)
  const { base, host } = baseDe(env)
  const bases = { WEST: base, JP: baseJpDe(base) }
  const arranque = reloj()
  const quedaTiempo = () => reloj() - arranque < MS_DE_MARGEN
  const pedir = restImpl || ((ruta) => rest(ruta, clave))
  const guardar = guardarImpl || ((filas) => rest('tcg_card_versions', clave, { method: 'POST', body: JSON.stringify(filas) }))
  const leerEstado = estadoImpl || (async () => (await pedir(`scrydex_estado?select=valor&clave=eq.${CLAVE_ESTADO}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: CLAVE_ESTADO, valor, updated_at: new Date().toISOString() }]) }))
  const dia = ahora.toISOString().slice(0, 10)

  let estado
  try {
    estado = (await leerEstado()) || {}
  } catch (e) {
    return { ok: false, error: `nuestra base (estado): ${String(e?.message || e).slice(0, 200)}` }
  }
  if (estado.dia !== dia) estado = { dia, hechos: [], saltar: [], fallos: {}, gasto: 0, escritas: 0, pendientes: null, ...(estado.ultimoError ? { ultimoError: estado.ultimoError } : {}) }
  const persistir = async () => { try { await guardarEstado(estado) } catch { /* se vuelve a escribir en la pasada siguiente */ } }
  if (estado.planBloqueado?.dia === dia) return { ok: true, saltado: `el plan de TCGGO no da más hoy: ${estado.planBloqueado.motivo}` }
  if (estado.hecho === dia) return { ok: true, saltado: 'hoy ya están todas', escritas: estado.escritas }
  if (estado.gasto >= topeDiario) return { ok: true, saltado: `tope diario (${topeDiario} peticiones)` }

  // ── Lo gratis primero: qué versiones tiene alguien ──
  let versiones
  try {
    const copias = []
    for (let desde = 0; ; desde += 1000) {
      const pag = (await pedir(`user_collection?select=card_id,market,variante&variante=not.is.null&variante=neq.normal&order=id&limit=1000&offset=${desde}`)) || []
      copias.push(...pag)
      if (pag.length < 1000) break
    }
    const ids = [...new Set(copias.map((l) => l.card_id).filter(Boolean))]
    const filas = []
    for (let i = 0; i < ids.length; i += 150) {
      const trozo = ids.slice(i, i + 150).map((x) => `"${encodeURIComponent(x)}"`).join(',')
      filas.push(...((await pedir(`tcg_card_versions?select=tcggo_id,card_id,market,etiqueta&card_id=in.(${trozo})&limit=1000`)) || []))
    }
    versiones = versionesQueAlguienTiene(copias, filas)
  } catch (e) {
    estado.ultimoError = { fecha: ahora.toISOString(), donde: 'nuestra base', error: String(e?.message || e).slice(0, 200) }
    await persistir()
    return { ok: false, error: `nuestra base: ${estado.ultimoError.error}` }
  }
  estado.pendientes = versiones.length
  const lotes = lotesPorPedir(versiones, { hechos: estado.hechos, saltar: estado.saltar })
  if (!lotes.length) {
    estado.hecho = dia
    await persistir()
    return { ok: true, hecho: true, versiones: versiones.length, escritas: estado.escritas }
  }

  // ── Lo que se paga: de 20 en 20 ──
  let pedidas = 0
  for (const lote of lotes) {
    if (!quedaTiempo() || estado.gasto >= topeDiario) break
    if (pedidas) await pausa(pausaMs)
    pedidas++
    estado.gasto++
    let res
    let texto = ''
    try {
      res = await fetchImpl(urlCartasPorIds(lote.ids, bases[lote.mercado]), { headers: cabeceras(claveTcggo, host) })
      texto = await res.text()
    } catch (e) {
      res = null
      texto = String(e?.message || e)
    }
    if (res && esLimiteDelPlan(res.status, texto)) {
      estado.planBloqueado = { dia, motivo: `TCGGO ${res.status}: ${texto.slice(0, 120)}` }
      await persistir()
      return { ok: true, saltado: estado.planBloqueado.motivo }
    }
    let cartas = null
    if (res?.ok) {
      try { cartas = JSON.parse(texto)?.data } catch { cartas = null }
    }
    if (!Array.isArray(cartas)) {
      // El fallo es SUYO: el lote se reintenta y a la tercera se salta hoy.
      const k = lote.ids.join(',')
      estado.fallos[k] = (Number(estado.fallos[k]) || 0) + 1
      if (estado.fallos[k] >= FALLOS_PARA_SALTAR) estado.saltar.push(...lote.ids)
      estado.ultimoError = { fecha: ahora.toISOString(), donde: 'TCGGO', error: `${res ? res.status : 'red'}: ${texto.slice(0, 160)}` }
      continue
    }
    const porId = new Map(versiones.map((v) => [v.tcggo_id, v]))
    const filas = []
    for (const c of cartas) {
      const v = porId.get(Number(c?.id))
      if (!v || !lote.ids.includes(v.tcggo_id)) continue
      filas.push(filaDeIdiomasDeVersion(c, { cardId: v.card_id, market: v.market, ahora }))
    }
    if (filas.length) {
      try {
        await guardar(filas)
      } catch (e) {
        // Lo nuestro: se para la pasada, sin pedir más (la 526).
        estado.ultimoError = { fecha: ahora.toISOString(), donde: 'nuestra base al escribir', error: String(e?.message || e).slice(0, 200) }
        await persistir()
        return { ok: false, error: estado.ultimoError.error }
      }
    }
    estado.escritas += filas.length
    // Las del lote que TCGGO no ha devuelto cuentan como hechas: pedirlas
    // otra vez hoy contestaría lo mismo.
    estado.hechos.push(...lote.ids)
  }
  await persistir()
  return { ok: true, versiones: versiones.length, pedidas, escritas: estado.escritas, gasto: estado.gasto }
}

export default async () => {
  const r = await procesar()
  if (!r.ok) console.warn('tcggo-versiones-idioma:', JSON.stringify(r).slice(0, 600))
  return new Response(JSON.stringify(r), { headers: { 'content-type': 'application/json' } })
}

// Cada diez minutos: con 6 lotes por pasada son 720 versiones a la hora, y
// el día se acaba (`hecho`) en cuanto no queda ninguna. 300 peticiones al
// día como mucho, de las 15.000 del plan.
export const config = { schedule: '*/10 * * * *' }
