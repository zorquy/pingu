// Tanda 593 — los efectos de los ataques, también cuando la carta está en
// ESPAÑOL; y los que todavía había que hacer a mano.
//
// PINGU: «Efectos de ataques, como por ejemplo el del Budew, que deja sin
// objetos, pues que directamente si se usa un Budew, que no te deja
// utilizar objetos. Y bueno, con eso, muchos más ataques que tienen sus
// efectos, pues que se cumplan y no los tengas que hacer a mano».
//
// El veto de Budew existía desde la 462… leyendo el texto INGLÉS. Y desde
// la 330 el engorde guarda el texto en español siempre que TCGdex lo
// tiene, así que el Budew de verdad dice «Durante el próximo turno de tu
// rival, este no puede jugar ninguna carta de Objeto de su mano» y no
// casaba con nada: el ataque se quedaba «a mano», sin dar error.
//
// Lo que se prueba:
//   1. Los ~1.300 pares (inglés, español) de los ataques de Escarlata y
//      Púrpura y Megaevolución (tcgdex/cards-database): donde el inglés se
//      lee entero, el español da EXACTAMENTE los mismos pasos. Y lo mismo
//      con las habilidades que se aplican solas.
//   2. Budew EN ESPAÑOL contra el motor: J2 no puede jugar objetos.
//   3. Los efectos que se leían y no se cumplían (contaban cero): «tus
//      Pokémon {G}», «si tiene Energía {R}», «Uxie y Azelf», «si alguno de
//      tus Pokémon {F} quedó KO», el bono de «tus Pokémon {F}» y el
//      «no puede usar ataques» que bloqueaba solo uno.
//   4. Los efectos nuevos, jugados: premios cogidos, menos por contadores,
//      quitar herramientas antes del daño, el rival descarta (y elige él),
//      descarte al azar, robar hasta N, buscar un partidario.
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
const PARES = JSON.parse(readFileSync(new URL('./textos-tcgdex.json', import.meta.url), 'utf8'))

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. El mismo ataque en inglés y en español, los mismos pasos ──')
{
  // Los nombres propios (de un ataque, de una habilidad, «excepto los de
  // Ferrotesta ex») se quedan en el idioma de la carta: es contra lo que
  // se comparan, y la carta habla ese idioma.
  const sinNombres = (x) => JSON.stringify(x, (k, v) => (k === 'nombre' || k === 'habilidad' || k === 'salvo' || k === 'contiene' ? '·' : v))
  let enteros = 0
  let cartas = 0
  const malos = []
  const sinLeerEs = []
  for (const x of PARES.ataques) {
    const en = T.leerAtaque(x.en)
    const es = T.leerAtaque(x.es)
    if (!en.completo || en.vacio) continue
    enteros++
    cartas += x.n
    if (!es.completo) sinLeerEs.push(`${es.sinLeer[0]}`)
    else if (sinNombres(en.pasos) !== sinNombres(es.pasos)) malos.push(`${x.es} → ${JSON.stringify(es.pasos)} ≠ ${JSON.stringify(en.pasos)}`)
  }
  check(`los ataques que se leen en inglés se leen en español (${enteros} textos, ${cartas} cartas)`, sinLeerEs.length === 0, sinLeerEs.slice(0, 3).join(' | '))
  check('  …y dan EXACTAMENTE los mismos pasos', malos.length === 0, malos.slice(0, 2).join(' | '))
  // Lo que ya se sabía leer no baja (2.777 cartas al cerrar la tanda).
  check('  …y son por lo menos los de esta tanda', cartas >= 2777, cartas)
  let conRasgo = 0
  const malasH = []
  for (const x of PARES.habilidades) {
    const en = T.leerHabilidad(x.en)
    if (!en.length) continue
    conRasgo += x.n
    const es = T.leerHabilidad(x.es)
    if (sinNombres(en) !== sinNombres(es)) malasH.push(`${x.es} → ${JSON.stringify(es)}`)
  }
  check(`las habilidades que se aplican solas, igual en los dos idiomas (${conRasgo} cartas)`, malasH.length === 0 && conRasgo >= 105, malasH.slice(0, 2).join(' | '))
  // El texto de TCGdex trae a veces el símbolo como HTML.
  const html = T.leerAtaque('Si este Pokémon tiene alguna Energía <span class="energy-symbol fire" title="fuego">fire</span> unida, este ataque hace 80 puntos de daño más.')
  check('el símbolo de energía en HTML («<span class="energy-symbol fire">») se lee como {R}', html.completo && html.pasos[0]?.nombre === '{r} energy', JSON.stringify(html))
  // Y lo que no entiende sigue sin inventarse: todo o nada.
  const mitad = T.leerAtaque('El Pokémon Activo de tu rival pasa a estar Dormido. Baraja una carta inventada en la baraja de tu rival.')
  check('una frase española que no se entiende deja el ataque ENTERO a mano', !mitad.completo && mitad.sinLeer.length === 1)
}

