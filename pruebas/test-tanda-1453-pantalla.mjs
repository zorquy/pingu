// Tanda 1453 — La puerta de un torneo en persona (propuesta «Torneos, versión
// final», PINGU: adelante con lo recomendado):
//   1. Quien organiza ve «La puerta» en Jugadores: cuántos dentro y cuántos
//      faltan, «Escanear entrada», buscar por @usuario y «Viene sin cuenta».
//   2. Cada fila: «Dar entrada» o «Dentro · HH:MM»; dar entrada llama a
//      `torneos_dar_entrada` y la fila pasa a «Dentro».
//   3. Buscar @usuario: los apuntados y, si no, cualquier cuenta («Apuntar y
//      dar entrada»).
//   4. «Viene sin cuenta» enseña el QR del torneo.
//   5. Emparejar la ronda 1 avisa de quién se queda fuera y cierra la puerta.
//   6. Un jugador no ve la puerta; un torneo online o «libre» tampoco tiene.
//   7. Lo puro: leer el QR de la entrada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const dentroDe = (dias) => new Date(Date.now() + dias * 86400e3).toISOString()
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const T = (extra = {}) => ({ id: 'torneo-1', slug: 'copa', name: 'Copa de la Tienda', status: 'registration_closed', admin_id: 'admin-1', swiss_rounds: 3, top_cut_size: 0, max_players: 16, start_at: dentroDe(0.01), format: 'standard', checkin_minutes: 0, round_time_minutes: 50, modalidad: 'presencial', lugar: 'Cartas Bilbao', direccion: 'Calle Ercilla 12, Bilbao', inscripcion: 'pedir', ...extra })
const GENTE = [['p1', 'misty'], ['p2', 'brock'], ['p3', 'gary'], ['p4', 'erika']]
const INSC = GENTE.map(([u], i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: '', registered_at: hace(600 - i), entrada_at: i < 2 ? hace(20 - i) : null }))
const PERFILES = [...GENTE.map(([id, username]) => ({ id, username })), { id: 'admin-1', username: 'tienda' }, { id: 'p9', username: 'nuevojugador' }]

