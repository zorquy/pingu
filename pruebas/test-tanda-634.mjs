// Tanda 634 — en una LIGA, cada jugador se apunta o se desapunta de las
// jornadas, siempre antes de que empiecen.
//
// PINGU: «hay que arreglar esto haciendo que te puedas apuntar o
// desapuntar a las jornadas siempre antes de que den comienzo». Antes,
// quien no podía ir a una jornada o no hacía el check-in (su rival
// esperaba y ganaba por incomparecencia) o se daba de baja para siempre.
//
// Lo que se prueba:
//   1. «Tus jornadas» en «Tu plaza»: una fila por jornada, la empezada
//      sin botón y las demás con «Desapuntarme» / «Apuntarme», que
//      llaman a la RPC y repintan.
//   2. El organizador ve quién no juega antes de emparejar, y el pareo
//      NO sienta a quien se desapuntó (leído en el momento, no del último
//      refresco); en la jornada siguiente vuelve a entrar.
//   3. La jornada con pareos ya no se puede cambiar (la base lo dice).
//   4. La jornada 1 (con los dos pasos): desapuntarse no es retirarse.
//   5. Sin la migración, ni caja ni fallos; y un torneo normal no la pinta.
//   6. La base: la migración contra PostgreSQL (sql-jornadas.sql).
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

const GENTE = [['user-1', 'Ash'], ['user-2', 'Misty'], ['user-3', 'Brock'], ['p4', 'Gary'], ['p5', 'Erika'], ['p6', 'Sabrina']]
const JUGADORES = GENTE.map(([id]) => id)

// Una liga de tres jornadas. `jugadas` = cuántas rondas existen ya
// (cerradas): con 1, la J1 está jugada y la J2 por emparejar.
function liga({ jugadas = 1, ausencias = [], formato = 'league', estado = 'in_progress' } = {}) {
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
      swiss_rounds: 3, swiss_bo: 1, top_cut_size: 0, checkin_minutes: 10, current_round_id: null,
      matchday_dates: [dentroDe(-1), dentroDe(6), dentroDe(13)], decklist_visibility: 'al_terminar', start_at: dentroDe(-1),
    }],
    __FAKE_INSCRIPCIONES__: JUGADORES.map((u, i) => ({
      id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: `TCG_${u}`, participation_confirmed_at: hace(3000),
    })),
    __FAKE_DECKLISTS__: JUGADORES.map((u, i) => ({
      id: `deck-${i + 1}`, tournament_id: 'torneo-1', user_id: u, raw_text: 'Pokémon: 4\n4 Pikachu SVI 63\n',
      parsed_cards: { pokemon: [{ quantity: 4, name: 'Pikachu', set: 'SVI', number: '63' }], trainer: [], energy: [], total: 4 }, submitted_at: hace(3000),
    })),
    __FAKE_RONDAS__: rondas,
    __FAKE_MESAS__: mesas,
    __FAKE_RESULTADOS__: mesas.map((m, i) => ({ id: `res-${i + 1}`, match_id: m.id, result: 'a_wins', winner_id: m.player_a_id })),
    __FAKE_AUSENCIAS__: ausencias.map(([user_id, matchday]) => ({ tournament_id: 'torneo-1', user_id, matchday })),
  }
}

const browser = await chromium.launch()
async function abrir(sem, { sesion = 'user-1', antes = null } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
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
      boton: f.querySelector('.torneo-jornada-cambiar')?.textContent.trim() || null,
    }))
  )
const tablas = (page) => page.evaluate(() => window.__TABLAS__)
const rpcs = (page) => page.evaluate(() => (window.__RPCS__ || []).filter((r) => r.nombre === 'torneos_jornada'))

