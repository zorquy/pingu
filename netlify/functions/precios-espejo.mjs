// EL ESPEJO DE PRECIOS (tanda 686): las cartas japonesas antiguas heredan
// el producto de Cardmarket de su gemela occidental.
//
// PINGU: «el precio no sale, ¿hay alguna manera de enlazarlo con Cardmarket
// por id de carta?». Para Cardmarket la copia japonesa del Blastoise de
// Base Set NO es otro producto: es el mismo «Blastoise (BS 2)» en idioma
// japonés. Y TCGGO, en el producto occidental, da el mínimo general y los
// de DE, FR, ES e IT, pero NO el japonés (comprobado con el Charizard BS 4
// que pegó PINGU: no hay `lowest_near_mint_JP`). Así que lo que se puede
// dar es el PRODUCTO —con el enlace filtrado a japonés, donde está el
// precio exacto— y su mínimo general, rotulado como lo que es («mínimo en
// Cardmarket, cualquier idioma»). Lo que no se puede, no se inventa.
//
// Cómo casa una carta japonesa de Scrydex con su gemela occidental, SIN
// lista a mano (las ~40 expansiones japonesas anteriores a 2008 se
// reparten entre sets occidentales que juntan dos o tres de ellas):
//
//   · mismo nombre inglés (`name_en`, el de la 685, contra `name`/`name_en`
//     de la occidental),
//   · mismos PS y misma Pokédex cuando los dos lados los traen (las señales
//     canónicas de la 506: una reimpresión de otra era cambia los PS),
//   · la occidental salió DESPUÉS que la japonesa y dentro de VENTANA_DIAS,
//   · y si hay varias, la más antigua (el Charizard del Expansion Pack es el
//     de Base Set, no el de Base Set 2),
//   · y la gemela tiene que tener su producto de Cardmarket decidido
//     (`cm_id_product_propio`, el par de la 588).
//
// Un set japonés por pasada (lo nuestro, gratis); se repasa cada día para
// que el precio siga al de la gemela. El estado (`precios_espejo`) lo
// enseña /admin.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY.
import { nombreComparable } from '../lib/tcggo.mjs'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const CLAVE_ESTADO = 'precios_espejo'
export const VENTANA_DIAS = 4 * 365
export const DIAS_REPASO = 1
const MERCADO = 'JP'

async function rest(ruta, clave, opciones = null) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${ruta}`, {
    method: opciones?.method || 'GET',
    headers: { apikey: clave, Authorization: `Bearer ${clave}`, 'Content-Type': 'application/json', Prefer: opciones?.method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal', ...(opciones?.headers || {}) },
    body: opciones?.body,
  })
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`)
  if (!opciones || opciones.method === 'GET') return res.json()
  const texto = await res.text()
  try { return texto ? JSON.parse(texto) : null } catch { return texto }
}

// ── Lo puro ──
const dexDe = (c) => (Array.isArray(c?.dex_ids) ? c.dex_ids.map(Number).filter((n) => n > 0).sort((a, b) => a - b).join(',') : '')
const hpDe = (c) => (Number.isInteger(Number(c?.hp)) && Number(c.hp) > 0 ? Number(c.hp) : null)
// La huella de los ataques SIN el idioma (686.1): cuántos, qué daño y
// cuántas energías cuesta cada uno. Los nombres no valen —los nuestros
// occidentales están en español desde la 330 y los suyos en inglés— pero
// un «Scratch 10 (1)» y un «Ember 30 (2)» son números. Es lo que separa al
// Charmander de Base Set del de Team Rocket: mismo nombre, mismos PS,
// otros ataques, OTRO producto en Cardmarket.
export const huellaDeAtaques = (c) => {
  const lista = Array.isArray(c?.attacks) ? c.attacks : []
  if (!lista.length) return ''
  // Del daño se queda lo que es daño: cifras y el signo («30+», «20×»,
  // que TCGdex escribe «20x» y Scrydex «20×»).
  const dano = (d) => String(d ?? '').toLowerCase().replace(/[×*]/g, 'x').replace(/[^\d+x-]/g, '')
  return lista.map((a) => `${dano(a?.damage)}/${Array.isArray(a?.cost) ? a.cost.length : ''}`).join('|')
}

// Las gemelas que caen FUERA del set occidental que más tiene (687): es lo
// que hay que mirar cuando el espejo dice «gemelas en base1, base4, gym1».
export function cruzadas(pares) {
  const cuenta = new Map()
  for (const { setWest } of pares.values()) cuenta.set(setWest, (cuenta.get(setWest) || 0) + 1)
  const principal = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null
  return { principal, fuera: [...pares.entries()].filter(([, p]) => p.setWest !== principal).map(([id, p]) => ({ id, gemela: p.west.id })) }
}

