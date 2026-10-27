// Tanda 923 — La ficha de una carta en el ordenador, TODA dentro del pop-up
// (PINGU, con una captura a 1.152 × 711: «botones que sobresalen, cosas
// demasiado grandes… hay un scroll y no quiero scrolls»). Lo que se mira, a
// 1.152 × 711, 1.366 × 768 y 1.920 × 1.080, con la carta sin copia y con el
// caso más cargado (tres versiones, álbum, dos personas que la tienen, la
// gráfica y siete atributos):
//   1. La columna de los datos no se desplaza: cabe entera.
//   2. Ningún botón ni enlace se sale de su caja (el «+ Añadir a mi
//      colección» se metía en 44 px y la letra salía por fuera).
//   3. Los seis precios en una sola fila, y la gráfica más baja (alto 120).
//   4. Sin copia, no salen las chapas «ES · NM · Holo» de una copia que no
//      existe.
//   5. «Ficha completa» va abajo en la columna de la carta, y lleva a /carta.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}

const SETS = [{ id: '30th', name: '30th Celebration', serie_id: 'sv', market: 'WEST', release_date: '2026-09-16', card_count_official: 191, card_count_total: 191, tcg_online_code: '30C' }]
const carta = (n, nombre) => ({ id: `30th-${n}`, market: 'WEST', set_id: '30th', local_id: String(n).padStart(3, '0'), name: nombre, name_es: nombre, image_path: `sv/30th/${n}`, rarity: 'Rare Holo', category: 'Pokemon', types: ['Grass'], dex_ids: [103], hp: 150, illustrator: 'Oswaldo KATO', stage: 'Stage1', evolve_from: 'Exeggcute', tcg_sets: { id: '30th', name: '30th Celebration', serie_id: 'sv', release_date: '2026-09-16', card_count_official: 191, tcg_online_code: '30C' } })
const PRECIOS = [{ card_id: '30th-2', cm_id_product: 777, cm_low: 0.02, cm_low_es: 0.02, cm_low_en: 0.02, cm_low_it: 0.02, cm_low_fr: 0.02, cm_low_de: 0.02, tp_market_eur: 0.19, checked_at: '2026-10-15T10:00:00Z' }]
const HIST = []
for (let d = 0; d < 33; d++) {
  const dia = new Date(Date.UTC(2026, 8, 16 + d)).toISOString().slice(0, 10)
  const v = d === 0 ? 1.67 : d < 5 ? 0.5 : 0.02
  HIST.push({ card_id: '30th-2', dia, cm_low: v, cm_low_es: v, cm_low_en: v * 0.9, cm_low_de: v, cm_low_fr: v, cm_low_it: v, tp_market_eur: 0.19 + (d % 3) * 0.01, origen: 'tcggo' })
}

