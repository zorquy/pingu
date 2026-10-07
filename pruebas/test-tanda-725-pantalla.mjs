// Tanda 725 — enseñar la colección a pantalla completa (X15) y la medalla
// con la mascota al completar una expansión (X9), de la lista de
// propuestas, elegidas por PINGU.
//
// Lo que se mira: que añadir la carta que FALTABA saque la medalla con el
// nombre del set, una sola vez —quitarla y volverla a poner no es
// completarlo otra vez—, y que añadir otra cualquiera no la saque; y que
// «Enseñar las que tengo» abra a pantalla completa solo las tuyas, en su
// orden, y se pase con los botones y las flechas y se salga con Esc.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const browser = await chromium.launch()
const semilla = ({ tengo }) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 3, card_count_total: 3 }]
  window.__FAKE_CARTAS__ = [1, 2, 3].map((n) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: `Carta ${n}`, name_es: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
  window.__FAKE_COLECCION__ = tengo.map((n) => ({ id: `l${n}`, card_id: `xy5-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
}
async function abrir({ tengo = [1, 2], ctx = null } = {}) {
  ctx = ctx || await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(semilla, { tengo })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=xy5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, ctx, errores }
}
const anadir = async (page, id) => {
  await page.locator(`#mcAlbum .mc-mas[data-anadir="${id}"]`).first().click()
  await page.waitForTimeout(500)
  // Si ya la tienes, la hoja abre por «Ya en tu colección»: a añadir más.
  if (await page.locator('#mcAdMas').isVisible().catch(() => false)) await page.click('#mcAdMas')
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(1000)
}
const medalla = (page) => page.evaluate(() => { const d = document.getElementById('mcCompleto'); return d?.open ? d.textContent.replace(/\s+/g, ' ').trim() : null })

console.log('── 1. Completar una expansión ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  await anadir(page, 'xy5-1')
  check('añadir otra copia de una que ya tenías no saca nada', (await medalla(page)) === null)
  await anadir(page, 'xy5-3')
  const m = await medalla(page)
  check('añadir la que faltaba saca la medalla, con el nombre del set', /Has completado Duelos Primigenios/.test(m || '') && /Las 3 cartas del set/.test(m || ''), m)
  check('  …con la mascota', await page.$eval('#mcCompleto img', (i) => /mascota\.webp/.test(i.src) && i.getAttribute('width') === '120').catch(() => false))
  await page.click('#mcCompleto [data-cerrar]')
  await page.waitForTimeout(300)
  check('  …y se cierra', (await medalla(page)) === null)
  await ctx.close()

  // Otra vez, en el mismo navegador: con el set ya celebrado no sale.
  const otro = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await otro.addInitScript(() => { try { localStorage.setItem('pokedoc-sets-completos', JSON.stringify(['WEST:xy5'])) } catch {} })
  const b = await abrir({ ctx: otro })
  await anadir(b.page, 'xy5-3')
  check('completarlo otra vez (ya celebrado en este navegador) no la repite', (await medalla(b.page)) === null)
  await otro.close()
}

console.log('── 2. Enseñar las que tengo ──')
{
  const { page, ctx, errores } = await abrir({ tengo: [1, 3] })
  await page.click('#mcAlbumMenu summary')
  await page.waitForTimeout(200)
  await page.click('#mcAlbumEnsenar')
  await page.waitForTimeout(600)
  const e = await page.evaluate(() => { const d = document.getElementById('mcEnsenar'); const r = d?.getBoundingClientRect(); return d ? { open: d.open, ancho: Math.round(r.width), alto: Math.round(r.height), sitio: d.querySelector('.mc-ensenar-sitio').textContent, nombre: d.querySelector('figcaption b').textContent } : null })
  check('a pantalla completa, solo las tuyas: «1 de 2», la Carta 1', e?.open && e.ancho === 390 && e.alto >= 660 && e.sitio === '1 de 2' && e.nombre === 'Carta 1', JSON.stringify(e))
  await page.click('.mc-ensenar-despues')
  check('la siguiente es la Carta 3 (la 2 no es tuya)', (await page.textContent('#mcEnsenar figcaption b')) === 'Carta 3' && (await page.textContent('.mc-ensenar-sitio')) === '2 de 2')
  check('  …y en la última, la flecha de seguir se apaga', await page.$eval('.mc-ensenar-despues', (b) => b.disabled))
  await page.keyboard.press('ArrowLeft')
  check('con la flecha del teclado, vuelve', (await page.textContent('#mcEnsenar figcaption b')) === 'Carta 1')
  check('los botones miden 44', await page.$$eval('#mcEnsenar button', (bs) => bs.every((b) => b.getBoundingClientRect().width >= 44 && b.getBoundingClientRect().height >= 44)))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Esc sale', !(await page.evaluate(() => document.getElementById('mcEnsenar').open)) && (await page.$eval('#mcEnsenar', (d) => getComputedStyle(d).display)) === 'none')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
