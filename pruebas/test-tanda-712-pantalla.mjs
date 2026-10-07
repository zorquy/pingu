// Tanda 712 — la hoja de añadir, corta (C5), y «añadida» con Deshacer
// (C7). PINGU eligió las dos de la lista de propuestas.
//
// Lo que se mira: la regla de deshacer (una línea nueva se borra; una a la
// que se SUMARON copias vuelve a las que tenía, mirando lo que devolvió la
// base y no la memoria); que la hoja lleve la miniatura y el nombre en una
// fila y «Ya tienes N»; que estado y versión se elijan de un toque y lo
// elegido llegue al select de verdad (que es quien guarda); que el botón
// diga «Añadir 2 copias»; y que tras guardar salga el aviso abajo, encima de
// la burbuja, con un Deshacer que deja todo como estaba y que se va solo.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { comoDeshacer } from '/home/user/pingu/js/mi-coleccion/deshacer.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 1. Qué deshace Deshacer ──')
check('una línea nueva (vuelve con las copias pedidas): se borra', JSON.stringify(comoDeshacer({ cantidad: 2 }, { id: 'n1', cantidad: 2 })) === '{"tipo":"borrar","id":"n1"}')
check('una línea a la que se sumaron copias: vuelve a las que tenía', JSON.stringify(comoDeshacer({ cantidad: 1 }, { id: 'l1', cantidad: 3 })) === '{"tipo":"bajar","id":"l1","cantidad":2}')
check('sin cantidad pedida cuenta como una', JSON.stringify(comoDeshacer({}, { id: 'l1', cantidad: 2 })) === '{"tipo":"bajar","id":"l1","cantidad":1}')
check('sin línea devuelta no hay nada que deshacer', comoDeshacer({ cantidad: 1 }, null) === null)

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [
    { id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true } },
    { id: 'xy5-1', market: 'WEST', set_id: 'xy5', local_id: '1', name: 'Weedle', name_es: 'Weedle', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', variants: { normal: true, reverse: true } },
  ]
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' }]
}
async function abrir() {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|r2\.limitlesstcg\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=xy5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, ctx, errores }
}
const tengoLa = (page, id) => page.$eval(`#mcAlbum .mc-bolsillo:has([data-carta="${id}"])`, (b) => b.className.includes('tengo')).catch(() => null)

