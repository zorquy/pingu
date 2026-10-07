// Tanda 394 — lo que pidió PINGU para los torneos, el 2026-10-01:
//
//   1. «un contador para ver cuántas mesas se han completado, que se vaya
//      actualizando sin recargar la página: 4/7 mesas han terminado»;
//   2. «cuando un jugador no ha hecho el check-in, que su nombre salga en
//      un apartado de los jueces para avisarle y poder darle de baja —
//      esa baja la hará SIEMPRE el juez»;
//   3. «los arquetipos no tienen que salir con ese recuadro dorado»;
//   4. «las listas de los jugadores, una vez termina el torneo, que se
//      abran en otra ventana y no abajo, porque si no, no se ven».
//
// Y lo que salió al hacer el 2: un juez aprobado NO podía escribir nada
// del torneo. Resolver una mesa le decía «Mesa resuelta» y la base no
// tocaba nada. Las dos funciones nuevas se prueban contra PostgreSQL de
// verdad en sql-jueces.sql, que esta prueba corre si hay uno a mano.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const AQUI = dirname(fileURLToPath(import.meta.url))
const { progresoDeMesas, sinCheckin, cierreDeCheckin, TERMINALES } = await import(`${RAIZ}/js/torneos/mesas.js`)

const hace = (min) => new Date(Date.now() - min * 60000).toISOString()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Las cuentas de una ronda (mesas.js) ──')
{
  const R = { id: 'r2', status: 'active', started_at: hace(3) }
  const mesa = (n, a, b, status, extra = {}) => ({ id: `m${n}`, round_id: 'r2', table_number: n, player_a_id: a, player_b_id: b, status, ...extra })
  const mesas = [
    mesa(1, 'a', 'b', 'finished'),
    mesa(2, 'c', 'd', 'active', { check_in_a_at: hace(2) }),
    mesa(3, 'e', 'f', 'forfeit_both'),
    mesa(4, 'g', 'h', 'forfeit_a', { check_in_b_at: hace(2) }),
    mesa(5, 'i', 'j', 'awaiting_confirmation'),
    mesa(6, 'k', null, 'bye'),
    // Una mesa de OTRA ronda no cuenta para esta.
    { ...mesa(7, 'l', 'm', 'active'), round_id: 'r1' },
  ]
  const p = progresoDeMesas(mesas.filter((m) => m.round_id === 'r2'))
  check('cuenta las mesas cerradas', p.terminadas === 3, JSON.stringify(p))
  // El bye nace cerrado: contarlo diría «1/N terminadas» en una ronda
  // recién empezada, y con jugadores impares nunca llegaría a cero.
  check('  …y el BYE no es una mesa', p.total === 5, JSON.stringify(p))
  check('  …ni cuando todo está cerrado salvo él', progresoDeMesas([mesa(1, 'a', 'b', 'active'), mesa(2, 'c', null, 'bye')]).terminadas === 0)
  check('«todas» solo con todas', !p.todas && progresoDeMesas([mesa(1, 'a', 'b', 'finished')]).todas)
  check('  …y una ronda sin mesas no está «toda terminada»', !progresoDeMesas([]).todas && progresoDeMesas([]).total === 0)
  check('los estados terminales son los de siempre', ['finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both'].every((e) => TERMINALES.has(e)) && TERMINALES.size === 5)

  const insc = 'abcdefghijklm'.split('').map((u, i) => ({ id: `i-${u}`, user_id: u, status: u === 'h' ? 'dropped' : 'active' }))
  const reportes = [{ match_id: 'm5', reporter_id: 'i' }]
  const faltan = sinCheckin({ ronda: R, mesas, reportes, inscripciones: insc })
  const quien = faltan.map((f) => f.userId).join(',')
  check('sin check-in: d (en juego), e y f (no vino nadie), g (no vino) y j', quien === 'd,e,f,g,j', quien)
  check('  …no quien terminó su mesa con resultado (a, b)', !/[ab]/.test(quien))
  check('  …ni quien hizo check-in (c, h)', !quien.includes('c') && !quien.includes('h'))
  check('  …ni quien REPORTÓ aunque no pulsara el botón (i)', !quien.includes('i'))
  check('  …ni el del bye (k), ni los de otra ronda (l, m)', !/[klm]/.test(quien))
  const g = faltan.find((f) => f.userId === 'g')
  check('g «no se presentó»: su mesa ya cayó por él', g?.noSePresento === true && g.inscripcionId === 'i-g' && g.mesa === 4 && g.rivalId === 'h', JSON.stringify(g))
  check('d sigue en juego: aún no se sabe', faltan.find((f) => f.userId === 'd')?.noSePresento === false)
  check('e y f, mesa caída por los dos', faltan.filter((f) => /[ef]/.test(f.userId)).every((f) => f.noSePresento))
  // Quien ya está de baja no tiene nada más que hacerle un juez.
  const hBaja = sinCheckin({ ronda: R, mesas: [mesa(1, 'h', 'b', 'active')], inscripciones: insc })
  check('quien ya está de baja no sale', hBaja.every((f) => f.userId !== 'h'), hBaja.map((f) => f.userId).join(','))
  check('ordenados por mesa', faltan.map((f) => f.mesa).join() === [...faltan.map((f) => f.mesa)].sort((x, y) => x - y).join())
  check('ronda sin empezar o cerrada: nadie', !sinCheckin({ ronda: { ...R, status: 'pending' }, mesas, inscripciones: insc }).length &&
    !sinCheckin({ ronda: { ...R, started_at: null }, mesas, inscripciones: insc }).length &&
    !sinCheckin({ ronda: null, mesas, inscripciones: insc }).length)
  check('el cierre del check-in es inicio + minutos', cierreDeCheckin({ started_at: '2026-10-01T10:00:00Z' }, 5) === Date.parse('2026-10-01T10:05:00Z'))
  check('  …y sin inicio no hay cierre', cierreDeCheckin({ started_at: null }, 5) === null)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. La migración: dos puertas para el juez, y nada más ──')
{
  const SQL = leer('supabase-migration-torneos-jueces.sql').replace(/^\s*--.*$/gm, '')
  for (const f of ['torneos_dar_de_baja', 'torneos_resolver_como_juez']) {
    const cuerpo = SQL.match(new RegExp(`create or replace function public\\.${f}\\([\\s\\S]*?end \\$\\$;`))?.[0] || ''
    check(`${f} existe`, Boolean(cuerpo))
    check(`  …es security definer`, /security definer/.test(cuerpo))
    // LA puerta: sin ella, cualquiera con cuenta podría dar de baja a
    // cualquiera, porque la función se salta la RLS.
    check(`  …y su puerta es mando O juez de ESE torneo`, /if not \(torneos_mando\(v_[\w.]+\) or torneos_soy_juez\(v_[\w.]+\)\) then\s*raise exception/.test(cuerpo), cuerpo.slice(0, 120))
  }
  check('solo con cuenta', /revoke all on function public\.torneos_dar_de_baja\(uuid\) from public/.test(SQL) &&
    /grant execute on function public\.torneos_dar_de_baja\(uuid\) to authenticated/.test(SQL) &&
    /grant execute on function public\.torneos_resolver_como_juez\(uuid, text\) to authenticated/.test(SQL))
  check('NO abre las tablas al juez (ni una política nueva)', !/create policy/i.test(SQL))
  const resolver = SQL.match(/function public\.torneos_resolver_como_juez[\s\S]*?end \$\$;/)?.[0] || ''
  check('el juez no corrige mesas cerradas', /if v_m\.status in \('finished', 'bye', 'forfeit_a', 'forfeit_b', 'forfeit_both'\)/.test(resolver))
  check('  …ni empata en el corte', /p_resultado = 'draw' and v_fase = 'top_cut'/.test(resolver))
  check('  …y firma lo que resuelve', /resolved_by\)\s*values \(p_partida, p_resultado, v_ganador, auth\.uid\(\)\)/.test(resolver))
  const baja = SQL.match(/function public\.torneos_dar_de_baja[\s\S]*?end \$\$;/)?.[0] || ''
  check('la baja apunta la ronda en juego (SPEC §6.9)', /dropped_after_round_id = v_ronda/.test(baja) && /select current_round_id into v_ronda/.test(baja))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La prueba contra PostgreSQL ──')
{
  const ruta = join(AQUI, 'sql-jueces.sql')
  check('existe sql-jueces.sql junto a esta prueba', existsSync(ruta))
  const proof = existsSync(ruta) ? readFileSync(ruta, 'utf8') : ''
  check('aplica la migración de verdad', /\\i \/home\/user\/pingu\/supabase-migration-torneos-jueces\.sql/.test(proof))
  check('prueba que un juez da de baja', /Brock \(juez\) da de baja a Gary/.test(proof))
  check('prueba que el juez de OTRO torneo no', /jueza de OTRO torneo/.test(proof))
  check('prueba que no corrige mesas cerradas', /corregir una mesa ya cerrada/.test(proof))
  // Y si hay un PostgreSQL a mano, se corre. Sin él, se dice — no se
  // da por bueno en silencio.
  // Los «ok» salen como NOTICE, que psql escribe por la salida de
  // ERRORES: hay que leer las dos.
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-f', ruta], { encoding: 'utf8', timeout: 30000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 21 && !fallos.length, fallos.slice(0, 2).join(' | '))
  }
}

