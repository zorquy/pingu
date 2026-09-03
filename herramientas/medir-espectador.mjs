import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const nav = await chromium.launch()

const mundo = (quien) => ({
  __FAKE_SESSION__: quien,
  __FAKE_TORNEOS__: [{ id: 'torneo-1', slug: 'copa', name: 'Copa', status: 'in_progress', admin_id: 'admin-1', max_players: 16, swiss_rounds: 3, current_round_id: 'ronda-1' }],
  // OJO: user-3 NO se inscribe. Es el espectador de verdad — la primera
  // versión de esta medición lo tenía inscrito y por eso «seguía»
  // pidiendo su decklist.
  __FAKE_INSCRIPCIONES__: [
    { id: 'i-0', tournament_id: 'torneo-1', user_id: 'admin-1', status: 'active' },
    { id: 'i-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active' },
    { id: 'i-2', tournament_id: 'torneo-1', user_id: 'user-2', status: 'active' },
  ],
  __FAKE_RONDAS__: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'active' }],
  __FAKE_MESAS__: [{ id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'admin-1', player_b_id: 'user-1', status: 'active' }],
})

for (const [etiqueta, quien] of [['organizador que juega', 'admin-1'], ['espectador con cuenta', 'user-3'], ['sin cuenta', 'none']]) {
  const pag = await nav.newPage()
  await pag.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, mundo(quien))
  await pag.goto('http://localhost:8892/torneo?slug=copa', { waitUntil: 'domcontentloaded' })
  await pag.waitForTimeout(2600)
  const antes = await pag.evaluate(() => window.__CONSULTAS__.n)
  const base = await pag.evaluate(() => ({ ...window.__CONSULTAS__.porTabla }))
  await pag.evaluate(() => document.getElementById('btnActualizarCiclo')?.click())
  await pag.waitForTimeout(1800)
  const despues = await pag.evaluate(() => window.__CONSULTAS__.n)
  const fin = await pag.evaluate(() => ({ ...window.__CONSULTAS__.porTabla }))
  const delta = Object.entries(fin)
    .map(([t, n]) => [t, n - (base[t] || 0)])
    .filter(([, n]) => n > 0)
  console.log(`${etiqueta.padEnd(24)} carga inicial: ${String(antes).padStart(3)} | por refresco: ${despues - antes}`)
  if (delta.length) console.log('    ', delta.map(([t, n]) => `${t}×${n}`).join(', '))
  await pag.close()
}
await nav.close()
