// Tanda 716 — la ficha de una carta en el móvil, con su arte detrás y en
// pestañas (F1, F2 y F4 de la lista de propuestas, elegidas por PINGU; la
// F3 —leer la gráfica con el dedo— ya existía desde la 661).
//
// Lo que se mira: que en un iPhone la carta lleve detrás su propio arte
// difuminado y el precio en una línea bajo el nombre (copiado del bloque de
// precio, una sola fuente); que haya cuatro pestañas y solo salgan las que
// tienen algo; que cada una enseñe lo suyo y esconda lo demás SIN quitarlo
// del HTML (Google lo sigue leyendo); que la barra se pegue arriba; que las
// versiones vayan en carrusel; y que en el escritorio no cambie nada.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const semilla = ({ versiones }) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'bw4', name: 'Siguiente Destino', serie_id: 'bw', market: 'WEST', release_date: '2012-02-08', card_count_official: 99, card_count_total: 103 }]
  const c = (n, rareza) => ({ id: `bw4-${n}`, market: 'WEST', set_id: 'bw4', local_id: String(n), name: 'Mewtwo-EX', name_es: 'Mewtwo-EX', image_path: `bw/bw4/${n}`, rarity: rareza, category: 'Pokemon', hp: 170, types: ['Psychic'], dex_ids: [150], variants: { holo: true }, attacks: [{ name: 'Disparo', cost: ['Colorless'], damage: '20', effect: 'Hace 20 de daño.' }], tcg_sets: { id: 'bw4', name: 'Siguiente Destino', serie_id: 'bw' } })
  window.__FAKE_CARTAS__ = versiones ? [c(98, 'Ultra Rare'), c(54, 'Rare Holo EX')] : [c(98, 'Ultra Rare')]
  window.__FAKE_PRECIOS__ = [{ card_id: 'bw4-98', cm_low: 12.4, cm_low_es: 12.4, cm_trend: 13, checked_at: new Date().toISOString() }]
  window.__FAKE_COLECCION__ = []
}
async function abrir({ movil = true, versiones = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { versiones })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="825"><rect width="600" height="825" fill="#e8564a"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/carta.html?id=bw4-98`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
const seVe = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== 'none' && r.height > 0 }, sel)
const pestanas = (page) => page.$$eval('.carta-pestanas button', (bs) => bs.map((b) => `${b.textContent}${b.hidden ? '·oculta' : ''}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`).join(' '))

console.log('── 1. En un iPhone: la cabecera ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const arte = await page.evaluate(() => ({ var: getComputedStyle(document.getElementById('cartaNucleo')).getPropertyValue('--arte'), antes: getComputedStyle(document.querySelector('.carta-articulo'), '::before').backgroundImage }))
  check('la carta lleva detrás su propio arte (la misma imagen, difuminada)', /url\(/.test(arte.var) && /url\(/.test(arte.antes), JSON.stringify(arte))
  const precio = limpio(await page.locator('.carta-precio-corto').innerText().catch(() => ''))
  const delBloque = limpio(await page.locator('#cmPrecios .pv-burbuja-principal .pv-cifra').innerText().catch(() => ''))
  check('el precio en una línea bajo el nombre, el MISMO que el bloque de precio', precio.startsWith(delBloque) && /12,40/.test(precio), `${precio} / ${delBloque}`)
  const orden = await page.evaluate(() => {
    const h1 = document.querySelector('.carta-cabecera h1').getBoundingClientRect().top
    const p = document.querySelector('.carta-precio-corto').getBoundingClientRect().top
    return p > h1
  })
  check('  …debajo del nombre', orden)
  await ctx.close()
}

console.log('── 2. En un iPhone: las pestañas ──')
{
  const { page, ctx } = await abrir()
  check('cuatro pestañas, Resumen puesta, y sin histórico no sale Historial', (await pestanas(page)) === 'Resumen* Precio Historial·oculta Versiones', await pestanas(page))
  check('Resumen: la ficha y los ataques sí; el precio y las versiones no', (await seVe(page, '.carta-datos')) && !(await seVe(page, '#cartaMercado')) && !(await seVe(page, '#cartaVersiones')))
  check('  …pero el precio sigue en el HTML (no se borra nada)', (await page.locator('#cartaMercado .pv-cifra').count()) >= 1)
  await page.click('.carta-pestanas [data-pestana="precio"]')
  await page.waitForTimeout(300)
  check('Precio: el bloque de precio sí; la ficha no', (await seVe(page, '#cmPrecios')) && !(await seVe(page, '.carta-datos')) && (await pestanas(page)).includes('Precio*'))
  await page.click('.carta-pestanas [data-pestana="versiones"]')
  await page.waitForTimeout(300)
  check('Versiones: las otras versiones, en carrusel (en fila y deslizables)', (await seVe(page, '#cartaVersiones')) && !(await seVe(page, '#cartaMercado')) && (await page.$eval('#listaVersiones', (e) => getComputedStyle(e).display === 'flex' && getComputedStyle(e).overflowX === 'auto')))
  check('cada pestaña mide 44 de alto', (await page.$$eval('.carta-pestanas button:not([hidden])', (bs) => bs.every((b) => b.getBoundingClientRect().height >= 44))))
  await page.click('.carta-pestanas [data-pestana="resumen"]')
  await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' }))
  await page.waitForTimeout(500)
  const arriba = await page.$eval('.carta-pestanas', (e) => Math.round(e.getBoundingClientRect().top))
  check('al bajar, la barra se queda pegada arriba', arriba >= 0 && arriba <= 80, String(arriba))
  const ancho = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }))
  check('y la página no se va de ancho', ancho.s <= ancho.c + 1, JSON.stringify(ancho))
  await ctx.close()
}

console.log('── 3. Sin otras versiones, su pestaña no sale ──')
{
  const { page, ctx } = await abrir({ versiones: false })
  check('Versiones no sale', (await pestanas(page)).includes('Versiones·oculta'), await pestanas(page))
  await ctx.close()
}

console.log('── 4. En el escritorio, como siempre ──')
{
  const { page, ctx, errores } = await abrir({ movil: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('ni pestañas ni línea de precio arriba', (await page.locator('.carta-pestanas').count()) === 0 && (await page.locator('.carta-precio-corto').count()) === 0)
  check('la ficha y el precio, los dos a la vista', (await seVe(page, '.carta-datos')) && (await seVe(page, '#cartaMercado')))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
