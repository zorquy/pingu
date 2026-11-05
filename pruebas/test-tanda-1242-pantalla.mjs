// Tanda 1242 — Tiendas entra en Comunidad (PINGU: «me parece bien hacer un
// nuevo apartado para las tiendas en comunidad») y Eventos lleva el calendario
// («me has puesto un icono como de brújula. Mejor el de calendario»). Se mira:
//   · las 49 páginas con barra llevan Tiendas entre Eventos y Gente, en el
//     desplegable de arriba y en el menú plegado, y el pie sigue con «Para tiendas»;
//   · /tiendas es página de lista: sin `data-detalle`, con la burbuja de
//     Comunidad y Tiendas marcada;
//   · el móvil: la burbuja de /foro tiene Eventos con el calendario, Tiendas con
//     la tienda y su punto de «Nuevo»;
//   · el PC: la lateral lleva Tiendas con «Nuevo» y Eventos con el calendario;
//   · `esNueva` deja de serlo el día que dice `NUEVA_HASTA`;
//   · la bienvenida de Comunidad tiene la fila de Tiendas con «Nuevo».
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readdirSync, readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

console.log('── 1. Las barras de las páginas ──')
{
  const html = readdirSync(RAIZ).filter((f) => f.endsWith('.html'))
  const conBarra = html.filter((f) => readFileSync(`${RAIZ}/${f}`, 'utf8').includes('<a href="/eventos">Eventos</a>'))
  const mal = conBarra.filter((f) => {
    const s = readFileSync(`${RAIZ}/${f}`, 'utf8')
    const arriba = /<a href="\/eventos">Eventos<\/a>\n\s*<a href="\/tiendas">Tiendas<\/a>\n\s*<a href="\/usuarios.html">Gente<\/a>/g
    return (s.match(arriba) || []).length !== 2 || !s.includes('<a href="/tiendas">Para tiendas</a>')
  })
  check(`las ${conBarra.length} páginas: Tiendas entre Eventos y Gente arriba y en el menú, el pie igual`, conBarra.length >= 45 && !mal.length, mal.join(', '))
  const t = readFileSync(`${RAIZ}/tiendas.html`, 'utf8').match(/<html[^>]*>/)[0]
  check('/tiendas ya no es una ficha (sin data-detalle)', t.includes('data-seccion="comunidad"') && !t.includes('data-detalle'), t)
}

console.log('── 2. Lo puro ──')
{
  const { esNueva, NUEVA_HASTA } = await import(`${RAIZ}/js/paginas-nuevas.js`)
  check('Tiendas es nueva hoy (5-11-2026) y deja de serlo el día que dice', esNueva('tiendas', new Date('2026-11-05T12:00:00')) && !esNueva('tiendas', new Date(`${NUEVA_HASTA.tiendas}T00:00:01`)) && !esNueva('foro', new Date('2026-11-05')))
  const { ICONO_DE_PAGINA } = await import(`${RAIZ}/js/barra-movil.js`).catch(() => ({}))
  if (ICONO_DE_PAGINA) check('Eventos con el calendario y Tiendas con la tienda', ICONO_DE_PAGINA.eventos === 'calendar' && ICONO_DE_PAGINA.tiendas === 'store')
}

const browser = await chromium.launch()
async function abrir({ movil = false, sesion = true } = {}) {
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((s) => { window.__FAKE_SESSION__ = s ? 'admin-1' : 'none' }, sesion)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
// El dibujo de un icono: el primer trazo de su SVG.
const dibujo = (page, sel) => page.evaluate((sel) => document.querySelector(sel)?.querySelector('svg')?.innerHTML.slice(0, 40) || '', sel)
const { icons } = await import(`${RAIZ}/js/icons.js`)
const trazo = (n) => icons[n](24).match(/<svg[^>]*>(.*)<\/svg>/s)[1].slice(0, 40)

console.log('── 3. El móvil ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await page.goto(`${BASE}/foro`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bm-burbuja-item[href="/tiendas"]', { timeout: 8000 }).catch(() => {})
  const items = await page.evaluate(() => [...document.querySelectorAll('.bm-burbuja-item')].map((a) => a.getAttribute('href')))
  check('la burbuja de Comunidad: Foro, Eventos, Tiendas, Gente', items.join('|') === '/foro.html|/eventos|/tiendas|/usuarios.html', items.join('|'))
  check('Eventos con el calendario (no la brújula)', (await dibujo(page, '.bm-burbuja-item[href="/eventos"]')) === trazo('calendar'))
  check('Tiendas con la tienda', (await dibujo(page, '.bm-burbuja-item[href="/tiendas"]')) === trazo('store'))
  const punto = await page.evaluate(() => {
    const p = document.querySelector('.bm-burbuja-item[href="/tiendas"] .bm-nuevo')
    if (!p) return null
    const r = p.getBoundingClientRect(), a = p.closest('a').getBoundingClientRect()
    return { w: r.width, dentro: r.left >= a.left && r.right <= a.right && r.top >= a.top, nombre: p.closest('a').textContent.trim() }
  })
  check('Tiendas lleva su punto de «Nuevo», dentro del botón y dicho para quien escucha', punto && punto.w >= 8 && punto.dentro && /Nuevo/.test(punto.nombre), JSON.stringify(punto))
  await page.goto(`${BASE}/tiendas`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.bm-burbuja-item[href="/tiendas"]', { timeout: 8000 }).catch(() => {})
  const aqui = await page.evaluate(() => document.querySelector('.bm-burbuja-item[aria-current="page"]')?.getAttribute('href'))
  check('en /tiendas la burbuja sale y marca Tiendas', aqui === '/tiendas', aqui)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. El PC ──')
{
  const { ctx, page, errores } = await abrir()
  await page.goto(`${BASE}/tiendas`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.lat-paginas a[href="/tiendas"]', { timeout: 8000 }).catch(() => {})
  const lat = await page.evaluate(() => {
    const a = document.querySelector('.lat-paginas a[href="/tiendas"]')
    const n = a?.querySelector('.lat-nuevo')
    return a && { actual: a.getAttribute('aria-current'), nuevo: n?.textContent, alto: Math.round(a.getBoundingClientRect().height), dentro: n ? n.getBoundingClientRect().right <= a.getBoundingClientRect().right : false }
  })
  check('la lateral: Tiendas marcada, con «Nuevo» dentro de su fila', lat && lat.actual === 'page' && lat.nuevo === 'Nuevo' && lat.alto >= 44 && lat.dentro, JSON.stringify(lat))
  check('la lateral: Eventos con el calendario', (await dibujo(page, '.lat-paginas a[href="/eventos"]')) === trazo('calendar'))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. La bienvenida de Comunidad ──')
{
  const { ctx, page, errores } = await abrir()
  await page.goto(`${BASE}/foro?bienvenida=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#bvsDialogo[open]', { timeout: 8000 }).catch(() => {})
  const filas = await page.evaluate(() => [...document.querySelectorAll('#bvsDialogo .bvs-fila')].map((a) => ({ n: a.querySelector('b')?.textContent.trim(), href: a.getAttribute('href') })))
  const t = filas.find((f) => f.href === '/tiendas')
  check('cuatro filas y Tiendas con «Nuevo»', filas.length === 4 && t && /^Tiendas\s+Nuevo$/.test(t.n), JSON.stringify(filas))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
