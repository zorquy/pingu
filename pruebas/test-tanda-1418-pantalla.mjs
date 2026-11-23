// Tanda 1418 — Tus colores, bien: la pantalla.
//   · Las energías no salen aunque sean de arte (una dorada, «Hyper Rare»).
//   · Grupos nuevos: Multicolor (una carta a franjas) y Oscuras (casi negra).
//   · La pared son HOJAS de nueve; debajo de cada carta, la barra de sus colores.
//   · «Hazme un álbum» crea el binder con las cartas EN EL ORDEN DE LAS HOJAS.
//   · Una huella guardada antes de la 1418 (sin `colores`) se vuelve a leer.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
// 1-9 rojas, 10-12 azules, 13 a franjas de cuatro colores, 14 casi negra con
// algo de azul, 15 la energía dorada.
const svg = (n) => {
  const rect = (fill, x = 0, w = 245, y = 0, h = 342) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`
  const cuerpo = n <= 9 ? rect('#c62828') : n <= 12 ? rect('#2f6fb3')
    : n === 13 ? ['#dc2828', '#28a03c', '#285adc', '#f0c81e'].map((c, i) => rect(c, i * 61.25, 61.25)).join('')
    : n === 14 ? rect('#141418') + rect('#285adc', 0, 245, 0, 30)
    : rect('#d8b13a')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342">${cuerpo}</svg>`
}
const N = 15
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: i + 1 === 15 ? 'Basic Fire Energy' : `Chispa ${i + 1}`, name_es: i + 1 === 15 ? 'Energía Fuego Básica' : `Chispa ${i + 1}`, name_search: `chispa ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: i + 1 === 15 ? 'Hyper rare' : 'Illustration Rare', category: i + 1 === 15 ? 'Energy' : 'Pokemon' }))
const COLECCION = CARTAS.map((c, i) => ({ id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-11-01T10:00:00Z' }))
// La huella de antes de la 1418 de la 1: sin `colores` (y AZUL, para que se
// note si se usara tal cual).
const VIEJA = { 'sv8-1': { labs: [[0.5, -0.03, -0.15], [0.5, -0.03, -0.15], [0.5, -0.03, -0.15]], pesos: [0.34, 0.33, 0.33], croma: 0.15, luz: 0.5, bordes: { izq: [0.5, -0.03, -0.15], der: [0.5, -0.03, -0.15], arr: [0.5, -0.03, -0.15], aba: [0.5, -0.03, -0.15] } } }

const browser = await chromium.launch()
async function abrir({ movil = false } = {}) {
  const ctx = await browser.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(({ SETS, CARTAS, COLECCION, VIEJA }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS; window.__FAKE_CARTAS__ = CARTAS; window.__FAKE_COLECCION__ = COLECCION; window.__FAKE_ALBUMES__ = []
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); if (!sessionStorage.getItem('ya')) { localStorage.setItem('pd-armonia-v1', JSON.stringify(VIEJA)); sessionStorage.setItem('ya', '1') } } catch {}
  }, { SETS, CARTAS, COLECCION, VIEJA })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|pokemontcg|scrydex/, (r) => {
    const n = Number((r.request().url().match(/sv8\/(\d+)/) || [])[1] || 1)
    return r.fulfill({ status: 200, contentType: 'image/svg+xml', headers: { 'Access-Control-Allow-Origin': '*' }, body: svg(n) })
  })
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => { if (!/ViewTransition|Transition was/.test(String(e))) errores.push(String(e).slice(0, 200)) })
  await page.goto(`${BASE}/mi-coleccion.html?ver=colores`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcPanelColores .vc-hoja', { timeout: 20000 }).catch(() => {})
  return { ctx, page, errores }
}

console.log('\n── La pared en hojas ──')
{
  const { page, ctx, errores } = await abrir()
  const r = await page.evaluate(() => ({
    hojas: [...document.querySelectorAll('#mcPanelColores .vc-hoja')].map((h) => [...h.querySelectorAll('a')].map((a) => Number(a.dataset.carta.split('-')[1]))),
    chips: [...document.querySelectorAll('#mcPanelColores .vc-chips [data-color]')].map((b) => b.textContent.trim()),
    barras: [...document.querySelectorAll('#mcPanelColores .vc-pared li')].map((li) => li.querySelectorAll('.vc-barra b').length),
    rotulos: [...document.querySelectorAll('#mcPanelColores .vc-hoja > p')].map((p) => p.textContent.trim()),
    resumen: document.querySelector('#mcPanelColores .mc-vista-resumen')?.textContent.replace(/\s+/g, ' ').trim(),
    multi: document.querySelector('#mcPanelColores [data-color="multicolor"] i')?.getAttribute('style') || '',
  }))
  const todas = r.hojas.flat()
  check('la energía dorada no sale', !todas.includes(15) && todas.length === 14, todas.join())
  check('dos hojas: la primera, las nueve rojas', r.hojas.length === 2 && r.hojas[0].length === 9 && r.hojas[0].every((n) => n <= 9), JSON.stringify(r.hojas))
  check('cada hoja con su rótulo', r.rotulos.join('|') === 'Hoja 1|Hoja 2', r.rotulos.join('|'))
  check('chips con Multicolor y Oscuras, al final', r.chips.join('|') === 'Todos · 14|Rojo · 9|Azul · 3|Multicolor · 1|Oscuras · 1', r.chips.join('|'))
  check('la muestra de Multicolor es una rueda de colores', /conic-gradient/.test(r.multi), r.multi)
  check('cada carta lleva la barra de sus colores', r.barras.length === 14 && r.barras.every((n) => n >= 1 && n <= 3), r.barras.join())
  check('la 1, guardada sin colores de antes, se ha vuelto a leer y es roja', r.hojas[0].includes(1))
  const guardada = await page.evaluate(() => JSON.parse(localStorage.getItem('pd-armonia-v1') || '{}')['sv8-1']?.colores?.color)
  await page.waitForTimeout(700)
  const guardada2 = await page.evaluate(() => JSON.parse(localStorage.getItem('pd-armonia-v1') || '{}')['sv8-1']?.colores?.color)
  check('y queda guardada con su color', (guardada || guardada2) === 'rojo', guardada2)
  check('la frase habla de hojas', /hojas de nueve/.test(r.resumen || ''), r.resumen)

  await page.click('#mcPanelColores [data-color="oscuras"]')
  const oscuras = await page.$$eval('#mcPanelColores .vc-pared a', (as) => as.map((a) => a.dataset.carta))
  check('el chip «Oscuras» deja la casi negra', oscuras.join() === 'sv8-14', oscuras.join())
  await page.click('#mcPanelColores [data-color="todos"]')
  await page.click('#vcAlbum')
  await page.waitForURL(/ver=carpetas/, { timeout: 8000 }).catch(() => {})
  const esc = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'user_albums'))
  const fila = esc[0]?.filas?.[0] || esc[0]?.filas
  const enAlbum = (fila?.cartas || []).map((c) => Number(String(c.card_id || c.id || c).split('-')[1]))
  check('el álbum lleva las cartas en el orden de las hojas', enAlbum.join() === todas.join(), `${enAlbum.join()} / ${todas.join()}`)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('\n── Móvil ──')
{
  const { page, ctx, errores } = await abrir({ movil: true })
  const r = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth - innerWidth,
    columnas: getComputedStyle(document.querySelector('.vc-hojas')).gridTemplateColumns.split(' ').length,
    carta: document.querySelector('.vc-pared img')?.getBoundingClientRect().width,
    barra: document.querySelector('.vc-barra')?.getBoundingClientRect().width,
  }))
  check('nada se sale de lado', r.ancho <= 1, r.ancho)
  check('una hoja a lo ancho, con cartas de más de 90 px', r.columnas === 1 && r.carta > 90, JSON.stringify(r))
  check('la barra mide lo que la carta', Math.abs(r.barra - r.carta) <= 2, JSON.stringify(r))
  if (process.env.CAPTURAS) await page.screenshot({ path: `${process.env.CAPTURAS}/1418-movil.png`, fullPage: true })
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
