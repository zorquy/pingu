// Tanda 1123 — la limpieza de Cartas en /admin: la sección es «Marcas
// legales» (las marcas de la temporada y, plegadas, las herramientas de
// diagnóstico), sin los importadores de TCGdex, sin los códigos de TCG Live a
// mano ni «Emparejar» / «Precios de TCGGO ahora»; y la marca de cada set está
// en Colecciones y funciona allí.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript(() => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_FILAS__ = { tcg_sets: [
    { id: 'sv10', name: 'Destined Rivals', market: 'WEST', release_date: '2025-05-30', regulation_mark: 'I', regulation_mark_origen: 'cartas' },
    { id: 'sv10.5', name: 'Black Bolt', market: 'WEST', release_date: '2025-07-18', regulation_mark: 'I', regulation_mark_origen: 'fecha' },
  ] }
})
await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => { if (!/serviceWorker' property from 'Navigator'/.test(String(e))) errores.push(String(e).slice(0, 180)) })
await page.goto(`${BASE}/admin/?ver=cards`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1500)

const nav = await page.textContent('.admin-nav-item[data-section="cards"]')
check('en el menú se llama «Marcas legales»', /Marcas legales/.test(nav), nav)
const sec = await page.textContent('#section-cards')
check('las marcas de la temporada, a la vista', await page.isVisible('#marcasLegales') && await page.isVisible('#btnGuardarMarcas'))
check('sin importadores de TCGdex, ni códigos a mano, ni emparejar ni precios', !/Buscar sets en TCGdex|Importar los que faltan|Reimportar|Códigos de set de TCG Live|Emparejar con TCGGO|Precios de TCGGO ahora/.test(sec))
check('el diagnóstico, plegado', !(await page.isVisible('#btnTcggoEstado')) && (await page.$('details #btnTcggoEstado')) !== null)
await page.click('#section-cards details summary')
await page.click('#btnTcggoEstado')
await page.waitForTimeout(600)
check('  …y sigue funcionando («Estado del catálogo»)', /CATÁLOGO \(tcggo_catalogo\)/.test(await page.inputValue('#cardsDiagnostico')))
await page.click('.admin-nav-item[data-section="colecciones"]')
await page.waitForTimeout(800)
check('la marca de cada set está en Colecciones, con las deducidas a la vista', /Black Bolt/.test(await page.textContent('#section-colecciones #marcasSetLista')) && /deducidas/.test(await page.textContent('#marcasSetResumen')))
const opciones = await page.$$eval('#marcaSetCual option', (o) => o.length)
check('  …con la lista de sets para corregir (se cargan igual)', opciones > 0, opciones)
check('sin errores en la página', !errores.length, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
