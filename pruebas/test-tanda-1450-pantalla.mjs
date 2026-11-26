// Tanda 1450 — Mesas en tarjetas de dos líneas (propuesta «El torneo, de
// nuevo», PINGU: «visualmente es horripilante»):
//   1. Fuera la fila de cajas «Ronda N · Terminada»: las rondas son pastillas
//      (las que faltan, apagadas) y el reloj va al lado del título.
//   2. Cada mesa: arriba número y estado; debajo un jugador por línea con su
//      casilla V/D. Los nombres largos caben enteros en el PC.
//   3. Filtros por estado (Todas · Jugando · Cerradas) y buscador por nombre,
//      que se suman y no se pierden al repintar.
//   4. Móvil: una columna, la tuya la primera y nada se sale.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const NOMBRES = ['misty', 'brock', 'gary', 'cesar-emiliano-hernandez', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni', 'lance', 'bruno', 'agatha']
const JUG = ['user-1', ...NOMBRES.slice(1).map((_, i) => `p${i + 2}`)]
const nombreDe = (u) => (u === 'user-1' ? 'pingu' : NOMBRES[JUG.indexOf(u)])
function semillas() {
  const T = { id: 'torneo-1', slug: 'copa', name: 'Copa de Mesas', status: 'in_progress', admin_id: 'admin-1', swiss_rounds: 4, top_cut_size: 4, current_round_id: 'ronda-2', decklist_visibility: 'al_terminar', start_at: hace(200), format: 'standard', checkin_minutes: 5, round_time_minutes: 50 }
  const mesas = []
  // Ronda 1, cerrada: gana siempre el primero.
  for (let t = 0; t < 6; t++) mesas.push([`a${t}`, 'ronda-1', JUG[t * 2], JUG[t * 2 + 1], 'a_wins', t + 1])
  // Ronda 2, en juego: user-1 en la mesa 5; dos ya cerradas.
  const r2 = [['p3', 'p4', 'b_wins'], ['p5', 'p6', 'a_wins'], ['p7', 'p8', null], ['p9', 'p10', null], ['user-1', 'p2', null], ['p11', 'p12', null]]
  r2.forEach(([a, b, r], t) => mesas.push([`b${t}`, 'ronda-2', a, b, r, t + 1]))
  return {
    __FAKE_PERFILES__: JUG.map((id) => ({ id, username: nombreDe(id), display_name: nombreDe(id) })),
    __FAKE_TORNEOS__: [T],
    __FAKE_INSCRIPCIONES__: JUG.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}` })),
    __FAKE_RONDAS__: [
      { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: hace(120) },
      { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: 'active', phase: 'swiss', started_at: hace(10), ends_at: new Date(Date.now() + 40 * 60000).toISOString() },
    ],
    __FAKE_MESAS__: mesas.map(([id, round_id, a, b, r, n]) => ({ id, round_id, table_number: n, player_a_id: a, player_b_id: b, status: r ? 'finished' : 'active', check_in_a_at: hace(9), check_in_b_at: hace(9) })),
    __FAKE_RESULTADOS__: mesas.filter((m) => m[4]).map(([match_id, , a, b, result], i) => ({ id: `r${i}`, match_id, result, winner_id: result === 'a_wins' ? a : b })),
    __FAKE_DECKLISTS__: [], __FAKE_REPORTES__: [], __FAKE_TABLON__: [], __FAKE_JUECES__: [],
  }
}

const browser = await chromium.launch()
async function abrir(movil = false) {
  const page = await browser.newPage(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript((se) => {
    window.__FAKE_SESSION__ = 'user-1'
    for (const [k, v] of Object.entries(se)) window[k] = v
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, semillas())
  await page.goto(`${BASE}/torneo?slug=copa&ver=rondas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { page, errores }
}
const vistas = (page) => page.$$eval('#mesasContenido .torneo-mesa', (ms) => ms.filter((m) => m.checkVisibility()).map((m) => m.querySelector('.torneo-mesa-num')?.textContent.trim()))

