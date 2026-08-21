import { icons } from './icons.js'
import { supabase } from './supabase.js'
import { escapeHtml } from './html.js'
import { conVueltaAtras, terminoParaFiltro } from './busqueda.js'

// Lupa de búsqueda en la navbar. Primer clic abre un mini popup; con
// texto, el popup enseña RESULTADOS RÁPIDOS de todo el sitio (guías y
// temas del foro, tres de cada) sin salir de la página, más el salto a
// cartas y a la búsqueda grande. Y el atajo clásico de teclado: pulsar
// "/" en cualquier página (fuera de un campo de texto) abre la lupa.
export function renderNavSearch() {
  const navRight = document.querySelector('.nav-right')
  const navUser = document.getElementById('nav-user')
  if (!navRight || !navUser || document.getElementById('navSearch')) return

  const wrap = document.createElement('div')
  wrap.className = 'nav-search-wrap'
  wrap.id = 'navSearch'
  wrap.innerHTML = `
    <button type="button" class="nav-search-btn" id="navSearchBtn" aria-label="Buscar" title="Buscar (/)">${icons.search(19)}</button>
    <div class="nav-search-dropdown hidden" id="navSearchDropdown">
      <form id="navSearchForm">
        <input type="text" id="navSearchInput" class="search-input" placeholder="Buscar en PokeDoc…" autocomplete="off" />
        <button type="submit" class="btn-primary">Buscar</button>
      </form>
      <div id="navSearchRapidos"></div>
      <a href="/buscar.html" id="navSearchAdvanced">Búsqueda avanzada…</a>
    </div>`
  navRight.insertBefore(wrap, navUser)

  const dropdown = document.getElementById('navSearchDropdown')
  const input = document.getElementById('navSearchInput')
  const rapidos = document.getElementById('navSearchRapidos')

  function goToSearch() {
    const q = input.value.trim()
    window.location.href = q ? `/buscar.html?q=${encodeURIComponent(q)}` : '/buscar.html'
  }

  function abrir() {
    dropdown.classList.remove('hidden')
    input.focus()
  }

  // ── Los resultados rápidos ──
  //
  // Guías y temas del foro, tres de cada, según se teclea. Con número de
  // secuencia: una respuesta lenta de una búsqueda VIEJA no puede pisar
  // a la nueva (la misma carrera que ya mordió en buscar.html).
  let secuencia = 0
  let temporizador = null

  async function buscarRapido() {
    const crudo = input.value.trim()
    const mia = ++secuencia
    if (crudo.length < 2) {
      rapidos.innerHTML = ''
      return
    }
    const patron = `%${terminoParaFiltro(crudo)}%`

    const [guias, temas] = await Promise.all([
      conVueltaAtras(
        () => supabase.from('guides').select('slug, title').not('published_at', 'is', null).ilike('search_norm', patron).limit(3),
        // Sin la migración de acentos, se busca distinguiéndolos.
        () => supabase.from('guides').select('slug, title').not('published_at', 'is', null).ilike('title', `%${crudo}%`).limit(3)
      ).then(({ data }) => data || []),
      conVueltaAtras(
        () => supabase.from('forum_threads').select('id, title').ilike('search_norm', patron).limit(3),
        () => supabase.from('forum_threads').select('id, title').ilike('title', `%${crudo}%`).limit(3)
      ).then(({ data }) => data || []),
    ]).catch(() => [[], []])
    if (mia !== secuencia) return

    const seccion = (titulo, filas) => (filas.length ? `<p class="nav-search-seccion">${titulo}</p>${filas.join('')}` : '')
    const fila = (href, icono, texto) =>
      `<a class="nav-search-fila" href="${href}">${icono}<span>${escapeHtml(texto)}</span></a>`

    // No hay fila de "cartas": el buscador de cartas vive dentro del
    // editor (el selector), no tiene página propia que enlazar.
    rapidos.innerHTML =
      seccion('Guías', guias.map((g) => fila(`/guia?slug=${encodeURIComponent(g.slug)}`, icons.bookOpen(14), g.title))) +
      seccion('Foro', temas.map((t) => fila(`/tema/${encodeURIComponent(t.id)}`, icons.messageSquare(14), t.title)))
    if (!rapidos.innerHTML && guias.length + temas.length === 0) {
      rapidos.innerHTML = `<p class="nav-search-seccion">Nada rápido con «${escapeHtml(crudo)}» — prueba la búsqueda grande.</p>`
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(temporizador)
    temporizador = setTimeout(buscarRapido, 250)
  })

  document.getElementById('navSearchBtn').addEventListener('click', () => {
    const willOpen = dropdown.classList.contains('hidden')
    if (!willOpen) {
      goToSearch()
      return
    }
    abrir()
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
    // El atajo "/" de los foros de toda la vida. Solo a pelo: sin
    // modificadores y nunca mientras se escribe en un campo o el editor.
    if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return
    const donde = e.target
    if (donde && (donde.closest?.('input, textarea, select') || donde.isContentEditable)) return
    e.preventDefault()
    abrir()
  })
}
