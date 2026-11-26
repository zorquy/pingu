// Tanda 1403 — La tabla arranca («El torneo, más sencillo», T5):
//   · con la primera ronda aún en juego, la Tabla no pinta el podio de «van»
//     (salía gente a cero puntos en él): dice «La tabla arranca cuando acabe
//     la ronda 1…: van X de Y mesas» y la tabla de debajo sigue;
//   · en cuanto hay una ronda cerrada, el podio vuelve;
//   · con tu mesa terminada y la ronda en marcha, Hoy no te pide la lista de
//     la jornada que viene (tu mazo, fuera).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const OUT = process.env.OUT || ''
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ahora = Date.now()
const GENTE = [['user-1', 'pingu'], ['user-2', 'marina'], ['user-3', 'teo'], ['mod-1', 'nerea'], ['p5', 'david'], ['p6', 'hugo'], ['p7', 'lucia'], ['p8', 'alex']]
const INSC = (t) => GENTE.map(([u, n], i) => ({ id: `i-${i}`, tournament_id: t, user_id: u, status: 'active', tcg_live_username: `TCG_${n}`, registered_at: new Date(ahora - 5 * 86400e3).toISOString() }))
const PERFILES = GENTE.map(([id, username]) => ({ id, username, display_name: username }))
const cruces = [['user-1', 'user-2'], ['user-3', 'mod-1'], ['p5', 'p7'], ['p6', 'p8']]

