// UN DESPLEGABLE HECHO BOTONES (712, C5). PINGU eligió la hoja de añadir
// corta: el estado y la versión se eligen de un toque, a la vista, en vez
// de abrir un desplegable que en el iPhone tapa media pantalla.
//
// El `<select>` NO desaparece: sigue siendo la fuente del valor —lo lee
// quien guarda, lo rellena quien prepara el formulario, y las pruebas
// viejas eligen con él—, pero pasa a medir un píxel, sin foco y fuera de
// la lectura de pantalla. Lo que se toca y lo que se lee es el grupo de
// botones, con `role="radiogroup"`. Y los dos no se pueden separar: un
// observador repinta los botones cada vez que cambian las opciones del
// select, y cualquier cambio de valor —venga de un botón o de código— pasa
// por el `change` del select.
import { escapeHtml } from '../html.js'

export function segmentar(select, { etiqueta = '', corto = (o) => o.textContent, conNombre = false } = {}) {
  if (!select || select.dataset.segmentado) return null
  select.dataset.segmentado = '1'
  select.classList.add('mc-seg-select')
  select.tabIndex = -1
  select.setAttribute('aria-hidden', 'true')
  const caja = document.createElement('div')
  caja.className = 'mc-seg'
  caja.setAttribute('role', 'radiogroup')
  if (etiqueta) caja.setAttribute('aria-label', etiqueta)
  select.insertAdjacentElement('afterend', caja)
  const nombre = conNombre ? document.createElement('small') : null
  if (nombre) {
    nombre.className = 'mc-seg-nombre'
    caja.insertAdjacentElement('afterend', nombre)
  }

  const pintar = () => {
    const ops = [...select.options]
    caja.innerHTML = ops
      .map((o) => {
        const si = o.value === select.value
        return `<button type="button" role="radio" aria-checked="${si}" tabindex="${si ? 0 : -1}" data-valor="${escapeHtml(o.value)}" title="${escapeHtml(o.textContent)}">${escapeHtml(corto(o))}</button>`
      })
      .join('')
    if (nombre) nombre.textContent = select.selectedOptions[0]?.textContent || ''
  }
  const elegir = (valor, foco = false) => {
    if (select.value !== valor) {
      select.value = valor
      select.dispatchEvent(new Event('change', { bubbles: true }))
    }
    pintar()
    if (foco) caja.querySelector(`[data-valor="${CSS.escape(valor)}"]`)?.focus()
  }
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-valor]')
    if (b) elegir(b.dataset.valor)
  })
  // Las flechas mueven la elección, como en cualquier grupo de radios.
  caja.addEventListener('keydown', (e) => {
    const paso = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
    if (!paso) return
    e.preventDefault()
    const ops = [...select.options]
    const i = ops.findIndex((o) => o.value === select.value)
    const j = (i + paso + ops.length) % ops.length
    elegir(ops[j].value, true)
  })
  select.addEventListener('change', pintar)
  new MutationObserver(pintar).observe(select, { childList: true, subtree: true, attributes: true })
  pintar()
  return { pintar }
}
