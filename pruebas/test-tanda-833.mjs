// Tanda 833 — Ibai: «cuando quieres iniciar la jornada 2, no hay botón y no
// puedes iniciar la jornada. Ya sea la 2 o cualquiera de las siguientes».
// Lo que había en producción (Liga FDN [Oct-Dic]): la J1 cerrada el 9 de
// octubre y SIN pareos —no se jugó en PokeDoc—. El panel solo ofrece «la
// siguiente ronda» (rondas.length + 1), así que decía «Generar pareos de la
// jornada 1» para siempre. Ahora se puede SALTAR una jornada: queda como «no
// se jugó» (ronda cerrada, sin mesas ni puntos) y el panel pasa a la
// siguiente; se recupera con «Recuperar la jornada N».
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
function liga({ fechas = [dentroDe(-5), dentroDe(2), dentroDe(9)], cerradas = [1], rondas = [], listas = null, estado = 'registration_open', formato = 'league', corte = 0, jornadas = 3 } = {}) {
  const ls = listas ?? [...JUGADORES.map((u) => [u, 1]), ['user-1', 2], ['user-2', 2], ['user-3', 2], ['p4', 2]]
  return {
    __FAKE_PERFILES__: [['admin-1', 'Oak'], ...GENTE].map(([id, username]) => ({ id, username, display_name: username })),
    __FAKE_TORNEOS__: [{
      id: 'torneo-1', slug: 'liga', name: 'Liga FDN', status: estado, admin_id: 'admin-1', format: formato,
      swiss_rounds: jornadas, swiss_bo: 1, top_cut_size: corte, checkin_minutes: 10, round_time_minutes: 50, current_round_id: null, max_players: null,
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
async function abrir(sem, { sesion = 'admin-1' } = {}) {
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
  await page.goto(`${BASE}/torneo?slug=liga`, { waitUntil: 'domcontentloaded' })
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

console.log('── 1. La Liga FDN: J1 cerrada sin pareos y ya pasada de fecha ──')
{
  const { page, errores, dialogos } = await abrir(liga())
  await pestana(page, 'rondas')
  const panel = await texto(page, '#rondasAdmin')
  check('sigue ofreciendo emparejar la J1', /Generar pareos de la jornada 1/.test(await texto(page, '#btnGenerarPareos')))
  check('  …y AL LADO «Saltar la jornada 1»', /Saltar la jornada 1/.test(await texto(page, '#btnSaltarJornada')))
  check('  …con el aviso de que la J1 ya pasó y cómo seguir', /La jornada 1 era el .+ y no tiene pareos/.test(panel) && /pasa a la jornada 2/.test(panel), panel.slice(0, 400))
  check('  …y la línea de tiempo habla de jornadas', /Jornada 1\s*Por jugar/.test(await texto(page, '.torneo-linea')), await texto(page, '.torneo-linea'))

  await clic(page, '#btnSaltarJornada')
  check('saltar pide confirmación y dice qué pasa', dialogos.length === 1 && /no se jugó/.test(dialogos[0]) && /jornada 2/.test(dialogos[0]), dialogos[0])
  let T = await tablas(page)
  const r1 = T.rounds.find((r) => r.round_number === 1)
  check('  …crea la ronda de la J1 ya CERRADA', r1?.status === 'finished' && r1?.phase === 'swiss', JSON.stringify(r1))
  check('  …sin empezar (es la marca de «saltada»)', r1 && !r1.started_at)
  check('  …y sin una sola mesa', !T.tournament_matches.some((m) => m.round_id === r1?.id))
  check('  …la liga pasa a «en juego»', T.tournaments[0].status === 'in_progress', T.tournaments[0].status)
  check('  …y lo dice', /Jornada 1 saltada/.test(await toasts(page)), await toasts(page))

  check('ahora SÍ sale «Generar pareos de la jornada 2»', /Generar pareos de la jornada 2/.test(await texto(page, '#btnGenerarPareos')))
  check('  …con «Saltar la jornada 2» al lado', /Saltar la jornada 2/.test(await texto(page, '#btnSaltarJornada')))
  check('  …la J2 todavía no está pasada: sin aviso de fecha', !/era el/.test(await texto(page, '#rondasAdmin')))
  check('  …y se puede recuperar la J1', /Recuperar la jornada 1/.test(await texto(page, '#btnDeshacerRonda')))
  check('la línea de tiempo dice que la J1 no se jugó', /Jornada 1\s*No se jugó/.test(await texto(page, '.torneo-linea')), await texto(page, '.torneo-linea'))
  check('las mesas de la J1 lo explican', /no se jugó en PokeDoc/.test(await texto(page, '#mesasContenido')), await texto(page, '#mesasContenido'))

  // La J2, entera, con los botones de una liga.
  await clic(page, '#btnGenerarPareos', 1800)
  T = await tablas(page)
  const r2 = T.rounds.find((r) => r.round_number === 2)
  const sentados = T.tournament_matches.filter((m) => m.round_id === r2?.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean)
  check('la J2 se empareja con quien mandó su lista', Boolean(r2) && JUGADORES.every((u) => sentados.includes(u)), sentados.join(','))
  check('  …y sale «Iniciar la jornada 2»', /Iniciar la jornada 2/.test(await texto(page, '#btnIniciarRonda')), await texto(page, '#rondasAdmin'))
  await clic(page, '#btnIniciarRonda', 1800)
  check('  …y luego «Cerrar la jornada 2»', /Cerrar la jornada 2/.test(await texto(page, '#btnCerrarRonda')), await texto(page, '#rondasAdmin'))
  for (let k = 0; k < 2; k++) {
    const s = (await page.$$('[data-resolver]'))[k]
    if (!s) continue
    const opts = await s.$$eval('option', (os) => os.map((o) => o.value).filter(Boolean))
    await s.selectOption(opts[0])
    await page.waitForTimeout(900)
  }
  await clic(page, '#btnCerrarRonda', 1800)
  check('cerrada la J2, sale la J3', /Generar pareos de la jornada 3/.test(await texto(page, '#btnGenerarPareos')), await texto(page, '#rondasAdmin'))
  check('  …la liga NO se ha terminado', (await tablas(page)).tournaments[0].status === 'in_progress')
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 2. Recuperar una jornada saltada ──')
{
  const { page, errores, dialogos } = await abrir(liga())
  await pestana(page, 'rondas')
  await clic(page, '#btnSaltarJornada')
  await clic(page, '#btnDeshacerRonda')
  const T = await tablas(page)
  check('recuperar pide confirmación', dialogos.length === 2 && /recuperar la jornada 1/.test(dialogos[1]), dialogos[1])
  check('  …borra la ronda saltada', !T.rounds.some((r) => r.round_number === 1), JSON.stringify(T.rounds))
  check('  …la liga vuelve a inscripciones abiertas (no a cerradas)', T.tournaments[0].status === 'registration_open', T.tournaments[0].status)
  check('  …y vuelve a ofrecer la J1', /Generar pareos de la jornada 1/.test(await texto(page, '#btnGenerarPareos')))
  check('  …y lo dice', /Jornada 1 recuperada/.test(await toasts(page)), await toasts(page))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 3. Saltar la ÚLTIMA jornada cierra la liga ──')
{
  // J1 jugada (con started_at), J2 por jugar y es la última.
  const jugada = { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'finished', started_at: hace(3000) }
  const { page, errores, dialogos } = await abrir(liga({ jornadas: 2, rondas: [jugada], estado: 'in_progress', fechas: [dentroDe(-9), dentroDe(-3)] }))
  await pestana(page, 'rondas')
  check('la J1 jugada sigue diciendo «Terminada», no «No se jugó»', /Jornada 1\s*Terminada/.test(await texto(page, '.torneo-linea')), await texto(page, '.torneo-linea'))
  check('el aviso de la última dice que cierra la liga', /cierra la liga/.test(await texto(page, '#rondasAdmin')), await texto(page, '#rondasAdmin'))
  await clic(page, '#btnSaltarJornada', 2000)
  check('la confirmación avisa de que es la última', /última jornada/.test(dialogos[0] || ''), dialogos[0])
  const T = await tablas(page)
  check('  …y la liga se termina', T.tournaments[0].status === 'finished', T.tournaments[0].status)
  // Por el camino de la última jornada (sin corte → terminar), no por el
  // respaldo de «no hay jugadores para el corte».
  check('  …y lo dice como el final de la liga', /Liga terminada/.test(await toasts(page)), await toasts(page))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 4. Tus jornadas: la saltada «no se jugó», aunque mandaras lista ──')
{
  const saltada = { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'finished', started_at: null, closed_at: hace(100) }
  const { page, errores } = await abrir(liga({ rondas: [saltada], estado: 'in_progress' }), { sesion: 'user-1' })
  await pestana(page, 'torneo')
  const filas = await page.$$eval('.torneo-mis-jornadas-fila', (fs) => fs.map((f) => f.textContent.replace(/\s+/g, ' ').trim()))
  check('la J1 dice «No se jugó» y no «Juegas»', /No se jugó/.test(filas[0] || '') && !/Juegas/.test(filas[0] || ''), filas[0])
  check('la J2 sigue con tu lista', /Juegas/.test(filas[1] || ''), filas[1])
  check('un jugador no ve el botón de saltar', !(await page.$('#btnSaltarJornada')))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 5. Un torneo de un día no se salta rondas ──')
{
  const { page, errores } = await abrir(liga({ formato: 'standard', estado: 'registration_closed', cerradas: [] }))
  await pestana(page, 'rondas')
  check('sale «Generar pareos de la ronda 1»', /Generar pareos de la ronda 1/.test(await texto(page, '#btnGenerarPareos')))
  check('  …y no hay «Saltar»', !(await page.$('#btnSaltarJornada')))
  check('  …ni la línea habla de jornadas', /Ronda 1/.test(await texto(page, '.torneo-linea')) && !/Jornada/.test(await texto(page, '.torneo-linea')))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
