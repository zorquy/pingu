import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const b = await chromium.launch()
// Los esqueletos solo viven mientras carga, así que no se esperan: se
// mete uno en la página y se mira qué dice el CSS de él. Lo que se
// comprueba es la REGLA, no el momento en que aparece.
const PIEZAS = ['esq-titular', 'esq-bloque', 'esq-avatar', 'achievement-card', 'lightbox', 'foro-mensaje-destello']
for (const modo of ['no-preference', 'reduce']) {
  const p = await b.newPage({ viewport: { width: 1100, height: 800 }, reducedMotion: modo })
  await p.addInitScript(() => { window.__FAKE_SESSION__='user-1' })
  await p.goto('http://localhost:8892/foro', { waitUntil:'domcontentloaded' })
  await p.waitForTimeout(1800)
  const r = await p.evaluate((piezas) => {
    const out = {}
    for (const c of piezas) {
      const d = document.createElement('div')
      d.className = c
      document.body.appendChild(d)
      out[c] = getComputedStyle(d).animationName
      d.remove()
    }
    return out
  }, PIEZAS)
  console.log(modo, JSON.stringify(r))
  await p.close()
}
await b.close()
