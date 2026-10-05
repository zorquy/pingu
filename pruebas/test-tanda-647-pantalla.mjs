// Tanda 647 en pantalla — /coleccion/pbl con precios, sesión y colección:
// los filtros se llenan con lo que hay, filtran y ordenan, «las que me
// faltan» funciona, las cifras de la cabecera salen y cada carta lleva su
// precio y sus impresiones.
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
await page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'))
await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'me05', name: 'Pitch Black', name_en: 'Pitch Black', serie_id: 'me', serie_name_en: 'Mega Evolution', market: 'WEST', release_date: '2026-07-17', card_count_official: 120, card_count_total: 120, tcg_online_code: 'PBL', tcggo_id: 415 }]
  window.__FAKE_CARTAS__ = [
    { id: 'me05-1', market: 'WEST', set_id: 'me05', local_id: '1', name: 'Tropius', name_es: 'Tropius', image_path: 'x/1', category: 'Pokemon', rarity_en: 'Common', types: ['Grass'], illustrator: 'Akino Fukuji', variants: { normal: true, reverse: true } },
    { id: 'me05-45', market: 'WEST', set_id: 'me05', local_id: '45', name: 'Mega Lucario ex', name_es: 'Mega Lucario ex', image_path: 'x/2', category: 'Pokemon', rarity_en: 'Double Rare', types: ['Fighting'], illustrator: '5ban Graphics', variants: { holo: true } },
    { id: 'me05-112', market: 'WEST', set_id: 'me05', local_id: '112', name: 'Mega Lucario ex', name_es: 'Mega Lucario ex', image_path: 'x/3', category: 'Pokemon', rarity_en: 'Special Illustration Rare', types: ['Fighting'], illustrator: 'toriyufu', variants: { holo: true } },
  ]
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'me05-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
  window.__FAKE_PRECIOS__ = [
    { card_id: 'me05-1', cm_id_product: 1, cm_low: 0.05, cm_low_es: 0.05, origen: 'tcggo' },
    { card_id: 'me05-45', cm_id_product: 2, cm_low: 6.2, cm_low_es: 6.2, origen: 'tcggo' },
    { card_id: 'me05-112', cm_id_product: 3, cm_low: 118, cm_low_es: 118, origen: 'tcggo' },
  ]
  window.__FAKE_SET_VALOR__ = [{ set_id: 'me05', market: 'WEST', dia: '2026-09-29', valor_cm: 600 }, { set_id: 'me05', market: 'WEST', dia: '2026-10-05', valor_cm: 616.4 }]
})
await page.route(/assets\.tcgdex\.net|images\.tcggo\.com|api\.tcgdex\.net/, (r) => r.abort())

console.log('── 1. La expansión por dentro ──')
{
  await page.goto(`${BASE}/coleccion/pbl`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const cifras = limpio(await page.locator('.coleccion-cifras').innerText())
  check('las cifras de la cabecera: valor del set, semanal y lo que tienes', /Valor del set 616 €/i.test(cifras) && /Semanal \+3 %/i.test(cifras) && /Tienes 1 \/ 3/i.test(cifras), cifras)
  const opciones = async (id) => (await page.locator(`#${id} option`).allInnerTexts()).map(limpio).join(' | ')
  check('rarezas: de más rara a menos, en español', (await opciones('filtroRareza')) === 'Todas las rarezas | Rara Ilustración Especial | Rara Doble | Común', await opciones('filtroRareza'))
  check('tipos, impresiones, ilustradores y precio, con lo que hay', (await opciones('filtroTipo')) === 'Todos los tipos | Planta | Lucha' && (await opciones('filtroImpresion')) === 'Todas las impresiones | Normal | Reverse holo | Holo' && /Akino Fukuji \| toriyufu/.test(await opciones('filtroIlustrador')) && /Hasta 1 € \| 1 – 5 €/.test(await opciones('filtroPrecio')), await opciones('filtroTipo'))
  const nombres = async () => (await page.locator('#coleccionRejilla .coleccion-carta-num').allInnerTexts()).map(limpio).join(' | ')
  check('cada carta lleva número y rareza', (await nombres()) === '1 · Común | 45 · Rara Doble | 112 · Rara Ilustración Especial', await nombres())
  const pies = (await page.locator('#coleccionRejilla .coleccion-carta-pie').allInnerTexts()).map(limpio)
  check('  …y su precio; Tropius además sus dos impresiones', pies[0] === '0,05 € N RH' && pies[1] === '6,20 €' && pies[2] === '118,00 €', pies.join(' | '))
  check('  …y la que tienes, marcada', (await page.locator('#coleccionRejilla .coleccion-carta-tengo').count()) === 1 && /Tropius/.test(await page.locator('.coleccion-carta-tengo').innerText()))
  await page.selectOption('#filtroPrecio', '5a20')
  await page.waitForTimeout(200)
  check('filtrar por 5–20 € deja el Lucario de 6,20', (await nombres()) === '45 · Rara Doble' && limpio(await page.locator('#coleccionCuenta').innerText()) === '1 de 3 cartas', await nombres())
  await page.selectOption('#filtroPrecio', '')
  await page.selectOption('#filtroOrden', 'precio')
  await page.waitForTimeout(200)
  check('ordenar por precio pone la de 118 € primero', (await nombres()).startsWith('112 ·'), await nombres())
  await page.selectOption('#filtroOrden', '')
  await page.click('#filtroFaltan')
  await page.waitForTimeout(200)
  check('«las que me faltan» quita el Tropius que tienes', (await page.locator('#filtroFaltan').getAttribute('aria-pressed')) === 'true' && (await nombres()) === '45 · Rara Doble | 112 · Rara Ilustración Especial', await nombres())
  await page.selectOption('#filtroIlustrador', 'toriyufu')
  await page.waitForTimeout(200)
  check('  …y con el ilustrador se combina', (await nombres()) === '112 · Rara Ilustración Especial', await nombres())
  const altoChip = await page.locator('#filtroFaltan').evaluate((el) => el.getBoundingClientRect().height)
  check('el chip mide 44', altoChip >= 44, String(altoChip))
}

console.log('── 2. Sin sesión: ni «faltan» ni «tienes», y el resto igual ──')
{
  const p2 = await browser.newPage({ viewport: { width: 390, height: 900 } })
  await p2.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'))
  await p2.addInitScript(() => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = [{ id: 'me05', name: 'Pitch Black', market: 'WEST', tcg_online_code: 'PBL', card_count_official: 120 }]
    window.__FAKE_CARTAS__ = [{ id: 'me05-1', market: 'WEST', set_id: 'me05', local_id: '1', name: 'Tropius', name_es: 'Tropius', image_path: 'x/1', category: 'Pokemon', rarity_en: 'Common', variants: { normal: true } }]
    window.__FAKE_PRECIOS__ = []
    window.__FAKE_SET_VALOR__ = []
  })
  await p2.route(/assets\.tcgdex\.net|images\.tcggo\.com|api\.tcgdex\.net/, (r) => r.abort())
  await p2.goto(`${BASE}/coleccion/pbl`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(2200)
  check('sin sesión no hay chip de faltan', (await p2.locator('#filtroFaltan').isVisible()) === false)
  check('sin valor no hay cifras', (await p2.locator('.coleccion-cifras:not(.hidden)').count()) === 0)
  check('con una sola rareza el desplegable se esconde', (await p2.locator('#filtroRareza').isVisible()) === false && (await p2.locator('#filtroPrecio').isVisible()) === false)
  check('la página no se sale de lado en el móvil', (await p2.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await p2.close()
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
