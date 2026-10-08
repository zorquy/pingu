// Tanda 719 — escanear a un toque y en ráfaga (N4 de la lista de
// propuestas, elegida por PINGU).
//
// Lo que se mira: que la burbuja de Cartas lleve su botón de escanear (solo
// con cuenta) y que abra la cámara donde estés; que leer una carta ya NO
// cierre la cámara: lo leído sale en una bandeja con su «+», que añade una
// copia por `datos.anadir` —y otra al volver a leerla—, con su Deshacer al
// lado; que tocar la carta abra el diálogo de siempre encima de la cámara;
// y que «Ver todas en Buscar» cierre y deje la búsqueda entera a la vista.
//
// Desde la 758 el escáner está ESCONDIDO (PINGU: «ocúltalo, que no funciona
// muy bien»): no hay botón en ninguna burbuja, y lo de dentro se prueba por
// las dos puertas que quedan en el código, la dirección y el aviso.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion ? 'user-1' : 'none'
  window.__FAKE_SETS__ = [{ id: 'bw9', name: 'Destinos Futuros', serie_id: 'bw', market: 'WEST', card_count_official: 99, release_date: '2012-02-08' }]
  window.__FAKE_CARTAS__ = [
    { id: 'bw9-22', market: 'WEST', set_id: 'bw9', local_id: '22', name: 'Reshiram EX', name_es: 'Reshiram EX', image_path: 'x/22', rarity: 'Ultra Rare', category: 'Pokemon', types: ['Fire'], dex_ids: [643], variants: { normal: true } },
    { id: 'bw9-21', market: 'WEST', set_id: 'bw9', local_id: '21', name: 'Reshiram', name_es: 'Reshiram', image_path: 'x/21', rarity: 'Rare', category: 'Pokemon', types: ['Fire'], dex_ids: [643], variants: { normal: true } },
  ]
  window.__FAKE_COLECCION__ = []
}
async function abrir(ruta, { sesion = true, textos = { nombre: 'BÁSICO Reshiram EX pv180', codigo: '22/99 Ilus. Shizurow' } } = {}) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', permissions: ['camera'] })
  await ctx.addInitScript(semilla, { sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#e8564a"/></svg>' }))
  await ctx.route('**/.netlify/functions/leer-carta', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ textos, idioma: 'es' }) }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\/(?!leer-carta)/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}
const abierto = (page) => page.evaluate(() => !!document.getElementById('mcEscanerCaja')?.open)
const lineas = (page) => page.evaluate(() => (window.__TABLAS__.user_collection || []).filter((l) => l.user_id === 'user-1').map((l) => ({ card: l.card_id, n: l.cantidad, idioma: l.idioma, estado: l.estado })))
const escanear = (page) => page.evaluate(() => document.dispatchEvent(new CustomEvent('pokedoc:escanear', { cancelable: true })))
const disparar = async (page) => { await page.click('#mcEscanerDisparo'); await page.waitForTimeout(2200) }

console.log('── 1. Sin botón en ninguna parte (758) ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('en Mi colección la burbuja ya no lleva «Escanear»', (await page.locator('.bm-escanear').count()) === 0 && !/Escanear/.test(await page.textContent('.mc-pestanias')))
  await escanear(page)
  await page.waitForTimeout(1500)
  check('  …pero el código sigue: el aviso abre la cámara ahí mismo', (await abierto(page)) && /mi-coleccion\.html/.test(page.url()), page.url())
  await ctx.close()

  const otra = await abrir('/lanzamientos.html')
  check('en otras páginas tampoco', (await otra.page.locator('.bm-escanear').count()) === 0)
  await otra.ctx.close()
  const directa = await abrir('/mi-coleccion.html?ver=buscar&escanear=1')
  check('y esa dirección abre la cámara sola', await abierto(directa.page))
  await directa.ctx.close()
}

