// «¿De qué expansión es?» (tanda 835), lo PURO: el número del día, las
// cuatro expansiones de cada ronda y el texto que se comparte. Las cinco
// cartas las elige netlify/functions/que-expansion.mjs.
// El número del día es el COMÚN de todos los retos (870): un solo «#77»
// para los seis. Se reexporta para quien lo pedía de aquí.
import { numeroDelDia, cabeceraDeReto, NOMBRE_CORTO, tiraEmoji } from './reto-compartir.js'
import { azarDelDia } from './carta-del-dia.js'
import { nombreDeSet } from './catalogo-series.js'

export { numeroDelDia }

export const RONDAS = 5
export const OPCIONES = 4
export const ENLACE = 'pokedoc.es/que-expansion'

const dias = (a, b) => Math.abs((Date.parse(a || '1990-01-01') - Date.parse(b || '1990-01-01')) / 86400000)

// Las cuatro de una ronda: la buena y tres de la MISMA ERA, de las más
// cercanas en fecha (si no, sería fácil: nadie confunde Base Set con Surging
// Sparks); si la era no da para tres, las más cercanas en fecha de las demás.
// El orden, por la fecha del reto y la ronda: todo el mundo ve las mismas.
// Y dos con el MISMO nombre no van juntas (976): «Trainer Gallery» al lado
// de «Trainer Gallery» no se puede acertar más que a suerte.
export function opcionesDeExpansion(bueno, sets, dia, ronda = 0) {
  const nombre = (s) => String(nombreDeSet(s) || s?.id || '').trim().toLowerCase()
  const vistos = new Set([nombre(bueno)])
  const otros = (sets || []).filter((s) => {
    if (!s?.id || s.id === bueno?.id || vistos.has(nombre(s))) return false
    vistos.add(nombre(s))
    return true
  })
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
  return [cabeceraDeReto({ dia, nombre: NOMBRE_CORTO.expansion, cuenta: `${aciertos}/${RONDAS}` }), tiraEmoji(tira), ENLACE].join('\n')
}
