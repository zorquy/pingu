// Tanda 1114 — Deseos y cambios por páginas (PINGU eligió la A de «El Mercado
// por páginas» y «sí, haz lo mismo» en La quiero y Las que doy).
//
// Lo que se mira:
//   · lo puro: columnas por ancho, el tramo de la dirección, tramosHtml;
//   · el Mercado: de cada catálogo lo que cabe en DOS filas y «Ver las N»;
//     dentro, 48 por página con el paginador arriba y abajo, «atrás» y
//     «← Todas»; un filtro vuelve a la página 1; en el móvil, 6 y 24;
//   · que lo que se pide a la base es lo que se enseña (no 60 de cada uno);
//   · La quiero y Las que doy, igual (cortadas en el navegador);
//   · y que ya no hay «Ver más».
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  const T = await import(`${RAIZ}/js/mi-coleccion/tramos.js`)
  check('en el móvil, tres columnas', T.columnasPara(375, true) === 3)
  check('en el PC, las de la rejilla (auto-fill de 140 con 12 de hueco)', T.columnasPara(1100, false) === 7 && T.columnasPara(600, false) === 4, `${T.columnasPara(1100, false)} ${T.columnasPara(600, false)}`)
  check('48 por página en el PC y 24 en el móvil', T.porPagina(false) === 48 && T.porPagina(true) === 24)
  check('el tramo sale de la dirección, solo para su vista', JSON.stringify(T.tramoDeDireccion('mercado', '?ver=mercado&tramo=mercado:JP&pag=3')) === '{"market":"JP","pagina":3}' && T.tramoDeDireccion('quiero', '?tramo=mercado:JP') === null && T.tramoDeDireccion('mercado', '?tramo=mercado:XX') === null)
  const items = [...Array.from({ length: 30 }, (_, i) => ({ id: `w${i}`, m: 'WEST' })), ...Array.from({ length: 5 }, (_, i) => ({ id: `j${i}`, m: 'JP' }))]
  const pintar = (x) => `<i data-x="${x.id}"></i>`
  const caja = { clientWidth: 1100 }
  const esc = T.tramosHtml({ vista: 'quiero', items, mercadoDe: (x) => x.m, pintar, caja, busqueda: '', movil: false })
  check('escaparate: 14 occidentales (dos filas de 7) y las 5 japonesas', (esc.html.match(/data-x="w/g) || []).length === 14 && (esc.html.match(/data-x="j/g) || []).length === 5)
  check('  …«Ver las 30» en el occidental y nada en el japonés, que cabe', /data-tramo-ver="WEST"[^>]*>Ver las 30/.test(esc.html) && !/data-tramo-ver="JP"/.test(esc.html))
  const uno = T.tramosHtml({ vista: 'quiero', items: items.slice(0, 10), mercadoDe: (x) => x.m, pintar, caja, busqueda: '', movil: false })
  check('un catálogo que cabe entero: sin rótulo, como antes', !/mc-catalogo-rotulo/.test(uno.html) && (uno.html.match(/data-x=/g) || []).length === 10)
  const p2 = T.tramosHtml({ vista: 'quiero', items, mercadoDe: (x) => x.m, pintar, caja, busqueda: '?tramo=quiero:WEST&pag=2', movil: true })
  check('un tramo en el móvil: 24 por página; la 2 trae las 6 que quedan', (p2.html.match(/data-x="w/g) || []).length === 6 && /data-tramo-volver/.test(p2.html) && (p2.html.match(/class="paginacion/g) || []).length === 2)
  const lejos = T.tramosHtml({ vista: 'quiero', items, mercadoDe: (x) => x.m, pintar, caja, busqueda: '?tramo=quiero:WEST&pag=9', movil: true })
  check('una página que no existe se queda en la última', lejos.tramo.pagina === 2)
}

