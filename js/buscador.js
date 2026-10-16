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
import { COLUMNAS_RANGO } from './rangos.js'
import { entenderBusqueda, partirBusqueda, filtroDeNumero, conPrefijoPegado, prefijoSuelto, llevaElNumero, expansionEnBusqueda, tocaProbarExpansion } from './mi-coleccion/busqueda.js'
import { setsDelCatalogo } from './sets-catalogo.js'
import { esDelTCG, deSetVisible } from './catalogo-series.js'

// Lo justo para pintar la fila (y `serie_id` para echar a TCG Pocket).
const COLUMNAS_CARTA = 'id, market, set_id, local_id, name, name_es, name_en, image_path, image_tcggo, tcg_sets(name, name_en, serie_id, oculto)'

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
  // Las cartas, con las MISMAS reglas que el buscador de Cartas (851).
  // PINGU: «busco Pikachu 277 y no encuentro nada […] en el buscador de
  // cartas me sale el Pikachu de Ascended Heroes». Aquí cada palabra tenía
  // que estar en el NOMBRE, y «277» no lo está. Ahora un número suelto es el
  // número de la carta (o el de Pokédex), «151/165» y «MEW 151» dicen la
  // expansión, y si por nombre no sale nada se prueba por ilustrador.
  async cartas(crudo, limite) {
    // La lista de sets siempre (874): además del código y el total, la cola
    // de lo escrito puede ser una expansión. Viene de la CDN y se pide una vez.
    const sets = await setsDelCatalogo('WEST', { cliente: supabase }).catch(() => [])
    const leida = entenderBusqueda(crudo, sets)
    const consulta = (aplicar) => {
      let q = supabase.from('tcg_cards').select(COLUMNAS_CARTA).eq('market', 'WEST')
      q = aplicar(q)
      // De más, para quitar las de Pocket y de sets escondidos sin quedarse corto.
      return q.order('name_search').limit(limite * 3)
    }
    const porNombre = async (texto, setIds, filtroLocal = null) => {
      const { nombre, numero, prefijo } = partirBusqueda(normalizeSearch(texto))
      if (!nombre.length && !numero) return { filas: [], numero: null, prefijo: null }
      const { data, error } = await consulta((q) => {
        if (setIds?.length) q = q.in('set_id', setIds)
        for (const p of nombre) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
        if (numero) q = q.or(filtroDeNumero(numero, prefijo))
        if (filtroLocal) q = q.or(filtroLocal)
        return q
      })
      if (error) throw error
      return { filas: data || [], numero, prefijo }
    }
    let r = await porNombre(leida.texto, leida.setIds)
    // «Pikachu XY 124» con el prefijo suelto (852): pegados, segunda pasada.
    if (!r.filas.length && conPrefijoPegado(leida.texto)) r = await porNombre(conPrefijoPegado(leida.texto), leida.setIds)
    // Y «Pikachu XY», las letras solas (853): las cartas de Pikachu cuyo número empieza por XY.
    const suelto = r.filas.length ? null : prefijoSuelto(normalizeSearch(leida.texto))
    if (suelto) r = await porNombre(suelto.texto, leida.setIds, suelto.filtro)
    // «mew 151» puede ser el set o el Pokémon: si como set no hay nada, como nombre.
    if (!r.filas.length && leida.codigo) r = await porNombre(crudo, null)
    // «Pikachu asc», «hypno rocket» (874): la cola como EXPANSIÓN. Sin nada
    // por nombre, siempre; con algo pero poco, solo si la cola son palabras
    // enteras (`tocaProbarExpansion`). Lo de por nombre va delante.
    if (!leida.setIds?.length) {
      const exp = expansionEnBusqueda(leida.texto, sets)
      if (tocaProbarExpansion(exp, r.filas.length, limite)) {
        const mas = await porNombre(exp.texto, exp.setIds)
        const vistas = new Set(r.filas.map((c) => c.id))
        r = { ...r, filas: [...r.filas, ...mas.filas.filter((c) => !vistas.has(c.id))] }
      }
    }
    // Y si por nombre nada, por ilustrador (la pasada cara, solo entonces).
    if (!r.filas.length) {
      const { nombre } = partirBusqueda(normalizeSearch(crudo))
      if (nombre.length) {
        const { data, error } = await consulta((q) => {
          for (const p of nombre) q = q.ilike('illustrator', `%${p.replace(/[%_]/g, '')}%`)
          return q
        })
        if (error) throw error
        r = { filas: data || [], numero: null, prefijo: null }
      }
    }
    // Ni TCG Pocket ni sets escondidos (694, 826). Y con un número, primero
    // las que lo llevan IMPRESO: «Pikachu 25» es antes la 25 que todos los
    // Pikachu (que son el 25 de la Pokédex).
    const impreso = (c) => Number(llevaElNumero(c.local_id, r.numero, r.prefijo))
    const cartas = r.filas
      .filter((c) => esDelTCG({ id: c.set_id, serie_id: c.tcg_sets?.serie_id }) && deSetVisible(c))
      .sort((x, y) => (r.numero ? impreso(y) - impreso(x) : 0))
      .slice(0, limite)
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
      // Con el rango: el nombre se pinta con su color (la 386).
      .select(`id, username, display_name, avatar_url, ${COLUMNAS_RANGO}`)
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
  // Para el panel (848): cuántas salieron, solo si todos los grupos han
  // contestado (un fallo no es «no hay»). Por `import()`: no pesa en la
  // barra de arriba hasta que alguien busca.
  if (Object.values(salida).every((g) => !g.error)) {
    const total = Object.values(salida).reduce((n, g) => n + (g.filas?.length || 0), 0)
    import('./busquedas-apunte.js').then((m) => m.apuntarBusqueda(texto, total)).catch(() => {})
  }
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
