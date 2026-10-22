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
import { conVueltaAtras, terminoParaFiltro } from './busqueda.js'
import { precioDeFila, valorDe } from './cardmarket.js'
import { COLUMNAS_RANGO } from './rangos.js'
import { llevaElNumero } from './mi-coleccion/busqueda.js'
import { setsDelCatalogo } from './sets-catalogo.js'
import { buscarComoEnCartas } from './buscar-cartas.js'
import { nombreDeCarta } from './catalogo-series.js'
import { urlDeLogo } from './carta-ruta.js'
import { buscarProductos } from './productos-valor.js'
import { expansionesQueCasan, mejorResultado, esPersona, sinArroba } from './buscador-puro.js'

// Lo justo para pintar la fila (y `serie_id` para echar a TCG Pocket, y la
// fecha del set para ordenar por expansión).
const COLUMNAS_CARTA = 'id, market, set_id, local_id, name, name_es, name_en, image_path, image_tcggo, tcg_sets(name, name_en, serie_id, release_date, oculto)'
// El de la pestaña Buscar de Cartas: con 120 de vuelta, «hay más, afina».
export const TOPE_CARTAS = 120

// Por expansión, de la más nueva a la más vieja, como Cartas
// (`gruposPorExpansion`); dentro, por nombre y número. Con un número
// escrito, primero las expansiones que lo llevan IMPRESO y, dentro, esas:
// «Pikachu 25» es antes la 25 que todos los Pikachu (el 25 de la Pokédex).
// La fecha sale de la carta o, si no la trae, de la lista de sets.
export function ordenarPorExpansion(lista, { numero = null, prefijo = null } = {}, sets = []) {
  const fechaDeSet = new Map(sets.map((s) => [s.id, s.release_date]))
  const fecha = (c) => String(c.tcg_sets?.release_date || fechaDeSet.get(c.set_id) || '')
  const impreso = (c) => (numero && llevaElNumero(c.local_id, numero, prefijo) ? 1 : 0)
  const conNumero = new Set(lista.filter(impreso).map((c) => c.set_id))
  const enSet = (c) => (conNumero.has(c.set_id) ? 1 : 0)
  const n = (c) => parseInt(String(c.local_id || '').replace(/\D+/g, ''), 10) || 0
  return [...lista].sort((x, y) =>
    enSet(y) - enSet(x) ||
    fecha(y).localeCompare(fecha(x)) ||
    String(x.set_id).localeCompare(String(y.set_id)) ||
    impreso(y) - impreso(x) ||
    nombreDeCarta(x).localeCompare(nombreDeCarta(y), 'es') ||
    n(x) - n(y))
}

export const GRUPOS = [
  ['cartas', 'Cartas'],
  // Las expansiones (972, B1: «151», «obsidiana», «MEW»).
  ['expansiones', 'Expansiones'],
  // Los productos sellados (968, Sergio: «tampoco busca sellado»).
  ['productos', 'Productos'],
  ['guias', 'Guías'],
  ['temas', 'Foro'],
  ['gente', 'Gente'],
]

