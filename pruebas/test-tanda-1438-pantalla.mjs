// Tandas 1438–1440 en la ficha — Torneos sin atascos.
//  1. Sin la migración: la ficha va por las consultas de siempre y con las
//     escuchas de siempre (nada se rompe antes de ejecutarla).
//  2. Con la migración: el ciclo llega por torneo_ciclo (ni rondas, ni mesas,
//     ni resultados, ni reportes sueltos) y se escucha el canal «torneo:<id>».
//  3. Un aviso con la fila dentro se pinta SIN ir a la base.
//  4. Un reporte de otra mesa no le cuesta nada a un espectador; uno de tu mesa
//     pide UNA consulta (torneo_ciclo).
//  5. Vencido el check-in con tu rival ausente, tu ficha cierra la mesa.
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
const browser = await chromium.launch()
const abrir = async ({ sesion = 'user-1', con = true, mesas = MESAS, rondas = RONDAS, ancho = 1280 } = {}) => {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, t, i, r, m, res, tab, ju, con]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = r; window.__FAKE_MESAS__ = m; window.__FAKE_RESULTADOS__ = res; window.__FAKE_REPORTES__ = []
    window.__FAKE_TABLON__ = tab; window.__FAKE_JUECES__ = ju
    if (con) window.__CON_1438__ = true
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, TORNEO, INSCRIPCIONES, rondas, mesas, RESULTADOS, TABLON, JUECES, con])
  await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.getByText('¡A jugar!').click({ timeout: 1000 }).catch(() => {})
  return { page, ctx, errores }
}
const consultas = (page) => page.evaluate(async () => { const m = await import('/js/supabase.js'); return { n: m.CONSULTAS.n, por: { ...m.CONSULTAS.porTabla }, rpc: [...(window.__RPC_1438__ || [])] } })

console.log('── 1. Sin la migración, como siempre ──')
{
  const { page, ctx, errores } = await abrir({ con: false })
  const c = await consultas(page)
  check('el ciclo va por las consultas sueltas', (c.por.tournament_matches || 0) >= 1 && (c.por.match_results || 0) >= 1, JSON.stringify(c.por))
  const v = await page.evaluate(() => ({ subs: window.__VIVO__.suscripciones.map((s) => s.nombre), canales: window.__VIVO__.canales.map((c) => c.tema) }))
  check('…y escucha como siempre (sin canal)', v.subs.some((n) => /^torneo-/.test(n)) && v.canales.length === 0, JSON.stringify(v))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2. Con la migración ──')
{
  const { page, ctx, errores } = await abrir()
  const c = await consultas(page)
  check('el ciclo llega por torneo_ciclo', c.rpc.includes('torneo_ciclo'), JSON.stringify(c.rpc))
  check('…sin pedir mesas, resultados ni reportes sueltos', !c.por.tournament_matches && !c.por.match_results && !c.por.match_reports, JSON.stringify(c.por))
  const v = await page.evaluate(() => ({ subs: window.__VIVO__.suscripciones.map((s) => s.nombre), canales: window.__VIVO__.canales.map((c) => c.tema) }))
  check('escucha el canal «torneo:torneo-1» y ningún postgres_changes del torneo', v.canales.includes('torneo:torneo-1') && !v.subs.some((n) => /^torneo-/.test(n)), JSON.stringify(v))

  console.log('\n── 3. Un aviso con la fila dentro se pinta sin ir a la base ──')
  await page.click('#torneoPestanas [data-pestana="rondas"]')
  await page.waitForTimeout(400)
  const antes = await consultas(page)
  const texto0 = await page.evaluate(() => document.querySelector('[data-panel="rondas"]')?.textContent.replace(/\s+/g, ' ') || '')
  // La mesa 1 (la del jugador) se cierra: llega la mesa y su resultado.
  await page.evaluate(() => {
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'tournament_matches', op: 'UPDATE', fila: { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' } })
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'match_results', op: 'INSERT', fila: { id: 'r9', match_id: 'mesa-1', result: 'a_wins', winner_id: 'user-1', score_a: 2, score_b: 0 } })
  })
  await page.waitForTimeout(700)
  const despues = await consultas(page)
  const texto1 = await page.evaluate(() => document.querySelector('[data-panel="rondas"]')?.textContent.replace(/\s+/g, ' ') || '')
  check('las mesas terminadas pasan de 1/2 a 2/2', /1\s*\/\s*2/.test(texto0) && /2\s*\/\s*2/.test(texto1), `${texto0.match(/\d\s*\/\s*\d[^·]{0,30}/)?.[0]} → ${texto1.match(/\d\s*\/\s*\d[^·]{0,30}/)?.[0]}`)
  check('…sin una sola consulta', despues.n === antes.n && despues.rpc.length === antes.rpc.length, `${antes.n} → ${despues.n}`)

  console.log('\n── 4. Los reportes ──')
  await page.evaluate(() => window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'match_reports', op: 'INSERT', fila: { match_id: 'mesa-2' } }))
  await page.waitForTimeout(3000)
  const tras = await consultas(page)
  check('un reporte de otra mesa no le cuesta nada a quien no la juega', tras.n === despues.n && tras.rpc.length === despues.rpc.length, `${despues.rpc.length} → ${tras.rpc.length}`)
  await page.evaluate(() => window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'match_reports', op: 'INSERT', fila: { match_id: 'mesa-1' } }))
  await page.waitForTimeout(3000)
  const tras2 = await consultas(page)
  check('uno de tu mesa pide UNA consulta (torneo_ciclo)', tras2.rpc.length === tras.rpc.length + 1 && tras2.rpc.at(-1) === 'torneo_ciclo', JSON.stringify(tras2.rpc.slice(-2)))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 5. Sin check-in del rival, la mesa se cierra sola ──')
{
  const ahoraT = Date.now()
  const rondas = RONDAS.map((r) => (r.id === 'ronda-2' ? { ...r, started_at: new Date(ahoraT - 7 * 60000).toISOString() } : r))
  const mesas = MESAS.map((m) => (m.id === 'mesa-1' ? { ...m, check_in_b_at: null } : m))
  const { page, ctx, errores } = await abrir({ rondas, mesas })
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => ({ rpc: [...(window.__RPC_1438__ || [])], estado: window.__TABLAS__.tournament_matches.find((m) => m.id === 'mesa-1')?.status }))
  check('la ficha pide torneos_reclamar_ausencia', r.rpc.includes('torneos_reclamar_ausencia'), JSON.stringify(r.rpc))
  check('…y la mesa queda en forfeit_b (gana quien vino)', r.estado === 'forfeit_b', r.estado)
  const hoy = await page.evaluate(() => document.getElementById('torneoMiPartida')?.textContent.replace(/\s+/g, ' ') || '')
  check('tu mesa ya no pide reportar', !/Victoria\s*Derrota/.test(hoy), hoy.slice(0, 200))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
