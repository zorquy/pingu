// Tanda 925 — B de la propuesta: el Panel tipo cartera. PINGU: «la B me
// gusta, la normal». Lo que se mira, en el móvil y en el PC:
//   1. Debajo de la cifra, UNA línea con cartas, distintas y expansiones
//      (eran tres casillas grandes), y el cambio en una chapa de su color.
//   2. «Las que más valen»: una tira de cartas con lo que vale una copia,
//      de la más cara a la más barata, y cada una abre su ficha.
//   3. «Las que más se mueven» SALE: el Panel se repintaba al llegar los
//      precios y su hueco nacía vacío (la 748 llevaba días roja por eso).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }, { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207 }]
const nombres = ['Pikachu ex', 'Charizard ex', 'Mew ex', 'Greninja', 'Zapdos ex', 'Alakazam', 'Gengar', 'Raichu', 'Snorlax', 'Eevee', 'Dragonite', 'Gyarados']
const CARTAS = nombres.map((n, i) => ({ id: `${i < 6 ? 'sv8' : 'sv3pt5'}-${i + 1}`, market: 'WEST', set_id: i < 6 ? 'sv8' : 'sv3pt5', local_id: String(i + 1), name: n, name_es: n, image_path: `x/${i}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [25 + i], tcg_sets: { id: i < 6 ? 'sv8' : 'sv3pt5', name: i < 6 ? 'Chispas Fulgurantes' : '151', serie_id: 'sv' } }))
const precio = (i) => [182, 96.5, 44, 12.3, 30, 7.2, 3.1, 1.5, 0.9, 22, 15, 5][i]
const PRECIOS = CARTAS.map((c, i) => ({ card_id: c.id, cm_low: precio(i), cm_low_es: precio(i), checked_at: '2026-10-19T10:00:00Z' }))
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 + (i % 3), created_at: `2026-10-${String(1 + i).padStart(2, '0')}T10:00:00Z` }))
const hoy = Date.UTC(2026, 9, 20)
const VALOR = Array.from({ length: 30 }, (_, d) => ({ user_id: 'admin-1', dia: new Date(hoy - d * 864e5).toISOString().slice(0, 10), valor: 610 - d * 3 + (d % 4) * 5 }))
const HIST = []
CARTAS.forEach((c, i) => { for (let d = 0; d < 9; d++) { const v = precio(i) * (1 + (i % 2 ? -1 : 1) * 0.02 * d * (i < 3 ? 1 : 0.3)); HIST.push({ card_id: c.id, dia: new Date(hoy - d * 864e5).toISOString().slice(0, 10), cm_low: v, cm_low_es: v, origen: 'tcggo' }) } })
const browser = await chromium.launch()
for (const movil of [true, false]) {
  console.log(movil ? '── En el móvil ──' : '── En el PC ──')
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1366, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [], __FAKE_VALOR__: d.VALOR, __FAKE_HISTORIAL__: d.HIST, __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }] })
  }, { SETS, CARTAS, PRECIOS, COLECCION, VALOR, HIST })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|scrydex|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" rx="24" fill="#f59e0b"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(5000)
  const m = await page.evaluate(() => {
    const r = (e) => e.getBoundingClientRect()
    const cifra = document.querySelector('#mcValorCaja .mc-cartera-cifra')
    const sub = document.querySelector('#mcValorCaja .mc-cartera-sub')
    const cambio = document.querySelector('#mcValorCaja .mc-valor-cambio')
    const valiosas = [...document.querySelectorAll('#mcValiosas .mc-valiosa')]
    return {
      viejas: document.querySelectorAll('.mc-cartera-fichas').length,
      sub: sub ? [...sub.children].map((s) => s.textContent.replace(/\s+/g, ' ').trim()) : null,
      subBajoCifra: !!(sub && cifra) && r(sub).top >= r(cifra).bottom - 1 && (!cambio || r(sub).bottom <= r(cambio).top + 1),
      cambio: cambio ? { clase: cambio.className, fondo: getComputedStyle(cambio).backgroundColor, texto: cambio.textContent.replace(/\s+/g, ' ').trim() } : null,
      valiosas: valiosas.map((v) => v.querySelector('b').textContent.trim()),
      valiosasAbren: valiosas.every((v) => v.querySelector('a[data-carta]')),
      movidas: document.querySelectorAll('#mcMovidas .mc-movida').length,
    }
  })
  check('las tres casillas grandes se fueron', m.viejas === 0)
  check('una línea bajo la cifra: cartas, distintas y expansiones', JSON.stringify(m.sub) === JSON.stringify(['24 cartas', '12 distintas', '2 expansiones']) && m.subBajoCifra, JSON.stringify(m))
  check('el cambio, en una chapa con su fondo', !!m.cambio && /sube|baja/.test(m.cambio.clase) && m.cambio.fondo !== 'rgba(0, 0, 0, 0)', JSON.stringify(m.cambio))
  const euros = m.valiosas.map((t) => Number(t.replace(/[^\d,]/g, '').replace(',', '.')))
  check('«Las que más valen»: ocho, de la más cara a la más barata', euros.length === 8 && euros[0] === 182 && euros.every((v, i) => i === 0 || v <= euros[i - 1]), m.valiosas.join(' · '))
  check('  …y cada una abre su ficha', m.valiosasAbren)
  check('«Las que más se mueven» sale, con sus tres', m.movidas === 3, String(m.movidas))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
