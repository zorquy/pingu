// Cómo le fue a un ARQUETIPO en un torneo (tanda 1444). Ibai, con un gráfico
// de poke_hive delante: «que haga estos gráficos con los datos del torneo
// finalizado». Representación, % de victorias y de empates, conversión al
// corte, el % contra el resto del meta, dónde acabaron sus jugadores y la
// tabla de cruces contra cada mazo rival.
//
// Puro (sin DOM ni base): sale de lo que la ficha ya tiene —el meta agrupado
// de meta-torneo.js, las mesas y sus resultados— y se prueba en Node.
//
// Qué cuenta como partida: solo las JUGADAS (gana A, gana B o empate). Un bye
// o una victoria por no presentarse no dicen nada de cómo juega un mazo, y con
// pocas mesas le cambiarían el porcentaje a quien le tocó. El corte sí cuenta:
// es donde más se juega.

const JUGADAS = new Set(['a_wins', 'b_wins', 'draw'])

// El desenlace de una mesa para estas cuentas, o null si no se jugó.
function desenlace(m, resultadoDe) {
  if (m.status !== 'finished') return null
  const r = resultadoDe(m.id)?.result
  return JUGADAS.has(r) ? r : null
}

const vacio = () => ({ v: 0, d: 0, e: 0 })
const jugadas = (x) => x.v + x.d + x.e
const tasa = (n, x) => (jugadas(x) ? n / jugadas(x) : null)

// Los tramos de puestos, como en los informes de los torneos grandes. Cada
// jugador cae en UNO (el más alto que alcanza): ganar es «Top 1», no también
// «Top 2».
export function tramosDePuestos(jugadores) {
  const tramos = [1, 2, 4, 8, 16, 32, 64, 128, 256].filter((n, i, a) => i === 0 || a[i - 1] < jugadores)
  return tramos.map((hasta, i) => ({ desde: i ? tramos[i - 1] + 1 : 1, hasta, etiqueta: `Top ${hasta}` }))
}

// meta:     lo que devuelve agruparMeta (los grupos con su `clave` y sus jugadores)
// clave:    el grupo que se mira
// partidas: las mesas del torneo ({ id, round_id, player_a_id, player_b_id, status })
// resultadoDe(matchId) → { result } o null
// orden:    la clasificación FINAL (ordenFinal): [{ playerId }]
// corte:    plazas del corte (0 si no hubo)
export function cifrasDeArquetipo({ meta, clave, partidas = [], resultadoDe = () => null, orden = [], corte = 0 }) {
  const grupo = meta?.arquetipos?.find((g) => g.clave === clave)
  if (!grupo) return null
  const grupoDe = new Map()
  for (const g of meta.arquetipos) for (const j of g.jugadores) grupoDe.set(j.userId, g)
  const mios = new Set(grupo.jugadores.map((j) => j.userId))

  const total = vacio()
  const sinEspejo = vacio()
  const cruces = new Map()
  for (const m of partidas) {
    const r = desenlace(m, resultadoDe)
    if (!r) continue
    // Cada lado de la mesa que juega este mazo suma una partida. En un espejo
    // suman los dos (una victoria y una derrota), como en los informes.
    for (const [yo, rival, gano] of [
      [m.player_a_id, m.player_b_id, 'a_wins'],
      [m.player_b_id, m.player_a_id, 'b_wins'],
    ]) {
      if (!yo || !mios.has(yo)) continue
      const casilla = r === 'draw' ? 'e' : r === gano ? 'v' : 'd'
      total[casilla]++
      const g = grupoDe.get(rival) || null
      const claveRival = g?.clave ?? 'sin-lista'
      if (claveRival !== clave) sinEspejo[casilla]++
      if (!cruces.has(claveRival)) cruces.set(claveRival, { clave: claveRival, grupo: g, ...vacio() })
      cruces.get(claveRival)[casilla]++
    }
  }

  // Dónde acabó cada uno, por tramos.
  const puestoDe = new Map(orden.map((e, i) => [e.playerId, i + 1]))
  const tramos = tramosDePuestos(orden.length).map((t) => ({ ...t, cuantos: 0 }))
  for (const id of mios) {
    const p = puestoDe.get(id)
    if (!p) continue
    const tramo = tramos.find((t) => p >= t.desde && p <= t.hasta)
    if (tramo) tramo.cuantos++
  }

  // La conversión: de los que lo jugaron, cuántos entraron en el corte. Sin
  // corte, cuántos acabaron en el Top 8 (o en la mitad de arriba si son menos).
  const plazas = corte > 0 ? corte : Math.min(8, Math.ceil(orden.length / 2))
  const convertidos = [...mios].filter((id) => (puestoDe.get(id) || Infinity) <= plazas).length

  const filas = [...cruces.values()]
    .map((c) => ({ ...c, partidas: jugadas(c), porcentaje: tasa(c.v, c), empates: tasa(c.e, c), espejo: c.clave === clave }))
    .sort((a, b) => b.partidas - a.partidas || (b.porcentaje ?? 0) - (a.porcentaje ?? 0))

  return {
    grupo,
    jugadores: grupo.cuantos,
    listas: meta.total,
    representacion: meta.total ? grupo.cuantos / meta.total : 0,
    partidas: jugadas(total),
    ...total,
    porcentaje: tasa(total.v, total),
    empates: tasa(total.e, total),
    porcentajeSinEspejo: tasa(sinEspejo.v, sinEspejo),
    partidasSinEspejo: jugadas(sinEspejo),
    conversion: { plazas, convertidos, de: grupo.cuantos, porCorte: corte > 0 },
    tramos,
    cruces: filas,
  }
}

// El color de una casilla de cruce: de rojo (0 %) a verde (100 %) pasando por
// un gris en el 50 %, que es «ni bien ni mal». Devuelve un `hsl` con su
// transparencia para que sirva en claro y en oscuro.
export function colorDeCruce(p) {
  if (p === null || p === undefined) return 'transparent'
  const d = Math.max(-1, Math.min(1, (p - 0.5) * 2))
  const fuerza = Math.abs(d)
  // El 50 % justo, gris: ni verde ni rojo.
  if (fuerza < 0.05) return 'hsl(205 15% 55% / 0.14)'
  const tono = d > 0 ? 145 : 4
  return `hsl(${tono} 62% 46% / ${(0.12 + fuerza * 0.5).toFixed(2)})`
}
