// EL BUSCADOR DE CARTAS, UNO (tanda 909). Vivía dentro de js/mi-coleccion.js
// y la barra de arriba (/buscar, la paleta) tenía su copia «con las mismas
// reglas» (851)… y con otro tope y otro orden: 24 por orden alfabético,
// así que «zapdos» se quedaba en los Galarian y los de Rocket y el Zapdos ex
// de 151 no salía nunca (lo contó Sergio en el foro). Dos buscadores que
// buscan lo mismo se separan (la 471): ahora los dos llaman a este.
//
// Lo que es de cada pantalla entra por opciones: las columnas, el catálogo,
// los filtros (`filtrar`, que recibe la consulta) y la lista de sets para
// leer la expansión en lo escrito (`sets`: la lista, o una función que la
// trae, para no pedirla si no hace falta).
import { supabase } from './supabase.js'
import { normalizeSearch } from './texto.js'
import { esDelTCG, deSetVisible } from './catalogo-series.js'
import { entenderBusqueda, partirBusqueda, filtroDeNumero, conPrefijoPegado, prefijoSuelto, expansionEnBusqueda, tocaProbarExpansion } from './mi-coleccion/busqueda.js'

// Ni TCG Pocket (694) ni las cartas de un set escondido (826).
const delTCG = (c) => esDelTCG({ id: c.set_id, serie_id: c.tcg_sets?.serie_id }) && deSetVisible(c)

// Lo que la base da como mucho por respuesta (808: corta a 1.000 sin avisar).
const POR_PAGINA = 1000

// Un tope de más de 1.000 se pide por páginas (1113). PINGU buscó «pikachu»
// y no salía el de Temporal Forces: el tope era 120 por orden alfabético y
// hay muchos más Pikachu, así que los que caían detrás no salían nunca. El
// `id` desempata el orden, o una página podría repetir o saltarse cartas.
async function pedirHasta(montar, limite) {
  if (limite <= POR_PAGINA) {
    const { data, error } = await montar().order('name_search').order('id').limit(limite)
    if (error) throw error
    return data || []
  }
  const todas = []
  for (let desde = 0; desde < limite; desde += POR_PAGINA) {
    const hasta = Math.min(limite, desde + POR_PAGINA) - 1
    const { data, error } = await montar().order('name_search').order('id').range(desde, hasta)
    if (error) throw error
    todas.push(...(data || []))
    if ((data || []).length < hasta - desde + 1) break
  }
  return todas
}

export async function buscarCartasUnaVez(texto, limite = 60, opciones = {}) {
  return (await pedirHasta(() => consultaDeBusqueda(texto, opciones), limite)).filter(delTCG)
}

function consultaDeBusqueda(texto, { columnas, market = 'WEST', setIds = null, variantes = null, filtroLocal = null, filtrar = null } = {}) {
  const { nombre, numero, prefijo } = partirBusqueda(texto)
  let q = supabase.from('tcg_cards').select(columnas).eq('market', market)
  // «151/165» y «MEW 151» (765): la expansión ya la ha dicho quien escribe.
  if (setIds?.length) q = q.in('set_id', setIds)
  if (variantes?.length) {
    // Las variantes del escáner en UNA consulta (561): un `or` es una ida y
    // vuelta, un bucle serían hasta trece. La coma y el paréntesis se
    // quitan porque son la sintaxis del propio `or` de PostgREST.
    const limpias = variantes.map((x) => String(x).replace(/[%_*,()]/g, '')).filter(Boolean)
    if (limpias.length) q = q.or(limpias.map((x) => `name_search.like.*${x}*`).join(','))
  } else {
    for (const p of nombre) q = q.like('name_search', `%${p.replace(/[%_]/g, '')}%`)
  }
  if (numero) q = q.or(filtroDeNumero(numero, prefijo))
  if (filtroLocal) q = q.or(filtroLocal)
  // Los filtros van EN LA CONSULTA, no después: filtrar lo que vuelve
  // sería filtrar la muestra y no el catálogo.
  if (filtrar) q = filtrar(q)
  return q
}

export async function buscarCartas(texto, limite = 60, opciones = {}) {
  let lista = await buscarCartasUnaVez(texto, limite, opciones)
  // «Pikachu XY 124» con el prefijo suelto (852): la primera pasada lo toma
  // por una palabra del nombre. Si no sale nada, otra con los dos pegados.
  const pegado = lista.length ? null : conPrefijoPegado(texto)
  if (pegado) lista = await buscarCartasUnaVez(pegado, limite, opciones)
  // Y «Pikachu XY», las letras solas (853): las de Pikachu cuyo número empieza por XY.
  const suelto = lista.length ? null : prefijoSuelto(texto)
  if (suelto) lista = await buscarCartasUnaVez(suelto.texto, limite, { ...opciones, filtroLocal: suelto.filtro })
  // «Pikachu asc», «hypno rocket» (874): la cola de lo escrito como
  // EXPANSIÓN. Sin nada por nombre, siempre; con algo pero poco, solo si la
  // cola son palabras enteras (`tocaProbarExpansion`). Lo de por nombre va
  // delante. No cuando la expansión ya la ha dicho un código o un total, ni
  // con las variantes del escáner, que no son un texto que alguien escribió.
  if (!opciones.setIds?.length && !opciones.variantes?.length) {
    const sets = typeof opciones.sets === 'function' ? await opciones.sets() : opciones.sets || []
    const exp = expansionEnBusqueda(texto, sets)
    if (tocaProbarExpansion(exp, lista.length, limite)) {
      const mas = await buscarCartasUnaVez(exp.texto, limite, { ...opciones, setIds: exp.setIds })
      const vistas = new Set(lista.map((c) => c.id))
      lista = [...lista, ...mas.filter((c) => !vistas.has(c.id))]
    }
  }
  return lista
}

// Y si por nombre no sale nada, por ILUSTRADOR. Va como segunda consulta y
// no como un `or` de la primera: un `or` entre `name_search` e
// `illustrator` no puede usar el índice del nombre y recorrería las 23.000
// cartas en cada tecla.
export async function buscarPorIlustrador(texto, limite = 60, { columnas, market = 'WEST' } = {}) {
  const { nombre } = partirBusqueda(texto)
  if (!nombre.length) return []
  const montar = () => {
    let q = supabase.from('tcg_cards').select(columnas).eq('market', market)
    for (const p of nombre) q = q.ilike('illustrator', `%${p.replace(/[%_]/g, '')}%`)
    return q
  }
  return (await pedirHasta(montar, limite)).filter(delTCG)
}

// Lo que pasa al escribir en el buscador, entero: leer el código o el total
// de la expansión, buscar, y si nada, «mew 151» como nombre y luego por
// ilustrador. `crudo` es lo escrito tal cual. Devuelve también lo leído,
// que quien pinta necesita (el número, para poner antes las que lo llevan).
export async function buscarComoEnCartas(crudo, limite, { sets = [], ...opciones } = {}) {
  const leida = entenderBusqueda(crudo, sets)
  const texto = normalizeSearch(leida.texto)
  let lista = await buscarCartas(texto, limite, { ...opciones, sets, setIds: leida.setIds })
  // «mew 151» puede ser el set o el Pokémon: si como set no hay nada, como nombre.
  if (!lista.length && leida.codigo) lista = await buscarCartas(normalizeSearch(crudo), limite, { ...opciones, sets })
  let porIlustrador = false
  if (!lista.length) {
    lista = await buscarPorIlustrador(texto, limite, opciones)
    porIlustrador = lista.length > 0
  }
  return { lista, porIlustrador, leida: { ...leida, ...partirBusqueda(texto) } }
}
