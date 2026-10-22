// Cuánto tarda en verse una página que NUNCA has abierto cuando llegas
// tocando su enlace (985, la D): se abre la portada (sus ficheros ya en el
// worker), se posa el dedo en el enlace 150 ms y se suelta. Tres casos:
// la web de antes, la de ahora haciéndose pasar por un iPhone (sin «reglas de
// especulación»: solo el worker se adelanta) y la de ahora en Chrome.
// Uso: PD_ANTES=http://localhost:8895 PD_AHORA=http://localhost:8893 node medir-tocar.mjs
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const ANTES = process.env.PD_ANTES || 'http://localhost:8895'
const AHORA = process.env.PD_AHORA || 'http://localhost:8893'
const DESTINOS = (process.argv.slice(2).length ? process.argv.slice(2) : ['/mi-coleccion', '/torneos', '/foro'])
const b = await chromium.launch()
async function caso(base, destino, { comoIphone = false } = {}) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'allow' })
  await ctx.addInitScript((iphone) => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('sb-prueba-auth-token', '{}') } catch {}
    const s = new Proxy({}, { get: () => 250 }); window.__FAKE_RETRASO__ = s; window.__RPC_RETRASO__ = s
    if (iphone) HTMLScriptElement.supports = () => false
  }, comoIphone)
  await ctx.route(/\/\.netlify\/functions\//, (r) => setTimeout(() => r.fulfill({ status: 404, body: '{}' }).catch(() => {}), 250))
  await ctx.route(/assets\.tcgdex|images\.tcggo|limitless|githubusercontent|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }))
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 100, downloadThroughput: 5e6 / 8, uploadThroughput: 1.5e6 / 8 })
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 })
  for (let i = 0; i < 2; i++) { await p.goto(base + '/', { waitUntil: 'load' }); await p.waitForTimeout(2500) }
  // Un enlace de verdad al destino, en la portada, a la vista.
  await p.evaluate((d) => { const a = document.createElement('a'); a.href = d; a.id = 'irA'; a.textContent = 'Ir'; a.style.cssText = 'position:fixed;top:120px;left:20px;z-index:99999;padding:20px;background:#fff'; document.body.appendChild(a) }, destino)
  const caja = await p.locator('#irA').boundingBox()
  const x = caja.x + 10, y = caja.y + 10
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  await p.waitForTimeout(150)
  const t0 = Date.now()
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await p.waitForURL((u) => u.pathname.startsWith(destino), { timeout: 15000 })
  // Cuándo el contenido visible llega al 90 % del de al final.
  const muestras = []
  for (let i = 0; i < 60; i++) {
    const n = await p.evaluate(() => (document.querySelector('main, .page-content')?.innerText || '').replace(/\s+/g, '').length).catch(() => 0)
    muestras.push([Date.now() - t0, n])
    await p.waitForTimeout(100)
  }
  const fin = muestras.at(-1)[1]
  const seVe = muestras.find(([, n]) => n >= fin * 0.9)?.[0]
  await ctx.close()
  return seVe
}
for (const d of DESTINOS) {
  const antes = await caso(ANTES, d)
  const iphone = await caso(AHORA, d, { comoIphone: true })
  const chrome = await caso(AHORA, d)
  console.log(`${d.padEnd(16)} antes ${(antes / 1000).toFixed(1)} s · ahora en iPhone ${(iphone / 1000).toFixed(1)} s · ahora en Chrome ${(chrome / 1000).toFixed(1)} s`)
}
await b.close()
