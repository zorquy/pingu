// «Ordena por precio» (tanda 835), lo PURO: qué cartas sirven, el orden
// bueno, qué está en su sitio y el texto que se comparte. Las cuatro del día
// las elige netlify/functions/ordena-precio.mjs (como «Más caro»: la lista de
// cartas con precio cambia en el día y una semilla sobre ella no valdría).
// El número del día es el COMÚN de todos los retos (870): un solo «#77»
// para los seis. Se reexporta para quien lo pedía de aquí.
import { numeroDelDia, cabeceraDeReto, NOMBRE_CORTO } from './reto-compartir.js'

export { numeroDelDia }

export const CARTAS = 4
export const INTENTOS = 3
export const ENLACE = 'pokedoc.es/ordena-precio'
export const PRECIO_MINIMO = 1
// Dos cartas a menos de un 15 % la una de la otra no se distinguen: el
// juego sería adivinar los céntimos.
export const DIFERENCIA_MINIMA = 1.15

// De las candidatas (con `precio`), las cuatro primeras que sirven: con
// foto, de un euro para arriba y lejos en precio de las ya elegidas.
export function cartasQueSirven(candidatas, cuantas = CARTAS) {
  const fuera = []
  for (const c of candidatas || []) {
    const p = Number(c?.precio)
    if (!c?.id || !Number.isFinite(p) || p < PRECIO_MINIMO) continue
    if (!c.image_path && !c.image_scrydex && !c.image_tcggo) continue
    if (fuera.some((x) => Math.max(x.precio, p) / Math.min(x.precio, p) < DIFERENCIA_MINIMA)) continue
    fuera.push(c)
    if (fuera.length >= cuantas) break
  }
  return fuera
}

// Los ids de la más barata a la más cara.
export const ordenBueno = (cartas) => [...(cartas || [])].sort((a, b) => Number(a.precio) - Number(b.precio)).map((c) => c.id)

// Cuáles están en su sitio en el orden que diste.
export function enSuSitio(orden, cartas) {
  const bueno = ordenBueno(cartas)
  return (orden || []).map((id, i) => id === bueno[i])
}

export function textoParaCompartir({ dia, intentos = [], cartas = [], acertada }) {
  const filas = intentos.map((o) => enSuSitio(o, cartas).map((b) => (b ? '🟩' : '🟥')).join(''))
  return [cabeceraDeReto({ dia, nombre: NOMBRE_CORTO.ordena, cuenta: acertada ? `${intentos.length}/${INTENTOS}` : `X/${INTENTOS}` }), ...filas, ENLACE].join('\n')
}
