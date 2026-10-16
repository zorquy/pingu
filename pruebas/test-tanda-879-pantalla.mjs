// Tanda 879 — una jornada de liga es un día de torneo.
//
// PINGU: «en el panel de siguiente torneo no sale el de hoy, es la jornada
// 2 de una liga, debería decir que hoy hay torneo». Y en la ficha: «ahora
// que son las 11 de la mañana no dice nada de que está por empezar y por
// defecto dice que se están generando los pareos, pero es incorrecto: los
// pareos no se harán hasta la hora acordada a las 19:00». La portada ordena
// tus torneos por su PRÓXIMA CITA (la siguiente jornada en una liga) y la
// barra entre jornadas dice cuándo es la siguiente.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const ahora = Date.now()
const aLas = (diasDesdeHoy, h = 19) => {
  const d = new Date(ahora)
  d.setDate(d.getDate() + diasDesdeHoy)
  d.setHours(h, 0, 0, 0)
  return d.toISOString()
}

console.log('── 0. Lo puro ──')
{
  const { proximaCita, cuandoLaCita } = await import(`${RAIZ}/js/torneos/rondas-jornada.js`)
  const liga = { format: 'league', status: 'in_progress', start_at: aLas(-7), matchday_dates: [aLas(-7), aLas(0), aLas(7)] }
  const c = proximaCita(liga, ahora)
  check('una liga en juego: la cita es la jornada de hoy (la 2), no el start_at de hace una semana', c?.jornada === 2 && c.fecha === aLas(0), JSON.stringify(c))
  check('la jornada de hoy sigue siendo la cita hasta seis horas después', proximaCita(liga, Date.parse(aLas(0)) + 5 * 3600e3)?.jornada === 2 && proximaCita(liga, Date.parse(aLas(0)) + 7 * 3600e3)?.jornada === 3)
  check('sin jornadas que queden, nada; terminada o cancelada, nada', proximaCita({ ...liga, matchday_dates: [aLas(-7)] }, ahora) === null && proximaCita({ ...liga, status: 'finished' }, ahora) === null)
  check('un torneo normal: su start_at, sin jornada', proximaCita({ status: 'registration_open', start_at: aLas(2) }, ahora)?.fecha === aLas(2) && proximaCita({ status: 'registration_open', start_at: aLas(2) }, ahora).jornada === null)
  check('«hoy a las 19:00», «mañana a las 19:00», y el día con el nombre', /^hoy a las 19:00$/.test(cuandoLaCita(aLas(0), Date.parse(aLas(0, 11)))) && /^mañana a las 19:00$/.test(cuandoLaCita(aLas(1), ahora)) && /^el \S+\.? \d+ \S+\.? a las 19:00$/.test(cuandoLaCita(aLas(7), ahora)), [cuandoLaCita(aLas(0), Date.parse(aLas(0, 11))), cuandoLaCita(aLas(1), ahora), cuandoLaCita(aLas(7), ahora)].join(' | '))
  check('ya pasada: «hace 40 min»', cuandoLaCita(new Date(ahora - 40 * 60000).toISOString(), ahora) === 'hace 40 min')
}

const browser = await chromium.launch()

console.log('\n── 1. La portada: «Torneo hoy a las 19:00 · jornada 2» ──')
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(([j1, j2, j3]) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_TORNEOS__ = [{ id: 'torneo-1', slug: 'liga-fdn', name: 'Liga FDN', status: 'in_progress', format: 'league', start_at: j1, matchday_dates: [j1, j2, j3], swiss_rounds: 9, rounds_per_matchday: 3 }]
    window.__FAKE_INSCRIPCIONES__ = [{ tournament_id: 'torneo-1', user_id: 'user-1', status: 'active' }]
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [aLas(-7), aLas(0), aLas(7)])
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const ficha = await page.$eval('.hoy-ficha[href^="/torneo"]', (a) => ({ href: a.getAttribute('href'), texto: a.textContent.replace(/\s+/g, ' ').trim() })).catch(() => null)
  check('la ficha dice «Torneo hoy a las 19:00» y la liga con su jornada, y lleva a ella', ficha?.href === '/torneo?slug=liga-fdn' && /Torneo hoy a las 19:00/.test(ficha.texto) && /Liga FDN · jornada 2/.test(ficha.texto), JSON.stringify(ficha))
  await page.close()
}