const browser = await chromium.launch()
async function abrir(sesion, { torneos = [T()], movil = false } = {}) {
  const page = await browser.newPage(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  page.on('dialog', (d) => d.accept())
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(([s, t, i, p]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = t
    window.__FAKE_INSCRIPCIONES__ = i
    window.__FAKE_PERFILES__ = p
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, torneos, INSC, PERFILES])
  await page.goto(`${BASE}/torneo?slug=copa&ver=jugadores`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { page, errores }
}
const rpcs = (page, nombre) => page.evaluate((n) => (window.__RPCS__ || []).filter((r) => r.nombre === n).map((r) => r.args), nombre)

console.log('── 1–4. La puerta, para quien organiza ──')
{
  const { page, errores } = await abrir('admin-1')
  check('sin errores', !errores.length, errores.join(' | '))
  const cab = await page.$eval('#torneoPuerta', (c) => c.textContent.replace(/\s+/g, ' ')).catch(() => '')
  check('sale «La puerta» con 2 dentro y 2 por llegar', /La puerta/.test(cab) && /2 dentro/.test(cab) && /2 por llegar/.test(cab), cab)
  check('con «Escanear entrada», el buscador y «Viene sin cuenta»', Boolean(await page.$('[data-puerta-escanear]')) && Boolean(await page.$('#puertaUsuario')) && Boolean(await page.$('[data-puerta-sin-cuenta]')))
  const filas = await page.$$eval('#listaInscritos .torneo-inscrito', (fs) => fs.map((f) => f.textContent.replace(/\s+/g, ' ').trim()))
  check('las que han entrado dicen «Dentro · hora»; las demás, «Dar entrada»', filas.filter((f) => /Dentro · \d\d:\d\d/.test(f)).length === 2 && filas.filter((f) => /Dar entrada/.test(f)).length === 2, filas.join(' | '))
  await page.click('#listaInscritos [data-dar-entrada="p3"]')
  await page.waitForTimeout(900)
  check('dar entrada llama a la base', (await rpcs(page, 'torneos_dar_entrada')).some((a) => a.p_usuario === 'p3' && a.p_torneo === 'torneo-1'))
  check('y la fila de gary pasa a «Dentro» (3 dentro)', /3 dentro/.test(await page.$eval('#torneoPuerta', (c) => c.textContent)) && /Dentro/.test(await page.$eval('#listaInscritos', (l) => [...l.querySelectorAll('.torneo-inscrito')].find((f) => /gary/.test(f.textContent))?.textContent || '')))
  await page.fill('#puertaUsuario', 'nuevo')
  await page.waitForTimeout(700)
  const res = await page.$eval('#puertaResultado', (r) => r.textContent.replace(/\s+/g, ' '))
  check('buscar a alguien sin plaza ofrece «Apuntar y dar entrada»', /@nuevojugador/.test(res) && /Apuntar y dar entrada/.test(res), res)
  await page.click('#puertaResultado [data-dar-entrada="p9"]')
  await page.waitForTimeout(900)
  check('y le apunta dentro', (await rpcs(page, 'torneos_dar_entrada')).some((a) => a.p_usuario === 'p9'))
  await page.click('[data-puerta-sin-cuenta]')
  await page.waitForTimeout(300)
  check('«Viene sin cuenta» enseña el QR del torneo', Boolean(await page.$('#puertaResultado .torneo-puerta-qr svg')) && /Que lo escanee/.test(await page.$eval('#puertaResultado', (r) => r.textContent)))
  check('sin errores al usarla', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('── 5. Emparejar la ronda 1 cierra la puerta ──')
{
  const { page } = await abrir('admin-1')
  await page.evaluate(() => { const u = new URL(location.href); u.searchParams.set('ver', 'rondas'); history.replaceState(null, '', u) })
  await page.goto(`${BASE}/torneo?slug=copa&ver=rondas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  const boton = await page.$('#btnGenerarPareos')
  check('hay «Generar pareos de la ronda 1»', Boolean(boton))
  if (boton) {
    await page.evaluate(() => document.getElementById('btnGenerarPareos').click())
    await page.waitForTimeout(1500)
    check('se cierra la puerta en la base', (await rpcs(page, 'torneos_cerrar_puerta')).length === 1)
    const quedan = await page.evaluate(() => (window.__TABLAS__?.tournament_registrations || []).filter((r) => r.tournament_id === 'torneo-1').map((r) => `${r.user_id}:${r.status}`))
    check('quien no entró queda fuera (brock y misty dentro; gary y erika fuera)', quedan.includes('p3:dropped') && quedan.includes('p4:dropped') && quedan.includes('p1:active'), quedan.join())
    const mesas = await page.evaluate(() => (window.__TABLAS__?.tournament_matches || []).map((m) => [m.player_a_id, m.player_b_id].join('-')))
    check('y en la ronda 1 solo juegan los de dentro', mesas.length >= 1 && mesas.every((m) => !/p3|p4/.test(m)), mesas.join())
  }
  await page.close()
}

console.log('── 6. Quién no la ve ──')
{
  const { page } = await abrir('p1')
  check('un jugador no ve la puerta', !(await page.$('#torneoPuerta')))
  await page.close()
}
{
  const { page } = await abrir('admin-1', { torneos: [T({ inscripcion: 'libre' })] })
  check('con «se apuntan solos» no hay puerta', !(await page.$('#torneoPuerta')))
  await page.close()
}
{
  const { page } = await abrir('admin-1', { torneos: [T({ modalidad: 'online', lugar: null, direccion: null })] })
  check('online no hay puerta', !(await page.$('#torneoPuerta')) && !(await page.$('[data-dar-entrada]')))
  await page.close()
}
{
  const { page, errores } = await abrir('admin-1', { movil: true })
  check('móvil: la puerta sin salirse de lado', Boolean(await page.$('#torneoPuerta')) && (await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)))
  check('móvil: sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
await browser.close()

console.log('── 7. Leer el QR de la entrada ──')
// puerta.js importa app.js (navegador): lo puro se prueba en la página.
{
  const b2 = await chromium.launch()
  const p = await b2.newPage()
  await p.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  const r = await p.evaluate(async () => {
    const { leerEntrada, cuentaDePuerta } = await import('/js/torneos/puerta.js')
    return [leerEntrada('pokedoc-entrada:torneo-1:p3', 'torneo-1'), leerEntrada('pokedoc-entrada:otro:p3', 'torneo-1'), leerEntrada('https://pokedoc.es', 'torneo-1'), cuentaDePuerta([{ status: 'active', entrada_at: 'x' }, { status: 'active' }, { status: 'waitlisted' }, { status: 'dropped' }])]
  })
  check('una entrada de este torneo da el usuario', r[0].usuario === 'p3')
  check('una de otro torneo se rechaza', /otro torneo/.test(r[1].error || ''))
  check('un QR cualquiera se rechaza', /no es una entrada/.test(r[2].error || ''))
  check('la cuenta: 1 dentro y 2 por llegar (las bajas no cuentan)', r[3].dentro === 1 && r[3].faltan === 2, JSON.stringify(r[3]))
  await b2.close()
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
