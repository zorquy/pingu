// Tanda 714 — los filtros de un toque y con su resultado (C6 de la lista
// de propuestas, elegida por PINGU).
//
// Lo que se mira: que el botón del panel diga «Ver N cartas» y cambie con
// cada chip (y diga cuándo no queda ninguna); que el tipo de energía lleve
// su símbolo; que el rango de precio por copia filtre y deje fuera lo que
// no tiene precio («no se sabe» no cumple un límite) y se limpie con
// «Limpiar»; y en una expansión, que la rareza se elija de un toque (el
// select sigue mandando) y que «Solo las que tengo» y «Solo las que me
// faltan» se excluyan.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 4, card_count_total: 4, tcg_online_code: 'PRC' }]
  const c = (n, nombre, tipo, rareza) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${n}`, rarity: rareza, category: 'Pokemon', types: [tipo], variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } })
  window.__FAKE_CARTAS__ = [c(1, 'Oddish', 'Grass', 'Common'), c(2, 'Charmander', 'Fire', 'Common'), c(3, 'Squirtle', 'Water', 'Rare'), c(4, 'Mew', 'Psychic', 'Rare')]
  const l = (id, carta, valor) => ({ id, card_id: carta, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: valor, created_at: '2026-10-01T10:00:00Z' })
  window.__FAKE_COLECCION__ = [l('l1', 'xy5-1', 2), l('l2', 'xy5-2', 12), l('l3', 'xy5-3', null)]
}
async function abrir(ruta) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/api\.tcgdex\.net|r2\.limitlesstcg\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, ctx, errores }
}
const ver = async (page, id) => limpio(await page.locator(`#${id}`).innerText())

console.log('── 1. Cartas: el botón dice cuántas, los chips de energía con su símbolo, el precio ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=cartas')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(400)
  check('al abrir: «Ver 3 cartas»', (await ver(page, 'mcFiltrosVer')) === 'Ver 3 cartas', await ver(page, 'mcFiltrosVer'))
  // Desde la 748 el chip es SOLO el símbolo (su nombre, en `aria-label`).
  const planta = page.locator('#mcGruposChips .chip-filtro[data-grupo="energia"][aria-label="Planta"]')
  check('el chip de Planta lleva el símbolo de la energía (y carga)', (await planta.locator('img.mc-energia').count()) === 1 && (await planta.locator('img.mc-energia').evaluate((i) => i.getAttribute('src') === '/assets/energias/G.svg' && i.complete && i.naturalWidth > 0)))
  await planta.click()
  await page.waitForTimeout(200)
  check('tocar Planta: «Ver 1 carta»', (await ver(page, 'mcFiltrosVer')) === 'Ver 1 carta')
  await page.locator('#mcGruposChips .chip-filtro[data-grupo="energia"][aria-label="Planta"]').click()
  await page.fill('#mcFiltroPrecioDesde', '5')
  await page.waitForTimeout(200)
  check('desde 5 €: solo la de 12 (la de 2 no, y la que no tiene precio tampoco)', (await ver(page, 'mcFiltrosVer')) === 'Ver 1 carta' && (await page.locator('#mcCartas [data-carta], #mcCartas .mc-carta').count()) >= 1, await ver(page, 'mcFiltrosVer'))
  await page.fill('#mcFiltroPrecioHasta', '1')
  await page.waitForTimeout(200)
  check('desde 5 hasta 1 se entiende al derecho (de 1 a 5): la de 2 €', (await ver(page, 'mcFiltrosVer')) === 'Ver 1 carta' && /Oddish/.test(limpio(await page.locator('#mcCartas').innerText())), await ver(page, 'mcFiltrosVer'))
  await page.fill('#mcFiltroPrecioHasta', '')
  await page.fill('#mcFiltroPrecioDesde', '20')
  await page.waitForTimeout(200)
  check('desde 20 €: ninguna, y el botón lo dice', (await ver(page, 'mcFiltrosVer')) === 'Ninguna carta: afloja algún filtro', await ver(page, 'mcFiltrosVer'))
  check('  …y el precio cuenta como un filtro puesto en la chapa', limpio(await page.locator('#mcFiltrosCuenta').innerText()) === '1')
  await page.click('#mcFiltrosLimpiar')
  await page.waitForTimeout(200)
  check('«Limpiar» vacía el precio: otra vez las tres', (await ver(page, 'mcFiltrosVer')) === 'Ver 3 cartas' && (await page.inputValue('#mcFiltroPrecioDesde')) === '')
  await ctx.close()
}

console.log('── 2. Una expansión: la rareza de un toque y «tengo / me faltan» ──')
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=album&set=xy5')
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(400)
  check('al abrir: «Ver 4 cartas»', (await ver(page, 'mcAlbumFiltrosVer')) === 'Ver 4 cartas', await ver(page, 'mcAlbumFiltrosVer'))
  const seg = page.locator('#mcAlbumRareza + .mc-seg button')
  check('la rareza son botones (con «todas» y las dos que hay)', (await seg.count()) === 3, (await seg.allInnerTexts()).join('|'))
  const rara = seg.nth(2)
  const valorRara = await rara.getAttribute('data-valor')
  await rara.click()
  await page.waitForTimeout(250)
  check('tocar una rareza la pone en el select y el botón se recuenta', (await page.inputValue('#mcAlbumRareza')) === valorRara && (await ver(page, 'mcAlbumFiltrosVer')) === 'Ver 2 cartas', await ver(page, 'mcAlbumFiltrosVer'))
  await seg.nth(0).click()
  await page.click('#mcAlbumSoloTengo')
  await page.waitForTimeout(250)
  check('«Solo las que tengo»: las tres tuyas', (await ver(page, 'mcAlbumFiltrosVer')) === 'Ver 3 cartas' && (await page.getAttribute('#mcAlbumSoloTengo', 'aria-pressed')) === 'true', await ver(page, 'mcAlbumFiltrosVer'))
  await page.click('#mcAlbumSoloFaltan')
  await page.waitForTimeout(250)
  check('«Solo las que me faltan» suelta la otra: la que falta', (await ver(page, 'mcAlbumFiltrosVer')) === 'Ver 1 carta' && (await page.getAttribute('#mcAlbumSoloTengo', 'aria-pressed')) === 'false' && (await page.getAttribute('#mcAlbumSoloFaltan', 'aria-pressed')) === 'true')
  await page.click('#mcAlbumFiltrosLimpiar')
  await page.waitForTimeout(250)
  check('«Limpiar» lo suelta todo', (await ver(page, 'mcAlbumFiltrosVer')) === 'Ver 4 cartas' && (await page.getAttribute('#mcAlbumSoloFaltan', 'aria-pressed')) === 'false')
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
