// ── Rellenar lo que le falta a un set desde TCGdex (tanda 1158) ──
//
// PINGU: «en las MEP faltan cartas: el Darkrai no sale todavía, faltan
// creo que desde la 89 a la 92 y alguna más seguro». La 1151 repasa la
// expansión de TCGGO cada semana, pero esas promos TCGGO NO las tiene (lo
// comprobó PINGU). TCGdex sí: su base de datos lleva las MEP del 1 al 110 y
// la 120 (la 89 Mega Zeraora ex, la 90 Mega Darkrai ex, la 91 Mega Dragonite
// ex, la 92 Paradise Resort…), y TCGdex es gratis.
//
// Es la forma de `scrydex-rellenar-set` (886) contra TCGdex: pide la lista
// de cartas del set a su API, se queda con las que NO tenemos por NÚMERO y
// las escribe con `origen = 'relleno'`, que el reemplazo respeta (no las
// borra; si TCGGO las trae un día, las casa por número y las mejora). Las que
// ya tenemos no se tocan: son las que llevan el precio de TCGGO.
//
// EL PRECIO: cada carta va con su id de producto de Cardmarket
// (`cm_id_product_propio`), sacado de los ficheros de TCGdex
// (tcgdex/cards-database, `variants[].thirdParty.cardmarket`; la 90 es el
// 903676). Con él, `cardmarket-precios` le pone cada día el de la guía
// pública de Cardmarket, sin pedirle nada a nadie de pago.
//
// Como un set de promos CRECE, cada entrada se repasa cada `cadaDias` (la
// regla de la 1151, `tocaRepasar`). Frenos de la casa: tres intentos por
// entrada y lo que falla va al estado (`tcgdex_rellenar_set`, en PASADAS).
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY.
import { numeroComparable, igualarClaves } from '../lib/scrydex.mjs'
import { consultaDelSet, elegirSet, cartasQueFaltan } from './scrydex-rellenar-set.mjs'
import { tocaRepasar } from './tcggo-reemplazar-set.mjs'
import { imagePathFromUrl } from '../../js/carta-detalle.js'
import { RELLENOS_TCGDEX } from '../../js/rellenos-tcgdex.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const TCGDEX = 'https://api.tcgdex.net/v2'
export const CLAVE_ESTADO = 'tcgdex_rellenar_set'
export const ORIGEN = 'relleno'
export const MAXIMO_INTENTOS = 3

// El id de producto de Cardmarket de cada MEP, de los ficheros de TCGdex
// (2026-11-01). Una que no esté aquí lo toma de la API si lo trae
// (`pricing.cardmarket.idProduct`), o se queda sin él y se pone en /admin.
const CM_MEP = '001:851043 002:851045 003:851047 004:851049 005:851051 006:851052 007:851053 008:851054 009:851055 010:851058 011:851063 012:858146 013:859011 014:857390 015:857393 016:857396 017:857400 018:859021 019:859022 020:859024 021:859026 022:859029 023:859033 024:859036 025:859037 026:855284 027:855283 028:850977 029:873692 030:873699 031:873702 032:873708 033:873710 034:873717 035:873719 036:873721 037:875186 038:875187 039:875188 040:875189 041:875190 042:875191 043:875192 044:875193 045:875194 046:886615 047:886616 048:886617 049:886618 050:886619 051:886620 052:886621 053:886622 054:886623 055:891870 056:891880 057:891888 058:891889 059:891890 060:891891 061:891892 062:891893 063:891894 064:877543 065:877544 066:877545 067:877546 068:879250 069:879255 070:879262 071:873310 072:891720 073:891721 074:884752 075:884754 076:884756 077:884758 078:888609 079:888607 080:888506 081:885516 082:894261 083:894262 084:894263 085:894264 086:898176 087:898177 088:895779 089:903672 090:903676 091:903681 092:903686 093:894884 094:895609 095:895610 096:895606 097:895607 098:895608 099:895611 100:895612 101:895604 102:895613 103:895614 104:895620 105:895621 106:895619 107:895615 108:895616 109:895617 110:895618 120:903004'
export const CARDMARKET = { mep: new Map(CM_MEP.split(' ').map((p) => p.split(':')).map(([n, id]) => [numeroComparable(n), Number(id)])) }

