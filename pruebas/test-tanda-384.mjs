// Tanda 384 — el laboratorio de pruebas del constructor.
//
// PINGU: «quiero mejorar el constructor para probar todas las
// probabilidades a la hora de robar cartas. Como un laboratorio de
// pruebas: una demo funcional del juego con manos de prueba y haciendo
// que las cartas funcionen, y un toggle con una tabla de las
// probabilidades de robar cada carta en cada momento».
//
// Lo que se prueba, por orden de lo caro que sería equivocarse:
//
//   1. Las PROBABILIDADES. Una tabla que da un 40 % donde es un 30 no da
//      error en ninguna parte: se cree. Por eso se comparan con una
//      simulación (Monte Carlo) en los tres estados de lo que sabe el
//      jugador —nada, todo el mazo, una parte— y con la fórmula cerrada
//      donde la hay.
//   2. Las REGLAS del turno que más se equivocan de memoria (el primer
//      turno del que va primero, evolucionar, una energía por turno).
//   3. Los EFECTOS: cada carta automatizada, jugada en una partida
//      montada para poder usarla, sin perder ni duplicar una sola carta.
//      Y un bot que juega partidas enteras al azar con cinco mazos.
//   4. La PANTALLA: se abre desde el constructor (bajándose SOLO al
//      abrirla), se juega, la tabla se abre y cambia con lo que se ve,
//      deshacer deshace, y en el móvil no se sale de ancho.
//
// Y la trampa que costó encontrar en esta misma tanda: las claves de los
// efectos se buscan SIN TILDES, y la primera versión tenía «poké pad» con
// tilde. La cuarta carta más jugada del meta salía «a mano» sin dar
// ningún error. De ahí la comprobación 3.1: toda clave en plano.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = process.env.BASE || 'http://localhost:8892'

const M = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS, CLAVES, estaAutomatizada } = await import(`${RAIZ}/js/constructor/efectos.js`)
const { claveDeNombre, plano } = await import(`${RAIZ}/js/constructor/nucleo.js`)
const { Partida, oddsDelMazo, probabilidadDeGrupo, contextoDeProbabilidad, comb, esPokemon, faseDe, claveDeEfecto } = M

// Las cartas: filas con la forma de `tcg_cards` (canonizadas), sacadas de
// los textos oficiales en inglés de las ~320 cartas más jugadas del meta
// (Limitless, 2026-09-30).
const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}
const mazo = (lista) => lista.map(([n, nombre]) => ({ carta: fila(nombre), n }))

