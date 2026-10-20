// Tanda 926 — A de la propuesta: /carta en el ordenador es la ficha del
// pop-up en grande (PINGU: «la A me gusta, sí»). Lo que se mira:
//   1. A 1.366 y 1.920: dos columnas; la carta a la izquierda sobre sus
//      colores difuminados (`--arte`) y arriba; el nombre y los datos a la
//      derecha.
//   2. Los precios en UNA fila, «Avísame», «Comparar» y «Todas las cartas
//      de…» en otra (botones suaves), la gráfica dibujada baja (120).
//   3. Los datos en tres columnas; la legalidad, una chapa con su porqué
//      en el `title`; sin la caja de «Debilidad —» cuando no hay nada.
//   4. En el móvil no cambia: una columna y sin la forma del PC.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}
const CARTA = { id: '30th-2', market: 'WEST', set_id: '30th', local_id: '002', name: 'Alolan Exeggutor', name_es: 'Alolan Exeggutor', image_path: 'x/2', rarity: 'Rare Holo', category: 'Pokemon', types: ['Grass'], dex_ids: [103], hp: 150, illustrator: 'Oswaldo KATO', stage: 'Stage1', evolve_from: 'Exeggcute', regulation_mark: 'G', detalle_at: '2026-10-01T00:00:00Z', variants: { normal: true, reverse: true, holo: true } }
const HIST = Array.from({ length: 33 }, (_, d) => ({ card_id: '30th-2', dia: new Date(Date.UTC(2026, 8, 16 + d)).toISOString().slice(0, 10), cm_low: d ? 0.02 : 1.67, cm_low_es: d ? 0.02 : 1.67, tp_market_eur: 0.19, origen: 'tcggo' }))
const browser = await chromium.launch()
async function abrir(opciones) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, {
      __FAKE_SETS__: [{ id: '30th', name: '30th Celebration', serie_id: 'sv', market: 'WEST', release_date: '2026-09-16', card_count_official: 191 }],
      __FAKE_CARTAS__: [d.CARTA], __FAKE_PRECIOS__: [{ card_id: '30th-2', cm_id_product: 7, cm_low: 0.02, cm_low_es: 0.02, cm_low_en: 0.02, cm_low_de: 0.02, cm_low_fr: 0.02, cm_low_it: 0.02, tp_market_eur: 0.19 }],
      __FAKE_COLECCION__: [{ id: 'l1', user_id: 'admin-1', card_id: '30th-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'holo', cantidad: 1 }],
      __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }],
    })
  }, { CARTA })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|scrydex|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" rx="24" fill="#6fae3c"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await ctx.route(/tcggo-historial/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ filas: HIST }) }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/carta.html?id=30th-2`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  return { ctx, page, errores }
}
const medir = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const r = (e) => e.getBoundingClientRect()
  const art = q('#cartaNucleo'), scan = q('.carta-scan'), img = q('.carta-scan img'), h1 = q('.carta-cabecera h1'), datos = q('.carta-datos')
  const tarjetas = [...document.querySelectorAll('#cmPrecios .pv-tarjeta')].map((t) => Math.round(r(t).top))
  const fila = ['#cmAvisoSitio', '#cmComparar', '.carta-mercado-pie'].map((s) => q(s)).filter(Boolean).map((e) => Math.round(r(e).top + r(e).height / 2))
  const legal = q('.carta-legal')
  return {
    columnas: getComputedStyle(art).gridTemplateColumns.split(' ').length,
    arte: getComputedStyle(art).getPropertyValue('--arte'),
    cartaIzq: r(scan).right <= r(h1).left + 1 && r(scan).right <= r(datos).left + 1,
    cartaArriba: img ? r(img).top - r(scan).top : null,
    tarjetas: tarjetas.length, filasDePrecio: new Set(tarjetas).size,
    botonesEnFila: fila.length === 3 && Math.max(...fila) - Math.min(...fila) <= 12,
    pie: q('.carta-mercado-pie')?.tagName,
    viewBox: q('#cmHistorial svg')?.getAttribute('viewBox') || '',
    ficha: getComputedStyle(q('.carta-ficha')).gridTemplateColumns.split(' ').length,
    legal: legal ? { radio: parseFloat(getComputedStyle(legal).borderTopLeftRadius), title: legal.getAttribute('title') || '', porqueVisible: getComputedStyle(q('.carta-legal-porque')).display !== 'none' } : null,
    combate: document.querySelectorAll('.carta-combate').length,
  }
})

for (const [ancho, alto] of [[1366, 768], [1920, 1080]]) {
  console.log(`── ${ancho} × ${alto} ──`)
  const { ctx, page, errores } = await abrir({ viewport: { width: ancho, height: alto } })
  const m = await medir(page)
  check('dos columnas: la carta a la izquierda, el nombre y los datos a la derecha', m.columnas === 2 && m.cartaIzq, JSON.stringify(m))
  check('  …la carta sobre sus colores (--arte) y arriba, no centrada en la columna', /url\(/.test(m.arte) && m.cartaArriba !== null && m.cartaArriba < 80, JSON.stringify({ arte: m.arte.slice(0, 40), arriba: m.cartaArriba }))
  check('los seis precios en una fila', m.tarjetas === 6 && m.filasDePrecio === 1, JSON.stringify(m))
  check('«Avísame», «Comparar» y «Todas las cartas de…» en una fila, fuera de un párrafo', m.botonesEnFila && m.pie === 'DIV', JSON.stringify(m))
  check('la gráfica, dibujada más baja', m.viewBox === '0 0 600 120', m.viewBox)
  check('los datos en tres columnas', m.ficha === 3, String(m.ficha))
  check('la legalidad, una chapa con su porqué en el title', m.legal && m.legal.radio > 100 && /marcas/.test(m.legal.title) && !m.legal.porqueVisible, JSON.stringify(m.legal))
  check('sin la caja de debilidad y resistencia vacías', m.combate === 0, String(m.combate))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── En el móvil ──')
{
  const { ctx, page, errores } = await abrir(devices['iPhone 13'])
  const m = await page.evaluate(() => ({ display: getComputedStyle(document.getElementById('cartaNucleo')).display, scan: getComputedStyle(document.querySelector('.carta-scan')).position }))
  check('una columna, como antes (sin la forma del PC)', m.display !== 'grid' && m.scan !== 'relative', JSON.stringify(m))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
