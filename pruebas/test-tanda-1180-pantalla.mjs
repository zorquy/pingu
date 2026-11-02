// Tanda 1180 — en TUS ÁLBUMES lo que falta va en color (PINGU: «para hacer
// álbumes queda feo» el gris). Lo que tienes, en color y con su ✓; lo que no,
// en color, sin ✓ y con su «+». En la vista Archivador de una EXPANSIÓN lo que
// falta sigue en gris: ahí el gris dice qué te falta del set.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let FOTOS = []
const browser = await chromium.launch()
const N = 30
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, logo_tcggo: 'https://images.tcggo.com/logo-sv8.png' }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }))
// Un binder de 3×3 y 6 páginas: 14 cartas, con huecos, y una de portada.
const EN_BINDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null, 12, 13, 14, null, 16]
const ALBUMES = [
  { id: 'alb-bin', user_id: 'admin-1', nombre: 'BW/XY', descripcion: 'Las Full Art', tipo: 'binder', rejilla: '3x3', paginas: 6, tapa: 'azul', portada: 'sv8-4', is_public: false, cartas: EN_BINDER.map((n) => (n ? { id: `sv8-${n}` } : {})), updated_at: '2026-10-05T10:00:00Z' },
  { id: 'alb-set', user_id: 'admin-1', nombre: 'Chispas Fulgurantes', tipo: 'set', set_id: 'sv8', set_market: 'WEST', set_modo: 'entero', rejilla: '3x3', cartas: CARTAS.map((c) => ({ id: c.id })), updated_at: '2026-10-04T10:00:00Z' },
]
const COLECCION = [1, 2, 4, 5, 7, 12].map((n, i) => ({ id: `l${n}`, card_id: `sv8-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: `2026-10-0${(i % 8) + 1}T10:00:00Z` }))

async function abrir(url, { movil = false, ancho = 1280, vistaAlbum = null } = {}) {
  // Sin service worker: lo que él pide no pasa por `route` (897) y las fotos
  // de mentira no llegarían.
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' } : { viewport: { width: ancho, height: 1000 }, locale: 'es-ES', colorScheme: 'dark', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, ALBUMES, COLECCION, vistaAlbum }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = COLECCION
    window.__FAKE_ALBUMES__ = ALBUMES
    window.__FAKE_DESEOS__ = [{ id: 'd1', user_id: 'admin-1', card_id: 'sv8-3', idioma: null, created_at: '2026-10-01T10:00:00Z' }]
    try { localStorage.setItem('pokedoc-theme', 'dark'); if (vistaAlbum) localStorage.setItem('mc-album-vista', vistaAlbum) } catch {}
  }, { SETS, CARTAS, ALBUMES, COLECCION, vistaAlbum })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => {
    const url = r.request().url()
    if (/logo/.test(url)) return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="12" fill="#f2b632"/></svg>' })
    const n = Number((url.match(/sv8\/(\d+)/) || [])[1] || 0)
    if (FOTOS.length) return r.fulfill({ status: 200, contentType: 'image/jpeg', body: FOTOS[n % FOTOS.length] })
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' })
  })
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${url}`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbArchivador .mc-hoja, .mc-exp-archivador .mc-hoja', { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(900)
  return { ctx, page, errores }
}

// Cómo va pintada cada carta: su filtro, su opacidad, si lleva ✓ y si lleva «+».
const medir = (page, raiz) => page.evaluate((raiz) => [...document.querySelectorAll(`${raiz} .mc-bolsillo:not(.mc-bolsillo-vacio):not(.mc-bolsillo-hueco)`)]
  .filter((b) => b.querySelector('img'))
  .map((b) => {
    const cs = getComputedStyle(b.querySelector('img'))
    return { tengo: b.classList.contains('tengo'), filtro: cs.filter, opacidad: cs.opacity, check: !!b.querySelector('.mc-tengo-marca'), mas: !!b.querySelector('.mc-mas, [data-mas], .mc-bolsillo-mas') }
  }), raiz)

for (const tema of ['dark', 'light']) {
  console.log(`\n── En un álbum tuyo (${tema}) ──`)
  for (const id of ['alb-set', 'alb-bin']) {
    const { ctx, page, errores } = await abrir(`/mi-coleccion.html?ver=carpetas&album=${id}`)
    if (tema === 'light') { await page.evaluate(() => { document.documentElement.dataset.theme = 'light' }); await page.waitForTimeout(200) }
    const m = await medir(page, '#mcAlbArchivador')
    const faltan = m.filter((x) => !x.tengo), tengo = m.filter((x) => x.tengo)
    check(`[${id}] hay de las dos`, faltan.length > 0 && tengo.length > 0, `${tengo.length} tengo, ${faltan.length} faltan`)
    check(`[${id}] lo que falta va en color, sin gris ni transparencia`, faltan.every((x) => x.filtro === 'none' && x.opacidad === '1'), JSON.stringify(faltan[0]))
    check(`[${id}]   …sin ✓ y con su «+»`, faltan.every((x) => !x.check && x.mas), JSON.stringify(faltan[0]))
    check(`[${id}] lo que tienes, en color y con su ✓`, tengo.every((x) => x.filtro === 'none' && x.opacidad === '1' && x.check), JSON.stringify(tengo[0]))
    check(`[${id}] sin errores`, errores.length === 0, errores.join(' | '))
    await ctx.close()
  }
}

console.log('\n── En una expansión (Archivador), lo que falta sigue en gris ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=album&set=sv8', { vistaAlbum: 'archivador' })
  const m = await medir(page, '#mcAlbum')
  const faltan = m.filter((x) => !x.tengo)
  check('hay cartas que faltan', faltan.length > 0, String(m.length))
  check('  …y van en gris', faltan.every((x) => /grayscale|saturate/.test(x.filtro)), JSON.stringify(faltan[0]))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
