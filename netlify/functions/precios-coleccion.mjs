// Los precios de Cardmarket de las cartas que alguien TIENE (tanda 365).
//
// Cada pasada pide a la base qué cartas de las colecciones no tienen
// precio o lo tienen de hace más de 20 horas (`precios_pendientes`), le
// pide a TCGdex la ficha de cada una y guarda `pricing.cardmarket` en
// `tcg_card_prices`. TCGdex copia la guía de Cardmarket una vez al día,
// así que refrescar más a menudo no traería nada nuevo.
//
// Es la misma cuenta que `cartas-detalle` (tanda 322): una petición por
// carta a un catálogo comunitario y gratuito, así que con tope por pasada,
// pausa entre peticiones y presupuesto de tiempo propio (Netlify mata una
// función programada a los 30 s). Lo que no da tiempo, a la siguiente.
//
// Y LOS DOS MERCADOS (tanda 586): de la misma ficha de TCGdex se guardan
// Cardmarket (euros) y TCGplayer (dólares, por versión). La 585 había
// puesto pokemontcg.io de respaldo; esa API murió (la compró Scrydex) y se
// quitó el mismo día.
//
// VARIABLES DE ENTORNO: SUPABASE_SERVICE_ROLE_KEY (obligatoria).
import { urlDePrecio, filaDePrecio, COLUMNAS_TCGPLAYER } from '../../js/cardmarket.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
export const POR_PASADA = 40
const PAUSA_MS = 300
const PRESUPUESTO_MS = 22000

const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

export async function procesar({ env = process.env, fetchImpl = fetch, reloj = () => Date.now(), pausa = PAUSA_MS, ahora = () => new Date() } = {}) {
  const clave = env.SUPABASE_SERVICE_ROLE_KEY
  if (!clave) return { ok: false, error: 'Falta SUPABASE_SERVICE_ROLE_KEY' }
  const cab = { apikey: clave, authorization: `Bearer ${clave}`, 'content-type': 'application/json' }
  const empezo = reloj()

  let pendientes
  try {
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/precios_pendientes`, {
      method: 'POST',
      headers: cab,
      body: JSON.stringify({ p_limite: POR_PASADA }),
    })
    const texto = await res.text()
    if (!res.ok) {
      if (/PGRST202|Could not find/.test(texto)) return { ok: false, saltado: 'falta ejecutar supabase-migration-mi-coleccion.sql' }
      throw new Error(`Supabase ${res.status}: ${texto.slice(0, 200)}`)
    }
    pendientes = (JSON.parse(texto) || []).map((f) => f.card_id).filter(Boolean)
  } catch (e) {
    return { ok: false, error: String(e?.message || e) }
  }
  if (!pendientes.length) return { ok: true, guardados: 0 }

  const filas = []
  const fallos = []
  for (const id of pendientes) {
    if (reloj() - empezo > PRESUPUESTO_MS) break
    try {
      const res = await fetchImpl(urlDePrecio(id), { headers: { accept: 'application/json' } })
      // Un 404 (la carta no existe en TCGdex en inglés) se apunta SIN
      // precio: queda marcada como mirada y no se pide en cada pasada.
      const carta = res.status === 404 ? {} : res.ok ? await res.json() : null
      if (!carta) throw new Error(`TCGdex ${res.status}`)
      filas.push(filaDePrecio(id, carta.pricing, ahora()))
    } catch (e) {
      fallos.push({ id, error: String(e?.message || e).slice(0, 120) })
    }
    await dormir(pausa)
  }

  if (filas.length) {
    const guardado = await guardarFilas(filas, { fetchImpl, cab })
    if (guardado.error) return { ok: false, error: guardado.error, fallos }
  }
  return { ok: fallos.length === 0, pendientes: pendientes.length, guardados: filas.length, fallos }
}

// Las columnas que trajeron la 585 y la 586. Hasta que la migración esté
// puesta no existen, y PostgREST rechaza la sentencia ENTERA por una
// columna que no conoce: se quitan y se vuelve a mandar — un puente como
// el de `cambio`, con la misma caducidad.
export const COLUMNAS_NUEVAS = ['cm_url', 'origen', ...COLUMNAS_TCGPLAYER]

// Un `insert` de varias filas pide que TODAS tengan las mismas claves:
// las de TCGdex no traen `cm_url` ni `origen` y las del respaldo sí.
export function igualarClaves(filas) {
  const claves = [...new Set(filas.flatMap((f) => Object.keys(f)))]
  return filas.map((f) => Object.fromEntries(claves.map((k) => [k, f[k] ?? null])))
}

async function guardarFilas(filas, { fetchImpl, cab }) {
  const mandar = async (cuerpo) =>
    fetchImpl(`${SUPABASE_URL}/rest/v1/tcg_card_prices`, {
      method: 'POST',
      headers: { ...cab, Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(cuerpo),
    })
  let res = await mandar(igualarClaves(filas))
  if (res.ok) return { ok: true }
  const texto = (await res.text()).slice(0, 300)
  const faltaColumna = res.status === 400 && (/PGRST204|42703/.test(texto) || COLUMNAS_NUEVAS.some((c) => texto.includes(c)))
  if (!faltaColumna) return { error: `Supabase ${res.status}: ${texto.slice(0, 200)}` }
  const sinNuevas = filas.map((f) => Object.fromEntries(Object.entries(f).filter(([k]) => !COLUMNAS_NUEVAS.includes(k))))
  res = await mandar(igualarClaves(sinNuevas))
  if (res.ok) return { ok: true, sinMigracion: true }
  return { error: `Supabase ${res.status}: ${(await res.text()).slice(0, 200)}` }
}

export default async function handler() {
  const r = await procesar()
  if (!r.ok) console.warn('precios-coleccion:', JSON.stringify(r).slice(0, 800))
  return new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } })
}

// Cada diez minutos: 40 cartas por pasada son ~5.700 al día, de sobra
// para refrescarlas todas cada día mientras la web tenga el tamaño que
// tiene. Si se queda corto, `precios_pendientes` siempre coge primero las
// que nunca se han mirado.
export const config = { schedule: '*/10 * * * *' }
