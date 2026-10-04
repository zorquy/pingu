// Tanda 555 — la repetición de una MESA, en «Rondas».
//
// PINGU: «que los jueces puedan asociar repeticiones a cada mesa de cada
// ronda para que los jugadores puedan ver la repetición de las mesas […]
// que quieran pasar su log para que los jueces añadan la repetición de su
// partida, y que se quede en el apartado de rondas en los torneos. Puede
// que tengan repetición o puede que no, no es obligatorio».
//
//   1. La base, contra PostgreSQL (sql-repeticiones-de-mesa.sql): la añade
//      SOLO quien lleva el torneo o un juez aprobado, con una suya, hasta
//      tres por mesa; queda pública y compartida; la ve cualquiera que vea
//      la mesa —también sin cuenta— y las de los jugadores siguen privadas.
//      Y sin cuenta, la consulta NO falla entera (lo que pasaba con la
//      política de la 496 para todo el mundo).
//   2. El juez, en «Rondas»: «Añadir la repetición de la mesa», pegar el
//      registro, el aviso si los nombres no son los de la mesa, guardar y
//      añadir por las dos funciones, y «Quitar».
//   3. Quién la ve: sin cuenta, otro jugador, los de la mesa; en cualquier
//      ronda; sin «Añadir» ni «Quitar».
//   4. Sin la migración: ni el botón, ni un error.
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
const REGISTRO = readFileSync(join(AQUI, 'registro-481.txt'), 'utf8').replace(/\r/g, '')

console.log('\n── 1. La base, contra PostgreSQL ──')
{
  const SQL = leer('supabase-migration-torneos-repeticiones-de-mesa.sql')
  check('nadie escribe en la tabla: solo se lee', /grant select on table public\.tournament_match_replays to anon, authenticated/.test(SQL) && !/grant (insert|update|delete|all)[^;]*tournament_match_replays/.test(SQL))
  check('la política de las de JUGADOR se queda en `authenticated` (la de la 496 y esta)', /alter policy tmr_ver on public\.tournament_match_replays to authenticated/.test(SQL) && /create policy tmr_ver on public\.tournament_match_replays for select to authenticated/.test(leer('supabase-migration-repeticiones.sql')))
  const ruta = join(AQUI, 'sql-repeticiones-de-mesa.sql')
  const prueba = existsSync(ruta) ? readFileSync(ruta, 'utf8') : ''
  check('sql-repeticiones-de-mesa.sql prueba las puertas, quién la ve y el orden de las migraciones', /la jueza PENDIENTE|Dawn \(jueza PENDIENTE\)/.test(prueba) && /sin cuenta también se ve/.test(prueba) && /ejecutar DESPUÉS la de las repeticiones/.test(prueba))
  spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-c', 'create database prueba_de_mesa'], { encoding: 'utf8', timeout: 20000 })
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-d', 'prueba_de_mesa', '-f', ruta], { encoding: 'utf8', timeout: 60000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    // Un ERROR suelto también es un fallo: es una consulta que se cae
    // ENTERA (así se vio lo de la política para todo el mundo).
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 45 && !fallos.length, fallos.slice(0, 2).join(' | '))
  }
}

