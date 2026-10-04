// Tanda 554 — «¿Cómo encuentro esta carta?»: los caminos de objetos,
// partidarios y habilidades para traer una carta, con su probabilidad, en
// el laboratorio y en las repeticiones.
//
// PINGU: «poder parar y preguntar a la app cuál es el mejor camino de
// habilidades, entrenadores y objetos que tienes que usar para que te
// favorezca al máximo la probabilidad de encontrar X carta. Que te pregunte
// qué carta es la que quieres buscar y te diga todos los posibles caminos
// con la probabilidad de cada uno».
//
//   1. El motor (constructor/caminos.js), en Node y con el motor de verdad:
//      el reparto de lo que no sabes respeta lo que sabes; las cifras casan
//      con las EXACTAS donde se pueden calcular a mano (Ultra Ball: falla
//      solo si están todas en premios; Determinación de Lillie: una
//      hipergeométrica); no hace trampa con el orden de verdad; respeta el
//      partidario del turno; las habilidades «al bajarlo» cuentan; marca
//      los caminos peores que uno más corto; y deja la partida (y la mesa
//      de dos) EXACTAMENTE como estaba.
//   2. Cómo se enseña (constructor/caminos-html.js): un casi seguro no se
//      vende como «100 %».
//   3. El laboratorio: la pestaña «Encontrar» del panel.
//   4. Las repeticiones: «¿Cómo encuentro una carta?» en la jugada que se
//      mira, solo con la mano entera de quien juega.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const M = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const C = await import(`${RAIZ}/js/constructor/caminos.js`)
const H = await import(`${RAIZ}/js/constructor/caminos-html.js`)
const { Partida, Mesa, esPokemon, faseDe, comb, hiper, contextoDeProbabilidad, probabilidadDeGrupo } = M

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
const nombre = (p, u) => p.carta(u).name
const de = (n) => (c) => c?.name === n

// Una partida contra el muñeco en tu turno 1 (yendo segundo: con
// partidario), con la mano que se pida. Lo demás de la mano vuelve al
// mazo: desde ese momento SABES que está dentro (confirmado).
function montar(mano, { semilla = 11, lista = DRAGAPULT, activo = 'Budew' } = {}) {
  const p = new Partida({ entradas: mazo(lista), efectos: EFECTOS, semilla, vaPrimero: false })
  p.repartir()
  // De activo, uno que no es ninguna de las que se buscan.
  const b = [...p.s.mano, ...p.s.mazo, ...p.s.premios].find((u) => nombre(p, u) === activo)
  if (!p.s.mano.includes(b)) {
    if (p.s.mazo.includes(b)) p.sacarDelMazo(b)
    else {
      // Un premio por otro: el sitio del premio lo ocupa una carta del mazo.
      const i = p.s.premios.indexOf(b)
      const otra = p.s.mazo.find((u) => !esPokemon(p.carta(u)))
      p.sacarDelMazo(otra)
      p.s.premios[i] = otra
    }
    p.s.mano.push(b)
  }
  p.colocar(b, 'activo')
  p.empezar()
  for (const u of [...p.s.mano]) {
    p.quitarDeMano(u)
    p.alMazo([u], 'barajar')
  }
  for (const n of mano) {
    const u = p.s.mazo.find((x) => nombre(p, x) === n) || p.s.premios.find((x) => nombre(p, x) === n)
    if (!u) throw new Error(`no hay ${n}`)
    if (p.s.mazo.includes(u)) p.sacarDelMazo(u)
    else p.s.premios = p.s.premios.filter((x) => x !== u)
    p.s.mano.push(u)
  }
  return p
}
const texto = (c) => c.pasos.map((x) => x.nombre).join(' → ')
const camino = (r, t) => r.caminos.find((c) => texto(c) === t)

