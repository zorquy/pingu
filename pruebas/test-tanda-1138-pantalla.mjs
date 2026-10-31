// Tanda 1138 — una casilla por pareja idioma × versión (Sergio.M otra vez: «me
// falta portugués sin holo, y francés y portugués con reverse… si apunto
// francés y portugués reverse, luego no me deja añadir la portuguesa normal»).
//
// Lo que se mira: una carta con versiones abre la TABLA (no las chapas);
// apuntar FR Reverse + PT Reverse escribe esas dos y nada más; cambiar desde
// la baldosa de la Reverse abre con TODO lo de la carta marcado y añadir PT
// Normal es una casilla más; desmarcarlo todo la quita de la lista; y una
// carta sin versiones sigue con las chapas.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'

const SETS = [
  { id: 'swsh7', name: 'Cielos Evolutivos', serie_id: 'swsh', market: 'WEST', release_date: '2021-08-27', card_count_official: 203 },
  { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, tcg_online_code: 'MEW' },
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 },
  { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', release_date: '2023-06-09', card_count_official: 193 },
  { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165 },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre, extra = {}) => ({ id, market: setDe(set).market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date }, ...extra })
// Una con dos versiones que se saben (1129): Normal y Reverse.
const CARTAS = [carta('sv2-50', 'sv2', 50, 'Pawmi', { rarity: 'Common', variants: { normal: true, reverse: true } }), carta('swsh7-215', 'swsh7', 215, 'Umbreon VMAX'), carta('sv3pt5-199', 'sv3pt5', 199, 'Charizard ex'), carta('sv8-238', 'sv8', 238, 'Pikachu ex'), carta('sv2-269', 'sv2', 269, 'Iono'), carta('sv3pt5-151', 'sv3pt5', 151, 'Mew ex'), carta('swsh7-1', 'swsh7', 1, 'Mew'), carta('SV2a-201', 'SV2a', 201, 'リザードン', { name_en: 'Charizard' })]
const U = (n) => `user-${n}`
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: U(1), username: 'lucia_tcg', display_name: 'Lucía' }, { id: U(2), username: 'danipoke', display_name: 'Dani' }, { id: U(3), username: 'marta.jp', display_name: 'Marta' }, { id: U(4), username: 'iker_ex', display_name: 'Íker' }, { id: U(5), username: 'malo', is_banned: true }]
const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
const linea = (id, user, card, idioma, cambio, h, o = {}) => ({ id, user_id: user, card_id: card, market: card.startsWith('SV2a') ? 'JP' : 'WEST', cantidad: Math.max(1, cambio), cambio, idioma, estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: hace(h), ...o })
// Yo (admin-1) doy Mew ex; Lucía busca Mew ex, así que con ella hay cruce.
const COLECCION = [
  linea('m1', 'admin-1', 'sv3pt5-151', 'es', 1, 1),
  linea('o1', U(1), 'swsh7-215', 'es', 1, 2), linea('o2', U(4), 'swsh7-215', 'en', 1, 3), linea('o3', U(2), 'sv3pt5-199', 'es', 1, 5),
  linea('o4', U(2), 'sv2-269', 'es', 1, 6), linea('o5', U(3), 'sv2-269', 'fr', 2, 7), linea('o6', U(1), 'sv2-269', 'es', 1, 8),
  linea('o7', U(4), 'sv8-238', 'es', 1, 9), linea('o11', U(2), 'sv2-50', 'es', 1, 1), linea('o8', U(3), 'SV2a-201', 'ja', 1, 1),
  // La da un baneado y otra con cambio 0: ninguna de las dos sale.
  linea('o9', U(5), 'swsh7-1', 'es', 1, 1), linea('o10', U(4), 'swsh7-1', 'es', 0, 1),
]
const DESEOS = [{ id: 'd1', user_id: 'admin-1', card_id: 'swsh7-215', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }, { id: 'd2', user_id: U(1), card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' }]
const PRECIOS = [{ card_id: 'swsh7-215', cm_low: 612 }, { card_id: 'sv3pt5-199', cm_low: 118.5 }, { card_id: 'sv8-238', cm_low: 84.9 }, { card_id: 'sv2-269', cm_low: 42 }]

const browser = await chromium.launch()
async function abrir({ movil = false, sesion = true, ancho = 1440, extra = {} } = {}) {
  // Sin service worker: el de la web (745) contesta antes que `route` y la
  // prueba no vería a dónde se va al escribir.
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: ancho, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion ? 'admin-1' : 'none'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.DESEOS
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_PRECIOS__ = d.PRECIOS
    Object.assign(window, d.extra)
  }, { SETS, CARTAS, COLECCION, DESEOS, PERFILES, PRECIOS, sesion, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  // A dónde se va al escribir o al registrarse, sin irse de verdad.
  await ctx.route(/\/(mensajes|auth)\.html/, (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>fuera</title>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta = '/mi-coleccion.html?ver=mercado') => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
}
const baldosas = (page) => page.$$eval('#mcMercadoRejilla .mc-merc', (as) => as.map((a) => a.dataset.merc))
const textoDe = (page, id) => page.$eval(`#mcMercadoRejilla [data-merc="${id}"]`, (a) => a.innerText.replace(/\s+/g, ' ').trim())
const visible = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); return !!e && !e.closest('.hidden') && e.getBoundingClientRect().height > 0 }, sel)



