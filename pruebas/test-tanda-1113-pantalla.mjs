// Tanda 1113 — el buscador de /cartas trae TODAS las que casan (PINGU:
// buscando «pikachu» no salía el Pikachu de Temporal Forces, «y hay un
// montón de cartas de Pikachu que no salen»).
//
// El tope era 120 por orden alfabético: con más de 120 Pikachu, los que
// caían detrás no salían nunca. Ahora se piden hasta 2.000 por páginas de
// 1.000, que es lo que la base da como mucho por respuesta (808). El doble
// corta a 1.000 como la base (`__MAX_FILAS__`), o la prueba no probaría
// las páginas.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

function semilla() {
  window.__FAKE_SESSION__ = 'none'
  window.__MAX_FILAS__ = 1000
  const sets = Array.from({ length: 13 }, (_, i) => [`old${String(i).padStart(2, '0')}`, `Set viejo ${i}`, `2010-01-${String(i + 1).padStart(2, '0')}`, 'bw'])
  sets.push(['sv5', 'Temporal Forces', '2024-03-22', 'sv'])
  window.__FAKE_SETS__ = sets.map(([id, name, release_date, serie_id]) => ({ id, name, release_date, serie_id, market: 'WEST', card_count_official: 218, card_count_total: 218 }))
  const porId = Object.fromEntries(sets.map(([id, name, release_date, serie_id]) => [id, { id, name, release_date, serie_id }]))
  const c = (setId, n) => ({ id: `${setId}-${n}`, market: 'WEST', set_id: setId, local_id: String(n), name: 'Pikachu', name_es: 'Pikachu', image_path: `x/${setId}/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [25], tcg_sets: porId[setId] })
  // 1.300 Pikachu viejos que van antes en el orden, y el de Temporal Forces el último.
  window.__FAKE_CARTAS__ = [...sets.slice(0, 13).flatMap(([id]) => Array.from({ length: 100 }, (_, n) => c(id, n + 1))), c('sv5', 51), { ...c('sv5', 52), name: 'Raichu', name_es: 'Raichu', dex_ids: [26] }]
  window.__FAKE_PRECIOS__ = []
}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
await ctx.addInitScript(semilla)
await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
await ctx.route(/limitlesstcg|pokemontcg|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.goto(`${BASE}/cartas?ver=buscar&q=pikachu`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => /\d+ cartas/.test(document.getElementById('mcBuscarCuantas')?.textContent || ''), null, { timeout: 15000 }).catch(() => {})
await page.waitForTimeout(800)
const cuenta = await page.locator('#mcBuscarCuantas').textContent().catch(() => '')
check('«pikachu» trae los 1.301 Pikachu, aunque la base corte a 1.000 por respuesta', /^1301 cartas/.test(cuenta.trim()), cuenta)
check('  …sin «hay más, afina la búsqueda»', !/hay más/.test(cuenta), cuenta)
const html = await page.locator('#mcBuscarResultados').innerHTML()
check('  …y entre ellos el de Temporal Forces, que era el último del orden', /Temporal Forces/.test(html) && /sv5-51/.test(html))
check('  …y no el Raichu', !/sv5-52/.test(html))
check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()

const comun = readFileSync(`${RAIZ}/js/buscar-cartas.js`, 'utf8')
check('las páginas desempatan por id (sin repetir ni saltarse cartas)', /order\('name_search'\)\.order\('id'\)\.range\(/.test(comun))
check('/cartas pide hasta 2.000', /const TOPE = 2000/.test(readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')))

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
