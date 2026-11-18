// Tanda 1394 — Torneos en modo juego (4): el final (la propuesta «Torneos en
// modo juego», PINGU: «dale con todo lo recomendado»):
//   · si acabas en el podio de un torneo recién cerrado, al abrirlo sale la
//     pantalla «¡CAMPEÓN!» con el trofeo y la mascota, UNA vez; un torneo
//     cerrado hace más de tres días no celebra nada;
//   · Mis partidas › Torneos lleva arriba «Tu último torneo» (puesto, récord,
//     ronda a ronda y Compartir) en el panel de juego;
//   · Inicio: la ficha «Tu torneo» dice «¡Campeón!» unos días.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const OUT = process.env.OUT || ''
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const ahora = Date.now()
const GENTE = [['user-1', 'pingu'], ['user-2', 'marina'], ['user-3', 'teo'], ['mod-1', 'nerea']]
// Copa suiza de 2 rondas, terminada: pingu gana las dos.
function datos(cerradoHace) {
  const TORNEO = { id: 'copa-1', slug: 'copa', name: 'Copa de otoño', status: 'finished', format: 'swiss', admin_id: 'user-3', max_players: 8, swiss_rounds: 2, swiss_bo: 1, top_cut_size: 0, round_time_minutes: 50, start_at: new Date(ahora - cerradoHace - 3 * 3600e3).toISOString(), updated_at: new Date(ahora - cerradoHace).toISOString(), podium: ['user-1', 'user-2', 'user-3', 'mod-1'], champion_id: 'user-1' }
  const RONDAS = [1, 2].map((n) => ({ id: `r-${n}`, tournament_id: 'copa-1', round_number: n, phase: 'swiss', status: 'finished', started_at: new Date(ahora - cerradoHace - (3 - n) * 3600e3).toISOString(), ends_at: new Date(ahora - cerradoHace - (2 - n) * 3600e3).toISOString() }))
  const cruces = { 1: [['user-1', 'mod-1'], ['user-2', 'user-3']], 2: [['user-1', 'user-2'], ['user-3', 'mod-1']] }
  const MESAS = [], RES = []
  for (const n of [1, 2]) cruces[n].forEach(([a, b], t) => {
    const id = `m-${n}-${t}`
    MESAS.push({ id, round_id: `r-${n}`, table_number: t + 1, player_a_id: a, player_b_id: b, status: 'finished' })
    RES.push({ id: `res-${id}`, match_id: id, result: 'a_wins', winner_id: a, score_a: 1, score_b: 0, created_at: new Date(ahora - cerradoHace).toISOString() })
  })
  const INSC = GENTE.map(([u, n], i) => ({ id: `i-${i}`, tournament_id: 'copa-1', user_id: u, status: 'active', tcg_live_username: `TCG_${n}` }))
  const PERFILES = GENTE.map(([id, username]) => ({ id, username, display_name: username }))
  const MAZOS = { 'user-1': 'Dragapult ex', 'user-2': 'Gardevoir ex', 'user-3': 'Charizard ex', 'mod-1': 'Raging Bolt ex' }
  const DECKS = Object.entries(MAZOS).map(([u, n], i) => ({ id: `dk-${i}`, tournament_id: 'copa-1', user_id: u, parsed_cards: { pokemon: [{ quantity: 3, name: n, set: 'X', number: '1' }], trainer: [], energy: [] } }))
  const ARQ = Object.values(MAZOS).map((n, i) => ({ id: `arq-${i}`, nombre: n.replace(' ex', ''), iconos: [{ nombre: n }], requiere: [{ nombres: [n] }], activo: true }))
  return { TORNEO, RONDAS, MESAS, RES, INSC, PERFILES, DECKS, ARQ }
}
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
async function abrir(url, d, movil = false) {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: movil, hasTouch: movil, colorScheme: 'dark', serviceWorkers: 'block' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = []; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_DECKLISTS__ = d.DECKS; window.__FAKE_ARQUETIPOS__ = d.ARQ
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, d)
  await page.goto(BASE + url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4500)
  return { ctx, page, errores }
}

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  console.log(`── ${q}: la ficha de un torneo que acabas de ganar ──`)
  const { ctx, page, errores } = await abrir('/torneo?slug=copa', datos(3600e3), movil)
  const r = await page.evaluate(() => {
    const d = document.querySelector('.torneo-celebra-final[open]')
    return d && { titulo: d.querySelector('.torneo-celebra-titulo')?.textContent, oro: d.classList.contains('torneo-celebra-oro'), cifras: d.querySelector('.torneo-celebra-cifras')?.textContent.replace(/\s+/g, ' ').trim(), trofeo: Boolean(d.querySelector('.torneo-celebra-trofeo svg')), mascota: d.querySelector('[data-mascota]')?.dataset.mascota }
  })
  check(`${q}: sale «¡CAMPEÓN!» en oro, con el trofeo y tu puesto`, r && r.titulo === '¡CAMPEÓN!' && r.oro && r.trofeo && /1º\s*de 4/.test(r.cifras) && /2-0-0/.test(r.cifras), JSON.stringify(r))
  check(`${q}: …con la mascota bailando`, r?.mascota === 'bailar', JSON.stringify(r))
  if (OUT) await page.screenshot({ path: `${OUT}/1394-campeon-${movil ? 'm' : 'pc'}.png`, scale: 'css' })
  await page.click('.torneo-celebra-final [data-cerrar]')
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  check(`${q}: al volver a entrar no se repite`, !(await page.$('.torneo-celebra-final[open]')))
  check(`${q}: sin errores`, !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── Un torneo que ganaste hace una semana ──')
{
  const { ctx, page } = await abrir('/torneo?slug=copa', datos(7 * 86400e3))
  check('no celebra nada', !(await page.$('.torneo-celebra-final[open]')))
  await ctx.close()
}

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  console.log(`── ${q}: Mis partidas › Torneos ──`)
  const { ctx, page, errores } = await abrir('/mis-partidas', datos(3600e3), movil)
  await page.locator('#partidasTabs [data-vista="torneos"]').click()
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => {
    const c = document.querySelector('#partidasTorneos .tu-torneo')
    return c && { primero: c === document.querySelector('#partidasTorneos').firstElementChild, nombre: c.querySelector('h3')?.textContent, puesto: c.querySelector('.tu-torneo-puesto')?.textContent.trim(), oro: c.querySelector('.tu-torneo-puesto')?.classList.contains('oro'), rondas: [...c.querySelectorAll('.tu-torneo-rondas li')].map((l) => l.textContent).join(''), compartir: Boolean(c.querySelector('[data-compartir-torneo]')), fondo: getComputedStyle(c).backgroundImage.includes('gradient') }
  })
  check(`${q}: arriba, «Tu último torneo» en el panel de juego`, r?.primero && r.fondo && r.nombre === 'Copa de otoño', JSON.stringify(r))
  check(`${q}: …«¡Campeón!» en oro, ronda a ronda (VV) y Compartir`, r?.puesto === '¡Campeón!' && r.oro && r.rondas === 'VV' && r.compartir, JSON.stringify(r))
  check(`${q}: sin errores y sin desplazamiento de lado`, !errores.length && (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)), errores.join(' | '))
  if (OUT) await page.screenshot({ path: `${OUT}/1394-partidas-${movil ? 'm' : 'pc'}.png`, scale: 'css' })
  await ctx.close()
}

