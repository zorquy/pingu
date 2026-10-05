// Tanda 623 — «¿cómo la encuentro?»: las cuentas, exactas donde se puede.
//
// PINGU, con un enlace (/lab/rf8eeeuz): «¿se está teniendo en cuenta que,
// para buscar X carta robando primero con Dudunsparce, este vuelve al mazo
// y el mazo se hace más grande? Y con Drakloak miras las 2 primeras, te
// quedas una y la otra se va abajo: te quitas 2 de en medio». El motor sí
// lo hacía —se juega con él—; lo que no cuadraba eran las CIFRAS: en esa
// mesa salía «Run Away Draw: 11 %» cuando robar 3 de 40 con una que buscas
// es un 7,5, porque 400 repartos al azar bailan ±3 puntos y con la semilla
// fija bailaban siempre hacia el mismo lado. Y el orden de dos pasos se
// decidía por ese baile.
//
// Lo que se prueba, en Node y con el motor de verdad:
//   1. Con una copia que sabes que está en el mazo, robar 3, robar 2 y los
//      dos seguidos dan 3/40, 2/40 y 5/40 EXACTOS.
//   2. Dudunsparce vuelve al mazo (que crece) y Drakloak manda una abajo:
//      lo cuenta el motor, y se ve en la partida jugada.
//   3. Kadabra y Dudunsparce en cualquier orden dan lo mismo (12,5 contra
//      12,2): «Lo mejor, en cualquier orden», no «en este orden».
//   4. Barajar y DESPUÉS mirar sí importa: ahí sigue «en este orden».
//   5. Un camino con el partidario no esconde a uno sin él.
//   6. Sin saber si está en el mazo o en los premios, la cuenta también sale
//      exacta (3/46).
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const M = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const C = await import(`${RAIZ}/js/constructor/caminos.js`)
const H = await import(`${RAIZ}/js/constructor/caminos-html.js`)
const { Partida, esPokemon } = M
const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}
const mazo = (lista) => lista.map(([n, nombre]) => ({ carta: fila(nombre), n }))
const ALAKAZAM = [
  [4, 'Abra'], [3, 'Kadabra'], [3, 'Alakazam'], [2, 'Dunsparce'], [2, 'Dudunsparce'], [1, 'Dawn'],
  [3, "Boss's Orders"], [4, "Lillie's Determination"], [3, 'Rare Candy'], [4, 'Crushing Hammer'], [4, 'Night Stretcher'],
  [27, 'Psychic Energy'],
]
const nombre = (p, u) => p.carta(u).name
const de = (n) => (c) => c?.name === n
const texto = (c) => c.pasos.map((x) => (x.tipo === 'evolucion' ? `evolucionar a ${x.nombre}` : x.tipo === 'habilidad' ? `${x.nombre}: ${x.habilidad}` : x.nombre)).join(' → ')

