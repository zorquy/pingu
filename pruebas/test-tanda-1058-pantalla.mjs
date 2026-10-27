// Tanda 1058 — lo que quedaba de la propuesta de las listas:
//   · «Las que doy» con la barra de «La quiero» (Seleccionar · cuenta · «+» ·
//     ⋯ · Todas / La buscan / Nadie), baldosa compacta y Seleccionar
//     («Darlas todas», «Ya no las doy»);
//   · Seleccionar en el Mercado («Las quiero»);
//   · el interruptor «Cuenta para los cruces» de una lista;
//   · el Modo evento con una lista: «Busco» solo con esa y el QR la lleva.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 }]
const carta = (n, nombre) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: nombre, name_es: nombre, image_path: `x/sv8-${n}`, rarity: 'Common', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', release_date: '2024-11-08' } })
const CARTAS = [carta(1, 'Exeggcute'), carta(2, 'Exeggutor'), carta(3, 'Pikachu'), carta(4, 'Raichu')]
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: 'user-1', username: 'lucia_tcg', display_name: 'Lucía' }]
const linea = (id, user, card, cantidad, cambio) => ({ id, user_id: user, card_id: card, market: 'WEST', cantidad, cambio, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' })
// Yo doy Exeggcute (1 de 2) y Exeggutor (1 de 1); Lucía da Pikachu y Raichu.
const COLECCION = [linea('m1', 'admin-1', 'sv8-1', 2, 1), linea('m2', 'admin-1', 'sv8-2', 1, 1), linea('o1', 'user-1', 'sv8-3', 1, 1), linea('o2', 'user-1', 'sv8-4', 1, 1)]
// Lucía busca mi Exeggcute.
const DESEOS = [{ id: 'dl', user_id: 'user-1', card_id: 'sv8-1', idioma: null, prioridad: 1, created_at: '2026-10-20T10:00:00Z' }]

const browser = await chromium.launch()
async function abrir(ruta, { movil = false, extra = {} } = {}) {
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => Object.assign(window, { __FAKE_SESSION__: 'admin-1', __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: d.COLECCION, __FAKE_PERFILES__: d.PERFILES, __FAKE_DESEOS__: d.DESEOS, __FAKE_PRECIOS__: [] }, d.extra), { SETS, CARTAS, COLECCION, PERFILES, DESEOS, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}
const cambioDe = (page, id) => page.evaluate((id) => window.__TABLAS__.user_collection.find((l) => l.id === id)?.cambio, id)

console.log('── 1. Las que doy ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero')
  await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
  await page.waitForTimeout(1200)
  check('la barra: Seleccionar, la cuenta, «+» y ⋯', await page.isVisible('#mcDoySeleccionar') && /2\s*copias/.test(await page.textContent('#mcDoyCifra')) && await page.isVisible('#mcDoyPoner') && await page.isVisible('#mcDoyMenu'), await page.textContent('#mcDoyBarra'))
  check('dos baldosas, sin «Nadie la busca aún»', (await page.$$('#mcDoyRejilla .mc-doy-baldosa')).length === 2 && !/Nadie la busca/.test(await page.textContent('#mcDoyRejilla')))
  const exe = await page.$eval('[data-doy-linea="m1"]', (a) => a.innerText)
  check('la que alguien busca dice «La busca 1»', /La busca 1/.test(exe), exe)
  const pos = await page.evaluate(() => { const b = document.querySelector('[data-doy-linea="m1"]'); const f = b.querySelector('.mc-merc-foto').getBoundingClientRect(); const c = b.querySelector('.mc-quiero-aviso').getBoundingClientRect(); return c.left >= f.left - 1 && c.top >= f.top - 1 && c.right <= f.left + f.width / 2 })
  check('la campana encima de la foto, a la izquierda', pos)
  if (await page.isVisible('#mcDoyQue')) {
    await page.click('#mcDoyQue [data-doy-filtro="nadie"]')
    await page.waitForTimeout(300)
    check('«Nadie» deja la que nadie busca', (await page.$$eval('#mcDoyRejilla .mc-doy-baldosa', (as) => as.map((a) => a.dataset.doyLinea))).join() === 'm2')
    await page.click('#mcDoyQue [data-doy-filtro="todas"]')
    await page.waitForTimeout(300)
  } else check('«Todas / La buscan / Nadie» sale cuando se sabe quién busca', false)
  await page.click('#mcDoySeleccionar')
  await page.waitForTimeout(300)
  await page.click('[data-doy-linea="m1"] .mc-merc-foto')
  await page.waitForTimeout(200)
  check('Seleccionar marca y pone la barra de abajo', (await page.$$('.mc-doy-baldosa.marcada')).length === 1 && await page.isVisible('#mcDoySel .mc-sel-abajo'))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1058-doy.png` })
  await page.click('[data-sel-doy="todo"]')
  await page.waitForTimeout(900)
  check('«Darlas todas»: doy 2 de 2', (await cambioDe(page, 'm1')) === 2, String(await cambioDe(page, 'm1')))
  await page.click('#mcDoySeleccionar')
  await page.click('[data-sel-doy="todas"]')
  await page.click('[data-sel-doy="nada"]')
  await page.waitForTimeout(1200)
  check('«Ya no las doy» con todas: ninguna a cambio (siguen en la colección)', (await cambioDe(page, 'm1')) === 0 && (await cambioDe(page, 'm2')) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Seleccionar en el Mercado ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=mercado')
  await page.waitForSelector('[data-merc-ficha="sv8-3"]', { timeout: 8000 }).catch(() => {})
  check('el botón Seleccionar está', await page.isVisible('#mcMercadoSeleccionar'))
  await page.click('#mcMercadoSeleccionar')
  await page.click('[data-merc="sv8-3"] .mc-merc-foto')
  await page.click('[data-merc="sv8-4"] .mc-merc-foto')
  await page.waitForTimeout(200)
  check('marca dos (y no abre la ficha)', (await page.$$('.mc-merc.marcada')).length === 2 && !(await page.$eval('#mcMercadoFicha', (d) => d.open)))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1058-mercado.png` })
  await page.click('[data-sel-merc="quiero"]')
  await page.waitForTimeout(1200)
  const mios = await page.evaluate(() => window.__TABLAS__.user_wants.filter((w) => w.user_id === 'admin-1').map((w) => w.card_id).sort())
  check('«Las quiero» las apunta, en cualquier idioma', mios.join() === 'sv8-3,sv8-4', mios.join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Una lista que no cuenta para los cruces ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero', { extra: { __FAKE_DESEOS__: [{ id: 'd9', user_id: 'admin-1', card_id: 'sv8-3', idioma: null, prioridad: 1, created_at: '2026-10-20T10:00:00Z' }] } })
  await page.click('#mcQuieroLista')
  await page.click('#mcListasHoja [data-lista-nueva]')
  await page.waitForTimeout(300)
  check('la hoja trae «Cuenta para los cruces», puesto', await page.isVisible('#mcListaCruces') && await page.isChecked('#mcListaCruces'))
  await page.fill('#mcListaNombre', 'A vigilar')
  await page.uncheck('#mcListaCruces')
  if (CAPS) await page.screenshot({ path: `${CAPS}/1058-cruces.png` })
  await page.click('#mcListaForm [type="submit"]')
  await page.waitForTimeout(600)
  const fila = await page.evaluate(() => window.__TABLAS__.user_want_lists.find((l) => l.nombre === 'A vigilar'))
  check('se guarda con cruces = false', fila && fila.cruces === false, JSON.stringify(fila))
  await page.click('#mcQuieroLista')
  await page.waitForTimeout(300)
  check('en «Tus listas» dice que es solo para ti', /solo para ti/.test(await page.textContent('#mcListasHoja')))
  await page.keyboard.press('Escape')
  await page.click('#mcQuieroMenu')
  await page.waitForTimeout(300)
  check('el ⋯ de una lista: «Modo evento con esta lista»', /con esta lista/.test(await page.textContent('#mcListasHoja [data-accion="evento"]')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. El Modo evento con una lista ──')
{
  const extra = {
    __FAKE_DESEOS__: [
      { id: 'd1', user_id: 'admin-1', card_id: 'sv8-3', idioma: null, prioridad: 1, created_at: '2026-10-20T10:00:00Z' },
      { id: 'd2', user_id: 'admin-1', card_id: 'sv8-4', idioma: null, prioridad: 1, created_at: '2026-10-20T10:00:00Z' },
    ],
    __FAKE_LISTAS__: [{ id: '11111111-1111-1111-1111-111111111111', nombre: 'Feria de Madrid' }],
    __FAKE_LISTA_ITEMS__: [{ list_id: '11111111-1111-1111-1111-111111111111', card_id: 'sv8-4' }],
  }
  const { ctx, page, errores } = await abrir('/evento', { movil: true, extra })
  await page.waitForTimeout(800)
  check('«Busco» con las dos y el selector de lista', (await page.textContent('#eventoNBusco')) === '2' && await page.isVisible('#eventoOpListaDeseo'))
  await page.selectOption('#eventoListaDeseo', '11111111-1111-1111-1111-111111111111')
  await page.waitForTimeout(500)
  const r = await page.evaluate(() => ({ n: document.getElementById('eventoNBusco').textContent, cartas: document.querySelectorAll('#eventoLista .evento-carta').length, lema: document.querySelector('.evento-pase-lema')?.textContent }))
  check('con la lista: solo su carta, y el pase la nombra', r.n === '1' && r.cartas === 1 && /Feria de Madrid/.test(r.lema), JSON.stringify(r))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1058-evento.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
