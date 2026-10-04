// Tanda 594 — elegir en la mesa, sin ventanas.
//
// PINGU: «en el tú contra ti mismo muchas veces salen modales todo el rato
// y estaría mejor hacerlo sin modales, porque encima los modales se ven mal
// poniendo la imagen de la carta. Que está bien ese chequeo, pero que ese
// chequeo sea simplemente resaltando las cartas que tienes que elegir o
// descartar. Para búsquedas y eso sí que está bien. Pero por lo demás no».
//
// Lo que se prueba, jugando de verdad en el laboratorio:
//   1. Descartar de la mano (Ultra Ball): sin ventana, brillan las cartas
//      de la mano, la barra cuenta y no deja confirmar hasta que vale; y la
//      BÚSQUEDA de después sigue en ventana.
//   2. Escape cancela la elección y deshace la jugada.
//   3. Retirarse: las energías que pagan se eligen tocándolas en el
//      Pokémon (con el aviso si no llegan al coste), y quién sube, tocando
//      la banca.
//   4. Órdenes de Jefes contra el muñeco: se toca el muñeco de la banca.
//   5. Coger premios: se tocan los de la mesa, boca abajo; ni Escape ni
//      tocar fuera los saltan.
//   6. Una pregunta de sí o no, en la barra.
//   7. En el móvil la mano sigue a la vista y la barra cabe.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.BASE || 'http://localhost:8892'
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
const cartas = [...new Map(mazo(DRAGAPULT).map((e) => [e.carta.id, { ...e.carta, market: 'WEST', image_path: null }])).values()]
const sets = [...new Set(cartas.map((c) => c.set_id))].map((id) => ({ id, name: id.toUpperCase(), market: 'WEST', tcg_online_code: id.toUpperCase(), release_date: '2025-01-01', card_count_official: 200 }))
const lista = mazo(DRAGAPULT).map((e) => `${e.n}~${e.carta.id}`).join('_')