// Tu turno 2: Abra de activo y Dudunsparce (sobre Dunsparce) en la banca,
// los dos desde antes; en la mano, lo que se diga; UNA sola copia de la
// carta buscada fuera de la mano (las demás, al descarte); y el mazo VISTO
// (como después de buscar en él) si `visto`. El mazo queda en `largo`.
function montar(mano, { buscada = "Boss's Orders", visto = true, largo = 40, semilla = 7, fuera = [] } = {}) {
  const p = new Partida({ entradas: mazo(ALAKAZAM), efectos: EFECTOS, semilla, vaPrimero: false })
  p.repartir()
  // Todo al mazo, para montar la mesa a mano.
  for (const u of [...p.s.mano]) {
    p.quitarDeMano(u)
    p.s.mazo.push(u)
  }
  p.s.mazo.push(...p.s.premios)
  p.s.premios = []
  const sacar = (n) => {
    const u = p.s.mazo.find((x) => nombre(p, x) === n)
    if (!u) throw new Error(`no queda ${n}`)
    p.s.mazo.splice(p.s.mazo.indexOf(u), 1)
    return u
  }
  p.s.mano.push(sacar('Abra'))
  p.colocar(p.s.mano[0], 'activo')
  p.s.mano.push(sacar('Dunsparce'))
  p.colocar(p.s.mano[0], 'banca')
  p.empezar({ arrancar: false })
  // Empezar pone premios: vuelven al mazo, que los de esta mesa son otros.
  p.s.mazo.push(...p.s.premios)
  p.s.premios = []
  p.s.fase = 'turno'
  p.s.turno = 2
  for (const sl of p.enJuego) sl.entroTurno = 0
  p.s.banca[0].cartas.push(sacar('Dudunsparce'))
  p.s.banca[0].evolucionoTurno = 0
  for (const n of mano) p.s.mano.push(sacar(n))
  // Lo que no tiene que estar (otra manera de robar que taparía la que se
  // mira), al descarte.
  for (const n of fuera) while (p.s.mazo.some((x) => nombre(p, x) === n)) p.s.descarte.push(sacar(n))
  // Una sola copia de la buscada en el mazo.
  while (p.s.mazo.filter((x) => nombre(p, x) === buscada).length > 1) p.s.descarte.push(sacar(buscada))
  // Seis premios de relleno y el mazo, del largo pedido.
  for (let i = 0; i < 6; i++) p.s.premios.push(sacar('Psychic Energy'))
  while (p.s.mazo.length > largo) p.s.descarte.push(sacar('Psychic Energy'))
  p.s.conocimiento = { arriba: 0, abajo: 0, confirmados: {} }
  if (visto) for (const u of p.s.mazo) p.s.conocimiento.confirmados[u] = true
  return p
}
const casi = (a, b, tol = 0.006) => Math.abs(a - b) <= tol

console.log('\n── 1. Robar 3, robar 2 y los dos: cifras exactas ──')
{
  const p = montar(['Kadabra', 'Crushing Hammer'])
  const D = p.s.mazo.length
  const antes = JSON.stringify(p.s)
  const r = await C.buscarCaminos({ partida: p, objetivo: de("Boss's Orders"), muestras: 400 })
  const lista = r.caminos.map((c) => `${(c.p * 100).toFixed(1)}% ${texto(c)}`).join(' / ')
  const camino = (t) => r.caminos.find((c) => texto(c) === t)
  const dud = camino('Dudunsparce: Run Away Draw')
  const kad = camino('evolucionar a Kadabra')
  check(`el mazo tiene ${D} cartas y la buscada está en él`, D === 40 && p.s.mazo.filter((u) => nombre(p, u) === "Boss's Orders").length === 1)
  check('Run Away Draw (roba 3): 3/40 = 7,5 %, sin baile', dud && casi(dud.p, 3 / D), lista)
  check('evolucionar a Kadabra (roba 2): 2/40 = 5 %', kad && casi(kad.p, 2 / D), lista)
  const ambos = r.caminos.find((c) => /Kadabra/.test(texto(c)) && /Dudunsparce/.test(texto(c)) && c.pasos.length === 2)
  check('  …y los dos seguidos, entre 12 y 13 %', ambos && ambos.p > 0.115 && ambos.p < 0.135, lista)
  check('la partida queda EXACTAMENTE como estaba', JSON.stringify(p.s) === antes)
}