// ═════════════════════════════════════════════════════════════════════
// El torneo de las pruebas de navegador: ronda 2 de 3 en juego, cuatro
// mesas de verdad y un bye. Ash y Misty ya han terminado; jesus vino y
// Gary no; Brock2 y Erika no han aparecido; Sabrina y Blaine juegan.
const GENTE = [['p4', 'Gary'], ['p5', 'Brock2'], ['p6', 'Erika'], ['p7', 'Sabrina'], ['p8', 'Blaine'], ['p9', 'Giovanni']]
const JUGADORES = ['user-1', 'user-2', 'user-3', ...GENTE.map(([id]) => id)]
function semillas({ empezoHace = 3, checkinMin = 5, estado = 'in_progress' } = {}) {
  const fin = estado === 'finished'
  return {
    __FAKE_PERFILES__: GENTE.map(([id, username]) => ({ id, username, display_name: username })),
    __FAKE_TORNEOS__: [{
      id: 'torneo-1', slug: 'copa', name: 'Copa del Gimnasio', status: estado, admin_id: 'admin-1',
      swiss_rounds: 2, top_cut_size: 0, checkin_minutes: checkinMin, current_round_id: fin ? null : 'ronda-2',
      decklist_visibility: 'al_terminar',
    }],
    __FAKE_INSCRIPCIONES__: JUGADORES.map((u, i) => ({ id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: `TCG_${u}` })),
    __FAKE_RONDAS__: [
      { id: 'ronda-1', round_number: 1, status: 'finished', started_at: hace(60) },
      { id: 'ronda-2', round_number: 2, status: fin ? 'finished' : 'active', started_at: hace(empezoHace), ends_at: new Date(Date.now() + 40 * 60000).toISOString() },
    ],
    __FAKE_MESAS__: [
      ['r1-1', 'ronda-1', 1, 'user-1', 'p4', 'finished'], ['r1-2', 'ronda-1', 2, 'user-2', 'p5', 'finished'],
      ['r1-3', 'ronda-1', 3, 'user-3', 'p6', 'finished'], ['r1-4', 'ronda-1', 4, 'p7', 'p8', 'finished'],
      ['r1-5', 'ronda-1', 5, 'p9', null, 'bye'],
      ['mesa-1', 'ronda-2', 1, 'user-1', 'user-2', 'finished', true, true],
      ['mesa-2', 'ronda-2', 2, 'user-3', 'p4', fin ? 'finished' : 'active', true, fin],
      ['mesa-3', 'ronda-2', 3, 'p5', 'p6', fin ? 'finished' : 'active', fin, fin],
      ['mesa-4', 'ronda-2', 4, 'p7', 'p8', fin ? 'finished' : 'active', true, true],
      ['mesa-5', 'ronda-2', 5, 'p9', null, 'bye'],
    ].map(([id, round_id, table_number, a, b, status, ca, cb]) => ({
      id, round_id, table_number, player_a_id: a, player_b_id: b, status,
      check_in_a_at: round_id === 'ronda-1' || ca ? hace(59) : null,
      check_in_b_at: b && (round_id === 'ronda-1' || cb) ? hace(59) : null,
    })),
    __FAKE_RESULTADOS__: [
      ['r1-1', 'a_wins', 'user-1'], ['r1-2', 'a_wins', 'user-2'], ['r1-3', 'b_wins', 'p6'], ['r1-4', 'a_wins', 'p7'], ['r1-5', 'bye', 'p9'],
      ['mesa-1', 'a_wins', 'user-1'], ...(fin ? [['mesa-2', 'a_wins', 'user-3'], ['mesa-3', 'b_wins', 'p6'], ['mesa-4', 'b_wins', 'p8'], ['mesa-5', 'bye', 'p9']] : []),
    ].map(([match_id, result, winner_id], i) => ({ id: `res-${i + 1}`, match_id, result, winner_id })),
    __FAKE_JUECES__: [{ id: 'juez-1', tournament_id: 'torneo-1', user_id: 'mod-1', status: 'approved' }],
    __FAKE_DECKLISTS__: fin
      ? JUGADORES.map((u, i) => ({
          id: `deck-${i + 1}`, tournament_id: 'torneo-1', user_id: u, raw_text: `Pokémon: 4\n4 Pikachu SVI 63\n`,
          parsed_cards: { pokemon: [{ quantity: 4, name: 'Pikachu', set: 'SVI', number: '63' }], trainer: [], energy: [], total: 4 },
          locked_at: hace(90),
        }))
      : [],
  }
}

