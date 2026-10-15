// Tanda 850 — «Entre jornadas». PINGU: «acabo de saltar la jornada 1 […]
// ahora pone que el torneo está en juego. Y eso es un error […] no está en
// juego entre jornadas». En la base la liga sigue `in_progress` (así admite
// listas y gente nueva); lo que se ENSEÑA es «Entre jornadas · jornada N»
// cuando ninguna ronda está viva y la última jornada empezada ha acabado.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const dentroDe = (dias) => new Date(Date.now() + dias * 86400000).toISOString()

const LISTA = 'Pokémon: 4\n4 Pikachu SVI 63\nTrainer: 0\nEnergy: 56\n56 Basic {L} Energy SVE 4\n'
const CARTAS = { pokemon: [{ quantity: 4, name: 'Pikachu', set: 'SVI', number: '63' }], trainer: [], energy: [{ quantity: 56, name: 'Basic {L} Energy', set: 'SVE', number: '4' }], total: 60 }
const GENTE = [['user-1', 'Ash'], ['user-2', 'Misty'], ['user-3', 'Brock'], ['p4', 'Gary']]
const JUGADORES = GENTE.map(([id]) => id)

// La Liga FDN en pequeño: tres jornadas, la J1 hace cinco días y CERRADA,
// sin una sola ronda. Todos mandaron lista para la J1 y dos para la J2.
function liga({ fechas = [dentroDe(-5), dentroDe(2), dentroDe(9)], cerradas = [1], rondas = [], listas = null, estado = 'registration_open', formato = 'league', corte = 0, jornadas = 3, rpj = 3 } = {}) {
  const ls = listas ?? [...JUGADORES.map((u) => [u, 1]), ['user-1', 2], ['user-2', 2], ['user-3', 2], ['p4', 2]]
  return {
    __FAKE_PERFILES__: [['admin-1', 'Oak'], ...GENTE].map(([id, username]) => ({ id, username, display_name: username })),
    __FAKE_TORNEOS__: [{
      id: 'torneo-1', slug: 'liga', name: 'Liga FDN', status: estado, admin_id: 'admin-1', format: formato,
      swiss_rounds: jornadas * rpj, rounds_per_matchday: rpj, swiss_bo: 1, top_cut_size: corte, checkin_minutes: 10, round_time_minutes: 50, current_round_id: null, max_players: null,
      matchday_dates: formato === 'league' ? fechas.slice(0, jornadas) : null, decklist_visibility: 'al_terminar', start_at: fechas[0], pairing_seed: 'semilla',
    }],
    __FAKE_INSCRIPCIONES__: JUGADORES.map((u, i) => ({
      id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: `TCG_${u}`, participation_confirmed_at: hace(3000), status: 'active',
    })),
    __FAKE_RONDAS__: rondas,
    __FAKE_LISTAS_JORNADA__: formato === 'league' ? ls.map(([user_id, matchday]) => ({ tournament_id: 'torneo-1', user_id, matchday, raw_text: LISTA, parsed_cards: CARTAS, submitted_at: hace(100) })) : [],
    __FAKE_JORNADAS_CERRADAS__: cerradas.map((matchday) => ({ tournament_id: 'torneo-1', matchday })),
    __FAKE_DECKLISTS__: formato === 'league' ? [] : JUGADORES.map((u, i) => ({ id: `deck-${i}`, tournament_id: 'torneo-1', user_id: u, raw_text: LISTA, parsed_cards: CARTAS, submitted_at: hace(100), locked_at: null })),
  }
}

