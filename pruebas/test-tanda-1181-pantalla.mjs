// Tanda 1181 — la gráfica del Panel llena su caja (PINGU mandó la captura del
// móvil con un hueco vacío entre la gráfica y 7D/1M/…).
//
// La 1179 subió la CAJA (`.mc-valor-lienzo`) a 200 px y dejó el DIBUJO
// (`.mc-valor-grafica`) en sus 128: 72 px de nada debajo. Y la regla iba
// detrás de la del móvil, así que el móvil tampoco cogía sus 160 ni su cifra.
// Se mide lo que se ve: el SVG acaba donde acaba su caja, en los dos anchos.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const dia = (hace, valor) => ({ dia: new Date(Date.now() - hace * 864e5).toISOString().slice(0, 10), valor, copias: 1, sin_precio: 0 })
const VALOR = [dia(28, 100), dia(20, 140), dia(10, 120), dia(0, 150)]

async function abrir(movil) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], serviceWorkers: 'block' } : { viewport: { width: 1280, height: 1000 }, serviceWorkers: 'block' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>' }))
  await page.route('**/api.tcgdex.net/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
  await page.addInitScript((vals) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura' }]
    window.__FAKE_CARTAS__ = [{ id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Carta 1', name_es: 'Carta 1', image_path: 'x/1', market: 'WEST', rarity: 'Rare' }]
    window.__FAKE_COLECCION__ = [{ id: 'c1', user_id: 'admin-1', card_id: 'sv1-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, cambio: 0, valor_manual: 150, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }]
    window.__FAKE_VALOR__ = vals
  }, VALOR)
  await page.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcValorCaja .mc-valor-grafica', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(800)
  return { ctx, page, errores }
}

for (const [nombre, movil, alto, cifraMax] of [['PC', false, 200, 999], ['móvil', true, 160, 40]]) {
  console.log(`\n── ${nombre} ──`)
  const { ctx, page, errores } = await abrir(movil)
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const caja = r('#mcValorCaja .mc-valor-lienzo'), svg = r('#mcValorCaja .mc-valor-grafica')
    const cifra = document.querySelector('#mcValorCaja .mc-cartera-cifra')
    return { caja: caja && Math.round(caja.height), svg: svg && Math.round(svg.height), hueco: caja && svg ? Math.round(caja.bottom - svg.bottom) : null, cifra: cifra ? parseFloat(getComputedStyle(cifra).fontSize) : null }
  })
  check('la gráfica está', m.caja && m.svg, JSON.stringify(m))
  check(`la caja mide ${alto} px`, m.caja === alto, JSON.stringify(m))
  check('  …y el dibujo la llena, sin hueco debajo', m.svg === m.caja && Math.abs(m.hueco) <= 1, JSON.stringify(m))
  check(`la cifra no pasa de ${cifraMax} px`, m.cifra !== null && m.cifra <= cifraMax, JSON.stringify(m))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
