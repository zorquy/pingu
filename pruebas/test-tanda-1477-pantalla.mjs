// Tandas 1477–1480 — Partidas, más visual (PINGU: «dale con lo recomendado»).
//   1. Lo puro: las losas, los cruces (chapas con 3 partidas o más), las
//      semanas de las sueltas y el día de cada tarjeta.
//   2. Estadísticas: una gráfica, chips del periodo, mazo que filtra,
//      «Filtros» plegado con su número, y sin tablas de enfrentamientos.
//   3. Sueltas en tarjetas por semanas; Torneos en tarjetas, «Tu último
//      torneo» con uno apuntado y «Apuntar rondas» en vez de 0-0.
//   4. El móvil no se sale por el lado.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.RAIZ || process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || process.env.BASE || 'http://localhost:8893'
const E = await import(`${RAIZ}/js/estadisticas-partidas.js`)
const PE = await import(`${RAIZ}/js/partidas-estadisticas.js`)

const hoy = E.hoyLocal()
const hace = (d) => E.sumarDias(hoy, -d)
const P = (d, resultado, extra = {}) => ({ fecha: hace(d), resultado, tipo: 'normal', mio: 'd:dragapult ex', mioNombre: 'Dragapult ex', rival: 'd:lugia vstar', rivalNombre: 'Lugia VSTAR', donde: 'TCG Live', ...extra })

console.log('\n── 1. Lo puro ──')
{
  const jugadas = [P(0, 'win'), P(1, 'win'), P(2, 'loss'), P(3, 'win', { rival: 'd:charizard ex', rivalNombre: 'Charizard ex' }), P(4, 'loss', { rival: 'd:charizard ex', rivalNombre: 'Charizard ex' }), P(5, 'loss', { rival: 'd:charizard ex', rivalNombre: 'Charizard ex' }), P(6, 'win', { rival: 'd:mew', rivalNombre: 'Mew' })]
  const losas = PE.losasHtml(jugadas, { hoy })
  check('las losas: % con la cuenta de siempre, V y D, y las partidas', /57%/.test(losas) && /4 V/.test(losas) && /3 D/.test(losas) && /pe-grande">7</.test(losas), losas.replace(/\s+/g, ' ').slice(0, 200))
  check('  …la racha de ahora (2 victorias seguidas)', /2 victorias seguidas/.test(losas))
  check('  …y sin juegos apuntados, «Empezando» lo explica', /Apunta quién empieza/.test(losas))
  const cruces = PE.crucesHtml(jugadas)
  check('cruces: el mejor y el peor con 3 o más partidas', /Tu mejor cruce/.test(cruces) && /Tu bestia negra/.test(cruces), cruces.replace(/\s+/g, ' ').slice(0, 300))
  check('  …y Mew (1 partida) no lleva chapa', !/Tu (mejor|bestia)[^<]*<\/em><span class="pe-cruce-caras"><\/span>\s*<b>100%<\/b><span class="pe-cruce-nombre">Mew/.test(cruces))
  const muchos = Array.from({ length: 13 }, (_, i) => P(i, 'win', { rival: `d:r${i}`, rivalNombre: `R${i}` }))
  check(`  …se ven ${PE.CRUCES_DE_GOLPE} y «Ver los 13»`, (PE.crucesHtml(muchos).match(/data-pe-rival=/g) || []).length === PE.CRUCES_DE_GOLPE && /Ver los 13/.test(PE.crucesHtml(muchos)))
  const sem = E.porSemanas([{ fecha: hoy, resultado: 'win' }, { fecha: hace(7), resultado: 'loss' }, { fecha: hace(21), resultado: 'win' }, { fecha: null, resultado: 'draw' }], hoy)
  check('sueltas por semanas: «Esta semana», «La semana pasada», «Semana del…» y «Sin fecha» al final', sem[0].titulo === 'Esta semana' && sem[1].titulo === 'La semana pasada' && /^Semana del \d+ \w+$/.test(sem[2].titulo) && sem.at(-1).titulo === 'Sin fecha', sem.map((g) => g.titulo).join(' | '))
  check('  …con su marcador', sem[0].balance === '1-0' && sem[1].balance === '0-1')
  check('el día de cada tarjeta: Hoy, Ayer y «Lun 3 nov»', E.diaCorto(hoy, hoy) === 'Hoy' && E.diaCorto(hace(1), hoy) === 'Ayer' && /^(Lun|Mar|Mié|Jue|Vie|Sáb|Dom) \d+ \w+$/.test(E.diaCorto(hace(5), hoy)), E.diaCorto(hace(5), hoy))
}

const PARTIDAS = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, user_id: 'user-1', mi_mazo: i % 3 ? 'd:dragapult ex' : 'd:gardevoir ex', mi_mazo_nombre: i % 3 ? 'Dragapult ex' : 'Gardevoir ex', rival_mazo: i % 2 ? 'd:lugia vstar' : 'd:charizard ex', rival_mazo_nombre: i % 2 ? 'Lugia VSTAR' : 'Charizard ex', resultado: i % 4 ? 'win' : 'loss', jugada_el: hace(i * 3), donde: 'TCG Live', created_at: new Date(Date.now() - i * 3 * 864e5).toISOString() }))
const RONDAS = ['win', 'win', 'loss'].map((r, i) => ({ id: `r${i}`, user_id: 'user-1', torneo_id: 'lt1', mi_mazo: 'd:dragapult ex', mi_mazo_nombre: 'Dragapult ex', rival_mazo: 'd:mew', rival_mazo_nombre: 'Mew', resultado: r, jugada_el: hace(2), donde: 'Copa', created_at: new Date(Date.now() - 2 * 864e5 + i * 6e5).toISOString() }))
const TORNEOS = [
  { id: 'lt1', user_id: 'user-1', nombre: 'Copa de la tienda', donde: 'Torneo local', mi_mazo: 'd:dragapult ex', mi_mazo_nombre: 'Dragapult ex', jugado_el: hace(2), cerrado_el: null, puesto: 2 },
  { id: 'lt2', user_id: 'user-1', nombre: 'Liga sin rondas', donde: 'Torneo local', mi_mazo: 'd:dragapult ex', mi_mazo_nombre: 'Dragapult ex', jugado_el: hace(40), cerrado_el: null },
]
const browser = await chromium.launch()
async function abrir(ancho = 1280) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1100 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/cdn\.jsdelivr|limitlesstcg|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(([p, t]) => { window.__FAKE_SESSION__ = 'user-1'; window.__FAKE_PARTIDAS__ = p; window.__FAKE_LOG_TORNEOS__ = t }, [[...PARTIDAS, ...RONDAS], TORNEOS])
  await page.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, errores }
}
const texto = (page, sel) => page.innerText(sel).then((t) => t.replace(/\s+/g, ' ').trim())

