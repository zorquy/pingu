import { icons } from './icons.js'

const STORAGE_KEY = 'pokedoc-theme'

// El script en línea del <head> de cada página ya deja document.documentElement.dataset.theme
// puesto antes de pintar (para evitar el parpadeo de tema claro al cargar
// con el oscuro guardado) — aquí solo hace falta pintar el icono del botón
// a juego con lo que ya se aplicó, y enganchar el clic.
export function renderThemeToggle() {
  const navRight = document.querySelector('.nav-right')
  const navUser = document.getElementById('nav-user')
  if (!navRight || !navUser || document.getElementById('navThemeToggle')) return

  const btn = document.createElement('button')
  btn.type = 'button'
  btn.className = 'nav-search-btn'
  btn.id = 'navThemeToggle'
  btn.setAttribute('aria-label', 'Cambiar entre tema claro y oscuro')

  function paint() {
    const isDark = document.documentElement.dataset.theme === 'dark'
    btn.innerHTML = isDark ? icons.sun(19) : icons.moon(19)
  }
  paint()

  btn.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem(STORAGE_KEY, next)
    paint()
  })

  navRight.insertBefore(btn, navUser)
}
