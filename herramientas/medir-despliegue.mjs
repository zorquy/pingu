// «Vuelves al día siguiente» con ~20 despliegues al día: abres la portada
// (sale de la caché vieja), el service worker ve que hay despliegue nuevo y
// vacía TODO (la 910), y la segunda página que abres va como la primera vez.
// Se compara con la misma segunda página sin despliegue por medio.
import { utimesSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const SITIO = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/test-forum'
const BASE = process.env.PD_BASE || 'http://localhost:8894'
const b = await chromium.launch()
async function caso(segunda, desplegar) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'allow' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('sb-prueba-auth-token', '{}') } catch {}
    const s = new Proxy({}, { get: () => 250 }); window.__FAKE_RETRASO__ = s; window.__RPC_RETRASO__ = s
  })
  await ctx.route(/\/\.netlify\/functions\//, (r) => setTimeout(() => r.fulfill({ status: 404, body: '{}' }).catch(() => {}), 250))
  await ctx.route(/assets\.tcgdex|images\.tcggo|limitless|githubusercontent|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }))
  const p = await ctx.newPage()
  const cdp = await ctx.newCDPSession(p)
  await cdp.send('Network.enable')
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 2 })
  // Ayer: portada y la otra página, todo a la caché.
  // Sin el despliegue, la «segunda» es otra visita normal; con él, el SW ha
  // vaciado todo al ver la portada.
  for (const r of ['/', segunda, '/']) { await p.goto(BASE + r, { waitUntil: 'load' }); await p.waitForTimeout(2500) }
  if (desplegar) { const t = Date.now() / 1000 + 60; utimesSync(`${SITIO}/js/app.js`, t, t) }
  // Hoy: la portada (de la caché, revisa en segundo plano)…
  await p.goto(BASE + '/', { waitUntil: 'load' }); await p.waitForTimeout(3000)
  // …y la segunda página.
  const t0 = Date.now()
  await p.goto(BASE + segunda, { waitUntil: 'load' })
  const carga = Date.now() - t0
  const hayCache = await p.evaluate(async () => (await caches.keys()).join(','))
  await p.waitForTimeout(3000)
  const r = await p.evaluate(() => {
    const rs = performance.getEntriesByType('resource')
    return { fcp: Math.round(performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0), kb: Math.round(rs.reduce((n, x) => n + (x.transferSize || 0), 0) / 1024), red: rs.filter((x) => /\/(js|css)\//.test(x.name) && x.transferSize > 400).length }
  })
  await ctx.close()
  return { ...r, carga, hayCache }
}
for (const s of ['/foro', '/mi-coleccion', '/torneos']) {
  const sin = await caso(s, false)
  const con = await caso(s, true)
  console.log(`${s.padEnd(14)} sin despliegue: pinta ${sin.fcp} ms, carga ${sin.carga} ms, ${sin.kb} KB (${sin.red} ficheros por red) | tras despliegue: pinta ${con.fcp} ms, carga ${con.carga} ms, ${con.kb} KB (${con.red} por red) [${con.hayCache}]`)
}
await b.close()
