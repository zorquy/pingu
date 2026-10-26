// Las cajas de lo alto de una página en el móvil, con su hueco con la anterior.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const [ruta, sel] = process.argv.slice(2)
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1'; window.__FAKE_DESEOS__ = [0, 1, 2].map((i) => ({ id: 'd' + i, user_id: 'admin-1', card_id: 'sv8-' + (i + 1), idioma: null })); localStorage.setItem('pokedoc-onboarding', '1') })
const page = await ctx.newPage()
await page.goto(`http://localhost:8892${ruta}`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)
console.log(await page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => e.getBoundingClientRect().height > 2).map((e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return `${e.tagName.toLowerCase()}#${e.id}.${[...e.classList].join('.')} top=${Math.round(r.top)} h=${Math.round(r.height)} mt=${cs.marginTop} mb=${cs.marginBottom} gap=${cs.gap}` }).join('\n'), sel))
await b.close()
