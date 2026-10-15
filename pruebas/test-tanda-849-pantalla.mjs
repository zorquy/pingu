// Tanda 849 — rondas por jornada en las ligas. PINGU: «tengo una liga con
// 10 jornadas, pero en cada jornada quiero hacer tres rondas […] no pone tres
// rondas por jornada». Una jornada son `rounds_per_matchday` rondas suizas
// seguidas con la misma lista; se salta, se recupera y se cierra entera.
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


// Lo de PINGU: «una liga con 10 jornadas, pero en cada jornada quiero hacer
// tres rondas». Aquí, en pequeño: 3 jornadas de 3 rondas (9 en total), la J1
// cerrada y sin jugar (se intentó y no pudo ser), y para la J2 mandan lista
// tres de los cuatro (Gary no).
const listasJ2 = [...JUGADORES.map((u) => [u, 1]), ['user-1', 2], ['user-2', 2], ['user-3', 2]]
const resolverTodas = async (page) => {
  for (let k = 0; k < 4; k++) {
    const s = (await page.$$('[data-resolver]'))[0]
    if (!s) break
    const opts = await s.$$eval('option', (os) => os.map((o) => o.value).filter(Boolean))
    await s.selectOption(opts[0])
    await page.waitForTimeout(900)
  }
}
const sentadosEn = (T, n) => {
  const r = T.rounds.find((x) => x.round_number === n)
  return T.tournament_matches.filter((m) => m.round_id === r?.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean)
}

