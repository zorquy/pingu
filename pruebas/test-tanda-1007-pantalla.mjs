// Tanda 1007 — la «Normal» que no existe, también cuando llegan las versiones.
//
// PINGU, con el Reshiram de Legendary Treasures al separar versiones: «yo la
// tengo agregada como normal, pero no existe la variante normal de esa carta,
// solo la holográfica… debería prevalecer la holográfica y mantenerse en mi
// colección». La carta es Rara Holo, TCGdex dice «normal» y TCGGO trae su fila
// «Holo»: salían las dos casillas, y la copia en la de «Normal».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
const v = await import(`${RAIZ}/js/mi-coleccion/variantes.js`)
const reshi = { id: 'bw11-RC22', set_id: 'bw11', market: 'WEST', rarity: 'Rare Holo', rarity_en: 'Rare Holo', variants: { normal: true } }
check('sin versiones de TCGGO: solo Holo', v.variantesDeCarta(reshi).map((e) => e.nuestro).join() === 'holo')
check('con la fila «Holo» de TCGGO: sigue siendo solo Holo (antes, Normal y Holo)', v.variantesDeCarta({ ...reshi, versiones: [{ etiqueta: 'Holo' }] }).map((e) => e.nuestro).join() === 'holo')
check('  …y una copia en «Normal» se lee Holo', v.versionPosible('normal', { ...reshi, versiones: [{ etiqueta: 'Holo' }] }) === 'holo')
check('con las dos dichas por TCGdex (Pitch Black) se quedan las dos', v.variantesDeCarta({ ...reshi, variants: { normal: true, holo: true }, versiones: [{ etiqueta: 'Holo' }] }).map((e) => e.nuestro).sort().join() === 'holo,normal')
const wotc = { id: 'base1-4', set_id: 'base1', market: 'WEST', rarity: 'Rare Holo', variants: { holo: true }, versiones: [{ etiqueta: '1st Edition', origen: 'edicion' }, { etiqueta: 'Unlimited', origen: 'edicion' }] }
check('una «Normal» de Wizards con ediciones es la Unlimited, no la 1.ª', v.versionPosible('normal', wotc) === 'unlimited', v.versionPosible('normal', wotc))

console.log('── 2. En pantalla, con las versiones separadas ──')
const SETS = [{ id: 'bw11', name: 'Legendary Treasures', serie_id: 'bw', market: 'WEST', release_date: '2013-11-08', card_count_official: 113, card_count_total: 140 }]
const CARTAS = [{ ...reshi, local_id: 'RC22', name: 'Reshiram', image_path: 'bw/bw11/RC22' }]
const VERSIONES = [{ tcggo_id: 71234, market: 'WEST', card_id: 'bw11-RC22', set_id: 'bw11', etiqueta: 'Holo', cm_low: 2 }]
const COLECCION = [{ id: 'l1', user_id: 'user-1', card_id: 'bw11-RC22', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal' }]
const browser = await chromium.launch()
const errores = []
async function abrir(ruta) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('mc-split', '1') } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_VERSIONES__: d.VERSIONES, __FAKE_COLECCION__: d.COLECCION, __FAKE_ERAS__: [] })
  }, { SETS, CARTAS, VERSIONES, COLECCION })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="63" height="88"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  return { ctx, page }
}
{
  const { ctx, page } = await abrir('/mi-coleccion?ver=buscar&q=reshiram')
  const r = await page.$$eval('#mcBuscarResultados .mc-resultado[data-carta="bw11-RC22"]', (as) => as.map((a) => `${a.dataset.variante}:${a.classList.contains('tengo') ? 'tengo' : '-'}`))
  check('Buscar: una sola casilla, la Holo, y la tienes', r.join() === 'holo:tengo', r.join())
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/mi-coleccion?ver=album&set=bw11')
  const r = await page.$$eval('#mcAlbum [data-carta="bw11-RC22"]', (as) => [...new Set(as.map((a) => a.dataset.variante || '-'))])
  check('La expansión: una sola casilla, la Holo', r.join() === 'holo', r.join())
  await ctx.close()
}
check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
