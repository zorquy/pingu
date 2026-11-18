// Tanda 1392 — Torneos en modo juego (2): la tabla con podio y las mesas en
// mapa (la propuesta «Torneos en modo juego», PINGU: «dale con todo lo
// recomendado»):
//   · «quién va» es un podio: 2.º, 1.º, 3.º sobre peanas, la del 1.º más alta;
//   · tu fila de la tabla, marcada; en el móvil, con ella fuera de la
//     pantalla, «Tú · Nº» abajo, que te lleva a ella;
//   · las mesas, cada una con el color de su estado (jugando, disputa,
//     terminada), la tuya marcada y la leyenda con cuántas hay de cada.
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
// Copa suiza de 5 rondas con top 4. R1 ganada, R2 perdida, R3 en juego contra marina.
function datos(r3Terminada) {
  const TORNEO = { id: 'copa-1', slug: 'copa', name: 'Copa de otoño', status: 'in_progress', format: 'swiss', admin_id: 'user-3', max_players: 32, swiss_rounds: 5, swiss_bo: 1, top_cut_size: 4, top_cut_bo: 3, round_time_minutes: 50, checkin_minutes: 5, start_at: new Date(ahora - 3 * 3600e3).toISOString(), current_round_id: 'r-3' }
  const RONDAS = [1, 2, 3].map((n) => ({ id: `r-${n}`, tournament_id: 'copa-1', round_number: n, phase: 'swiss', status: n < 3 ? 'finished' : 'active', started_at: new Date(ahora - (4 - n) * 3600e3).toISOString(), ends_at: new Date(ahora + (n === 3 ? 30 * 60e3 : -3600e3)).toISOString() }))
  const cruces = { 1: [['user-1', 'p5'], ['user-2', 'p6'], ['user-3', 'p7'], ['mod-1', 'p8']], 2: [['user-1', 'mod-1'], ['user-2', 'user-3'], ['p5', 'p6'], ['p7', 'p8']], 3: [['user-1', 'user-2'], ['user-3', 'mod-1'], ['p5', 'p7'], ['p6', 'p8']] }
  const MESAS = [], RES = []
  for (const n of [1, 2, 3]) {
    cruces[n].forEach(([a, b], t) => {
      const id = `m-${n}-${t}`
      const mia = n === 3 && t === 0
      const fin = n < 3 || (mia ? r3Terminada : t > 1)
      const estado = fin ? 'finished' : n === 3 && t === 1 ? 'disputed' : 'active'
      MESAS.push({ id, round_id: `r-${n}`, table_number: t + 1, player_a_id: a, player_b_id: b, status: estado, check_in_a_at: new Date(ahora - 600e3).toISOString(), check_in_b_at: new Date(ahora - 600e3).toISOString() })
      if (!fin) return
      // user-1: gana la R1, pierde la R2 y (si acaba) gana la R3.
      const ganaA = n === 2 && t === 0 ? false : true
      RES.push({ id: `res-${id}`, match_id: id, result: ganaA ? 'a_wins' : 'b_wins', winner_id: ganaA ? a : b, score_a: ganaA ? 1 : 0, score_b: ganaA ? 0 : 1, created_at: new Date(ahora - (n === 3 ? 60e3 : 3600e3)).toISOString() })
    })
  }
  const INSC = GENTE.map(([u, n], i) => ({ id: `i-${i}`, tournament_id: 'copa-1', user_id: u, status: 'active', tcg_live_username: `TCG_${n}`, registered_at: new Date(ahora - 5 * 86400e3).toISOString() }))
  const PERFILES = GENTE.map(([id, username]) => ({ id, username, display_name: username }))
  return { TORNEO, RONDAS, MESAS, RES, INSC, PERFILES }
}
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] })
async function abrir(movil, ver) {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 640 } : { width: 1440, height: 900 }, isMobile: movil, hasTouch: movil, colorScheme: 'dark', serviceWorkers: 'block' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = []; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, datos(false))
  await page.goto(BASE + '/torneo?slug=copa&ver=' + ver, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { ctx, page, errores }
}

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  console.log(`── ${q}: la Tabla ──`)
  {
    const { ctx, page, errores } = await abrir(movil, 'clasificacion')
    const r = await page.evaluate(() => {
      const lid = [...document.querySelectorAll('#clasificacionContenido .torneo-lider')]
      const vis = lid.map((l) => ({ pos: l.querySelector('.torneo-peana')?.textContent, x: Math.round(l.getBoundingClientRect().left), h: Math.round(l.querySelector('.torneo-peana')?.getBoundingClientRect().height || 0) }))
      const yo = document.querySelector('#clasificacionContenido tr.torneo-fila-yo')
      return { vis, yo: yo && getComputedStyle(yo).boxShadow, ancho: document.documentElement.scrollWidth <= innerWidth + 1 }
    })
    const orden = [...r.vis].sort((a, b) => a.x - b.x).map((v) => v.pos).join(',')
    const alto = Object.fromEntries(r.vis.map((v) => [v.pos, v.h]))
    check(`${q}: «quién va» es un podio 2-1-3 sobre peanas`, orden === '2,1,3', JSON.stringify(r.vis))
    check(`${q}: …la del 1.º más alta que la del 2.º, y esta más que la del 3.º`, alto[1] > alto[2] && alto[2] > alto[3], JSON.stringify(alto))
    check(`${q}: tu fila, marcada con su borde`, r.yo && r.yo !== 'none', r.yo)
    if (OUT) await page.screenshot({ path: `${OUT}/1392-tabla-${movil ? 'm' : 'pc'}.png`, scale: 'css', fullPage: !movil })
    // «Tú» a mano: tu fila fuera de la pantalla
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(400)
    const fuera = await page.evaluate(() => { const f = document.querySelector('tr.torneo-fila-yo').getBoundingClientRect(); return f.top > innerHeight || f.bottom < 0 })
    const flota = await page.evaluate(() => { const b = document.querySelector('.torneo-tu-flota'); return b && { visible: !b.hidden && b.getClientRects().length > 0, texto: b.textContent.replace(/\s+/g, ' ').trim() } })
    if (movil) {
      if (fuera) {
        check('Móvil: con tu fila fuera, sale «Tú · Nº» abajo', flota?.visible && /Tú · \dº/.test(flota.texto), JSON.stringify(flota))
        if (OUT) await page.screenshot({ path: `${OUT}/1392-tu-m.png`, scale: 'css' })
        await page.click('.torneo-tu-flota')
        await page.waitForTimeout(900)
        const ahora = await page.evaluate(() => { const f = document.querySelector('tr.torneo-fila-yo').getBoundingClientRect(); return f.top >= 0 && f.bottom <= innerHeight })
        check('Móvil: …al tocarla, te lleva a tu fila y se va', ahora && (await page.evaluate(() => document.querySelector('.torneo-tu-flota').hidden)))
      } else check('Móvil: (tu fila cabía en pantalla; la pastilla no hace falta)', !flota?.visible, JSON.stringify(flota))
    } else check('PC: la pastilla «Tú» no sale', !flota?.visible, JSON.stringify(flota))
    check(`${q}: sin desplazamiento de lado y sin errores`, r.ancho && !errores.length, errores.join(' | '))
    await ctx.close()
  }
  console.log(`── ${q}: las Mesas ──`)
  {
    const { ctx, page, errores } = await abrir(movil, 'rondas')
    const r = await page.evaluate(() => {
      const mesas = [...document.querySelectorAll('.torneo-mesas-mapa .torneo-mesa')].map((m) => ({ n: m.querySelector('.torneo-mesa-num')?.textContent, estado: (m.className.match(/torneo-mesa-(jugando|disputa|cerrada|espera)/) || [])[1], mia: m.classList.contains('mia'), borde: getComputedStyle(m).borderLeftColor }))
      return { mesas, leyenda: document.querySelector('.torneo-mesas-leyenda')?.textContent.replace(/\s+/g, ' ').trim(), cols: getComputedStyle(document.querySelector('.torneo-mesas-mapa')).gridTemplateColumns.split(' ').length, ancho: document.documentElement.scrollWidth <= innerWidth + 1 }
    })
    check(`${q}: cada mesa con su estado: la 1 (tuya) jugando, la 2 en disputa, la 3 y la 4 terminadas`, r.mesas.map((m) => `${m.n}:${m.estado}`).join(',') === '1:jugando,2:disputa,3:cerrada,4:cerrada' && r.mesas[0].mia, JSON.stringify(r.mesas))
    check(`${q}: …con colores distintos a la izquierda`, new Set(r.mesas.map((m) => m.borde)).size === 3, JSON.stringify(r.mesas.map((m) => m.borde)))
    check(`${q}: la leyenda cuenta cada estado`, r.leyenda === '1 jugando1 en disputa2 terminadas' || r.leyenda === '1 jugando 1 en disputa 2 terminadas', r.leyenda)
    check(`${q}: ${movil ? 'una columna' : 'en rejilla (dos o más columnas)'}`, movil ? r.cols === 1 : r.cols >= 2, String(r.cols))
    check(`${q}: sin desplazamiento de lado y sin errores`, r.ancho && !errores.length, errores.join(' | '))
    if (OUT) await page.screenshot({ path: `${OUT}/1392-mesas-${movil ? 'm' : 'pc'}.png`, scale: 'css', fullPage: true })
    await ctx.close()
  }
}
await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