// ═════════════════════════════════════════════════════════════════════
// El motor, con cartas de la ficha y cartas hechas a medida.
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}
let ids = 0
const poke = (name, { hp = 200, types = ['Colorless'], attacks = [], abilities = [], stage = 'Basic', evolve_from = null } = {}) => ({ id: `t569-${++ids}`, set_id: 't569', local_id: String(ids), name, name_es: name, category: 'Pokemon', stage, evolve_from, hp, types, retreat: 1, attacks, abilities, weaknesses: [], resistances: [], regulation_mark: 'I' })
const ataque = (name, effect, damage = null, cost = []) => ({ name, effect, damage, cost })
const relleno = [[20, 'Poké Pad'], [10, 'Psychic Energy'], [10, 'Fire Energy'], [6, 'Fighting Energy'], [6, 'Grass Energy'], [4, "Boss's Orders"], [4, "Hero's Cape"]]
const mazo = (lista) => [...lista, ...relleno].map(([n, c]) => ({ carta: typeof c === 'string' ? fila(c) : c, n }))
const uiGuion = (mesa, o = {}) => ({
  preguntas: [],
  async cartas(x) { this.preguntas.push(x); const pool = x.elegibles || x.opciones; return pool.slice(0, Math.max(x.min, Math.min(x.max, 1))) },
  async pokemon(x) { return x.opciones.slice(0, Math.max(x.min, Math.min(x.max, 1))) },
  async confirmar() { return o.confirmar ?? true },
  async opcion(x) { return x.opciones.find((y) => !y.no).id },
  async numero(x) { return x.valor },
  async repartir(x) { return { [x.opciones[0]]: x.total } },
  async premios(x) { return (x.partida || mesa.actual).s.premios.slice(0, x.n) },
})
const sacar = (p, c) => {
  const es = (x) => (typeof c === 'string' ? p.carta(x).name === c : p.carta(x) === c)
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
// La banca, vacía: lo que había de activo pasa a ella al poner otro, y
// estas cuentas dependen de qué hay EXACTAMENTE en juego.
const sinBanca = (p) => { p.s.banca = [] }
const banca = (p, c) => { const s = p.nuevoSlot(sacar(p, c)); s.entroTurno = -5; p.s.banca.push(s); return s }
const aMano = (p, c) => { const u = sacar(p, c); p.s.mano.push(u); return u }
async function mesaCon(listaA, listaB, { semilla = 7, ui = {} } = {}) {
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
  // J1 empieza y no ataca en su primer turno: se pasa hasta su segundo.
  await mesa.accion(() => mesa.pasarTurno(u), u)
  await mesa.accion(() => mesa.pasarTurno(u), u)
  return { mesa, u, a: mesa.jugadores[0], b: mesa.jugadores[1] }
}
const atacar = (mesa, u, p, i = 0) => mesa.accion(() => p.atacar(p.s.activo, i, u), u)
const registro = (mesa) => mesa.m.registro.map((x) => x.texto).join(' | ')

console.log('\n── 2. Budew, con la carta en español ──')
{
  const budew = { ...fila('Budew'), id: 't569-budew', detalle_lang: 'es', attacks: [ataque('Polen Picazón', 'Durante el próximo turno de tu rival, este no puede jugar ninguna carta de Objeto de su mano.', '10')] }
  const muro = poke('Muro', { hp: 300 })
  const { mesa, u, a, b } = await mesaCon([[4, budew]], [[4, muro]])
  activo(a, budew)
  await atacar(mesa, u, a, 0)
  check('es el turno de J2', mesa.actual === b)
  const pad = aMano(b, 'Poké Pad')
  const no = b.motivoNoJugar(pad)
  check('J2 NO puede jugar objetos: «Polen Picazón» se ha leído en español', /no puedes jugar objetos/i.test(no || ''), no)
  check('  …y el registro lo dice', /no podrá jugar objetos en su próximo turno/.test(registro(mesa)), registro(mesa).slice(-200))
  const boss = aMano(b, "Boss's Orders")
  check('  …un partidario sí', !b.motivoNoJugar(boss), b.motivoNoJugar(boss))
}

console.log('\n── 3. Lo que se leía y contaba CERO ──')
{
  // «Por cada uno de tus Pokémon {G} en juego»: antes se buscaba un DUEÑO
  // llamado «{g}» y salía cero.
  const at = poke('Contador', { attacks: [ataque('Bosque', 'Este ataque hace 30 puntos de daño por cada uno de tus Pokémon {G} en juego.', '30×')] , types: ['Grass'] })
  const verde = poke('Hoja', { types: ['Grass'] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a, b } = await mesaCon([[4, at], [4, verde]], [[4, muro]])
  activo(a, at)
  sinBanca(a)
  banca(a, verde)
  banca(a, verde)
  await atacar(mesa, u, a, 0)
  check('«tus Pokémon {G} en juego»: 3 Pokémon Planta × 30 = 90', b.s.activo.danio === 90, b.s.activo.danio)
}
{
  const at = poke('Ardiente', { attacks: [ataque('Llama', 'Si este Pokémon tiene alguna Energía {R} unida, este ataque hace 90 puntos de daño más.', '30+')] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a, b } = await mesaCon([[4, at]], [[4, muro]])
  activo(a, at, { energias: ['Fire Energy'] })
  await atacar(mesa, u, a, 0)
  check('«si tiene alguna Energía {R} unida»: con una Fuego, 30 + 90', b.s.activo.danio === 120, b.s.activo.danio)
}
{
  const at = poke('Ardiente', { attacks: [ataque('Llama', 'Si este Pokémon tiene alguna Energía {R} unida, este ataque hace 90 puntos de daño más.', '30+')] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a, b } = await mesaCon([[4, at]], [[4, muro]])
  activo(a, at, { energias: ['Psychic Energy'] })
  await atacar(mesa, u, a, 0)
  check('  …y con una Psíquica, solo 30', b.s.activo.danio === 30, b.s.activo.danio)
}
{
  const mes = poke('Mesprit', { attacks: [ataque('Supremacía', 'Si no tienes a Uxie y Azelf en tu Banca, este ataque no hace nada.', '200')] })
  const uxie = poke('Uxie')
  const azelf = poke('Azelf')
  const muro = poke('Muro', { hp: 400 })
  const con = await mesaCon([[4, mes], [2, uxie], [2, azelf]], [[4, muro]])
  activo(con.a, mes)
  sinBanca(con.a)
  banca(con.a, uxie)
  banca(con.a, azelf)
  await atacar(con.mesa, con.u, con.a, 0)
  check('«si no tienes a Uxie y Azelf»: con los DOS, hace sus 200', con.b.s.activo.danio === 200, con.b.s.activo.danio)
  const sin = await mesaCon([[4, mes], [2, uxie], [2, azelf]], [[4, muro]])
  activo(sin.a, mes)
  sinBanca(sin.a)
  banca(sin.a, uxie)
  await atacar(sin.mesa, sin.u, sin.a, 0)
  check('  …con uno solo, nada (antes buscaba un Pokémon llamado «uxie y azelf»)', sin.b.s.activo.danio === 0, sin.b.s.activo.danio)
}
{
  // El bono de una habilidad para «tus Pokémon {F}»: antes solo valía
  // para los «del futuro» y los de un dueño.
  const gong = poke('Gong', { types: ['Fighting'], abilities: [{ name: 'Gong de Lucha', effect: 'Los ataques usados por tus Pokémon {F} hacen 30 puntos de daño más al Pokémon Activo de tu rival (antes de aplicar Debilidad y Resistencia).' }] })
  const puño = poke('Puño', { types: ['Fighting'], attacks: [ataque('Golpe', '', '50')] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a, b } = await mesaCon([[4, puño], [2, gong]], [[4, muro]])
  activo(a, puño)
  sinBanca(a)
  banca(a, gong)
  await atacar(mesa, u, a, 0)
  check('el bono de «tus Pokémon {F}» suma: 50 + 30', b.s.activo.danio === 80, b.s.activo.danio)
}
{
  const at = poke('Cansado', { attacks: [ataque('Golpazo', 'Durante tu próximo turno, este Pokémon no puede usar ataques.', '100'), ataque('Placaje', '', '10')] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a } = await mesaCon([[4, at]], [[4, muro]])
  activo(a, at)
  await atacar(mesa, u, a, 0)
  await mesa.accion(() => mesa.pasarTurno(u), u)
  const ats = a.ataquesDe(a.s.activo)
  const bloqueados = ats.filter((x) => a.motivoNoAtacar(a.s.activo, x.ataque))
  check('«no puede usar ataques» bloquea LOS DOS ataques (antes solo el que se usó)', bloqueados.length === 2, ats.map((x) => a.motivoNoAtacar(a.s.activo, x.ataque)).join(' / '))
}
{
  // «Si alguno de tus Pokémon {F} quedó fuera de combate…»: se guarda la
  // carta KO y no solo su nombre, que no dice el tipo.
  const venga = poke('Vengador', { types: ['Fighting'], attacks: [ataque('Revancha', 'Si alguno de tus Pokémon {F} quedó Fuera de Combate por el daño de un ataque durante el último turno de tu rival, este ataque hace 90 puntos de daño más.', '30+')] })
  const caido = poke('Caído', { types: ['Fighting'], hp: 30 })
  const verdugo = poke('Verdugo', { hp: 400, attacks: [ataque('Corte', '', '50')] })
  const { mesa, u, a, b } = await mesaCon([[4, venga], [4, caido]], [[4, verdugo]])
  activo(a, caido)
  banca(a, venga)
  await mesa.accion(() => mesa.pasarTurno(u), u)
  activo(b, verdugo)
  await atacar(mesa, u, b, 0)
  check('el rival deja KO a un Pokémon {F}', a.s.caidos === 1 && mesa.actual === a, `${a.s.caidos}`)
  if (a.s.activo !== a.s.banca.find(() => false)) {
    const v = [a.s.activo, ...a.s.banca].find((x) => x && a.cartaDe(x) === venga)
    if (a.s.activo !== v) { a.s.banca = a.s.banca.filter((x) => x !== v); if (a.s.activo) a.s.banca.push(a.s.activo); a.s.activo = v }
  }
  await atacar(mesa, u, a, 0)
  check('  …y «si alguno de tus Pokémon {F} quedó KO» suma: 30 + 90', b.s.activo.danio === 120, b.s.activo.danio)
}

console.log('\n── 4. Los efectos nuevos, jugados ──')
{
  const at = poke('Cuentapremios', { attacks: [ataque('Cuenta', 'Este ataque hace 30 puntos de daño más por cada carta de Premio que haya cogido tu rival.', '20+')] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a, b } = await mesaCon([[4, at]], [[4, muro]])
  activo(a, at)
  b.s.premios = b.s.premios.slice(2)
  await atacar(mesa, u, a, 0)
  check('«por cada carta de Premio que haya cogido tu rival»: 2 cogidos, 20 + 60', b.s.activo.danio === 80, b.s.activo.danio)
}
{
  const at = poke('Herido', { attacks: [ataque('Desgaste', 'Este ataque hace 10 puntos de daño menos por cada contador de daño en este Pokémon.', '100-')] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a, b } = await mesaCon([[4, at]], [[4, muro]])
  activo(a, at, { danio: 30 })
  await atacar(mesa, u, a, 0)
  check('«10 menos por cada contador en este Pokémon»: 3 contadores, 100 − 30', b.s.activo.danio === 70, b.s.activo.danio)
}
{
  const at = poke('Quitacapas', { attacks: [ataque('Desnudar', 'Antes de infligir daño, descarta todas las Herramientas Pokémon del Pokémon Activo de tu rival.', '200')] })
  const def = poke('Defensa', { hp: 180 })
  const { mesa, u, a, b } = await mesaCon([[4, at]], [[4, def]])
  activo(a, at)
  activo(b, def, { herramienta: "Hero's Cape" })
  check('con la Capa de Héroe tiene 280 PS', b.psDe(b.s.activo) === 280, b.psDe(b.s.activo))
  await atacar(mesa, u, a, 0)
  check('«antes de infligir daño, descarta las herramientas»: la capa se va y 200 lo deja KO', b.s.caidos === 1 && b.s.descarte.some((x) => b.carta(x).name === "Hero's Cape"), `caídos ${b.s.caidos}`)
}
{
  const at = poke('Ladrón', { attacks: [ataque('Hurto', 'Tu rival descarta 2 cartas de su mano.', '10')] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a, b } = await mesaCon([[4, at]], [[4, muro]])
  activo(a, at)
  const antes = b.s.mano.length
  await atacar(mesa, u, a, 0)
  const pregunta = u.preguntas.find((x) => /descarta 2 cartas de tu mano/.test(x.titulo))
  check('«tu rival descarta 2 cartas»: las elige el RIVAL (se le pregunta a él)', pregunta?.partida === b && pregunta.min === 2, pregunta?.titulo)
  // J2 roba 1 al empezar su turno.
  check('  …y su mano baja en 2 (más la que roba al empezar)', b.s.mano.length === antes - 2 + 1, `${antes} → ${b.s.mano.length}`)
}
{
  const at = poke('Ladrón', { attacks: [ataque('Hurto', 'Descarta 1 carta aleatoria de la mano de tu rival.', '10')] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a, b } = await mesaCon([[4, at]], [[4, muro]])
  activo(a, at)
  const antes = b.s.descarte.length
  await atacar(mesa, u, a, 0)
  check('«descarta 1 carta aleatoria de la mano de tu rival»: sin preguntar a nadie', b.s.descarte.length === antes + 1 && !u.preguntas.length, `${antes} → ${b.s.descarte.length}`)
}
{
  const at = poke('Lector', { attacks: [ataque('Estudio', 'Puedes robar cartas hasta que tengas 6 cartas en tu mano.', '')] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a } = await mesaCon([[4, at]], [[4, muro]])
  activo(a, at)
  a.s.mano.splice(2)
  // Se mira la mano JUSTO después del ataque, antes de que el turno pase.
  let tras = null
  const robarHasta = a.robarHasta.bind(a)
  a.robarHasta = (n, o) => { const r = robarHasta(n, o); tras = a.s.mano.length; return r }
  await atacar(mesa, u, a, 0)
  check('«puedes robar cartas hasta tener 6»: de 2 a 6', tras === 6, tras)
}
{
  const at = poke('Buscador', { attacks: [ataque('Llamada', 'Busca en tu baraja 1 carta de Partidario, enséñala y ponla en tu mano. Después, baraja las cartas de tu baraja.', '')] })
  const muro = poke('Muro', { hp: 400 })
  const { mesa, u, a } = await mesaCon([[4, at]], [[4, muro]])
  activo(a, at)
  const antes = a.s.mano.filter((x) => a.carta(x).name === "Boss's Orders").length
  await atacar(mesa, u, a, 0)
  const pregunta = u.preguntas.find((x) => x.zona === 'mazo')
  check('«busca en tu baraja 1 carta de Partidario»: solo se ofrecen partidarios', pregunta && pregunta.elegibles.every((x) => a.carta(x).name === "Boss's Orders") && pregunta.max === 1, pregunta?.titulo)
  check('  …y va a la mano', a.s.mano.filter((x) => a.carta(x).name === "Boss's Orders").length === antes + 1)
}

console.log(fails ? `\n${fails} fallos.` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
