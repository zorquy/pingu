import { icons } from './icons.js'

// Lupa de búsqueda en la navbar: primer clic abre un mini popup, segundo
// clic (con el popup ya abierto) lleva a la búsqueda grande (/buscar.html).
export function renderNavSearch() {
  const navRight = document.querySelector('.nav-right')
  const navUser = document.getElementById('nav-user')
  if (!navRight || !navUser || document.getElementById('navSearch')) return

  const wrap = document.createElement('div')
  wrap.className = 'nav-search-wrap'
  wrap.id = 'navSearch'
  wrap.innerHTML = `
    <button type="button" class="nav-search-btn" id="navSearchBtn" aria-label="Buscar">${icons.search(19)}</button>
    <div class="nav-search-dropdown hidden" id="navSearchDropdown">
      <form id="navSearchForm">
        <input type="text" id="navSearchInput" class="search-input" placeholder="Buscar guías…" autocomplete="off" />
        <button type="submit" class="btn-primary">Buscar</button>
      </form>
      <a href="/buscar.html" id="navSearchAdvanced">Búsqueda avanzada…</a>
    </div>`
  navRight.insertBefore(wrap, navUser)

  const dropdown = document.getElementById('navSearchDropdown')
  const input = document.getElementById('navSearchInput')

  function goToSearch() {
    const q = input.value.trim()
    window.location.href = q ? `/buscar.html?q=${encodeURIComponent(q)}` : '/buscar.html'
  }

  document.getElementById('navSearchBtn').addEventListener('click', () => {
    const willOpen = dropdown.classList.contains('hidden')
    if (!willOpen) {
      goToSearch()
      return
    }
    dropdown.classList.remove('hidden')
    input.focus()
  })

  document.getElementById('navSearchForm').addEventListener('submit', (e) => {
    e.preventDefault()
    goToSearch()
  })

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) dropdown.classList.add('hidden')
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dropdown.classList.add('hidden')
  })
}
