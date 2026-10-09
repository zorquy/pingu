// Tanda 646 en pantalla — /cartas con las tarjetas de expansión (valor y
// semanal, plegado por TCGGO), la estantería con lo mismo, y la página de
// un set hijo que lleva a la del padre con las cartas de los dos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [
    { id: 'me02', name: '30th Celebration', name_en: '30th Celebration', serie_id: 'me', serie_name_en: 'Mega Evolution', market: 'WEST', release_date: '2026-09-16', card_count_official: 92, card_count_total: 92, tcg_online_code: '30C', tcggo_id: 431, logo_tcggo: 'https://images.tcggo.com/30c.png' },
    { id: 'me02.5', name: 'Classic Collection', name_en: 'Classic Collection', serie_id: 'me', serie_name_en: 'Mega Evolution', market: 'WEST', release_date: '2026-09-16', card_count_official: 36, card_count_total: 36, tcg_online_code: '30CC', tcggo_id: 431 },
    { id: 'me05', name: 'Pitch Black', name_en: 'Pitch Black', serie_id: 'me', serie_name_en: 'Mega Evolution', market: 'WEST', release_date: '2026-07-17', card_count_official: 120, card_count_total: 120, tcg_online_code: 'PBL', tcggo_id: 415 },
  ]
  window.__FAKE_CARTAS__ = [
    { id: 'me02-1', market: 'WEST', set_id: 'me02', local_id: '1', name: 'Mew', name_es: 'Mew', image_path: 'x/1', category: 'Pokemon', variants: { normal: true } },
    { id: 'me02.5-1', market: 'WEST', set_id: 'me02.5', local_id: '1', name: 'Charizard', name_es: 'Charizard', image_path: 'x/2', category: 'Pokemon', variants: { normal: true } },
    { id: 'me05-1', market: 'WEST', set_id: 'me05', local_id: '1', name: 'Tropius', name_es: 'Tropius', image_path: 'x/3', category: 'Pokemon', variants: { normal: true } },
  ]
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'me02.5-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
  window.__FAKE_SET_VALOR__ = [
    { set_id: 'me02', market: 'WEST', dia: '2026-09-29', valor_cm: 12000 },
    { set_id: 'me02', market: 'WEST', dia: '2026-10-05', valor_cm: 11133.72 },
    { set_id: 'me05', market: 'WEST', dia: '2026-10-05', valor_cm: 616.4 },
  ]
}
const abrir = async (ruta, ancho = 1200) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla)
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com|api\.tcgdex\.net/, (r) => r.abort())
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}
// Las fechas de la semilla son de hace unos días respecto al reloj de la
// prueba: `Date.now()` manda en la página, así que se fija aquí.
const fijarReloj = async (page) => page.clock.setFixedTime(new Date('2026-10-05T12:00:00Z'))

console.log('── 1. /cartas: una tarjeta por expansión de TCGGO ──')
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await fijarReloj(page)
  await page.addInitScript(semilla)
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com|api\.tcgdex\.net/, (r) => r.abort())
  await page.goto(`${BASE}/cartas.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  // /cartas ES la estantería de Mi colección desde la 649 (misma página,
  // modo catálogo): tarjetas `.mc-set-tarjeta` agrupadas por era.
  const nombres = (await page.locator('.mc-set-tarjeta .mc-set-nombre').allInnerTexts()).map(limpio)
  check('dos tarjetas: el 30 aniversario es UNA (la Classic va dentro) y Pitch Black', nombres.join(' | ') === '30th Celebration | Pitch Black', nombres.join(' | '))
  const treinta = page.locator('.mc-set-tarjeta', { hasText: '30th Celebration' })
  const texto = limpio(await treinta.innerText())
  check('  …con las cartas de las dos (128, y tu Charizard de la Classic cuenta), el valor del set y el semanal (−7 %)', /1\/128|1 de 128/.test(texto) && /11\.134 €/.test(texto) && /[−-]7 %/.test(texto), texto) // en losetas aparte desde la 668
  check('  …y el semanal en rojo', (await treinta.locator('.mc-set-valor-linea .baja, .mc-set-cifra .baja').first().evaluate((el) => getComputedStyle(el).color)) === 'rgb(220, 38, 38)')
  // Desde la 788 (PA8), fila compacta: el año en la línea corta.
  check('  …la fecha debajo del nombre y la era de rótulo', /2026/.test(texto) && (await page.locator('.mc-estanteria-titulo').allTextContents()).includes('Mega Evolution'), texto)
  const pitch = limpio(await page.locator('.mc-set-tarjeta', { hasText: 'Pitch Black' }).innerText())
  // Sin semanal = sin la loseta «Semanal». No «sin ningún %»: desde la 710
  // la tarjeta lleva el anillo de lo que tienes, que dice «0%».
  check('Pitch Black, con un solo día: valor sí y sin semanal', /616 €/.test(pitch) && !/semanal/i.test(pitch), pitch)
  check('las tarjetas miden 44 o más y van en rejilla', (await treinta.evaluate((el) => el.getBoundingClientRect().height)) >= 44 && (await page.locator('.mc-estanteria').first().evaluate((el) => getComputedStyle(el).display)) === 'grid')
  await treinta.click()
  await page.waitForTimeout(1500)
  check('  …y la tarjeta abre la expansión aquí, con las cartas de las dos mitades', (await page.locator('#mcAlbum .mc-bolsillo').count()) === 2, String(await page.locator('#mcAlbum .mc-bolsillo').count()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('── 2. La estantería de /mi-coleccion: lo mismo, y lo tuyo se cuenta en el padre ──')
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await fijarReloj(page)
  await page.addInitScript(semilla)
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com|api\.tcgdex\.net/, (r) => r.abort())
  // La tarjeta grande —con lo que vale y cómo va— es la del CATÁLOGO desde
  // la 748; en tu colección la estantería es la lista de su maqueta (C2).
  await page.goto(`${BASE}/cartas.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const tarjetas = page.locator('.mc-set-tarjeta')
  const nombres = (await tarjetas.locator('.mc-set-nombre').allInnerTexts()).map(limpio)
  check('dos tarjetas, no tres', nombres.length === 2 && nombres.includes('30th Celebration') && !nombres.includes('Classic Collection'), nombres.join(' | '))
  const treinta = tarjetas.filter({ hasText: '30th Celebration' })
  const texto = limpio(await treinta.innerText())
  check('tu Charizard de la Classic cuenta en el 30 aniversario: 1 de 128', /1\/128|1 de 128/.test(texto), texto)
  check('  …y la tarjeta dice lo que vale y cómo va', /11\.134 €/.test(texto) && /[−-]7 %/.test(texto), texto) // losetas aparte desde la 668
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('── 3. La página de un set hijo es la del padre, con las cartas de los dos ──')
{
  const { page, errores } = await abrir('/coleccion/30cc')
  check('la dirección pasa a ser la del padre', /\/coleccion\/30c$/.test(page.url()), page.url())
  const nombres = (await page.locator('#coleccionRejilla .coleccion-carta-nombre').allInnerTexts()).map(limpio)
  check('  …y salen las cartas de las dos mitades', nombres.includes('Mew') && nombres.includes('Charizard'), nombres.join(' | '))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
