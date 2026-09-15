import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const b = await chromium.launch()
const PAGINAS = ['/index.html', '/aprender', '/foro', '/usuarios', '/torneos', '/perfil', '/mis-partidas', '/noticias']
const pequenios = new Map()
let total = 0
for (const ruta of PAGINAS) {
  const p = await b.newPage({ viewport: { width: 393, height: 850 }, isMobile: true, hasTouch: true })
  await p.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
  await p.goto(`http://localhost:8892${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2000)
  const r = await p.evaluate(() => {
    const out = []
    for (const n of document.querySelectorAll('a, button, input, select, [role="button"]')) {
      if (n.offsetParent === null) continue
      const c = n.getBoundingClientRect()
      if (c.width < 1 || c.height < 1) continue
      out.push({ w: Math.round(c.width), h: Math.round(c.height), q: n.tagName + '.' + (n.className || '').toString().split(' ')[0] })
    }
    return out
  })
  total += r.length
  for (const x of r) if (x.h < 40 || x.w < 40) pequenios.set(x.q, `${x.w}×${x.h}  ${x.q}  (${ruta})`)
  await p.close()
}
console.log(`objetivos táctiles: ${total} medidos — ${pequenios.size} clases por debajo de 40×40`)
for (const v of [...pequenios.values()].slice(0, 14)) console.log('  ', v)
await b.close()