const parejas = (page, card = 'sv2-50') => page.evaluate((card) => (window.__TABLAS__.user_wants || []).filter((w) => w.user_id === 'admin-1' && w.card_id === card).map((w) => `${w.idioma || '*'}:${w.variante || '*'}`).sort().join(','), card)
const marcadas = (page) => page.$$eval('#iddMatriz [data-celda][aria-checked="true"]', (els) => els.map((e) => e.dataset.celda).sort().join(','))
const celda = (page, k) => page.click(`#iddMatriz [data-celda="${k}"]`)
const boton = async (page) => (await page.textContent('#iddApuntar')).trim()

for (const movil of [false, true]) {
  console.log(`── ${movil ? 'En el móvil' : 'En el PC'} ──`)
  const { ctx, page, errores } = await abrir({ movil })
  await page.addInitScript(() => { try { localStorage.removeItem('pd-deseo-idioma-WEST') } catch {} })
  await ir(page)
  await page.click('[data-merc-quiero="sv2-50"]')
  await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
  check('una carta con versiones abre la tabla y no las chapas', (await visible(page, '#iddMatriz')) && !(await visible(page, '#iddChips')) && !(await visible(page, '#iddVersiones')))
  const forma = await page.evaluate(() => ({ cols: [...document.querySelectorAll('#iddMatriz thead th')].slice(1).map((t) => t.textContent.replace(/\u00ad/g, '').trim()).filter(Boolean), filas: [...document.querySelectorAll('#iddMatriz tbody th')].map((t) => t.textContent.trim()) }))
  check('  …columnas «Cualquiera», Normal y Reverse; filas «Cualquiera» y los seis idiomas', forma.cols.length === 3 && /Cualquiera/.test(forma.cols[0]) && forma.filas.length === 7 && forma.filas[0] === 'Cualquiera' && forma.filas.includes('PT'), JSON.stringify(forma))
  check('  …de entrada, cualquier idioma en cualquier versión', (await marcadas(page)) === '|', await marcadas(page))
  const ancho = await page.evaluate(() => { const c = document.querySelector('.mc-idd-matriz-caja'); return c.scrollWidth <= c.clientWidth + 1 })
  check('  …y cabe sin deslizar de lado', ancho)
  const dedo = await page.$eval('#iddMatriz [data-celda="pt|normal"]', (b) => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 })
  check('  …cada casilla mide 44 al dedo', dedo)
  await celda(page, '|')
  check('  …sin ninguna, apuntar está apagado', await page.$eval('#iddApuntar', (b) => b.disabled))
  await celda(page, 'fr|reverse')
  await celda(page, 'pt|reverse')
  check('  …dos casillas: «Apuntar 2 deseos»', (await boton(page)) === 'Apuntar 2 deseos', await boton(page))
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('apunta FR Reverse y PT Reverse, y NADA más (ni la francesa normal)', (await parejas(page)) === 'fr:reverse,pt:reverse', await parejas(page))

  await page.click('[data-deseos-vista="quiero"]:visible')
  await page.waitForTimeout(1500)
  await page.click('[data-cambiar-deseo="sv2-50"][data-cambiar-version="reverse"]')
  await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
  check('cambiar abre la tabla con lo pedido marcado', (await marcadas(page)) === 'fr|reverse,pt|reverse' && (await boton(page)) === 'Guardar 2 deseos', `${await marcadas(page)} · ${await boton(page)}`)
  await celda(page, 'pt|normal')
  check('  …«la portuguesa normal, además»: una casilla más', (await boton(page)) === 'Guardar 3 deseos', await boton(page))
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('  …y quedan las tres parejas de Sergio', (await parejas(page)) === 'fr:reverse,pt:normal,pt:reverse', await parejas(page))
  const tiles = await page.$$eval('[data-deseo-carta="sv2-50"]', (els) => els.map((e) => e.dataset.deseoClave).sort().join(','))
  check('  …en «La quiero», la Normal y la Reverse', tiles === 'sv2-50|normal,sv2-50|reverse', tiles)
  if (!movil) {
    await page.click('[data-cambiar-deseo="sv2-50"][data-cambiar-version="normal"]')
    await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
    check('desde la baldosa de la Normal, la misma tabla con las tres', (await marcadas(page)) === 'fr|reverse,pt|normal,pt|reverse', await marcadas(page))
    await page.screenshot({ path: '/tmp/1138-pc.png' })
    for (const k of ['fr|reverse', 'pt|normal', 'pt|reverse']) await celda(page, k)
    check('  …sin ninguna: «Quitar de la lista»', (await boton(page)) === 'Quitar de la lista' && !(await page.$eval('#iddApuntar', (b) => b.disabled)), await boton(page))
    await page.click('#iddApuntar')
    await page.waitForTimeout(1200)
    check('  …y sale de la lista', (await parejas(page)) === '', await parejas(page))
  } else {
    await page.click('[data-cambiar-deseo="sv2-50"][data-cambiar-version="normal"]')
    await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
    await page.waitForTimeout(300)
    await page.screenshot({ path: '/tmp/1138-movil.png' })
    await page.click('#iddCancelar')
  }

  // Una carta SIN versiones sigue con las chapas de idioma.
  await page.click('[data-deseos-vista="mercado"]:visible')
  await page.waitForTimeout(1200)
  await page.click('[data-merc-quiero="sv2-269"]')
  await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
  check('sin versiones, las chapas de idioma de siempre', (await visible(page, '#iddChips')) && !(await visible(page, '#iddMatriz')))
  await page.click('#iddCancelar')
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

