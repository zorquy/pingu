// Lo que se comparte del reto diario (tanda 568): el texto de Wordle.
//
// Un «4/5 🥈 ¿puedes superarlo?» no se encadena. Lo que hizo que Wordle
// se encadenara son tres cosas, y son las tres que faltaban:
//   · el NÚMERO del día («Reto PokeDoc #66»): todo el mundo hace el mismo
//     reto el mismo día, y el número es lo que dice «el mismo que tú»;
//   · la TIRA de cuadrados (🟩🟩🟥🟩🟩), que enseña cómo te ha ido sin
//     desvelar ni una pregunta — así se puede publicar antes de que el de
//     al lado lo juegue;
//   · la RACHA de días («🔥 12 días seguidos»), que es la razón de volver
//     mañana.
//
// Son emojis A PROPÓSITO, contra la norma de la casa (iconos SVG): esto
// no es la interfaz, es un texto que se pega en WhatsApp o en X, y allí
// un SVG no existe. En la pantalla del resultado la tira va dibujada con
// CSS, como todo lo demás.
//
// Sin DOM y sin Supabase: se prueba en Node.

// Desde cuándo se cuenta. La fecha exacta del estreno del reto no quedó
// apuntada, así que se fija esta y de aquí NO SE MUEVE: cambiarla
// renumeraría todos los retos que la gente ya ha publicado.
export const DIA_UNO = '2026-08-01'

export const ENLACE = 'pokedoc.es/reto'

const MEDALLA = { oro: '🥇', plata: '🥈', bronce: '🥉' }

function diasDesde(desde, hasta) {
  const a = Date.UTC(...desde.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)))
  const b = Date.UTC(...hasta.split('-').map(Number).map((n, i) => (i === 1 ? n - 1 : n)))
  return Math.round((b - a) / 86400000)
}

// El número del reto de un día (ISO, UTC: el mismo que guarda la base).
export function numeroDelDia(dia) {
  return diasDesde(DIA_UNO, dia) + 1
}

export function tiraEmoji(tira) {
  return (tira || []).map((ok) => (ok ? '🟩' : '🟥')).join('')
}

// Cuántos días seguidos, contando `hoy`, hay en una lista de días jugados.
// Hoy tiene que estar: la racha se enseña justo después de guardar el
// reto de hoy. Sin hoy, cero — no hay racha que presumir.
export function rachaDeDias(diasJugados, hoy) {
  const hay = new Set(diasJugados || [])
  let n = 0
  let d = hoy
  while (hay.has(d)) {
    n++
    const [y, m, dd] = d.split('-').map(Number)
    d = new Date(Date.UTC(y, m - 1, dd - 1)).toISOString().slice(0, 10)
  }
  return n
}

export function textoParaCompartir({ dia, tira, correct, total, medal, rachaDias = 0 }) {
  const lineas = [
    `Reto PokeDoc #${numeroDelDia(dia)} · ${correct}/${total} ${MEDALLA[medal] || '🎯'}`,
    tiraEmoji(tira),
  ]
  if (rachaDias >= 2) lineas.push(`🔥 ${rachaDias} días seguidos`)
  lineas.push(ENLACE)
  return lineas.join('\n')
}
