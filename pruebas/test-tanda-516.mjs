// Tanda 516 — quién se lleva cada premio, y si ya se le dio.
//
// PINGU, de la lista de ideas: «que el organizador apunte qué se lleva cada
// puesto y salga en la ficha y en la clasificación final; la web no cobra
// nada». Qué se lleva cada puesto ya existía (tanda 352); lo nuevo:
//
//   1. Leer el puesto de texto libre («1.º», «3.º-4.º», «Top 8»,
//      «Finalista», «Todos»…) y cruzarlo con la clasificación FINAL; lo
//      que no se entiende («Mejor lista») no se le asigna a nadie.
//   2. La base (sql-premios-entrega.sql): la marca de «dado» la pone solo
//      quien lleva el torneo, terminado, a quien lo jugó, y por la función.
//   3. La ficha: el bloque con quién se lleva qué, los botones de quien
//      lleva el torneo, lo que ve el jugador y quien no ha entrado, y sin
//      la migración puesta.
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
const C = await import(`${RAIZ}/js/torneos/comun.js`)

console.log('\n── 1. Leer el puesto ──')
{
  const casos = {
    '1º': [1, 1], '1.º': [1, 1], 'Primero': [1, 1], 'Campeón': [1, 1], '2.º puesto': [2, 2], 'Finalista': [2, 2],
    '3º-4º': [3, 4], '3.º y 4.º': [3, 4], 'Del 5º al 8º': [5, 8], '5-8': [5, 8], 'Top 8': [1, 8], 'Semifinalistas': [3, 4], '10.º': [10, 10],
  }
  const malos = Object.entries(casos).filter(([t, [a, b]]) => JSON.stringify(C.puestosDelPremio(t)) !== JSON.stringify({ desde: a, hasta: b }))
  check('los puestos de verdad: números, ordinales, rangos, «Top N» y los nombres', !malos.length, malos.map(([t]) => `${t} → ${JSON.stringify(C.puestosDelPremio(t))}`).join(' | '))
  check('«Todos», «Todos los participantes» y «Participación» son para todo el mundo', ['Todos', 'Todos los participantes', 'Participación'].every((t) => C.puestosDelPremio(t)?.todos === true))
  check('lo que no es un puesto no se le asigna a nadie', ['Mejor lista', 'Sorteo', '', 'Top', '8-3'].every((t) => C.puestosDelPremio(t) === null))
  const orden = ['a', 'b', 'c', 'd', 'e', 'f']
  const r = C.quienSeLleva([{ puesto: '1º', premio: 'X' }, { puesto: '2º-3º', premio: 'Y' }, { puesto: 'Top 8', premio: 'Z' }, { puesto: 'Mejor lista', premio: 'W' }, { puesto: 'Todos', premio: 'V' }, { puesto: '9º', premio: 'U' }], orden)
  check('cruzado con la clasificación final, cada premio con quién se lo lleva', JSON.stringify(r.map((p) => p.jugadores)) === JSON.stringify([['a'], ['b', 'c'], orden, null, orden, []]), JSON.stringify(r.map((p) => p.jugadores)))
  check('  …y sin decidir si se suman: el 1.º sale en el suyo y en el «Top 8», como está escrito', r[0].jugadores.includes('a') && r[2].jugadores.includes('a'))
  check('la marca NO va en las inscripciones (que se leen sin cuenta por columnas: una columna sin migrar tumbaría la ficha)', !C.COLUMNAS_PUBLICAS_INSCRIPCION.some((c) => /prize|premio/i.test(c)) && !/tournament_registrations\s+add column/i.test(leer('supabase-migration-torneos-premios-entrega.sql')))
}

console.log('\n── 2. La base ──')
{
  const ruta = join(AQUI, 'sql-premios-entrega.sql')
  check('sql-premios-entrega.sql existe y prueba la privada y el desmarcar', existsSync(ruta) && /quien jugó la privada sí la ve/.test(readFileSync(ruta, 'utf8')) && /desmarcar la quita/.test(readFileSync(ruta, 'utf8')))
  // En su PROPIA base: la suite corre en dos filas a la vez, y las pruebas
  // de SQL tiran y rehacen tablas con el mismo nombre (tournaments…).
  spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-c', 'create database prueba_premios'], { encoding: 'utf8', timeout: 20000 })
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-d', 'prueba_premios', '-f', ruta], { encoding: 'utf8', timeout: 60000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 17 && !fallos.length, fallos.slice(0, 2).join(' | '))
  }
}

