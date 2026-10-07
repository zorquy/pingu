// La carta abierta A LA DERECHA (740, D2 de la lista de propuestas): en una
// pantalla ancha, Mi colección › Cartas es de tres columnas —tus
// expansiones y los filtros a la izquierda, la rejilla en el centro y la
// carta que abres a la derecha—, y la ficha no tapa la rejilla: abres otra
// carta y la de la derecha cambia, las flechas pasan de carta y Esc cierra.
//
// Es el MISMO `<dialog>` de siempre abierto sin modal (`show()`), pegado al
// borde derecho, y la página se aparta para dejarle sitio. Solo desde
// 1.600 px: con la barra lateral (739), las pestañas de Mi colección y la
// columna de filtros, por debajo de eso a la rejilla le quedaban dos cartas.
export const CONSULTA = '(min-width: 1600px) and (pointer: fine)'

// ¿Al lado? Pantalla ancha y la ficha se abre desde la rejilla de Cartas.
// Desde una expansión, la Pokédex o un álbum, la ficha sigue siendo la de
// siempre: esas pantallas no tienen tres columnas que hacer. Puro.
export function vaAlLado({ ancha, vista }) {
  return Boolean(ancha) && vista === 'cartas'
}

// Abre la ficha donde toque. Si ya estaba abierta en la otra forma, se
// cierra antes: un `<dialog>` modal no se vuelve no modal sin cerrarlo.
export function abrirFichaDonde(d, { alLado, doc = document }) {
  const ya = d.classList.contains('mc-ficha-al-lado')
  if (d.open && ya !== alLado) d.close()
  d.classList.toggle('mc-ficha-al-lado', alLado)
  doc.documentElement.classList.toggle('con-ficha-al-lado', alLado)
  if (d.open) return
  if (alLado) d.show()
  else d.showModal()
}

// Lo que el `<dialog>` modal hace solo y el no modal no: Esc cierra, y las
// flechas pasan de carta aunque el foco esté en la rejilla (en el modal el
// foco no podía salir de la ficha). Nunca dentro de un campo: ahí una
// flecha mueve el cursor o el valor.
export function engancharFichaAlLado(d, { vecino, doc = document }) {
  d.addEventListener('close', () => {
    d.classList.remove('mc-ficha-al-lado')
    doc.documentElement.classList.remove('con-ficha-al-lado')
  })
  doc.addEventListener('keydown', (e) => {
    if (!d.open || !d.classList.contains('mc-ficha-al-lado') || e.defaultPrevented) return
    if (e.target?.closest?.('input, select, textarea, [contenteditable]')) return
    if (e.key === 'Escape') {
      e.preventDefault()
      d.close()
      return
    }
    // Las flechas DENTRO de la ficha ya las escucha la ficha (422).
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !d.contains(e.target)) {
      e.preventDefault()
      vecino(e.key === 'ArrowRight' ? 1 : -1)
    }
  })
}