// Lo que cada grupo pregunta. Las columnas van contadas: una que no existe
// tumba la consulta entera (42703, la 624), así que aquí solo van las que
// ya piden otras pantallas.
const CONSULTAS = {
  // Las cartas, con EL buscador de Cartas (909): la misma función, el mismo
  // tope y por expansión, de la más nueva a la más vieja. Hasta la 909 era
  // una copia «con las mismas reglas» que se quedaba en las 24 primeras por
  // orden alfabético: «zapdos» daba los Galarian y los de Rocket, y el Zapdos
  // ex de 151 no salía (Sergio, en el foro). Se trae siempre el tope entero
  // —para saber cuáles son las más nuevas hay que tenerlas todas— y se
  // enseñan las `limite` primeras; el precio, solo de esas.
  //
  // Y a la vez, las japonesas (972, B3): solo cuántas, para la línea
  // «También en Pokémon Japón», que lleva a Cartas › Buscar en ese catálogo.
  // Si esa consulta falla, la línea no sale (no se sabe), las cartas sí.
  async cartas(crudo, limite) {
    const sets = await setsDelCatalogo('WEST', { cliente: supabase }).catch(() => [])
    const japonesas = setsDelCatalogo('JP', { cliente: supabase })
      .catch(() => [])
      .then((setsJp) => buscarComoEnCartas(crudo, TOPE_CARTAS, { columnas: COLUMNAS_CARTA, market: 'JP', sets: setsJp }))
      .then((r) => ({ total: r.lista.length, hayMas: r.lista.length >= TOPE_CARTAS }))
      .catch(() => null)
    const { lista, porIlustrador, leida } = await buscarComoEnCartas(crudo, TOPE_CARTAS, { columnas: COLUMNAS_CARTA, market: 'WEST', sets })
    const todas = ordenarPorExpansion(lista, leida, sets)
    // B2: la carta que lo escrito señala, arriba y en grande.
    const mejor = mejorResultado(todas, leida)
    const cartas = todas.slice(0, limite)
    if (mejor && !cartas.includes(mejor)) cartas.unshift(mejor)
    // El precio, en una segunda consulta y con la regla de siempre (el
    // mínimo en español, y si no el general: `valorDe`). Si falla, las
    // cartas salen igual y sin cifra: el precio es un extra de la fila.
    if (cartas.length) {
      const { data: precios } = await supabase.from('tcg_card_prices').select('*').in('card_id', cartas.map((c) => c.id))
      const porId = new Map((precios || []).map((p) => [p.card_id, p]))
      for (const c of cartas) c.valor = valorDe(precioDeFila(porId.get(c.id)), 'es')
    }
    // El logo de su expansión, para la cabecera de cada grupo en /buscar.
    const porSet = new Map(sets.map((x) => [x.id, x]))
    for (const c of cartas) {
      const set = porSet.get(c.set_id)
      c.logosDelSet = set ? [set.logo_tcggo, set.logo_scrydex, urlDeLogo(set.logo_path, 'WEST'), set.symbol_scrydex].filter(Boolean) : []
    }
    return { filas: cartas, total: todas.length, hayMas: lista.length >= TOPE_CARTAS, porIlustrador, mejor, japon: await japonesas }
  },
  // Los dos catálogos; de la lista de sets que ya baja la web (la CDN).
  async expansiones(crudo, limite) {
    const [west, jp] = await Promise.all([
      setsDelCatalogo('WEST', { cliente: supabase }),
      setsDelCatalogo('JP', { cliente: supabase }).catch(() => []),
    ])
    const r = expansionesQueCasan([...(west || []), ...(jp || [])], crudo, limite)
    for (const s of r.filas) s.logosDelSet = [s.logo_tcggo, s.logo_scrydex, urlDeLogo(s.logo_path, s.market || 'WEST'), s.symbol_scrydex].filter(Boolean)
    return { filas: r.filas, total: r.total, hayMas: false }
  },
  // Los dos catálogos, los que salen antes primero (`buscarProductos`). Se
  // pide uno de más para saber si hay más que enseñar.
  async productos(crudo, limite) {
    const { data, error } = await buscarProductos(crudo, { limite: limite + 1 })
    if (error) throw error
    const filas = data || []
    return { filas: filas.slice(0, limite), hayMas: filas.length > limite }
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
    // Solo temas de foros que se ven (876): sin esto los hilos del subforo
    // escondido de Noticias salían al buscar. Sin lista de foros, como siempre.
    const { data: foros } = await supabase.from('forum_boards').select('id, is_hidden')
    const visibles = (foros || []).filter((f) => !f.is_hidden).map((f) => f.id)
    const base = () => (visibles.length ? supabase.from('forum_threads').select('id, title').in('board_id', visibles) : supabase.from('forum_threads').select('id, title'))
    const { data, error } = await conVueltaAtras(
      () => base().ilike('search_norm', patron).limit(limite),
      () => base().ilike('title', `%${crudo.replace(/[,()%]/g, ' ')}%`).limit(limite)
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
  let texto = String(crudo || '').trim()
  const salida = {}
  // B6: «@ibai» es una persona, y solo se pregunta a la gente.
  if (esPersona(texto)) {
    texto = sinArroba(texto)
    grupos = ['gente']
  }
  if (texto.length < 2) return salida
  await Promise.all(
    grupos.map(async (g) => {
      try {
        const r = await CONSULTAS[g](texto, limite)
        salida[g] = Array.isArray(r) ? { filas: r } : r
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
  // Las cartas japonesas (972) también son algo que enseñar.
  return grupos.length > 0 && grupos.every((g) => !g.error && !g.filas?.length && !g.japon?.total)
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
