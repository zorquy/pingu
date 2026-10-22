// Tanda 956, en pantalla: la hoja de añadir de Mi colección y la de /carta
// quitan la versión que no salió en el idioma elegido y lo dicen; Jungle
// ofrece el neerlandés; y en /admin, los idiomas del set y la matriz de
// versiones por idioma escriben por sus funciones.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const SETS = [
  { id: 'dp7', name: 'Stormfront', serie_id: 'dp', market: 'WEST', release_date: '2008-11-05', card_count_official: 100 },
  { id: 'base2', name: 'Jungle', serie_id: 'base', market: 'WEST', release_date: '1999-06-16', card_count_official: 64 },
]
const carta = (id, set, n, nombre, rarity, variants) => ({ id, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity, category: 'Pokemon', variants, tcg_sets: { id: set, name: SETS.find((s) => s.id === set).name, serie_id: SETS.find((s) => s.id === set).serie_id, release_date: SETS.find((s) => s.id === set).release_date } })
const CARTAS = [
  carta('dp7-5', 'dp7', 5, 'Gengar', 'Rare Holo', { holo: true, reverse: true }),
  carta('dp7-50', 'dp7', 50, 'Gastly', 'Common', { normal: true, reverse: true }),
  carta('base2-1', 'base2', 1, 'Clefable', 'Rare Holo', { holo: true }),
]
const IDIOMAS_SET = { dp7: ['de', 'en', 'es', 'fr', 'it'], base2: ['de', 'en', 'es', 'fr', 'it', 'pt'] }
const MANO = [{ set_id: 'base2', idioma: 'nl', hay: true }]
const VERSION_IDIOMA = [{ set_id: 'dp7', variante: 'reverse', idioma: 'es', hay: false }]

const browser = await chromium.launch()
async function abrir({ conWorker = false, version = VERSION_IDIOMA } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', ...(conWorker ? {} : { serviceWorkers: 'block' }) })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PERFILES__ = [{ id: 'admin-1', username: 'pingu', is_admin: true }]
    window.__FAKE_PRECIOS__ = []
    window.__FAKE_VERSIONES__ = []
    window.__FAKE_ERAS__ = []
    window.__FAKE_IDIOMAS_SET__ = d.IDIOMAS_SET
    window.__FAKE_IDIOMAS_MANO__ = d.MANO
    window.__FAKE_VERSION_IDIOMA__ = d.version
  }, { SETS, CARTAS, IDIOMAS_SET, MANO, version })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  page.on('dialog', (d) => d.accept())
  return { ctx, page, errores }
}
const ir = async (page, ruta) => { await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2400) }
const chips = (page, sel) => page.$$eval(`${sel} .mc-idioma-chip`, (cs) => cs.map((c) => c.dataset.idioma).join())
const versiones = (page, sel) => page.$$eval(`${sel} option`, (os) => os.map((o) => o.value).join())
// Con dos versiones la hoja pregunta «¿Cuál tienes?» antes que el idioma (922).
const elegirSiPregunta = async (page, lista, version) => {
  if (await page.locator(`${lista}`).isVisible()) await page.click(`${lista} [data-vp-version="${version}"]`)
  await page.waitForTimeout(200)
}

