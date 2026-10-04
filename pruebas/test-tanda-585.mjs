// Tanda 585 — el enlace EXACTO a Cardmarket y el precio guardado como
// respaldo, en las dos pantallas que enseñan precio: la ficha de
// /mi-coleccion y la página de la carta.
//
// PINGU: «le das al botón de ver en Cardmarket y te saca una búsqueda».
// El fixture: una carta con fila guardada que vino de pokemontcg.io (URL
// exacta y cifras, sin idProduct) y otra sin fila. TCGdex en vivo se
// corta, que es justo el caso de las cartas sin precio.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { rutaDeCarta } from '/home/user/pingu/js/carta-ruta.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const URL_EXACTA = 'https://prices.pokemontcg.io/cardmarket/xy5-150'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', card_count_official: 160, card_count_total: 164, logo_path: 'x/l', tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [
    { id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true } },
    { id: 'xy5-1', market: 'WEST', set_id: 'xy5', local_id: '1', name: 'Weedle', name_es: 'Weedle', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', variants: { normal: true, reverse: true } },
  ]
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' },
    { id: 'l2', card_id: 'xy5-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-02T10:00:00Z' },
  ]
  window.__FAKE_PRECIOS__ = [
    { card_id: 'xy5-150', cm_id_product: null, cm_low: 39, cm_trend: 196.68, cm_avg30: 131.56, cm_avg7: 144.25, cm_url: 'https://prices.pokemontcg.io/cardmarket/xy5-150', origen: 'pokemontcg', cm_updated: '2026-10-05T00:00:00Z' },
  ]
})
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
await page.route('**api.tcgdex.net/**', (r) => r.abort())

console.log('── 1. La ficha de /mi-coleccion ──')
{
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const groudon = page.locator('.mc-carta-foto').filter({ hasText: 'Groudon' }).first()
  check('la carta está', (await groudon.count()) === 1)
  await groudon.click()
  await page.waitForTimeout(900)
  const precio = await page.locator('#mcEdPrecio').innerText()
  check('el precio guardado (del respaldo) se enseña', /39,00/.test(precio) && /196,68/.test(precio), precio)
  const href = await page.locator('#mcEdCardmarket').getAttribute('href')
  check('el botón lleva a la carta EXACTA, no a una búsqueda', href === URL_EXACTA, String(href))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  // Y la que no tiene fila sigue cayendo a la búsqueda por nombre.
  const weedle = page.locator('.mc-carta-foto').filter({ hasText: 'Weedle' }).first()
  await weedle.click()
  await page.waitForTimeout(900)
  const href2 = await page.locator('#mcEdCardmarket').getAttribute('href')
  check('sin fila y sin TCGdex, la búsqueda por nombre de siempre', /Products\/Search\?searchString=Weedle/.test(href2 || ''), String(href2))
  check('  …y «Sin precio de Cardmarket.»', /Sin precio/.test(await page.locator('#mcEdPrecio').innerText()))
  await page.keyboard.press('Escape')
}

console.log('── 2. La página de la carta ──')
{
  await page.goto(`${BASE}${rutaDeCarta({ id: 'xy5-150', name: 'Groudon-EX', name_es: 'Groudon EX' })}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const enlace = page.locator('#cmEnlace')
  check('hay botón de Cardmarket', (await enlace.count()) === 1)
  check('  …con la URL exacta', (await enlace.getAttribute('href')) === URL_EXACTA, String(await enlace.getAttribute('href')))
  check('  …y dice «Ver en Cardmarket»', /Ver en Cardmarket/.test(await enlace.innerText()), await enlace.innerText())
  const precios = await page.locator('#cmPrecios').innerText()
  check('las cifras guardadas se pintan aunque TCGdex no conteste', /39,00/.test(precios) && /196,68/.test(precios), precios.replace(/\n/g, ' '))
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
