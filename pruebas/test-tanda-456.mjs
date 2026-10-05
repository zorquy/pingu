// Tanda 456 — el laboratorio, a dos: «tú contra ti» con dos mazos, y una
// mesa que se juega con un clic.
//
// PINGU, con tcgmasters.net de referencia: «quiero incluso poder jugar
// una partida en el laboratorio tú contra ti mismo con los 2 mazos que
// quieras […] que sigas pudiendo jugar con un muñeco de pruebas, la
// pestaña de probabilidades que siempre tengas la opción de verla», y
// «si hacemos clic izquierdo en el Pokémon fase 1 se evolucionará a uno
// de los básicos donde pueda evolucionar, lo seleccionaría el usuario
// haciendo clic en el básico; si haces clic derecho ves la carta».
//
// Lo que se prueba:
//   1. La MESA (partida.js): dos jugadores de verdad con sus cartas, sus
//      premios al dejar KO, debilidad y resistencia, el estadio de los
//      dos, deshacer de los dos lados a la vez, y quien no puede robar
//      pierde.
//   2. Las cartas que tocan al rival (efectos.js), contra un rival que
//      ahora sí tiene mano y energías.
//   3. Partidas enteras al azar: ninguna carta se pierde, se duplica ni
//      se cuela en las zonas del otro.
//   4. La pantalla: elegir el modo y el mazo del otro, quién empieza,
//      jugar con un clic (y elegir dónde tocando el Pokémon que brilla),
//      ver la carta con el clic derecho, el panel siempre a mano, el
//      móvil y los dos temas.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = process.env.BASE || 'http://localhost:8892'

const M = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const { plano } = await import(`${RAIZ}/js/constructor/nucleo.js`)
const { Mesa, Partida, esPokemon, faseDe, contextoDeProbabilidad, premiosQueDa } = M

const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}
const mazo = (lista) => lista.map(([n, nombre]) => ({ carta: fila(nombre), n }))