console.log('── Mi colección: Stormfront en español, sin Reverse ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=dp7')
  await page.click('#mcAlbum .mc-mas[data-anadir="dp7-5"]')
  await page.waitForTimeout(900)
  // El idioma recordado es el español: la Reverse ya no se ofrece y no hay
  // nada que preguntar.
  check('al abrir en español no pregunta «¿Cuál tienes?»: solo hay Holo', await page.locator('#mcAdElegir').isHidden() && (await versiones(page, '#mcAdVariante')) === 'holo', await versiones(page, '#mcAdVariante'))
  await page.click('#mcAdIdiomas .mc-idioma-chip[data-idioma="en"]')
  await page.waitForTimeout(200)
  check('en inglés, Holo y Reverse', (await versiones(page, '#mcAdVariante')) === 'reverse,holo', await versiones(page, '#mcAdVariante'))
  check('  …sin aviso', await page.locator('#mcAdAvisoIdioma').isHidden())
  await page.click('#mcAdVersionFija [data-vp-cambiar]')
  await page.click('#mcAdElegir [data-vp-version="reverse"]')
  await page.waitForTimeout(200)
  await page.click('#mcAdIdiomas .mc-idioma-chip[data-idioma="es"]')
  await page.waitForTimeout(200)
  check('en español, solo la Holo', (await versiones(page, '#mcAdVariante')) === 'holo', await versiones(page, '#mcAdVariante'))
  check('  …y la Reverse que estaba elegida pasa a Holo', (await page.locator('#mcAdVariante').inputValue()) === 'holo')
  const aviso = await page.locator('#mcAdAvisoIdioma').textContent()
  check('  …y lo dice', await page.locator('#mcAdAvisoIdioma').isVisible() && /En español, Stormfront no salió en Reverse/.test(aviso), aviso)
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(900)
  const linea = await page.evaluate(() => window.__TABLAS__.user_collection.find((l) => l.card_id === 'dp7-5'))
  check('  …y se guarda en español como Holo', linea?.idioma === 'es' && linea?.variante === 'holo', JSON.stringify(linea))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir({ version: [] })
  await ir(page, '/mi-coleccion.html?ver=album&set=dp7')
  await page.click('#mcAlbum .mc-mas[data-anadir="dp7-50"]')
  await page.waitForTimeout(900)
  await elegirSiPregunta(page, '#mcAdElegir', 'normal')
  await page.click('#mcAdIdiomas .mc-idioma-chip[data-idioma="es"]')
  await page.waitForTimeout(200)
  check('sin nada puesto, en español también la Reverse (como antes)', (await versiones(page, '#mcAdVariante')).includes('reverse'), await versiones(page, '#mcAdVariante'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── Jungle con neerlandés ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=base2')
  await page.click('#mcAlbum .mc-mas[data-anadir="base2-1"]')
  await page.waitForTimeout(900)
  check('Jungle ofrece el neerlandés', (await chips(page, '#mcAdIdiomas')).split(',').includes('nl'), await chips(page, '#mcAdIdiomas'))
  const bandera = await page.$eval('#mcAdIdiomas .mc-idioma-chip[data-idioma="nl"] .pv-bandera', (b) => getComputedStyle(b).backgroundImage).catch(() => '')
  check('  …con su bandera', /gradient/.test(bandera), bandera)
  await page.keyboard.press('Escape')
  await ir(page, '/mi-coleccion.html?ver=album&set=dp7')
  await page.click('#mcAlbum .mc-mas[data-anadir="dp7-5"]')
  await page.waitForTimeout(900)
  check('Stormfront no', !(await chips(page, '#mcAdIdiomas')).split(',').includes('nl'), await chips(page, '#mcAdIdiomas'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── /carta ──')
{
  const { ctx, page, errores } = await abrir()
  await page.goto(`${BASE}/carta.html?id=dp7-5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.click('#cmAnadir')
  await page.waitForTimeout(900)
  await elegirSiPregunta(page, '#cmAdElegir', 'holo')
  await page.click('#cmAdIdiomas .mc-idioma-chip[data-idioma="es"]')
  await page.waitForTimeout(200)
  check('la hoja de /carta, en español: solo la Holo', (await versiones(page, '#cmAdVariante')) === 'holo', await versiones(page, '#cmAdVariante'))
  check('  …y lo dice', /no salió en Reverse/.test(await page.locator('#cmAdAvisoIdioma').textContent()) && await page.locator('#cmAdAvisoIdioma').isVisible())
  await page.click('#cmAdIdiomas .mc-idioma-chip[data-idioma="fr"]')
  await page.waitForTimeout(200)
  check('  …y en francés vuelve la Reverse', (await versiones(page, '#cmAdVariante')).includes('reverse') && await page.locator('#cmAdAvisoIdioma').isHidden(), await versiones(page, '#cmAdVariante'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── /admin ──')
{
  const { ctx, page: p, errores } = await abrir({ conWorker: true })
  await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  await p.locator('[data-section="colecciones"]').click()
  await p.waitForTimeout(800)
  // 975: las eras salen plegadas; se despliegan para tocar «Editar».
  await p.locator('#coleccionesDesplegar').click()
  await p.locator('[data-editar="dp7"]').click()
  await p.waitForTimeout(1000)
  const estados = () => p.$$eval('#colIdiomas [data-idioma-set]', (bs) => bs.map((b) => `${b.dataset.idiomaSet}:${b.className.replace(/.*idi-/, '')}`).join())
  check('el editor del set enseña sus idiomas', (await estados()) === 'es:auto,en:auto,fr:auto,de:auto,it:auto', await estados())
  await p.click('#colIdiomas [data-idioma-set="es"]')
  await p.waitForTimeout(500)
  check('tocar uno lo quita en el momento', (await estados()).includes('es:quitado'), await estados())
  const mano = await p.evaluate(() => window.__TABLAS__.tcg_set_idiomas_mano.filter((f) => f.set_id === 'dp7'))
  check('  …y lo escribe por su función', mano.length === 1 && mano[0].idioma === 'es' && mano[0].hay === false, JSON.stringify(mano))
  await p.click('#colIdiomas [data-idioma-set="es"]')
  await p.waitForTimeout(500)
  check('tocarlo otra vez lo devuelve', (await estados()).includes('es:auto') && (await p.evaluate(() => window.__TABLAS__.tcg_set_idiomas_mano.filter((f) => f.set_id === 'dp7').length)) === 0, await estados())
  await p.selectOption('#idiPoner', 'pt')
  await p.waitForTimeout(500)
  check('se añade uno desde el desplegable', (await estados()).includes('pt:puesto'), await estados())
  await p.click('#idiVersiones')
  await p.waitForTimeout(1200)
  const celda = (v, l) => p.locator(`[data-vpi-v="${v}"][data-vpi-l="${l}"]`)
  check('la matriz: la Reverse en español sale con ✕', ((await celda('reverse', 'es').textContent()) || '').trim() === '✕', await celda('reverse', 'es').textContent().catch(() => 'no está'))
  check('  …y en inglés con ✓', ((await celda('reverse', 'en').textContent()) || '').trim() === '✓')
  check('  …con las versiones del set (Reverse, Holo, Normal) y el portugués recién puesto', (await p.locator('[data-vpi-v="normal"][data-vpi-l="pt"]').count()) === 1 && (await p.locator('[data-vpi-v="holo"]').count()) > 0)
  await celda('holo', 'it').click()
  await p.waitForTimeout(500)
  const filas = await p.evaluate(() => window.__TABLAS__.tcg_version_idioma.filter((f) => f.set_id === 'dp7').map((f) => `${f.variante}:${f.idioma}`).sort().join())
  check('tocar una celda la marca y la escribe', filas === 'holo:it,reverse:es' && ((await celda('holo', 'it').textContent()) || '').trim() === '✕', filas)
  await celda('reverse', 'es').click()
  await p.waitForTimeout(500)
  const filas2 = await p.evaluate(() => window.__TABLAS__.tcg_version_idioma.filter((f) => f.set_id === 'dp7').map((f) => `${f.variante}:${f.idioma}`).sort().join())
  check('  …y devolverla borra la fila', filas2 === 'holo:it', filas2)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
