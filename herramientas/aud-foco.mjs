import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1100, height: 800 } })
await p.addInitScript(() => { window.__FAKE_SESSION__ = 'user-1' })
await p.goto('http://localhost:8892/index.html', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(1800)
let sinAnillo = []
for (let i = 0; i < 25; i++) {
  await p.keyboard.press('Tab')
  const r = await p.evaluate(() => {
    const n = document.activeElement
    if (!n || n === document.body) return null
    const s = getComputedStyle(n)
    const marca = s.outlineStyle !== 'none' && s.outlineWidth !== '0px'
    return { que: n.tagName + '.' + (n.className || '').toString().slice(0, 24), marca, outline: s.outlineWidth + ' ' + s.outlineStyle }
  })
  if (r && !r.marca) sinAnillo.push(r.que)
}
console.log('elementos enfocados sin anillo visible:', sinAnillo.length)
if (sinAnillo.length) console.log(' ', [...new Set(sinAnillo)].slice(0, 8).join(' | '))
await b.close()
