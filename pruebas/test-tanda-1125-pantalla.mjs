// Tanda 1125 — Deseos y cambios TODO HACIA ABAJO (PINGU eligió la A de
// «Todas las cartas hacia abajo», con lo recomendado: se cargan solas, un
// catálogo detrás de otro, y lo mismo en Mercado, La quiero y Las que doy).
//
// Lo que se mira:
//   · lo puro: la dirección (y los enlaces de la 1114), el orden y el selector;
//   · el Mercado: una tanda de 48 (24 en el móvil), «Los dos · Pokémon ·
//     Japón» con sus cuentas, al bajar llega el resto SIN pulsar, el japonés
//     detrás con su rótulo pegado arriba, «Ya están todas»;
//   · que volver a la dirección deja la lista como estaba;
//   · elegir un catálogo, un filtro que lo vacía, y los enlaces viejos;
//   · La quiero en el móvil, que crece igual;
//   · que la página no salta al traer más.
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
  check('48 por tanda en el PC y 24 en el móvil', T.porPagina(false) === 48 && T.porPagina(true) === 24)
  check('la dirección: catálogo y cuántas, solo para su vista', JSON.stringify(T.listaDeDireccion('mercado', '?tramo=mercado:JP&hasta=96', 48)) === '{"cat":"JP","hasta":96}' && T.listaDeDireccion('quiero', '?tramo=mercado:JP', 48) === null && T.listaDeDireccion('mercado', '?tramo=mercado:todas&hasta=90', 48).cat === 'todas')
  check('un enlace de la 1114 (pag=3) abre ese catálogo con tres tandas', JSON.stringify(T.listaDeDireccion('mercado', '?tramo=mercado:WEST&pag=3', 48)) === '{"cat":"WEST","hasta":144}')
  check('el orden: occidental y luego japonés, o el elegido, sin vacíos', JSON.stringify(T.ordenDe({ WEST: 70, JP: 20 }, 'todas')) === '[["WEST",70],["JP",20]]' && JSON.stringify(T.ordenDe({ WEST: 70, JP: 20 }, 'JP')) === '[["JP",20]]' && JSON.stringify(T.ordenDe({ WEST: 0, JP: 20 }, 'todas')) === '[["JP",20]]')
  const sel = T.selectorDeCatalogoHtml('mercado', { WEST: 1234, JP: 20 }, 'JP')
  check('el selector: los dos, con sus cuentas y el elegido marcado', /Los dos<\/span> <small>1\.254/.test(sel) && /data-lista-cat="JP"[^>]*aria-pressed="true"/.test(sel) && /data-lista-cat="todas"[^>]*aria-pressed="false"/.test(sel))
  check('  …y con un solo catálogo no sale', T.selectorDeCatalogoHtml('mercado', { WEST: 10, JP: 0 }, 'todas') === '')
  const l = T.listaQueCrece({ vista: 'prueba', orden: [['WEST', 3], ['JP', 2]], pintar: (x) => `<i data-x="${x}"></i>`, cargadas: { WEST: ['a', 'b'] }, pedir: async () => [] })
  const h = l.html()
  check('lo ya cargado, con su rótulo pegado y el final que trae más', (h.match(/data-x=/g) || []).length === 2 && /mc-rotulo-pegado/.test(h) && /data-lista-mas="prueba"/.test(h) && l.quedan())
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

const alFondo = async (page, veces = 6) => {
  for (let i = 0; i < veces; i++) {
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(700)
  }
}

