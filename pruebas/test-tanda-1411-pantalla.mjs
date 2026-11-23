// Tanda 1411 — Tus colores y Tus ilustradores (PINGU, de «Dónde va cada
// función»: «1, sí. 2, sí»). En el Panel › Más, dos losetas nuevas:
//   · Tus colores (`?ver=colores`): tus ilustraciones en una pared por color
//     (desde la 1418, en hojas de nueve que casan), tu color y el que menos, un
//     chip por color y «Hazme un álbum con estas» (un binder 3×3 en ese orden).
//     Las cartas que no son de arte no salen.
//   · Tus ilustradores (`?ver=ilustradores`): quién te dibuja la colección, con
//     cuántas suyas tienes y de cuántas hay; «A & B» cuenta para los dos.
//   · «Por colores» en «Empezar un álbum» lleva a Tus colores.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
// 1-6 azules, 7-10 rojas, 11-12 verdes; 13-14 comunes (rojas, no salen).
const COLOR = (n) => (n <= 6 ? '#2f6fb3' : n <= 10 || n >= 13 ? '#c62828' : '#2e7d32')
const svg = (n) => `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="${COLOR(n)}"/><circle cx="122" cy="140" r="50" fill="${COLOR(n)}" fill-opacity="0.8"/></svg>`
const N = 14
const FIRMA = (n) => (n <= 5 ? 'Mitsuhiro Arita' : n <= 8 ? 'Ryota Murayama' : n === 9 ? 'Mitsuhiro Arita & Ryota Murayama' : 'Akira Komayama')
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Chispa ${i + 1}`, name_es: `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: i + 1 >= 13 ? 'Common' : 'Illustration Rare', illustrator: FIRMA(i + 1), category: 'Pokemon', types: ['Water'], variants: { holo: true } }))
// Y en el catálogo, cartas de Arita que no tienes (para el «de N»).
const OTRAS = Array.from({ length: 6 }, (_, i) => ({ id: `sv7-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(100 + i), name: `Otra ${i}`, name_es: `Otra ${i}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Common', illustrator: 'Mitsuhiro Arita', category: 'Pokemon' }))
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-11-01T10:00:00Z' }))

const browser = await chromium.launch()
async function abrir(ver, { movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1440, height: 1000 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, COLECCION }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS; window.__FAKE_CARTAS__ = CARTAS; window.__FAKE_COLECCION__ = COLECCION; window.__FAKE_ALBUMES__ = []
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.removeItem('pd-armonia-v1') } catch {}
  }, { SETS, CARTAS: [...CARTAS, ...OTRAS], COLECCION })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|pokemontcg|scrydex/, (r) => {
    const n = Number((r.request().url().match(/sv8\/(\d+)/) || [])[1] || 1)
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: svg(n) })
  })
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  // La transición entre páginas del navegador de pruebas (como en la 1260) no es de esta tanda.
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.goto(`${BASE}/mi-coleccion.html${ver ? `?ver=${ver}` : ''}`, { waitUntil: 'domcontentloaded' })
  return { ctx, page, errores }
}

console.log('\n── Lo puro ──')
{
  const { page, ctx } = await abrir('')
  await page.waitForTimeout(800)
  const r = await page.evaluate(async () => {
    const c = await import('/js/mi-coleccion/tus-colores.js')
    const il = await import('/js/mi-coleccion/tus-ilustradores.js')
    // Desde la 1418 la pared son hojas (test-tanda-1418); aquí, los grupos.
    const f = (color) => ({ color, hex: '#000' })
    const grupos = c.gruposDe([f('oscuras'), f('azul'), f('rojo'), f('multicolor'), f('rojo'), f('verde')])
    const porIl = il.porIlustrador([{ id: 'a', illustrator: 'Arita' }, { id: 'b', illustrator: 'Arita & Komayama' }, { id: 'c', illustrator: 'Komayama' }, { id: 'd', illustrator: 'Komayama' }, { id: 'e' }])
    return {
      grupos: grupos.map((g) => `${g.color}:${g.n}`).join(','),
      resumen: c.resumenDe([{ color: 'rojo', n: 5 }, { color: 'azul', n: 2 }, { color: 'multicolor', n: 9 }], 16),
      arte: [c.esDeArte({ rarity: 'Special Illustration Rare' }), c.esDeArte({ rarity: 'Common' }), c.esDeArte({ rarity: 'Rare Holo' })],
      il: porIl.map((g) => `${g.slug}:${g.cartas.length}`).join(','),
      total: [il.totalVisto(3, 10), il.totalVisto(5, 2), il.totalVisto(3, null)],
    }
  })
  check('los grupos, en orden de rueda y al final los que no son un color', r.grupos === 'rojo:2,verde:1,azul:1,multicolor:1,oscuras:1', r.grupos)
  check('tu color y el que menos, sin contar Multicolor', r.resumen?.mas?.color === 'rojo' && r.resumen.mas.pct === 31 && r.resumen.menos?.color === 'azul', JSON.stringify(r.resumen))
  check('una SIR es de arte; una común o una holo, no', r.arte.join() === 'true,false,false', r.arte.join())
  check('«A & B» cuenta para los dos y sin firma no cuenta', r.il === 'komayama:3,arita:2', r.il)
  check('el total nunca es menos que las tuyas', r.total.join() === '10,5,', r.total.join())
  await ctx.close()
}

