// Tanda 1378 — Tabla, Info y Jueces como Hoy y Mesas (la versión 2 de «El
// torneo, renovado»):
//   · Meta deja de ser pestaña: es un apartado de Tabla; `?ver=meta` abre Tabla;
//   · en Info, «Tus jornadas» con las cerradas plegadas, una línea en vez del
//     párrafo y el botón grande solo en la próxima.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const ahora = Date.now()
const dia = 86400e3
const GENTE = [['user-1', 'pingu'], ['user-2', 'enege'], ['user-3', 'laiafdn'], ['mod-1', 'soyfedeegb'], ['p5', 'srpaquito'], ['p6', 'nox'], ['p7', 'pokecata'], ['p8', 'gorka-rubio']]
// Una liga de diez jornadas de tres rondas, con seis jugadas: entre jornadas.
const TORNEO = { id: 'liga-1', slug: 'liga', name: 'Liga FDN [Oct-Dic]', status: 'in_progress', format: 'league', admin_id: 'user-3', max_players: 32,
  swiss_rounds: 30, rounds_per_matchday: 3, swiss_bo: 1, round_time_minutes: 30, checkin_minutes: 5, start_at: new Date(ahora - 42 * dia).toISOString(),
  matchday_dates: Array.from({ length: 10 }, (_, i) => new Date(ahora + (i - 6) * 7 * dia + 3 * 3600e3).toISOString()) }
let semilla = 7
const azar = () => ((semilla = (semilla * 9301 + 49297) % 233280) / 233280)
const RONDAS = [], MESAS = [], RES = []
for (let n = 1; n <= 18; n++) {
  RONDAS.push({ id: `r-${n}`, tournament_id: 'liga-1', round_number: n, status: 'finished', phase: 'swiss', started_at: new Date(ahora - (19 - n) * dia).toISOString() })
  const ids = GENTE.map((g) => g[0]).sort(() => azar() - 0.5)
  for (let t = 0; t < 4; t++) {
    const a = ids[t * 2], b = ids[t * 2 + 1], id = `m-${n}-${t}`
    const gana = azar() < 0.5 ? a : b
    MESAS.push({ id, round_id: `r-${n}`, table_number: t + 1, player_a_id: a, player_b_id: b, status: 'finished' })
    RES.push({ id: `res-${id}`, match_id: id, result: gana === a ? 'a_wins' : 'b_wins', winner_id: gana, score_a: gana === a ? 1 : 0, score_b: gana === b ? 1 : 0 })
  }
}
const INSC = GENTE.map(([u, n], i) => ({ id: `i-${i}`, tournament_id: 'liga-1', user_id: u, status: 'active', tcg_live_username: `TCG_${n}`, registered_at: new Date(ahora - 50 * dia).toISOString() }))
const TABLON = []
for (let n = 1; n <= 6; n++) {
  TABLON.push({ id: `ta-${n}`, tournament_id: 'liga-1', author_id: null, kind: 'auto', body: `Ronda ${n} en marcha`, created_at: new Date(ahora - (19 - n) * dia).toISOString() })
  TABLON.push({ id: `tb-${n}`, tournament_id: 'liga-1', author_id: null, kind: 'auto', body: `Ronda ${n} cerrada`, created_at: new Date(ahora - (19 - n) * dia + 1800e3).toISOString() })
}
TABLON.push({ id: 'th-1', tournament_id: 'liga-1', author_id: 'user-3', kind: 'aviso', body: 'El viernes empezamos a las 19:00.', created_at: new Date(ahora - 7200e3).toISOString() })
const PERFILES = GENTE.map(([id, username]) => ({ id, username, display_name: username }))

const browser = await chromium.launch()
async function abrir(movil, ver) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = d.TABLON; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, { TORNEO, INSC, RONDAS, MESAS, RES, TABLON, PERFILES })
  await page.goto(BASE + '/torneo?slug=liga&ver=' + ver, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}

try {
  for (const movil of [false, true]) {
    const quien = movil ? 'Móvil' : 'PC'
    console.log(quien)
    {
      const { page, ctx, errores } = await abrir(movil, 'meta')
      check(`${quien}: sin errores de página`, errores.length === 0, errores.join(' | '))
      const p = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#torneoPestanas [data-pestana]')].map((b) => b.dataset.pestana), activa: document.querySelector('#torneoPestanas .activa')?.dataset.pestana, metaEnTabla: Boolean(document.querySelector('[data-panel="clasificacion"] #torneoMetaCaja')), panelMeta: Boolean(document.querySelector('[data-panel="meta"]')) }))
      // Arena limpia (1473): la pestaña Mazos se queda aunque no haya listas a la vista; dice cuándo se llena.
      check(`${quien}: los mazos en su panel y no dentro de la clasificación (1447); sin listas a la vista, Mazos sigue (1473)`, p.ids.includes('meta') && !p.metaEnTabla && p.panelMeta, JSON.stringify(p))
      check(`${quien}: ?ver=meta sin listas a la vista abre Mazos, con su «cuándo se llena» (1473)`, p.activa === 'meta', JSON.stringify(p))
      await ctx.close()
    }
    {
      const { page, ctx, errores } = await abrir(movil, 'torneo')
      check(`${quien}: Info sin errores`, errores.length === 0, errores.join(' | '))
      const j = await page.evaluate(() => {
        const c = document.getElementById('torneoMisJornadas')
        const vis = [...c.querySelectorAll('.torneo-mis-jornadas-fila')].filter((f) => f.checkVisibility())
        return { visibles: vis.map((f) => f.querySelector('strong')?.textContent), plegadas: c.querySelector('details.torneo-mis-jornadas-pasadas summary')?.textContent.trim(), abierto: c.querySelector('details.torneo-mis-jornadas-pasadas')?.open, grandes: c.querySelectorAll('.torneo-jornada-cambiar.btn-primary').length, enlaces: c.querySelectorAll('.torneo-jornada-cambiar.link-btn').length, parrafo: c.querySelector('.subtext')?.textContent.length || 0 }
      })
      check(`${quien}: a la vista, de la J7 a la J10; las seis cerradas, plegadas`, j.visibles.join() === 'Jornada 7,Jornada 8,Jornada 9,Jornada 10' && j.plegadas === 'Jornadas cerradas (6)' && !j.abierto, JSON.stringify(j))
      check(`${quien}: botón grande solo en la próxima; las demás, enlace`, j.grandes === 1 && j.enlaces === 3, JSON.stringify(j))
      check(`${quien}: una línea en vez del párrafo`, j.parrafo > 0 && j.parrafo < 120, j.parrafo)
      await ctx.close()
    }
  }
} finally {
  await browser.close()
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
