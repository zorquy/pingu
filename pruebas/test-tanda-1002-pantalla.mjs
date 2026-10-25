// Tanda 1002 — las versiones de una carta abierta desde el buscador, a la primera.
//
// PINGU, con el Reshiram ex de Journey Together: «entro por el buscador
// general, clico, me sale el pop-up y solo tiene una versión. Minimizas,
// clicas otra vez y te sale la versión con el stamp». Desde el buscador la
// carta llega sin sus versiones de TCGGO; se pedían al abrir, pero solo se
// repintaba el desplegable escondido del editor, no la fila que se ve.
//
// Y la 1003: PINGU, ya con la 1002 puesta, «nope, sigue sin salir a la
// primera». Con la base lenta (en el doble, `__FAKE_RETRASO__`) la ficha se
// pintaba antes de que llegaran; ahora el buscador las pide al volver.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const SETS = [{ id: 'sv09', name: 'Journey Together', serie_id: 'sv', market: 'WEST', release_date: '2025-03-28', card_count_official: 159, card_count_total: 190 }]
const CARTAS = [{ id: 'sv09-030', set_id: 'sv09', local_id: '030', name: 'Reshiram ex', market: 'WEST', category: 'Pokemon', rarity: 'Double rare', rarity_en: 'Double Rare', image_path: 'sv/sv09/030', variants: { holo: true, normal: false, reverse: false } }]
const VERSIONES = [{ tcggo_id: 61234, market: 'WEST', card_id: 'sv09-030', set_id: 'sv09', etiqueta: 'Expansion Stamp', cm_low: 0.5 }]
const browser = await chromium.launch()
const errores = []
async function abrir(ruta, { sesion = 'none', retraso = 0, col = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    if (d.retraso) window.__FAKE_RETRASO__ = { tcg_card_versions: d.retraso }
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_VERSIONES__: d.VERSIONES, __FAKE_COLECCION__: d.col })
  }, { SETS, CARTAS, VERSIONES, sesion, retraso, col })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="63" height="88"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(900)
  return { ctx, page }
}
const versiones = (page) => page.evaluate(() => [...document.querySelectorAll('#mcEdVersiones .mc-version b')].map((b) => b.textContent.trim()))

console.log('── 1. Desde la lupa de arriba (`?carta=`) ──')
{
  const { ctx, page } = await abrir('/cartas?ver=buscar&q=reshiram&carta=sv09-030')
  const v = await versiones(page)
  check('a la primera: Holo y Expansion Stamp', v.includes('Holo') && v.includes('Expansion Stamp'), JSON.stringify(v))
  await ctx.close()
}

console.log('── 2. Desde Cartas › Buscar, tocando el resultado ──')
{
  const { ctx, page } = await abrir('/cartas?ver=buscar&q=reshiram')
  await page.click('#mcBuscarResultados .mc-resultado[data-carta="sv09-030"]')
  await page.waitForTimeout(900)
  const v = await versiones(page)
  check('a la primera: Holo y Expansion Stamp', v.includes('Holo') && v.includes('Expansion Stamp'), JSON.stringify(v))
  await ctx.close()
}
console.log('── 3. Con la base lenta (1003), con cuenta y desde Mi colección ──')
{
  const LENTO = 1500
  const col = [{ id: 'l1', user_id: 'user-1', card_id: 'sv09-030', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo' }]
  for (const [rotulo, opciones] of [['sin tenerla', {}], ['teniéndola', { col }]]) {
    const { ctx, page } = await abrir('/mi-coleccion?ver=buscar&q=reshiram', { sesion: 'user-1', retraso: LENTO, ...opciones })
    // La búsqueda ya volvió (`networkidle` + 900 ms): sus versiones, de camino
    // o ya aquí. Al tocar, la ficha sale con ellas sin esperar otra consulta.
    await page.waitForTimeout(LENTO)
    await page.click('#mcBuscarResultados .mc-resultado[data-carta="sv09-030"]')
    await page.waitForTimeout(400)
    const v = await versiones(page)
    check(`${rotulo}: a la primera, sin esperar a otra consulta`, v.includes('Holo') && v.includes('Expansion Stamp'), JSON.stringify(v))
    await ctx.close()
  }
  // Y si se toca ANTES de que lleguen, aparecen en cuanto llegan (la 1002):
  // la ficha espera a la consulta del buscador.
  const { ctx, page } = await abrir('/mi-coleccion?ver=buscar&q=reshiram', { sesion: 'user-1', retraso: LENTO })
  await page.click('#mcBuscarResultados .mc-resultado[data-carta="sv09-030"]')
  await page.waitForTimeout(LENTO + 600)
  const v = await versiones(page)
  check('tocada antes de que lleguen: salen al llegar', v.includes('Holo') && v.includes('Expansion Stamp'), JSON.stringify(v))
  await ctx.close()
}
check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
