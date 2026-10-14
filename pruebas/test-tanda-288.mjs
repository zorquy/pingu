// Tanda 288: el banner de noticias de la portada.
//
// Antes era una fila fina con el titular de la última noticia. PINGU lo
// quiso como BANNER —con la imagen de portada— y que además se entienda
// que Noticias es una SECCIÓN, no ese artículo suelto.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 140) : ''}`)
}

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const abrir = async (semillas) => {
  const page = await browser.newPage({ viewport: { width: 1150, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, semillas)
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1700)
  return { page, errores }
}

// Desde la 844 la noticia es el bloque nuevo (js/portada-bloques.js): la
// última con el titular encima de su foto y dos más en filas. Lo que esta
// prueba defendía sigue igual: la foto en diferido y con su hueco, el enlace a
// todas FUERA del banner, la consulta que pide la portada y que no desborde.
console.log('\n── 1. Con portada: el titular sobre la foto ──')
{
  const { page, errores } = await abrir({
    __FAKE_NOTICIAS__: [{ title: 'Reveladas las 128 cartas del set', cover_image: '/fotos/foto1.svg' }],
  })
  const b = page.locator('#noticiaPortada .pb-noticia')
  check('hay banner', (await b.count()) === 1)
  check('con la imagen de portada', (await b.locator('img.pb-noticia-foto').getAttribute('src')) === '/fotos/foto1.svg')
  check('en diferido', (await b.locator('img').getAttribute('loading')) === 'lazy')
  check('con el titular', (await b.locator('strong').textContent())?.includes('128 cartas'))
  check('y la chapa de que es una noticia', /^Noticia/.test((await b.locator('.pb-chip').textContent())?.trim() || ''))
  check('el banner lleva al artículo', (await b.getAttribute('href')) === '/noticias/noticia-1', await b.getAttribute('href'))
  const todas = page.locator('#noticiaPortada .pb-pie-enlace a')
  check('hay enlace a todas las noticias', (await todas.count()) === 1)
  check('y lleva a /noticias', (await todas.getAttribute('href')) === '/noticias')
  check('que NO está dentro del banner', (await b.locator('.pb-pie-enlace').count()) === 0)
  // La caja tiene su alto antes de que llegue la foto (alto fijo).
  check('la imagen reserva su hueco', (await b.evaluate((n) => getComputedStyle(n).height)) === '200px', await b.evaluate((n) => getComputedStyle(n).height))
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 2. Sin portada: el color de su arte, no una caja vacía ──')
{
  const { page } = await abrir({ __FAKE_NOTICIAS__: [{ title: 'Noticia sin foto', cover_image: null }] })
  const b = page.locator('#noticiaPortada .pb-noticia')
  check('sin foto, ni una <img> rota', (await b.locator('img').count()) === 0)
  check('  …con su color y su titular', /\barte-[1-6]\b/.test((await b.getAttribute('class')) || '') && (await b.locator('strong').textContent())?.includes('sin foto'))
  await page.close()
}

console.log('\n── 3. Si no hay noticias, la sección se recoge ──')
{
  const { page } = await abrir({ __FAKE_NOTICIAS__: [] })
  check('nada de un hueco que no explica nada', !(await page.locator('#noticiaPortadaSeccion').isVisible()))
  await page.close()
}

console.log('\n── 4. La más reciente arriba, y dos más ──')
{
  const { page } = await abrir({
    __FAKE_NOTICIAS__: [
      { title: 'La de hoy', cover_image: '/fotos/foto1.svg' },
      { title: 'La de ayer', cover_image: '/fotos/foto2.svg' },
      { title: 'La de anteayer', cover_image: '/fotos/foto3.svg' },
      { title: 'La de hace una semana' },
    ],
  })
  check('una grande, y es la más reciente', (await page.locator('#noticiaPortada .pb-noticia').count()) === 1 && (await page.locator('#noticiaPortada .pb-noticia strong').textContent())?.includes('La de hoy'))
  const mas = await page.locator('#noticiaPortada .pb-noticias-mas b').allTextContents()
  check('  …y las dos siguientes en filas (la cuarta no)', mas.join('|') === 'La de ayer|La de anteayer', mas.join(' | '))
  await page.close()
}

console.log('\n── 5. La consulta pide la portada ──')
{
  const src = (await import('node:fs')).readFileSync('/home/user/pingu/js/portada-bloques.js', 'utf8')
  const i = src.indexOf('async function montarNoticias')
  const elSelect = src.slice(i, i + 700).match(/\.select\('([^']*)'\)/)?.[1] || ''
  check('se pide cover_image', elSelect.split(',').map((c) => c.trim()).includes('cover_image'), elSelect)
}

console.log('\n── 6. En móvil no se desborda ──')
{
  const page = await browser.newPage({ viewport: { width: 390, height: 840 } })
  await page.addInitScript(() => { window.__FAKE_NOTICIAS__ = [{ title: 'Una noticia con un titular bastante largo para ver si cabe', cover_image: '/fotos/foto1.svg' }] })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1700)
  check('la portada no coge scroll lateral', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  const caja = await page.locator('#noticiaPortada .pb-noticia').boundingBox()
  check('y el banner cabe en la pantalla', caja && caja.width <= 390, JSON.stringify(caja))
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
