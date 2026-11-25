// Tanda 1437 — el respaldo sin estampida y la recarga ligera (propuesta
// «Torneos sin atascos»: en el Tardeo de Testeo, con la base saturada, el
// tiempo real se cayó y TODAS las fichas pasaron a pedirlo todo cada 10 s).
//
//  1. `esperaEscalonada` (pura): 15, 20, 30 s y se queda en 30; con el vivo,
//     un minuto; el azar mueve ±25 %.
//  2. La ficha usa el sondeo escalonado.
//  3. Un aviso en vivo trae una recarga LIGERA: sin jueces, sin listas y sin
//     perfiles (nadie nuevo); las mesas, sí.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const ahora = Date.now()

const TORNEO = {
  id: 'torneo-1', slug: 'pachanga', name: 'Liga PokeDoc · Jornada 4', status: 'in_progress',
  admin_id: 'user-3', max_players: 16, swiss_rounds: 3, swiss_bo: 3, top_cut_size: 4, top_cut_bo: 3,
  round_time_minutes: 30, checkin_minutes: 5, is_official: true,
  start_at: new Date(ahora - 3600e3).toISOString(), current_round_id: 'ronda-2',
}
const GENTE = ['user-1', 'user-2', 'user-3', 'mod-1']
const INSCRIPCIONES = GENTE.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}`, participation_confirmed_at: new Date(ahora - 7200e3).toISOString() }))
const RONDAS = [
  { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: new Date(ahora - 4000e3).toISOString() },
  { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: 'active', phase: 'swiss', started_at: new Date(ahora - 120e3).toISOString(), ends_at: new Date(ahora + 14 * 60000).toISOString() },
]
const MESAS = [
  { id: 'mesa-3', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-3', status: 'finished' },
  { id: 'mesa-4', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-2', player_b_id: 'mod-1', status: 'finished' },
  { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'active', check_in_a_at: new Date(ahora - 60e3).toISOString(), check_in_b_at: new Date(ahora - 50e3).toISOString() },
  { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'finished' },
]
const RESULTADOS = [
  { id: 'r1', match_id: 'mesa-2', result: 'a_wins', winner_id: 'user-3', score_a: 2, score_b: 1 },
  { id: 'r2', match_id: 'mesa-3', result: 'a_wins', winner_id: 'user-1', score_a: 2, score_b: 0 },
  { id: 'r3', match_id: 'mesa-4', result: 'b_wins', winner_id: 'mod-1', score_a: 0, score_b: 2 },
]
const h = (min) => new Date(ahora - min * 60000).toISOString()
const TABLON = [
  { id: 'a1', tournament_id: 'torneo-1', author_id: 'user-3', kind: 'aviso', body: 'Esperamos 5 minutos a la mesa 1, que se le ha caído TCG Live.', created_at: h(2) },
  { id: 'a2', tournament_id: 'torneo-1', author_id: null, kind: 'auto', body: 'Ronda 2 en marcha · pareos publicados · 2 mesas · 30 min', created_at: h(20) },
  { id: 'a3', tournament_id: 'torneo-1', author_id: null, kind: 'auto', body: 'Ronda 1 cerrada · 2 mesas', created_at: h(22) },
  { id: 'a4', tournament_id: 'torneo-1', author_id: 'mod-1', kind: 'aviso', body: 'Recordad: el reporte lo hace el que gana.', created_at: h(26) },
  { id: 'a5', tournament_id: 'torneo-1', author_id: null, kind: 'auto', body: 'Ronda 1 en marcha · pareos publicados · 2 mesas · 30 min', created_at: h(50) },
  { id: 'a6', tournament_id: 'torneo-1', author_id: 'user-3', kind: 'aviso', body: 'Bienvenidos a la jornada 4.', created_at: h(55) },
]
const JUECES = [{ id: 'j1', tournament_id: 'torneo-1', user_id: 'mod-1', status: 'approved' }]
console.log('── 1. Los escalones ──')
{
  const { esperaEscalonada } = await import(`${RAIZ}/js/sondeo.js`)
  const fijo = { aleatorio: () => 0.5 }
  const pasos = [0, 1, 2, 3, 7].map((p) => esperaEscalonada(p, fijo))
  check('sin vivo: 15, 20, 30 s y se queda en 30', pasos.join() === '15000,20000,30000,30000,30000', pasos.join())
  check('con el vivo: un minuto', esperaEscalonada(0, { ...fijo, vivo: true }) === 60000)
  const min = esperaEscalonada(0, { aleatorio: () => 0 }), max = esperaEscalonada(0, { aleatorio: () => 0.999999 })
  check('el azar mueve ±25 % (11,25–18,75 s en el primer escalón)', min === 11250 && max >= 18749 && max <= 18750, `${min} ${max}`)
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
await page.addInitScript(([s, t, i, r, m, res, tab, ju]) => {
  window.__FAKE_SESSION__ = s
  window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = r; window.__FAKE_MESAS__ = m; window.__FAKE_RESULTADOS__ = res; window.__FAKE_REPORTES__ = []
  window.__FAKE_TABLON__ = tab; window.__FAKE_JUECES__ = ju
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
}, ['user-3', TORNEO, INSCRIPCIONES, RONDAS, MESAS, RESULTADOS, TABLON, JUECES])
await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(3000)

console.log('\n── 2. La ficha usa el escalonado ──')
const sondeo = await page.evaluate(() => (window.__VIVO__?.sondeos || []).map((s) => s.__estado))
check('la ficha monta UN sondeo escalonado', sondeo.length === 1 && sondeo[0].escalonado === true, JSON.stringify(sondeo))
check('con el vivo conectado espera un minuto', sondeo[0]?.ms === 60000, JSON.stringify(sondeo))
await page.evaluate(() => window.__VIVO__.estado(false))
await page.waitForTimeout(100)
const caido = await page.evaluate(() => window.__VIVO__.sondeos[0].__estado)
check('si el vivo se cae, empieza por 15 s (no por 10)', caido.ms === 15000 && caido.paso === 0, JSON.stringify(caido))
await page.evaluate(() => window.__VIVO__.estado(true))

console.log('\n── 3. Un aviso en vivo trae una recarga ligera ──')
const antes = await page.evaluate(async () => { const m = await import('/js/supabase.js'); return { ...m.CONSULTAS.porTabla } })
await page.evaluate(() => window.__VIVO__.emitir(null, { table: 'tournament_matches', new: {} }))
await page.waitForTimeout(8500)
const despues = await page.evaluate(async () => { const m = await import('/js/supabase.js'); return { ...m.CONSULTAS.porTabla } })
const dif = Object.fromEntries(Object.entries(despues).map(([k, v]) => [k, v - (antes[k] || 0)]).filter(([, v]) => v > 0))
check('la recarga llegó (pidió las mesas)', (dif.tournament_matches || 0) >= 1, JSON.stringify(dif))
check('…sin pedir jueces, listas ni perfiles', !dif.judge_applications && !dif.tournament_decklists && !dif.user_profiles, JSON.stringify(dif))
check('…y sí las inscripciones (las bajas, 1436)', (dif.tournament_registrations || 0) >= 1, JSON.stringify(dif))
check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
