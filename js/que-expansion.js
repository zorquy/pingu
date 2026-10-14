// «¿De qué expansión es?» (tanda 835), lo PURO: el número del día, las
// cuatro expansiones de cada ronda y el texto que se comparte. Las cinco
// cartas las elige netlify/functions/que-expansion.mjs.
import { azarDelDia } from './carta-del-dia.js'
import { tiraEmoji } from './reto-compartir.js'

export const DIA_UNO = '2026-10-14'
export const RONDAS = 5
export const OPCIONES = 4
export const ENLACE = 'pokedoc.es/que-expansion'

function utc(dia) {
  const [y, m, d] = String(dia).split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function numeroDelDia(dia) {
  return Math.round((utc(dia) - utc(DIA_UNO)) / 86400000) + 1
}

const dias = (a, b) => Math.abs((Date.parse(a || '1990-01-01') - Date.parse(b || '1990-01-01')) / 86400000)

// Las cuatro de una ronda: la buena y tres de la MISMA ERA, de las más
// cercanas en fecha (si no, sería fácil: nadie confunde Base Set con Surging
// Sparks); si la era no da para tres, las más cercanas en fecha de las demás.
// El orden, por la fecha del reto y la ronda: todo el mundo ve las mismas.
export function opcionesDeExpansion(bueno, sets, dia, ronda = 0) {
  const otros = (sets || []).filter((s) => s?.id && s.id !== bueno?.id)
  const cerca = (lista) => [...lista].sort((a, b) => dias(a.release_date, bueno?.release_date) - dias(b.release_date, bueno?.release_date))
  const deLaEra = cerca(otros.filter((s) => s.serie_id && s.serie_id === bueno?.serie_id)).slice(0, 6)
  const elegidas = []
  let sal = 1300 + ronda * 31
  while (elegidas.length < OPCIONES - 1 && deLaEra.length > elegidas.length && sal < 1300 + ronda * 31 + 200) {
    const c = deLaEra[Math.floor(azarDelDia(dia, sal) * deLaEra.length) % deLaEra.length]
    sal++
    if (!elegidas.includes(c)) elegidas.push(c)
  }
  for (const s of cerca(otros)) {
    if (elegidas.length >= OPCIONES - 1) break
    if (!elegidas.includes(s)) elegidas.push(s)
  }
  const sitio = Math.floor(azarDelDia(dia, 1700 + ronda) * (elegidas.length + 1)) % (elegidas.length + 1)
  const todas = [...elegidas]
  todas.splice(sitio, 0, bueno)
  return todas.filter(Boolean)
}

export function textoParaCompartir({ dia, tira }) {
  const aciertos = (tira || []).filter(Boolean).length
  return [`¿De qué expansión es? PokeDoc #${numeroDelDia(dia)} · ${aciertos}/${RONDAS}`, tiraEmoji(tira), ENLACE].join('\n')
}