// Y las mismas cartas como están HOY en el espejo: con el español en
// `name` («Pokétableta», «Zoroark ex de N»), que es como llegan 176 de
// las 318 más jugadas (ver js/constructor/nombres.js). Con los nombres de
// evolución también en español, que es como los trae TCGdex en la ficha
// española.
const { INGLES_DE } = await import(`${RAIZ}/js/constructor/nombres.js`)
const ESPANOL_DE = Object.fromEntries(Object.entries(INGLES_DE).map(([es, en]) => [en, es]))
const enEspanol = (c) => {
  const es = ESPANOL_DE[M.normalizarNombre(c.name)]
  const evo = c.evolve_from && ESPANOL_DE[M.normalizarNombre(c.evolve_from)]
  return { ...c, name: es || c.name, name_es: es || c.name_es, ...(evo ? { evolve_from: evo } : {}) }
}
const mazoEs = (lista) => lista.map(([n, nombre]) => ({ carta: enEspanol(fila(nombre)), n }))
const DRAGAPULT = [
  [4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Budew'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Munkidori'], [1, 'Moltres'],
  [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [3, 'Ultra Ball'],
  [4, 'Crushing Hammer'], [2, 'Crispin'], [2, 'Risky Ruins'], [1, 'Dawn'], [1, 'Judge'], [1, "Rosa's Encouragement"], [1, 'Special Red Card'], [1, 'Unfair Stamp'],
  [3, 'Fire Energy'], [3, 'Psychic Energy'], [2, 'Darkness Energy'],
]
const OTROS = {
  alakazam: [
    [4, 'Abra'], [3, 'Kadabra'], [3, 'Alakazam'], [2, 'Dunsparce'], [2, 'Dudunsparce'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [1, 'Psyduck'],
    [4, "Lillie's Determination"], [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [3, 'Rare Candy'], [3, 'Ultra Ball'], [3, 'Night Stretcher'], [2, "Boss's Orders"],
    [1, 'Dawn'], [1, 'Hilda'], [2, 'Wondrous Patch'], [1, 'Secret Box'], [1, 'Battle Cage'], [2, 'Pokégear 3.0'], [1, 'Enhanced Hammer'], [1, "Hero's Cape"],
    [8, 'Psychic Energy'], [2, 'Enriching Energy'],
  ],
  zoroark: [
    [4, "N's Zorua"], [3, "N's Zoroark ex"], [1, "N's Reshiram"], [1, "N's Zekrom"], [2, 'Munkidori'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Budew'],
    [4, "Lillie's Determination"], [4, 'Buddy-Buddy Poffin'], [3, 'Ultra Ball'], [4, "N's PP Up"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [1, "N's Castle"],
    [2, 'Switch'], [1, 'Unfair Stamp'], [2, 'Judge'], [1, 'Air Balloon'], [2, 'Crispin'], [1, 'Energy Switch'], [1, 'Prime Catcher'],
    [5, 'Darkness Energy'], [3, 'Fire Energy'], [3, 'Lightning Energy'], [2, 'Fighting Energy'],
  ],
  kangaskhan: [
    [3, 'Mega Kangaskhan ex'], [2, 'Latias ex'], [2, 'Moltres'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Shaymin'], [2, 'Chien-Pao'], [1, 'Yveltal'],
    [4, "Lillie's Determination"], [4, 'Poké Pad'], [3, 'Ultra Ball'], [3, "Boss's Orders"], [2, 'Switch'], [2, 'Air Balloon'], [3, 'Night Stretcher'],
    [2, "Black Belt's Training"], [2, 'Kieran'], [1, 'Maximum Belt'], [2, 'Brave Bangle'], [2, 'Crispin'], [2, 'Judge'], [1, "Team Rocket's Watchtower"],
    [4, 'Prism Energy'], [4, 'Fire Energy'], [3, 'Darkness Energy'], [2, 'Legacy Energy'],
  ],
  metagross: [
    [4, 'Beldum'], [3, 'Metang'], [3, 'Metagross'], [2, 'Genesect ex'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Drilbur'],
    [4, "Lillie's Determination"], [4, 'Poké Pad'], [3, 'Rare Candy'], [3, 'Ultra Ball'], [3, "Boss's Orders"], [2, 'Night Stretcher'], [2, 'Switch'],
    [2, 'Dawn'], [2, 'Energy Search'], [2, 'Grand Tree'], [1, 'Secret Box'], [2, 'Precious Trolley'], [1, 'Sacred Ash'], [1, 'Pokégear 3.0'],
    [12, 'Metal Energy'],
  ],
}

// Barajar con semilla, para la simulación.
let sem = 12345
const azar = () => ((sem = (sem * 16807) % 2147483647) / 2147483647)
const barajar = (l) => {
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[l[i], l[j]] = [l[j], l[i]]
  }
  return l
}

// Un `ui` de guion: elige lo primero que valga.
function uiGuion(p) {
  return {
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
    async premios(o) { return p.s.premios.slice(0, o.n) },
  }
}

// Ninguna carta se pierde ni se duplica, y lo que se sabe del mazo es
// posible.
function invariante(p, total) {
  const s = p.s
  const todas = [...s.mazo, ...s.mano, ...s.premios, ...s.descarte, ...s.jugando, ...(s.estadio ? [s.estadio] : []), ...p.enJuego.flatMap((x) => [...x.cartas, ...x.energias, ...(x.herramienta ? [x.herramienta] : [])])]
  if (todas.length !== total || new Set(todas).size !== total) return `cartas ${todas.length}/${total}, distintas ${new Set(todas).size}`
  const k = s.conocimiento
  if (k.arriba + k.abajo > s.mazo.length) return `conocimiento imposible: ${k.arriba}+${k.abajo} > ${s.mazo.length}`
  for (const u of Object.keys(k.confirmados)) if (!s.mazo.includes(u)) return `«confirmada» fuera del mazo: ${u}`
  return null
}

function empezada(entradas, { semilla = 7, vaPrimero = false, estricta = true } = {}) {
  const p = new Partida({ entradas, efectos: EFECTOS, semilla, vaPrimero, estricta })
  p.repartir()
  p.colocar(p.s.mano.find((u) => esPokemon(p.carta(u)) && faseDe(p.carta(u)) === 0), 'activo')
  p.empezar()
  return p
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las probabilidades del mazo, antes de robar ──')
{
  const entradas = mazo(DRAGAPULT)
  const o = oddsDelMazo(entradas)
  check('11 básicos en 60', o.total === 60 && o.basicos === 11, `${o.basicos} en ${o.total}`)
  check('mulligan = C(49,7)/C(60,7) (el 21,7 % de TCG Dexter)', Math.abs(o.mulligan - comb(49, 7) / comb(60, 7)) < 1e-12, (o.mulligan * 100).toFixed(2))
  // Monte Carlo de la mano que SE JUEGA (con básico): la tabla cuenta con
  // el mulligan, y eso es lo que la distingue de la hipergeométrica a
  // secas — que da un 39,9 % para una carta de 4 copias.
  const cartas = entradas.flatMap((e) => Array(e.n).fill(e.carta))
  const g = { lillie: 0, lillieT2: 0, dreepy: 0, fezPrem: 0, validas: 0 }
  for (let i = 0; i < 120000; i++) {
    const m = barajar(cartas.slice())
    const mano = m.slice(0, 7)
    if (!mano.some((c) => c.category === 'Pokemon' && c.stage === 'Basic')) continue
    g.validas++
    const vistas = [...mano, ...m.slice(13, 15)]
    if (mano.some((c) => c.name === "Lillie's Determination")) g.lillie++
    if (vistas.some((c) => c.name === "Lillie's Determination")) g.lillieT2++
    if (mano.some((c) => c.name === 'Dreepy')) g.dreepy++
    if (m.slice(7, 13).some((c) => c.name === 'Fezandipiti ex')) g.fezPrem++
  }
  const de = (n) => o.grupos.find((x) => x.nombre === n || x.carta.name === n)
  const cerca = (a, b, t = 0.006) => Math.abs(a - b) < t
  check('Lillie en la mano inicial ≈ simulación', cerca(de("Lillie's Determination").enMano, g.lillie / g.validas), `${(de("Lillie's Determination").enMano * 100).toFixed(2)} vs ${((g.lillie / g.validas) * 100).toFixed(2)}`)
  check('  …y no es la hipergeométrica a secas (39,9 %)', Math.abs(de("Lillie's Determination").enMano - 0.399) > 0.01)
  check('Lillie para el turno 2 ≈ simulación', cerca(de("Lillie's Determination").turno2, g.lillieT2 / g.validas), `${(de("Lillie's Determination").turno2 * 100).toFixed(2)} vs ${((g.lillieT2 / g.validas) * 100).toFixed(2)}`)
  check('Dreepy (básico) en la mano ≈ simulación', cerca(de('Dreepy').enMano, g.dreepy / g.validas))
  check('una carta suelta en premios ≈ simulación', cerca(de('Fezandipiti ex').todasPremiadas, g.fezPrem / g.validas), `${(de('Fezandipiti ex').todasPremiadas * 100).toFixed(2)} vs ${((g.fezPrem / g.validas) * 100).toFixed(2)}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Las probabilidades EN VIVO, con lo que sabe el jugador ──')
{
  const entradas = mazo(DRAGAPULT)
  // 2.1 Sin haber mirado nada: la carta de arriba es cualquiera de las
  // que no ves (mazo + premios boca abajo).
  const p = empezada(entradas)
  const ctx = contextoDeProbabilidad(p)
  const esLillie = (c) => c.name === "Lillie's Determination"
  const k = 4 - [...p.s.mano, ...p.enJuego.flatMap((x) => x.cartas)].filter((u) => esLillie(p.carta(u))).length
  const U = p.s.mazo.length + 6
  const r = probabilidadDeGrupo(p, esLillie, 3, ctx)
  check('sin mirar: próximo robo = k / (mazo + premios)', Math.abs(r.siguiente - k / U) < 1e-12, `${(r.siguiente * 100).toFixed(2)} %`)
  check('sin mirar: en 3 robos = 1 − C(U−k,3)/C(U,3)', Math.abs(r.enN - (1 - comb(U - k, 3) / comb(U, 3))) < 1e-12)
  check('sin mirar: todas en premios = C(6,k)/C(U,k)', Math.abs(r.todasPremiadas - (k ? comb(6, k) / comb(U, k) : 0)) < 1e-12)

  // 2.2 Tras buscar en el mazo: los premios salen por eliminación.
  p.verMazo()
  p.barajar()
  const r2 = probabilidadDeGrupo(p, esLillie, 3)
  const enMazo = p.s.mazo.filter((u) => esLillie(p.carta(u))).length
  const enPremios = p.s.premios.filter((u) => esLillie(p.carta(u))).length
  check('tras buscar: sabes cuántas hay en premios', r2.premiosExactos === enPremios, `${r2.premiosExactos} vs ${enPremios}`)
  check('tras buscar: próximo robo = en el mazo / mazo', Math.abs(r2.siguiente - enMazo / p.s.mazo.length) < 1e-12)

  // 2.3 Una parte vista (Pokégear: 7 miradas y barajadas) contra una
  // simulación que reparte al azar lo que NO sabe el jugador.
  const q = empezada(entradas, { semilla: 99 })
  q.mirarArriba(7)
  q.barajar()
  const c3 = contextoDeProbabilidad(q)
  check('7 confirmadas en el mazo', c3.conf.length === 7, `${c3.conf.length}`)
  const vista = q.carta(c3.conf[0])
  const nombres = new Set(c3.conf.map((u) => claveDeNombre(q.carta(u))))
  const otra = c3.sinConf.map((u) => q.carta(u)).find((c) => !nombres.has(claveDeNombre(c)))
  for (const [txt, carta] of [['una que VISTE', vista], ['una que no', otra]]) {
    const gr = (c) => claveDeNombre(c) === claveDeNombre(carta)
    const rr = probabilidadDeGrupo(q, gr, 5, c3)
    const pool = [...c3.sinConf, ...c3.premiosOcultos]
    let sig = 0, en5 = 0, todas = 0
    const N = 60000
    for (let i = 0; i < N; i++) {
      const m = barajar(pool.slice())
      const mazoSim = barajar([...c3.conf, ...m.slice(c3.Ph)])
      if (gr(q.carta(mazoSim[0]))) sig++
      if (mazoSim.slice(0, 5).some((u) => gr(q.carta(u)))) en5++
      if (!mazoSim.some((u) => gr(q.carta(u)))) todas++
    }
    check(`parcial, ${txt}: próximo robo ≈ simulación`, Math.abs(rr.siguiente - sig / N) < 0.006, `${(rr.siguiente * 100).toFixed(2)} vs ${((sig / N) * 100).toFixed(2)}`)
    check(`parcial, ${txt}: en 5 robos ≈ simulación`, Math.abs(rr.enN - en5 / N) < 0.008, `${(rr.enN * 100).toFixed(2)} vs ${((en5 / N) * 100).toFixed(2)}`)
    check(`parcial, ${txt}: todas en premios ≈ simulación`, rr.todasPremiadas === null || Math.abs(rr.todasPremiadas - todas / N) < 0.006, `${((rr.todasPremiadas ?? 0) * 100).toFixed(2)} vs ${((todas / N) * 100).toFixed(2)}`)
  }

  // 2.4 Lo que sabes DÓNDE está: Drakloak manda una abajo, y esa no sale.
  const d = empezada(entradas, { semilla: 5 })
  const drak = d.s.mazo.find((u) => d.carta(u).name === 'Drakloak')
  d.sacarDelMazo(drak)
  const sl = d.nuevoSlot(drak)
  d.s.banca.push(sl)
  const arriba2 = d.s.mazo.slice(0, 2)
  await d.accion(() => d.usarHabilidad(sl, uiGuion(d)))
  check('Drakloak: la otra va abajo y se sabe', d.s.mazo.at(-1) === arriba2[1] && d.s.conocimiento.abajo === 1)
  const rb = probabilidadDeGrupo(d, (c, u) => u === arriba2[1], 5)
  check('  …y la tabla no la da en los próximos robos', rb.enN === 0 && rb.todasPremiadas === 0, JSON.stringify(rb))
  check('  …ni se deja usar dos veces', /ya la has usado/i.test(d.motivoNoHabilidad(sl) || ''))

  // 2.5 Descifrador de Códigos: las dos de arriba, en orden: el próximo
  // robo es seguro.
  const cf = empezada(entradas, { semilla: 11 })
  cf.alMazo([cf.s.mano[0]], 'arriba')
  const r5 = probabilidadDeGrupo(cf, (c, u) => u === cf.s.mazo[0], 1)
  check('la carta que pusiste arriba sale seguro', r5.siguiente === 1)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Los efectos de las cartas ──')
{
  // 3.1 Las claves, en plano: una tilde en una clave no casa NUNCA.
  const conTilde = [...CLAVES.entrenadores, ...CLAVES.habilidades, ...CLAVES.ataques, ...CLAVES.energias].filter((k) => k !== claveDeEfecto({ name: k }))
  check('todas las claves de efecto van sin tildes', conTilde.length === 0, conTilde.join(', '))
  check('Poké Pad, Pokégear y la Dama del Centro Pokémon, automatizadas', ['Poké Pad', 'Pokégear 3.0', 'Pokémon Center Lady'].every((n) => estaAutomatizada(fila(n))))

  // 3.2 Los 25 entrenadores más jugados del meta tienen efecto (o son
  // pasivos que el motor aplica al calcular).
  const TOP = ["Boss's Orders", 'Night Stretcher', 'Ultra Ball', 'Poké Pad', "Lillie's Determination", 'Buddy-Buddy Poffin', 'Special Red Card', 'Crispin', 'Unfair Stamp', 'Switch', 'Judge', 'Rare Candy', 'Air Balloon', 'Hilda', "Team Rocket's Petrel", 'Dawn', "Rosa's Encouragement", 'Secret Box', 'Risky Ruins', "Ciphermaniac's Codebreaking", "Team Rocket's Watchtower", 'Cyrano', 'Crushing Hammer', 'Sacred Ash', 'Pokégear 3.0']
  const sinEfecto = TOP.filter((n) => !estaAutomatizada(fila(n)))
  check('los 25 entrenadores más jugados están automatizados', sinEfecto.length === 0, sinEfecto.join(', '))

  // 3.3 Cada entrenador automatizado, jugado, sin perder cartas.
  const entrenadores = FILAS.filter((c) => c.category === 'Trainer' && EFECTOS.entrenadores[claveDeEfecto(c)]?.usar)
  const rotos = []
  const saltados = []
  let jugados = 0
  for (const carta of entrenadores) {
    const relleno = [fila('Dreepy'), fila('Drakloak'), fila('Dragapult ex'), fila('Rare Candy'), fila('Teal Mask Ogerpon ex'), ...['Psychic', 'Fire', 'Darkness', 'Grass', 'Metal', 'Water'].map((t) => fila(`${t} Energy`))]
    const lista = [{ carta, n: 1 }, ...relleno.map((c) => ({ carta: c, n: 4 }))]
    const faltan = 60 - lista.reduce((s, e) => s + e.n, 0)
    lista.push({ carta: fila('Budew'), n: faltan })
    const p = new Partida({ entradas: lista, efectos: EFECTOS, semilla: 3, vaPrimero: false, estricta: false })
    p.repartir()
    p.colocar(p.s.mano.find((u) => faseDe(p.carta(u)) === 0 && esPokemon(p.carta(u))), 'activo')
    p.empezar()
    p.terminarTurno()
    const saca = (f) => { const u = p.s.mazo.find((x) => f(p.carta(x))); if (u) p.sacarDelMazo(u); return u }
    for (let i = 0; i < 2; i++) { const u = saca((c) => faseDe(c) === 0 && esPokemon(c)); if (u) p.s.banca.push(p.nuevoSlot(u)) }
    for (const f of [(c) => esPokemon(c), (c) => c.energy_type === 'Normal', (c) => c.energy_type === 'Normal']) { const u = saca(f); if (u) p.s.descarte.push(u) }
    for (const x of p.enJuego) { const u = saca((c) => c.category === 'Energy'); if (u) x.energias.push(u); x.danio = 20 }
    const u = [...p.cartas.entries()].find(([, c]) => c === carta)[0]
    p.moverCarta(u, 'mano')
    for (let i = 0; i < 3; i++) p.robar(1)
    p.s.koUltimoTurnoRival = true
    p.s.rival.premios = 2
    const no = p.motivoNoJugar(u)
    if (no) {
      saltados.push(`${carta.name} (${no})`)
      continue
    }
    try {
      await p.accion(() => p.jugarDeMano(u, { id: 'jugar' }, uiGuion(p)))
      const inv = invariante(p, 60)
      if (inv) rotos.push(`${carta.name}: ${inv}`)
      jugados++
    } catch (e) {
      if (!e.noSePuede) rotos.push(`${carta.name}: ${String(e).slice(0, 120)}`)
    }
  }
  // Los que piden algo que esta mesa no tiene (un Teracristal, un
  // Partidario en el descarte…) se saltan: aquí se mira que NO rompan, y
  // su condición la miran sus propias comprobaciones.
  check(`los entrenadores automatizados se juegan sin perder cartas (${jugados})`, rotos.length === 0 && jugados >= 65, rotos.slice(0, 4).join(' | ') || `${jugados} jugados; saltados: ${saltados.join(', ')}`)

  // 3.4 Un bot que juega partidas enteras al azar, dentro de las reglas.
  let partidas = 0
  const fallos = []
  for (const [nombre, lista] of Object.entries({ dragapult: DRAGAPULT, ...OTROS })) {
    const entradas = mazo(lista)
    const total = entradas.reduce((s, e) => s + e.n, 0)
    for (let g = 0; g < 12; g++) {
      sem = 777 + g * 31 + nombre.length
      const p = new Partida({ entradas, efectos: EFECTOS, semilla: g * 7919 + 1, vaPrimero: g % 2 === 0 })
      const ui = {
        ...uiGuion(p),
        async cartas(o) {
          const pool = barajar([...(o.elegibles || o.opciones)])
          const quiero = o.min + Math.floor(azar() * (Math.max(o.min, Math.min(o.max, pool.length)) - o.min + 1))
          const sel = []
          for (const u of pool) { if (sel.length >= quiero) break; if (!o.validar || !o.validar([...sel, u])) sel.push(u) }
          for (const u of o.opciones) if (sel.length < o.min && !sel.includes(u) && (!o.validar || !o.validar([...sel, u]))) sel.push(u)
          if (sel.length < o.min && !o.sinCancelar) throw new M.Cancelado()
          return sel
        },
        async confirmar() { return azar() < 0.8 },
      }
      p.repartir()
      p.colocar(p.s.mano.find((u) => esPokemon(p.carta(u)) && faseDe(p.carta(u)) === 0), 'activo')
      p.empezar()
      partidas++
      let fallo = null
      for (let t = 0; t < 30 && p.s.fase === 'turno' && !fallo; t++) {
        for (let a = 0; a < 20 && p.s.fase === 'turno' && !fallo; a++) {
          const posibles = []
          for (const u of p.s.mano) for (const o of p.opcionesDeMano(u)) if (!o.no) posibles.push(() => p.jugarDeMano(u, o, ui))
          for (const sl of p.enJuego) if (!p.motivoNoHabilidad(sl)) posibles.push(() => p.usarHabilidad(sl, ui))
          if (!posibles.length || azar() < 0.1) break
          try { await p.accion(posibles[Math.floor(azar() * posibles.length)]) } catch (e) { if (!e.cancelado && !e.noSePuede) fallo = String(e.stack).slice(0, 200) }
          fallo ||= invariante(p, total)
        }
        if (fallo || p.s.fase !== 'turno') break
        const at = p.s.activo ? p.ataquesDe(p.s.activo).find((x) => !p.motivoNoAtacar(p.s.activo, x.ataque, x.prestado ? x.de : null)) : null
        try { await p.accion(() => (at ? p.atacar(p.s.activo, at.i, ui, { prestadoDe: at.prestado ? at.de.id : null }) : p.pasarTurno(ui))) } catch (e) { if (!e.cancelado && !e.noSePuede) fallo = String(e.stack).slice(0, 200) }
        fallo ||= invariante(p, total)
      }
      if (fallo) fallos.push(`${nombre} #${g}: ${fallo}`)
    }
  }
  check(`${partidas} partidas al azar con cinco mazos, sin un fallo`, fallos.length === 0, fallos.slice(0, 3).join(' | '))

  // 3.5 Con los nombres en español que tiene hoy el espejo, lo mismo.
  const zor = mazoEs(OTROS.zoroark)
  const nombresEs = zor.map((e) => e.carta.name)
  check('la ficha en español lleva nombres en español', nombresEs.includes('zoroark ex de n') && nombresEs.includes('pokochos gemelos'), nombresEs.slice(0, 6).join(', '))
  check('con el nombre en español, el efecto se encuentra', ['Poké Pad', "Boss's Orders", "Lillie's Determination", 'Buddy-Buddy Poffin', "N's PP Up"].every((n) => estaAutomatizada(enEspanol(fila(n)))))
  const zoroark = zor.find((e) => e.carta.name === 'zoroark ex de n').carta
  check('«Zoroark ex de N» tiene Regla y da 2 premios', M.tieneRegla(zoroark) && M.premiosQueDa(zoroark) === 2)
  check('  …y es «de N» (para Más PP de N y el Palacio)', M.esDe(zoroark, 'n'))
  check('«Mega-Kangaskhan ex», con guion, da 3 premios', M.premiosQueDa({ ...fila('Mega Kangaskhan ex'), name: 'Mega-Kangaskhan ex' }) === 3)
  check('«Petrel del Team Rocket» es del Team Rocket', M.esDe(enEspanol(fila("Team Rocket's Petrel")), 'team rocket'))
  const pz = empezada(zor, { semilla: 4 })
  const zorua = pz.s.mazo.find((u) => pz.carta(u).name === 'zorua de n')
  if (zorua) {
    pz.sacarDelMazo(zorua)
    const sl = pz.nuevoSlot(zorua)
    sl.entroTurno = 0
    pz.s.banca.push(sl)
    pz.terminarTurno()
    const zx = pz.s.mazo.find((u) => pz.carta(u).name === 'zoroark ex de n')
    pz.sacarDelMazo(zx)
    pz.s.mano.push(zx)
    const op = pz.opcionesDeMano(zx).find((o) => o.slot === sl.id)
    check('«Zoroark ex de N» evoluciona de «Zorua de N»', op && !op.no, JSON.stringify(op))
  }
  let fallosEs = 0
  for (let g = 0; g < 10; g++) {
    sem = 4242 + g
    const p = empezada(zor, { semilla: g * 31 + 5 })
    const ui = uiGuion(p)
    for (let t = 0; t < 12 && p.s.fase === 'turno'; t++) {
      for (let a = 0; a < 12; a++) {
        const posibles = []
        for (const u of p.s.mano) for (const o of p.opcionesDeMano(u)) if (!o.no) posibles.push(() => p.jugarDeMano(u, o, ui))
        for (const sl of p.enJuego) if (!p.motivoNoHabilidad(sl)) posibles.push(() => p.usarHabilidad(sl, ui))
        if (!posibles.length) break
        try { await p.accion(posibles[Math.floor(azar() * posibles.length)]) } catch (e) { if (!e.cancelado && !e.noSePuede) fallosEs++ }
        if (invariante(p, 60)) fallosEs++
      }
      try { await p.accion(() => p.pasarTurno(ui)) } catch { fallosEs++ }
    }
  }
  check('10 partidas al azar con los nombres en español, sin un fallo', fallosEs === 0, `${fallosEs} fallos`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3.6. Mismo nombre, otra carta: la firma ──')
{
  // Dos impresiones con el mismo nombre pueden tener ataques distintos
  // (hay Greninja ex, Toxel o Riolu de varios sets). Un efecto de ataque
  // va por POSICIÓN y con la firma del daño impreso: si la carta no casa,
  // se juega a mano en vez de hacer lo que hace la otra.
  const p = new Partida({ entradas: mazo(DRAGAPULT), efectos: EFECTOS, semilla: 3 })
  const drag = fila('Dragapult ex')
  check('Dragapult ex: «Phantom Dive» tiene efecto', !!p.defDeAtaque(drag, drag.attacks[1]))
  const otroDanio = { ...drag, attacks: [drag.attacks[0], { ...drag.attacks[1], damage: '180' }] }
  check('  …pero no en una impresión con otro daño', p.defDeAtaque(otroDanio, otroDanio.attacks[1]) === null)
  const unoSolo = { ...drag, attacks: [drag.attacks[1]] }
  check('  …ni en una con otro número de ataques', p.defDeAtaque(unoSolo, unoSolo.attacks[0]) === null)
  const vieja = { ...drag, regulation_mark: 'D' }
  check('  …ni en una de otra era', p.defDeAtaque(vieja, vieja.attacks[1]) === null)

  // Las habilidades: solo si la carta la TIENE en el catálogo.
  const fez = fila('Fezandipiti ex')
  const conCarta = (c) => {
    const uid = `prueba-${Math.random()}`
    p.cartas.set(uid, c)
    return { cartas: [uid] }
  }
  check('Fezandipiti ex: su habilidad está automatizada', !!p.habilidadDe(conCarta(fez)))
  check('  …pero no en una impresión sin habilidades', p.habilidadDe(conCarta({ ...fez, abilities: [] })) === null)
  check('  …ni en una de otra era', p.habilidadDe(conCarta({ ...fez, regulation_mark: 'E' })) === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Las reglas del turno ──')
{
  const entradas = mazo(OTROS.alakazam)
  const p = empezada(entradas, { vaPrimero: true, semilla: 21 })
  const trae = (n) => { const u = p.s.mazo.find((x) => p.carta(x).name === n); p.sacarDelMazo(u); p.s.mano.push(u); return u }
  const lillie = trae("Lillie's Determination")
  check('quien va primero no juega partidarios en su turno 1', /primer turno/.test(p.motivoNoJugar(lillie) || ''))
  check('  …ni ataca', /primer turno/.test(p.motivoNoAtacar(p.s.activo, p.cartaDe(p.s.activo).attacks?.[0]) || ''))
  const caramelo = trae('Rare Candy')
  trae('Alakazam')
  check('Caramelo Raro no se usa en el primer turno', /primer turno/.test(p.motivoNoJugar(caramelo) || ''))
  // Un Abra que baja a la banca en el turno 1: el del turno 2 tiene que
  // poder recibir el Caramelo. Se baja a propósito para que la
  // comprobación de abajo no dependa de lo que haya salido en la mano.
  const abraU = p.s.mano.find((x) => p.carta(x).name === 'Abra') || trae('Abra')
  await p.accion(() => p.jugarDeMano(abraU, { id: 'banca' }, uiGuion(p)))
  const e1 = trae('Psychic Energy')
  const e2 = trae('Psychic Energy')
  await p.accion(() => p.jugarDeMano(e1, { id: 'energia', slot: p.s.activo.id }, uiGuion(p)))
  const op = p.opcionesDeMano(e2).find((o) => o.slot === p.s.activo.id)
  check('una energía de la mano por turno', /ya has unido/i.test(op?.no || ''), op?.no)
  p.terminarTurno()
  check('turno 2: ya se juegan partidarios', !p.motivoNoJugar(lillie))
  // El Abra que entró antes del turno 2 ya puede recibir el Caramelo.
  check('el Abra está en la banca', p.s.banca.some((x) => x.cartas.includes(abraU)))
  check('turno 2: Caramelo Raro sobre un Abra que ya estaba', !p.motivoNoJugar(caramelo), p.motivoNoJugar(caramelo))
  const opCaramelo = p.opcionesDeMano(caramelo)
  check('  …y lo ofrece sobre ese Abra', opCaramelo.some((o) => !o.no), JSON.stringify(opCaramelo))
  // Deshacer devuelve también el AZAR: barajar, deshacer y volver a
  // barajar tiene que dar el mismo orden. Si no, deshacer serviría para
  // repetir un robo hasta que saliera lo que quieres.
  await p.accion(() => p.barajar())
  const orden1 = p.s.mazo.join()
  p.deshacer()
  await p.accion(() => p.barajar())
  check('deshacer y volver a barajar da el mismo orden', p.s.mazo.join() === orden1)
  // Y el modo libre no mira nada de esto.
  const libre = empezada(entradas, { vaPrimero: true, estricta: false, semilla: 21 })
  const l2 = libre.s.mazo.find((x) => libre.carta(x).name === "Lillie's Determination")
  libre.sacarDelMazo(l2)
  libre.s.mano.push(l2)
  check('en modo libre, sí', !libre.motivoNoJugar(l2))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. La paleta de energías es COPIA de la de la ficha ──')
{
  // CLAUDE.md (tanda 322): una constante copiada se vigila con una prueba.
  const paleta = (css, prefijo) => Object.fromEntries([...css.matchAll(new RegExp(`${prefijo}\\[data-tipo='(\\w+)'\\]\\s*\\{\\s*--tipo-energia:\\s*(#[0-9a-f]{6})`, 'gi'))].map((m) => [m[1], m[2].toLowerCase()]))
  const ficha = paleta(leer('css/carta.css'), '\\.carta-energia')
  const lab = paleta(leer('css/laboratorio.css'), '\\.lab-energia')
  const LETRA = { Grass: 'G', Fire: 'R', Water: 'W', Lightning: 'L', Psychic: 'P', Fighting: 'F', Darkness: 'D', Metal: 'M', Fairy: 'Y', Dragon: 'N', Colorless: 'C' }
  const distintas = Object.entries(LETRA).filter(([t, l]) => ficha[t] !== lab[l]).map(([t]) => t)
  check('los once colores coinciden', Object.keys(ficha).length === 11 && distintas.length === 0, distintas.join(', '))
  // Y la tercera copia (711): las fichas de la Pokédex tiñen con los ocho
  // tipos que tienen símbolo de energía.
  const pdx = Object.fromEntries([...leer('css/mi-coleccion.css').matchAll(/\.pdx-especie\.tipo-([A-Z])\s*\{\s*--tipo-energia:\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2].toLowerCase()]))
  const malPdx = Object.entries(LETRA).filter(([, l]) => 'GRWLPFDM'.includes(l)).filter(([t, l]) => ficha[t] !== pdx[l]).map(([t]) => t)
  check('…y los ocho de la Pokédex de Mi colección también', Object.keys(pdx).length === 8 && malPdx.length === 0, malPdx.join(', ') || JSON.stringify(pdx))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. La pantalla ──')
const browser = await chromium.launch()
{
  const entradas = mazo(DRAGAPULT)
  const cartas = [...new Map(entradas.map((e) => [e.carta.id, { ...e.carta, market: 'WEST', name_key: plano(e.carta.name), image_path: null }])).values()]
  const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
  const l = entradas.map((e) => `${e.n}~${e.carta.id}`).join('_')
  const abrir = async ({ ancho = 1400, alto = 900, url = `/constructor?l=${l}` } = {}) => {
    const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
    const errores = []
    const pedidas = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
    page.on('request', (r) => pedidas.push(r.url()))
    await page.addInitScript(({ cartas, sets }) => {
      window.__FAKE_SESSION__ = 'none'
      window.__FAKE_SETS__ = sets
      window.__FAKE_CARTAS__ = cartas
      // El reparto con semilla: la misma mano cada vez.
      let s = 42
      Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647)
      localStorage.setItem('pokedoc-laboratorio', JSON.stringify({ opciones: { primero: 'segundo', estricta: true, rival: 'ex', banca: 2 } }))
    }, { cartas, sets })
    await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    return { page, errores, pedidas }
  }

  const { page, errores, pedidas } = await abrir()
  check('el laboratorio NO se baja al entrar en el constructor', !pedidas.some((u) => /laboratorio\.js|partida\.js|efectos\.js/.test(u)))
  check('  …pero su hoja sí va cargada (barrido de la 299)', await page.evaluate(() => [...document.styleSheets].some((s) => /laboratorio\.css/.test(s.href || ''))))
  await page.click('#cmProbar')
  await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
  check('«Probar» abre el laboratorio', (await page.locator('.lab:not([hidden]) .lab-mesa').count()) === 1)
  check('  …y ahora sí se ha bajado el motor', pedidas.some((u) => /constructor\/partida\.js/.test(u)))
  check('arranca en la preparación, con 7 cartas', /Preparación/.test(await page.locator('#labTurno').innerText()) && (await page.locator('[data-mano]').count()) === 7)
  check('  …y «Empezar» apagado mientras no hay activo', await page.locator('[data-accion="empezar"]').isDisabled())
  // Tocar un básico lo pone de activo, sin menú.
  const nombresMano = await page.locator('[data-mano]').evaluateAll((ns) => ns.map((n) => n.getAttribute('aria-label')))
  const basicos = ['Dreepy', 'Budew', 'Munkidori', 'Moltres', 'Fezandipiti ex', 'Meowth ex']
  const primero = nombresMano.findIndex((n) => basicos.includes(n))
  await page.locator('[data-mano]').nth(primero).click()
  await page.waitForTimeout(200)
  check('tocar un básico en la preparación lo pone de activo', (await page.locator('#labLadoPropio .lab-zona-activo .lab-slot-activo').count()) === 1)
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(200)
  check('empieza: turno 1 y 6 premios boca abajo', /Tu turno 1/.test(await page.locator('#labTurno').innerText()) && (await page.locator('#labLadoPropio .lab-zona-premios [data-premio]').count()) === 6)

  // La tabla de probabilidades: en una pantalla ancha, abierta de serie
  // al lado de la mesa (tanda 456); el botón la cierra y la vuelve a abrir.
  check('en ancho, la tabla está abierta de serie', await page.locator('#labPanel:not(.hidden) .lab-tabla').isVisible())
  await page.click('.lab-barra [data-accion="panel"]')
  await page.waitForTimeout(200)
  const cerrada = await page.locator('#labPanel').isHidden()
  await page.click('.lab-barra [data-accion="panel"]')
  await page.waitForTimeout(200)
  check('el botón la cierra y la abre', cerrada && (await page.locator('#labPanel:not(.hidden) .lab-tabla').isVisible()))
  const filas = await page.locator('#labPanel tbody tr:not(.lab-fila-seccion)').count()
  const distintas = new Set(entradas.map((e) => claveDeNombre(e.carta))).size
  check('una fila por carta distinta, más las tres de grupo', filas === distintas + 3, `${filas} filas, ${distintas} cartas`)
  const saberAntes = await page.locator('.lab-prob-saber').innerText()
  check('  …y dice que aún no has mirado el mazo', /no has mirado/i.test(saberAntes), saberAntes)
  // El número de una fila, contra la fórmula: Dragapult ex, sin mirar nada.
  const filaDrag = page.locator('#labPanel tbody tr', { hasText: 'Dragapult ex' }).first()
  const siguiente = await filaDrag.locator('td').nth(1).innerText()
  const quedan = Number(await filaDrag.locator('td').nth(0).innerText())
  const mazoN = Number((await page.locator('#labLadoPropio [data-pila="mazo"] strong').innerText()).trim())
  const esperado = `${((quedan / (mazoN + 6)) * 100).toFixed(1).replace('.', ',')} %`
  check('el «próximo robo» de la pantalla es k / (mazo + premios)', siguiente.trim() === esperado, `${siguiente.trim()} vs ${esperado}`)
  // Marcar dos cartas añade la fila de «cualquiera de las marcadas».
  await page.locator('[data-marca]').nth(0).check()
  await page.locator('[data-marca]').nth(1).check()
  await page.waitForTimeout(150)
  check('marcar dos cartas añade «cualquiera de tus 2 marcadas»', (await page.locator('#labPanel tbody tr', { hasText: 'Cualquiera de tus 2 marcadas' }).count()) === 1)

  // Buscar en el mazo a mano: la ventana, y lo que cambia en la tabla.
  const manoAntes = await page.locator('[data-mano]').count()
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Buscar en el mazo' }).click()
  await page.locator('#labDialogo [data-opcion="mano"]').click()
  await page.waitForTimeout(150)
  check('buscar abre la ventana con el mazo entero', (await page.locator('#labDialogo [data-elige]').count()) === mazoN, `${await page.locator('#labDialogo [data-elige]').count()} de ${mazoN}`)
  // El mazo NO sale en su orden: sale ordenado por nombre (enseñarlo en
  // orden sería enseñar lo que vas a robar).
  const nombresDialogo = await page.locator('#labDialogo [data-elige]').evaluateAll((ns) => ns.map((n) => n.getAttribute('aria-label')))
  const pokemonPrimero = nombresDialogo.findIndex((n) => !/Energy|Orders|Ball|Pad|Poffin|Stretcher|Determination|Hammer|Crispin|Ruins|Dawn|Judge|Encouragement|Card|Stamp/.test(n))
  check('  …ordenado por clase y nombre, no en el orden del mazo', pokemonPrimero === 0 && nombresDialogo.slice(0, 5).join() === [...nombresDialogo.slice(0, 5)].sort((a, b) => a.localeCompare(b, 'es')).join(), nombresDialogo.slice(0, 5).join(', '))
  await page.locator('#labDialogo [data-elige]').first().click()
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(200)
  check('la carta elegida llega a la mano, marcada como nueva', (await page.locator('[data-mano]').count()) === manoAntes + 1 && (await page.locator('[data-mano].lab-nueva').count()) === 1)
  const saberDespues = await page.locator('.lab-prob-saber').innerText()
  check('la tabla ya sabe qué hay en los premios', /mazo entero/i.test(saberDespues), saberDespues)
  // textContent y no innerText: la cabecera va en versalitas por CSS, e
  // innerText devuelve el texto como SE PINTA («EN PREMIOS»).
  check('  …y la columna pasa a decir cuántas hay', /En premios/.test(await page.locator('#labPanel thead').textContent()))

  // Deshacer.
  await page.click('[data-accion="deshacer"]')
  await page.waitForTimeout(150)
  check('«Deshacer» devuelve la mano', (await page.locator('[data-mano]').count()) === manoAntes)
  check('  …y lo que se sabía del mazo', /no has mirado/i.test(await page.locator('.lab-prob-saber').innerText()))

  // Una carta de la mano: su «⋯» abre el menú con su texto. (Tocar la
  // carta la JUEGA desde la tanda 456.)
  await page.locator('[data-mas][aria-label="Más opciones: Lillie\'s Determination"]').first().click().catch(() => {})
  await page.waitForTimeout(150)
  if (await page.locator('#labMenu:not(.hidden)').count()) {
    check('el menú de una carta enseña su texto (el espejo no lo tiene)', /Baraja tu mano/.test(await page.locator('#labMenu').innerText()))
    await page.keyboard.press('Escape')
    // El primer Escape cierra el menú; hasta que no se haya ido, el
    // segundo se lo comería él. Con la suite entera corriendo, 150 ms
    // fijos no bastaban (tanda 394): se espera a que pase, no un rato.
    await page.locator('#labMenu').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  }

  // Cerrar y volver: la partida sigue.
  const turno = await page.locator('#labTurno').innerText()
  await page.keyboard.press('Escape')
  await page.locator('.lab').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {})
  check('Escape cierra el laboratorio', await page.locator('.lab').isHidden())
  await page.click('#cmProbar')
  await page.waitForTimeout(400)
  check('volver a abrirlo con el mismo mazo sigue la partida', (await page.locator('#labTurno').innerText()) === turno)
  check('sin errores de JavaScript', errores.length === 0, errores[0])
  await page.close()

  // ?lab=1 (el «Probar en el laboratorio» de /meta).
  const x = await abrir({ url: `/constructor?l=${l}&lab=1` })
  await x.page.waitForTimeout(800)
  check('?lab=1 lo abre solo', (await x.page.locator('.lab:not([hidden]) .lab-mesa').count()) === 1)
  await x.page.close()
  check('/meta enlaza el laboratorio', /Probar en el laboratorio/.test(leer('js/meta-mazo.js')) && /laboratorio: true/.test(leer('js/meta-mazo.js')))

  // En el móvil, nada se sale de ancho y el × está a la vista.
  const mv = await abrir({ ancho: 360, alto: 740 })
  await mv.page.click('#cmProbar')
  await mv.page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
  await mv.page.click('[data-accion="auto"]')
  await mv.page.click('[data-accion="empezar"]')
  await mv.page.waitForTimeout(200)
  const medidas = await mv.page.evaluate(() => {
    const mesa = document.querySelector('.lab-mesa')
    const cerrar = document.querySelector('.lab-cerrar-lab').getBoundingClientRect()
    return { sobra: mesa.scrollWidth - mesa.clientWidth, cerrar: cerrar.right <= innerWidth && cerrar.top >= 0 && cerrar.bottom < 80 }
  })
  check('[360 px] la mesa no se sale de ancho', medidas.sobra <= 1, `${medidas.sobra}px`)
  check('[360 px] el × se ve arriba', medidas.cerrar)
  await mv.page.click('.lab-barra [data-accion="panel"]')
  await mv.page.waitForTimeout(200)
  const tabla = await mv.page.evaluate(() => {
    const t = document.querySelector('.lab-tabla')
    const c = document.querySelector('.lab-tabla-caja')
    return { cabe: t.getBoundingClientRect().width <= c.getBoundingClientRect().width + 1 }
  })
  check('[360 px] la tabla cabe en su caja', tabla.cabe)
  check('[360 px] sin errores', mv.errores.length === 0, mv.errores[0])
  await mv.page.close()
}
await browser.close()

console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
