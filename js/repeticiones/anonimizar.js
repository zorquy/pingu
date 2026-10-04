// Cambiar los nombres de los jugadores de un registro por Rojo y Azul
// (tanda 520), para publicar una partida como ejemplo sin enseñar a nadie:
// el rival no ha dicho que quiera salir en una galería.
//
// El nombre de TCG Live se cambia SOLO como palabra entera («Ash» sí,
// «Ashley» no), y en las dos frases a la vez con marcas de paso, para que un
// jugador que ya se llame «Azul» no acabe convertido dos veces. Y si el
// nombre de alguien es también parte del nombre de una carta («Pikachu»),
// no se toca nada: cambiarlo cambiaría la carta, y una partida de ejemplo
// con las cartas equivocadas enseña otra cosa.
//
// Sin DOM: se prueba en Node.
import { leerRegistro } from './registro.js'

export const NOMBRES_DE_EJEMPLO = ['Rojo', 'Azul']

const esc = (x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const palabra = (nombre) => new RegExp(`(?<![\\p{L}\\p{N}_])${esc(nombre)}(?![\\p{L}\\p{N}_])`, 'gu')

// Los nombres de carta que salen en la partida.
function cartasDe(lectura) {
  const out = new Set()
  for (const e of lectura.eventos) {
    for (const k of ['carta', 'pokemon', 'objetivo', 'sube', 'baja', 'a', 'de', 'herramienta']) if (typeof e[k] === 'string') out.add(e[k])
    for (const c of e.cartas || []) out.add(c)
  }
  return [...out]
}

// `primero` va a «Rojo» y el otro a «Azul». Devuelve { texto } o
// { error } diciendo por qué no se puede.
export function anonimizar(texto, primero = null) {
  const lectura = leerRegistro(texto)
  if (lectura.error) return { error: lectura.error }
  const [a, b] = lectura.jugadores
  const orden = primero === b ? [b, a] : [a, b]
  const cartas = cartasDe(lectura)
  const choca = orden.find((n) => cartas.some((c) => palabra(n).test(c)))
  if (choca) return { error: `«${choca}» es también parte del nombre de una carta de la partida: cambiarlo cambiaría la carta.` }
  // Primero a una marca que no puede estar en un registro, y luego al
  // nombre nuevo: así «Azul» → «Rojo» y «Rojo» → «Azul» no se pisan.
  let out = String(texto)
  orden.forEach((n, k) => (out = out.replace(palabra(n), `\u0000${k}\u0000`)))
  orden.forEach((_, k) => (out = out.split(`\u0000${k}\u0000`).join(NOMBRES_DE_EJEMPLO[k])))
  // Y se comprueba leyéndolo: los mismos jugadores nuevos, las mismas
  // jugadas y las mismas cartas. Si no, no se publica algo roto.
  const nueva = leerRegistro(out)
  const iguales = (x, y) => JSON.stringify(x) === JSON.stringify(y)
  const tipos = (l) => l.eventos.map((e) => e.tipo)
  if (nueva.error || !iguales([...nueva.jugadores].sort(), [...NOMBRES_DE_EJEMPLO].sort()) || !iguales(tipos(nueva), tipos(lectura)) || !iguales(cartasDe(nueva).sort(), cartas.sort())) {
    return { error: 'Con los nombres cambiados el registro ya no se lee igual: no se puede publicar así.' }
  }
  return { texto: out, de: Object.fromEntries(orden.map((n, k) => [n, NOMBRES_DE_EJEMPLO[k]])) }
}
