// Lo puro del creador de torneos (1434): sin navegador ni base, para que
// test-tanda-1434-pantalla.mjs lo pruebe en Node.

// El orden de las preguntas. «jornadas» solo en una liga; «resumen» es la
// última y no cuenta como pregunta en «3 de 9».
export const PREGUNTAS = ['nombre', 'tipo', 'cuando', 'jornadas', 'plazas', 'formato', 'reloj', 'entrada', 'listas', 'extras', 'resumen']

export const TEXTO_MODO_LISTAS = {
  al_terminar: 'Al terminar el torneo',
  en_juego: 'Desde la ronda 1',
  nunca: 'Nunca',
}

// «2026-11-29T17:00» en la hora de quien crea: lo que lleva un datetime-local.
export function aLocal(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// Los días que se ofrecen con un toque: hoy, mañana y el fin de semana que
// viene (sin repetir: un sábado, «Mañana» ya es el domingo).
export function diasRapidos(ahora = new Date()) {
  const dia = (n) => {
    const d = new Date(ahora)
    d.setHours(0, 0, 0, 0)
    d.setDate(d.getDate() + n)
    return d
  }
  const lista = [
    { fecha: dia(0), texto: 'Hoy' },
    { fecha: dia(1), texto: 'Mañana' },
  ]
  for (const objetivo of [6, 0]) {
    const falta = (objetivo - ahora.getDay() + 7) % 7
    const d = dia(falta)
    if (lista.some((x) => x.fecha.getTime() === d.getTime())) continue
    const corto = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' }).replace('.', '')
    lista.push({ fecha: d, texto: corto.charAt(0).toUpperCase() + corto.slice(1) })
  }
  return lista.map((x) => ({ ...x, valor: aLocal(x.fecha).slice(0, 10) }))
}

// Una jornada por semana desde la primera fecha (para «Una por semana»).
export function jornadasSemanales(primera, cuantas) {
  if (!primera) return Array.from({ length: cuantas }, () => '')
  const base = new Date(primera)
  return Array.from({ length: cuantas }, (_, i) => {
    const d = new Date(base)
    d.setDate(d.getDate() + 7 * i)
    return aLocal(d)
  })
}

// Lo que se juega, dicho en una frase (la tarjeta de «Así se juega» y el
// resumen): «4 rondas suizas al mejor de 1» y «Top 4 al mejor de 3».
export function frasesDelFormato({ liga, rondas, porJornada = 1, bo, corte, boCorte }) {
  const s = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
  const suizas = liga
    ? `${s(rondas, 'jornada', 'jornadas')}${porJornada > 1 ? ` de ${porJornada} rondas` : ''} al mejor de ${bo}`
    : `${s(rondas, 'ronda suiza', 'rondas suizas')} al mejor de ${bo}`
  return { suizas, corte: corte ? `Top ${corte} al mejor de ${boCorte}` : 'Sin top cut' }
}

