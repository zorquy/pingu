// Tanda 1097 — «Para cambio» con varias (PINGU: «puedes seleccionar cartas en
// cualquier sitio y añadirlas en bulk, pero lo que no puedes es darlas para
// cambio»).
//
// Lo que se mira:
//   · lo puro (`cambioDeLineas`): una de cada, todas menos una y todas, y que
//     nunca baja lo que ya dabas;
//   · en una expansión: la barra lleva «Para cambio»; con una tuya (de dos
//     copias), una que ya das y una que no tienes, la hoja dice cuántas de
//     cada; «Todas menos una» deja la de dos dando una, no toca la que ya
//     daba y AÑADE la que no tenías con su idioma y estado, ya para cambio;
//   · cancelar no escribe nada;
//   · en «Cartas» se marca una COPIA y esa da todas con «Todas»;
//   · en una tienda, «Para cambio» no sale.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 4, card_count_total: 4, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [1, 2, 3, 4].map((n) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', variants: { normal: true } }))
  window.__FAKE_COLECCION__ = [
    { id: 'l1', card_id: 'xy5-1', market: 'WEST', cantidad: 2, cambio: 0, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
    { id: 'l2', card_id: 'xy5-2', market: 'WEST', cantidad: 3, cambio: 3, idioma: 'en', estado: 'EX', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
  ]
  window.__FAKE_ALBUMES__ = []
  window.__FAKE_DESEOS__ = []
}
async function abrir(ruta = '/mi-coleccion.html?ver=album&set=xy5', { movil = true, antes = null } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(semilla)
  if (antes) await ctx.addInitScript(antes)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|r2\.limitlesstcg\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, ctx, errores }
}
const tabla = (page, t) => page.evaluate((t) => JSON.parse(JSON.stringify(window.__TABLAS__[t] || [])), t)
const seleccionar = async (page) => { await page.locator('[data-seleccionar]:visible').first().click(); await page.waitForTimeout(300) }
const tocar = async (page, id) => { await page.locator(`#mcAlbum .mc-bolsillo-enlace[data-carta="${id}"]`).first().click(); await page.waitForTimeout(120) }

console.log('── 1. Lo puro ──')
{
  const { page, ctx } = await abrir('/mi-coleccion.html')
  const r = await page.evaluate(async () => {
    const { cambioDeLineas } = await import('/js/mi-coleccion/cambio-varias.js')
    const ls = [{ id: 'a', cantidad: 3, cambio: 0 }, { id: 'b', cantidad: 1, cambio: 0 }]
    return {
      una: cambioDeLineas(ls, 'una'),
      menos: cambioDeLineas(ls, 'menos-una'),
      todas: cambioDeLineas(ls, 'todas'),
      yaDaba: cambioDeLineas([{ id: 'a', cantidad: 3, cambio: 2 }], 'una'),
      noBaja: cambioDeLineas([{ id: 'a', cantidad: 3, cambio: 3 }], 'menos-una'),
      unaSola: cambioDeLineas([{ id: 'a', cantidad: 1, cambio: 0 }], 'menos-una'),
    }
  })
  check('una de cada: la línea con más copias da una', JSON.stringify(r.una) === '[{"id":"a","cambio":1}]', JSON.stringify(r.una))
  check('todas menos una: te quedas una de la mayor y das el resto', JSON.stringify(r.menos) === '[{"id":"a","cambio":2},{"id":"b","cambio":1}]', JSON.stringify(r.menos))
  check('todas: das todo', JSON.stringify(r.todas) === '[{"id":"a","cambio":3},{"id":"b","cambio":1}]', JSON.stringify(r.todas))
  check('si ya das alguna, «una» no toca nada', r.yaDaba.length === 0)
  check('nunca baja lo que ya dabas', r.noBaja.length === 0)
  check('con una sola copia, «todas menos una» no da nada', r.unaSola.length === 0)
  await ctx.close()
}

