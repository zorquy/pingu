// Tanda 1059 — dos cosas del día:
//   · «También tienes» en el móvil: con Editar desplegado, tocar la otra copia
//     cambia la hoja a esa copia CON sus campos (antes se quedaban sin campos y
//     «Listo» la cerraba: «se queda ahí como muerto»);
//   · la ficha de una carta de «La quiero» ofrece meterla en una lista.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [{ id: 'pbl', name: 'Pitch Black', serie_id: 'me', market: 'WEST', release_date: '2026-09-01', card_count_official: 121 }]
const carta = (n, nombre) => ({ id: `pbl-${n}`, market: 'WEST', set_id: 'pbl', local_id: String(n).padStart(3, '0'), name: nombre, name_es: nombre, image_path: `x/pbl-${n}`, rarity: 'Common', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: 'pbl', name: 'Pitch Black', serie_id: 'me', release_date: '2026-09-01' } })
const CARTAS = [carta(13, 'Goldeen'), carta(14, 'Seaking')]
const linea = (id, idioma, cantidad, cambio) => ({ id, user_id: 'admin-1', card_id: 'pbl-13', market: 'WEST', cantidad, cambio, idioma, estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' })
const COLECCION = [linea('es1', 'es', 1, 1), linea('en1', 'en', 3, 3)]

const browser = await chromium.launch()
async function abrir(ruta, { movil = true, extra = {} } = {}) {
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => Object.assign(window, { __FAKE_SESSION__: 'admin-1', __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: d.COLECCION, __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }], __FAKE_DESEOS__: [], __FAKE_PRECIOS__: [] }, d.extra), { SETS, CARTAS, COLECCION, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}
const estadoHoja = (page) => page.evaluate(() => ({
  bloque: !document.getElementById('mcEdCopiaBloque').classList.contains('hidden'),
  campos: !document.getElementById('mcEdCopiaCampos').classList.contains('hidden'),
  idioma: document.getElementById('mcEdIdioma').value,
  boton: document.querySelector('#mcEdEditar span')?.textContent,
}))

console.log('── 1. «También tienes» con Editar desplegado (iPhone) ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album&set=pbl')
  await page.locator('#mcAlbum [data-carta="pbl-13"]').first().click()
  await page.waitForTimeout(1000)
  await page.click('#mcEdEditar')
  await page.waitForTimeout(400)
  const antes = await estadoHoja(page)
  check('Editar abre la hoja con los campos', antes.bloque && antes.campos, JSON.stringify(antes))
  const otra = antes.idioma === 'es' ? 'en1' : 'es1'
  await page.click(`#mcEdOtrasCopias [data-linea-otra="${otra}"]`)
  await page.waitForTimeout(600)
  const despues = await estadoHoja(page)
  check('tocar la otra copia deja la hoja CON los campos, ya de esa copia', despues.bloque && despues.campos && despues.idioma === (otra === 'en1' ? 'en' : 'es'), JSON.stringify(despues))
  check('  …y el botón sigue diciendo «Listo»', despues.boton === 'Listo', despues.boton)
  if (CAPS) await page.screenshot({ path: `${CAPS}/1059-otra-copia.png` })
  const vuelta = antes.idioma === 'es' ? 'es1' : 'en1'
  await page.click(`#mcEdOtrasCopias [data-linea-otra="${vuelta}"]`)
  await page.waitForTimeout(600)
  const otraVez = await estadoHoja(page)
  check('y volver a la primera también', otraVez.bloque && otraVez.campos && otraVez.idioma === antes.idioma, JSON.stringify(otraVez))
  // En el móvil «Listo» queda debajo de la hoja (se cierra con el velo o
  // arrastrando): se pulsa por código.
  await page.$eval('#mcEdEditar', (b) => b.click())
  await page.waitForTimeout(300)
  check('«Listo» la pliega', !(await estadoHoja(page)).bloque)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. La ficha de una carta de «La quiero»: a una lista ──')
{
  const extra = {
    __FAKE_DESEOS__: [{ id: 'd1', user_id: 'admin-1', card_id: 'pbl-14', idioma: 'es', prioridad: 1, created_at: '2026-10-20T10:00:00Z' }],
    __FAKE_LISTAS__: [{ id: '11111111-1111-1111-1111-111111111111', nombre: 'Feria', color: '#6d4aa8' }],
  }
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero', { movil: false, extra })
  await page.click('#mcQuieroRejilla [data-deseo-carta="pbl-14"] .mc-merc-abrir')
  await page.waitForTimeout(1200)
  check('la ficha trae «Añadir a una lista»', await page.isVisible('#mcMercadoFichaListas [data-merf-a-lista]'), await page.textContent('#mcMercadoFichaListas').catch(() => 'sin caja'))
  await page.click('#mcMercadoFichaListas [data-merf-a-lista]')
  await page.waitForTimeout(400)
  check('  …que abre tus listas, con «Nueva lista»', await page.isVisible('#mcListasHoja [data-lista="11111111-1111-1111-1111-111111111111"]') && await page.isVisible('#mcListasHoja [data-lista-nueva]'))
  await page.click('#mcListasHoja [data-lista="11111111-1111-1111-1111-111111111111"]')
  await page.waitForTimeout(800)
  const filas = await page.evaluate(() => window.__TABLAS__.user_want_list_items.map((f) => `${f.list_id}:${f.card_id}`))
  check('entra en la lista', filas.join() === '11111111-1111-1111-1111-111111111111:pbl-14', filas.join())
  check('  …y la ficha dice en cuál está', /Feria/.test(await page.textContent('#mcMercadoFichaListas')) && /A otra lista/.test(await page.textContent('#mcMercadoFichaListas')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1059-ficha-lista.png` })
  await page.click('#mcMercadoFichaListas [data-merf-sacar-lista]')
  await page.waitForTimeout(800)
  check('el ✕ la saca de la lista (sigue en «La quiero»)', (await page.evaluate(() => window.__TABLAS__.user_want_list_items.length)) === 0 && (await page.evaluate(() => window.__TABLAS__.user_wants.length)) === 1)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
