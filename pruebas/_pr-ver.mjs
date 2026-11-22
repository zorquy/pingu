import { chromium, contexto, BASE } from './fixtures-app.mjs'
const OUT = process.env.OUT
const sembrar = () => {
  const hace = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10)
  const mios = [['d:dragapult ex', 'Dragapult ex'], ['d:gardevoir ex', 'Gardevoir ex']]
  const rivales = [['d:charizard ex', 'Charizard ex'], ['d:lugia vstar', 'Lugia VSTAR'], ['d:raging bolt ex', 'Raging Bolt ex'], ['d:gholdengo ex', 'Gholdengo ex'], ['d:lost box', 'Lost Box']]
  const R = 'wwlwwdlwwlwlwwwlwwlwdwwlwlww'
  window.__FAKE_PARTIDAS__ = [...R].map((r, i) => ({ id: `p${i}`, user_id: 'user-1', mi_mazo: mios[i % 4 ? 0 : 1][0], mi_mazo_nombre: mios[i % 4 ? 0 : 1][1], rival_mazo: rivales[i % 5][0], rival_mazo_nombre: rivales[i % 5][1], resultado: { w: 'win', l: 'loss', d: 'draw' }[r], jugada_el: hace(i * 2), donde: i % 3 ? 'TCG Live' : 'Liga de tienda', created_at: new Date(Date.now() - i * 86400000).toISOString() }))
}
const b = await chromium.launch()
for (const movil of [true, false]) {
  const ctx = await contexto(b, movil, 'user-1', sembrar)
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('ERR', String(e).slice(0, 160)))
  await p.goto(BASE + '/mis-partidas', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(3000)
  console.log(movil ? 'm' : 'pc', await p.evaluate(() => document.querySelector('#partidasTabs [aria-pressed="true"]')?.dataset.vista))
  await p.screenshot({ path: `${OUT}/pr-${movil ? 'm' : 'pc'}.png`, scale: 'css', fullPage: true })
  await ctx.close()
}
await b.close()
