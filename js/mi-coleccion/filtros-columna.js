// Los filtros en una COLUMNA FIJA junto a la rejilla, en el ordenador (738,
// X14 de la lista de propuestas).
//
// En un móvil el panel de filtros es una hoja que tapa la rejilla, y está
// bien: no hay sitio para los dos. En el ordenador sobra sitio, y abrir una
// hoja para tocar un chip y cerrarla para ver el resultado es el gesto del
// móvil llevado a una pantalla donde no hace falta. Ahí el MISMO `<dialog>`
// se abre sin modal (`show()`) y la hoja lo coloca como columna pegajosa a
// la izquierda: los filtros ya aplicaban al momento (tanda 714), así que
// solo cambia dónde se ven.
//
// El botón «Filtros» la esconde y la saca, y lo que elijas se recuerda: hay
// quien prefiere la rejilla a lo ancho.
export const CLAVE = 'mc-filtros-columna'
export const CONSULTA = '(min-width: 1100px) and (pointer: fine)'

// ¿Va en columna? Hace falta pantalla ancha con ratón Y no haberla
// escondido. Puro: lo prueba node.
export function vaEnColumna({ ancha, guardado }) {
  return Boolean(ancha) && guardado !== 'no'
}

const leer = (almacen) => { try { return almacen?.getItem(CLAVE) ?? null } catch { return null } }
const guardar = (almacen, v) => { try { almacen?.setItem(CLAVE, v) } catch {} }

export function montarColumnaFiltros({ seccion, panel, boton, cerrar, alAbrir = () => {}, win = window, almacen = globalThis.localStorage }) {
  if (!seccion || !panel) return null
  const mq = win.matchMedia?.(CONSULTA)
  const ancha = () => Boolean(mq?.matches)
  const enColumna = () => seccion.classList.contains('mc-con-columna')

  const poner = () => {
    const toca = vaEnColumna({ ancha: ancha(), guardado: leer(almacen) })
    if (toca && !enColumna()) {
      // Si estaba abierto como hoja (modal), se cierra antes: un `<dialog>`
      // modal no se puede volver no modal sin cerrarlo.
      if (panel.open) panel.close()
      seccion.classList.add('mc-con-columna')
      alAbrir()
      panel.show()
    } else if (!toca && enColumna()) {
      seccion.classList.remove('mc-con-columna')
      if (panel.open) panel.close()
    }
    boton?.setAttribute('aria-expanded', enColumna() ? 'true' : 'false')
  }

  // El botón y el ✕: en columna, esconderla o sacarla (y recordarlo); si
  // no, lo de siempre (lo engancha mi-coleccion.js). Van en captura para
  // adelantarse a ese y pararlo.
  boton?.addEventListener('click', (e) => {
    if (!ancha()) return
    e.stopImmediatePropagation()
    guardar(almacen, enColumna() ? 'no' : 'si')
    poner()
  }, true)
  cerrar?.addEventListener('click', (e) => {
    if (!enColumna()) return
    e.stopImmediatePropagation()
    guardar(almacen, 'no')
    poner()
  }, true)
  // Esc en un `<dialog>` no modal no hace nada, pero por si acaso: en
  // columna no se cierra con el teclado mientras escribes un precio.
  panel.addEventListener('cancel', (e) => { if (enColumna()) e.preventDefault() })
  mq?.addEventListener?.('change', poner)
  poner()
  return { poner, enColumna }
}
