// «¿Más caro o más barato?» (tanda 583): el tercer reto diario.
//
// Seis cartas con precio de Cardmarket, las mismas para todo el mundo
// cada día. Se enseña una con su precio y la siguiente sin él: ¿vale más
// o menos? Cinco preguntas, una tira de cuadrados y una racha, como los
// otros dos retos. Es el «Higher or Lower» de toda la vida, con lo único
// que esta web tiene y los demás no: los precios de las cartas que la
// gente de PokeDoc tiene de verdad (son las únicas con precio guardado).
//
// Lo que se puede probar sin navegador vive aquí: el número del día, qué
// índices toca hoy, qué cartas sirven, si una respuesta acierta y el
// texto que se comparte.
import { azarDelDia } from './carta-del-dia.js'
import { rachaDeDias, tiraEmoji } from './reto-compartir.js'

export { rachaDeDias, tiraEmoji }

// El estreno. De aquí NO SE MUEVE: cambiarlo renumeraría los retos que la
// gente ya ha publicado.
export const DIA_UNO = '2026-10-04'
export const RONDAS = 5
export const CARTAS_POR_DIA = RONDAS + 1
export const ENLACE = 'pokedoc.es/mas-caro'
// Por debajo de un euro todo vale lo mismo y la pregunta no tiene gracia.
export const PRECIO_MINIMO = 1

function utc(dia) {
  const [y, m, d] = String(dia).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function numeroDelDia(dia) {
  return Math.round((utc(dia) - utc(DIA_UNO)) / 86400000) + 1
}

// `cuantos` índices DISTINTOS entre 0 y total-1, deterministas por día.
// Se piden más de los que hacen falta porque alguna carta elegida puede
// no valer (sin foto, de Pocket, mismo precio que la anterior).
export function indicesDelDia(dia, total, cuantos) {
  const n = Math.max(0, Math.min(Number(total) || 0, cuantos))
  const vistos = new Set()
  let sal = 0
  while (vistos.size < n && sal < cuantos * 20) {
    vistos.add(Math.floor(azarDelDia(dia, sal) * total) % total)
    sal++
  }
  return [...vistos]
}

// De las candidatas (ya con `precio`), las que sirven y en orden, sin dos
// seguidas con el mismo precio: «¿más o menos?» con la respuesta «igual»
// no es una pregunta. Devuelve hasta `cuantas`.
export function cartasQueSirven(candidatas, cuantas = CARTAS_POR_DIA) {
  const fuera = []
  for (const c of candidatas || []) {
    const precio = Number(c?.precio)
    if (!c?.id || !Number.isFinite(precio) || precio < PRECIO_MINIMO) continue
    if (!c.image_path && !c.image_scrydex && !c.image_tcggo) continue
    if (fuera.length && Math.abs(fuera[fuera.length - 1].precio - precio) < 0.005) continue
    fuera.push(c)
    if (fuera.length >= cuantas) break
  }
  return fuera
}

// ¿Acierta? `respuesta` es 'mas' o 'menos' sobre la carta B frente a la A.
export function acierta(precioA, precioB, respuesta) {
  const a = Number(precioA)
  const b = Number(precioB)
  if (respuesta === 'mas') return b > a
  if (respuesta === 'menos') return b < a
  return false
}

export function textoParaCompartir({ dia, tira, rachaDias = 0 }) {
  const aciertos = (tira || []).filter(Boolean).length
  const lineas = [
    `¿Más caro o más barato? PokeDoc #${numeroDelDia(dia)} · ${aciertos}/${RONDAS} ${aciertos === RONDAS ? '🏆' : '💶'}`,
    tiraEmoji(tira),
  ]
  if (rachaDias >= 2) lineas.push(`🔥 ${rachaDias} días seguidos`)
  lineas.push(ENLACE)
  return lineas.join('\n')
}
