// Captura del Panel (PC y móvil) con los fixtures de la 1173, para mirar la 1177.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = 'http://localhost:8892'
const OUT = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/total/r10/f1177'
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }, { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207 }]
const nombres = ['Pikachu ex', 'Charizard ex', 'Mew ex', 'Greninja', 'Zapdos ex', 'Alakazam', 'Gengar', 'Raichu', 'Snorlax', 'Eevee', 'Dragonite', 'Gyarados']
const CARTAS = nombres.map((n, i) => ({ id: `${i < 6 ? 'sv8' : 'sv3pt5'}-${i + 1}`, market: 'WEST', set_id: i < 6 ? 'sv8' : 'sv3pt5', local_id: String(i + 1), name: n, name_es: n, image_path: `x/${i}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [25 + i], tcg_sets: { id: i < 6 ? 'sv8' : 'sv3pt5', name: i < 6 ? 'Chispas Fulgurantes' : '151', serie_id: 'sv' } }))
const precio = (i) => [182, 96.5, 44, 12.3, 30, 7.2, 3.1, 1.5, 0.9, 22, 15, 5][i]
const PRECIOS = CARTAS.map((c, i) => ({ card_id: c.id, cm_low: precio(i), cm_low_es: precio(i), checked_at: '2026-10-19T10:00:00Z' }))
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 + (i % 3), precio_compra: i < 4 ? precio(i) * 0.8 : null, created_at: `2026-10-${String(1 + i).padStart(2, '0')}T10:00:00Z` }))
const hoy = Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate())
const VALOR = Array.from({ length: 30 }, (_, d) => ({ user_id: 'admin-1', dia: new Date(hoy - d * 864e5).toISOString().slice(0, 10), valor: 610 - d * 3 + (d % 4) * 5 }))
const HIST = []
CARTAS.forEach((c, i) => { for (let d = 0; d < 10; d++) { const v = precio(i) * (1 + (i % 2 ? -1 : 1) * 0.01 * d); HIST.push({ card_id: c.id, dia: new Date(hoy - d * 864e5).toISOString().slice(0, 10), cm_low: v, cm_low_es: v, origen: 'tcggo' }) } })
const AVISOS = [{ id: 'av1', user_id: 'admin-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 150, activo: true }, { id: 'av2', user_id: 'admin-1', card_id: 'sv8-2', market: 'WEST', idioma: 'es', tipo: 'sube', umbral: 100, activo: true }, { id: 'av3', user_id: 'admin-1', card_id: 'sv3pt5-7', market: 'WEST', idioma: 'es', tipo: 'baja', umbral: 1, activo: true }]
const browser = await chromium.launch()
const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
for (const [nombre, opts] of [['pc', { viewport: { width: 1280, height: 900 } }], ['pc-ancho', { viewport: { width: 1920, height: 900 } }], ['pc-sin-alertas', { viewport: { width: 1280, height: 900 }, sinAlertas: true }], ['movil', { ...devices['iPhone 13'] }]]) {
  const ctx = await browser.newContext({ ...opts, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.route(/assets\.tcgdex|limitless|tcggo|scrydex|pokemontcg|\/escaneo\//, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from(png.split(',')[1], 'base64') }))
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [], __FAKE_VALOR__: d.VALOR, __FAKE_HISTORIAL__: d.HIST, __FAKE_AVISOS__: d.AVISOS, __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }] })
  }, { SETS, CARTAS, PRECIOS, COLECCION, VALOR, HIST, AVISOS: opts.sinAlertas ? [] : AVISOS })
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  await page.screenshot({ path: `${OUT}/${nombre}.png`, fullPage: true })
  const m = await page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)] }
    return { valor: r('#mcValorCaja'), mov: r('#mcMovidas'), al: r('#mcAlertas'), cam: r('#mcCambios'), mes: r('#mcMes'), val: r('#mcValiosas'), ult: r('#mcUltimas'), sets: r('#mcVistazoSets'), mas: r('#mcMas'), lado: r('.mc-cartera-lado'), fichaMes: document.querySelector('#mcCarteraMes')?.textContent.trim(), fichaSem: document.querySelector('#mcCarteraSemana')?.textContent.trim(), ancho: document.documentElement.scrollWidth <= innerWidth }
  })
  console.log(nombre, JSON.stringify(m), err.join(' | '))
  await ctx.close()
}
await browser.close()
