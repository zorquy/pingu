// Tanda 750 — el precio dentro de una expansión (K6) y la Pokédex con la
// cuenta de cada región (K7).
//
// Lo que se mira: que los filtros de una expansión tengan el precio de cada
// carta (también de las que NO tienes, cuyos precios se piden al abrirla),
// que el atajo «Menos de 2 €» deje solo esas y se marque, que el botón diga
// cuántas salen y lo que suman, que una carta sin precio no entre en un
// rango y que «Borrar todo» lo quite. Y en la Pokédex, cada región con su
// «n/total» y la cabecera con el total de especies.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

async function abrir(ruta) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 5, card_count_total: 5, release_date: '2023-08-11', tcg_online_code: 'OBF' }]
    const c = (n) => ({ id: `sv3-${n}`, market: 'WEST', set_id: 'sv3', local_id: String(n), name: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true } })
    window.__FAKE_CARTAS__ = [1, 2, 3, 4, 5].map(c)
    // Solo tienes la 1: los precios de las demás tienen que llegar al abrir la expansión.
    window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'sv3-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
    // 0,30 € · 1,50 € · 4 € · 25 € · y la 5 sin precio.
    window.__FAKE_PRECIOS__ = [['sv3-1', 0.3], ['sv3-2', 1.5], ['sv3-3', 4], ['sv3-4', 25]].map(([card_id, v]) => ({ card_id, market: 'WEST', cm_low: v, cm_trend: v }))
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
const cartasALaVista = (page) => page.$$eval('#mcAlbum [data-carta]', (as) => [...new Set(as.map((a) => a.dataset.carta))])

console.log('── 1. El precio dentro de una expansión (K6) ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv3')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  check('en los filtros de la expansión está el precio de cada carta', await page.locator('#mcAlbumGrupoPrecio').isVisible() && await page.locator('#mcAlbumTiradorMax').isVisible())
  const tope = await page.getAttribute('#mcAlbumTiradorMax', 'max')
  check('  …y el tope sale de las cartas del set, también las que no tienes (25 € → 25)', tope === '25', tope)
  await page.click('#mcAlbumPrecioAtajos [data-precio-atajo="-2"]')
  await page.waitForTimeout(400)
  const ver = (await page.textContent('#mcAlbumFiltrosVer')) || ''
  const pulsado = await page.getAttribute('#mcAlbumPrecioAtajos [data-precio-atajo="-2"]', 'aria-pressed')
  check('«Menos de 2 €» se marca y el botón dice cuántas y lo que suman', pulsado === 'true' && /^Ver 2 cartas · unos 2\s€$/.test(ver.replace(/ /g, ' ')), ver)
  await page.click('#mcAlbumFiltrosVer')
  await page.waitForTimeout(400)
  const vistas = await cartasALaVista(page)
  check('  …y quedan esas dos (la que no tiene precio no entra)', JSON.stringify(vistas) === JSON.stringify(['sv3-1', 'sv3-2']), JSON.stringify(vistas))
  check('  …y la chapa de filtros cuenta el precio', (await page.textContent('#mcAlbumFiltrosCuenta')) === '1')
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(300)
  await page.fill('#mcAlbumPrecioDesde', '10')
  await page.fill('#mcAlbumPrecioHasta', '')
  await page.waitForTimeout(400)
  check('escribir «desde 10» deja solo la de 25 €', JSON.stringify(await cartasALaVista(page)) === '["sv3-4"]', JSON.stringify(await cartasALaVista(page)))
  check('  …y marca «Más de 10 €»', (await page.getAttribute('#mcAlbumPrecioAtajos [data-precio-atajo="10-"]', 'aria-pressed')) === 'true')
  await page.click('#mcAlbumFiltrosLimpiar')
  await page.waitForTimeout(400)
  check('«Borrar todo» quita el precio', (await cartasALaVista(page)).length === 5 && (await page.inputValue('#mcAlbumPrecioDesde')) === '')
  await ctx.close()
}

console.log('── 2. La Pokédex con la cuenta de cada región (K7) ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=pokedex')
  const m = await page.evaluate(() => ({
    sub: document.querySelector('.pdx-sub')?.textContent,
    regiones: [...document.querySelectorAll('.pdx-region')].map((b) => ({ n: b.querySelector('.pdx-region-nombre')?.textContent, c: b.querySelector('.pdx-region-cuenta')?.textContent, barra: !!b.querySelector('.pdx-region-barra i') })),
    ancho: document.documentElement.scrollWidth <= innerWidth,
  }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('arriba, el total de especies', /^\d+ de 1\.025 especies$/.test(m.sub || ''), m.sub)
  check('cada región con su «n/total» y su barra', m.regiones.length === 9 && m.regiones.every((r) => /^\d+\/\d+$/.test(r.c || '') && r.barra) && m.regiones[0].n === 'Kanto' && /\/151$/.test(m.regiones[0].c), JSON.stringify(m.regiones.slice(0, 3)))
  check('  …sin ensanchar la página', m.ancho)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