// ═════════════════════════════════════════════════════════════════════
console.log('── 1. «Tus jornadas», en tu plaza ──')
{
  const { page, errores } = await abrir(liga({ ausencias: [['user-3', 2]] }))
  await pestana(page, 'torneo')
  let f = await filas(page)
  check('una fila por jornada (3)', f.length === 3, JSON.stringify(f))
  check('  …la J1 ya empezó: sin botón', /Jornada 1/.test(f[0]?.texto) && /Ya empezó/.test(f[0]?.texto) && f[0]?.boton === null, f[0]?.texto)
  check('  …la J2 y la J3, que juegas, con «Desapuntarme»', f[1]?.boton === 'Desapuntarme' && f[2]?.boton === 'Desapuntarme' && /Juegas/.test(f[1]?.texto), JSON.stringify(f.slice(1)))
  check('  …y cada una con su fecha', f.every((x) => /·/.test(x.texto)), f.map((x) => x.texto).join(' | '))
  check('  …el botón mide 44', await page.$$eval('.torneo-jornada-cambiar', (bs) => bs.every((b) => b.getBoundingClientRect().height >= 44)))
  await page.click('.torneo-jornada-cambiar[data-jornada="2"]')
  await page.waitForTimeout(900)
  const r = await rpcs(page)
  check('desapuntarse llama a la base: torneos_jornada(J2, no juega)', r.length === 1 && r[0].args.p_jornada === 2 && r[0].args.p_juega === false && r[0].args.p_torneo === 'torneo-1', JSON.stringify(r))
  f = await filas(page)
  check('  …y la fila lo dice: «No juegas» y «Apuntarme»', /No juegas/.test(f[1]?.texto) && f[1]?.boton === 'Apuntarme', f[1]?.texto)
  check('  …la ausencia está en la base', (await tablas(page)).tournament_matchday_absences.some((a) => a.user_id === 'user-1' && a.matchday === 2))
  await page.click('.torneo-jornada-cambiar[data-jornada="2"]')
  await page.waitForTimeout(900)
  f = await filas(page)
  check('volver a apuntarse la quita', f[1]?.boton === 'Desapuntarme' && !(await tablas(page)).tournament_matchday_absences.some((a) => a.user_id === 'user-1'), f[1]?.texto)
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  const { page } = await abrir(liga({ ausencias: [['user-3', 2]] }), { sesion: 'user-3' })
  await pestana(page, 'torneo')
  const f = await filas(page)
  check('Brock, que se desapuntó de la J2, la ve como «No juegas»', /No juegas/.test(f[1]?.texto) && f[1]?.boton === 'Apuntarme', f[1]?.texto)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. El organizador empareja la J2 sin quien no juega ──')
{
  const { page, errores } = await abrir(liga({ ausencias: [['user-3', 2]] }), { sesion: 'admin-1' })
  await pestana(page, 'rondas')
  const boton = page.locator('#btnGenerarPareos')
  check('el botón habla de la jornada', /jornada 2/i.test((await boton.textContent()) || ''), await boton.textContent())
  const aviso = (await page.locator('.torneo-aviso-jornada').textContent().catch(() => '')) || ''
  check('  …y avisa de quién no juega y de que la lista se cierra al generar', /No juega la jornada 2: Brock/.test(aviso) && /la lista se cierra/.test(aviso), aviso)
  // Erika se quita AHORA, después del último refresco de la página.
  await page.evaluate(() => window.__TABLAS__.tournament_matchday_absences.push({ tournament_id: 'torneo-1', user_id: 'p5', matchday: 2 }))
  await boton.click()
  await page.waitForTimeout(1500)
  const T = await tablas(page)
  const r2 = T.rounds.find((r) => r.round_number === 2)
  const mesas = T.tournament_matches.filter((m) => m.round_id === r2?.id)
  const sentados = mesas.flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean)
  check('la J2 se empareja', Boolean(r2) && mesas.length >= 2, JSON.stringify(mesas.map((m) => [m.player_a_id, m.player_b_id])))
  check('  …sin Brock (avisó antes)', !sentados.includes('user-3'), sentados.join(','))
  check('  …ni Erika (se quitó hace un momento: se lee al emparejar)', !sentados.includes('p5'), sentados.join(','))
  check('  …y con los otros cuatro, sin bye', ['user-1', 'user-2', 'p4', 'p6'].every((u) => sentados.includes(u)) && !mesas.some((m) => m.status === 'bye'), sentados.join(','))
  check('  …nadie retirado por no jugar una jornada', T.tournament_registrations.every((i) => i.status === 'active'))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}
{
  // Con la J2 jugada y Brock fuera de ella, la J3 lo vuelve a sentar.
  const sem = liga({ jugadas: 2, ausencias: [['user-3', 2]] })
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
  check('en la J3 Brock vuelve a jugar (no estaba fuera de esa)', sentados.includes('user-3') && sentados.length === 6, sentados.join(','))
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Con los pareos hechos, la jornada se cierra ──')
{
  const sem = liga({ jugadas: 1 })
  sem.__FAKE_RONDAS__.push({ id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, phase: 'swiss', status: 'pending' })
  const { page } = await abrir(sem, { sesion: 'user-1' })
  await pestana(page, 'torneo')
  const f = await filas(page)
  check('la J2, emparejada, ya no tiene botón', /Ya empezó/.test(f[1]?.texto) && f[1]?.boton === null && f[2]?.boton === 'Desapuntarme', JSON.stringify(f))
  const r = await page.evaluate(async () => {
    const { cambiarJornada } = await import('/js/torneos/jornadas.js')
    return (await cambiarJornada('torneo-1', 2, false))?.message || null
  })
  check('  …y la base no deja desapuntarse de ella', /ya ha empezado/.test(r || ''), r)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La jornada 1: desapuntarse no es retirarse ──')
{
  const { page, errores } = await abrir(liga({ jugadas: 0, estado: 'registration_closed', ausencias: [['user-2', 1]] }), { sesion: 'admin-1' })
  await pestana(page, 'rondas')
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1500)
  const T = await tablas(page)
  const r1 = T.rounds.find((r) => r.round_number === 1)
  const sentados = T.tournament_matches.filter((m) => m.round_id === r1?.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean)
  check('la J1 se empareja sin Misty', Boolean(r1) && !sentados.includes('user-2') && sentados.length === 5, sentados.join(','))
  check('  …con un bye para el impar', T.tournament_matches.some((m) => m.round_id === r1?.id && m.status === 'bye'))
  check('  …y Misty sigue inscrita (no retirada)', T.tournament_registrations.find((i) => i.user_id === 'user-2')?.status === 'active')
  check('sin errores', !errores.length, errores[0])
  await page.close()
}

{
  // Si de seis se desapuntan cinco de la J1, no hay con quién emparejar:
  // se dice y no se crea una jornada de un solo jugador.
  const fuera = ['user-2', 'user-3', 'p4', 'p5', 'p6'].map((u) => [u, 1])
  const { page } = await abrir(liga({ jugadas: 0, estado: 'registration_closed', ausencias: fuera }), { sesion: 'admin-1' })
  await pestana(page, 'rondas')
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1500)
  const T = await tablas(page)
  const aviso = await page.evaluate(() => [...document.querySelectorAll('.toast, [class*="toast"]')].map((t) => t.textContent).join(' | '))
  check('con uno solo que juega la J1, no se empareja', !T.rounds.some((r) => r.round_number === 1), JSON.stringify(T.rounds))
  check('  …y se dice por qué', /No quedan suficientes jugadores/.test(aviso), aviso)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Sin la migración, y en un torneo normal ──')
{
  const { page, errores } = await abrir(liga({ ausencias: [['user-3', 2]] }), { sesion: 'admin-1', antes: { __SIN_TABLAS__: ['tournament_matchday_absences'] } })
  await pestana(page, 'rondas')
  check('sin la tabla, el organizador no ve el aviso de la jornada', !(await page.locator('.torneo-aviso-jornada').count()))
  await page.click('#btnGenerarPareos')
  await page.waitForTimeout(1500)
  const T = await tablas(page)
  check('  …y empareja como siempre (a los seis)', T.tournament_matches.filter((m) => m.round_id === T.rounds.find((r) => r.round_number === 2)?.id).flatMap((m) => [m.player_a_id, m.player_b_id]).filter(Boolean).length === 6)
  check('  …sin errores', !errores.length, errores[0])
  await page.close()
}
{
  const { page } = await abrir(liga({ ausencias: [['user-3', 2]] }), { sesion: 'user-1', antes: { __SIN_TABLAS__: ['tournament_matchday_absences'] } })
  await pestana(page, 'torneo')
  check('sin la tabla, «Tu plaza» no enseña jornadas', !(await page.locator('#torneoMisJornadas').count()))
  await page.close()
}
{
  const { page } = await abrir(liga({ formato: 'standard' }), { sesion: 'user-1' })
  await pestana(page, 'torneo')
  check('un torneo de un día no tiene «Tus jornadas»', !(await page.locator('#torneoMisJornadas').count()) && (await page.locator('#btnBaja').count()) === 1)
  await page.close()
}
await browser.close()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. La base, contra PostgreSQL ──')
{
  const SQL = readFileSync(`${RAIZ}/supabase-migration-torneos-jornadas.sql`, 'utf8')
  check('sin tablas temporales (tanda 631)', !/create\s+temp/i.test(SQL))
  check('la tabla se lee (política de select en la misma migración)', /create policy ausencias_leer on public\.tournament_matchday_absences for select using \(true\)/.test(SQL))
  check('  …y no se escribe directo (ni una política de escritura)', !/for (insert|update|delete|all)/i.test(SQL))
  const ruta = join(AQUI, 'sql-jornadas.sql')
  check('existe sql-jornadas.sql', existsSync(ruta))
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-f', ruta], { encoding: 'utf8', timeout: 30000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 12 && !fallos.length, fallos.slice(0, 3).join(' | ') || salida.slice(-300))
  }
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
