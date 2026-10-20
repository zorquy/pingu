// Tanda 922 — Las versiones de una carta (PINGU: «todas las cartas del 30
// aniversario son holográficas»; «si agregas esa carta no se está metiendo
// la variante exacta»; y «mira cómo lo hace Dex al añadir»):
//   0. Lo que una carta no dice se deduce de su expansión y su rareza.
//   1. Añadir: si hay varias versiones, «¿Cuál tienes?» primero; con una,
//      directa («la única que existe»); y se guarda la elegida.
//   2. Sin datos ni regla: las cuatro, con el aviso.
//   3. «Variantes»: la casilla de la Reverse abre la ficha EN la Reverse y su
//      «Añadir» guarda una Reverse.
//   4. /carta usa la misma lista.
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}

console.log('── 0. Lo que no se sabe, deducido ──')
{
  const v = await import(join(RAIZ, 'js/mi-coleccion/variantes.js'))
  const ids = (c) => v.variantesDeCarta(c, v.TODAS).map((x) => x.nuestro).join(',')
  check('30 aniversario: solo holo, aunque la rareza diga Rara', ids({ set_id: '30th', rarity: 'Rare' }) === 'holo')
  check('  …y su Classic, y Celebrations', ids({ set_id: '30th-c', rarity: 'Common' }) === 'holo' && ids({ set_id: 'cel25', rarity: 'Rare Holo' }) === 'holo')
  check('una Rara Ilustración Especial: solo holo (por inglés o por español)', ids({ set_id: 'sv8', rarity_en: 'Special Illustration Rare' }) === 'holo' && ids({ set_id: 'sv8', rarity: 'Rara Ilustración Especial' }) === 'holo')
  check('una común de hoy: normal y reverse', ids({ set_id: 'me1', rarity: 'Common' }) === 'normal,reverse')
  check('una Rara Holo de hoy: holo y reverse', ids({ set_id: 'sv1', rarity: 'Rare Holo' }) === 'holo,reverse')
  check('la 1.ª edición, solo en las de Wizards que la tuvieron (y sin reverse)', ids({ set_id: 'base1', rarity: 'Rare Holo' }) === 'holo,primera' && ids({ set_id: 'base4', rarity: 'Common' }) === 'normal')
  check('lo que la carta dice manda sobre la regla', ids({ set_id: '30th', rarity: 'Rare', variants: { normal: true } }) === 'normal')
  check('una promo sin datos: no se sabe (las cuatro)', ids({ set_id: 'svp', rarity: 'Promo' }) === 'normal,reverse,holo,primera' && !v.seSabenVariantes({ set_id: 'svp', rarity: 'Promo' }))
  check('  …y en el japonés solo se deduce lo que es holo', ids({ set_id: 'SV1a', market: 'JP', rarity: 'Common' }) === 'normal,reverse,holo,primera' && ids({ set_id: 'SV1a', market: 'JP', rarity_en: 'Double Rare' }) === 'holo')
}

