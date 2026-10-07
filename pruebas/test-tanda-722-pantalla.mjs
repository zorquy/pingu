// Tanda 722 — «Tu partida» siempre arriba, y debajo cómo vas (J2 de la
// lista de propuestas, elegida por PINGU).
//
// Casi todo J2 ya estaba: la pestaña Jugar se abre sola si estás jugando,
// tu mesa es un tablero (298), la barra viva va pegada arriba con el reloj
// y el chat se ve sin desplegar. Faltaba lo de debajo: tu fila de la
// clasificación sin tener que cambiar de pestaña. Lo que se mira: que salga
// en Jugar, debajo de tu mesa; que lleve al primero, a ti y a los de al
// lado —y no la tabla entera—; que tu fila diga «Tú» y vaya marcada; que la
// posición sea la MISMA que la de la tabla; y que el enlace lleve a ella.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const ahora = Date.now()

const TORNEO = {
  id: 'torneo-1', slug: 'pachanga', name: 'La Pachanga de Otoño', status: 'in_progress',
  description: 'Tres rondas suizas y corte a semifinales.',
  admin_id: 'admin-1', max_players: 16, swiss_rounds: 3, swiss_bo: 3, top_cut_size: 4, top_cut_bo: 3,
  round_time_minutes: 30, checkin_minutes: 5, is_official: true,
  start_at: new Date(ahora - 3600e3).toISOString(), current_round_id: 'ronda-2',
}
const GENTE = ['user-1', 'user-2', 'user-3', 'mod-1']
const INSCRIPCIONES = GENTE.map((u, i) => ({
  id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active',
  tcg_live_username: `TCG_${u}`, participation_confirmed_at: new Date(ahora - 7200e3).toISOString(),
}))
const RONDAS = [
  { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss' },
  { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: 'active', phase: 'swiss',
    started_at: new Date(ahora - 120e3).toISOString(), ends_at: new Date(ahora + 14 * 60000).toISOString() },
]
const MESAS = [
  { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2',
    status: 'active', check_in_a_at: new Date(ahora - 60e3).toISOString() },
  { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'finished' },
  { id: 'mesa-3', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-3', status: 'finished' },
  { id: 'mesa-4', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-2', player_b_id: 'mod-1', status: 'finished' },
]
const RESULTADOS = [
  { id: 'r1', match_id: 'mesa-2', result: 'a_wins', winner_id: 'user-3', score_a: 2, score_b: 1 },
  { id: 'r2', match_id: 'mesa-3', result: 'a_wins', winner_id: 'user-1', score_a: 2, score_b: 0 },
  { id: 'r3', match_id: 'mesa-4', result: 'b_wins', winner_id: 'mod-1', score_a: 0, score_b: 2 },
]
// Ash gana la 1.ª de su serie: la 2.ª es la que toca marcar.
const REPORTES = [
  { id: 'rep-1', match_id: 'mesa-1', reporter_id: 'user-1', result: 'win', game_number: 1 },
  { id: 'rep-2', match_id: 'mesa-1', reporter_id: 'user-2', result: 'loss', game_number: 1 },
]

const browser = await chromium.launch()
const abrir = async ({ sesion = 'user-1', ancho = 1280, torneo = TORNEO, rondas = RONDAS, mesas = MESAS, reportes = REPORTES } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, t, i, r, m, res, rep]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [t]
    window.__FAKE_INSCRIPCIONES__ = i
    window.__FAKE_RONDAS__ = r
    window.__FAKE_MESAS__ = m
    window.__FAKE_RESULTADOS__ = res
    window.__FAKE_REPORTES__ = rep
  }, [sesion, torneo, INSCRIPCIONES, rondas, mesas, RESULTADOS, reportes])
  await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const pestana = async (page, cual) => {
  const t = page.locator(`[data-pestana="${cual}"]`)
  if (!(await t.count())) return false
  await t.click()
  await page.waitForTimeout(600)
  return true
}


console.log('── 1. En Jugar, debajo de tu mesa ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('se abre en Jugar (estás jugando)', await page.locator('[data-panel="jugar"]').isVisible())
  const orden = await page.evaluate(() => {
    const a = document.getElementById('torneoMiPartida').getBoundingClientRect()
    const b = document.getElementById('torneoComoVas').getBoundingClientRect()
    return { mesa: !document.getElementById('torneoMiPartida').classList.contains('hidden'), vas: !document.getElementById('torneoComoVas').classList.contains('hidden'), debajo: b.top >= a.bottom - 1 }
  })
  check('«Cómo vas» sale, y debajo de «Tu partida»', orden.mesa && orden.vas && orden.debajo, JSON.stringify(orden))
  const filas = await page.$$eval('.torneo-como-vas li:not(.torneo-como-vas-salto)', (ls) => ls.map((l) => ({ pos: l.querySelector('.torneo-pos')?.textContent, nombre: l.querySelector('.torneo-como-vas-nombre')?.textContent, yo: l.classList.contains('torneo-fila-yo') && l.getAttribute('aria-current') === 'true', alto: l.getBoundingClientRect().height })))
  const mia = filas.find((f) => f.yo)
  check('tu fila dice «Tú» y va marcada', mia?.nombre === 'Tú', JSON.stringify(filas))
  check('el primero siempre está, y no más de cuatro filas', filas[0]?.pos === '1' && filas.length <= 4 && filas.length >= 2, JSON.stringify(filas))
  check('cada fila mide 44', filas.every((f) => f.alto >= 44))
  await page.click('[data-ir-pestana="clasificacion"]')
  await page.waitForTimeout(600)
  const enTabla = await page.$eval('tr.torneo-fila-yo .torneo-pos', (e) => e.textContent).catch(() => null)
  check('«Ver la clasificación entera» lleva a la tabla', await page.locator('[data-panel="clasificacion"]').isVisible())
  check('  …y tu puesto es el MISMO en las dos', enTabla === mia?.pos, `${enTabla} / ${mia?.pos}`)
  await page.close()
}

console.log('── 2. Sin cuenta, o sin puntos todavía, no sale ──')
{
  const { page } = await abrir({ sesion: 'none' })
  check('sin cuenta no hay «Cómo vas»', await page.evaluate(() => document.getElementById('torneoComoVas').classList.contains('hidden')))
  await page.close()
  const sinPuntos = await abrir({ mesas: MESAS.map((m) => ({ ...m, status: m.round_id === 'ronda-2' && m.id === 'mesa-1' ? 'active' : 'active' })) })
  check('sin ninguna mesa terminada, tampoco (no hay nada que contar)', await sinPuntos.page.evaluate(() => document.getElementById('torneoComoVas').classList.contains('hidden')))
  await sinPuntos.page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
