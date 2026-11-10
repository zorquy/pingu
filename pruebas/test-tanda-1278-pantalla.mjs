// Tanda 1278 — lo de cartas y productos, como leyenda DENTRO de la gráfica
// del Panel (PINGU eligió la D: la franja y las dos fichas de la 766 «son 2
// líneas más» y le quitaban protagonismo a la gráfica).
//
// Se mira: la leyenda está en el lienzo y no añade alto; la cifra grande sigue
// siendo la suma; cambiar de rango repinta la gráfica y la leyenda vuelve (una
// vez); «Productos ›» lleva a Productos; sin productos no sale; sin dos días de
// historia va en la raya de «hoy» (si no hubiera lienzo, iría arriba); en el móvil son dos
// líneas que caben y en el PC una fila; y al dedo «Productos» mide 44.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''
const browser = await chromium.launch()
const dia = (hace, valor) => ({ dia: new Date(Date.now() - hace * 864e5).toISOString().slice(0, 10), valor, copias: 1, sin_precio: 0 })
const VALOR = [dia(200, 20), dia(28, 30), dia(20, 35), dia(10, 38), dia(0, 40)]
const SETS = [{ id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, tcggo_id: 300 }]
const CARTAS = [{ id: 'sv3-26', market: 'WEST', set_id: 'sv3', local_id: '26', name: 'Charmander', name_es: 'Charmander', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', variants: { normal: true } }]
const PRODUCTOS = [
  { id: 9001, episode_id: 300, lang: 'en', name: 'Obsidian Flames Booster', tipo: 'sobre', image: null, cm_lowest: 5, cm_lowest_eu: 5, cm_lowest_es: 5, cm_avg30: 4.8, release_date: '2023-08-11' },
  { id: 9002, episode_id: 300, lang: 'en', name: 'Obsidian Flames ETB', tipo: 'etb', image: null, cm_lowest: 50, cm_lowest_eu: 50, cm_lowest_es: 50, cm_avg30: null, release_date: '2023-08-11' },
]

async function abrir({ movil = false, mios = [], valor = VALOR } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1280, height: 1000 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, PRODUCTOS, mios, valor }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'sv3-26', market: 'WEST', cantidad: 4, cambio: 0, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 10, created_at: '2026-10-01T10:00:00Z' }]
    window.__FAKE_PRODUCTOS__ = PRODUCTOS
    window.__FAKE_MIS_PRODUCTOS__ = mios
    window.__FAKE_VALOR__ = valor
  }, { SETS, CARTAS, PRODUCTOS, mios, valor })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=resumen`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcValorCaja .mc-cartera-cifra', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(1800)
  return { ctx, page, errores }
}
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const MIOS = [{ product_id: 9001, cantidad: 2 }, { product_id: 9002, cantidad: 1 }]

for (const [nombre, movil] of [['PC', false], ['móvil', true]]) {
  console.log(`\n── ${nombre}: con productos ──`)
  const { ctx, page, errores } = await abrir({ movil, mios: MIOS })
  const m = await page.evaluate(() => {
    const ley = document.querySelector('#mcCarteraGrafica .mc-valor-lienzo .mc-reparto-leyenda')
    const lienzo = document.querySelector('#mcCarteraGrafica .mc-valor-lienzo')?.getBoundingClientRect()
    const r = ley?.getBoundingClientRect()
    const datos = ley ? [...ley.querySelectorAll('.mc-reparto-dato')].map((d) => d.getBoundingClientRect()) : []
    return {
      hay: !!ley,
      cuantas: document.querySelectorAll('#mcValorCaja .mc-reparto-leyenda').length,
      texto: ley?.innerText.replace(/\s+/g, ' ').trim(),
      dentro: !!(r && lienzo && r.left >= lienzo.left && r.bottom <= lienzo.bottom + 0.5 && r.top >= lienzo.top && r.right <= lienzo.right),
      izquierda: r && lienzo ? Math.round(r.left - lienzo.left) : null,
      mitad: r && lienzo ? r.right < lienzo.left + lienzo.width * 0.75 : null,
      filas: datos.length === 2 ? (Math.abs(datos[0].top - datos[1].top) < 2 ? 1 : 2) : 0,
      fuera: !document.getElementById('mcCarteraReparto') || document.getElementById('mcCarteraReparto').classList.contains('hidden'),
      viejos: document.querySelectorAll('.mc-reparto-franja, .mc-reparto-ficha, .mc-reparto-nota').length,
      punto: ley ? getComputedStyle(ley.querySelector('.mc-reparto-cartas')).backgroundColor : null,
      linea: (() => { const l = document.querySelector('#mcValorCaja .mc-valor-linea'); return l ? getComputedStyle(l).stroke : null })(),
    }
  })
  check('la leyenda está dentro de la gráfica, abajo a la izquierda', m.hay && m.dentro && m.izquierda >= 0 && m.izquierda <= 24 && m.mitad, JSON.stringify(m))
  check('  …con lo de cada parte', /Cartas 40,00 €/.test(m.texto) && /Productos 60,00 €/.test(m.texto), m.texto)
  check(`  …${movil ? 'en dos líneas' : 'en una fila'}`, m.filas === (movil ? 2 : 1), JSON.stringify(m))
  check('  …y nada arriba: ni franja, ni fichas, ni la nota', m.fuera && m.viejos === 0, JSON.stringify(m))
  check('  …el punto de «Cartas», del color de la línea', m.punto && m.punto === m.linea, `${m.punto} / ${m.linea}`)
  const cifra = limpio(await page.textContent('#mcValorCaja .mc-cartera-cifra'))
  check('la cifra grande sigue siendo la suma (40 + 60)', /100,00/.test(cifra), cifra)
  if (movil) {
    const alto = await page.$eval('#mcCarteraGrafica .mc-reparto-ir', (b) => {
      const a = getComputedStyle(b, '::after')
      return b.getBoundingClientRect().height + parseFloat(a.top) * -1 + parseFloat(a.bottom) * -1
    })
    check('al dedo, «Productos» mide 44', alto >= 44, String(alto))
  }
  if (CAPS) await page.screenshot({ path: `${CAPS}/1278-${movil ? 'movil' : 'pc'}.png`, clip: await page.$eval('#mcValorCaja', (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y + scrollY, width: r.width, height: r.height } }) })
  // Cambiar de rango repinta el lienzo entero: la leyenda tiene que volver.
  const rango = await page.$('#mcValorCaja .mc-valor-rango:not(.activo):not([disabled])')
  if (rango) {
    await rango.click()
    await page.waitForTimeout(600)
    const n = await page.$$eval('#mcCarteraGrafica .mc-valor-lienzo .mc-reparto-leyenda', (l) => l.length)
    check('cambiar de rango: la leyenda sigue, una vez', n === 1, String(n))
  } else check('hay otro rango que pulsar', false)
  await page.click('#mcCarteraGrafica .mc-reparto-ir')
  await page.waitForTimeout(1200)
  check('«Productos ›» lleva a Productos', new URL(page.url()).searchParams.get('ver') === 'productos' && (await page.isVisible('#mcPanelProductos')), page.url())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── sin productos ──')
{
  const { ctx, page, errores } = await abrir()
  const n = await page.$$eval('.mc-reparto-leyenda', (l) => l.length)
  check('sin productos, ni leyenda ni hueco', n === 0 && !(await page.isVisible('#mcCarteraReparto')), String(n))
  check('  …y la cifra es la de las cartas', /40,00/.test(limpio(await page.textContent('#mcValorCaja .mc-cartera-cifra'))))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── con productos y un solo día de historia ──')
{
  // Sin fotos diarias la gráfica es la raya de «hoy», que también es lienzo.
  const { ctx, page, errores } = await abrir({ mios: MIOS, valor: [] })
  const t = limpio(await page.innerText('#mcCarteraGrafica .mc-valor-lienzo .mc-reparto-leyenda').catch(() => ''))
  check('la leyenda va en la raya de hoy', /Cartas 40,00 €/.test(t) && /Productos 60,00 €/.test(t), t)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
