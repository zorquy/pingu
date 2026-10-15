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
// El número del día es el COMÚN de todos los retos (870): un solo «#77»
// para los seis. Se reexporta para quien lo pedía de aquí.
import { numeroDelDia, cabeceraDeReto, NOMBRE_CORTO, rachaDeDias, tiraEmoji } from './reto-compartir.js'
import { azarDelDia } from './carta-del-dia.js'

export { numeroDelDia }

export { rachaDeDias, tiraEmoji }

export const RONDAS = 5
export const CARTAS_POR_DIA = RONDAS + 1
export const ENLACE = 'pokedoc.es/mas-caro'
// Por debajo de un euro todo vale lo mismo y la pregunta no tiene gracia.
export const PRECIO_MINIMO = 1

// `cuantos` índices DISTINTOS entre 0 y total-1, deterministas por día.
// Se piden más de los que hacen falta porque alguna carta elegida puede
// no valer (sin foto, de Pocket, mismo precio que la anterior).
// `salBase` (835): «Ordena por precio» elige con la misma regla, pero no
// las mismas cartas que «Más caro».
export function indicesDelDia(dia, total, cuantos, salBase = 0) {
  const n = Math.max(0, Math.min(Number(total) || 0, cuantos))
  const vistos = new Set()
  let sal = salBase
  while (vistos.size < n && sal < salBase + cuantos * 20) {
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
    cabeceraDeReto({ dia, nombre: NOMBRE_CORTO.caro, cuenta: `${aciertos}/${RONDAS}`, extra: aciertos === RONDAS ? '🏆' : '💶' }),
    tiraEmoji(tira),
  ]
  if (rachaDias >= 2) lineas.push(`🔥 ${rachaDias} días seguidos`)
  lineas.push(ENLACE)
  return lineas.join('\n')
}
