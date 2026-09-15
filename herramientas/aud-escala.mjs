import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readdirSync } from 'node:fs'
const BASE = 'http://localhost:8892'
const b = await chromium.launch()
const paginas = readdirSync('/home/user/pingu').filter((f) => f.endsWith('.html')).map((f) => '/' + f.replace(/\.html$/, ''))
let malos = 0
for (const ancho of [320, 393, 1280]) {
  for (const ruta of paginas) {
    const page = await b.newPage({ viewport: { width: ancho, height: 900 } })
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e).slice(0, 120)))
    await page.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
    try {
      await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 12000 })
      await page.waitForTimeout(1500)
      const sobra = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      const culpables = sobra > 1 ? await page.evaluate((w) => [...document.querySelectorAll('*')].filter((n) => n.getBoundingClientRect().right > w + 1).slice(0, 3).map((n) => n.tagName + '.' + (n.className || '').toString().slice(0, 30)), ancho) : []
      if (sobra > 1) { malos++; console.log(`DESBORDE ${ancho} ${ruta}: +${sobra}px`, JSON.stringify(culpables)) }
      if (errs.length) console.log(`ERROR ${ancho} ${ruta}: ${errs[0]}`)
    } catch (e) { console.log(`NO CARGA ${ancho} ${ruta}: ${String(e).slice(0, 80)}`) }
    await page.close()
  }
}
await b.close()
console.log(malos === 0 ? 'SIN DESBORDES' : `${malos} desbordes`)