// El torneo de la 496: ronda 2 en juego. Ash (user-1) y Misty (user-2) ya
// han terminado su mesa (la 1); Brock (user-3) juega la 2 contra Gary, y
// Tracey tiene un bye en la 3. Los
// nombres de TCG Live de la mesa 1 son los del registro de pruebas (Rojo y
// Azul), en otra caja, como los escribe la gente.
const semillas = (extra = {}) => ({
  __FAKE_PERFILES__: [{ id: 'p4', username: 'Gary', display_name: 'Gary' }, { id: 'p5', username: 'Tracey', display_name: 'Tracey' }],
  __FAKE_TORNEOS__: [{ id: 'torneo-1', slug: 'copa', name: 'Copa del Gimnasio', status: 'in_progress', admin_id: 'admin-1', swiss_rounds: 2, top_cut_size: 0, checkin_minutes: 5, current_round_id: 'ronda-2', decklist_visibility: 'al_terminar' }],
  __FAKE_INSCRIPCIONES__: [['user-1', 'rojo'], ['user-2', 'AZUL'], ['user-3', 'TCG_user-3'], ['p4', 'TCG_p4'], ['p5', 'TCG_p5']].map(([u, tcg], i) => ({ id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: tcg })),
  __FAKE_RONDAS__: [
    { id: 'ronda-1', round_number: 1, status: 'finished', started_at: hace(60) },
    { id: 'ronda-2', round_number: 2, status: 'active', started_at: hace(10), ends_at: new Date(Date.now() + 40 * 60000).toISOString() },
  ],
  __FAKE_MESAS__: [
    ['r1-1', 'ronda-1', 1, 'user-1', 'p4', 'finished'],
    ['r1-2', 'ronda-1', 2, 'user-2', 'user-3', 'finished'],
    ['mesa-1', 'ronda-2', 1, 'user-1', 'user-2', 'finished'],
    ['mesa-2', 'ronda-2', 2, 'user-3', 'p4', 'active'],
    // Un bye: sin partida que ver, sin botón.
    ['mesa-3', 'ronda-2', 3, 'p5', null, 'bye'],
  ].map(([id, round_id, table_number, a, b, status]) => ({ id, round_id, table_number, player_a_id: a, player_b_id: b, status, check_in_a_at: hace(9), check_in_b_at: hace(9) })),
  __FAKE_RESULTADOS__: [['r1-1', 'a_wins', 'user-1'], ['r1-2', 'a_wins', 'user-2'], ['mesa-1', 'a_wins', 'user-1']].map(([match_id, result, winner_id], i) => ({ id: `res-${i + 1}`, match_id, result, winner_id })),
  __FAKE_JUECES__: [
    { id: 'juez-1', tournament_id: 'torneo-1', user_id: 'mod-1', status: 'approved' },
    { id: 'juez-2', tournament_id: 'torneo-1', user_id: 'mod-2', status: 'pending' },
  ],
  __FAKE_REPETICIONES__: [
    { id: 'rep-mesa1', user_id: 'mod-1', titulo: 'Copa · Ronda 2 · Mesa 1', jugador_a: 'Rojo', jugador_b: 'Azul', compartida: true, created_at: hace(5) },
    { id: 'rep-ash', user_id: 'user-1', titulo: 'La mía', jugador_a: 'Rojo', jugador_b: 'Azul', created_at: hace(6) },
    { id: 'rep-r1', user_id: 'mod-1', titulo: 'Copa · Ronda 1 · Mesa 2', jugador_a: 'AZUL', jugador_b: 'TCG_user-3', compartida: true, created_at: hace(50) },
  ],
  ...extra,
})
const browser = await chromium.launch()
async function abrir({ sesion = 'mod-1', extra = {}, ancho = 1280 } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, se]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
  }, [sesion, semillas(extra)])
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  // La pestaña «Rondas»: lo de los jueces vive ahí, y un botón que está
  // en el DOM de otra pestaña no se puede pulsar (encontrarlo no es verlo).
  await page.click('[data-pestana="rondas"]').catch(() => null)
  await page.waitForTimeout(200)
  return { page, errores }
}
const PUBLICA = { match_id: 'mesa-1', user_id: 'mod-1', replay_id: 'rep-mesa1', publica: true, created_at: hace(5) }
const DE_ASH = { match_id: 'mesa-1', user_id: 'user-1', replay_id: 'rep-ash', publica: false, created_at: hace(6) }
const DE_R1 = { match_id: 'r1-2', user_id: 'mod-1', replay_id: 'rep-r1', publica: true, created_at: hace(50) }
const enlacesDeMesa = (page) => page.$$eval('#mesasContenido .torneo-rep-mesa a', (xs) => xs.map((x) => `${x.textContent.trim()}|${x.getAttribute('href')}`))
const rpc = (page, nombre) => page.evaluate((n) => window.__RPCS__.filter((r) => r.nombre === n).map((r) => r.args), nombre)
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' '))

