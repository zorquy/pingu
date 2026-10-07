import { icons } from './icons.js'

// La lupa de la barra. Desde la 718 abre la PALETA (`js/paleta.js`): una
// caja que busca en todo —cartas con su precio, guías, el foro, la gente—,
// lleva a cualquier página y lanza acciones. La abren también los dos
// atajos de teclado: «/» (el de los foros de toda la vida) y Ctrl+K, o
// Cmd+K en el Mac. Antes era un desplegable propio que buscaba solo guías
// y temas; ahora hay UN buscador y lo comparten /buscar y la paleta.
//
// La paleta entra por `import()` al abrirla: este módulo lo baja toda
// página y tiene que seguir siendo una lupa y dos atajos.
const abrir = (texto = '') => import('./paleta.js').then((m) => m.abrirPaleta({ texto })).catch(() => {
  // Si la paleta no llega (sin red, un fallo del módulo), la búsqueda
  // grande sigue siendo una página normal.
  location.href = '/buscar.html'
})

export function renderNavSearch() {
  const navRight = document.querySelector('.nav-right')
  const navUser = document.getElementById('nav-user')
  if (!navRight || !navUser || document.getElementById('navSearch')) return

  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
  const wrap = document.createElement('div')
  wrap.className = 'nav-search-wrap'
  wrap.id = 'navSearch'
  wrap.innerHTML = `<button type="button" class="nav-search-btn" id="navSearchBtn" aria-label="Buscar" aria-keyshortcuts="${mac ? 'Meta+K' : 'Control+K'} /" title="Buscar (${mac ? '⌘K' : 'Ctrl+K'} o /)">${icons.search(19)}</button>`
  navRight.insertBefore(wrap, navUser)
  document.getElementById('navSearchBtn').addEventListener('click', () => abrir())

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return
    if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'k') {
      // Ctrl+K vale también DENTRO de un campo: es lo que hace en todas
      // partes, y no escribe nada.
      e.preventDefault()
      abrir()
      return
    }
    // «/» solo a pelo: sin modificadores y nunca mientras se escribe en un
    // campo o en el editor.
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
    const donde = e.target
    if (donde && (donde.closest?.('input, textarea, select, [contenteditable]') || donde.isContentEditable)) return
    e.preventDefault()
    abrir()
  })
}
