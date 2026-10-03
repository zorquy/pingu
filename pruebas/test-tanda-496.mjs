// Tanda 496 — la repetición de una partida de torneo.
//
// PINGU, de la lista de ideas: «adjuntar la repetición a una partida de un
// torneo: la ven los dos jugadores, y la organización y los jueces cuando
// hay una disputa».
//
//   1. La base, contra PostgreSQL (sql-repeticiones.sql, secciones 12): la
//      adjunta SOLO un jugador de esa mesa y solo una suya, hasta tres (un
//      BO3); la ven los dos jugadores, quien lleva el torneo y un juez
//      aprobado, y nadie más; nadie escribe en la tabla a mano.
//   2. La ficha del torneo: «Adjuntar la repetición» en tu mesa, el
//      desplegable con TUS guardadas (las de contra tu rival primero), el
//      enlace para los demás, «Quitar» solo en la tuya.
//   3. Quién la ve en la ficha: el rival, el organizador y el juez sí; otro
//      jugador y quien no tiene cuenta, no (y sin preguntar a la base).
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()

console.log('\n── 1. La base, contra PostgreSQL ──')
{
  const SQL = leer('supabase-migration-repeticiones.sql')
  check('nadie escribe en la tabla: solo se lee (y lo que deja la política)', /grant select on table public\.tournament_match_replays to authenticated/.test(SQL) && !/grant (insert|update|delete)[^;]*tournament_match_replays/.test(SQL))
  check('la política: los dos jugadores, quien lleva el torneo (torneos_mando) y sus jueces', /m\.player_a_id = auth\.uid\(\)\s+or m\.player_b_id = auth\.uid\(\)\s+or public\.torneos_mando\(r\.tournament_id\)\s+or public\.repeticiones_juez_de\(r\.tournament_id\)/.test(SQL))
  check('adjuntar la COMPARTE (si no, los demás no la abrirían)', /update public\.replays set compartida = true where id = p_repeticion/.test(SQL))
  const ruta = join(AQUI, 'sql-repeticiones.sql')
  const prueba = existsSync(ruta) ? readFileSync(ruta, 'utf8') : ''
  check('sql-repeticiones.sql prueba las mesas de torneo', /12\. La repetición de una partida de torneo/.test(prueba) && /…pero la cuarta no/.test(prueba) && /la jueza PENDIENTE no/.test(prueba))
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-f', ruta], { encoding: 'utf8', timeout: 60000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 60 && !fallos.length, fallos.slice(0, 2).join(' | '))
  }
}

// El torneo: ronda 2 en juego. Ash (user-1) y Misty (user-2) ya han
// terminado su mesa; Brock (user-3) juega la suya contra Gary.
const GENTE = [['p4', 'Gary']]
const semillas = (extra = {}) => ({
  __FAKE_PERFILES__: GENTE.map(([id, username]) => ({ id, username, display_name: username })),
  __FAKE_TORNEOS__: [{ id: 'torneo-1', slug: 'copa', name: 'Copa del Gimnasio', status: 'in_progress', admin_id: 'admin-1', swiss_rounds: 2, top_cut_size: 0, checkin_minutes: 5, current_round_id: 'ronda-2', decklist_visibility: 'al_terminar' }],
  __FAKE_INSCRIPCIONES__: ['user-1', 'user-2', 'user-3', 'p4'].map((u, i) => ({ id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: `TCG_${u}` })),
  __FAKE_RONDAS__: [
    { id: 'ronda-1', round_number: 1, status: 'finished', started_at: hace(60) },
    { id: 'ronda-2', round_number: 2, status: 'active', started_at: hace(10), ends_at: new Date(Date.now() + 40 * 60000).toISOString() },
  ],
  __FAKE_MESAS__: [
    ['r1-1', 'ronda-1', 1, 'user-1', 'p4', 'finished'],
    ['r1-2', 'ronda-1', 2, 'user-2', 'user-3', 'finished'],
    ['mesa-1', 'ronda-2', 1, 'user-1', 'user-2', 'finished'],
    ['mesa-2', 'ronda-2', 2, 'user-3', 'p4', 'active'],
  ].map(([id, round_id, table_number, a, b, status]) => ({ id, round_id, table_number, player_a_id: a, player_b_id: b, status, check_in_a_at: hace(9), check_in_b_at: hace(9) })),
  __FAKE_RESULTADOS__: [['r1-1', 'a_wins', 'user-1'], ['r1-2', 'a_wins', 'user-2'], ['mesa-1', 'a_wins', 'user-1']].map(([match_id, result, winner_id], i) => ({ id: `res-${i + 1}`, match_id, result, winner_id })),
  __FAKE_JUECES__: [{ id: 'juez-1', tournament_id: 'torneo-1', user_id: 'mod-1', status: 'approved' }],
  // Las guardadas de Ash: la de contra Misty (por su nombre de TCG Live) es
  // la VIEJA, para ver que sale primero igual.
  __FAKE_REPETICIONES__: [
    { id: 'rep-otra-1', user_id: 'user-1', titulo: 'Amistosa del martes', jugador_a: 'TCG_user-1', jugador_b: 'Rival cualquiera', created_at: hace(5) },
    { id: 'rep-misty1', user_id: 'user-1', titulo: 'Ronda 2 contra Misty', jugador_a: 'tcg_USER-2', jugador_b: 'TCG_user-1', created_at: hace(30) },
    { id: 'rep-misty2', user_id: 'user-2', titulo: 'La mía de Misty', jugador_a: 'TCG_user-2', jugador_b: 'TCG_user-1', created_at: hace(20) },
  ],
  ...extra,
})
const browser = await chromium.launch()
async function abrir({ sesion = 'user-1', extra = {}, ancho = 1280 } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, se]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
  }, [sesion, semillas(extra)])
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const ADJUNTA = { __FAKE_REPETICIONES_MESA__: [{ match_id: 'mesa-1', user_id: 'user-1', replay_id: 'rep-misty1' }] }
const enlacesEn = (page, sel) => page.$$eval(`${sel} .torneo-rep a`, (xs) => xs.map((x) => `${x.textContent.trim()}|${x.getAttribute('href')}`))

