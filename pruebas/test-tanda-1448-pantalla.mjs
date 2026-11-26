// Tanda 1448 — Clasificación e Info sin scroll infinito (propuesta «El torneo,
// de nuevo», PINGU: «hay que scrollear un montonazo cuando hay muchísimos
// participantes»):
//   1. El podio en una tira y debajo el Top 8 (o el corte), la línea del
//      corte y TU fila aunque quedes lejos; sin la columna de TCG Live.
//   2. «Ver los 20 jugadores» abre la tabla entera con un buscador que filtra
//      sin perder lo escrito; «Ver solo el Top 8» vuelve.
//   3. Info: con el torneo empezado, los inscritos son una fila de caras con
//      «+N» y «Ver los 20»; la lista, plegada hasta que se pide.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const NOMBRES = ['pingu', 'misty', 'brock', 'gary', 'erika', 'koga', 'sabrina', 'blaine', 'giovanni', 'lance', 'bruno', 'agatha', 'lorelei', 'will', 'karen', 'clair', 'jasmine', 'pryce', 'chuck', 'morty']
const JUG = NOMBRES.map((_, i) => (i === 0 ? 'user-1' : `p${i + 1}`))
function semillas() {
  const T = { id: 'torneo-1', slug: 'copa', name: 'Copa Grande', status: 'finished', admin_id: 'admin-1', swiss_rounds: 1, top_cut_size: 8, current_round_id: 'ronda-1', decklist_visibility: 'al_terminar', start_at: hace(200), format: 'standard', checkin_minutes: 5, round_time_minutes: 50 }
  // Ronda 1 cerrada: en cada mesa gana el de abajo, así que user-1 (mesa 1,
  // lado A) pierde y queda en la mitad de abajo.
  const mesas = []
  for (let t = 0; t < 10; t++) mesas.push([`a${t}`, 'ronda-1', JUG[t * 2], JUG[t * 2 + 1], 'b_wins', t + 1])
  return {
    __FAKE_PERFILES__: JUG.map((id, i) => ({ id, username: NOMBRES[i], display_name: NOMBRES[i] })),
    __FAKE_TORNEOS__: [T],
    __FAKE_INSCRIPCIONES__: JUG.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${NOMBRES[i]}` })),
    __FAKE_RONDAS__: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: hace(120) }],
    __FAKE_MESAS__: mesas.map(([id, round_id, a, b, r, n]) => ({ id, round_id, table_number: n, player_a_id: a, player_b_id: b, status: 'finished', check_in_a_at: hace(119), check_in_b_at: hace(119) })),
    __FAKE_RESULTADOS__: mesas.map(([match_id, , a, b, result], i) => ({ id: `r${i}`, match_id, result, winner_id: result === 'a_wins' ? a : b })),
    __FAKE_DECKLISTS__: [], __FAKE_REPORTES__: [], __FAKE_TABLON__: [], __FAKE_JUECES__: [],
  }
}

const browser = await chromium.launch()
async function abrir(ver, movil = false) {
  const page = await browser.newPage(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript((se) => {
    window.__FAKE_SESSION__ = 'user-1'
    for (const [k, v] of Object.entries(se)) window[k] = v
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, semillas())
  await page.goto(`${BASE}/torneo?slug=copa&ver=${ver}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { page, errores }
}
const tabla = (page) => page.evaluate(() => {
  const filas = [...document.querySelectorAll('[data-panel="clasificacion"] tbody tr')].filter((f) => f.checkVisibility())
  return {
    jugadores: filas.filter((f) => f.dataset.nombre).map((f) => f.dataset.nombre),
    corte: filas.findIndex((f) => f.classList.contains('torneo-fila-corte')),
    hueco: filas.some((f) => f.classList.contains('torneo-fila-hueco')),
    yo: filas.find((f) => f.classList.contains('torneo-fila-yo'))?.dataset.nombre,
    tcg: [...document.querySelectorAll('[data-panel="clasificacion"] th')].some((t) => /TCG Live/i.test(t.textContent)),
    boton: document.querySelector('[data-clasif-todos]')?.textContent.trim(),
    buscar: Boolean(document.getElementById('torneoClasifBuscar')),
  }
})

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  console.log(`── ${q}: Clasificación ──`)
  const { page, errores } = await abrir('clasificacion', movil)
  const podio = await page.$$eval('.torneo-podio-tira .torneo-podio-puesto', (ps) => ps.length)
  check(`${q}: el podio en una tira (los cuatro de arriba)`, podio >= 3, String(podio))
  const t = await tabla(page)
  check(`${q}: el Top 8 y tu fila, no los 20`, t.jugadores.length === 9 && t.yo === 'pingu' && t.jugadores[8] === 'pingu', JSON.stringify(t.jugadores))
  check(`${q}: la línea del corte tras el 8.º y el hueco antes de ti`, t.corte === 8 && t.hueco, JSON.stringify(t))
  check(`${q}: sin la columna de TCG Live`, !t.tcg)
  check(`${q}: «Ver los 20 jugadores»`, t.boton === 'Ver los 20 jugadores' && !t.buscar, t.boton)
  await page.click('[data-clasif-todos="si"]')
  await page.waitForTimeout(400)
  const todos = await tabla(page)
  check(`${q}: abierta, los 20 con buscador y sin hueco`, todos.jugadores.length === 20 && todos.buscar && !todos.hueco, JSON.stringify(todos))
  await page.fill('#torneoClasifBuscar', 'GAR')
  await page.waitForTimeout(300)
  const busca = await tabla(page)
  check(`${q}: buscar «GAR» deja a gary`, busca.jugadores.join() === 'gary', busca.jugadores.join())
  check(`${q}: …y el buscador sigue con lo escrito y el foco`, await page.evaluate(() => document.activeElement?.id === 'torneoClasifBuscar' && document.activeElement.value === 'GAR'))
  await page.click('[data-clasif-todos="no"]')
  await page.waitForTimeout(400)
  const otra = await tabla(page)
  check(`${q}: «Ver solo el Top 8» vuelve a lo corto`, otra.jugadores.length === 9 && !otra.buscar, JSON.stringify(otra.jugadores))
  check(`${q}: nada se sale`, await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  check(`${q}: sin errores`, !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── Info: los inscritos en caras ──')
{
  const { page, errores } = await abrir('torneo')
  const r = await page.evaluate(() => {
    const caja = document.getElementById('torneoInscritosCaja')
    return {
      caras: caja?.querySelectorAll('.torneo-caras-fila .mini-avatar').length,
      mas: caja?.querySelector('.torneo-caras-mas')?.textContent,
      boton: caja?.querySelector('[data-inscritos-todos]')?.textContent.trim(),
      lista: document.getElementById('listaInscritos')?.checkVisibility(),
    }
  })
  check('diez caras y «+10»', r.caras === 10 && r.mas === '+10', JSON.stringify(r))
  check('«Ver los 20» y la lista plegada', r.boton === 'Ver los 20' && !r.lista, JSON.stringify(r))
  await page.click('[data-inscritos-todos]')
  await page.waitForTimeout(300)
  const abierta = await page.evaluate(() => ({ boton: document.querySelector('[data-inscritos-todos]')?.textContent.trim(), lista: document.getElementById('listaInscritos')?.checkVisibility() }))
  check('al pedirla se abre y dice «Ocultar»', abierta.boton === 'Ocultar' && abierta.lista, JSON.stringify(abierta))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