console.log('── 2. En una expansión ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  await seleccionar(page)
  check('la barra lleva «Para cambio», apagado sin nada marcado', (await page.locator('#mcMarcarCambio').isVisible()) && (await page.locator('#mcMarcarCambio').isDisabled()))
  for (const id of ['xy5-1', 'xy5-2', 'xy5-3']) await tocar(page, id)
  check('las cinco acciones caben y miden 44 o más', await page.$$eval('#mcMarcarAcciones button', (bs) => bs.filter((b) => b.offsetParent).length === 5 && bs.every((b) => b.getBoundingClientRect().height >= 44 && b.scrollWidth <= b.clientWidth + 1)))
  // Cancelar no escribe.
  await page.click('#mcMarcarCambio')
  await page.waitForSelector('#mcCambioVarias[open]', { timeout: 4000 })
  const hoja = await page.evaluate(() => ({
    cuenta: document.getElementById('cvarCuenta').textContent,
    tuyas: !document.getElementById('cvarTuyas').hidden && document.getElementById('cvarTuyasRot').textContent,
    nuevas: !document.getElementById('cvarNuevas').hidden && document.getElementById('cvarNuevasRot').textContent,
    idiomas: document.querySelectorAll('#cvarIdiomas [data-idioma]').length,
  }))
  check('la hoja dice cuántas tienes y cuántas se añaden', hoja.cuenta === '3 cartas' && hoja.tuyas === 'De las 2 que tienes, das' && /La que no tienes se añade así/.test(hoja.nuevas) && hoja.idiomas >= 2, JSON.stringify(hoja))
  await page.click('#mcCambioVarias [data-cvar="no"]')
  await page.waitForTimeout(300)
  check('cancelar no escribe nada', (await tabla(page, 'user_collection')).length === 2 && (await tabla(page, 'user_collection')).find((l) => l.id === 'l1').cambio === 0)
  // Ahora sí: todas menos una, en inglés y Excellent.
  await page.click('#mcMarcarCambio')
  await page.waitForSelector('#mcCambioVarias[open]')
  await page.click('#cvarCuantas [data-cuantas="menos-una"]')
  await page.click('#cvarIdiomas [data-idioma="en"]')
  await page.click('#cvarEstados [data-estado="EX"]')
  await page.click('#mcCambioVarias [data-cvar="si"]')
  await page.waitForTimeout(1200)
  const filas = await tabla(page, 'user_collection')
  const l1 = filas.find((l) => l.id === 'l1')
  const l2 = filas.find((l) => l.id === 'l2')
  const nueva = filas.find((l) => l.card_id === 'xy5-3')
  check('la de dos copias pasa a dar una', l1?.cambio === 1, JSON.stringify(l1))
  check('la que ya daba todas no se toca', l2?.cambio === 3 && l2.cantidad === 3, JSON.stringify(l2))
  check('la que no tenías se añade en inglés, Excellent y para cambio', nueva && nueva.cantidad === 1 && nueva.cambio === 1 && nueva.idioma === 'en' && nueva.estado === 'EX', JSON.stringify(nueva))
  const aviso = limpio(await page.locator('.toast').last().innerText().catch(() => ''))
  check('el aviso lo cuenta y el modo se apaga', /1 carta para cambio/.test(aviso) && /1 añadida y para cambio/.test(aviso) && !(await page.locator('#mcMarcarBarra .mc-sel-arriba').isVisible()), aviso)
  await ctx.close()
}

console.log('── 3. En «Cartas», una copia ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=cartas')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await seleccionar(page)
  await page.locator('#mcCartas .mc-carta[data-linea="l1"]').first().click()
  await page.waitForTimeout(200)
  await page.click('#mcMarcarCambio')
  await page.waitForSelector('#mcCambioVarias[open]')
  check('sin cartas por añadir, no pregunta idioma', await page.locator('#cvarNuevas').isHidden())
  await page.click('#cvarCuantas [data-cuantas="todas"]')
  await page.click('#mcCambioVarias [data-cvar="si"]')
  await page.waitForTimeout(900)
  const l1 = (await tabla(page, 'user_collection')).find((l) => l.id === 'l1')
  check('esa copia da todas (2 de 2)', l1?.cambio === 2, JSON.stringify(l1))
  await ctx.close()
}

console.log('── 4. En el PC ──')
{
  const { page, ctx } = await abrir('/mi-coleccion.html?ver=album&set=xy5', { movil: false })
  await seleccionar(page)
  await tocar(page, 'xy5-1')
  check('la barra lleva las cinco y no se sale', await page.$$eval('#mcMarcarAcciones button', (bs) => bs.filter((b) => b.offsetParent).length === 5 && bs.every((b) => b.scrollWidth <= b.clientWidth + 1)))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
