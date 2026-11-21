// Tanda 1409 — «Presume de página» (PINGU, de las siete ideas: «presume tu
// página, sí»). En el ⋯ de un álbum tuyo, «Compartir la página» abre la hoja de
// compartir con una imagen de la página: sus cartas en su bolsillo, los huecos
// como huecos y debajo sus tres colores (los de «Sugerir»).
//   · Lo puro: el título con la palabra clave, el texto, que la hoja quepa en
//     la caja en las tres formas, y qué páginas se enseñan.
//   · En un álbum tuyo con cartas sale; en uno vacío, no.
//   · La imagen se dibuja (Publicación, Historia y X) y lleva los azules de la
//     página; en el PC con dos páginas llenas se elige cuál.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
// 1-12 azules (la página y alguna más), 13-16 rojas, 17-20 verdes, 21-24 azules.
const COLOR = (n) => (n <= 12 || n > 20 ? ['#2f6fb3', '#4a90d9', '#7fb8e8', '#1d4f86'][n % 4] : n <= 16 ? ['#c62828', '#e0521f', '#a3201b', '#d84315'][n % 4] : ['#2e7d32', '#55a630', '#1b5e20', '#7cb342'][n % 4])
const ES_AZUL = (n) => n <= 12 || n > 20
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="${COLOR(n)}"/><stop offset="1" stop-color="${COLOR(n + 1)}"/></linearGradient></defs><rect width="245" height="342" fill="url(#g)"/><circle cx="122" cy="140" r="${40 + (n % 5) * 6}" fill="#ffffff" fill-opacity="0.35"/></svg>`
const N = 24
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Illustration Rare', category: 'Pokemon', types: [ES_AZUL(i + 1) ? 'Water' : 'Fire'], variants: { holo: true } }))
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-11-01T10:00:00Z' }))
// Página 1: azules con el centro vacío (bolsillo 5). Página 2 vacía.
const PAGINA = [1, 2, 3, 4, null, 5, 6, 7, 8]
const ALBUMES = [
  { id: 'alb-agua', user_id: 'admin-1', nombre: 'Agua y cielo', tipo: 'binder', rejilla: '3x3', paginas: 4, tapa: 'azul', is_public: false, cartas: PAGINA.map((n) => (n ? { id: `sv8-${n}` } : {})), updated_at: '2026-11-20T10:00:00Z' },
  // Dos páginas llenas: en el PC se ven las dos y se elige cuál.
  { id: 'alb-dos', user_id: 'admin-1', nombre: 'Fuego', tipo: 'binder', rejilla: '3x3', paginas: 2, tapa: 'roja', is_public: false, cartas: [13, 14, 15, 16, 13, 14, 15, 16, 13, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => ({ id: `sv8-${n}` })), updated_at: '2026-11-19T10:00:00Z' },
  { id: 'alb-vacio', user_id: 'admin-1', nombre: 'Vacío', tipo: 'binder', rejilla: '3x3', paginas: 2, tapa: 'azul', is_public: false, cartas: [], updated_at: '2026-11-18T10:00:00Z' },
]

const browser = await chromium.launch()
async function abrir(album, { movil = false, tema = 'light' } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', colorScheme: tema, serviceWorkers: 'block' } : { viewport: { width: 1440, height: 1000 }, locale: 'es-ES', colorScheme: tema, serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, ALBUMES, COLECCION, tema }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS; window.__FAKE_CARTAS__ = CARTAS; window.__FAKE_COLECCION__ = COLECCION; window.__FAKE_ALBUMES__ = ALBUMES
    try { localStorage.setItem('pokedoc-theme', tema); localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.removeItem('pd-armonia-v1') } catch {}
  }, { SETS, CARTAS, ALBUMES, COLECCION, tema })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|pokemontcg|scrydex/, (r) => {
    const n = Number((r.request().url().match(/sv8\/(\d+)/) || [])[1] || 1)
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: svg(n) })
  })
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=carpetas&album=${album}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbArchivador .mc-hoja', { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1200)
  return { ctx, page, errores }
}

const azulada = (page) => page.evaluate(async () => {
  const img = document.querySelector('#chPrevia img.ch-imagen')
  if (!img) return null
  await img.decode().catch(() => {})
  const c = document.createElement('canvas')
  c.width = img.naturalWidth; c.height = img.naturalHeight
  const x = c.getContext('2d'); x.drawImage(img, 0, 0)
  const d = x.getImageData(0, 0, c.width, c.height).data
  let azul = 0, rojo = 0, n = 0
  for (let i = 0; i < d.length; i += 4 * 37) { n++; const [r, g, b] = [d[i], d[i + 1], d[i + 2]]; if (b > 150 && b > r + 60) azul++; if (r > 150 && r > b + 80 && r > g + 40) rojo++ }
  return { w: c.width, h: c.height, azul: azul / n, rojo: rojo / n }
})

console.log('\n── Lo puro ──')
{
  const { page, ctx, errores } = await abrir('alb-agua')
  const r = await page.evaluate(async () => {
    const m = await import('/js/mi-coleccion/imagen-pagina.js')
    const caja = { x: 72, y: 300, w: 936, h: 760 }
    const cabe = (k, caja2 = caja) => k.hoja.x >= caja2.x - 0.5 && k.hoja.x + k.hoja.w <= caja2.x + caja2.w + 0.5 && k.hoja.y >= caja2.y - 0.5 && k.tira.y + k.tira.h <= caja2.y + caja2.h + 0.5
    return {
      t1: m.tituloDePagina('Agua y cielo'), t2: m.tituloDePagina('Fuego'), t3: m.tituloDePagina(''),
      texto: m.textoDePagina({ nombre: 'Agua y cielo', pagina: 3, nombres: ['Marill', 'Wartortle'] }),
      cabe33: cabe(m.medidasDeHoja(caja, { columnas: 3, filas: 3 })),
      cabe44: cabe(m.medidasDeHoja(caja, { columnas: 4, filas: 4 })),
      cabe22: cabe(m.medidasDeHoja(caja, { columnas: 2, filas: 2 })),
      cabeX: cabe(m.medidasDeHoja({ x: 640, y: 120, w: 504, h: 450 }, { columnas: 3, filas: 3, apaisada: true }), { x: 640, y: 120, w: 504, h: 450 }),
      paginas: m.paginasParaEnsenar([{ id: 'a' }, null, null, null, null], 2, [0, 1, 2]),
    }
  })
  check('el título lleva su palabra clave en el color', r.t1 === 'Agua y *cielo*' && r.t2 === '*Fuego*' && r.t3 === '*álbum*'.replace('*álbum*', 'Mi *álbum*'), JSON.stringify([r.t1, r.t2, r.t3]))
  check('el texto dice el álbum, la página, las cartas y la web', /«Agua y cielo» \(pág\. 3\)/.test(r.texto) && /· Marill/.test(r.texto) && /pokedoc\.es$/.test(r.texto), r.texto)
  check('la hoja y la tira caben en la caja (3×3, 4×4, 2×2 y la de X)', r.cabe33 && r.cabe44 && r.cabe22 && r.cabeX, JSON.stringify(r))
  check('solo se enseñan las páginas que se ven Y tienen cartas', JSON.stringify(r.paginas) === '[0]', JSON.stringify(r.paginas))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

for (const [nombre, opts] of [['PC claro', {}], ['móvil oscuro', { movil: true, tema: 'dark' }]]) {
  console.log(`\n── ${nombre} ──`)
  const { page, ctx, errores } = await abrir('alb-agua', opts)
  await page.click('#mcAlbMenu summary')
  const ve = await page.evaluate(() => !document.getElementById('mcAlbPagina').classList.contains('hidden'))
  check('⋯: «Compartir la página» en tu álbum con cartas', ve)
  await page.click('#mcAlbPagina')
  await page.waitForSelector('#chPrevia img.ch-imagen', { timeout: 20000 }).catch(() => {})
  check('abre la hoja de compartir', await page.evaluate(() => /Compartir la página/.test(document.querySelector('.ch-titulo')?.textContent || '')))
  await page.click('[data-ch-forma="publicacion"]')
  await page.waitForTimeout(800)
  let a = await azulada(page)
  check('la publicación se dibuja (1080×1350)', a && a.w === 1080 && a.h === 1350, JSON.stringify(a))
  check('  …con las cartas azules de la página', a && a.azul > 0.12, JSON.stringify(a))
  check('  …y sin las rojas, que no están en ella', a && a.rojo < 0.01, JSON.stringify(a))
  await page.click('[data-ch-forma="historia"]').catch(() => {})
  await page.waitForTimeout(800)
  a = await azulada(page)
  check('la historia también (1080×1920)', a && a.w === 1080 && a.h === 1920, JSON.stringify(a))
  await page.click('[data-ch-red="x"]').catch(() => {})
  await page.waitForTimeout(800)
  a = await azulada(page)
  check('y la de X (1200×630)', a && a.w === 1200 && a.h === 630 && a.azul > 0.05, JSON.stringify(a))
  check('una sola página con cartas: sin elegir página', (await page.locator('[data-ch-diseno]').count()) === 0)
  if (!opts.movil) await page.screenshot({ path: '/tmp/1409-hoja-pc.png' })
  else await page.screenshot({ path: '/tmp/1409-hoja-movil.png' })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── Dos páginas llenas en el PC ──')
{
  const { page, ctx, errores } = await abrir('alb-dos')
  await page.click('#mcAlbMenu summary')
  await page.click('#mcAlbPagina')
  await page.waitForSelector('#chPrevia img.ch-imagen', { timeout: 20000 }).catch(() => {})
  const disenos = await page.locator('[data-ch-diseno]').allTextContents()
  check('se elige la página', JSON.stringify(disenos) === '["Página 1","Página 2"]', JSON.stringify(disenos))
  let a = await azulada(page)
  check('  …la 1 es la roja', a && a.rojo > 0.1 && a.azul < 0.08, JSON.stringify(a))
  await page.click('[data-ch-diseno="p2"]')
  await page.waitForTimeout(1500)
  a = await azulada(page)
  check('  …y la 2, la azul', a && a.azul > 0.1, JSON.stringify(a))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── Un álbum vacío ──')
{
  const { page, ctx } = await abrir('alb-vacio')
  check('sin cartas, no sale', await page.evaluate(() => document.getElementById('mcAlbPagina').classList.contains('hidden')))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n    ❌ ${fails} FALLAN` : '\n    ✅ todo en verde')
process.exit(fails ? 1 : 0)
