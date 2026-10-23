// Tanda 880 — compartir una noticia en X, en pantalla.
//
// Desde la ficha de una noticia, el botón de compartir abre la hoja común
// (871) con el título «Compartir la noticia», el texto (título +
// entradilla + enlace), las dos imágenes con LA PORTADA dibujada y el
// botón «Publicar en X» con el cuadro de X apuntando al texto y al enlace.
// Una guía sigue como antes (la hoja del sistema con el título y la
// dirección).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { textoParaX, direccionDeX, textoConEnlace } = await import(`${RAIZ}/js/compartir-x.js`)
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const PORTADA = 'https://zqamujmfavwrsqlgbead.supabase.co/storage/v1/object/public/guias/heatran.png'
const PORTADA_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#d00000"/></svg>'
const NOTICIA = {
  id: 'noticia-1', slug: 'mega-heatran', title: 'Mega Heatran ex, Lebanne, Gastly y más promos de gimnasio reveladas para noviembre',
  description: 'The Pokémon Company ha revelado las promos de gimnasio de noviembre en Japón: Mega Heatran ex, Lebanne, Gastly y varias cartas más que llegarán a los torneos de liga de gimnasio.',
  cover_image: PORTADA,
}
const URL_NOTICIA = 'https://pokedoc.es/noticias/mega-heatran'

const browser = await chromium.launch()
async function abrir(ruta, { noticias = [NOTICIA], guias = [], movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { viewport: { width: 390, height: 844 }, hasTouch: true } : { viewport: { width: 1280, height: 900 } })
  await ctx.addInitScript(({ noticias, guias }) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_NOTICIAS__ = noticias
    window.__FAKE_GUIAS__ = guias
    navigator.share = async (d) => { window.__compartido = { title: d.title, url: d.url, text: d.text, ficheros: (d.files || []).map((f) => f.name) }; return true }
    navigator.canShare = () => true
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  }, { noticias, guias })
  await ctx.route('**/storage/v1/object/public/**', (r) => r.fulfill({ contentType: 'image/svg+xml', headers: { 'access-control-allow-origin': '*' }, body: PORTADA_SVG }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { ctx, page, errores }
}
const medida = (page) => page.locator('#chPrevia img').evaluate((img) => ({ w: img.naturalWidth, h: img.naturalHeight })).catch(() => null)
// Desde la 988: Instagram (Historia y Publicación) y X, sin pestaña de texto.
const pestana = async (page, sel) => { await page.click(sel); await page.waitForTimeout(1200) }
// El color del punto (x, y) de la imagen de la vista previa, leído del PNG.
const pixel = (page, x, y) => page.locator('#chPrevia img').evaluate((img, [x, y]) => new Promise((res) => {
  const i = new Image()
  i.onload = () => {
    const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight
    const ctx = c.getContext('2d'); ctx.drawImage(i, 0, 0)
    res(Array.from(ctx.getImageData(x, y, 1, 1).data))
  }
  i.src = img.src
}), [x, y])

console.log('── 1. La ficha de la noticia: la hoja con el texto, la portada y «Publicar en X» ──')
{
  const { ctx, page, errores } = await abrir('/noticias/mega-heatran')
  check('la noticia se abre', (await page.locator('h1').first().innerText()).includes('Mega Heatran'), await page.locator('h1').first().innerText().catch(() => ''))
  await page.click('#btnCompartir')
  await page.waitForTimeout(1200)
  const hoja = page.locator('.ch-hoja[open]')
  check('se abre la hoja común, «Compartir la noticia»', (await hoja.count()) === 1 && (await page.locator('#chTitulo').innerText()) === 'Compartir la noticia')
  check('  …con Instagram y X (988)', (await page.locator('[data-ch-red]').count()) === 2 && (await page.locator('[data-ch-pestana]').count()) === 0)
  await pestana(page, '[data-ch-red="x"]')
  const esperado = textoConEnlace({ titulo: NOTICIA.title, descripcion: NOTICIA.description, url: URL_NOTICIA })
  check('en X, el texto es título + entradilla + enlace a /noticias/<slug>', (await page.locator('#chTextoX').innerText()) === esperado, await page.locator('#chTextoX').innerText())
  const x = page.locator('[data-ch-x]')
  const href = await x.getAttribute('href')
  check('«Publicar en X» abre el cuadro de X con ese texto y el enlace aparte, en otra pestaña', href === direccionDeX({ texto: textoParaX({ titulo: NOTICIA.title, descripcion: NOTICIA.description }), url: URL_NOTICIA }) && (await x.getAttribute('target')) === '_blank' && /noopener/.test(await x.getAttribute('rel')), href)
  check('  …y mide 44 px, a lo ancho debajo de los otros dos', (await x.evaluate((a) => { const r = a.getBoundingClientRect(); const otro = a.parentElement.querySelector('[data-ch-descargar]').getBoundingClientRect(); return r.height >= 44 && r.width > otro.width * 1.5 && r.top >= otro.bottom })))
  check('X dibuja a 1200×630', JSON.stringify(await medida(page)) === '{"w":1200,"h":630}', JSON.stringify(await medida(page)))
  const p = await pixel(page, 600, 160)
  check('  …con la portada de fondo (el punto del centro-arriba es rojo, por el velo)', p && p[0] > 150 && p[1] < 60 && p[2] < 60, JSON.stringify(p))
  await pestana(page, '[data-ch-red="instagram"]')
  await pestana(page, '[data-ch-forma="publicacion"]')
  check('«Publicación» dibuja a 1080×1350', JSON.stringify(await medida(page)) === '{"w":1080,"h":1350}', JSON.stringify(await medida(page)))
  const p2 = await pixel(page, 540, 400)
  check('  …también con la portada', p2 && p2[0] > 150 && p2[1] < 60, JSON.stringify(p2))
  await page.click('[data-ch-compartir]')
  await page.waitForTimeout(800)
  const c = await page.evaluate(() => window.__compartido)
  check('«Compartir…» en una imagen manda «noticia-mega-heatran.png» con el texto', c?.ficheros?.[0] === 'noticia-mega-heatran.png' && c?.text === esperado, JSON.stringify(c))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 2. Sin portada se dibuja igual (el degradado), y en el móvil ──')
{
  const { ctx, page, errores } = await abrir('/noticias/mega-heatran', { noticias: [{ ...NOTICIA, cover_image: null }], movil: true })
  await page.click('#btnCompartir')
  await page.waitForTimeout(1200)
  check('la hoja se abre', (await page.locator('.ch-hoja[open]').count()) === 1)
  await pestana(page, '[data-ch-red="x"]')
  check('X dibuja a 1200×630 sin foto', JSON.stringify(await medida(page)) === '{"w":1200,"h":630}')
  const p = await pixel(page, 600, 160)
  check('  …sobre el azul de los retos (no rojo)', p && p[2] > p[0] && p[0] < 80, JSON.stringify(p))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 3. Una guía sigue como antes: la hoja del sistema con título y dirección ──')
{
  const { ctx, page, errores } = await abrir('/guia/guia-1', { noticias: [], guias: [{ id: 'guia-1', slug: 'guia-1', title: 'Cómo construir tu primer mazo', description: 'Paso a paso.' }] })
  await page.click('#btnCompartir')
  await page.waitForTimeout(600)
  const c = await page.evaluate(() => window.__compartido)
  check('navigator.share con el título y la dirección, sin hoja propia', c?.title === 'Cómo construir tu primer mazo' && /\/guia\/guia-1$/.test(c?.url || '') && (await page.locator('.ch-hoja[open]').count()) === 0, JSON.stringify(c))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
