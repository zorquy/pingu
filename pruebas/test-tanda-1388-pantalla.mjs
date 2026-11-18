// Tanda 1388 — dos fallos de la carta (PINGU, con dos capturas):
//   · «cuando buscas en el buscador una carta y le das, te sale este pop-up
//     raro… que saliese el pop-up de siempre»: la lupa lleva a Cartas › Buscar
//     con el pop-up de Mi colección (998), pero el oyente de la 1043 se comía
//     el enlace y sacaba la ficha rápida;
//   · «cuando cambias entre las versiones (normal, Winner Stamp, Jumbo…), la
//     imagen de la carta no cambia»: en /carta y en la ficha rápida, la
//     chapa de versión ahora pone la foto propia de la versión.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const SETS = [{ id: 'ex11', name: 'Legend Maker', serie_id: 'ex', market: 'WEST', release_date: '2006-02-13', card_count_official: 92, card_count_total: 93 }]
const CARTAS = [{ id: 'ex11-1', set_id: 'ex11', local_id: '1', name: 'Aerodactyl', name_es: 'Aerodactyl', market: 'WEST', category: 'Pokemon', rarity: 'Rare', rarity_en: 'Rare Holo', image_path: 'ex/ex11/1', variants: { normal: false, holo: true, reverse: true }, detalle_at: new Date().toISOString() }]
const FOTO_VERSION = 'https://images.tcggo.com/prueba/aerodactyl-cosmos.png'
const VERSIONES = [{ tcggo_id: 50939, card_id: 'ex11-1', set_id: 'ex11', market: 'WEST', etiqueta: 'Cosmos Holo', origen: 'mano', imagen: FOTO_VERSION, cm_low: 3, cm_low_es: 3 }]
const browser = await chromium.launch()
const errores = []
async function abrir(ruta, { pc = true } = {}) {
  const ctx = await browser.newContext({ viewport: pc ? { width: 1280, height: 900 } : { width: 390, height: 844 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, VERSIONES }) => {
    window.__FAKE_SESSION__ = 'user-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_VERSIONES__ = VERSIONES
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PRECIOS__ = [{ card_id: 'ex11-1', cm_low: 6.45, cm_low_en: 35, checked_at: new Date().toISOString() }]
  }, { SETS, CARTAS, VERSIONES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => { if (!/Transition was (aborted|skipped)/.test(String(e))) errores.push(`${ruta}: ${String(e).slice(0, 160)}`) })
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  return { ctx, page }
}
const foto = (page) => page.evaluate(() => document.querySelector('#cartaNucleo .carta-scan img')?.getAttribute('src') || '')

console.log('── 1. La versión cambia la foto (/carta) ──')
{
  const { ctx, page } = await abrir('/carta.html?id=ex11-1')
  await page.waitForSelector('#cmPrecios .pv-impresion', { timeout: 8000 }).catch(() => {})
  const antes = await foto(page)
  const chapas = await page.$$eval('#cmPrecios .pv-impresion b', (bs) => bs.map((b) => b.textContent.trim()))
  check('hay chapas de versión, con la Cosmos Holo', chapas.includes('Cosmos Holo'), JSON.stringify(chapas))
  await page.click('#cmPrecios .pv-impresion:has-text("Cosmos Holo")')
  await page.waitForTimeout(400)
  const cosmos = await foto(page)
  check('al elegir la Cosmos Holo, la foto es la suya', cosmos === `${FOTO_VERSION}`, `${antes} → ${cosmos}`)
  await page.click('#cmPrecios .pv-impresion:not(:has-text("Cosmos Holo"))')
  await page.waitForTimeout(400)
  check('al volver a otra sin foto propia, vuelve la de la carta', (await foto(page)) === antes, await foto(page))
  await ctx.close()
}

console.log('── 2. La lupa abre el pop-up de siempre ──')
for (const pc of [true, false]) {
  const lado = pc ? 'PC' : 'móvil'
  const { ctx, page } = await abrir('/foro', { pc })
  const enlace = `/cartas?ver=buscar&q=aero&carta=ex11-1`
  // El enlace tal y como lo pinta la lupa (`destinoDe`), tocado en una página cualquiera.
  await page.evaluate((h) => { const a = document.createElement('a'); a.href = h; a.id = 'zzLupa'; a.textContent = 'Aerodactyl'; document.body.append(a) }, enlace)
  await Promise.all([page.waitForURL(/\/cartas/, { timeout: 8000 }).catch(() => {}), page.click('#zzLupa')])
  await page.waitForTimeout(2500)
  const r = await page.evaluate(() => ({ url: location.pathname + location.search, editor: document.getElementById('mcEditor')?.open, rapida: document.getElementById('fichaRapida')?.open || false, nombre: document.querySelector('#mcEditor h2, #mcEditor #mcEditorTitulo')?.textContent.trim() }))
  check(`${lado}: va a Cartas › Buscar con lo buscado`, /^\/cartas/.test(r.url) && /q=aero/.test(r.url), r.url)
  check(`${lado}:   …y abre el pop-up de siempre, no la ficha rápida`, r.editor === true && !r.rapida, JSON.stringify(r))
  await ctx.close()
}

console.log('── 3. Lo de la 1043 sigue: otra carta, pop-up sin irse ──')
{
  const { ctx, page } = await abrir('/foro')
  await page.evaluate(() => { const a = document.createElement('a'); a.href = '/carta/aerodactyl-ex11-1'; a.id = 'zzCarta'; a.textContent = 'Aerodactyl'; document.body.append(a) })
  const antes = page.url()
  await page.click('#zzCarta')
  await page.waitForTimeout(2500)
  check('un enlace a /carta fuera de la lupa sigue abriendo su pop-up sin irse', page.url() === antes && (await page.evaluate(() => document.getElementById('fichaRapida')?.open)), page.url())
  await ctx.close()
}

check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
