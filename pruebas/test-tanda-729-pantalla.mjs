// Tanda 729 — el vacío de Mi colección con la mascota y dos caminos (V6 de
// la lista de propuestas, elegida por PINGU): escanear o buscar, y debajo
// traerla de Collectr o Dex.
//
// Lo que se mira: que sin cartas salga la mascota con su hueco reservado,
// una frase y DOS botones; que cada uno haga lo que dice —el de escanear
// abre la cámara, el de buscar lleva a Buscar— y que el de traerla abra el
// importador. Un camino escrito en prosa es un enlace que nadie comprueba
// (la 510): aquí se pulsan los tres.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
async function abrir() {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], permissions: ['camera'] })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1'; window.__FAKE_COLECCION__ = [] })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, ctx, errores }
}
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const v = await page.evaluate(() => {
    const c = document.getElementById('mcCartasVacio')
    const img = c?.querySelector('.mc-vacio-img')
    return c ? { ve: !c.classList.contains('hidden'), img: img ? { w: img.getAttribute('width'), h: img.getAttribute('height'), src: img.getAttribute('src') } : null, botones: [...c.querySelectorAll('.mc-vacio-acciones > *')].map((b) => b.textContent.trim()), pie: c.querySelector('.mc-vacio-pie')?.textContent.trim() } : null
  })
  check('sin cartas sale el vacío, con la mascota y su hueco reservado', v?.ve && v.img?.src.includes('mascota') && v.img.w === '96' && v.img.h === '145', JSON.stringify(v))
  check('  …y dos caminos: escanear o buscar', JSON.stringify(v?.botones) === JSON.stringify(['Escanear una carta', 'Buscar una carta']), JSON.stringify(v?.botones))
  check('  …y debajo, traerla de otra app', /Collectr o Dex/.test(v?.pie || ''), v?.pie)
  await page.click('[data-vacio-escanear]')
  await page.waitForTimeout(1500)
  check('«Escanear una carta» abre la cámara', await page.evaluate(() => document.getElementById('mcEscanerCaja').open))
  await page.click('#mcEscanerCerrar')
  await page.waitForTimeout(400)
  await page.click('#mcCartasVacio .mc-importar-abrir')
  await page.waitForTimeout(1200)
  check('«Tráela de Collectr o Dex» abre el importador', await page.evaluate(() => !!document.getElementById('mcImportarDialogo')?.open))
  await page.evaluate(() => document.getElementById('mcImportarDialogo').close())
  await page.click('#mcCartasVacio [data-ir-pestania="buscar"]')
  await page.waitForTimeout(500)
  check('«Buscar una carta» lleva a Buscar', await page.isVisible('#mcPanelBuscar'))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
