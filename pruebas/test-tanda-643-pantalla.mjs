// Tanda 643 — la gráfica del histórico en /carta: se pinta con las filas
// que devuelve la función (aquí, interceptada), cambia con el idioma, y
// sin filas no se ve. TCGdex y TCGGO en vivo, cortados.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { rutaDeCarta } from '/home/user/pingu/js/carta-ruta.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(() => {
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [{ id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true }, cm_id_product_propio: 273681, tp_id_product_propio: 96048 }]
  window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-150', cm_id_product: 273681, cm_low: 39, cm_low_es: 140, cm_low_en: 194, tp_market_eur: 171.08, tcggo_updated: '2026-10-05T12:00:00Z' }]
})
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
await page.route('**api.tcgdex.net/**', (r) => r.abort())
let pedidas = 0
await page.route('**/.netlify/functions/tcggo-historial*', (r) => {
  pedidas++
  const card = new URL(r.request().url()).searchParams.get('card')
  r.fulfill({
    contentType: 'application/json',
    body: JSON.stringify({ filas: card === 'xy5-150' ? [
      { dia: '2026-09-01', cm_low: 39, cm_low_es: 140, cm_low_en: 194, tp_market_eur: 171 },
      { dia: '2026-09-15', cm_low: 40, cm_low_es: 150, cm_low_en: 190, tp_market_eur: 160 },
      { dia: '2026-10-01', cm_low: 41, cm_low_es: 160, cm_low_en: 199, tp_market_eur: 155 },
    ] : [], pedido: false }),
  })
})

console.log('── 1. La gráfica, con las filas de la función ──')
{
  await page.goto(`${BASE}${rutaDeCarta({ id: 'xy5-150', name: 'Groudon-EX', name_es: 'Groudon EX' })}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const caja = page.locator('#cmHistorial')
  check('se pide el histórico de ESTA carta, una vez', pedidas === 1)
  check('la gráfica se ve, con su título', await caja.isVisible() && /Histórico de precios/i.test(await caja.innerText()))
  check('  …un SVG con las dos líneas', (await caja.locator('svg polyline.carta-historial-linea').count()) === 2 && (await caja.locator('svg .carta-historial-linea-tp').count()) === 1)
  check('  …el eje con el mínimo y el máximo del español (140 y 171 por TCGplayer)', /140,00 €/.test(limpio(await caja.innerText())) && /171,00 €/.test(limpio(await caja.innerText())), limpio(await caja.innerText()))
  check('  …y el pie en español', /mínimo en Cardmarket en español/.test(await caja.locator('.carta-historial-pie').innerText()))
  const ancho = await caja.locator('svg').evaluate((el) => el.getBoundingClientRect().width)
  check('el SVG ocupa el ancho de su caja', ancho > 400, String(ancho))
  // El idioma: en inglés el eje cambia.
  await page.selectOption('#cmIdioma', 'en')
  await page.waitForTimeout(300)
  check('al cambiar a inglés la gráfica cambia (199 € arriba) sin volver a pedir', /199,00 €/.test(limpio(await caja.innerText())) && /en inglés/.test(await caja.locator('.carta-historial-pie').innerText()) && pedidas === 1, limpio(await caja.innerText()))
}

console.log('── 2. Sin filas, no se ve ──')
{
  await page.addInitScript(() => {
    window.__FAKE_CARTAS__ = [{ id: 'xy5-1', market: 'WEST', set_id: 'xy5', local_id: '1', name: 'Weedle', name_es: 'Weedle', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', variants: { normal: true } }]
    window.__FAKE_PRECIOS__ = []
  })
  await page.goto(`${BASE}${rutaDeCarta({ id: 'xy5-1', name: 'Weedle', name_es: 'Weedle' })}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('una carta sin histórico no enseña la caja', (await page.locator('#cmHistorial').isVisible()) === false)
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
