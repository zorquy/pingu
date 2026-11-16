// Tanda 1373 — Expansiones en una fila («Más mejoras», B; PINGU: «dale con
// lo recomendado»). En Mi colección y en /cartas, en el móvil y en el PC:
//   · buscar · bandera · Filtros en UNA fila que cabe (sin lupa, sin el
//     Occidental / Japonés grande en otro piso);
//   · la bandera cambia de catálogo (y se pinta japonesa);
//   · el buscador se escribe ahí mismo y filtra;
//   · Filtros abre la hoja «Filtros» (Mostrar, Ordenar, Serie) y con algo
//     puesto se pinta en color con su cuenta.
import { chromium, sembrar, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()
async function abrir(movil, ruta) {
  const ctx = await b.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 900 }, isMobile: movil, hasTouch: movil, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, 'user-1')
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|cdn\.jsdelivr|\/sprite\//, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(e.message))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { ctx, page, errores }
}
const medir = (page) => page.evaluate(() => {
  const fila = document.getElementById('mcEstanteriaFila')
  if (!fila) return null
  const vis = [fila.querySelector('.mc-buscador'), ...fila.querySelectorAll('.mc-mandos > *')].filter((e) => e && e.getBoundingClientRect().width > 2 && getComputedStyle(e).display !== 'none')
  const rs = vis.map((e) => e.getBoundingClientRect())
  return {
    ids: vis.map((e) => e.id || String(e.className).split(' ')[0]),
    centros: rs.map((r) => Math.round(r.top + r.height / 2)),
    derecha: Math.round(Math.max(...rs.map((r) => r.right))),
    ancho: document.documentElement.clientWidth,
    lupa: Boolean(document.querySelector('#mcEstanteriaLupa')),
    segGrande: [...document.querySelectorAll('#mcEstanteriaZona .seg')].some((s) => /Occidental/.test(s.textContent) && s.getBoundingClientRect().width > 0),
  }
})
const sets = (page) => page.$$eval('#mcEstanteriaRejilla [data-set]', (xs) => xs.filter((x) => x.getBoundingClientRect().width > 0).map((x) => x.dataset.set))

for (const ruta of ['/mi-coleccion?ver=album', '/cartas']) {
  for (const movil of [true, false]) {
    const quien = `${movil ? 'móvil' : 'PC'} · ${ruta}`
    const { ctx, page, errores } = await abrir(movil, ruta)
    const m = await medir(page)
    const fila = m && Math.max(...m.centros) - Math.min(...m.centros) <= 4 && m.derecha <= m.ancho + 1
    check(`${quien}: buscar · bandera · Filtros en una fila que cabe`, fila && m.ids.includes('mcEstanteriaBusca') && m.ids.includes('mc-chapa-select') && m.ids.includes('mcEstanteriaOrdenAbrir'), JSON.stringify(m))
    check(`${quien}: sin lupa ni el Occidental / Japonés grande`, m && !m.lupa && !m.segGrande, JSON.stringify(m))
    // El buscador, ahí mismo
    const todos = await sets(page)
    await page.fill('#mcEstanteriaBuscar', 'Corona')
    await page.waitForTimeout(700)
    const buscados = await sets(page)
    check(`${quien}: escribir en el buscador filtra`, todos.length > 1 && buscados.length >= 1 && buscados.length < todos.length, `${todos.length} → ${buscados.length}`)
    await page.fill('#mcEstanteriaBuscar', '')
    await page.waitForTimeout(500)
    // La bandera
    const valor = (texto) => page.$eval('#mcEstanteriaFila select.mc-mercado', (s, t) => [...s.options].find((o) => o.textContent.includes(t))?.value, texto)
    const jp = await valor('Japon'), occ = await valor('Occidental')
    await page.selectOption('#mcEstanteriaFila select.mc-mercado', jp).catch(() => {})
    await page.waitForTimeout(1200)
    const cat = await page.$eval('#mcEstanteriaFila select.mc-mercado', (s) => ({ v: s.value, cat: s.dataset.cat }))
    check(`${quien}: la bandera cambia al japonés`, cat.v === jp && cat.cat === 'ja', JSON.stringify(cat))
    await page.selectOption('#mcEstanteriaFila select.mc-mercado', occ).catch(() => {})
    await page.waitForTimeout(1200)
    // Filtros
    await page.click('#mcEstanteriaOrdenAbrir')
    await page.waitForTimeout(400)
    check(`${quien}: Filtros abre la hoja «Filtros»`, (await page.textContent('#mcEstanteriaOrden[open] h2').catch(() => '')).trim() === 'Filtros')
    await page.click('#mcEstanteriaOrden [data-orden-sets="nuevas"]')
    await page.waitForTimeout(400)
    await page.click('#mcEstanteriaOrdenCerrar')
    await page.waitForTimeout(300)
    check(`${quien}: con un orden puesto, Filtros en color y con su cuenta`, await page.$eval('#mcEstanteriaOrdenAbrir', (e) => e.classList.contains('mc-filtros-puestos') && e.querySelector('.mc-filtros-cuenta').textContent.trim() === '1'))
    check(`${quien}: sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(N)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
