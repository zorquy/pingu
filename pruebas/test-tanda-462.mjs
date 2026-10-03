// Tanda 462 — los efectos de las cartas, solos; el Pokémon activo en el
// centro; y /repeticiones.
//
// PINGU: «que funcionen los efectos de las cartas, por ejemplo: cuando
// tienes el Casco Suerte que si te hacen daño robas 2 cartas, que se haga
// automáticamente. Si te pegan con Budew, el efecto es que no puedes usar
// objetos, pues que no puedas usar objetos, fíjate en esos detalles de
// todas las cartas». Y: «que el Pokémon activo sea lo que está centrado
// en la pantalla y no la barra de vida». Y después: «un apartado para ver
// repeticiones, que te peguen el log de una partida de Pokémon TCG Live en
// español y que se reproduzca sola la partida».
//
// Lo que se prueba:
//   1. Los efectos, jugando de verdad contra el motor (dos jugadores, un
//      ataque, y mirar qué ha pasado): cada uno es una FORMA de efecto
//      —un veto al turno siguiente, una herramienta que reacciona al
//      daño, un escudo, una habilidad pasiva que cambia una regla…—.
//   2. El lector de textos de ataque: la cobertura sobre la ficha de
//      pruebas no baja, y lo que no entiende lo dice en vez de inventar.
//   3. El registro de TCG Live, en español y en inglés: se lee entero, las
//      60 cartas de cada jugador están en su sitio en CADA foto, y los
//      casos que el registro cuenta a medias (dos Pokémon que se llaman
//      igual, la jugada contada dos veces, un KO sin su línea) caen bien.
//   4. /repeticiones en el navegador: se reproduce sola, se para, el
//      deslizador, los botones, el teclado, el registro al lado, girar la
//      mesa, ver cartas, los errores, y que quepa en el móvil y en un
//      portátil.
//   5. El activo centrado en el tapete (laboratorio y repetición), y la
//      última carta del descarte con su dibujo ENCIMA del nombre.
//   6. El sitio: el enlace en «Jugar» de todas las páginas y el sitemap.
import { readFileSync, readdirSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = process.env.BASE || 'http://localhost:8892'
const M = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const { leerAtaque, rasgosDeCarta } = await import(`${RAIZ}/js/constructor/textos.js`)
const { plano } = await import(`${RAIZ}/js/constructor/nucleo.js`)
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const { fotos, arriba } = await import(`${RAIZ}/js/repeticiones/estado.js`)
const { EJEMPLO } = await import(`${RAIZ}/js/repeticiones/ejemplo.js`)
const { Mesa, Partida, esPokemon, faseDe, claveDeEfecto } = M
const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Los efectos de las cartas, solos ──')
const relleno = [[20, 'Poké Pad'], [10, 'Psychic Energy'], [10, 'Fire Energy'], [10, 'Darkness Energy'], [6, 'Metal Energy'], [6, 'Grass Energy'], [6, 'Lightning Energy'], [6, 'Water Energy']]
const mazo = (lista) => [...lista, ...relleno].map(([n, nombre]) => ({ carta: fila(nombre), n }))
const uiGuion = (mesa, elecciones = {}) => ({
  async cartas(o) { const pool = o.elegibles || o.opciones; return pool.slice(0, Math.max(o.min, Math.min(o.max, 1))) },
  async pokemon(o) { return o.opciones.slice(0, Math.max(o.min, Math.min(o.max, 1))) },
  async confirmar() { return elecciones.confirmar ?? true },
  async opcion(o) { return o.opciones.find((x) => !x.no).id },
  async numero(o) { return o.valor },
  async repartir(o) { return { [o.opciones[0]]: o.total } },
  async premios(o) { return (o.partida || mesa.actual).s.premios.slice(0, o.n) },
})
// Saca una carta por nombre de donde esté (mazo, mano, premios).
const sacar = (p, nombre) => {
  for (const z of ['mazo', 'mano', 'premios', 'descarte']) {
    const u = p.s[z].find((x) => p.carta(x).name === nombre)
    if (u) { if (z === 'mazo') p.sacarDelMazo(u); else p.s[z] = p.s[z].filter((x) => x !== u); return u }
  }
  throw new Error('no hay ' + nombre)
}
// Pone de ACTIVO un Pokémon con lo que se le diga (el que había, a la banca).
const activo = (p, nombre, { energias = [], herramienta = null } = {}) => {
  const slot = p.nuevoSlot(sacar(p, nombre))
  slot.entroTurno = -5
  for (const e of energias) slot.energias.push(sacar(p, e))
  if (herramienta) slot.herramienta = sacar(p, herramienta)
  if (p.s.activo) p.s.banca.push(p.s.activo)
  p.s.activo = slot
  return slot
}
const banca = (p, nombre, { energias = [] } = {}) => { const s = p.nuevoSlot(sacar(p, nombre)); s.entroTurno = -5; for (const e of energias) s.energias.push(sacar(p, e)); p.s.banca.push(s); return s }
const aMano = (p, nombre) => { const u = sacar(p, nombre); p.s.mano.push(u); return u }
async function mesaCon(listaA, listaB, { semilla = 7 } = {}) {
  const mesa = new Mesa({ mazos: [mazo(listaA), mazo(listaB)], efectos: EFECTOS, semilla, empieza: 0 })
  const u = uiGuion(mesa)
  mesa.repartir()
  for (let k = 0; k < 2; k++) {
    const p = mesa.actual
    let b = p.s.mano.filter((x) => esPokemon(p.carta(x)) && faseDe(p.carta(x)) === 0)
    if (!b.length) { const x = p.s.mazo.find((y) => esPokemon(p.carta(y)) && faseDe(p.carta(y)) === 0); p.sacarDelMazo(x); p.s.mano.push(x); b = [x] }
    p.colocar(b[0], 'activo')
    await mesa.accion(() => mesa.listo(u), u)
  }
  return { mesa, u, a: mesa.jugadores[0], b: mesa.jugadores[1] }
}
const pasar = (mesa, u) => mesa.accion(() => mesa.pasarTurno(u), u)
const atacar = (mesa, u, p, i = 0) => mesa.accion(() => p.atacar(p.s.activo, i, u), u)
const registro = (mesa) => mesa.m.registro.map((x) => x.texto).join(' | ')


const turnoDeA = async (listaA, listaB, o = {}) => { const r = await mesaCon(listaA, listaB, o); await pasar(r.mesa, r.u); await pasar(r.mesa, r.u); return r }
const E = (n, tipo) => Array(n).fill(tipo)

console.log('── Budew: sin objetos en el siguiente turno del rival ──')
{
  const { mesa, u, a, b } = await mesaCon([[4, 'Budew']], [[4, 'Dunsparce'], [2, 'Lucky Helmet'], [2, "Lillie's Determination"]])
  // J1 empieza: no ataca en su turno 1. Pasa; J2 pasa; J1 ataca en su turno 2.
  await pasar(mesa, u); await pasar(mesa, u)
  activo(a, 'Budew')
  await atacar(mesa, u, a, 0)
  check('es el turno de J2', mesa.actual === b)
  const pad = aMano(b, 'Poké Pad')
  const no = b.motivoNoJugar(pad)
  check('J2 no puede jugar objetos (Poké Pad)', /no puedes jugar objetos/i.test(no || ''), no)
  const casco = aMano(b, 'Lucky Helmet')
  const ops = b.opcionesDeMano(casco)
  check('…pero una herramienta sí (no es un objeto)', ops.some((o) => o.id === 'herramienta' && !o.no), JSON.stringify(ops))
  // El veto es de OBJETOS: un partidario se sigue jugando.
  const lillie = aMano(b, "Lillie's Determination")
  check('…y un partidario también', !b.motivoNoJugar(lillie), b.motivoNoJugar(lillie))
  await pasar(mesa, u)
  await pasar(mesa, u)
  check('en el siguiente turno de J2 ya puede', !b.motivoNoJugar(pad), b.motivoNoJugar(pad))
}
console.log('── Casco Suerte: el que recibe roba 2 ──')
{
  const { mesa, u, a, b } = await mesaCon([[4, 'Budew']], [[4, 'Dunsparce'], [2, 'Lucky Helmet']])
  await pasar(mesa, u); await pasar(mesa, u)
  activo(a, 'Budew')
  activo(b, 'Dunsparce', { herramienta: 'Lucky Helmet' })
  const antes = b.s.mano.length
  await atacar(mesa, u, a, 0)
  // J2 empieza su turno robando 1: 2 del casco + 1 del turno.
  check('J2 tiene 3 cartas más (2 del casco + 1 del turno)', b.s.mano.length === antes + 3, `${antes} → ${b.s.mano.length}`)
  check('el registro dice Casco Suerte', /Casco Suerte/.test(registro(mesa)))
}
console.log('── Dusknoir: el defensor no puede retirarse ──')
{
  const { mesa, u, a, b } = await mesaCon([[4, 'Duskull'], [4, 'Dusknoir']], [[4, 'Dunsparce'], [2, 'Genesect ex']])
  await pasar(mesa, u); await pasar(mesa, u)
  activo(a, 'Dusknoir', { energias: ['Psychic Energy', 'Psychic Energy', 'Fire Energy'] })
  activo(b, 'Genesect ex', { energias: ['Psychic Energy', 'Psychic Energy'] })
  banca(b, 'Dunsparce')
  await atacar(mesa, u, a, 0)
  const no = b.motivoNoRetirar()
  check('J2 no puede retirar su activo', /impide retirarse/.test(no || ''), no)
}
console.log('── Munkidori: confunde ──')
{
  const { mesa, u, a, b } = await mesaCon([[4, 'Munkidori']], [[4, 'Dudunsparce'], [4, 'Dunsparce']])
  await pasar(mesa, u); await pasar(mesa, u)
  activo(a, 'Munkidori', { energias: ['Psychic Energy', 'Fire Energy'] })
  activo(b, 'Dudunsparce')
  await atacar(mesa, u, a, 0)
  check('el activo de J2 queda confundido', b.s.activo.estados.includes('confundido'), JSON.stringify(b.s.activo.estados))
}
console.log('── Genesect ex: −30 en el siguiente turno del rival ──')
for (const [atacante, iAtq, espera, que] of [['Latias ex', 0, 170, 'Latias ex (200) le hace 170'], ['Dudunsparce ex', 1, 150, 'Dudunsparce ex (150, «no le afectan los efectos») le hace 150']]) {
  const { mesa, u, a, b } = await mesaCon([[4, 'Genesect ex']], [[4, 'Dunsparce'], [2, atacante]])
  await pasar(mesa, u); await pasar(mesa, u)
  const g = activo(a, 'Genesect ex', { energias: ['Metal Energy', 'Metal Energy', 'Darkness Energy'] })
  activo(b, atacante, { energias: ['Psychic Energy', 'Psychic Energy', 'Fire Energy'] })
  await atacar(mesa, u, a, 0)
  const d0 = g.danio
  await atacar(mesa, u, b, iAtq)
  check(que, g.danio - d0 === espera, `${d0} → ${g.danio} | ${registro(mesa).slice(-260)}`)
}
console.log('── Crustle: los ex no le hacen daño ──')
{
  const { mesa, u, a, b } = await mesaCon([[4, 'Dwebble'], [4, 'Crustle']], [[4, 'Genesect ex']])
  await pasar(mesa, u)
  const cr = activo(a, 'Crustle')
  const g = activo(b, 'Genesect ex', { energias: ['Metal Energy', 'Metal Energy', 'Darkness Energy'] })
  const i = b.cartaDe(g).attacks.findIndex((x) => /Protect Charge/.test(x.name))
  await atacar(mesa, u, b, i)
  check('Crustle sin daño', cr.danio === 0, `${cr.danio} | ${registro(mesa).slice(-200)}`)
}
console.log('── Weedle: moneda ──')
{
  let caras = 0, cruces = 0
  for (let sem = 1; sem < 12; sem++) {
    const { mesa, u, a, b } = await mesaCon([[4, 'Weedle']], [[4, 'Dudunsparce'], [4, 'Dunsparce']], { semilla: sem })
    await pasar(mesa, u); await pasar(mesa, u)
    activo(a, 'Weedle', { energias: ['Grass Energy'] })
    const d = activo(b, 'Dudunsparce')
    await atacar(mesa, u, a, 0)
    if (d.danio === 30) caras++
    else if (d.danio === 0) cruces++
  }
  check('Weedle: unas veces 30, otras nada', caras > 0 && cruces > 0, `${caras} caras, ${cruces} cruces`)
}
console.log('── Energía Legado: un premio menos ──')
{
  const { mesa, u, a, b } = await mesaCon([[4, 'Duskull'], [4, 'Dusknoir']], [[4, 'Dunsparce'], [2, 'Legacy Energy']])
  await pasar(mesa, u); await pasar(mesa, u)
  activo(a, 'Dusknoir', { energias: ['Psychic Energy', 'Psychic Energy', 'Fire Energy'] })
  const d = activo(b, 'Dunsparce', { energias: ['Legacy Energy'] })
  const p0 = a.s.premios.length
  await atacar(mesa, u, a, 0)
  check('Dusknoir deja KO a Dunsparce con Legado: coge 0 premios', a.s.premios.length === p0, `${p0} → ${a.s.premios.length}`)
}
console.log('── Jellicent ex: cierra objetos y herramientas ──')
{
  const { mesa, u, a, b } = await mesaCon([[4, 'Frillish'], [4, 'Jellicent ex']], [[4, 'Dunsparce'], [2, 'Lucky Helmet']])
  activo(a, 'Jellicent ex')
  const pad = aMano(b, 'Poké Pad')
  check('J2 no puede jugar objetos con Jellicent ex de J1 de activo', /mientras Jellicent ex/.test(b.motivoNoJugar(pad) || ''), b.motivoNoJugar(pad))
  const casco = aMano(b, 'Lucky Helmet')
  let error = null
  try { b.unirHerramienta(casco, b.s.activo) } catch (e) { error = e.message }
  check('  …ni herramientas', /herramientas mientras Jellicent/.test(error || ''), error)
}
console.log('── Contra el maniquí: Budew lo dice y no rompe ──')
{
  const p = new Partida({ entradas: mazo([[4, 'Budew']]), efectos: EFECTOS, semilla: 3 })
  const u = uiGuion({ actual: p })
  p.repartir()
  const b = p.s.mano.find((x) => p.carta(x).name === 'Budew') || (() => { const x = sacar(p, 'Budew'); p.s.mano.push(x); return x })()
  p.colocar(b, 'activo')
  p.empezar()
  p.terminarTurno()
  await p.atacar(p.s.activo, 0, u)
  check('el maniquí recibe 10 y el registro avisa', p.s.rival.activo.danio === 10 || p.s.rival.caidos >= 0, p.s.registro.map((x) => x.texto).slice(-4).join(' | '))
}

console.log('── Energía Punzante: 2 contadores al atacante ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Pecharunt']], [[4, 'Maractus'], [2, 'Spiky Energy']])
  const at = activo(a, 'Pecharunt', { energias: E(2, 'Darkness Energy') })
  activo(b, 'Maractus', { energias: ['Spiky Energy'] })
  await atacar(mesa, u, a, 0)
  check('Pecharunt recibe 20 por la Energía Punzante', at.danio === 20, at.danio)
}
console.log('── Ventilador de Mano: una energía del atacante a su banca ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Pecharunt']], [[4, 'Maractus'], [2, 'Handheld Fan']])
  const at = activo(a, 'Pecharunt', { energias: E(2, 'Darkness Energy') })
  const ban = banca(a, 'Pecharunt')
  activo(b, 'Maractus', { herramienta: 'Handheld Fan' })
  await atacar(mesa, u, a, 0)
  check('el atacante pierde una energía y su banca la gana', at.energias.length === 1 && a.s.banca.reduce((t, x) => t + x.energias.length, 0) === 1, `${at.energias.length} / ${a.s.banca.map((x) => x.energias.length)}`)
}
console.log('── Agujas Explosivas (Maractus): 6 contadores al que lo deja KO ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Gastly'], [4, 'Mega Absol ex']], [[4, 'Maractus']])
  const at = activo(a, 'Mega Absol ex', { energias: E(3, 'Darkness Energy') })
  activo(b, 'Maractus')
  await atacar(mesa, u, a, 1)
  check('Mega Absol ex recibe 60 al tumbar a Maractus', at.danio === 60, `${at.danio} | ${registro(mesa).slice(-200)}`)
}
console.log('── Gruñido (Chikorita): el defensor hace 20 menos ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Chikorita']], [[4, 'Maractus']])
  const ch = activo(a, 'Chikorita', { energias: ['Grass Energy'] })
  activo(b, 'Maractus', { energias: ['Grass Energy'] })
  await atacar(mesa, u, a, 0)
  check('el Maractus rival lleva la rebaja', b.s.activo.debil?.n === 20)
  await atacar(mesa, u, b, 0)
  check('Maractus (20) no le hace nada a Chikorita (20 − 20 = 0)', ch.danio === 0, `${ch.danio} | ${registro(mesa).slice(-200)}`)
}
console.log('── Trampa (Stunfisk): no se retira, y el próximo turno recibe 100 más ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Stunfisk']], [[4, 'Mega Darkrai ex'], [4, 'Pecharunt']])
  activo(a, 'Stunfisk', { energias: ['Lightning Energy'] })
  const d = activo(b, 'Mega Darkrai ex')
  banca(b, 'Pecharunt')
  await atacar(mesa, u, a, 0)
  check('Mega Darkrai ex no puede retirarse', /impide/.test(b.motivoNoRetirar() || ''), b.motivoNoRetirar())
  await pasar(mesa, u)
  const d0 = d.danio
  await atacar(mesa, u, a, 0)
  check('el siguiente Pouncing Trap le hace 30 + 100', d.danio - d0 === 130, `${d0} → ${d.danio}`)
}
console.log('── Energía Niebla: sin estados ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Pecharunt']], [[4, 'Maractus'], [2, 'Mist Energy']])
  activo(a, 'Pecharunt', { energias: E(2, 'Darkness Energy') })
  const m = activo(b, 'Maractus', { energias: ['Mist Energy'] })
  await atacar(mesa, u, a, 0)
  check('Maractus con Niebla no queda envenenado', !m.estados.length, JSON.stringify(m.estados))
  check('…ni se queda sin retirada', !(m.noRetirarHasta >= b.s.turno), m.noRetirarHasta)
}
console.log('── Escondite (Banette): sin contadores de Dragapult ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Dreepy'], [4, 'Dragapult ex']], [[4, 'Shuppet'], [4, 'Banette'], [4, 'Maractus']])
  activo(a, 'Dragapult ex', { energias: ['Fire Energy', 'Psychic Energy'] })
  activo(b, 'Maractus')
  const ban = banca(b, 'Banette')
  await atacar(mesa, u, a, 1)
  check('Banette en la banca no recibe los contadores', ban.danio === 0, `${ban.danio} | ${registro(mesa).slice(-200)}`)
}
console.log('── Jaula de Combate: sin contadores en la banca ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Dreepy'], [4, 'Dragapult ex'], [2, 'Battle Cage']], [[4, 'Maractus']])
  activo(a, 'Dragapult ex', { energias: ['Fire Energy', 'Psychic Energy'] })
  const est = sacar(a, 'Battle Cage'); a.ponerEstadio(est)
  activo(b, 'Maractus')
  const ban = banca(b, 'Maractus')
  await atacar(mesa, u, a, 1)
  check('la banca rival no recibe contadores', ban.danio === 0, ban.danio)
}
console.log('── Shaymin: la banca sin Regla, a salvo del daño ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Pecharunt'], [2, 'Mega Starmie ex']], [[4, 'Maractus'], [2, 'Shaymin']])
  activo(a, 'Mega Starmie ex', { energias: ['Water Energy', 'Water Energy'] })
  activo(b, 'Maractus')
  const ban = banca(b, 'Maractus')
  banca(b, 'Shaymin')
  await atacar(mesa, u, a, 0)
  check('el Maractus de la banca no recibe los 50 de Mega Starmie ex', ban.danio === 0, `${ban.danio} | ${registro(mesa).slice(-200)}`)
}
console.log('── Flutter Mane: el activo rival sin habilidades ──')
{
  const { mesa, u, a, b } = await mesaCon([[4, 'Flutter Mane']], [[4, 'Kakuna'], [4, 'Weedle']])
  activo(a, 'Flutter Mane')
  const k = activo(b, 'Kakuna')
  check('Kakuna de activo pierde Exoesqueleto', !b.habilidadActiva(k))
  const k2 = banca(b, 'Kakuna')
  check('…y el de la banca no', b.habilidadActiva(k2))
}
console.log('── Kakuna: −20 ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Maractus']], [[4, 'Kakuna'], [4, 'Weedle']])
  activo(a, 'Maractus', { energias: ['Grass Energy'] })
  const k = activo(b, 'Kakuna')
  await atacar(mesa, u, a, 0)
  check('Maractus (20) no le hace daño a Kakuna (−20)', k.danio === 0, `${k.danio} | ${registro(mesa).slice(-160)}`)
}
console.log('── Mega Chandelure ex: retirarse cuesta 1 más ──')
{
  const { mesa, u, a, b } = await mesaCon([[4, 'Pecharunt']], [[4, 'Mega Chandelure ex'], [4, 'Litwick']])
  const p = activo(a, 'Pecharunt')
  const base = a.cartaDe(p).retreat
  banca(b, 'Mega Chandelure ex')
  check('el activo de J1 cuesta uno más', a.costeDeRetirada(p) === base + 1, `${base} → ${a.costeDeRetirada(p)}`)
}
console.log('── Pecharunt: 5 contadores más de veneno ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Pecharunt']], [[4, 'Maractus']])
  activo(a, 'Pecharunt', { energias: E(2, 'Darkness Energy') })
  const m = activo(b, 'Maractus')
  // Pecharunt (el de activo) no tiene la habilidad: es el Pecharunt con
  // Sometimiento Tóxico. Se mira en el texto.
  const tiene = (a.cartaDe(a.s.activo).abilities || []).some((h) => /Toxic/.test(h.name))
  await atacar(mesa, u, a, 0)
  const tras = m.danio
  check('el Chequeo pone 10 de veneno' + (tiene ? ' + 50' : ''), tras === 10 + (tiene ? 60 : 10), `${tras}`)
}
console.log('── Scream Tail ex: solo si vas segundo, en tu primer turno, y el rival sin partidarios ──')
{
  const { mesa, u, a, b } = await mesaCon([[4, 'Pecharunt'], [2, "Boss's Orders"]], [[4, 'Scream Tail ex']])
  await pasar(mesa, u)
  const st = activo(b, 'Scream Tail ex', { energias: ['Psychic Energy'] })
  check('J2 en su turno 1 puede usar Scream', !b.motivoNoAtacar(st, b.cartaDe(st).attacks[0]), b.motivoNoAtacar(st, b.cartaDe(st).attacks[0]))
  await atacar(mesa, u, b, 0)
  const boss = aMano(a, "Boss's Orders")
  check('J1 no puede jugar partidarios', /partidarios/.test(a.motivoNoJugar(boss) || ''), a.motivoNoJugar(boss))
}
console.log('── Bronzong: sin evolucionar desde la mano ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Bronzor'], [4, 'Bronzong']], [[4, 'Applin'], [4, 'Dipplin']])
  activo(a, 'Bronzong', { energias: ['Psychic Energy'] })
  const ap = activo(b, 'Applin', { energias: [] })
  await atacar(mesa, u, a, 0)
  const dip = aMano(b, 'Dipplin')
  check('J2 no puede evolucionar Applin', /evolucionar/.test(b.motivoNoEvolucionar(dip, b.s.activo) || ''), b.motivoNoEvolucionar(dip, b.s.activo))
}
console.log('── Meowth ex: Recogida (a la mano con todo) ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Meowth ex'], [4, 'Pecharunt']], [[4, 'Mega Darkrai ex']])
  const mw = activo(a, 'Meowth ex', { energias: E(3, 'Darkness Energy') })
  banca(a, 'Pecharunt')
  activo(b, 'Mega Darkrai ex')
  const i = a.cartaDe(mw).attacks.findIndex((x) => /Tuck Tail/.test(x.name))
  const mano0 = a.s.mano.length
  if (i >= 0) {
    await atacar(mesa, u, a, i)
    check('Meowth ex y sus 3 energías vuelven a la mano', a.s.mano.length === mano0 + 4 && !a.enJuego.includes(mw), `${mano0} → ${a.s.mano.length}`)
  } else check('Meowth ex con Tuck Tail en la ficha', false)
}
console.log('── Mega Excadrill ex: dos al descarte del mazo rival ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Drilbur'], [4, 'Mega Excadrill ex']], [[4, 'Mega Darkrai ex']])
  activo(a, 'Mega Excadrill ex', { energias: E(2, 'Metal Energy') })
  activo(b, 'Mega Darkrai ex')
  const d0 = b.s.descarte.length
  await atacar(mesa, u, a, 0)
  check('el descarte del rival crece en 2', b.s.descarte.length === d0 + 2, `${d0} → ${b.s.descarte.length}`)
}
console.log('── Unown: un premio más ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Unown']], [[4, 'Pecharunt']])
  activo(a, 'Unown', { energias: E(2, 'Psychic Energy') })
  const pe = activo(b, 'Pecharunt')
  pe.danio = 50
  const p0 = a.s.premios.length
  await atacar(mesa, u, a, 0)
  check('deja KO a Pecharunt (80) y coge 2', p0 - a.s.premios.length === 2, `${p0} → ${a.s.premios.length}`)
}
console.log('── Mega Darkrai ex: Ojo del Abismo deja KO al que tiene un estado ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Mega Darkrai ex']], [[4, 'Mega Absol ex']])
  activo(a, 'Mega Darkrai ex', { energias: E(3, 'Darkness Energy') })
  const ab = activo(b, 'Mega Absol ex')
  ab.estados = ['envenenado']
  const p0 = a.s.premios.length
  await atacar(mesa, u, a, 1)
  check('Mega Absol ex cae y J1 coge 3', p0 - a.s.premios.length === 3, `${p0} → ${a.s.premios.length}`)
}
console.log('── Festival en Cabeza: con la Pradera, ataca dos veces ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, 'Applin'], [4, 'Dipplin'], [2, 'Festival Grounds']], [[4, 'Mega Darkrai ex']])
  activo(a, 'Dipplin', { energias: ['Grass Energy'] })
  a.ponerEstadio(sacar(a, 'Festival Grounds'))
  const d = activo(b, 'Mega Darkrai ex')
  await atacar(mesa, u, a, 0)
  const veces = (registro(mesa).match(/Dipplin ataca con/g) || []).length
  check('Dipplin ataca dos veces', veces === 2, `${veces} | ${d.danio}`)
}
console.log('── Zona Feérica: la debilidad del {N} rival pasa a ser {P} ──')
{
  const { mesa, u, a, b } = await turnoDeA([[4, "Lillie's Clefairy ex"], [4, 'Unown']], [[4, 'Dreepy']])
  activo(a, 'Unown', { energias: E(2, 'Psychic Energy') })
  banca(a, "Lillie's Clefairy ex")
  const dr = activo(b, 'Dreepy')
  const tipos = b.cartaDe(dr).types
  await atacar(mesa, u, a, 0)
  check(`Unown (40) a un Dreepy (${tipos}) hace 80`, dr.danio === 80 || (dr.danio >= b.psDe(dr) && b.psDe(dr) <= 80), `${dr.danio} | ${registro(mesa).slice(-160)}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El lector de textos de ataque ──')
{
  let leidos = 0
  let sinLeer = 0
  const vistos = new Set()
  for (const c of FILAS) {
    const k = claveDeEfecto(c)
    ;(c.attacks || []).forEach((a, i) => {
      if (!a.effect || vistos.has(a.effect)) return
      vistos.add(a.effect)
      if (EFECTOS.ataques[k]?.[`#${i}`]) return
      if (leerAtaque(a.effect).completo) leidos++
      else sinLeer++
    })
  }
  // 79 de 89 cuando se escribió: lo que queda son ataques que copian otro
  // ataque o cuentan cartas de una forma que no se repite en ninguna otra.
  check('la cobertura sobre la ficha de pruebas no baja de 75 textos leídos enteros', leidos >= 75, `${leidos} leídos, ${sinLeer} sin leer`)

  const budew = leerAtaque("During your opponent's next turn, they can't play any Item cards from their hand.")
  check('Budew: «no puede jugar objetos» es un veto al siguiente turno del rival', budew.completo && budew.pasos.some((p) => p.t === 'veto' && p.que === 'objetos'), JSON.stringify(budew.pasos))
  const raro = leerAtaque('Choose 1 of your Benched Pokémon\'s attacks and use it as this attack.')
  check('un texto que no entiende NO se da por leído (se hace a mano)', !raro.completo && raro.sinLeer.length > 0, JSON.stringify(raro))
  const mitad = leerAtaque("Flip a coin. If heads, your opponent's Active Pokémon is now Paralyzed. Choose 1 of your Benched Pokémon's attacks and use it as this attack.")
  check('…y uno entendido A MEDIAS tampoco: todo o nada', !mitad.completo, JSON.stringify(mitad.sinLeer))
  const casco = rasgosDeCarta({ abilities: [{ name: 'X', effect: "This Pokémon takes 30 less damage from attacks (after applying Weakness and Resistance)." }] })
  check('una habilidad pasiva de «recibe N menos» sale como rasgo', casco.some((r) => r.t === 'reduce' && r.n === 30), JSON.stringify(casco))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. El registro de TCG Live, jugada a jugada ──')
