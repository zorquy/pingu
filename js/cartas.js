// El índice del catálogo: el buscador y la lista de colecciones (tanda
// 324).
//
// Es la puerta. Desde aquí se llega a una colección, y desde una
// colección a cada carta: sin esta página las fichas existirían pero no
// habría forma de encontrarlas, ni para una persona ni para Google.
import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { rejillaDeCartas, rutaDeColeccion, urlDeLogo, fechaLarga } from './carta-nucleo.js'
import { normalizeSearch } from './tcgdex.js'
import { esDelTCG } from './catalogo-series.js'
import { icons } from './icons.js'

const MERCADO = 'WEST'
const $ = (id) => document.getElementById(id)

async function colecciones() {
  const { data, error } = await supabase
    .from('tcg_sets')
    .select('id,name,serie_id,serie_name,logo_path,release_date,card_count_official,card_count_total')
    .eq('market', MERCADO)
    // Lo más nuevo primero, y las que no tienen fecha al final. Aquí sí
    // funciona `nullslast`: es una columna PROPIA de la tabla, no una
    // embebida — que es donde PostgREST se lo come sin avisar.
    .order('release_date', { ascending: false, nullsFirst: false })
  if (error || !data?.length) return

  // Fuera lo que no es el TCG de mesa. La tabla trae sets de Pokémon
  // TCG Pocket importados antes de que el importador los filtrara, y
  // son otro juego: mezclados aquí, quien busca una carta para su mazo
  // se encuentra una del móvil.
  const soloTCG = data.filter(esDelTCG)
  if (!soloTCG.length) return

  $('listaColecciones').innerHTML = soloTCG
    .map((s) => {
      const logo = urlDeLogo(s.logo_path)
      const total = s.card_count_official || s.card_count_total
      const pie = [s.serie_name, s.release_date ? fechaLarga(s.release_date) : '', total ? `${total} cartas` : '']
        .filter(Boolean)
        .join(' · ')
      return (
        `<a class="cartas-coleccion" href="${escapeHtml(rutaDeColeccion(s))}">` +
        (logo
          ? `<img src="${escapeHtml(logo)}" alt="" loading="lazy" decoding="async">`
          : `<span class="cartas-coleccion-sinlogo" aria-hidden="true">${icons.cards(28)}</span>`) +
        `<span class="cartas-coleccion-nombre">${escapeHtml(s.name)}</span>` +
        `<span class="cartas-coleccion-pie">${escapeHtml(pie)}</span>` +
        '</a>'
      )
    })
    .join('')
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
