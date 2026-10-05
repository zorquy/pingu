// Tanda 620 — «tú contra ti»: la mesa gira hacia quien decide, y lo que se
// pide no tapa la mano.
//
// PINGU: «cuando te noquean un Pokémon se tiene que cambiar el tablero para
// ver tu mano y elegir qué Pokémon subir: el jugador 1 noquea un Pokémon
// del jugador 2 después de declarar su ataque, y se gira la cámara a la
// perspectiva del jugador 2 para poder ver la mano y elegir. Pasa algo
// parecido con Robo a la Fuga de Dudunsparce: robas las 3 cartas pero, en
// vez de ver primero toda tu mano, te dice de subir un activo. Es tan fácil
// como no tapar la mano con el mini modal ese».
//
// Lo que se prueba, jugando en el laboratorio:
//   1. Un KO en «tú contra ti»: los premios los coge el que ataca (su lado
//      abajo); después la mesa GIRA hacia el otro —su mano, su banca abajo,
//      «decide Jugador 2»— y al elegir, como atacar acaba el turno, sigue
//      él con su robo, ya sin girar. Deshacer lo devuelve todo de una vez.
//   2. Lo que se pide va en la franja del centro: no tapa la mano, y la
//      mano no se apaga eligiendo un Pokémon.
//   3. Dudunsparce: eligiendo quién sube se ven las 3 robadas marcadas como
//      nuevas, y el aviso no dice «ha caído» (no ha caído nadie).
//   4. En el móvil, lo que se toca queda por encima de la mano.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const { plano } = await import(`${RAIZ}/js/constructor/nucleo.js`)
const FILAS = JSON.parse(readFileSync(new URL('./cartas-laboratorio.json', import.meta.url), 'utf8'))
const fila = (n) => {
  const f = FILAS.find((x) => x.name === n)
  if (!f) throw new Error(`falta ${n} en la ficha de pruebas`)
  return f
}
const LISTA = [
  [4, 'Dreepy'], [4, 'Drakloak'], [3, 'Dragapult ex'], [2, 'Dunsparce'], [2, 'Dudunsparce'], [1, 'Fezandipiti ex'], [1, 'Meowth ex'], [2, 'Munkidori'],
  [4, 'Buddy-Buddy Poffin'], [4, 'Poké Pad'], [4, "Lillie's Determination"], [3, "Boss's Orders"], [3, 'Night Stretcher'], [3, 'Ultra Ball'],
  [4, 'Crushing Hammer'], [2, 'Crispin'], [2, 'Risky Ruins'], [1, 'Dawn'], [1, 'Judge'], [1, "Rosa's Encouragement"], [1, 'Special Red Card'], [1, 'Unfair Stamp'],
  [3, 'Fire Energy'], [3, 'Psychic Energy'], [1, 'Darkness Energy'],
]
const entradas = LISTA.map(([n, nombre]) => ({ carta: fila(nombre), n }))
const cartas = [...new Map(entradas.map((e) => [e.carta.id, { ...e.carta, market: 'WEST', name_key: plano(e.carta.name), image_path: null }])).values()]
const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
const lista = entradas.map((e) => `${e.n}~${e.carta.id}`).join('_')

const browser = await chromium.launch()
async function abrir({ ancho = 1440, alto = 900, estricta = true } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(({ cartas, sets, estricta }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    let s = 42
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    localStorage.setItem('pokedoc-laboratorio', JSON.stringify({ opciones: { primero: 'segundo', estricta, rival: 'ex', banca: 2, modo: 'muneco' }, panelAbierto: false }))
  }, { cartas, sets, estricta })
  await page.goto(`${BASE}/constructor?l=${lista}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1400)
  await page.click('#cmProbar')
  await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(300)
  return { page, errores }
}
async function aDos(page) {
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
}
async function traer(page, nombre, { destino = 'mano' } = {}) {
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Buscar en el mazo' }).click()
  await page.locator(`#labDialogo [data-opcion="${destino}"]`).click()
  await page.waitForTimeout(100)
  await page.locator(`#labDialogo [data-elige][aria-label="${nombre}"][aria-pressed="false"]:not([disabled])`).first().click()
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(200)
}
const estado = (page) =>
  page.evaluate(() => ({
    mano: document.querySelector('#labManoTitulo')?.textContent || '',
    pide: document.querySelector('#labElegir')?.textContent.replace(/\s+/g, ' ').trim() || '',
    propio: document.querySelector('#labLadoPropio')?.getAttribute('aria-label') || '',
    turno: document.querySelector('#labTurno')?.textContent || '',
  }))
const seTocan = (a, b) => a.bottom > b.top && a.top < b.bottom && a.right > b.left && a.left < b.right
const pisaLaMano = (page) =>
  page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const mano = r('.lab-mano-zona')
    const centro = r('#labCentro')
    const flota = document.querySelector('#labApuntar:not(.hidden)')
    return { centro: centro.bottom > mano.top && centro.top < mano.bottom, flota: !!flota }
  })

