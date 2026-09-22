import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1600, height: 800 } })
await p.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
await p.goto('http://localhost:8892/index.html', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2400)
// Lo que PIDE la barra: la suma de lo que mide cada pieza a su ancho
// natural, más los huecos y el relleno. No lo que ocupa cuando cabe.
const m = await p.evaluate(() => {
  const inner = document.querySelector('.nav-inner')
  const cs = getComputedStyle(inner)
  const relleno = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
  const hueco = parseFloat(cs.gap) || 0
  const piezas = [...inner.children].filter((n) => n.offsetParent)
  const anchos = piezas.map((n) => {
    const r = n.getBoundingClientRect()
    return { clase: n.className || n.id, w: Math.round(r.width) }
  })
  const enlaces = document.querySelector('.nav-links')
  return {
    relleno, hueco, anchos,
    pide: Math.round(anchos.reduce((a, x) => a + x.w, 0) + relleno + hueco * (piezas.length - 1)),
    enlaces: enlaces ? Math.round(enlaces.getBoundingClientRect().width) : 0,
  }
})
console.log(JSON.stringify(m, null, 1))
await b.close()
