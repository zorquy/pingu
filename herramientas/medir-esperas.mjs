// Segunda visita de una página: qué fichero pide cada consulta y en qué ola.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const ruta = process.argv[2] || '/foro'
const b = await chromium.launch()
const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript(() => {
  window.__FAKE_SESSION__ = 'user-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('sb-prueba-auth-token', '{}') } catch {}
  const s = new Proxy({}, { get: () => 250 }); window.__FAKE_RETRASO__ = s; window.__RPC_RETRASO__ = s
  window.__QUIEN__ = []
})
await ctx.route(/\/\.netlify\/functions\//, (r) => setTimeout(() => r.fulfill({ status: 404, body: '{}' }).catch(() => {}), 250))
const p = await ctx.newPage()
await p.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
await p.waitForTimeout(4500)
const q = (await p.evaluate(() => window.__QUIEN__)).sort((a, b) => a[1] - b[1])
let d = -1e9, o = 0
for (const [t, ms, f] of q) { if (ms >= d + 200) { o++; d = ms; console.log(`— ola ${o} (${ms} ms)`) } console.log(`   ${t.padEnd(28)} ${f}`) }
await b.close()
