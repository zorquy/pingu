// La lista de expansiones de un catálogo, primero desde la CDN (tanda 813, VE1).
//
// `netlify/functions/sets.mjs` la sirve igual para todo el mundo y la CDN la
// guarda diez minutos; si no contesta (o en las pruebas, donde no existe), se
// pide a Supabase como siempre. Las dos devuelven las mismas columnas y el
// mismo orden, así que quien llama no sabe ni le importa de dónde vino.
// Los sets escondidos NO vienen (la 550): no los pinta nadie de los que usan esto.
const COLUMNAS = 'id,market,name,name_en,serie_id,serie_name,serie_name_en,logo_path,logo_scrydex,logo_tcggo,symbol_scrydex,symbol_url,release_date,card_count_official,card_count_total,tcg_online_code,orden,oculto,tcggo_id'
const TROZO = 1000
const ESPERA_MS = 4000

const enCurso = new Map()

async function desdeLaCdn(mercado, fetchImpl) {
  const res = await fetchImpl(`/.netlify/functions/sets?market=${encodeURIComponent(mercado)}`, { signal: AbortSignal.timeout(ESPERA_MS) })
  if (!res.ok) throw new Error(`sets ${res.status}`)
  const cuerpo = await res.json()
  if (!Array.isArray(cuerpo?.sets)) throw new Error('sets sin lista')
  return cuerpo.sets
}

// Supabase corta a 1.000 filas sin avisar (la 808): a trozos con `.range()`.
async function desdeSupabase(mercado, cliente) {
  const filas = []
  for (let desde = 0; desde < 5 * TROZO; desde += TROZO) {
    let q = cliente.from('tcg_sets').select(COLUMNAS)
    if (mercado !== 'todos') q = q.eq('market', mercado)
    const { data, error } = await q
      .order('release_date', { ascending: false, nullsFirst: false })
      .order('id')
      .range(desde, desde + TROZO - 1)
    if (error) throw error
    filas.push(...(data || []).filter((s) => !s.oculto))
    if ((data || []).length < TROZO) break
  }
  return filas
}

// `mercado`: 'WEST', 'JP', … o 'todos'. Dos llamadas a la vez comparten la
// misma petición; una que falla no se queda guardada.
export function setsDelCatalogo(mercado, { cliente, fetchImpl = fetch } = {}) {
  if (enCurso.has(mercado)) return enCurso.get(mercado)
  const p = desdeLaCdn(mercado, fetchImpl)
    .catch(async () => {
      if (!cliente) cliente = (await import('./supabase.js')).supabase
      return desdeSupabase(mercado, cliente)
    })
    .catch((e) => {
      enCurso.delete(mercado)
      throw e
    })
  enCurso.set(mercado, p)
  return p
}

// Para quien vuelve a pedir después de cambiar algo (o para las pruebas).
export function olvidarSets() {
  enCurso.clear()
}
