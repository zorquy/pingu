// Tanda 1384 — los idiomas asiáticos al editar y al añadir varias (un usuario
// por Twitter, vía PINGU: «a la hora de editar una carta solo deja elegir
// idioma japonés… desde añadir cartas individuales sí deja los otros dos
// idiomas asiáticos, aunque desde añadir múltiples cartas tampoco deja
// seleccionar idioma»):
//   · editar una copia de un set japonés ofrece japonés, coreano y chino
//     (si su set los tiene), y conserva el idioma que la copia ya tiene;
//   · Seleccionar → Añadir pregunta idioma y estado, con los idiomas de los
//     sets de las marcadas, y añade con lo elegido;
//   · en el occidental, la hoja ofrece los de siempre.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const SETS = [
  { id: 'M6A', name: '30th Celebration (Japanese)', serie_id: 'm', market: 'JP', release_date: '2026-09-16', card_count_official: 100 },
  { id: 'bw10', name: 'Plasma Blast', serie_id: 'bw', market: 'WEST', release_date: '2013-08-14', card_count_official: 101 },
]
const carta = (id, set, n, nombre, market) => ({ id, market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: SETS.find((s) => s.id === set).name, serie_id: SETS.find((s) => s.id === set).serie_id } })
const CARTAS = [carta('M6A-001', 'M6A', 1, 'Exeggcute', 'JP'), carta('M6A-002', 'M6A', 2, 'Exeggutor', 'JP'), carta('M6A-003', 'M6A', 3, 'Scyther', 'JP'), carta('bw10-1', 'bw10', 1, 'Tropius', 'WEST'), carta('bw10-2', 'bw10', 2, 'Shuckle', 'WEST')]
const linea = (id, card, market, idioma) => ({ id, user_id: 'admin-1', card_id: card, market, idioma, estado: 'NM', variante: 'normal', cantidad: 1, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-01T10:00:00Z' })
const COLECCION = [linea('l1', 'M6A-001', 'JP', 'ja'), linea('l2', 'M6A-002', 'JP', 'zh')]
const IDIOMAS_SET = { M6A: ['ja', 'ko', 'zh'], bw10: ['de', 'en', 'fr', 'it', 'pt'] }

const browser = await chromium.launch()
async function abrir() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_PERFILES__ = [{ id: 'admin-1', username: 'pingu' }]
    window.__FAKE_PRECIOS__ = []
    window.__FAKE_IDIOMAS_SET__ = d.IDIOMAS_SET
  }, { SETS, CARTAS, COLECCION, IDIOMAS_SET })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
}
const opcionesEditar = (page) => page.$$eval('#mcEdIdioma option', (os) => os.map((o) => o.value).join())
const lineas = (page) => page.evaluate(() => window.__TABLAS__.user_collection.map((f) => `${f.card_id}:${f.idioma}:${f.estado}`).sort().join(','))

console.log('── Editar una copia japonesa ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=M6A&catalogo=JP')
  await page.locator('#mcAlbum [data-carta="M6A-001"]').first().click()
  await page.waitForTimeout(1200)
  check('una japonesa de un set con coreano y chino: los tres al editar', (await opcionesEditar(page)) === 'ja,ko,zh', await opcionesEditar(page))
  check('  …con el suyo puesto (japonés)', (await page.$eval('#mcEdIdioma', (s) => s.value)) === 'ja')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.locator('#mcAlbum [data-carta="M6A-002"]').first().click()
  await page.waitForTimeout(1200)
  check('una copia china abre en chino (no se la cambia a japonés)', (await page.$eval('#mcEdIdioma', (s) => s.value)) === 'zh', await page.$eval('#mcEdIdioma', (s) => s.value))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── Añadir varias: idioma y estado ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=M6A&catalogo=JP')
  await page.click('#mcMarcarAbrir')
  await page.waitForTimeout(400)
  await page.click('#mcAlbum [data-carta="M6A-003"]')
  await page.waitForTimeout(300)
  await page.click('#mcMarcarGuardar')
  await page.waitForSelector('#mcCambioVarias[open]', { timeout: 5000 }).catch(() => {})
  const hoja = await page.evaluate(() => {
    const d = document.querySelector('#mcCambioVarias')
    return d ? { abierta: d.open, titulo: d.querySelector('#cvarTitulo').textContent, idiomas: [...d.querySelectorAll('#cvarIdiomas .mc-idioma-chip')].map((b) => b.dataset.idioma).join(), boton: d.querySelector('[data-cvar="si"]').textContent, tuyas: d.querySelector('#cvarTuyas').hidden } : null
  })
  check('Añadir con una marcada abre la hoja «Añadir» con idioma y estado', hoja?.abierta && hoja.titulo === 'Añadir' && hoja.boton === 'Añadir 1' && hoja.tuyas, JSON.stringify(hoja))
  check('  …con japonés, coreano y chino (los de su set)', hoja?.idiomas === 'ja,ko,zh', hoja?.idiomas)
  await page.click('#cvarIdiomas .mc-idioma-chip[data-idioma="ko"]')
  await page.click('#cvarEstados [data-estado="EX"]')
  await page.click('#mcCambioVarias [data-cvar="si"]')
  await page.waitForTimeout(1500)
  check('se añade en coreano y EX', (await lineas(page)).includes('M6A-003:ko:EX'), await lineas(page))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── En el occidental, los de siempre ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=bw10')
  await page.click('#mcMarcarAbrir')
  await page.waitForTimeout(400)
  await page.click('#mcAlbum [data-carta="bw10-2"]')
  await page.click('#mcMarcarGuardar')
  await page.waitForSelector('#mcCambioVarias[open]', { timeout: 5000 }).catch(() => {})
  const idiomas = await page.$$eval('#cvarIdiomas .mc-idioma-chip', (bs) => bs.map((b) => b.dataset.idioma).join()).catch(() => '')
  check('la hoja ofrece los occidentales, sin coreano ni chino', idiomas.includes('es') && idiomas.includes('en') && !/ko|zh/.test(idiomas), idiomas)
  await page.click('#mcCambioVarias [data-cvar="no"]')
  await page.waitForTimeout(500)
  check('Cancelar no añade nada', !(await lineas(page)).includes('bw10-2'), await lineas(page))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
