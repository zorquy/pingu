// Tanda 914 — la barra lateral del ordenador, siempre abierta.
//
// PINGU: «no quiero que se pliegue la barra y quita el icono de plegar… la
// barra siempre ahí y ya está». Plegada había que desplegarla para abrir un
// submenú, y se plegaba SOLA al entrar en una expansión (788, PA9).
//
// Se mira: no hay botón de plegar; entrar en una expansión y salir no la
// mueve ni un píxel (ni la barra ni el contenido); quien la tenía plegada la
// ve abierta y su preferencia se olvida; y no queda nada que la pliegue en
// el código (ni en app.js, que la ponía plegada antes de pintar).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 3 }]
const CARTAS = [1, 2, 3].map((n) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `sv/sv8/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv' } }))

const browser = await chromium.launch()
async function abrir(ruta, { antes = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PRECIOS__ = []
    if (d.antes) localStorage.setItem('pokedoc-lateral-plegada', d.antes)
  }, { SETS, CARTAS, antes })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.lat:not([hidden])', { timeout: 6000 }).catch(() => {})
  await page.waitForTimeout(1500)
  return { ctx, page, errores }
}
const medir = (page) => page.evaluate(() => ({
  barra: Math.round(document.querySelector('.lat')?.getBoundingClientRect().width || 0),
  cuerpo: getComputedStyle(document.body).paddingLeft,
  plegada: document.documentElement.classList.contains('lat-plegada'),
  palabras: [...document.querySelectorAll('.lat .lat-seccion-enlace span')].filter((s) => getComputedStyle(s).display !== 'none').length,
}))

console.log('── 1. Sin botón de plegar, y quieta al entrar en una expansión ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album')
  check('no hay botón de plegar', !(await page.$('.lat-plegar')))
  const antes = await medir(page)
  check('abierta: 240 px, con las palabras de las secciones', antes.barra === 240 && antes.cuerpo === '240px' && antes.palabras >= 5, JSON.stringify(antes))
  await page.locator('#mcEstanteriaRejilla [data-set="sv8"]').first().click()
  await page.waitForTimeout(1200)
  const dentro = await medir(page)
  check('al abrir una expansión, sigue abierta (ni la barra ni el contenido se mueven)', JSON.stringify(dentro) === JSON.stringify(antes), JSON.stringify(dentro))
  check('  …y la expansión está abierta', await page.$eval('#mcArchivadorZona', (z) => !z.classList.contains('hidden')))
  await page.goBack()
  await page.waitForTimeout(900)
  check('al volver a Expansiones, igual', JSON.stringify(await medir(page)) === JSON.stringify(antes))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2. Quien la tenía plegada la ve abierta ──')
{
  const { ctx, page, errores } = await abrir('/foro.html', { antes: '1' })
  const m = await medir(page)
  check('abierta aunque se apuntara plegada', !m.plegada && m.barra === 240 && m.cuerpo === '240px', JSON.stringify(m))
  check('  …y lo apuntado se olvida', (await page.evaluate(() => localStorage.getItem('pokedoc-lateral-plegada'))) === null)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. Nada en el código que la pliegue ──')
for (const f of ['js/app.js', 'js/barra-lateral.js', 'js/mi-coleccion.js', 'css/lateral.css', 'css/style.css']) {
  const s = readFileSync(`${RAIZ}/${f}`, 'utf8')
  check(`${f}: sin «lat-plegada» ni botón de plegar`, !/lat-plegada|lat-plegar|plegarLateralSola/.test(s))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
