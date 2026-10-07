// Tanda 710 — las expansiones con anillo de progreso, y en el móvil en
// filas compactas (C2 de la lista de propuestas, elegida por PINGU).
//
// Lo que se mira: que cada expansión TUYA lleve su anillo con el tanto por
// ciento bueno (y la completa en verde con su marca), que en el móvil la
// tarjeta sea una fila baja con «8 de 12» debajo del nombre y sin las
// cifras, la gráfica ni el pie, que en el escritorio siga la tarjeta
// entera, y que en el catálogo sin cuenta NO haya anillos (sin colección
// no hay progreso: un 0 % en cada set afirmaría algo falso).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const semilla = ({ sesion }) => {
  window.__FAKE_SESSION__ = sesion ? 'admin-1' : 'none'
  window.__FAKE_SETS__ = [
    { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 4, card_count_total: 4, tcg_online_code: 'PRC' },
    { id: 'xy6', name: 'Cielos Rugientes', serie_id: 'xy', market: 'WEST', release_date: '2015-05-06', card_count_official: 4, card_count_total: 4, tcg_online_code: 'ROS' },
  ]
  const carta = (set, n, nombre) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${set}/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], tcg_sets: { id: set, name: set, serie_id: 'xy' } })
  window.__FAKE_CARTAS__ = [1, 2, 3, 4].flatMap((n) => [carta('xy5', n, `Uno ${n}`), carta('xy6', n, `Dos ${n}`)])
  window.__FAKE_COLECCION__ = sesion ? [
    ...[1, 2, 3, 4].map((n) => ({ id: `a${n}`, card_id: `xy5-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' })),
    { id: 'b1', card_id: 'xy6-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' },
  ] : []
}
async function abrir(ruta, { movil = true, sesion = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla, { sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return { page, ctx, errores }
}
const tarjetas = (page) => page.$$eval('.mc-set-tarjeta', (ts) => ts.map((t) => {
  const an = t.querySelector('.mc-set-anillo')
  const vis = (s) => { const e = t.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0 }
  return {
    set: t.dataset.set,
    alto: Math.round(t.getBoundingClientRect().height),
    anillo: an ? { pct: an.style.getPropertyValue('--pct'), label: an.getAttribute('aria-label'), completo: an.classList.contains('completo'), texto: an.textContent.trim(), marca: !!an.querySelector('svg'), ancho: Math.round(an.getBoundingClientRect().width) } : null,
    corta: vis('.mc-set-corta') ? t.querySelector('.mc-set-corta').textContent.trim() : null,
    cifras: vis('.mc-set-cifras'), grafica: vis('.mc-set-grafica'), pie: vis('.mc-set-pie'),
  }
}))

console.log('── 1. En un iPhone: filas compactas con su anillo ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const ts = await tarjetas(page)
  const a = ts.find((t) => t.set === 'xy5'), b = ts.find((t) => t.set === 'xy6')
  check('las dos expansiones están', !!a && !!b, JSON.stringify(ts))
  check('la completa: anillo verde con la marca, «4 de 4»', a?.anillo?.completo && a.anillo.marca && a.anillo.pct === '100' && a.anillo.label === '4 de 4', JSON.stringify(a))
  check('la de una de cuatro: 25 %, escrito dentro', b?.anillo && !b.anillo.completo && b.anillo.pct === '25' && b.anillo.texto === '25%' && b.anillo.label === '1 de 4', JSON.stringify(b))
  check('el anillo se ve y mide lo que debe (48 px)', a?.anillo?.ancho === 48 && b?.anillo?.ancho === 48)
  check('cada fila es baja (≤ 90 px) y dice «1 de 4» bajo el nombre', ts.every((t) => t.alto <= 90) && b?.corta === '1 de 4' && a?.corta === '4 de 4 · completa', JSON.stringify(ts.map((t) => [t.alto, t.corta])))
  check('  …sin las cifras, la gráfica ni el pie de la tarjeta grande', ts.every((t) => !t.cifras && !t.grafica && !t.pie))
  const aro = await page.$eval('.mc-set-tarjeta[data-set="xy6"] .mc-set-anillo > i', (i) => getComputedStyle(i).backgroundImage)
  check('el aro es un degradado cónico que llega al 25 %', /conic-gradient/.test(aro), aro)
  await ctx.close()
}

console.log('── 2. En el escritorio sigue la tarjeta entera, con su anillo ──')
{
  const { page, ctx, errores } = await abrir('/mi-coleccion.html?ver=album', { movil: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const ts = await tarjetas(page)
  check('las cifras y el pie siguen, y el anillo también', ts.length === 2 && ts.every((t) => t.cifras && t.pie && t.anillo), JSON.stringify(ts))
  check('  …y la cuenta corta no se repite (ya está en la cifra «Tienes»)', ts.every((t) => t.corta === null))
  await ctx.close()
}

console.log('── 3. El catálogo sin cuenta: sin anillos ──')
{
  const { page, ctx, errores } = await abrir('/cartas.html', { sesion: false })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const ts = await tarjetas(page)
  check('hay expansiones y ninguna lleva anillo', ts.length >= 2 && ts.every((t) => t.anillo === null), JSON.stringify(ts.map((t) => [t.set, t.anillo])))
  check('  …y la fila dice cuántas cartas tiene el set', ts.find((t) => t.set === 'xy5')?.corta === '4 cartas', JSON.stringify(ts.map((t) => t.corta)))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
