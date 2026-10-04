// Importar varias partidas a la vez (tanda 518): lo que no necesita la
// página. PINGU, de la lista de ideas: «pegar varios registros de golpe (o
// elegir los ficheros) y que se guarden y se apunten en Mis partidas».
//
// Sin DOM: se prueba en Node.

// Cada registro de TCG Live empieza por su línea de «Preparación» («Setup»
// en inglés): es lo que separa uno pegado detrás de otro. Lo de antes de la
// primera (una línea suelta, un título que alguien escribió) no es partida.
const INICIO = /^(preparaci[oó]n|setup)$/i

export function partirRegistros(texto) {
  const lineas = String(texto || '').replace(/\r/g, '').split('\n')
  const trozos = []
  let actual = null
  for (const l of lineas) {
    if (INICIO.test(l.trim())) {
      if (actual) trozos.push(actual)
      actual = [l]
    } else if (actual) actual.push(l)
  }
  if (actual) trozos.push(actual)
  // Sin ninguna «Preparación» (un registro copiado sin su primera línea),
  // el texto entero es UNA partida, y ya dirá el lector si lo es.
  if (!trozos.length) return String(texto || '').trim() ? [String(texto).trim()] : []
  // La misma pegada dos veces es una partida, no dos.
  return [...new Set(trozos.map((t) => t.join('\n').trim()))]
}

// Quién eres, por defecto: el nombre que este navegador recuerda si juega
// alguna; si no, el que sale en MÁS partidas — quien importa sus partidas
// sale en todas —, y solo si sale en dos o más (con una no se sabe).
export function yoDeLasPartidas(partidas, recordado = null) {
  const cuenta = new Map()
  for (const p of partidas) for (const j of p.jugadores || []) cuenta.set(j, (cuenta.get(j) || 0) + 1)
  if (recordado && cuenta.has(recordado)) return recordado
  const [mas, n] = [...cuenta.entries()].sort((a, b) => b[1] - a[1])[0] || [null, 0]
  const empatado = [...cuenta.values()].filter((x) => x === n).length > 1
  return n >= 2 && !empatado ? mas : null
}
