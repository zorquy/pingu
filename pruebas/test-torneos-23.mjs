import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 230: las chapas de arquetipo en la ficha del torneo.
//
// Lo que de verdad se prueba aquí NO es que salgan, es CUÁNDO NO SALEN.
// La chapa se deduce de la decklist, así que enseñarla a mitad de un
// torneo de lista cerrada es contarle a alguien a qué juega su rival.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const MAZO = {
  pokemon: [
    { quantity: 3, name: 'Dragapult ex', set: 'TWM', number: '130' },
    { quantity: 4, name: 'Dreepy', set: 'TWM', number: '128' },
    { quantity: 2, name: 'Dusknoir', set: 'SFA', number: '20' },
  ],
  trainer: [],
  energy: [],
}
const OTRO = {
  pokemon: [
    { quantity: 3, name: 'Gardevoir ex', set: 'SVI', number: '86' },
    { quantity: 4, name: 'Ralts', set: 'SVI', number: '84' },
  ],
  trainer: [],
  energy: [],
}

const INSCRIPCIONES = [
  { id: 'ins-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'Ash' },
  { id: 'ins-2', tournament_id: 'torneo-1', user_id: 'user-2', status: 'active', tcg_live_username: 'Misty' },
]
const RONDAS = [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'finished' }]
const MESAS = [
  { id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' },
]
const RESULTADOS = [{ id: 'res-1', match_id: 'mesa-1', result: 'a_wins', winner_id: 'user-1' }]
const DECKLISTS = [
  { id: 'dk-1', tournament_id: 'torneo-1', user_id: 'user-1', parsed_cards: MAZO },
  { id: 'dk-2', tournament_id: 'torneo-1', user_id: 'user-2', parsed_cards: OTRO },
]

const abrir = async (semillas) => {
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = s.sesion
    window.__FAKE_TORNEOS__ = s.torneos
    window.__FAKE_INSCRIPCIONES__ = s.inscripciones
    window.__FAKE_RONDAS__ = s.rondas
    window.__FAKE_MESAS__ = s.mesas
    window.__FAKE_RESULTADOS__ = s.resultados
    window.__FAKE_DECKLISTS__ = s.decklists
    if (s.arquetipos) window.__FAKE_ARQUETIPOS__ = s.arquetipos
  }, semillas)
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores }
}

const TORNEO = {
  id: 'torneo-1', slug: 'copa', name: 'Copa', admin_id: 'admin-1',
  max_players: 8, swiss_rounds: 3,
}
const BASE_SEMILLA = {
  sesion: 'user-1', inscripciones: INSCRIPCIONES, rondas: RONDAS, mesas: MESAS,
  resultados: RESULTADOS, decklists: DECKLISTS,
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Torneo TERMINADO: las chapas salen ──')
{
  const { page, errores } = await abrir({
    ...BASE_SEMILLA,
    torneos: [{ ...TORNEO, status: 'finished', show_opponent_decklists: false }],
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const chapas = await page.locator('#clasificacionContenido .torneo-arquetipo').count()
  check('hay una chapa por jugador', chapas === 2, String(chapas))
  const etiquetas = await page.locator('#clasificacionContenido .torneo-arquetipo').evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label'))
  )
  // Sin catálogo se deduce, y NO puede llamarse por los básicos.
  check('deduce el mazo bien', etiquetas.some((e) => /Dragapult ex/.test(e || '')), JSON.stringify(etiquetas))
  check('sin nombrarlo por los básicos', !etiquetas.some((e) => /Dreepy|Ralts/.test(e || '')), JSON.stringify(etiquetas))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. EN JUEGO con lista CERRADA: no sale ninguna ──')
{
  const { page } = await abrir({
    ...BASE_SEMILLA,
    torneos: [{ ...TORNEO, status: 'in_progress', show_opponent_decklists: false }],
  })
  const chapas = await page.locator('.torneo-arquetipo').count()
  check('ni una chapa en toda la página', chapas === 0, String(chapas))
  const cuerpo = await page.locator('body').innerText()
  check('ni el nombre de ningún mazo suelto', !/Dragapult|Gardevoir/.test(cuerpo))
  check('ni el botón de ver la lista del rival', (await page.locator('[data-ver-lista]').count()) === 0)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. EN JUEGO con lista ABIERTA: sí salen ──')
{
  const { page } = await abrir({
    ...BASE_SEMILLA,
    torneos: [{ ...TORNEO, status: 'in_progress', show_opponent_decklists: true }],
  })
  check('vuelven las chapas', (await page.locator('#clasificacionContenido .torneo-arquetipo').count()) === 2)
  check('y el botón de ver la lista', (await page.locator('[data-ver-lista]').count()) > 0)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Con el catálogo puesto, manda el nombre curado ──')
{
  const { page } = await abrir({
    ...BASE_SEMILLA,
    torneos: [{ ...TORNEO, status: 'finished', show_opponent_decklists: false }],
    arquetipos: [
      {
        id: 'dragapult-dusknoir', nombre: 'Dragapult Dusknoir', activo: true,
        iconos: [{ set: 'TWM', numero: '130' }, { set: 'SFA', numero: '20' }],
        requiere: [{ nombres: ['Dragapult ex'] }, { nombres: ['Dusknoir'] }],
      },
    ],
  })
  const etiquetas = await page.locator('#clasificacionContenido .torneo-arquetipo').evaluateAll((els) =>
    els.map((e) => e.getAttribute('aria-label'))
  )
  check('sale el nombre del catálogo', etiquetas.includes('Dragapult Dusknoir'), JSON.stringify(etiquetas))
  // Y el que no casa sigue deducido, no desaparece.
  check('el que no casa sigue saliendo', etiquetas.some((e) => /Gardevoir/.test(e || '')), JSON.stringify(etiquetas))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Sin cuenta, en un torneo terminado ──')
{
  // El escaparate de la 229: un visitante ve la clasificación de un
  // torneo acabado, y con ella los arquetipos. Nada que esconder ya.
  const { page, errores } = await abrir({
    ...BASE_SEMILLA,
    sesion: 'none',
    torneos: [{ ...TORNEO, status: 'finished', show_opponent_decklists: false }],
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('el visitante también las ve', (await page.locator('#clasificacionContenido .torneo-arquetipo').count()) === 2)
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