console.log('\n── 1. Un KO en «tú contra ti»: la mesa gira hacia el que sube ──')
{
  const { page, errores } = await abrir()
  await aDos(page)
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(300)
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(300)
  const bancaJ2 = await page.locator('#labLadoRival .lab-zona-banca .lab-slot').count()
  const manoJ2 = await page.locator('#labLadoRival .lab-pila-mano strong').innerText()
  await page.click('#labLadoPropio .lab-zona-activo [data-slot-carta]')
  await page.locator('#labMenu [data-op]', { hasText: 'Atacar a mano' }).click()
  await page.fill('#labDialogo input[type="number"]', '990')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(400)
  let e = await estado(page)
  check('los premios los coge el que ataca, con SU lado abajo', /Jugador 1: coge \d premios?/.test(e.pide) && /Jugador 1/.test(e.mano), JSON.stringify(e))
  for (let k = 0; k < 3 && /premio/.test((await estado(page)).pide); k++) {
    await page.locator('[data-elegir][aria-pressed="false"]').first().click()
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(300)
  e = await estado(page)
  check('después la mesa GIRA: abajo la mano del Jugador 2', /Mano de Jugador 2/.test(e.mano), JSON.stringify(e))
  check('  …su lado abajo, «decide»', /Lado de Jugador 2 \(decide\)/.test(e.propio), e.propio)
  check('  …la barra de arriba dice quién decide', /decide Jugador 2/.test(e.turno), e.turno)
  check('  …lo que se pide, en la franja del centro y con «ha caído»', /Jugador 2: tu activo ha caído, elige quién sube/.test(e.pide), e.pide)
  check('  …y brilla SU banca, abajo', (await page.locator('#labLadoPropio .lab-slot-elegible').count()) === bancaJ2 && bancaJ2 > 0, `${await page.locator('#labLadoPropio .lab-slot-elegible').count()} de ${bancaJ2}`)
  check('  …con su mano entera a la vista', (await page.locator('#labMano .lab-mano-carta').count()) === Number(manoJ2), `${await page.locator('#labMano .lab-mano-carta').count()} de ${manoJ2}`)
  const op = await page.locator('#labMano .lab-mano-carta').first().evaluate((el) => getComputedStyle(el).opacity)
  check('  …y sin apagar', Number(op) === 1, op)
  const p = await pisaLaMano(page)
  check('lo que se pide no tapa la mano (ni flota encima)', !p.centro && !p.flota, JSON.stringify(p))
  await page.locator('#labLadoPropio [data-elegir]').first().click()
  await page.waitForTimeout(500)
  e = await estado(page)
  check('al elegir, atacar ha acabado el turno: le toca al Jugador 2, que ha robado', /Turno 4 · Jugador 2/.test(e.turno) && new RegExp(`Mano de Jugador 2 \\(${Number(manoJ2) + 1}\\)`).test(e.mano), JSON.stringify(e))
  await page.click('[data-accion="deshacer"]')
  await page.waitForTimeout(300)
  e = await estado(page)
  check('Deshacer lo devuelve todo de una vez: turno 3 del Jugador 1, antes de atacar', /Turno 3 · Jugador 1/.test(e.turno) && /Mano de Jugador 1/.test(e.mano) && !e.pide, JSON.stringify(e))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 2. Dudunsparce: ver lo robado antes de elegir ──')
{
  const { page, errores } = await abrir({ estricta: false })
  await page.click('[data-accion="auto"]')
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(300)
  await traer(page, 'Dunsparce', { destino: 'banca' })
  await traer(page, 'Dudunsparce')
  await page.locator('#labMano [data-mano][aria-label^="Dudunsparce"]').first().click()
  await page.waitForTimeout(300)
  if (await page.locator('.lab-apuntable').count()) await page.locator('.lab-apuntable [data-slot-carta]').first().click()
  await page.waitForTimeout(300)
  const dud = page.locator('[data-slot-carta][aria-label^="Dudunsparce"]').first()
  if (!/activo/.test(await dud.getAttribute('aria-label'))) {
    await dud.click()
    await page.locator('#labMenu [data-op]', { hasText: 'Pasar al puesto activo' }).click()
    await page.waitForTimeout(300)
  }
  const antes = await page.locator('#labMano .lab-carta').count()
  await page.locator('[data-slot-carta][aria-label^="Dudunsparce"]').first().click()
  await page.locator('#labMenu [data-op]', { hasText: 'Habilidad' }).click()
  await page.waitForTimeout(500)
  const e = await estado(page)
  check('roba 3 y, eligiendo quién sube, las 3 se ven marcadas como nuevas', (await page.locator('#labMano .lab-carta').count()) === antes + 3 && (await page.locator('#labMano .lab-nueva').count()) === 3, `${await page.locator('#labMano .lab-nueva').count()} nuevas`)
  check('  …el aviso no dice «ha caído»: te has quedado sin activo', /Te has quedado sin activo: elige quién sube/.test(e.pide), e.pide)
  const p = await pisaLaMano(page)
  check('  …y no tapa la mano', !p.centro && !p.flota, JSON.stringify(p))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. En el móvil ──')
{
  const { page, errores } = await abrir({ ancho: 390, alto: 844 })
  await aDos(page)
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(300)
  await page.click('[data-accion="pasar"]')
  await page.waitForTimeout(300)
  await page.click('#labLadoPropio .lab-zona-activo [data-slot-carta]')
  await page.locator('#labMenu [data-op]', { hasText: 'Atacar a mano' }).click()
  await page.fill('#labDialogo input[type="number"]', '990')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(400)
  for (let k = 0; k < 3 && /premio/.test((await estado(page)).pide); k++) {
    await page.locator('[data-elegir][aria-pressed="false"]').first().click()
    await page.waitForTimeout(200)
  }
  await page.waitForTimeout(400)
  const r = await page.evaluate(() => {
    const b = document.querySelector('#labLadoPropio [data-elegir]').getBoundingClientRect()
    const m = document.querySelector('.lab-mano-zona').getBoundingClientRect()
    return { abajo: Math.round(b.bottom), mano: Math.round(m.top), alto: innerHeight }
  })
  check('lo primero que se toca queda por encima de la mano', r.abajo <= r.mano + 1, JSON.stringify(r))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} fallos.` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
