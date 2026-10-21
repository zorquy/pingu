// Tanda 941 — El perfil › Cambios en dos filas (tanda 2 de «Cambios en PokeDoc»).
//
// PINGU: «voy al perfil de alguien y tiene un montón de cartas en búsqueda…
// salen hacia abajo, scroll, y no paran. Y eso está mal». Lo que se mira, con
// alguien que da 40 cartas y busca 30:
//   1. Lo puro: el orden de la fila (lo tuyo primero, luego lo que más vale).
//   2. Cada lista es UNA fila: 24 baldosas a la misma altura, y la página no
//      crece con las que se apuntan; las flechas la deslizan.
//   3. «Ver todas (40)»: la hoja con las 40, buscador y «Las que buscas».
//   4. Vuestro cruce arriba, con las cartas en pequeño.
//   5. En el iPhone: sin flechas, la fila se desliza con el dedo y la página
//      no se sale de lado.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  const m = await import(`${RAIZ}/js/perfil-cambios-puro.js`)
  const filas = [{ card_id: 'a' }, { card_id: 'b' }, { card_id: 'c' }, { card_id: 'd' }]
  const precio = { a: 5, b: 50, c: 1, d: 20 }
  const sellos = { c: 'La buscas', d: 'La tienes' }
  const r = m.ordenarParaTira(filas, { sello: (f) => sellos[f.card_id] || null, precio: (f) => precio[f.card_id] })
  check('lo tuyo primero, «La tienes» después y lo demás por valor', r.map((f) => f.card_id).join() === 'c,d,b,a', r.map((f) => f.card_id).join())
  check('la fila lleva 24', m.DE_PRIMERAS === 24)
}