console.log('\n── 2. Dudunsparce vuelve al mazo; Drakloak manda una abajo ──')
{
  const p = montar([])
  const D = p.s.mazo.length
  const sl = p.s.banca[0]
  const ui = { cartas: async (o) => o.opciones.slice(0, 1), pokemon: async (o) => o.opciones.slice(0, 1) }
  await p.usarHabilidad(sl, ui)
  // Roba 3 (40 → 37) y vuelven Dudunsparce y Dunsparce: 39.
  check('Run Away Draw: roba 3 y el mazo CRECE con Dudunsparce y lo de debajo (40 → 39)', p.s.mazo.length === D - 3 + 2 && p.s.mano.length === 3, `${p.s.mazo.length} en el mazo, ${p.s.mano.length} en la mano`)
  check('  …y lo que vuelve se sabe que está en el mazo (para las probabilidades)', p.s.mazo.filter((u) => /Dunsparce/.test(nombre(p, u))).every((u) => p.s.conocimiento.confirmados[u]))
  // Drakloak, en otra partida: la que no coges va ABAJO y se sabe.
  const DRAGA = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
  const q = new Partida({ entradas: [[8, 'Dreepy'], [4, 'Drakloak'], [48, 'Psychic Energy']].map(([n, x]) => ({ carta: DRAGA.find((f) => f.name === x), n })), efectos: EFECTOS, semilla: 3, vaPrimero: false })
  q.repartir()
  const dreepy = q.s.mano.find((u) => nombre(q, u) === 'Dreepy')
  q.colocar(dreepy, 'activo')
  q.empezar({ arrancar: false })
  q.s.fase = 'turno'
  q.s.turno = 2
  q.s.activo.entroTurno = 0
  const dk = q.s.mazo.find((u) => nombre(q, u) === 'Drakloak')
  q.s.mazo.splice(q.s.mazo.indexOf(dk), 1)
  q.s.activo.cartas.push(dk)
  const arriba = q.s.mazo.slice(0, 2)
  const largo = q.s.mazo.length
  await q.usarHabilidad(q.s.activo, ui)
  check('Recon Directive: de las 2 de arriba, una a la mano y la otra al FONDO (el mazo pierde 1, y las 2 de arriba salen de arriba)', q.s.mazo.length === largo - 1 && q.s.mazo.at(-1) === arriba[1] && !q.s.mazo.slice(0, 2).some((u) => arriba.includes(u)) && q.s.conocimiento.abajo === 1)
}

console.log('\n── 3. Cuando el orden no cambia nada, se dice ──')
{
  // Sin Lillie (robarla con Dudunsparce y jugarla sería el mejor, y de tres
  // pasos), para que el mejor sea el de los dos que roban.
  const p = montar(['Kadabra', 'Crushing Hammer'], { fuera: ["Lillie's Determination"] })
  const r = await C.buscarCaminos({ partida: p, objetivo: de("Boss's Orders"), muestras: 400 })
  const mejor = r.caminos.find((c) => !c.dominado)
  check('el mejor es Kadabra y Dudunsparce', mejor && mejor.pasos.length === 2 && /Kadabra/.test(texto(mejor)) && /Dudunsparce/.test(texto(mejor)), mejor && texto(mejor))
  check('  …y el orden da igual (12,5 contra 12,2: no se distingue)', mejor?.ordenDaIgual === true, String(mejor?.ordenDaIgual))
  const html = H.resultadoDeCaminosHtml(r, "Boss's Orders")
  check('  …y lo dice así: «Lo mejor, en cualquier orden»', /Lo mejor, en cualquier orden/.test(html) && !/en este orden/.test(html))
}