console.log('\n── 2. Adjuntar desde tu mesa ──')
{
  const { page, errores } = await abrir()
  const boton = page.locator('#miPartidaContenido [data-adjuntar-rep="mesa-1"]')
  check('tu mesa terminada ofrece «Adjuntar la repetición»', (await boton.count()) === 1 && (await boton.textContent()).trim() === 'Adjuntar la repetición')
  check('  …y la mesa de otros (en «Mesas») no', (await page.locator('#mesasContenido [data-adjuntar-rep="mesa-2"]').count()) === 0)
  await boton.click()
  const sel = page.locator('#miPartidaContenido select.torneo-rep-elegir')
  await sel.waitFor({ timeout: 4000 })
  const opciones = await sel.locator('option').allTextContents()
  check('el desplegable tiene TUS guardadas, la de contra tu rival primero y dicho', opciones.join(' / ') === 'Elige una de tus repeticiones… / Ronda 2 contra Misty — contra tu rival / Amistosa del martes', opciones.join(' / '))
  await sel.selectOption('rep-misty1')
  await page.waitForTimeout(1500)
  const rpc = await page.evaluate(() => window.__RPCS__.find((r) => r.nombre === 'torneos_adjuntar_repeticion')?.args)
  check('elegirla la adjunta por la función, con su mesa', rpc?.p_partida === 'mesa-1' && rpc.p_repeticion === 'rep-misty1', JSON.stringify(rpc))
  const toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' '))
  check('  …y dice quién la ve y que queda compartida', /La ven tu rival y quien lleva o arbitra el torneo, y queda compartida/.test(toast), toast)
  await page.waitForSelector('#miPartidaContenido .torneo-rep a', { timeout: 6000 }).catch(() => null)
  check('  …sale como «Tu repetición», con «Quitar» y sitio para otra', (await enlacesEn(page, '#miPartidaContenido')).join() === 'Tu repetición|/repeticiones?r=rep-misty1' && (await page.locator('#miPartidaContenido [data-quitar-rep="mesa-1"]').count()) === 1 && (await page.locator('#miPartidaContenido [data-adjuntar-rep]').textContent()).trim() === 'Adjuntar otra repetición')
  await page.locator('#miPartidaContenido [data-quitar-rep="mesa-1"]').click()
  await page.waitForTimeout(1500)
  const quitar = await page.evaluate(() => window.__RPCS__.find((r) => r.nombre === 'torneos_quitar_repeticion')?.args)
  check('«Quitar» la desengancha (por la función) y la mesa vuelve a ofrecer adjuntar', quitar?.p_partida === 'mesa-1' && quitar.p_repeticion === 'rep-misty1' && (await page.locator('#miPartidaContenido .torneo-rep').count()) === 0, JSON.stringify(quitar))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Tres ya adjuntas (un BO3): no se ofrece una cuarta.
  const tres = { __FAKE_REPETICIONES_MESA__: ['rep-otra-1', 'rep-misty1', 'rep-x'].map((replay_id) => ({ match_id: 'mesa-1', user_id: 'user-1', replay_id })) }
  const { page } = await abrir({ extra: tres })
  check('con tres tuyas (un BO3 entero) no se ofrece una cuarta', (await page.locator('#miPartidaContenido [data-adjuntar-rep]').count()) === 0)
  check('  …y se numeran: Tu repetición (1), (2), (3)', (await enlacesEn(page, '#miPartidaContenido')).map((x) => x.split('|')[0]).join() === 'Tu repetición (1),Tu repetición (2),Tu repetición (3)')
  await page.close()
}
{
  // Con una ya puesta, «Adjuntar otra» no vuelve a ofrecer esa.
  const { page } = await abrir({ extra: ADJUNTA })
  await page.locator('#miPartidaContenido [data-adjuntar-rep="mesa-1"]').click()
  const sel = page.locator('#miPartidaContenido select.torneo-rep-elegir')
  await sel.waitFor({ timeout: 4000 })
  const opciones = await sel.locator('option').allTextContents()
  check('«Adjuntar otra» no ofrece la que ya está puesta', opciones.join(' / ') === 'Elige una de tus repeticiones… / Amistosa del martes', opciones.join(' / '))
  await page.close()
}
{
  // Una mesa sin jugar todavía (pendiente) no tiene partida que adjuntar.
  const pendiente = semillas().__FAKE_MESAS__.map((m) => (m.id === 'mesa-2' ? { ...m, status: 'pending', check_in_a_at: null, check_in_b_at: null } : m))
  const { page } = await abrir({ sesion: 'user-3', extra: { __FAKE_MESAS__: pendiente } })
  check('una mesa pendiente no ofrece adjuntar nada', (await page.locator('[data-adjuntar-rep]').count()) === 0)
  await page.close()
}
{
  // Sin ninguna guardada: lo dice y manda a guardarla.
  const { page } = await abrir({ extra: { __FAKE_REPETICIONES__: [] } })
  await page.locator('#miPartidaContenido [data-adjuntar-rep="mesa-1"]').click()
  await page.waitForTimeout(800)
  check('sin repeticiones guardadas, lo dice y manda a /repeticiones', /No tienes ninguna repetición guardada que adjuntar/.test(await page.textContent('#miPartidaContenido')) && (await page.locator('#miPartidaContenido a[href="/repeticiones"]').count()) === 1)
  await page.close()
}

