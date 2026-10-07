// UN BUSCADOR PARA TODO (718: N2 y D3 de la lista de propuestas, elegidas
// por PINGU). Cada pantalla buscaba en lo suyo —el foro en el foro, las
// cartas en Mi colección—, y para encontrar un hilo había que ir antes al
// foro. Esto busca a la vez en las cartas, las guías, el foro y la gente,
// y lo usan los tres sitios que buscan: /buscar, la lupa de la barra y la
// paleta de Ctrl+K. Se hace una vez y sirve para los tres.
//
// Cada grupo vuelve con UNO de tres estados, y no se juntan (la 510):
//   { error: true }  → no se ha podido preguntar (se dice, y se reintenta);
//   { filas: [] }    → se ha preguntado y no hay nada;
//   { filas: [...] } → lo que haya.
// Un `[]` por un fallo diría «no hay» de algo que no se sabe.
import { supabase } from './supabase.js'
import { normalizeSearch } from './texto.js'
import { conVueltaAtras, terminoParaFiltro } from './busqueda.js'
import { precioDeFila, valorDe } from './cardmarket.js'

export const GRUPOS = [
  ['cartas', 'Cartas'],
  ['guias', 'Guías'],
  ['temas', 'Foro'],
  ['gente', 'Gente'],
]

// Lo que cada grupo pregunta. Las columnas van contadas: una que no existe
// tumba la consulta entera (42703, la 624), así que aquí solo van las que
// ya piden otras pantallas.
const CONSULTAS = {
  async cartas(crudo, limite) {
    const palabras = normalizeSearch(crudo).split(/\s+/).filter(Boolean)
    if (!palabras.length) return []
    let q = supabase
      .from('tcg_cards')
      .select('id, market, set_id, local_id, name, name_es, image_path, image_tcggo, tcg_sets(name)')
      .eq('market', 'WEST')
    for (const p of palabras) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
    const { data, error } = await q.order('name_search').limit(limite)
    if (error) throw error
    const cartas = data || []
    // El precio, en una segunda consulta y con la regla de siempre (el
    // mínimo en español, y si no el general: `valorDe`). Si falla, las
    // cartas salen igual y sin cifra: el precio es un extra de la fila.
    if (cartas.length) {
      const { data: precios } = await supabase.from('tcg_card_prices').select('*').in('card_id', cartas.map((c) => c.id))
      const porId = new Map((precios || []).map((p) => [p.card_id, p]))
      for (const c of cartas) c.valor = valorDe(precioDeFila(porId.get(c.id)), 'es')
    }
    return cartas
  },
  async guias(crudo, limite) {
    const patron = `%${terminoParaFiltro(crudo)}%`
    const base = () => supabase.from('guides').select('slug, title, description, cover_emoji').not('published_at', 'is', null)
    const { data, error } = await conVueltaAtras(
      () => base().ilike('search_norm', patron).limit(limite),
      () => base().ilike('title', `%${crudo.replace(/[,()%]/g, ' ')}%`).limit(limite)
    )
    if (error) throw error
    return data || []
  },
  async temas(crudo, limite) {
    const patron = `%${terminoParaFiltro(crudo)}%`
    const { data, error } = await conVueltaAtras(
      () => supabase.from('forum_threads').select('id, title').ilike('search_norm', patron).limit(limite),
      () => supabase.from('forum_threads').select('id, title').ilike('title', `%${crudo.replace(/[,()%]/g, ' ')}%`).limit(limite)
    )
    if (error) throw error
    return data || []
  },
  async gente(crudo, limite) {
    const plegado = terminoParaFiltro(crudo)
    const escrito = crudo.replace(/[,()%*\s]/g, '')
    if (!plegado) return []
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, username, display_name, avatar_url')
      // `*` es el comodín de PostgREST dentro de un `or` (el `%` también
      // vale, pero en una URL hay que escaparlo).
      .or(`username.ilike.${escrito || plegado}*,search_norm.ilike.*${plegado}*`)
      .neq('is_banned', true)
      .order('username')
      .limit(limite)
    if (error) throw error
    return data || []
  },
}

// Busca en los grupos pedidos a la vez. Menos de dos letras no pregunta:
// con una sola, «a», saldría media base de datos.
export async function buscarTodo(crudo, { limite = 4, grupos = GRUPOS.map(([g]) => g) } = {}) {
  const texto = String(crudo || '').trim()
  const salida = {}
  if (texto.length < 2) return salida
  await Promise.all(
    grupos.map(async (g) => {
      try {
        salida[g] = { filas: await CONSULTAS[g](texto, limite) }
      } catch {
        salida[g] = { error: true }
      }
    })
  )
  return salida
}

// Si no hay NADA en ningún grupo que haya contestado. Un grupo que ha
// fallado no cuenta como vacío: no se sabe.
export function todoVacio(resultado) {
  const grupos = Object.values(resultado || {})
  return grupos.length > 0 && grupos.every((g) => !g.error && !g.filas?.length)
}

// ── Las búsquedas recientes ──
// Por persona y en este navegador (una comodidad, no un dato que tenga
// que viajar). Sin almacenamiento —modo privado— no se recuerda y ya.
const CLAVE = 'pokedoc-busquedas'
const MAXIMO = 6

export function recordarBusqueda(texto, almacen = globalThis.localStorage) {
  const t = String(texto || '').trim()
  if (t.length < 2) return
  try {
    const antes = leerRecientes(almacen).filter((x) => x.toLowerCase() !== t.toLowerCase())
    almacen.setItem(CLAVE, JSON.stringify([t, ...antes].slice(0, MAXIMO)))
  } catch {}
}

export function leerRecientes(almacen = globalThis.localStorage) {
  try {
    const v = JSON.parse(almacen.getItem(CLAVE) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, MAXIMO) : []
  } catch {
    return []
  }
}

export function olvidarRecientes(almacen = globalThis.localStorage) {
  try {
    almacen.removeItem(CLAVE)
  } catch {}
}