console.log('\n── 4. Cuando el orden sí importa, también ──')
{
  // La mesa de la 595: las dos de arriba ya vistas (y no son), un Poffin
  // que baraja y Drakloak que mira las dos de arriba.
  const DRAGAPULT = [
    [4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Budew'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Munkidori'], [1, 'Moltres'],
    [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [3, 'Ultra Ball'],
    [4, 'Crushing Hammer'], [2, 'Crispin'], [2, 'Risky Ruins'], [1, 'Dawn'], [1, 'Judge'], [1, "Rosa's Encouragement"], [1, 'Special Red Card'], [1, 'Unfair Stamp'],
    [3, 'Fire Energy'], [3, 'Psychic Energy'], [2, 'Darkness Energy'],
  ]
  const p = new Partida({ entradas: mazo(DRAGAPULT), efectos: EFECTOS, semilla: 11, vaPrimero: false })
  p.repartir()
  const traer = (n) => {
    const u = [...p.s.mazo, ...p.s.premios].find((x) => nombre(p, x) === n)
    if (p.s.mazo.includes(u)) p.sacarDelMazo(u)
    else {
      const i = p.s.premios.indexOf(u)
      const otra = p.s.mazo.find((x) => !esPokemon(p.carta(x)))
      p.sacarDelMazo(otra)
      p.s.premios[i] = otra
    }
    return u
  }
  const dreepy = p.s.mano.find((x) => nombre(p, x) === 'Dreepy') || traer('Dreepy')
  if (!p.s.mano.includes(dreepy)) p.s.mano.push(dreepy)
  p.colocar(dreepy, 'activo')
  p.empezar()
  for (const u of [...p.s.mano]) {
    p.quitarDeMano(u)
    p.alMazo([u], 'barajar')
  }
  p.s.turno = 1
  p.s.activo.entroTurno = -5
  p.s.activo.cartas.push(traer('Drakloak'))
  p.s.activo.evolucionoTurno = -5
  for (const n of ['Buddy-Buddy Poffin', 'Crushing Hammer']) p.s.mano.push(traer(n))
  // Sin Lillie, Meowth ex ni Camilla (robarlos y jugarlos alarga el mejor a
  // cuatro pasos), al descarte.
  for (const n of ["Lillie's Determination", 'Meowth ex', 'Fezandipiti ex', 'Night Stretcher']) {
    for (const u of p.s.mazo.filter((x) => nombre(p, x) === n)) {
      p.sacarDelMazo(u)
      p.s.descarte.push(u)
    }
  }
  for (const n of ['Psychic Energy', 'Fire Energy']) {
    const u = p.s.mazo.find((x) => nombre(p, x) === n)
    p.sacarDelMazo(u)
    p.alMazo([u], 'arriba')
  }
  const r = await C.buscarCaminos({ partida: p, objetivo: de("Boss's Orders"), muestras: 300 })
  const mejor = r.caminos.find((c) => !c.dominado)
  // (Y después, si sale, un partidario que roba: Judge.)
  check('el mejor empieza por Poffin → Drakloak', mejor && /^Buddy-Buddy Poffin → Drakloak: Recon Directive/.test(texto(mejor)) && mejor.pasos.length <= 3, r.caminos.slice(0, 3).map(texto).join(' / '))
  check('  …y AQUÍ el orden importa (mirar primero no trae nada)', mejor?.ordenDaIgual === false, String(mejor?.ordenDaIgual))
  check('  …«Lo mejor, en este orden»', /Lo mejor, en este orden/.test(H.resultadoDeCaminosHtml(r, "Boss's Orders")))
}

console.log('\n── 5. El partidario no esconde lo que no lo gasta ──')
{
  // Dawn trae un Alakazam seguro, pero gasta el partidario del turno;
  // Kadabra → Dudunsparce no. Antes Dawn (un paso, 100 %) lo dejaba en
  // «otros caminos».
  const p = montar(['Kadabra', 'Dawn'], { buscada: 'Alakazam' })
  const r = await C.buscarCaminos({ partida: p, objetivo: de('Alakazam'), muestras: 300 })
  const lista = r.caminos.map((c) => `${(c.p * 100).toFixed(1)}% ${texto(c)}${c.dominado ? ' (dominado)' : ''}`).join(' / ')
  const dawn = r.caminos.find((c) => texto(c) === 'Dawn')
  check('Dawn: la trae siempre (sabes que está en el mazo)', dawn && dawn.p > 0.99 && !dawn.dominado, lista)
  const sin = r.caminos.find((c) => !c.pasos.some((x) => x.partidario) && c.pasos.length >= 2 && /Dudunsparce/.test(texto(c)))
  check('  …y un camino sin partidario sigue a la vista, no en «otros»', sin && !sin.dominado, lista)
}

console.log('\n── 6. Sin saber si está en el mazo o en los premios ──')
{
  const p = montar(['Crushing Hammer'], { visto: false, largo: 40 })
  // Las de la buscada, entre el mazo y los premios: que la cuenta sea
  // la de 46 huecos y no la de 40.
  const r = await C.buscarCaminos({ partida: p, objetivo: de("Boss's Orders"), muestras: 460 })
  const dud = r.caminos.find((c) => texto(c) === 'Dudunsparce: Run Away Draw')
  check('Run Away Draw sin haber visto el mazo: 3/46 = 6,5 %', dud && casi(dud.p, 3 / 46, 0.005), dud && (dud.p * 100).toFixed(2))
}

console.log(fails ? `\n${fails} fallos.` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
