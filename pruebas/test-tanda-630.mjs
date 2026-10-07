// Tanda 630 — «¿cómo la encuentro?» con lo que hacen las cartas de la mano,
// y la mano contada en «tú contra ti».
//
// PINGU: «tienes que tener en cuenta la funcionalidad de las cartas que se
// tienen en mano: es posible que se creen más caminos si buscas una carta
// que te haga robar más con un entrenador u objeto, además de que puede que
// te quites cartas del mazo». Y: «necesito un contador de cuántas cartas
// tienes en mano cuando juegas tú contra ti mismo».
//
// Lo que se prueba, en Node y con el motor de verdad:
//   1. Un básico cuya habilidad va con su botón (Fezandipiti ex) es un paso
//      desde la mano: «bajarlo y usarla», con su cifra exacta (3/D).
//   2. …y un puente: Ultra Ball lo trae y roba tres (3/(D-1)).
//   3. Una evolución que roba AL evolucionar (Kadabra) también es puente.
//   4. Adelgazar: Poffin saca dos del mazo antes de un Lillie's y la cifra lo
//      cuenta (8/(D-2), no 8/D) y el paso lo DICE; antes de un Lillie's que
//      devuelve la mano al mazo, coger de más a la mano no cambia nada y no
//      se dice.
//   5. Robar HASTA tener N: vaciar la mano antes cuenta (Ultra Ball → Ariana
//      es 5/D) y no se coge de más a la mano (sería 4/(D-1)).
//   6. A la banca se deja un hueco: Poffin no se la come a Fezandipiti.
//   7. La partida queda como estaba, también su `barajar`.
// Y en el navegador, la mano contada en «tú contra ti» (y solo ahí), que se
// pone al día al robar y que en el móvil no pisa al activo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const M = await import(`${RAIZ}/js/constructor/partida.js`)
const { EFECTOS } = await import(`${RAIZ}/js/constructor/efectos.js`)
const C = await import(`${RAIZ}/js/constructor/caminos.js`)
const H = await import(`${RAIZ}/js/constructor/caminos-html.js`)
const { plano } = await import(`${RAIZ}/js/constructor/nucleo.js`)
const { Partida } = M
const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}
const MAZO = [
  [4, 'Abra'], [3, 'Kadabra'], [3, 'Alakazam'], [2, 'Dunsparce'], [2, 'Dudunsparce'], [1, 'Dawn'], [2, 'Fezandipiti ex'], [2, 'Ultra Ball'], [2, 'Buddy-Buddy Poffin'],
  [3, "Boss's Orders"], [4, "Lillie's Determination"], [2, "Team Rocket's Ariana"], [3, 'Rare Candy'], [4, 'Crushing Hammer'], [2, 'Night Stretcher'], [20, 'Psychic Energy'],
]
// Lo que robaría o buscaría por su cuenta y taparía el paso que se mira: al
// descarte, salvo lo que la mesa pida.
const OTRAS = ["Lillie's Determination", 'Dawn', "Team Rocket's Ariana", 'Ultra Ball', 'Buddy-Buddy Poffin', 'Fezandipiti ex', 'Dudunsparce', 'Kadabra', 'Rare Candy', 'Night Stretcher', 'Crushing Hammer']
const sinOtras = (...quedan) => OTRAS.filter((x) => !quedan.includes(x))
const nombre = (p, u) => p.carta(u).name
const de = (n) => (c) => c?.name === n
const texto = (c) =>
  c.pasos.map((x) => (x.tipo === 'evolucion' ? `evolucionar a ${x.nombre}` : x.tipo === 'habilidad' ? `${x.nombre}: ${x.habilidad}` : x.tipo === 'banca' ? `bajar ${x.nombre}${x.usa ? ` y usar ${x.habilidad}` : ''}` : x.nombre)).join(' → ')

