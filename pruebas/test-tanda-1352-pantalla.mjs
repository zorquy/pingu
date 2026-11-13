// Tanda 1352 — la ficha del torneo como app (propuesta «Torneos como app»):
// en el móvil las pestañas son la barra de abajo y la de la web se esconde;
// en el PC, una columna estrecha a la izquierda; entre medias, arriba. Y los
// nombres nuevos: Hoy, Mesas, Tabla, Info.
//
// (El fixture es el de las tandas 1347–1351, los torneos con caras (la propuesta «Torneos con caras»
// que PINGU aprobó con las recomendadas: «muy sencillo, muy plano… deberían
// salir los avatares de cada uno»).
//
// 1347: piezas comunes (cara, forma, flecha) y el día en la pastilla entre jornadas.
// 1348: /torneos con «Vas N.º» en la liga en curso.
// 1349: Mi mesa entre jornadas: «Tu próxima jornada» con cuenta y pasos.
// 1350: Rondas de una liga con tira de jornadas; cada mesa como duelo con marcador.
// 1351: Clasificación con caras, flechas y «Últimos» (OWP/OOWP al historial),
//       Jugadores en mosaico, tablón con lo automático junto, cara de quien organiza.
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
async function abrir(ancho, movil = false) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'] } : { viewport: { width: ancho, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = d.TABLON; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, { TORNEO, INSC, RONDAS, MESAS, RES, TABLON, PERFILES })
  await page.goto(BASE + '/torneo?slug=liga&ver=jugar', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
const nombres = (page) => page.$$eval('#torneoPestanas [data-pestana]', (bs) => bs.map((b) => b.querySelector('.torneo-tab-txt')?.textContent.trim()))

try {
  console.log('Móvil: la barra de abajo es la del torneo')
  {
    const { page, ctx, errores } = await abrir(390, true)
    check('sin errores de página', errores.length === 0, errores.join(' | '))
    check('Hoy, Mesas, Tabla e Info', (await nombres(page)).join() === 'Hoy,Mesas,Tabla,Info', (await nombres(page)).join())
    const pos = await page.evaluate(() => {
      const nav = document.getElementById('torneoPestanas')
      const r = nav.getBoundingClientRect()
      const bm = document.querySelector('.bm')
      return { fija: getComputedStyle(nav).position === 'fixed', abajo: Math.round(innerHeight - r.bottom), enBody: nav.parentNode === document.body, bm: bm ? getComputedStyle(bm).display : 'no hay' }
    })
    check('pegada abajo, fija', pos.fija && pos.abajo <= 1 && pos.enBody, JSON.stringify(pos))
    check('la barra de la web, escondida', pos.bm === 'none', pos.bm)
    check('con iconos', (await page.locator('#torneoPestanas .torneo-tab-ic svg').count()) === 4)
    await page.locator('#torneoPestanas [data-pestana="clasificacion"]').click()
    await page.waitForTimeout(300)
    check('tocar Tabla abre la tabla y lo apunta en la dirección', await page.locator('[data-panel="clasificacion"]').isVisible() && page.url().includes('ver=clasificacion'))
    await ctx.close()
  }
  console.log('PC: columna estrecha a la izquierda')
  {
    const { page, ctx } = await abrir(1280)
    const d = await page.evaluate(() => {
      const nav = document.getElementById('torneoPestanas')
      const rail = document.getElementById('torneoRail')
      return { enRail: Boolean(rail && nav.parentNode === rail), ancho: Math.round(rail?.getBoundingClientRect().width || 0), izquierda: rail ? rail.getBoundingClientRect().right <= document.querySelector('.torneo-principal').getBoundingClientRect().left : false }
    })
    check('las pestañas, en la columna de la izquierda', d.enRail && d.izquierda, JSON.stringify(d))
    check('…estrecha (72 px)', d.ancho === 72, d.ancho)
    check('la barra de la web, como siempre', !(await page.evaluate(() => document.documentElement.classList.contains('torneo-app'))))
    await ctx.close()
  }
  console.log('Tableta: arriba, como antes')
  {
    const { page, ctx } = await abrir(1000)
    check('las pestañas, en lo pegado de arriba', await page.evaluate(() => document.getElementById('torneoPestanas').parentNode.id === 'torneoPegado'))
    await ctx.close()
  }
} finally {
  await browser.close()
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
