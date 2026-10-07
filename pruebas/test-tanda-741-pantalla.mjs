// Tanda 741 — arrastrar cartas de la rejilla a un álbum de la barra lateral
// (X13 de la lista de propuestas, elegidas por PINGU).
//
// Lo que se mira: la lista pura (primer nivel y sus hijas, con su cuenta y
// un tope); y a 1.680 con ratón: tus álbumes cuelgan del menú de Mi
// colección en la lateral; las cartas de la rejilla se pueden arrastrar;
// soltar una encima de un álbum la mete (una escritura en
// `collection_folder_cards`, con esa línea y ese álbum) y lo dice; pulsar un
// álbum lo abre; y en el móvil las cartas NO son arrastrables (la
// pulsación larga es de la selección múltiple, 713).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { albumesDeLaLateral } = await import(`${RAIZ}/js/mi-coleccion/arrastrar-a-album.js`)

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. La lista ──')
{
  const arbol = [{ id: 'a', nombre: 'Favoritas', hijas: [{ id: 'a1', nombre: 'Charizard', hijas: [{ id: 'a11', nombre: 'Nieta', hijas: [] }] }] }, { id: 'b', nombre: 'Para cambiar', hijas: [] }]
  const l = albumesDeLaLateral(arbol, new Map([['a', { cartas: 3 }]]))
  check('primer nivel y sus hijas, en orden, sin las nietas', JSON.stringify(l.map((x) => `${x.nivel}:${x.id}`)) === JSON.stringify(['0:a', '1:a1', '0:b']), JSON.stringify(l))
  check('con su cuenta, y sin cifra si no se sabe', l[0].cartas === 3 && l[1].cartas === null)
  check('con tope', albumesDeLaLateral(Array.from({ length: 30 }, (_, i) => ({ id: `x${i}`, nombre: `A${i}`, hijas: [] }))).length === 12)
}

const browser = await chromium.launch()
const semilla = () => {
  window.__FAKE_SESSION__ = 'user-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST' }]
  window.__FAKE_CARTAS__ = Array.from({ length: 12 }, (_, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i}`, rarity: 'Common', category: 'Pokemon', dex_ids: [i + 1], tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
  window.__FAKE_COLECCION__ = Array.from({ length: 12 }, (_, i) => ({ id: `l${i}`, user_id: 'user-1', card_id: `xy5-${i + 1}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
  window.__FAKE_CARPETAS__ = [
    { id: 'f1', user_id: 'user-1', nombre: 'Favoritas', parent_id: null, orden: 0, created_at: '2026-10-01T10:00:00Z' },
    { id: 'f2', user_id: 'user-1', nombre: 'Para cambiar', parent_id: null, orden: 1, created_at: '2026-10-01T10:00:00Z' },
  ]
}
async function abrir(opciones = { viewport: { width: 1680, height: 1000 } }) {
  const ctx = await browser.newContext({ locale: 'es-ES', ...opciones })
  await ctx.addInitScript(semilla)
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { page, ctx, errores }
}

console.log('── 2. En el ordenador ──')
{
  const { page, ctx, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  const albumes = await page.$$eval('.lat #mcLatAlbumes .lat-album span', (s) => s.map((x) => x.textContent))
  check('tus álbumes, en la barra lateral, detrás del menú de Mi colección', JSON.stringify(albumes) === JSON.stringify(['Favoritas', 'Para cambiar']) && (await page.evaluate(() => document.getElementById('mcMenu').nextElementSibling?.id === 'mcLatAlbumes')), JSON.stringify(albumes))
  check('las cartas de la rejilla se pueden arrastrar', await page.$$eval('#mcCartas .mc-carta', (as) => as.length === 12 && as.every((a) => a.draggable)))
  await page.dragAndDrop('#mcCartas .mc-carta >> nth=3', '.lat-album[data-carpeta-destino="f2"]')
  await page.waitForTimeout(1200)
  const escrituras = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'collection_folder_cards'))
  check('soltar una carta encima de un álbum la mete (esa línea, ese álbum)', escrituras.length === 1 && escrituras[0].filas[0]?.folder_id === 'f2' && escrituras[0].filas[0]?.line_id === 'l3', JSON.stringify(escrituras))
  const aviso = await page.evaluate(() => [...document.querySelectorAll('.toast, [role="status"]')].map((t) => t.textContent).join(' | '))
  check('  …y lo dice', /Dentro de «Para cambiar»/.test(aviso), aviso.slice(0, 200))
  check('  …y la cuenta del álbum sube', (await page.textContent('.lat-album[data-carpeta-destino="f2"]')).includes('1'), await page.textContent('.lat-album[data-carpeta-destino="f2"]'))
  check('al acabar no queda nada marcado', !(await page.evaluate(() => document.documentElement.classList.contains('arrastrando-carta') || !!document.querySelector('.lat-album.sobre'))))
  await page.click('.lat-album[data-carpeta-destino="f1"]')
  await page.waitForTimeout(1200)
  check('pulsar un álbum lo abre', (await page.locator('#mcPanelCarpetas').isVisible()) && /Favoritas/.test(await page.textContent('#mcPanelCarpetas')))
  check('sin errores al final', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. En el móvil, no ──')
{
  const { page, ctx } = await abrir({ ...devices['iPhone 13'] })
  check('las cartas no son arrastrables y no hay álbumes que soltar', (await page.$$eval('#mcCartas .mc-carta', (as) => as.length > 0 && as.every((a) => !a.draggable))) && (await page.locator('#mcLatAlbumes').count()) === 0)
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