// Tu turno 2: Abra de activo desde antes, lo que diga `banca` en la banca; en
// la mano, `mano`; UNA copia de la buscada en el mazo; seis premios de
// relleno; y el mazo entero visto (así la buscada SE SABE en el mazo y las
// cifras se pueden escribir: robar 3 de D es 3/D).
function montar(mano, { buscada = "Boss's Orders", fuera = [], banca = [], ko = false } = {}) {
  const p = new Partida({ entradas: MAZO.map(([n, x]) => ({ carta: fila(x), n })), efectos: EFECTOS, semilla: 7, vaPrimero: false })
  p.repartir()
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
  for (const b of banca) {
    p.s.mano.push(sacar(b))
    p.colocar(p.s.mano[0], 'banca')
  }
  p.empezar({ arrancar: false })
  p.s.mazo.push(...p.s.premios)
  p.s.premios = []
  p.s.fase = 'turno'
  p.s.turno = 2
  for (const sl of p.enJuego) sl.entroTurno = 0
  for (const n of mano) p.s.mano.push(sacar(n))
  for (const n of fuera) while (p.s.mazo.some((x) => nombre(p, x) === n)) p.s.descarte.push(sacar(n))
  while (p.s.mazo.filter((x) => nombre(p, x) === buscada).length > 1) p.s.descarte.push(sacar(buscada))
  for (let i = 0; i < 6; i++) p.s.premios.push(sacar('Psychic Energy'))
  p.s.conocimiento = { arriba: 0, abajo: 0, confirmados: {} }
  for (const u of p.s.mazo) p.s.conocimiento.confirmados[u] = true
  if (ko) p.s.koUltimoTurnoRival = true
  return p
}
const casi = (a, b, tol = 0.008) => a != null && Math.abs(a - b) <= tol
const pct = (x) => (x == null ? '—' : `${(x * 100).toFixed(1)} %`)
async function caminos(p, buscada = "Boss's Orders") {
  const r = await C.buscarCaminos({ partida: p, objetivo: de(buscada), muestras: 400 })
  const lista = r.caminos.map((c) => `${pct(c.p)} ${texto(c)}`).join(' / ')
  return { r, lista, camino: (t) => r.caminos.find((c) => texto(c) === t) }
}