console.log('\n── Panel › Más ──')
{
  const { page, ctx, errores } = await abrir('')
  await page.waitForSelector('#mcMas', { timeout: 10000 }).catch(() => {})
  const r = await page.evaluate(() => ({
    colores: !!document.querySelector('#mcMas [data-ir-a="colores"]'),
    ilustradores: !!document.querySelector('#mcMas [data-ir-a="ilustradores"]'),
    textos: [...document.querySelectorAll('#mcMas .mc-accion-loseta')].map((b) => b.textContent.trim()).join(' | '),
  }))
  check('«Tus colores» y «Tus ilustradores» están en Más', r.colores && r.ilustradores, r.textos)
  await page.click('#mcMas [data-ir-a="colores"]')
  await page.waitForSelector('#mcPanelColores .vc-pared a', { timeout: 10000 }).catch(() => {})
  check('la loseta abre Tus colores con su dirección', /ver=colores/.test(page.url()) && await page.isVisible('#mcPanelColores'), page.url())
  check('el Panel sigue marcado en el menú', await page.evaluate(() => document.querySelector('[data-pestania="resumen"]').classList.contains('activa')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── Tus colores ──')
{
  const { page, ctx, errores } = await abrir('colores')
  await page.waitForSelector('#mcPanelColores .vc-pared a', { timeout: 15000 }).catch(() => {})
  const r = await page.evaluate(() => ({
    ids: [...document.querySelectorAll('#mcPanelColores .vc-pared a')].map((a) => a.dataset.carta),
    chips: [...document.querySelectorAll('#mcPanelColores [data-color]')].map((b) => b.textContent.trim()),
    cifras: document.querySelector('#mcPanelColores .vc-cifras')?.textContent.replace(/\s+/g, ' ').trim(),
    titulo: document.querySelector('#mcPanelColores h2, #mcPanelColores h1')?.textContent.trim(),
  }))
  const num = (id) => Number(id.split('-')[1])
  check('salen las 12 ilustraciones y no las comunes', r.ids.length === 12 && !r.ids.some((id) => num(id) >= 13), r.ids.join())
  const pos = (f) => r.ids.findIndex((id) => f(num(id)))
  // 1418: en hojas de nueve; las cuatro rojas van juntas en la misma hoja.
  const hojas = await page.$$eval('#mcPanelColores .vc-hoja', (hs) => hs.map((h) => [...h.querySelectorAll('a')].map((a) => Number(a.dataset.carta.split('-')[1]))))
  check('dos hojas, la de nueve primero', hojas.length === 2 && hojas[0].length === 9 && hojas[1].length === 3, JSON.stringify(hojas))
  check('las cuatro rojas, en la misma hoja', hojas.some((h) => [7, 8, 9, 10].every((n) => h.includes(n))), JSON.stringify(hojas))
  void pos
  check('un chip por color con su cuenta', r.chips.join('|') === 'Todos · 12|Rojo · 4|Verde · 2|Azul · 6', r.chips.join('|'))
  check('tu color es el azul (50 %) y el que menos, el verde', /Tu color\s*Azul · 50 %/.test(r.cifras) && /El que menos\s*Verde · 17 %/.test(r.cifras), r.cifras)
  await page.click('#mcPanelColores [data-color="rojo"]')
  const rojas = await page.$$eval('#mcPanelColores .vc-pared a', (as) => as.map((a) => a.dataset.carta))
  check('el chip «Rojo» deja solo las rojas', rojas.length === 4 && rojas.every((id) => { const n = Number(id.split('-')[1]); return n >= 7 && n <= 10 }), rojas.join())
  check('el botón dice cuántas', /estas 4/.test(await page.textContent('#vcAlbum')), await page.textContent('#vcAlbum'))
  await page.click('#vcAlbum')
  await page.waitForURL(/ver=carpetas/, { timeout: 8000 }).catch(() => {})
  const esc = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'user_albums'))
  const fila = esc[0]?.filas?.[0] || esc[0]?.filas
  check('crea un binder 3×3 «Colores: Rojo» con las 4', fila?.nombre === 'Colores: Rojo' && fila?.tipo === 'binder' && fila?.rejilla === '3x3' && fila?.cartas?.length === 4, JSON.stringify(fila)?.slice(0, 200))
  check('y lleva a ese álbum', /ver=carpetas/.test(page.url()) && /album=/.test(page.url()), page.url())
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── Tus ilustradores ──')
{
  const { page, ctx, errores } = await abrir('ilustradores')
  await page.waitForSelector('#mcPanelIlustradores .vi-fila', { timeout: 10000 }).catch(() => {})
  await page.waitForFunction(() => /de \d+/.test(document.querySelector('#mcPanelIlustradores .vi-fila .vi-cifra')?.textContent || ''), null, { timeout: 8000 }).catch(() => {})
  const r = await page.evaluate(() => [...document.querySelectorAll('#mcPanelIlustradores .vi-fila')].map((f) => ({
    nombre: f.querySelector('.vi-nombre a')?.textContent.trim(), href: f.querySelector('.vi-nombre a')?.getAttribute('href'),
    cifra: f.querySelector('.vi-cifra b')?.textContent.replace(/\s+/g, ' ').trim(),
  })))
  check('el primero es Mitsuhiro Arita con 6 (5 suyas y 1 a medias)', r[0]?.nombre === 'Mitsuhiro Arita' && /^6/.test(r[0]?.cifra), JSON.stringify(r[0]))
  check('de las 12 suyas del catálogo', /de 12/.test(r[0]?.cifra || ''), r[0]?.cifra)
  check('su nombre lleva a su página', r[0]?.href === '/ilustrador/mitsuhiro-arita', r[0]?.href)
  check('salen los tres', r.map((x) => x.nombre).join('|') === 'Mitsuhiro Arita|Akira Komayama|Ryota Murayama' || r.length === 3, r.map((x) => `${x.nombre} ${x.cifra}`).join('|'))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── «Por colores» en Empezar un álbum ──')
{
  const { page, ctx, errores } = await abrir('carpetas')
  await page.waitForSelector('#mcAlbNuevoAbrir', { timeout: 10000 }).catch(() => {})
  await page.click('#mcAlbNuevoAbrir').catch(() => {})
  await page.waitForSelector('#mcAlbNuevo [data-tipo="colores"]', { state: 'visible', timeout: 5000 }).catch(() => {})
  check('está el tipo «Por colores» con su dibujo', await page.evaluate(() => !!document.querySelector('#mcAlbNuevo [data-tipo="colores"] svg')))
  await page.click('#mcAlbNuevo [data-tipo="colores"]').catch(() => {})
  await page.waitForSelector('#mcPanelColores .vc-pared a', { timeout: 10000 }).catch(() => {})
  check('lleva a Tus colores', /ver=colores/.test(page.url()) && await page.isVisible('#mcPanelColores .vc-pared'), page.url())
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── Móvil ──')
for (const ver of ['colores', 'ilustradores']) {
  const { page, ctx, errores } = await abrir(ver, { movil: true })
  await page.waitForSelector(ver === 'colores' ? '#mcPanelColores .vc-pared a' : '#mcPanelIlustradores .vi-fila', { timeout: 15000 }).catch(() => {})
  await page.waitForTimeout(600)
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)
  check(`${ver}: nada se sale de lado`, ancho <= 1, ancho)
  if (ver === 'colores') check('tres por fila en cada hoja y una hoja a lo ancho', await page.evaluate(() => getComputedStyle(document.querySelector('.vc-pared')).gridTemplateColumns.split(' ').length === 3 && getComputedStyle(document.querySelector('.vc-hojas')).gridTemplateColumns.split(' ').length === 1))
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/1411-${ver}-movil.png`, fullPage: true })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} fallos` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
