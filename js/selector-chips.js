// Un desplegable corto, en chips (tanda 790): tres opciones se eligen de un
// vistazo y no detrás de un toque. El <select> se queda —es quien manda y a
// quien escucha la página—, escondido a la vista; los chips solo lo mueven.
export function chipsDeSelect(select, etiqueta = '') {
  if (!select || select.dataset.chips) return null
  select.dataset.chips = '1'
  const caja = document.createElement('div')
  caja.className = 'seg chips-de-select'
  caja.setAttribute('role', 'group')
  if (etiqueta) caja.setAttribute('aria-label', etiqueta)
  caja.innerHTML = [...select.options].map((o) =>
    `<button type="button" class="seg-btn" data-valor="${o.value.replace(/"/g, '&quot;')}">${o.textContent.replace(/\s*\(.*\)\s*$/, '').replace(/</g, '&lt;')}</button>`).join('')
  const sincronizar = () => {
    for (const b of caja.querySelectorAll('[data-valor]')) b.setAttribute('aria-pressed', String(b.dataset.valor === select.value))
  }
  caja.addEventListener('click', (e) => {
    const b = e.target.closest('[data-valor]')
    if (!b || select.disabled || b.dataset.valor === select.value) return
    select.value = b.dataset.valor
    sincronizar()
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  select.addEventListener('change', sincronizar)
  select.classList.add('sr-only')
  select.tabIndex = -1
  select.after(caja)
  sincronizar()
  return sincronizar
}