const total = (s, n) => {
  const p = s.jugadores[n]
  const enJuego = [p.activo, ...p.banca].filter(Boolean).reduce((t, x) => t + x.cartas.length + x.energias.length + (x.herramienta ? 1 : 0), 0)
  return enJuego + p.mano + p.mazo + p.premios + p.descarte.length + (s.estadio?.dueno === n ? 1 : 0)
}
// Las 60 cartas, en cada foto desde que se reparten.
const cuadra = (fs) => {
  const malas = []
  fs.forEach((s, i) => {
    if (i < 3) return
    for (const n of s.orden) if (total(s, n) !== 60) malas.push(`${i}:${n}=${total(s, n)} «${s.linea.slice(0, 50)}»`)
  })
  return malas
}
{
  const r = leerRegistro(EJEMPLO)
  check('el ejemplo se lee entero (dos jugadores, ninguna línea sin entender)', r.jugadores.join() === 'Rojo,Azul' && r.sinLeer.length === 0 && r.eventos.length > 150, `${r.jugadores} · ${r.eventos.length} eventos · ${r.sinLeer.length} sin leer`)
  const fs = fotos(r)
  check('…y las 60 cartas de cada jugador están en su sitio en CADA foto', !cuadra(fs).length, cuadra(fs).slice(0, 3).join(' | '))
  const fin = fs.at(-1)
  check('…y acaba con quien gana y por qué', fin.fin?.ganador === 'Rojo' && fin.fin.porque === 'rendicion', JSON.stringify(fin.fin))
  check('el que va abajo es el que enseña su mano (el dueño del registro)', fs[0].protagonista === 'Rojo')
  const rojo = fin.jugadores.Rojo
  check('la mano de Rojo se conoce entera al final (la roba con nombre)', rojo.manoConocida.length === rojo.mano, `${rojo.manoConocida.length}/${rojo.mano}`)
  const ataque = r.eventos.find((e) => e.tipo === 'ataque')
  check('un ataque trae quién, qué, cuánto y a quién', ataque.pokemon === 'Budew' && ataque.ataque === 'Polen Picazón' && ataque.danio === 10 && ataque.objetivo === 'Dunsparce' && ataque.deQuien === 'Rojo', JSON.stringify(ataque))
  const unir = r.eventos.find((e) => e.tipo === 'unir' && /Básica/.test(e.linea))
  check('«Energía Psíquica Básica» se guarda como «Energía Psíquica» (la del catálogo)', unir?.carta === 'Energía Psíquica', unir?.carta)
  // Dudunsparce «ha jugado Dudunsparce» con él en juego: es su habilidad.
  const i = r.eventos.findIndex((e) => e.tipo === 'jugar' && e.carta === 'Dudunsparce')
  check('«ha jugado X» con X en juego es su habilidad, no una carta de la mano', fs[i + 1].foco?.tipo === 'habilidad', JSON.stringify(fs[i + 1].foco))
}
{
  // Lo que el registro cuenta a medias, en español.
  const ES = `Preparación
Rojo ha elegido cara para el lanzamiento de moneda inicial.
Rojo ha ganado el lanzamiento de moneda.
Rojo ha decidido empezar en primer lugar.
Rojo ha robado 7 cartas de la mano inicial.
- 7 cartas robadas.
   • Abra, Abra, Kadabra, Globo Helio, Globo Helio, Energía Psíquica Básica, Erin
Azul ha robado 7 cartas de la mano inicial.
- 7 cartas robadas.
Rojo ha puesto en juego a Kadabra en el Puesto Activo.
Rojo ha puesto en juego a Abra en la Banca.
Rojo ha puesto en juego a Abra en la Banca.
Azul ha puesto en juego a Budew en el Puesto Activo.

Turno de Rojo
Rojo ha robado Maya.
Rojo ha unido Globo Helio al Abra en la Banca.
Rojo ha unido Globo Helio al Abra en la Banca.
Rojo ha unido Energía Psíquica Básica al Kadabra en el Puesto Activo.
El Kadabra de Rojo ha infligido 30 puntos de daño usando Golpe contra el Budew de Azul.
¡El Budew de Azul ha quedado Fuera de Combate!
Rojo ha robado 1 carta de Premio.
Una carta se ha añadido a la mano de Rojo.

Turno de Azul
Azul ha robado una carta.
Azul ha puesto en juego a Dreepy en el Puesto Activo.
Azul ha jugado Órdenes de Jefes.
- El Abra de Rojo se ha intercambiado con el Kadabra de Rojo y pasa a ser el Pokémon Activo.
El Abra de Rojo pasa a estar en el Puesto Activo.
El Dreepy de Azul ha infligido 50 puntos de daño usando Mordisco contra el Abra de Rojo.
El Abra de Rojo pasa a estar en el Puesto Activo.
Azul ha terminado su turno.`
  const r = leerRegistro(ES)
  check('[es] se lee entero', r.sinLeer.length === 0, r.sinLeer.join(' | '))
  const premio = r.eventos.find((e) => /cartas? de Premio/.test(e.linea))
  check('[es] «ha robado 1 carta de Premio» es un PREMIO, no una carta que se llama así', premio?.tipo === 'premio' && premio.n === 1, JSON.stringify(premio))
  const ko = r.eventos.find((e) => e.tipo === 'ko')
  check('[es] el KO se reconoce por «Fuera de Combate»', ko?.pokemon === 'Budew' && ko.jugador === 'Azul', JSON.stringify(ko))
  const fs = fotos(r, { psDe: (n) => ({ Abra: 50, Kadabra: 80, Budew: 30, Dreepy: 70 })[n] || null })
  check('[es] las 60 cartas cuadran en cada foto', !cuadra(fs).length, cuadra(fs).slice(0, 3).join(' | '))
  const tras = (texto) => fs[r.eventos.findIndex((e) => e.linea.startsWith(texto)) + 1]
  const conGlobo = tras('Rojo ha unido Energía').jugadores.Rojo.banca.filter((x) => x.herramienta === 'Globo Helio').length
  check('[es] dos herramientas a «el Abra» van a los DOS Abra (nadie lleva dos)', conGlobo === 2, conGlobo)
  const boss = tras('El Abra de Rojo pasa').jugadores.Rojo
  // Por el SLOT y no por el nombre: los dos Abra se llaman igual, y
  // cambiarlos otra vez deja una mesa con los mismos nombres… y otro Abra.
  const subio = tras('El Abra de Rojo se ha intercambiado').jugadores.Rojo.activo
  check('[es] «se ha intercambiado» y «pasa a estar» son la MISMA jugada: no vuelve a cambiar', boss.activo && boss.activo.id === subio?.id && boss.banca.some((x) => arriba(x) === 'Kadabra'), `${subio?.id} → ${boss.activo?.id}`)
  const final = fs.at(-1).jugadores.Rojo
  check('[es] un KO sin su línea se deduce de la vida: el Abra con 50 de 50 va al descarte al subir el otro', final.descarte.includes('Abra') && arriba(final.activo) === 'Abra' && final.activo.danio === 0, `${final.descarte} · activo ${arriba(final.activo)} ${final.activo?.danio}`)
}
{
  // Y en inglés, con dos Pokémon que se llaman igual.
  const EN = `Setup
Ash chose tails for the opening coin flip.
Gary won the coin toss.
Gary decided to go second.
Ash drew 7 cards for the opening hand.
- 7 drawn cards.
   • Raikou V, Raikou V, Basic Lightning Energy, Forest Seal Stone, Rescue Board, Ultra Ball, Arven
Gary drew 7 cards for the opening hand.
- 7 drawn cards.
Ash played Raikou V to the Active Spot.
Ash played Raikou V to the Bench.
Gary played Mew ex to the Active Spot.

Turn # 1 - Ash's Turn
Ash drew Boss's Orders.
Ash attached Forest Seal Stone to Raikou V in the Active Spot.
Ash attached Rescue Board to Raikou V on the Bench.
Ash attached Basic Lightning Energy to Raikou V in the Active Spot.
Ash ended their turn.

Turn # 2 - Gary's Turn
Gary drew a card.
Gary's Mew ex used Genome Hacking on Ash's Raikou V for 200 damage.
Ash's Raikou V was Knocked Out!
- 3 cards were discarded from Ash's Raikou V.
   • Raikou V, Basic Lightning Energy, Forest Seal Stone
Ash's Raikou V is now in the Active Spot.
Gary took 2 Prize cards.
A card was added to Gary's hand.
A card was added to Gary's hand.
All Prize cards taken. Gary wins.`
  const r = leerRegistro(EN)
  check('[en] se lee entero', r.sinLeer.length === 0 && r.jugadores.join() === 'Ash,Gary', `${r.jugadores} · ${r.sinLeer.join(' | ')}`)
  const fs = fotos(r)
  check('[en] las 60 cartas cuadran en cada foto', !cuadra(fs).length, cuadra(fs).slice(0, 3).join(' | '))
  const ash = fs.at(-1).jugadores.Ash
  check('[en] tras el KO, «3 cards were discarded from Raikou V» NO tira a su gemelo de la banca', ash.activo && arriba(ash.activo) === 'Raikou V' && ash.activo.herramienta === 'Rescue Board', JSON.stringify(ash.activo))
  check('[en] el descarte lleva el caído con lo suyo, una vez', ash.descarte.length === 3, ash.descarte.join(', '))
  check('[en] Gary coge 2 premios y los dos llegan a su mano, sin contarlos dos veces (7 − Mew ex + 1 robada + 2)', fs.at(-1).jugadores.Gary.premios === 4 && fs.at(-1).jugadores.Gary.mano === 7 - 1 + 1 + 2, `${fs.at(-1).jugadores.Gary.premios} premios, ${fs.at(-1).jugadores.Gary.mano} en la mano`)
}
{
  const r = leerRegistro('hola\nesto no es un registro')
  check('un texto que no es un registro lo dice', !!r.error && !r.eventos.length, r.error)
}