console.log('── Inicio: la ficha «Tu torneo» ──')
{
  const { ctx, page, errores } = await abrir('/', datos(3600e3))
  const f = await page.evaluate(() => [...document.querySelectorAll('.hoy-ficha')].map((a) => ({ t: a.getAttribute('aria-label'), href: a.getAttribute('href') })).find((x) => /Tu torneo/.test(x.t)))
  check('dice «Tu torneo · ¡Campeón!» y lleva a la tabla', f && /¡Campeón!/.test(f.t) && /slug=copa&ver=clasificacion/.test(f.href), JSON.stringify(f))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Sin la migración 1394, portada_hoy no trae el podio: la ficha de siempre, sin romper nada.
  const ctx = await browser.newContext({ serviceWorkers: 'block' })
  await ctx.addInitScript(() => { window.__SIN_1394__ = true })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  const d = datos(3600e3)
  await page.addInitScript((d) => { window.__FAKE_SESSION__ = 'user-1'; window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC }, d)
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  check('sin la migración 1394: la ficha de siempre y sin errores', !(await page.evaluate(() => [...document.querySelectorAll('.hoy-ficha')].some((a) => /Tu torneo/.test(a.getAttribute('aria-label'))))) && !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/', datos(7 * 86400e3))
  check('con el torneo de hace una semana, la ficha de siempre', !(await page.evaluate(() => [...document.querySelectorAll('.hoy-ficha')].some((a) => /Tu torneo/.test(a.getAttribute('aria-label'))))))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
