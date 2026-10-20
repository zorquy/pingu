// Tanda 645 — la ficha nueva en pantalla: el resumen de tu copia con los
// campos plegados, el histórico dentro de la ficha, y en /carta las
// impresiones pulsables. Fixture: el Groudon-EX de la 589 con dos
// impresiones (normal y reverse).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { rutaDeCarta } from '/home/user/pingu/js/carta-ruta.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [{ id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { normal: true, reverse: true }, cm_id_product_propio: 273681, tp_id_product_propio: 96048 }]
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', precio_compra: 100, created_at: '2026-10-01T10:00:00Z' }]
  window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-150', cm_id_product: 273681, cm_low: 39, cm_low_es: 140, cm_low_en: 194, cm_low_fr: 150, tp_market_eur: 171.08, cm_gradeadas: { psa: { psa10: 2621 } }, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' }]
})
await page.route('**assets.tcgdex.net/**', (r) => r.abort())
await page.route('**api.tcgdex.net/**', (r) => r.abort())
let historialPedido = 0
await page.route('**/.netlify/functions/tcggo-historial*', (r) => {
  historialPedido++
  r.fulfill({ contentType: 'application/json', body: JSON.stringify({ filas: [{ dia: '2026-09-01', cm_low_es: 120 }, { dia: '2026-09-15', cm_low_es: 130 }, { dia: '2026-10-01', cm_low_es: 140 }], pedido: false }) })
})

console.log('── 1. La ficha de tu copia ──')
{
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.locator('.mc-carta-foto').filter({ hasText: 'Groudon' }).first().click()
  await page.waitForTimeout(1200)
  const resumen = page.locator('#mcEdCopiaResumen')
  // Desde la 669 el bloque de tu copia nace PLEGADO (PINGU: «solo cuando le
  // des a editar») y Editar lo despliega entero.
  check('al abrir, el bloque de tu copia está plegado y la loseta Editar a la vista', !(await page.locator('#mcEdCopiaBloque').isVisible()) && (await page.locator('#mcEdEditar').isVisible()))
  await page.click('#mcEdEditar')
  await page.waitForTimeout(250)
  check('Editar despliega el resumen de tu copia: chapas y lo que vale', await resumen.isVisible() && /ES NM/.test(limpio(await resumen.locator('#mcEdCopiaChapas').innerText())) && limpio(await page.locator('#mcEdCopiaVale').innerText()) === '2 copias · valen 280,00 € · pagaste 100,00 €', limpio(await page.locator('#mcEdCopiaVale').innerText()))
  check('  …con los campos de siempre y la loseta en «Listo»', await page.locator('#mcEdIdioma').isVisible() && (await page.locator('#mcEdEditar').getAttribute('aria-expanded')) === 'true' && /Listo$/.test(limpio(await page.locator('#mcEdEditar').innerText())))
  check('  …las chapas de arriba no se repiten', (await page.locator('#mcEdChapas').isVisible()) === false)
  check('Quitar está a la vista, en rojo', await page.locator('#mcEdQuitarResumen').isVisible())
  await page.click('#mcEdEditar')
  await page.waitForTimeout(200)
  check('  …y «Listo» lo pliega entero', (await page.locator('#mcEdCopiaCampos').isVisible()) === false && !(await page.locator('#mcEdCopiaBloque').isVisible()))
  await page.click('#mcEdEditar')
  await page.waitForTimeout(200)
  const bloque = page.locator('#mcEdPrecioBloque')
  // Desde la 915: tarjetas por idioma (la de tu copia la primera) y la
  // versión en su fila, que abre la lista con un check en las que tienes.
  check('la tarjeta de tu copia: 140 € en español, y TCGplayer en la suya', /^ES tu copia 140,00 €/.test(limpio(await bloque.locator('.pv-tarjeta-tuya').innerText())) && (await bloque.locator('.pv-tarjeta-tcg').count()) === 1)
  check('la versión en su fila: Normal', (await page.locator('#mcEdVersion').isVisible()) && limpio(await page.locator('#mcEdVersionNombre').innerText()) === 'Normal')
  await page.click('#mcEdVersion')
  await page.waitForTimeout(200)
  check('  …y al tocarla, las dos, la normal marcada y con su check', (await page.locator('#mcEdVersiones .mc-version').count()) === 2 && (await page.locator('#mcEdVersiones .mc-version.activa').getAttribute('data-version')) === 'normal' && (await page.locator('#mcEdVersiones .mc-version.activa .mc-version-check.si').count()) === 1)
  await page.click('#mcEdVersion')
  const filas = bloque.locator('.pv-tarjeta:not(.pv-tarjeta-tcg)')
  check('una tarjeta por idioma con precio: tres, la del español la primera y marcada como tu copia', (await filas.count()) === 3 && /tu copia/.test(limpio(await filas.first().innerText())))
  const alto = await filas.first().evaluate((el) => el.getBoundingClientRect().height)
  check('  …cada tarjeta mide 44 px y abre Cardmarket con ese idioma', alto >= 44 && /language=1/.test(await filas.nth(1).getAttribute('href')), String(alto))
  check('la de TCGplayer lleva a TCGplayer', /tcgplayer\.com\/product\//.test(await bloque.locator('.pv-tarjeta-tcg').getAttribute('href')))
  check('el histórico se pide y se pinta dentro de la ficha', historialPedido === 1 && (await page.locator('#mcEdHistorial').isVisible()) && (await page.locator('#mcEdHistorial svg polyline').count()) === 1)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

console.log('── 2. /carta: las impresiones se pulsan ──')
{
  await page.goto(`${BASE}${rutaDeCarta({ id: 'xy5-150', name: 'Groudon-EX', name_es: 'Groudon EX' })}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const caja = page.locator('#cmPrecios')
  check('dos impresiones como botones, la normal marcada', (await caja.locator('button.pv-impresion').count()) === 2 && (await caja.locator('.pv-impresion.pv-activa').getAttribute('data-variante')) === 'normal')
  await caja.locator('button.pv-impresion[data-variante="reverse"]').click()
  await page.waitForTimeout(300)
  check('al pulsar la reverse, se marca y el desplegable de versión la sigue', (await caja.locator('.pv-impresion.pv-activa').getAttribute('data-variante')) === 'reverse' && (await page.locator('#cmVariante').inputValue()) === 'reverse')
  check('la fila del idioma elegido dice «elegido» y no «tu copia»', /elegido/.test(limpio(await caja.locator('.pv-fila.pv-activa').innerText())))
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