console.log('\n── 1. El motor ──')
{
  // El reparto de lo que no sabes.
  const p = montar(['Ultra Ball', 'Psychic Energy', 'Fire Energy'])
  p.mirarArriba(2) // las 2 de arriba, vistas: no se mueven
  const arriba = p.s.mazo.slice(0, 2)
  const ctx = contextoDeProbabilidad(p)
  let bien = true
  let cambia = false
  const azar = (() => {
    let t = 7
    return () => ((t = (t * 16807) % 2147483647) / 2147483647)
  })()
  for (let k = 0; k < 50; k++) {
    const s = C.repartoDeLoQueNoSabes(p.s, azar)
    const mismas = [...s.mazo, ...s.premios].sort().join() === [...p.s.mazo, ...p.s.premios].sort().join()
    const arribaIgual = s.mazo.slice(0, 2).join() === arriba.join()
    const confEnMazo = ctx.conf.every((u) => s.mazo.includes(u))
    const manoIgual = s.mano.join() === p.s.mano.join()
    if (!(mismas && arribaIgual && confEnMazo && manoIgual && s.premios.length === p.s.premios.length)) bien = false
    if (s.premios.join() !== p.s.premios.join()) cambia = true
  }
  check('un reparto cambia SOLO lo que no sabes: las mismas cartas, lo de arriba en su sitio, lo confirmado dentro del mazo y la mano igual', bien && cambia)
}
{
  // Ultra Ball: la trae salvo que estén TODAS en los premios.
  const p = montar(['Ultra Ball', 'Psychic Energy', 'Fire Energy'])
  const antes = JSON.stringify(p.s)
  const r = await C.buscarCaminos({ partida: p, objetivo: de('Dragapult ex'), muestras: 400 })
  const ub = camino(r, 'Ultra Ball')
  const exacta = 1 - probabilidadDeGrupo(p, de('Dragapult ex'), 1).todasPremiadas
  check('Ultra Ball → Dragapult ex: la probabilidad de que NO estén todas en los premios (la exacta)', ub && Math.abs(ub.p - exacta) < 0.04, `${ub?.p} contra ${exacta.toFixed(3)}`)
  check('  …y es el primer camino', texto(r.caminos[0] || { pasos: [] }) === 'Ultra Ball', r.caminos.map(texto).join(' / '))
  check('la partida queda EXACTAMENTE como estaba (mano, mazo, premios, azar, registro)', JSON.stringify(p.s) === antes)
  check('un objeto que no trae nada (Boss) no sale como camino', !r.caminos.some((c) => c.pasos.some((x) => x.clave === "boss's orders")))
}
{
  // Determinación de Lillie: baraja la mano y roba 6. La exacta, a mano:
  // las X que no has visto se reparten entre el mazo sin identificar (S) y
  // los premios boca abajo; el mazo nuevo es eso, lo confirmado y la mano.
  const p = montar(["Lillie's Determination", 'Psychic Energy', 'Fire Energy', 'Darkness Energy'])
  const r = await C.buscarCaminos({ partida: p, objetivo: de('Dragapult ex'), muestras: 400 })
  const ctx = contextoDeProbabilidad(p)
  // Las que SABES que están en el mazo (volvieron de la mano al montar)
  // están en el mazo seguro; las demás, repartidas. Y con 6 premios, Lillie
  // roba 8 en vez de 6 (lo dice la carta).
  const esX = (u) => nombre(p, u) === 'Dragapult ex'
  const kx = [...ctx.sinConf, ...ctx.premiosOcultos].filter(esX).length
  const cx = ctx.conf.filter(esX).length
  const n = p.s.premios.length === 6 ? 8 : 6
  const D2 = ctx.D + p.s.mano.length - 1
  let ninguna = 0
  for (let h = 0; h <= kx; h++) ninguna += hiper(ctx.Uu, kx, ctx.S, h) * (comb(D2 - cx - h, n) / comb(D2, n))
  const lillie = camino(r, "Lillie's Determination")
  check('Determinación de Lillie → Dragapult ex: casa con la hipergeométrica exacta', lillie && Math.abs(lillie.p - (1 - ninguna)) < 0.07, `${lillie?.p} contra ${(1 - ninguna).toFixed(3)}`)
  check('  …y lleva la marca de partidario', lillie?.pasos[0].partidario === true)
}
{
  // No hace trampa: con una Dragapult ex DE VERDAD arriba del mazo (que no
  // has visto), Lillie no pasa a ser un «seguro».
  const p = montar(["Lillie's Determination", 'Psychic Energy', 'Fire Energy', 'Darkness Energy'])
  const dp = p.s.mazo.filter((u) => nombre(p, u) === 'Dragapult ex')
  if (dp.length) {
    p.s.mazo = [...dp, ...p.s.mazo.filter((u) => !dp.includes(u))]
    p.s.conocimiento = { arriba: 0, abajo: 0, confirmados: p.s.conocimiento.confirmados }
  }
  const r = await C.buscarCaminos({ partida: p, objetivo: de('Dragapult ex'), muestras: 400 })
  const lillie = camino(r, "Lillie's Determination")
  check('no mira el orden de verdad: con la carta arriba (sin saberlo), Lillie sigue siendo lo que es', dp.length > 0 && lillie && lillie.p < 0.8, `${lillie?.p}`)
}
{
  // El partidario del turno ya jugado: Lillie no es camino.
  const p = montar(["Lillie's Determination", 'Ultra Ball', 'Psychic Energy', 'Fire Energy'])
  p.s.flags.partidario = true
  const r = await C.buscarCaminos({ partida: p, objetivo: de('Dragapult ex'), muestras: 200 })
  check('con el partidario del turno ya jugado, Lillie no sale en ningún camino', r.caminos.length > 0 && !r.caminos.some((c) => c.pasos.some((x) => x.partidario)), r.caminos.map(texto).join(' / '))
}
{
  // Los caminos peores que uno más corto se marcan.
  const p = montar(["Lillie's Determination", 'Ultra Ball', 'Psychic Energy', 'Fire Energy'])
  const r = await C.buscarCaminos({ partida: p, objetivo: de('Dragapult ex'), muestras: 300 })
  const largo = r.caminos.find((c) => c.pasos.length > 1)
  check('un camino más largo y no mejor que «Ultra Ball» sale marcado como peor', largo && largo.dominado === true && !camino(r, 'Ultra Ball').dominado, r.caminos.map((c) => `${texto(c)} ${c.p} ${c.dominado}`).join(' / '))
  const conLillie = r.caminos.find((c) => c.pasos.length === 2 && c.pasos[0].clave === "lillie's determination")
  check('  …y un paso que no siempre se puede dar dice cuántas veces se pudo («si la tienes»)', !conLillie || (conLillie.pasos[1].siempre === false && conLillie.pasos[1].cuando > 0 && conLillie.pasos[1].cuando < 1), JSON.stringify(conLillie?.pasos))
}
{
  // Una habilidad «al bajarlo»: Meowth ex busca un partidario.
  const p = montar(['Meowth ex', 'Psychic Energy', 'Fire Energy'])
  const r = await C.buscarCaminos({ partida: p, objetivo: de('Crispin'), muestras: 400 })
  const meowth = r.caminos[0]
  const exacta = 1 - probabilidadDeGrupo(p, de('Crispin'), 1).todasPremiadas
  check('bajar Meowth ex (Last-Ditch) para traer Crispin: la exacta de que no estén todas en premios', meowth?.pasos[0].tipo === 'banca' && meowth.pasos[0].habilidad === 'Last-Ditch' && Math.abs(meowth.p - exacta) < 0.04, `${JSON.stringify(meowth?.pasos[0])} ${meowth?.p} contra ${exacta.toFixed(3)}`)
}
{
  // Un PUENTE: sin Ultra Ball ni Dawn en la mano, Pokégear trae un
  // partidario que trae la carta. Pokégear tiene que saber coger a Dawn (o
  // a Hilda), que es lo que trae a Alakazam, y no a cualquiera.
  const p = montar(['Pokégear 3.0', 'Psychic Energy', 'Psychic Energy', 'Enriching Energy'], { lista: ALAKAZAM, activo: 'Psyduck' })
  const r = await C.buscarCaminos({ partida: p, objetivo: de('Alakazam'), muestras: 400 })
  const puente = r.caminos.find((c) => c.pasos.length === 2 && c.pasos[0].clave === 'pokegear 3.0' && ['dawn', 'hilda'].includes(c.pasos[1].clave))
  check('Pokégear 3.0 → Dawn (o Hilda): un camino de dos, con el segundo «si la tienes»', puente && puente.p > 0.05 && puente.pasos[1].siempre === false, r.caminos.map((c) => `${texto(c)} ${c.p}`).join(' / '))
  check('  …y ningún camino lleva dos partidarios (el segundo no se podría jugar)', r.caminos.every((c) => c.pasos.filter((x) => x.partidario).length <= 1), r.caminos.map(texto).join(' / '))
  check('  …porque Dawn trae la carta (puente directo) y Pokégear trae a Dawn (puente de segunda)', r.puentes.dawn > 1 && r.puentes['pokegear 3.0'] > 0 && r.puentes['pokegear 3.0'] <= 1, JSON.stringify(r.puentes))
}
{
  // Una habilidad con botón: Drakloak mira las 2 de arriba y se queda una.
  // La exacta es la de «robar 2» de la tabla.
  const p = montar(['Psychic Energy', 'Fire Energy'])
  const u = p.s.mazo.find((x) => nombre(p, x) === 'Drakloak')
  p.sacarDelMazo(u)
  const sl = p.nuevoSlot(u)
  sl.entroTurno = -1
  p.s.banca.push(sl)
  const r = await C.buscarCaminos({ partida: p, objetivo: de('Night Stretcher'), muestras: 400 })
  const recon = r.caminos.find((c) => c.pasos.length === 1 && c.pasos[0].tipo === 'habilidad')
  const exacta = probabilidadDeGrupo(p, de('Night Stretcher'), 2).enN
  check('la habilidad de Drakloak (Recon Directive): la de que salga entre las 2 de arriba', recon?.pasos[0].habilidad === 'Recon Directive' && Math.abs(recon.p - exacta) < 0.05, `${recon?.p} contra ${exacta.toFixed(3)}`)
}
{
  const p = montar(['Dragapult ex', 'Ultra Ball', 'Psychic Energy'])
  const r = await C.buscarCaminos({ partida: p, objetivo: de('Dragapult ex'), muestras: 50 })
  check('si ya la tienes en la mano, lo dice y no calcula nada', r.yaLaTienes === true && r.caminos.length === 0)
  const q = montar(['Ultra Ball', 'Psychic Energy', 'Fire Energy'])
  for (const u of [...q.s.mazo, ...q.s.premios].filter((u) => nombre(q, u) === 'Moltres')) {
    q.sacarDelMazo(u)
    q.s.premios = q.s.premios.filter((x) => x !== u)
    q.s.descarte.push(u)
  }
  const r2 = await C.buscarCaminos({ partida: q, objetivo: de('Moltres'), muestras: 50 })
  check('si no queda ninguna en el mazo ni en los premios, lo dice', r2.noQueda === true)
}
{
  // Con MESA (tú contra ti): las dos partidas y la mesa, intactas.
  const ui = {
    async cartas(o) {
      return (o.elegibles || o.opciones).slice(0, o.min)
    },
    async pokemon(o) {
      return o.opciones.slice(0, 1)
    },
    async confirmar() {
      return false
    },
    async opcion(o) {
      return o.opciones[0].id
    },
    async numero(o) {
      return o.valor
    },
    async premios(o) {
      return o.partida.s.premios.slice(0, o.n)
    },
    async repartir() {
      return {}
    },
  }
  const mesa = new Mesa({ mazos: [mazo(DRAGAPULT), mazo(DRAGAPULT)], efectos: EFECTOS, semilla: 5, empieza: 1 })
  mesa.repartir()
  for (let k = 0; k < 2; k++) {
    const p = mesa.actual
    const b = p.s.mano.find((x) => esPokemon(p.carta(x)) && faseDe(p.carta(x)) === 0)
    p.colocar(b, 'activo')
    await mesa.accion(() => mesa.listo(ui), ui)
  }
  // El turno del SEGUNDO: quien va primero no juega partidario en su
  // primer turno, y sin Juez en el camino nada toca al otro (el rigor de la
  // 554 lo pilló: con «Dragapult ex» ya en la mano ni siquiera se buscaba).
  await mesa.accion(() => mesa.pasarTurno(ui), ui)
  const p = mesa.actual
  const u = p.s.mazo.find((x) => nombre(p, x) === 'Judge')
  if (u) {
    p.sacarDelMazo(u)
    p.s.mano.push(u)
  }
  const antes = JSON.stringify([mesa.jugadores[0].s, mesa.jugadores[1].s, mesa.m])
  const objetivo = ['Drakloak', 'Dragapult ex', 'Munkidori'].find((n) => !p.s.mano.some((x) => nombre(p, x) === n))
  const r = await C.buscarCaminos({ partida: p, objetivo: de(objetivo), muestras: 150 })
  const conJuez = r.caminos.some((c) => c.pasos.some((x) => x.nombre === 'Judge'))
  check('con mesa: las dos partidas y la mesa quedan EXACTAMENTE como estaban (Juez toca la mano del otro)', JSON.stringify([mesa.jugadores[0].s, mesa.jugadores[1].s, mesa.m]) === antes && conJuez, `${objetivo}: ${r.caminos.map(texto).join(' | ')}`)
}