const SETS = [
  { id: '30th', name: '30th Celebration', serie_id: 'sv', market: 'WEST', card_count_official: 1, card_count_total: 1 },
  { id: 'me1', name: 'Mega Evolution', serie_id: 'me', market: 'WEST', card_count_official: 3, card_count_total: 3 },
  { id: 'svp', name: 'Promos', serie_id: 'sv', market: 'WEST', card_count_official: 1, card_count_total: 1 },
]
const carta = (id, set, n, nombre, extra = {}) => ({ id, market: 'WEST', set_id: set, local_id: n, name: nombre, name_es: nombre, image_path: `x/${id}`, category: 'Pokemon', dex_ids: [1], tcg_sets: { id: set, name: SETS.find((s) => s.id === set).name, serie_id: 'sv' }, ...extra })
const CARTAS = [
  carta('tcggo-1', '30th', '002', 'Alolan Exeggutor', { rarity: 'Rare' }),
  carta('me1-1', 'me1', '001', 'Bulbasaur', { rarity: 'Common', variants: { normal: true, reverse: true } }),
  carta('me1-2', 'me1', '002', 'Ivysaur', { rarity: 'Uncommon' }),
  carta('me1-3', 'me1', '003', 'Venusaur', { rarity: 'Rare Holo' }),
  carta('svp-1', 'svp', '001', 'Pikachu', { rarity: 'Promo' }),
]
const browser = await chromium.launch()
async function abrir(ruta, { movil = true } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_DESEOS__: [], __FAKE_COLECCION__: [{ id: 'l1', user_id: 'admin-1', card_id: 'me1-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 }] })
  }, { SETS, CARTAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|pokemontcg|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" rx="24" fill="#84cc16"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { ctx, page, errores }
}
const vista = (page) => page.evaluate(() => ({
  eligiendo: document.getElementById('mcAdForm').classList.contains('vp-eligiendo'),
  lista: [...document.querySelectorAll('#mcAdElegir [data-vp-version]')].map((b) => b.dataset.vpVersion),
  aviso: document.querySelector('#mcAdElegir .vp-aviso')?.textContent || '',
  fija: (document.getElementById('mcAdVersionFija').hidden ? '' : document.getElementById('mcAdVersionFija').innerText).replace(/\s+/g, ' ').trim(),
  guardarVisible: document.getElementById('mcAdGuardar').getBoundingClientRect().height > 0,
  valor: document.getElementById('mcAdVariante').value,
}))
const lineasDe = (page, cardId) => page.evaluate((id) => (window.__TABLAS__?.user_collection || []).filter((l) => l.card_id === id).map((l) => l.variante), cardId)

console.log('── 1–2. Añadir en Mi colección ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album&set=30th')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.locator('#mcAlbum [data-anadir="tcggo-1"]').first().click()
  await page.waitForTimeout(700)
  const r = await vista(page)
  check('el Exeggutor del 30, directo: «Holo · la única que existe», sin preguntar', !r.eligiendo && r.fija === 'Versión Holo la única que existe' && r.valor === 'holo' && r.guardarVisible, JSON.stringify(r))
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(900)
  check('  …y se guarda en holo', JSON.stringify(await lineasDe(page, 'tcggo-1')) === '["holo"]', JSON.stringify(await lineasDe(page, 'tcggo-1')))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=me1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('#mcAlbum [data-anadir="me1-2"]').first().click()
  await page.waitForTimeout(700)
  const a = await vista(page)
  check('el Ivysaur (sin datos, infrecuente): «¿Cuál tienes?» con Normal y Reverse, y el resto espera', a.eligiendo && a.lista.join() === 'normal,reverse' && !a.guardarVisible && !a.aviso, JSON.stringify(a))
  await page.click('#mcAdElegir [data-vp-version="reverse"]')
  await page.waitForTimeout(400)
  const b = await vista(page)
  check('  …al tocar Reverse, queda arriba con «Cambiar» y sale lo demás', !b.eligiendo && /^Versión Reverse holo Cambiar$/.test(b.fija) && b.guardarVisible && b.valor === 'reverse', JSON.stringify(b))
  await page.click('#mcAdVersionFija [data-vp-cambiar]')
  await page.waitForTimeout(300)
  check('  …«Cambiar» vuelve a la lista', (await vista(page)).eligiendo)
  await page.click('#mcAdElegir [data-vp-version="reverse"]')
  await page.waitForTimeout(300)
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(900)
  check('  …y se guarda la Reverse', JSON.stringify(await lineasDe(page, 'me1-2')) === '["reverse"]', JSON.stringify(await lineasDe(page, 'me1-2')))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=svp`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('#mcAlbum [data-anadir="svp-1"]').first().click()
  await page.waitForTimeout(700)
  const c = await vista(page)
  check('una promo sin datos: las cuatro, con «No sabemos qué versiones tiene: elige la tuya»', c.eligiendo && c.lista.length === 4 && /No sabemos qué versiones tiene/.test(c.aviso), JSON.stringify(c))
  check('sin errores al final', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. «Variantes»: la casilla que tocas es la que se abre ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album&set=me1')
  // «Apilar» va en la barra desde la 927: quitarlo separa las versiones.
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(800)
  const casilla = page.locator('#mcAlbum .mc-bolsillo-enlace[data-carta="me1-1"][data-variante="reverse"]')
  check('con «Variantes», cada casilla dice su versión', (await casilla.count()) === 1)
  await casilla.click()
  await page.waitForTimeout(1300)
  const f = await page.evaluate(() => ({ version: document.getElementById('mcEdVersionNombre')?.textContent, linea: document.getElementById('mcEditor').dataset.linea, boton: document.querySelector('#mcEdMas .mc-mas-texto')?.textContent }))
  check('la Reverse del Bulbasaur (tienes la Normal) abre la ficha EN la Reverse, sin copia', f.version === 'Reverse holo' && (!f.linea || f.linea === 'undefined' || f.linea === 'null') && f.boton === 'Añadir Reverse holo', JSON.stringify(f))
  await page.click('#mcEdMas')
  await page.waitForTimeout(700)
  const v = await vista(page)
  check('  …y su «Añadir» va directo a la Reverse', !v.eligiendo && v.valor === 'reverse', JSON.stringify(v))
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(900)
  check('  …y guarda una Reverse, no otra Normal', JSON.stringify((await lineasDe(page, 'me1-1')).sort()) === '["normal","reverse"]', JSON.stringify(await lineasDe(page, 'me1-1')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. /carta, la misma lista ──')
{
  const { ctx, page, errores } = await abrir('/carta.html?id=me1-3', { movil: false })
  await page.click('#cmAnadir')
  await page.waitForTimeout(800)
  const r = await page.evaluate(() => ({ eligiendo: document.getElementById('cmAdForm')?.classList.contains('vp-eligiendo'), lista: [...document.querySelectorAll('#cmAdElegir [data-vp-version]')].map((b) => b.dataset.vpVersion) }))
  check('el Venusaur (Rara Holo sin datos): «¿Cuál tienes?» con Holo y Reverse', r.eligiendo && r.lista.join() === 'holo,reverse', JSON.stringify(r))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
