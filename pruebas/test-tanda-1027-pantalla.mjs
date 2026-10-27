// Tanda 1027 — el chip «Edición japonesa / occidental» en la cabecera de una
// expansión: al lado del nombre en el PC, en la línea del progreso en el
// móvil (el mismo elemento), con el nombre de la gemela y el enlace al otro
// catálogo; varias gemelas en un desplegable; sin gemela, nada.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const SETS = [
  { id: 'sv8', name: 'Chispas Fulgurantes', name_en: 'Surging Sparks', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252, tcggo_id: 450, tcggo_gemelos: [468] },
  { id: 'sv2', name: 'Evoluciones en Paldea', name_en: 'Paldea Evolved', serie_id: 'sv', market: 'WEST', release_date: '2023-06-09', card_count_official: 193, card_count_total: 279, tcggo_id: 318, tcggo_gemelos: [452, 453, 454] },
  { id: 'sv1', name: 'Escarlata y Púrpura', name_en: 'Scarlet & Violet', serie_id: 'sv', market: 'WEST', release_date: '2023-03-31', card_count_official: 198, card_count_total: 258, tcggo_id: 300, tcggo_gemelos: null },
  { id: 'SV8', name: 'Super Electric Breaker', name_en: 'Super Electric Breaker', serie_id: 'SV', market: 'JP', release_date: '2024-10-18', card_count_official: 106, card_count_total: 136, tcggo_id: 468, tcggo_gemelos: [450] },
  { id: 'SV1a', name: 'Triplet Beat', name_en: 'Triplet Beat', serie_id: 'SV', market: 'JP', release_date: '2023-03-10', card_count_official: 73, card_count_total: 100, tcggo_id: 452, tcggo_gemelos: [318] },
  { id: 'SV2P', name: 'Snow Hazard', name_en: 'Snow Hazard', serie_id: 'SV', market: 'JP', release_date: '2023-04-14', card_count_official: 71, card_count_total: 90, tcggo_id: 453, tcggo_gemelos: [318] },
  { id: 'SV2D', name: 'Clay Burst', name_en: 'Clay Burst', serie_id: 'SV', market: 'JP', release_date: '2023-04-14', card_count_official: 71, card_count_total: 90, tcggo_id: 454, tcggo_gemelos: [318] },
]
const carta = (set, market, n) => ({ id: `${set}-${n}`, set_id: set, local_id: String(n), name: 'Pikachu', market, category: 'Pokemon', rarity: 'Common', rarity_en: 'Common', image_path: `x/${set}/${n}`, variants: { normal: true } })
const CARTAS = [...Array.from({ length: 6 }, (_, i) => carta('sv8', 'WEST', i + 1)), ...Array.from({ length: 6 }, (_, i) => carta('sv2', 'WEST', i + 1)), ...Array.from({ length: 6 }, (_, i) => carta('sv1', 'WEST', i + 1)), ...Array.from({ length: 6 }, (_, i) => carta('SV8', 'JP', i + 1))]

const b = await chromium.launch()
async function abrir(ruta, { movil = false } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'user-1'
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: [{ id: 'l1', user_id: 'user-1', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 }], __FAKE_PRECIOS__: [] })
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-onboarding', '1') } catch {}
  }, { SETS, CARTAS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent|api\.tcgdex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { ctx, page, errores }
}
const chip = (page) => page.evaluate(() => {
  const sitio = document.getElementById('mcAlbumGemela')
  const a = sitio?.querySelector('a.mc-gemela, summary.mc-gemela')
  const r = a?.getBoundingClientRect()
  return { oculto: !sitio || sitio.classList.contains('hidden'), texto: a?.textContent.replace(/\s+/g, ' ').trim() || '', href: a?.getAttribute('href') || null, padre: sitio?.parentElement?.className || '', alto: r ? Math.round(r.height) : 0, enPantalla: r ? r.width > 0 && r.top >= 0 && r.left >= 0 && r.right <= innerWidth : false, menu: document.getElementById('mcAlbumGemelaMenu')?.classList.contains('hidden') === false ? document.getElementById('mcAlbumGemelaMenuTexto')?.textContent : null }
})

