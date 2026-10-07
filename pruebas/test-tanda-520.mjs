// Tanda 520 — publicar una repetición como partida de ejemplo de su mazo.
//
// PINGU, de la lista de ideas: «una galería pública por arquetipo: publicar
// (si quieres) una repetición y que salga en /meta como partida de ejemplo».
//
//   1. Cambiar los nombres por Rojo y Azul (repeticiones/anonimizar.js), en
//      Node: palabra entera, sin pisarse, y si el nombre es también una
//      carta, no se toca nada.
//   2. La base (sql-galeria.sql, en su propia base de datos).
//   3. /repeticiones: «Publicar como ejemplo» publica una COPIA con los
//      nombres cambiados, compartida, con sus mazos del meta; se quita desde
//      «Tus repeticiones»; y sin un mazo del meta no se ofrece.
//   4. La ficha del mazo en /meta: «Partidas de ejemplo».
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
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8892'
const A = await import(`${RAIZ}/js/repeticiones/anonimizar.js`)
const { leerRegistro } = await import(`${RAIZ}/js/repeticiones/registro.js`)
const R481 = readFileSync(new URL('./registro-481.txt', import.meta.url), 'utf8').replace(/\r/g, '')
// La partida de la prueba, con nombres de verdad (de mentira) en vez de
// Rojo y Azul: Ash es quien la copió (su mano se ve).
const CON_NOMBRES = R481.replace(/\bRojo\b/g, 'AshKetchum99').replace(/\bAzul\b/g, 'Misty_TCG')

console.log('\n── 1. Los nombres ──')
{
  const r = A.anonimizar(CON_NOMBRES, 'AshKetchum99')
  check('los dos nombres pasan a Rojo (quien la copió) y Azul, y el registro queda igual que el de Rojo y Azul', !r.error && r.texto === R481 && r.de.AshKetchum99 === 'Rojo' && r.de.Misty_TCG === 'Azul', r.error)
  const leida = leerRegistro(r.texto)
  check('  …y se lee igual: los mismos jugadores nuevos y las mismas jugadas', JSON.stringify(leida.jugadores.sort()) === '["Azul","Rojo"]' && leida.eventos.length === leerRegistro(CON_NOMBRES).eventos.length)
  const cruzados = A.anonimizar(R481, 'Azul')
  check('si ya se llaman Rojo y Azul pero al revés, se cruzan sin pisarse', !cruzados.error && /^Azul ha elegido cruz/m.test(cruzados.texto) && /^Rojo ha ganado el lanzamiento/m.test(cruzados.texto), cruzados.error)
  // «Ban» está DENTRO de «Banca», que sale treinta veces en el registro.
  const ban = A.anonimizar(R481.replace(/\bRojo\b/g, 'Ban'), 'Ban')
  check('el nombre se cambia como palabra entera, no dentro de otra («Ban» no toca «la Banca»)', !ban.error && ban.texto === R481, ban.error)
  // «mano» sí es una palabra entera del registro («de la mano inicial»):
  // cambiarla rompe la lectura, y eso se comprueba antes de publicar.
  const mano = A.anonimizar(R481.replace(/\bRojo\b/g, 'mano'), 'mano')
  check('si el nombre es una palabra del propio registro («mano»), no se publica algo que ya no se lee igual', /ya no se lee igual/.test(mano.error || ''), mano.error)
  const choca = A.anonimizar(R481.replace(/\bRojo\b/g, 'Zorua'))
  check('si un nombre es también una carta de la partida, no se toca nada y se dice', /«Zorua» es también parte del nombre de una carta/.test(choca.error || ''), choca.error)
  check('un texto que no es un registro, tampoco', Boolean(A.anonimizar('hola').error))
}