const browser = await chromium.launch()
async function abrir(sem, { sesion = 'admin-1', ancho = 1280, alto = 900, antes = null } = {}) {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, se, a]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
    if (a) Object.assign(window, a)
  }, [sesion, sem, antes])
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
// La fila de un jugador por su NOMBRE, no por un trozo de texto: «Erika»
// sale también en la fila de su rival («contra Erika»).
const filaDe = (page, nombre) =>
  page.locator('.torneo-sincheckin-fila').filter({ has: page.locator('strong', { hasText: new RegExp(`^${nombre}$`) }) })
const pestana = async (page, id) => {
  await page.click(`[data-pestana="${id}"]`)
  await page.waitForTimeout(250)
}
// Lo que llega del tiempo real: cambia la base y avisa, como el websocket.
const llegaDeLaBase = async (page, fn, arg) => {
  await page.evaluate(([f, a]) => {
    // eslint-disable-next-line no-new-func
    new Function('T', 'a', f)(window.__TABLAS__, a)
    window.__VIVO__.emitir('torneo-torneo-1')
  }, [fn, arg])
  await page.waitForTimeout(900)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. El contador de mesas, sin recargar ──')
{
  const { page, errores } = await abrir(semillas(), { sesion: 'user-1' })
  // Una marca en la ventana: si la página se recargara, se perdería.
  await page.evaluate(() => { window.__sinRecargar = true })
  const barra = page.locator('#torneoVivaMesas')
  check('la barra viva lleva el contador', await barra.isVisible())
  const texto = async () => (await barra.textContent()).replace(/\s+/g, ' ').trim()
  check('  …dice 1/4: el bye no es una mesa', /\b1\/4\b/.test(await texto()) && /mesas terminadas/i.test(await texto()), await texto())
  check('  …y al lector de pantalla, la frase entera', /1 de 4 mesas han terminado/.test(await barra.locator('.sr-only').textContent()))
  check('  …en una región que avisa sola', (await barra.getAttribute('role')) === 'status')
  check('  …también a quien está jugando (Ash, con su mesa al lado)', /Tu partida contra/.test(await page.locator('#torneoVivaTitular').textContent()))
  const anchoBarra = async () => page.locator('#torneoVivaMesas .torneo-mesas-barra > span').evaluate((n) => n.getBoundingClientRect().width / n.parentElement.getBoundingClientRect().width)
  check('  …y su barrita va por el 25 %', Math.abs((await anchoBarra()) - 0.25) < 0.03, (await anchoBarra()).toFixed(2))

  // Se cierra una mesa EN OTRO SITIO: llega por el tiempo real.
  await llegaDeLaBase(page, `
    const m = T.tournament_matches.find((x) => x.id === 'mesa-4'); m.status = 'finished'
    T.match_results.push({ id: 'res-nuevo', match_id: 'mesa-4', result: 'a_wins', winner_id: 'p7' })`)
  check('una mesa que termina pasa el contador a 2/4', /\b2\/4\b/.test(await texto()), await texto())
  check('  …sin recargar la página', await page.evaluate(() => window.__sinRecargar === true))

  await llegaDeLaBase(page, `
    for (const id of ['mesa-2', 'mesa-3']) { const m = T.tournament_matches.find((x) => x.id === id); m.status = 'forfeit_both' }`)
  check('con todas cerradas, 4/4', /\b4\/4\b/.test(await texto()), await texto())
  check('  …y en verde', (await barra.locator('.torneo-mesas-cuenta').getAttribute('class')).split(/\s+/).includes('completa'))

  await pestana(page, 'rondas')
  const enRondas = page.locator('#mesasContenido .torneo-mesas-progreso')
  check('en la pestaña de rondas, junto al título', await enRondas.isVisible() && /4\/4/.test((await enRondas.textContent()).replace(/\s+/g, ' ')))
  // Una ronda ya cerrada no lo lleva: siempre diría «todas».
  await page.click('[data-ver-ronda="ronda-1"]')
  await page.waitForTimeout(300)
  check('  …pero no en una ronda ya cerrada', (await page.locator('#mesasContenido .torneo-mesas-progreso').count()) === 0)
  check('sin errores', !errores.length, errores[0])
  await page.close()

  // Un espectador: el titular ya no repite la cuenta, la cuenta la lleva
  // el contador.
  const vis = await abrir(semillas(), { sesion: 'none' })
  check('quien solo mira también lo ve', /\b1\/4\b/.test((await vis.page.locator('#torneoVivaMesas').textContent()).replace(/\s+/g, ' ')))
  check('  …con «Ronda en marcha» de titular', (await vis.page.locator('#torneoVivaTitular').textContent()) === 'Ronda en marcha')
  check('  …y sin la caja de los jueces', await vis.page.locator('#torneoSinCheckinCaja').isHidden())
  await vis.page.close()

  // En el móvil la barra no se sale.
  const mv = await abrir(semillas(), { sesion: 'user-1', ancho: 360, alto: 760 })
  const sobra = await mv.page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('[360 px] la barra viva con el contador no desborda', sobra <= 1, `${sobra}px`)
  await mv.page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Sin check-in: la caja de los jueces ──')
{
  // Un JUEZ (Brock, mod-1): no lleva el torneo, es juez aprobado.
  const { page, errores } = await abrir(semillas({ empezoHace: 3 }), { sesion: 'mod-1' })
  check('la pestaña de jueces lleva cuántas cosas esperan', (await page.locator('[data-pestana="jueces"] .torneo-pestana-aviso').textContent()).startsWith('3'))
  check('  …con un rojo de fondo que no es el gris de /torneos',
    (await page.locator('[data-pestana="jueces"] .torneo-pestana-aviso').evaluate((n) => getComputedStyle(n).backgroundColor)) !== 'rgba(127, 127, 127, 0.14)')
  await pestana(page, 'jueces')
  const caja = page.locator('#torneoSinCheckinCaja')
  check('la caja sale, la primera de la pestaña', await caja.isVisible() &&
    (await page.locator('[data-panel="jueces"] > .simple-card:not(.hidden)').first().getAttribute('id')) === 'torneoSinCheckinCaja')
  const nombres = async () => (await page.locator('.torneo-sincheckin-fila strong').allTextContents()).join(',')
  check('salen Gary, Brock2 y Erika — y nadie más', (await nombres()) === 'Gary,Brock2,Erika', await nombres())
  const filaGary = filaDe(page, 'Gary')
  check('  …con su mesa, su rival y su TCG Live', /Mesa 2 · contra jesus · TCG Live: TCG_p4/.test(await filaGary.textContent()))
  check('  …y que aún está en plazo', /Aún en plazo/.test(await filaGary.textContent()))
  check('dice a qué hora se cierra el check-in', /se cierra a las \d\d:\d\d/.test(await caja.textContent()))
  check('el botón es «Dar de baja»', (await filaGary.locator('button').textContent()).trim() === 'Dar de baja')

  // Dar de baja: dos toques, y por la función.
  await filaGary.locator('button').click()
  check('el primer toque pide confirmación', (await filaGary.locator('button').textContent()).trim() === '¿Seguro?')
  check('  …y todavía no ha hecho nada', !(await page.evaluate(() => window.__RPCS__.some((r) => r.nombre === 'torneos_dar_de_baja'))))
  await filaGary.locator('button').click()
  await page.waitForTimeout(1200)
  const llamada = await page.evaluate(() => window.__RPCS__.find((r) => r.nombre === 'torneos_dar_de_baja'))
  check('el segundo llama a torneos_dar_de_baja con SU inscripción', llamada?.args?.p_inscripcion === 'insc-4', JSON.stringify(llamada))
  check('Gary queda de baja en la base', await page.evaluate(() => window.__TABLAS__.tournament_registrations.find((i) => i.id === 'insc-4').status === 'dropped'))
  check('  …y sale de la lista', (await nombres()) === 'Brock2,Erika', await nombres())
  check('  …y la pestaña cuenta uno menos', (await page.locator('[data-pestana="jueces"] .torneo-pestana-aviso').textContent()).startsWith('2'))

  // El JUEZ resuelve una mesa: por su función, no por el update que la
  // base le rechaza en silencio.
  await pestana(page, 'rondas')
  await page.selectOption('[data-resolver="mesa-3"]', 'forfeit_both')
  await page.waitForTimeout(1200)
  const res = await page.evaluate(() => window.__RPCS__.find((r) => r.nombre === 'torneos_resolver_como_juez'))
  check('un juez resuelve por torneos_resolver_como_juez', res?.args?.p_partida === 'mesa-3' && res.args.p_resultado === 'forfeit_both', JSON.stringify(res))
  check('  …y la mesa queda cerrada', await page.evaluate(() => window.__TABLAS__.tournament_matches.find((m) => m.id === 'mesa-3').status === 'forfeit_both'))
  await pestana(page, 'jueces')
  const filaErika = filaDe(page, 'Erika')
  check('quien no vino y ya perdió su mesa sigue en la lista: es a quien hay que dar de baja', await filaErika.count() === 1)
  check('  …marcado «No se presentó»', /No se presentó/.test(await filaErika.textContent()))
  check('sin errores', !errores.length, errores[0])
  await page.close()

  // Pasado el plazo, lo dice.
  const tarde = await abrir(semillas({ empezoHace: 9 }), { sesion: 'mod-1' })
  await pestana(tarde.page, 'jueces')
  check('pasado el plazo: «Plazo cumplido» y «se cerró»', /Plazo cumplido/.test(await tarde.page.locator('#torneoSinCheckinCaja').textContent()) &&
    /se cerró a las/.test(await tarde.page.locator('#torneoSinCheckinCaja').textContent()))
  await tarde.page.close()

  // Quien REPORTÓ estaba ahí, aunque no pulsara el botón.
  const sem = semillas()
  sem.__FAKE_REPORTES__ = [{ id: 'rep-1', match_id: 'mesa-2', reporter_id: 'p4', result: 'loss' }]
  const rep = await abrir(sem, { sesion: 'mod-1' })
  await pestana(rep.page, 'jueces')
  check('quien ha reportado no sale', !/Gary/.test(await rep.page.locator('#torneoSinCheckinCaja').textContent()))
  await rep.page.close()

  // Todos listos: la caja lo dice, y la pestaña no avisa de nada.
  const todos = semillas()
  for (const m of todos.__FAKE_MESAS__) {
    m.check_in_a_at = hace(1)
    if (m.player_b_id) m.check_in_b_at = hace(1)
  }
  const ok = await abrir(todos, { sesion: 'mod-1' })
  await pestana(ok.page, 'jueces')
  check('con todos listos, «Todo el mundo ha hecho check-in»', /Todo el mundo ha hecho check-in/.test(await ok.page.locator('#torneoSinCheckinCaja').textContent()))
  check('  …y sin número en la pestaña', (await ok.page.locator('[data-pestana="jueces"] .torneo-pestana-aviso').count()) === 0)
  await ok.page.close()

  // Un jugador normal no ve nada de esto, ni la cuenta.
  const ju = await abrir(semillas(), { sesion: 'user-3' })
  check('un jugador no ve la caja', await ju.page.locator('#torneoSinCheckinCaja').isHidden())
  check('  …ni el número de la pestaña', (await ju.page.locator('.torneo-pestana-aviso').count()) === 0)
  await ju.page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Sin la migración: se dice, no se finge ──')
{
  // Un JUEZ sin la función: no hay camino viejo que le valga (la base le
  // rechaza el update en silencio), así que se le dice qué falta.
  const j = await abrir(semillas(), { sesion: 'mod-1', antes: { __SIN_RPC__: ['torneos_dar_de_baja', 'torneos_resolver_como_juez'] } })
  await pestana(j.page, 'jueces')
  const fila = filaDe(j.page, 'Gary')
  await fila.locator('button').click()
  await fila.locator('button').click()
  await j.page.waitForTimeout(900)
  const aviso = await j.page.locator('.toast').allTextContents()
  check('al juez se le dice qué SQL falta', aviso.some((t) => /supabase-migration-torneos-jueces\.sql/.test(t)), aviso.join(' | '))
  check('  …y Gary sigue dentro', await j.page.evaluate(() => window.__TABLAS__.tournament_registrations.find((i) => i.id === 'insc-4').status === 'active'))
  check('  …sin intentar el update directo', !(await j.page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').some((e) => e.tabla === 'tournament_registrations'))))
  await pestana(j.page, 'rondas')
  await j.page.selectOption('[data-resolver="mesa-3"]', 'forfeit_both')
  await j.page.waitForTimeout(900)
  check('resolver sin la función tampoco finge', await j.page.evaluate(() => window.__TABLAS__.tournament_matches.find((m) => m.id === 'mesa-3').status === 'active'))
  check('  …y el desplegable vuelve a «Resolver…»', (await j.page.locator('[data-resolver="mesa-3"]').inputValue()) === '')
  await j.page.close()

  // Quien LLEVA el torneo sí tiene camino: el de «Expulsar».
  const o = await abrir(semillas(), { sesion: 'admin-1', antes: { __SIN_RPC__: ['torneos_dar_de_baja'] } })
  await pestana(o.page, 'jueces')
  const filaO = filaDe(o.page, 'Gary')
  await filaO.locator('button').click()
  await filaO.locator('button').click()
  await o.page.waitForTimeout(1200)
  check('el organizador, sin la función, da de baja por la puerta de siempre',
    await o.page.evaluate(() => window.__TABLAS__.tournament_registrations.find((i) => i.id === 'insc-4').status === 'dropped'))
  // Y el organizador resuelve como siempre, sin pasar por la del juez.
  await pestana(o.page, 'rondas')
  await o.page.selectOption('[data-resolver="mesa-2"]', 'a_wins')
  await o.page.waitForTimeout(900)
  check('el organizador resuelve por su camino de siempre',
    !(await o.page.evaluate(() => window.__RPCS__.some((r) => r.nombre === 'torneos_resolver_como_juez'))) &&
    (await o.page.evaluate(() => window.__TABLAS__.tournament_matches.find((m) => m.id === 'mesa-2').status === 'finished')))
  await o.page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Los arquetipos, sin recuadro ──')
{
  const css = leer('css/torneos.css').replace(/\/\*[\s\S]*?\*\//g, '')
  // Contra la FORMA, no contra la regla de antes: ninguna regla que
  // toque «sin catalogar» puede pintar un contorno.
  const reglas = [...css.matchAll(/([^{}]*torneo-arquetipo-sin-catalogar[^{}]*)\{([^}]*)\}/g)]
  check('hay reglas de «sin catalogar» que mirar', reglas.length > 0)
  check('ninguna pinta un contorno ni un borde discontinuo', reglas.every(([, , cuerpo]) => !/outline\s*:\s*[^;]*(dashed|solid|dotted)|border[^:]*:\s*[^;]*dashed/.test(cuerpo)),
    reglas.map(([, sel, c]) => sel.trim() + '{' + c.trim() + '}').join(' ').slice(0, 200))
  // Y en la pantalla, lo que de verdad se ve.
  const { page } = await abrir(semillas(), { sesion: 'admin-1' })
  const estilo = await page.evaluate(() => {
    const s = document.createElement('span')
    s.className = 'torneo-arquetipo torneo-arquetipo-sin-catalogar'
    s.innerHTML = '<img class="torneo-arquetipo-icono es-sprite" alt="" width="30" height="30"><span class="torneo-arquetipo-marco"></span>'
    document.querySelector('main').appendChild(s)
    const [i, m] = [s.querySelector('img'), s.querySelector('.torneo-arquetipo-marco')]
    return [getComputedStyle(i).outlineStyle, getComputedStyle(m).outlineStyle]
  })
  check('un sprite sin catalogar se pinta sin recuadro', estilo.every((o) => o === 'none'), estilo.join(','))
  // La pista para el organizador se queda, pero en el texto de ayuda.
  const chapa = leer('js/torneos/cartas-decklist.js')
  check('  …y el «(sin catalogar)» sigue en el texto de ayuda', /\(sin catalogar\)/.test(chapa))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 8. La lista de un jugador, en su ventana ──')
{
  const { page, errores } = await abrir(semillas({ estado: 'finished' }), { sesion: 'user-1', alto: 800 })
  await pestana(page, 'clasificacion')
  check('ya no hay hueco para la lista debajo de la tabla', (await page.locator('#clasificacionListaRival').count()) === 0)
  const botones = page.locator('[data-ver-lista]')
  check('cada fila lleva «Ver lista»', (await botones.count()) === 9, await botones.count())
  // La del ÚLTIMO de la tabla: es la que antes se abría más lejos.
  const ultimo = botones.last()
  await ultimo.scrollIntoViewIfNeeded()
  await ultimo.click()
  await page.waitForTimeout(900)
  const modal = page.locator('#torneoListaModal')
  check('se abre en una ventana', await modal.isVisible())
  const caja = await modal.locator('.modal-box').boundingBox()
  check('  …dentro de la pantalla, sin tener que bajar', caja && caja.y >= 0 && caja.y + Math.min(caja.height, 200) <= 800, JSON.stringify(caja))
  check('  …con el nombre en el título', /^Lista de /.test(await modal.locator('#torneoListaTitulo').textContent()))
  check('  …y es un diálogo que se anuncia', (await modal.locator('[role="dialog"]').getAttribute('aria-modal')) === 'true' &&
    (await modal.locator('[role="dialog"]').getAttribute('aria-labelledby')) === 'torneoListaTitulo')
  check('  …dice dónde quedó', /\d+\.º · 4 cartas/.test(await modal.textContent()), (await modal.textContent()).replace(/\s+/g, ' ').slice(0, 120))
  check('  …con los botones de exportar', (await modal.locator('.torneo-exportar').count()) === 1)
  check('  …y el texto, plegado', (await modal.locator('details.torneo-lista-texto pre').count()) === 1 && !(await modal.locator('details.torneo-lista-texto').evaluate((d) => d.open)))
  check('el foco va al botón de cerrar', await page.evaluate(() => document.activeElement?.id === 'btnCerrarListaRival'))

  // El refresco de la ficha NO la cierra.
  await page.evaluate(() => window.__VIVO__.emitir('torneo-torneo-1'))
  await page.waitForTimeout(900)
  check('sigue abierta tras un refresco de la ficha', await modal.isVisible())

  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  check('Escape la cierra', await modal.isHidden())
  check('  …y el foco vuelve al «Ver lista»', await page.evaluate(() => document.activeElement?.dataset?.verLista !== undefined))
  await botones.first().click()
  await page.waitForTimeout(700)
  await page.mouse.click(5, 5)
  await page.waitForTimeout(200)
  check('pulsar fuera también la cierra', await modal.isHidden())
  await botones.first().click()
  await page.waitForTimeout(700)
  await modal.locator('#btnCerrarListaRival').click()
  check('y el ×', await modal.isHidden())
  check('sin errores', !errores.length, errores[0])
  await page.close()

  const mv = await abrir(semillas({ estado: 'finished' }), { sesion: 'user-1', ancho: 360, alto: 740 })
  await pestana(mv.page, 'clasificacion')
  await mv.page.locator('[data-ver-lista]').first().click()
  await mv.page.waitForTimeout(800)
  const m = await mv.page.locator('#torneoListaModal .modal-box').boundingBox()
  check('[360 px] la ventana cabe de ancho', m && m.x >= 0 && m.x + m.width <= 360, JSON.stringify(m))
  const cerrar = await mv.page.locator('#btnCerrarListaRival').boundingBox()
  check('[360 px] el × se toca bien (44 px)', cerrar && cerrar.width >= 43 && cerrar.height >= 43, JSON.stringify(cerrar))
  await mv.page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
