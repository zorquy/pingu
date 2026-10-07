// Tanda 715 — el Panel como una cartera (C1 de la lista de propuestas,
// elegida por PINGU).
//
// Lo que se mira: que en el Panel el valor vaya ARRIBA, a lo ancho y en la
// talla grande, con su cambio del mes debajo; que las otras tres cifras
// sean tres fichas en una fila; que la gráfica no repita la cifra grande a
// la vista (pero sí para la lectura en voz alta); y que en el móvil la
// gráfica vaya de borde a borde.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 4, card_count_total: 4 }]
  window.__FAKE_CARTAS__ = [1, 2, 3, 4].map((n) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: `Carta ${n}`, image_path: 'x', rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
  window.__FAKE_COLECCION__ = [1, 2, 3, 4].map((n) => ({ id: `l${n}`, card_id: `xy5-${n}`, market: 'WEST', cantidad: n, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: n * 40, created_at: '2026-08-01T10:00:00Z' }))
  const hoy = Date.now()
  window.__FAKE_VALOR__ = Array.from({ length: 40 }, (_, i) => ({ dia: new Date(hoy - (39 - i) * 86400000).toISOString().slice(0, 10), valor: 900 + i * 5 }))
}
async function abrir(movil) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}
// Desde la 748 la cartera es la de su maqueta de verdad: la cabecera se
// recoge y el Panel abre con la etiqueta, la cifra grande, el cambio, la
// línea, los rangos y las tres fichas, en ese orden.
const medir = (page) => page.evaluate(() => {
  const r = (e) => e.getBoundingClientRect()
  const q = (s) => document.querySelector(s)
  const cifra = q('#mcValorCaja .mc-cartera-cifra')
  const cambio = q('#mcValorCaja .mc-valor-cambio')
  const lienzo = q('#mcValorCaja .mc-valor-lienzo')
  const rangos = q('#mcValorCaja .mc-valor-rangos')
  const fichas = [...document.querySelectorAll('.mc-cartera-fichas li')]
  return {
    cabecera: Math.round(r(q('#mcHero')).height),
    orden: !!(cifra && cambio && lienzo && rangos && fichas.length) && r(cifra).bottom <= r(cambio).top + 1 && r(cambio).bottom <= r(lienzo).top + 1 && r(lienzo).bottom <= r(rangos).top + 1 && r(rangos).bottom <= r(fichas[0]).top + 1,
    talla: cifra ? parseFloat(getComputedStyle(cifra).fontSize) : 0,
    unaFila: new Set(fichas.map((c) => Math.round(r(c).top))).size === 1 && fichas.length === 3,
    fichas: fichas.every((c) => getComputedStyle(c).borderTopWidth === '1px'),
    caja: lienzo ? { izq: Math.round(r(lienzo).left), der: Math.round(innerWidth - r(lienzo).right) } : null,
  }
})

console.log('── 1. En un iPhone ──')
{
  const { page, ctx, errores } = await abrir(true)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await medir(page)
  check('la cabecera se recoge y abre la cartera: cifra, cambio, línea, rangos y fichas', m.cabecera === 0 && m.orden, JSON.stringify(m))
  check('  …la cifra en la talla grande (34 px)', m.talla === 34, JSON.stringify(m))
  check('las tres fichas en una fila', m.unaFila && m.fichas, JSON.stringify(m))
  check('  …y la línea va de borde a borde', m.caja && m.caja.izq <= 1 && m.caja.der <= 1, JSON.stringify(m.caja))
  const ancho = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }))
  check('  …sin que la página se vaya de ancho', ancho.s <= ancho.c + 1, JSON.stringify(ancho))
  await ctx.close()
}

console.log('── 2. En el escritorio ──')
{
  const { page, ctx, errores } = await abrir(false)
  check('sin errores', errores.length === 0, errores.join(' | '))
  const m = await medir(page)
  check('la misma cartera: en orden y con las tres fichas en una fila', m.orden && m.unaFila && m.fichas, JSON.stringify(m))
  check('  …y la línea sigue en su columna (no a sangre)', m.caja && m.caja.izq > 16, JSON.stringify(m.caja))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