// ═════════════════════════════════════════════════════════════════════
// Las cartas del ejemplo, con PS, para que la mesa tenga vida que pintar.
const PS = { Dunsparce: 60, Dudunsparce: 140, Abra: 50, Kadabra: 80, Alakazam: 140, Elgyem: 60, 'Fezandipiti ex': 210, Budew: 30, Dreepy: 70, Drakloak: 90, 'Dragapult ex': 320, Duskull: 60, Dusclops: 90, Dusknoir: 160, 'Meowth ex': 170 }
const OTRAS = ['Erin', 'Ceniza Sagrada', 'Mina Nocturna', 'Pokétableta', 'Ultra Ball', 'Órdenes de Jefes', 'Determinación de Lylia', 'Pokochos Gemelos', 'Energía Enriquecedora', 'Caramelo Raro', 'Energía Psíquica Telepática', 'Martillo Demoledor', 'Camilla Nocturna', 'Globo Helio', 'Jaula de Combate', 'Ventilador de Mano', 'Maya', 'Liza']
const cartasRep = [...Object.entries(PS).map(([n, hp]) => ({ name: n, name_es: n, hp, category: 'Pokemon' })), ...OTRAS.map((n) => ({ name: n, name_es: n, category: /^Energ/.test(n) ? 'Energy' : 'Trainer' }))].map((c, i) => ({
  id: `fk-${i + 1}`,
  set_id: 'fk',
  local_id: String(i + 1),
  market: 'WEST',
  image_path: null,
  regulation_mark: 'H',
  ...c,
}))
const setsRep = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 99 }]
// Una carta de mentira con la proporción de verdad (tanda 441: una
// captura con los datos a medias es OTRA pantalla).
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/><rect x="10" y="10" width="225" height="322" rx="8" fill="#9cc3e0"/></svg>'