// Liga de 3 rondas por jornada; `ronda` es la ronda de la jornada 1 que se
// juega ahora (las anteriores, cerradas y ganadas). Tu mesa ya ha terminado
// (ganada 1-0) y de las demás, solo la 3.
function liga(ronda) {
  const TORNEO = { id: 'liga-1', slug: 'liga', name: 'Liga de prueba', status: 'in_progress', format: 'league', admin_id: 'user-3', max_players: 16, swiss_rounds: 9, rounds_per_matchday: 3, swiss_bo: 1, round_time_minutes: 30, checkin_minutes: 5, start_at: new Date(ahora - 3 * 3600e3).toISOString(), matchday_dates: [0, 1, 2].map((i) => new Date(ahora - 3600e3 + i * 7 * 86400e3).toISOString()), current_round_id: `r-${ronda}` }
  const RONDAS = [], MESAS = [], RES = []
  for (let n = 1; n <= ronda; n++) {
    RONDAS.push({ id: `r-${n}`, tournament_id: 'liga-1', round_number: n, phase: 'swiss', status: n < ronda ? 'finished' : 'active', started_at: new Date(ahora - (ronda - n + 1) * 40 * 60e3).toISOString(), ends_at: new Date(ahora + 600e3).toISOString() })
    cruces.forEach(([a, b], t) => {
      const id = `m-${n}-${t}`
      const fin = n < ronda || t === 0 || t === 2
      MESAS.push({ id, round_id: `r-${n}`, table_number: t + 1, player_a_id: a, player_b_id: b, status: fin ? 'finished' : 'active', check_in_a_at: new Date(ahora - 1800e3).toISOString(), check_in_b_at: new Date(ahora - 1800e3).toISOString() })
      if (fin) RES.push({ id: `res-${id}`, match_id: id, result: 'a_wins', winner_id: a, score_a: 1, score_b: 0, created_at: new Date(ahora - 60e3).toISOString() })
    })
  }
  return { TORNEO, RONDAS, MESAS, RES, INSC: INSC('liga-1') }
}
// Copa suiza: R1 cerrada, R2 empezada hace `minutos` contra hugo (mesa 3).
function copa(minutos) {
  const TORNEO = { id: 'copa-1', slug: 'copa', name: 'Copa de otoño', status: 'in_progress', format: 'swiss', admin_id: 'user-3', max_players: 32, swiss_rounds: 4, swiss_bo: 1, top_cut_size: 0, round_time_minutes: 50, checkin_minutes: 5, start_at: new Date(ahora - 2 * 3600e3).toISOString(), current_round_id: 'r-2' }
  const RONDAS = [1, 2].map((n) => ({ id: `r-${n}`, tournament_id: 'copa-1', round_number: n, phase: 'swiss', status: n < 2 ? 'finished' : 'active', started_at: new Date(ahora - (n === 2 ? minutos * 60e3 : 2 * 3600e3)).toISOString(), ends_at: new Date(ahora + (n === 2 ? (50 - minutos) * 60e3 : -3600e3)).toISOString() }))
  const c = { 1: cruces, 2: [['user-3', 'mod-1'], ['p5', 'p7'], ['user-1', 'p6'], ['user-2', 'p8']] }
  const MESAS = [], RES = []
  for (const n of [1, 2]) c[n].forEach(([a, b], t) => {
    const id = `m-${n}-${t}`
    MESAS.push({ id, round_id: `r-${n}`, table_number: t + 1, player_a_id: a, player_b_id: b, status: n < 2 ? 'finished' : 'active', check_in_a_at: null, check_in_b_at: null })
    if (n < 2) RES.push({ id: `res-${id}`, match_id: id, result: 'a_wins', winner_id: a, score_a: 1, score_b: 0, created_at: new Date(ahora - 3600e3).toISOString() })
  })
  return { TORNEO, RONDAS, MESAS, RES, INSC: INSC('copa-1') }
}
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
async function abrir(d, movil, { quieto = false, ctxPrevio = null } = {}) {
  const ctx = ctxPrevio || (await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: movil, hasTouch: movil, colorScheme: 'dark', serviceWorkers: 'block', reducedMotion: quieto ? 'reduce' : 'no-preference' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = []; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES
    window.__VIBRA__ = []
    try { navigator.vibrate = (p) => { window.__VIBRA__.push(p); return true } } catch {}
    try {
      localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
      // La celebración de la 1391 no es lo que se prueba aquí.
      for (const m of d.MESAS) localStorage.setItem(`pd-celebrada-${m.id}`, '1')
    } catch {}
  }, { ...d, PERFILES })
  await page.goto(`${BASE}/torneo?slug=${d.TORNEO.slug}&ver=${d.VER || 'jugar'}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { ctx, page, errores }
}

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  {
    const { ctx, page, errores } = await abrir({ ...liga(1), VER: 'clasificacion' }, movil)
    const r = await page.evaluate(() => ({ lideres: document.querySelectorAll('#clasificacionContenido .torneo-lideres').length, aviso: document.querySelector('#clasificacionContenido .torneo-tabla-arranca')?.textContent.replace(/\s+/g, ' ').trim(), filas: document.querySelectorAll('#clasificacionContenido tbody tr[data-nombre]').length /* 1448: sin la fila de la línea del corte */ }))
    check(`${q}: en la ronda 1, sin podio y con el aviso de cuánto falta`, r.lideres === 0 && r.aviso === 'La tabla arranca cuando acabe la ronda 1 de la jornada 1: van 2 de 4 mesas. El podio sale en cuanto haya algo que contar.', JSON.stringify(r))
    check(`${q}: …y la tabla sigue debajo`, r.filas === 8, r.filas)
    if (OUT) await page.screenshot({ path: `${OUT}/1403-tabla-${movil ? 'm' : 'pc'}.png`, scale: 'css' })
    check(`${q}: sin errores`, !errores.length, errores.join(' | '))
    await ctx.close()
  }
  {
    const { ctx, page, errores } = await abrir({ ...liga(2), VER: 'clasificacion' }, movil)
    const r = await page.evaluate(() => ({ lideres: document.querySelectorAll('#clasificacionContenido .torneo-lider').length, aviso: document.querySelectorAll('#clasificacionContenido .torneo-tabla-arranca').length }))
    check(`${q}: con la ronda 1 cerrada, vuelve el podio`, r.lideres === 3 && r.aviso === 0, JSON.stringify(r))
    check(`${q}: sin errores`, !errores.length, errores.join(' | '))
    await ctx.close()
  }
  {
    const { ctx, page, errores } = await abrir(liga(1), movil)
    const r = await page.evaluate(() => ({ entre: document.querySelectorAll('#miPartidaContenido .torneo-entre').length, mazo: (() => { const m = document.getElementById('torneoMazoCaja'); return Boolean(m) && getComputedStyle(m).display !== 'none' && !m.classList.contains('hidden') })() }))
    check(`${q}: con tu mesa terminada, Hoy no te pide la lista de la jornada que viene`, r.entre === 1 && !r.mazo, JSON.stringify(r))
    check(`${q}: sin errores`, !errores.length, errores.join(' | '))
    await ctx.close()
  }
}
await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
