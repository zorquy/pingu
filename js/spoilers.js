// Comportamiento fino de los spoilers PUBLICADOS (los <details> que salen
// del editor). El plegado en sí es del navegador, sin JavaScript; esto
// arregla los dos roces que tenía por ser un elemento nativo:
//
//   1. Seleccionar texto que termina sobre la pestaña la plegaba: el
//      navegador dispara un clic al soltar el ratón, aunque lo que
//      estuvieras haciendo fuera seleccionar. Si hay una selección viva,
//      el clic no pliega.
//   2. Copiar una selección que ATRAVIESA un spoiler cerrado se llevaba
//      también su contenido oculto: está en la página aunque no se vea,
//      y aparecía de sorpresa al pegar — un spoiler desvelado justo donde
//      alguien lo había plegado a propósito. Se copia lo que se ve: de un
//      spoiler cerrado, solo su pestaña.
//
// Va con escuchas delegadas: se llama UNA vez por contenedor y vale para
// todo lo que se pinte dentro después.
export function engancharSpoilers(raiz) {
  if (!raiz || raiz.__spoilersEnganchados) return
  raiz.__spoilersEnganchados = true

  raiz.addEventListener('click', (e) => {
    const resumen = e.target.closest?.('summary')
    if (!resumen || !raiz.contains(resumen)) return
    // Basta con que haya un rango sin colapsar: NO se mira su texto,
    // porque la pestaña lleva user-select: none y una selección que
    // termina sobre ella puede existir con toString() vacío.
    const sel = document.getSelection()
    if (sel && !sel.isCollapsed) e.preventDefault()
  })

  raiz.addEventListener('copy', (e) => {
    const sel = document.getSelection()
    if (!sel || sel.isCollapsed || sel.rangeCount === 0 || !e.clipboardData) return
    const trozo = sel.getRangeAt(0).cloneContents()
    const cerrados = [...trozo.querySelectorAll('details:not([open])')]
    if (cerrados.length === 0) return

    for (const d of cerrados) {
      for (const hijo of [...d.children]) {
        if (hijo.tagName !== 'SUMMARY') hijo.remove()
      }
    }
    const caja = document.createElement('div')
    caja.appendChild(trozo)
    e.clipboardData.setData('text/html', caja.innerHTML)
    e.clipboardData.setData('text/plain', caja.textContent)
    e.preventDefault()
  })
}