const browser = await chromium.launch()
async function abrir({ viewport = { width: 1400, height: 900 }, estricta = false } = {}) {
  const page = await browser.newPage({ viewport })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(({ cartas, sets, estricta }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    let s = 42
    Math.random = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    // Sin reglas: así se pueden unir dos energías en el mismo turno para
    // tener algo que elegir al retirarse.
    localStorage.setItem('pokedoc-laboratorio', JSON.stringify({ opciones: { primero: 'segundo', estricta, rival: 'ex', banca: 2, modo: 'muneco' }, panelAbierto: false }))
  }, { cartas, sets, estricta })
  await page.goto(`${BASE}/constructor?l=${lista}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  await page.click('#cmProbar')
  await page.waitForSelector('.lab:not([hidden]) .lab-mesa', { timeout: 6000 }).catch(() => {})
  await page.click('[data-accion="auto"]')
  await page.click('[data-accion="empezar"]')
  await page.waitForTimeout(300)
  return { page, errores }
}
// Una carta del mazo a la mano, por el menú del mazo (es una búsqueda: en
// ventana).
async function traer(page, nombre) {
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Buscar en el mazo' }).click()
  await page.locator('#labDialogo [data-opcion="mano"]').click()
  await page.waitForTimeout(100)
  await page.locator(`#labDialogo [data-elige][aria-label="${nombre}"][aria-pressed="false"]:not([disabled])`).first().click()
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(200)
}
const barra = (page) => page.locator('#labApuntar.lab-elegir-barra:not(.hidden)')
const hayVentana = async (page) => (await page.locator('#labVelo:not(.hidden)').count()) > 0
const manoUids = (page) => page.locator('#labMano [data-mano]').evaluateAll((ns) => ns.map((n) => n.dataset.uid))
const descarte = async (page) => Number((await page.locator('#labLadoPropio [data-pila="descarte"] strong').innerText()) || 0)

console.log('\n── 1. Descartar de la mano: en la mesa, sin ventana ──')
{
  const { page, errores } = await abrir()
  await traer(page, 'Ultra Ball')
  const antes = await manoUids(page)
  await page.locator('#labMano [data-mano][aria-label^="Ultra Ball"]').first().click()
  await page.waitForTimeout(300)
  check('jugar Ultra Ball NO abre una ventana', !(await hayVentana(page)))
  check('  …sale la barra con lo que se pide', /Descarta 2 cartas de tu mano/.test(await barra(page).innerText().catch(() => '')), await barra(page).innerText().catch(() => ''))
  const enMano = await page.locator('#labMano [data-mano]').count()
  const brillan = await page.locator('#labMano [data-elegir]').count()
  check('  …brillan las cartas de la mano que valen (todas menos la Ultra Ball, que se está jugando)', brillan === enMano && brillan === antes.length - 1, `${brillan} de ${enMano}`)
  check('  …y no hay ventana con imágenes de cartas', (await page.locator('#labDialogo .lab-rejilla-cartas').count()) === 0)
  const ok = page.locator('[data-elegir-accion="ok"]')
  check('  …«Confirmar» empieza desactivado', await ok.isDisabled())
  const el = page.locator('#labMano [data-elegir]')
  await el.nth(0).click()
  check('  …con una, sigue sin dejar (son dos) y la cuenta lo dice', (await ok.isDisabled()) && /1 de 2/.test(await barra(page).innerText()))
  await el.nth(1).click()
  check('  …con dos, deja; y las elegidas lo dicen (aria-pressed)', !(await ok.isDisabled()) && (await page.locator('#labMano [data-elegir][aria-pressed="true"]').count()) === 2)
  const elegidas = await page.locator('#labMano [data-elegir][aria-pressed="true"]').evaluateAll((ns) => ns.map((n) => n.dataset.uid))
  await ok.click()
  await page.waitForTimeout(300)
  check('  …confirmar sigue con la BÚSQUEDA, y esa sí en ventana', (await hayVentana(page)) && /Busca un Pokémon/.test(await page.locator('#labDialogoTitulo').innerText()))
  await page.locator('#labDialogo [data-elige]:not([disabled])').first().click()
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(300)
  const tras = await manoUids(page)
  check('  …y las dos elegidas se han ido de la mano (con la Ultra Ball al descarte)', elegidas.every((u) => !tras.includes(u)) && (await descarte(page)) === 3, `descarte ${await descarte(page)}`)
  check('  …sin la barra ni nada apagado al acabar', (await barra(page).count()) === 0 && (await page.locator('.lab-modo-elegir').count()) === 0)

  console.log('\n── 2. Escape cancela y deshace ──')
  await traer(page, 'Ultra Ball')
  const mano2 = await manoUids(page)
  const desc2 = await descarte(page)
  await page.locator('#labMano [data-mano][aria-label^="Ultra Ball"]').first().click()
  await page.waitForTimeout(250)
  await page.locator('#labMano [data-elegir]').first().click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  check('Escape quita la barra', (await barra(page).count()) === 0)
  check('  …y la jugada no ha pasado: la misma mano (con su Ultra Ball) y el mismo descarte', JSON.stringify(await manoUids(page)) === JSON.stringify(mano2) && (await descarte(page)) === desc2)
  check('  …y el laboratorio sigue abierto', (await page.locator('.lab:not([hidden])').count()) === 1)
  // Cerrar el laboratorio a mitad de una elección que se puede cancelar:
  // se cancela. Si se quedara esperando, la mesa volvería «ocupada» y no
  // se podría jugar nada.
  await page.locator('#labMano [data-mano][aria-label^="Ultra Ball"]').first().click()
  await page.waitForTimeout(250)
  await page.click('[data-accion="cerrar"]')
  await page.waitForTimeout(200)
  await page.click('#cmProbar')
  await page.waitForTimeout(500)
  check('cerrar a medias y volver: sin barra y con la misma mano', (await barra(page).count()) === 0 && JSON.stringify(await manoUids(page)) === JSON.stringify(mano2))
  await page.locator('#labMano [data-mano][aria-label^="Ultra Ball"]').first().click()
  await page.waitForTimeout(250)
  check('  …y la mesa no se ha quedado bloqueada: la Ultra Ball se vuelve a jugar', (await barra(page).count()) === 1)
  await page.keyboard.press('Escape')
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Retirarse: las energías y quién sube, tocándolos ──')
{
  const { page, errores } = await abrir()
  // Una banca con alguien y dos energías en el activo.
  for (const n of ['Dreepy', 'Psychic Energy', 'Fire Energy']) await traer(page, n)
  await page.locator('#labMano [data-mano][aria-label^="Dreepy"]').first().click()
  await page.waitForTimeout(200)
  for (const n of ['Psychic Energy', 'Fire Energy']) {
    await page.locator(`#labMano [data-mano][aria-label^="${n}"]`).first().click()
    await page.waitForTimeout(150)
    if (await page.locator('.lab-modo-apuntar').count()) await page.locator('#labLadoPropio .lab-slot-activo [data-slot-carta]').click()
    await page.waitForTimeout(200)
  }
  const banca = await page.locator('#labLadoPropio .lab-zona-banca .lab-slot').count()
  check('el activo tiene dos energías y hay banca', (await page.locator('#labLadoPropio .lab-slot-activo .lab-energia').count()) === 2 && banca >= 1, `banca ${banca}`)
  await page.locator('#labLadoPropio .lab-slot-activo [data-slot-carta]').click()
  await page.locator('#labMenu [data-op]', { hasText: 'Retirarse' }).click()
  await page.waitForTimeout(300)
  const opacidad = await page.locator('#labMano .lab-mano-carta').first().evaluate((el) => getComputedStyle(el).opacity)
  check('mientras se eligen energías, la mano se apaga (no es de ahí)', (await page.locator('#labMano .lab-elegible-mano').count()) === 0 && Number(opacidad) < 1, opacidad)
  check('retirarse no abre ventana: brillan las ENERGÍAS del activo', !(await hayVentana(page)) && (await page.locator('#labLadoPropio .lab-slot-activo button.lab-energia[data-elegir]').count()) === 2)
  check('  …y son botones con nombre', /Energy|Energía/.test((await page.locator('#labLadoPropio .lab-slot-activo button.lab-energia[data-elegir]').first().getAttribute('aria-label')) || ''))
  await page.locator('#labLadoPropio .lab-slot-activo button.lab-energia[data-elegir]').first().click()
  await page.waitForTimeout(150)
  await page.click('[data-elegir-accion="ok"]')
  await page.waitForTimeout(300)
  check('  …luego brilla la BANCA para elegir quién sube (y el resto se apaga)', (await page.locator('#labLadoPropio .lab-slot-elegible').count()) === banca && (await page.locator('.lab-modo-elegir[data-eligiendo="pokemon"]').count()) === 1)
  const opacidadMano = await page.locator('#labMano .lab-mano-carta').first().evaluate((el) => getComputedStyle(el).opacity)
  check('  …y la mano también se apaga mientras se elige el Pokémon', Number(opacidadMano) < 1, opacidadMano)
  check('  …sin «Confirmar»: tocar ya es elegir', (await page.locator('[data-elegir-accion="ok"]').count()) === 0)
  const sube = await page.locator('#labLadoPropio .lab-slot-elegible [data-slot-carta]').first().getAttribute('data-slot-carta')
  await page.locator('#labLadoPropio .lab-slot-elegible [data-slot-carta]').first().click()
  await page.waitForTimeout(300)
  check('  …y el que se toca pasa al puesto activo, con una energía menos en el que se va', (await page.locator(`#labLadoPropio .lab-slot-activo [data-slot-carta="${sube}"]`).count()) === 1 && (await descarte(page)) === 1)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. Órdenes de Jefes contra el muñeco ──')
{
  const { page, errores } = await abrir()
  await traer(page, "Boss's Orders")
  const activoAntes = await page.locator('.lab-maniqui-activo').getAttribute('data-rival')
  await page.locator(`#labMano [data-mano][aria-label^="Boss's Orders"]`).first().click()
  await page.waitForTimeout(300)
  const muñecos = page.locator('.lab-maniqui.lab-a-elegir')
  check('brillan los muñecos de la banca, sin ventana', !(await hayVentana(page)) && (await muñecos.count()) === 2)
  check('  …con su rol de botón y su etiqueta (es un <div>)', (await muñecos.first().getAttribute('role')) === 'button' && /Banca del muñeco/.test((await muñecos.first().getAttribute('aria-label')) || ''))
  // Con el teclado: Intro sobre el muñeco enfocado.
  const id = await muñecos.nth(1).getAttribute('data-rival')
  await muñecos.nth(1).focus()
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  check('  …Intro sobre uno lo sube al puesto activo del muñeco', (await page.locator('.lab-maniqui-activo').getAttribute('data-rival')) === id && id !== activoAntes)
  check('sin errores', !errores.length, errores.join(' | '))

  console.log('\n── 5. Coger premios, tocándolos en la mesa ──')
  await page.click('[data-accion="atacar"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Atacar a mano' }).click()
  await page.locator('#labDialogo input[type="number"]').fill('990')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(400)
  const premios = page.locator('#labLadoPropio .lab-zona-premios [data-elegir]')
  check('dejar KO al muñeco: brillan TUS premios en la mesa, sin ventana', !(await hayVentana(page)) && (await premios.count()) === 6)
  check('  …la barra dice cuántos (un ex da dos)', /Toca 2/.test(await barra(page).innerText()), await barra(page).innerText())
  await page.keyboard.press('Escape')
  await page.locator('#labCentro').click({ position: { x: 5, y: 5 } })
  await page.waitForTimeout(200)
  check('  …ni Escape ni tocar fuera se los saltan', (await barra(page).count()) === 1 && (await page.locator('.lab:not([hidden])').count()) === 1)
  check('  …y sin «Cancelar»', (await page.locator('[data-elegir-accion="cancelar"]').count()) === 0)
  // Los botones de arriba no se cuelan a mitad de la jugada.
  await page.click('[data-accion="nueva"]')
  await page.waitForTimeout(200)
  check('  …ni «Nueva partida» abre nada mientras tanto', !(await hayVentana(page)) && (await barra(page).count()) === 1)
  await premios.nth(0).click()
  await page.waitForTimeout(150)
  check('  …con uno tocado, sigue esperando el segundo', (await barra(page).count()) === 1)
  await premios.nth(3).click()
  await page.waitForTimeout(300)
  check('  …con el segundo, se cogen: quedan 4', (await barra(page).count()) === 0 && /4 premios/.test(await page.locator('#labLadoPropio .lab-zona-premios').innerText()))
  check('sin errores', !errores.length, errores.join(' | '))

  console.log('\n── 6. Sí o no, en la barra ──')
  await page.click('#labLadoPropio [data-pila="mazo"]')
  await page.locator('#labMenu [data-op]', { hasText: 'Mirar las de arriba' }).click()
  await page.locator('#labDialogo input[type="number"]').fill('3')
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(200)
  check('mirar las de arriba es una búsqueda: en ventana', await hayVentana(page))
  await page.click('#labDialogo [data-dlg="ok"]')
  await page.waitForTimeout(250)
  check('  …y «¿barajas?» sale en la barra, sin ventana', !(await hayVentana(page)) && /Barajas el mazo/.test(await barra(page).innerText().catch(() => '')))
  check('  …con sus dos respuestas', (await page.locator('[data-elegir-accion="si"]').innerText()) === 'Barajar' && (await page.locator('[data-elegir-accion="no"]').innerText()) === 'Dejarlas')
  await page.click('[data-elegir-accion="no"]')
  await page.waitForTimeout(200)
  check('  …contestar la quita', (await barra(page).count()) === 0)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 7. En el móvil ──')
{
  const { page, errores } = await abrir({ viewport: { width: 390, height: 800 } })
  await traer(page, 'Ultra Ball')
  await page.locator('#labMano [data-mano][aria-label^="Ultra Ball"]').first().click()
  await page.waitForTimeout(300)
  const r = await page.evaluate(() => {
    const b = document.querySelector('#labApuntar').getBoundingClientRect()
    const mano = document.querySelector('.lab-mano-zona')
    return { izq: b.left, der: b.right, abajo: b.bottom, ancho: innerWidth, alto: innerHeight, manoVisible: getComputedStyle(mano).display !== 'none' }
  })
  check('la barra cabe en la pantalla', r.izq >= 0 && r.der <= r.ancho && r.abajo <= r.alto, JSON.stringify(r))
  check('  …y la mano NO se esconde (es de donde se elige)', r.manoVisible)
  const ultima = page.locator('#labMano [data-elegir]').last()
  await ultima.scrollIntoViewIfNeeded()
  const tapada = await ultima.evaluate((el) => {
    const c = el.getBoundingClientRect()
    const b = document.querySelector('#labApuntar').getBoundingClientRect()
    return c.bottom > b.top && c.top < b.bottom && c.right > b.left && c.left < b.right
  })
  check('  …y las cartas de la mano se pueden ver por encima de la barra', !tapada)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} fallos.` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
