// Tanda 971 — en una liga, cada jornada se empareja de cero (opción A).
//
// PINGU: «uno dice: siempre que me toca con los buenos. Yo creo que cada
// jornada debería ser individual y empezar aleatoriamente y luego ya que
// paree como sea». Antes solo la ronda 1 de la LIGA iba al azar; todo lo
// demás, por los puntos de la liga entera y sin repetir rival nunca.
//
// Se juega una liga de 8 con tres rondas por jornada con el motor de verdad
// y `snapshotDeJornada`, y se mira: la ronda 1 de cada jornada no depende de
// la clasificación, la 2 y la 3 van por los puntos de la jornada, no se
// repite rival dentro de la jornada (entre jornadas puede), los retirados no
// vuelven, y la clasificación de la liga sigue sumando todo.
import { readFileSync } from 'node:fs'

const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const { snapshotDeJornada } = await import(`${RAIZ}/js/torneos/rondas-jornada.js`)
const { pairRound1, pairSwissRound, computeStandings, pairKey } = await import(`${RAIZ}/js/torneos/motor.js`)

const LIGA = { format: 'league', swiss_rounds: 9, rounds_per_matchday: 3 }
const JUG = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
// Gana siempre el de letra menor: así «los buenos» son a, b, c… y se ve si
// la jornada nueva los vuelve a juntar.
const gana = (x, y) => (x < y ? 'a_wins' : 'b_wins')

function parear(snap, n) {
  const dj = snapshotDeJornada(LIGA, snap, n)
  return dj.ronda === 1 ? { ...pairRound1(dj.snapshot), dj } : { ...pairSwissRound({ snapshot: dj.snapshot, roundNumber: dj.ronda, history: dj.historial }), dj }
}
function jugar(snap, n, plan) {
  for (const p of plan.pairings) snap.matches.push({ roundNumber: n, tableNumber: p.tableNumber, playerAId: p.playerAId, playerBId: p.playerBId, outcome: gana(p.playerAId, p.playerBId), finishedAt: null })
  if (plan.byePlayerId) snap.matches.push({ roundNumber: n, tableNumber: 99, playerAId: plan.byePlayerId, playerBId: null, outcome: 'bye', finishedAt: null })
}
const nuevo = () => ({ pairingSeed: 'semilla-liga', currentRoundNumber: 1, players: JUG.map((id) => ({ id, dropped: false, droppedAfterRoundNumber: null })), matches: [] })

console.log('── 1. Lo puro ──')
{
  const s = nuevo()
  s.matches.push({ roundNumber: 1, playerAId: 'a', playerBId: 'b', outcome: 'a_wins' }, { roundNumber: 3, playerAId: 'c', playerBId: 'd', outcome: 'a_wins' }, { roundNumber: 4, playerAId: 'e', playerBId: 'f', outcome: 'a_wins' })
  const dj = snapshotDeJornada(LIGA, s, 5)
  check('la ronda 5 es la 2 de la jornada 2', dj.ronda === 2 && dj.snapshot.currentRoundNumber === 2)
  check('  …y el motor solo ve lo de la jornada 2, renumerado (la 4 es su ronda 1)', dj.snapshot.matches.length === 1 && dj.snapshot.matches[0].roundNumber === 1 && dj.snapshot.matches[0].playerAId === 'e', JSON.stringify(dj.snapshot.matches))
  check('  …con los cruces de la jornada y nada más', [...dj.historial].join() === pairKey('e', 'f'))
  check('  …y una semilla por jornada (el azar de cada jornada es otro)', dj.snapshot.pairingSeed === 'semilla-liga:jornada:2' && snapshotDeJornada(LIGA, s, 7).snapshot.pairingSeed === 'semilla-liga:jornada:3')
  const conBaja = { ...s, players: [{ id: 'a', dropped: true, droppedAfterRoundNumber: 2 }, { id: 'b', dropped: true, droppedAfterRoundNumber: 4 }, { id: 'c', dropped: false, droppedAfterRoundNumber: null }] }
  const p = snapshotDeJornada(LIGA, conBaja, 5).snapshot.players
  check('un retirado en la jornada 1 no juega la 2 (0); uno retirado tras su ronda 1, tras la 1', p[0].droppedAfterRoundNumber === 0 && p[1].droppedAfterRoundNumber === 1 && p[2].droppedAfterRoundNumber === null, JSON.stringify(p))
  check('  …y no toca el snapshot de la clasificación', s.matches.length === 3 && s.pairingSeed === 'semilla-liga')
}

