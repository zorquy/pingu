// Tanda 755 — el logo de una expansión no se sale de su caja.
//
// PINGU: «algún logo de expansión se desborda y se queda por encima del
// nombre; debería ir por detrás». Un logo CUADRADO (la estrella de las
// promos) con `height: 100%` en una caja de rejilla salía a 160×160 en la
// baldosa del escritorio y tapaba el nombre. Lo que se mira, en escritorio
// (baldosas) y en móvil (lista): el logo cabe en su caja, la caja no pisa
// el nombre y el nombre va por encima.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()
const ESTRELLA = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 100 100"><polygon points="50,2 61,38 98,38 68,60 79,96 50,74 21,96 32,60 2,38 39,38" fill="#000"/></svg>'
const ANCHO = '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="96"><rect width="240" height="96" fill="#d4471c"/></svg>'

async function medir(opciones) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [
      { id: 'mep', name: 'MEP Black Star Promos', serie_id: 'me', market: 'WEST', card_count_official: 11, release_date: '2025-09-26', tcg_online_code: 'MEP', logo_tcggo: 'https://images.tcggo.com/promo.png' },
      { id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 4, release_date: '2023-08-11', tcg_online_code: 'OBF', logo_tcggo: 'https://images.tcggo.com/obf.png' },
    ]
    window.__FAKE_CARTAS__ = [{ id: 'sv3-1', set_id: 'sv3', market: 'WEST', local_id: '1', name: 'A', image_path: 'x/1' }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'sv3-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal' }]
  })
  await ctx.route(/images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: r.request().url().includes('promo') ? ESTRELLA : ANCHO }))
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => [...document.querySelectorAll('.mc-set-fila .mc-set-marca img')].some((i) => i.complete && i.naturalWidth), null, { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(300)
  const filas = await page.evaluate(() => [...document.querySelectorAll('.mc-set-fila')].map((f) => {
    const marca = f.querySelector('.mc-set-marca')
    const img = marca?.querySelector('img')
    const info = f.querySelector('.mc-set-info')
    const r = (e) => (e ? e.getBoundingClientRect().toJSON() : null)
    return { set: f.dataset.set, marca: r(marca), img: r(img), info: r(info), zInfo: info ? getComputedStyle(info).zIndex : null, cargada: Boolean(img?.complete && img.naturalWidth) }
  }))
  await ctx.close()
  return filas
}

const dentro = (a, b) => a && b && a.left >= b.left - 0.5 && a.right <= b.right + 0.5 && a.top >= b.top - 0.5 && a.bottom <= b.bottom + 0.5
const pisa = (a, b) => a && b && a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5

for (const [nombre, opciones] of [['escritorio', { viewport: { width: 1280, height: 900 } }], ['móvil', { ...devices['iPhone 13'] }]]) {
  console.log(`── ${nombre} ──`)
  const filas = await medir(opciones)
  const promo = filas.find((f) => f.set === 'mep')
  check('la fila de las promos sale y su logo (cuadrado) ha cargado', promo?.cargada, JSON.stringify(filas).slice(0, 300))
  for (const f of filas.filter((x) => x.img)) {
    check(`  ${f.set}: el logo cabe en su caja`, dentro(f.img, f.marca), JSON.stringify({ img: f.img, marca: f.marca }))
    check(`  ${f.set}: la caja del logo no pisa el nombre`, !pisa(f.marca, f.info), JSON.stringify({ marca: f.marca, info: f.info }))
  }
  check('  el nombre va por encima (z-index propio)', filas.every((f) => !f.info || f.zInfo === '1'), JSON.stringify(filas.map((f) => f.zInfo)))
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