console.log('\n── 2. El juez, en «Rondas» ──')
{
  const { page, errores } = await abrir()
  const anadir = page.locator('#mesasContenido [data-anadir-de-mesa]')
  const ids = await anadir.evaluateAll((xs) => xs.map((x) => x.dataset.anadirDeMesa))
  check('la jueza ve «Añadir la repetición de la mesa» en las dos mesas con partida (el bye no; y no es obligatorio: nada más)', ids.join() === 'mesa-1,mesa-2' && (await anadir.first().textContent()).trim() === 'Añadir la repetición de la mesa', ids.join())
  check('  …dentro de la caja de «Rondas»', (await page.locator('#torneoRondasCaja [data-anadir-de-mesa="mesa-1"]').count()) === 1)
  check('  …y en «Tu partida» no (no juega, y ahí solo se enlaza)', (await page.locator('#miPartidaContenido [data-anadir-de-mesa]').count()) === 0)
  await page.locator('#mesasContenido [data-anadir-de-mesa="mesa-1"]').click()
  const area = page.locator('#torneoDeMesaTexto')
  await area.waitFor({ timeout: 3000 })
  check('pulsarlo abre el sitio para pegar el registro, con el foco puesto', await area.evaluate((x) => document.activeElement === x))
  check('  …dice que la verá todo el mundo', /La verá todo el mundo en «Rondas», con la mesa/.test(await page.textContent('#mesasContenido .torneo-rep-form')))
  check('  …y el campo tiene su nombre (para un lector de pantalla)', /Registro de TCG Live de la mesa 1/.test(await page.textContent('label[for="torneoDeMesaTexto"]')))
  await area.fill(REGISTRO)
  // Se repinta la tabla (cambiar de ronda y volver): lo pegado sigue ahí.
  await page.locator('[data-ver-ronda="ronda-1"]').click()
  await page.waitForTimeout(300)
  check('en otra ronda el formulario no sale (es de la mesa 1 de la ronda 2)', (await page.locator('#torneoDeMesaTexto').count()) === 0)
  await page.locator('[data-ver-ronda="ronda-2"]').click()
  await page.waitForTimeout(300)
  check('  …y al volver, lo pegado sigue ahí', ((await page.locator('#torneoDeMesaTexto').inputValue()) || '').length === REGISTRO.length)
  await page.locator('[data-guardar-de-mesa="mesa-1"]').click()
  await page.waitForTimeout(1800)
  const g = (await rpc(page, 'repeticiones_guardar'))[0]
  check('guardar: la repetición, a nombre del juez, compartida, con el título del torneo, la ronda y la mesa', g?.p_compartida === true && g.p_titulo === 'Copa del Gimnasio · Ronda 2 · Mesa 1' && g.p_jugadores?.join() === 'Rojo,Azul' && g.p_ganador === 'Rojo', JSON.stringify(g)?.slice(0, 200))
  const a = (await rpc(page, 'torneos_juez_adjuntar_repeticion'))[0]
  const nueva = await page.evaluate(() => window.__RPCS__.find((r) => r.nombre === 'repeticiones_guardar') && window.__TABLAS__?.replays?.find?.((r) => r.user_id === 'mod-1' && r.registro?.length > 1000)?.id)
  check('  …y añadirla a la mesa por la función de los jueces, con la que acaba de guardar', a?.p_partida === 'mesa-1' && typeof a.p_repeticion === 'string' && a.p_repeticion.length === 10 && (nueva == null || nueva === a.p_repeticion), JSON.stringify(a))
  check('  …lo dice', /Repetición añadida a la mesa 1: la ve todo el mundo en «Rondas»/.test(await toasts(page)), await toasts(page))
  await page.waitForSelector('#mesasContenido .torneo-rep-mesa a', { timeout: 6000 }).catch(() => null)
  const enl = await enlacesDeMesa(page)
  check('  …y sale en la mesa: «Repetición de la mesa», con su enlace', enl.length === 1 && enl[0] === `Repetición de la mesa|/repeticiones?r=${a?.p_repeticion}`, enl.join(' · '))
  check('  …con «Quitar», y sitio para otra (un BO3)', (await page.locator('#mesasContenido [data-quitar-de-mesa="mesa-1"]').count()) === 1 && (await page.locator('#mesasContenido [data-anadir-de-mesa="mesa-1"]').textContent()).trim() === 'Añadir otra repetición de la mesa')
  check('  …y el formulario se ha cerrado', (await page.locator('#torneoDeMesaTexto').count()) === 0)
  await page.locator('#mesasContenido [data-quitar-de-mesa="mesa-1"]').click()
  await page.waitForTimeout(1500)
  const q = (await rpc(page, 'torneos_juez_quitar_repeticion'))[0]
  check('«Quitar» la quita por la función, y la mesa vuelve a estar sin ninguna', q?.p_partida === 'mesa-1' && q.p_repeticion === a?.p_repeticion && (await page.locator('#mesasContenido .torneo-rep-mesa').count()) === 0, JSON.stringify(q))
  check('  …diciendo que la repetición sigue guardada', /Quitada de la mesa\. La repetición sigue en tus repeticiones/.test(await toasts(page)))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Los nombres del registro no son los de la mesa 2 (Brock y Gary): se
  // avisa UNA vez, y se puede añadir igual.
  const { page, errores } = await abrir()
  await page.locator('#mesasContenido [data-anadir-de-mesa="mesa-2"]').click()
  await page.locator('#torneoDeMesaTexto').fill(REGISTRO)
  await page.locator('[data-guardar-de-mesa="mesa-2"]').click()
  await page.waitForTimeout(800)
  const aviso = (await page.locator('#mesasContenido .torneo-rep-aviso').textContent().catch(() => '')) || ''
  check('si los jugadores del registro no son los de la mesa, avisa (y dice quiénes son unos y otros)', /Los jugadores del registro \(Rojo y Azul\) no son los nombres de TCG Live de esta mesa \(TCG_user-3 y TCG_p4\)\. ¿Es la partida de la mesa 2\?/.test(aviso), aviso)
  check('  …como alerta, sin guardar nada todavía', (await page.locator('.torneo-rep-aviso[role="alert"]').count()) === 1 && (await rpc(page, 'repeticiones_guardar')).length === 0)
  check('  …y el botón pasa a «Añadirla igual», con lo pegado en su sitio', (await page.locator('[data-guardar-de-mesa="mesa-2"]').textContent()).trim() === 'Añadirla igual' && (await page.locator('#torneoDeMesaTexto').inputValue()).length === REGISTRO.length)
  // Cambiar lo pegado quita el aviso: era del registro de antes.
  await page.locator('#torneoDeMesaTexto').press('End')
  await page.locator('#torneoDeMesaTexto').type(' ')
  check('cambiar lo pegado quita el aviso (era del de antes)', (await page.locator('.torneo-rep-aviso').count()) === 0 && (await page.locator('[data-guardar-de-mesa="mesa-2"]').textContent()).trim() === 'Añadir a la mesa')
  await page.locator('[data-guardar-de-mesa="mesa-2"]').click()
  await page.waitForTimeout(600)
  check('  …y vuelve a avisar con el nuevo', (await page.locator('[data-guardar-de-mesa="mesa-2"]').textContent()).trim() === 'Añadirla igual')
  await page.locator('[data-guardar-de-mesa="mesa-2"]').click()
  await page.waitForTimeout(1800)
  const a = (await rpc(page, 'torneos_juez_adjuntar_repeticion'))[0]
  check('«Añadirla igual» la añade a la mesa 2', a?.p_partida === 'mesa-2', JSON.stringify(a))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Sin pegar nada no se llama a nadie; y si la base dice que no, se cuenta.
  const { page } = await abrir({ extra: { __RPC_ERRORES__: { torneos_juez_adjuntar_repeticion: { code: 'PGRST202', message: 'Could not find the function public.torneos_juez_adjuntar_repeticion' } } } })
  await page.locator('#mesasContenido [data-anadir-de-mesa="mesa-1"]').click()
  await page.locator('[data-guardar-de-mesa="mesa-1"]').click()
  await page.waitForTimeout(500)
  check('sin pegar nada lo pide, sin guardar nada', /Pega primero el registro de la partida/.test(await toasts(page)) && (await rpc(page, 'repeticiones_guardar')).length === 0)
  await page.locator('#torneoDeMesaTexto').fill(REGISTRO)
  await page.locator('[data-guardar-de-mesa="mesa-1"]').click()
  await page.waitForTimeout(1500)
  check('si a la base le falta la función, dice qué fichero hay que poner', /falta poner supabase-migration-torneos-repeticiones-de-mesa\.sql/.test(await toasts(page)), await toasts(page))
  check('  …y el formulario sigue abierto, con lo pegado', (await page.locator('#torneoDeMesaTexto').inputValue()).length === REGISTRO.length && !(await page.locator('[data-guardar-de-mesa="mesa-1"]').isDisabled()))
  await page.close()
}
{
  // Quien lleva el torneo también; una jueza PENDIENTE y un jugador, no.
  const { page } = await abrir({ sesion: 'admin-1' })
  check('quien lleva el torneo también puede añadirla', (await page.locator('#mesasContenido [data-anadir-de-mesa]').count()) === 2)
  await page.close()
  for (const [quien, texto] of [['mod-2', 'una jueza PENDIENTE'], ['user-1', 'un jugador de la mesa'], ['none', 'quien no tiene cuenta']]) {
    const { page: p } = await abrir({ sesion: quien })
    check(`${texto} no tiene el botón`, (await p.locator('[data-anadir-de-mesa], [data-quitar-de-mesa]').count()) === 0)
    await p.close()
  }
}
{
  // Una jueza que además juega (un torneo pequeño): el formulario, en
  // «Rondas»; en «Tu partida», no (solo se enlaza).
  const { page } = await abrir({ sesion: 'user-3', extra: { __FAKE_JUECES__: [{ id: 'juez-9', tournament_id: 'torneo-1', user_id: 'user-3', status: 'approved' }] } })
  check('una jueza que también juega lo tiene en «Rondas» y no en «Tu partida»', (await page.locator('#mesasContenido [data-anadir-de-mesa="mesa-2"]').count()) === 1 && (await page.locator('#miPartidaContenido .torneo-mesa-reps').count()) >= 1 && (await page.locator('#miPartidaContenido [data-anadir-de-mesa]').count()) === 0)
  await page.close()
}
{
  // Tres de mesa (un BO3 entero): no se ofrece una cuarta, y se numeran.
  const tres = ['rep-mesa1', 'rep-x2', 'rep-x3'].map((replay_id, i) => ({ ...PUBLICA, replay_id, created_at: hace(5 - i) }))
  const { page } = await abrir({ extra: { __FAKE_REPETICIONES_MESA__: tres } })
  const enl = await enlacesDeMesa(page)
  check('con tres en la mesa no se ofrece una cuarta', (await page.locator('#mesasContenido [data-anadir-de-mesa="mesa-1"]').count()) === 0 && (await page.locator('#mesasContenido [data-anadir-de-mesa="mesa-2"]').count()) === 1)
  check('  …y se numeran: (1), (2), (3)', enl.map((x) => x.split('|')[0]).join() === 'Repetición de la mesa (1),Repetición de la mesa (2),Repetición de la mesa (3)', enl.join(' · '))
  await page.close()
}

