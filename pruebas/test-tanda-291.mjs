// Tanda 291: el mejor de tres, partida a partida.
//
// PINGU, tras arbitrar un BO3 a tres rondas: jugando al mejor de tres lo
// que la gente tiene delante es LA PARTIDA que acaba de terminar, no el
// resultado final echando la cuenta de cabeza. Y con dos ganadas, la
// tercera no se juega y no se debería poder votar.
//
// Y la decisión sobre deshacer: mientras el rival no haya contestado,
// cambiar tu parte no es deshacer nada — es enmendarlo antes de que
// valga. En cuanto los dos coincidís, esa partida queda cerrada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { serieBo3, juegoAbierto } from '/home/user/pingu/js/torneos/motor.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 150) : ''}`)
}

console.log('\n── 1. La serie, sin navegador ──')
{
  const s = (j) => serieBo3(j)
  check('sin nada, toca la 1.ª', s({}).siguiente === 1 && !s({}).decidida)
  check('ganada la 1.ª, toca la 2.ª', s({ 1: 'a_wins' }).siguiente === 2)
  // Lo que pidió PINGU: con dos ganadas se acabó.
  const dosCero = s({ 1: 'a_wins', 2: 'a_wins' })
  check('con dos ganadas la serie está decidida', dosCero.decidida && dosCero.result === 'a_wins')
  check('y NO hay tercera', dosCero.siguiente === null)
  check('1-1 abre la tercera', s({ 1: 'a_wins', 2: 'b_wins' }).siguiente === 3)
  check('y la tercera la decide', s({ 1: 'a_wins', 2: 'b_wins', 3: 'b_wins' }).result === 'b_wins')
  // Tablas: tres jugadas sin que nadie llegue a dos es empate de serie.
  check('1-1 y tablas es empate', s({ 1: 'a_wins', 2: 'b_wins', 3: 'draw' }).result === 'draw')
  check('tres tablas también', s({ 1: 'draw', 2: 'draw', 3: 'draw' }).result === 'draw')

  check('la 3.ª está cerrada tras un 2-0', !juegoAbierto({ 1: 'a_wins', 2: 'a_wins' }, 3))
  check('no se puede saltar la 2.ª', !juegoAbierto({ 1: 'a_wins' }, 3))
  check('pero la 2.ª sí está abierta', juegoAbierto({ 1: 'a_wins' }, 2))
  check('ni se repite una ya jugada', !juegoAbierto({ 1: 'a_wins' }, 1))
}

const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const TORNEO = {
  id: 'torneo-1', slug: 'copa', name: 'Copa de Prueba', status: 'in_progress',
  admin_id: 'admin-1', max_players: 8, swiss_rounds: 3, swiss_bo: 3, top_cut_bo: 3,
}
const INSCRIPCIONES = [
  { id: 'ins-1', tournament_id: 'torneo-1', user_id: 'user-1', status: 'active', tcg_live_username: 'AshKetchum' },
  { id: 'ins-2', tournament_id: 'torneo-1', user_id: 'user-2', status: 'active', tcg_live_username: 'MistyW' },
]
const RONDAS = [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'active', ends_at: null }]
const MESAS = [{
  id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2',
  status: 'active', check_in_a_at: new Date().toISOString(), check_in_b_at: new Date().toISOString(),
}]

