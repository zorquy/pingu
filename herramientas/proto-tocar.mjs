import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const modo = process.argv[2]
const F_CSS = `
.nav-right button, .nav-right > a, .nav-toggle, .nav-user-avatar { min-width: 44px !important; min-height: 44px !important; }
.nav-right { gap: 0 !important; }
.nav-logo { min-height: 44px; }
`
// Pinta el área que de verdad se puede tocar: verde si llega a 44, roja
// si no. Sin esto la comparación no enseña nada — el icono se ve igual,
// lo que cambia es el hueco alrededor, que es invisible.
const PINTAR = () => {
  const capa = document.createElement('div')
  capa.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:9999'
  document.body.appendChild(capa)
  for (const n of document.querySelectorAll('.navbar button, .navbar a, nav button, nav a, header button, header a')) {
    if (n.offsetParent === null) continue
    const c = n.getBoundingClientRect()
    if (c.width < 1) continue
    const vale = c.width >= 44 && c.height >= 44
    const d = document.createElement('div')
    d.style.cssText = `position:absolute;left:${c.left + scrollX}px;top:${c.top + scrollY}px;width:${c.width}px;height:${c.height}px;` +
      `border:2px solid ${vale ? '#16a34a' : '#dc2626'};background:${vale ? 'rgba(22,163,74,.14)' : 'rgba(220,38,38,.14)'};border-radius:6px;` +
      `font:700 9px system-ui;color:${vale ? '#166534' : '#991b1b'};display:flex;align-items:flex-end;justify-content:center;padding-bottom:1px`
    d.textContent = `${Math.round(c.width)}×${Math.round(c.height)}`
    capa.appendChild(d)
  }
}
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 393, height: 200 }, isMobile: true, hasTouch: true })
await p.addInitScript(() => { localStorage.setItem('pokedoc-theme','light'); window.__FAKE_SESSION__='user-1' })
await p.goto('http://localhost:8892/index.html', { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(2400)
if (modo === 'despues') await p.addStyleTag({ content: F_CSS })
await p.waitForTimeout(300)
await p.evaluate(PINTAR)
await p.waitForTimeout(200)
await p.screenshot({ path: `${SC}/${modo === 'antes' ? 'prop-antes' : 'prop-despues'}/movil.png`, clip: { x: 0, y: 0, width: 393, height: 80 } })
await b.close()
console.log(modo, 'ok')
