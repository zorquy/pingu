// Tanda 648 — dos catálogos como en la API (Pokémon y Pokémon Japón), y
// la ficha desde el Panel funciona aunque la carta sea de OTRO catálogo:
// el fallo que PINGU describió («cambio a japonés, vuelvo al panel, abro
// una en español y deja de cargar la foto, el precio y TCGplayer»).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(() => {
  // Se entra con el catálogo JAPONÉS puesto, que es el caso del fallo.
  try { localStorage.setItem('mc-vista', 'ja') } catch {}
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [
    { id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', card_count_official: 160, tcg_online_code: 'PRC' },
    { id: 'SV1a', name: 'トリプレットビート', name_en: 'Triplet Beat', serie_id: 'sv', market: 'JP', card_count_official: 73 },
  ]
  window.__FAKE_CARTAS__ = [
    { id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity_en: 'Ultra Rare', category: 'Pokemon', variants: { holo: true }, cm_id_product_propio: 273681, tp_id_product_propio: 96048 },
    { id: 'SV1a-1', market: 'JP', set_id: 'SV1a', local_id: '001', name: 'フシギダネ', name_en: 'Bulbasaur', image_path: 'sv/sv1a/001', category: 'Pokemon', variants: { normal: true } },
  ]
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-05T10:00:00Z' },
    { id: 'l2', card_id: 'SV1a-1', market: 'JP', cantidad: 1, idioma: 'ja', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
  ]
  window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-150', cm_id_product: 273681, cm_low: 39, cm_low_es: 140, tp_market_eur: 171.08, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' }]
})
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 825"><rect width="600" height="825" fill="#345"/></svg>'
await page.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
await page.route('**api.tcgdex.net/**', (r) => r.abort())
await page.route('**/.netlify/functions/tcggo-historial*', (r) => r.fulfill({ contentType: 'application/json', body: '{"filas":[]}' }))

console.log('── 1. Dos catálogos, como en la API ──')
{
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  // En el Panel no hay selector a la vista (está en Cartas, Expansiones y
  // Pokédex): se lee el primero del DOM, que es el mismo repetido.
  const sel = page.locator('.mc-mercado').first()
  const ops = await sel.evaluate((n) => [...n.options].map((o) => `${o.value}=${o.textContent}`))
  check('el desplegable ofrece Pokémon y Pokémon Japón, y nada más', ops.join(' | ') === 'es=🇬🇧 Pokémon | ja=🇯🇵 Pokémon Japón', ops.join(' | '))
  check('  …y está en el japonés, que es lo que había guardado', (await sel.evaluate((n) => n.value)) === 'ja')
}

console.log('── 2. Desde el Panel, la ficha de una carta española con el japonés puesto ──')
{
  const tarjeta = page.locator('.mc-vistazo-carta[data-carta="xy5-150"]')
  check('lo último que añadiste sale en el Panel aunque sea de otro catálogo', (await tarjeta.count()) === 1)
  await tarjeta.click()
  await page.waitForTimeout(1500)
  check('la ficha se abre como TU copia (no como una que no tienes)', (await page.locator('#mcEditor[open]').count()) === 1 && (await page.locator('#mcEdEditar').isVisible())) // desde la 669 lo que dice «tuya» es la loseta Editar
  check('  …con su foto', (await page.locator('#mcEdFoto img').count()) === 1 && /xy5|x\/1/.test(await page.locator('#mcEdFoto img').getAttribute('src') || ''), await page.locator('#mcEdFoto img').getAttribute('src'))
  check('  …su nombre y su colección', limpio(await page.locator('#mcEditorTitulo').innerText()) === 'Groudon EX' && /Duelos Primigenios/i.test(await page.locator('#mcEdSet').innerText()), limpio(await page.locator('#mcEditorTitulo').innerText()) + ' / ' + limpio(await page.locator('#mcEdSet').innerText()))
  check('  …su precio (140 € en español)', limpio(await page.locator('#mcEdPrecioBloque .pv-cifra').innerText()) === '140,00 €', limpio(await page.locator('#mcEdPrecioBloque').innerText()).slice(0, 120))
  check('  …y su botón de TCGplayer', (await page.locator('#mcEdPrecioBloque .btn-tcgplayer').count()) === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // Y el catálogo japonés sigue siendo el que se mira: abrir una española
  // no ha colado nada en él.
  check('el catálogo sigue en japonés', (await page.locator('.mc-mercado').first().evaluate((n) => n.value)) === 'ja')
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
