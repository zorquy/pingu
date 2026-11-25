// Tanda 1443 — /admin → Arquetipos: «Sin catalogar en los últimos torneos».
//   · Junta los mazos deducidos de los torneos terminados, de más a menos.
//   · Lo catalogado y el «Basic Box» no salen.
//   · «Catalogar» rellena el formulario con el nombre, los iconos y las
//     cartas que tiene que llevar.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const p = (name, quantity, set = 'MEG', number = '1') => ({ name, quantity, set, number })
const RAYQUAZA = { pokemon: [p('Mega Rayquaza ex', 3, 'MEG', '104'), p('Dragapult ex', 2, 'TWM', '130'), p('Dreepy', 2, 'TWM', '128')] }
const GARDE = { pokemon: [p('Ralts', 4), p('Kirlia', 3), p('Gardevoir ex', 2, 'SVI', '86')] }
const CAJA = { pokemon: ['Raging Bolt ex', 'Iron Hands ex', 'Terapagos ex', 'Latias ex', 'Miraidon ex', 'Mew ex'].map((n) => p(n, 2)) }
const FILAS = {
  tournaments: [
    { id: 't1', name: 'Tardeo', status: 'finished', start_at: '2026-11-25T16:00:00Z' },
    { id: 't2', name: 'Liga', status: 'finished', start_at: '2026-11-18T16:00:00Z' },
  ],
  tournament_decklists: [
    { tournament_id: 't1', user_id: 'u1', parsed_cards: RAYQUAZA },
    { tournament_id: 't1', user_id: 'u2', parsed_cards: RAYQUAZA },
    { tournament_id: 't2', user_id: 'u3', parsed_cards: RAYQUAZA },
    { tournament_id: 't1', user_id: 'u4', parsed_cards: GARDE },
    { tournament_id: 't2', user_id: 'u5', parsed_cards: CAJA },
  ],
  tcg_archetypes: [{ id: 'gardevoir', nombre: 'Gardevoir', iconos: [], requiere: [{ nombres: ['Gardevoir ex'] }], activo: true }],
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript((FILAS) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_FILAS__ = FILAS
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
}, FILAS)
await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => { if (!/Transition/.test(String(e))) errores.push(String(e).slice(0, 200)) })
await page.goto(`${BASE}/admin/?ver=arquetipos`, { waitUntil: 'domcontentloaded' })
await page.waitForSelector('#btnSinCatalogar', { state: 'attached', timeout: 15000 })
await page.waitForTimeout(800)
await page.evaluate(() => document.getElementById('btnSinCatalogar').click())
await page.waitForSelector('#arquetiposSinCatalogar table', { timeout: 10000 }).catch(() => {})
const filas = await page.$$eval('#arquetiposSinCatalogar tbody tr', (trs) => trs.map((t) => t.textContent.replace(/\s+/g, ' ').trim()))
check('una fila: el Rayquaza (3 mazos en 2 torneos); sin Gardevoir (catalogado) ni Basic Box', filas.length === 1 && /Mega Rayquaza ex Dragapult ex/.test(filas[0]) && /3 en 2 torneos/.test(filas[0]), JSON.stringify(filas))
await page.evaluate(() => document.querySelector('[data-catalogar]').click())
const f = await page.evaluate(() => ({
  id: document.getElementById('arqId').value,
  nombre: document.getElementById('arqNombre').value,
  i1: `${document.getElementById('arqIcono1Set').value} ${document.getElementById('arqIcono1Num').value}`,
  i2: `${document.getElementById('arqIcono2Set').value} ${document.getElementById('arqIcono2Num').value}`,
  req: document.getElementById('arqRequiere').value,
}))
check('«Catalogar» rellena nombre e identificador', f.nombre === 'Mega Rayquaza ex Dragapult ex' && f.id === 'mega-rayquaza-ex-dragapult-ex', JSON.stringify(f))
check('… los dos iconos', f.i1 === 'MEG 104' && f.i2 === 'TWM 130', JSON.stringify(f))
check('… y las cartas que tiene que llevar', f.req === 'Mega Rayquaza ex\nDragapult ex', JSON.stringify(f.req))
check('sin errores', !errores.length, errores.join(' | '))
await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