console.log('── 1. PC: una gemela, en la línea del progreso (1051) ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv8')
  const c = await chip(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Desde la 1051 también en el PC va en la línea «N de M · %»: al lado del
  // nombre aplastaba el código y la fecha y pisaba «Todas / Tengo / Faltan».
  check('el chip dice «Edición japonesa · Super Electric Breaker» y vive en la línea del progreso', !c.oculto && /Edición japonesa · Super Electric Breaker/.test(c.texto) && /mc-avance-linea/.test(c.padre) && c.enPantalla, JSON.stringify(c))
  const meta = await page.evaluate(() => { const m = document.getElementById('mcAlbumMeta'); return m && !m.classList.contains('hidden') ? Math.round(m.getBoundingClientRect().height) : null })
  check('  …y el código y la fecha del set siguen en un renglón', meta === null || meta < 24, String(meta))
  check('  …y lleva a esa expansión en el catálogo japonés', /ver=album&set=SV8&catalogo=JP/.test(c.href || ''), c.href)
  // El ⋯ ya no la repite (1053, PINGU: quitar lo que está a la vista).
  check('  …y el menú ⋯ ya no la repite', !c.menu, c.menu)
  await page.click('#mcAlbumGemela a.mc-gemela')
  await page.waitForTimeout(2500)
  const despues = await page.evaluate(() => ({ url: location.search, titulo: document.getElementById('mcAlbumTitulo')?.textContent, chip: document.querySelector('#mcAlbumGemela .mc-gemela')?.textContent.replace(/\s+/g, ' ').trim() }))
  check('al pulsarlo se abre la japonesa, y ahí el chip dice «Edición occidental · Chispas Fulgurantes»', /catalogo=JP/.test(despues.url) && despues.titulo === 'Super Electric Breaker' && /Edición occidental · Chispas Fulgurantes/.test(despues.chip || ''), JSON.stringify(despues))
  await ctx.close()
}

console.log('\n── 2. PC: tres gemelas, en un desplegable; y sin gemela, nada ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv2')
  const c = await chip(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('Evoluciones en Paldea: «Ediciones japonesas · 3»', !c.oculto && /Ediciones japonesas · 3/.test(c.texto), JSON.stringify(c))
  await page.click('#mcAlbumGemela summary.mc-gemela')
  await page.waitForTimeout(300)
  const lista = await page.evaluate(() => [...document.querySelectorAll('#mcAlbumGemela .mc-menu a')].map((a) => `${a.textContent.trim()}→${a.getAttribute('href')}`))
  check('  …abierto, las tres con su enlace', lista.length === 3 && lista.some((x) => /^Triplet Beat→.*set=SV1a&catalogo=JP/.test(x)) && lista.some((x) => /^Clay Burst→/.test(x)), lista.join(' | '))
  check('  …y el menú ⋯ ya no la repite', !c.menu, c.menu)
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  const sin = await chip(page)
  check('Escarlata y Púrpura, sin gemela: ni chip ni entrada en el menú', sin.oculto && sin.menu === null, JSON.stringify(sin))
  await ctx.close()
}

console.log('\n── 3. iPhone: el mismo chip, en la línea del progreso ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv8', { movil: true })
  const c = await chip(page)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el chip está en la línea «N de M · %», a la vista y sin salirse', !c.oculto && /mc-avance-linea/.test(c.padre) && c.enPantalla, JSON.stringify(c))
  const linea = await page.evaluate(() => { const l = document.querySelector('#mcAlbumProgreso .mc-avance-linea'); const b = l.querySelector('b').getBoundingClientRect(); const i = l.querySelector('.mc-gemela i'); return { cifraEnUnRenglon: b.height < 30, sinNombre: !i || getComputedStyle(i).display === 'none', texto: l.querySelector('.mc-gemela').textContent.replace(/\s+/g, ' ').trim() } })
  check('  …dice solo «Edición japonesa» (sin el nombre) y «1 de 6» sigue en un renglón', linea.sinNombre && linea.cifraEnUnRenglon, JSON.stringify(linea))
  check('  …mide 44 px con el dedo (312)', c.alto >= 44, String(c.alto))
  check('  …y es el mismo elemento (uno solo en la página)', (await page.evaluate(() => document.querySelectorAll('.mc-gemela').length)) === 1)
  const titulo = await page.evaluate(() => { const t = document.getElementById('mcAlbumTitulo').getBoundingClientRect(); const b = document.querySelector('#mcAlbumMenu summary').getBoundingClientRect(); return { fila: Math.abs((t.top + t.height / 2) - (b.top + b.height / 2)) < 12, titulo: document.getElementById('mcAlbumTitulo').textContent } })
  check('  …y la cabecera sigue siendo una línea (893)', titulo.fila, JSON.stringify(titulo))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
