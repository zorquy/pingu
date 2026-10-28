// Tanda 1076 — Seleccionar en la Colección de una tienda (PINGU: «que puedas
// seleccionar varias cartas… en la Pokédex también… para seleccionar en bulk
// y darle a añadir. Y en los productos también»), y en Productos lo suyo ya
// no sale arriba («no tiene mucho sentido»): una franja lleva al Stock.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const N = 8
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, tcg_online_code: 'SSP', tcggo_id: 300 }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Pikachu ${i + 1}`, name_es: `Pikachu ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Common', category: 'Pokemon', variants: { normal: true }, dex_ids: [25] }))
const STOCK = [
  { id: 's1', tienda_id: 'user-2', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 3, coste: 2, precio: 5, visible: true, created_at: '2026-10-01T10:00:00Z' },
  { id: 's3', tienda_id: 'user-2', product_id: 9002, market: 'WEST', idioma: 'es', estado: 'sellado', variante: 'normal', unidades: 3, visible: true, created_at: '2026-10-01T10:00:00Z' },
]
const PRODUCTOS = [
  { id: 9002, episode_id: 300, market: 'WEST', lang: 'en', name: 'Chispas Charizard ex Tin', tipo: 'lata', cm_lowest: 22, cm_lowest_es: 21, release_date: '2024-11-08' },
  { id: 9003, episode_id: 300, market: 'WEST', lang: 'en', name: 'Chispas Booster', tipo: 'sobre', cm_lowest: 5, release_date: '2024-11-08' },
]
const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', tienda = true } = {}) {
  const ctx = await b.newContext({ viewport: { width: 1500, height: 950 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(([d, s, t]) => {
    window.__FAKE_SESSION__ = s
    if (t) window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Cartas de Ane', username: 'cartas-ane' }
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_PRODUCTOS__ = d.PRODUCTOS
    window.__FAKE_FILAS__ = { tienda_stock: d.STOCK.map((x) => ({ ...x })) }
    if (!sessionStorage.getItem('ya')) {
      sessionStorage.setItem('ya', '1')
      try { localStorage.removeItem('pokedoc-prod-idioma'); localStorage.removeItem('pd-tienda'); if (t) localStorage.setItem('pd-tienda', JSON.stringify({ u: 'cartas-ane', id: 'user-2' })) } catch {}
    }
  }, [{ SETS, CARTAS, STOCK, PRODUCTOS }, sesion, tienda])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  return { p, ctx, errs }
}
const stock = (p) => p.evaluate(() => window.__TABLAS__.tienda_stock.map((f) => `${f.card_id || 'p' + f.product_id}:${f.idioma}:${f.unidades}`).sort().join(','))

console.log('── 1. Seleccionar cartas de una expansión ──')
{
  const { p, ctx, errs } = await abrir('/cartas?ver=album&set=sv8')
  check('«Seleccionar» sale en la barra de la expansión', !errs.length && (await p.isVisible('#mcMarcarAbrir')), errs.join(' | '))
  await p.click('#mcMarcarAbrir'); await p.waitForTimeout(400)
  for (const n of [2, 3]) await p.click(`#mcAlbum [data-carta="sv8-${n}"]`)
  await p.waitForTimeout(300)
  check('  …marcar dos dice «2 al stock»', /2 seleccionadas/.test(await p.textContent('#mcMarcarCuenta')) && (await p.textContent('#mcMarcarGuardarTexto')) === '2 al stock')
  check('  …sin «A un álbum» ni «Las quiero»', !(await p.isVisible('#mcMarcarAlbum')) && !(await p.isVisible('#mcMarcarQuiero')))
  await p.click('#mcMarcarGuardar'); await p.waitForTimeout(1500)
  check('  …y entran las dos en su stock', (await stock(p)) === 'p9002:es:3,sv8-1:es:3,sv8-2:es:1,sv8-3:es:1', await stock(p))
  await ctx.close()
}

console.log('── 2. Y en la Pokédex ──')
{
  const { p, ctx } = await abrir('/cartas?ver=pokedex&dex=25')
  check('la especie lleva «Seleccionar»', await p.isVisible('#pdxSeleccionar'))
  await ctx.close()
}

console.log('── 3. Productos: la franja y seleccionar varios ──')
{
  const { p, ctx, errs } = await abrir('/cartas?ver=productos')
  check('sin «Tus productos» arriba: una franja que cuenta lo sellado y lleva al Stock', !errs.length && !/Tus productos/.test(await p.textContent('#mcProdTuyos')) && /3 productos sellados/.test(await p.textContent('.mc-prod-enstock')) && (await p.getAttribute('.mc-prod-enstock', 'href')) === '/tienda?ver=stock&filtro=sellado', errs.join(' | '))
  check('  …y la expansión dice «3 en stock»', /3 en stock/.test(await p.textContent('#mcProdSets [data-prod-set="300"]')))
  await p.click('#mcProdSets [data-prod-set="300"]'); await p.waitForTimeout(800)
  check('dentro, «Seleccionar» en la fila de tipos', await p.isVisible('[data-prodsel-abrir]'))
  await p.click('[data-prodsel-abrir]'); await p.waitForTimeout(300)
  await p.click('#mcProdRejilla [data-prod="9003"] .mc-prod-abrir')
  await p.click('#mcProdRejilla [data-prod="9002"] .mc-prod-abrir')
  await p.waitForTimeout(300)
  check('  …tocar marca (no abre la ficha) y la barra dice «2 al stock»', !(await p.isVisible('#mcProdFicha')) && (await p.locator('.mc-prod.marcada').count()) === 2 && (await p.textContent('[data-prodsel-texto]')) === '2 al stock')
  await p.click('[data-prodsel-anadir]'); await p.waitForTimeout(500)
  check('  …pregunta el idioma UNA vez para los dos', /¿En qué idioma son\?/.test(await p.textContent('#mcProdIdioma')) && /2 productos/.test(await p.textContent('#mcProdIdioma')))
  await p.click('#mcProdIdioma [data-prodi-idioma="es"]'); await p.waitForTimeout(1500)
  check('  …y suma uno de cada en español a su stock', (await stock(p)) === 'p9002:es:4,p9003:es:1,sv8-1:es:3', await stock(p))
  check('  …y la selección se cierra', (await p.locator('.mc-prod.marcada').count()) === 0 && !(await p.isVisible('#mcProdSel')))
  await ctx.close()
}

console.log('── 4. Una persona en /cartas también selecciona ──')
{
  const { p, ctx } = await abrir('/cartas?ver=album&set=sv8', { sesion: 'user-1', tienda: false })
  check('con cuenta, «Seleccionar» y «Añadir» (a su colección)', (await p.isVisible('#mcMarcarAbrir')) && (await p.textContent('#mcMarcarGuardarTexto')) === 'Añadir')
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
