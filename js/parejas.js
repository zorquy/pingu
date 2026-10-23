// «Parejas» (tanda 989), lo PURO: la mesa del día, la XP por movimientos y el
// texto que se comparte. Sustituye a «El reto de hoy» (el cuestionario).
//
// PINGU eligió el juego de memoria de toda la vida, con cartas de verdad:
// doce boca abajo, seis parejas; das la vuelta a dos y, si son la misma, se
// quedan. Siempre se acaba, así que nadie se queda a cero: lo que cambia es
// en cuántos MOVIMIENTOS (un movimiento = dos cartas vueltas).
//
// Las seis cartas las elige netlify/functions/parejas.mjs (el catálogo
// cambia en el día y una semilla sobre «cuántas hay» no valdría); el SITIO de
// cada una en la mesa sale de aquí, de la fecha, y es el mismo para todos.
// El número del día es el común de los retos (870).
import { numeroDelDia, cabeceraDeReto, NOMBRE_CORTO, tiraEmoji } from './reto-compartir.js'
import { azarDelDia } from './carta-del-dia.js'
// La XP vive con la de los demás (retos-xp.js; la base dice lo mismo en
// retos_xp): aquí se reexporta y se usa, así que se importa también (la 624).
import { PAREJAS, xpDeMovimientos } from './retos-xp.js'

export { numeroDelDia, PAREJAS, xpDeMovimientos }

export const ENLACE = 'pokedoc.es/parejas'
const SAL = 15000

// Lo que vale todavía, en el mejor de los casos: los movimientos que llevas
// y uno por cada pareja que falta.
export const xpQueQueda = (movimientos, hechas) => xpDeMovimientos((Number(movimientos) || 0) + (PAREJAS - (Number(hechas) || 0)))

// La mesa: qué carta (0..n-1) va en cada hueco, cada una dos veces, barajada
// con la fecha.
export function mesaDelDia(dia, n = PAREJAS) {
  const mesa = Array.from({ length: n * 2 }, (_, i) => i % n)
  for (let i = mesa.length - 1; i > 0; i--) {
    const j = Math.floor(azarDelDia(dia, SAL + i) * (i + 1)) % (i + 1)
    ;[mesa[i], mesa[j]] = [mesa[j], mesa[i]]
  }
  return mesa
}

// Un movimiento: `abiertas` son los dos huecos vueltos y `hechas` las cartas
// (0..n-1) ya emparejadas. Devuelve el estado nuevo y si ha sido pareja.
export function mover(estado, a, b, mesa) {
  const pareja = a !== b && mesa[a] === mesa[b]
  const hechas = pareja && !estado.hechas.includes(mesa[a]) ? [...estado.hechas, mesa[a]] : estado.hechas
  return { estado: { ...estado, movimientos: estado.movimientos + 1, hechas, tira: [...(estado.tira || []), pareja] }, pareja }
}

export const acabada = (estado, n = PAREJAS) => (estado?.hechas?.length || 0) >= n

// «PokeDoc #84 · Parejas · 9 movimientos», la tira (verde = pareja) y el
// enlace. No desvela nada: el sitio de las cartas no se ve en cuadrados.
export function textoParaCompartir({ dia, movimientos, tira = [] }) {
  return [cabeceraDeReto({ dia, nombre: NOMBRE_CORTO.parejas, cuenta: `${movimientos} movimientos` }), tiraEmoji(tira), ENLACE].join('\n')
}
