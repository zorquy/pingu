// Tanda 521 — puzles «¿Qué jugarías?» sacados de una repetición.
//
// PINGU, de la lista de ideas: «una posición de una repetición, la pregunta
// "¿qué jugarías?", unas opciones y la solución explicada».
//
//   1. La base (sql-puzles.sql, en su propia base de datos).
//   2. Hacerlo: desde una repetición TUYA, en la jugada que se mira; con su
//      forma (2 a 4 opciones, cuál es la buena, la explicación).
//   3. Resolverlo (/repeticiones?puzle=…): la mesa en esa jugada y NADA de
//      lo que viene después (ni registro, ni momentos, ni números, ni
//      teclas); al elegir, si acertaste, por qué y qué eligió la gente; y
//      luego, cómo siguió.
//   4. La lista de puzles de la comunidad.
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
const BASE = process.env.BASE || 'http://localhost:8892'
const R481 = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8').replace(/\r/g, '')

console.log('\n── 1. La base ──')
{
  const ruta = join(AQUI, 'sql-puzles.sql')
  check('sql-puzles.sql existe y prueba que la solución no se lee', existsSync(ruta) && /pero no la buena/.test(readFileSync(ruta, 'utf8')))
  spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-c', 'create database prueba_puzles'], { encoding: 'utf8', timeout: 20000 })
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-d', 'prueba_puzles', '-f', ruta], { encoding: 'utf8', timeout: 60000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 22 && !fallos.length, fallos.slice(0, 2).join(' | '))
  }
}

const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const GUARDADA = { id: 'rep0000001', user_id: 'user-1', registro: R481, titulo: 'La de los puzles', jugador_a: 'Rojo', jugador_b: 'Azul', ganador: 'Rojo', turnos: 11, compartida: false }
const browser = await chromium.launch()
async function pagina({ quien = 'user-1', url = `/repeticiones.html?r=${GUARDADA.id}`, antes = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ quien, antes, guardada }) => {
    window.__FAKE_SESSION__ = quien
    window.__FAKE_REPETICIONES__ = [guardada]
    Object.assign(window, antes)
  }, { quien, antes, guardada: GUARDADA })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}
const irA = (page, f) =>
  page.evaluate((f) => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
    const r = document.getElementById('repProgreso')
    r.value = String(f)
    r.dispatchEvent(new Event('input', { bubbles: true }))
  }, f)

