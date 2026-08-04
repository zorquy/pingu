import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { inlineIconHtml } from './content-icon.js'
import { plegarConMapa } from './texto.js'
import { conVueltaAtras, terminoParaFiltro } from './busqueda.js'

const input = document.getElementById('searchInput')
const resultsEl = document.getElementById('searchResults')
const categorySelect = document.getElementById('categorySelect')

let activeCategoryId = null
let debounceTimer = null
let searchSeq = 0

function sanitizeForFilter(str) {
  return str.replace(/[,()%]/g, ' ').trim()
}

// Trozo del texto alrededor de lo encontrado, con la coincidencia
// resaltada.
//
// La búsqueda va por el texto plegado (sin acentos) pero lo que se enseña
// es el original, así que las posiciones se traducen con el mapa: si
// alguien busca "falsificacion" y la guía dice "falsificación", se
// subraya la palabra tal cual está escrita, con su tilde.
function snippet(text, terminoPlegado) {
  if (!text) return ''
  if (!terminoPlegado) return escapeHtml(text.slice(0, 120))

  const { plegado, mapa } = plegarConMapa(text)
  const encontrado = plegado.indexOf(terminoPlegado)
  if (encontrado === -1) return escapeHtml(text.slice(0, 120))

  const desde = mapa[encontrado]
  const hasta = mapa[encontrado + terminoPlegado.length]
  const start = Math.max(0, desde - 40)
  const end = Math.min(text.length, hasta + 60)
  const before = escapeHtml(text.slice(start, desde))
  const match = escapeHtml(text.slice(desde, hasta))
  const after = escapeHtml(text.slice(hasta, end))
  return `${start > 0 ? '…' : ''}${before}<mark>${match}</mark>${after}${end < text.length ? '…' : ''}`
}

async function loadCategories() {
  const { data } = await supabase.from('categories').select('id, name, slug').order('order_pos')
  const categories = data || []
  categorySelect.innerHTML =
    `<option value="">Todas las categorías</option>` +
    categories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')

  categorySelect.addEventListener('change', () => {
    activeCategoryId = categorySelect.value || null
    runSearch(input.value.trim())
  })
}

async function runSearch(rawQuery) {
  const seq = ++searchSeq
  const query = sanitizeForFilter(rawQuery)
  // Lo mismo, pero sin acentos: es lo que se compara contra la columna
  // `search_norm`, que Postgres guarda ya plegada.
  const termino = terminoParaFiltro(rawQuery)

  if (!query) {
    resultsEl.innerHTML = `<p class="empty-state">Escribe algo para buscar entre las guías.</p>`
    return
  }

  const base = () => {
    // Columnas contadas, no `*`: `search_norm` repite el texto entero de
    // la guía, y traerlo veinte veces por búsqueda para no usarlo es
    // regalar megas al que busca desde el móvil.
    const q = supabase
      .from('guides')
      .select('slug, title, description, cover_emoji, search_content, categories(name)')
      .not('published_at', 'is', null)
    return activeCategoryId ? q.eq('category_id', activeCategoryId) : q
  }

  const { data, error } = await conVueltaAtras(
    // Una sola columna: `search_norm` ya junta título, descripción y
    // texto de la guía, todo sin acentos.
    () => base().ilike('search_norm', `%${termino}%`).limit(20),
    // Sin la migración puesta, se busca como antes: distinguiendo
    // acentos, pero encontrando algo.
    () =>
      base()
        .or(`title.ilike.%${query}%,description.ilike.%${query}%,search_content.ilike.%${query}%`)
        .limit(20)
  )
  if (seq !== searchSeq) return // ya hay una búsqueda más nueva en marcha o resuelta

  if (error || !data || data.length === 0) {
    resultsEl.innerHTML = `<p class="empty-state">No se encontraron resultados para "${escapeHtml(rawQuery)}".</p>`
    return
  }

  resultsEl.innerHTML = data
    .map(
      (g) => `
    <a href="guia.html?slug=${encodeURIComponent(g.slug)}" class="search-result" style="display: block;">
      <span class="guide-label">${escapeHtml(g.categories?.name || '')}</span>
      <h3>${inlineIconHtml(g.cover_emoji, 16, 'bookOpen')}${escapeHtml(g.title)}</h3>
      <p class="snippet">${snippet(g.search_content || g.description, termino)}</p>
    </a>`
    )
    .join('')
}

input?.addEventListener('input', () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => runSearch(input.value.trim()), 300)
})

const qFromUrl = new URLSearchParams(window.location.search).get('q') || ''
if (input) input.value = qFromUrl
runSearch(qFromUrl)
loadCategories()
