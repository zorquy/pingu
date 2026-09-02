import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const nav = await chromium.launch()

const partidas = []
const mundo = [
  ['Dragapult', [['Gardevoir', 4, 1], ['Charizard', 2, 3], ['Raging Bolt', 5, 0], ['Lugia', 1, 2], ['Gholdengo', 3, 3], ['Lost Box', 0, 2]]],
  ['Gardevoir', [['Dragapult', 2, 2], ['Snorlax', 3, 0], ['Miraidon', 1, 1]]],
]
let n = 0
for (const [mio, contra] of mundo)
  for (const [rival, v, d] of contra)
    for (let i = 0; i < v + d; i++)
      partidas.push({ id: `p-${n++}`, user_id: 'admin-1', mi_mazo: `d:${mio.toLowerCase()}`, mi_mazo_nombre: mio,
        rival_mazo: `d:${rival.toLowerCase()}`, rival_mazo_nombre: rival, resultado: i < v ? 'win' : 'loss',
        tipo: 'normal', donde: 'Escalera', jugada_el: '2026-08-30' })

for (const [tema, ancho, nombre] of [['light', 900, 'stats-claro'], ['dark', 900, 'stats-oscuro'], ['light', 380, 'stats-movil']]) {
  const pag = await (await nav.newContext({ viewport: { width: ancho, height: 900 }, colorScheme: tema })).newPage()
  await pag.addInitScript((p) => { window.__FAKE_SESSION__ = 'admin-1'; window.__FAKE_PARTIDAS__ = p }, partidas)
  await pag.goto('http://localhost:8892/mis-partidas', { waitUntil: 'domcontentloaded' })
  await pag.waitForTimeout(2400)
  await pag.locator('[data-vista="stats"]').click()
  await pag.waitForTimeout(700)
  await pag.screenshot({ path: `${SC}/${nombre}.png`, fullPage: true })
  console.log('pintado', nombre)
  await pag.close()
}
await nav.close()