console.log('\n── 2. Hacerlo ──')
let idPuzle = null
{
  const { page, ctx, errores } = await pagina()
  await page.waitForSelector('#repSala:not(.hidden)', { timeout: 8000 })
  await irA(page, 120)
  const boton = page.locator('[data-accion="puzle"]')
  check('en una repetición tuya, «Momentos» ofrece «Hacer un puzle aquí»', (await boton.count()) === 1 && (await boton.isVisible()))
  await boton.click()
  await page.waitForSelector('#repPuzlePregunta', { timeout: 5000 })
  check('la pregunta viene puesta («¿Qué jugarías aquí?») y se dice qué pasó después (para tenerlo delante)', (await page.inputValue('#repPuzlePregunta')) === '¿Qué jugarías aquí?' && /Lo que se jugó después/.test(await page.textContent('#repDialogoCuerpo')))
  await page.fill('#repPuzleOpcion0', 'Retirarse')
  await page.click('[data-dlg="crear-puzle"]')
  await page.waitForTimeout(300)
  check('con una sola opción no se crea, y se dice', /Hacen falta de 2 a 4 opciones/.test(await page.textContent('#repDialogo .rep-dialogo-estado')) && !(await page.evaluate(() => window.__RPCS__.some((r) => r.nombre === 'puzles_crear'))))
  // Con un hueco en medio (la 2.ª vacía): las vacías se quitan, y la
  // buena se cuenta entre las que quedan — la 4.ª casilla es la 3.ª opción.
  await page.fill('#repPuzleOpcion2', 'Atacar con lo que hay')
  await page.fill('#repPuzleOpcion3', 'Jugar Órdenes de Jefes')
  await page.fill('#repPuzleExplicacion', 'Con Jefes se coge el Pokémon de la banca que da los dos últimos premios.')
  await page.check('input[name="repPuzleBuena"][value="1"]')
  await page.click('[data-dlg="crear-puzle"]')
  await page.waitForTimeout(300)
  check('marcando como buena una casilla vacía no se crea, y se dice', /La que marcas como buena está vacía/.test(await page.textContent('#repDialogo .rep-dialogo-estado')) && !(await page.evaluate(() => window.__RPCS__.some((r) => r.nombre === 'puzles_crear'))))
  await page.check('input[name="repPuzleBuena"][value="3"]')
  await page.click('[data-dlg="crear-puzle"]')
  await page.waitForSelector('#repPuzleEnlace', { timeout: 5000 }).catch(() => null)
  const a = await page.evaluate(() => window.__RPCS__.find((r) => r.nombre === 'puzles_crear')?.args)
  check('lo crea por la función: la repetición, ESTA jugada, la pregunta, las opciones y la buena', a?.p_repeticion === GUARDADA.id && a.p_foto === 120 && a.p_pregunta === '¿Qué jugarías aquí?' && JSON.stringify(a.p_opciones) === '["Retirarse","Atacar con lo que hay","Jugar Órdenes de Jefes"]' && a.p_correcta === 2 && /Con Jefes/.test(a.p_explicacion), JSON.stringify(a))
  idPuzle = await page.evaluate(() => window.__TABLAS__.replay_puzzles.at(-1)?.id)
  check('  …y da su enlace para pasarlo', (await page.inputValue('#repPuzleEnlace')) === `${BASE}/repeticiones?puzle=${idPuzle}`)
  check('  …y la repetición queda compartida (sin ella no hay mesa)', await page.evaluate(() => window.__TABLAS__.replays[0].compartida))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Una repetición pegada (no guardada): hay que guardarla antes.
  const { page, ctx } = await pagina({ url: '/repeticiones.html' })
  await page.fill('#repTexto', R481)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await irA(page, 50)
  await page.click('[data-accion="puzle"]')
  check('de una partida sin guardar, pide guardarla antes', /guarda antes la repetición/.test(await page.textContent('#repDialogoCuerpo')))
  await ctx.close()
}