const browser = await chromium.launch()
async function abrir({ ancho, alto, tiene = false, todo = false }) {
  const CARTAS = [carta(1, 'Exeggcute'), carta(2, 'Alolan Exeggutor'), ...Array.from({ length: 10 }, (_, i) => carta(3 + i, `Carta ${3 + i}`))]
  if (todo) CARTAS[1].variants = { normal: true, reverse: true, holo: true }
  const COLECCION = tiene ? [{ id: 'l1', user_id: 'admin-1', card_id: '30th-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'holo', cantidad: 1, created_at: '2026-10-01T10:00:00Z' }] : []
  if (todo) COLECCION.push({ id: 'o1', user_id: 'u-ana', card_id: '30th-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'holo', cantidad: 1, cambio: 0 }, { id: 'o2', user_id: 'u-beto', card_id: '30th-2', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'holo', cantidad: 4, cambio: 1 })
  const ctx = await browser.newContext({ viewport: { width: ancho, height: alto }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, {
      __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [], __FAKE_HISTORIAL__: d.HIST,
      __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }, { id: 'u-ana', username: 'ana', coleccion_publica: true }, { id: 'u-beto', username: 'beto', coleccion_publica: true }],
      __FAKE_SEGUIDOS__: [{ follower_id: 'admin-1', following_id: 'u-ana' }],
      __FAKE_IDIOMAS_SET__: { '30th': ['de', 'en', 'es', 'fr', 'it'] },
      ...(d.todo && d.tiene ? { __FAKE_CARPETAS__: [{ id: 'c1', user_id: 'admin-1', parent_id: null, nombre: 'Archivador 30 aniversario', icono: 'folder', orden: 0, created_at: '2026-01-01T00:00:00Z' }], __FAKE_CARPETA_CARTAS__: [{ id: 'cc1', user_id: 'admin-1', folder_id: 'c1', line_id: 'l1' }] } : {}),
    })
  }, { SETS, CARTAS, PRECIOS, COLECCION, HIST, todo, tiene })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|scrydex|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" rx="24" fill="#6fae3c"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await ctx.route(/tcggo-historial/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ filas: HIST }) }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=30th`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.locator('[data-carta="30th-2"]').first().click()
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}

const medir = (page) => page.evaluate(() => {
  const d = document.getElementById('mcEditor')
  const datos = d.querySelector('.mc-ficha-datos')
  const caja = d.getBoundingClientRect()
  const visibles = (sel) => [...d.querySelectorAll(sel)].filter((e) => e.offsetParent)
  const desbordan = visibles('button, a').filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => `${e.id || e.className}: «${e.textContent.trim().slice(0, 30)}» ${e.scrollWidth}x${e.scrollHeight} > ${e.clientWidth}x${e.clientHeight}`)
  // Y que nada visible se salga del pop-up por abajo o por la derecha.
  const fuera = visibles('.mc-ficha-datos *').filter((e) => { const r = e.getBoundingClientRect(); return r.width && (r.bottom > caja.bottom + 1 || r.right > caja.right + 1) }).map((e) => e.id || e.className).slice(0, 4)
  const tarjetas = visibles('#mcEdPrecioBloque .pv-tarjeta').map((e) => Math.round(e.getBoundingClientRect().top))
  const svg = d.querySelector('#mcEdHistorial svg')
  const ficha = document.getElementById('mcEdFicha').getBoundingClientRect()
  const carta = d.querySelector('.mc-ficha-carta').getBoundingClientRect()
  return {
    sobra: datos.scrollHeight - datos.clientHeight,
    desbordan, fuera,
    filasDePrecio: new Set(tarjetas).size, tarjetas: tarjetas.length,
    viewBox: svg?.getAttribute('viewBox') || '',
    chapas: !document.getElementById('mcEdChapas').classList.contains('hidden') && document.getElementById('mcEdChapas').offsetParent ? document.getElementById('mcEdChapas').textContent.trim() : '',
    fichaEnLaCarta: ficha.left >= carta.left && ficha.right <= carta.right && ficha.bottom <= carta.bottom,
    fichaHref: document.getElementById('mcEdFicha').getAttribute('href'),
    mas: document.getElementById('mcEdMas').offsetParent ? document.getElementById('mcEdMas').innerText.replace(/\s+/g, ' ').trim() : '',
  }
})

for (const [ancho, alto] of [[1152, 711], [1366, 768], [1920, 1080]]) {
  console.log(`── ${ancho} × ${alto} ──`)
  for (const caso of [{ tiene: false, todo: false, nombre: 'sin copia' }, { tiene: true, todo: true, nombre: 'la más cargada (tuya, tres versiones, álbum, dos personas)' }, { tiene: false, todo: true, nombre: 'sin copia y tres versiones' }]) {
    const { ctx, page, errores } = await abrir({ ancho, alto, ...caso })
    const m = await medir(page)
    check(`${caso.nombre}: la columna de datos cabe sin desplazarse`, m.sobra <= 0, `sobran ${m.sobra} px`)
    check('  …ningún botón se sale de su caja', !m.desbordan.length, m.desbordan.join(' | '))
    check('  …y nada se sale del pop-up', !m.fuera.length, m.fuera.join(' | '))
    check('  …los seis precios en una fila', m.tarjetas === 6 && m.filasDePrecio === 1, JSON.stringify(m))
    check('  …la gráfica dibujada más baja', m.viewBox === '0 0 600 104' /* 104 desde la 1062: los botones de las series ocupan una fila */, m.viewBox)
    check('  …«Ficha completa» abajo en la columna de la carta', m.fichaEnLaCarta && /carta/.test(m.fichaHref || ''), m.fichaHref)
    if (!caso.tiene) {
      check('  …sin chapas de una copia que no existe', m.chapas === '', m.chapas)
      check('  …y «+ Añadir a mi colección» entero', /^\+ ?Añadir a mi colección$/.test(m.mas), m.mas)
    }
    check('  …sin errores', !errores.length, errores.join(' | '))
    await ctx.close()
  }
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
