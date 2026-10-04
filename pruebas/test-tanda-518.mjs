// Tanda 518 — importar varias partidas a la vez en /repeticiones.
//
// PINGU, de la lista de ideas: «pegar varios registros de golpe (o elegir
// los ficheros) y que se guarden y se apunten en Mis partidas».
//
//   1. Partir (repeticiones/varias.js, en Node): cada registro empieza por
//      «Preparación» (o «Setup»); la misma pegada dos veces es una; lo de
//      antes de la primera no es partida. Y quién eres por defecto.
//   2. La ventana: leer pegadas y ficheros, decir de cada una quién ganó (y
//      cuál no se entiende), elegir quién eres, e importar: se guardan sin
//      compartir, con sus mazos, y se apuntan en Mis partidas con su
//      repetición — y una segunda vez no duplica nada.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = '/home/user/pingu'
const BASE = process.env.BASE || 'http://localhost:8892'
const V = await import(`${RAIZ}/js/repeticiones/varias.js`)
const { EJEMPLO } = await import(`${RAIZ}/js/repeticiones/ejemplo.js`)
const R481 = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8')

console.log('\n── 1. Partir ──')
{
  const dos = V.partirRegistros(`${EJEMPLO}\n${R481}`)
  // (El de la 481 viene con saltos de Windows: al partir se quedan en «\n».)
  check('dos registros pegados seguidos son dos partidas, cada una entera', dos.length === 2 && dos[0] === EJEMPLO.trim() && dos[1] === R481.replace(/\r/g, '').trim())
  check('la misma pegada dos veces es una', V.partirRegistros(`${EJEMPLO}\n\n${EJEMPLO}`).length === 1)
  check('lo de antes de la primera «Preparación» no es partida', V.partirRegistros(`Mis partidas del sábado\n\n${EJEMPLO}`)[0].startsWith('Preparación'))
  check('en inglés se parte por «Setup»', V.partirRegistros('Setup\nA drew.\nSetup\nB drew.').length === 2)
  check('sin ninguna «Preparación», el texto entero es una (y ya dirá el lector)', JSON.stringify(V.partirRegistros('  algo suelto  ')) === '["algo suelto"]' && V.partirRegistros('   ').length === 0)
  const p = (a, b) => ({ jugadores: [a, b] })
  check('quién eres: el recordado, si juega alguna', V.yoDeLasPartidas([p('Rojo', 'Azul'), p('Rojo', 'Verde')], 'Verde') === 'Verde')
  check('  …si no, el que sale en más partidas (y en dos o más)', V.yoDeLasPartidas([p('Rojo', 'Azul'), p('Rojo', 'Verde')], 'Otro') === 'Rojo')
  check('  …y si empatan o sale en una sola, nadie', V.yoDeLasPartidas([p('Rojo', 'Azul'), p('Rojo', 'Azul')]) === null && V.yoDeLasPartidas([p('Rojo', 'Azul')]) === null)
}

