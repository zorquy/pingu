// «Jugar otra vez» (988): una partida LIBRE del mismo reto, las veces que
// se quiera y sin XP. PURO (sin DOM ni Supabase): lo importan los juegos y
// las funciones de Netlify que eligen las cartas.
//
// PINGU: «cada reto, cuando acabes, que puedas repetir el minijuego las veces
// que quieras… que te avise de que esa vez ya no te da experiencia, porque
// solo da la primera vez que lo completas al día».
//
// Una partida libre es un número del 1 al LIBRES (`?libre=N` en la
// dirección) y se juega como si fuera OTRO DÍA: el de `diaLibre(N)`, en 1900,
// que no puede ser ningún día de verdad. Así todo lo que ya elige por la
// fecha (la silueta, las cartas, las opciones) sirve tal cual, y lo libre no
// pisa nunca la partida de hoy: va en su propia llave del navegador
// (`claveLibre`), no se guarda en la base y no se comparte (la de hoy es la
// misma para todos; una libre no la puede comparar nadie).
//
// Son MIL y no infinitas a propósito: cada una es una dirección que la CDN
// guarda un día, así que repetir no le cuesta una función a nadie.
export const LIBRES = 1000
const DIA_CERO = Date.UTC(1900, 0, 1)

export function numeroLibre(v) {
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= LIBRES ? n : null
}

export const diaLibre = (n) => new Date(DIA_CERO + n * 86400000).toISOString().slice(0, 10)

export const libreDeDireccion = (search = '') => numeroLibre(new URLSearchParams(search).get('libre'))

// Otra al azar, distinta de la que se acaba de jugar.
export function otraLibre(actual = null, azar = Math.random) {
  let n = 1 + Math.floor(azar() * LIBRES)
  if (n === actual) n = (n % LIBRES) + 1
  return n
}

export const rutaLibre = (ruta, n) => `${ruta}?libre=${n}`
export const claveLibre = (clave, libre) => (libre ? `${clave}-libre` : clave)
