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

export const RELLENOS = [
  { clave: 'mep-tcgdex', mercado: 'WEST', set: { ids: ['mep'], codigo: 'MEP', nombre: 'MEP Black Star Promos' }, tcgdex: 'mep', cadaDias: 7, motivo: 'TCGGO no tiene las MEP más nuevas (la 90 de Mega Darkrai y otras)' },
]

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
    }
  })
}

export async function pasada({
  env = process.env, fetchImpl = fetch, restImpl = null, estadoImpl = null, guardarEstadoImpl = null,
  rellenos = RELLENOS, ahora = new Date(),
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
  const pendientes = rellenos.filter((r) => tocaRepasar(r, estado.hechos[r.clave], ahora) && (Number(estado.intentos[r.clave]) || 0) < MAXIMO_INTENTOS)
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
    nuestras = set ? (await pedir(`tcg_cards?select=id,local_id&market=eq.${relleno.mercado}&set_id=eq.${encodeURIComponent(set.id)}&limit=2000`)) || [] : []
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
  try {
    const res = await fetchImpl(`${TCGDEX}/en/sets/${encodeURIComponent(relleno.tcgdex)}`)
    if (!res.ok) return tropiezo(`TCGdex ${res.status}`, 'tcgdex')
    cartas = (await res.json())?.cards
    if (!Array.isArray(cartas)) return tropiezo('TCGdex no trae la lista de cartas del set', 'tcgdex')
  } catch (e) {
    return tropiezo(`TCGdex: ${String(e?.message || e).slice(0, 160)}`, 'tcgdex')
  }
  const es = new Map()
  try {
    const res = await fetchImpl(`${TCGDEX}/es/sets/${encodeURIComponent(relleno.tcgdex)}`)
    if (res.ok) for (const c of (await res.json())?.cards || []) if (c?.name) es.set(numeroComparable(c.localId), c.name)
  } catch {
    // Sin español se escribe en inglés: el engorde lo traduce luego.
  }

  const todas = filasDeTcgdex(cartas, { set: set.id, mercado: relleno.mercado, tcgdex: relleno.tcgdex, es })
  let faltan = cartasQueFaltan(todas, nuestras)
  // Un id que ya existe en otro set no se pisa (el upsert lo movería).
  try {
    if (faltan.length) {
      const ya = (await pedir(`tcg_cards?select=id&market=eq.${relleno.mercado}&id=in.(${faltan.map((f) => `"${f.id}"`).join(',')})`)) || []
      const usados = new Set(ya.map((f) => f.id))
      faltan = faltan.filter((f) => !usados.has(f.id))
    }
    faltan = igualarClaves(faltan)
    for (let i = 0; i < faltan.length; i += 200) await pedir('tcg_cards?on_conflict=id,market', { method: 'POST', body: JSON.stringify(faltan.slice(i, i + 200)) })
  } catch (e) {
    return tropiezo(`nuestra base al escribir: ${String(e?.message || e).slice(0, 160)}`, 'escribir')
  }
  delete estado.intentos[relleno.clave]
  estado.hechos[relleno.clave] = {
    fecha: ahora.toISOString(), estado: 'hecho', set: set.id,
    suyas: todas.length, teniamos: nuestras.length, escritas: faltan.length,
    numeros: faltan.map((f) => f.local_id).join(', ') || null,
    conCardmarket: faltan.filter((f) => f.cm_id_product_propio).length,
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
export const config = { schedule: '6-59/10 * * * *' }