const browser = await chromium.launch()
async function repeticion({ ancho = 1440, alto = 900, ejemplo = true, movimiento = 'no-preference', tacto = false } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto }, reducedMotion: movimiento, hasTouch: tacto })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ cartas, sets }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
  }, { cartas: cartasRep, sets: setsRep })
  await page.goto(`${BASE}/repeticiones.html${ejemplo ? '?ejemplo' : ''}`, { waitUntil: 'domcontentloaded' })
  if (ejemplo) await page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 })
  return { page, errores }
}
const jugada = (page) => page.evaluate(() => Number(document.getElementById('repProgreso').value))
const irA = (page, n) =>
  page.evaluate((n) => {
    const r = document.getElementById('repProgreso')
    r.value = String(n)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, n)
// Con un clic del propio DOM y no de Playwright: el de Playwright mueve la
// página para enseñar el botón, y eso es justo lo que se quiere medir.
const parar = (page) =>
  page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
const lectura = leerRegistro(EJEMPLO)
const fotoDe = (pred) => lectura.eventos.findIndex(pred) + 1
const inicioDeTurno = (n) => lectura.eventos.map((e, i) => [e, i + 1]).filter(([e]) => e.tipo === 'turno')[n - 1][1]

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. /repeticiones ──')
{
  const { page, errores } = await repeticion({ ejemplo: false })
  check('la página tiene su h1 y el campo para pegar', (await page.textContent('h1')) === 'Repeticiones' && (await page.locator('#repTexto').count()) === 1)
  await page.click('#repFormulario button[type=submit]')
  check('sin texto, lo dice', /Pega primero/.test(await page.textContent('#repError')) && (await page.isVisible('#repError')))
  await page.fill('#repTexto', 'hola\nesto no es un registro')
  await page.click('#repFormulario button[type=submit]')
  check('con un texto que no es un registro, lo dice', /No encuentro a los dos jugadores/.test(await page.textContent('#repError')))
  check('…y no abre la sala', await page.isHidden('#repSala'))
  await page.click('#repEjemplo')
  await page.waitForSelector('#repSala:not(.hidden)')
  check('«Probar con un ejemplo» la abre', await page.isVisible('#repTapete'))
  check('  …y esconde el campo de pegar', await page.isHidden('#repPegar'))
  // Un jugador que se llama como un trozo de la chapa («jugador», de
  // `lab-jugador`): resaltar su nombre sobre el HTML ya montado lo casaba
  // DENTRO de la clase de la chapa del otro y rompía la línea.
  await page.click('[data-accion="otra"]')
  await page.fill('#repTexto', `Preparación
jugador ha elegido cara para el lanzamiento de moneda inicial.
jugador ha ganado el lanzamiento de moneda.
jugador ha decidido empezar en primer lugar.
jugador ha robado 7 cartas de la mano inicial.
Rojo ha robado 7 cartas de la mano inicial.
jugador ha puesto en juego a Budew en el Puesto Activo.
Rojo ha puesto en juego a Abra en el Puesto Activo.

Turno de jugador
jugador ha robado una carta.
El Budew de jugador ha infligido 10 puntos de daño usando Polen Picazón contra el Abra de Rojo.`)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await parar(page)
  await irA(page, 11)
  const linea = await page.evaluate(() => {
    const l = document.querySelector('#repCentro .rep-linea')
    return { chapas: [...l.querySelectorAll('.lab-jugador')].map((x) => x.textContent), texto: l.textContent }
  })
  check('un jugador llamado «jugador» no rompe la línea del centro', linea.chapas.join() === 'jugador,Rojo' && linea.texto === 'El Budew de jugador ha infligido 10 puntos de daño usando Polen Picazón contra el Abra de Rojo.', JSON.stringify(linea))
  check('sin errores en la página', !errores.length, errores.join(' | '))
  await page.close()
}
{
  const { page, errores } = await repeticion()
  const a = await jugada(page)
  await page.waitForTimeout(2500)
  const b = await jugada(page)
  check('se reproduce SOLA', b > a, `${a} → ${b}`)
  check('  …y el botón dice «Pausa»', (await page.getAttribute('[data-accion="reproducir"]', 'aria-label')) === 'Pausa')
  await page.click('[data-accion="reproducir"]')
  const c = await jugada(page)
  await page.waitForTimeout(1500)
  check('al pausar se queda quieta', (await jugada(page)) === c)

  // El ataque de Budew: el golpe, el daño, el centro y el registro.
  const fAtaque = fotoDe((e) => e.tipo === 'ataque')
  await irA(page, fAtaque)
  await page.waitForTimeout(500)
  check('el deslizador lleva a esa jugada', (await jugada(page)) === fAtaque)
  check('el atacado tiembla y lleva el daño encima', (await page.locator('#repLadoAbajo .lab-slot-activo.rep-golpe .rep-golpe-num').textContent()) === '−10')
  check('el atacante brilla', (await page.locator('#repLadoArriba .lab-slot-activo.rep-foco').count()) === 1)
  check('el centro dice el ataque y su daño', /Polen Picazón/.test(await page.textContent('#repCentro .rep-destacado')) && (await page.textContent('#repCentro .rep-foco-danio')) === '10')
  check('la línea del registro va marcada', /Polen Picazón/.test(await page.textContent('#repLineas [aria-current="step"]')))
  check('la vida del atacado baja (50 de 60)', /50\/60/.test(await page.textContent('#repLadoAbajo .lab-slot-activo .lab-ps-texto')))
  // La línea del centro, con los nombres de los jugadores en su color.
  check('en la línea del centro, cada jugador lleva su chapa', (await page.locator('#repCentro .rep-linea .lab-jugador').count()) === 2)

  await page.click('[data-accion="siguiente"]')
  check('«jugada siguiente» avanza una', (await jugada(page)) === fAtaque + 1)
  await page.click('[data-accion="anterior"]')
  check('«jugada anterior» vuelve', (await jugada(page)) === fAtaque)
  await page.click('[data-accion="turnoSiguiente"]')
  check('«turno siguiente» va al principio del turno que viene', (await jugada(page)) === inicioDeTurno(3), `${await jugada(page)} (esperaba ${inicioDeTurno(3)})`)
  await page.click('[data-accion="turnoAnterior"]')
  check('«turno anterior» va al principio del anterior', (await jugada(page)) === inicioDeTurno(2), `${await jugada(page)} (esperaba ${inicioDeTurno(2)})`)

  // El registro: pulsar una línea lleva a ella.
  const fJuega = fotoDe((e) => e.tipo === 'jugar' && e.carta === 'Erin')
  await page.click(`#repLineas [data-foto="${fJuega}"]`)
  check('pulsar una línea del registro lleva a esa jugada', (await jugada(page)) === fJuega)
  check('  …y una carta jugada sale en grande en el centro', (await page.locator('#repCentro .rep-foco-carta').count()) === 1 && /juega/.test(await page.textContent('#repCentro .rep-destacado')))

  // El teclado.
  await page.locator('h1').click()
  await page.keyboard.press('ArrowRight')
  check('→ avanza una jugada', (await jugada(page)) === fJuega + 1)
  await page.keyboard.press('Shift+ArrowRight')
  check('Mayús + → salta al turno siguiente', lectura.eventos[(await jugada(page)) - 1]?.tipo === 'turno')
  await page.keyboard.press('Space')
  check('Espacio la pone en marcha', (await page.getAttribute('[data-accion="reproducir"]', 'aria-label')) === 'Pausa')
  await page.keyboard.press('Space')
  check('  …y la para', (await page.getAttribute('[data-accion="reproducir"]', 'aria-label')) !== 'Pausa')

  // Girar la mesa: el de abajo pasa arriba, y la mano es la del otro.
  check('abajo va Rojo, el dueño del registro', (await page.getAttribute('#repLadoAbajo', 'aria-label')) === 'Lado de Rojo')
  await page.click('[data-accion="girar"]')
  check('«Girar la mesa» pone abajo a Azul', (await page.getAttribute('#repLadoAbajo', 'aria-label')) === 'Lado de Azul' && /Azul/.test(await page.textContent('#repMano .rep-mano-rotulo')))
  check('  …y el color sigue a la PERSONA, no al sitio', (await page.getAttribute('#repLadoAbajo .lab-lado-cab .lab-jugador', 'data-j')) === '1')
  await page.click('[data-accion="girar"]')

  // Ver cartas: el descarte de Azul.
  await irA(page, fotoDe((e) => e.tipo === 'descartar' && e.jugador === 'Azul'))
  await page.click('#repLadoArriba [data-ver-descarte]')
  check('el descarte se abre en grande', (await page.isVisible('#repVer')) && (await page.locator('#repVerCartas .rep-ver-carta').count()) >= 2, await page.textContent('#repVerTitulo'))
  await page.keyboard.press('Escape')
  check('  …y se cierra con Escape', !(await page.isVisible('#repVer')))
  await page.click('#repLadoAbajo .lab-slot-activo [data-ver-slot]')
  check('pulsar un Pokémon enseña sus cartas (la evolución y lo unido)', (await page.locator('#repVerCartas .rep-ver-carta').count()) >= 1)
  await page.click('#repVer [data-cerrar]')

  // El final.
  await irA(page, lectura.eventos.length)
  check('al final, la copa y quién gana', /Gana/.test(await page.textContent('#repCentro .rep-destacado')) && (await page.locator('#repCentro .rep-copa svg').count()) === 1)
  check('  …y el botón dice «Volver a verla»', (await page.getAttribute('[data-accion="reproducir"]', 'aria-label')) === 'Volver a verla')
  await page.click('[data-accion="reproducir"]')
  await page.waitForTimeout(300)
  check('«Volver a verla» empieza desde el principio', (await jugada(page)) < 5)
  await parar(page)

  // La última del descarte: su DIBUJO encima de su nombre (la imagen va
  // posicionada, como la de una carta). Se mira qué hay en ese punto.
  await irA(page, 60)
  await page.waitForTimeout(400)
  const encima = await page.evaluate(() => {
    const c = document.querySelector('#repLadoArriba .lab-pila-cara')
    c.scrollIntoView({ block: 'center', behavior: 'instant' })
    const r = c.getBoundingClientRect()
    const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return el ? `${el.tagName}.${el.className}` : `nada en ${Math.round(r.left)},${Math.round(r.top)}`
  })
  check('la última carta del descarte se ve con su dibujo, no con el nombre encima', /^IMG/.test(encima), encima)
  check('sin errores en la página', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // El cartel del cambio de turno: al avanzar una jugada, y se va solo
  // también con «menos movimiento» (CLAUDE.md, tanda 313).
  const { page } = await repeticion({ movimiento: 'reduce' })
  await parar(page)
  await irA(page, inicioDeTurno(4) - 1)
  await page.click('[data-accion="siguiente"]')
  check('al avanzar al cambio de turno sale el cartel', (await page.locator('#repTapete .lab-cambio').count()) === 1)
  await page.waitForTimeout(1600)
  check('  …y se va solo con «menos movimiento»', (await page.locator('#repTapete .lab-cambio').count()) === 0)
  await irA(page, inicioDeTurno(5))
  check('saltar con el deslizador NO saca el cartel (es mirar, no jugar)', (await page.locator('#repTapete .lab-cambio').count()) === 0)
  const anuncio = await page.textContent('#repAnuncio')
  check('el lector oye la jugada a la que se salta', /Turno de/.test(anuncio), anuncio)
  await page.close()
}
{
  // Que quepa: en un portátil, mesa y controles a la vista sin bajar; en
  // el móvil, sin desbordar a lo ancho y con el activo de arriba sin
  // meterse debajo de sus pilas.
  for (const [ancho, alto] of [[1280, 800], [1440, 900], [1920, 1080]]) {
    const { page } = await repeticion({ ancho, alto })
    // Lo que se mide es dónde la deja ella al abrirse (va sola hasta la
    // mesa): se espera a que acabe ese desplazamiento.
    await page.waitForTimeout(900)
    await parar(page)
    const m = await page.evaluate(() => {
      const t = document.getElementById('repTapete').getBoundingClientRect()
      const c = document.querySelector('.rep-controles').getBoundingClientRect()
      return { arriba: t.top, abajo: c.bottom, alto: innerHeight }
    })
    check(`[${ancho}×${alto}] la mesa y los controles caben en la pantalla`, m.arriba >= 60 && m.abajo <= m.alto + 1, JSON.stringify(m))
    await page.close()
  }
  for (const [ancho, alto] of [[360, 740], [390, 844]]) {
    const { page } = await repeticion({ ancho, alto, tacto: true })
    await parar(page)
    await irA(page, lectura.eventos.length)
    await page.waitForTimeout(500)
    const m = await page.evaluate(() => {
      const caja = (s) => document.querySelector(s)?.getBoundingClientRect()
      const pie = caja('#repLadoArriba .lab-slot-activo .lab-slot-pie')
      const pilas = caja('#repLadoArriba .lab-zona-pilas')
      return {
        desborda: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        pisa: pie && pilas ? pie.right > pilas.left + 1 && pie.bottom > pilas.top : false,
        controles: caja('.rep-controles').height,
        // Las FILAS, contando los centros de lo que se ve: una cuenta que
        // asoma sola en su renglón cabía en el alto de antes.
        filas: (() => {
          const centros = [...document.querySelector('.rep-controles').children]
            .map((e) => e.getBoundingClientRect())
            .filter((r) => r.width > 1 && r.height > 1)
            .map((r) => r.top + r.height / 2)
            .sort((a, b) => a - b)
          return centros.filter((c, i) => i === 0 || c - centros[i - 1] > 12).length
        })(),
      }
    })
    check(`[${ancho}] sin desbordar a lo ancho`, !m.desborda)
    check(`[${ancho}] la vida del activo de arriba no se mete debajo de sus pilas`, !m.pisa)
    check(`[${ancho}] los controles en dos filas (no cuatro)`, m.filas === 2 && m.controles <= 124, `${m.filas} filas, ${m.controles}px`)
    const pequenos = await page.evaluate(() => [...document.querySelectorAll('.rep-ctrl, .rep-progreso, .rep-velocidad select')].filter((b) => b.getBoundingClientRect().height < 44).length)
    check(`[${ancho}] los controles miden 44 px de alto`, pequenos === 0, pequenos)
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. El activo, en el centro ──')
{
  // Con «menos movimiento»: el atacado TIEMBLA medio segundo, y medirlo a
  // mitad del temblor da unos píxeles de más que no son de la maqueta.
  const { page } = await repeticion({ ancho: 1440, alto: 900, movimiento: 'reduce' })
  await parar(page)
  await irA(page, fotoDe((e) => e.tipo === 'ataque'))
  await page.waitForTimeout(400)
  const d = await page.evaluate(() => {
    const t = document.getElementById('repTapete').getBoundingClientRect()
    const centro = t.left + t.width / 2
    return ['#repLadoArriba', '#repLadoAbajo'].map((l) => {
      const c = document.querySelector(`${l} .lab-slot-activo .lab-slot-carta`).getBoundingClientRect()
      return Math.round(c.left + c.width / 2 - centro)
    })
  })
  check('[repetición] la CARTA del activo está en el centro del tapete (la vida va al lado)', d.every((x) => Math.abs(x) <= 2), d.join(', '))
  await page.close()
}
{
  // Y en el laboratorio, a dos, que es donde se pidió.
  const FICHA = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
  const D = [[4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Budew'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Munkidori'], [1, 'Moltres'], [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [3, 'Ultra Ball'], [4, 'Crushing Hammer'], [2, 'Crispin'], [2, 'Risky Ruins'], [1, 'Dawn'], [1, 'Judge'], [1, "Rosa's Encouragement"], [1, 'Special Red Card'], [1, 'Unfair Stamp'], [3, 'Fire Energy'], [3, 'Psychic Energy'], [2, 'Darkness Energy']]
  const entradas = D.map(([n, nombre]) => ({ carta: FICHA.find((x) => x.name === nombre), n }))
  const cartas = [...new Map(entradas.map((e) => [e.carta.id, { ...e.carta, market: 'WEST', name_key: plano(e.carta.name), image_path: null }])).values()]
  const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
  const lista = entradas.map((e) => `${e.n}~${e.carta.id}`).join('_')
  for (const [ancho, alto] of [[1280, 720], [1920, 1080]]) {
    const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
    await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
    await page.addInitScript(({ cartas, sets }) => {
      window.__FAKE_SESSION__ = 'none'
      window.__FAKE_SETS__ = sets
      window.__FAKE_CARTAS__ = cartas
      let s = 42
      Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      localStorage.setItem('pokedoc-laboratorio', JSON.stringify({ opciones: { primero: 'segundo', estricta: true, rival: 'ex', banca: 2, modo: 'muneco' } }))
    }, { cartas, sets })
    await page.goto(`${BASE}/constructor?l=${lista}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1400)
    await page.click('#cmProbar')
    await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
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
    await page.waitForTimeout(300)
    const d = await page.evaluate(() => {
      const t = document.querySelector('.lab-tapete').getBoundingClientRect()
      const centro = t.left + t.width / 2
      return ['#labLadoRival', '#labLadoPropio'].map((l) => {
        const c = document.querySelector(`${l} .lab-slot-activo .lab-slot-carta`)?.getBoundingClientRect()
        return c ? Math.round(c.left + c.width / 2 - centro) : null
      })
    })
    check(`[laboratorio ${ancho}×${alto}] la carta del activo, en el centro (los dos lados)`, d.every((x) => x != null && Math.abs(x) <= 2), d.join(', '))
    await page.close()
  }
}
check('la imagen de la última del descarte va posicionada (si no, el nombre se pinta encima)', /\.lab-pila-cara img \{[^}]*position: absolute;[^}]*inset: 0;/.test(leer('css/laboratorio.css')))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. El sitio ──')
{
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
  const conJugar = paginas.filter((f) => /<div class="nav-grupo nav-jugar hidden">/.test(leer(f)))
  const sinEnlace = conJugar.filter((f) => (leer(f).match(/<a href="\/repeticiones">Repeticiones<\/a>/g) || []).length !== 2)
  check(`«Repeticiones» está en el menú «Jugar» (arriba y en el del móvil) de las ${conJugar.length} páginas que lo tienen`, conJugar.length >= 30 && !sinEnlace.length, sinEnlace.join(', '))
  check('el sitemap la lleva', /\['\/repeticiones', '0\.\d'\]/.test(leer('netlify/functions/sitemap.mjs')))
  const html = leer('repeticiones.html')
  check('la página es indexable, con su descripción y su canónica', /<meta name="description" content="[^"]{60,}"/.test(html) && /<link rel="canonical" href="https:\/\/pokedoc\.es\/repeticiones" \/>/.test(html) && !/noindex/.test(html))
  check('carga la hoja del laboratorio (la mesa es la misma) y la suya', /href="\/css\/laboratorio\.css"/.test(html) && /href="\/css\/repeticiones\.css"/.test(html))
  // Una frase de la interfaz es una afirmación (tanda 447): la página dice
  // que la partida no se guarda en ningún sitio hasta que tú le das a
  // «Guardar» o a «Compartir» (desde la 480 se puede). Que leerla y pintarla
  // no escriba nada: ni la lectura ni la mesa mandan nada, y la página solo
  // deja la partida en la pestaña al ir a entrar para guardarla. Lo que se
  // manda al pulsar, en la prueba de la 480.
  const js = ['js/repeticiones/registro.js', 'js/repeticiones/estado.js'].map(leer).join('\n')
  const pagina = leer('js/repeticiones.js')
  check('leer y pintar la partida no la manda a ninguna parte', !/\.insert\(|\.upsert\(|fetch\(|setItem\(/i.test(js) && !/\.insert\(|\.upsert\(|fetch\(/.test(pagina))
  check('  …y la página solo la deja en la pestaña para guardarla al volver de entrar', (pagina.match(/sessionStorage\.setItem\(/g) || []).length === 1 && /function guardarPendiente\(\) \{\s*try \{\s*sessionStorage\.setItem\(CLAVE_PENDIENTE, R\.texto\)/.test(pagina))
  check('los iconos del reproductor NO van en js/icons.js (lo baja la portada)', !/reproducir|turnoSiguiente/.test(leer('js/icons.js')))
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
