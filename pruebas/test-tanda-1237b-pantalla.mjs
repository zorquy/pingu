// Tanda 1237b — «Ficha completa» del pop-up de Mi colección y /cartas lleva a
// /carta. PINGU: «le doy a ficha completa y no funciona el enlace». El oyente
// de la 1043 (app.js) convierte cualquier clic en un enlace a una carta en su
// pop-up, y #mcEdFicha no llevaba `data-ficha-completa`: el clic volvía a
// abrir el mismo pop-up y parecía que no hacía nada (desde la 1043).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── 0. Lo estático ──')
for (const f of ['mi-coleccion.html', 'cartas.html']) {
  check(`${f}: «Ficha completa» lleva data-ficha-completa`, /<a class="mc-fila mc-fila-ficha" id="mcEdFicha"[^>]*\sdata-ficha-completa[\s>]/.test(readFileSync(join(RAIZ, f), 'utf8')))
}

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 }]
const carta = (n, nombre) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: nombre, name_es: nombre, image_path: `sv/sv8/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [25], variants: { normal: true }, tcg_sets: SETS[0] })
const CARTAS = [carta(238, 'Pikachu ex'), carta(239, 'Raichu')]
const browser = await chromium.launch()
for (const [nombre, ruta, ctxOpts] of [
  ['Mi colección, PC', '/mi-coleccion.html?ver=album&set=sv8', { viewport: { width: 1366, height: 900 } }],
  ['Mi colección, móvil', '/mi-coleccion.html?ver=album&set=sv8', devices['iPhone 13']],
  ['/cartas, PC', '/cartas.html?ver=album&set=sv8', { viewport: { width: 1366, height: 900 } }],
]) {
  console.log(`── ${nombre} ──`)
  const ctx = await browser.newContext({ ...ctxOpts, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: [], __FAKE_DESEOS__: [], __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }],
      __FAKE_COLECCION__: [{ id: 'l1', user_id: 'admin-1', card_id: 'sv8-238', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 }] })
  }, { SETS, CARTAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|scrydex|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#f59e0b"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  // El salto entre páginas en un navegador sin pantalla aborta la transición
  // («ViewTransition opt-in disabled», también en la 1043): no es de esta tanda.
  page.on('pageerror', (e) => { if (!/ViewTransition/.test(String(e))) errores.push(String(e).slice(0, 180)) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('#mcAlbum [data-carta="sv8-238"]').first().click()
  await page.waitForTimeout(1500)
  const href = await page.getAttribute('#mcEdFicha', 'href')
  check('el enlace apunta a la ficha de la carta', /^\/carta\//.test(href || ''), href)
  await page.locator('#mcEdFicha').scrollIntoViewIfNeeded()
  await Promise.all([page.waitForURL(/\/carta(\/|\.html)/, { timeout: 8000 }).catch(() => {}), page.locator('#mcEdFicha').click()])
  check('pulsar «Ficha completa» va a /carta (no vuelve a abrir el pop-up)', /\/carta(\/|\.html)/.test(new URL(page.url()).pathname), page.url())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `❌ ${fails} FALLA(S)` : '✅ TODO BIEN')
process.exit(fails ? 1 : 0)
