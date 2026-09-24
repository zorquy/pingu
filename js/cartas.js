// El índice del catálogo: el buscador y la lista de colecciones (tanda
// 324).
//
// Es la puerta. Desde aquí se llega a una colección, y desde una
// colección a cada carta: sin esta página las fichas existirían pero no
// habría forma de encontrarlas, ni para una persona ni para Google.
import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { rejillaDeCartas, rutaDeColeccion, TIPOS_ES } from './carta-nucleo.js'
import { normalizeSearch } from './tcgdex.js'
import { esDelTCG } from './catalogo-series.js'

const MERCADO = 'WEST'
const $ = (id) => document.getElementById(id)

// ── Las colecciones, en lista y agrupadas por serie ──
//
// Como las listan las bases de cartas de toda la vida, y por un motivo:
// quien busca una colección la busca por su CÓDIGO («TWM», «SFA») o
// sabiendo más o menos de cuándo es. Una rejilla de logos es bonita y no
// deja comparar nada.
//
// Y resuelve de paso el problema de los logos que faltan: muchas
// colecciones viejas no tienen logo en TCGdex, pero TODAS tienen código
// o identificador, así que todas las filas se ven iguales.
function insignia(set) {
  // El código de TCG Live es el que usa la gente al hablar y al escribir
  // decklists. Si no lo tenemos —solo llega al importar las cartas de un
  // set—, vale el identificador de TCGdex, que es lo que hay.
  return String(set?.tcg_online_code || set?.id || '?').toUpperCase().slice(0, 6)
}

async function colecciones() {
  const { data, error } = await supabase
    .from('tcg_sets')
    .select('id,name,serie_id,serie_name,logo_path,tcg_online_code,release_date,card_count_official,card_count_total')
    .eq('market', MERCADO)
    // Lo más nuevo primero, y las que no tienen fecha al final. Aquí sí
    // funciona `nullslast`: es una columna PROPIA de la tabla, no una
    // embebida — que es donde PostgREST se lo come sin avisar.
    .order('release_date', { ascending: false, nullsFirst: false })
  if (error || !data?.length) return

  const soloTCG = data.filter(esDelTCG)
  if (!soloTCG.length) return

  const series = agruparEnSeries(soloTCG)

  $('listaColecciones').innerHTML = series
    .map(
      (g) =>
        `<section class="serie${g.era ? '' : ' serie-menor'}">` +
        `<h3 class="serie-titulo">${escapeHtml(g.nombre)}</h3>` +
        '<ul class="serie-lista">' +
        g.sets.map(filaDeColeccion).join('') +
        '</ul></section>'
    )
    .join('')
}

// ── Las eras, y lo que no es una era ──
//
// Agrupar por serie y ordenar por el set más nuevo de cada una deja
// «McDonald's Collection» entre Escarlata y Púrpura y Espada y Escudo,
// porque McDonald's saca promos todos los años. Y eso es lo contrario
// de lo que busca quien entra: «para jugar nos interesan las últimas
// colecciones» (PINGU).
//
// La regla NO es una lista de nombres a mano —eso se queda viejo el día
// que salga la siguiente promo—: es el TAMAÑO. Una expansión de verdad
// pasa de las cien cartas; una colección de promos no llega a treinta.
// Así que una serie es una ERA si alguno de sus sets es grande.
//
// Las eras van primero, de la más nueva a la más vieja. Detrás, todo lo
// demás —promos, colecciones sueltas y lo que aún no tiene serie—, con
// el mismo orden entre ellas.
export const CARTAS_DE_UNA_EXPANSION = 100

export const SIN_CLASIFICAR = 'Sin clasificar'

export function esUnaEra(sets) {
  return sets.some((s) => (s.card_count_official || s.card_count_total || 0) >= CARTAS_DE_UNA_EXPANSION)
}

// ── El 30 aniversario es UNA cosa ──
//
// TCGdex lo tiene partido —la celebración por un lado y la Classics
// Collection por otro—, y para quien entra es lo mismo: «yo no separaría
// los sets, los tendría en lo mismo» (PINGU). Se juntan por el
// identificador, que es lo que no cambia con el nombre que le dé TCGdex.
export function claveDeSerie(set) {
  const pista = `${set?.id || ''} ${set?.serie_id || ''} ${set?.serie_name || ''} ${set?.name || ''}`
  if (/30th/i.test(pista)) return '30 aniversario'
  return set?.serie_name || SIN_CLASIFICAR
}

// ── Y dentro de una era: promos, energías y luego los sets ──
//
// «Las promos siempre son el primer set de la era» (PINGU). Es el orden
// con el que se habla de una era y el que usan las bases de siempre: las
// promos abren, las energías van detrás —salen con la era pero no son
// una expansión— y después las expansiones, de la más nueva a la más
// vieja, que es como estaban.
//
// Se mira el NOMBRE porque es lo único que lo dice: no hay una columna
// que separe una promo de una expansión, y el tamaño tampoco vale (una
// colección de promos puede tener 80 cartas).
const ES_PROMO = /\bpromos?\b/i
const ES_ENERGIA = /\benerg(y|ies|ia|ías|ía)\b/i

export function rangoDeSet(set) {
  const nombre = String(set?.name || '')
  if (ES_PROMO.test(nombre)) return 0
  if (ES_ENERGIA.test(nombre)) return 1
  return 2
}

