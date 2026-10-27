// Tanda 1057 — «La quiero» en dos filas: la barra (lista · «+» · buscar ·
// Seleccionar · ⋯ · Todas/La dan/Nadie), baldosas compactas como el Mercado
// (campana encima de la foto, sin «Nadie la da aún»), las listas (crear,
// elegir, meter con Seleccionar y al apuntar, sacar) y, sin la migración,
// todo como antes sin errores.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''

const SETS = [
  { id: 'mcd21', name: "McDonald's Collection 2021", serie_id: 'swsh', market: 'WEST', release_date: '2021-02-09', card_count_official: 25 },
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre, variants, extra = {}) => ({ id, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Common', category: 'Pokemon', variants, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date }, ...extra })
const CARTAS = [
  carta('mcd21-2', 'mcd21', 2, 'Chikorita', { normal: true, holo: true }),
  carta('mcd21-3', 'mcd21', 3, 'Cyndaquil', { normal: true, holo: true }),
  // Una sola versión: no hay nada que elegir.
  carta('sv8-238', 'sv8', 238, 'Pikachu ex', { holo: true }, { rarity: 'Special Illustration Rare' }),
]
const U = (n) => `user-${n}`
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: U(1), username: 'lucia_tcg', display_name: 'Lucía' }, { id: U(2), username: 'danipoke', display_name: 'Dani' }]
const linea = (id, user, card, idioma, variante, cambio) => ({ id, user_id: user, card_id: card, market: 'WEST', cantidad: Math.max(1, cambio), cambio, idioma, estado: 'NM', variante, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-20T10:00:00Z' })
// Lucía da la Chikorita HOLO; Dani, la NORMAL. Yo doy un Cyndaquil normal.
const COLECCION = [
  linea('c1', U(1), 'mcd21-2', 'es', 'holo', 1),
  linea('c2', U(2), 'mcd21-2', 'es', 'normal', 1),
  linea('m1', 'admin-1', 'mcd21-3', 'es', 'normal', 1),
]
const PRECIOS = [{ card_id: 'mcd21-2', cm_low: 0.5, cm_low_holo: 3 }]

const browser = await chromium.launch()
async function abrir({ movil = false, deseos = [], extra = {} } = {}) {
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.deseos
    window.__FAKE_LISTAS__ = d.extra.listas || []
    window.__FAKE_LISTA_ITEMS__ = d.extra.items || []
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_PRECIOS__ = d.PRECIOS
    Object.assign(window, d.extra)
  }, { SETS, CARTAS, COLECCION, PERFILES, PRECIOS, deseos, extra })
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
const deseo = (id, card, variante, idioma = null) => ({ id, user_id: 'admin-1', card_id: card, idioma, variante, prioridad: 1, created_at: `2026-10-2${id.slice(-1)}T10:00:00Z` })
const DESEOS = [deseo('d1', 'mcd21-2', 'holo'), deseo('d2', 'mcd21-3', null, 'es'), deseo('d3', 'sv8-238', null)]
const baldosas = (page) => page.$$eval('#mcQuieroRejilla .mc-deseo-baldosa', (as) => as.map((a) => a.dataset.deseoClave))
const items = (page) => page.evaluate(() => window.__TABLAS__.user_want_list_items.map((f) => `${f.list_id}:${f.card_id}`).sort())

console.log('── 1. La barra y las baldosas compactas (PC) ──')
{
  const { ctx, page, errores } = await abrir({ deseos: DESEOS })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.waitForTimeout(800)
  check('tres baldosas', (await baldosas(page)).length === 3, (await baldosas(page)).join())
  check('la barra dice «Todas · 3»', (await page.textContent('#mcQuieroListaRotulo')) === 'Todas' && (await page.textContent('#mcQuieroListaN')) === '3')
  check('ya no están los tres botones sueltos (van en el ⋯)', !(await page.$('#mcQuieroCompartir')) && !(await page.$('#mcQuieroTexto')))
  const pos = await page.evaluate(() => {
    const b = document.querySelector('.mc-deseo-baldosa[data-deseo-clave="mcd21-3|"]')
    const f = b.querySelector('.mc-merc-foto').getBoundingClientRect()
    const c = b.querySelector('.mc-quiero-aviso').getBoundingClientRect()
    return { dentro: c.left >= f.left - 1 && c.top >= f.top - 1 && c.right <= f.left + f.width / 2 && c.bottom <= f.top + f.height / 2, txt: b.innerText }
  })
  check('la campana va encima de la foto, arriba a la izquierda', pos.dentro, JSON.stringify(pos))
  check('sin «Nadie la da aún»', !/Nadie la da/.test(pos.txt), pos.txt)
  const chik = await page.$eval('.mc-deseo-baldosa[data-deseo-clave="mcd21-2|holo"]', (a) => a.innerText)
  check('la que da alguien dice «La da 1»', /La da 1/.test(chik), chik)
  check('«La dan / Nadie» con sus cuentas', !(await page.$eval('#mcQuieroQue', (e) => e.classList.contains('hidden'))) && (await page.textContent('[data-quiero-n="dan"]')) === '1' && (await page.textContent('[data-quiero-n="nadie"]')) === '2')
  await page.click('#mcQuieroQue [data-quiero-filtro="nadie"]')
  await page.waitForTimeout(200)
  check('  …«Nadie» deja las dos que nadie da', (await baldosas(page)).length === 2)
  await page.click('#mcQuieroQue [data-quiero-filtro="todas"]')
  if (CAPS) await page.screenshot({ path: `${CAPS}/1057-pc.png` })

  console.log('── 2. Una lista nueva y meter cartas con Seleccionar ──')
  await page.click('#mcQuieroLista')
  await page.waitForTimeout(300)
  check('sale «Tus listas» con Todas y «Nueva lista»', await page.isVisible('#mcListasHoja [data-lista=""]') && await page.isVisible('#mcListasHoja [data-lista-nueva]'))
  await page.click('#mcListasHoja [data-lista-nueva]')
  await page.fill('#mcListaNombre', 'Feria de Madrid')
  await page.click('#mcListaForm [type="submit"]')
  await page.waitForTimeout(600)
  check('la lista nueva queda abierta y vacía', (await page.textContent('#mcQuieroListaRotulo')) === 'Feria de Madrid' && (await page.textContent('#mcQuieroListaN')) === '0' && /está vacía/.test(await page.textContent('#mcQuieroPanel')))
  await page.click('#mcQuieroLista')
  await page.click('#mcListasHoja [data-lista=""]')
  await page.waitForTimeout(300)
  await page.click('#mcQuieroSeleccionar')
  await page.waitForTimeout(200)
  check('Seleccionar pone la barra de abajo', await page.isVisible('#mcQuieroSel .mc-sel-abajo'))
  await page.click('.mc-deseo-baldosa[data-deseo-clave="mcd21-2|holo"] .mc-merc-abrir')
  await page.click('.mc-deseo-baldosa[data-deseo-clave="sv8-238|"] .mc-merc-foto')
  await page.waitForTimeout(200)
  check('tocar marca (y no abre la carta)', (await page.$$('.mc-deseo-baldosa.marcada')).length === 2 && /2 marcadas/.test(await page.textContent('#mcQuieroSel')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1057-seleccion.png` })
  await page.click('[data-sel-quiero="lista"]')
  await page.waitForTimeout(300)
  await page.click('#mcListasHoja .mc-lista-opcion[data-lista]:not([data-lista=""])')
  await page.waitForTimeout(700)
  const it = await items(page)
  check('las dos entran en la lista', it.length === 2 && it.some((x) => x.endsWith(':mcd21-2')) && it.some((x) => x.endsWith(':sv8-238')), it.join())
  check('  …y se sale de Seleccionar', !(await page.isVisible('#mcQuieroSel .mc-sel-abajo')))
  await page.click('#mcQuieroLista')
  await page.click('#mcListasHoja .mc-lista-opcion[data-lista]:not([data-lista=""])')
  await page.waitForTimeout(300)
  check('abrir la lista enseña solo esas dos', (await baldosas(page)).sort().join() === 'mcd21-2|holo,sv8-238|', (await baldosas(page)).join())

  console.log('── 3. Sacar de la lista ──')
  await page.click('#mcQuieroSeleccionar')
  await page.click('.mc-deseo-baldosa[data-deseo-clave="sv8-238|"] .mc-merc-foto')
  await page.click('[data-sel-quiero="sacar"]')
  await page.waitForTimeout(600)
  check('sale de la lista y sigue en «La quiero»', (await baldosas(page)).join() === 'mcd21-2|holo' && (await page.evaluate(() => window.__TABLAS__.user_wants.length)) === 3)
  await page.click('#mcQuieroMenu')
  await page.waitForTimeout(300)
  check('⋯ con compartir, imagen, álbum, evento y editar', (await page.$$eval('#mcListasHoja [data-accion]', (bs) => bs.map((b) => b.dataset.accion))).join() === 'compartir,imagen,album,evento,editar')
  await page.keyboard.press('Escape')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. En el iPhone: «+» abre el buscador y la barra cabe en una fila ──')
{
  const { ctx, page, errores } = await abrir({ movil: true, deseos: DESEOS, extra: { listas: [{ id: 'l1', nombre: 'Master set' }], items: [{ list_id: 'l1', card_id: 'mcd21-3' }] } })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.waitForTimeout(800)
  const fila = await page.evaluate(() => {
    const b = document.getElementById('mcQuieroBarra').getBoundingClientRect()
    return { alto: b.height, buscador: getComputedStyle(document.querySelector('.mc-quiero-busca')).display }
  })
  check('la barra es una fila y el buscador se esconde', fila.alto < 60 && fila.buscador === 'none', JSON.stringify(fila))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1057-movil.png` })
  await page.click('#mcQuieroMas')
  await page.waitForTimeout(200)
  check('«+» enseña el buscador', await page.isVisible('#mcDeseoBuscar'))
  await page.click('#mcQuieroMas')
  await page.click('#mcQuieroLista')
  await page.waitForTimeout(400)
  check('«Tus listas»: Master set con 1', /Master set\s*1/.test(await page.textContent('#mcListasHoja')), await page.textContent('#mcListasHoja'))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1057-listas-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Sin la migración ──')
{
  const { ctx, page, errores } = await abrir({ deseos: DESEOS, extra: { __SIN_TABLAS__: ['user_want_lists', 'user_want_list_items'] } })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.waitForTimeout(800)
  check('«La quiero» sale igual', (await baldosas(page)).length === 3)
  await page.click('#mcQuieroLista')
  await page.waitForTimeout(300)
  check('  …y la lista no abre hoja (avisa)', !(await page.$eval('#mcListasHoja', (d) => d.open).catch(() => false)))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