console.log('\n── 2. La base ──')
{
  const ruta = join(AQUI, 'sql-galeria.sql')
  check('sql-galeria.sql existe y prueba los topes', existsSync(ruta) && /con 30 publicadas, la 31 no entra/.test(readFileSync(ruta, 'utf8')))
  spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-c', 'create database prueba_galeria'], { encoding: 'utf8', timeout: 20000 })
  const r = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-d', 'prueba_galeria', '-f', ruta], { encoding: 'utf8', timeout: 60000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 21 && !fallos.length, fallos.slice(0, 2).join(' | '))
  }
}

console.log('\n── 3. Publicar desde /repeticiones ──')
const INGLES = { 'Zorua de N': "N's Zorua", 'Zoroark ex de N': "N's Zoroark ex", 'Darumaka de N': "N's Darumaka", 'Reshiram de N': "N's Reshiram", 'Zekrom de N': "N's Zekrom", 'Mega-Greninja ex': 'Mega Greninja ex', 'Más PP de N': "N's PP Up", 'Energía Oscura': 'Darkness Energy', 'Órdenes de Jefes': "Boss's Orders" }
const lectura = leerRegistro(R481)
const nombres = new Set()
for (const e of lectura.eventos) for (const k of ['carta', 'pokemon', 'objetivo', 'sube', 'baja', 'a', 'de']) if (e[k] && e[k] !== '?') nombres.add(e[k])
for (const e of lectura.eventos) for (const c of e.cartas || []) nombres.add(c)
const enJuego = new Set(['Zorua de N', 'Zoroark ex de N', 'Fezandipiti ex', 'Pecharunt', 'Reshiram de N', 'Zekrom de N', 'Budew', 'Shaymin', 'Dreepy', 'Drakloak', 'Dragapult ex', 'Froakie', 'Frogadier', 'Mega-Greninja ex'])
const catalogo = [...nombres].map((n, i) => ({
  id: `fk-${i + 1}`, set_id: 'fk', local_id: String(i + 1), market: 'WEST', image_path: null, regulation_mark: 'H',
  name: INGLES[n] || n, name_es: n,
  category: enJuego.has(n) || n === 'Darumaka de N' ? 'Pokemon' : /^Energ/.test(n) ? 'Energy' : 'Trainer',
  hp: enJuego.has(n) ? 200 : null,
}))
const ZOROARK = { id: 'zoroark-n', nombre: "N's Zoroark", iconos: [{ nombre: "N's Zoroark ex" }], requiere: [{ nombres: ["N's Zoroark ex"] }], activo: true }
const cartaFalsa = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342" viewBox="0 0 245 342"><rect width="245" height="342" rx="12" fill="#e9c94a"/></svg>'
const browser = await chromium.launch()
async function pagina({ quien = 'user-1', url = '/repeticiones.html', arquetipos = [ZOROARK], antes = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/escaneo\/|\.(png|webp|jpg|jpeg)(\?|$)/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: cartaFalsa }))
  await page.route(/api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }))
  await page.addInitScript(({ cartas, quien, arquetipos, antes }) => {
    window.__FAKE_SESSION__ = quien
    window.__FAKE_SETS__ = [{ id: 'fk', name: 'FK', market: 'WEST', tcg_online_code: 'FK', release_date: '2025-01-01', card_count_official: 999 }]
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_ARQUETIPOS__ = arquetipos
    Object.assign(window, antes)
  }, { cartas: catalogo, quien, arquetipos, antes })
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  return { page, ctx, errores }
}
async function pegar(page, texto = CON_NOMBRES) {
  await page.fill('#repTexto', texto)
  await page.click('#repFormulario button[type=submit]')
  await page.waitForSelector('#repSala:not(.hidden)')
  await page.evaluate(() => {
    const b = document.querySelector('[data-accion="reproducir"]')
    if (b.getAttribute('aria-label') === 'Pausa') b.click()
  })
  // Los mazos se deducen por detrás.
  await page.waitForFunction(() => /N's Zoroark/.test(document.getElementById('repMazosCuerpo')?.textContent || ''), null, { timeout: 10000 }).catch(() => null)
}
const rpcs = (page, n) => page.evaluate((n) => window.__RPCS__.filter((r) => r.nombre === n).map((r) => r.args), n)
{
  const { page, ctx, errores } = await pagina()
  await pegar(page)
  await page.click('[data-accion="publicar"]')
  await page.waitForSelector('[data-dlg="publicar"]', { timeout: 8000 })
  const texto = (await page.textContent('#repDialogoCuerpo')).replace(/\s+/g, ' ')
  check('la ventana dice dónde saldrá: en la ficha de su mazo del meta', /Saldrá en la ficha de N's Zoroark en \/meta/.test(texto), texto.slice(0, 200))
  check('  …con un enlace a esa ficha', (await page.getAttribute('#repDialogoCuerpo a[href^="/meta/"]', 'href')) === '/meta/zoroark-n')
  check('  …y la casilla de cambiar los nombres, marcada', await page.isChecked('#repPublicarAnonima'))
  await page.click('[data-dlg="publicar"]')
  await page.waitForFunction(() => (window.__RPCS__ || []).some((r) => r.nombre === 'repeticiones_publicar'), null, { timeout: 10000 }).catch(() => null)
  const [g] = await rpcs(page, 'repeticiones_guardar')
  check('guarda una COPIA con los nombres cambiados (ni rastro de los de verdad), compartida', g && g.p_registro === R481 && !g.p_registro.includes('AshKetchum99') && g.p_compartida === true && JSON.stringify(g.p_jugadores) === '["Rojo","Azul"]' && g.p_ganador === 'Rojo', JSON.stringify({ ...g, p_registro: g?.p_registro?.length }))
  check('  …titulada por sus mazos', g?.p_titulo === "N's Zoroark contra Mega Greninja ex Dragapult ex", g?.p_titulo)
  const [p] = await rpcs(page, 'repeticiones_publicar')
  const nueva = await page.evaluate(() => window.__TABLAS__.replays.at(-1))
  check('  …y la publica con el id de su mazo del meta (el otro no es del meta)', p?.p_id === nueva.id && p.p_publica === true && JSON.stringify(p.p_arquetipos) === '["zoroark-n"]', JSON.stringify(p))
  check('  …y la de verdad no se ha tocado (esta no estaba ni guardada)', (await page.evaluate(() => window.__TABLAS__.replays.length)) === 1 && nueva.publica)
  const toast = await page.evaluate(() => [...document.querySelectorAll('.toast')].map((t) => t.textContent).join(' '))
  check('  …y lo dice', /Publicada: sale en la ficha de N's Zoroark/.test(toast), toast)
  await page.waitForSelector('#repGuardadasCuerpo [data-despublicar]', { timeout: 5000 }).catch(() => null)
  const item = (await page.textContent('#repGuardadasCuerpo')).replace(/\s+/g, ' ')
  check('en «Tus repeticiones» sale como publicada, con «Quitar de la galería»', /Publicada/.test(item) && (await page.locator('#repGuardadasCuerpo [data-despublicar]').count()) === 1)
  await page.click('#repGuardadasCuerpo [data-despublicar]')
  await page.waitForFunction(() => window.__RPCS__.filter((r) => r.nombre === 'repeticiones_publicar').length === 2, null, { timeout: 5000 }).catch(() => null)
  const quitar = (await rpcs(page, 'repeticiones_publicar'))[1]
  check('  …que la quita (por la función, con «no»)', quitar?.p_publica === false && quitar.p_id === nueva.id && !(await page.evaluate(() => window.__TABLAS__.replays.at(-1).publica)), JSON.stringify(quitar))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  // Sin cambiar los nombres: se publica tal cual (y avisado).
  const { page, ctx } = await pagina()
  await pegar(page)
  await page.click('[data-accion="publicar"]')
  await page.waitForSelector('[data-dlg="publicar"]')
  await page.uncheck('#repPublicarAnonima')
  await page.click('[data-dlg="publicar"]')
  await page.waitForFunction(() => (window.__RPCS__ || []).some((r) => r.nombre === 'repeticiones_publicar'), null, { timeout: 10000 }).catch(() => null)
  const [g] = await rpcs(page, 'repeticiones_guardar')
  check('desmarcando la casilla se publica con los nombres de verdad', g?.p_registro === CON_NOMBRES && JSON.stringify(g.p_jugadores) === '["AshKetchum99","Misty_TCG"]', JSON.stringify(g?.p_jugadores))
  await ctx.close()
}
{
  // Un nombre que es también una carta: la casilla no se puede marcar.
  const { page, ctx } = await pagina()
  await pegar(page, R481.replace(/\bAzul\b/g, 'Budew'))
  await page.click('[data-accion="publicar"]')
  await page.waitForSelector('#repPublicarAnonima', { timeout: 8000 }).catch(() => null)
  const texto = await page.textContent('#repDialogoCuerpo')
  check('si un nombre es también una carta, no se pueden cambiar y se dice por qué', (await page.isDisabled('#repPublicarAnonima')) && !(await page.isChecked('#repPublicarAnonima')) && /«Budew» es también parte del nombre de una carta/.test(texto), texto.slice(0, 200))
  await ctx.close()
}
{
  // Sin ningún mazo del meta, no hay dónde publicarla.
  const { page, ctx } = await pagina({ arquetipos: [] })
  await pegar(page)
  await page.waitForTimeout(800)
  await page.click('[data-accion="publicar"]')
  await page.waitForTimeout(800)
  const texto = await page.textContent('#repDialogoCuerpo')
  check('sin ningún mazo del meta, lo dice y no ofrece publicar', /Ninguno de los dos mazos es de los del meta/.test(texto) && (await page.locator('[data-dlg="publicar"]').count()) === 0, texto.slice(0, 200))
  await ctx.close()
}
{
  const { page, ctx } = await pagina({ quien: 'none' })
  await pegar(page)
  await page.click('[data-accion="publicar"]')
  check('sin cuenta, pide entrar', /hace falta una cuenta/.test(await page.textContent('#repDialogoCuerpo')))
  await ctx.close()
}
{
  // Sin la migración se dice ANTES de guardar nada: publicar es guardar
  // una copia y después publicarla, y sin la función la copia se quedaría
  // huérfana en «Tus repeticiones».
  const { page, ctx } = await pagina({ antes: { __SIN_COLUMNAS__: { replays: ['publica'] } } })
  await pegar(page)
  await page.click('[data-accion="publicar"]')
  await page.waitForFunction(() => /no está disponible|Saldrá/.test(document.getElementById('repDialogoCuerpo')?.textContent || ''), null, { timeout: 8000 }).catch(() => null)
  const texto = (await page.textContent('#repDialogoCuerpo')).replace(/\s+/g, ' ')
  check('sin la migración, lo dice antes de guardar nada (y no ofrece publicar)', /Publicar aún no está disponible: falta poner supabase-migration-repeticiones-galeria\.sql/.test(texto) && (await page.locator('[data-dlg="publicar"]').count()) === 0 && (await page.evaluate(() => window.__TABLAS__.replays.length)) === 0, texto.slice(0, 200))
  await ctx.close()
}
{
  // Publicada y después hecha privada: no está en ninguna ficha, así que
  // no se dice «Publicada» ni se ofrece quitarla de la galería.
  const fila = { id: 'pri0000001', user_id: 'user-1', titulo: 'La que se hizo privada', registro: R481, jugador_a: 'Rojo', jugador_b: 'Azul', ganador: 'Rojo', turnos: 11, compartida: false, publica: true, arquetipos: ['zoroark-n'], publicada_at: new Date().toISOString() }
  const { page, ctx } = await pagina({ antes: { __FAKE_REPETICIONES__: [fila] } })
  await page.waitForSelector('#repGuardadasCuerpo .rep-item', { timeout: 8000 }).catch(() => null)
  const item = (await page.textContent('#repGuardadasCuerpo')).replace(/\s+/g, ' ')
  check('una publicada que ya no se comparte no sale como «Publicada» (no está en ninguna ficha)', /La que se hizo privada/.test(item) && !/Publicada/.test(item) && (await page.locator('#repGuardadasCuerpo [data-despublicar]').count()) === 0, item.slice(0, 200))
  await ctx.close()
}

console.log('\n── 4. La ficha del mazo en /meta ──')
const PUBLICADAS = [
  { id: 'pub0000001', user_id: 'user-1', titulo: 'x', registro: R481, jugador_a: 'Rojo', jugador_b: 'Azul', ganador: 'Rojo', turnos: 11, mazo_a: "N's Zoroark", mazo_b: 'Dragapult ex', compartida: true, publica: true, arquetipos: ['zoroark-n'], publicada_at: new Date(Date.now() - 60e3).toISOString() },
  { id: 'pub0000002', user_id: 'user-2', titulo: 'y', registro: R481, jugador_a: 'Rojo', jugador_b: 'Azul', ganador: 'Rojo', turnos: 9, mazo_a: 'Gardevoir ex', mazo_b: "N's Zoroark", compartida: true, publica: true, arquetipos: ['gardevoir', 'zoroark-n'], publicada_at: new Date().toISOString() },
  // Publicada pero ya NO compartida: no sale.
  { id: 'pub0000003', user_id: 'user-1', titulo: 'z', registro: R481, jugador_a: 'Rojo', jugador_b: 'Azul', ganador: 'Rojo', turnos: 5, mazo_a: "N's Zoroark", mazo_b: null, compartida: false, publica: true, arquetipos: ['zoroark-n'], publicada_at: new Date().toISOString() },
]
async function ficha({ publicadas = PUBLICADAS, antes = {} } = {}) {
  return pagina({ quien: 'none', url: '/mazo-meta.html?a=zoroark-n', antes: { __FAKE_META_ARQUETIPOS__: [{ id: 'zoroark-n', nombre: "N's Zoroark", iconos: [] }], __FAKE_REPETICIONES__: publicadas, ...antes } })
}
{
  const { page, ctx, errores } = await ficha()
  await page.waitForSelector('#mmPartidas:not(.hidden) .meta-partida', { timeout: 8000 }).catch(() => null)
  const filas = await page.$$eval('#mmPartidasLista li', (xs) => xs.map((x) => [x.querySelector('a').getAttribute('href'), `${x.querySelector('a').textContent.trim()} | ${x.querySelector('.meta-sub')?.textContent.trim()}`]))
  check('«Partidas de ejemplo» lista las publicadas y compartidas de ESTE mazo, la más nueva primero', filas.length === 2 && filas[0][0] === '/repeticiones?r=pub0000002' && filas[1][0] === '/repeticiones?r=pub0000001', JSON.stringify(filas))
  check('  …cada una con sus mazos, cuál ganó (por su mazo), los turnos y quién la subió', filas[1][1] === "N's Zoroark contra Dragapult ex | gana N's Zoroark · 11 turnos · subida por Ash" && filas[0][1] === "Gardevoir ex contra N's Zoroark | gana Gardevoir ex · 9 turnos · subida por Misty", filas.map((f) => f[1]).join(' || '))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const vacia = await ficha({ publicadas: [] })
  await vacia.page.waitForSelector('#mmPartidas:not(.hidden)', { timeout: 8000 }).catch(() => null)
  check('sin ninguna, la sección dice cómo publicar una', /guarda una partida tuya en Repeticiones y publícala/.test(await vacia.page.textContent('#mmPartidasVacio')) && (await vacia.page.isVisible('#mmPartidasVacio')))
  await vacia.ctx.close()
  const sin = await ficha({ antes: { __RPC_ERRORES__: { repeticiones_publicas: { code: 'PGRST202', message: 'Could not find the function' } } } })
  await sin.page.waitForTimeout(2000)
  check('sin la migración, la sección no sale (ni un error)', (await sin.page.locator('#mmPartidas.hidden').count()) === 1 && !sin.errores.length)
  await sin.ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