const DRAGAPULT = [
  [4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Budew'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Munkidori'], [1, 'Moltres'],
  [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [3, 'Ultra Ball'],
  [4, 'Crushing Hammer'], [2, 'Crispin'], [2, 'Risky Ruins'], [1, 'Dawn'], [1, 'Judge'], [1, "Rosa's Encouragement"], [1, 'Special Red Card'], [1, 'Unfair Stamp'],
  [3, 'Fire Energy'], [3, 'Psychic Energy'], [2, 'Darkness Energy'],
]
const ALAKAZAM = [
  [4, 'Abra'], [3, 'Kadabra'], [3, 'Alakazam'], [2, 'Dunsparce'], [2, 'Dudunsparce'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [1, 'Psyduck'],
  [4, "Lillie's Determination"], [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [3, 'Rare Candy'], [3, 'Ultra Ball'], [3, 'Night Stretcher'], [2, "Boss's Orders"],
  [1, 'Dawn'], [1, 'Hilda'], [2, 'Wondrous Patch'], [1, 'Secret Box'], [1, 'Battle Cage'], [2, 'Pokégear 3.0'], [1, 'Enhanced Hammer'], [1, "Hero's Cape"],
  [8, 'Psychic Energy'], [2, 'Enriching Energy'],
]
const KANGASKHAN = [
  [3, 'Mega Kangaskhan ex'], [2, 'Latias ex'], [2, 'Moltres'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Shaymin'], [2, 'Chien-Pao'], [1, 'Yveltal'],
  [4, "Lillie's Determination"], [4, 'Poké Pad'], [3, 'Ultra Ball'], [3, "Boss's Orders"], [2, 'Switch'], [2, 'Air Balloon'], [3, 'Night Stretcher'],
  [2, "Black Belt's Training"], [2, 'Kieran'], [1, 'Maximum Belt'], [2, 'Brave Bangle'], [2, 'Crispin'], [2, 'Judge'], [1, "Team Rocket's Watchtower"],
  [4, 'Prism Energy'], [4, 'Fire Energy'], [3, 'Darkness Energy'], [2, 'Legacy Energy'],
]
// Dos mazos cortos y conocidos para montar situaciones a mano.
const DRAG = [[4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [4, 'Budew'], [4, "Boss's Orders"], [4, 'Judge'], [4, 'Risky Ruins'], [4, 'Crushing Hammer'], [3, 'Fire Energy'], [10, 'Psychic Energy'], [16, 'Poké Pad']]
const ALA = [[4, 'Abra'], [3, 'Kadabra'], [3, 'Alakazam'], [4, 'Dunsparce'], [4, 'Battle Cage'], [4, "Boss's Orders"], [4, 'Enhanced Hammer'], [4, "Xerosic's Machinations"], [4, 'Psychic Energy'], [26, 'Poké Pad']]

// Un `ui` de guion: elige lo primero que valga, siempre.
const uiGuion = (mesa) => ({
  async cartas(o) {
    const pool = o.elegibles || o.opciones
    const sel = []
    for (const u of pool) {
      if (sel.length >= o.max) break
      if (!o.validar || !o.validar([...sel, u])) sel.push(u)
    }
    for (const u of o.opciones) if (sel.length < o.min && !sel.includes(u)) sel.push(u)
    return sel.slice(0, o.max)
  },
  async pokemon(o) { return o.opciones.slice(0, Math.max(o.min, Math.min(o.max, 1))) },
  async confirmar() { return true },
  async opcion(o) { return o.opciones.find((x) => !x.no).id },
  async numero(o) { return o.valor },
  async repartir(o) { return { [o.opciones[0]]: o.total } },
  async premios(o) { return (o.partida || mesa.actual).s.premios.slice(0, o.n) },
})
// Traer una carta a la mano (para montar la situación sin depender del
// reparto).
const trae = (p, n) => {
  const u = p.s.mazo.find((x) => p.carta(x).name === n) || p.s.premios.find((x) => p.carta(x).name === n)
  if (!u) throw new Error(`no hay ${n}`)
  if (p.s.mazo.includes(u)) p.sacarDelMazo(u)
  else p.s.premios = p.s.premios.filter((x) => x !== u)
  p.s.mano.push(u)
  return u
}
async function montada({ semilla = 3, empieza = 0, mazos = [DRAG, ALA] } = {}) {
  const mesa = new Mesa({ mazos: mazos.map(mazo), efectos: EFECTOS, semilla, empieza })
  const u = uiGuion(mesa)
  mesa.repartir()
  for (let k = 0; k < 2; k++) {
    const p = mesa.actual
    const b = p.s.mano.filter((x) => esPokemon(p.carta(x)) && faseDe(p.carta(x)) === 0)
    p.colocar(b[0], 'activo')
    await mesa.accion(() => mesa.listo(u), u)
  }
  return { mesa, u, a: mesa.jugadores[0], b: mesa.jugadores[1] }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. La mesa: dos jugadores de verdad ──')
{
  const { mesa, a, b } = await montada({ empieza: 0 })
  check('empieza J1: su turno, y J2 espera', mesa.actual === a && a.s.fase === 'turno' && b.s.fase === 'espera')
  check('los dos con 6 premios', a.s.premios.length === 6 && b.s.premios.length === 6)
  check('quien va primero no ataca en su turno 1', /primer turno/.test(a.motivoNoAtacar(a.s.activo, a.cartaDe(a.s.activo).attacks?.[0]) || ''))
  check('las cartas de cada uno llevan su prefijo', [...a.uidsPropios].every((x) => x.startsWith('a')) && [...b.uidsPropios].every((x) => x.startsWith('b')))
  check('  …y los huecos también', a.s.activo.id.startsWith('a') && b.s.activo.id.startsWith('b'))
  // Las probabilidades de cada uno salen de SU mazo y SUS premios.
  const ca = contextoDeProbabilidad(a)
  const cb = contextoDeProbabilidad(b)
  check('las probabilidades de cada jugador cuentan su mazo', ca.D === a.s.mazo.length && cb.D === b.s.mazo.length, `${ca.D}/${a.s.mazo.length} · ${cb.D}/${b.s.mazo.length}`)
}
{
  // Quién empieza: fijo, y cambiándolo mientras se prepara.
  const m1 = new Mesa({ mazos: [mazo(DRAG), mazo(ALA)], efectos: EFECTOS, semilla: 5, empieza: 1 })
  m1.repartir()
  check('«empieza J2»: prepara primero J2, y J2 va primero', m1.actual === m1.jugadores[1] && m1.jugadores[1].s.vaPrimero && !m1.jugadores[0].s.vaPrimero)
  m1.ponerPrimero(0)
  check('cambiarlo en la preparación', m1.m.primero === 0 && m1.jugadores[0].s.vaPrimero && !m1.jugadores[1].s.vaPrimero)
  const u = uiGuion(m1)
  for (let k = 0; k < 2; k++) {
    const p = m1.actual
    p.colocar(p.s.mano.find((x) => esPokemon(p.carta(x)) && faseDe(p.carta(x)) === 0), 'activo')
    await m1.accion(() => m1.listo(u), u)
  }
  check('  …y empieza el que se dijo', m1.actual === m1.jugadores[0] && m1.jugadores[0].s.fase === 'turno')
  m1.ponerPrimero(1)
  check('  …pero empezada la partida ya no se cambia', m1.m.primero === 0)
  // Con el muñeco, lo mismo: ir primero o segundo en la preparación.
  const solo = new Partida({ entradas: mazo(DRAG), efectos: EFECTOS, semilla: 4, vaPrimero: false })
  solo.repartir()
  solo.ponerVaPrimero(true)
  check('contra el muñeco: elegir ir primero en la preparación', solo.s.vaPrimero === true)
  solo.colocar(solo.s.mano.find((x) => esPokemon(solo.carta(x)) && faseDe(solo.carta(x)) === 0), 'activo')
  solo.empezar()
  solo.ponerVaPrimero(false)
  check('  …y ya empezada no cambia', solo.s.vaPrimero === true)
  const sinListo = new Mesa({ mazos: [mazo(DRAG), mazo(ALA)], efectos: EFECTOS, semilla: 6, empieza: 0 })
  sinListo.repartir()
  let error = null
  await sinListo.accion(() => sinListo.listo(uiGuion(sinListo))).catch((e) => (error = e))
  check('«listo» sin activo: no, y dice por qué', error?.noSePuede && /activo/.test(error.message), error?.message)
}

console.log('\n── 1.2. Un ataque que deja KO ──')
{
  const { mesa, u, a, b } = await montada({ empieza: 1, semilla: 9 })
  await mesa.accion(() => b.pasarTurno(u), u)
  check('pasar el turno: ahora juega J1', mesa.actual === a && a.s.fase === 'turno' && b.s.fase === 'espera')
  const drag = a.s.mazo.find((x) => a.carta(x).name === 'Dragapult ex') || a.s.premios.find((x) => a.carta(x).name === 'Dragapult ex')
  if (a.s.mazo.includes(drag)) a.sacarDelMazo(drag)
  else a.s.premios = a.s.premios.filter((x) => x !== drag)
  a.s.activo.cartas.push(drag)
  const fuego = trae(a, 'Fire Energy')
  const psi = trae(a, 'Psychic Energy')
  a.s.mano = a.s.mano.filter((x) => x !== fuego && x !== psi)
  a.s.activo.energias.push(fuego, psi)
  const dun = b.s.mazo.find((x) => b.carta(x).name === 'Dunsparce')
  b.sacarDelMazo(dun)
  b.s.banca.push(b.nuevoSlot(dun))
  const victima = b.s.activo
  victima.danio = b.psDe(victima) - 10
  const danioAntes = victima.danio
  const premiosAntes = a.s.premios.length
  const manoAntes = a.s.mano.length
  const vale = premiosQueDa(b.cartaDe(victima))
  await mesa.accion(() => a.atacar(a.s.activo, 1, u), u)
  check('el Pokémon de J2 cae al descarte de J2 (no al de J1)', b.s.descarte.includes(victima.cartas[0]) && !a.s.descarte.includes(victima.cartas[0]))
  check(`J1 coge ${vale} premio(s) a su mano`, a.s.premios.length === premiosAntes - vale && a.s.mano.length === manoAntes + vale, `${a.s.premios.length} premios`)
  check('J2 sube uno de su banca', b.s.activo && b.cartaDe(b.s.activo).name === 'Dunsparce')
  check('para J2, eso pasó en el último turno de su rival', b.s.koUltimoTurnoRival === true)
  check('atacar pasa el turno a J2', mesa.actual === b && b.s.fase === 'turno')
  mesa.deshacer()
  check('deshacer devuelve los DOS lados: el activo de J2 y los premios de J1', b.s.activo?.cartas[0] === victima.cartas[0] && b.s.activo.danio === danioAntes && a.s.premios.length === premiosAntes)
  check('  …y el turno vuelve a J1', mesa.actual === a && a.s.fase === 'turno')
}

{
  // Un KO que no es de un ataque (el veneno, entre turnos): los premios
  // los coge el otro igual, y el de J2 sube uno de su banca.
  const { mesa, u, a, b } = await montada({ empieza: 0, semilla: 12 })
  const dun = b.s.mazo.find((x) => b.carta(x).name === 'Dunsparce')
  b.sacarDelMazo(dun)
  b.s.banca.push(b.nuevoSlot(dun))
  const victima = b.s.activo
  victima.danio = b.psDe(victima) - 10
  M.ponerEstado(victima, 'envenenado', b.s.turno)
  const vale = premiosQueDa(b.cartaDe(victima))
  const premiosAntes = a.s.premios.length
  await mesa.accion(() => a.pasarTurno(u), u)
  check('el veneno lo deja KO entre turnos: J1 coge su premio igual', a.s.premios.length === premiosAntes - vale && b.s.descarte.includes(victima.cartas[0]), `${a.s.premios.length}/${premiosAntes}`)
  check('  …y J2 sube uno de su banca antes de jugar', b.s.activo && b.cartaDe(b.s.activo).name === 'Dunsparce' && mesa.actual === b)
}

console.log('\n── 1.3. Debilidad y resistencia ──')
{
  const { a, b } = await montada({ empieza: 0, semilla: 30 })
  const ata = a.s.activo
  const def = b.s.activo
  const original = b.cartaDe(def)
  const tipo = a.cartaDe(ata).types?.[0]
  const uidDef = def.cartas.at(-1)
  b.cartas.set(uidDef, { ...original, weaknesses: [{ type: tipo, value: '×2' }], resistances: [] })
  check('debilidad ×2: el doble', a.debilidadYResistencia(ata, def, 60).total === 120)
  b.cartas.set(uidDef, { ...original, weaknesses: [{ type: tipo, value: '+30' }], resistances: [] })
  check('debilidad +30: treinta más', a.debilidadYResistencia(ata, def, 60).total === 90)
  b.cartas.set(uidDef, { ...original, weaknesses: [], resistances: [{ type: tipo, value: '-30' }] })
  check('resistencia −30', a.debilidadYResistencia(ata, def, 60).total === 30)
  check('  …sin bajar de cero', a.debilidadYResistencia(ata, def, 20).total === 0)
  const otro = tipo === 'Metal' ? 'Fire' : 'Metal'
  b.cartas.set(uidDef, { ...original, weaknesses: [{ type: otro, value: '×2' }], resistances: [] })
  check('la debilidad a otro tipo no cuenta', a.debilidadYResistencia(ata, def, 60).total === 60)
  b.cartas.set(uidDef, original)
}
{
  // Y en un ataque de verdad: Dreepy (Dragón) hace 10 con Petty Grudge.
  const golpe = async (cambio) => {
    const { mesa, u, a, b } = await montada({ empieza: 1, semilla: 31 })
    await mesa.accion(() => b.pasarTurno(u), u)
    const dre = a.s.mazo.find((x) => a.carta(x).name === 'Dreepy')
    a.sacarDelMazo(dre)
    a.s.mazo.push(a.s.activo.cartas[0])
    a.s.activo.cartas = [dre]
    a.s.activo.energias.push(trae(a, 'Psychic Energy'))
    a.s.mano.pop()
    const uidDef = b.s.activo.cartas.at(-1)
    b.cartas.set(uidDef, { ...b.carta(uidDef), ...cambio })
    const victima = b.s.activo
    await mesa.accion(() => a.atacar(a.s.activo, 0, u), u)
    return victima.danio
  }
  check('un ataque de verdad contra un Pokémon débil a Dragón: 10 × 2', (await golpe({ weaknesses: [{ type: 'Dragon', value: '×2' }], resistances: [] })) === 20)
  check('  …y contra uno que lo resiste: nada', (await golpe({ weaknesses: [], resistances: [{ type: 'Dragon', value: '-30' }] })) === 0)
  check('  …y contra uno normal: 10', (await golpe({ weaknesses: [], resistances: [] })) === 10)
}

console.log('\n── 1.4. Sin cartas que robar ──')
{
  const { mesa, u, a, b } = await montada({ empieza: 0, semilla: 40 })
  b.s.mazo = []
  await mesa.accion(() => a.pasarTurno(u), u)
  check('J2 no puede robar al empezar su turno: gana J1', mesa.terminada && mesa.m.resultado.ganador === 0, JSON.stringify(mesa.m.resultado))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Las cartas que tocan al rival ──')
{
  const { mesa, u, a, b } = await montada({ empieza: 1, semilla: 21 })
  await mesa.accion(() => b.pasarTurno(u), u)
  const dun = b.s.mazo.find((x) => b.carta(x).name === 'Dunsparce')
  b.sacarDelMazo(dun)
  b.s.banca.push(b.nuevoSlot(dun))
  const boss = trae(a, "Boss's Orders")
  await mesa.accion(() => a.jugarDeMano(boss, { id: 'jugar' }, u), u)
  check("Boss's Orders sube el Pokémon de la banca de J2", b.cartaDe(b.s.activo).name === 'Dunsparce')
  // Juez: los dos barajan su mano y roban 4.
  a.s.flags.partidario = false
  const juez = trae(a, 'Judge')
  for (let i = 0; i < 3; i++) trae(b, 'Poké Pad')
  await mesa.accion(() => a.jugarDeMano(juez, { id: 'jugar' }, u), u)
  check('Juez: J1 roba 4…', a.s.mano.length === 4, a.s.mano.length)
  check('  …y J2 también, de SU mazo', b.s.mano.length === 4 && b.s.mano.every((x) => x.startsWith('b')), b.s.mano.join())
  // El estadio es de los dos; al cambiarlo, el viejo vuelve a su dueño.
  const ruinas = trae(a, 'Risky Ruins')
  await mesa.accion(() => a.jugarDeMano(ruinas, { id: 'jugar' }, u), u)
  check('el estadio de J1 está en los dos lados', a.s.estadio === ruinas && b.s.estadio === ruinas)
  await mesa.accion(() => a.pasarTurno(u), u)
  const jaula = trae(b, 'Battle Cage')
  await mesa.accion(() => b.jugarDeMano(jaula, { id: 'jugar' }, u), u)
  check('J2 pone el suyo: el de J1 va al descarte de J1', a.s.descarte.includes(ruinas) && !b.s.descarte.includes(ruinas) && a.s.estadio === jaula && b.s.estadio === jaula)
  // Las maquinaciones de Xerosic: J1 se queda con 3 en la mano.
  b.s.flags.partidario = false
  for (let i = 0; i < 4; i++) trae(a, 'Poké Pad')
  const xero = trae(b, "Xerosic's Machinations")
  const manoA = a.s.mano.length
  const descarteA = a.s.descarte.length
  await mesa.accion(() => b.jugarDeMano(xero, { id: 'jugar' }, u), u)
  check('Xerosic: J1 descarta hasta quedarse con 3', a.s.mano.length === 3 && a.s.descarte.length === descarteA + (manoA - 3), `${a.s.mano.length} en mano`)
  // Martillo Mejorado: una energía ESPECIAL del rival, a SU descarte.
  // (Las energías del mazo de J1 son básicas: no puede quitar ninguna.)
  const psiA = trae(a, 'Psychic Energy')
  a.s.mano = a.s.mano.filter((x) => x !== psiA)
  a.s.activo.energias.push(psiA)
  const martillo = trae(b, 'Enhanced Hammer')
  await mesa.accion(() => b.jugarDeMano(martillo, { id: 'jugar' }, u), u).catch(() => {})
  check('Martillo Mejorado no quita una energía básica', a.s.activo.energias.includes(psiA))
}
{
  // Martillo Demoledor: si sale cara, la energía del rival va a SU descarte.
  let caras = 0
  let cruces = 0
  for (let semilla = 50; semilla < 70 && (!caras || !cruces); semilla++) {
    const { mesa, u, a, b } = await montada({ empieza: 0, semilla })
    const psiB = trae(b, 'Psychic Energy')
    b.s.mano = b.s.mano.filter((x) => x !== psiB)
    b.s.activo.energias.push(psiB)
    const martillo = trae(a, 'Crushing Hammer')
    await mesa.accion(() => a.jugarDeMano(martillo, { id: 'jugar' }, u), u)
    if (!b.s.activo.energias.includes(psiB)) {
      caras++
      if (caras === 1) check('Martillo Demoledor con cara: la energía del rival, al descarte del RIVAL', b.s.descarte.includes(psiB) && !a.s.descarte.includes(psiB))
    } else cruces++
  }
  check('  …y con cruz no pasa nada (salen las dos caras en 20 tiradas)', caras > 0 && cruces > 0, `${caras} caras, ${cruces} cruces`)
}

{
  // Iono: «si ALGUNO de los dos puso cartas debajo, CADA jugador roba».
  // Con tu mano vacía (solo tenías el Iono) y la del otro llena, roban
  // los dos. (Iono no está en la ficha: una carta de mentira con su
  // nombre basta, el efecto se busca por el nombre.)
  const IONO = { ...fila("Lillie's Determination"), id: 'prueba-iono', name: 'Iono', name_es: 'Iono', effect: null }
  const mesa = new Mesa({ mazos: [[...mazo(DRAG), { carta: IONO, n: 1 }], mazo(ALA)], efectos: EFECTOS, semilla: 8, empieza: 1 })
  const u = uiGuion(mesa)
  mesa.repartir()
  for (let k = 0; k < 2; k++) {
    const p = mesa.actual
    p.colocar(p.s.mano.find((x) => esPokemon(p.carta(x)) && faseDe(p.carta(x)) === 0), 'activo')
    await mesa.accion(() => mesa.listo(u), u)
  }
  const [a, b] = mesa.jugadores
  await mesa.accion(() => b.pasarTurno(u), u)
  const iono = a.s.mazo.find((x) => a.carta(x).name === 'Iono') || a.s.mano.find((x) => a.carta(x).name === 'Iono') || a.s.premios.find((x) => a.carta(x).name === 'Iono')
  for (const zona of ['mazo', 'mano', 'premios']) a.s[zona] = a.s[zona].filter((x) => x !== iono)
  a.s.mazo.push(...a.s.mano)
  a.s.mano = [iono]
  await mesa.accion(() => a.jugarDeMano(iono, { id: 'jugar' }, u), u)
  check('Iono con tu mano vacía y la del otro llena: roban LOS DOS', a.s.mano.length === a.s.premios.length && b.s.mano.length === b.s.premios.length, `${a.s.mano.length} y ${b.s.mano.length}`)
}
{
  // Campana Oscura: el activo del otro, si es Oscuro, no se confunde.
  const prueba = async (tipo) => {
    const { mesa, u, a, b } = await montada({ empieza: 0, semilla: 13 })
    const uidDef = b.s.activo.cartas.at(-1)
    b.cartas.set(uidDef, { ...b.carta(uidDef), types: [tipo] })
    const campana = trae(a, 'Poké Pad')
    a.cartas.set(campana, { ...fila('Dark Bell') })
    await mesa.accion(() => a.jugarDeMano(campana, { id: 'jugar' }, u), u)
    return b.s.activo.estados.includes('confundido')
  }
  check('Campana Oscura confunde al activo del otro que no es Oscuro…', await prueba('Psychic'))
  check('  …y no al que lo es', !(await prueba('Darkness')))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Partidas enteras al azar ──')
{
  let sem = 777
  const azar = () => ((sem = (sem * 16807) % 2147483647) / 2147483647)
  const uiAzar = (mesa) => ({ ...uiGuion(mesa), async confirmar() { return azar() < 0.7 } })
  // Todas las cartas de cada jugador, donde estén: ninguna se pierde ni
  // se duplica, y ninguna está en las zonas del otro.
  const invariante = (mesa) => {
    const errores = []
    for (const p of mesa.jugadores) {
      const s = p.s
      const zonas = [...s.mazo, ...s.mano, ...s.premios, ...s.descarte, ...s.jugando, ...p.enJuego.flatMap((x) => [...x.cartas, ...x.energias, ...(x.herramienta ? [x.herramienta] : [])])]
      const ajenas = zonas.filter((x) => !p.uidsPropios.has(x))
      if (ajenas.length) errores.push(`${p.nombreJugador}: cartas del otro en sus zonas: ${ajenas.slice(0, 3)}`)
      const mias = [...zonas, ...(s.estadio && p.uidsPropios.has(s.estadio) ? [s.estadio] : [])]
      const total = p.uidsPropios.size
      if (mias.length !== total || new Set(mias).size !== total) errores.push(`${p.nombreJugador}: ${mias.length}/${total} cartas`)
      if (s.estadio !== p.oponente.s.estadio) errores.push('el estadio no es el mismo en los dos lados')
    }
    return errores
  }
  const MAZOS = [DRAGAPULT, ALAKAZAM, KANGASKHAN]
  const N = Number(process.env.PARTIDAS || 24)
  const fallos = []
  let terminadas = 0
  let deshechas = 0
  for (let g = 0; g < N; g++) {
    sem = 1000 + g
    const mesa = new Mesa({ mazos: [mazo(MAZOS[g % 3]), mazo(MAZOS[(g + 1) % 3])], efectos: EFECTOS, semilla: 50 + g * 13 })
    const ui = uiAzar(mesa)
    mesa.repartir()
    try {
      for (let k = 0; k < 2; k++) {
        const p = mesa.actual
        const basicos = p.s.mano.filter((x) => esPokemon(p.carta(x)) && faseDe(p.carta(x)) === 0)
        await mesa.accion(() => {
          p.colocar(basicos[0], 'activo')
          for (const x of basicos.slice(1, 4)) p.colocar(x, 'banca')
        }, ui)
        await mesa.accion(() => mesa.listo(ui), ui)
      }
    } catch (e) {
      fallos.push(`g${g}: preparación: ${e.message}`)
      continue
    }
    for (let t = 0; t < 60 && mesa.fase === 'juego'; t++) {
      const p = mesa.actual
      for (let k = 0; k < 10 && mesa.fase === 'juego' && mesa.actual === p; k++) {
        const posibles = []
        for (const x of p.s.mano) for (const o of p.opcionesDeMano(x)) if (!o.no) posibles.push(() => p.jugarDeMano(x, o, ui))
        for (const sl of p.enJuego) if (!p.motivoNoHabilidad(sl)) posibles.push(() => p.usarHabilidad(sl, ui))
        if (!posibles.length) break
        try {
          await mesa.accion(posibles[Math.floor(azar() * posibles.length)], ui)
        } catch (e) {
          if (!e.cancelado && !e.noSePuede) fallos.push(`g${g} t${t}: ${e.stack?.split('\n').slice(0, 2).join(' / ')}`)
        }
        const inv = invariante(mesa)
        if (inv.length) { fallos.push(`g${g} t${t}: ${inv.join('; ')}`); break }
        if (azar() < 0.05 && mesa.puedeDeshacer) {
          mesa.deshacer()
          deshechas++
          const inv2 = invariante(mesa)
          if (inv2.length) fallos.push(`g${g} t${t}: tras deshacer: ${inv2.join('; ')}`)
        }
      }
      if (mesa.fase !== 'juego') break
      const yo = mesa.actual
      const act = yo.s.activo
      const ataques = act ? yo.ataquesDe(act).filter((at) => !yo.motivoNoAtacar(act, at.ataque, at.prestado ? at.de : null)) : []
      try {
        if (ataques.length) {
          const at = ataques[ataques.length - 1]
          await mesa.accion(() => yo.atacar(act, at.i, ui, { prestadoDe: at.prestado ? at.de.id : null }), ui)
        } else await mesa.accion(() => yo.pasarTurno(ui), ui)
      } catch (e) {
        if (!e.cancelado && !e.noSePuede) fallos.push(`g${g} t${t} fin de turno: ${e.stack?.split('\n').slice(0, 2).join(' / ')}`)
        else await mesa.accion(() => yo.pasarTurno(ui), ui).catch((e2) => fallos.push(`g${g}: no pasa el turno: ${e2.message}`))
      }
      const inv = invariante(mesa)
      if (inv.length) { fallos.push(`g${g} t${t} tras el turno: ${inv.join('; ')}`); break }
      if (mesa.actual === yo && mesa.fase === 'juego') { fallos.push(`g${g} t${t}: el turno no ha pasado`); break }
    }
    if (mesa.fase === 'fin') terminadas++
  }
  check(`${N} partidas sin perder, duplicar ni cruzar una carta`, fallos.length === 0, fallos.slice(0, 3).join(' | '))
  check('  …deshaciendo de vez en cuando', deshechas > 0, `${deshechas} veces`)
  check('  …y casi todas terminan con un ganador', terminadas >= N * 0.75, `${terminadas} de ${N}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La pantalla ──')
const browser = await chromium.launch()
const entradas = mazo(DRAGAPULT)
const cartas = [...new Map(entradas.map((e) => [e.carta.id, { ...e.carta, market: 'WEST', name_key: plano(e.carta.name), image_path: null }])).values()]
const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
const lista = entradas.map((e) => `${e.n}~${e.carta.id}`).join('_')
async function abrir({ ancho = 1400, alto = 900, tema = 'light', prefs = {}, sesion = 'none', extra = {}, nombre = '' } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto }, colorScheme: tema })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(({ cartas, sets, prefs, sesion, extra }) => {
    window.__FAKE_SESSION__ = sesion
    window.__FAKE_SETS__ = [...sets, ...(extra.sets || [])]
    window.__FAKE_CARTAS__ = [...cartas, ...(extra.cartas || [])]
    if (extra.mazos) window.__FAKE_MAZOS__ = extra.mazos
    let s = 42
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    localStorage.setItem('pokedoc-laboratorio', JSON.stringify({ opciones: { primero: 'segundo', estricta: true, rival: 'ex', banca: 2, modo: 'muneco' }, ...prefs }))
  }, { cartas, sets, prefs, sesion, extra })
  await page.goto(`${BASE}/constructor?l=${lista}${nombre ? `&nombre=${encodeURIComponent(nombre)}` : ''}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.click('#cmProbar')
  await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(300)
  return { page, errores }
}
const turno = (page) => page.locator('#labTurno').innerText()
const manoUids = (page) => page.locator('[data-mano]').evaluateAll((ns) => ns.map((n) => n.dataset.uid))
const cuantas = (page, nombre) => page.locator('[data-mano]').evaluateAll((ns, nombre) => ns.filter((n) => (n.getAttribute('aria-label') || '').startsWith(nombre)).length, nombre)
// Buscar en el mazo «a mano» (el menú del mazo): monta la situación sin
// depender de lo que haya salido en el reparto.
async function traer(page, nombre, { destino = 'mano', n = 1 } = {}) {
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Buscar en el mazo' }).click()
  await page.locator(`#labDialogo [data-opcion="${destino}"]`).click()
  await page.waitForTimeout(100)
  for (let i = 0; i < n; i++) await page.locator(`#labDialogo [data-elige][aria-label="${nombre}"][aria-pressed="false"]:not([disabled])`).first().click()
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(200)
}
const slotsPropios = (page) => page.locator('#labLadoPropio [data-slot-carta]').evaluateAll((ns) => ns.map((n) => n.getAttribute('aria-label')))

// ── 4.1. Elegir el modo, el mazo del otro y quién empieza ──
{
  const { page, errores } = await abrir()
  check('arranca contra el muñeco', (await page.locator('[data-modo="muneco"][aria-checked="true"]').count()) === 1 && (await page.locator('#labLadoRival.lab-lado-muneco').count()) === 1)
  await page.click('[data-modo="mesa"]')
  await page.waitForTimeout(200)
  check('«Tú contra ti» abre «Nueva partida» con ese modo marcado', (await page.locator('#labDialogo input[name="labModo"][value="mesa"]:checked').count()) === 1)
  check('  …y no reparte sin el mazo del jugador 2', await page.locator('#labDialogo [data-dlg="ok"]').isDisabled())
  await page.click('[data-cambiar-mazo="1"]')
  await page.waitForTimeout(150)
  check('el mazo sale de cuatro sitios: este, los tuyos, el meta o una lista pegada', (await page.locator('#labDialogo [data-fuente]').count()) === 4)
  await page.click('#labDialogo [data-fuente="texto"]')
  await page.locator('#labListaTexto').fill('4 Dreepy TWM 128')
  await page.click('#labDialogo [data-usar="texto"]')
  await page.waitForTimeout(400)
  check('una lista de 4 cartas no vale, y dice por qué', /13/.test(await page.locator('#labDialogo .lab-dialogo-error').innerText()))
  await page.click('#labDialogo [data-fuente="este"]')
  await page.click('#labDialogo [data-usar="este"]')
  await page.waitForTimeout(200)
  check('con el mazo elegido, vuelve y ya se puede repartir', !(await page.locator('#labDialogo [data-dlg="ok"]').isDisabled()) && (await page.locator('#labDialogo .lab-mazo-fila').nth(1).innerText()).includes('60 cartas'))
  await page.check('#labDialogo input[name="labEmpieza"][value="1"]')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(300)
  check('reparte la mesa: modo «tú contra ti» marcado', (await page.locator('[data-modo="mesa"][aria-checked="true"]').count()) === 1)
  check('  …y prepara primero el jugador 2, el que empieza', /Preparación · Jugador 2/.test(await turno(page)), await turno(page))
  check('  …con SU mano', (await manoUids(page)).every((x) => x.startsWith('b')))
  await page.click('[data-accion="auto"]')
  await page.waitForTimeout(150)
  check('«Listo» dice a quién le toca preparar', /le toca a Jugador 1/.test(await page.locator('[data-accion="empezar"]').innerText()))
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(250)
  check('ahora prepara el jugador 1, con su mano', /Preparación · Jugador 1/.test(await turno(page)) && (await manoUids(page)).every((x) => x.startsWith('a')))
  check('  …y lo que puso el otro está boca abajo', (await page.locator('#labLadoRival .lab-slot .lab-carta-dorso').count()) >= 1 && (await page.locator('#labLadoRival [data-rival-carta]').count()) === 0)
  // Cambiar quién empieza en la mesa, mientras se prepara.
  await page.click('[data-empieza="0"]')
  await page.waitForTimeout(150)
  check('el interruptor de quién empieza se mueve', (await page.locator('[data-empieza="0"][aria-checked="true"]').count()) === 1)
  await page.click('[data-accion="auto"]')
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(300)
  // Si alguien hizo mulligan, el otro elige cuántas roba de más.
  if (await page.locator('#labVelo:not(.hidden) .lab-numero').count()) await page.click('#labDialogo [data-dlg="ok"]')
  if (await page.locator('#labVelo:not(.hidden) .lab-numero').count()) await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(200)
  check('empieza el que se eligió en la mesa', /Turno 1 · Jugador 1/.test(await turno(page)), await turno(page))
  check('  …y el otro lado ya se ve boca arriba', (await page.locator('#labLadoRival [data-rival-carta]').count()) >= 1)
  check('cada lado lleva el nombre de su jugador', (await page.locator('#labLadoPropio .lab-jugador[data-j="0"]').count()) === 1 && (await page.locator('#labLadoRival .lab-jugador[data-j="1"]').count()) === 1)
  check('el panel de probabilidades es del que juega', /Jugador 1/.test(await page.locator('#labPanelTitulo').innerText()))

  // ── 4.2. Jugar con un clic ──
  await traer(page, 'Dreepy', { destino: 'banca', n: 2 })
  const bancaAntes = await page.locator('#labLadoPropio .lab-zona-banca .lab-slot').count()
  await traer(page, 'Budew')
  await page.locator('[data-mano][aria-label^="Budew"]').first().click()
  await page.waitForTimeout(200)
  check('tocar un básico lo baja a la banca, sin menú', (await page.locator('#labLadoPropio .lab-zona-banca .lab-slot').count()) === bancaAntes + 1 && (await page.locator('#labMenu:not(.hidden)').count()) === 0)
  await traer(page, 'Psychic Energy')
  const energiasAntes = await cuantas(page, 'Psychic Energy')
  const enJuego = (await slotsPropios(page)).length
  await page.locator('[data-mano][aria-label^="Psychic Energy"]').first().click()
  await page.waitForTimeout(200)
  check('una energía con varios Pokémon posibles: brillan los que valen', (await page.locator('#labApuntar:not(.hidden)').count()) === 1 && (await page.locator('#labLadoPropio .lab-apuntable').count()) === enJuego, `${await page.locator('#labLadoPropio .lab-apuntable').count()} de ${enJuego}`)
  check('  …y el aviso dice qué hacer', /A quién unes/.test(await page.locator('#labApuntar').innerText()))
  check('  …con el foco en el primero (también con teclado)', await page.evaluate(() => !!document.activeElement?.closest('.lab-apuntable')))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('Escape lo cancela y la energía sigue en la mano', (await page.locator('#labApuntar.hidden').count()) === 1 && (await cuantas(page, 'Psychic Energy')) === energiasAntes && (await page.locator('.lab').isVisible()))
  await page.locator('[data-mano][aria-label^="Psychic Energy"]').first().click()
  await page.waitForTimeout(150)
  // A un Dreepy de la banca: el que luego evoluciona, para ver que la
  // energía se queda con él.
  const objetivo = await page.locator('#labLadoPropio .lab-zona-banca .lab-apuntable [data-slot-carta][aria-label^="Dreepy"]').first().getAttribute('data-slot-carta')
  await page.click(`#labLadoPropio [data-slot-carta="${objetivo}"]`)
  await page.waitForTimeout(200)
  check('tocar el que brilla une la energía a ESE Pokémon', (await page.locator(`#labLadoPropio [data-slot="${objetivo}"] .lab-energia`).count()) === 1 && (await cuantas(page, 'Psychic Energy')) === energiasAntes - 1)
  check('  …y se acaba el apuntar', (await page.locator('#labApuntar.hidden').count()) === 1 && (await page.locator('.lab-apuntable').count()) === 0)
  check('  …y el foco sigue en la mesa, no en el «body» (el teclado sigue vivo)', await page.evaluate(() => document.activeElement !== document.body && document.querySelector('.lab').contains(document.activeElement)))
  await traer(page, 'Psychic Energy')
  check('la segunda energía ya no se puede jugar: va apagada', (await page.locator('.lab-mano-carta:not(.lab-jugable) [data-mano][data-no-jugable][aria-label^="Psychic Energy"]').count()) >= 1 && (await page.locator('.lab-jugable [data-mano][aria-label^="Psychic Energy"]').count()) === 0)
  await page.locator('[data-mano][aria-label^="Psychic Energy"]').first().click()
  await page.waitForTimeout(200)
  check('  …y tocarla dice por qué, sin hacer nada', /ya has unido/i.test(await page.locator('.toast').last().innerText().catch(() => '')) && (await page.locator('#labApuntar.hidden').count()) === 1)

  // Pasar el turno: la mesa gira.
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(300)
  check('terminar el turno: le toca al jugador 2, con su mano abajo', /Jugador 2/.test(await turno(page)) && (await manoUids(page)).every((x) => x.startsWith('b')))
  check('  …y el jugador 1 pasa arriba', (await page.locator('#labLadoRival .lab-jugador[data-j="0"]').count()) === 1)
  await page.click('[data-accion="deshacer"]')
  await page.waitForTimeout(200)
  check('deshacer devuelve el turno al jugador 1', /Turno 1 · Jugador 1/.test(await turno(page)) && (await manoUids(page)).every((x) => x.startsWith('a')))
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(250)
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(300)
  check('y otra vuelta: turno 3, el segundo del jugador 1', /Turno 3 · Jugador 1/.test(await turno(page)), await turno(page))

  // El ejemplo de PINGU: un básico en juego desde el turno anterior, y
  // al tocar el fase 1 se elige a cuál evoluciona tocando el básico.
  await traer(page, 'Drakloak')
  const dreepys = (await slotsPropios(page)).filter((x) => /^Dreepy\b/.test(x)).length
  const drakAntes = await cuantas(page, 'Drakloak')
  await page.locator('[data-mano][aria-label^="Drakloak"]').first().click()
  await page.waitForTimeout(200)
  check('tocar Drakloak: brillan los Dreepy que pueden evolucionar', (await page.locator('#labLadoPropio .lab-apuntable').count()) === dreepys && dreepys >= 2, `${await page.locator('#labLadoPropio .lab-apuntable').count()} de ${dreepys} Dreepy`)
  check('  …y solo los Dreepy', (await page.locator('#labLadoPropio .lab-apuntable [data-slot-carta]').evaluateAll((ns) => ns.every((n) => /^Dreepy\b/.test(n.getAttribute('aria-label'))))))
  const cual = objetivo
  check('  …entre ellos, el Dreepy de la energía', (await page.locator(`#labLadoPropio .lab-apuntable [data-slot-carta="${cual}"]`).count()) === 1)
  await page.click(`#labLadoPropio [data-slot-carta="${cual}"]`)
  await page.waitForTimeout(200)
  check('  …tocar uno lo evoluciona: ESE pasa a ser Drakloak', /^Drakloak\b/.test(await page.locator(`#labLadoPropio [data-slot-carta="${cual}"]`).getAttribute('aria-label')))
  check('  …y se queda con su energía', (await page.locator(`#labLadoPropio [data-slot="${cual}"] .lab-energia`).count()) === 1)
  check('  …y el Drakloak sale de la mano', (await cuantas(page, 'Drakloak')) === drakAntes - 1)

  // Una elección que HAY que contestar (quién sube de activo, coger un
  // premio) no se va con Escape ni tocando fuera: se quedaba la jugada a
  // medias y la mesa entera bloqueada. Desde la tanda 594 se contesta en
  // la mesa, con la barra de abajo, y no en una ventana.
  await page.locator('#labLadoPropio .lab-zona-activo [data-slot-carta]').click()
  await page.locator('#labMenu [data-op]', { hasText: 'Poner o quitar daño' }).click()
  await page.locator('#labDialogo input[type="number"]').fill('990')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(250)
  const barra = page.locator('#labCentro.lab-centro-eligiendo')
  const obligada = await barra.locator('.lab-elegir-titulo').innerText().catch(() => '')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('una elección que hay que contestar no se va con Escape', (await barra.count()) === 1 && (await barra.locator('.lab-elegir-titulo').innerText()) === obligada && !!obligada, obligada)
  await page.locator('#labCentro').click({ position: { x: 4, y: 4 } })
  await page.waitForTimeout(150)
  check('  …ni tocando fuera', (await barra.count()) === 1)
  for (let k = 0; k < 4 && (await barra.count()); k++) {
    await page.locator('[data-elegir]').first().click()
    await page.waitForTimeout(100)
    if (await page.locator('[data-elegir-accion="ok"]:not([disabled])').count()) await page.click('[data-elegir-accion="ok"]')
    await page.waitForTimeout(200)
  }
  check('  …y contestada, la mesa sigue: el otro ha cogido su premio', (await barra.count()) === 0 && /5 premios/.test(await page.locator('#labLadoRival .lab-zona-premios').innerText()))
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(250)
  check('  …y se puede terminar el turno', /Jugador 2/.test(await turno(page)))
  await page.click('[data-accion="deshacer"]')
  await page.waitForTimeout(200)

  // ── 4.3. Ver la carta ──
  const manoN = (await manoUids(page)).length
  const primera = page.locator('[data-mano]').first()
  const nombre = await primera.getAttribute('aria-label')
  await primera.click({ button: 'right' })
  await page.waitForTimeout(200)
  check('clic derecho en la mano: enseña la carta…', (await page.locator('#labVelo:not(.hidden) #labDialogoTitulo').count()) === 1 && nombre.startsWith(await page.locator('#labDialogoTitulo').innerText()))
  check('  …y no la juega', (await manoUids(page)).length === manoN)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  await page.locator('#labLadoRival [data-rival-carta]').first().click({ button: 'right' })
  await page.waitForTimeout(200)
  check('clic derecho en un Pokémon del otro: también', (await page.locator('#labVelo:not(.hidden) #labDialogoTitulo').count()) === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  const enfocada = await page.locator('[data-mano]').first().getAttribute('data-uid')
  await page.locator('[data-mano]').first().focus()
  await page.keyboard.press('v')
  await page.waitForTimeout(200)
  check('con teclado: «v» enseña la carta enfocada', (await page.locator('#labVelo:not(.hidden) #labDialogoTitulo').count()) === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('  …y al cerrarla, el foco vuelve a esa carta', (await page.evaluate(() => document.activeElement?.dataset?.uid)) === enfocada)
  // Mantener pulsado con el dedo: la enseña, y al soltar no la juega.
  // Con una energía (aún no se ha unido ninguna este turno, y hay varios
  // Pokémon): si el toque de después contara, se pondría a apuntar.
  await traer(page, 'Fire Energy')
  const manoN2 = (await manoUids(page)).length
  const pulsada = await page.locator('[data-mano][aria-label^="Fire Energy"]').first().evaluate(async (el) => {
    const r = el.getBoundingClientRect()
    const op = { bubbles: true, pointerType: 'touch', clientX: r.x + 10, clientY: r.y + 10, isPrimary: true }
    el.dispatchEvent(new PointerEvent('pointerdown', op))
    await new Promise((ok) => setTimeout(ok, 650))
    const visto = !document.querySelector('#labVelo').classList.contains('hidden')
    el.dispatchEvent(new PointerEvent('pointerup', op))
    el.click()
    return visto
  })
  await page.waitForTimeout(150)
  check('mantener pulsado (táctil): enseña la carta', pulsada)
  check('  …y el toque de después no la juega', (await manoUids(page)).length === manoN2 && (await page.locator('#labApuntar.hidden').count()) === 1 && !(await page.evaluate(() => document.querySelector('.lab').classList.contains('lab-modo-apuntar'))))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)

  // ── 4.4. El panel, siempre a mano ──
  check('en ancho, el panel está abierto de serie', await page.locator('#labPanel').isVisible())
  await page.click('.lab-panel-cerrar')
  await page.waitForTimeout(150)
  check('cerrado, queda su lengüeta para volver', (await page.locator('#labPanel').isHidden()) && (await page.locator('#labPanelPestana').isVisible()))
  // Que no tape NADA que se pulse en la mesa (estaba encima de «Terminar
  // el turno»): se mira contra todos, no contra el botón de hoy.
  const pisados = await page.evaluate(() => {
    const l = document.querySelector('#labPanelPestana').getBoundingClientRect()
    return [...document.querySelectorAll('.lab-mesa button')]
      .filter((b) => {
        const r = b.getBoundingClientRect()
        return r.width && r.left < l.right && r.right > l.left && r.top < l.bottom && r.bottom > l.top
      })
      .map((b) => b.getAttribute('aria-label') || b.textContent.trim())
  })
  check('  …que no tapa nada que se pulse en la mesa', pisados.length === 0, pisados.join(', '))
  await page.locator('[data-mano]').first().focus()
  await page.keyboard.press('p')
  await page.waitForTimeout(150)
  check('«p» lo vuelve a abrir', await page.locator('#labPanel').isVisible())
  await page.click('#labPanel [data-panel-pestania="registro"]')
  await page.waitForTimeout(150)
  check('el registro dice de quién es cada jugada', (await page.locator('#labRegistro .lab-jugador-mini[data-j="0"]').count()) > 0 && (await page.locator('#labRegistro .lab-jugador-mini[data-j="1"]').count()) > 0)
  check('sin errores de JavaScript', errores.length === 0, errores[0])
  await page.close()
}

// ── 4.5. Contra el muñeco: un solo sitio posible, se juega directo ──
{
  const { page, errores } = await abrir({ prefs: { panelAbierto: false } })
  check('con «panelAbierto: false» guardado, empieza cerrado', await page.locator('#labPanel').isHidden())
  await page.click('[data-primero="primero"]')
  await page.waitForTimeout(150)
  check('contra el muñeco también se elige ir primero', (await page.locator('[data-primero="primero"][aria-checked="true"]').count()) === 1 && /vas primero/.test(await turno(page)))
  const basico = page.locator('.lab-jugable [data-mano]').first()
  await basico.click()
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(250)
  check('empieza yendo primero', /Tu turno 1 · vas primero/.test(await turno(page)), await turno(page))
  const enJuego = (await slotsPropios(page)).length
  await traer(page, 'Fire Energy')
  await page.locator('[data-mano][aria-label^="Fire Energy"]').first().click()
  await page.waitForTimeout(200)
  check(`con ${enJuego} Pokémon en juego, la energía va directa a él`, enJuego !== 1 || ((await page.locator('#labApuntar.hidden').count()) === 1 && (await page.locator('#labLadoPropio .lab-slot-activo .lab-energia').count()) === 1))
  check('sin errores de JavaScript', errores.length === 0, errores[0])
  await page.close()
}

// ── 4.6. Los dos temas: el tapete es el mismo ──
{
  const medir = async (tema) => {
    const { page } = await abrir({ tema })
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), tema)
    await page.waitForTimeout(100)
    const r = await page.evaluate(() => {
      const t = getComputedStyle(document.querySelector('.lab-tapete'))
      const ps = getComputedStyle(document.querySelector('#labLadoPropio .lab-pila-texto strong'))
      return { fondo: t.backgroundImage, letra: t.color, cifra: ps.color, mano: getComputedStyle(document.querySelector('.lab-mano-zona')).backgroundColor }
    })
    await page.close()
    return r
  }
  const claro = await medir('light')
  const oscuro = await medir('dark')
  check('el tapete pinta el mismo fondo en los dos temas', claro.fondo === oscuro.fondo && /gradient/.test(claro.fondo))
  check('  …con el blanco fijo encima', claro.letra === 'rgb(255, 255, 255)' && oscuro.letra === claro.letra && oscuro.cifra === claro.cifra)
  check('lo de fuera del tapete (la mano) sí cambia de tema', claro.mano !== oscuro.mano, `${claro.mano} / ${oscuro.mano}`)
}

// ── 4.7. Cabe: a 1440×900 se ve tu activo y tu mano sin desplazar ──
{
  const { page } = await abrir({ ancho: 1440, alto: 900 })
  await page.click('[data-accion="auto"]')
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(250)
  const r = await page.evaluate(() => {
    const a = document.querySelector('#labLadoPropio .lab-slot-activo').getBoundingClientRect()
    const m = document.querySelector('.lab-mano-zona').getBoundingClientRect()
    const rival = document.querySelector('#labLadoRival').getBoundingClientRect()
    return { activo: a.bottom, mano: m.top, manoAbajo: m.bottom, rival: rival.top, alto: innerHeight }
  })
  check('[1440×900] tu activo, entero por encima de la mano', r.activo <= r.mano, JSON.stringify(r))
  check('[1440×900] la mano, entera en la pantalla', r.manoAbajo <= r.alto)
  check('[1440×900] y el rival arriba, a la vista', r.rival >= 0)
  await page.close()
}

// ── 4.7b. La cabecera, en una línea, y el turno entero ──
{
  // Con un nombre de mazo largo: es lo que hace que no quepa.
  const { page } = await abrir({ ancho: 1280, alto: 800, nombre: 'Dragapult de la liga regional de Bilbao' })
  await page.click('[data-modo="mesa"]')
  await page.click('[data-cambiar-mazo="1"]')
  await page.click('#labDialogo [data-usar="este"]')
  await page.check('#labDialogo input[name="labEmpieza"][value="0"]')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(250)
  for (let k = 0; k < 2; k++) {
    await page.click('[data-accion="auto"]')
    await page.click('[data-accion="empezar"]')
    await page.waitForTimeout(200)
  }
  while (await page.locator('#labVelo:not(.hidden) .lab-numero').count()) await page.click('#labDialogo [data-dlg="ok"]')
  for (const ancho of [800, 900, 1024, 1100, 1200, 1280, 1366, 1440]) {
    await page.setViewportSize({ width: ancho, height: 800 })
    await page.waitForTimeout(100)
    const r = await page.evaluate(() => {
      const b = document.querySelector('.lab-barra').getBoundingClientRect()
      const t = document.querySelector('#labTurno')
      const x = document.querySelector('.lab-cerrar-lab').getBoundingClientRect()
      // Nada de la barra se monta encima de lo de al lado (el título sobre
      // los modos, el turno sobre los botones…).
      // (El título, cuando se queda solo para el lector, mide 1 px y no
      // cuenta.)
      const visible = document.querySelector('.lab-titulo').getBoundingClientRect().width > 1
      const cajas = [visible ? '.lab-titulo h2' : null, '.lab-modos', '#labTurno', '.lab-barra-botones', '.lab-cerrar-lab'].filter(Boolean).map((s) => document.querySelector(s).getBoundingClientRect())
      const pisan = cajas.slice(1).some((c, i) => c.left < cajas[i].right - 1)
      return { alto: b.height, cortado: t.scrollWidth > t.clientWidth + 1 || t.scrollHeight > t.clientHeight + 1, cerrar: x.top < b.top + 16 && x.right <= innerWidth, pisan }
    })
    check(`[${ancho}] la cabecera, en una línea, sin pisarse, con el × arriba y el turno entero`, r.alto <= 72 && r.cerrar && !r.cortado && !r.pisan, JSON.stringify(r))
    // Y con un turno LARGO (lo que se acaba de hacer va detrás: «Turno 12
    // · Jugador 2 — …»): el turno puede cortarse con sus puntos, pero el
    // título no cede por debajo de «Laboratorio» ni se monta en los modos.
    const largo = await page.evaluate(() => {
      const t = document.querySelector('#labTurno')
      const antes = t.textContent
      t.textContent = 'Turno 12 · Jugador 2 — Dragapult ex usa Phantom Dive y deja KO a Fezandipiti ex'
      const b = document.querySelector('.lab-barra').getBoundingClientRect()
      const visible = document.querySelector('.lab-titulo').getBoundingClientRect().width > 1
      const cajas = [visible ? '.lab-titulo h2' : null, '.lab-modos', '#labTurno', '.lab-barra-botones', '.lab-cerrar-lab'].filter(Boolean).map((s) => document.querySelector(s).getBoundingClientRect())
      const pisan = cajas.slice(1).some((c, i) => c.left < cajas[i].right - 1)
      t.textContent = antes
      return { alto: b.height, pisan }
    })
    check(`[${ancho}]   …y con un turno largo, tampoco se pisa nada`, largo.alto <= 72 && !largo.pisan, JSON.stringify(largo))
  }
  // A 1024 el panel va por encima: al cerrarlo, el foco vuelve a su botón
  // (la lengüeta no se ve a ese ancho) y Escape sigue cerrando.
  await page.setViewportSize({ width: 1024, height: 800 })
  await page.click('.lab-barra [data-accion="panel"]')
  await page.waitForTimeout(150)
  await page.click('.lab-panel-cerrar')
  await page.waitForTimeout(150)
  check('[1024] al cerrar el panel, el foco vuelve a su botón', await page.evaluate(() => document.activeElement?.classList.contains('lab-btn-panel')))
  await page.click('.lab-barra [data-accion="panel"]')
  await page.waitForTimeout(150)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check('[1024] Escape cierra primero el panel (va por encima), no el laboratorio', (await page.locator('#labPanel').isHidden()) && (await page.locator('.lab').isVisible()))
  await page.close()
}

// ── 4.7c. El teclado: el foco no se escapa, y Ctrl+Z no le llega al
// constructor de debajo ──
{
  const { page } = await abrir()
  await page.keyboard.press('Escape')
  await page.locator('.lab').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  // Un cambio en el constructor: quitar una copia de la primera carta.
  await page.locator('#cmMazo [data-menos]').first().click()
  await page.waitForTimeout(150)
  const cuenta = await page.locator('#cmTabCuenta').innerText()
  await page.click('#cmProbar')
  await page.waitForTimeout(600)
  await page.click('[data-accion="auto"]')
  await page.waitForTimeout(150)
  await page.keyboard.press('Control+z')
  await page.waitForTimeout(150)
  check('Ctrl+Z en el laboratorio deshace la jugada…', (await page.locator('#labLadoPropio .lab-slot').count()) === 0)
  await page.keyboard.press('Escape')
  await page.locator('.lab').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  check('  …y NO el cambio del mazo de debajo', (await page.locator('#cmTabCuenta').innerText()) === cuenta, `${await page.locator('#cmTabCuenta').innerText()} vs ${cuenta}`)
  await page.click('#cmProbar')
  await page.waitForTimeout(600)
  // El foco no sale del laboratorio con el tabulador: hacia atrás desde
  // lo primero va a lo último (de él), y hacia delante desde lo último, a
  // lo primero. Sin la trampa, se iba a la página de debajo.
  await page.locator('#labTitulo').focus()
  await page.keyboard.press('Shift+Tab')
  const atras = await page.evaluate(() => document.querySelector('.lab').contains(document.activeElement))
  const ultimo = await page.evaluate(() => {
    const v = [...document.querySelector('.lab').querySelectorAll('button, [href], input, select, textarea, [tabindex]')].filter((x) => !x.disabled && x.tabIndex >= 0 && x.getClientRects().length)
    v.at(-1).focus()
    return v[0].outerHTML.slice(0, 60)
  })
  await page.keyboard.press('Tab')
  const adelante = await page.evaluate(() => document.querySelector('.lab').contains(document.activeElement))
  check('el tabulador da la vuelta DENTRO del laboratorio, en los dos sentidos', atras && adelante, ultimo)
  // Las flechas, dentro del grupo de «contra quién».
  await page.locator('[data-modo="muneco"]').focus()
  await page.keyboard.press('ArrowRight')
  check('las flechas se mueven por un grupo de opciones', await page.evaluate(() => document.activeElement?.dataset?.modo === 'mesa'))
  await page.close()
}

// ── 4.8. El móvil ──
for (const [ancho, alto] of [[360, 740], [390, 844]]) {
  const { page, errores } = await abrir({ ancho, alto })
  check(`[${ancho}] el panel empieza cerrado (taparía la mesa)`, await page.locator('#labPanel').isHidden())
  const boton = await page.locator('.lab-barra [data-accion="panel"]').boundingBox()
  check(`[${ancho}] …y su botón está arriba, a la vista y de 44 px`, boton && boton.y + boton.height < 120 && boton.x + boton.width <= ancho && boton.width >= 44 && boton.height >= 44, JSON.stringify(boton))
  check(`[${ancho}] la cabecera cabe en dos filas`, (await page.locator('.lab-barra').boundingBox()).height <= 112)
  await page.click('[data-modo="mesa"]')
  await page.click('[data-cambiar-mazo="1"]')
  await page.click('#labDialogo [data-usar="este"]')
  await page.check('#labDialogo input[name="labEmpieza"][value="0"]')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(250)
  for (let k = 0; k < 2; k++) {
    await page.click('[data-accion="auto"]')
    await page.click('[data-accion="empezar"]')
    await page.waitForTimeout(200)
  }
  while (await page.locator('#labVelo:not(.hidden) .lab-numero').count()) await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(200)
  const medidas = await page.evaluate(() => {
    const mesa = document.querySelector('.lab-mesa')
    const mano = document.querySelector('.lab-mano-zona').getBoundingClientRect()
    return { sobra: mesa.scrollWidth - mesa.clientWidth, mano: mano.bottom <= innerHeight + 1 && mano.top < innerHeight - 80 }
  })
  check(`[${ancho}] la mesa a dos no se sale de ancho`, medidas.sobra <= 1, `${medidas.sobra}px`)
  check(`[${ancho}] la mano, pegada abajo y a la vista`, medidas.mano)
  await traer(page, 'Dreepy', { destino: 'banca', n: 2 })
  await traer(page, 'Psychic Energy')
  await page.locator('[data-mano][aria-label^="Psychic Energy"]').first().click()
  await page.waitForTimeout(300)
  const vista = await page.evaluate(() => {
    const b = document.querySelector('#labApuntar').getBoundingClientRect()
    const ps = [...document.querySelectorAll('#labLadoPropio .lab-apuntable [data-slot-carta]')].map((x) => x.getBoundingClientRect())
    const f = document.activeElement.getBoundingClientRect()
    return { n: ps.length, foco: f.top >= 0 && f.bottom <= b.top + 1, aviso: b.bottom <= innerHeight && b.left >= 0 && b.right <= innerWidth, mano: getComputedStyle(document.querySelector('.lab-mano-zona')).display }
  })
  check(`[${ancho}] eligiendo, el Pokémon enfocado se ve entero por encima del aviso`, vista.n >= 2 && vista.foco, JSON.stringify(vista))
  check(`[${ancho}] …el aviso cabe en la pantalla`, vista.aviso)
  check(`[${ancho}] …y la mano se aparta para no tapar la banca`, vista.mano === 'none')
  await page.click('#labApuntar [data-accion="no-apuntar"]')
  await page.waitForTimeout(150)
  check(`[${ancho}] «Cancelar» del aviso lo cancela`, (await page.locator('#labApuntar.hidden').count()) === 1)
  await page.click('.lab-barra [data-accion="panel"]')
  await page.waitForTimeout(200)
  const panel = await page.locator('#labPanel').boundingBox()
  check(`[${ancho}] el panel se abre por encima, sin salirse`, (await page.locator('#labPanel').isVisible()) && panel.x >= 0 && panel.x + panel.width <= ancho + 1)
  check(`[${ancho}] sin errores`, errores.length === 0, errores[0])
  await page.close()
}
// ── 4.9. El mazo del otro, de los tuyos guardados ──
{
  const ala = mazo(ALAKAZAM)
  const cartasAla = [...new Map(ala.map((e) => [e.carta.id, { ...e.carta, market: 'WEST', name_key: plano(e.carta.name), image_path: null }])).values()].filter((c) => !cartas.some((x) => x.id === c.id))
  const setsAla = [...new Set(cartasAla.map((c) => c.set_id))].filter((id) => !sets.some((s) => s.id === id)).map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
  const mazos = [{ user_id: 'user-1', name: 'Alakazam de la liga', cards: ala.map((e) => ({ id: e.carta.id, n: e.n })) }]
  const { page, errores } = await abrir({ sesion: 'user-1', extra: { cartas: cartasAla, sets: setsAla, mazos } })
  // Primero una mesa con el mismo mazo en los dos lados.
  await page.click('[data-modo="mesa"]')
  await page.click('[data-cambiar-mazo="1"]')
  await page.click('#labDialogo [data-usar="este"]')
  await page.check('#labDialogo input[name="labEmpieza"][value="0"]')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(250)
  for (let k = 0; k < 2; k++) {
    await page.click('[data-accion="auto"]')
    await page.click('[data-accion="empezar"]')
    await page.waitForTimeout(200)
  }
  while (await page.locator('#labVelo:not(.hidden) .lab-numero').count()) await page.click('#labDialogo [data-dlg="ok"]')
  const cabecera = await page.locator('#labNombre').innerText()
  // Cambiar el mazo del jugador 2 y CANCELAR no toca la partida en juego.
  await page.click('[data-accion="nueva"]')
  await page.click('[data-cambiar-mazo="1"]')
  await page.click('#labDialogo [data-fuente="mios"]')
  await page.locator('#labDialogo [data-usar="mio"]').first().click()
  await page.waitForTimeout(500)
  await page.click('#labDialogo [data-dlg="cancelar"]')
  await page.waitForTimeout(150)
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(250)
  await page.click('.lab-barra [data-accion="panel"]').catch(() => {})
  if (await page.locator('#labPanel').isHidden()) await page.click('.lab-barra [data-accion="panel"]')
  await page.click('#labPanel [data-panel-pestania="mazo"]')
  await page.waitForTimeout(150)
  const tablaJ2 = await page.locator('#labPanel').innerText()
  check('cambiar un mazo en «Nueva partida» y cancelar no toca la partida', (await page.locator('#labNombre').innerText()) === cabecera && /Dreepy/.test(tablaJ2) && !/Abra/.test(tablaJ2), cabecera)
  // Y ahora sí: elegir uno de los tuyos y repartir.
  await page.click('[data-accion="nueva"]')
  await page.click('[data-cambiar-mazo="1"]')
  await page.click('#labDialogo [data-fuente="mios"]')
  await page.locator('#labDialogo [data-usar="mio"]').first().waitFor({ timeout: 4000 }).catch(() => {})
  check('«Mis mazos» lista los guardados de tu cuenta', /Alakazam de la liga/.test(await page.locator('#labDialogo .lab-lista-mazos').innerText().catch(() => '')))
  await page.locator('#labDialogo [data-usar="mio"]').first().click()
  await page.waitForTimeout(500)
  check('  …y elegido, es el del jugador 2', /Alakazam de la liga/.test(await page.locator('#labDialogo .lab-mazo-fila').nth(1).innerText()))
  await page.check('#labDialogo input[name="labEmpieza"][value="1"]')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(300)
  const nombresAla = new Set(ALAKAZAM.map(([, n]) => n))
  const mano = await page.locator('[data-mano]').evaluateAll((ns) => ns.map((n) => n.getAttribute('aria-label').replace(/ \(.*\)$/, '')))
  check('el jugador 2 juega con ESE mazo', /Jugador 2/.test(await turno(page)) && mano.length === 7 && mano.every((n) => nombresAla.has(n)), mano.join(', '))
  check('  …y la cabecera dice los dos mazos', /contra Alakazam de la liga/.test(await page.locator('#labNombre').innerText()))
  check('sin errores de JavaScript', errores.length === 0, errores[0])
  await page.close()
}
{
  // Contra el muñeco en 360 px: la fila de muñecos se desplaza, no estira.
  const { page } = await abrir({ ancho: 360, alto: 740 })
  await page.click('[data-accion="auto"]')
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(200)
  const sobra = await page.evaluate(() => document.querySelector('.lab-mesa').scrollWidth - document.querySelector('.lab-mesa').clientWidth)
  check('[360] contra el muñeco, la mesa no se sale de ancho', sobra <= 1, `${sobra}px`)
  await page.close()
}
await browser.close()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Lo que no se ve ──')
{
  const css = leer('css/laboratorio.css')
  check('el latido de lo que brilla se apaga con «menos movimiento»', /prefers-reduced-motion[\s\S]*\.lab-apuntable \.lab-slot-carta[^{]*\{\s*animation: none/.test(css))
  check('el tapete sale de los azules fijos (los que no cambian de tema)', /\.lab-tapete \{[\s\S]*?--navy-solid-dark[\s\S]*?\}/.test(css) && !/\.lab-tapete \{[^}]*var\(--navy\)/.test(css))
  const js = leer('js/constructor/laboratorio.js')
  check('el clic derecho no abre el menú del navegador sobre una carta', /addEventListener\('contextmenu'[\s\S]{0,200}preventDefault/.test(js))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