console.log('\n── 3. Resolverlo ──')
const PUZLE = { id: 'pz00000001', replay_id: GUARDADA.id, user_id: 'user-1', foto: 120, pregunta: '¿Qué jugarías aquí?', opciones: ['Retirarse', 'Atacar', 'Jugar Órdenes de Jefes'], correcta: 2, explicacion: 'Con Jefes se cogen los dos últimos premios.' }
const conPuzle = (quien = 'user-2', extra = {}) =>
  pagina({ quien, url: `/repeticiones.html?puzle=${PUZLE.id}`, antes: { __FAKE_PUZLES__: [PUZLE], __FAKE_REPETICIONES__: [{ ...GUARDADA, compartida: true }], ...extra } })
{
  const { page, ctx, errores } = await conPuzle()
  await page.waitForSelector('#repPuzle:not(.hidden)', { timeout: 8000 }).catch(() => null)
  const estado = await page.evaluate(() => {
    const ve = (sel) => {
      const el = document.querySelector(sel)
      if (!el) return false
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    }
    return {
      i: Number(document.getElementById('repProgreso').value),
      registro: ve('.rep-registro'),
      momentos: ve('.rep-momentos'),
      controles: ve('.rep-botones') || ve('#repProgreso'),
      numeros: ve('#repNumeros'),
      mazos: ve('#repMazos'),
      // La cabecera lleva «Imagen», «Vídeo» y compañía: todas dicen cómo acaba.
      cabecera: ve('.rep-cab-botones'),
      pregunta: document.querySelector('#repPuzle h2')?.textContent.trim(),
      opciones: [...document.querySelectorAll('#repPuzle [data-opcion]')].map((b) => b.textContent.trim()),
    }
  })
  check('abre la mesa en la jugada del puzle', estado.i === 120, estado.i)
  check('  …con la pregunta y sus opciones', estado.pregunta === '¿Qué jugarías aquí?' && estado.opciones.join('|') === 'Retirarse|Atacar|Jugar Órdenes de Jefes', JSON.stringify(estado))
  check('  …y sin NADA de lo que viene después: ni registro, ni momentos, ni controles, ni números, ni mazos, ni la cabecera', !estado.registro && !estado.momentos && !estado.controles && !estado.numeros && !estado.mazos && !estado.cabecera, JSON.stringify(estado))
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('End')
  check('  …ni las teclas lo adelantan', Number(await page.inputValue('#repProgreso')) === 120)
  const dom = await page.content()
  check('  …y la solución no está en la página antes de contestar', !dom.includes('Con Jefes se cogen'))
  await page.click('#repPuzle [data-opcion="1"]')
  await page.waitForSelector('#repPuzle .rep-puzle-solucion', { timeout: 5000 }).catch(() => null)
  const sol = (await page.textContent('#repPuzle')).replace(/\s+/g, ' ')
  check('al elegir mal: lo dice, cuál era la buena y por qué', /No: la buena era «Jugar Órdenes de Jefes»/.test(sol) && /Con Jefes se cogen los dos últimos premios/.test(sol), sol.slice(0, 300))
  check('  …y qué eligió la gente (con tu respuesta ya contada)', /1 respuesta/.test(sol) && /Atacar\s*100 %/.test(sol), sol.slice(0, 400))
  const rpc = await page.evaluate(() => window.__RPCS__.find((r) => r.nombre === 'puzles_responder')?.args)
  check('  …contestado por la función', rpc?.p_puzle === PUZLE.id && rpc.p_opcion === 1)
  await page.click('#repPuzle [data-accion="verComoSiguio"]')
  await page.waitForTimeout(400)
  check('«Ver cómo siguió» devuelve la repetición entera, desde ahí', (await page.isVisible('.rep-registro')) && (await page.isVisible('.rep-botones')) && Number(await page.inputValue('#repProgreso')) >= 120)
  check('  …y como la repetición no es suya, no le ofrece hacer otro puzle de ella', (await page.locator('[data-accion="puzle"]').count()) === 1 && !(await page.isVisible('[data-accion="puzle"]')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { page, ctx } = await conPuzle('none')
  await page.waitForSelector('#repPuzle [data-opcion]', { timeout: 8000 }).catch(() => null)
  await page.click('#repPuzle [data-opcion="2"]')
  await page.waitForSelector('#repPuzle .rep-puzle-solucion', { timeout: 5000 }).catch(() => null)
  const sol = (await page.textContent('#repPuzle')).replace(/\s+/g, ' ')
  check('sin cuenta también se contesta: «¡Bien!» y la explicación (sin apuntarse)', /¡Bien!/.test(sol) && /Con Jefes/.test(sol) && (await page.evaluate(() => window.__TABLAS__.replay_puzzle_answers.length)) === 0, sol.slice(0, 200))
  await ctx.close()
}
{
  const { page, ctx } = await pagina({ quien: 'user-2', url: '/repeticiones.html?puzle=noexiste1' })
  await page.waitForTimeout(1500)
  check('un puzle que no existe (o ya no se comparte) lo dice', /Este puzle no existe o ya no se comparte/.test(await page.textContent('#repError')))
  await ctx.close()
}

console.log('\n── 4. La lista ──')
{
  const { page, ctx } = await pagina({ quien: 'user-2', url: '/repeticiones.html', antes: { __FAKE_PUZLES__: [PUZLE], __FAKE_REPETICIONES__: [{ ...GUARDADA, compartida: true }] } })
  await page.waitForSelector('#repPuzles:not(.hidden) li', { timeout: 8000 }).catch(() => null)
  const filas = await page.$$eval('#repPuzles li', (xs) => xs.map((x) => [x.querySelector('a')?.getAttribute('href'), x.textContent.replace(/\s+/g, ' ').trim()]))
  check('«Puzles de la comunidad» lista los puzles, con su enlace', filas.length === 1 && filas[0][0] === `/repeticiones?puzle=${PUZLE.id}` && /¿Qué jugarías aquí\?/.test(filas[0][1]) && /de Ash/.test(filas[0][1]), JSON.stringify(filas))
  await ctx.close()
  const sin = await pagina({ quien: 'user-2', url: '/repeticiones.html', antes: { __RPC_ERRORES__: { puzles_lista: { code: 'PGRST202', message: 'Could not find the function' } } } })
  await sin.page.waitForTimeout(1500)
  check('sin la migración, la lista no sale', (await sin.page.locator('#repPuzles.hidden').count()) === 1)
  await sin.ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