console.log('\n── 1. Fezandipiti ex en la mano: bajarlo y usarla, un paso ──')
{
  const p = montar(['Fezandipiti ex'], { fuera: sinOtras(), ko: true })
  const D = p.s.mazo.length
  const antes = JSON.stringify(p.s)
  const { r, lista, camino } = await caminos(p)
  const fez = camino('bajar Fezandipiti ex y usar Flip the Script')
  check(`«Bajar Fezandipiti ex y usar Flip the Script»: 3/${D} = ${pct(3 / D)}`, fez && casi(fez.p, 3 / D, 0.004), lista)
  check('  …es UN paso, con `usa`', fez?.pasos.length === 1 && fez.pasos[0].usa === true && fez.pasos[0].tipo === 'banca')
  const html = H.resultadoDeCaminosHtml(r, "Boss's Orders")
  check('  …y se lee así en el panel', html.includes('Bajar Fezandipiti ex y usar Flip the Script'), html.match(/lab-camino-pasos">([^<]*)/)?.[1])
  check('la partida queda EXACTAMENTE como estaba', JSON.stringify(p.s) === antes)
  check('  …y sin el `barajar` de los caminos puesto', !Object.hasOwn(p, 'barajar') && typeof p.barajar === 'function')

  // Sin un KO en el turno del rival, Flip the Script no se puede usar: bajarlo
  // no es un camino.
  const q = montar(['Fezandipiti ex'], { fuera: sinOtras(), ko: false })
  const sin = await caminos(q)
  check('sin un KO en el último turno del rival, no hay camino con Fezandipiti', !sin.r.caminos.some((c) => /Fezandipiti/.test(texto(c))), sin.lista || '(ninguno)')
}

console.log('\n── 2. Ultra Ball trae a Fezandipiti, y roba tres ──')
{
  const p = montar(['Ultra Ball', 'Psychic Energy', 'Psychic Energy'], { fuera: sinOtras('Fezandipiti ex'), ko: true })
  const D = p.s.mazo.length
  const { lista, camino, r } = await caminos(p)
  const c = camino('Ultra Ball → bajar Fezandipiti ex y usar Flip the Script')
  check(`«Ultra Ball → Bajar Fezandipiti ex y usar Flip the Script»: 3/${D - 1} = ${pct(3 / (D - 1))}`, c && casi(c.p, 3 / (D - 1)), lista)
  check('  …y Fezandipiti es puente (la Ultra Ball sabe cogerlo)', (r.puentes['fezandipiti ex'] || 0) > 1, JSON.stringify(r.puentes))
}

console.log('\n── 3. Kadabra, que roba AL evolucionar, también es puente ──')
{
  const p = montar(['Ultra Ball', 'Psychic Energy', 'Psychic Energy'], { fuera: sinOtras('Kadabra') })
  const D = p.s.mazo.length
  const { lista, camino } = await caminos(p)
  const c = camino('Ultra Ball → evolucionar a Kadabra')
  check(`«Ultra Ball → Evolucionar a Kadabra»: 2/${D - 1} = ${pct(2 / (D - 1))}`, c && casi(c.p, 2 / (D - 1)), lista)
}

console.log('\n── 4. Adelgazar el mazo: cuenta, y se dice donde cuenta ──')
{
  // Poffin a la banca (dos básicos de 70 PS o menos) y Lillie's (la mano al
  // mazo, roba 8 con seis premios): 8/(D-2) contra 8/(D+1) de Lillie's sola,
  // que se lleva el Poffin al mazo.
  const p = montar(['Buddy-Buddy Poffin', "Lillie's Determination"], { fuera: sinOtras("Lillie's Determination", 'Buddy-Buddy Poffin') })
  const D = p.s.mazo.length
  const { r, lista, camino } = await caminos(p)
  const sola = camino("Lillie's Determination")
  const con = camino("Buddy-Buddy Poffin → Lillie's Determination")
  check(`Lillie's sola: 8/${D + 1} = ${pct(8 / (D + 1))}`, sola && casi(sola.p, 8 / (D + 1)), lista)
  check(`Poffin (cogiendo dos) → Lillie's: 8/${D - 2} = ${pct(8 / (D - 2))}, no 8/${D} = ${pct(8 / D)}`, con && casi(con.p, 8 / (D - 2)), lista)
  check('  …y el Poffin dice que hay que coger las dos', con?.pasos[0].adelgaza === true && con.pasos[1].adelgaza === false, JSON.stringify(con?.pasos.map((x) => x.adelgaza)))
  const html = H.resultadoDeCaminosHtml(r, "Boss's Orders")
  check('  …en el panel: «cogiendo todas las que deje»', /Buddy-Buddy Poffin <span class="lab-paso-si">cogiendo todas las que deje: el mazo adelgaza<\/span>/.test(html), html.match(/<li class="lab-camino[^>]*>[\s\S]*?<\/li>/)?.[0].replace(/\s+/g, ' '))

  // Ultra Ball antes de Lillie's: lo que coja de más va a la mano, y Lillie's
  // la devuelve al mazo. Da lo mismo coger o no: no se dice.
  const q = montar(['Ultra Ball', 'Psychic Energy', 'Psychic Energy', "Lillie's Determination"], { fuera: sinOtras("Lillie's Determination", 'Ultra Ball') })
  const Dq = q.s.mazo.length
  const b = await caminos(q)
  const ub = b.camino("Ultra Ball → Lillie's Determination")
  check(`Ultra Ball → Lillie's: 8/${Dq} = ${pct(8 / Dq)}`, ub && casi(ub.p, 8 / Dq), b.lista)
  check('  …y ahí coger de más no se dice (no cambia nada)', ub && ub.pasos.every((x) => !x.adelgaza), JSON.stringify(ub?.pasos.map((x) => x.adelgaza)))
}

console.log('\n── 5. Robar HASTA tener N: la mano, vacía antes ──')
{
  // Ariana roba hasta tener 5. Con Ultra Ball, E, E y Ariana: Ariana sola
  // roba 2; con la Ultra Ball antes (descarta las dos energías), roba 5. Y la
  // Ultra Ball NO coge nada de más: a la mano sería una menos que robar
  // (4/(D-1)).
  const p = montar(['Ultra Ball', 'Psychic Energy', 'Psychic Energy', "Team Rocket's Ariana"], { fuera: sinOtras("Team Rocket's Ariana", 'Ultra Ball') })
  const D = p.s.mazo.length
  const { lista, camino } = await caminos(p)
  const sola = camino("Team Rocket's Ariana")
  const con = camino("Ultra Ball → Team Rocket's Ariana")
  check(`Ariana sola: 2/${D} = ${pct(2 / D)}`, sola && casi(sola.p, 2 / D), lista)
  check(`Ultra Ball → Ariana: 5/${D} = ${pct(5 / D)} (no ${pct(4 / (D - 1))}, que es cogiendo de más)`, con && casi(con.p, 5 / D), lista)

  // Y lo que solo VACÍA la mano (un Martillo, que no toca el mazo) también
  // prepara: antes no pasaba al nivel siguiente.
  const q = montar(['Crushing Hammer', "Team Rocket's Ariana", 'Psychic Energy'], { fuera: sinOtras("Team Rocket's Ariana", 'Crushing Hammer') })
  const Dq = q.s.mazo.length
  const b = await caminos(q)
  const mart = b.camino("Crushing Hammer → Team Rocket's Ariana")
  check(`Martillo → Ariana: 4/${Dq} = ${pct(4 / Dq)} (Ariana sola, 3/${Dq})`, mart && casi(mart.p, 4 / Dq), b.lista)
}

console.log('\n── 6. A la banca se deja un hueco ──')
{
  // Tres en la banca (dos huecos): un Poffin que cogiera dos se comería el
  // sitio de Fezandipiti. Coge uno, y Fezandipiti baja.
  const p = montar(['Buddy-Buddy Poffin', 'Fezandipiti ex'], { fuera: sinOtras('Buddy-Buddy Poffin', 'Fezandipiti ex'), banca: ['Abra', 'Abra', 'Dunsparce'], ko: true })
  const D = p.s.mazo.length
  check('la mesa tiene dos huecos en la banca', p.huecosBanca === 2, p.huecosBanca)
  const { lista, camino } = await caminos(p)
  const c = camino('Buddy-Buddy Poffin → bajar Fezandipiti ex y usar Flip the Script')
  check(`«Poffin → Bajar Fezandipiti ex y usar Flip the Script» existe: ${pct(3 / (D - 1))}`, c && casi(c.p, 3 / (D - 1)), lista)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. «Tú contra ti»: tu mano, contada ──')
const LISTA = [
  [4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Dunsparce'], [2, 'Dudunsparce'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Munkidori'],
  [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [3, 'Ultra Ball'],
  [4, 'Crushing Hammer'], [2, 'Crispin'], [2, 'Risky Ruins'], [1, 'Dawn'], [1, 'Judge'], [1, "Rosa's Encouragement"], [1, 'Special Red Card'], [1, 'Unfair Stamp'],
  [3, 'Fire Energy'], [3, 'Psychic Energy'], [1, 'Darkness Energy'],
]
const entradas = LISTA.map(([n, x]) => ({ carta: fila(x), n }))
const cartas = [...new Map(entradas.map((e) => [e.carta.id, { ...e.carta, market: 'WEST', name_key: plano(e.carta.name), image_path: null }])).values()]
const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
const lista = entradas.map((e) => `${e.n}~${e.carta.id}`).join('_')
const browser = await chromium.launch()
async function abrir(ancho, alto, { mesa = true } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(({ cartas, sets }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    let s = 42
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    localStorage.setItem('pokedoc-laboratorio', JSON.stringify({ opciones: { primero: 'segundo', estricta: true, rival: 'ex', banca: 2, modo: 'muneco' }, panelAbierto: false }))
  }, { cartas, sets })
  await page.goto(`${BASE}/constructor?l=${lista}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1400)
  await page.click('#cmProbar')
  await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(300)
  if (mesa) {
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
  }
  return { page, errores }
}
const leer = (page) =>
  page.evaluate(() => {
    const caja = (n) => n?.getBoundingClientRect()
    const pila = document.querySelector('#labLadoPropio .lab-pila-mano')
    const pilas = [...document.querySelectorAll('#labLadoPropio .lab-zona-pilas > .lab-pila')].map((n) => caja(n))
    const activo = caja(document.querySelector('#labLadoPropio .lab-slot-activo'))
    return {
      hay: !!pila,
      cuenta: pila?.querySelector('strong')?.textContent,
      voz: pila?.getAttribute('aria-label'),
      mano: document.querySelectorAll('#labMano .lab-mano-carta').length,
      visible: !!pila && caja(pila).height > 0,
      // ¿En la fila del mazo (misma altura) o debajo?
      enFila: pilas.length === 3 && Math.abs(pilas[2].top - pilas[0].top) < 2,
      pisa: activo && pilas.length ? Math.max(0, activo.right - Math.min(...pilas.map((b) => b.left))) : 0,
      cabe: pilas.every((b) => b.right <= document.documentElement.clientWidth),
    }
  })
{
  const { page, errores } = await abrir(1440, 900)
  const a = await leer(page)
  check('en «tú contra ti», tu lado lleva «N en la mano»', a.hay && a.visible && a.cuenta === String(a.mano) && a.voz === `${a.mano} cartas en la mano`, JSON.stringify(a))
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Robar una carta' }).click()
  await page.waitForTimeout(300)
  const b = await leer(page)
  check('  …y se pone al día al robar', b.cuenta === String(a.mano + 1) && b.mano === a.mano + 1, `${a.cuenta} → ${b.cuenta}`)
  check('sin errores en la página', !errores.length, errores.join(' | '))
  await page.close()
}
{
  const { page } = await abrir(1440, 900, { mesa: false })
  const a = await leer(page)
  check('contra el muñeco no sale (la mano entera está abajo, con su cuenta)', !a.hay, JSON.stringify(a))
  await page.close()
}
for (const [ancho, fila3] of [[390, true], [380, true], [360, false]]) {
  const { page } = await abrir(ancho, 844)
  const a = await leer(page)
  check(`a ${ancho} px: ${fila3 ? 'en la fila del mazo' : 'debajo del mazo'}, sin pisar al activo y dentro de la pantalla`, a.hay && a.enFila === fila3 && a.pisa === 0 && a.cabe, JSON.stringify(a))
  await page.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