const browser = await chromium.launch()
async function abrir(sem, { sesion = 'admin-1', ruta = '/torneo?slug=liga' } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  const dialogos = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  page.on('dialog', (d) => {
    dialogos.push(d.message())
    void d.accept()
  })
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(([s, se]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
  }, [sesion, sem])
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores, dialogos }
}
const pestana = async (page, id) => {
  await page.click(`[data-pestana="${id}"]`).catch(() => {})
  await page.waitForTimeout(250)
}
const tablas = (page) => page.evaluate(() => window.__TABLAS__)
const texto = async (page, sel) => ((await page.locator(sel).textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim()
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.toast, [class*="toast"]')].map((t) => t.textContent).join(' | '))
const clic = async (page, sel, espera = 1600) => {
  await page.click(sel)
  await page.waitForTimeout(espera)
}



// La J1 saltada (sus tres rondas, cerradas y sin empezar) y la J2 mañana.
const saltadas = [1, 2, 3].map((n) => ({ id: `ronda-${n}`, tournament_id: 'torneo-1', round_number: n, phase: 'swiss', status: 'finished', started_at: null, closed_at: hace(600) }))
const enPausa = () => liga({ rondas: saltadas, estado: 'in_progress', fechas: [dentroDe(-5), dentroDe(1), dentroDe(8)] })
const resolverTodas = async (page) => {
  for (let k = 0; k < 4; k++) {
    const s = (await page.$$('[data-resolver]'))[k]
    if (!s) break
    const opts = await s.$$eval('option', (os) => os.map((o) => o.value).filter(Boolean))
    await s.selectOption(opts[0])
    await page.waitForTimeout(900)
  }
}

console.log('── 1. La ficha: «Entre jornadas» con la próxima ──')
{
  const { page, errores } = await abrir(enPausa())
  const pill = await texto(page, '#torneoEstado')
  check('la chapa dice «Entre jornadas · jornada 2» con su día', /^Entre jornadas · jornada 2, \S+ \d+ \S+$/.test(pill), pill + ' / ' + errores.join(' | '))
  check('  …sin el punto que late', !(await page.locator('#torneoEstado .torneo-punto').count()))
  check('  …y la base sigue en juego (las listas y apuntarse tarde lo necesitan)', (await tablas(page)).tournaments[0].status === 'in_progress')
  await pestana(page, 'rondas')
  check('el botón de la J2 está ahí', /Generar pareos de la jornada 2/.test(await texto(page, '#btnGenerarPareos')))
  await clic(page, '#btnGenerarPareos', 1800)
  check('  …con la J2 pareada (sin empezar) ya no está «entre jornadas»', /^En juego/.test(await texto(page, '#torneoEstado')), await texto(page, '#torneoEstado'))
  await clic(page, '#btnIniciarRonda', 1800)
  check('  …iniciada, «En juego» con su punto', /^En juego/.test(await texto(page, '#torneoEstado')) && (await page.locator('#torneoEstado .torneo-punto').count()) === 1, await texto(page, '#torneoEstado'))
  await resolverTodas(page)
  await clic(page, '#btnCerrarRonda', 1800)
  check('entre la ronda 1 y la 2 de la MISMA jornada se sigue jugando: «En juego»', /^En juego/.test(await texto(page, '#torneoEstado')), await texto(page, '#torneoEstado'))
  for (let r = 0; r < 2; r++) {
    await clic(page, '#btnGenerarPareos', 1800)
    await clic(page, '#btnIniciarRonda', 1800)
    await resolverTodas(page)
    await clic(page, '#btnCerrarRonda', 1800)
  }
  check('acabada la J2 entera, otra vez «Entre jornadas · jornada 3»', /^Entre jornadas · jornada 3/.test(await texto(page, '#torneoEstado')), await texto(page, '#torneoEstado'))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 2. La lista de /torneos ──')
{
  const sem = enPausa()
  // Y un torneo de un día que SÍ se está jugando, para comparar.
  sem.__FAKE_TORNEOS__.push({ ...sem.__FAKE_TORNEOS__[0], id: 'torneo-2', slug: 'otro', name: 'Torneo del sábado', format: 'standard', swiss_rounds: 4, rounds_per_matchday: 1, matchday_dates: null })
  sem.__FAKE_RONDAS__ = [...saltadas, { id: 'r-otro', tournament_id: 'torneo-2', round_number: 1, phase: 'swiss', status: 'active', started_at: hace(5) }]
  const { page, errores } = await abrir(sem, { ruta: '/torneos' })
  const grupos = await page.$$eval('[data-grupo]', (bs) => bs.map((b) => b.dataset.grupo))
  const tarjetaDe = async (grupo, nombre) => {
    await page.click(`[data-grupo="${grupo}"]`).catch(() => {})
    await page.waitForTimeout(300)
    return ((await page.locator('.torneo-tarjeta', { hasText: nombre }).first().innerText().catch(() => '')) || '').replace(/\s+/g, ' ')
  }
  const liga = await tarjetaDe('porempezar', 'Liga FDN')
  check('la liga entre jornadas va a «Por empezar», no a «En juego»', grupos.includes('porempezar') && /Entre jornadas · J2/i.test(liga), liga)
  check('  …con «Ver la liga» y no «Ver el directo»', /Ver la liga/.test(liga) && !/directo/.test(liga), liga)
  const otro = await tarjetaDe('enjuego', 'Torneo del sábado')
  check('el torneo que se juega sigue en «En juego» con su punto', /en juego/i.test(otro) && (await page.locator('.torneo-tarjeta', { hasText: 'Torneo del sábado' }).locator('.torneo-punto').count()) >= 1, otro)
  check('  …y la liga no está ahí', !/Liga FDN/.test(await texto(page, '.torneos-rejilla')))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
