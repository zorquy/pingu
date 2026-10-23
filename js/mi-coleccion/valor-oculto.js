// Tapar lo que vale la colección (tanda 992). PINGU: «para la gente que hace
// directos o capturas y no quiere enseñar lo que vale». Un ojo al lado del
// valor lo cambia por asteriscos —en la cabecera y en el Panel, con su
// gráfica— y se recuerda en este navegador. Lo tapa la hoja (`html.mc-valor-
// oculto`, en mi-coleccion.css): así vale también para lo que se repinta o
// cuenta solo (la cifra que sube, el cambio del mes) sin tocar quien lo pinta.
import { icons, icon } from '../icons.js'

const CLAVE = 'pokedoc-valor-oculto'
const ojoTachado = (t) => icon('<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"></path><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"></path><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>', t)

let oculto = (() => { try { return localStorage.getItem(CLAVE) === '1' } catch { return false } })()
export const valorOculto = () => oculto
const rotulo = () => (oculto ? 'Enseñar lo que vale' : 'Tapar lo que vale (para directos y capturas)')

export function botonOcultarHtml() {
  return `<button type="button" class="mc-ojo-valor" data-ocultar-valor aria-pressed="${oculto}" aria-label="${rotulo()}" title="${rotulo()}">${oculto ? ojoTachado(16) : icons.eye(16)}</button>`
}

function aplicar() {
  document.documentElement.classList.toggle('mc-valor-oculto', oculto)
  // El botón se cambia en su sitio, sin sustituirlo: así no pierde el foco.
  document.querySelectorAll('[data-ocultar-valor]').forEach((b) => {
    b.setAttribute('aria-pressed', String(oculto))
    b.setAttribute('aria-label', rotulo())
    b.title = rotulo()
    b.innerHTML = oculto ? ojoTachado(16) : icons.eye(16)
  })
}

// Antes del primer pintado del valor, para que no se vea ni un instante.
if (typeof document !== 'undefined') {
  document.documentElement.classList.toggle('mc-valor-oculto', oculto)
  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('[data-ocultar-valor]')) return
    e.preventDefault()
    e.stopPropagation()
    oculto = !oculto
    try { localStorage.setItem(CLAVE, oculto ? '1' : '0') } catch {}
    aplicar()
  })
}
