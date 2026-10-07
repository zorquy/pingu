// La ayuda de los atajos (723, D6): sale con «?». Su CSS va con el de la
// paleta (`css/buscador.css`), que es la misma familia de caja.
import { hojaInyectada } from './hoja.js'
import { SECCIONES } from './nav-search.js'

const NOMBRES = { i: 'Inicio', n: 'Noticias', a: 'Guías y cursos', c: 'Catálogo de cartas', m: 'Mi colección', f: 'Foro', j: 'Torneos', b: 'Buscar' }

export function abrirAyuda(doc = document) {
  hojaInyectada('css/buscador.css')
  let d = doc.getElementById('atajosAyuda')
  if (!d) {
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '')
    const fila = (teclas, que) => `<tr><td>${teclas.map((t) => `<kbd>${t}</kbd>`).join(' ')}</td><td>${que}</td></tr>`
    d = doc.createElement('dialog')
    d.id = 'atajosAyuda'
    d.className = 'paleta atajos'
    d.setAttribute('aria-labelledby', 'atajosTitulo')
    d.innerHTML = `<div class="atajos-cuerpo">
      <h2 id="atajosTitulo">Atajos de teclado</h2>
      <table>
        ${fila([mac ? '⌘' : 'Ctrl', 'K'], 'Buscar en todo')}
        ${fila(['/'], 'Buscar en todo')}
        ${Object.keys(SECCIONES).map((k) => fila(['G', k.toUpperCase()], `Ir a ${NOMBRES[k]}`)).join('')}
        ${fila(['←', '→'], 'Pasar de carta en una ficha')}
        ${fila(['A'], 'Añadir la carta abierta a tu colección')}
        ${fila(['T'], 'Cambiar entre tema claro y oscuro')}
        ${fila(['Esc'], 'Cerrar')}
        ${fila(['?'], 'Esta ayuda')}
      </table>
      <form method="dialog"><button class="btn-primary">Entendido</button></form>
    </div>`
    doc.body.appendChild(d)
    d.addEventListener('click', (e) => { if (e.target === d) d.close() })
  }
  if (!d.open) d.showModal()
  return d
}
