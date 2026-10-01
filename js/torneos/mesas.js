// Lo que se mira de un vistazo en una ronda viva (tanda 394): cuántas
// mesas han terminado y quién no ha hecho check-in.
//
// Sin DOM ni base, como motor.js, para poder probarlo en Node: la
// pantalla solo lo pinta. Y no es lógica de JUEGO —eso es motor.js, que
// es traducción 1:1 de TrainerArena y no se toca a la ligera—, es cómo
// se lee una ronda desde fuera.

// Una mesa ya no se mueve en estos estados.
export const TERMINALES = new Set(['finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both'])

// Una mesa de verdad tiene DOS jugadores. El bye nace cerrado, así que
// contarlo haría que una ronda recién empezada dijera «1/8 terminadas»
// sin que nadie haya jugado una carta — y que el contador no llegara
// nunca a cero en una ronda con número impar de jugadores.
const esMesaDeVerdad = (m) => Boolean(m?.player_a_id && m?.player_b_id) && m.status !== 'bye'

// «4 de 7 mesas han terminado».
export function progresoDeMesas(mesas) {
  const jugadas = (mesas || []).filter(esMesaDeVerdad)
  const terminadas = jugadas.filter((m) => TERMINALES.has(m.status)).length
  return {
    terminadas,
    total: jugadas.length,
    todas: jugadas.length > 0 && terminadas === jugadas.length,
  }
}

// Cuándo se cierra el check-in de una ronda, en milisegundos. Null si la
// ronda no ha arrancado (sin `started_at` no hay ventana que contar).
export function cierreDeCheckin(ronda, checkinMinutes) {
  if (!ronda?.started_at) return null
  return new Date(ronda.started_at).getTime() + (Number(checkinMinutes) || 0) * 60000
}

// Quién no ha hecho check-in en la ronda viva, para la caja de los
// jueces (pedido de PINGU, 2026-10-01): «que salga su nombre para
// avisarles y poder darles de baja». La baja la da SIEMPRE un juez a
// mano; esto solo dice a quién mirar.
//
// Fuera de la lista:
//   · el bye: no tiene check-in que hacer;
//   · quien ya está de baja: no hay nada más que hacerle;
//   · una mesa TERMINADA con resultado (no por incomparecencia): si
//     tiene ganador es que se jugó, aunque a alguien se le olvidara el
//     botón —o la ha cerrado un juez sabiendo lo que pasó—;
//   · quien ha REPORTADO: estaba ahí, aunque no pulsara «Estoy listo».
//
// Y DENTRO quien no vino y su mesa ya cayó por incomparecencia (el
// barredor la tira al cerrarse la ventana): es justo al que hay que dar
// de baja para que no entre en el pareo de la ronda siguiente.
export function sinCheckin({ ronda, mesas, reportes = [], inscripciones = [] }) {
  if (!ronda || ronda.status !== 'active' || !ronda.started_at) return []
  const reporto = new Set((reportes || []).map((r) => `${r.match_id}:${r.reporter_id}`))
  const inscripcionDe = new Map((inscripciones || []).map((i) => [i.user_id, i]))
  const faltan = []
  for (const m of mesas || []) {
    if (m.round_id !== ronda.id || !esMesaDeVerdad(m) || m.status === 'finished') continue
    const lados = [
      { id: m.player_a_id, listo: m.check_in_a_at, rival: m.player_b_id, cae: 'forfeit_a' },
      { id: m.player_b_id, listo: m.check_in_b_at, rival: m.player_a_id, cae: 'forfeit_b' },
    ]
    for (const l of lados) {
      if (l.listo || reporto.has(`${m.id}:${l.id}`)) continue
      const insc = inscripcionDe.get(l.id)
      if (!insc || insc.status !== 'active') continue
      faltan.push({
        userId: l.id,
        inscripcionId: insc.id,
        mesa: m.table_number,
        partidaId: m.id,
        rivalId: l.rival,
        // Su mesa ya ha caído por no presentarse (él solo, o los dos).
        noSePresento: m.status === l.cae || m.status === 'forfeit_both',
      })
    }
  }
  return faltan.sort((a, b) => (a.mesa ?? 0) - (b.mesa ?? 0))
}
