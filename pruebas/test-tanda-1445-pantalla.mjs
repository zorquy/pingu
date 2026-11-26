// Tanda 1445 — Sin recargar. PINGU: «cuando pasaban los 5 minutos de check-in
// […] se daba la victoria, pero solo si recargabas la página. Debería ser
// automático. Y había más problemas de este tipo de recarga de página».
//
// Todo con la ficha ABIERTA desde antes y sin recargar:
//  1. Vence el check-in con el rival ausente: la ficha de quien vino cierra la
//     mesa sola y se ve.
//  2. Lo mismo desde la ficha del AUSENTE (quien vino tiene el móvil bloqueado).
//  3. Desde la del ORGANIZADOR, que no juega esa mesa: cierra todas las que
//     tocan (una con un ausente, otra con los dos).
//  4. Lo que llega por el canal se ve sin recargar: el check-in del rival, su
//     resultado, la ronda nueva con tu mesa nueva, el tablón y el final.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const GENTE = ['user-1', 'user-2', 'user-3', 'mod-1']
const PERFILES = [{ id: 'user-2', username: 'Rival', display_name: 'Rival' }, { id: 'user-3', username: 'Orga', display_name: 'Orga' }, { id: 'mod-1', username: 'Misty', display_name: 'Misty' }]

// La ronda 2 empezó hace 5 min menos `quedan` segundos: el check-in vence en `quedan` s.
function datos({ quedan = 6, mesa1 = {}, mesa2 = {} } = {}) {
  const ahora = Date.now()
  const iso = (ms) => new Date(ahora + ms).toISOString()
  return {
    torneo: { id: 'torneo-1', slug: 'tardeo', name: 'Tardeo de Testeo', status: 'in_progress', admin_id: 'user-3', max_players: 16, swiss_rounds: 3, swiss_bo: 1, top_cut_size: 0, round_time_minutes: 30, checkin_minutes: 5, start_at: iso(-3600e3), current_round_id: 'ronda-2' },
    inscripciones: GENTE.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}`, participation_confirmed_at: iso(-7200e3) })),
    rondas: [
      { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: iso(-4000e3) },
      { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: 'active', phase: 'swiss', started_at: iso(-(5 * 60e3 - quedan * 1000)) },
    ],
    mesas: [
      { id: 'mesa-3', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-3', status: 'finished' },
      { id: 'mesa-4', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-2', player_b_id: 'mod-1', status: 'finished' },
      { id: 'mesa-1', round_id: 'ronda-2', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'active', check_in_a_at: iso(-60e3), check_in_b_at: null, ...mesa1 },
      { id: 'mesa-2', round_id: 'ronda-2', table_number: 2, player_a_id: 'user-3', player_b_id: 'mod-1', status: 'active', check_in_a_at: iso(-60e3), check_in_b_at: iso(-50e3), ...mesa2 },
    ],
    resultados: [
      { id: 'r2', match_id: 'mesa-3', result: 'a_wins', winner_id: 'user-1' },
      { id: 'r3', match_id: 'mesa-4', result: 'b_wins', winner_id: 'mod-1' },
    ],
  }
}

const browser = await chromium.launch()
async function abrir(sesion, d) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, d, perfiles]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [d.torneo]; window.__FAKE_INSCRIPCIONES__ = d.inscripciones; window.__FAKE_RONDAS__ = d.rondas
    window.__FAKE_MESAS__ = d.mesas; window.__FAKE_RESULTADOS__ = d.resultados; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = []; window.__FAKE_JUECES__ = []
    window.__FAKE_PERFILES__ = perfiles
    window.__CON_1438__ = true
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, d, PERFILES])
  await page.goto(`${BASE}/torneo?slug=tardeo`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((x) => x.close()))
  return { page, ctx, errores }
}
const estado = (page, id) => page.evaluate((id) => window.__TABLAS__.tournament_matches.find((m) => m.id === id)?.status, id)
const miMesa = (page) => page.evaluate(() => document.getElementById('torneoMiPartida')?.textContent.replace(/\s+/g, ' ') || '')
const consultasDeRecarga = (page) => page.evaluate(async () => (await import('/js/supabase.js')).CONSULTAS.n)

console.log('── 1. Vence el check-in con la ficha de quien vino abierta ──')
{
  const { page, ctx, errores } = await abrir('user-1', datos({ quedan: 6 }))
  const antes = await miMesa(page)
  check('antes del plazo: la mesa sigue abierta, «Check-in pendiente» del rival', (await estado(page, 'mesa-1')) === 'active' && /Check-in pendiente/.test(antes), antes.slice(0, 160))
  await page.waitForTimeout(8000)
  const despues = await miMesa(page)
  check('pasado el plazo, SIN recargar: la mesa se cierra (forfeit_b, gana quien vino)', (await estado(page, 'mesa-1')) === 'forfeit_b')
  check('…y se ve: ya no pide check-in ni reportar', !/Check-in pendiente|Hacer check-in/.test(despues) && !/Victoria\s*Derrota/.test(despues), despues.slice(0, 200))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2. Desde la ficha del que NO vino ──')
{
  const { page, ctx, errores } = await abrir('user-2', datos({ quedan: 5 }))
  await page.waitForTimeout(8000)
  check('su ficha también la cierra: forfeit_b (gana el que vino)', (await estado(page, 'mesa-1')) === 'forfeit_b')
  const t = await miMesa(page)
  check('…y deja de pedirle el check-in', !/Hacer check-in/.test(t), t.slice(0, 200))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. Desde la ficha del organizador ──')
{
  // El organizador (user-3) juega la mesa 2, pero aquí la 2 tiene los dos check-ins
  // sin hacer y la 1 (que no juega) uno: cierra las dos.
  const { page, ctx, errores } = await abrir('user-3', datos({ quedan: 5, mesa2: { check_in_a_at: null, check_in_b_at: null } }))
  await page.waitForTimeout(8000)
  const [e1, e2] = [await estado(page, 'mesa-1'), await estado(page, 'mesa-2')]
  check('cierra la mesa que no juega (forfeit_b) y la de los dos ausentes (forfeit_both)', e1 === 'forfeit_b' && e2 === 'forfeit_both', `${e1} ${e2}`)
  const rpc = await page.evaluate(() => (window.__RPC_1438__ || []).filter((x) => x === 'torneos_reclamar_ausencia').length)
  check('una llamada por mesa, no una por segundo', rpc === 2, String(rpc))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 4. Lo que llega por el canal, sin recargar ──')
{
  const { page, ctx, errores } = await abrir('user-1', datos({ quedan: 120 }))
  const n0 = await consultasDeRecarga(page)
  // El rival hace check-in.
  await page.evaluate(() => {
    const m = window.__TABLAS__.tournament_matches.find((x) => x.id === 'mesa-1')
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'tournament_matches', op: 'UPDATE', fila: { ...m, check_in_b_at: new Date().toISOString() } })
  })
  await page.waitForTimeout(800)
  let t = await miMesa(page)
  check('el check-in del rival se ve al momento', !/Check-in pendiente/.test(t), t.slice(0, 200))
  // El rival reporta y el juez lo resuelve: llega la mesa cerrada y su resultado.
  await page.evaluate(() => {
    const m = window.__TABLAS__.tournament_matches.find((x) => x.id === 'mesa-1')
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'tournament_matches', op: 'UPDATE', fila: { ...m, check_in_b_at: new Date().toISOString(), status: 'finished' } })
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'match_results', op: 'INSERT', fila: { id: 'r9', match_id: 'mesa-1', result: 'b_wins', winner_id: 'user-2' } })
  })
  await page.waitForTimeout(800)
  t = await miMesa(page)
  check('el resultado de tu mesa se ve al momento', !/Victoria\s*Derrota/.test(t) && !/Check-in/.test(t), t.slice(0, 200))
  // La ronda 3: la ronda, tu mesa nueva y el torneo apuntando a ella.
  await page.evaluate(() => {
    const ya = new Date().toISOString()
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'rounds', op: 'UPDATE', fila: { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: 'finished', phase: 'swiss', started_at: ya } })
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'rounds', op: 'INSERT', fila: { id: 'ronda-3', tournament_id: 'torneo-1', round_number: 3, status: 'active', phase: 'swiss', started_at: ya } })
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'tournament_matches', op: 'INSERT', fila: { id: 'mesa-9', round_id: 'ronda-3', table_number: 1, player_a_id: 'user-1', player_b_id: 'mod-1', status: 'active', check_in_a_at: null, check_in_b_at: null } })
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'tournaments', op: 'UPDATE', fila: { id: 'torneo-1', status: 'in_progress', current_round_id: 'ronda-3' } })
  })
  await page.waitForTimeout(1200)
  t = await miMesa(page)
  check('la ronda nueva y tu mesa nueva (contra Misty) se ven al momento', /Misty/.test(t) && /Hacer check-in/.test(t), t.slice(0, 220))
  const cab = await page.evaluate(() => document.querySelector('.torneo-cabecera, #torneoCabecera, header')?.textContent.replace(/\s+/g, ' ') || '')
  check('…y la cabecera dice ronda 3', /3\s*\/\s*3|[Rr]onda 3/.test(cab), cab.slice(0, 200))
  const n1 = await consultasDeRecarga(page)
  check('todo eso sin una sola consulta a la base', n1 === n0, `${n0} → ${n1}`)
  // El tablón: trae solo el id, se pide (una vez) y se ve.
  await page.evaluate(() => {
    window.__TABLAS__.tournament_updates.push({ id: 'a9', tournament_id: 'torneo-1', author_id: 'user-3', kind: 'aviso', body: 'Pausa de 10 minutos para merendar', created_at: new Date().toISOString() })
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'tournament_updates', op: 'INSERT', fila: { id: 'a9' } })
  })
  await page.waitForTimeout(4800)
  const tablon = await page.evaluate(() => document.body.textContent.includes('Pausa de 10 minutos para merendar'))
  check('un aviso del tablón aparece sin recargar', tablon)
  // El final: el torneo pasa a terminado.
  await page.evaluate(() => {
    // Filas NUEVAS (copias): el doble comparte los objetos con la página, y
    // cambiarlos en su sitio sería cambiar el torneo de la ficha por detrás.
    const T = window.__TABLAS__
    const i = T.tournaments.findIndex((x) => x.id === 'torneo-1')
    T.tournaments[i] = { ...T.tournaments[i], status: 'finished', current_round_id: 'ronda-3' }
    // Lo que la base tiene de verdad al terminar: las rondas cerradas, la ronda 3
    // con su mesa jugada y su resultado.
    T.rounds.forEach((r, k) => { T.rounds[k] = { ...r, status: 'finished' } })
    T.rounds.push({ id: 'ronda-3', tournament_id: 'torneo-1', round_number: 3, status: 'finished', phase: 'swiss', started_at: new Date().toISOString() })
    T.tournament_matches.push({ id: 'mesa-9', round_id: 'ronda-3', table_number: 1, player_a_id: 'user-1', player_b_id: 'mod-1', status: 'finished', check_in_a_at: new Date().toISOString(), check_in_b_at: new Date().toISOString() })
    T.match_results.push({ id: 'r10', match_id: 'mesa-9', result: 'a_wins', winner_id: 'user-1' })
    window.__VIVO__.emitirCanal('torneo:torneo-1', { t: 'tournaments', op: 'UPDATE', fila: { id: 'torneo-1', status: 'finished', current_round_id: 'ronda-3' } })
  })
  await page.waitForTimeout(2500)
  const fin = await page.evaluate(() => ({ chapa: [...document.querySelectorAll('.torneo-estado-fin')].map((x) => x.textContent.trim()).join('|'), mesa: (() => { const c = document.getElementById('torneoMiPartida'); return !c || c.classList.contains('hidden') || c.closest('.hidden') ? '' : c.textContent.replace(/\s+/g, ' ') })() }))
  check('el final del torneo se ve sin recargar: chapa «Terminado» y fuera la mesa', /Terminado/.test(fin.chapa) && !/Hacer check-in/.test(fin.mesa), JSON.stringify(fin).slice(0, 240))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
