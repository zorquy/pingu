// Tanda 1148 — la paleta (Ctrl+K) del PC con vista previa (B5 de «Buscar,
// otra vuelta») y «Te lo completa» (B3) también dentro.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const b = await chromium.launch()

console.log('── 1. En el PC ──')
{
  const ctx = await contexto(b, false, 'user-1')
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/foro`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.keyboard.press('Control+k')
  await page.waitForSelector('#paletaInput', { timeout: 8000 })
  await page.keyboard.type('chari', { delay: 30 })
  await page.waitForSelector('#paletaPrevia:not([hidden]) .paleta-previa-nombre', { timeout: 8000 }).catch(() => {})
  const previa = await page.$eval('#paletaPrevia', (p) => ({ visible: !p.hidden, nombre: p.querySelector('.paleta-previa-nombre')?.textContent, precio: p.querySelector('.paleta-previa-precio')?.textContent.replace(/\s+/g, ' ').trim(), foto: !!p.querySelector('img.bs-foto[width="245"]'), botones: [...p.querySelectorAll('[data-previa]')].map((x) => x.dataset.previa) }))
  check('la carta, en grande al lado de la lista', previa.visible && /Charizard/.test(previa.nombre) && previa.foto, JSON.stringify(previa))
  check('  …con su precio en español', /En español\s*173,38\s?€/.test(previa.precio), previa.precio)
  check('  …y sus tres botones (con cuenta)', previa.botones.join() === 'abrir,quiero,anadir', previa.botones.join())
  await page.waitForTimeout(600)
  check('  …y la marca de «la tienes»', (await page.locator('#paletaPrevia .mk-tengo').count()) === 1)
  const ancho = await page.$eval('dialog.paleta', (d) => d.getBoundingClientRect().width)
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowDown')
  await page.waitForTimeout(200)
  check('con las flechas en una guía, la caja no cambia de ancho y enseña la carta', Math.abs((await page.$eval('dialog.paleta', (d) => d.getBoundingClientRect().width)) - ancho) < 2 && (await page.locator('#paletaPrevia:not([hidden])').count()) === 1)
  const completa = await page.$$eval('#paletaLista [role=option]', (os) => os.map((o) => o.textContent.trim()))
  check('«Te lo completa» también aquí', (await page.locator('#paletaLista .bs-seccion', { hasText: 'Te lo completa' }).count()) === 1, completa.slice(0, 3).join(' | '))
  await page.click('#paletaPrevia [data-previa="quiero"]')
  await page.waitForTimeout(800)
  check('«La quiero» pregunta el idioma, como en la ficha', await page.locator('#iddTitulo').isVisible().catch(() => false))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto(b, false, 'none')
  const page = await ctx.newPage()
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}/foro`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.keyboard.press('Control+k')
  await page.waitForSelector('#paletaInput', { timeout: 8000 })
  await page.keyboard.type('chari', { delay: 30 })
  await page.waitForSelector('#paletaPrevia:not([hidden]) .paleta-previa-nombre', { timeout: 8000 }).catch(() => {})
  const bs = await page.$$eval('#paletaPrevia [data-previa]', (bs) => bs.map((x) => x.dataset.previa)); check('sin cuenta, solo «Ver ficha»', bs.join() === 'abrir', bs.join() + ' / ' + await page.locator('#navUserBtn').count())
  await ctx.close()
}

console.log('── 2. En el móvil, sin vista previa ──')
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/foro`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.evaluate(() => import('/js/paleta.js').then((m) => m.abrirPaleta({ texto: 'chari' })))
  await page.waitForTimeout(400)
  await page.fill('#paletaInput', 'charizard')
  await page.waitForTimeout(1500)
  check('la lista sola, sin la carta al lado', await page.locator('#paletaPrevia').isHidden())
  await ctx.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo verde')
process.exit(fails ? 1 : 0)
