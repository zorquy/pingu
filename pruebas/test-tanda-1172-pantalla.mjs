// Tanda 1172 — Añadidas y Estadísticas como vistas, Expansiones a las empezadas
// (P3 y P4 de la propuesta del Panel).
//   · «Últimas añadidas → Ver todas» abre ?ver=anadidas: por días (Hoy, Ayer,
//     Esta semana, los meses) con cuántas y cuánto pagaste en cada tramo; «Sin
//     apuntar lo pagado» (?sin=pagado) deja solo esas con su campo a mano, que
//     guarda al salir y actualiza la cuenta.
//   · «Estadísticas → Ver todas» abre ?ver=estadisticas con lo de siempre más
//     «Por idioma» y «Por era».
//   · El 649 (Expansiones → todas) lo prueba su propia prueba, cambiada.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const browser = await chromium.launch()

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }, { id: 'swsh1', name: 'Espada y Escudo', serie_id: 'swsh', serie_name: 'Espada y Escudo', market: 'WEST', release_date: '2020-02-07', card_count_official: 202, card_count_total: 216 }]
const nombres = ['Pikachu ex', 'Charizard ex', 'Mew ex', 'Greninja', 'Zapdos ex', 'Alakazam', 'Gengar', 'Raichu']
const CARTAS = nombres.map((n, i) => ({ id: `${i < 5 ? 'sv8' : 'swsh1'}-${i + 1}`, market: 'WEST', set_id: i < 5 ? 'sv8' : 'swsh1', local_id: String(i + 1), name: n, name_es: n, image_path: `x/${i}`, rarity: i % 2 ? 'Rare' : 'Common', category: 'Pokemon', dex_ids: [25 + i], tcg_sets: { id: i < 5 ? 'sv8' : 'swsh1', name: i < 5 ? 'Chispas Fulgurantes' : 'Espada y Escudo', serie_id: i < 5 ? 'sv' : 'swsh' } }))
const precio = (i) => [182, 96.5, 44, 12.3, 30, 7.2, 3.1, 1.5][i]
const PRECIOS = CARTAS.map((c, i) => ({ card_id: c.id, cm_low: precio(i), cm_low_es: precio(i), cm_low_en: precio(i) * 1.1, checked_at: '2026-10-19T10:00:00Z' }))
const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
const hace = (d) => new Date(hoy.getTime() - d * 864e5).toISOString()
// Dos de hoy (una sin lo pagado), una de ayer, dos de esta semana, tres de hace
// dos meses; la Mew ex en inglés.
const CUANDO = [0, 0, 1, 3, 4, 62, 63, 64]
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', idioma: i === 2 ? 'en' : 'es', estado: 'NM', variante: 'normal', cantidad: i === 1 ? 2 : 1, precio_compra: i === 0 ? 150 : i === 1 ? 40 : i >= 5 ? 3 : null, created_at: hace(CUANDO[i]) }))
const sembrar = (d) => {
  window.__FAKE_SESSION__ = 'admin-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [], __FAKE_VALOR__: [], __FAKE_HISTORIAL__: [], __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }] })
}
const datos = { SETS, CARTAS, PRECIOS, COLECCION }