console.log('\n── 2. Estadísticas en una pantalla ──')
{
  const { page, errores } = await abrir()
  await page.click('#partidasTabs [data-vista="stats"]')
  await page.waitForTimeout(400)
  check('una sola gráfica', (await page.locator('#vista-stats svg.graf').count()) === 1)
  check('sin tablas de enfrentamientos', (await page.locator('.partidas-mazo-bloque, .partidas-enfrentamientos').count()) === 0)
  check('cuatro losas', (await page.locator('#partidasResumen .pe-losa').count()) === 4)
  check('tus mazos en tarjetas (Dragapult y Gardevoir)', (await page.locator('#partidasExtra [data-pe-mazo]').count()) === 2)
  check('a la vista, solo periodo y mazo: el resto plegado', (await page.isVisible('#filtroMazo')) && !(await page.isVisible('#filtroRival')))
  await page.click('#partidasMatriz [data-pe-rival]')
  await page.waitForTimeout(200)
  check('tocar un rival lo filtra y «Filtros» cuenta 1', Boolean(await page.inputValue('#filtroRival')) && (await texto(page, '#statsFiltrosN')) === '1')
  await page.click('#partidasMatriz [data-pe-rival].pe-on')
  await page.waitForTimeout(200)
  check('  …y otra vez lo quita', (await page.inputValue('#filtroRival')) === '' && !(await page.isVisible('#statsFiltrosN')))
  const alto = await page.evaluate(() => document.getElementById('vista-stats').offsetHeight)
  check('la pestaña cabe en ~1,5 pantallas del PC', alto < 1650, String(alto))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Sueltas y Torneos ──')
{
  const { page, errores } = await abrir()
  await page.click('#partidasTabs [data-vista="sueltas"]')
  await page.waitForTimeout(300)
  const semanas = await page.$$eval('#partidasLista .partidas-mes-titulo', (xs) => xs.map((x) => x.firstChild.textContent.trim()))
  check('sueltas por semanas, la primera «Esta semana»', semanas[0] === 'Esta semana' && semanas.length >= 3, semanas.join(' | '))
  check('  …en tarjetas con los dos lados', (await page.locator('#partidasLista .ps-tarjeta .ps-caras').count()) === 12)
  const varias = await page.evaluate(() => { const ts = [...document.querySelectorAll('#partidasLista .ps-tarjetas')].find((x) => x.children.length > 1); if (!ts) return null; const [a, b] = ts.children; return Math.abs(a.getBoundingClientRect().top - b.getBoundingClientRect().top) < 8 })
  check('  …varias por fila en el PC', varias !== false, String(varias))
  await page.click('#partidasTabs [data-vista="torneos"]')
  await page.waitForTimeout(300)
  check('«Tu último torneo» sale también con uno apuntado', /Copa de la tienda/.test(await texto(page, '#partidasTorneos .tu-torneo')))
  check('los torneos en tarjetas', (await page.locator('#partidasTorneos .pt-rejilla .partidas-torneo').count()) === 2)
  check('sin rondas: «Apuntar rondas», no «0-0»', /Apuntar rondas/.test(await texto(page, '#partidasTorneos .pt-rejilla')) && !/0-0/.test(await texto(page, '#partidasTorneos .pt-rejilla')))
  check('  …y las rondas como fichas', (await page.locator('#partidasTorneos .pt-forma i').count()) === 3)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. El móvil ──')
{
  const { page, errores } = await abrir(390)
  for (const v of ['stats', 'sueltas', 'torneos']) {
    await page.evaluate((v) => document.querySelector(`#partidasTabs [data-vista="${v}"]`).click(), v)
    await page.waitForTimeout(300)
    check(`${v}: no se sale por el lado`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)))
  }
  check('sueltas: dos tarjetas por fila', await page.evaluate(() => { document.querySelector('#partidasTabs [data-vista="sueltas"]').click(); const ts = [...document.querySelectorAll('#partidasLista .ps-tarjetas')].find((x) => x.children.length > 1); return !ts || Math.abs(ts.children[0].getBoundingClientRect().top - ts.children[1].getBoundingClientRect().top) < 8 }))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