console.log('── 1. Saltar la J1 salta sus TRES rondas ──')
{
  const { page, errores, dialogos } = await abrir(liga({ listas: listasJ2 }))
  check('la ficha dice «3 rondas por jornada»', /Liga de 3 jornadas · 3 rondas por jornada/.test(await texto(page, '#torneoFormato')), await texto(page, '#torneoFormato'))
  await pestana(page, 'rondas')
  check('ofrece emparejar la J1 diciendo que es su ronda 1 de 3', /Generar pareos de la jornada 1 \(ronda 1 de 3\)/.test(await texto(page, '#btnGenerarPareos')), await texto(page, '#btnGenerarPareos'))
  check('  …y saltar la jornada 1', /Saltar la jornada 1/.test(await texto(page, '#btnSaltarJornada')))
  const pasos = await page.$$eval('.torneo-paso', (ps) => ps.map((p) => p.textContent.replace(/\s+/g, ' ').trim()))
  check('la línea de tiempo: un paso por JORNADA (3), no por ronda (9)', pasos.length === 3 && pasos.every((p, i) => p.startsWith(`Jornada ${i + 1}`)), pasos.join(' | '))
  await clic(page, '#btnSaltarJornada')
  let T = await tablas(page)
  const saltadas = T.rounds.filter((r) => [1, 2, 3].includes(r.round_number))
  check('saltar crea las rondas 1, 2 y 3, cerradas y sin empezar', saltadas.length === 3 && saltadas.every((r) => r.status === 'finished' && !r.started_at), JSON.stringify(T.rounds.map((r) => [r.round_number, r.status])))
  check('  …y ninguna más', T.rounds.length === 3)
  check('  …lo dice por la jornada', /Jornada 1 saltada/.test(await toasts(page)) && /jornada 2/.test(dialogos[0] || ''), await toasts(page))
  check('ahora toca la J2, ronda 1 de 3', /Generar pareos de la jornada 2 \(ronda 1 de 3\)/.test(await texto(page, '#btnGenerarPareos')), await texto(page, '#rondasAdmin'))
  check('  …y «Recuperar la jornada 1»', /Recuperar la jornada 1/.test(await texto(page, '#btnDeshacerRonda')))
  check('la línea: la J1 no se jugó', /Jornada 1\s*No se jugó/.test(await texto(page, '.torneo-linea')), await texto(page, '.torneo-linea'))

  console.log('── 2. La J2: tres rondas con la misma gente ──')
  await clic(page, '#btnGenerarPareos', 1800)
  T = await tablas(page)
  const r4 = sentadosEn(T, 4)
  check('la ronda 4 (J2·R1) sienta a los tres con lista, y a Gary no', ['user-1', 'user-2', 'user-3'].every((u) => r4.includes(u)) && !r4.includes('p4'), r4.join(','))
  check('  …la J2 queda cerrada para las listas', T.tournament_matchday_closures.some((c) => c.matchday === 2))
  check('  …y sale «Iniciar la ronda 1 de la jornada 2»', /Iniciar la ronda 1 de la jornada 2/.test(await texto(page, '#btnIniciarRonda')), await texto(page, '#rondasAdmin'))
  await clic(page, '#btnIniciarRonda', 1800)
  check('  …la barra viva: «Jornada 2 de 3 · ronda 1 de 3»', /Jornada 2 de 3 · ronda 1 de 3/.test(await texto(page, '#torneoBarraViva')), await texto(page, '#torneoBarraViva'))
  check('  …la línea: «Jornada 2 · R1»', /Jornada 2 · R1/.test(await texto(page, '.torneo-linea')), await texto(page, '.torneo-linea'))
  await resolverTodas(page)
  await clic(page, '#btnCerrarRonda', 1800)
  check('cerrada la R1, sale «Generar la ronda 2 de la jornada 2» (no la J3)', /Generar la ronda 2 de la jornada 2/.test(await texto(page, '#btnGenerarPareos')), await texto(page, '#rondasAdmin'))
  check('  …sin «Saltar» a media jornada', !(await page.$('#btnSaltarJornada')))
  check('  …y la línea dice cuántas van', /Jornada 2\s*1 de 3 rondas/.test(await texto(page, '.torneo-linea')), await texto(page, '.torneo-linea'))
  await clic(page, '#btnGenerarPareos', 1800)
  T = await tablas(page)
  const r5 = sentadosEn(T, 5)
  check('la ronda 5 (J2·R2) con la MISMA gente: Gary sigue fuera', ['user-1', 'user-2', 'user-3'].every((u) => r5.includes(u)) && !r5.includes('p4'), r5.join(','))
  check('  …sin pedir otra vez las listas ni crear otro cierre', T.tournament_matchday_closures.filter((c) => c.matchday === 2).length === 1 && !T.tournament_matchday_closures.some((c) => c.matchday === 3))
  await clic(page, '#btnIniciarRonda', 1800)
  await resolverTodas(page)
  await clic(page, '#btnCerrarRonda', 1800)
  await clic(page, '#btnGenerarPareos', 1800)
  check('la ronda 3 de la J2 es la ronda 6', (await tablas(page)).rounds.some((r) => r.round_number === 6))
  await clic(page, '#btnIniciarRonda', 1800)
  await resolverTodas(page)
  await clic(page, '#btnCerrarRonda', 1800)
  check('acabada la J2, toca la J3 (ronda 1 de 3), con su «Saltar»', /Generar pareos de la jornada 3 \(ronda 1 de 3\)/.test(await texto(page, '#btnGenerarPareos')) && Boolean(await page.$('#btnSaltarJornada')), await texto(page, '#rondasAdmin'))
  check('  …la liga sigue en juego', (await tablas(page)).tournaments[0].status === 'in_progress')

  console.log('── 3. La clasificación de la jornada suma sus tres rondas ──')
  await pestana(page, 'clasificacion')
  const chips = await page.$$eval('[data-ver-clasif]', (cs) => cs.map((c) => c.textContent.trim()))
  check('pestañas: General y Jornada 2 (una, no tres)', JSON.stringify(chips) === JSON.stringify(['General', 'Jornada 2']), chips.join(' | '))
  await page.click('[data-ver-clasif="2"]').catch(() => {})
  await page.waitForTimeout(400)
  const filas = await page.$$eval('#clasificacionContenido table tbody tr', (rs) => rs.length)
  check('  …y en la J2 salen los tres que la jugaron', filas === 3, String(filas))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 4. Recuperar la J1 saltada devuelve sus tres rondas ──')
{
  const { page, errores, dialogos } = await abrir(liga({ listas: listasJ2 }))
  await pestana(page, 'rondas')
  await clic(page, '#btnSaltarJornada')
  await clic(page, '#btnDeshacerRonda')
  const T = await tablas(page)
  check('borra las tres rondas saltadas', T.rounds.length === 0, JSON.stringify(T.rounds.map((r) => r.round_number)))
  check('  …pide confirmación por la jornada', /recuperar la jornada 1/.test(dialogos[1] || ''), dialogos[1])
  check('  …y vuelve a ofrecer la J1', /Generar pareos de la jornada 1/.test(await texto(page, '#btnGenerarPareos')))
  check('  …con la liga en inscripciones abiertas', T.tournaments[0].status === 'registration_open')
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

console.log('── 5. Tus jornadas y el formulario de editar ──')
{
  const { page, errores } = await abrir(liga({ listas: listasJ2 }), { sesion: 'user-1' })
  await pestana(page, 'torneo')
  const filas = await page.$$eval('.torneo-mis-jornadas-fila', (fs) => fs.length)
  check('«Tus jornadas»: tres (las jornadas), no nueve', filas === 3, String(filas))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // Una liga de antes (una ronda por jornada), sin rondas: el campo se puede cambiar.
  const { page, errores } = await abrir(liga({ rpj: 1, jornadas: 10, fechas: Array.from({ length: 10 }, (_, i) => dentroDe(-5 + 7 * i)) }))
  await page.click('#btnEditarTorneo').catch(() => {})
  await page.waitForTimeout(500)
  const campo = page.locator('#editarRondasJornada')
  check('el editor de una liga tiene «Rondas por jornada», activo sin rondas', (await campo.count()) === 1 && !(await campo.isDisabled()), errores.join(' | '))
  await campo.selectOption('3')
  await page.click('#btnGuardarEdicion').catch(() => {})
  await page.waitForTimeout(1200)
  const t = (await tablas(page)).tournaments[0]
  check('  …al guardar con 3: rounds_per_matchday 3 y 30 rondas (10 × 3)', t.rounds_per_matchday === 3 && t.swiss_rounds === 30, JSON.stringify({ rpj: t.rounds_per_matchday, sr: t.swiss_rounds }))
  check('  …y la ficha ya lo dice', /Liga de 10 jornadas · 3 rondas por jornada/.test(await texto(page, '#torneoFormato')), await texto(page, '#torneoFormato'))
  await page.close()
}
{
  const jugada = { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'finished', started_at: hace(3000) }
  // En juego no sale «Editar»; el candado es para una liga con rondas que
  // aún está en inscripciones (una jornada saltada y recuperada a medias, o
  // datos de antes).
  const { page } = await abrir(liga({ rpj: 1, rondas: [jugada], estado: 'registration_closed' }))
  await page.click('#btnEditarTorneo').catch(() => {})
  await page.waitForTimeout(500)
  check('con rondas ya hechas, el campo sale bloqueado', await page.locator('#editarRondasJornada').isDisabled().catch(() => false))
  await page.close()
}
{
  // Sin la migración (la fila no trae la columna) el campo no sale.
  const sem = liga({ rpj: 1 })
  delete sem.__FAKE_TORNEOS__[0].rounds_per_matchday
  const { page, errores } = await abrir(sem)
  await page.click('#btnEditarTorneo').catch(() => {})
  await page.waitForTimeout(500)
  check('sin la columna en la base, no se ofrece el campo y todo sigue igual', !(await page.locator('#editarRondasJornada').count()) && /Liga de 3 jornadas · BO1/.test(await texto(page, '#torneoFormato')) && !errores.length, await texto(page, '#torneoFormato'))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