// La gemela occidental de cada carta japonesa. Devuelve un mapa id JP →
// { west, setWest } y la lista de las que no casan con su motivo.
export function casarGemelas(cartasJp, cartasWest, setsWest) {
  const fechaDeSet = new Map((setsWest || []).map((s) => [s.id, s.release_date || '']))
  const porNombre = new Map()
  for (const w of cartasWest || []) {
    for (const n of [w.name_en, w.name]) {
      const k = nombreComparable(n)
      if (!k) continue
      if (!porNombre.has(k)) porNombre.set(k, [])
      if (!porNombre.get(k).includes(w)) porNombre.get(k).push(w)
    }
  }
  const pares = new Map()
  const sinPar = []
  for (const j of cartasJp || []) {
    const k = nombreComparable(j.name_en)
    if (!k) { sinPar.push({ id: j.id, motivo: 'sin nombre inglés' }); continue }
    const candidatas = (porNombre.get(k) || []).filter((w) => {
      const hj = hpDe(j), hw = hpDe(w)
      if (hj && hw && hj !== hw) return false
      const dj = dexDe(j), dw = dexDe(w)
      if (dj && dw && dj !== dw) return false
      const aj = huellaDeAtaques(j), aw = huellaDeAtaques(w)
      if (aj && aw && aj !== aw) return false
      return Boolean(w.cm_id_product_propio)
    })
    if (!candidatas.length) { sinPar.push({ id: j.id, motivo: (porNombre.get(k) || []).length ? 'mismo nombre pero otros PS/Pokédex/ataques, o sin producto' : 'ninguna occidental con ese nombre en la ventana' }); continue }
    candidatas.sort((a, b) => String(fechaDeSet.get(a.set_id) || '').localeCompare(String(fechaDeSet.get(b.set_id) || '')))
    pares.set(j.id, { west: candidatas[0], setWest: candidatas[0].set_id })
  }
  return { pares, sinPar }
}

// La fila de precio de la copia japonesa: el producto y las cifras
// GENERALES de la gemela. Los mínimos por idioma (DE, FR, ES, IT) no se
// copian: son de otras impresiones, y en la ficha de una japonesa serían
// ruido. `card_id` es la clave; `checked_at` lleva `default now()`.
export function filaEspejo(cardIdJp, precioWest, ahora = new Date()) {
  if (!precioWest?.cm_id_product) return null
  const n = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null)
  return {
    card_id: cardIdJp,
    cm_id_product: precioWest.cm_id_product,
    cm_low: n(precioWest.cm_low), cm_avg30: n(precioWest.cm_avg30), cm_avg7: n(precioWest.cm_avg7),
    cm_disponibles: Number.isInteger(precioWest.cm_disponibles) ? precioWest.cm_disponibles : null,
    cm_gradeadas: precioWest.cm_gradeadas ?? null,
    tp_market_eur: n(precioWest.tp_market_eur), tp_mid_eur: n(precioWest.tp_mid_eur),
    cm_url: precioWest.cm_url ?? null,
    origen: 'espejo',
    tcggo_updated: precioWest.tcggo_updated ?? null,
    checked_at: ahora.toISOString(),
  }
}

const sumarDias = (iso, dias) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10) }