console.log('\n── 3. La ficha ──')
// La Copa, terminada: Ash gana las dos, Misty y jesus una cada uno, Gary
// ninguna. Misty queda por delante de jesus por el desempate (sus rivales
// ganaron más).
const PREMIOS = [
  { puesto: '1º', premio: '50 € en la tienda' },
  { puesto: '2º-3º', premio: 'Un sobre' },
  { puesto: 'Top 8', premio: 'Carta promo' },
  { puesto: 'Mejor lista', premio: 'Tapete' },
  { puesto: 'Todos', premio: 'Pegatina' },
]
const semillas = (extra = {}) => ({
  __FAKE_PERFILES__: [{ id: 'p4', username: 'Gary', display_name: 'Gary' }],
  __FAKE_TORNEOS__: [{ id: 'torneo-1', slug: 'copa', name: 'Copa del Gimnasio', status: 'finished', admin_id: 'admin-1', swiss_rounds: 2, top_cut_size: 0, current_round_id: 'ronda-2', prizes: PREMIOS }],
  __FAKE_INSCRIPCIONES__: ['user-1', 'user-2', 'user-3', 'p4'].map((u, i) => ({ id: `insc-${i + 1}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: `TCG_${u}` })),
  __FAKE_RONDAS__: [
    { id: 'ronda-1', round_number: 1, status: 'finished', started_at: hace(90) },
    { id: 'ronda-2', round_number: 2, status: 'finished', started_at: hace(45) },
  ],
  __FAKE_MESAS__: [
    ['m1', 'ronda-1', 1, 'user-1', 'p4'],
    ['m2', 'ronda-1', 2, 'user-2', 'user-3'],
    ['m3', 'ronda-2', 1, 'user-1', 'user-2'],
    ['m4', 'ronda-2', 2, 'user-3', 'p4'],
  ].map(([id, round_id, table_number, a, b]) => ({ id, round_id, table_number, player_a_id: a, player_b_id: b, status: 'finished' })),
  __FAKE_RESULTADOS__: [['m1', 'user-1'], ['m2', 'user-2'], ['m3', 'user-1'], ['m4', 'user-3']].map(([match_id, winner_id], i) => ({ id: `res-${i + 1}`, match_id, result: 'a_wins', winner_id })),
  ...extra,
})
const browser = await chromium.launch()
async function abrir({ sesion = 'admin-1', extra = {} } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.addInitScript(([s, se]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
  }, [sesion, semillas(extra)])
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('[data-pestana="clasificacion"]', { timeout: 8000 }).catch(() => null)
  await page.click('[data-pestana="clasificacion"]').catch(() => null)
  await page.waitForSelector('.torneo-reparto', { timeout: 4000 }).catch(() => null)
  return { page, errores }
}
const reparto = (page) =>
  page.$$eval('.torneo-reparto-premio', (xs) =>
    xs.map((x) => ({
      puesto: x.querySelector('.torneo-premio-puesto')?.textContent.trim(),
      quien: [...x.querySelectorAll('.torneo-reparto-quien li > span:first-child')].map((s) => s.textContent.trim()),
      nota: x.querySelector('p.subtext')?.textContent.trim() || '',
    }))
  )
{
  const { page, errores } = await abrir()
  const r = await reparto(page)
  check('el bloque «Quién se lleva cada premio» sale en la clasificación del torneo terminado', r.length === 5, JSON.stringify(r).slice(0, 200))
  check('  …el 1.º para Ash, y el 2.º-3.º para Misty y jesus, en el orden final', JSON.stringify(r[0].quien) === '["Ash"]' && JSON.stringify(r[1].quien) === '["Misty","jesus"]', JSON.stringify(r.slice(0, 2)))
  check('  …un «Top 8» con cuatro jugadores, los cuatro', r[2].quien.length === 4)
  check('  …«Mejor lista» lo reparte quien organiza; «Todos», los cuatro sin lista', /Lo reparte quien organiza/.test(r[3].nota) && !r[3].quien.length && r[4].nota === 'Para los 4 participantes.' && !r[4].quien.length, JSON.stringify(r.slice(3)))
  const texto = await page.textContent('.torneo-reparto')
  check('  …y dice que la web no cobra ni paga nada', /PokeDoc no cobra ni paga nada/.test(texto))
  const botones = await page.locator('.torneo-reparto [data-premio-dado][data-si="1"]').count()
  check('quien lleva el torneo tiene «Marcar como dado» en cada persona con premio', botones === 1 + 2 + 4, botones)
  await page.locator('.torneo-reparto-premio').first().locator('[data-premio-dado]').click()
  await page.waitForFunction(() => document.querySelector('.torneo-reparto-premio .torneo-premio-dado'), null, { timeout: 5000 }).catch(() => null)
  const rpc = await page.evaluate(() => window.__RPCS__.find((r) => r.nombre === 'torneos_premio_entregado')?.args)
  check('marcarlo llama a la función con el torneo, la persona y «sí»', rpc?.p_torneo === 'torneo-1' && rpc.p_usuario === 'user-1' && rpc.p_entregado === true, JSON.stringify(rpc))
  const ash = await page.$$eval('.torneo-reparto-quien li', (xs) => xs.filter((x) => x.textContent.includes('Ash')).map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
  check('  …y Ash sale «Dado» en TODOS sus premios (la marca es de la persona), con «Deshacer»', ash.length === 2 && ash.every((t) => /Dado el .* Deshacer$/.test(t)), ash.join(' | '))
  await page.locator('.torneo-reparto [data-premio-dado][data-si="0"]').first().click()
  await page.waitForFunction(() => !document.querySelector('.torneo-reparto .torneo-premio-dado'), null, { timeout: 5000 }).catch(() => null)
  check('«Deshacer» lo quita (por la función, con «no»)', (await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'torneos_premio_entregado').at(-1)?.args.p_entregado)) === false && (await page.locator('.torneo-premio-dado').count()) === 0)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Ash, con su premio ya dado; Misty, sin dar.
  const { page, errores } = await abrir({ sesion: 'user-2', extra: { __FAKE_ENTREGAS__: [{ user_id: 'user-1' }] } })
  check('un jugador no ve botones', (await page.locator('.torneo-reparto [data-premio-dado]').count()) === 0)
  const filas = await page.$$eval('.torneo-reparto-premio:nth-child(2) .torneo-reparto-quien li', (xs) => xs.map((x) => [x.className, x.textContent.replace(/\s+/g, ' ').trim()]))
  check('  …ve su fila marcada y «Pendiente» en la suya', filas[0][0].includes('torneo-fila-yo') && filas[0][1] === 'Misty Pendiente', JSON.stringify(filas))
  check('  …y «Dado» en la de quien ya lo tiene', /Ash Dado el/.test((await page.textContent('.torneo-reparto-premio:first-child')).replace(/\s+/g, ' ')))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  const { page } = await abrir({ sesion: 'none', extra: { __FAKE_ENTREGAS__: [{ user_id: 'user-1' }] } })
  check('sin cuenta se ve el reparto y lo dado, sin botones', (await reparto(page)).length === 5 && /Ash Dado el/.test((await page.textContent('.torneo-reparto')).replace(/\s+/g, ' ')) && (await page.locator('.torneo-reparto [data-premio-dado]').count()) === 0)
  await page.close()
}
{
  // Sin la migración: el reparto sale igual; la marca, no; y quien lleva
  // el torneo sabe qué falta.
  const { page } = await abrir({ extra: { __SIN_TABLAS__: ['tournament_prize_deliveries'] } })
  const texto = await page.textContent('.torneo-reparto')
  check('sin la tabla, el reparto sale igual y sin estados ni botones', (await reparto(page)).length === 5 && (await page.locator('.torneo-reparto [data-premio-dado]').count()) === 0 && !/Pendiente|Dado el/.test(texto))
  check('  …y a quien lleva el torneo se le dice qué migración falta', /Falta ejecutar supabase-migration-torneos-premios-entrega\.sql/.test(texto))
  await page.close()
  const otra = await abrir({ sesion: 'user-2', extra: { __SIN_TABLAS__: ['tournament_prize_deliveries'] } })
  check('  …a un jugador, no (no puede hacer nada con eso)', !/Falta ejecutar/.test(await otra.page.textContent('.torneo-reparto')))
  await otra.page.close()
}
{
  // Con corte a cuatro: Gary (último de las suizas) gana las semis a Ash y
  // la final a Misty. Manda el corte: Gary 1.º y Misty 2.ª; y de los que
  // cayeron en semis, Ash antes que jesus por las suizas. Contando todas las
  // mesas como si fueran suizas saldría Ash 2.º: es justo lo que no tiene
  // que pasar.
  const base = semillas()
  const { page, errores } = await abrir({
    extra: {
      __FAKE_TORNEOS__: [{ ...base.__FAKE_TORNEOS__[0], top_cut_size: 4, current_round_id: 'ronda-4' }],
      __FAKE_RONDAS__: [
        ...base.__FAKE_RONDAS__,
        { id: 'ronda-3', round_number: 3, status: 'finished', phase: 'top_cut', started_at: hace(30) },
        { id: 'ronda-4', round_number: 4, status: 'finished', phase: 'top_cut', started_at: hace(15) },
      ],
      __FAKE_MESAS__: [
        ...base.__FAKE_MESAS__,
        { id: 'm5', round_id: 'ronda-3', table_number: 1, player_a_id: 'user-1', player_b_id: 'p4', status: 'finished' },
        { id: 'm6', round_id: 'ronda-3', table_number: 2, player_a_id: 'user-2', player_b_id: 'user-3', status: 'finished' },
        { id: 'm7', round_id: 'ronda-4', table_number: 1, player_a_id: 'p4', player_b_id: 'user-2', status: 'finished' },
      ],
      __FAKE_RESULTADOS__: [
        ...base.__FAKE_RESULTADOS__,
        { id: 'res-5', match_id: 'm5', result: 'b_wins', winner_id: 'p4' },
        { id: 'res-6', match_id: 'm6', result: 'a_wins', winner_id: 'user-2' },
        { id: 'res-7', match_id: 'm7', result: 'a_wins', winner_id: 'p4' },
      ],
    },
  })
  const r = await reparto(page)
  check('con corte manda el corte: 1.º quien ganó la final (Gary, último en las suizas) y 2.º-3.º Misty y Ash', JSON.stringify(r[0]?.quien) === '["Gary"]' && JSON.stringify(r[1]?.quien) === '["Misty","Ash"]', JSON.stringify(r.slice(0, 2)))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
{
  // Ni sin terminar, ni sin premios.
  const enJuego = await abrir({ extra: { __FAKE_TORNEOS__: [{ ...semillas().__FAKE_TORNEOS__[0], status: 'in_progress' }] } })
  check('con el torneo en juego no hay reparto (aún no hay ganadores)', (await enJuego.page.locator('.torneo-reparto').count()) === 0)
  await enJuego.page.close()
  const sin = await abrir({ extra: { __FAKE_TORNEOS__: [{ ...semillas().__FAKE_TORNEOS__[0], prizes: null }] } })
  check('  …ni en uno sin premios', (await sin.page.locator('.torneo-reparto').count()) === 0)
  const veces = await sin.page.evaluate(() => window.__CONSULTAS__.porTabla.tournament_prize_deliveries || 0)
  const conPremios = await abrir()
  const vecesCon = await conPremios.page.evaluate(() => window.__CONSULTAS__.porTabla.tournament_prize_deliveries || 0)
  await conPremios.page.close()
  check('  …y sin premios ni se pregunta a la base por los dados (con ellos, sí)', veces === 0 && vecesCon > 0, `${veces} / ${vecesCon}`)
  await sin.page.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
