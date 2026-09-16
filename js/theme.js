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

  // El gemelo del menú desplegable de móvil (tanda 312). Existe porque
  // en una pantalla de 320 px la barra no da para seis botones de 44,
  // que es lo que pide un dedo: ahí el de arriba se esconde por CSS y
  // este toma el relevo. Los dos apuntan al mismo sitio, así que el
  // cambio de tema se hace en una función y no en dos.
  const enMenu = document.createElement('button')
  enMenu.type = 'button'
  enMenu.className = 'nav-tema-menu'
  enMenu.id = 'navThemeToggleMenu'

  function paint() {
    const isDark = document.documentElement.dataset.theme === 'dark'
    btn.innerHTML = isDark ? icons.sun(19) : icons.moon(19)
    enMenu.innerHTML = isDark
      ? `${icons.sun(16)} Tema claro`
      : `${icons.moon(16)} Tema oscuro`
  }

  const cambiar = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem(STORAGE_KEY, next)
    paint()
  }
  btn.addEventListener('click', cambiar)
  enMenu.addEventListener('click', cambiar)

  paint()
  navRight.insertBefore(btn, navUser)
  document.getElementById('navMobileMenu')?.appendChild(enMenu)
}
