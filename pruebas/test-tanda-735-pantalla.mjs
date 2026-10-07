// Tanda 735 — comparar dos cartas lado a lado (X8 de la lista de
// propuestas, elegidas por PINGU).
//
// Lo que se mira: las reglas puras (la más barata se marca solo si las dos
// tienen cifra, «no se sabe» es «—» y no un cero, el mínimo general va con
// asterisco, la frase no afirma nada sin las dos cifras); y en /carta, que
// «Comparar con otra carta» abra el diálogo con la de la ficha, que buscar
// no ofrezca la misma carta, que elegir una pinte la tabla con sus dos
// precios y su cambio en 30 días, y que se cierre de verdad.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { datosDeLado, filasDeComparacion, resumenDeComparacion } = await import(`${RAIZ}/js/carta-comparar.js`)

let fails = 0
// Intl pone un espacio duro antes del «€»: se compara con uno normal.
const n = (t) => String(t ?? '').replace(/\u00a0|\u202f/g, ' ')
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Las reglas ──')
{
  const set = { name: 'Set Básico' }
  const a = datosDeLado({ carta: { name: 'Charizard', local_id: '4', tcg_sets: set, variants: { normal: true, holo: true } }, fila: { card_id: 'a', cm_low: 200, cm_trend: 220, cm_avg30: 210, cm_low_es: 250 } }, 'es')
  const b = datosDeLado({ carta: { name: 'Pikachu', local_id: '58', tcg_sets: set }, fila: { card_id: 'b', cm_low: 2, cm_trend: 3 } }, 'es')
  const sin = datosDeLado({ carta: { name: 'Nada', tcg_sets: set }, fila: null }, 'es')
  check('el mínimo es el del idioma elegido', a.desde === 250 && !a.desdeGeneral)
  check('  …y si no lo hay, el general con su marca', b.desde === 2 && b.desdeGeneral)
  const f = filasDeComparacion(a, b)
  check('la más barata se marca', f[0].menor === 'b' && f[1].menor === 'b' && n(f[0].b) === '2,00 € *', JSON.stringify(f[0]))
  check('  …pero no si a una le falta la cifra (y la que falta es «—»)', f[2].menor === null && f[2].b === '—')
  check('versiones: las que existen, o «No se sabe»', f[5].a === 'Normal, Holo' && f[5].b === 'No se sabe')
  check('sin precio, la columna entera dice «—» y no un cero', filasDeComparacion(a, sin).slice(0, 3).every((x) => x.b === '—' && x.menor === null))
  check('la frase: cuánto más y cuántas veces', n(resumenDeComparacion(a, b)) === 'Charizard cuesta 248,00 € más (×125).', resumenDeComparacion(a, b))
  check('  …y sin las dos cifras no afirma nada', resumenDeComparacion(a, sin) === null)
  const hist = [{ dia: '2026-08-01', cm_low_es: 100 }, { dia: '2026-09-01', cm_low_es: 150 }, { dia: '2026-10-05', cm_low_es: 200 }]
  const h = datosDeLado({ carta: { name: 'X' }, fila: null, historico: hist }, 'es')
  check('el cambio de 30 días sale del histórico; el de 90, sin datos de 90, no', h.mes === '+33 %' && h.trimestre === null, JSON.stringify(h))
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_SETS__ = [{ id: 'base1', name: 'Set Básico', serie_id: 'base', market: 'WEST' }]
  window.__FAKE_CARTAS__ = [
    { id: 'base1-4', market: 'WEST', set_id: 'base1', local_id: '4', name: 'Charizard', name_es: 'Charizard', image_path: 'base/base1/4', variants: { normal: true, holo: true }, tcg_sets: { id: 'base1', name: 'Set Básico', serie_id: 'base' } },
    { id: 'base1-2', market: 'WEST', set_id: 'base1', local_id: '2', name: 'Blastoise', name_es: 'Blastoise', image_path: 'base/base1/2', variants: { holo: true }, tcg_sets: { id: 'base1', name: 'Set Básico', serie_id: 'base' } },
    { id: 'base1-3', market: 'WEST', set_id: 'base1', local_id: '3', name: 'Chansey', name_es: 'Chansey', image_path: 'base/base1/3', variants: { holo: true }, tcg_sets: { id: 'base1', name: 'Set Básico', serie_id: 'base' } },
  ]
  window.__FAKE_PRECIOS__ = [
    { card_id: 'base1-4', cm_low: 200, cm_trend: 220, cm_low_es: 250, checked_at: new Date().toISOString() },
    { card_id: 'base1-2', cm_low: 80, cm_trend: 90, cm_low_es: 100, checked_at: new Date().toISOString() },
  ]
  const hoy = new Date()
  const dia = (n) => new Date(hoy.getTime() - n * 86_400_000).toISOString().slice(0, 10)
  window.__FAKE_HISTORIAL__ = [
    { card_id: 'base1-2', dia: dia(40), cm_low_es: 80 },
    { card_id: 'base1-2', dia: dia(1), cm_low_es: 100 },
  ]
}
async function abrir({ movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#e8564a"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/carta.html?id=base1-4`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, ctx, errores }
}
const abierto = (page) => page.evaluate(() => { const d = document.getElementById('cmCompararDialogo'); return !!d?.open && getComputedStyle(d).display !== 'none' })

for (const movil of [false, true]) {
  console.log(`── 2. En /carta (${movil ? 'móvil' : 'escritorio'}) ──`)
  const { page, ctx, errores } = await abrir({ movil })
  check('sin errores', errores.length === 0, errores.join(' | '))
  if (movil) {
    // En el móvil la ficha va en pestañas (716): el botón vive en la de precio.
    await page.click('.carta-pestanas button[data-pestana="precio"]').catch(() => {})
    await page.waitForTimeout(200)
  }
  const boton = page.locator('#cmComparar')
  check('«Comparar con otra carta», a la vista y de 44', (await boton.isVisible()) && (await boton.evaluate((b) => b.getBoundingClientRect().height >= 44)))
  await boton.click()
  await page.waitForTimeout(800)
  check('abre el diálogo con la de la ficha a la izquierda', (await abierto(page)) && /Charizard/.test(await page.textContent('#cmCompararDialogo [data-lado="a"]')))
  check('  …con la hoja puesta', (await page.$eval('#cmCompararDialogo', (d) => getComputedStyle(d).borderTopWidth)) === (movil ? '1px' : '1px'))
  check('  …y el foco en la búsqueda', await page.evaluate(() => document.activeElement?.id === 'cmCompararQ'))
  await page.fill('#cmCompararQ', 'ch')
  await page.waitForTimeout(800)
  const nombres = await page.$$eval('#cmCompararResultados .bs-fila b', (bs) => bs.map((b) => b.textContent))
  check('buscar no ofrece la misma carta', nombres.includes('Chansey') && !nombres.includes('Charizard'), JSON.stringify(nombres))
  await page.fill('#cmCompararQ', 'blast')
  await page.waitForTimeout(800)
  await page.click('#cmCompararResultados .bs-fila')
  await page.waitForTimeout(900)
  const tabla = await page.$$eval('#cmCompararTabla tbody tr', (trs) => trs.map((tr) => [...tr.children].map((c) => c.textContent.trim() + (c.classList.contains('comparar-menor') ? '!' : '')))).then((xs) => xs.map((fila) => fila.map(n)))
  check('elegir una pinta la tabla: Desde en español, la barata marcada', JSON.stringify(tabla[0]) === JSON.stringify(['Desde', '250,00 €', '100,00 €!']), JSON.stringify(tabla))
  check('  …su cambio en 30 días, y «Sin histórico» la que no tiene', JSON.stringify(tabla[3]) === JSON.stringify(['Últimos 30 días', 'Sin histórico', '+25 %']), JSON.stringify(tabla[3]))
  check('  …y las versiones de cada una', JSON.stringify(tabla[5]) === JSON.stringify(['Versiones', 'Normal, Holo', 'Holo']), JSON.stringify(tabla[5]))
  check('la frase de arriba', n(await page.textContent('#cmCompararResumen')) === 'Charizard cuesta 150,00 € más (×2,5).', await page.textContent('#cmCompararResumen'))
  const ancho = await page.evaluate(() => ({ d: document.getElementById('cmCompararDialogo').scrollWidth, c: document.getElementById('cmCompararDialogo').clientWidth }))
  check('nada se sale de lado', ancho.d <= ancho.c, JSON.stringify(ancho))
  check('los botones del diálogo miden 44', await page.$$eval('#cmCompararDialogo button', (bs) => bs.every((b) => b.getBoundingClientRect().height >= 44)))
  await page.click('[data-comparar="cambiar"]')
  await page.waitForTimeout(800)
  check('«Elegir otra» vuelve a la búsqueda, limpia', (await page.locator('#cmCompararQ').isVisible()) && (await page.textContent('#cmCompararTabla')) === '')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Esc lo cierra (y deja de verse)', !(await abierto(page)))
  check('sin errores al final', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
