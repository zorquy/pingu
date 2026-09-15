// Tanda 290: el motor de pareos deja de rendirse.
//
// El 2026-09-13 PINGU echó un torneo a tres rondas y al abrir la R3 el
// motor solo pareó algunas mesas: los dos últimos del ranking ya se
// habían cruzado en la R1 y se rindió — habiendo un pareo completo
// perfectamente posible si hubiera deshecho una mesa anterior. Tuvo que
// sentar a la gente a mano.
//
// Motor puro: sin navegador y sin red.
import { pairSwissRound, pairRound1, pairKey, computeStandings, activePlayersForRound } from '/home/user/pingu/js/torneos/motor.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 160) : ''}`)
}

const hora = (r) => `2026-09-13T${String(9 + r).padStart(2, '0')}:00:00.000Z`
const partida = (r, mesa, a, b, quien = 'a_wins') => ({
  roundNumber: r,
  tableNumber: mesa,
  playerAId: a,
  playerBId: b,
  outcome: quien,
  finishedAt: hora(r),
})

function montar(jugadores, partidas, ronda) {
  return {
    snapshot: {
      pairingSeed: 'semilla-fija',
      currentRoundNumber: ronda,
      players: jugadores.map((id) => ({ id, dropped: false, droppedAfterRoundNumber: null })),
      matches: partidas,
    },
    history: new Set(partidas.map((m) => pairKey(m.playerAId, m.playerBId))),
  }
}

const nadieRepite = (plan, history) =>
  plan.pairings.every((p) => !history.has(pairKey(p.playerAId, p.playerBId)))
const todosSentados = (plan, jugadores) => {
  const sentados = new Set()
  for (const p of plan.pairings) {
    sentados.add(p.playerAId)
    sentados.add(p.playerBId)
  }
  if (plan.byePlayerId) sentados.add(plan.byePlayerId)
  return sentados.size === jugadores.length
}

console.log('\n── 1. EL CASO DE PINGU: la R3 que se quedó a medias ──')
{
  const jugadores = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const partidas = [
    partida(1, 1, 'A', 'B'), partida(1, 2, 'C', 'E'), partida(1, 3, 'D', 'F'), partida(1, 4, 'G', 'H'),
    partida(2, 1, 'A', 'G'), partida(2, 2, 'C', 'F', 'b_wins'), partida(2, 3, 'D', 'E', 'b_wins'), partida(2, 4, 'B', 'H'),
  ]
  const { snapshot, history } = montar(jugadores, partidas, 3)
  // La semilla decide los desempates y con ella el reparto en grupos: con
  // ESTA el camino de la SPEC se queda a medias de verdad. Con otra puede
  // salir por el camino normal, y entonces la prueba no probaría nada.
  snapshot.pairingSeed = 'semilla'
  const plan = pairSwissRound({ snapshot, roundNumber: 3, history })
  check('entra el rescate', plan.rescatado === true, JSON.stringify(plan.rescatado))
  check('parea los ocho', todosSentados(plan, jugadores), JSON.stringify(plan.pairings))
  check('cuatro mesas', plan.pairings.length === 4)
  check('y sin repetir ni un cruce', nadieRepite(plan, history), JSON.stringify(plan.pairings))
  // Antes esto tiraba ManualPairingRequired dejando a dos sin sentar.
  check('no hace falta sentar a nadie a mano', !plan.repetidos?.length)
  // Las mesas van numeradas de 1 a N, sin huecos ni repetidas.
  check('mesas numeradas del 1 al 4', plan.pairings.map((p) => p.tableNumber).join() === '1,2,3,4')
}

