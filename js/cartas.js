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
import { esDelTCG, nombreDeSet, eraDeSet, reglasQueNoCasan, plegarHermanos, esUnaEra, CARTAS_DE_UNA_EXPANSION } from './catalogo-series.js'
import { logClientError } from './error-log.js'

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
    .select('id,name,name_en,serie_id,serie_name,serie_name_en,logo_path,logo_scrydex,symbol_scrydex,tcg_online_code,release_date,card_count_official,card_count_total')
    .eq('market', MERCADO)
    // Lo más nuevo primero, y las que no tienen fecha al final. Aquí sí
    // funciona `nullslast`: es una columna PROPIA de la tabla, no una
    // embebida — que es donde PostgREST se lo come sin avisar.
    .order('release_date', { ascending: false, nullsFirst: false })
    // Y un desempate (tanda 510): un `order` por fecha a secas deja los
    // sets del MISMO día en el orden que quiera Postgres, que además
    // puede cambiar entre dos cargas de la misma página. Y salen el mismo
    // día más de los que parece: un set principal y su galería de
    // entrenador, o un set y sus promos. `id` no es el orden ideal, pero
    // es ESTABLE, que es lo que hace que la lista no baile.
    .order('id')
  // ── TRES COSAS DISTINTAS NO SON UN SOLO `return` (tanda 510) ──
  //
  // Esto era `if (error || !data?.length) return`, y era un silencio: si
  // la consulta fallaba, la página se quedaba con el título «Colecciones»
  // y un hueco debajo, sin un solo aviso y sin forma de saber que había
  // pasado algo. Y es la página PÚBLICA del catálogo, o sea la primera que
  // ve quien llega de fuera.
  //
  // Son tres estados y cada uno dice una cosa: no se ha podido preguntar
  // (nuestro, y se puede reintentar), no hay nada (raro, pero es una
  // respuesta), y hay pero no sale ninguna (un fallo del filtro).
  const aviso = (texto) => {
    $('listaColecciones').innerHTML = `<p class="empty-state">${escapeHtml(texto)}</p>`
  }
  if (error) return aviso('No se han podido cargar las colecciones. Vuelve a intentarlo en un momento.')
  if (!data?.length) return aviso('Todavía no hay ninguna colección en el catálogo.')

  // ── UNA REGLA QUE YA NO CASA CON NADA (tanda 533) ──
  //
  // Las colecciones que se pliegan dentro de otra están escritas con sus
  // identificadores a mano, y una lista a mano se queda vieja: si TCGdex
  // renombra uno, la regla deja de casar, el set vuelve a salir suelto y
  // **no da ningún error**. Es la lección de la 323 —las megas que se
  // curaron a mano y dejaron de encontrarse— aplicada aquí.
  //
  // Se mira contra los sets que de verdad han llegado, que es el único
  // sitio donde se puede saber, y se deja dicho. No rompe la página: una
  // regla vieja es una fila de más, no una web caída.
  const reglasViejas = reglasQueNoCasan(data)
  if (reglasViejas.length) {
    logClientError(`Reglas de colecciones que ya no casan con ningún set: ${reglasViejas.join('; ')}`)
  }

  const soloTCG = plegarHermanos(data.filter(esDelTCG))
  if (!soloTCG.length) return aviso('No hay ninguna colección del juego de cartas que enseñar.')

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
export const SIN_CLASIFICAR = 'Sin clasificar'

// ── El 30 aniversario NO es una era aparte ──
//
// Lo primero que hice fue sacarlo a su propio grupo, y PINGU: «30 aniv
// es parte de megaevoluciones, no me lo separes». Es una entrega de esa
// era, como cualquier otra.
//
// La era a la que va se busca EN LOS DATOS —la serie de los sets `me*`—
// en vez de escribir aquí su nombre: el nombre lo pone TCGdex y puede
// cambiar, los identificadores no.
export function serieDeLaEraMega(sets) {
  const me = sets.find((s) => /^me/i.test(String(s?.id || '')) && eraDeSet(s))
  return me ? eraDeSet(me) : null
}

export function claveDeSerie(set, serieMega = null) {
  const pista = `${set?.id || ''} ${set?.serie_id || ''} ${eraDeSet(set)} ${nombreDeSet(set)}`
  if (/30th/i.test(pista) && serieMega) return serieMega
  return eraDeSet(set) || SIN_CLASIFICAR
}

// ── Y dentro de una era: las expansiones, y abajo las energías y las
// promos ──
//
// «Primero promos y energía EMPEZANDO POR ABAJO» (PINGU, corrigiéndome:
// las había puesto arriba). Contando desde el final: la última fila son
// las promos, encima las energías, y todo lo demás por delante de la más
// nueva a la más vieja. Las dos salen con la era pero no son
// expansiones, así que no compiten por el sitio de arriba.
//
// Se mira el NOMBRE porque es lo único que lo dice: no hay una columna
// que separe una promo de una expansión, y el tamaño tampoco vale (una
// colección de promos puede tener 80 cartas).
const ES_PROMO = /\bpromos?\b/i
const ES_ENERGIA = /\benerg(y|ies|ia|ías|ía)\b/i

export function rangoDeSet(set) {
  const nombre = String(set?.name || '')
  if (ES_PROMO.test(nombre)) return 2
  if (ES_ENERGIA.test(nombre)) return 1
  return 0
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
  const serieMega = serieDeLaEraMega(sets)
  for (const s of sets) {
    const clave = claveDeSerie(s, serieMega)
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
    `<span class="serie-nombre">${escapeHtml(nombreDeSet(s))}</span>` +
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
    // Con el código de TCG Live de su set (tanda 370): es lo que hace
    // falta para el segundo sitio donde buscar el escaneo cuando TCGdex
    // no tiene el de esta carta. Aquí se mezclan sets, así que va POR
    // CARTA y no una vez.
    .select('id,name,name_es,name_en,local_id,image_path,image_scrydex,tcg_sets(tcg_online_code)')
    .eq('market', MERCADO)
  if (q.length >= 3) consulta = consulta.ilike('name_search', `%${q}%`)
  // `types` es un array: `contains` pregunta si lleva ESE tipo dentro, y
  // una carta de dos tipos sale en los dos.
  if (tipo) consulta = consulta.contains('types', [tipo])
  const { data, error } = await consulta.limit(RESULTADOS)
  // Una respuesta que llega tarde no puede pisar a una más nueva: se
  // teclea más rápido de lo que contesta la red.
  if (mio !== ultimaBusqueda) return
  // Lo mismo aquí: una búsqueda que falla no puede quedarse callada.
  // Quien escribe y no ve nada da por hecho que no hay esa carta, y lo
  // que ha pasado es que no se ha podido preguntar.
  if (error) {
    $('resultados').innerHTML = '<p class="empty-state">No se ha podido buscar. Vuelve a intentarlo en un momento.</p>'
    $('sinResultados').classList.add('hidden')
    $('seccionColecciones').classList.add('hidden')
    return
  }

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

// Se reexportan desde aquí porque vivían aquí hasta la 536.
export { esUnaEra, CARTAS_DE_UNA_EXPANSION }
