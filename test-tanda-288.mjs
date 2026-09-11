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

const BASE = 'http://localhost:8892'
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

console.log('\n── 1. Con portada: banner con imagen ──')
{
  const { page, errores } = await abrir({
    __FAKE_NOTICIAS__: [{ title: 'Reveladas las 128 cartas del set', cover_image: '/fotos/foto1.svg' }],
  })
  const b = page.locator('#noticiaPortada .noticia-banner')
  check('hay banner', (await b.count()) === 1)
  check('con la imagen de portada', (await b.locator('img.noticia-banner-foto').getAttribute('src')) === '/fotos/foto1.svg')
  // Sin `loading=lazy` la portada pagaría la imagen en la primera
  // pantalla, y el presupuesto de la portada anda justo.
  check('en diferido', (await b.locator('img').getAttribute('loading')) === 'lazy')
  check('con el titular', (await b.locator('strong').textContent())?.includes('128 cartas'))
  // Que se entienda que NOTICIAS es una sección, no ese artículo.
  check('y la etiqueta de la sección', (await b.locator('.noticia-banner-etiqueta').textContent())?.trim().endsWith('Noticias'))
  check('el banner lleva al artículo', (await b.getAttribute('href')) === '/noticias/noticia-1', await b.getAttribute('href'))

  // El enlace a la sección va FUERA: dentro sería un enlace metido en
  // otro y llevaría al artículo, que es lo contrario de lo que promete.
  const todas = page.locator('#noticiaPortada .noticia-banner-todas')
  check('hay enlace a todas las noticias', (await todas.count()) === 1)
  check('y lleva a /noticias', (await todas.getAttribute('href')) === '/noticias')
  check('que NO está dentro del banner', (await b.locator('.noticia-banner-todas').count()) === 0)

  // La caja reserva su altura antes de que cargue: sin eso la portada
  // pega un salto justo cuando la persona va a pulsar.
  const ratio = await b.locator('img').evaluate((n) => getComputedStyle(n).aspectRatio)
  check('la imagen reserva su hueco', /16\s*\/\s*7/.test(ratio), ratio)
  check('sin errores de página', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 2. Sin portada: la fila fina de siempre ──')
{
  // Una caja de imagen vacía en la primera pantalla es peor que no tener
  // imagen.
  const { page } = await abrir({ __FAKE_NOTICIAS__: [{ title: 'Noticia sin foto', cover_image: null }] })
  check('no se pinta un banner vacío', (await page.locator('#noticiaPortada .noticia-banner').count()) === 0)
  check('se cae a la tarjeta fina', (await page.locator('#noticiaPortada .reto-tarjeta').count()) === 1)
  check('con su titular', (await page.locator('#noticiaPortada .reto-tarjeta strong').textContent())?.includes('sin foto'))
  await page.close()
}

console.log('\n── 3. Si no hay noticias, la sección se recoge ──')
{
  const { page } = await abrir({ __FAKE_NOTICIAS__: [] })
  const visible = await page.locator('#noticiaPortadaSeccion').isVisible()
  check('nada de un hueco que no explica nada', !visible)
  await page.close()
}

console.log('\n── 4. La más reciente, y solo una ──')
{
  const { page } = await abrir({
    __FAKE_NOTICIAS__: [
      { title: 'La de hoy', cover_image: '/fotos/foto1.svg' },
      { title: 'La de ayer', cover_image: '/fotos/foto2.svg' },
      { title: 'La de anteayer', cover_image: '/fotos/foto3.svg' },
    ],
  })
  check('solo una', (await page.locator('#noticiaPortada .noticia-banner').count()) === 1)
  check('y es la más reciente', (await page.locator('#noticiaPortada strong').textContent())?.includes('La de hoy'))
  await page.close()
}

console.log('\n── 5. La consulta pide la portada ──')
{
  // El doble de Supabase devuelve la fila entera mire lo que mire el
  // `select`, así que esto no se puede ver desde el navegador: se vigila
  // en el fuente. Sin `cover_image` en la consulta, en producción el
  // banner nunca tendría imagen aunque la noticia sí la tenga.
  const home = (await import('node:fs')).readFileSync('/home/user/pingu/js/home.js', 'utf8')
  const i = home.indexOf('cargarNoticiaPortada')
  const consulta = home.slice(i, i + 600)
  check('se pide cover_image', /\.select\('slug, title, published_at, cover_image'\)/.test(consulta), consulta.slice(0, 160))
}

console.log('\n── 6. En móvil no se desborda ──')
{
  const page = await browser.newPage({ viewport: { width: 390, height: 840 } })
  await page.addInitScript(() => { window.__FAKE_NOTICIAS__ = [{ title: 'Una noticia con un titular bastante largo para ver si cabe', cover_image: '/fotos/foto1.svg' }] })
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1700)
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  check('la portada no coge scroll lateral', ancho)
  const caja = await page.locator('#noticiaPortada .noticia-banner').boundingBox()
  check('y el banner cabe en la pantalla', caja && caja.width <= 390, JSON.stringify(caja))
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
