// Tanda 1026 — la ficha de un producto con su PVP, «Qué lleva dentro» (con la
// cuenta del pack) y «Viene en» (los packs que lo llevan, lo que sale cada
// uno, cinco a la vista y «Ver más»). Las filas se abren: tocar el sobre
// dentro del bundle abre la ficha del sobre, y al revés.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const REAL = JSON.parse(readFileSync(new URL('./fixtures/tcggo-producto-1026.json', import.meta.url), 'utf8'))
const { filaDeProducto } = await import(`${RAIZ}/js/productos.js`)

const SETS = [{ id: 'me30', name: '30 aniversario', serie_id: 'me', market: 'WEST', release_date: '2026-09-16', card_count_official: 128, card_count_total: 128, tcggo_id: 431, logo_tcggo: 'https://images.tcggo.com/logo-30.png' }]
// El sobre y el bundle del ejemplo real, y seis packs más que llevan el
// sobre (para que «Viene en» pase de cinco).
const SOBRE = { ...filaDeProducto(REAL.lista.data[0]), id: 48447, episode_id: 431 } // 10,50 €, lowest_ES 8,99
const BUNDLE = { ...filaDeProducto(REAL.lista.data[1]), id: 48449, episode_id: 431 } // 59,99 €, lowest_ES 47,95, PVP 29,99
const PACKS = [48450, 48451, 48452, 48453, 48454, 48455].map((id, i) => ({ id, episode_id: 431, lang: 'en', name: `Pack ${i + 1} con sobres`, tipo: 'coleccion', image: null, cm_lowest: 40 + i * 10, cm_lowest_eu: 40 + i * 10, cm_lowest_es: 40 + i * 10, release_date: '2026-09-16' }))
const CONTENIDO = [
  { product_id: 48449, contenido_tipo: 'product', contenido_id: 48447, cantidad: 6, nombre: '30th Celebration Booster', image: SOBRE.image, cm_lowest: 10.5, tp_market: 11.2 },
  ...PACKS.map((p, i) => ({ product_id: p.id, contenido_tipo: 'product', contenido_id: 48447, cantidad: 4 + i, nombre: '30th Celebration Booster', image: null, cm_lowest: 10.5, tp_market: null })),
  // Una ETB con un sobre con precio y accesorios sin él: la cuenta es orientativa.
  { product_id: 48455, contenido_tipo: 'product', contenido_id: 48460, cantidad: 1, nombre: 'Accesorios de la caja', image: null, cm_lowest: null, tp_market: null },
  { product_id: 48455, contenido_tipo: 'card', contenido_id: 31799, cantidad: 1, nombre: 'Spinarak (promo)', image: null, cm_lowest: 0.03, tp_market: null },
]
const b = await chromium.launch()
async function abrir(ruta, { movil = false } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, PRODUCTOS, CONTENIDO }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = []
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PRODUCTOS__ = PRODUCTOS
    window.__FAKE_MIS_PRODUCTOS__ = []
    window.__FAKE_PRODUCTO_CONTENIDO__ = CONTENIDO
    localStorage.setItem('pokedoc-onboarding', '1')
  }, { SETS, PRODUCTOS: [SOBRE, BUNDLE, ...PACKS], CONTENIDO })
  await ctx.route(/images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#c9a24d"/></svg>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"filas":[]}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { ctx, page, errores }
}
const texto = (page, sel) => page.evaluate((sel) => document.querySelector(sel)?.textContent.replace(/\s+/g, ' ').trim() || '', sel)