console.log('\n── 3. Quién la ve ──')
const VARIAS = { __FAKE_REPETICIONES_MESA__: [PUBLICA, DE_ASH, DE_R1] }
for (const [quien, texto] of [['none', 'sin cuenta'], ['user-3', 'otro jugador del torneo'], ['user-2', 'Misty, que juega la mesa']]) {
  const { page, errores } = await abrir({ sesion: quien, extra: VARIAS })
  const enl = await enlacesDeMesa(page)
  check(`${texto} ve la de la mesa en «Rondas», con su enlace`, enl.join() === 'Repetición de la mesa|/repeticiones?r=rep-mesa1', enl.join(' · '))
  check('  …sin «Quitar» ni «Añadir»', (await page.locator('[data-quitar-de-mesa], [data-anadir-de-mesa]').count()) === 0)
  if (quien === 'user-2') check('  …y la de Ash (de jugador), también, que es su rival', (await page.$$eval('#miPartidaContenido .torneo-rep:not(.torneo-rep-mesa) a', (xs) => xs.map((x) => x.getAttribute('href')))).join() === '/repeticiones?r=rep-ash')
  else check('  …y la de Ash (de jugador), no', (await page.locator('a[href="/repeticiones?r=rep-ash"]').count()) === 0)
  check('  …sin errores', !errores.length, errores.join(' | '))
  if (quien === 'none') {
    // Cada mesa de CADA ronda: la de la ronda 1, en su ronda.
    await page.locator('[data-ver-ronda="ronda-1"]').click()
    await page.waitForTimeout(300)
    const r1 = await enlacesDeMesa(page)
    check('en la ronda 1, la de su mesa 2', r1.join() === 'Repetición de la mesa|/repeticiones?r=rep-r1', r1.join(' · '))
  }
  await page.close()
}
{
  // Ash ve la de la mesa también en «Tu partida», junto a la suya.
  const { page } = await abrir({ sesion: 'user-1', extra: VARIAS })
  const tu = await page.$$eval('#miPartidaContenido .torneo-rep a', (xs) => xs.map((x) => `${x.textContent.trim()}|${x.getAttribute('href')}`))
  check('en «Tu partida» Ash ve la de la mesa y la suya', tu.join(' · ') === 'Repetición de la mesa|/repeticiones?r=rep-mesa1 · Tu repetición|/repeticiones?r=rep-ash', tu.join(' · '))
  check('  …sin el formulario de los jueces (solo en «Rondas»)', (await page.locator('#miPartidaContenido [data-anadir-de-mesa]').count()) === 0)
  await page.close()
}

