import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'
import { inlineIconHtml } from './content-icon.js'

const input = document.getElementById('searchInput')
const resultsEl = document.getElementById('searchResults')
const categorySelect = document.getElementById('categorySelect')

let activeCategoryId = null
let debounceTimer = null
let searchSeq = 0

function sanitizeForFilter(str) {
  return str.replace(/[,()%]/g, ' ').trim()
}

function snippet(text, query) {
  if (!text) return ''
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return escapeHtml(text.slice(0, 120))
  const start = Math.max(0, idx - 40)
  const end = Math.min(text.length, idx + query.length + 60)
  const before = escapeHtml(text.slice(start, idx))
  const match = escapeHtml(text.slice(idx, idx + query.length))
  const after = escapeHtml(text.slice(idx + query.length, end))
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

  if (!query) {
    resultsEl.innerHTML = `<p class="empty-state">Escribe algo para buscar entre las guías.</p>`
    return
  }

  let q = supabase
    .from('guides')
    .select('*, categories(name)')
    .not('published_at', 'is', null)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,search_content.ilike.%${query}%`)

  if (activeCategoryId) q = q.eq('category_id', activeCategoryId)

  const { data, error } = await q.limit(20)
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
      <p class="snippet">${snippet(g.search_content || g.description, query)}</p>
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
