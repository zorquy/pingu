// Tanda 1064 — el idioma de lo que quieres, en todos los sitios.
//
// PINGU: «no te pide el idioma, entonces se queda en cualquiera… y yo las
// quiero en español. Si abro una carta de las que quiero… que me deje editar
// el idioma, lo mismo desde deseos y cambios… y editar también en masa». Lo
// que se mira:
//   · «Las quiero» de Seleccionar pregunta el idioma una vez para todas, y la
//     siguiente vez sale con lo último elegido;
//   · la ficha de una carta que quieres dice cómo la quieres y deja cambiarlo;
//   · la ficha del Mercado (la que abre «La quiero») tiene «Cambiar»;
//   · en «La quiero», Seleccionar → «Idioma» cambia el de varias, y una
//     apuntada en dos idiomas se queda en uno;
//   · cancelar la pregunta no apunta nada.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 }]
const carta = (n, nombre) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: nombre, name_es: nombre, image_path: `sv/sv8/${n}`, rarity: 'Common', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', release_date: '2024-11-08' } })
const CARTAS = [carta(1, 'Pikachu'), carta(2, 'Raichu'), carta(3, 'Chikorita'), carta(4, 'Cyndaquil'), carta(5, 'Totodile')]
const deseo = (id, card, idioma = null) => ({ id, user_id: 'admin-1', card_id: card, idioma, variante: null, prioridad: 1, created_at: `2026-10-2${id.slice(-1)}T10:00:00Z` })

const browser = await chromium.launch()
async function abrir({ deseos = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = []
    window.__FAKE_DESEOS__ = d.deseos
    window.__FAKE_PERFILES__ = [{ id: 'admin-1', username: 'pingu' }]
  }, { SETS, CARTAS, deseos })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
}
const misDeseos = (page) => page.evaluate(() => window.__TABLAS__.user_wants.filter((d) => d.user_id === 'admin-1').map((d) => `${d.card_id}:${d.idioma || '*'}`).sort().join())
const ventana = (page) => page.evaluate(() => ({ abierta: !!document.getElementById('iddDialogo')?.open, titulo: document.getElementById('iddTitulo')?.textContent, marcado: document.querySelector('#iddChips .mc-idioma-chip.activo')?.dataset.idioma ?? null }))