console.log('── 2. El Mercado en el PC ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=mercado')
  check('al entrar, una tanda: 48 occidentales y ninguna japonesa todavía', (await cuantasEn(page, '#mcMercadoRejilla', 'WEST')) === 48 && (await cuantasEn(page, '#mcMercadoRejilla', 'JP')) === 0, `${await cuantasEn(page, '#mcMercadoRejilla', 'WEST')} + ${await cuantasEn(page, '#mcMercadoRejilla', 'JP')}`)
  const chips = await page.$$eval('#mcMercadoRejilla [data-lista-cat]', (els) => els.map((e) => `${e.dataset.listaCat}:${e.innerText.replace(/\s+/g, ' ').trim()}:${e.getAttribute('aria-pressed')}`))
  check('«Los dos · Pokémon · Japón» con sus cuentas', chips.join('|') === 'todas:Los dos 90:true|WEST:Pokémon 70:false|JP:Japón 20:false', chips.join('|'))
  check('la cuenta sigue siendo de los dos', /90 cartas a cambio/.test(await page.locator('#mcMercadoCuantas').innerText()))
  check('ya no hay «Ver las N» ni páginas', (await page.locator('[data-tramo-ver], #mcMercadoRejilla .paginacion').count()) === 0)
  check('el rótulo del occidental se pega arriba', (await page.$eval('#mcMercadoRejilla .mc-catalogo-rotulo', (e) => getComputedStyle(e).position)) === 'sticky')
  check('al final, lo que se está trayendo (sin botón: llega solo)', (await page.locator('#mcMercadoRejilla [data-lista-mas]').count()) === 1 && !(await page.locator('#mcMercadoRejilla [data-lista-mas-boton]').isVisible()))
  // Bajar: llegan solas, sin pulsar.
  const saltos = await page.evaluate(() => { window.__saltos = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__saltos += e.value }).observe({ type: 'layout-shift', buffered: false }); return 0 })
  void saltos
  await alFondo(page)
  check('bajando, llegan las 70 occidentales y detrás las 20 japonesas', (await cuantasEn(page, '#mcMercadoRejilla', 'WEST')) === 70 && (await cuantasEn(page, '#mcMercadoRejilla', 'JP')) === 20)
  const rotulos = await page.$$eval('#mcMercadoRejilla .mc-catalogo-rotulo', (els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
  check('  …cada catálogo con su rótulo, el japonés detrás', rotulos.join('|') === 'Pokémon 70|Pokémon Japón 20', rotulos.join('|'))
  check('  …y al final «Ya están todas · 90»', /Ya están todas · 90/.test(await page.locator('#mcMercadoRejilla .mc-lista-fin').innerText()))
  check('  …la dirección lo recuerda', /hasta=90/.test(page.url()) && /tramo=mercado(%3A|:)todas/.test(page.url()), page.url())
  check('  …y la página no salta al traerlas', (await page.evaluate(() => window.__saltos)) < 0.1, await page.evaluate(() => window.__saltos))
  // A media lista del japonés, su rótulo está pegado bajo la barra.
  await page.evaluate(() => { const r = [...document.querySelectorAll('#mcMercadoRejilla .mc-catalogo-rotulo')][1]; const y = r.getBoundingClientRect().top + scrollY; scrollTo(0, y + 200) })
  await page.waitForTimeout(300)
  const arriba = await page.$$eval('#mcMercadoRejilla .mc-catalogo-rotulo', (els) => Math.round(els[1].getBoundingClientRect().top))
  check('bajando por el japonés, su rótulo se queda pegado bajo la barra', arriba >= 60 && arriba <= 80, arriba)
  await page.screenshot({ path: '/tmp/1125-pc.png' })
  // Volver a esa dirección (atrás desde otra página): la lista como estaba.
  await page.goto(page.url(), { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('volver a la dirección trae las 90 de una vez', (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 90, await page.locator('#mcMercadoRejilla .mc-merc').count())
  await page.evaluate(() => scrollTo(0, 0))
  await page.click('[data-lista-cat="JP"]')
  await page.waitForTimeout(1500)
  check('«Japón»: solo las 20 japonesas, sin rótulo en medio', (await cuantasEn(page, '#mcMercadoRejilla', 'JP')) === 20 && (await cuantasEn(page, '#mcMercadoRejilla', 'WEST')) === 0 && (await page.locator('#mcMercadoRejilla .mc-catalogo-rotulo').count()) === 0)
  check('  …en la dirección, y la cuenta de la pestaña sigue de los dos', /tramo=mercado(%3A|:)JP/.test(page.url()) && !/hasta=/.test(page.url()) && /90 cartas a cambio/.test(await page.locator('#mcMercadoCuantas').innerText()), page.url())
  await page.fill('#mcMercadoBuscar', 'occ 1')
  await page.waitForTimeout(1800)
  check('un filtro que deja el japonés vacío enseña los dos (aquí, 10 occidentales)', (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 10, await page.locator('#mcMercadoRejilla .mc-merc').count())
  await page.fill('#mcMercadoBuscar', '')
  await page.waitForTimeout(1500)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Lo recordado y los enlaces viejos ──')
{
  const { ctx, page } = await abrir('/mi-coleccion.html?ver=mercado')
  await page.click('[data-lista-cat="WEST"]')
  await page.waitForTimeout(1200)
  await page.goto(`${BASE}/mi-coleccion.html?ver=mercado`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('el catálogo elegido se recuerda en tu navegador', (await page.locator('[data-lista-cat="WEST"][aria-pressed="true"]').count()) === 1 && (await cuantasEn(page, '#mcMercadoRejilla', 'JP')) === 0)
  await page.goto(`${BASE}/mi-coleccion.html?ver=mercado&tramo=mercado:JP&pag=2`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('un enlace de la 1114 abre ese catálogo', (await cuantasEn(page, '#mcMercadoRejilla', 'JP')) === 20 && (await page.locator('[data-lista-cat="JP"][aria-pressed="true"]').count()) === 1)
  await ctx.close()
}

console.log('── 4. El móvil ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=mercado', { movil: true })
  check('al entrar, 24', (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 24)
  check('  …a tres por fila', (await columnas(page, '#mcMercadoRejilla')) === 3)
  check('  …y el selector cabe sin desbordar', await page.$eval('.mc-lista-cats', (e) => e.getBoundingClientRect().right <= innerWidth + 1))
  await alFondo(page, 8)
  check('bajando, llegan todas', (await page.locator('#mcMercadoRejilla .mc-merc').count()) === 90, await page.locator('#mcMercadoRejilla .mc-merc').count())
  await page.screenshot({ path: '/tmp/1125-movil.png' })
  await page.goto(`${BASE}/mi-coleccion.html?ver=quiero`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const antes = await page.locator('#mcQuieroRejilla .mc-deseo-baldosa').count()
  await alFondo(page, 4)
  const despues = await page.locator('#mcQuieroRejilla .mc-deseo-baldosa').count()
  check('La quiero crece igual: 24 y, bajando, las 30', antes === 24 && despues === 30, `${antes} → ${despues}`)
  check('  …sin selector (todas son de un catálogo) ni rótulo', (await page.locator('#mcQuieroRejilla [data-lista-cat], #mcQuieroRejilla .mc-catalogo-rotulo').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