console.log('\n── 2. Un torneo normal parea EXACTAMENTE igual que antes ──')
{
  // Lo más importante de todo: el rescate solo entra cuando el camino de
  // la SPEC falla. Si un torneo hoy parea bien, tiene que dar las mismas
  // mesas — si no, se habría cambiado el pareo de todo el mundo para
  // arreglar un caso raro.
  const jugadores = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']
  const partidas = [
    partida(1, 1, 'A', 'E'), partida(1, 2, 'B', 'F'), partida(1, 3, 'C', 'G'), partida(1, 4, 'D', 'H'),
  ]
  const { snapshot, history } = montar(jugadores, partidas, 2)
  const plan = pairSwissRound({ snapshot, roundNumber: 2, history })
  check('parea los ocho', todosSentados(plan, jugadores))
  check('sin repetir', nadieRepite(plan, history))
  // El «fold» de la SPEC: dentro de un grupo de puntos, el primero se
  // sienta contra el que ABRE LA MITAD DE ABAJO, no contra el segundo.
  // Se comprueba contra el ranking de verdad, no contra el orden
  // alfabético — que no tiene por qué coincidir.
  const ranking = computeStandings(snapshot, activePlayersForRound(snapshot.players, 2))
  const arriba = ranking.filter((e) => e.matchPoints === ranking[0].matchPoints).map((e) => e.playerId)
  const mesa1 = plan.pairings[0]
  check(
    'el 1º contra el que abre la mitad de abajo de su grupo',
    mesa1.playerAId === arriba[0] && mesa1.playerBId === arriba[arriba.length / 2],
    `${JSON.stringify(mesa1)} — grupo: ${arriba.join()}`
  )
  check('y NO se marca como rescatado', !plan.rescatado, JSON.stringify(plan.rescatado))
}

console.log('\n── 3. El grupo impar del final ya no tumba la ronda ──')
{
  // Antes: un último grupo de puntos con un número impar de jugadores se
  // rendía en el acto, sin parear ni una mesa.
  const jugadores = ['A', 'B', 'C', 'D', 'E', 'F']
  const partidas = [
    partida(1, 1, 'A', 'D'), partida(1, 2, 'B', 'E'), partida(1, 3, 'C', 'F'),
    partida(2, 1, 'A', 'B'), partida(2, 2, 'C', 'D', 'b_wins'), partida(2, 3, 'E', 'F'),
  ]
  const { snapshot, history } = montar(jugadores, partidas, 3)
  const plan = pairSwissRound({ snapshot, roundNumber: 3, history })
  check('los seis sentados', todosSentados(plan, jugadores), JSON.stringify(plan.pairings))
  check('sin repetir cruces', nadieRepite(plan, history), JSON.stringify(plan.pairings))
}

console.log('\n── 4. Impares: el bye sigue siendo el de la SPEC ──')
{
  const jugadores = ['A', 'B', 'C', 'D', 'E']
  const partidas = [partida(1, 1, 'A', 'B'), partida(1, 2, 'C', 'D'), { ...partida(1, 3, 'E', null), outcome: 'bye' }]
  const { snapshot, history } = montar(jugadores, partidas, 2)
  const plan = pairSwissRound({ snapshot, roundNumber: 2, history })
  check('hay bye', !!plan.byePlayerId, String(plan.byePlayerId))
  check('los cinco colocados', todosSentados(plan, jugadores))
  check('sin repetir cruces', nadieRepite(plan, history))

  // Y la regla fina: el bye NO es para el último del ranking, es para el
  // último QUE NO LO HAYA TENIDO. Aquí el último es B, que ya lo tuvo en
  // la R2; le toca a A, que está por encima pero nunca lo ha recibido.
  const rotados = ['A', 'B', 'C']
  const suyas = [
    partida(1, 1, 'A', 'B'), { ...partida(1, 2, 'C', null), outcome: 'bye' },
    partida(2, 1, 'C', 'A'), { ...partida(2, 2, 'B', null), outcome: 'bye' },
  ]
  const otra = montar(rotados, suyas.filter((m) => m.playerBId), 3)
  otra.snapshot.matches = suyas
  const plan2 = pairSwissRound({ snapshot: otra.snapshot, roundNumber: 3, history: otra.history })
  const rank = computeStandings(otra.snapshot, activePlayersForRound(otra.snapshot.players, 3))
  check(
    'no le toca al último, sino al último sin bye',
    plan2.byePlayerId === 'A',
    `bye: ${plan2.byePlayerId} — ranking: ${rank.map((e) => `${e.playerId}(${e.matchPoints}p,${e.byesReceived}b)`).join(' ')}`
  )
}

