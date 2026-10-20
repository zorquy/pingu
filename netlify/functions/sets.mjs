// La lista de expansiones de un catálogo, servida desde la CDN (tanda 813, VE1).
//
// POR QUÉ. /mi-coleccion, /cartas y el Panel piden la lista ENTERA de sets
// cada vez que se abren: cientos de filas que cambian unas pocas veces al día
// (cuando el catálogo de TCGGO o el calco japonés escriben). Pedírsela a
// Supabase desde cada navegador es una consulta igual para todo el mundo, y
// la CDN de Netlify sabe guardar una respuesta igual para todo el mundo.
//
// Se llama a pelo (`/.netlify/functions/sets?market=JP`) y no detrás de una
// reescritura: una reescritura no le pasa la consulta a una función v2 (la
// 633). Y quien la llama tiene su respaldo directo a Supabase: si esto falla,
// la página no se queda sin estantería.
//
// Solo lee filas públicas, con la clave publicable (la de js/supabase.js).
import { MERCADOS } from '../../js/mercados.js'

const SUPABASE_URL = 'https://zqamujmfavwrsqlgbead.supabase.co'
const SUPABASE_KEY = 'sb_publishable_ohfCPNNVCoqcVBainTbDlg_04mJliQZ'

// Las columnas que pide la estantería. Una columna que no se pide llega
// `undefined` (la 523): si una pantalla necesita otra, va AQUÍ.
export const COLUMNAS = 'id,market,name,name_en,serie_id,serie_name,serie_name_en,logo_path,logo_scrydex,logo_tcggo,symbol_scrydex,symbol_url,release_date,card_count_official,card_count_total,tcg_online_code,orden,oculto,tcggo_id'

// Supabase corta a 1.000 filas sin avisar (la 808): se pide a trozos.
const TROZO = 1000
const MAX_TROZOS = 5

// Diez minutos en la CDN y, pasados, se sirve lo guardado mientras se pide
// lo nuevo por detrás. Con su ETIQUETA (908), para que /admin la tire al
// guardar algo de Colecciones (sets-purgar.mjs). Y el navegador ya no se
// la guarda (era un minuto): la CDN contesta igual de rápido, y así quien
// acaba de cambiar algo lo ve al recargar.
export const ETIQUETA_CACHE = 'sets'
export const CABECERAS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=0, must-revalidate',
  'netlify-cdn-cache-control': 'public, durable, max-age=600, stale-while-revalidate=86400',
  'netlify-cache-tag': ETIQUETA_CACHE,
}

export function mercadoDePeticion(url) {
  const m = String(new URL(url).searchParams.get('market') || '').trim()
  if (m === 'todos') return 'todos'
  return Object.prototype.hasOwnProperty.call(MERCADOS, m) ? m : null
}

export async function leerSets(mercado, { fetchImpl = fetch } = {}) {
  const filtro = mercado === 'todos' ? '' : `&market=eq.${mercado}`
  const filas = []
  for (let i = 0; i < MAX_TROZOS; i++) {
    const ruta = `tcg_sets?select=${COLUMNAS}${filtro}&oculto=not.is.true&order=release_date.desc.nullslast,id.asc&offset=${i * TROZO}&limit=${TROZO}`
    const res = await fetchImpl(`${SUPABASE_URL}/rest/v1/${ruta}`, {
      headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}`, accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`supabase ${res.status}`)
    const trozo = await res.json()
    filas.push(...trozo)
    if (trozo.length < TROZO) return filas
  }
  return filas
}

export async function responder(req, { fetchImpl = fetch } = {}) {
  const mercado = mercadoDePeticion(req.url)
  if (!mercado) return new Response(JSON.stringify({ error: 'market' }), { status: 400, headers: { 'content-type': 'application/json' } })
  try {
    const sets = await leerSets(mercado, { fetchImpl })
    return new Response(JSON.stringify({ sets, generado: new Date().toISOString() }), { status: 200, headers: CABECERAS })
  } catch (e) {
    // Un fallo NO se guarda en la CDN: sin cabecera de caché, la siguiente
    // petición vuelve a preguntar. Quien llama cae a Supabase directo.
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 502, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })
  }
}

export default (req) => responder(req)