console.log('\n── 2. Cómo se enseña ──')
check('un casi seguro que puede fallar no se vende como «100 %»', H.pctDeCamino(1, true) === '>99 %' && H.pctDeCamino(1, false) === '100 %' && H.pctDeCamino(0.003) === '<1 %' && H.pctDeCamino(0.456) === '46 %')
check('bajar a la banca y la habilidad, dichos enteros; y lo que no siempre se puede, con su «si la tienes»', /Bajar Meowth ex \(Last-Ditch\)/.test(H.pasoHtml({ tipo: 'banca', nombre: 'Meowth ex', habilidad: 'Last-Ditch', siempre: true })) && /si la tienes: 45 %/.test(H.pasoHtml({ tipo: 'carta', nombre: 'Ultra Ball', siempre: false, cuando: 0.45 })))
check('ya la tienes / no queda ninguna, dicho', /Ya tienes Dragapult ex en la mano/.test(H.resultadoDeCaminosHtml({ yaLaTienes: true }, 'Dragapult ex')) && /No queda ninguna Dragapult ex/.test(H.resultadoDeCaminosHtml({ noQueda: true }, 'Dragapult ex')))

console.log('\n── 3. El laboratorio ──')
const browser = await chromium.launch()
{
  const cartas = [...new Map(mazo(DRAGAPULT).map((e) => [e.carta.id, { ...e.carta, market: 'WEST', image_path: null }])).values()]
  const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
  const lista = mazo(DRAGAPULT).map((e) => `${e.n}~${e.carta.id}`).join('_')
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(({ cartas, sets }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    let s = 42
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    localStorage.setItem('pokedoc-laboratorio', JSON.stringify({ opciones: { primero: 'segundo', estricta: true, rival: 'ex', banca: 2, modo: 'muneco' }, panelAbierto: true }))
  }, { cartas, sets })
  await page.goto(`${BASE}/constructor?l=${lista}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.click('#cmProbar')
  await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
  await page.click('[data-accion="auto"]')
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(300)
  // Una Ultra Ball a la mano, por el menú del mazo («Buscar en el mazo»).
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Buscar en el mazo' }).click()
  await page.locator('#labDialogo [data-opcion="mano"]').click()
  await page.waitForTimeout(100)
  await page.locator('#labDialogo [data-elige][aria-label="Ultra Ball"][aria-pressed="false"]:not([disabled])').first().click()
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(200)
  await page.click('[data-panel-pestania="caminos"]')
  await page.waitForSelector('#labCaminosCarta', { timeout: 4000 }).catch(() => null)
  check('el panel tiene la pestaña «Encontrar», con las cartas del mazo para elegir', (await page.locator('#labCaminosCarta option').count()) >= 20 && /Encontrar una carta/.test(await page.textContent('#labPanelTitulo')))
  const valor = await page.$$eval('#labCaminosCarta option', (xs) => xs.find((x) => x.textContent === 'Dragapult ex')?.value)
  await page.selectOption('#labCaminosCarta', valor)
  const manoAntes = await page.locator('[data-mano]').evaluateAll((ns) => ns.map((n) => n.dataset.uid).join())
  const turnoAntes = await page.locator('#labTurno').innerText()
  await page.click('[data-caminos]')
  await page.waitForFunction(() => document.querySelector('.lab-caminos-resultado .lab-camino, .lab-caminos-resultado .lab-caminos-vacio'), null, { timeout: 30000 }).catch(() => null)
  const filas = await page.$$eval('.lab-caminos-resultado .lab-caminos > .lab-camino', (xs) => xs.map((x) => [x.querySelector('.lab-camino-p').textContent.trim(), x.querySelector('.lab-paso').textContent.trim()]))
  // Buscar en el mazo (para traer la Ultra Ball) te enseña el mazo entero:
  // desde ahí SABES que las tres están dentro, y la Ultra Ball no falla.
  const ub = filas.find(([, paso]) => paso === 'Ultra Ball')
  check('«Buscar caminos» con Dragapult ex: Ultra Ball, segura (ya viste el mazo: no puede estar en premios), y la mejor', ub?.[0] === '100 %' && filas[0][0] === '100 %', JSON.stringify(filas))
  check('  …dice cuántas quedan y cómo de fiables son las cifras', /entre el mazo y los premios boca abajo/.test(await page.textContent('.lab-caminos-resultado')) && /400 repartos/.test(await page.textContent('.lab-caminos-resultado')))
  check('  …y la mesa no se ha movido (ni la mano, ni el turno)', (await page.locator('[data-mano]').evaluateAll((ns) => ns.map((n) => n.dataset.uid).join())) === manoAntes && (await page.locator('#labTurno').innerText()) === turnoAntes)
  // Traer otra carta cambia la mesa: el resultado de antes ya no vale.
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Buscar en el mazo' }).click()
  await page.locator('#labDialogo [data-opcion="mano"]').click()
  await page.waitForTimeout(100)
  await page.locator('#labDialogo [data-elige][aria-label="Fire Energy"][aria-pressed="false"]:not([disabled])').first().click()
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(300)
  const tras = await page.textContent('.lab-caminos-resultado').catch(() => '')
  check('si la mesa cambia, el resultado viejo no se enseña: «vuelve a buscar»', /La mesa ha cambiado desde que buscaste Dragapult ex/.test(tras) && (await page.locator('.lab-caminos-resultado .lab-camino').count()) === 0, tras.slice(0, 160))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. Las repeticiones ──')
{
  const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
  const { fotos } = await import(`${RAIZ}/js/repeticiones/estado.js`)
  const REGISTRO = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8').replace(/\r/g, '')
  const lectura = leerRegistro(REGISTRO)
  const fs = fotos(lectura)
  const INGLES = { 'Zorua de N': "N's Zorua", 'Zoroark ex de N': "N's Zoroark ex", 'Darumaka de N': "N's Darumaka", 'Reshiram de N': "N's Reshiram", 'Zekrom de N': "N's Zekrom", 'Mega-Greninja ex': 'Mega Greninja ex', 'Más PP de N': "N's PP Up", 'Energía Oscura': 'Darkness Energy', 'Órdenes de Jefes': "Boss's Orders", 'Pokétableta': 'Poké Pad', 'Determinación de Lylia': "Lillie's Determination", 'Pokochos Gemelos': 'Buddy-Buddy Poffin', 'Camilla Nocturna': 'Night Stretcher' }
  const enJuego = new Set()
  for (const s of fs) for (const p of Object.values(s.jugadores)) for (const x of [p.activo, ...p.banca].filter(Boolean)) x.cartas.forEach((c) => enJuego.add(c))
  const nombres = new Set()
  for (const e of lectura.eventos) for (const k of ['carta', 'pokemon', 'objetivo', 'sube', 'baja', 'a', 'de']) if (e[k] && e[k] !== '?') nombres.add(e[k])
  for (const e of lectura.eventos) for (const c of e.cartas || []) nombres.add(c)
  const SUP = new Set(['Determinación de Lylia', 'Órdenes de Jefes'])
  const catalogo = [...nombres].map((n, i) => ({
    id: `fk-${i + 1}`, set_id: 'fk', local_id: String(i + 1), market: 'WEST', image_path: null, regulation_mark: 'H', name: INGLES[n] || n, name_es: n,
    category: enJuego.has(n) || n === 'Darumaka de N' ? 'Pokemon' : /^Energ/.test(n) ? 'Energy' : 'Trainer',
    trainer_type: SUP.has(n) ? 'Supporter' : enJuego.has(n) || /^Energ/.test(n) ? undefined : 'Item',
    hp: enJuego.has(n) ? 200 : null, stage: n === 'Zoroark ex de N' ? 'Stage1' : enJuego.has(n) ? 'Basic' : undefined,
  }))
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/api\.tcgdex\.net|\.(png|webp)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ cartas }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 999 }]
    window.__FAKE_CARTAS__ = cartas
  }, { cartas: catalogo })
  await page.goto(`${BASE}/repeticiones.html`)
  await page.fill('#repTexto', REGISTRO)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  const ir = (n) =>
    page.evaluate((n) => {
      const b = document.querySelector('[data-accion="reproducir"]')
      if (b.getAttribute('aria-label') === 'Pausa') b.click()
      const r = document.getElementById('repProgreso')
      r.value = String(n)
      r.dispatchEvent(new Event('input', { bubbles: true }))
    }, n)
  await ir(0)
  check('en la preparación no hay jugada que mirar: el botón está apagado', await page.isDisabled('[data-accion="caminos"]'))
  // La jugada 60: le toca a Rojo, con dos Ultra Ball y una Pokétableta.
  await ir(60)
  await page.waitForTimeout(1200)
  await page.click('[data-accion="caminos"]')
  await page.waitForSelector('#repCaminosCarta', { timeout: 10000 }).catch(() => null)
  const intro = (await page.textContent('#repDialogoCuerpo')).replace(/\s+/g, ' ')
  check('la ventana dice quién juega y en qué jugada', /Juega Rojo en la jugada 60/.test(intro), intro.slice(0, 160))
  check('  …y sin su lista, que las cifras se quedan cortas (con el botón para elegirla)', /las copias que no llegaron a salir no cuentan/.test(intro) && (await page.locator('[data-dlg="caminos-lista"]').count()) === 1)
  const opciones = await page.$$eval('#repCaminosCarta option', (xs) => xs.map((x) => x.textContent))
  check('  …elige entre las cartas de SU mazo (sin la «Carta sin ver»)', opciones.includes('Reshiram de N') && opciones.includes('Ultra Ball') && !opciones.includes('Carta sin ver') && !opciones.some((o) => /Dreepy|Dragapult/.test(o)), opciones.join(' | '))
  const valor = await page.$$eval('#repCaminosCarta option', (xs) => xs.find((x) => x.textContent === 'Reshiram de N').value)
  await page.selectOption('#repCaminosCarta', valor)
  await page.click('[data-dlg="caminos"]')
  await page.waitForFunction(() => /%/.test(document.getElementById('repCaminosResultado')?.textContent || '') && !/Jugando/.test(document.getElementById('repCaminosResultado').textContent), null, { timeout: 30000 }).catch(() => null)
  const filas = await page.$$eval('#repCaminosResultado .lab-caminos > .lab-camino', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
  check('Reshiram de N: Ultra Ball y Pokétableta, cada uno con lo que tiene de no estar en premios', filas.length === 2 && filas.some((f) => /^\d+ % Ultra Ball$/.test(f)) && filas.some((f) => /^\d+ % Pokétableta$/.test(f)) && filas.every((f) => Number(f.split(' ')[0]) >= 80 && Number(f.split(' ')[0]) <= 95), filas.join(' | '))
  const vz = await page.$$eval('#repCaminosCarta option', (xs) => xs.find((x) => x.textContent === 'Zorua de N').value)
  await page.selectOption('#repCaminosCarta', vz)
  await page.click('[data-dlg="caminos"]')
  await page.waitForFunction(() => /No queda ninguna/.test(document.getElementById('repCaminosResultado')?.textContent || ''), null, { timeout: 15000 }).catch(() => null)
  check('Zorua de N, que están todas en juego: «no queda ninguna»', /No queda ninguna Zorua de N/.test(await page.textContent('#repCaminosResultado')))
  await page.keyboard.press('Escape')
  // Una jugada de Azul: su mano no se ve.
  const deAzul = fs.findIndex((f, i) => i > 20 && f.deQuien === 'Azul' && f.jugadores.Azul.manoConocida.length < f.jugadores.Azul.mano)
  await ir(deAzul)
  await page.waitForTimeout(400)
  await page.click('[data-accion="caminos"]')
  await page.waitForTimeout(400)
  check('en una jugada de Azul (su mano no se ve entera) lo dice y no calcula', /no se ve entera en el registro/.test(await page.textContent('#repDialogoCuerpo')) && (await page.locator('#repCaminosCarta').count()) === 0)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
