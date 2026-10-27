// Tandas 1034, 1035 y 1036 — el móvil compacto que pidió PINGU con su
// captura de La quiero: sin selector de catálogo (busca en los dos), sin el
// título «Deseos y cambios», las vistas y «Evento» en una fila, los botones
// en una fila, las cartas antes de media pantalla; Expansiones con el
// catálogo en la fila de la lupa; /buscar, /evento y /repeticiones sin
// botones apilados; y la sección «Colección» en vez de «Cartas».
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Desde la 1057 el buscador de «La quiero» sale con el «+» en el móvil.
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const N = ['Pikachu ex', 'Charizard ex', 'Eevee', 'Snorlax', 'Gengar ex', 'Lapras']
const carta = (set, market, i) => ({ id: `${set}-${i + 1}`, market, set_id: set, local_id: String(i + 1), name: N[i], name_es: N[i], image_path: `sv/${set}/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } })
const CARTAS = [...N.map((_, i) => carta('sv8', 'WEST', i)), ...N.slice(0, 3).map((_, i) => carta('SV8', 'JP', i))]
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', tcg_online_code: 'SSP', card_count_official: 6, card_count_total: 6, release_date: '2024-11-08' }, { id: 'SV8', name: 'Super Electric Breaker', serie_id: 'SV', market: 'JP', card_count_official: 6, card_count_total: 6, release_date: '2024-10-18' }]
const DESEOS = CARTAS.slice(0, 4).map((c, i) => ({ id: `d${i}`, user_id: 'admin-1', card_id: c.id, idioma: null, created_at: `2026-10-2${i}T10:00:00Z` }))

const b = await chromium.launch()
async function abrir(ruta, { movil = true } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1366, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_DESEOS__: d.DESEOS, __FAKE_COLECCION__: [], __FAKE_PRECIOS__: [] })
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('pokedoc-onboarding', '1') } catch {}
  }, { SETS, CARTAS, DESEOS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitless|jsdelivr|githubusercontent/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { ctx, page, errores }
}
// Las filas distintas que ocupan los hijos visibles de una caja.
const filas = (page, sel) => page.evaluate((sel) => { const c = document.querySelector(sel); if (!c) return null; const hs = [...c.children].filter((h) => h.getBoundingClientRect().width > 2); return { n: hs.length, filas: new Set(hs.map((h) => { const r = h.getBoundingClientRect(); return Math.round((r.top + r.height / 2) / 16) })).size, textos: hs.map((h) => h.innerText.trim()) } }, sel)

console.log('── 1. iPhone · La quiero ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero')
  check('sin errores', errores.length === 0, errores.join(' | '))
  const t = await page.evaluate(() => { const h = document.querySelector('#mcPanelQuiero .mc-deseos-cabeza .mc-subtitulo'); return { existe: Boolean(h), alto: Math.round(h.getBoundingClientRect().height) } })
  check('el título «Deseos y cambios» no ocupa sitio (queda para el lector)', t.existe && t.alto <= 1, JSON.stringify(t))
  check('ni rastro del selector «Pokémon / Pokémon Japón» del buscador', (await page.locator('#mcPanelQuiero [data-deseo-mercado], #mcPanelQuiero .mc-deseo-catalogo').count()) === 0)
  const cab = await filas(page, '#mcPanelQuiero .mc-deseos-cabeza')
  // Desde la 1041 Evento flota abajo (test-tanda-1041-pantalla.mjs): en la
  // fila de arriba quedan solo las vistas.
  const flota = await page.evaluate(() => getComputedStyle(document.querySelector('#mcPanelQuiero .mc-evento-boton')).position)
  check('las vistas en UNA fila y «Evento» flotando aparte (1041)', cab.textos.filter(Boolean).length === 1 && flota === 'fixed', JSON.stringify({ ...cab, flota }))
  // Desde la 1057 la cabecera es UNA barra: lista, «+», Seleccionar y ⋯.
  const bot = await page.evaluate(() => { const c = document.getElementById('mcQuieroBarra'); const hs = [...c.querySelectorAll('#mcQuieroLista, #mcQuieroMas, #mcQuieroSeleccionar, #mcQuieroMenu')]; return { filas: new Set(hs.map((h) => { const r = h.getBoundingClientRect(); return Math.round((r.top + r.height / 2) / 16) })).size, n: hs.length } })
  check('la barra (lista · + · Seleccionar · ⋯) en UNA fila', bot.filas === 1 && bot.n === 4, JSON.stringify(bot))
  const y = await page.evaluate(() => Math.round(document.querySelector('#mcQuieroRejilla .mc-deseo-baldosa').getBoundingClientRect().top / innerHeight * 100))
  check('la primera carta empieza antes de media pantalla', y < 50, `${y} %`)
  if (!(await page.isVisible('#mcDeseoBuscar'))) await page.click('#mcQuieroMas')
  await page.fill('#mcDeseoBuscar', 'pikachu')
  await page.waitForTimeout(1500)
  const r = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#mcDeseoResultados [data-desear]')].map((x) => x.dataset.desear), rotulos: [...document.querySelectorAll('#mcDeseoResultados .mc-deseo-rotulo')].map((x) => [...x.children].map((c) => c.textContent.trim()).filter(Boolean).join(' ')) }))
  check('apuntar busca en los dos catálogos: la occidental y debajo la japonesa, con su rótulo', r.ids.join() === 'sv8-1,SV8-1' && r.rotulos.join('|') === 'Pokémon 1|Pokémon Japón 1', JSON.stringify(r))
  await ctx.close()
}

console.log('\n── 2. iPhone · Expansiones, /buscar, /evento y /repeticiones ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album')
  const e = await page.evaluate(() => {
    const cab = document.querySelector('.mc-estanteria-cabeza')
    const hs = [...cab.children].filter((h) => h.getBoundingClientRect().width > 2)
    return { filas: new Set(hs.map((h) => { const r = h.getBoundingClientRect(); return Math.round((r.top + r.height / 2) / 16) })).size, catalogo: Boolean(cab.querySelector('.seg [data-vista]')), textos: [...cab.querySelectorAll('.seg-btn')].map((x) => x.innerText.trim()), fila2: getComputedStyle(document.querySelector('.mc-estanteria-fila2')).display, ancho: document.documentElement.scrollWidth <= innerWidth }
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('Expansiones: catálogo («Pokémon · Japón»), lupa y Orden en UNA fila, sin título ni fila de la cuenta', e.catalogo && e.filas === 1 && e.textos.join('|') === 'Pokémon|Japón' && e.fila2 === 'none' && e.ancho, JSON.stringify(e))
  await page.goto(`${BASE}/buscar.html?q=pikachu`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const bs = await page.evaluate(() => { const c = document.getElementById('bsChips'); const hs = [...c.children]; return { filas: new Set(hs.map((h) => { const r = h.getBoundingClientRect(); return Math.round((r.top + r.height / 2) / 16) })).size, desliza: c.scrollWidth > c.clientWidth, titulo: Math.round(document.querySelector('.bs-titulo').getBoundingClientRect().height), ancho: document.documentElement.scrollWidth <= innerWidth } })
  check('/buscar: los filtros en UNA fila que se desliza y sin el «Buscar» grande', bs.filas === 1 && bs.titulo <= 1 && bs.ancho, JSON.stringify(bs))
  await page.goto(`${BASE}/evento.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#eventoListas:not(.hidden)', { timeout: 8000 }).catch(() => {})
  const ev = await filas(page, '.evento-botones')
  // Desde la 1042 en el móvil son tres iconos en grupo (el nombre va en aria-label).
  const nombres = await page.evaluate(() => [...document.querySelectorAll('.evento-botones button')].map((b) => b.getAttribute('aria-label')))
  check('/evento: Copiar · Imagen · CSV en UNA fila', ev?.filas === 1 && nombres.join('|') === 'Copiar lista|Imagen|Exportar CSV', JSON.stringify({ ev, nombres }))
  await page.goto(`${BASE}/repeticiones.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const rep = await filas(page, '.rep-pegar-botones')
  check('/repeticiones: sus botones en UNA fila', rep?.filas === 1 && rep.textos.includes('Ejemplo'), JSON.stringify(rep))
  await ctx.close()
}

console.log('\n── 3. PC: lo largo se queda; la sección es «Colección» ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero', { movil: false })
  const pc = await page.evaluate(() => ({ botones: [...document.querySelectorAll('.mc-quiero-botones button')].map((x) => x.innerText.trim()), evento: document.querySelector('#mcPanelQuiero .mc-evento-boton').innerText.trim(), titulo: document.querySelector('.mc-estanteria-h')?.textContent }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('en el PC el texto entero: «Modo evento» (Compartir y Álbum van en el ⋯ desde la 1057)', pc.evento === 'Modo evento', JSON.stringify(pc))
  await ctx.close()
  const html = readFileSync(`${RAIZ}/index.html`, 'utf8')
  check('la barra de abajo dice «Colección» y no «Cartas»', /<span>Colección<\/span>/.test(html) && !/<nav class="bm"[\s\S]*?<span>Cartas<\/span>[\s\S]*?<\/nav>/.test(html))
  check('y el color sigue colgando de data-seccion="cartas"', /<html[^>]*data-seccion="cartas"/.test(readFileSync(`${RAIZ}/mi-coleccion.html`, 'utf8')))
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
