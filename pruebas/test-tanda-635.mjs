// Tanda 635 — en una LIGA, una lista por jornada y cada jornada se cierra
// por separado.
//
// PINGU: «en una liga puedes jugar distintas jornadas con distintos
// mazos, por lo tanto tienes que enviar una decklist en cada jornada, no
// importa si es la misma todas las jornadas […] y a la hora de cerrar
// inscripciones que no se cierren para toda la liga y que solo se
// cierren para la jornada que quieras». Eligió: sin lista no juega esa
// jornada; cerrar congela quién la juega y con qué lista; la liga admite
// gente nueva mientras quede una jornada abierta.
//
// Lo que se prueba:
//   1. «Tus jornadas»: una fila por jornada, «Enviar lista» lleva a «Tu
//      decklist» con esa jornada y la lista anterior ya puesta; guardar la
//      manda por la RPC; «No juego» la retira.
//   2. El organizador: inscripciones por jornada, cerrar una sola, no se
//      empareja sin cerrar, y el pareo sienta solo a quien tiene lista —
//      leída en el momento— y publica esas listas.
//   3. Con la jornada cerrada no hay botones; y en la siguiente vuelve
//      a jugar quien mande lista.
//   4. Una liga empezada admite gente nueva (el formulario sale y lo dice).
//   5. Sin la migración, ni cajas ni fallos; un torneo normal, como antes.
//   6. La base: sql-jornadas.sql contra PostgreSQL.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const AQUI = dirname(fileURLToPath(import.meta.url))
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const dentroDe = (dias) => new Date(Date.now() + dias * 86400000).toISOString()

const LISTA = 'Pokémon: 4\n4 Pikachu SVI 63\nTrainer: 0\nEnergy: 56\n56 Basic {L} Energy SVE 4\n'
const CARTAS = { pokemon: [{ quantity: 4, name: 'Pikachu', set: 'SVI', number: '63' }], trainer: [], energy: [{ quantity: 56, name: 'Basic {L} Energy', set: 'SVE', number: '4' }], total: 60 }
const GENTE = [['user-1', 'Ash'], ['user-2', 'Misty'], ['user-3', 'Brock'], ['p4', 'Gary'], ['p5', 'Erika'], ['p6', 'Sabrina']]
const JUGADORES = GENTE.map(([id]) => id)

// Una liga de tres jornadas. `jugadas` rondas cerradas; `listas` =
// [usuario, jornada]; `cerradas` = jornadas cerradas por el organizador.
function liga({ jugadas = 1, listas = [], cerradas = [], formato = 'league', estado = 'in_progress', inscritos = JUGADORES } = {}) {
  const rondas = Array.from({ length: jugadas }, (_, i) => ({
    id: `ronda-${i + 1}`, tournament_id: 'torneo-1', round_number: i + 1, phase: 'swiss', status: 'finished', started_at: hace(60 * 24 * (jugadas - i)),
  }))
  const mesas = jugadas >= 1
    ? [['r1-1', 'user-1', 'user-2'], ['r1-2', 'user-3', 'p4'], ['r1-3', 'p5', 'p6']].map(([id, a, b], i) => ({
        id, round_id: 'ronda-1', table_number: i + 1, player_a_id: a, player_b_id: b, status: 'finished', check_in_a_at: hace(1500), check_in_b_at: hace(1500), finished_at: hace(1450),
      }))
    : []
  return {
    __FAKE_PERFILES__: [['admin-1', 'Oak'], ...GENTE].map(([id, username]) => ({ id, username, display_name: username })),
    __FAKE_TORNEOS__: [{
      id: 'torneo-1', slug: 'liga', name: 'Liga del Gimnasio', status: estado, admin_id: 'admin-1', format: formato,
      swiss_rounds: 3, swiss_bo: 1, top_cut_size: 0, checkin_minutes: 10, current_round_id: null, max_players: null,
      matchday_dates: [dentroDe(-1), dentroDe(6), dentroDe(13)], decklist_visibility: 'al_terminar', start_at: dentroDe(-1),
    }],
    __FAKE_INSCRIPCIONES__: inscritos.map((u, i) => ({
      id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: `TCG_${u}`, participation_confirmed_at: hace(3000),
    })),
    __FAKE_RONDAS__: rondas,
    __FAKE_MESAS__: mesas,
    __FAKE_RESULTADOS__: mesas.map((m, i) => ({ id: `res-${i + 1}`, match_id: m.id, result: 'a_wins', winner_id: m.player_a_id })),
    __FAKE_LISTAS_JORNADA__: listas.map(([user_id, matchday]) => ({ tournament_id: 'torneo-1', user_id, matchday, raw_text: LISTA, parsed_cards: CARTAS, submitted_at: hace(100) })),
    __FAKE_JORNADAS_CERRADAS__: cerradas.map((matchday) => ({ tournament_id: 'torneo-1', matchday })),
  }
}

