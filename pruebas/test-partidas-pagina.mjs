import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 230: /mis-partidas en el navegador. La cuenta se prueba aparte
// (test-partidas.mjs, sin pantalla); aquí se prueba lo que la página
// hace de más: juntar las partidas de los torneos con las apuntadas a
// mano, y no enseñar nada de un torneo cuyas listas aún no se pueden ver.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const MAZO_MIO = { pokemon: [{ quantity: 3, name: 'Dragapult ex', set: 'TWM', number: '130' }], trainer: [], energy: [] }
const MAZO_RIVAL = { pokemon: [{ quantity: 3, name: 'Gardevoir ex', set: 'SVI', number: '86' }], trainer: [], energy: [] }

const abrir = async (semillas = {}) => {
  const page = await browser.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = s.sesion ?? 'user-1'
    for (const [gancho, valor] of Object.entries(s.semillas || {})) window[gancho] = valor
  }, semillas)
  await page.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

const TORNEO_FIN = {
  id: 'torneo-1', slug: 'copa', name: 'Copa de Prueba', status: 'finished',
  admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, start_at: '2026-08-01T10:00:00Z',
  show_opponent_decklists: false,
}
const MESAS = [
  { id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' },
  { id: 'mesa-2', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' },
  // Un bye NO es un enfrentamiento y no puede contar.
  { id: 'mesa-3', round_id: 'ronda-1', table_number: 3, player_a_id: 'user-1', player_b_id: null, status: 'bye' },
]
const SEMILLA_TORNEO = {
  __FAKE_TORNEOS__: [TORNEO_FIN],
  __FAKE_RONDAS__: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'finished' }],
  __FAKE_MESAS__: MESAS,
  __FAKE_RESULTADOS__: [
    { id: 'r1', match_id: 'mesa-1', result: 'a_wins', winner_id: 'user-1' },
    { id: 'r2', match_id: 'mesa-2', result: 'b_wins', winner_id: 'user-2' },
    // Como en producción: ronda.js SÍ escribe un resultado para el bye.
    // Si el bye se contara como victoria, el porcentaje subiría solo.
    { id: 'r3', match_id: 'mesa-3', result: 'bye', winner_id: 'user-1' },
  ],
  __FAKE_DECKLISTS__: [
    { id: 'dk-1', tournament_id: 'torneo-1', user_id: 'user-1', parsed_cards: MAZO_MIO },
    { id: 'dk-2', tournament_id: 'torneo-1', user_id: 'user-2', parsed_cards: MAZO_RIVAL },
  ],
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las de torneo entran solas ──')
{
  const { page, errores } = await abrir({ semillas: SEMILLA_TORNEO })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  const resumen = await page.locator('#partidasResumen').innerText()
  // Dos mesas jugadas, una ganada y una perdida. El bye NO cuenta.
  check('cuenta 2 partidas, sin el bye', /\b2\b/.test(resumen) && !/\b3\b/.test(resumen), resumen.replace(/\n/g, ' | '))
  // Y el porcentaje tiene que ser 50%, no 67%: si el bye entrase como
  // victoria nadie lo notaría mirando el número de partidas.
  check('y el bye no infla el porcentaje', /50%/.test(resumen) && !/67%/.test(resumen), resumen.replace(/\n/g, ' | '))
  const matriz = await page.locator('.partidas-matriz').innerText()
  check('la fila es mi mazo', /Dragapult ex/.test(matriz), matriz.replace(/\n/g, ' | ').slice(0, 90))
  check('la columna es el del rival', /Gardevoir ex/.test(matriz), matriz.replace(/\n/g, ' | ').slice(0, 90))
  check('1-1 son el 50%', /50%/.test(matriz), matriz.replace(/\n/g, ' | ').slice(0, 90))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Un torneo con las listas aún cerradas NO cuenta ──')
{
  // Sin poder ver la lista del rival no se sabe a qué jugaba, y
  // adivinarlo sería inventar. La partida se queda fuera hasta que el
  // torneo termine — que es cuando la base deja leer las listas.
  const soloLaMia = {
    ...SEMILLA_TORNEO,
    __FAKE_TORNEOS__: [{ ...TORNEO_FIN, status: 'in_progress' }],
    __FAKE_DECKLISTS__: [{ id: 'dk-1', tournament_id: 'torneo-1', user_id: 'user-1', parsed_cards: MAZO_MIO }],
  }
  const { page } = await abrir({ semillas: soloLaMia })
  const cuerpo = await page.locator('#partidasMatriz').innerText()
  check('no se cuela ninguna partida', /Todavía no hay partidas/.test(cuerpo), cuerpo.slice(0, 80))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Las apuntadas a mano se suman a las de torneo ──')
{
  const { page } = await abrir({
    semillas: {
      ...SEMILLA_TORNEO,
      __FAKE_PARTIDAS__: [
        { id: 'm1', user_id: 'user-1', mi_mazo: 'd:dragapult ex', mi_mazo_nombre: 'Dragapult ex',
          rival_mazo: 'd:charizard', rival_mazo_nombre: 'Charizard', resultado: 'win', jugada_el: '2026-08-20', donde: 'TCG Live' },
      ],
    },
  })
  const resumen = await page.locator('#partidasResumen').innerText()
  check('ahora son 3 partidas', /\b3\b/.test(resumen), resumen.replace(/\n/g, ' | '))
  const matriz = await page.locator('.partidas-matriz').innerText()
  check('con su columna nueva', /Charizard/.test(matriz))
  // La clave es la misma («d:dragapult ex»), así que la apuntada a mano
  // tiene que caer en la MISMA fila, no abrir una segunda.
  const filas = await page.locator('.partidas-matriz tbody tr').count()
  check('y en la MISMA fila, no en una nueva', filas === 1, String(filas))
  const lista = await page.locator('#partidasLista').innerText()
  check('sale en «las últimas» con su sitio', /TCG Live/.test(lista))
  check('y las de torneo enlazan al torneo', (await page.locator('#partidasLista a[href*="/torneo?slug="]').count()) > 0)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Sin cuenta ──')
{
  const { page, errores } = await abrir({ sesion: 'none', semillas: SEMILLA_TORNEO })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  check('invita a entrar', await page.locator('#partidasSinCuenta').isVisible())
  check('y no enseña ninguna tabla', await page.locator('#partidasContenido').isHidden())
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Apuntar una a mano ──')
{
  const { page } = await abrir({ semillas: SEMILLA_TORNEO })
  await page.click('#btnApuntarPartida')
  await page.fill('#partidaMio', 'Dragapult ex')
  await page.fill('#partidaRival', 'Raging Bolt')
  await page.selectOption('#partidaResultado', 'loss')
  await page.click('#btnGuardarPartida')
  await page.waitForTimeout(1200)
  const matriz = await page.locator('.partidas-matriz').innerText()
  check('aparece en la matriz al momento', /Raging Bolt/.test(matriz), matriz.replace(/\n/g, ' | ').slice(0, 100))
  const escrito = await page.evaluate(() => (window.__TABLAS__.match_log || []).at(-1))
  check('se guarda con la clave, no solo el nombre', escrito?.mi_mazo === 'd:dragapult ex', JSON.stringify(escrito?.mi_mazo))
  check('y con el resultado que se eligió', escrito?.resultado === 'loss', escrito?.resultado)
  await page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS\n` : '\nTodo en verde\n')
process.exit(fails ? 1 : 0)
