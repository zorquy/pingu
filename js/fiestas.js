// LAS FIESTAS, la puerta (tanda 1287). La línea de la cabecera pone
// `data-temporada` (la decoración de unos días: Halloween, Navidad) y
// `data-fiesta` (lo de UN día dentro de ella: Inocentes, Nochevieja, Reyes);
// app.js entra aquí por `import()` solo si hay alguna, y esto baja el módulo
// de cada una. Así app.js, que lo baja todo el mundo, no crece con cada fiesta.
export function montarFiestas(raiz = document.documentElement) {
  const { temporada, fiesta } = raiz.dataset
  if (temporada === 'halloween') import('./temporada.js').then((m) => m.montarTemporada()).catch(() => {})
  else if (temporada === 'navidad') import('./navidad.js').then((m) => m.montarNavidad()).catch(() => {})
  if (fiesta === 'inocentes') import('./inocentes.js').then((m) => m.montarInocentes()).catch(() => {})
  else if (fiesta === 'nochevieja') import('./nochevieja.js').then((m) => m.montarNochevieja()).catch(() => {})
  else if (fiesta === 'reyes') import('./reyes.js').then((m) => m.montarReyes()).catch(() => {})
}