// Con CUATRO versiones (Normal, Reverse, Holo, 1.ª edición) en un Android de
// 360: la ventana no se sale de la pantalla y, si la tabla no cabe, se
// desliza ella con la columna del idioma fija.
console.log('── Cuatro versiones en un móvil de 360 ──')
{
  const muchas = CARTAS.map((c) => (c.id === 'sv2-50' ? { ...c, variants: { normal: true, reverse: true, holo: true, firstEdition: true } } : c))
  const ctx = await browser.newContext({ viewport: { width: 360, height: 760 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => { window.__FAKE_SESSION__ = 'admin-1'; window.__FAKE_SETS__ = d.SETS; window.__FAKE_CARTAS__ = d.muchas; window.__FAKE_COLECCION__ = d.COLECCION; window.__FAKE_DESEOS__ = d.DESEOS; window.__FAKE_PERFILES__ = d.PERFILES; window.__FAKE_PRECIOS__ = d.PRECIOS }, { SETS, muchas, COLECCION, DESEOS, PERFILES, PRECIOS })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  await ir(page)
  await page.click('[data-merc-quiero="sv2-50"]')
  await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
  const m = await page.evaluate(() => ({ cols: document.querySelectorAll('#iddMatriz thead th').length - 1, dialogo: document.querySelector('#iddDialogo').getBoundingClientRect().right, boton: document.querySelector('#iddApuntar').getBoundingClientRect().right, fija: getComputedStyle(document.querySelector('#iddMatriz tbody th')).position }))
  check('cinco columnas y la ventana dentro de la pantalla', m.cols === 5 && m.dialogo <= 361 && m.boton <= 360, JSON.stringify(m))
  check('  …la columna del idioma, fija', m.fija === 'sticky', m.fija)
  await page.screenshot({ path: '/tmp/1138-cuatro-360.png' })
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
