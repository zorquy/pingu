// Tanda 577 — «las que faltan» y el idioma, en una expansión y en la Pokédex.
//
// PINGU: «en la Pokédex y en las expansiones, filtrar por las que faltan y
// también por el idioma». Lo que cambia es QUÉ cuenta como «la tengo»:
// con «español» puesto, una carta que solo tienes en inglés te falta. Es
// la pregunta de quien colecciona en un idioma, y «Solo las que me
// faltan» con ese idioma es su lista de la compra.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>'
const SETS = [{ id: 'sv8', name: 'Surging Sparks', serie_id: 'sv', market: 'WEST', card_count_official: 3, card_count_total: 3, logo_path: 'x/l', release_date: '2024-11-08', tcg_online_code: 'SSP' }]
// Tres Pikachus (misma especie, dex 25) para que la Pokédex tenga una
// especie con tres cartas.
const CARTAS = [1, 2, 3].map((n) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: `Pikachu ${n}`, name_es: `Pikachu ${n}`, image_path: `sv/sv8/${n}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [25], variants: { normal: true } }))
// La 1 en español, la 2 solo en inglés, la 3 no la tienes.
const COL = [
  { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-09-01T10:00:00Z' },
  { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 1, idioma: 'en', estado: 'NM', variante: 'normal', created_at: '2026-09-02T10:00:00Z' },
]

const browser = await chromium.launch()
async function abrir(ver) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await page.route('**/limitlesstcg.nyc3.cdn.digitaloceanspaces.com/**', (r) => r.abort())
  await page.route('**/images.pokemontcg.io/**', (r) => r.abort())
  await page.route('**/r2.limitlesstcg.net/**', (r) => r.abort())
  await page.addInitScript(([sets, cartas, col]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    window.__FAKE_COLECCION__ = col
  }, [SETS, CARTAS, COL])
  await page.goto(`${BASE}/mi-coleccion.html?ver=${ver}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, errores }
}
const tengo = (page) => page.locator('#mcAlbum .mc-bolsillo.tengo').count()

console.log('── 1. En una expansión ──')
{
  const { page, errores } = await abrir('album')
  await page.locator('[data-set="sv8"]').click()
  await page.waitForTimeout(1500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('sin filtro, tienes dos de tres', (await tengo(page)) === 2, String(await tengo(page)))
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(500)
  const opciones = await page.$$eval('#mcAlbumIdioma option', (os) => os.map((o) => o.value))
  check('el filtro ofrece «cualquier idioma» y los del catálogo', opciones[0] === '' && opciones.includes('es') && opciones.includes('en'), opciones.join(','))
  await page.selectOption('#mcAlbumIdioma', 'es')
  await page.waitForTimeout(800)
  check('contando solo en español, tienes UNA', (await tengo(page)) === 1, String(await tengo(page)))
  check('  …y el progreso lo dice', /1 de 3/.test(await page.locator('#mcAlbumProgreso').innerText()), (await page.locator('#mcAlbumProgreso').innerText()).replace(/\s+/g, ' ').slice(0, 80))
  await page.click('#mcAlbumSoloFaltan')
  await page.waitForTimeout(800)
  const faltan = await page.$$eval('#mcAlbum .mc-bolsillo-enlace', (es) => es.map((e) => e.dataset.carta))
  check('«solo las que me faltan» en español: la 2 (solo en inglés) y la 3', faltan.join(',') === 'sv8-2,sv8-3', faltan.join(','))
  check('  …y el botón de filtros cuenta dos', (await page.locator('#mcAlbumFiltrosCuenta').innerText()).trim() === '2', await page.locator('#mcAlbumFiltrosCuenta').innerText())
  await page.click('#mcAlbumFiltrosLimpiar')
  await page.waitForTimeout(800)
  check('limpiar quita también el idioma', (await tengo(page)) === 2 && (await page.inputValue('#mcAlbumIdioma')) === '', String(await tengo(page)))
  await page.close()
}

console.log('── 2. En la Pokédex de un Pokémon ──')
{
  const { page, errores } = await abrir('pokedex')
  // `:visible`: hay más de un elemento con ese dex (la tira de «el que más tienes» también lo lleva) y el primero del DOM puede estar escondido.
  // Hay que llevar el botón a la vista a mano y pulsar «a la fuerza»:
  // Playwright lo veía tapado y se negaba, aunque el clic funciona.
  await page.evaluate(() => document.querySelector('button[data-dex="25"]')?.scrollIntoView())
  await page.locator('button[data-dex="25"]').first().click({ force: true })
  await page.waitForTimeout(1500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const tuyas = () => page.locator('.pdx-carta.tengo').count()
  check('las tres cartas, dos tuyas', (await page.locator('.pdx-carta').count()) === 3 && (await tuyas()) === 2, `${await page.locator('.pdx-carta').count()} / ${await tuyas()}`)
  check('hay chip de «solo las que me faltan» y desplegable de idioma', (await page.locator('#pdxSoloFaltan').count()) === 1 && (await page.locator('#pdxIdioma').count()) === 1)
  // Desde dentro: los dos mandos viven en una barra que se desliza en
  // horizontal, y Playwright no quiere tocar lo que queda fuera del
  // deslizamiento aunque esté pintado. Lo que importa es el `change`.
  await page.evaluate(() => { const s = document.getElementById('pdxIdioma'); s.value = 'es'; s.dispatchEvent(new Event('change', { bubbles: true })) })
  await page.waitForTimeout(800)
  check('en español, una tuya', (await tuyas()) === 1, String(await tuyas()))
  check('  …y el desplegable conserva lo elegido tras repintar', (await page.inputValue('#pdxIdioma')) === 'es')
  await page.locator('#pdxSoloFaltan').click({ force: true })
  await page.waitForTimeout(800)
  const quedan = await page.$$eval('.pdx-carta', (es) => es.map((e) => e.dataset.carta))
  check('«solo las que me faltan» en español deja la 2 y la 3', quedan.join(',') === 'sv8-2,sv8-3', quedan.join(','))
  check('  …con el chip encendido', (await page.getAttribute('#pdxSoloFaltan', 'aria-pressed')) === 'true')
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
