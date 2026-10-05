// Tanda 586 — los dos mercados en pantalla, y el Groudon que valía 2 €.
//
// Fixture: el Groudon-EX con la fila guardada que trae Cardmarket MAL
// emparejado (2,06 €, el común) y TCGplayer a 150 $; y un Weedle que solo
// tiene TCGplayer. TCGdex en vivo se corta: lo guardado es lo que manda.
// Desde la 589 el precio es un bloque (js/precio-vista.js): la cifra, de
// qué es, y los botones. Sin TCGGO en estas filas, la cifra sale de
// TCGplayer convertido.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { rutaDeCarta } from '/home/user/pingu/js/carta-ruta.js'
import { usdAEuros } from '/home/user/pingu/js/cardmarket.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ')
const euros = (v) => v.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
    { id: 'l2', card_id: 'xy5-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-02T10:00:00Z' },
  ]
  window.__FAKE_PRECIOS__ = [
    { card_id: 'xy5-150', cm_id_product: 272930, cm_low: 0.25, cm_trend: 2.06, cm_avg30: 1.34, cm_avg7: 1.55, tp_holo_market: 150, tp_holo_low: 120, cm_updated: '2026-10-05T00:00:00Z' },
    { card_id: 'xy5-1', tp_normal_market: 0.5, tp_normal_low: 0.1 },
  ]
})
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
await page.route('**api.tcgdex.net/**', (r) => r.abort())

console.log('── 1. La cabecera suma el Groudon por TCGplayer, no por los 2 € ──')
{
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const esperado = usdAEuros(150) + usdAEuros(0.5) * 2
  const valor = limpio(await page.locator('#mcResumen .mc-cifra-valor dd').textContent())
  check(`el valor de la colección es ${euros(esperado)} €`, valor.includes(euros(esperado)), valor)
}

console.log('── 2. La ficha del Groudon ──')
{
  const groudon = page.locator('.mc-carta-foto').filter({ hasText: 'Groudon' }).first()
  await groudon.click()
  await page.waitForTimeout(900)
  const cifra = limpio(await page.locator('#mcEdPrecioBloque .pv-cifra').innerText())
  check('la cifra es TCGplayer convertido (129 €), no los 2,06 € de la otra carta', cifra === '129,00 €', cifra)
  const de = limpio(await page.locator('#mcEdPrecioBloque .pv-de').innerText())
  check('  …y el renglón dice de qué es', /TCGplayer, 150,00 US\$ convertidos/.test(de), de)
  check('  …sin filas por idioma (no hay TCGGO)', (await page.locator('#mcEdPrecioBloque .pv-bandera').count()) === 0)
  const href = await page.locator('#mcEdPrecioBloque .btn-cardmarket').getAttribute('href')
  check('el botón busca por nombre en vez de ir al producto equivocado', /Products\/Search\?searchString=Groudon/.test(href || '') && !/idProduct=272930/.test(href || ''), String(href))
  check('  …y sin id de TCGplayer no hay botón de TCGplayer', (await page.locator('#mcEdPrecioBloque .btn-tcgplayer').count()) === 0)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  // Weedle: solo TCGplayer.
  await page.locator('.mc-carta-foto').filter({ hasText: 'Weedle' }).first().click()
  await page.waitForTimeout(900)
  const p2 = limpio(await page.locator('#mcEdPrecioBloque .pv-cifra').innerText())
  check('una carta que solo tiene TCGplayer enseña la conversión', p2 === '0,43 €', p2)
  check('  …y el renglón dice que son dólares', /0,50 US\$ convertidos/.test(limpio(await page.locator('#mcEdPrecioBloque .pv-de').innerText())))
  await page.keyboard.press('Escape')
}

console.log('── 3. La página de la carta ──')
{
  await page.goto(`${BASE}${rutaDeCarta({ id: 'xy5-150', name: 'Groudon-EX', name_es: 'Groudon EX' })}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const precios = limpio(await page.locator('#cmPrecios').innerText())
  check('la cifra es la de TCGplayer convertida', /129,00 €/.test(precios) && /150,00 US\$/.test(precios), precios)
  check('  …y NO las cifras del Groudon común', !/2,06/.test(precios), precios)
  const enlace = page.locator('#cmPrecios .btn-cardmarket')
  check('el botón busca', /Products\/Search/.test(await enlace.getAttribute('href')))
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
