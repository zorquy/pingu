// Los juegos de una partida al mejor de tres (tanda 632).
//
// PINGU: «me falta que se pueda marcar en Mis partidas el Bo3: algo más
// dinámico, tipo poner game 1 W, L, T y así consecutivamente, como
// trainingcourt.app». Una partida de torneo son hasta tres juegos, y lo que
// se apunta es cada uno —quién ganó y quién empezó—; el resultado de la
// partida SALE de ahí y no se elige aparte, que sería poder apuntar «2-1» y
// «Perdida» a la vez.
//
// Sin imports: lo usan la página y las pruebas en Node.
//
// En la base (supabase-migration-partidas-juegos.sql), tres columnas de
// `match_log`, las tres opcionales —una fila de antes no las trae y es una
// partida al mejor de uno sin detalle—:
//   formato  'bo1' | 'bo3'
//   juegos   'WLW' — una letra por juego: W ganado, L perdido, T empate
//   salida   '12-' — quién empezó cada juego: 1 tú, 2 el rival, - no se sabe

export const FORMATOS = ['bo1', 'bo3']
export const MAX_JUEGOS = { bo1: 1, bo3: 3 }

// De la letra de un juego al resultado de la partida, con las mismas
// palabras que usa el resto de la página.
const A_RESULTADO = { W: 'win', L: 'loss', T: 'draw' }

// El resultado de la partida a partir de sus juegos. Al mejor de tres
// gana quien gana más juegos, y un juego empatado (el tiempo) no suma a
// nadie: «W, T» es una victoria 1-0, como en un torneo de verdad. Sin
// ningún juego apuntado no hay resultado (null), y eso NO es un empate.
export function resultadoDeJuegos(formato, juegos) {
  const hechos = (juegos || []).map((j) => j?.r).filter((r) => r === 'W' || r === 'L' || r === 'T')
  if (!hechos.length) return null
  if (formato !== 'bo3') return A_RESULTADO[hechos[0]]
  const g = hechos.filter((r) => r === 'W').length
  const p = hechos.filter((r) => r === 'L').length
  return g > p ? 'win' : g < p ? 'loss' : 'draw'
}

// Cuántos juegos van ganados y perdidos (y empatados).
export function marcador(juegos) {
  const rs = (juegos || []).map((j) => j?.r)
  return { g: rs.filter((r) => r === 'W').length, p: rs.filter((r) => r === 'L').length, e: rs.filter((r) => r === 'T').length }
}

// ¿La partida está decidida? Al mejor de tres, con dos juegos de alguien;
// o con los tres jugados.
export function decidida(formato, juegos) {
  if (formato !== 'bo3') return !!juegos?.[0]?.r
  const m = marcador(juegos)
  return m.g >= 2 || m.p >= 2 || (juegos || []).filter((j) => j?.r).length >= 3
}

// Cuántas filas de juego se enseñan: las apuntadas y, si la partida no
// está decidida, UNA más para el siguiente (así se rellena de corrido,
// juego a juego). Al mejor de uno, siempre una.
export function filasVisibles(formato, juegos) {
  if (formato !== 'bo3') return 1
  const js = recortar(formato, juegos)
  return decidida(formato, js) ? Math.max(js.length, 1) : Math.min(js.length + 1, MAX_JUEGOS.bo3)
}

// Lo que sobra de una partida ya decidida se quita: si cambias el juego 2
// a una victoria y ya ibas 1-0, el juego 3 deja de existir. Y un hueco en
// medio (juego 1 sin marcar, juego 2 marcado) corta ahí: los juegos van en
// orden.
export function recortar(formato, juegos) {
  const max = MAX_JUEGOS[formato] || 1
  const out = []
  for (const j of (juegos || []).slice(0, max)) {
    if (!j?.r) break
    out.push({ r: j.r, s: j.s === '1' || j.s === '2' ? j.s : null })
    if (formato === 'bo3' && decidida('bo3', out)) break
  }
  return out
}

// A la base: las tres columnas. Sin juegos apuntados, todo null (una
// partida de las de antes, o un bye).
export function aColumnas(formato, juegos) {
  const js = recortar(formato, juegos)
  if (!js.length) return { formato: FORMATOS.includes(formato) ? formato : null, juegos: null, salida: null }
  return {
    formato,
    juegos: js.map((j) => j.r).join(''),
    salida: js.some((j) => j.s) ? js.map((j) => j.s || '-').join('') : null,
  }
}

// De la base: lo contrario. Una fila sin columnas es una al mejor de uno
// sin juegos: el formulario la abre como estaba.
export function deColumnas(fila) {
  const formato = FORMATOS.includes(fila?.formato) ? fila.formato : 'bo1'
  const rs = typeof fila?.juegos === 'string' ? [...fila.juegos].filter((r) => 'WLT'.includes(r)) : []
  const ss = typeof fila?.salida === 'string' ? [...fila.salida] : []
  return { formato, juegos: rs.map((r, i) => ({ r, s: ss[i] === '1' || ss[i] === '2' ? ss[i] : null })) }
}

// «2-1», «1-0-1»: el marcador para enseñar.
export function textoMarcador(juegos) {
  const m = marcador(juegos)
  return `${m.g}-${m.p}${m.e ? `-${m.e}` : ''}`
}

// Las cifras de los juegos para las estadísticas: cuántos juegos ganados,
// y cómo te va empezando tú y empezando el rival. Solo cuentan las
// partidas que traen juegos (las demás no dicen nada de esto: no son
// «cero juegos», son «no se sabe»).
export function cifrasDeJuegos(partidas) {
  const c = { partidas: 0, juegos: { g: 0, p: 0, e: 0 }, primero: { g: 0, total: 0 }, segundo: { g: 0, total: 0 }, bo3: { g: 0, p: 0, e: 0 } }
  for (const p of partidas || []) {
    const js = p.juegos || []
    if (!js.length) continue
    c.partidas++
    for (const j of js) {
      if (j.r === 'W') c.juegos.g++
      else if (j.r === 'L') c.juegos.p++
      else if (j.r === 'T') c.juegos.e++
      const lado = j.s === '1' ? c.primero : j.s === '2' ? c.segundo : null
      if (lado && j.r !== 'T') {
        lado.total++
        if (j.r === 'W') lado.g++
      }
    }
    if (p.formato === 'bo3') {
      const r = resultadoDeJuegos('bo3', js)
      if (r === 'win') c.bo3.g++
      else if (r === 'loss') c.bo3.p++
      else if (r === 'draw') c.bo3.e++
    }
  }
  return c
}