console.log('── 2. Leer no cierra: la bandeja, el «+» y otra vez ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=buscar')
  await escanear(page)
  await page.waitForTimeout(1500)
  await disparar(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la cámara SIGUE abierta tras leer', await abierto(page))
  check('  …y dice lo que ha leído', /He leído: Reshiram EX/.test(await page.textContent('#mcEscanerAyuda')), await page.textContent('#mcEscanerAyuda'))
  const cand = await page.$$eval('#mcEscanerCandidatas .mc-escaner-candidata', (cs) => cs.map((c) => c.textContent.replace(/\s+/g, ' ').trim()))
  check('la bandeja enseña LA carta, con su set y su número', cand.length === 1 && /Reshiram EX/.test(cand[0]) && /Destinos Futuros · 22/.test(cand[0]), JSON.stringify(cand))
  check('  …y por detrás, Buscar ya tiene la búsqueda de siempre', (await page.inputValue('#mcBuscarTodo')) === 'Reshiram EX 22')
  const mas = await page.$eval('[data-escaner-anadir="bw9-22"]', (b) => ({ w: b.getBoundingClientRect().width, h: b.getBoundingClientRect().height, label: b.getAttribute('aria-label') }))
  check('el «+» mide 44 y dice qué añade', mas.w >= 44 && mas.h >= 44 && /Reshiram EX/.test(mas.label), JSON.stringify(mas))
  await page.click('[data-escaner-anadir="bw9-22"]')
  await page.waitForTimeout(900)
  let ls = await lineas(page)
  check('el «+» añade UNA copia, en el idioma del escáner y en el estado por defecto', ls.length === 1 && ls[0].card === 'bw9-22' && ls[0].n === 1 && ls[0].idioma === 'es' && ls[0].estado === 'NM', JSON.stringify(ls))
  check('  …se queda en la cámara y lo cuenta', (await abierto(page)) && /añadida · una en esta ráfaga/.test(await page.textContent('#mcEscanerAyuda')), await page.textContent('#mcEscanerAyuda'))
  check('  …y donde estaba el «+», Deshacer; y ya «tienes 1»', (await page.locator('#mcEscanerCandidatas .mc-escaner-hecha').count()) === 1 && /tienes 1/.test(await page.textContent('#mcEscanerCandidatas')))
  await disparar(page)
  await page.click('[data-escaner-anadir="bw9-22"]')
  await page.waitForTimeout(900)
  ls = await lineas(page)
  check('leerla otra vez y «+»: dos copias en la MISMA línea', ls.length === 1 && ls[0].n === 2, JSON.stringify(ls))
  check('  …y van dos en esta ráfaga', /2 en esta ráfaga/.test(await page.textContent('#mcEscanerAyuda')), await page.textContent('#mcEscanerAyuda'))
  await page.click('#mcEscanerCandidatas .mc-escaner-hecha')
  await page.waitForTimeout(900)
  ls = await lineas(page)
  check('Deshacer devuelve a una copia, y vuelve el «+»', ls.length === 1 && ls[0].n === 1 && (await page.locator('[data-escaner-anadir="bw9-22"]').count()) === 1, JSON.stringify(ls))
  await ctx.close()
}

console.log('── 3. Tocar la carta y «Ver todas en Buscar» ──')
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=buscar', { textos: { nombre: 'BÁSICO Reshiram pv130', codigo: 'Ilus. Nadie' } })
  await escanear(page)
  await page.waitForTimeout(1500)
  await disparar(page)
  check('sin número: las dos Reshiram en la bandeja', (await page.locator('#mcEscanerCandidatas .mc-escaner-candidata').count()) === 2)
  await page.click('#mcEscanerCandidatas [data-escaner-abrir]')
  await page.waitForTimeout(600)
  check('tocar la carta abre el diálogo de añadir encima de la cámara', (await page.evaluate(() => document.getElementById('mcAnadirDialogo').open)) && (await abierto(page)))
  await page.evaluate(() => document.getElementById('mcAnadirDialogo').close())
  await page.waitForTimeout(300)
  check('  …y al cerrarlo sigues en la cámara', await abierto(page))
  await page.click('#mcEscanerVer')
  await page.waitForTimeout(600)
  check('«Ver todas en Buscar» cierra y deja la lista a la vista', !(await abierto(page)) && (await page.locator('#mcBuscarResultados .mc-resultado').count()) === 2 && (await page.isVisible('#mcBuscarResultados')))
  const video = await page.evaluate(() => !document.getElementById('mcEscanerVideo').srcObject)
  check('  …con la cámara apagada', video)
  await escanear(page)
  await page.waitForTimeout(1500)
  check('al volver a abrir, la bandeja empieza vacía', await page.$eval('#mcEscanerBandeja', (b) => b.classList.contains('hidden')))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
