// Tanda 1402 — Entre rondas y la entrada a cada ronda («El torneo, más
// sencillo», T3 y T4; PINGU: «dale con todo lo recomendado», la entrada en
// TODAS las rondas):
//   · con TU mesa terminada y la ronda en marcha: tu resultado en una tarjeta
//     («¡Ganaste a marina!», ronda, marcador, mesa, +3, la mascota contenta) y
//     «Siguiente» con las mesas terminadas en una barra; en una liga, las
//     rondas de la jornada como casillas (R1 ganada, R2 la que viene);
//   · la última ronda de una jornada dice «Hoy ya has terminado»;
//   · al empezar una ronda, «¡RONDA 2!» con las dos caras, la mesa, el tiempo
//     y el TCG Live del rival; «¡A jugar!» la cierra, UNA vez por mesa;
//   · a media ronda (más de diez minutos) no sale: te deja en tu mesa.
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
  await page.goto(`${BASE}/torneo?slug=${d.TORNEO.slug}&ver=jugar`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { ctx, page, errores }
}

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  console.log(`── ${q}: tu mesa ya está y la ronda sigue (liga) ──`)
  {
    const { ctx, page, errores } = await abrir(liga(1), movil)
    const r = await page.evaluate(() => {
      const e = document.querySelector('#miPartidaContenido .torneo-entre')
      if (!e) return null
      return {
        clase: e.querySelector('.torneo-entre-res')?.className,
        titulo: e.querySelector('.torneo-entre-texto b')?.textContent,
        sub: e.querySelector('.torneo-entre-texto small')?.textContent,
        pts: e.querySelector('.torneo-entre-pts')?.textContent,
        mascota: e.querySelector('.torneo-entre-res [data-mascota]')?.dataset.mascota,
        sig: e.querySelector('.torneo-entre-sig h4')?.textContent,
        texto: e.querySelector('.torneo-entre-sig p')?.textContent.replace(/\s+/g, ' ').trim(),
        barra: e.querySelector('.torneo-entre-barra')?.getAttribute('aria-valuenow') + '/' + e.querySelector('.torneo-entre-barra')?.getAttribute('aria-valuemax'),
        ancho: e.querySelector('.torneo-entre-barra i')?.style.width,
        casillas: [...e.querySelectorAll('.torneo-entre-casilla')].map((c) => `${c.textContent}:${c.className.replace('torneo-entre-casilla', '').trim() || '-'}`),
        jornada: e.querySelector('.torneo-entre-camino em')?.textContent,
        sinDesborde: document.documentElement.scrollWidth <= innerWidth + 1,
      }
    })
    check(`${q}: «¡Ganaste a marina!» con ronda, marcador, mesa y +3`, r && /gana/.test(r.clase) && r.titulo === '¡Ganaste a marina!' && r.sub === 'Ronda 1 de la jornada 1 · 1-0 · mesa 1' && r.pts === '+3', JSON.stringify(r))
    check(`${q}: …con la mascota contenta`, r?.mascota === 'contento', r?.mascota)
    check(`${q}: «Siguiente: ronda 2 de la jornada 1» y 2 de 4 mesas en la barra`, r?.sig === 'Siguiente: ronda 2 de la jornada 1' && /Empieza cuando acaben las mesas que quedan \(faltan las mesas 2 y 4\)\. 2 de 4 terminadas/.test(r.texto) && r.barra === '2/4' && r.ancho === '50%', JSON.stringify(r))
    check(`${q}: las rondas de la jornada: R1 ganada, R2 la que viene, R3`, r?.casillas.join(',') === 'R1:gana,R2:ya,R3:-' && r.jornada === 'Jornada 1 de 3', JSON.stringify(r?.casillas))
    check(`${q}: no sale la entrada de ronda (tu mesa ya está)`, !(await page.$('.torneo-ronda-entra[open]')))
    check(`${q}: sin desplazamiento de lado y sin errores`, r?.sinDesborde && !errores.length, errores.join(' | '))
    if (OUT) await page.screenshot({ path: `${OUT}/1402-entre-${movil ? 'm' : 'pc'}.png`, scale: 'css', fullPage: !movil })
    await ctx.close()
  }
  console.log(`── ${q}: la última ronda de la jornada ──`)
  {
    const { ctx, page, errores } = await abrir(liga(3), movil)
    const r = await page.evaluate(() => ({ sig: document.querySelector('.torneo-entre-sig h4')?.textContent, texto: document.querySelector('.torneo-entre-sig p')?.textContent.replace(/\s+/g, ' ').trim(), casillas: [...document.querySelectorAll('.torneo-entre-casilla')].map((c) => c.className.replace('torneo-entre-casilla', '').trim()) }))
    check(`${q}: «Hoy ya has terminado. Siguiente: jornada 2»`, r.sig === 'Hoy ya has terminado. Siguiente: jornada 2' && /^La ronda se cierra cuando acaben/.test(r.texto), JSON.stringify(r))
    check(`${q}: …con las tres rondas de hoy ganadas`, r.casillas.join(',') === 'gana,gana,gana', JSON.stringify(r.casillas))
    check(`${q}: sin errores`, !errores.length, errores.join(' | '))
    await ctx.close()
  }
  console.log(`── ${q}: empieza la ronda 2 (suizo) ──`)
  {
    const { ctx, page, errores } = await abrir(copa(2), movil)
    const r = await page.evaluate(() => {
      const d = document.querySelector('dialog.torneo-ronda-entra[open]')
      return d && { ceja: d.querySelector('.torneo-ronda-entra-ceja')?.textContent, titulo: d.querySelector('h2')?.textContent, caras: [...d.querySelectorAll('.torneo-ronda-entra-jugador')].map((c) => c.textContent.trim()), datos: d.querySelector('.torneo-ronda-entra-datos')?.textContent, foco: document.activeElement?.textContent, vibra: window.__VIBRA__.length }
    })
    check(`${q}: sale «¡RONDA 2!» con el torneo arriba`, r && r.titulo === '¡RONDA 2!' && r.ceja === 'COPA DE OTOÑO', JSON.stringify(r))
    check(`${q}: …tú contra hugo, mesa 3, 50 minutos y su TCG Live`, r && r.caras.join('|') === 'PTú|Hhugo' && r.datos === 'Mesa 3 · 50 minutos · TCG Live: TCG_hugo', JSON.stringify(r))
    check(`${q}: …con el foco en «¡A jugar!» y vibrando`, r && r.foco === '¡A jugar!' && r.vibra === 1, JSON.stringify(r))
    if (OUT) await page.screenshot({ path: `${OUT}/1402-entrada-${movil ? 'm' : 'pc'}.png`, scale: 'css' })
    await page.click('.torneo-ronda-entra [data-cerrar]')
    await page.waitForTimeout(300)
    check(`${q}: «¡A jugar!» la cierra y deja tu mesa`, !(await page.$('.torneo-ronda-entra')) && (await page.locator('#miPartidaContenido .torneo-duelo').count()) === 1)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3500)
    check(`${q}: al volver a entrar no se repite`, !(await page.$('.torneo-ronda-entra[open]')))
    check(`${q}: sin errores`, !errores.length, errores.join(' | '))
    await ctx.close()
  }
}
console.log('── A media ronda, y con «menos movimiento» ──')
{
  const { ctx, page, errores } = await abrir(copa(20), false)
  check('a los 20 minutos de ronda no sale la entrada', !(await page.$('.torneo-ronda-entra')) && (await page.locator('#miPartidaContenido .torneo-duelo').count()) === 1)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir(copa(2), true, { quieto: true })
  const r = await page.evaluate(() => ({ abierta: Boolean(document.querySelector('.torneo-ronda-entra[open]')), vibra: window.__VIBRA__.length, anim: getComputedStyle(document.querySelector('.torneo-ronda-entra-titulo') || document.body).animationName }))
  check('con «menos movimiento» sale quieta y sin vibrar', r.abierta && r.vibra === 0 && r.anim === 'none', JSON.stringify(r))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