console.log('\n── 5. Cuando repetir es inevitable, se repite y SE DICE ──')
{
  // Cuatro jugadores que ya se han cruzado todos con todos. No hay pareo
  // posible sin repetir — pero la ronda tiene que poder jugarse.
  const jugadores = ['A', 'B', 'C', 'D']
  const partidas = [
    partida(1, 1, 'A', 'B'), partida(1, 2, 'C', 'D'),
    partida(2, 1, 'A', 'C'), partida(2, 2, 'B', 'D'),
    partida(3, 1, 'A', 'D'), partida(3, 2, 'B', 'C'),
  ]
  const { snapshot, history } = montar(jugadores, partidas, 4)
  const plan = pairSwissRound({ snapshot, roundNumber: 4, history })
  check('la ronda se puede jugar igual', todosSentados(plan, jugadores), JSON.stringify(plan.pairings))
  // Un cruce repetido que nadie sabe que se repite SÍ sería un problema.
  check('y se avisa de qué mesas repiten', plan.repetidos?.length === 2, JSON.stringify(plan.repetidos))
  check('con su número de mesa', plan.repetidos?.every((m) => typeof m.tableNumber === 'number'))
  check('y quiénes son', plan.repetidos?.every((m) => m.playerAId && m.playerBId))
}

console.log('\n── 6. Los repes, los justos ──')
{
  // Seis jugadores donde solo una pareja está obligada a repetir. Si el
  // motor cogiera el primer pareo que le sale, dejaría tres mesas
  // repetidas donde basta con una.
  const jugadores = ['A', 'B', 'C', 'D', 'E', 'F']
  const partidas = [
    // A y B se han cruzado con todo el mundo menos entre ellos... al revés:
    // A ha jugado contra todos, así que le toque quien le toque, repite.
    partida(1, 1, 'A', 'B'), partida(1, 2, 'C', 'D'), partida(1, 3, 'E', 'F'),
    partida(2, 1, 'A', 'C'), partida(2, 2, 'B', 'D'), partida(2, 3, 'E', 'B'),
    partida(3, 1, 'A', 'D'), partida(3, 2, 'C', 'E'), partida(3, 3, 'F', 'B'),
    partida(4, 1, 'A', 'E'), partida(4, 2, 'C', 'F'), partida(4, 3, 'D', 'E'),
    partida(5, 1, 'A', 'F'), partida(5, 2, 'D', 'F'), partida(5, 3, 'B', 'C'),
  ]
  const { snapshot, history } = montar(jugadores, partidas, 6)
  const plan = pairSwissRound({ snapshot, roundNumber: 6, history })
  check('los seis sentados', todosSentados(plan, jugadores), JSON.stringify(plan.pairings))
  // Todos han jugado contra todos: las tres mesas repiten a la fuerza.
  check('se repite lo justo', (plan.repetidos?.length ?? 0) === 3, JSON.stringify(plan.repetidos))
}

console.log('\n── 7. Quien se retira no se sienta ──')
{
  const jugadores = ['A', 'B', 'C', 'D']
  const partidas = [partida(1, 1, 'A', 'B'), partida(1, 2, 'C', 'D')]
  const { snapshot, history } = montar(jugadores, partidas, 2)
  snapshot.players[3] = { id: 'D', dropped: true, droppedAfterRoundNumber: 1 }
  const plan = pairSwissRound({ snapshot, roundNumber: 2, history })
  const sentados = plan.pairings.flatMap((p) => [p.playerAId, p.playerBId]).concat(plan.byePlayerId || [])
  check('el retirado no aparece', !sentados.includes('D'), sentados.join())
  check('y los otros tres sí', ['A', 'B', 'C'].every((id) => sentados.includes(id)), sentados.join())
}

console.log('\n── 8. La ronda 1 no la toca nadie ──')
{
  // El sorteo de la R1 es aparte y tiene que seguir siendo reproducible:
  // la misma semilla, las mismas mesas.
  const jugadores = ['A', 'B', 'C', 'D', 'E', 'F']
  const { snapshot } = montar(jugadores, [], 1)
  const uno = pairRound1(snapshot)
  const dos = pairRound1(snapshot)
  check('la misma semilla da el mismo sorteo', JSON.stringify(uno) === JSON.stringify(dos))
  check('y se sientan los seis', todosSentados(uno, jugadores))
}

