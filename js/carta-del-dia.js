// «¿Qué carta es?» (tanda 570): lo PURO del juego, sin DOM y sin Supabase,
// que lo usan el navegador y la función que elige la carta del día.
//
// Un recorte de una carta al día, la misma para todo el mundo, y seis
// intentos para adivinar CUÁL. Cada intento dice cuatro cosas de la carta
// que has dicho contra la del día —el nombre, la era, el tipo y la
// rareza—, y esas cuatro casillas son la fila 🟩🟥 que luego se comparte,
// como los cuadrados de Wordle: enseña cómo has llegado sin desvelar la
// carta. El porqué largo, en SCHEMA.md.

// Desde cuándo se cuenta. Fijo: cambiarlo renumeraría lo ya publicado.
export const DIA_UNO = '2026-10-04'
export const INTENTOS = 6
export const ENLACE = 'pokedoc.es/carta-del-dia'

function utc(dia) {
  const [y, m, d] = String(dia).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function numeroDelDia(dia) {
  return Math.round((utc(dia) - utc(DIA_UNO)) / 86400000) + 1
}

// Un número del día que no se adivina mirando el calendario (mulberry32
// sobre la fecha, el mismo generador del reto). Devuelve [0, 1).
export function azarDelDia(dia, sal = 0) {
  let a = (utc(dia) / 86400000 + sal * 7919) >>> 0
  a = (a + 0x6d2b79f5) >>> 0
  let t = a
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Cuál de las `total` cartas elegibles toca hoy. Determinista: dos
// personas (o dos servidores a la vez) sacan la misma.
export function indiceDelDia(dia, total) {
  if (!total || total < 1) return 0
  return Math.floor(azarDelDia(dia) * total) % total
}

// El DESENFOQUE de cada intento, en píxeles sobre una carta de ~320 de
// ancho (tanda 572): de una mancha de colores a casi nítida. Era un
// recorte con zoom (570); PINGU enseñó Pokédle y su carta entera
// borrosa, y es mejor mecánica: lo que se reconoce de una carta son los
// colores y la composición, no un trozo de cielo a 5×. Y el último paso
// NO es cero: con 5 px el arte se ve y el nombre impreso sigue sin
// leerse, que es lo que hace que el sexto intento siga siendo un intento.
export const DESENFOQUES = [28, 20, 14, 10, 7, 5]

// El nombre que se compara: en minúsculas, sin tildes, y sin la coletilla
// de la mecánica («Pikachu ex» y «Pikachu» son dos cartas distintas, así
// que la coletilla SE QUEDA; lo que se quita es solo mayúsculas y tildes).
export function claveDeNombre(nombre) {
  return String(nombre || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

const rarezaDe = (c) => String(c?.rarity_en || c?.rarity || '').toLowerCase()
const tipoDe = (c) => String((Array.isArray(c?.types) ? c.types[0] : c?.types) || '').toLowerCase()
const eraDe = (c) => String(c?.tcg_sets?.serie_id || c?.serie_id || '').toLowerCase()

// Las cuatro casillas de un intento. `nombre` manda: si coincide, has
// acertado aunque sea otra impresión del mismo Pokémon.
export function compararIntento(intento, respuesta) {
  return {
    nombre: claveDeNombre(intento?.name) === claveDeNombre(respuesta?.name),
    era: Boolean(eraDe(intento)) && eraDe(intento) === eraDe(respuesta),
    tipo: Boolean(tipoDe(intento)) && tipoDe(intento) === tipoDe(respuesta),
    rareza: Boolean(rarezaDe(intento)) && rarezaDe(intento) === rarezaDe(respuesta),
  }
}

export const ORDEN_CASILLAS = ['nombre', 'era', 'tipo', 'rareza']

export function filaEmoji(comparacion) {
  return ORDEN_CASILLAS.map((k) => (comparacion[k] ? '🟩' : '🟥')).join('')
}

// Las pistas, en el orden en que se abren: una por fallo.
export const PISTAS = ['era', 'tipo', 'rareza', 'ilustrador', 'inicial']

export function textoParaCompartir({ dia, comparaciones, acertada, rachaDias = 0 }) {
  const n = comparaciones.length
  const lineas = [
    `¿Qué carta es? #${numeroDelDia(dia)} · ${acertada ? `${n}/${INTENTOS}` : `X/${INTENTOS}`}`,
    ...comparaciones.map(filaEmoji),
  ]
  if (rachaDias >= 2) lineas.push(`🔥 ${rachaDias} días seguidos`)
  lineas.push(ENLACE)
  return lineas.join('\n')
}

// La racha de días ACERTADOS, contando hoy (la misma idea que la del
// reto: sin hoy, cero).
export function rachaDeDias(diasAcertados, hoy) {
  const hay = new Set(diasAcertados || [])
  let n = 0
  let d = hoy
  while (hay.has(d)) {
    n++
    d = new Date(utc(d) - 86400000).toISOString().slice(0, 10)
  }
  return n
}
