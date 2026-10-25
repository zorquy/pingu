// Tanda 1004 — «separar variantes» en el buscador, como en una expansión.
//
// PINGU, con Reshiram en la búsqueda general: «tengo puesto separar
// variantes… la variante debería salir al lado, y no sale» (la Expansion
// Stamp del Reshiram ex de Journey Together), y «aunque sea la única, debería
// mostrar algo»: el Reshiram ex de White Flare es Rara Doble, su versión es la
// Holo, y en la expansión sale con su chapa; en el buscador, sin nada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const SETS = [
  { id: 'sv09', name: 'Journey Together', serie_id: 'sv', market: 'WEST', release_date: '2025-03-28', card_count_official: 159, card_count_total: 190 },
  { id: 'sv10.5w', name: 'White Flare', serie_id: 'sv', market: 'WEST', release_date: '2025-07-18', card_count_official: 86, card_count_total: 173 },
]
const CARTAS = [
  { id: 'sv09-030', set_id: 'sv09', local_id: '030', name: 'Reshiram ex', market: 'WEST', category: 'Pokemon', rarity: 'Double rare', rarity_en: 'Double Rare', image_path: 'sv/sv09/030' },
  { id: 'sv10.5w-020', set_id: 'sv10.5w', local_id: '020', name: 'Reshiram ex', market: 'WEST', category: 'Pokemon', rarity: 'Double rare', rarity_en: 'Double Rare', image_path: 'sv/sv10.5w/020' },
  { id: 'sv10.5w-005', set_id: 'sv10.5w', local_id: '005', name: 'Reshiram mini', market: 'WEST', category: 'Pokemon', rarity: 'Common', rarity_en: 'Common', image_path: 'sv/sv10.5w/005', variants: { normal: true, reverse: true } },
]
const VERSIONES = [{ tcggo_id: 61234, market: 'WEST', card_id: 'sv09-030', set_id: 'sv09', etiqueta: 'Expansion Stamp', cm_low: 0.5 }]
const browser = await chromium.launch()
const errores = []
async function buscar({ split = true, retraso = 1500 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_RETRASO__ = { tcg_card_versions: d.retraso }
    try { localStorage.setItem('mc-split', d.split ? '1' : '0') } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_VERSIONES__: d.VERSIONES, __FAKE_COLECCION__: [] })
  }, { SETS, CARTAS, VERSIONES, split, retraso })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="63" height="88"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion?ver=buscar&q=reshiram`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(retraso + 1200)
  return { ctx, page }
}
const casillas = (page, id) => page.$$eval(`#mcBuscarResultados .mc-resultado[data-carta="${id}"]`, (as) => as.map((a) => `${a.dataset.variante || '-'}:${a.querySelector('.mc-chapa-variante span')?.textContent || ''}`))

console.log('── 1. Separadas, con la base lenta ──')
{
  const { ctx, page } = await buscar()
  const jtg = await casillas(page, 'sv09-030')
  check('el Reshiram ex de Journey Together: su Holo y, al lado, la Expansion Stamp', jtg.length === 2 && /^holo:Holo$/.test(jtg[0]) && /Expansion Stamp/.test(jtg[1]), JSON.stringify(jtg))
  const wf = await casillas(page, 'sv10.5w-020')
  check('una Rara Doble con una sola versión: una casilla con su chapa «Holo»', wf.length === 1 && wf[0] === 'holo:Holo', JSON.stringify(wf))
  const mini = await casillas(page, 'sv10.5w-005')
  check('una común con Normal y Reverse: las dos', mini.length === 2 && mini[0] === 'normal:Normal' && mini[1].startsWith('reverse:'), JSON.stringify(mini))
  await ctx.close()
}

console.log('── 2. Juntas: una casilla por carta, sin chapa ──')
{
  const { ctx, page } = await buscar({ split: false, retraso: 0 })
  const todas = [...(await casillas(page, 'sv09-030')), ...(await casillas(page, 'sv10.5w-020'))]
  check('dos casillas, sin versión', todas.join() === '-:,-:', JSON.stringify(todas))
  await ctx.close()
}
check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