console.log('\n── 2. La ventana ──')
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const browser = await chromium.launch()
async function pagina(sesion = 'user-1') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript((s) => {
    window.__FAKE_SESSION__ = s
  }, sesion)
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}
const filas = (page) => page.$$eval('.rep-varias-lista li', (xs) => xs.map((x) => x.textContent.replace(/\s+/g, ' ').trim()))
{
  const { page, ctx } = await pagina('none')
  await page.click('#repVarias')
  check('sin cuenta, la ventana dice que hace falta una', /hace falta una cuenta/.test(await page.textContent('#repDialogo')))
  await ctx.close()
}
{
  const { page, ctx, errores } = await pagina()
  await page.click('#repVarias')
  await page.waitForSelector('#repVariasTexto')
  // Una pegada y otra rota en el texto; la segunda partida, como fichero, y
  // DOS veces (el mismo fichero con dos nombres no cuenta dos veces).
  await page.fill('#repVariasTexto', `${EJEMPLO}\nPreparación\nesto no es una partida`)
  await page.setInputFiles('#repVariasFicheros', [
    { name: 'partida.txt', mimeType: 'text/plain', buffer: Buffer.from(R481) },
    { name: 'copia.txt', mimeType: 'text/plain', buffer: Buffer.from(R481) },
  ])
  await page.click('[data-dlg="leer-varias"]')
  await page.waitForSelector('.rep-varias-lista li', { timeout: 5000 })
  let f = await filas(page)
  check('lee las tres (la del fichero también, y el fichero repetido no cuenta): dos buenas y una que no se entiende', f.length === 3 && /^Rojo contra Azul · gana Rojo · 13 turnos$/.test(f[0]) && /^Partida 2: /.test(f[1]) && /^Rojo contra Azul · gana Rojo · 11 turnos$/.test(f[2]), f.join(' | '))
  check('  …sin saber quién eres (en las dos juegan los mismos), no deja apuntar', (await page.inputValue('#repVariasYo')) === '' && (await page.isDisabled('#repVariasApuntar')))
  check('  …y el botón dice cuántas', (await page.textContent('[data-dlg="importar-varias"]')).trim() === 'Importar 2 partidas')
  await page.selectOption('#repVariasYo', 'Azul')
  f = await filas(page)
  check('eligiendo «Azul», cada una dice si la ganaste o la perdiste, contada desde ti', /^Azul contra Rojo · perdida/.test(f[0]) && /^Azul contra Rojo · perdida/.test(f[2]) && !(await page.isDisabled('#repVariasApuntar')) && (await page.isChecked('#repVariasApuntar')), f.join(' | '))
  await page.click('[data-dlg="importar-varias"]')
  await page.waitForFunction(() => /guardadas/.test(document.querySelector('#repDialogo .rep-dialogo-estado')?.textContent || ''), null, { timeout: 30000 }).catch(() => null)
  const estado = (await page.textContent('#repDialogo .rep-dialogo-estado')).trim()
  check('importa las dos: guardadas y apuntadas', estado === '2 guardadas, 2 apuntadas en «Mis partidas».', estado)
  const rpcs = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'repeticiones_guardar').map((r) => r.args))
  check('  …guardadas SIN compartir, con su título desde ti, y los dos jugadores', rpcs.length === 2 && rpcs.every((a) => a.p_compartida === false && a.p_titulo === 'Azul contra Rojo' && JSON.stringify(a.p_jugadores) === '["Rojo","Azul"]' && a.p_ganador === 'Rojo' && a.p_turnos > 0), JSON.stringify(rpcs.map((a) => ({ ...a, p_registro: a.p_registro.length }))))
  check('  …y con sus mazos (los dos nombres, aunque estén vacíos sin catálogo)', rpcs.every((a) => Array.isArray(a.p_mazos) && a.p_mazos.length === 2))
  const apuntes = await page.evaluate(() => window.__TABLAS__.match_log.map((m) => ({ r: m.resultado, rep: m.replay_id, donde: m.donde, mio: m.mi_mazo_nombre })))
  const ids = await page.evaluate(() => window.__TABLAS__.replays.map((r) => r.id))
  check('  …apuntadas en Mis partidas como perdidas, con SU repetición', apuntes.length === 2 && apuntes.every((a) => a.r === 'loss' && ids.includes(a.rep) && a.donde === 'TCG Live'), JSON.stringify(apuntes))
  f = await filas(page)
  check('  …y cada fila dice cómo le fue', f[0].endsWith('Guardada y apuntada (perdida)') && f[2].endsWith('Guardada y apuntada (perdida)'), f.join(' | '))
  check('recuerda quién eres para la próxima', (await page.evaluate(() => localStorage.getItem('pokedoc-repeticion-yo'))) === 'Azul')
  await page.waitForFunction(() => document.querySelectorAll('#repGuardadasCuerpo .rep-item').length === 2, null, { timeout: 5000 }).catch(() => null)
  check('  …y salen en «Tus repeticiones»', (await page.locator('#repGuardadasCuerpo .rep-item').count()) === 2)

  // Otra vez las mismas: ni se duplican ni se apuntan dos veces.
  await page.click('#repDialogo [data-cerrar]')
  await page.click('#repVarias')
  await page.fill('#repVariasTexto', `${EJEMPLO}\n${R481}`)
  await page.click('[data-dlg="leer-varias"]')
  await page.waitForSelector('.rep-varias-lista li')
  check('la segunda vez, quien eres ya viene puesto', (await page.inputValue('#repVariasYo')) === 'Azul')
  await page.click('[data-dlg="importar-varias"]')
  await page.waitForFunction(() => /guardadas/.test(document.querySelector('#repDialogo .rep-dialogo-estado')?.textContent || ''), null, { timeout: 30000 }).catch(() => null)
  f = await filas(page)
  check('otra vez las mismas: «ya estaba guardada · ya estaba apuntada», sin duplicar nada', f.every((t) => t.endsWith('Ya estaba guardada · ya estaba apuntada')) && (await page.evaluate(() => [window.__TABLAS__.replays.length, window.__TABLAS__.match_log.length].join())) === '2,2', f.join(' | '))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Solo guardar (sin decir quién eres): no se apunta nada, y una sin
  // ganador tampoco se apuntaría.
  const { page, ctx } = await pagina()
  await page.click('#repVarias')
  await page.fill('#repVariasTexto', EJEMPLO.replace(/El rival se ha rendido\. Rojo ha ganado\.\s*$/, ''))
  await page.click('[data-dlg="leer-varias"]')
  await page.waitForSelector('.rep-varias-lista li')
  check('una sin final dice que no tiene ganador', /sin ganador en el registro/.test((await filas(page))[0]))
  await page.selectOption('#repVariasYo', 'Rojo')
  await page.click('[data-dlg="importar-varias"]')
  await page.waitForFunction(() => /guardada/.test(document.querySelector('#repDialogo .rep-dialogo-estado')?.textContent || ''), null, { timeout: 30000 }).catch(() => null)
  check('  …se guarda y NO se apunta (un resultado inventado ensucia tus números)', (await page.evaluate(() => [window.__TABLAS__.replays.length, window.__TABLAS__.match_log.length].join())) === '1,0' && (await filas(page))[0].endsWith('Guardada'))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
