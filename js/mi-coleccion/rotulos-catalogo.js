// Occidental y japonés, cada uno en su tramo (1033, PINGU: «separado está bien
// y está ordenado»): el rótulo va como una fila más de la rejilla, que sigue
// siendo una; con un solo catálogo no hay rótulo. Lo usan Deseos y cambios
// (La quiero, Las que doy) y, desde la 1038, el Mercado, que dejó su selector
// de catálogo y enseña los dos.
import { banderaHtml } from '../precio-vista.js'

export function porCatalogo(items, mercadoDe) {
  const jp = items.filter((x) => mercadoDe(x) === 'JP')
  const occ = items.filter((x) => mercadoDe(x) !== 'JP')
  return [['WEST', occ], ['JP', jp]].filter(([, l]) => l.length)
}

export function rotuloDeCatalogo(m, n) {
  return `<h3 class="mc-catalogo-rotulo">${banderaHtml(m === 'JP' ? 'ja' : 'en')}<span>${m === 'JP' ? 'Pokémon Japón' : 'Pokémon'}</span>${n == null ? '' : `<small>${n}</small>`}</h3>`
}

export function conRotulos(items, mercadoDe, pintar) {
  const tramos = porCatalogo(items, mercadoDe)
  if (tramos.length < 2) return items.map(pintar).join('')
  return tramos.map(([m, l]) => `${rotuloDeCatalogo(m, l.length)}${l.map(pintar).join('')}`).join('')
}
