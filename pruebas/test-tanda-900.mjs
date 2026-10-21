// Tanda 900 — el precio de la pestaña Cambios del perfil es el de la
// ficha: el mínimo de Cardmarket en el IDIOMA de la copia, con los mismos
// respaldos (`valorDe`). Pintaba `cm_low` a secas —el mínimo entre todos
// los idiomas— y PINGU y soyfedeegb lo vieron: 14,90 € en la pestaña,
// 230 € (español) en la ficha.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

console.log('── 1. Lo estático ──')
{
  const js = leer('js/perfil-cambios.js')
  check('pide la fila entera de precios y la monta como la ficha', /from\('tcg_card_prices'\)\.select\('\*'\)/.test(js) && /\[p\.card_id, precioDeFila\(p\)\]/.test(js))
  check('  …y el precio de cada baldosa es el del idioma de la copia (`valorDe`)', /valorDe\(precios\.get\(f\.card_id\) \|\| null, f\.idiomas\?\.\[0\] \|\| null\)/.test(js) && (js.match(/precioDeFilaDeCambio\(precios, f\)/g) || []).length >= 1)
  check('  …sin el `cm_low` a secas de antes', !/\[p\.card_id, p\.cm_low\]/.test(js))
}

console.log('\n── 2. En el perfil de otra persona ──')
const browser = await chromium.launch()
{
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'fede', display_name: 'soyfedeegb' }]
    window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 5 }, (_, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i}` }))
    window.__FAKE_COLECCION__ = [
      // La da en español y en inglés: manda el primero (español).
      { id: 'l1', user_id: 'user-2', card_id: 'xy5-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', cambio: 1 },
      { id: 'l2', user_id: 'user-2', card_id: 'xy5-1', market: 'WEST', cantidad: 1, idioma: 'en', estado: 'NM', variante: 'normal', cambio: 1 },
      // Esta no tiene precio en español: el respaldo es el general.
      { id: 'l3', user_id: 'user-2', card_id: 'xy5-2', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'LP', variante: 'normal', cambio: 1 },
    ]
    // La busca en inglés: el precio es el inglés.
    window.__FAKE_DESEOS__ = [{ id: 'd3', user_id: 'user-2', card_id: 'xy5-3', idioma: 'en' }]
    window.__FAKE_PRECIOS__ = [
      { card_id: 'xy5-1', market: 'WEST', cm_low: 14.9, cm_low_es: 230, cm_low_en: 80, cm_low_it: 40 },
      { card_id: 'xy5-2', market: 'WEST', cm_low: 3.5 },
      { card_id: 'xy5-3', market: 'WEST', cm_low: 20, cm_low_es: 185, cm_low_en: 60 },
    ]
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"/>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/usuario.html?id=user-2&ver=cambios`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const precios = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.pc-carta')].map((c) => [c.querySelector('a')?.getAttribute('href') || c.textContent.trim().slice(0, 12), c.querySelector('.pc-carta-precio')?.textContent.trim() || ''])))
  const de = (id) => Object.entries(precios).find(([k]) => k.includes(id))?.[1]
  check('la que da en español vale lo que la ficha dice en español (230 €), no el mínimo entre idiomas (14,90)', de('xy5-1') === '230,00 €', JSON.stringify(precios))
  check('la que no tiene precio en su idioma cae al general, como la ficha', de('xy5-2') === '3,50 €', JSON.stringify(precios))
  check('la que busca en inglés vale lo inglés', de('xy5-3') === '60,00 €', JSON.stringify(precios))
  await ctx.close()
}
await browser.close()

console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