const abrir = async (semillas = {}) => {
  const page = await browser.newPage({ viewport: { width: 1150, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [s.torneo]
    window.__FAKE_INSCRIPCIONES__ = s.inscripciones
    window.__FAKE_RONDAS__ = s.rondas
    window.__FAKE_MESAS__ = s.mesas
    if (s.reportes) window.__FAKE_REPORTES__ = s.reportes
    window.__RPC_RESPUESTAS__ = { torneos_reportar: 'esperando', torneos_desreportar: 'retirado' }
  }, { torneo: TORNEO, inscripciones: INSCRIPCIONES, rondas: RONDAS, mesas: MESAS, ...semillas })
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

const rep = (juego, quien, resultado) => ({
  id: `rep-${quien}-${juego}`, match_id: 'mesa-1', reporter_id: quien, result: resultado, game_number: juego,
})

console.log('\n── 2. En BO3 hay TRES partidas que marcar ──')
{
  const { page, errores } = await abrir({ reportes: [] })
  const filas = page.locator('.torneo-bo3-juego')
  check('tres filas', (await filas.count()) === 3, String(await filas.count()))
  check('numeradas', (await filas.nth(0).locator('.torneo-bo3-n').textContent())?.includes('1'))
  // Solo la primera se puede marcar: no tiene sentido votar la tercera
  // antes que la segunda.
  check('solo la 1.ª tiene botones', (await filas.nth(0).locator('[data-reporte]').count()) === 3 && (await filas.nth(1).locator('[data-reporte]').count()) === 0)
  check('las otras esperan', (await filas.nth(1).textContent())?.includes('Pendiente'))
  check('y se ve el marcador', (await page.locator('.torneo-bo3-cab .torneo-chapa').textContent())?.includes('0-0'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Marcar una partida manda su NÚMERO ──')
{
  const { page } = await abrir({ reportes: [] })
  await page.locator('.torneo-bo3-juego').first().locator('[data-reporte="win"]').click()
  await page.waitForTimeout(500)
  const llamadas = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_reportar'))
  check('se llama a la RPC', llamadas.length === 1, JSON.stringify(llamadas))
  check('con el resultado', llamadas[0]?.args?.p_resultado === 'win')
  // Sin esto el parte se apuntaría como resultado del MATCH entero.
  check('y con el número de partida', llamadas[0]?.args?.p_juego === 1, JSON.stringify(llamadas[0]?.args))
  await page.close()
}

console.log('\n── 4. Con 2-0, la tercera NO se juega ──')
{
  const { page } = await abrir({
    reportes: [
      rep(1, 'user-1', 'win'), rep(1, 'user-2', 'loss'),
      rep(2, 'user-1', 'win'), rep(2, 'user-2', 'loss'),
    ],
  })
  const filas = page.locator('.torneo-bo3-juego')
  check('las dos primeras, cerradas', (await filas.nth(0).textContent())?.includes('ganaste') && (await filas.nth(1).textContent())?.includes('ganaste'))
  check('la tercera dice que no se juega', (await filas.nth(2).textContent())?.includes('No se juega'), await filas.nth(2).textContent())
  // Esto es lo que pidió PINGU: que no se pueda votar la tercera.
  check('y no tiene botones', (await filas.nth(2).locator('[data-reporte]').count()) === 0)
  check('el marcador dice 2-0', (await page.locator('.torneo-bo3-cab .torneo-chapa').textContent())?.includes('2-0'))
  await page.close()
}

console.log('\n── 4b. El 1-1: la tercera SÍ se juega ──')
{
  // El caso más común de un BO3, y el que destapa si los partes de una
  // partida se cuelan en otra: aquí la 1.ª la ganas y la 2.ª la pierdes.
  const { page } = await abrir({
    reportes: [
      rep(1, 'user-1', 'win'), rep(1, 'user-2', 'loss'),
      rep(2, 'user-1', 'loss'), rep(2, 'user-2', 'win'),
    ],
  })
  const filas = page.locator('.torneo-bo3-juego')
  check('la 1.ª, ganada', (await filas.nth(0).textContent())?.includes('La ganaste'), await filas.nth(0).textContent())
  check('la 2.ª, perdida', (await filas.nth(1).textContent())?.includes('La perdiste'), await filas.nth(1).textContent())
  check('y la 3.ª abierta', (await filas.nth(2).locator('[data-reporte]').count()) === 3)
  check('con el marcador a 1-1', (await page.locator('.torneo-bo3-cab .torneo-chapa').textContent())?.includes('1-1'))
  await page.close()
}

console.log('\n── 5. Tu parte se puede cambiar hasta que el rival conteste ──')
{
  const { page } = await abrir({ reportes: [rep(1, 'user-1', 'win')] })
  const primera = page.locator('.torneo-bo3-juego').first()
  check('se ve lo que has dicho', (await primera.textContent())?.includes('Victoria'), await primera.textContent())
  check('y que falta el rival', (await primera.textContent())?.includes('falta tu rival'))
  check('con botón para cambiarlo', (await primera.locator('[data-quitar]').count()) === 1)
  await primera.locator('[data-quitar]').click()
  await page.waitForTimeout(500)
  const llamadas = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_desreportar'))
  check('que llama a retirar el parte', llamadas.length === 1 && llamadas[0].args.p_juego === 1, JSON.stringify(llamadas))
  await page.close()
}

console.log('\n── 6. Una vez acordada, esa partida ya no se toca ──')
{
  // Lo acordado por los dos lo corrige un juez, no un jugador.
  const { page } = await abrir({ reportes: [rep(1, 'user-1', 'win'), rep(1, 'user-2', 'loss')] })
  const primera = page.locator('.torneo-bo3-juego').first()
  check('la fila queda cerrada', (await primera.textContent())?.includes('ganaste'))
  check('sin botón de cambiar', (await primera.locator('[data-quitar]').count()) === 0)
  check('y sin botones de resultado', (await primera.locator('[data-reporte]').count()) === 0)
  // Y la siguiente se abre sola.
  check('la 2.ª se abre', (await page.locator('.torneo-bo3-juego').nth(1).locator('[data-reporte]').count()) === 3)
  await page.close()
}

console.log('\n── 7. Un BO1 sigue como estaba ──')
{
  const { page } = await abrir({ torneo: { ...TORNEO, swiss_bo: 1 }, reportes: [] })
  check('no hay desglose por partidas', (await page.locator('.torneo-bo3-juego').count()) === 0)
  check('sino los botones de siempre', (await page.locator('[data-reporte]').count()) === 2)
  // En un BO1 el parte es del match entero: número de partida 0.
  await page.locator('[data-reporte="win"]').first().click()
  await page.waitForTimeout(500)
  const llamadas = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_reportar'))
  check('y va como resultado del match', llamadas[0]?.args?.p_juego === 0, JSON.stringify(llamadas[0]?.args))
  await page.close()
}

console.log('\n── 8. La migración ──')
{
  const sql = readFileSync('/home/user/pingu/supabase-migration-torneos-bo3.sql', 'utf8')
  check('añade la columna', /add column if not exists game_number/.test(sql))
  check('con su límite de 0 a 3', /game_number between 0 and 3/.test(sql))
  // El candado viejo era «un parte por persona y mesa»: con él, la 2.ª
  // partida de un BO3 chocaría con la 1.ª.
  check('y el candado pasa a ser por partida', /unique index[\s\S]*?\(match_id, reporter_id, game_number\)/.test(sql))
  check('quitando el de antes', /drop constraint if exists match_reports_match_id_reporter_id_key/.test(sql))
  // `create or replace` con otra firma NO reemplaza: crea una sobrecarga,
  // y con el parámetro por defecto la llamada quedaría ambigua.
  check('se quita la RPC vieja, no se deja al lado', /drop function if exists public\.torneos_reportar\(uuid, text\)/.test(sql))
  check('y se puede retirar el propio parte', /create or replace function public\.torneos_desreportar/.test(sql))
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
