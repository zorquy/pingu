// Tanda 625 — el repaso de los efectos del formato.
//
// PINGU: «léete todos los efectos de ataque, habilidades y el
// funcionamiento de TODOS los ataques de los Pokémon del formato actual.
// Fíjate cómo funciona tcgmasters.net». Y dos casos concretos: Meowth ex,
// que «no vuelve a usar la habilidad la segunda vez», y Hydrapple ex, que
// «siempre hay que introducir a mano el daño».
//
// Un inventario de las 2.763 cartas con marca H, I o J (cards-database)
// sacó lo que el motor no sabía hacer. Aquí se prueba, con el motor de
// verdad y en ESPAÑOL (que es como lo guarda producción desde la 330):
//   1. Las frases nuevas de daño, una por una.
//   2. Lo que pasa después del daño.
//   3. Las habilidades que se aplican solas y las que se usan.
//   4. Los ataques que usan OTRO ataque (Zoroark ex de N, Slowking).
//   5. Los dos casos de PINGU, con sus textos de producción.
//   6. Que el inventario no baje: las cartas del formato que se leen.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const M = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const T = await import(`${RAIZ}/js/constructor/textos.js`)
const { Mesa, esPokemon, faseDe } = M
const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}
let ids = 0
const poke = (name, { hp = 200, types = ['Colorless'], attacks = [], abilities = [], stage = 'Basic', evolve_from = null, retreat = 1, name_es = name } = {}) => ({ id: `t625-${++ids}`, set_id: 't625', local_id: String(ids), name, name_es, category: 'Pokemon', stage, evolve_from, hp, types, retreat, attacks, abilities, weaknesses: [], resistances: [], regulation_mark: 'I' })
const ataque = (name, effect, damage = null, cost = []) => ({ name, effect, damage, cost })
const hab = (name, effect) => ({ name, effect })
const relleno = [[20, 'Poké Pad'], [8, 'Psychic Energy'], [8, 'Fire Energy'], [6, 'Fighting Energy'], [8, 'Grass Energy'], [4, "Boss's Orders"], [4, "Hero's Cape"]]
const mazo = (lista) => [...lista, ...relleno].map(([n, c]) => ({ carta: typeof c === 'string' ? fila(c) : c, n }))
const uiGuion = (mesa, o = {}) => ({
  preguntas: [],
  async cartas(x) { this.preguntas.push(x); const pool = x.elegibles || x.opciones; return pool.slice(0, Math.max(x.min, Math.min(x.max, o.cuantas ?? x.max))) },
  async pokemon(x) { this.preguntas.push(x); return x.opciones.slice(0, Math.max(x.min, Math.min(x.max, 1))) },
  async confirmar(x) { this.preguntas.push(x); return o.confirmar ?? true },
  async opcion(x) { this.preguntas.push(x); return (o.opcion ? x.opciones.find(o.opcion) : x.opciones.find((y) => !y.no)).id },
  async numero(x) { this.preguntas.push({ ...x, numero: true }); return x.valor },
  async repartir(x) { this.preguntas.push(x); return { [x.opciones[0]]: x.total } },
  async premios(x) { return (x.partida || mesa.actual).s.premios.slice(0, x.n) },
})
const sacar = (p, c) => {
  // Por nombre: `poke()` hace un objeto nuevo en cada llamada, así que el
  // «mismo» Pokémon de la lista y el de la preparación no son idénticos.
  const es = (x) => p.carta(x).name === (typeof c === 'string' ? c : c.name)
  for (const z of ['mazo', 'mano', 'premios', 'descarte']) {
    const u = p.s[z].find(es)
    if (u) { if (z === 'mazo') p.sacarDelMazo(u); else p.s[z] = p.s[z].filter((x) => x !== u); return u }
  }
  throw new Error('no hay ' + (c.name || c))
}
const activo = (p, c, { energias = [], herramienta = null, danio = 0 } = {}) => {
  const slot = p.nuevoSlot(sacar(p, c))
  slot.entroTurno = -5
  slot.danio = danio
  for (const e of energias) slot.energias.push(sacar(p, e))
  if (herramienta) slot.herramienta = sacar(p, herramienta)
  if (p.s.activo) p.s.banca.push(p.s.activo)
  p.s.activo = slot
  return slot
}
const sinBanca = (p) => { p.s.banca = [] }
const banca = (p, c, { energias = [], herramienta = null, danio = 0 } = {}) => {
  const s = p.nuevoSlot(sacar(p, c))
  s.entroTurno = -5
  s.danio = danio
  for (const e of energias) s.energias.push(sacar(p, e))
  if (herramienta) s.herramienta = sacar(p, herramienta)
  p.s.banca.push(s)
  return s
}
const aMano = (p, c) => { const u = sacar(p, c); p.s.mano.push(u); return u }
async function mesaCon(listaA, listaB, { semilla = 7, ui = {}, turnos = 2 } = {}) {
  const mesa = new Mesa({ mazos: [mazo(listaA), mazo(listaB)], efectos: EFECTOS, semilla, empieza: 0 })
  const u = uiGuion(mesa, ui)
  mesa.repartir()
  for (let k = 0; k < 2; k++) {
    const p = mesa.actual
    let b = p.s.mano.filter((x) => esPokemon(p.carta(x)) && faseDe(p.carta(x)) === 0)
    if (!b.length) { const x = p.s.mazo.find((y) => esPokemon(p.carta(y)) && faseDe(p.carta(y)) === 0); p.sacarDelMazo(x); p.s.mano.push(x); b = [x] }
    p.colocar(b[0], 'activo')
    await mesa.accion(() => mesa.listo(u), u)
  }
  for (let k = 0; k < turnos; k++) await mesa.accion(() => mesa.pasarTurno(u), u)
  return { mesa, u, a: mesa.jugadores[0], b: mesa.jugadores[1] }
}
const atacar = (mesa, u, p, i = 0) => mesa.accion(() => p.atacar(p.s.activo, i, u), u)
const registro = (mesa) => mesa.m.registro.map((x) => x.texto).join(' | ')
const muro = (hp = 400, extra = {}) => poke('Muro', { hp, ...extra })

