// Tanda 1481 — El selector de catálogo (Los dos · Occidental · Japonés) del
// Mercado, en UNA fila en el móvil (PINGU, con la captura: «ocupa demasiado…
// mejor dejarlo en una fila y quizá hacerlo más pequeño»). Con cuentas de tres
// cifras, como en su captura: a 390 y a 375 caben los nombres; por debajo de
// 375 (el Zoom de pantalla del iPhone, 320) quedan la bandera y la cuenta.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}

console.log('── 1. Lo puro ──')
{
  const T = await import(`${RAIZ}/js/mi-coleccion/tramos.js`)
  check('48 por tanda en el PC y 24 en el móvil', T.porPagina(false) === 48 && T.porPagina(true) === 24)
  check('la dirección: catálogo y cuántas, solo para su vista', JSON.stringify(T.listaDeDireccion('mercado', '?tramo=mercado:JP&hasta=96', 48)) === '{"cat":"JP","hasta":96}' && T.listaDeDireccion('quiero', '?tramo=mercado:JP', 48) === null && T.listaDeDireccion('mercado', '?tramo=mercado:todas&hasta=90', 48).cat === 'todas')
  check('un enlace de la 1114 (pag=3) abre ese catálogo con tres tandas', JSON.stringify(T.listaDeDireccion('mercado', '?tramo=mercado:WEST&pag=3', 48)) === '{"cat":"WEST","hasta":144}')
  check('el orden: occidental y luego japonés, o el elegido, sin vacíos', JSON.stringify(T.ordenDe({ WEST: 70, JP: 20 }, 'todas')) === '[["WEST",70],["JP",20]]' && JSON.stringify(T.ordenDe({ WEST: 70, JP: 20 }, 'JP')) === '[["JP",20]]' && JSON.stringify(T.ordenDe({ WEST: 0, JP: 20 }, 'todas')) === '[["JP",20]]')
  const sel = T.selectorDeCatalogoHtml('mercado', { WEST: 1234, JP: 20 }, 'JP')
  check('el selector: los dos, con sus cuentas y el elegido marcado', /Los dos<\/span> <small>1\.254/.test(sel) && /data-lista-cat="JP"[^>]*aria-pressed="true"/.test(sel) && /data-lista-cat="todas"[^>]*aria-pressed="false"/.test(sel))
  check('  …y con un solo catálogo no sale', T.selectorDeCatalogoHtml('mercado', { WEST: 10, JP: 0 }, 'todas') === '')
  const l = T.listaQueCrece({ vista: 'prueba', orden: [['WEST', 3], ['JP', 2]], pintar: (x) => `<i data-x="${x}"></i>`, cargadas: { WEST: ['a', 'b'] }, pedir: async () => [] })
  const h = l.html()
  check('lo ya cargado, con su rótulo pegado y el final que trae más', (h.match(/data-x=/g) || []).length === 2 && /mc-rotulo-pegado/.test(h) && /data-lista-mas="prueba"/.test(h) && l.quedan())
}

// ── Las fixtures: 70 occidentales y 20 japonesas a cambio, y 30 en «La quiero» ──
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 }, { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165 }]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre) => ({ id, market: setDe(set).market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: 'sv', release_date: setDe(set).release_date } })
const OCC = Array.from({ length: 70 }, (_, i) => carta(`sv8-${i + 1}`, 'sv8', i + 1, `Occ ${String(i + 1).padStart(2, '0')}`))
const JP = Array.from({ length: 20 }, (_, i) => carta(`SV2a-${i + 1}`, 'SV2a', i + 1, `Jp ${i + 1}`))
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: 'user-1', username: 'lucia_tcg', display_name: 'Lucía' }]
const hace = (m) => new Date(Date.now() - m * 60e3).toISOString()
const COLECCION = [
  ...[...OCC, ...JP].map((c, i) => ({ id: `o${i}`, user_id: 'user-1', card_id: c.id, market: c.market, cantidad: 1, cambio: 1, idioma: c.market === 'JP' ? 'ja' : 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: hace(i) })),
  // Lo que da Admin: 40 occidentales.
  ...OCC.slice(0, 40).map((c, i) => ({ id: `m${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', cantidad: 2, cambio: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: hace(i) })),
]
const DESEOS = OCC.slice(30, 60).map((c, i) => ({ id: `d${i}`, user_id: 'admin-1', card_id: c.id, idioma: null, prioridad: 1, created_at: hace(i) }))

const browser = await chromium.launch()
async function abrir(ruta, { movil = 0 } = {}) {
  const ctx = await browser.newContext({ ...(movil ? { viewport: { width: movil, height: 800 }, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.DESEOS
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_PRECIOS__ = []
    window.__rpcMercado = []
  }, { SETS, CARTAS: [...OCC, ...JP], COLECCION, DESEOS, PERFILES })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/limitlesstcg|pokemontcg|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { ctx, page, errores }
}

for (const ancho of [390, 375, 320]) {
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=mercado', { movil: ancho })
  await page.evaluate(() => { const n = ['794', '679', '115']; document.querySelectorAll('.mc-lista-cats button small').forEach((s, i) => { s.textContent = n[i] }) })
  const r = await page.$eval('.mc-lista-cats', (e) => {
    const bs = [...e.querySelectorAll('button')]
    const tops = bs.map((b) => Math.round(b.getBoundingClientRect().top))
    const nombres = bs.slice(1).map((b) => [...b.children].find((c) => c.tagName === 'SPAN' && !c.classList.contains('pv-bandera'))).map((s) => s && s.getBoundingClientRect().width > 2)
    return { tops, derecha: Math.round(e.getBoundingClientRect().right), ancho: innerWidth, nombres, alto: Math.round(bs[0].getBoundingClientRect().height), letra: getComputedStyle(bs[0]).fontSize }
  })
  check(`${ancho}: las tres en una fila`, r.tops.length === 3 && r.tops.every((t) => t === r.tops[0]), JSON.stringify(r))
  check(`${ancho}: sin salirse por la derecha`, r.derecha <= r.ancho - 16, JSON.stringify(r))
  check(`${ancho}: ${ancho >= 375 ? 'con' : 'sin'} los nombres a la vista`, r.nombres.every((v) => v === (ancho >= 375)), JSON.stringify(r))
  check(`${ancho}: al dedo, 36 de alto (la 1038)`, r.alto >= 36, JSON.stringify(r))
  check(`${ancho}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/mi-coleccion.html?ver=mercado')
  const r = await page.$eval('.mc-lista-cats button', (b) => getComputedStyle(b).fontSize)
  check('en el PC, la letra de siempre', r === '13px', r)
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
