// Tandas 707 y 708 — la ficha de una carta con las acciones a mano, y los
// pequeños del móvil.
//
// 707: en /carta las losetas Añadir/Editar/Avísame iban bajo la foto, que
// en un móvil es la primera pantalla entera. Van en una barra fija encima
// de la barra de secciones; la foto se queda en 200 px; las burbujas de
// idioma del precio son una fila que se desplaza. 708: el botón «Ver las
// guías» de la portada se salía de su tarjeta (100 % más 32 de sangría);
// las 43 páginas llevan `viewport-fit=cover` y la barra de arriba el
// hueco de la muesca.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readdirSync, readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'

console.log('── 708. Las páginas, de fuente ──')
{
  const paginas = readdirSync(RAIZ).filter((f) => f.endsWith('.html')).concat(readdirSync(`${RAIZ}/admin`).filter((f) => f.endsWith('.html')).map((f) => `admin/${f}`))
  const sinCover = paginas.filter((p) => !/<meta name="viewport" content="width=device-width, initial-scale=1\.0, viewport-fit=cover"/.test(readFileSync(`${RAIZ}/${p}`, 'utf8')))
  check(`las ${paginas.length} páginas llevan viewport-fit=cover`, paginas.length > 40 && sinCover.length === 0, sinCover.join(', '))
  check('la barra de arriba reserva el hueco de la muesca', /\.navbar \{[^}]*padding-top: env\(safe-area-inset-top\)/s.test(readFileSync(`${RAIZ}/css/style.css`, 'utf8')))
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164 }]
  window.__FAKE_CARTAS__ = [{ id: 'xy5-12', market: 'WEST', set_id: 'xy5', local_id: '12', name: 'Charizard', name_es: 'Charizard', image_path: 'xy/xy5/12', rarity: 'Rare Holo', category: 'Pokemon', dex_ids: [6], variants: { normal: true, reverse: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }]
  window.__FAKE_COLECCION__ = [{ id: 'l12', card_id: 'xy5-12', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
}
async function abrir(ruta, { movil = true } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1200, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, ctx, errores }
}

console.log('── 707. La ficha de una carta en un iPhone ──')
{
  const { page, ctx, errores } = await abrir('/carta.html?id=xy5-12')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const a = await page.$eval('#cartaAcciones', (e) => { const r = e.getBoundingClientRect(); return { pos: getComputedStyle(e).position, bottom: Math.round(r.bottom), left: Math.round(r.left), w: Math.round(r.width), vw: window.innerWidth, losetas: e.querySelectorAll('.mc-ficha-tile').length } })
  const barra = await page.$eval('.bm', (e) => Math.round(e.getBoundingClientRect().top))
  check('las acciones van en una barra FIJA encima de la barra de secciones, de lado a lado', a.pos === 'fixed' && a.bottom <= barra && a.bottom >= barra - 24 && a.left >= 8 && a.left <= 24 && a.w === a.vw - 2 * a.left && a.losetas === 4, JSON.stringify({ a, barra }))
  check('  …y cada loseta mide 44 o más', (await page.$$eval('#cartaAcciones .mc-ficha-tile', (as) => as.every((x) => x.getBoundingClientRect().height >= 44))))
  check('la foto se queda en 200 px para que quepa con el nombre', (await page.$eval('.carta-scan', (e) => Math.round(e.getBoundingClientRect().width))) <= 200)
  const chips = await page.$$eval('#cmIdiomas', (es) => es.map((e) => ({ filas: new Set([...e.children].map((c) => Math.round(c.getBoundingClientRect().top))).size })))
  if (chips.length) check('las burbujas de idioma del precio van en UNA fila que se desplaza', chips[0].filas === 1, JSON.stringify(chips))
  else console.log('  (sin fila de idiomas en esta ficha de pruebas: no se mide)')
  await ctx.close()
  const d = await abrir('/carta.html?id=xy5-12', { movil: false })
  check('en el escritorio las losetas siguen bajo la foto, sin fijar', (await d.page.$eval('#cartaAcciones', (e) => getComputedStyle(e).position)) === 'static')
  await d.ctx.close()
}

console.log('── 708. El botón de «Tus primeros pasos» cabe en su tarjeta ──')
{
  const { page, ctx } = await abrir('/index.html')
  const r = await page.$eval('.paso-boton', (e) => { const b = e.getBoundingClientRect(); const t = e.closest('.primeros-pasos').getBoundingClientRect(); return { boton: Math.round(b.right), tarjeta: Math.round(t.right) } })
  check('el botón «Ver las guías» no se sale por la derecha de su tarjeta', r.boton <= r.tarjeta, JSON.stringify(r))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
