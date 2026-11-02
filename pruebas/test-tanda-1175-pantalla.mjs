// Tanda 1175 — V2 y V3 de la propuesta de orden del Panel:
//   · Las dos tiras de cartas («Las que más valen», «Últimas añadidas») con
//     la MISMA ficha: la carta, el dato en negrita (lo que vale una copia /
//     cuándo la metiste) y el nombre debajo.
//   · Las expansiones del Panel en filas (logo, nombre, barra, «14 / 252»),
//     hasta cuatro, que abren la expansión al pulsar.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const browser = await chromium.launch()
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }, { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207 }, { id: 'sv9', name: 'Evoluciones Prismáticas', serie_id: 'sv', market: 'WEST', release_date: '2025-01-17', card_count_official: 131, card_count_total: 180 }, { id: 'sv6', name: 'Mascarada Crepuscular', serie_id: 'sv', market: 'WEST', release_date: '2024-05-24', card_count_official: 167, card_count_total: 226 }, { id: 'sv5', name: 'Fuerzas Temporales', serie_id: 'sv', market: 'WEST', release_date: '2024-03-22', card_count_official: 162, card_count_total: 218 }]
const nombres = ['Pikachu ex', 'Charizard ex', 'Mew ex', 'Greninja', 'Zapdos ex', 'Alakazam', 'Gengar', 'Raichu']
const setDe = (i) => ['sv8', 'sv8', 'sv3pt5', 'sv9', 'sv6', 'sv5', 'sv5', 'sv5'][i]
const CARTAS = nombres.map((n, i) => ({ id: `${setDe(i)}-${i + 1}`, market: 'WEST', set_id: setDe(i), local_id: String(i + 1), name: n, name_es: n, image_path: `x/${i}`, rarity: 'Rare', category: 'Pokemon', tcg_sets: { id: setDe(i), name: SETS.find((s) => s.id === setDe(i)).name, serie_id: 'sv' } }))
const precio = (i) => [182, 96.5, 44, 12.3, 30, 7.2, 3.1, 1.5][i]
const PRECIOS = CARTAS.map((c, i) => ({ card_id: c.id, cm_low: precio(i), cm_low_es: precio(i), checked_at: '2026-10-19T10:00:00Z' }))
const hoy = new Date(); hoy.setHours(12, 0, 0, 0)
const hace = (d) => new Date(hoy.getTime() - d * 864e5).toISOString()
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, created_at: hace([0, 1, 3, 45, 0, 2, 2, 2][i]) }))
const sembrar = (d) => {
  window.__FAKE_SESSION__ = 'admin-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [], __FAKE_VALOR__: [], __FAKE_HISTORIAL__: [], __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }] })
}
const datos = { SETS, CARTAS, PRECIOS, COLECCION }

for (const movil of [false, true]) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(sembrar, datos)
  const page = await ctx.newPage()
  const err = []; page.on('pageerror', (e) => err.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcVistazoSets .mc-set-fila', { timeout: 15000 }).catch(() => {})
  const que = movil ? 'móvil' : 'PC'
  console.log(`── ${que} ──`)
  const v = await page.evaluate(() => {
    const ficha = (f) => `${f.querySelector('small')?.textContent}|${f.querySelector('b')?.textContent}|${!!f.querySelector('a.mc-vistazo-carta[data-carta]')}`
    const top = (sel) => [...document.querySelectorAll(sel)].map((e) => Math.round(e.getBoundingClientRect().top))
    return {
      valiosas: [...document.querySelectorAll('#mcValiosas .mc-vistazo-ficha')].map(ficha),
      ultimas: [...document.querySelectorAll('#mcUltimas .mc-vistazo-ficha')].map(ficha),
      anchoValiosa: Math.round(document.querySelector('#mcValiosas .mc-vistazo-carta')?.getBoundingClientRect().width || 0),
      anchoUltima: Math.round(document.querySelector('#mcUltimas .mc-vistazo-carta')?.getBoundingClientRect().width || 0),
      sets: [...document.querySelectorAll('#mcVistazoSets .mc-set-fila')].map((f) => `${f.dataset.set}:${f.querySelector('b').textContent}:${f.querySelector('em').textContent}:${!!f.querySelector('.mc-barra i')}`),
      tarjetas: document.querySelectorAll('#mcVistazoSets .mc-set-tarjeta').length,
      filasDeSets: new Set([...document.querySelectorAll('#mcVistazoSets .mc-set-fila')].filter((f) => f.getClientRects().length).map((f) => Math.round(f.getBoundingClientRect().top))).size,
      ancho: document.documentElement.scrollWidth <= innerWidth,
    }
  })
  check('«Las que más valen»: la carta, lo que vale una copia y el nombre', v.valiosas.length >= 4 && v.valiosas[0].replace(/ /g, ' ') === 'Pikachu ex|182,00 €|true' && v.valiosas[1].replace(/ /g, ' ') === 'Charizard ex|96,50 €|true', JSON.stringify(v.valiosas))
  check('«Últimas añadidas»: la carta, cuándo la metiste y el nombre', v.ultimas.length >= 4 && v.ultimas[0] === 'Pikachu ex|hoy|true' && v.ultimas.some((x) => /\|ayer\|/.test(x)) && v.ultimas.some((x) => /\|hace 2 días\|/.test(x)) && v.ultimas.some((x) => /\|hace 3 días\|/.test(x)), JSON.stringify(v.ultimas))
  check('  …y las dos tiras con cartas del mismo tamaño', v.anchoValiosa > 0 && v.anchoValiosa === v.anchoUltima, `${v.anchoValiosa} vs ${v.anchoUltima}`)
  check('Expansiones: cuatro filas (de las cinco que tienes), las más nuevas, con nombre, barra y «N / total», sin tarjeta grande', v.sets.length === 4 && v.tarjetas === 0 && v.sets[0] === 'sv9:Evoluciones Prismáticas:1 / 180:true' && v.sets[1] === 'sv8:Chispas Fulgurantes:2 / 252:true' && v.sets[3] === 'sv5:Fuerzas Temporales:3 / 218:true', JSON.stringify(v.sets))
  check(`  …${movil ? 'dos filas en el móvil (1178), una por fila' : 'las cuatro en una fila en el PC (1177)'}`, v.filasDeSets === (movil ? 2 : 1), String(v.filasDeSets))
  check('  …sin salirse', v.ancho)
  await page.click('#mcVistazoSets .mc-set-fila[data-set="sv8"]')
  await page.waitForTimeout(1500)
  check('una fila abre su expansión', await page.evaluate(() => !document.getElementById('mcPanelAlbum').classList.contains('hidden') && /set=sv8/.test(location.search)), await page.evaluate(() => location.search))
  check(`${que}: sin errores`, !err.length, err.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
