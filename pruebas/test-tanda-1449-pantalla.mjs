// Tanda 1449 — Mazos en mosaico (propuesta «El torneo, de nuevo», PINGU: «los
// mazos están como si fuese una lista… no me convence»):
//   1. Los seis más jugados en recuadros, el primero el doble de alto, y el
//      resto en tarjetas pequeñas debajo.
//   2. Tocar un recuadro abre sus cifras (las de la 1444) y «Todo el meta»
//      vuelve al mosaico.
//   3. Móvil: dos columnas y nada se sale.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (min) => new Date(Date.now() - min * 60000).toISOString()
const L = (quantity, name, set, number) => ({ quantity, name, set, number })
// Siete mazos; el primero lo juegan cuatro y los demás dos (o uno el último).
const MAZOS = [
  [L(3, "N's Zoroark ex", 'JTG', '98'), L(3, "N's Zorua", 'JTG', '97')],
  [L(3, 'Dragapult ex', 'TWM', '130'), L(3, 'Drakloak', 'TWM', '129'), L(4, 'Dreepy', 'TWM', '128')],
  [L(3, 'Charizard ex', 'OBF', '125'), L(1, 'Charmeleon', 'PAF', '8'), L(3, 'Charmander', 'PAF', '7')],
  [L(2, 'Gardevoir ex', 'SVI', '86'), L(3, 'Kirlia', 'SIT', '68'), L(4, 'Ralts', 'SVI', '84')],
  [L(3, 'Raging Bolt ex', 'TEF', '123')],
  [L(3, 'Gholdengo ex', 'PAR', '139'), L(4, 'Gimmighoul', 'SSP', '97')],
  [L(3, 'Lugia VSTAR', 'SIT', '139'), L(3, 'Lugia V', 'SIT', '138')],
]
const DE = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 6]
const JUG = DE.map((_, i) => (i === 0 ? 'user-1' : `p${i + 1}`))
function semillas() {
  const T = { id: 'torneo-1', slug: 'copa', name: 'Copa de Mazos', status: 'finished', admin_id: 'admin-1', swiss_rounds: 1, top_cut_size: 0, current_round_id: 'ronda-1', decklist_visibility: 'al_terminar', start_at: hace(200), format: 'standard', checkin_minutes: 5, round_time_minutes: 50 }
  const mesas = []
  for (let t = 0; t < 7; t++) mesas.push([`a${t}`, 'ronda-1', JUG[t * 2], JUG[t * 2 + 1], 'a_wins', t + 1])
  return {
    __FAKE_PERFILES__: JUG.map((id, i) => ({ id, username: `jug${i}`, display_name: `jug${i}` })),
    __FAKE_TORNEOS__: [T],
    __FAKE_INSCRIPCIONES__: JUG.map((u, i) => ({ id: `insc-${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${i}` })),
    __FAKE_RONDAS__: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'finished', phase: 'swiss', started_at: hace(120) }],
    __FAKE_MESAS__: mesas.map(([id, round_id, a, b, r, n]) => ({ id, round_id, table_number: n, player_a_id: a, player_b_id: b, status: 'finished', check_in_a_at: hace(119), check_in_b_at: hace(119) })),
    __FAKE_RESULTADOS__: mesas.map(([match_id, , a, b, result], i) => ({ id: `r${i}`, match_id, result, winner_id: result === 'a_wins' ? a : b })),
    __FAKE_DECKLISTS__: JUG.map((u, i) => ({ id: `d${i}`, tournament_id: 'torneo-1', user_id: u, raw_text: '', parsed_cards: { pokemon: MAZOS[DE[i]], trainer: [], energy: [] }, locked_at: hace(130) })),
    __FAKE_REPORTES__: [], __FAKE_TABLON__: [], __FAKE_JUECES__: [],
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
  await page.goto(`${BASE}/torneo?slug=copa&ver=meta`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { page, errores }
}
const mosaico = (page) => page.evaluate(() => {
  const t = [...document.querySelectorAll('.torneo-meta-mosaico .torneo-meta-tesela')]
  const alto = (i) => t[i]?.getBoundingClientRect().height || 0
  return {
    activa: document.documentElement.dataset.torneoPestana,
    teselas: t.length,
    primera: t[0]?.textContent.replace(/\s+/g, ' ').trim(),
    doble: alto(0) > alto(2) * 1.6, // en el PC el segundo también es alto (la maqueta)
    resto: document.querySelectorAll('.torneo-meta-lista-resto .torneo-meta-fila').length,
    cols: getComputedStyle(document.querySelector('.torneo-meta-mosaico') || document.body).gridTemplateColumns.split(' ').length,
    ancho: document.documentElement.scrollWidth <= innerWidth + 1,
  }
})

for (const movil of [false, true]) {
  const q = movil ? 'Móvil' : 'PC'
  console.log(`── ${q} ──`)
  const { page, errores } = await abrir(movil)
  const m = await mosaico(page)
  check(`${q}: ?ver=meta abre Mazos`, m.activa === 'meta', m.activa)
  check(`${q}: seis recuadros y el séptimo en tarjeta`, m.teselas === 6 && m.resto === 1, JSON.stringify(m))
  check(`${q}: el primero, el más jugado (4 de 14, el 29 %)`, /29 %/.test(m.primera || '') && /Zoroark/.test(m.primera || '') && /4 jugadores/.test(m.primera || ''), m.primera)
  check(`${q}: ${movil ? 'dos columnas' : 'el primero el doble de alto que los pequeños'}`, movil ? m.cols === 2 : m.doble, JSON.stringify(m))
  check(`${q}: nada se sale`, m.ancho)
  await page.locator('.torneo-meta-tesela').first().click()
  await page.waitForTimeout(500)
  check(`${q}: tocarlo abre sus cifras`, await page.locator('#metaContenido .torneo-mc').isVisible())
  await page.click('[data-meta-volver]')
  await page.waitForTimeout(400)
  check(`${q}: «Todo el meta» vuelve al mosaico`, (await mosaico(page)).teselas === 6)
  check(`${q}: sin errores`, !errores.length, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