console.log('\n── 4. Sin la migración ──')
{
  // Sin la columna no puede haber ninguna de mesa: solo la de Ash.
  const sin = { __FAKE_REPETICIONES_MESA__: [DE_ASH], __SIN_COLUMNAS__: { tournament_match_replays: ['publica'] } }
  const { page, errores } = await abrir({ extra: sin })
  check('a la jueza no se le ofrece un botón que la base no tiene', (await page.locator('[data-anadir-de-mesa]').count()) === 0)
  const enl = await page.$$eval('#mesasContenido .torneo-rep a', (xs) => xs.map((x) => x.getAttribute('href')))
  check('  …y las de jugador se siguen viendo (se pregunta otra vez sin la columna)', enl.join() === '/repeticiones?r=rep-ash', enl.join(' · '))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 5. Lo estático ──')
{
  const JS = leer('js/torneos/ronda.js')
  check('las repeticiones de las mesas se piden para todo el mundo (la base decide cuáles)', /\n\s+repeticionesDePartidas\(idsPartidas\),\n/.test(JS) && !/necesitaReportes \? repeticionesDePartidas/.test(JS))
  check('ninguna escritura directa en la tabla (por función)', !/from\('tournament_match_replays'\)\.(insert|upsert|update|delete)/.test(JS + leer('js/repeticiones/datos.js')))
  check('el formulario solo en «Rondas»', /repeticionesDeMesaHtml\(m, \{ enRondas: true \}\)/.test(JS) && (JS.match(/enRondas: true/g) || []).length === 1)
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde.')
process.exit(fails ? 1 : 0)
