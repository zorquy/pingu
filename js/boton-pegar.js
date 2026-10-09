// «Pegar» al lado de un textarea (tanda 790): en el móvil, mantener pulsado
// para pegar en una caja vacía es un gesto que mucha gente no encuentra. Sin
// permiso del navegador para leer el portapapeles, el botón no sale.
export function botonPegar(textarea, boton) {
  if (!textarea || !boton) return
  if (!navigator.clipboard?.readText) { boton.remove(); return }
  boton.hidden = false
  boton.addEventListener('click', async () => {
    try {
      const texto = await navigator.clipboard.readText()
      if (!texto) return textarea.focus()
      textarea.value = texto
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
      textarea.focus()
    } catch {
      textarea.focus()
    }
  })
}