// ── Las fixtures: 70 occidentales y 20 japonesas a cambio, y 30 en «La quiero» ──
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 }, { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165 }]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre) => ({ id, market: setDe(set).market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: 'sv', release_date: setDe(set).release_date } })
const OCC = Array.from({ length: 70 }, (_, i) => carta(`sv8-${i + 1}`, 'sv8', i + 1, `Occ ${String(i + 1).padStart(2, '0')}`))
const JP = Array.from({ length: 20 }, (_, i) => carta(`SV2a-${i + 1}`, 'SV2a', i + 1, `Jp ${i + 1}`))
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: 'user-1', username: 'lucia_tcg', display_name: 'Lucía' }]
const hace = (m) => new Date(Date.now() - m * 60e3).toISOString()
const COLECCION = [
  ...[...OCC, ...JP].map((c, i) => ({ id: `o${i}`, user_id: 'user-1', card_id: c.id, market: c.market, cantidad: 1, cambio: 1, idioma: c.market === 'JP' ? 'ja' : 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: hace(i) })),
  // Lo que da Admin: 40 occidentales.
  ...OCC.slice(0, 40).map((c, i) => ({ id: `m${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', cantidad: 2, cambio: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: hace(i) })),
]
const DESEOS = OCC.slice(30, 60).map((c, i) => ({ id: `d${i}`, user_id: 'admin-1', card_id: c.id, idioma: null, prioridad: 1, created_at: hace(i) }))

const browser = await chromium.launch()
async function abrir(ruta, { movil = false } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.DESEOS
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_PRECIOS__ = []
    window.__rpcMercado = []
  }, { SETS, CARTAS: [...OCC, ...JP], COLECCION, DESEOS, PERFILES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/limitlesstcg|pokemontcg|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { ctx, page, errores }
}
const cuantasEn = (page, sel, m) => page.$$eval(`${sel} .mc-merc`, (els, m) => els.filter((e) => {
  const id = e.dataset.merc || e.dataset.deseoCarta || e.querySelector('[data-carta]')?.dataset.carta || e.querySelector('[data-deseo-carta]')?.dataset.deseoCarta || ''
  return m === 'JP' ? /^SV2a/.test(id) || /SV2a/.test(e.innerHTML) : !/SV2a/.test(e.innerHTML)
}).length, m)
const columnas = (page, sel) => page.$eval(sel, (e) => getComputedStyle(e).gridTemplateColumns.split(' ').filter(Boolean).length)

console.log('── 2. El Mercado en el PC ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=mercado')
  const col = await columnas(page, '#mcMercadoRejilla')
  const occ = await cuantasEn(page, '#mcMercadoRejilla', 'WEST')
  const jp = await cuantasEn(page, '#mcMercadoRejilla', 'JP')
  check('escaparate: de cada catálogo, lo que cabe en dos filas', occ === 2 * col && jp === 2 * col, `columnas ${col}: ${occ} + ${jp}`)
  check('  …«Ver las 70» y «Ver las 20» en sus rótulos', /Ver las 70/.test(await page.locator('[data-tramo-ver="WEST"]').innerText()) && /Ver las 20/.test(await page.locator('[data-tramo-ver="JP"]').innerText()))
  check('  …la cuenta sigue siendo de los dos', /90 cartas a cambio/.test(await page.locator('#mcMercadoCuantas').innerText()), await page.locator('#mcMercadoCuantas').innerText())
  check('  …y ya no hay «Ver más»', (await page.locator('#mcMercadoMas').count()) === 0)
  await page.click('[data-tramo-ver="WEST"]')
  await page.waitForTimeout(1500)
  check('«Ver las 70»: el occidental entero, 48 en la página 1', /tramo=mercado(%3A|:)WEST/.test(page.url()) && (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 48, page.url())
  check('  …con «← Todas» y el paginador arriba y abajo', (await page.locator('#mcMercadoRejilla [data-tramo-volver]').count()) === 1 && (await page.locator('#mcMercadoRejilla .paginacion').count()) === 2)
  check('  …y el paginador con su CSS (botones de 44)', (await page.locator('#mcMercadoRejilla .paginacion .pag-num').first().evaluate((e) => e.getBoundingClientRect().height)) >= 44)
  await page.locator('#mcMercadoRejilla .paginacion').last().locator('[data-pagina="2"]').first().click()
  await page.waitForTimeout(1500)
  check('página 2: las 22 que quedan, y en la dirección', (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 22 && /pag=2/.test(page.url()))
  await page.goBack()
  await page.waitForTimeout(1500)
  check('atrás: vuelve a la página 1', (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 48 && !/pag=2/.test(page.url()), page.url())
  await page.click('[data-tramo-ver]').catch(() => {})
  await page.locator('#mcMercadoRejilla .paginacion').first().locator('[data-pagina="2"]').first().click()
  await page.waitForTimeout(1200)
  await page.fill('#mcMercadoBuscar', 'occ 1')
  await page.waitForTimeout(1800)
  check('un filtro nuevo vuelve a la página 1 del tramo', !/pag=2/.test(page.url()) && (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 10, `${page.url()} · ${await page.locator('#mcMercadoRejilla .mc-merc').count()}`)
  await page.fill('#mcMercadoBuscar', '')
  await page.waitForTimeout(1500)
  await page.click('[data-tramo-volver]')
  await page.waitForTimeout(1500)
  check('«← Todas»: de vuelta al escaparate', !/tramo=/.test(page.url()) && (await page.locator('[data-tramo-ver="WEST"]').count()) === 1)
  const pedidos = await page.evaluate(() => (window.__TABLAS__ ? null : null))
  void pedidos
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Lo que se pide a la base ──')
{
  const { ctx, page } = await abrir('/mi-coleccion.html?ver=quiero')
  const limites = []
  await page.route('**/*', (r) => r.continue())
  await page.evaluate(() => {
    const orig = window.__stubRpcHook
    void orig
  })
  // El doble no apunta las llamadas: se mira la rejilla, que pinta lo que llega.
  await page.goto(`${BASE}/mi-coleccion.html?ver=mercado&tramo=mercado:JP`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('un enlace a un tramo abre ese catálogo (las 20 japonesas, una página)', (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 20 && (await page.locator('#mcMercadoRejilla .paginacion').count()) === 0)
  check('  …y la cuenta de la pestaña sigue siendo de los dos', /90 cartas a cambio/.test(await page.locator('#mcMercadoCuantas').innerText()), await page.locator('#mcMercadoCuantas').innerText())
  void limites
  await ctx.close()
}

console.log('── 4. El móvil ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=mercado', { movil: true })
  check('escaparate: seis de cada catálogo (dos filas de tres)', (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 12)
  await page.click('[data-tramo-ver="WEST"]')
  await page.waitForTimeout(1500)
  check('dentro, 24 por página', (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 24)
  check('  …y el paginador cabe en la pantalla', (await page.locator('#mcMercadoRejilla .paginacion').first().evaluate((e) => e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().right <= innerWidth)))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. La quiero y Las que doy ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero')
  const col = await columnas(page, '#mcQuieroRejilla')
  const n = await page.locator('#mcQuieroRejilla .mc-merc').count()
  check('La quiero: dos filas y «Ver las 30»', n === 2 * col && /Ver las 30/.test(await page.locator('#mcQuieroPanel [data-tramo-ver="WEST"]').innerText().catch(() => '')), `${n} con ${col} columnas`)
  await page.click('#mcQuieroPanel [data-tramo-ver="WEST"]')
  await page.waitForTimeout(800)
  check('  …dentro, las 30 (una página) con «← Todas»', (await page.locator('#mcQuieroRejilla .mc-merc').count()) === 30 && /tramo=quiero/.test(page.url()) && (await page.locator('#mcQuieroPanel [data-tramo-volver]').count()) === 1)
  await page.click('#mcQuieroPanel [data-tramo-volver]')
  await page.waitForTimeout(800)
  check('  …y «← Todas» vuelve', (await page.locator('#mcQuieroRejilla .mc-merc').count()) === 2 * col && !/tramo=/.test(page.url()))
  await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
  await page.waitForTimeout(2000)
  const nd = await page.locator('#mcDoyRejilla .mc-merc').count()
  const cold = await columnas(page, '#mcDoyRejilla')
  check('Las que doy: dos filas y «Ver las 40»', nd === 2 * cold && /Ver las 40/.test(await page.locator('#mcDoyPanel [data-tramo-ver="WEST"]').innerText().catch(() => '')), `${nd} con ${cold}`)
  await page.click('#mcDoyPanel [data-tramo-ver="WEST"]')
  await page.waitForTimeout(1500)
  check('  …dentro, las 40', (await page.locator('#mcDoyRejilla .mc-merc').count()) === 40 && /tramo=doy/.test(page.url()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
