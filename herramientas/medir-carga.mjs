import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const b = await chromium.launch()
const page = await b.newPage()
await page.addInitScript(() => {
  window.__FAKE_TORNEOS__ = [{ slug: 'medir', name: 'Copa Medida', status: 'in_progress', max_players: 32, swiss_rounds: 5 }]
  window.__FAKE_INSCRIPCIONES__ = Array.from({ length: 16 }, (_, i) => ({
    id: `i-${i}`, tournament_id: 'torneo-1', user_id: i === 0 ? 'admin-1' : `user-${(i % 3) + 1}`,
    status: 'active', tcg_live_username: `TCG_${i}`,
  }))
  window.__FAKE_RONDAS__ = [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'active' }]
  window.__FAKE_MESAS__ = Array.from({ length: 8 }, (_, i) => ({
    id: `mesa-${i}`, round_id: 'ronda-1', table_number: i + 1,
    player_a_id: 'admin-1', player_b_id: 'user-1', status: 'active',
  }))
  // El hilo del torneo TIENE que existir en la semilla: si no, la ficha
  // lo busca en cada refresco pase lo que pase (no hay nada que
  // memorizar) y la medición no puede ver si el memorizado funciona.
  // Un torneo de verdad, anunciado, es el caso normal.
  window.__FAKE_TEMAS__ = [{ id: 'tema-1', board_id: 'foro-1', title: 'Torneo: Copa Medida', author_id: 'admin-1' }]
})
await page.goto('http://localhost:8892/torneo?slug=medir', { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3500)
const carga = await page.evaluate(() => ({ ...window.__CONSULTAS__, porTabla: { ...window.__CONSULTAS__.porTabla } }))
console.log('Carga inicial de la ficha:', carga.n, 'consultas')

// Ahora se deja pasar UN ciclo del refresco automático. Desde la tanda
// 227 el sondeo lo lleva sondeoAdaptable: con el tiempo real conectado
// baja a marcha larga (10 s x6 = 60 s), así que hay que esperar de más
// o no se mide nada.
await page.evaluate(() => { window.__CONSULTAS__.n = 0; window.__CONSULTAS__.porTabla = {} })
await page.waitForTimeout(65000)
const ciclo = await page.evaluate(() => ({ ...window.__CONSULTAS__, porTabla: { ...window.__CONSULTAS__.porTabla } }))
console.log('Cada refresco:', ciclo.n, 'consultas')
console.log('  reparto:', JSON.stringify(ciclo.porTabla))
console.log()
for (const gente of [16, 32, 64]) {
  console.log(`  ${gente} personas con la ficha abierta → ${((ciclo.n * gente) / 10).toFixed(1)} consultas/segundo sostenidas`)
}
await b.close()
