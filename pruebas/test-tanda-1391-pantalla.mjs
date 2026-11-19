// Tanda 1391 — Torneos en modo juego (1): la pantalla VS, tu camino y la
// celebración (la propuesta «Torneos en modo juego», PINGU: «dale con todo
// lo recomendado»):
//   · tu mesa es un cara a cara (panel de juego con el VS en medio);
//   · «Tu puesto» lleva tu camino: R1…R5 de colores, la de ahora latiendo y
//     el Top con su trofeo;
//   · reportar: Victoria y Derrota gordos y de color;
//   · al cerrarse TU mesa sale «¡VICTORIA!» (o «Derrota») con la mascota,
//     los puntos y el puesto, UNA vez; volver a entrar no la repite.
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
      MESAS.push({ id, round_id: `r-${n}`, table_number: t + 1, player_a_id: a, player_b_id: b, status: fin ? 'finished' : 'active', check_in_a_at: new Date(ahora - 600e3).toISOString(), check_in_b_at: new Date(ahora - 600e3).toISOString() })
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
async function abrir(movil, r3Terminada, { quieto = false } = {}) {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: movil, hasTouch: movil, colorScheme: 'dark', serviceWorkers: 'block', reducedMotion: quieto ? 'reduce' : 'no-preference' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [d.TORNEO]; window.__FAKE_INSCRIPCIONES__ = d.INSC; window.__FAKE_RONDAS__ = d.RONDAS; window.__FAKE_MESAS__ = d.MESAS
    window.__FAKE_RESULTADOS__ = d.RES; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = []; window.__FAKE_JUECES__ = []; window.__FAKE_PERFILES__ = d.PERFILES
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, datos(r3Terminada))
  await page.goto(BASE + '/torneo?slug=copa&ver=jugar', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { ctx, page, errores }
}

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  console.log(`── ${q}: la ronda en juego ──`)
  {
    const { ctx, page, errores } = await abrir(movil, false)
    const r = await page.evaluate(() => {
      const duelo = document.querySelector('#miPartidaContenido .torneo-duelo')
      const vs = duelo?.querySelector('.torneo-duelo-vs')
      return {
        duelo: Boolean(duelo),
        fondo: duelo ? getComputedStyle(duelo).backgroundImage.includes('gradient') : false,
        vs: vs?.textContent.trim(),
        rival: duelo?.textContent.includes('marina'),
        botones: [...document.querySelectorAll('#miPartidaContenido .torneo-boton-resultado')].map((b) => [b.textContent.trim(), (getComputedStyle(b).backgroundImage.includes('gradient') ? 'degradado' : getComputedStyle(b).backgroundColor)]),
        camino: [...document.querySelectorAll('#torneoComoVas .torneo-camino-paso')].map((p) => `${p.querySelector('b').textContent}:${p.className.replace('torneo-camino-paso', '').trim() || '-'}`),
        celebra: Boolean(document.querySelector('.torneo-celebra[open]')),
        ancho: document.documentElement.scrollWidth <= innerWidth + 1,
      }
    })
    check(`${q}: tu mesa es un cara a cara en panel de juego, con el VS y tu rival`, r.duelo && r.fondo && r.vs === 'VS' && r.rival, JSON.stringify(r))
    check(`${q}: Victoria y Derrota gordos y de color`, r.botones.length === 2 && r.botones.every(([, bg]) => bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgb(255, 255, 255)'), JSON.stringify(r.botones))
    check(`${q}: tu camino: R1 ganada, R2 perdida, R3 latiendo, R4 y R5 por jugar y el Top 4`, r.camino.join(',') === 'R1:gana,R2:pierde,R3:vivo,R4:-,R5:-,Top 4:top', JSON.stringify(r.camino))
    check(`${q}: con la mesa en juego no sale ninguna celebración`, !r.celebra)
    check(`${q}: sin desplazamiento de lado y sin errores`, r.ancho && !errores.length, errores.join(' | '))
    if (OUT) await page.screenshot({ path: `${OUT}/1391-vs-${movil ? 'm' : 'pc'}.png`, scale: 'css', fullPage: true })
    await ctx.close()
  }
  console.log(`── ${q}: la mesa se acaba de cerrar ──`)
  {
    const { ctx, page, errores } = await abrir(movil, true)
    await page.waitForTimeout(2500)
    const r = await page.evaluate(() => {
      const d = document.querySelector('.torneo-celebra[open]')
      return d && { titulo: d.querySelector('.torneo-celebra-titulo')?.textContent, marca: d.querySelector('.torneo-celebra-marca')?.textContent, cifras: d.querySelector('.torneo-celebra-cifras')?.textContent.replace(/\s+/g, ' ').trim(), mascota: d.querySelector('[data-mascota]')?.dataset.mascota, montada: d.querySelector('[data-mascota]')?.dataset.montada }
    })
    check(`${q}: sale «¡VICTORIA!» con el marcador, contra quién, +3 y tu puesto`, r && r.titulo === '¡VICTORIA!' && /1-0 contra marina/.test(r.marca) && /\+3\s*puntos/.test(r.cifras) && /º/.test(r.cifras), JSON.stringify(r))
    check(`${q}: …con la mascota contenta en 3D`, r && r.mascota === 'contento' && r.montada === '3d', JSON.stringify(r))
    if (OUT) await page.screenshot({ path: `${OUT}/1391-celebra-${movil ? 'm' : 'pc'}.png`, scale: 'css' })
    await page.click('.torneo-celebra [data-cerrar]')
    await page.waitForTimeout(300)
    check(`${q}: «Seguir» la cierra`, !(await page.$('.torneo-celebra')))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3500)
    check(`${q}: al volver a entrar no se repite`, !(await page.$('.torneo-celebra[open]')))
    check(`${q}: sin errores`, !errores.length, errores.join(' | '))
    await ctx.close()
  }
}
await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