console.log('\n── 3. Quién la ve ──')
{
  const { page, errores } = await abrir({ sesion: 'user-2', extra: ADJUNTA })
  check('el rival la ve en su mesa, con el nombre de quien la subió', (await enlacesEn(page, '#miPartidaContenido')).join() === 'Repetición de Ash|/repeticiones?r=rep-misty1')
  check('  …sin poder quitarla', (await page.locator('#miPartidaContenido [data-quitar-rep]').count()) === 0)
  check('  …y puede adjuntar la suya', (await page.locator('#miPartidaContenido [data-adjuntar-rep="mesa-1"]').count()) === 1)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
for (const [quien, texto] of [['admin-1', 'quien lleva el torneo'], ['mod-1', 'la jueza aprobada']]) {
  const { page } = await abrir({ sesion: quien, extra: ADJUNTA })
  check(`${texto} la ve en «Mesas», bajo la mesa 1`, (await enlacesEn(page, '#mesasContenido')).join() === 'Repetición de Ash|/repeticiones?r=rep-misty1' && (await page.locator('#mesasContenido [data-adjuntar-rep], #mesasContenido [data-quitar-rep]').count()) === 0)
  await page.close()
}
{
  const { page } = await abrir({ sesion: 'user-3', extra: ADJUNTA })
  check('otro jugador del torneo NO la ve (la base no se la da)', (await page.locator('.torneo-rep').count()) === 0)
  await page.close()
}
{
  const { page } = await abrir({ sesion: 'none', extra: ADJUNTA })
  const veces = await page.evaluate(() => window.__CONSULTAS__.porTabla.tournament_match_replays || 0)
  check('sin cuenta ni se pregunta a la base (como los reportes)', veces === 0 && (await page.locator('.torneo-rep').count()) === 0, veces)
  await page.close()
}

console.log('\n── 4. Lo estático ──')
{
  const JS = leer('js/torneos/ronda.js')
  check('se pide con los reportes, solo para quien juega, lleva o arbitra', /necesitaReportes \? repeticionesDePartidas\(idsPartidas\) : Promise\.resolve\(\[\]\)/.test(JS))
  check('ninguna escritura directa en la tabla (por función)', !/from\('tournament_match_replays'\)\.(insert|upsert|update|delete)/.test(JS + leer('js/repeticiones/datos.js')))
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
