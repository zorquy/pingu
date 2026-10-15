// «¿Quién es ese Pokémon?» (tanda 835), lo PURO: el Pokémon del día, las
// cuatro opciones y el texto que se comparte. Sin servidor y sin tabla: el
// Pokémon sale de la fecha y de la Pokédex Nacional, que no cambia en el día
// (al revés que el catálogo de cartas, que por eso elige en una función).
//
// La silueta de la serie de la tele: el dibujo oficial en negro, cuatro
// nombres y tres intentos. El dibujo es el de PokeAPI (por número), por las
// mismas dos puertas que los minisprites (jsDelivr y GitHub a pelo).
// El número del día es el COMÚN de todos los retos (870): un solo «#77»
// para los seis. Se reexporta para quien lo pedía de aquí.
import { numeroDelDia, cabeceraDeReto, NOMBRE_CORTO } from './reto-compartir.js'
import { azarDelDia } from './carta-del-dia.js'
import { cadenaDe } from './familias-pokemon.js'

export { numeroDelDia }

export const INTENTOS = 3
export const OPCIONES = 4
export const TOTAL_POKEDEX = 1025
export const ENLACE = 'pokedoc.es/quien-es'
// Una sal propia para no sacar los mismos números que los otros retos.
const SAL = 7001

export function pokemonDelDia(dia) {
  return 1 + (Math.floor(azarDelDia(dia, SAL) * TOTAL_POKEDEX) % TOTAL_POKEDEX)
}

// Las cuatro opciones, en un orden que no delata cuál es: la buena y tres
// de OTRAS familias (con Haunter al lado de Gengar, la silueta se parece
// demasiado y deja de ser un juego de reconocer).
export function opcionesDelDia(dia) {
  const buena = pokemonDelDia(dia)
  const elegidas = [buena]
  const familias = new Set([cadenaDe(buena)])
  let sal = SAL + 1
  while (elegidas.length < OPCIONES && sal < SAL + 400) {
    const dex = 1 + (Math.floor(azarDelDia(dia, sal) * TOTAL_POKEDEX) % TOTAL_POKEDEX)
    sal++
    if (elegidas.includes(dex) || familias.has(cadenaDe(dex))) continue
    elegidas.push(dex)
    familias.add(cadenaDe(dex))
  }
  // El sitio de la buena entre las cuatro, también por la fecha.
  const sitio = Math.floor(azarDelDia(dia, SAL + 500) * elegidas.length) % elegidas.length
  const [b, ...resto] = elegidas
  resto.splice(sitio, 0, b)
  return resto
}

const ARTE = 'sprites/pokemon/other/official-artwork'
export function urlsDelDibujo(dex) {
  return [
    `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/${ARTE}/${dex}.png`,
    `https://raw.githubusercontent.com/PokeAPI/sprites/master/${ARTE}/${dex}.png`,
  ]
}

export function textoParaCompartir({ dia, fallos = [], acertada }) {
  const filas = [...fallos.map(() => '🟥'), ...(acertada ? ['🟩'] : [])].join('')
  return [cabeceraDeReto({ dia, nombre: NOMBRE_CORTO.silueta, cuenta: acertada ? `${fallos.length + 1}/${INTENTOS}` : `X/${INTENTOS}` }), filas, ENLACE].join('\n')
}
