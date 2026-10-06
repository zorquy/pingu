// Tandas 662 y 663 — lo que vale una expansión en el tiempo, y las cartas
// de tu colección que más se mueven esta semana (las dos primeras
// propuestas de la noche del 5 al 6).
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const d = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

console.log('── 1. Las que más se mueven, en puro (663) ──')
{
  const { movidasDe, extremos } = await import(`${RAIZ}/js/mi-coleccion/movidas.js`)
  const cartas = { a: { id: 'a', name: 'A' }, b: { id: 'b', name: 'B' }, c: { id: 'c', name: 'C' }, e: { id: 'e', name: 'E' } }
  const lineas = [{ card_id: 'a', idioma: 'es' }, { card_id: 'b', idioma: 'en' }, { card_id: 'c', idioma: 'es' }, { card_id: 'd', idioma: 'es' }, { card_id: 'e', idioma: 'es' }, { card_id: 'a', idioma: 'es' }]
  const filas = [
    { card_id: 'a', dia: d(7), cm_low_es: 100 }, { card_id: 'a', dia: d(0), cm_low_es: 120 },
    { card_id: 'b', dia: d(7), cm_low: 10, cm_low_en: 10 }, { card_id: 'b', dia: d(0), cm_low: 10, cm_low_en: 8 },
    { card_id: 'c', dia: d(7), cm_low_es: 5 }, { card_id: 'c', dia: d(0), cm_low_es: 5.01 },
    { card_id: 'd', dia: d(0), cm_low_es: 50 },
    { card_id: 'e', dia: d(0), cm_low_es: 50 }, { card_id: 'e', dia: d(7), cm_low_es: 40 },
  ]
  const m = movidasDe(lineas, filas, (l) => cartas[l.card_id] || null)
  check('sale cada carta con dos fotos en el idioma de tu copia, con su cambio y su porcentaje', m.length === 3 && m[0].carta.id === 'e' && m[0].pct === 25 && m[1].carta.id === 'a' && m[1].cambio === 20 && m[2].carta.id === 'b' && m[2].cambio === -2 && m[2].idioma === 'en', JSON.stringify(m.map((x) => [x.carta.id, x.cambio, x.pct])))
  check('  …sin repetir una línea duplicada, sin la que apenas cambia, sin la de una sola foto y sin la que no está en el catálogo', !m.some((x) => x.carta.id === 'c') && !m.some((x) => x.carta.id === 'd') && m.filter((x) => x.carta.id === 'a').length === 1)
  const { suben, bajan } = extremos(m, 3)
  check('las que suben y las que bajan, en su orden', suben.map((x) => x.carta.id).join() === 'e,a' && bajan.map((x) => x.carta.id).join() === 'b')
}

const browser = await chromium.launch()
const semilla = ({ valor, historial }) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', release_date: '2015-02-04', card_count_official: 160, card_count_total: 164, tcg_online_code: 'PRC' }]
  window.__FAKE_CARTAS__ = [
    { id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true } },
    { id: 'xy5-1', market: 'WEST', set_id: 'xy5', local_id: '1', name: 'Weedle', name_es: 'Weedle', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
    { id: 'xy5-2', market: 'WEST', set_id: 'xy5', local_id: '2', name: 'Kakuna', name_es: 'Kakuna', image_path: 'x/3', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
  ]
  window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-150', cm_id_product: 1, cm_low: 39, cm_low_es: 159.95, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' }, { card_id: 'xy5-1', cm_id_product: 2, cm_low: 0.2, cm_low_es: 0.3, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' }, { card_id: 'xy5-2', cm_id_product: 3, cm_low: 1, cm_low_es: 2, tcggo_updated: '2026-10-05T12:00:00Z', origen: 'tcggo' }]
  window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'xy5-150', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' }, { id: 'l2', card_id: 'xy5-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-02T10:00:00Z' }, { id: 'l3', card_id: 'xy5-2', market: 'WEST', cantidad: 1, idioma: 'en', estado: 'NM', variante: 'normal', created_at: '2026-10-03T10:00:00Z' }]
  const dd = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
  window.__FAKE_SET_VALOR__ = Array.from({ length: valor }, (_, i) => ({ set_id: 'xy5', market: 'WEST', dia: dd(valor - 1 - i), valor_cm: 400 + i * 3 }))
  window.__FAKE_HISTORIAL__ = historial ? [].concat(...[0, 1, 2, 3, 4, 5, 6, 7].map((k) => [
    { card_id: 'xy5-150', dia: dd(7 - k), cm_low: 100 + k * 5, cm_low_es: 140 + k * 3 },
    { card_id: 'xy5-1', dia: dd(7 - k), cm_low: 0.5, cm_low_es: 0.5 - k * 0.03 },
    { card_id: 'xy5-2', dia: dd(7 - k), cm_low: 2, cm_low_en: 2 + k * 0.5 },
  ])) : []
}
async function abrir(ruta, { valor = 20, historial = true } = {}) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript(semilla, { valor, historial })
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' }))
  await page.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, errores }
}

console.log('\n── 2. Lo que vale la expansión: ya NO va dentro de la expansión (667) ──')
{
  // PINGU en la 667: «como vas a ponerlo en el overview de la expansión no
  // tiene sentido meterlo dentro». La gráfica se fue de aquí; la tarjeta
  // de la estantería es la que lo cuenta.
  const { page, errores } = await abrir('/mi-coleccion.html?ver=album&set=xy5')
  check('dentro de la expansión no hay gráfica de valor', (await page.locator('#mcAlbumValor').count()) === 0 && !/Lo que vale esta expansión/.test(await page.locator('#mcPanelAlbum').innerText()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
  const sin = await abrir('/mi-coleccion.html', { historial: false })
  check('sin histórico, el bloque no sale', (await sin.page.locator('#mcVistazos .mc-vistazo').filter({ hasText: 'Las que más se mueven' }).count()) === 0)
  await sin.page.close()
}

console.log('\n── 4. Lo estático ──')
{
  const js = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  check('las movidas se acotan a las 600 más valiosas', /TOPE_MOVIDAS = 600/.test(js) && /slice\(0, TOPE_MOVIDAS\)/.test(js))
  check('el histórico se pide por tandas de 150 y calla sin migración', /historicoDeCartas/.test(readFileSync(`${RAIZ}/js/mi-coleccion/datos.js`, 'utf8')) && /i \+= 150/.test(readFileSync(`${RAIZ}/js/mi-coleccion/datos.js`, 'utf8')))
}

await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
