// Tanda 992 — tapar lo que vale la colección. PINGU: «para la gente que hace
// directos o capturas y no quiere compartir lo que vale». Un ojo al lado del
// valor (cabecera y Panel) lo cambia por asteriscos, también la gráfica y el
// cambio del mes, y se recuerda al volver.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const dia = (hace, valor) => ({ dia: new Date(Date.now() - hace * 86400000).toISOString().slice(0, 10), valor, copias: 1, sin_precio: 0 })
const semilla = ({ valor }) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [{ id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true }, cm_id_product_propio: 273681 }]
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' }]
  window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-150', cm_id_product: 273681, cm_low: 139, cm_low_es: 139, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' }]
  window.__FAKE_VALOR__ = valor
}
const browser = await chromium.launch()
for (const movil of [false, true]) {
  const que = movil ? 'móvil' : 'PC'
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1280, height: 1000 } })
  await ctx.addInitScript(semilla, { valor: Array.from({ length: 30 }, (_, i) => dia(29 - i, 100 + i)) })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' }))
  await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  // Lo que se VE de una caja: su color y el del ::after (los asteriscos).
  const visto = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent).map((e) => ({ color: getComputedStyle(e).color, tapa: getComputedStyle(e, '::after').content, texto: e.textContent.trim().slice(0, 24) })), sel)
  const ojos = await page.locator('[data-ocultar-valor]').count()
  check(`${que}: hay un ojo al lado del valor (cabecera y Panel)`, ojos >= 1, String(ojos))
  const antes = await visto('.mc-cartera-cifra, .mc-cifra-valor dd')
  check('  …y de primeras el valor se ve', antes.length >= 1 && antes.every((v) => v.color !== 'rgba(0, 0, 0, 0)' && v.tapa === 'none' && /€/.test(v.texto)), JSON.stringify(antes))
  await page.locator('[data-ocultar-valor]:visible').first().click()
  await page.waitForTimeout(300)
  const tapado = await visto('.mc-cartera-cifra, .mc-cifra-valor dd, .mc-cartera .mc-valor-cambio')
  check('  al tocarlo, asteriscos en su lugar (la cifra, el de la cabecera y el cambio)', tapado.length >= 2 && tapado.every((v) => v.color === 'rgba(0, 0, 0, 0)' && v.tapa === '"*****"'), JSON.stringify(tapado))
  const rotulos = await page.evaluate(() => [...document.querySelectorAll('.mc-valor-rotulos')].map((e) => getComputedStyle(e).visibility))
  check('  …y la gráfica sin sus cifras', rotulos.every((v) => v === 'hidden'), rotulos.join())
  const pulsados = await page.$$eval('[data-ocultar-valor]', (bs) => bs.map((b) => b.getAttribute('aria-pressed')))
  check('  …todos los ojos dicen que está tapado', pulsados.length && pulsados.every((p) => p === 'true'), pulsados.join())
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const vuelta = await visto('.mc-cartera-cifra, .mc-cifra-valor dd')
  check('  al volver, sigue tapado', vuelta.length >= 1 && vuelta.every((v) => v.tapa === '"*****"'), JSON.stringify(vuelta))
  await page.locator('[data-ocultar-valor]:visible').first().click()
  await page.waitForTimeout(300)
  const otra = await visto('.mc-cartera-cifra, .mc-cifra-valor dd')
  check('  y otro toque lo enseña', otra.every((v) => v.tapa === 'none'), JSON.stringify(otra))
  check('  sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
// Y la tarjeta «Tu colección» de la portada (lo vio PINGU: allí seguía la cifra).
for (const oculto of [true, false]) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'] })
  await ctx.addInitScript((o) => {
    window.__FAKE_SESSION__ = 'admin-1'
    const hoy = Date.now()
    window.__FAKE_VALOR__ = Array.from({ length: 40 }, (_, i) => ({ user_id: 'admin-1', dia: new Date(hoy - (39 - i) * 864e5).toISOString().slice(0, 10), valor: 1000 + i * 2 }))
    window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'sv1-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 1078 }]
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-valor-oculto', o ? '1' : '0') } catch {}
  }, oculto)
  const page = await ctx.newPage()
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.hoy-valor-texto b', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(800)
  const v = await page.evaluate(() => [...document.querySelectorAll('.hoy-valor-texto b, .hoy-valor-mes')].map((e) => ({ color: getComputedStyle(e).color, tapa: getComputedStyle(e, '::after').content, texto: e.textContent.trim() })))
  check(oculto ? 'portada, tapado: «Tu colección» enseña asteriscos (valor y cambio del mes)' : 'portada, sin tapar: la cifra se ve', v.length >= 2 && v.every((x) => oculto ? x.color === 'rgba(0, 0, 0, 0)' && x.tapa === '"*****"' : x.tapa === 'none' && x.color !== 'rgba(0, 0, 0, 0)') && /€/.test(v[0].texto), JSON.stringify(v))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