console.log('\n── 2. La ficha entre jornadas: cuándo es la siguiente, no «pareando» ──')
{
  const TORNEO = { id: 'torneo-1', slug: 'liga-fdn', name: 'Liga FDN', status: 'in_progress', format: 'league', admin_id: 'admin-1', max_players: 32, swiss_rounds: 9, rounds_per_matchday: 3, swiss_bo: 1, top_cut_size: 0, round_time_minutes: 30, checkin_minutes: 5, start_at: aLas(-7) }
  const GENTE = ['user-1', 'user-2', 'user-3', 'mod-1']
  const INSC = GENTE.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}`, participation_confirmed_at: aLas(-8) }))
  const RONDAS = [1, 2, 3].map((n) => ({ id: `ronda-${n}`, tournament_id: 'torneo-1', round_number: n, status: 'finished', phase: 'swiss', started_at: aLas(-7, 19 + n - 1) }))
  const MESAS = [1, 2, 3].map((n) => ({ id: `mesa-${n}`, round_id: `ronda-${n}`, table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'finished' }))
  const RES = [1, 2, 3].map((n) => ({ id: `r${n}`, match_id: `mesa-${n}`, result: 'a_wins', winner_id: 'user-1', score_a: 1, score_b: 0 }))
  const abrir = async (fechas) => {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
    await page.addInitScript(([t, i, r, m, res]) => {
      window.__FAKE_SESSION__ = 'user-1'
      window.__FAKE_TORNEOS__ = [t]; window.__FAKE_INSCRIPCIONES__ = i; window.__FAKE_RONDAS__ = r; window.__FAKE_MESAS__ = m; window.__FAKE_RESULTADOS__ = res; window.__FAKE_REPORTES__ = []; window.__FAKE_TABLON__ = []
    }, [{ ...TORNEO, matchday_dates: fechas }, INSC, RONDAS, MESAS, RES])
    await page.goto(`${BASE}/torneo?slug=liga-fdn`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2600)
    const b = await page.evaluate(() => {
      const t = (id) => document.getElementById(id)?.textContent.replace(/\s+/g, ' ').trim() || ''
      return { visible: !document.getElementById('torneoBarraViva').classList.contains('hidden'), rotulo: t('torneoVivaRotulo'), titular: t('torneoVivaTitular'), der: t('torneoVivaDer') }
    })
    await page.close()
    return { b, errores }
  }
  const hoy = await abrir([aLas(-7), aLas(0, 23), aLas(7)])
  check('sin errores', hoy.errores.length === 0, hoy.errores.join(' | '))
  check('«Jornada 1 de 3 · cerrada» y «Jornada 2 hoy a las 23:00»', hoy.b.visible && /Jornada 1 de 3 · cerrada/.test(hoy.b.rotulo) && /^Jornada 2 hoy a las 23:00$/.test(hoy.b.titular), JSON.stringify(hoy.b))
  check('  …y dice que a esa hora salen los pareos (no que se están pareando)', /A esa hora salen aquí los pareos/.test(hoy.b.der) && !/[Pp]areando/.test(hoy.b.titular), hoy.b.der)
  const manana = await abrir([aLas(-7), aLas(1), aLas(8)])
  check('con la jornada mañana: «Jornada 2 mañana a las 19:00»', /^Jornada 2 mañana a las 19:00$/.test(manana.b.titular), manana.b.titular)
  const sinFecha = await abrir([aLas(-7)])
  check('sin fecha puesta: «Jornada 2 · sin fecha todavía»', /^Jornada 2 · sin fecha todavía$/.test(sinFecha.b.titular), sinFecha.b.titular)
  const pasada = await abrir([aLas(-7), new Date(ahora - 40 * 60000).toISOString(), aLas(7)])
  check('con la hora ya pasada y sin pareos: «Pareando la jornada 2… (era hace 40 min)»', /^Pareando la jornada 2… \(era hace 40 min\)$/.test(pasada.b.titular), pasada.b.titular)
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