const browser = await chromium.launch()
async function abrir(sem, { sesion = 'user-1', antes = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.abort())
  await page.addInitScript(([s, se, a]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
    if (a) Object.assign(window, a)
  }, [sesion, sem, antes])
  await page.goto(`${BASE}/torneo?slug=liga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}
const pestana = async (page, id) => {
  await page.click(`[data-pestana="${id}"]`).catch(() => {})
  await page.waitForTimeout(250)
}
const filas = (page) =>
  page.$$eval('.torneo-mis-jornadas-fila', (fs) =>
    fs.map((f) => ({
      texto: f.textContent.replace(/\s+/g, ' ').trim(),
      botones: [...f.querySelectorAll('.torneo-jornada-cambiar')].map((b) => b.textContent.trim()),
    }))
  )
const tablas = (page) => page.evaluate(() => window.__TABLAS__)
const rpcs = (page, nombre) => page.evaluate((n) => (window.__RPCS__ || []).filter((r) => r.nombre === n), nombre)
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.toast, [class*="toast"]')].map((t) => t.textContent).join(' | '))

// ═════════════════════════════════════════════════════════════════════
console.log('── 1. Tus jornadas y tu lista de cada una ──')
{
  const { page, errores } = await abrir(liga({ listas: [['user-1', 1]] }))
  await pestana(page, 'torneo')
  let f = await filas(page)
  check('una fila por jornada (3)', f.length === 3, JSON.stringify(f))
  check('  …la J1, jugada: «Juegas» y «Ya empezó», sin botones', /Juegas/.test(f[0]?.texto) && /Ya empezó/.test(f[0]?.texto) && !f[0]?.botones.length, f[0]?.texto)
  check('  …la J2, sin lista: «Sin lista» y «Enviar lista»', /Sin lista/.test(f[1]?.texto) && f[1]?.botones.join() === 'Enviar lista', JSON.stringify(f[1]))
  check('  …sin los dos pasos de un torneo normal', !(await page.locator('.torneo-pasos').count()))
  await page.click('.torneo-jornada-cambiar[data-jornada="2"][data-accion="lista"]')
  await page.waitForTimeout(500)
  check('«Enviar lista» lleva a «Tu decklist», con la J2 elegida', (await page.locator('#torneoDecklistCaja').isVisible()) && (await page.locator('#decklistJornada').inputValue()) === '2')
  const texto = await page.locator('#decklistTexto').inputValue()
  check('  …con la lista de la J1 puesta, para guardarla tal cual', texto.includes('4 Pikachu SVI 63'), texto.slice(0, 60))
  check('  …y lo dice', /Abajo tienes la de la jornada 1/.test(await page.locator('#decklistContenido').textContent()))
  await page.click('#btnGuardarDecklist')
  await page.waitForTimeout(900)
  const r = await rpcs(page, 'torneos_lista_jornada')
  check('guardar la manda a la base: torneos_lista_jornada(J2)', r.length === 1 && r[0].args.p_jornada === 2 && r[0].args.p_texto.includes('Pikachu') && r[0].args.p_cartas?.total === 60, JSON.stringify(r.map((x) => x.args.p_jornada)))
  check('  …y no toca la lista general del torneo (eso es al emparejar)', !(await tablas(page)).tournament_decklists.some((d) => d.user_id === 'user-1'))
  await pestana(page, 'torneo')
  f = await filas(page)
  check('  …y la J2 pasa a «Juegas», con «Cambiar lista» y «No juego»', /Juegas/.test(f[1]?.texto) && f[1]?.botones.join() === 'Cambiar lista,No juego', JSON.stringify(f[1]))
  await page.click('.torneo-jornada-cambiar[data-jornada="2"][data-accion="quitar"]')
  await page.waitForTimeout(900)
  f = await filas(page)
  check('«No juego» la retira (vuelve a «Sin lista»)', /Sin lista/.test(f[1]?.texto) && !(await tablas(page)).tournament_matchday_decklists.some((d) => d.user_id === 'user-1' && d.matchday === 2), f[1]?.texto)
  // «Enviar lista» de la J3 (que no es la primera abierta) abre la J3.
  await pestana(page, 'torneo')
  await page.click('.torneo-jornada-cambiar[data-jornada="3"][data-accion="lista"]')
  await page.waitForTimeout(500)
  check('«Enviar lista» de la J3 abre la J3, no la primera abierta', (await page.locator('#decklistJornada').inputValue()) === '3')
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // El selector de jornada de «Tu decklist» enseña la de cada una.
  const { page } = await abrir(liga({ listas: [['user-1', 1]], cerradas: [2] }))
  await pestana(page, 'jugar')
  const opciones = await page.$$eval('#decklistJornada option', (os) => os.map((o) => o.textContent))
  check('en «Tu decklist» se elige la jornada, con su estado', opciones.length === 3 && /con lista/.test(opciones[0]) && /no la juegas/.test(opciones[1]) && /sin lista/.test(opciones[2]), opciones.join(' | '))
  check('  …y abre en la primera abierta (la J3, porque la J2 está cerrada)', (await page.locator('#decklistJornada').inputValue()) === '3')
  await page.selectOption('#decklistJornada', '1')
  await page.waitForTimeout(300)
  check('  …la J1, jugada, se ve y no se edita', (await page.locator('#btnGuardarDecklist').count()) === 0 && /Jornada cerrada/.test(await page.locator('#decklistContenido').textContent()))
  await pestana(page, 'torneo')
  const f = await filas(page)
  check('en «Tus jornadas» la J2 cerrada dice «No juegas» y «Cerrada», sin botones', /No juegas/.test(f[1]?.texto) && /Cerrada/.test(f[1]?.texto) && !f[1]?.botones.length, f[1]?.texto)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El organizador cierra una jornada y la empareja ──')
{
  const listas = [['user-1', 2], ['user-2', 2], ['user-3', 2], ['p4', 2], ['user-1', 3]]
  const { page, errores } = await abrir(liga({ listas }), { sesion: 'admin-1' })
  await pestana(page, 'rondas')
  check('sin cerrar la J2 no hay botón de emparejar, y se dice', !(await page.locator('#btnGenerarPareos').count()) && /cierra antes sus inscripciones/.test(await page.locator('#rondasAdmin').textContent()))
  const filasAdmin = await page.$$eval('.torneo-jornadas-admin-fila', (fs) => fs.map((f) => f.textContent.replace(/\s+/g, ' ').trim()))
  check('inscripciones por jornada: J2 y J3 (la J1 ya se jugó), cada una con su cuenta', filasAdmin.length === 2 && /Jornada 2.*Abierta.*4 de 6 con lista/.test(filasAdmin[0]) && /Jornada 3.*1 de 6/.test(filasAdmin[1]), filasAdmin.join(' | '))
  check('  …el botón mide 44', await page.$$eval('.torneo-jornada-cerrar', (bs) => bs.every((b) => b.getBoundingClientRect().height >= 44)))
  await page.click('.torneo-jornada-cerrar[data-jornada="2"]')
  await page.waitForTimeout(1200)
  let T = await tablas(page)
  check('cerrar la J2 cierra SOLO la J2', T.tournament_matchday_closures.map((c) => c.matchday).join() === '2')
  check('  …y sale «Generar pareos de la jornada 2» con quién juega', /Generar pareos de la jornada 2/.test(await page.locator('#btnGenerarPareos').textContent()) && /Juegan la jornada 2 \(4\)/.test(await page.locator('.torneo-aviso-jornada').textContent()) && /Sin lista, no la juegan: Erika, Sabrina/.test(await page.locator('.torneo-aviso-jornada').textContent()), await page.locator('.torneo-aviso-jornada').textContent())
  // Un fallo que tiene que ser IMPOSIBLE: alguien con lista en la base que
  // la página aún no sabía (llegó después del último refresco). Se mete a
  // pelo en la tabla, como si la hubiera mandado justo antes de cerrar.
  await page.evaluate((l) => window.__TABLAS__.tournament_matchday_decklists.push({ tournament_id: 'torneo-1', user_id: 'p5', matchday: 2, raw_text: l, parsed_cards: {}, submitted_at: new Date().toISOString() }), LISTA)
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1500)
  T = await tablas(page)
  const r2 = T.rounds.find((r) => r.round_number === 2)
  const sentados = T.tournament_matches.filter((m) => m.round_id === r2?.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean)
  check('la J2 sienta solo a quien tiene lista (los 4 + Erika, leída al emparejar)', Boolean(r2) && ['user-1', 'user-2', 'user-3', 'p4', 'p5'].every((u) => sentados.includes(u)) && !sentados.includes('p6'), sentados.join(','))
  check('  …con un bye para el impar', T.tournament_matches.some((m) => m.round_id === r2?.id && m.status === 'bye'))
  check('  …nadie retirado por no jugar una jornada', T.tournament_registrations.every((i) => i.status === 'active'))
  check('  …y las listas de la J2 pasan a ser «la» lista (rival, jueces, meta)', (await rpcs(page, 'torneos_publicar_listas_jornada')).some((r) => r.args.p_jornada === 2) && T.tournament_decklists.filter((d) => d.locked_at).length === 5, T.tournament_decklists.length)
  check('  …y la de la J3 de Ash, no (aún no se juega)', T.tournament_decklists.find((d) => d.user_id === 'user-1')?.raw_text === LISTA)
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // Cerrada pero con una sola lista: no se empareja, y se dice por qué.
  const { page } = await abrir(liga({ listas: [['user-1', 2]], cerradas: [2] }), { sesion: 'admin-1' })
  await pestana(page, 'rondas')
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1200)
  const T = await tablas(page)
  check('con una sola lista en la J2, no se empareja', !T.rounds.some((r) => r.round_number === 2))
  check('  …y se dice por qué', /solo un jugador ha mandado su lista/.test(await toasts(page)), await toasts(page))
  // Reabrir la J2.
  await page.click('.torneo-jornada-cerrar[data-jornada="2"]')
  await page.waitForTimeout(1000)
  check('«Reabrir» la vuelve a abrir', !(await tablas(page)).tournament_matchday_closures.length)
  await page.close()
}
{
  // Una carrera que tiene que salir bien: la página cree la J2 cerrada
  // (tiene el botón de emparejar) pero otro organizador la acaba de
  // reabrir. Al emparejar se vuelve a leer y no se empareja.
  const { page } = await abrir(liga({ listas: [['user-1', 2], ['user-2', 2], ['user-3', 2]], cerradas: [2] }), { sesion: 'admin-1' })
  await pestana(page, 'rondas')
  await page.evaluate(() => { window.__TABLAS__.tournament_matchday_closures.length = 0 })
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1200)
  check('si la J2 se reabrió entretanto, no se empareja', !(await tablas(page)).rounds.some((r) => r.round_number === 2))
  check('  …y se dice', /Cierra antes las inscripciones de la jornada 2/.test(await toasts(page)), await toasts(page))
  await page.close()
}
{
  // En la J3, Brock (que no jugó la J2) vuelve si manda lista.
  const sem = liga({ jugadas: 2, listas: [['user-1', 3], ['user-2', 3], ['user-3', 3], ['p6', 3]], cerradas: [3] })
  sem.__FAKE_MESAS__.push(
    ...[['r2-1', 'user-1', 'p4'], ['r2-2', 'user-2', 'p5'], ['r2-3', 'p6', null]].map(([id, a, b], i) => ({
      id, round_id: 'ronda-2', table_number: i + 1, player_a_id: a, player_b_id: b, status: b ? 'finished' : 'bye', finished_at: hace(30),
    }))
  )
  sem.__FAKE_RESULTADOS__.push(
    { id: 'res-r2-1', match_id: 'r2-1', result: 'a_wins', winner_id: 'user-1' },
    { id: 'res-r2-2', match_id: 'r2-2', result: 'a_wins', winner_id: 'user-2' },
    { id: 'res-r2-3', match_id: 'r2-3', result: 'bye', winner_id: 'p6' },
  )
  const { page, errores } = await abrir(sem, { sesion: 'admin-1' })
  await pestana(page, 'rondas')
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1500)
  const T = await tablas(page)
  const r3 = T.rounds.find((r) => r.round_number === 3)
  const sentados = T.tournament_matches.filter((m) => m.round_id === r3?.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean)
  check('en la J3 juegan los cuatro con lista (Brock incluido, que no jugó la J2)', sentados.length === 4 && sentados.includes('user-3') && !sentados.includes('p4'), sentados.join(','))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La jornada 1 en una liga que aún no ha empezado ──')
{
  const { page, errores } = await abrir(liga({ jugadas: 0, estado: 'registration_open', listas: [['user-1', 1], ['user-2', 1], ['user-3', 1]] }), { sesion: 'admin-1' })
  check('en una liga no hay «Cerrar inscripciones» de la liga entera', !(await page.locator('#btnCerrarInscripciones').count()))
  await pestana(page, 'rondas')
  check('  …se cierra cada jornada desde «Rondas»', (await page.locator('.torneo-jornada-cerrar').count()) === 3)
  await page.click('.torneo-jornada-cerrar[data-jornada="1"]')
  await page.waitForTimeout(1200)
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1500)
  const T = await tablas(page)
  const r1 = T.rounds.find((r) => r.round_number === 1)
  const sentados = T.tournament_matches.filter((m) => m.round_id === r1?.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean)
  check('la J1 sienta a los tres con lista', sentados.length === 3 && !sentados.includes('p4'), sentados.join(','))
  check('  …y no retira a los que no la mandaron (no hay «dos pasos» en una liga)', T.tournament_registrations.every((i) => i.status === 'active'))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Entrar en una liga que ya ha empezado ──')
{
  const { page } = await abrir(liga({ inscritos: JUGADORES.filter((u) => u !== 'user-1'), cerradas: [2] }), { sesion: 'user-1' })
  await pestana(page, 'torneo')
  const caja = (await page.locator('#miPlazaContenido').textContent()).replace(/\s+/g, ' ')
  check('la liga en juego enseña el formulario de inscripción', (await page.locator('#formInscripcion').count()) === 1, caja.slice(0, 120))
  check('  …y avisa: 0 puntos y desde la jornada 3 (la 2 está cerrada)', /entras con 0 puntos y juegas desde la jornada 3/.test(caja), caja)
  await page.close()
}
{
  const { page } = await abrir(liga({ inscritos: JUGADORES.filter((u) => u !== 'user-1'), cerradas: [2, 3] }), { sesion: 'user-1' })
  await pestana(page, 'torneo')
  check('sin jornadas abiertas, no hay formulario', !(await page.locator('#formInscripcion').count()) && /no están abiertas/.test(await page.locator('#miPlazaContenido').textContent()))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Sin la migración, y en un torneo normal ──')
{
  const sin = { __SIN_TABLAS__: ['tournament_matchday_closures', 'tournament_matchday_decklists'] }
  const { page, errores } = await abrir(liga(), { sesion: 'admin-1', antes: sin })
  await pestana(page, 'rondas')
  check('sin la migración, el organizador empareja como siempre', (await page.locator('#btnGenerarPareos').count()) === 1 && !(await page.locator('#torneoJornadasAdmin').count()))
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1500)
  const T = await tablas(page)
  check('  …a los seis', T.tournament_matches.filter((m) => m.round_id === T.rounds.find((r) => r.round_number === 2)?.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean).length === 6)
  check('  …sin errores', !errores.length, errores[0])
  await page.close()
}
{
  const sin = { __SIN_TABLAS__: ['tournament_matchday_closures', 'tournament_matchday_decklists'] }
  const { page } = await abrir(liga(), { sesion: 'user-1', antes: sin })
  await pestana(page, 'torneo')
  check('sin la migración, «Tu plaza» no enseña jornadas', !(await page.locator('#torneoMisJornadas').count()))
  await page.close()
}
{
  const { page } = await abrir(liga({ formato: 'standard' }), { sesion: 'user-1' })
  await pestana(page, 'torneo')
  check('un torneo de un día no tiene «Tus jornadas»', !(await page.locator('#torneoMisJornadas').count()) && (await page.locator('#btnBaja').count()) === 1)
  await pestana(page, 'jugar')
  check('  …ni selector de jornada en «Tu decklist»', !(await page.locator('#decklistJornada').count()))
  await page.close()
}
await browser.close()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. La base, contra PostgreSQL ──')
{
  const SQL = readFileSync(`${RAIZ}/supabase-migration-torneos-jornadas.sql`, 'utf8')
  check('sin tablas temporales (tanda 631)', !/create\s+temp/i.test(SQL))
  check('las listas de jornada no se escriben directo (ni una política de escritura)', !/create policy[^;]*for (insert|update|delete|all)/i.test(SQL))
  const ruta = join(AQUI, 'sql-jornadas.sql')
  check('existe sql-jornadas.sql', existsSync(ruta))
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-f', ruta], { encoding: 'utf8', timeout: 30000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 37 && !fallos.length, fallos.slice(0, 3).join(' | ') || salida.slice(-300))
  }
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
