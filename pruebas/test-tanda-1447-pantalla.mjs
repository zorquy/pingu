// Tanda 1447 — «El torneo, de nuevo»: las pestañas fijas, Mazos como pestaña,
// el Modo juez en la cabecera y «Tu torneo» al terminar.
//   1. En juego, quien juega: Tu mesa · Clasificación · Mesas · Info (sin
//      Mazos: las listas aún no se ven) y abre en Tu mesa.
//   2. Terminado, quien jugó: el MISMO orden con Mazos, abre en Clasificación y
//      Tu mesa es «Tu torneo» (puesto final, camino y rivales).
//   3. Quien organiza: Jueces no está en la fila; «Modo juez» en la cabecera
//      abre la consola (sin la fila de pestañas) y «Volver al torneo» sale.
//   4. Móvil: los nombres cortos («Clasif.») y las cinco caben sin «Más».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const L = (quantity, name, set, number) => ({ quantity, name, set, number })
const MAZOS = {
  z: { pokemon: [L(3, "N's Zoroark ex", 'JTG', '98'), L(3, "N's Zorua", 'JTG', '97')], trainer: [], energy: [] },
  d: { pokemon: [L(3, 'Dragapult ex', 'TWM', '130'), L(3, 'Drakloak', 'TWM', '129'), L(4, 'Dreepy', 'TWM', '128')], trainer: [], energy: [] },
}
const GENTE = [['user-2', 'misty'], ['user-3', 'brock'], ['p4', 'gary']]
const JUG = ['user-1', 'user-2', 'user-3', 'p4']
const DE = { 'user-1': 'z', 'user-2': 'd', 'user-3': 'z', p4: 'd' }
function semillas({ terminado }) {
  const T = { id: 'torneo-1', slug: 'copa', name: 'Tardeo de Testeo', status: terminado ? 'finished' : 'in_progress', admin_id: 'admin-1', swiss_rounds: 2, top_cut_size: 0, current_round_id: 'ronda-2', decklist_visibility: 'al_terminar', start_at: hace(200), format: 'standard', checkin_minutes: 5, round_time_minutes: 30 }
  const mesas = [
    ['m1', 'ronda-1', 'user-1', 'user-2', 'a_wins'], ['m2', 'ronda-1', 'user-3', 'p4', 'b_wins'],
    ['m3', 'ronda-2', 'user-1', 'p4', terminado ? 'b_wins' : null], ['m4', 'ronda-2', 'user-2', 'user-3', terminado ? 'a_wins' : null],
  ]
  return {
    __FAKE_PERFILES__: GENTE.map(([id, username]) => ({ id, username, display_name: username })),
    __FAKE_TORNEOS__: [T],
    __FAKE_INSCRIPCIONES__: JUG.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}` })),
    __FAKE_RONDAS__: [
      { id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: hace(120) },
      { id: 'ronda-2', tournament_id: 'torneo-1', round_number: 2, status: terminado ? 'finished' : 'active', phase: 'swiss', started_at: hace(60) },
    ],
    __FAKE_MESAS__: mesas.map(([id, round_id, a, b, r], i) => ({ id, round_id, table_number: (i % 2) + 1, player_a_id: a, player_b_id: b, status: r ? 'finished' : 'active', check_in_a_at: hace(59), check_in_b_at: hace(59) })),
    __FAKE_RESULTADOS__: mesas.filter((m) => m[4]).map(([match_id, , a, b, result], i) => ({ id: `r${i}`, match_id, result, winner_id: result === 'a_wins' ? a : b })),
    __FAKE_DECKLISTS__: JUG.map((u, i) => ({ id: `d${i}`, tournament_id: 'torneo-1', user_id: u, raw_text: '', parsed_cards: MAZOS[DE[u]], locked_at: hace(130) })),
    __FAKE_REPORTES__: [], __FAKE_TABLON__: [], __FAKE_JUECES__: [],
  }
}

const browser = await chromium.launch()
async function abrir(sesion, se, movil = false) {
  const page = await browser.newPage(movil ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route(/\/sprite\/|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 404, body: '' }))
  await page.addInitScript(([s, se]) => {
    window.__FAKE_SESSION__ = s
    for (const [k, v] of Object.entries(se)) window[k] = v
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, [sesion, se])
  await page.goto(`${BASE}/torneo?slug=copa`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { page, errores }
}
const pestanas = (page) => page.evaluate(() => ({
  nombres: [...document.querySelectorAll('#torneoPestanas [data-pestana]')].map((b) => getComputedStyle(b.querySelector('.torneo-tab-largo')).display !== 'none' ? b.querySelector('.torneo-tab-largo').textContent : b.querySelector('.torneo-tab-corto').textContent),
  activa: document.documentElement.dataset.torneoPestana,
  mas: Boolean(document.querySelector('#torneoPestanas .torneo-tab-mas')),
  navVisible: !document.getElementById('torneoPestanas').classList.contains('hidden'),
}))

console.log('── 1. En juego, quien juega ──')
{
  const { page, errores } = await abrir('user-1', semillas({ terminado: false }))
  const p = await pestanas(page)
  // Arena limpia (1473): las cuatro de siempre; «Tu mesa» no es pestaña (abre sola).
  check('Resumen · Clasificación · Rondas · Mazos (1473), Mazos aunque no se vean aún las listas', p.nombres.join() === 'Resumen,Clasificación,Rondas,Mazos', p.nombres.join())
  check('abre en Tu mesa', p.activa === 'jugar', p.activa)
  check('un jugador no tiene «Modo juez»', !(await page.$('#btnModoJuez')))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 2. Terminado, quien jugó ──')
{
  const { page, errores } = await abrir('user-1', semillas({ terminado: true }))
  const p = await pestanas(page)
  check('el MISMO orden (1473)', p.nombres.join() === 'Resumen,Clasificación,Rondas,Mazos', p.nombres.join())
  check('abre en Clasificación', p.activa === 'clasificacion', p.activa)
  check('los mazos ya no van debajo de la clasificación', !(await page.$('[data-panel="clasificacion"] #torneoMetaCaja')) && Boolean(await page.$('[data-panel="meta"] #torneoMetaCaja')))
  // Terminado, tu panel («Tu torneo») se abre con la línea de debajo de las pestañas (1473).
  await page.click('#torneoTuLinea')
  await page.waitForTimeout(400)
  const tt = await page.evaluate(() => {
    const c = document.getElementById('torneoComoVas')
    return { titulo: c?.querySelector('h3')?.textContent, puesto: c?.querySelector('.torneo-tt-puesto')?.textContent, datos: c?.querySelector('.torneo-tt-datos')?.textContent.replace(/\s+/g, ' '), rivales: [...(c?.querySelectorAll('.torneo-tt-rival') || [])].map((r) => r.textContent.replace(/\s+/g, ' ').trim()), compartir: Boolean(c?.querySelector('[data-compartir-mi-torneo]')), lista: Boolean(c?.querySelector('[data-abrir-lista]')) }
  })
  check('Tu mesa es «Tu torneo»', tt.titulo === 'Tu torneo', tt.titulo)
  check('…con el puesto final y el récord (1-1)', /^\d\.º$/.test(tt.puesto || '') && /de 4/.test(tt.datos || '') && /1-1-0/.test(tt.datos || ''), JSON.stringify(tt))
  check('…contra quién jugaste, ronda a ronda', tt.rivales.length === 2 && /R1.*V.*misty/.test(tt.rivales[0]) && /R2.*D.*gary/.test(tt.rivales[1]), JSON.stringify(tt.rivales))
  check('…con «Mi lista» y «Compartir»', tt.compartir && tt.lista)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 3. Quien organiza: el Modo juez ──')
{
  const { page, errores } = await abrir('admin-1', semillas({ terminado: false }))
  const p = await pestanas(page)
  check('Jueces no está en la fila de pestañas', !p.nombres.includes('Jueces'), p.nombres.join())
  const boton = await page.$('#btnModoJuez')
  check('«Modo juez» está en la cabecera', Boolean(boton) && Boolean(await page.$('#torneoCabecera #btnModoJuez')))
  await page.click('#btnModoJuez')
  await page.waitForTimeout(400)
  const dentro = await pestanas(page)
  const r = await page.evaluate(() => ({ panel: !document.querySelector('[data-panel="jueces"]').classList.contains('hidden'), bar: document.getElementById('torneoJuezBar')?.textContent.replace(/\s+/g, ' '), url: location.search, boton: document.getElementById('btnModoJuez')?.textContent }))
  check('abre la consola de jueces, sin la fila de pestañas', dentro.activa === 'jueces' && r.panel && !dentro.navVisible, JSON.stringify({ ...dentro, ...r }))
  check('…con su barra y «Volver al torneo», y ?ver=jueces', /Modo juez/.test(r.bar) && /Volver al torneo/.test(r.bar) && /ver=jueces/.test(r.url), JSON.stringify(r))
  await page.click('[data-salir-juez]')
  await page.waitForTimeout(400)
  const fuera = await pestanas(page)
  check('«Volver al torneo» sale a la de entrada', fuera.activa !== 'jueces' && fuera.navVisible && !/ver=jueces/.test(await page.evaluate(() => location.search)), JSON.stringify(fuera))
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}

console.log('\n── 4. Móvil ──')
{
  const { page, errores } = await abrir('user-1', semillas({ terminado: true }), true)
  const p = await pestanas(page)
  // 1473: cuatro iguales, Clasificación se llama «Tabla» en el móvil.
  check('nombres cortos y las cuatro sin «Más»', p.nombres.join() === 'Resumen,Tabla,Rondas,Mazos' && !p.mas, JSON.stringify(p))
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)
  check('nada se sale', ancho)
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
