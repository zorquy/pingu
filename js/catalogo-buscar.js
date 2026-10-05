// Buscar una carta en el catálogo por nombre, catálogo y expansión (tanda
// 570). Nació dentro de `js/nueve.js` y sale a su fichero porque «¿Qué
// carta es?» pide lo mismo: un buscador para escribir la respuesta.
import { supabase } from './supabase.js'
import { normalizeSearch } from './texto.js'
import { ID_DE_POCKET, esDelTCG } from './catalogo-series.js'

// Lo que echa a TCG Pocket de una consulta (tanda 573). PINGU: «salen
// cartas del TCG Pocket, y esas no deberían estar». Es la misma regla que
// `esDelTCG` —el id del set (A1, A2b, B1…) y la serie `tcgp`— escrita
// para PostgREST: un regex sobre `set_id`. `imatch` es `~*` de Postgres.
export const REGEX_POCKET = ID_DE_POCKET.source
export function sinPocket(q) {
  return q.not('set_id', 'imatch', REGEX_POCKET)
}

// Lo justo para pintar un resultado y una carta. Sin `rarity`: pedirla
// obliga a pedir también `rarity_en` (tanda 523), y aquí no se enseña.
export const COLUMNAS_RESULTADO = 'id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,tcg_sets(name,name_en,tcg_online_code,serie_id)'

const setsPorMercado = new Map()

export async function setsDelMercado(mercado) {
  if (setsPorMercado.has(mercado)) return setsPorMercado.get(mercado)
  const { data, error } = await supabase
    .from('tcg_sets')
    .select('id,name,name_en,release_date')
    .eq('market', mercado)
    .order('release_date', { ascending: false, nullsFirst: false })
    .limit(600)
  if (error) throw error
  // Sin las de Pocket (tanda 573): no es un filtro de la consulta sino de
  // la lista, porque son pocas y `esDelTCG` ya sabe cuáles.
  const lista = (data || []).filter(esDelTCG)
  setsPorMercado.set(mercado, lista)
  return lista
}

// Devuelve las cartas, o `null` si no hay nada que buscar (sin texto y
// sin expansión): el que llama decide qué decir en cada caso.
export async function buscarEnCatalogo({ mercado, set = '', texto = '', limite = 60, soloTCG = false }) {
  // NFC después de normalizar (tanda 557): sin él, una búsqueda en
  // japonés con dakuten no casa con lo que guarda Postgres.
  const limpio = normalizeSearch(texto).normalize('NFC').trim()
  const palabras = limpio.split(/\s+/).filter(Boolean).slice(0, 4)
  if (!palabras.length && !set) return null
  let q = supabase.from('tcg_cards').select(COLUMNAS_RESULTADO).eq('market', mercado)
  if (soloTCG) q = sinPocket(q)
  if (set) q = q.eq('set_id', set)
  for (const p of palabras) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
  const { data, error } = await q.order('name_search').limit(limite)
  if (error) throw error
  return data || []
}