// ── Las fichas de respaldo (tanda 1160) ──
//
// PINGU, con la lista de Bulbapedia: «siguen faltando la 89, 90, 91 y 92».
// La pasada de la 1158 las pedía a la API de TCGdex, y no entraron: o la API
// todavía no las publica (se construye desde tcgdex/cards-database y va por
// detrás) o no contestó. Así que su ficha va aquí, copiada a mano de los
// ficheros de cards-database (data/Mega Evolution/MEP Black Star Promos,
// 089–092, 2026-11-01): si la API no trae un número de esta lista, se escribe
// con esto. Sin foto (no se inventa una dirección, la 441: la pone PINGU en
// /admin) y sin español (no lo tiene ni TCGdex).
const ataque = (cost, name, effect, damage) => ({ cost, name, effect, ...(damage != null ? { damage } : {}) })
export const FICHAS_DE_RESPALDO = {
  mep: [
    { localId: '089', name: 'Mega Zeraora ex', category: 'Pokemon', hp: 270, types: ['Lightning'], stage: 'Basic', dex_ids: [807], illustrator: '5ban Graphics', regulation_mark: 'J', retreat: 1,
      attacks: [ataque(['Lightning'], 'Thunderous Fist', 'This attack does 60 damage for each {L} Energy attached to this Pokémon.', '60×'), ataque(['Lightning', 'Lightning', 'Lightning'], 'Zepto Turn', 'Switch this Pokémon with 1 of your Benched Pokémon.', 150)],
      weaknesses: [{ type: 'Fighting', value: '×2' }] },
    { localId: '090', name: 'Mega Darkrai ex', category: 'Pokemon', hp: 280, types: ['Darkness'], stage: 'Basic', dex_ids: [491], illustrator: '5ban Graphics', regulation_mark: 'J', retreat: 2,
      attacks: [ataque(['Darkness', 'Darkness'], 'Dusk Raid', "If your Benched Pokémon have any damage counters on them, this attack does 110 more damage.", '110+'), ataque(['Darkness', 'Darkness', 'Darkness'], 'Abyss Eye', "If your opponent's Active Pokémon is affected by a Special Condition, it is Knocked Out.")],
      weaknesses: [{ type: 'Grass', value: '×2' }] },
    { localId: '091', name: 'Mega Dragonite ex', category: 'Pokemon', hp: 370, types: ['Dragon'], stage: 'Stage2', evolve_from: 'Dragonair', dex_ids: [149], illustrator: '5ban Graphics', regulation_mark: 'I', retreat: 2,
      abilities: [{ type: 'Ability', name: 'Sky Transport', effect: 'Once during your turn, you may use this Ability. Switch your Active Pokémon with 1 of your Benched Pokémon.' }],
      attacks: [ataque(['Water', 'Lightning', 'Lightning'], 'Ryuno Glide', 'Discard 2 Energy from this Pokémon.', 330)] },
    { localId: '092', name: 'Paradise Resort', category: 'Trainer', trainer_type: 'Stadium', illustrator: 'Naoki Saito', regulation_mark: 'J',
      description: "The Retreat Cost of each Psyduck in play (both yours and your opponent's) is {C} less." },
  ],
}

// ── Las versiones que no son otra carta (tanda 1160) ──
//
// PINGU: «en la 92 metes la versión Staff, y en la 93 World Championships,
// Play! Pokémon Winner y Pokémon Game On!». Son filas de `tcg_card_versions`
// colgadas de la carta, como las de a mano de la 934: clase «sello» (no
// cuentan para completar el set) y su producto de Cardmarket cuando TCGdex lo
// da (la Staff y la Winner; origen `tcgdex`, como las Ball de la 945). Las
// otras dos no salen en ningún catálogo: origen `mano`. Se crean UNA vez
// (si la carta ya tiene una versión con ese nombre, no se toca) y la foto la
// pone PINGU en /admin.
export const VERSIONES_EXTRA = {
  mep: [
    { numero: '092', etiqueta: 'Staff', salio_en: '2026 Pokémon World Championships', cm: 905263 },
    { numero: '093', etiqueta: 'World Championships', salio_en: 'Play! Pokémon 2026 Worlds Celebration events attendance reward' },
    { numero: '093', etiqueta: 'Play! Pokémon Winner', salio_en: 'Play! Pokémon 2026 Worlds Celebration events winner reward', cm: 894885 },
    { numero: '093', etiqueta: 'Pokémon Game On!', salio_en: 'Pokémon Game On! events participation reward (Malaysia, the Philippines, Singapore)' },
  ],
}

// Las ids de las versiones que crea esta pasada van lejos de las de la
// secuencia de /admin (que cuenta -1, -2…): si cogiera la siguiente, la
// próxima versión a mano chocaría con la suya.
export const BASE_ID_VERSIONES = -900000

