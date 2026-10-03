// Las TIRAS DE DATOS de Mi colección (tanda 476).
//
// PINGU, con Dex al lado: «las estadísticas, en deslizables, ¿ves que se
// pueden deslizar? Pues igual» (tanda 467, sobre una expansión) y «la
// Pokédex tiene que ser igual».
//
// Tenía razón en lo de «igual», y lo decía de una pantalla que estaba
// escrita aparte: la tira de una expansión la monta `js/mi-coleccion.js` y
// la cabecera de la Pokédex la montaba `pokedex.js`, con su propia familia
// de clases (`.mc-pdx-caja`, `.mc-pdx-cifra`…). Dos moldes para el mismo
// objeto se separan — es la lección de la tarjeta de guía de la 316.
//
// Así que el molde vive aquí, sin dependencias, y lo usan los dos.
//
// Lo que NO vive aquí es `engancharPuntos`, que es lo que mide dónde está
// la tira al deslizarla: eso necesita el DOM ya pintado y vive donde se
// pinta.

const escapar = (t) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

// Una tarjeta. `dentro` es HTML ya montado por quien la pide: cada
// pantalla mete lo suyo —un anillo, una lista, unas barras—, y lo único
// que comparten es la caja y el título.
export function diapoHtml(titulo, dentro) {
  return `<article class="mc-diapo">
    <h3 class="mc-diapo-titulo">${escapar(titulo)}</h3>
    ${dentro}
  </article>`
}

// La tira entera, con su fila de puntos debajo.
//
// Los puntos se pintan VACÍOS: cuántos hay lo decide `engancharPuntos`
// contando las tarjetas que al final se hayan pintado, y eso cambia —
// «Tipos de carta» no sale si el catálogo no sabe de qué clase es ninguna,
// y «El que menos» no sale si es el mismo que «El que más».
export function tiraHtml(diapos, { idPuntos = '', etiqueta = 'Qué dato se está viendo' } = {}) {
  const dentro = (diapos || []).filter(Boolean).join('')
  if (!dentro) return ''
  // `mc-tira-datos` es lo que la hace DESLIZABLE. No va en `.mc-diapos` a
  // secas porque esa clase la usa también el bloque de «Estadísticas» del
  // panel, que no es una tira con puntos sino una rejilla larga: darle el
  // ajuste a pantalla de aquí le dejaría las tarjetas a lo ancho de la
  // pantalla y los datos a tres pantallazos de distancia.
  return `<div class="mc-diapos mc-tira-datos">${dentro}</div>
    <div class="mc-puntos"${idPuntos ? ` id="${escapar(idPuntos)}"` : ''} role="tablist" aria-label="${escapar(etiqueta)}"></div>`
}