export function ordenDentroDeUnaSerie(a, b) {
  const ra = rangoDeSet(a)
  const rb = rangoDeSet(b)
  if (ra !== rb) return ra - rb
  // Empate: lo más nuevo primero, y lo que no tiene fecha al final —
  // igual que en la consulta, que es de donde vienen ya ordenados.
  const fa = String(a?.release_date || '')
  const fb = String(b?.release_date || '')
  if (!fa && !fb) return 0
  if (!fa) return 1
  if (!fb) return -1
  return fb.localeCompare(fa)
}

export function agruparEnSeries(sets) {
  // El orden de llegada YA es de lo más nuevo a lo más viejo, así que la
  // primera vez que aparece una serie es por su set más reciente. Se
  // conserva, y así no hay una segunda ordenación que pudiera decir
  // otra cosa.
  const porSerie = new Map()
  for (const s of sets) {
    const clave = claveDeSerie(s)
    if (!porSerie.has(clave)) porSerie.set(clave, [])
    porSerie.get(clave).push(s)
  }
  for (const [, suyos] of porSerie) suyos.sort(ordenDentroDeUnaSerie)
  const grupos = [...porSerie].map(([nombre, suyos]) => ({ nombre, sets: suyos, era: esUnaEra(suyos) }))
  // Lo que no tiene serie va al final del todo pase lo que pase: no es
  // que sea menos importante, es que no sabemos qué es, y una caja de
  // «no lo sé» en medio de las eras rompe la lectura.
  return [
    ...grupos.filter((g) => g.era && g.nombre !== SIN_CLASIFICAR),
    ...grupos.filter((g) => !g.era && g.nombre !== SIN_CLASIFICAR),
    ...grupos.filter((g) => g.nombre === SIN_CLASIFICAR),
  ]
}

function filaDeColeccion(s) {
  const total = s.card_count_official || s.card_count_total
  return (
    `<li><a class="serie-fila" href="${escapeHtml(rutaDeColeccion(s))}">` +
    `<span class="serie-codigo">${escapeHtml(insignia(s))}</span>` +
    `<span class="serie-nombre">${escapeHtml(s.name)}</span>` +
    `<span class="serie-fecha">${escapeHtml(s.release_date ? fechaCorta(s.release_date) : '—')}</span>` +
    `<span class="serie-cuantas">${total ? escapeHtml(`${total} cartas`) : ''}</span>` +
    '</a></li>'
  )
}

// La fecha, corta: en una lista de doscientas filas «22 mar 2024» se lee
// igual de bien que la larga y deja sitio para el nombre.
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

export function fechaCorta(iso) {
  const m = String(iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return ''
  return `${Number(m[3])} ${MESES_CORTOS[Number(m[2]) - 1]} ${m[1]}`
}

// ── El buscador ──
//
// Busca contra `name_search`, que Postgres mantiene en minúsculas y sin
// tildes. Lo que se teclea pasa por el MISMO normalizador que usa el
// resto del sitio: si no, quien escriba «pomez» no encontraría «Piedra
// Pómez», y hay 1.159 cartas acentuadas en el catálogo.
let ultimaBusqueda = 0

const RESULTADOS = 60

async function buscar(texto) {
  const q = normalizeSearch(texto).trim()
  const tipo = $('buscarTipo')?.value || ''
  const mio = ++ultimaBusqueda
  // Con menos de tres letras y sin tipo no hay nada que buscar: vuelven
  // las colecciones. Pero un tipo SOLO sí es una búsqueda — es «enséñame
  // cartas de Fuego», y para eso están los datos guardados.
  if (q.length < 3 && !tipo) {
    $('resultados').innerHTML = ''
    $('sinResultados').classList.add('hidden')
    $('seccionColecciones').classList.remove('hidden')
    return
  }
  let consulta = supabase
    .from('tcg_cards')
    .select('id,name,name_es,local_id,image_path')
    .eq('market', MERCADO)
  if (q.length >= 3) consulta = consulta.ilike('name_search', `%${q}%`)
  // `types` es un array: `contains` pregunta si lleva ESE tipo dentro, y
  // una carta de dos tipos sale en los dos.
  if (tipo) consulta = consulta.contains('types', [tipo])
  const { data, error } = await consulta.limit(RESULTADOS)
  // Una respuesta que llega tarde no puede pisar a una más nueva: se
  // teclea más rápido de lo que contesta la red.
  if (mio !== ultimaBusqueda) return
  if (error) return

  const lista = data || []
  $('resultados').innerHTML = rejillaDeCartas(lista)
  $('sinResultados').classList.toggle('hidden', lista.length > 0)
  $('seccionColecciones').classList.add('hidden')
}

let temporizador = null
$('buscarCarta')?.addEventListener('input', (e) => {
  clearTimeout(temporizador)
  const v = e.target.value
  temporizador = setTimeout(() => buscar(v).catch(() => {}), 250)
})

// El desplegable de tipos se llena desde el mismo sitio que los pinta,
// así que no hay una lista de tipos escrita dos veces.
const selTipo = $('buscarTipo')
if (selTipo) {
  selTipo.innerHTML = '<option value="">Todos los tipos</option>' +
    Object.entries(TIPOS_ES).map(([t, es]) => `<option value="${escapeHtml(t)}">${escapeHtml(es)}</option>`).join('')
  // Aquí no hay retardo: elegir en un desplegable es una decisión
  // tomada, no alguien tecleando.
  selTipo.addEventListener('change', () => buscar($('buscarCarta')?.value || '').catch(() => {}))
}

colecciones().catch(() => {})