// ── La pasada ──
export async function pasada({ env = process.env, restImpl = null, estadoImpl = null, guardarEstadoImpl = null, ahora = new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const pedir = restImpl || ((ruta, opciones = null) => rest(ruta, clave, opciones))
  const leerEstado = estadoImpl || (async (k) => (await pedir(`scrydex_estado?select=valor&clave=eq.${k}&limit=1`))?.[0]?.valor || {})
  const guardarEstado = guardarEstadoImpl || ((k, valor) => rest('scrydex_estado', clave, { method: 'POST', body: JSON.stringify([{ clave: k, valor, updated_at: new Date().toISOString() }]) }))
  let estado
  try {
    estado = await leerEstado(CLAVE_ESTADO)
  } catch (e) {
    const m = String(e?.message || e)
    if (/42P01|scrydex_estado/.test(m)) return { ok: true, saltado: 'falta ejecutar supabase-migration-scrydex-cartas.sql (scrydex_estado)' }
    return { ok: false, error: m.slice(0, 200) }
  }
  estado = estado && typeof estado === 'object' ? estado : {}
  if (!estado.hechos || typeof estado.hechos !== 'object') estado.hechos = {}
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)
  const resumen = () => {
    const v = Object.values(estado.hechos)
    return { sets: v.length, espejadas: v.reduce((a, h) => a + (Number(h.espejadas) || 0), 0), sinPar: v.reduce((a, h) => a + (Number(h.sinPar) || 0), 0) }
  }
  try {
    // Los sets japoneses rellenados por scrydex-huecos (684).
    const sets = (await pedir(`tcg_sets?select=id,name_en,release_date&market=eq.${MERCADO}&scrydex_por=eq.huecos&order=release_date&limit=2000`)) || []
    // Si `scrydex-huecos` ha vuelto a escribir los nombres de un set (su
    // `vistos[k].nombres`, 685.3), las gemelas se buscan otra vez sin
    // esperar al día: con los nombres de la Pokédex «Dark Charmeleon» era
    // «Charmeleon» y casaba con el que no era.
    const vistos = (await leerEstado('scrydex_huecos'))?.vistos || {}
    const nombresDe = (id) => Number(vistos[`${MERCADO}|${id}`]?.nombres) || 0
    const caducado = (s) => { const h = estado.hechos[s.id]; return !h?.fecha || (ahora.getTime() - new Date(h.fecha).getTime()) / 86_400_000 >= DIAS_REPASO || (h.nombres ?? 0) !== nombresDe(s.id) }
    const set = sets.find((s) => caducado(s))
    if (!set) { await persistir(); return { ok: true, ...resumen(), hecho: true } }
    if (!set.release_date) {
      estado.hechos[set.id] = { fecha: ahora.toISOString(), nota: 'sin fecha: no se sabe qué ventana mirar', espejadas: 0, sinPar: 0 }
      await persistir()
      return { ok: true, ...resumen(), set: set.id, nota: estado.hechos[set.id].nota }
    }
    const cartasJp = (await pedir(`tcg_cards?select=id,name_en,hp,dex_ids,attacks&market=eq.${MERCADO}&set_id=eq.${encodeURIComponent(set.id)}&origen=eq.scrydex&limit=2000`)) || []
    const setsWest = (await pedir(`tcg_sets?select=id,release_date&market=eq.WEST&release_date=gte.${set.release_date}&release_date=lte.${sumarDias(set.release_date, VENTANA_DIAS)}&order=release_date&limit=500`)) || []
    const cartasWest = setsWest.length
      ? (await pedir(`tcg_cards?select=id,set_id,name,name_en,hp,dex_ids,attacks,cm_id_product_propio&market=eq.WEST&set_id=in.(${setsWest.map((s) => `"${s.id}"`).join(',')})&limit=10000`)) || []
      : []
    const { pares, sinPar } = casarGemelas(cartasJp, cartasWest, setsWest)
    const idsWest = [...new Set([...pares.values()].map((p) => p.west.id))]
    const precios = idsWest.length ? (await pedir(`tcg_card_prices?select=card_id,cm_id_product,cm_low,cm_avg30,cm_avg7,cm_disponibles,cm_gradeadas,tp_market_eur,tp_mid_eur,cm_url,tcggo_updated&card_id=in.(${idsWest.map((i) => `"${i}"`).join(',')})`)) || [] : []
    const precioDe = new Map(precios.map((p) => [p.card_id, p]))
    const filas = []
    let sinPrecio = 0
    for (const [idJp, { west }] of pares) {
      const fila = filaEspejo(idJp, precioDe.get(west.id), ahora)
      if (fila) filas.push(fila)
      else sinPrecio++
    }
    for (let i = 0; i < filas.length; i += 200) {
      await pedir('tcg_card_prices?on_conflict=card_id', { method: 'POST', body: JSON.stringify(filas.slice(i, i + 200)) })
    }
    const { principal, fuera } = cruzadas(pares)
    estado.hechos[set.id] = {
      fecha: ahora.toISOString(), nombre: set.name_en || set.id, nombres: nombresDe(set.id), cartas: cartasJp.length, espejadas: filas.length, sinPar: sinPar.length, sinPrecio,
      setsWest: [...new Set([...pares.values()].map((p) => p.setWest))], principal, cruzadas: fuera.length, ejemplosCruzadas: fuera.slice(0, 8), ejemplosSinPar: sinPar.slice(0, 5),
    }
    await persistir()
    return { ok: true, ...resumen(), set: set.id, ...estado.hechos[set.id] }
  } catch (e) {
    estado.ultimoError = { fecha: ahora.toISOString(), error: String(e?.message || e).slice(0, 200) }
    try { await persistir() } catch { /* el estado es lo de menos si la base no contesta */ }
    return { ok: false, ...resumen(), error: estado.ultimoError.error }
  }
}

export default async () => {
  const r = await pasada()
  if (!r.ok) console.warn('precios-espejo:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada seis minutos (a y 1, y 7, y 13…): un set por pasada y todo a nuestra
// base, sin créditos de nadie; al día siguiente cada set se repasa una vez.
export const config = { schedule: '1-59/6 * * * *' }