console.log('── Añadidas ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, datos)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.mc-vistazo .mc-subtitulo', { timeout: 15000 }).catch(() => {})
  const titulos = await page.locator('.mc-vistazo .mc-subtitulo').allTextContents()
  check('el bloque se llama «Últimas añadidas» y «Tus cartas» ya no está', titulos.includes('Últimas añadidas') && !titulos.includes('Tus cartas'), titulos.join('|'))
  await page.locator('.mc-vistazo').filter({ has: page.locator('h2', { hasText: 'Últimas añadidas' }) }).locator('[data-ir-a="anadidas"]').click()
  await page.waitForSelector('#mcAnadLista a.mc-movida', { timeout: 8000 }).catch(() => {})
  const a = await page.evaluate(() => ({
    ver: new URL(location.href).searchParams.get('ver'),
    tramos: [...document.querySelectorAll('#mcAnadLista .mc-vista-tramo')].map((h) => h.textContent.replace(/\s+/g, ' ').trim()),
    filas: [...document.querySelectorAll('#mcAnadLista a.mc-movida .mc-movida-nombre b')].map((b) => b.textContent),
    datos: [...document.querySelectorAll('#mcAnadLista .mc-anadida-dato')].map((d) => d.textContent.replace(/\s+/g, ' ').trim()),
    campos: document.querySelectorAll('#mcAnadLista input[data-pagado-de]').length,
    lit: document.querySelector('[data-pestania="resumen"]').classList.contains('activa'),
  }))
  check('«Ver todas» abre ?ver=anadidas con el Panel encendido', a.ver === 'anadidas' && a.lit, JSON.stringify(a))
  check('  …por tramos de días con cuántas y cuánto pagaste', a.tramos.length >= 4 && /^Hoy\s*3 cartas · 230,00 €$/.test(a.tramos[0]) && /^Ayer\s*1 carta · 1 sin apuntar$/.test(a.tramos[1]) && /^Esta semana\s*2 cartas · 2 sin apuntar$/.test(a.tramos[2]) && /^[A-Z][a-z]+( de \d{4})?\s*\d carta/.test(a.tramos[3]), JSON.stringify(a.tramos))
  check('  …de la última a la primera (8 líneas)', a.filas.length === 8 && a.filas[0] === 'Pikachu ex' && a.filas[7] === 'Raichu', a.filas.join(','))
  check('  …con «+N» y lo pagado, y un campo donde no está apuntado', /^\+1\s*pagaste 150,00 €$/.test(a.datos[0]) && /^\+2\s*pagaste 40,00 € por copia$/.test(a.datos[1]) && a.campos === 3, JSON.stringify(a.datos))
  await page.click('#mcPanelAnadidas [data-sin="pagado"]')
  await page.waitForTimeout(400)
  const sin = await page.evaluate(() => ({ url: location.search, filas: document.querySelectorAll('#mcAnadLista a.mc-movida').length, resumen: document.getElementById('mcAnadResumen').textContent }))
  check('«Sin apuntar lo pagado» deja las tres, con ?sin=pagado', /sin=pagado/.test(sin.url) && sin.filas === 3 && /3 líneas sin lo que pagaste/.test(sin.resumen), JSON.stringify(sin))
  await page.fill('#mcAnadLista input[data-pagado-de="l2"]', '35,5')
  await page.locator('#mcAnadLista input[data-pagado-de="l2"]').press('Tab')
  await page.waitForTimeout(900)
  const tras = await page.evaluate(() => ({ filas: document.querySelectorAll('#mcAnadLista a.mc-movida').length, escrito: JSON.stringify(JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => /user_collection/.test(e.ruta || e.tabla || '')).slice(-1)) }))
  check('apuntar 35,5 guarda precio_compra y la fila se va de «sin apuntar»', tras.filas === 2 && /35\.5/.test(tras.escrito), JSON.stringify(tras))
  await page.click('#mcPanelAnadidas [data-sin="todas"]')
  await page.waitForTimeout(400)
  const hoyTramo = await page.evaluate(() => document.querySelector('#mcAnadLista .mc-vista-tramo')?.textContent.replace(/\s+/g, ' '))
  check('  …y la cuenta de «Ayer» la lleva: ya no hay sin apuntar y suma 35,50 €', await page.evaluate(() => /Ayer\s*1 carta · 35,50 €$/.test(document.querySelectorAll('#mcAnadLista .mc-vista-tramo')[1]?.textContent.replace(/\s+/g, ' ').trim() || '')), hoyTramo)
  await page.click('#mcAnadLista a.mc-movida')
  await page.waitForTimeout(600)
  check('una fila abre el pop-up', await page.evaluate(() => document.getElementById('mcEditor')?.open))
  await page.keyboard.press('Escape')
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}

console.log('── Estadísticas ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, datos)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcVerTodo', { timeout: 15000 }).catch(() => {})
  check('el Panel no despliega nada: «Ver todas» de Estadísticas es un enlace a la vista', await page.evaluate(() => !document.getElementById('mcEstadisticas') && document.getElementById('mcVerTodo')?.dataset.irA === 'estadisticas'))
  await page.click('#mcVerTodo')
  await page.waitForSelector('#mcEstEra .mc-reparto', { timeout: 8000 }).catch(() => {})
  const e = await page.evaluate(() => ({
    ver: new URL(location.href).searchParams.get('ver'),
    cajas: [...document.querySelectorAll('#mcPanelEstadisticas .mc-resumen-caja h3')].map((h) => h.textContent),
    idioma: [...document.querySelectorAll('#mcEstIdioma .mc-reparto li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
    era: [...document.querySelectorAll('#mcEstEra .mc-reparto li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
    volver: !!document.querySelector('#mcPanelEstadisticas #mcVistaVolver'),
    ancho: document.documentElement.scrollWidth <= innerWidth,
  }))
  check('abre ?ver=estadisticas con las seis cajas', e.ver === 'estadisticas' && e.cajas.join('|') === 'Lo que das|Lo más valioso|Por colección|Por rareza|Por idioma|Por era' && e.volver, JSON.stringify(e))
  check('  …por idioma: 7 en español y 1 en inglés', e.idioma.join('|') === 'Español 7|Inglés 1', e.idioma.join('|'))
  check('  …por era: 5 de Escarlata y Púrpura y 3 de Espada y Escudo', e.era.join('|') === 'Escarlata y Púrpura 5|Espada y Escudo 3', e.era.join('|'))
  check('  …sin salirse en el móvil', e.ancho)
  await page.click('#mcVistaVolver')
  await page.waitForTimeout(400)
  check('«‹ Panel» vuelve', await page.evaluate(() => !new URL(location.href).searchParams.get('ver') && !document.getElementById('mcPanelResumen').classList.contains('hidden')))
  check('sin errores', !err.length, err.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
