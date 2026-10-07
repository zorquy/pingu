// Tanda 713 — seleccionar varias y hacer algo con ellas (C4 de la lista de
// propuestas, elegida por PINGU).
//
// Sobre el «marcar varias» de la 426, que solo añadía. Lo que se mira:
// mantener pulsada una carta enciende el modo y la deja marcada sin abrir
// la ficha; la barra dice cuántas y, en «Quitar», cuántas de esas son
// tuyas; «La quiero» las apunta en `user_wants` sin repetir; «A un álbum»
// las mete en el álbum elegido sin duplicar las que ya estaban; y «Quitar»
// pide un segundo toque y quita UNA copia de cada (la de dos queda en una,
// la de una desaparece), escrito de verdad en la tabla.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 4, card_count_total: 4, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [1, 2, 3, 4].map((n) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', variants: { normal: true } }))
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'xy5-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
    { id: 'l2', card_id: 'xy5-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
  ]
  window.__FAKE_ALBUMES__ = [{}]
  window.__FAKE_DESEOS__ = []
}
async function abrir() {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const a = window.__TABLAS__?.user_albums?.[0]; if (a) a.cartas = [{ id: 'xy5-3' }] }) })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|r2\.limitlesstcg\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=xy5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, ctx, errores }
}
const enlace = (page, id) => page.locator(`#mcAlbum .mc-bolsillo-enlace[data-carta="${id}"]`).first()
async function mantener(page, id, ms = 650) {
  const b = await enlace(page, id).boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 3)
  await page.mouse.down()
  await page.waitForTimeout(ms)
  await page.mouse.up()
  await page.waitForTimeout(300)
}
const marcada = (page, id) => page.$eval(`#mcAlbum .mc-bolsillo:has([data-carta="${id}"])`, (b) => b.classList.contains('marcada')).catch(() => false)
const tabla = (page, t) => page.evaluate((t) => JSON.parse(JSON.stringify(window.__TABLAS__[t] || [])), t)

console.log('── 1. Mantener pulsada una carta la marca ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  await mantener(page, 'xy5-1')
  check('el modo se enciende, la carta queda marcada y la ficha NO se abre', (await page.locator('#mcMarcarBarra').isVisible()) && (await marcada(page, 'xy5-1')) && !(await page.locator('#mcEditor').evaluate((d) => d.open)))
  check('la barra dice cuántas y salen las acciones', limpio(await page.locator('#mcMarcarCuenta').innerText()) === '1 carta marcada' && (await page.locator('#mcMarcarAcciones').isVisible()))
  await page.locator('#mcAlbum .mc-bolsillo-enlace[data-carta="xy5-2"]').first().click()
  await page.locator('#mcAlbum .mc-bolsillo-enlace[data-carta="xy5-3"]').first().click()
  await page.waitForTimeout(200)
  check('con el modo puesto, tocar marca: tres marcadas', limpio(await page.locator('#mcMarcarCuenta').innerText()) === '3 cartas marcadas')
  check('«Quitar» cuenta solo las tuyas (dos de las tres)', limpio(await page.locator('#mcMarcarQuitar').innerText()) === 'Quitar 2')
  check('cada acción mide 44 o más', (await page.$$eval('#mcMarcarAcciones button', (bs) => bs.every((b) => b.getBoundingClientRect().height >= 44))))
  await page.mouse.move(10, 10)
  const b = await enlace(page, 'xy5-4').boundingBox()
  await page.mouse.move(b.x + 10, b.y + 10); await page.mouse.down(); await page.mouse.move(b.x + 10, b.y + 60, { steps: 5 }); await page.waitForTimeout(650); await page.mouse.up()
  check('arrastrar (desplazarse) no es mantener: no marca', !(await marcada(page, 'xy5-4')))
  await ctx.close()
}

