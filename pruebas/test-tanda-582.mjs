// Tanda 582 — «+X € este mes» bajo el valor de la cabecera y en la imagen.
//
// La gráfica existe desde la 377; esto es sacarla a la vista: la
// cabecera se ve en todas las pestañas y decía el valor de hoy y nada
// más. Fixture: una foto de hace 40 días a 80 €, otra de hace 20 a 100 €,
// y hoy la colección vale 150 (valor manual). «Hace un mes» la colección
// valía lo que decía la última foto de entonces —la de hace 40 días, 80—,
// así que el mes es +70: la misma regla que la gráfica (`diasDelRango`
// coge el punto anterior al corte para que la línea empiece en el borde).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const hace = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.addInitScript(([d40, d20]) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura' }]
  window.__FAKE_CARTAS__ = [{ id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Carta 1', name_es: 'Carta 1', image_path: 'x/1', market: 'WEST', rarity: 'Rare' }]
  window.__FAKE_COLECCION__ = [{ id: 'c1', card_id: 'sv1-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, valor_manual: 150, created_at: new Date().toISOString() }]
  window.__FAKE_VALOR__ = [
    { dia: d40, valor: 80, copias: 1, distintas: 1, sin_precio: 0 },
    { dia: d20, valor: 100, copias: 1, distintas: 1, sin_precio: 0 },
  ]
}, [hace(40), hace(20)])
await page.route('**/assets.tcgdex.net/**', (r) => r.abort())
await page.route('**/api.tcgdex.net/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
await page.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)

console.log('── 1. Bajo el valor ──')
{
  // Desde la 748 el cambio va en la CARTERA del Panel (la C1 de su
  // maqueta): flecha, cifra, porcentaje y «este mes» con 1M puesto, que es
  // el rango con el que abre.
  const chip = page.locator('#mcValorCaja .mc-valor-cambio')
  check('bajo el valor hay un «este mes»', (await chip.count()) === 1 && (await chip.isVisible()), String(await chip.count()))
  const t = ((await chip.textContent()) || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim()
  check('  …que dice 70,00 € · 87,5 % este mes', /^Sube 70,00 € · 87,5 % este mes$/.test(t), JSON.stringify(t))
  check('  …y va en verde (clase sube)', await chip.evaluate((e) => e.classList.contains('sube')))
}

console.log('── 2. En la imagen ──')
{
  await page.click('#mcImagenCrear')
  await page.waitForTimeout(1500)
  const datos = await page.evaluate(() => window.__mcImagenDatos)
  check('la imagen recibe el cambio del mes', /\+70,00 €/.test(String(datos?.cambioMes || '').replace(/\u00a0/g, ' ')), JSON.stringify(datos?.cambioMes))
}

console.log('── 3. Sin histórico, nada ──')
{
  const p2 = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  await p2.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', serie_id: 'sv' }]
    window.__FAKE_CARTAS__ = [{ id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Carta 1', name_es: 'Carta 1', image_path: 'x/1', market: 'WEST', rarity: 'Rare' }]
    window.__FAKE_COLECCION__ = [{ id: 'c1', card_id: 'sv1-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, valor_manual: 150, created_at: new Date().toISOString() }]
    window.__FAKE_VALOR__ = []
  })
  await p2.route('**/assets.tcgdex.net/**', (r) => r.abort())
  await p2.route('**/api.tcgdex.net/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
  await p2.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(2500)
  check('sin dos fotos no se inventa un cambio', !(await p2.locator('#mcCifraCambio').isVisible()) && (await p2.locator('#mcValorCaja .mc-valor-cambio.sube, #mcValorCaja .mc-valor-cambio.baja').count()) === 0)
  await p2.close()
}

check('sin errores de JavaScript', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
