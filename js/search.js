import { supabase } from './supabase.js'
import { escapeHtml } from './app.js'

const SUGGESTED = ['cartas falsas', 'rarezas', 'PSA', 'backs', 'grading', 'holográfica']

const input = document.getElementById('searchInput')
const resultsEl = document.getElementById('searchResults')
const emptyStateEl = document.getElementById('searchEmptyState')
const chipsEl = document.getElementById('searchChips')
const filtersEl = document.getElementById('categoryFilters')

let categories = []
let activeCategoryId = null
let debounceTimer = null

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

function renderChips() {
  chipsEl.innerHTML = SUGGESTED.map((s) => `<button class="search-chip" data-q="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('')
  chipsEl.querySelectorAll('.search-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      input.value = chip.dataset.q
      runSearch(chip.dataset.q)
    })
  })
}

async function loadCategories() {
  const { data } = await supabase.from('categories').select('id, name, slug').order('order_pos')
  categories = data || []
  filtersEl.innerHTML = [
    `<button class="filter-pill active" data-id="">Todas</button>`,
    ...categories.map((c) => `<button class="filter-pill" data-id="${c.id}">${escapeHtml(c.name)}</button>`),
  ].join('')

  filtersEl.querySelectorAll('.filter-pill').forEach((pill) => {
    pill.addEventListener('click', () => {
      filtersEl.querySelectorAll('.filter-pill').forEach((p) => p.classList.remove('active'))
      pill.classList.add('active')
      activeCategoryId = pill.dataset.id || null
      runSearch(input.value.trim())
    })
  })
}

async function runSearch(rawQuery) {
  const query = sanitizeForFilter(rawQuery)

  if (!query) {
    emptyStateEl.style.display = 'block'
    resultsEl.innerHTML = ''
    return
  }
  emptyStateEl.style.display = 'none'

  let q = supabase
    .from('guides')
    .select('*, categories(name)')
    .not('published_at', 'is', null)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%,search_content.ilike.%${query}%`)

  if (activeCategoryId) q = q.eq('category_id', activeCategoryId)

  const { data, error } = await q.limit(20)

  if (error || !data || data.length === 0) {
    resultsEl.innerHTML = `<p class="empty-state">No se encontraron resultados para "${escapeHtml(rawQuery)}".</p>`
    return
  }

  resultsEl.innerHTML = data
    .map(
      (g) => `
    <a href="guia.html?slug=${encodeURIComponent(g.slug)}" class="search-result" style="display: block;">
      <span class="guide-label">${escapeHtml(g.categories?.name || '')}</span>
      <h3>${g.emoji || ''} ${escapeHtml(g.title)}</h3>
      <p class="snippet">${snippet(g.search_content || g.description, query)}</p>
    </a>`
    )
    .join('')
}

input?.addEventListener('input', () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => runSearch(input.value.trim()), 300)
})

renderChips()
loadCategories()