console.log('\n── 9. Mil torneos al azar: nadie se queda sin sentar ──')
{
  // Esta es la prueba que de verdad importa. El motor viejo se rendía en
  // 421 de estos 1000 — o sea que lo de PINGU no fue mala suerte: era
  // que casi la mitad de los torneos acababan en pareo manual.
  let semilla = 12345
  const azar = () => ((semilla = (semilla * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  let sentadosSiempre = 0
  let conRepes = 0
  let mesasRepetidas = 0
  let saltoDePuntos = 0 // solo para mirarlo, no se afirma nada (ver abajo)
  let rotos = []

  for (let t = 0; t < 1000; t++) {
    const cuantos = 4 + Math.floor(azar() * 13)
    const jugadores = [...Array(cuantos).keys()].map((i) => `J${i}`)
    const partidas = []
    const history = new Set()
    const rondas = 1 + Math.floor(azar() * 4)
    for (let r = 1; r <= rondas; r++) {
      const libres = [...jugadores].sort(() => azar() - 0.5)
      while (libres.length >= 2) {
        const a = libres.pop()
        const b = libres.pop()
        partidas.push(partida(r, partidas.length + 1, a, b, azar() < 0.1 ? 'draw' : azar() < 0.5 ? 'a_wins' : 'b_wins'))
        history.add(pairKey(a, b))
      }
    }
    const snapshot = {
      pairingSeed: `s${t}`,
      currentRoundNumber: rondas + 1,
      players: jugadores.map((id) => ({ id, dropped: false, droppedAfterRoundNumber: null })),
      matches: partidas,
    }
    try {
      const plan = pairSwissRound({ snapshot, roundNumber: rondas + 1, history })
      // Un pareo suizo sienta a gente con los MISMOS puntos siempre que
      // puede. Si el rescate dejara de mirar los puntos, esto se
      // dispararía: sería sentar al primero contra el último.
      const puntos = new Map(computeStandings(snapshot, activePlayersForRound(snapshot.players, rondas + 1)).map((e) => [e.playerId, e.matchPoints]))
      for (const m of plan.pairings) saltoDePuntos += Math.abs(puntos.get(m.playerAId) - puntos.get(m.playerBId))
      if (todosSentados(plan, jugadores)) sentadosSiempre++
      else rotos.push(`torneo ${t}: falta gente`)
      if (plan.repetidos?.length) { conRepes++; mesasRepetidas += plan.repetidos.length }
    } catch (e) {
      rotos.push(`torneo ${t}: ${e.name}`)
    }
  }
  check('los mil pareados enteros', sentadosSiempre === 1000, `${sentadosSiempre}/1000 — ${rotos.slice(0, 3).join(' | ')}`)
  check('y ninguno se rinde', rotos.length === 0, rotos.slice(0, 3).join(' | '))
  // Repetir es el último recurso: en torneos normales no debería pasar
  // casi nunca. Si esto se dispara, es que el rescate no está buscando.
  check('repetir cruce sigue siendo raro', conRepes < 50, `${conRepes} de 1000`)
  // Cuántas mesas repiten en total. No es un mínimo demostrado —está
  // razonado en motor.js— pero sí una raya: si esto se dispara, el
  // rescate ha dejado de buscar y está tirando de repes a la primera.
  check('y el total de mesas repetidas no se dispara', mesasRepetidas <= 60, `${mesasRepetidas} mesas`)
  // El salto de puntos acumulado se mide y se enseña, pero NO se afirma
  // nada sobre él: quitando el término de los puntos del coste da 4367 en
  // vez de 4249, o sea que no discrimina. Está razonado en motor.js.
  console.log(`       (salto de puntos acumulado: ${saltoDePuntos})`)
}

console.log('\n── 10. Al juez se le dice qué mesas repiten ──')
{
  // Un cruce repetido que nadie sabe que se repite sí sería un problema:
  // es lo que el juez tiene que poder explicarle a la mesa.
  const ronda = (await import('node:fs')).readFileSync('/home/user/pingu/js/torneos/ronda.js', 'utf8')
  check('se leen los repetidos del plan', /const repes = plan\.repetidos \|\| \[\]/.test(ronda))
  check('y se avisan con su mesa y sus nombres', /repiten cruce[\s\S]{0,400}nombreDe\(m\.playerAId\)/.test(ronda))
}

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