console.log('── 1b. Con el DEDO de verdad (eventos táctiles) ──')
{
  // El fallo que costó: con el dedo el navegador manda el «soltar» al
  // elemento donde empezó la pulsación, y si la rejilla se repintaba a
  // mitad, ese elemento ya no existía. Con el ratón no se ve.
  const { page, ctx } = await abrir()
  const cdp = await ctx.newCDPSession(page)
  const b = await enlace(page, 'xy5-2').boundingBox()
  const punto = [{ x: b.x + b.width / 2, y: b.y + b.height / 3 }]
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: punto })
  await page.waitForTimeout(700)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(500)
  const estado = { barra: await page.locator('#mcMarcarBarra').isVisible(), marcada: await marcada(page, 'xy5-2'), ficha: await page.locator('#mcEditor').evaluate((d) => d.open), cuenta: limpio(await page.locator('#mcMarcarCuenta').innerText()) }
  check('mantener con el dedo enciende el modo y marca la carta, sin abrir la ficha', estado.barra && estado.marcada && !estado.ficha, JSON.stringify(estado))
  await enlace(page, 'xy5-3').evaluate((e) => e.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await page.waitForTimeout(400)
  const c = await enlace(page, 'xy5-3').boundingBox()
  await page.touchscreen.tap(c.x + c.width / 2, c.y + c.height / 3)
  await page.waitForTimeout(400)
  check('  …y el siguiente toque marca otra (no se lo come nadie)', (await marcada(page, 'xy5-3')) && limpio(await page.locator('#mcMarcarCuenta').innerText()) === '2 cartas marcadas', limpio(await page.locator('#mcMarcarCuenta').innerText()))
  await ctx.close()
}

console.log('── 2. «La quiero» ──')
{
  const { page, ctx } = await abrir()
  await mantener(page, 'xy5-3')
  await page.locator('#mcAlbum .mc-bolsillo-enlace[data-carta="xy5-4"]').first().click()
  await page.click('#mcMarcarQuiero')
  await page.waitForTimeout(900)
  const deseos = await tabla(page, 'user_wants')
  check('las dos quedan apuntadas, y el modo se apaga', deseos.map((d) => d.card_id).sort().join() === 'xy5-3,xy5-4' && !(await page.locator('#mcMarcarBarra').isVisible()), JSON.stringify(deseos))
  await ctx.close()
}

console.log('── 3. «A un álbum» ──')
{
  const { page, ctx } = await abrir()
  await mantener(page, 'xy5-1')
  await page.locator('#mcAlbum .mc-bolsillo-enlace[data-carta="xy5-3"]').first().click()
  await page.click('#mcMarcarAlbum')
  await page.waitForTimeout(700)
  check('sale la hoja con tus álbumes', (await page.locator('#mcElegirAlbum').evaluate((d) => d.open)) && (await page.locator('#mcEaLista [data-album]').count()) === 1)
  await page.locator('#mcEaLista [data-album]').first().click()
  await page.waitForTimeout(900)
  const alb = (await tabla(page, 'user_albums'))[0]
  check('el álbum gana la que faltaba y no repite la que ya estaba', JSON.stringify(alb.cartas) === '[{"id":"xy5-3"},{"id":"xy5-1"}]', JSON.stringify(alb.cartas))
  check('  …y la hoja se cierra', !(await page.locator('#mcElegirAlbum').evaluate((d) => d.open)))
  await ctx.close()
}

console.log('── 4. «Quitar», con su segundo toque ──')
{
  const { page, ctx } = await abrir()
  await mantener(page, 'xy5-1')
  await page.locator('#mcAlbum .mc-bolsillo-enlace[data-carta="xy5-2"]').first().click()
  await page.click('#mcMarcarQuitar')
  await page.waitForTimeout(200)
  check('el primer toque pregunta y no quita nada', /¿Quitar 2\? Toca otra vez/.test(limpio(await page.locator('#mcMarcarQuitar').innerText())) && (await tabla(page, 'user_collection')).length === 2)
  await page.click('#mcMarcarQuitar')
  await page.waitForTimeout(1200)
  const col = await tabla(page, 'user_collection')
  check('el segundo quita UNA copia de cada: la de dos queda en una, la de una desaparece', col.length === 1 && col[0].id === 'l1' && col[0].cantidad === 1, JSON.stringify(col.map((l) => [l.id, l.cantidad])))
  check('  …y el modo se apaga', !(await page.locator('#mcMarcarBarra').isVisible()))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