console.log('── 1. Rondas en pastillas y reloj al lado del título ──')
{
  const { page, errores } = await abrir()
  const r = await page.evaluate(() => ({
    linea: Boolean(document.querySelector('.torneo-linea, .torneo-paso')),
    chips: [...document.querySelectorAll('#mesasContenido .torneo-rondas-chips .torneo-ronda-chip')].map((c) => `${c.textContent.trim()}${c.classList.contains('futura') ? '·f' : ''}${c.classList.contains('activa') ? '·a' : ''}`),
    reloj: document.querySelector('.torneo-mesas-cabecera #cuentaGrande')?.textContent.trim(),
  }))
  check('sin la fila de cajas de rondas', !r.linea)
  check('pastillas R1 R2 (la que se mira) y las que faltan apagadas, con el Top 4', r.chips.join() === 'R1,R2·a,R3·f,R4·f,Top 4·f', r.chips.join())
  check('el reloj de la ronda al lado del título, corriendo', /^\d+:\d{2}$/.test(r.reloj || ''), r.reloj)

  console.log('\n── 2. Tarjetas de dos líneas ──')
  const t = await page.evaluate(() => {
    const m = [...document.querySelectorAll('#mesasContenido .torneo-mesa')]
    const dos = m.every((x) => {
      const l = x.querySelectorAll(':scope > .torneo-mesa-lado')
      return x.querySelector(':scope > .torneo-mesa-top') && l.length === 2 && l[1].getBoundingClientRect().top >= l[0].getBoundingClientRect().bottom - 1
    })
    const mia = document.querySelector('#mesasContenido .torneo-mesa.mia .torneo-mesa-rotulo')?.textContent
    const cerrada = m.find((x) => x.querySelector('.torneo-mesa-num').textContent.trim() === '1')
    const res = [...cerrada.querySelectorAll('.torneo-mesa-lado')].map((l) => `${l.querySelector('.torneo-mesa-jugador').textContent.trim()}:${l.querySelector('.torneo-mesa-res').textContent}`)
    return { dos, mia, res, cols: getComputedStyle(document.querySelector('.torneo-mesas-tarjetas')).gridTemplateColumns.split(' ').length }
  })
  check('cada mesa: arriba número y estado, y un jugador por línea', t.dos)
  check('la tuya lo dice', /la tuya/.test(t.mia || ''), t.mia)
  check('en una cerrada, casilla V al que gana y D al que pierde', t.res.join() === 'gary:D,cesar-emiliano-hernandez:V', t.res.join())
  check('en el PC, en rejilla', t.cols >= 2, String(t.cols))
  await page.click('#mesasContenido .torneo-ronda-chip:text-is("R1")')
  await page.waitForTimeout(400)
  const largo = await page.evaluate(() => {
    const j = [...document.querySelectorAll('#mesasContenido .torneo-mesa-jugador')].find((x) => x.textContent.includes('cesar'))
    return j ? { cabe: j.scrollWidth <= j.clientWidth + 1, texto: j.textContent.trim() } : null
  })
  check('R1: el nombre largo cabe entero en su línea', largo?.cabe, JSON.stringify(largo))
  check('R1 cerrada: sin filtros por estado, con buscador', !(await page.$('#mesasContenido [data-filtro-mesas]')) && Boolean(await page.$('#torneoMesasBuscar')))
  await page.click('#mesasContenido .torneo-ronda-chip:text-is("R2")')
  await page.waitForTimeout(400)

  console.log('\n── 3. Filtros y buscador ──')
  const seg = await page.$$eval('#mesasContenido [data-filtro-mesas]', (bs) => bs.map((b) => b.textContent.trim()))
  check('Todas · 6, Jugando · 4, Cerradas · 2 (sin Disputa si no hay)', seg.join() === 'Todas · 6,Jugando · 4,Cerradas · 2', seg.join())
  await page.click('#mesasContenido [data-filtro-mesas="cerradas"]')
  await page.waitForTimeout(200)
  check('Cerradas: solo las mesas 1 y 2', (await vistas(page)).join() === '1,2', (await vistas(page)).join())
  await page.click('#mesasContenido [data-filtro-mesas="todas"]')
  await page.fill('#torneoMesasBuscar', 'Pingu')
  await page.waitForTimeout(200)
  check('buscar «Pingu» deja su mesa (sin mirar mayúsculas)', (await vistas(page)).join() === '5', (await vistas(page)).join())
  await page.click('#mesasContenido [data-filtro-mesas="cerradas"]')
  await page.waitForTimeout(200)
  check('filtro y búsqueda se suman: «Pingu» entre las cerradas, ninguna', (await vistas(page)).length === 0 && (await page.locator('#torneoMesasNada').isVisible()), (await vistas(page)).join())
  check('…y lo dice', /pingu/i.test((await page.textContent('#torneoMesasNada')) || ''))
  await page.click('#mesasContenido [data-filtro-mesas="todas"]')
  await page.fill('#torneoMesasBuscar', '')
  await page.waitForTimeout(200)
  check('vaciar el buscador las devuelve todas', (await vistas(page)).length === 6)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. Móvil ──')
{
  const { page, errores } = await abrir(true)
  const m = await page.evaluate(() => {
    const ms = [...document.querySelectorAll('#mesasContenido .torneo-mesa')].sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)
    return { primera: ms[0]?.classList.contains('mia'), cols: getComputedStyle(document.querySelector('.torneo-mesas-tarjetas')).gridTemplateColumns.split(' ').length, ancho: document.documentElement.scrollWidth <= innerWidth + 1, buscar: document.getElementById('torneoMesasBuscar')?.getBoundingClientRect().width }
  })
  check('la tuya la primera', m.primera)
  check('una columna y nada se sale', m.cols === 1 && m.ancho, JSON.stringify(m))
  check('el buscador a lo ancho', m.buscar > 250, String(m.buscar))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