console.log('── 2. Una que no tienes: la hoja corta, añadir dos y deshacer ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.locator('#mcAlbum .mc-mas[data-anadir="xy5-1"]').first().click()
  await page.waitForTimeout(500)
  const cab = await page.evaluate(() => {
    const img = document.querySelector('#mcAdCarta img').getBoundingClientRect()
    const nom = document.querySelector('#mcAdNombre').getBoundingClientRect()
    return { ancho: Math.round(img.width), alLado: nom.left >= img.right - 1 && nom.top < img.bottom }
  })
  check('la miniatura (64 px, 748) y el nombre en una fila', cab.ancho === 64 && cab.alLado, JSON.stringify(cab))
  check('  …sin «Ya tienes» (no la tienes)', !(await page.locator('#mcAdTienes').isVisible()))
  const est = page.locator('#mcAdEstado + .mc-seg button')
  // Sin el nombre largo debajo desde la 748 (la maqueta no lo lleva): va
  // en el `title` de cada botón.
  check('el estado: siete botones con su sigla y Near Mint puesto', (await est.count()) === 7 && (await est.allInnerTexts()).join() === 'MT,NM,EX,GD,LP,PL,PO' && (await page.locator('#mcAdEstado + .mc-seg [aria-checked="true"]').innerText()) === 'NM' && (await page.locator('#mcAdEstado + .mc-seg [aria-checked="true"]').getAttribute('title')) === 'Near Mint')
  check('  …y cada uno mide 44 de alto', (await est.evaluateAll((bs) => bs.every((b) => b.getBoundingClientRect().height >= 44))))
  await page.locator('#mcAdEstado + .mc-seg button', { hasText: 'EX' }).click()
  check('tocar EX lo pone en el select de verdad', (await page.inputValue('#mcAdEstado')) === 'EX' && (await page.locator('#mcAdEstado + .mc-seg [aria-checked="true"]').innerText()) === 'EX')
  await page.locator('#mcAdVariante + .mc-seg button', { hasText: 'Reverse' }).click()
  check('la versión: Normal y Reverse holo de un toque', (await page.locator('#mcAdVariante + .mc-seg button').count()) === 2 && (await page.inputValue('#mcAdVariante')) === 'reverse')
  check('el select ya no se ve ni recibe el foco', (await page.$eval('#mcAdEstado', (s) => s.getBoundingClientRect().width <= 1 && s.tabIndex === -1 && s.getAttribute('aria-hidden') === 'true')))
  check('el botón dice lo que hará: «Añadir 1 copia»', limpio(await page.locator('#mcAdGuardar').innerText()) === 'Añadir 1 copia')
  await page.locator('#mcAdCantidad').locator('xpath=../button[@data-paso="1"]').click()
  check('  …y con el + «Añadir 2 copias»', limpio(await page.locator('#mcAdGuardar').innerText()) === 'Añadir 2 copias')
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1200)
  const aviso = page.locator('.mc-deshacer')
  check('al guardar sale el aviso: la carta, y «ya tienes 2»', (await aviso.isVisible()) && /Weedle añadida · ya tienes 2/.test(limpio(await aviso.innerText())), limpio(await aviso.innerText().catch(() => '')))
  const pos = await page.evaluate(() => ({ aviso: document.querySelector('.mc-deshacer').getBoundingClientRect().bottom, burbuja: document.querySelector('.mc-pestanias').getBoundingClientRect().top }))
  check('  …encima de la burbuja, sin taparla', pos.aviso <= pos.burbuja, JSON.stringify(pos))
  check('  …y la casilla pasa a «la tengo»', await tengoLa(page, 'xy5-1'))
  await aviso.locator('button', { hasText: 'Deshacer' }).click()
  await page.waitForTimeout(1200)
  check('Deshacer: la carta deja de ser tuya y el aviso se va', (await tengoLa(page, 'xy5-1')) === false && (await aviso.count()) === 0)
  await ctx.close()
}

console.log('── 3. Una que ya tienes: sumar una y deshacer devuelve una ──')
{
  const { page, ctx } = await abrir()
  await page.locator('#mcAlbum .mc-mas[data-anadir="xy5-150"]').first().click()
  await page.waitForTimeout(500)
  check('la hoja dice «Ya tienes 1»', limpio(await page.locator('#mcAdTienes').innerText()) === 'Ya tienes 1')
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1200)
  check('el aviso dice «ya tienes 2»', /Groudon EX añadida · ya tienes 2/.test(limpio(await page.locator('.mc-deshacer').innerText())), limpio(await page.locator('.mc-deshacer').innerText().catch(() => '')))
  await page.locator('.mc-deshacer button').click()
  await page.waitForTimeout(1200)
  await page.locator('#mcAlbum .mc-bolsillo-enlace[data-carta="xy5-150"]').click()
  await page.waitForTimeout(900)
  check('Deshacer: sigue siendo tuya, con UNA copia (no se borró la línea)', limpio(await page.locator('#mcEdTienes').innerText()) === 'Tienes 1', limpio(await page.locator('#mcEdTienes').innerText()))
  await ctx.close()
}

console.log('── 4. El aviso se va solo ──')
{
  const { page, ctx } = await abrir()
  await page.locator('#mcAlbum .mc-mas[data-anadir="xy5-1"]').first().click()
  await page.waitForTimeout(400)
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(800)
  check('está', (await page.locator('.mc-deshacer').count()) === 1)
  await page.waitForTimeout(6500)
  check('a los seis segundos se ha ido, y la carta sigue añadida', (await page.locator('.mc-deshacer').count()) === 0 && (await tengoLa(page, 'xy5-1')) === true)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