// user-2 da 40 (xy5-1…40, la 40 la más cara) y busca 30 (xy5-41…70); quien
// mira (user-1) busca xy5-7 y xy5-30, y da xy5-50.
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'fede', display_name: 'Fede' }]
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST' }]
  window.__FAKE_CARTAS__ = Array.from({ length: 70 }, (_, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: i === 11 ? 'Pikachu' : `Carta ${i + 1}`, name_es: i === 11 ? 'Pikachu' : `Carta ${i + 1}`, image_path: `x/${i}` }))
  window.__FAKE_PRECIOS__ = Array.from({ length: 40 }, (_, i) => ({ card_id: `xy5-${i + 1}`, cm_low: i + 1, cm_low_es: i + 1 }))
  window.__FAKE_COLECCION__ = [
    ...Array.from({ length: 40 }, (_, i) => ({ id: `l${i}`, user_id: 'user-2', card_id: `xy5-${i + 1}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', cambio: 1 })),
    { id: 'm1', user_id: 'user-1', card_id: 'xy5-50', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', cambio: 1 },
  ]
  window.__FAKE_DESEOS__ = [
    ...Array.from({ length: 30 }, (_, i) => ({ id: `d${i}`, user_id: 'user-2', card_id: `xy5-${i + 41}`, idioma: null })),
    { id: 'y1', user_id: 'user-1', card_id: 'xy5-7', idioma: null },
    { id: 'y2', user_id: 'user-1', card_id: 'xy5-30', idioma: null },
  ]
}
const browser = await chromium.launch()
async function abrir({ movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  const page = await ctx.newPage()
  await page.route(/assets\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/usuario.html?id=user-2&ver=cambios`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}
const fila = (page, id) => page.$$eval(`#${id} > .pc-carta`, (ls) => ls.map((l) => ({ top: Math.round(l.getBoundingClientRect().top), nombre: l.querySelector('.pc-carta-nombre')?.textContent || '', sello: l.querySelector('.pc-sello')?.textContent || '' })))

{
  const { page, ctx, errores } = await abrir()
  console.log('\n── 2. Una fila por lista ──')
  const da = await fila(page, 'pcRejillaDa')
  check('«Da 40 cartas»: 24 baldosas en la fila', /Da 40 cartas/.test(await page.locator('#perfilCambios').innerText()) && da.length === 24, String(da.length))
  check('  …todas a la misma altura (una sola fila)', new Set(da.map((x) => x.top)).size === 1, JSON.stringify([...new Set(da.map((x) => x.top))]))
  check('  …las que buscas primero (la 30 y la 7, por valor), luego la más cara', da[0]?.nombre === 'Carta 30' && da[1]?.nombre === 'Carta 7' && da[0].sello === 'La buscas' && da[2]?.nombre === 'Carta 40', JSON.stringify(da.slice(0, 3)))
  check('  …y lo dice: «Las que buscas, primero»', /Las que buscas, primero/.test(await page.locator('#perfilCambios').innerText()))
  const busca = await fila(page, 'pcRejillaBusca')
  check('«Busca 30 cartas»: una fila, con «La das» delante', busca.length === 24 && new Set(busca.map((x) => x.top)).size === 1 && busca[0]?.sello === 'La das' && busca[0]?.nombre === 'Carta 50', JSON.stringify(busca.slice(0, 2)))
  const alto = await page.$eval('#perfilCambios', (c) => c.getBoundingClientRect().height)
  check('la pestaña entera cabe en una pantalla y poco (antes, seis filas por lista)', alto < 1100, String(Math.round(alto)))
  const antes = await page.$eval('#pcRejillaDa', (u) => u.scrollLeft)
  await page.click('[data-tira="pcRejillaDa"][data-paso="1"]')
  await page.waitForTimeout(900)
  check('la flecha › desliza la fila', (await page.$eval('#pcRejillaDa', (u) => u.scrollLeft)) > antes + 200)

  console.log('\n── 3. «Ver todas» ──')
  const boton = page.locator('[data-ver-todas="pcRejillaDa"]')
  check('el botón dice cuántas: «Ver todas (40)»', /Ver todas \(40\)/.test(await boton.innerText()), await boton.innerText())
  await boton.click()
  await page.waitForTimeout(500)
  const n = () => page.locator('#pcTodasRejilla > .pc-carta').count()
  check('la hoja se abre con las 40', (await page.$eval('#pcTodas', (d) => d.open)) && (await n()) === 40, String(await n()))
  check('  …con el título de quién es', /Lo que da Fede/.test(await page.locator('#pcTodasTitulo').innerText()))
  await page.fill('#pcTodasBuscar', 'pika')
  await page.waitForTimeout(300)
  check('el buscador la estrecha («pika» → Pikachu)', (await n()) === 1 && /Pikachu/.test(await page.locator('#pcTodasRejilla').innerText()) && /1 de 40/.test(await page.locator('#pcTodasCuenta').innerText()))
  await page.fill('#pcTodasBuscar', '')
  await page.click('#pcTodasSolo')
  await page.waitForTimeout(300)
  check('«Las que buscas»: las dos', (await n()) === 2 && (await page.getAttribute('#pcTodasSolo', 'aria-pressed')) === 'true')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Esc la cierra', !(await page.$eval('#pcTodas', (d) => d.open)))

  console.log('\n── 4. Vuestro cruce ──')
  check('arriba, con las cartas en pequeño (te da 2, le das 1)', (await page.locator('#pcCruce .perfil-cruce-minis').count()) === 2 && (await page.locator('#pcCruce .perfil-cruce-mini img').count()) === 3, `${await page.locator('#pcCruce .perfil-cruce-mini').count()} minis`)
  check('  …y «Escribir» sigue', (await page.locator('#pcCruce a.btn-primary').count()) === 1)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. En el iPhone ──')
{
  const { page, ctx, errores } = await abrir({ movil: true })
  check('sin flechas', !(await page.locator('[data-tira="pcRejillaDa"]').first().isVisible()))
  const da = await fila(page, 'pcRejillaDa')
  check('una sola fila', da.length === 24 && new Set(da.map((x) => x.top)).size === 1)
  check('la página no se sale de lado', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), await page.evaluate(() => `${document.documentElement.scrollWidth} > ${innerWidth}`))
  await page.click('[data-ver-todas="pcRejillaBusca"]')
  await page.waitForTimeout(500)
  const caja = await page.locator('#pcTodas').boundingBox()
  const alto = await page.evaluate(() => innerHeight)
  check('«Ver todas» sale desde abajo, a lo ancho', caja && caja.width >= 380 && Math.abs(caja.y + caja.height - alto) < 4, `${JSON.stringify(caja)} · ventana ${alto}`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