// Un atacante con UN ataque en español, contra un muro, y lo que se prepare.
async function golpe(texto, danio, { prep = () => {}, rival = muro(), ui = {}, extra = [], extraRival = [], semilla = 7 } = {}) {
  const at = poke('Atacante', { attacks: [ataque('Golpe', texto, danio)] })
  const r = await mesaCon([[4, at], ...extra], [[4, rival], ...extraRival], { ui, semilla })
  const { mesa, u, a, b } = r
  activo(a, at)
  sinBanca(a)
  activo(b, rival)
  sinBanca(b)
  await prep(r)
  // Lo que se pregunte al repartir (los mulligans) no es del ataque.
  u.preguntas.length = 0
  await atacar(mesa, u, a, 0)
  return { ...r, rival: b.s.activo || b.s.descarte }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El daño ──')
{
  const r = await golpe('Este ataque hace 30 puntos de daño por cada herramienta Pokémon unida a cada uno de tus Pokémon.', '30×', {
    extra: [[4, poke('Amigo')]],
    prep: ({ a }) => { a.s.activo.herramienta = sacar(a, "Hero's Cape"); banca(a, poke('Amigo'), {}).herramienta = sacar(a, "Hero's Cape") },
  })
  check('por cada herramienta de tus Pokémon: 2 × 30', r.b.s.activo.danio === 60, r.b.s.activo.danio)
}
{
  const evo = poke('Evolucionado', { hp: 400, stage: 'Stage 1', evolve_from: 'Muro' })
  const r = await golpe('Si el Pokémon activo de tu rival es un Pokémon Evolución, este ataque hace 70 puntos de daño más.', '30+', { rival: evo, extraRival: [[4, muro()]] })
  check('contra un Pokémon Evolución: 30 + 70', r.b.s.activo.danio === 100, r.b.s.activo.danio)
  const r2 = await golpe('Si el Pokémon activo de tu rival es un Pokémon Evolución, este ataque hace 70 puntos de daño más.', '30+')
  check('  …contra un básico, 30', r2.b.s.activo.danio === 30, r2.b.s.activo.danio)
}
{
  const r = await golpe('Si tienes por lo menos 3 Energías {R} en juego, este ataque hace 90 puntos de daño más.', '30+', {
    prep: ({ a }) => { for (let i = 0; i < 3; i++) a.s.activo.energias.push(sacar(a, 'Fire Energy')) },
  })
  check('«por lo menos 3 Energías {R} en juego»: 30 + 90', r.b.s.activo.danio === 120, r.b.s.activo.danio)
  const r2 = await golpe('Si tienes por lo menos 3 Energías {R} en juego, este ataque hace 90 puntos de daño más.', '30+', {
    prep: ({ a }) => { for (let i = 0; i < 2; i++) a.s.activo.energias.push(sacar(a, 'Fire Energy')) },
  })
  check('  …con 2, solo 30', r2.b.s.activo.danio === 30, r2.b.s.activo.danio)
}
{
  const r = await golpe('Este ataque hace 20 puntos de daño por cada uno de tus Pokémon en juego.', '20×', { extra: [[4, poke('Amigo')]], prep: ({ a }) => { banca(a, poke('Amigo')); banca(a, poke('Amigo')) } })
  check('por cada uno de tus Pokémon en juego (3): 60', r.b.s.activo.danio === 60, r.b.s.activo.danio)
}
{
  const r = await golpe('Si a tu rival le quedan 6 cartas de premio o menos, este ataque hace 100 puntos de daño más.', '20+')
  check('«si a tu rival le quedan 6 premios o menos»: 120', r.b.s.activo.danio === 120, r.b.s.activo.danio)
  const r2 = await golpe('Si te quedan más cartas de premio que a tu rival, este ataque hace 80 puntos de daño más.', '20+', { prep: ({ b }) => { b.s.premios = b.s.premios.slice(0, 3) } })
  check('«si te quedan más premios que a tu rival»: 100', r2.b.s.activo.danio === 100, r2.b.s.activo.danio)
}
{
  const pesado = poke('Pesado', { hp: 400, retreat: 3 })
  const r = await golpe('Este ataque hace 30 puntos de daño menos por cada {C} en el coste de retirada del Pokémon Activo de tu rival.', '150-', { rival: pesado, extraRival: [[4, pesado]] })
  check('menos por cada {C} de su retirada (3): 150 − 90', r.b.s.activo.danio === 60, r.b.s.activo.danio)
}
{
  const r = await golpe('Si este Pokémon no tiene ningún contador de daño sobre él, este ataque hace 120 puntos de daño más.', '30+')
  check('sin contadores encima: 30 + 120', r.b.s.activo.danio === 150, r.b.s.activo.danio)
  const r2 = await golpe('Si este Pokémon no tiene ningún contador de daño sobre él, este ataque hace 120 puntos de daño más.', '30+', { prep: ({ a }) => { a.s.activo.danio = 10 } })
  check('  …con uno, solo 30', r2.b.s.activo.danio === 30, r2.b.s.activo.danio)
}
{
  const r = await golpe('Si el Pokémon Activo de tu rival no está Quemado, este ataque no hace nada.', '200')
  check('«si no está Quemado, no hace nada»', r.b.s.activo.danio === 0, r.b.s.activo.danio)
  const r2 = await golpe('Si el Pokémon Activo de tu rival no está Quemado, este ataque no hace nada.', '200', { prep: ({ b }) => { b.s.activo.estados = ['quemado'] } })
  // 200 del ataque y 20 de la quemadura en el chequeo de entre turnos.
  check('  …quemado, 200 (+20 de quemarse al pasar el turno)', r2.b.s.activo.danio === 220, r2.b.s.activo.danio)
}
{
  const metal = poke('Acero', { types: ['Metal'] })
  const r = await golpe('Si tienes algún Pokémon {M} en tu banca, este ataque hace 80 puntos de daño más.', '60+', { extra: [[4, metal]], prep: ({ a }) => { banca(a, metal) } })
  check('«algún Pokémon {M} en tu banca»: 60 + 80', r.b.s.activo.danio === 140, r.b.s.activo.danio)
}
{
  const beldum = poke('Beldum')
  const metang = poke('Metang')
  const r = await golpe('Si Beldum y Metang están en tu banca, este ataque hace 150 puntos de daño más.', '130+', { extra: [[4, beldum], [4, metang]], prep: ({ a }) => { banca(a, beldum); banca(a, metang) } })
  check('Metagross: «si Beldum y Metang están en tu banca»: 130 + 150', r.b.s.activo.danio === 280, r.b.s.activo.danio)
  const r2 = await golpe('Si Beldum y Metang están en tu banca, este ataque hace 150 puntos de daño más.', '130+', { extra: [[4, beldum]], prep: ({ a }) => { banca(a, beldum) } })
  check('  …solo con Beldum, 130', r2.b.s.activo.danio === 130, r2.b.s.activo.danio)
}
{
  const r = await golpe('Si hay 3 cartas o menos en tu baraja, este ataque hace 200 puntos de daño más.', '40+', { prep: ({ a }) => { a.s.mazo = a.s.mazo.slice(0, 3) } })
  check('Rabsca: «3 cartas o menos en tu baraja»: 240', r.b.s.activo.danio === 240, r.b.s.activo.danio)
}
{
  // Sinistcha: descarta hasta 3 Energías {G} de tus Pokémon, 70 por cada una.
  const r = await golpe('Descarta hasta 3 cartas de Energía {G} de tus Pokémon. Este ataque hace 70 puntos de daño por cada carta que hayas descartado de esta manera.', '70×', {
    prep: ({ a }) => { a.s.activo.energias.push(sacar(a, 'Grass Energy'), sacar(a, 'Grass Energy'), sacar(a, 'Psychic Energy')) },
  })
  check('Sinistcha: 2 Planta descartadas × 70 = 140', r.b.s.activo.danio === 140, r.b.s.activo.danio)
  check('  …y la Psíquica se queda', r.a.s.activo.energias.length === 1, r.a.s.activo.energias.length)
}
{
  // Hydrapple (no ex): 6 Planta de la mano y KO; con 5, nada.
  const txt = 'Descarta 6 cartas de Energía {G} básica de tu mano y deja fuera de combate al Pokémon Activo de tu rival. Si no puedes descartar 6 cartas de esta manera, este ataque no hace nada.'
  const r = await golpe(txt, null, { prep: ({ a }) => { for (let i = 0; i < 6; i++) aMano(a, 'Grass Energy') } })
  check('Aliento Hydra con 6 Planta en la mano: KO', r.mesa.jugadores[1].s.activo === null || r.mesa.jugadores[1].s.descarte.some((u) => r.b.carta(u).name === 'Muro'), registro(r.mesa).slice(-200))
  const r2 = await golpe(txt, null, { prep: ({ a }) => { a.s.mano = a.s.mano.filter((u) => a.carta(u).name !== 'Grass Energy'); for (let i = 0; i < 5; i++) aMano(a, 'Grass Energy') } })
  check('  …con 5, no hace nada (ni descarta)', r2.b.s.activo?.danio === 0 && r2.a.s.mano.filter((u) => r2.a.carta(u).name === 'Grass Energy').length === 5, registro(r2.mesa).slice(-160))
}
{
  const ex = poke('Grande ex', { hp: 300 })
  const r = await golpe('Este ataque hace 60 puntos de daño a uno de los Pokémon ex en banca o Pokémon V en banca de tu rival.', null, { extraRival: [[4, ex], [4, poke('Chico')]], prep: ({ b }) => { banca(b, poke('Chico')); banca(b, ex) } })
  const enBanca = r.b.s.banca.map((d) => `${r.b.cartaDe(d).name}:${d.danio}`).join(',')
  check('Shaymin: 60 al Pokémon ex de la banca, no al otro', /Grande ex:60/.test(enBanca) && /Chico:0/.test(enBanca) && r.b.s.activo.danio === 0, enBanca)
}
{
  const r = await golpe('Este ataque hace 20 puntos de daño a uno de los Pokémon de tu rival por cada Energía {G} unida a este Pokémon.', null, {
    prep: ({ a }) => { a.s.activo.energias.push(sacar(a, 'Grass Energy'), sacar(a, 'Grass Energy'), sacar(a, 'Grass Energy')) },
  })
  check('Genesect: 20 × 3 Planta al elegido (el activo)', r.b.s.activo.danio === 60, r.b.s.activo.danio)
}
{
  const r = await golpe('Este ataque hace 30 puntos de daño a cada uno de los Pokémon de tu rival.', '30', { extraRival: [[4, poke('Chico')]], prep: ({ b }) => { banca(b, poke('Chico')) } })
  check('«a cada uno de los Pokémon de tu rival»: activo y banca', r.b.s.activo.danio === 30 && r.b.s.banca[0].danio === 30, `${r.b.s.activo.danio} / ${r.b.s.banca[0]?.danio}`)
}
{
  const r = await golpe('Cambia 1 de los Pokémon en Banca de tu rival por el Pokémon que esté en el Puesto Activo. Este ataque hace 30 puntos de daño al nuevo Pokémon Activo.', null, { extraRival: [[4, poke('Chico', { hp: 100 })]], prep: ({ b }) => { banca(b, poke('Chico', { hp: 100 })) } })
  check('Arrastrar: sube el de la banca y el daño es para ÉL', r.b.cartaDe(r.b.s.activo).name === 'Chico' && r.b.s.activo.danio === 30 && r.b.s.banca[0].danio === 0, `${r.b.cartaDe(r.b.s.activo).name} ${r.b.s.activo.danio}`)
}
{
  const r = await golpe('Puedes hacer 120 puntos de daño más. Si lo haces, este Pokémon también se hace 50 puntos de daño a sí mismo.', '100+')
  check('«puedes hacer 120 más… y te haces 50»', r.b.s.activo.danio === 220 && r.a.s.activo.danio === 50, `${r.b.s.activo.danio} / ${r.a.s.activo.danio}`)
  const r2 = await golpe('Puedes hacer 120 puntos de daño más. Si lo haces, este Pokémon también se hace 50 puntos de daño a sí mismo.', '100+', { ui: { confirmar: false } })
  check('  …y si dices que no, 100 y nada', r2.b.s.activo.danio === 100 && r2.a.s.activo.danio === 0, `${r2.b.s.activo.danio} / ${r2.a.s.activo.danio}`)
}
{
  // Una moneda por energía: con varias semillas tiene que salir alguna
  // vez más de una cara (si solo se lanzara una, nunca pasaría de 50).
  const vistos = []
  let preguntas = 0
  for (let semilla = 1; semilla <= 8; semilla++) {
    const r = await golpe('Lanza 1 moneda por cada Energía unida a este Pokémon. Este ataque hace 50 puntos de daño por cada cara.', '50×', {
      semilla,
      prep: ({ a }) => { a.s.activo.energias.push(sacar(a, 'Fire Energy'), sacar(a, 'Fire Energy'), sacar(a, 'Fire Energy')) },
    })
    vistos.push(r.b.s.activo.danio)
    preguntas += r.u.preguntas.filter((x) => x.numero).length
  }
  check('monedas por energía (3): múltiplos de 50, hasta 150, y alguna vez más de una cara', vistos.every((d) => d % 50 === 0 && d <= 150) && Math.max(...vistos) > 50, vistos.join(','))
  check('  …y no se pregunta el daño a mano', preguntas === 0, preguntas)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Lo que pasa después ──')
{
  const r = await golpe('Cura a este Pokémon la misma cantidad de puntos de daño que hayas infligido al Pokémon Activo de tu rival.', '60', { prep: ({ a }) => { a.s.activo.danio = 100 } })
  check('Chupavidas: cura lo que ha hecho (60)', r.a.s.activo.danio === 40, r.a.s.activo.danio)
}
{
  const r = await golpe('Cura 50 puntos de daño a este Pokémon. Durante tu próximo turno, este Pokémon no puede retirarse.', null, { prep: ({ a }) => { a.s.activo.danio = 50 } })
  check('Skarmory, Respiro: se cura 50 y no puede retirarse en tu próximo turno', r.a.s.activo.danio === 0 && r.a.s.activo.noRetirarHasta === r.a.s.turno + 1, `${r.a.s.activo.danio} ${r.a.s.activo.noRetirarHasta} ${r.a.s.turno}`)
}
{
  const r = await golpe('Pon hasta 2 Pokémon de tu pila de descartes en tu mano.', null, {
    extra: [[4, poke('Viejo')]],
    prep: ({ a }) => { for (let i = 0; i < 4; i++) a.s.descarte.push(sacar(a, 'Viejo')) },
  })
  check('Dhelmise, Ancla de Rescate: 2 Pokémon del descarte a la mano', r.a.s.mano.filter((u) => r.a.carta(u).name === 'Viejo').length === 2, r.a.s.mano.map((u) => r.a.carta(u).name).join(','))
}
{
  const r = await golpe('Pon 2 contadores de daño en cada uno de los Pokémon de tu rival que tenga algún contador de daño sobre él.', null, {
    extraRival: [[4, poke('Chico')]],
    prep: ({ b }) => { b.s.activo.danio = 10; banca(b, poke('Chico')); banca(b, poke('Chico'), { danio: 30 }) },
  })
  const d = [r.b.s.activo, ...r.b.s.banca].map((x) => x.danio).join(',')
  check('Yveltal, Vientos Corrosivos: 2 contadores solo a los que ya tenían', d === '30,0,50', d)
}
{
  const r = await golpe('Pon 4 contadores de daño en los Pokémon de tu rival de la manera que desees.', null)
  check('Sinistcha, Gota Maldita: se reparten 4 contadores', r.b.s.activo.danio === 40 && r.u.preguntas.some((x) => x.total === 4), r.b.s.activo.danio)
}
{
  const r = await golpe('Puedes poner 2 Energías unidas al Pokémon Activo de tu rival en su mano.', '70', { prep: ({ b }) => { b.s.activo.energias.push(sacar(b, 'Fire Energy'), sacar(b, 'Fire Energy'), sacar(b, 'Psychic Energy')) } })
  check('Slowking, Lavar la Pizarra: 2 energías del activo rival vuelven a SU mano', r.b.s.activo.energias.length === 1 && r.b.s.mano.filter((u) => /Energy/.test(r.b.carta(u).name)).length >= 2 && r.b.s.activo.danio === 70, `${r.b.s.activo.energias.length}`)
}
{
  // Sin «puedes» no se pregunta: aunque digas que no a todo, vuelve.
  const r = await golpe('Pon 1 Energía unida al Pokémon Activo de tu rival en su mano.', '30', { ui: { confirmar: false }, prep: ({ b }) => { b.s.activo.energias.push(sacar(b, 'Fire Energy'), sacar(b, 'Fire Energy')) } })
  check('«Pon 1 Energía unida al activo rival en su mano» (sin «puedes»): vuelve sin preguntar', r.b.s.activo.energias.length === 1, r.b.s.activo.energias.length)
}
{
  // Metagross: Puño Meteoro, +60 en el turno siguiente.
  const at = poke('Metagross', { attacks: [ataque('Puño Meteoro', 'Durante tu próximo turno, el ataque Puño Meteoro de este Pokémon hace 60 puntos de daño más.', '60')] })
  const { mesa, u, a, b } = await mesaCon([[4, at]], [[4, muro(500)]])
  activo(a, at)
  sinBanca(a)
  activo(b, muro(500))
  await atacar(mesa, u, a, 0)
  const primero = b.s.activo.danio
  await mesa.accion(() => mesa.pasarTurno(u), u)
  await atacar(mesa, u, a, 0)
  check('Puño Meteoro: 60 y, al turno siguiente, 120', primero === 60 && b.s.activo.danio === 180, `${primero} → ${b.s.activo.danio}`)
}
{
  const r = await golpe('Lanza 2 monedas. Por cada cara, descarta 1 Energía del Pokémon Activo de tu rival.', '50', { prep: ({ b }) => { b.s.activo.energias.push(sacar(b, 'Fire Energy'), sacar(b, 'Fire Energy')) } })
  const caras = (registro(r.mesa).match(/Golpe: (\d) caras?/) || [])[1]
  check('«por cada cara, descarta una energía»: tantas como caras', caras != null && r.b.s.activo.energias.length === 2 - Number(caras), `${caras} caras, quedan ${r.b.s.activo.energias.length}`)
}
{
  const r = await golpe('Busca en tu baraja 1 carta de Energía {G} básica y únela a uno de tus Pokémon. Después, baraja las cartas de tu baraja.', '30')
  check('Kagura Planta: una Planta del mazo, unida', r.a.s.activo.energias.some((u) => r.a.carta(u).name === 'Grass Energy'), r.a.s.activo.energias.length)
}
{
  const r = await golpe('Descarta 1 carta de tu mano. Si lo haces, roba 3 cartas.', null, { prep: ({ a }) => { a.s.mano = [aMano(a, 'Poké Pad')] } })
  check('«descarta 1 carta; si lo haces, roba 3»', r.a.s.descarte.some((u) => r.a.carta(u).name === 'Poké Pad'), registro(r.mesa).slice(-150))
}
{
  // Ataque Arena: el rival lanza moneda al atacar; con cruz no hay ataque.
  // Con varias semillas tienen que salir las dos cosas.
  const sand = poke('Sandygast', { attacks: [ataque('Ataque Arena', 'Durante el próximo turno de tu rival, si el Pokémon Defensor intenta usar un ataque, tu rival lanza 1 moneda. Si sale cruz, ese ataque no se lleva a cabo.', '10')] })
  const golpeador = poke('Golpeador', { attacks: [ataque('Pum', '', '100')] })
  let puesta = true
  let cruces = 0
  let golpes = 0
  let raros = []
  for (let semilla = 1; semilla <= 8; semilla++) {
    const { mesa, u, a, b } = await mesaCon([[4, sand]], [[4, golpeador]], { semilla })
    activo(a, sand)
    activo(b, golpeador)
    await atacar(mesa, u, a, 0)
    if (b.s.activo.monedaAtaque?.turno !== b.s.turno) puesta = false
    await atacar(mesa, u, b, 0)
    const cruz = /Cruz: el ataque no se hace/.test(registro(mesa))
    if (cruz && a.s.activo.danio === 0) cruces++
    else if (!cruz && a.s.activo.danio === 100) golpes++
    else raros.push(`${semilla}:${a.s.activo.danio}`)
  }
  check('Ataque Arena: el defensor queda con la moneda puesta para SU turno', puesta)
  check('  …y al atacar, unas veces cruz (sin ataque) y otras el golpe', cruces > 0 && golpes > 0 && !raros.length, `${cruces} cruces, ${golpes} golpes ${raros.join(' ')}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2b. Más de lo de después (textos de producción) ──')
{
  const txt = 'Si sales en primer lugar, puedes usar este ataque durante tu primer turno. Busca en tu baraja hasta 3 Pokémon Básicos y ponlos en tu Banca. Después, baraja las cartas de tu baraja.'
  const llamador = poke('Llamador', { attacks: [ataque('Llamada', txt, null), ataque('Pum', '', '10')] })
  const { mesa, u, a } = await mesaCon([[4, llamador], [4, poke('Amigo')]], [[4, muro()]], { turnos: 0 })
  activo(a, llamador)
  sinBanca(a)
  let pum = ''
  try { await atacar(mesa, u, a, 1) } catch (e) { pum = e.message }
  check('el primer turno de quien va primero sigue sin ataques…', /primer turno/.test(pum), pum)
  let llama = ''
  try { await atacar(mesa, u, a, 0) } catch (e) { llama = e.message }
  check('  …salvo el que dice «si sales en primer lugar, puedes usarlo»', !llama && a.s.banca.length === 3, llama || a.s.banca.length)
}
{
  const bajo = poke('Bajo', { attacks: [ataque('Crecer', 'Busca en tu baraja 1 carta que evolucione de este Pokémon y ponla sobre este Pokémon para hacerlo evolucionar. Después, baraja las cartas de tu baraja.', null)] })
  const alto = poke('Alto', { stage: 'Stage 1', evolve_from: 'Bajo', hp: 150 })
  const { mesa, u, a, b } = await mesaCon([[4, bajo], [2, alto]], [[4, muro()]])
  activo(a, bajo)
  activo(b, muro())
  if (!a.s.mazo.some((x) => a.carta(x).name === 'Alto')) a.s.mazo.push(sacar(a, 'Alto'))
  await atacar(mesa, u, a, 0)
  check('«busca una carta que evolucione de este Pokémon»: evoluciona', a.cartaDe(a.s.activo).name === 'Alto', a.cartaDe(a.s.activo).name)
}
{
  const r = await golpe('Cura 100 puntos de daño a cada uno de tus Pokémon en Banca.', null, { extra: [[4, poke('Amigo')]], prep: ({ a }) => { a.s.activo.danio = 50; banca(a, poke('Amigo'), { danio: 120 }) } })
  check('«cura 100 a cada uno de tus Pokémon en Banca»: la banca sí, el activo no', r.a.s.banca[0].danio === 20 && r.a.s.activo.danio === 50, `${r.a.s.banca[0].danio} / ${r.a.s.activo.danio}`)
}
{
  const r = await golpe('Une 1 carta de Energía {G} Básica de tu pila de descartes a uno de tus Pokémon en Banca.', '30', { extra: [[4, poke('Amigo')]], prep: ({ a }) => { banca(a, poke('Amigo')); a.s.descarte.push(sacar(a, 'Grass Energy')) } })
  check('«une 1 Energía {G} de tu descarte a uno de tu Banca»', r.a.s.banca[0].energias.length === 1 && r.a.carta(r.a.s.banca[0].energias[0]).name === 'Grass Energy', r.a.s.banca[0].energias.length)
}
{
  const r = await golpe('Une 1 carta de Energía {G} Básica de tu mano a uno de tus Pokémon en Banca.', '30', { extra: [[4, poke('Amigo')]], prep: ({ a }) => { banca(a, poke('Amigo')); aMano(a, 'Grass Energy') } })
  check('«une 1 Energía {G} de tu mano a uno de tu Banca»', r.a.s.banca[0].energias.length === 1, r.a.s.banca[0].energias.length)
}
{
  const r = await golpe('Este ataque también hace 40 puntos de daño a uno de tus Pokémon en Banca. (No apliques Debilidad y Resistencia a los Pokémon en Banca).', '120', { extra: [[4, poke('Amigo')]], prep: ({ a }) => { banca(a, poke('Amigo')) } })
  check('«también hace 40 a uno de TUS Pokémon en Banca»', r.b.s.activo.danio === 120 && r.a.s.banca[0].danio === 40, `${r.b.s.activo.danio} / ${r.a.s.banca[0].danio}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Habilidades ──')
{
  const crustle = poke('Crustle', { hp: 150, abilities: [hab('Robustez', 'Si este Pokémon tiene todos sus PS y fuese a quedar fuera de combate por el daño de un ataque, no queda fuera de combate y sus PS restantes pasan a ser 10.')] })
  const r = await golpe('', '300', { rival: crustle, extraRival: [[4, crustle]] })
  check('Crustle, Robustez: con todos sus PS aguanta con 10', r.b.s.activo && r.b.s.activo.danio === 140, r.b.s.activo?.danio)
  const r2 = await golpe('', '300', { rival: crustle, extraRival: [[4, crustle]], prep: ({ b }) => { b.s.activo.danio = 10 } })
  // Y el registro no dice que aguanta: con daño encima ya no tiene «todos
  // sus PS», así que la habilidad ni se mira.
  check('  …si ya tenía daño, cae (y el registro no dice que aguante)', (!r2.b.s.activo || r2.b.cartaDe(r2.b.s.activo).name !== 'Crustle' || r2.b.s.activo.danio >= 150) && !/aguanta con 10/.test(registro(r2.mesa)), registro(r2.mesa).slice(-120))
}
{
  const polt = poke('Poltchageist', { hp: 30, abilities: [hab('Escondite Almacén', 'Mientras este Pokémon esté en tu banca, se evitan todo el daño y todos los efectos de los ataques de los Pokémon de tu rival infligidos a este Pokémon.')] })
  const r = await golpe('Este ataque también hace 30 puntos de daño a cada uno de los Pokémon en banca de tu rival.', '30', { extraRival: [[4, polt], [4, poke('Chico')]], prep: ({ b }) => { banca(b, polt); banca(b, poke('Chico')) } })
  const d = r.b.s.banca.map((x) => `${r.b.cartaDe(x).name}:${x.danio}`).join(',')
  check('Poltchageist en la banca no recibe daño; el de al lado sí', /Poltchageist:0/.test(d) && /Chico:30/.test(d), d)
}
{
  const yv = poke('Yveltal', { abilities: [hab('Vida Bloqueada', 'El Pokémon Activo de tu rival no puede ser curado.')] })
  const sanador = poke('Sanador', { attacks: [ataque('Curarse', 'Cura 60 puntos de daño a este Pokémon.', null)] })
  const { mesa, u, a, b } = await mesaCon([[4, sanador]], [[4, yv]])
  activo(a, sanador, { danio: 60 })
  activo(b, yv)
  await atacar(mesa, u, a, 0)
  check('Yveltal: el activo rival no se cura', a.s.activo.danio === 60, `${a.s.activo.danio} ${registro(mesa).slice(-100)}`)
}
{
  const sp = poke('Slowpoke', { abilities: [hab('Cara Despistada', 'Este Pokémon no puede pasar a estar Confundido.')] })
  const r = await golpe('El Pokémon Activo de tu rival pasa a estar Confundido.', '10', { rival: sp, extraRival: [[4, sp]] })
  check('Slowpoke no queda Confundido', !r.b.s.activo.estados.includes('confundido'), r.b.s.activo.estados.join(','))
}
{
  // Kyurem en español: «Acromo» en el descarte rival, Triple Escarcha por {C}.
  const kyurem = poke('Kyurem', { abilities: [hab('Perdición Plasma', 'Si tu rival tiene alguna carta en su pila de descartes que tenga "Acromo" en el nombre, este Pokémon puede usar el ataque Triple Escarcha por Colorless.')], attacks: [ataque('Triple Escarcha', '', '110', ['Water', 'Water', 'Metal', 'Metal'])] })
  const acromo = { ...fila("Boss's Orders"), id: 't625-acromo', name: "Colress's Tenacity", name_es: 'Tenacidad de Acromo' }
  const { a, b } = await mesaCon([[4, kyurem]], [[4, muro()], [2, acromo]])
  activo(a, kyurem)
  const antes = a.costeDeAtaque(a.s.activo, a.s.activo && a.cartaDe(a.s.activo).attacks[0]).join('')
  b.s.descarte.push(sacar(b, acromo))
  const despues = a.costeDeAtaque(a.s.activo, a.cartaDe(a.s.activo).attacks[0]).join('')
  check('Kyurem (en español): con «Acromo» en el descarte rival, Triple Escarcha por {C}', antes.length === 4 && despues === 'C', `${antes} → ${despues}`)
}
{
  const drilbur = { ...poke('Drilbur', { abilities: [hab('Excava Excava', 'Una vez durante tu turno, cuando juegues este Pokémon de tu mano a tu banca, puedes usar esta habilidad. Busca en tu baraja hasta 3 cartas de Energía {F} básica y descártalas. Después, baraja las cartas de tu baraja.')] }) }
  const { mesa, u, a } = await mesaCon([[4, drilbur]], [[4, muro()]])
  const antes = a.s.descarte.length
  const d = aMano(a, drilbur)
  await mesa.accion(() => a.bajarABanca(d, u), u)
  check('Drilbur, Excava Excava: 3 Lucha del mazo al descarte', a.s.descarte.filter((x) => a.carta(x).name === 'Fighting Energy').length === 3 && a.s.descarte.length === antes + 3, a.s.descarte.length - antes)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Usar el ataque de otro ──')
{
  const zekrom = poke("N's Zekrom", { attacks: [ataque('Rayo', '', '90')] })
  const zoro = poke("N's Zoroark ex", { attacks: [ataque('Broma Nocturna', 'Elige uno de los ataques de tus Pokémon de N en banca y úsalo como este ataque.', null)] })
  const { mesa, u, a, b } = await mesaCon([[4, zoro], [4, zekrom]], [[4, muro()]])
  activo(a, zoro)
  sinBanca(a)
  banca(a, zekrom)
  activo(b, muro())
  await atacar(mesa, u, a, 0)
  check('Zoroark ex de N: usa el ataque de Zekrom de N (90)', b.s.activo.danio === 90, `${b.s.activo.danio} ${registro(mesa).slice(-140)}`)
}
{
  const slowking = poke('Slowking', { attacks: [ataque('Buscar Inspiración', 'Descarta la primera carta de tu baraja y, si es un Pokémon que no tiene un recuadro de regla, elige uno de sus ataques y úsalo como este ataque.', null), ataque('Súper Psicorrayo', '', '120')] })
  const arriba = poke('Pegón', { attacks: [ataque('Pegar', '', '70')] })
  const { mesa, u, a, b } = await mesaCon([[4, slowking], [1, arriba]], [[4, muro()]])
  activo(a, slowking)
  activo(b, muro())
  const u0 = sacar(a, arriba)
  a.s.mazo.unshift(u0)
  await atacar(mesa, u, a, 0)
  check('Slowking: descarta Pegón de arriba y usa su ataque (70)', b.s.activo.danio === 70 && a.s.descarte.includes(u0), `${b.s.activo.danio}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Los dos de PINGU, con los textos de producción ──')
{
  const hydra = { ...poke('Hydrapple ex', { hp: 330, types: ['Grass'], attacks: [ataque('Tormenta en Almíbar', 'Este ataque hace 30 puntos de daño más por cada Energía {G} unida a cada uno de tus Pokémon.', '30+', ['Incolora', 'Incolora'])] }) }
  const r = await (async () => {
    const { mesa, u, a, b } = await mesaCon([[4, hydra], [4, poke('Amigo')]], [[4, muro()]])
    activo(a, hydra, { energias: ['Grass Energy', 'Grass Energy'] })
    sinBanca(a)
    banca(a, poke('Amigo'), { energias: [] }).energias.push(sacar(a, 'Grass Energy'))
    activo(b, muro())
    u.preguntas.length = 0
    await atacar(mesa, u, a, 0)
    return { mesa, u, a, b }
  })().catch((e) => ({ error: e.message }))
  check('Hydrapple ex: 30 + 30 × 3 Planta (dos suyas y una de la banca) = 120, sin preguntar', !r.error && r.b.s.activo.danio === 120 && !r.u.preguntas.some((x) => x.numero), r.error || r.b.s.activo.danio)
}
{
  const meowth = fila('Meowth ex')
  const { mesa, u, a } = await mesaCon([[4, meowth], [4, "Lillie's Determination"]], [[4, muro()]])
  const usos = []
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    const m = aMano(a, meowth)
    const antes = a.s.mano.filter((x) => a.carta(x).name === "Lillie's Determination").length
    await mesa.accion(() => a.bajarABanca(m, u), u)
    usos.push(a.s.mano.filter((x) => a.carta(x).name === "Lillie's Determination").length - antes)
    await mesa.accion(() => mesa.pasarTurno(u), u)
    await mesa.accion(() => mesa.pasarTurno(u), u)
  }
  check('Meowth ex: la habilidad funciona al bajarlo en turnos distintos', usos.join(',') === '1,1', usos.join(','))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Lo que ya se lee no baja ──')
{
  const PARES = JSON.parse(readFileSync(new URL('./textos-tcgdex.json', import.meta.url), 'utf8'))
  let cartas = 0
  for (const x of PARES.ataques) {
    const en = T.leerAtaque(x.en)
    if (en.completo && !en.vacio) cartas += x.n
  }
  // 2.777 al cerrar la 593; 3.180 con esta tanda.
  check(`los ataques del corpus que se leen enteros: ${cartas} cartas (eran 2.777)`, cartas >= 3180, cartas)
}

console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