// El id de versión de un nombre, como `catalogo_id_de_version` de la base:
// «Play! Pokémon Winner» y «play pokemon winner» son la misma.
export const idDeVersion = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

// Lo que falta de la API se completa con las fichas de respaldo; y a lo que
// la API sí trae, se le ponen los datos de la ficha (la API del set solo da
// id, número, nombre y foto).
export function conRespaldo(cartas, tcgdex) {
  const fichas = FICHAS_DE_RESPALDO[tcgdex] || []
  const lista = (cartas || []).slice()
  const porNumero = new Map(lista.map((c, i) => [numeroComparable(c?.localId), i]))
  for (const f of fichas) {
    const n = numeroComparable(f.localId)
    if (porNumero.has(n)) lista[porNumero.get(n)] = { ...f, ...lista[porNumero.get(n)], respaldo: false }
    else lista.push({ ...f, id: `${tcgdex}-${f.localId}`, respaldo: true })
  }
  return lista
}

// Las filas de versión que hay que crear: las de la lista cuya carta existe
// y que esa carta no tiene ya (por su nombre).
export function versionesQueFaltan({ tcgdex, mercado, set, cartas, existentes, desde = BASE_ID_VERSIONES }) {
  const porNumero = new Map((cartas || []).map((c) => [numeroComparable(c.local_id), c]))
  const ya = new Set((existentes || []).map((v) => `${v.card_id}|${idDeVersion(v.etiqueta)}`))
  let id = Math.min(desde, ...(existentes || []).map((v) => Number(v.tcggo_id)).filter((x) => x <= desde)) - 1
  const filas = []
  const sinCarta = []
  for (const v of VERSIONES_EXTRA[tcgdex] || []) {
    const c = porNumero.get(numeroComparable(v.numero))
    if (!c) { sinCarta.push(v.numero); continue }
    if (ya.has(`${c.id}|${idDeVersion(v.etiqueta)}`)) continue
    filas.push({
      tcggo_id: id--, market: mercado, card_id: c.id, set_id: set, numero: null, nombre: c.name || null,
      etiqueta: v.etiqueta, icono: 'sello', clase: 'sello', salio_en: v.salio_en || null,
      cm_id_product: v.cm || null, origen: v.cm ? 'tcgdex' : 'mano', actualizado_at: new Date().toISOString(),
    })
  }
  return { filas, sinCarta }
}

// La lista vive en js/rellenos-tcgdex.js (1159): la lee también /admin para
// saber en qué sets ofrecer «Traer ahora lo que falta».
export const RELLENOS = RELLENOS_TCGDEX

// Los intentos fallidos de ANTES de `rehacerDesde` no cuentan: si no, un
// relleno que agotó sus tres intentos no volvería nunca, por mucho que se
// le pida rehacerlo (la 1159).
export function olvidarIntentosViejos(estado, rellenos, ahora = new Date()) {
  for (const r of rellenos) {
    const desde = Date.parse(r.rehacerDesde || '')
    if (!Number.isFinite(desde) || ahora.getTime() < desde) continue
    const error = estado.ultimoError
    const fechaError = Date.parse(error?.fecha || '')
    if (estado.intentos?.[r.clave] && (!(error?.clave === r.clave) || !Number.isFinite(fechaError) || fechaError < desde)) delete estado.intentos[r.clave]
  }
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
  if (!texto) return null
  try { return JSON.parse(texto) } catch { return null }
}

// ── Lo puro ──

// Las filas de las cartas de TCGdex (el `cards` de su set, que trae id,
// localId, nombre e imagen si la tiene). La foto solo si TCGdex la da: un
// camino inventado es una foto rota (la 441). El español, si su set en
// español lo trae; el nombre de la fila es el inglés (la clave, la 335).
export function filasDeTcgdex(cartas, { set, mercado, tcgdex, es = new Map() }) {
  const cms = CARDMARKET[tcgdex] || new Map()
  return (cartas || []).filter((c) => c?.id && c?.localId != null).map((c) => {
    const n = numeroComparable(c.localId)
    return {
      id: String(c.id),
      market: mercado,
      set_id: set,
      local_id: String(c.localId),
      name: c.name || String(c.id),
      name_en: c.name || null,
      name_es: es.get(n) || null,
      image_path: imagePathFromUrl(c.image) || null,
      cm_id_product_propio: cms.get(n) || null,
      origen: ORIGEN,
      // La ficha, cuando viene de las de respaldo (1160): solo lo que trae.
      ...Object.fromEntries(COLUMNAS_DE_FICHA.filter((k) => c[k] !== undefined).map((k) => [k, c[k]])),
      ...(c.category ? { rarity: 'Promo', variants: { normal: false, reverse: false, holo: true, firstEdition: false } } : {}),
    }
  })
}
const COLUMNAS_DE_FICHA = ['category', 'hp', 'types', 'stage', 'evolve_from', 'dex_ids', 'illustrator', 'regulation_mark', 'retreat', 'trainer_type', 'description', 'attacks', 'abilities', 'weaknesses']

