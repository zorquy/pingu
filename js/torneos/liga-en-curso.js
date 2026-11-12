// Una LIGA EN CURSO, de un vistazo (tandas 1302 y 1303, PINGU eligió la J1 y
// la T1 de «Ligas y jornadas»: «estamos por la jornada 6 y no se ve, y no se
// avisa de las jornadas nuevas»).
//
// Puro, sin la base: lo usan /torneos (la franja «Ligas en curso») y la
// función programada `ligas-jornadas` (la víspera y los resultados en
// Telegram y la campanita), así que las dos cuentan las jornadas igual.
// Las cuentas de rondas por jornada son las de siempre (rondas-jornada.js) y
// la clasificación, la del motor (computeStandings), como en la ficha.
import { computeStandings } from './motor.js'
import { TERMINALES } from './mesas.js'
import { rondasPorJornada, numJornadas, jornadaDeRonda } from './rondas-jornada.js'

// La víspera es el día antes: se avisa cuando faltan 24 horas o menos.
export const VISPERA_MS = 24 * 3600e3
// Los resultados de una jornada se cuentan si se cerró hace menos de un día:
// una jornada vieja (la 5 cuando esto llegue con la 6 en marcha) no se
// anuncia tarde, se apunta y ya está.
export const RESULTADOS_MS = 24 * 3600e3

const suizas = (rondas) => (rondas || []).filter((r) => r.phase !== 'top_cut')
const fechasDe = (t) => (Array.isArray(t?.matchday_dates) ? t.matchday_dates : [])

// Cada jornada con su estado: «hecha» (todas sus rondas cerradas), «saltada»
// (cerrada sin empezar ninguna, la 833), «en_juego» (alguna empezada) o
// «pendiente». Y la SIGUIENTE: la primera que no está hecha.
export function jornadasDeLiga(t, rondas) {
  const rpj = rondasPorJornada(t)
  const fechas = fechasDe(t)
  const total = numJornadas(t) || fechas.length
  const porJornada = new Map()
  for (const r of suizas(rondas)) {
    const n = jornadaDeRonda(t, r.round_number)
    if (!porJornada.has(n)) porJornada.set(n, [])
    porJornada.get(n).push(r)
  }
  const lista = Array.from({ length: total }, (_, i) => {
    const n = i + 1
    const suyas = porJornada.get(n) || []
    const cerradas = suyas.length >= rpj && suyas.every((r) => r.status === 'finished')
    const saltada = cerradas && suyas.every((r) => !r.started_at)
    const cierre = cerradas ? Math.max(...suyas.map((r) => Date.parse(r.closed_at || '') || 0)) || null : null
    const estado = saltada ? 'saltada' : cerradas ? 'hecha' : suyas.length ? 'en_juego' : 'pendiente'
    return { n, fecha: fechas[i] || null, estado, cierre }
  })
  const siguiente = lista.find((j) => j.estado === 'en_juego' || j.estado === 'pendiente') || null
  return { lista, total, siguiente, hechas: lista.filter((j) => j.estado === 'hecha' || j.estado === 'saltada').length }
}

// La jornada que toca avisar la víspera: su fecha cae en las próximas 24
// horas y no ha empezado. Una jornada ya empezada no se anuncia.
export function jornadaDeVispera(t, rondas, ahora = Date.now()) {
  return (
    jornadasDeLiga(t, rondas).lista.find((j) => {
      const f = Date.parse(j.fecha || '')
      return j.estado === 'pendiente' && Number.isFinite(f) && f > ahora && f - ahora <= VISPERA_MS
    }) || null
  )
}

// La última jornada JUGADA, si se cerró hace menos de un día (una saltada no
// tiene resultados que contar).
export function jornadaRecienTerminada(t, rondas, ahora = Date.now()) {
  const hechas = jornadasDeLiga(t, rondas).lista.filter((j) => j.estado === 'hecha' || j.estado === 'saltada')
  const ultima = hechas[hechas.length - 1]
  if (!ultima || ultima.estado !== 'hecha' || !ultima.cierre) return null
  return ahora - ultima.cierre <= RESULTADOS_MS ? ultima : null
}

// La clasificación de la liga entera, como la de la ficha (montarSnapshot de
// ronda.js: jugadores, partidas terminales con su resultado), sin los que se
// han dado de baja. `resultados` son filas de match_results.
export function clasificacionDeLiga(t, { inscripciones = [], rondas = [], partidas = [], resultados = [] } = {}) {
  const numeroDe = new Map(rondas.map((r) => [r.id, Number(r.round_number)]))
  const resultadoDe = new Map(resultados.map((r) => [r.match_id, r]))
  const desenlace = (m) => (m.status === 'finished' ? resultadoDe.get(m.id)?.result || 'draw' : m.status === 'bye' ? 'bye' : m.status)
  const jugadores = inscripciones.filter((i) => i.status === 'active' || i.status === 'dropped')
  const snapshot = {
    pairingSeed: t?.pairing_seed || '',
    currentRoundNumber: Math.max(0, ...numeroDe.values()),
    players: jugadores.map((i) => ({ id: i.user_id, dropped: i.status === 'dropped', droppedAfterRoundNumber: null })),
    matches: partidas
      .filter((m) => TERMINALES.has(m.status) && numeroDe.has(m.round_id))
      .map((m) => ({
        roundNumber: numeroDe.get(m.round_id),
        tableNumber: m.table_number,
        playerAId: m.player_a_id,
        playerBId: m.player_b_id,
        outcome: desenlace(m),
        finishedAt: m.finished_at,
      })),
  }
  const fuera = new Set(jugadores.filter((i) => i.status === 'dropped').map((i) => i.user_id))
  return computeStandings(snapshot).filter((e) => !fuera.has(e.playerId))
}

// «Liga FDN [Oct–Dic]» → «Liga FDN»: los corchetes son la temporada, que en
// un aviso corto sobra (la misma regla que la mascota de Inicio, 1301).
export const nombreCorto = (nombre) => String(nombre || '').replace(/\s*\[[^\]]*\]\s*/g, ' ').trim()

// La campanita de la víspera, a los inscritos: si ya ha mandado su lista, se
// le recuerda la hora; si no, que la mande (sin lista no juega esa jornada).
export function campanitaDeVispera(t, j, { conLista = false, hora = '', dia = 'Mañana' } = {}) {
  const liga = nombreCorto(t.name)
  return {
    title: `${dia}, jornada ${j.n} de la ${liga}`,
    body: conLista
      ? `Ya tienes tu lista.${hora ? ` Se juega a las ${hora}.` : ''}`
      : `${hora ? `A las ${hora}. ` : ''}Manda tu lista para jugarla: sin lista no juegas esta jornada.`,
  }
}
