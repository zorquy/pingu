// El índice del catálogo: el buscador y la lista de colecciones (tanda
// 324).
//
// Es la puerta. Desde aquí se llega a una colección, y desde una
// colección a cada carta: sin esta página las fichas existirían pero no
// habría forma de encontrarlas, ni para una persona ni para Google.
import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { rejillaDeCartas, rutaDeColeccion } from './carta-nucleo.js'
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

  // Agrupadas por serie, conservando el orden en que llegan: como la
  // consulta ya viene de la más nueva a la más vieja, la primera vez que
  // aparece una serie es por su set más reciente. Así las series salen
  // también de la más nueva a la más vieja SIN una segunda ordenación
  // que pudiera decir otra cosa.
  const series = new Map()
  for (const s of soloTCG) {
    const clave = s.serie_name || 'Otras colecciones'
    if (!series.has(clave)) series.set(clave, [])
    series.get(clave).push(s)
  }

  $('listaColecciones').innerHTML = [...series]
    .map(
      ([nombre, sets]) =>
        `<section class="serie"><h3 class="serie-titulo">${escapeHtml(nombre)}</h3>` +
        '<ul class="serie-lista">' +
        sets.map(filaDeColeccion).join('') +
        '</ul></section>'
    )
    .join('')
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

async function buscar(texto) {
  const q = normalizeSearch(texto).trim()
  const mio = ++ultimaBusqueda
  if (q.length < 3) {
    $('resultados').innerHTML = ''
    $('sinResultados').classList.add('hidden')
    $('seccionColecciones').classList.remove('hidden')
    return
  }
  const { data, error } = await supabase
    .from('tcg_cards')
    .select('id,name,local_id,image_path')
    .eq('market', MERCADO)
    .ilike('name_search', `%${q}%`)
    .limit(60)
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

colecciones().catch(() => {})