console.log('── 1. El bundle: PVP y qué lleva dentro ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=productos&producto=48449')
  await page.waitForTimeout(1200)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la ficha del bundle se abre desde la dirección', (await page.evaluate(() => document.getElementById('mcProdFicha')?.open)) && /Bundle/.test(await texto(page, '#mcProdFichaTitulo')))
  check('la chapa del PVP: 29,99 € y a cuánto está hoy (47,95 €, un 60 % por encima)', (await texto(page, '#mcProdFicha .mc-prod-pvp')) === 'PVP 29,99 € · hoy un 60 % por encima', await texto(page, '#mcProdFicha .mc-prod-pvp'))
  const dentro = await page.evaluate(() => {
    const bloques = [...document.querySelectorAll('#mcProdContenido .mc-prodc-bloque')].map((s) => s.querySelector('h3').textContent)
    const filas = [...document.querySelectorAll('#mcProdContenido .mc-prodc-bloque:first-child .mc-prodc-fila')].map((f) => ({ tag: f.tagName, abre: f.dataset.prodFicha, texto: f.textContent.replace(/\s+/g, ' ').trim() }))
    const cuenta = [...(document.querySelector('#mcProdContenido .mc-prodc-cuenta')?.children || [])].map((c) => c.textContent.trim()).join(' ')
    const veredicto = document.querySelector('#mcProdContenido .mc-prodc-veredicto')
    return { visible: !document.getElementById('mcProdContenido').classList.contains('hidden'), bloques, filas, cuenta, veredicto: veredicto ? [veredicto.className, veredicto.textContent.trim()] : null }
  })
  check('«Qué lleva dentro»: ×6 sobres, 10,50 € cada uno, 63,00 € en total, y la fila se abre', dentro.visible && dentro.bloques[0] === 'Qué lleva dentro' && dentro.filas.length === 1 && dentro.filas[0].tag === 'BUTTON' && dentro.filas[0].abre === '48447' && /×6/.test(dentro.filas[0].texto) && /30th Celebration Booster/.test(dentro.filas[0].texto) && /10,50 € cada uno/.test(dentro.filas[0].texto) && /63,00 €/.test(dentro.filas[0].texto), JSON.stringify(dentro))
  check('  …la cuenta contra el precio en español del pack (47,95 €): comprarlo suelto sale 15,05 € mejor', /Todo lo de dentro, suelto 63,00 €/.test(dentro.cuenta) && /El pack hoy 47,95 €/.test(dentro.cuenta) && dentro.veredicto?.[0] === 'mc-prodc-veredicto bien' && dentro.veredicto[1] === 'El pack sale 15,05 € mejor que comprarlo suelto', JSON.stringify([dentro.cuenta, dentro.veredicto]))
  check('  …y el bundle no viene en nada: solo ese bloque', dentro.bloques.length === 1, dentro.bloques.join())
  if (process.env.CAPS) { await page.evaluate(() => document.getElementById('mcProdContenido').scrollIntoView()); await page.screenshot({ path: `${process.env.CAPS}/1026-bundle.png` }) }
  await page.click('#mcProdContenido .mc-prodc-fila[data-prod-ficha="48447"]')
  await page.waitForTimeout(1200)
  check('tocar el sobre abre SU ficha', (await texto(page, '#mcProdFichaTitulo')) === '30th Celebration Booster')
  const viene = await page.evaluate(() => {
    const s = [...document.querySelectorAll('#mcProdContenido .mc-prodc-bloque')].find((x) => x.querySelector('h3').textContent === 'Viene en')
    if (!s) return null
    const filas = [...s.querySelectorAll('.mc-prodc-fila')]
    const visibles = filas.filter((f) => f.getBoundingClientRect().height > 0)
    return { n: filas.length, visibles: visibles.length, primera: [...(visibles[0]?.querySelectorAll('.mc-prodc-texto b, .mc-prodc-texto small, .mc-prodc-eur') || [])].map((c) => c.textContent.replace(/\s+/g, ' ').trim()).join(' '), ver: s.querySelector('[data-prodc-ver]')?.textContent.trim(), pvp: !!document.querySelector('#mcProdFicha .mc-prod-pvp') }
  })
  // El precio del bundle es el de España (47,95 €, la 967): 47,95 / 6 = 7,99 por sobre.
  check('«Viene en»: los 7 packs, cinco a la vista, el que sale mejor por sobre primero (el bundle: 47,95 € / 6 = 7,99 € cada uno)', viene && viene.n === 7 && viene.visibles === 5 && /Booster Bundle/.test(viene.primera) && /6 dentro · 47,95 €/.test(viene.primera) && /7,99 €\s*cada uno/.test(viene.primera) && viene.ver === 'Ver 2 más', JSON.stringify(viene))
  check('  …y el sobre, sin PVP, no lleva chapa', viene && !viene.pvp)
  if (process.env.CAPS) { await page.evaluate(() => document.getElementById('mcProdContenido').scrollIntoView()); await page.screenshot({ path: `${process.env.CAPS}/1026-sobre.png` }) }
  await page.click('#mcProdContenido [data-prodc-ver]')
  await page.waitForTimeout(300)
  const tras = await page.evaluate(() => ({ visibles: [...document.querySelectorAll('#mcProdContenido .mc-prodc-fila')].filter((f) => f.getBoundingClientRect().height > 0).length, ver: !!document.querySelector('#mcProdContenido [data-prodc-ver]') }))
  check('  …«Ver 2 más» los despliega y se va', tras.visibles === 7 && !tras.ver, JSON.stringify(tras))
  await ctx.close()
}

console.log('\n── 2. Una ETB con cosas sin precio, en el móvil ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=productos&producto=48455', { movil: true })
  await page.waitForTimeout(1200)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const r = await page.evaluate(() => {
    const filas = [...document.querySelectorAll('#mcProdContenido .mc-prodc-bloque:first-child .mc-prodc-fila')].map((f) => ({ tag: f.tagName, texto: f.textContent.replace(/\s+/g, ' ').trim() }))
    const v = document.querySelector('#mcProdContenido .mc-prodc-veredicto')
    return { filas, veredicto: v ? [v.className, v.textContent.trim()] : null, cuenta: [...(document.querySelector('#mcProdContenido .mc-prodc-cuenta')?.children || [])].map((c) => c.textContent.trim()).join(' '), ancho: document.documentElement.scrollWidth <= innerWidth + 1 }
  })
  check('tres filas: los sobres (se abren), los accesorios sin precio y la carta promo (no se abren)', r.filas.length === 3 && r.filas[0].tag === 'BUTTON' && r.filas[1].tag === 'DIV' && /sin precio/.test(r.filas[1].texto) && r.filas[2].tag === 'DIV' && /Carta/.test(r.filas[2].texto) && /0,03 €/.test(r.filas[2].texto), JSON.stringify(r.filas))
  check('  …la cuenta es orientativa, y lo dice (una cosa sin precio)', r.veredicto?.[0] === 'mc-prodc-veredicto parcial' && /1 cosa de dentro sin precio/.test(r.veredicto[1]) && /Lo de dentro con precio, suelto/.test(r.cuenta), JSON.stringify([r.cuenta, r.veredicto]))
  check('  …y nada se sale de lado en el iPhone', r.ancho)
  if (process.env.CAPS) { await page.evaluate(() => document.getElementById('mcProdContenido').scrollIntoView()); await page.screenshot({ path: `${process.env.CAPS}/1026-etb-movil.png` }) }
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