export async function pasada({
  env = process.env, fetchImpl = fetch, restImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  rellenos = RELLENOS, ahora = new Date(),
  // «Traer ahora» de /admin (1159): sin mirar si toca ni los intentos.
  forzar = false, clave: soloClave = null,
} = {}) {
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
  for (const k of ['hechos', 'intentos']) if (!estado[k] || typeof estado[k] !== 'object') estado[k] = {}
  const persistir = () => guardarEstado(CLAVE_ESTADO, estado)
  olvidarIntentosViejos(estado, rellenos, ahora)
  const pendientes = forzar
    ? rellenos.filter((r) => !soloClave || r.clave === soloClave)
    : rellenos.filter((r) => tocaRepasar(r, estado.hechos[r.clave], ahora) && (Number(estado.intentos[r.clave]) || 0) < MAXIMO_INTENTOS)
  if (forzar && !pendientes.length) return { ok: false, error: `No hay ningún relleno de TCGdex «${soloClave}».` }
  if (!pendientes.length) {
    // Una vez al día dice que sigue viva, o el semáforo de /admin la pinta
    // en ámbar («más de un día sin escribir») toda la semana entre repasos.
    if (!estado.mirado || ahora - new Date(estado.mirado) > 20 * 3600 * 1000) {
      estado.mirado = ahora.toISOString()
      try { await persistir() } catch { /* solo era el latido */ }
    }
    return { ok: true, saltado: 'nada pendiente', hechos: estado.hechos }
  }
  const relleno = pendientes[0]
  const tropiezo = async (error, donde) => {
    const n = (Number(estado.intentos[relleno.clave]) || 0) + 1
    estado.intentos[relleno.clave] = n
    estado.ultimoError = { fecha: ahora.toISOString(), clave: relleno.clave, donde, intento: n, error }
    await persistir()
    return { ok: false, clave: relleno.clave, error }
  }

  // Nuestro set y lo que ya tiene (gratis: nuestra base).
  let set
  let nuestras
  try {
    set = elegirSet((await pedir(`tcg_sets?select=id,name,name_en,tcg_online_code,tcggo_id,oculto,card_count_total&market=eq.${relleno.mercado}&${consultaDelSet(relleno)}&limit=10`)) || [])
    nuestras = set ? (await pedir(`tcg_cards?select=id,local_id,name&market=eq.${relleno.mercado}&set_id=eq.${encodeURIComponent(set.id)}&limit=2000`)) || [] : []
  } catch (e) {
    return tropiezo(`nuestra base: ${String(e?.message || e).slice(0, 160)}`, 'leer')
  }
  if (!set) {
    estado.hechos[relleno.clave] = { fecha: ahora.toISOString(), estado: 'sinSet', buscado: relleno.set }
    await persistir()
    return { ok: true, saltado: `ningún set de ${relleno.mercado} casa con ${JSON.stringify(relleno.set)}` }
  }

  // Sus cartas en TCGdex (inglés) y, si las hay, sus nombres en español.
  let cartas
  let avisoTcgdex = null
  const hayRespaldo = (FICHAS_DE_RESPALDO[relleno.tcgdex] || []).length > 0
  try {
    const res = await fetchImpl(`${TCGDEX}/en/sets/${encodeURIComponent(relleno.tcgdex)}`)
    if (!res.ok) avisoTcgdex = `TCGdex ${res.status}`
    else {
      cartas = (await res.json())?.cards
      if (!Array.isArray(cartas)) avisoTcgdex = 'TCGdex no trae la lista de cartas del set'
    }
  } catch (e) {
    avisoTcgdex = `TCGdex: ${String(e?.message || e).slice(0, 160)}`
  }
  // Sin la API, lo que haya de respaldo se escribe igual (1160); sin
  // respaldo, es un intento fallido como siempre.
  if (avisoTcgdex && !hayRespaldo) return tropiezo(avisoTcgdex, 'tcgdex')
  cartas = conRespaldo(Array.isArray(cartas) ? cartas : [], relleno.tcgdex)
  const es = new Map()
  try {
    const res = await fetchImpl(`${TCGDEX}/es/sets/${encodeURIComponent(relleno.tcgdex)}`)
    if (res.ok) for (const c of (await res.json())?.cards || []) if (c?.name) es.set(numeroComparable(c.localId), c.name)
  } catch {
    // Sin español se escribe en inglés: el engorde lo traduce luego.
  }

  const todas = filasDeTcgdex(cartas, { set: set.id, mercado: relleno.mercado, tcgdex: relleno.tcgdex, es })
  let faltan = cartasQueFaltan(todas, nuestras)
  const faltaban = faltan.map((f) => f.local_id)
  // Un id que ya existe en otro set no se pisa (el upsert lo movería), y se
  // dice DÓNDE está: una carta saltada en silencio es una carta que «no
  // sale» sin que nadie sepa por qué (la 1159).
  let enOtroSet = []
  try {
    if (faltan.length) {
      const ya = (await pedir(`tcg_cards?select=id,set_id,local_id&market=eq.${relleno.mercado}&id=in.(${faltan.map((f) => `"${f.id}"`).join(',')})`)) || []
      const usados = new Set(ya.map((f) => f.id))
      enOtroSet = ya.map((f) => ({ id: f.id, set: f.set_id, numero: f.local_id }))
      faltan = faltan.filter((f) => !usados.has(f.id))
    }
    faltan = igualarClaves(faltan)
    for (let i = 0; i < faltan.length; i += 200) await pedir('tcg_cards?on_conflict=id,market', { method: 'POST', body: JSON.stringify(faltan.slice(i, i + 200)) })
  } catch (e) {
    return tropiezo(`nuestra base al escribir: ${String(e?.message || e).slice(0, 160)}`, 'escribir')
  }

  // Las versiones de la lista (1160), sobre las cartas que ya hay en el set
  // (las de antes y las recién escritas).
  let versiones = null
  if ((VERSIONES_EXTRA[relleno.tcgdex] || []).length) {
    try {
      const delSet = [...nuestras, ...faltan].map((c) => ({ id: c.id, local_id: c.local_id, name: c.name }))
      const ids = [...new Set(delSet.map((c) => c.id))]
      const existentes = ids.length ? (await pedir(`tcg_card_versions?select=tcggo_id,card_id,etiqueta&market=eq.${relleno.mercado}&card_id=in.(${ids.map((i) => `"${i}"`).join(',')})`)) || [] : []
      const lejanas = (await pedir(`tcg_card_versions?select=tcggo_id&tcggo_id=lte.${BASE_ID_VERSIONES}&order=tcggo_id.asc&limit=1`)) || []
      const { filas, sinCarta } = versionesQueFaltan({ tcgdex: relleno.tcgdex, mercado: relleno.mercado, set: set.id, cartas: delSet, existentes: [...existentes, ...lejanas] })
      if (filas.length) await pedir('tcg_card_versions', { method: 'POST', body: JSON.stringify(igualarClaves(filas)) })
      versiones = { creadas: filas.map((f) => `${f.etiqueta} (${delSet.find((c) => c.id === f.card_id)?.local_id})`), sinCarta }
    } catch (e) {
      versiones = { error: String(e?.message || e).slice(0, 160) }
    }
  }
  delete estado.intentos[relleno.clave]
  estado.hechos[relleno.clave] = {
    fecha: ahora.toISOString(), estado: 'hecho', set: set.id, nombreSet: set.name_en || set.name || null,
    suyas: todas.length, teniamos: nuestras.length, faltaban: faltaban.length, escritas: faltan.length,
    numeros: faltan.map((f) => f.local_id).join(', ') || null,
    conCardmarket: faltan.filter((f) => f.cm_id_product_propio).length,
    sinFoto: faltan.filter((f) => !f.image_path).length,
    enOtroSet: enOtroSet.length ? enOtroSet.slice(0, 20) : undefined,
    conFicha: faltan.filter((f) => f.category).map((f) => f.local_id).join(', ') || undefined,
    avisoTcgdex: avisoTcgdex || undefined,
    versiones: versiones || undefined,
    ...(forzar ? { aMano: true } : {}),
  }
  await persistir()
  return { ok: true, hecho: estado.hechos[relleno.clave] }
}

export default async () => {
  const r = await pasada()
  if (!r.ok) console.warn('tcgdex-rellenar-set:', JSON.stringify(r).slice(0, 400))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada diez minutos; con todo hecho y sin tocar repasar, es leer el estado.
// Más espaciada desde la 1310 (C1 del plan): cada despertar se paga aunque
// no haya nada que hacer, y esta termina su trabajo antes. SCHEMA 1310.
export const config = { schedule: '6 */3 * * *' }