console.log('\n── 2. Una liga entera, jornada a jornada ──')
{
  const s = nuevo()
  for (let n = 1; n <= 3; n++) jugar(s, n, parear(s, n))
  const clasif = computeStandings(s, s.players).map((e) => e.playerId)
  check('tras la jornada 1, «los buenos» van arriba (a el primero, h el último)', clasif[0] === 'a' && clasif.at(-1) === 'h', clasif.join())
  // La ronda 1 de la jornada 2: exactamente la del azar de su jornada, sin
  // mirar la clasificación.
  const p4 = parear(s, 4)
  const azar = pairRound1({ ...s, pairingSeed: 'semilla-liga:jornada:2', matches: [] })
  const sinOrden = (pl) => pl.pairings.map((x) => pairKey(x.playerAId, x.playerBId)).sort().join()
  check('la ronda 1 de la jornada 2 es al azar (no depende de los puntos de la liga)', sinOrden(p4) === sinOrden(azar), `${sinOrden(p4)} | ${sinOrden(azar)}`)
  const antes = pairSwissRound({ snapshot: s, roundNumber: 4, history: new Set(s.matches.filter((m) => m.playerBId).map((m) => pairKey(m.playerAId, m.playerBId))) })
  check('  …y no es lo que daba antes (a contra b, los dos de arriba)', !p4.pairings.some((x) => pairKey(x.playerAId, x.playerBId) === pairKey('a', 'b')) || sinOrden(p4) !== sinOrden(antes), sinOrden(antes))
  jugar(s, 4, p4)
  const p5 = parear(s, 5)
  const ganadores4 = new Set(p4.pairings.map((x) => (x.playerAId < x.playerBId ? x.playerAId : x.playerBId)))
  const mesasDeGanadores = p5.pairings.filter((x) => ganadores4.has(x.playerAId) && ganadores4.has(x.playerBId)).length
  check('la ronda 2 de la jornada empareja por los puntos DE LA JORNADA (ganadores con ganadores)', mesasDeGanadores === 2, `${mesasDeGanadores} mesas de ganadores · ${sinOrden(p5)}`)
  const cruces4 = new Set(p4.pairings.map((x) => pairKey(x.playerAId, x.playerBId)))
  check('  …sin repetir rival de la jornada', p5.pairings.every((x) => !cruces4.has(pairKey(x.playerAId, x.playerBId))))
  jugar(s, 5, p5)
  jugar(s, 6, parear(s, 6))
  const j2 = s.matches.filter((m) => m.roundNumber >= 4 && m.roundNumber <= 6 && m.playerBId).map((m) => pairKey(m.playerAId, m.playerBId))
  check('en toda la jornada 2 nadie repite rival', new Set(j2).size === j2.length, j2.join())
  const j1 = new Set(s.matches.filter((m) => m.roundNumber <= 3 && m.playerBId).map((m) => pairKey(m.playerAId, m.playerBId)))
  for (let n = 7; n <= 9; n++) jugar(s, n, parear(s, n))
  const otraVez = s.matches.filter((m) => m.roundNumber >= 4 && m.playerBId).some((m) => j1.has(pairKey(m.playerAId, m.playerBId)))
  check('de una jornada a otra SÍ puede repetirse (no se arrastra el historial de la liga)', otraVez)
  const total = computeStandings(s, s.players)
  check('la clasificación de la liga suma las nueve rondas', total.reduce((t, e) => t + e.matchPoints, 0) === 9 * 4 * 3 && total[0].playerId === 'a', JSON.stringify(total.slice(0, 2).map((e) => [e.playerId, e.matchPoints])))
}

console.log('\n── 3. Con número impar y una baja ──')
{
  const s = nuevo()
  s.players.push({ id: 'i', dropped: false, droppedAfterRoundNumber: null })
  for (let n = 1; n <= 3; n++) jugar(s, n, parear(s, n))
  s.players.find((p) => p.id === 'h').dropped = true
  s.players.find((p) => p.id === 'h').droppedAfterRoundNumber = 3
  const p4 = parear(s, 4)
  const sentados = p4.pairings.flatMap((x) => [x.playerAId, x.playerBId])
  check('quien se retiró en la jornada 1 no se sienta en la 2', !sentados.includes('h') && p4.byePlayerId !== 'h')
  check('  …y los 8 que quedan se sientan en 4 mesas, sin bye', p4.pairings.length === 4 && !p4.byePlayerId, JSON.stringify(p4))
}

console.log('\n── 4. La ronda lo usa solo en las ligas ──')
{
  const ronda = readFileSync(`${RAIZ}/js/torneos/ronda.js`, 'utf8')
  check('emparejar en una liga pasa por snapshotDeJornada', /const deJornada = esLiga\(\) \? snapshotDeJornada\(ctx\.torneo, montarSnapshot\(n\), n\) : null/.test(ronda))
  check('  …con su ronda y sus cruces; fuera de una liga, el suizo y el historial de siempre', /plan = k === 1 \? pairRound1\(snapshot\) : pairSwissRound\(\{ snapshot, roundNumber: k, history: deJornada \? deJornada\.historial : historialSet\(\) \}\)/.test(ronda) && /if \(!deJornada && n > 1\) await cargarHistorial\(\)/.test(ronda))
  check('la clasificación no pasa por la jornada (computeStandings sobre montarSnapshot)', !/computeStandings\([^)]*snapshotDeJornada/.test(ronda))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
