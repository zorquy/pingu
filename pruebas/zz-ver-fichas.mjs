import { chromium, contexto, BASE } from './fixtures-app.mjs'
const S = process.env.S
const b = await chromium.launch()
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, 'user-1')
  const page = await ctx.newPage()
  page.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 160)))
  await page.goto(`${BASE}/evento`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.click('#eventoLista .evento-carta')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: `${S}/ficha-rapida-${movil ? 'm' : 'pc'}.png` })
  const href = await page.evaluate(() => document.getElementById('fichaRapidaCompleta')?.getAttribute('href'))
  console.log('completa', href)
  await page.goto(`${BASE}/cartas?carta=sv08-13`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  await page.screenshot({ path: `${S}/mceditor-${movil ? 'm' : 'pc'}.png` })
  await ctx.close()
}
await b.close()