console.log('── 1. «Las quiero» de Seleccionar pregunta el idioma una vez ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=sv8')
  const seleccionar = async () => {
    await page.locator('[data-seleccionar]:visible').first().click()
    await page.waitForTimeout(400)
  }
  await seleccionar()
  await page.locator('#mcAlbum [data-carta="sv8-1"]').first().click()
  await page.locator('#mcAlbum [data-carta="sv8-2"]').first().click()
  await page.waitForTimeout(300)
  await page.click('#mcMarcarQuiero')
  await page.waitForTimeout(700)
  const v = await ventana(page)
  check('sale «¿En qué idioma las quieres?», con «Cualquiera» marcado la primera vez', v.abierta && v.titulo === '¿En qué idioma las quieres?' && v.marcado === '', JSON.stringify(v))
  await page.click('#iddChips .mc-idioma-chip[data-idioma="es"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('las dos se apuntan en español', (await misDeseos(page)) === 'sv8-1:es,sv8-2:es', await misDeseos(page))
  // La siguiente vez, con lo último elegido; y cancelar no apunta nada.
  await seleccionar()
  await page.locator('#mcAlbum [data-carta="sv8-3"]').first().click()
  await page.locator('#mcAlbum [data-carta="sv8-4"]').first().click()
  await page.waitForTimeout(300)
  await page.click('#mcMarcarQuiero')
  await page.waitForTimeout(700)
  check('la siguiente sale con «Español» marcado (lo último que elegiste)', (await ventana(page)).marcado === 'es', JSON.stringify(await ventana(page)))
  await page.click('#iddCancelar')
  await page.waitForTimeout(800)
  check('cancelar no apunta nada', (await misDeseos(page)) === 'sv8-1:es,sv8-2:es', await misDeseos(page))
  // El corazón de una sola, también con lo último.
  await page.keyboard.press('Escape').catch(() => {})
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. La ficha dice cómo la quieres y deja cambiarlo ──')
{
  const { ctx, page, errores } = await abrir({ deseos: [deseo('d1', 'sv8-1')] })
  await ir(page, '/mi-coleccion.html?ver=album&set=sv8')
  await page.locator('#mcAlbum [data-carta="sv8-1"]').first().click()
  await page.waitForTimeout(1000)
  const fila = await page.evaluate(() => ({ visible: !document.getElementById('mcEdDeseos')?.classList.contains('hidden'), texto: document.getElementById('mcEdDeseos')?.innerText.replace(/\s+/g, ' ').trim() }))
  check('la fila «La quieres · Cualquier idioma»', fila.visible && /La quieres Cualquier idioma/.test(fila.texto), JSON.stringify(fila))
  await page.click('#mcEdDeseos [data-cambiar-deseo-ficha]')
  await page.waitForTimeout(700)
  check('tocarla abre la ventana con lo puesto', (await ventana(page)).abierta && (await ventana(page)).marcado === '', JSON.stringify(await ventana(page)))
  await page.click('#iddChips .mc-idioma-chip[data-idioma="es"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('  …y el deseo pasa a español', (await misDeseos(page)) === 'sv8-1:es', await misDeseos(page))
  check('  …y la fila lo dice sin cerrar la ficha', /Español/.test(await page.textContent('#mcEdDeseos')) && (await page.evaluate(() => document.getElementById('mcEditor').open)))
  // Una que no quieres no tiene fila.
  await page.click('#mcEdCerrar')
  await page.waitForTimeout(400)
  await page.locator('#mcAlbum [data-carta="sv8-5"]').first().click()
  await page.waitForTimeout(900)
  check('una que no quieres no tiene fila', await page.evaluate(() => document.getElementById('mcEdDeseos')?.classList.contains('hidden')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. La ficha que abre «La quiero» tiene «Cambiar» ──')
{
  const { ctx, page, errores } = await abrir({ deseos: [deseo('d1', 'sv8-1')] })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.waitForTimeout(600)
  await page.click('#mcQuieroRejilla [data-deseo-carta="sv8-1"] .mc-merc-abrir')
  await page.waitForTimeout(1000)
  check('al lado de «La quieres», «Cambiar»', await page.isVisible('#mcMercadoFichaQuiero [data-merf-cambiar]'), await page.textContent('#mcMercadoFichaQuiero').catch(() => 'sin caja'))
  await page.click('#mcMercadoFichaQuiero [data-merf-cambiar]')
  await page.waitForTimeout(700)
  await page.click('#iddChips .mc-idioma-chip[data-idioma="en"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('  …y lo cambia a inglés', (await misDeseos(page)) === 'sv8-1:en', await misDeseos(page))
  check('  …y la ficha lo dice', /inglés/.test(await page.textContent('#mcMercadoFichaQuiero')), await page.textContent('#mcMercadoFichaQuiero'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. En «La quiero», «Idioma» cambia el de varias ──')
{
  // Pikachu en cualquiera, Raichu en japonés Y en inglés, Chikorita en francés.
  const { ctx, page, errores } = await abrir({ deseos: [deseo('d1', 'sv8-1'), deseo('d2', 'sv8-2', 'ja'), deseo('d3', 'sv8-2', 'en'), deseo('d4', 'sv8-3', 'fr')] })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.waitForTimeout(600)
  await page.click('#mcQuieroSeleccionar')
  await page.waitForTimeout(400)
  await page.click('#mcQuieroRejilla [data-deseo-carta="sv8-1"]')
  await page.click('#mcQuieroRejilla [data-deseo-carta="sv8-2"]')
  await page.waitForTimeout(300)
  check('la barra trae «Idioma»', await page.isVisible('#mcQuieroSel [data-sel-quiero="idioma"]'))
  await page.click('#mcQuieroSel [data-sel-quiero="idioma"]')
  await page.waitForTimeout(700)
  check('pregunta una vez para las dos', (await ventana(page)).titulo === '¿En qué idioma las quieres?', JSON.stringify(await ventana(page)))
  await page.click('#iddChips .mc-idioma-chip[data-idioma="es"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1500)
  check('las dos en español; el Raichu de dos idiomas se queda en uno; la Chikorita no se toca', (await misDeseos(page)) === 'sv8-1:es,sv8-2:es,sv8-3:fr', await misDeseos(page))
  const baldosas = await page.$$eval('#mcQuieroRejilla .mc-deseo-baldosa', (as) => as.map((a) => a.dataset.deseoCarta).sort().join())
  check('  …y «La quiero» lo pinta sin recargar (tres baldosas)', baldosas === 'sv8-1,sv8-2,sv8-3', baldosas)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAS` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
