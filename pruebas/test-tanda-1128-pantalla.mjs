// Tandas 1128 y 1129 — querer una carta en VARIOS idiomas Y VERSIONES (Sergio.M en el foro: «si
// digo que me falta en portugués, no puedo añadir que me falta también en
// francés»). PINGU eligió la A de la propuesta: los idiomas de la ventana son
// casillas.
//
// Lo que se mira: lo puro (`idiomasPara`, `planDeDeseos`, `textoDeIdiomas`);
// la ventana con casillas, «Cualquiera» excluyente y el botón con la cuenta;
// apuntar desde el Mercado escribe un deseo por idioma; cambiar desde «La
// quiero» abre con los suyos marcados y añade y quita; y volver a «Cualquiera».
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'

console.log('── 1. Lo puro ──')
{
  const P = await import(`${RAIZ}/js/deseo-idiomas.js`)
  check('varios idiomas, sin repetir', JSON.stringify(P.idiomasPara(['pt', 'fr', 'pt'])) === '["pt","fr"]')
  check('«cualquiera» va solo', JSON.stringify(P.idiomasPara(['pt', null])) === '[null]' && JSON.stringify(P.idiomasPara([])) === '[null]')
  check('una japonesa: lo occidental es «cualquiera», lo asiático se queda', JSON.stringify(P.idiomasPara(['es', 'fr'], 'JP')) === '[null]' && JSON.stringify(P.idiomasPara(['ja', 'ko'], 'JP')) === '["ja","ko"]')
  const filas = [{ id: 'a', idioma: 'pt', variante: null }, { id: 'b', idioma: 'fr', variante: null }]
  let p = P.planDeDeseos(filas, ['pt', 'de'])
  check('cambiar: se queda el que sigue, se borra el quitado, se añade el nuevo', JSON.stringify(p) === '{"cambiar":[],"borrar":["b"],"anadir":["de"]}', JSON.stringify(p))
  p = P.planDeDeseos(filas, ['pt', 'fr'], 'reverse')
  check('  …con otra versión, los que se quedan cambian de versión', p.cambiar.length === 2 && p.cambiar.every((c) => c.cambios.variante === 'reverse') && !p.borrar.length && !p.anadir.length, JSON.stringify(p))
  p = P.planDeDeseos(filas, ['pt', 'it'], null, ['it'])
  check('  …y lo que ya está en otra fila de esa versión no se repite', !p.anadir.length && JSON.stringify(p.borrar) === '["b"]', JSON.stringify(p))
  p = P.planDeDeseos(filas, [null])
  check('  …y «cualquiera» deja uno solo', JSON.stringify(p) === '{"cambiar":[],"borrar":["a","b"],"anadir":[null]}', JSON.stringify(p))
  const n = { pt: 'Portugués', fr: 'Francés', de: 'Alemán' }
  check('el aviso: «en portugués y francés»', P.textoDeIdiomas(['pt', 'fr'], (i) => n[i]) === 'en portugués y francés' && P.textoDeIdiomas(['pt', 'fr', 'de'], (i) => n[i]) === 'en portugués, francés y alemán' && P.textoDeIdiomas([null], (i) => n[i]) === '')
}

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


const deseosDe = (page, card) => page.evaluate((card) => (window.__TABLAS__.user_wants || []).filter((w) => w.user_id === 'admin-1' && w.card_id === card).map((w) => w.idioma || '*').sort().join(','), card)
const marcados = (page) => page.$$eval('#iddChips .mc-idioma-chip[aria-checked="true"]', (els) => els.map((e) => e.dataset.idioma || '*').join(','))
const chip = (page, id) => page.click(`#iddChips .mc-idioma-chip[data-idioma="${id}"]`)

for (const movil of [false, true]) {
  console.log(`── 2. ${movil ? 'En el móvil' : 'En el PC'} ──`)
  const { ctx, page, errores } = await abrir({ movil })
  await page.addInitScript(() => { try { localStorage.removeItem('pd-deseo-idioma-WEST') } catch {} })
  await ir(page)
  await page.click('[data-merc-quiero="sv2-269"]')
  await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
  check('el corazón abre la ventana con casillas', (await page.$$eval('#iddChips .mc-idioma-chip', (els) => els.every((e) => e.getAttribute('role') === 'checkbox'))) && (await marcados(page)) === '*', await marcados(page))
  await chip(page, 'pt')
  await chip(page, 'fr')
  check('marcar dos quita «Cualquiera» y el botón cuenta', (await marcados(page)) === 'fr,pt' || (await marcados(page)) === 'pt,fr', await marcados(page))
  check('  …«Apuntar en 2 idiomas»', (await page.textContent('#iddApuntar')).trim() === 'Apuntar en 2 idiomas', await page.textContent('#iddApuntar'))
  await chip(page, '')
  check('«Cualquiera» va solo', (await marcados(page)) === '*' && (await page.textContent('#iddApuntar')).trim() === 'Apuntar')
  await chip(page, 'pt')
  await chip(page, 'fr')
  await page.click('#iddApuntar')
  await page.waitForTimeout(900)
  check('apuntar escribe un deseo por idioma', (await deseosDe(page, 'sv2-269')) === 'fr,pt', await deseosDe(page, 'sv2-269'))
  check('  …y lo recuerda para la próxima', ['pt,fr', 'fr,pt'].includes(await page.evaluate(() => localStorage.getItem('pd-deseo-idioma-WEST'))))
  // Sin navegar: el doble vuelve a sembrar la base en cada carga.
  await page.click('#mcPanelMercado [data-deseos-vista="quiero"], [data-deseos-vista="quiero"]:visible')
  await page.waitForTimeout(1500)
  const fila = await page.$eval('[data-deseo-carta="sv2-269"]', (e) => e.querySelectorAll('.mc-deseo-cambiar .pv-bandera').length).catch(() => 0)
  check('en «La quiero», una baldosa con las dos banderas', fila === 2, fila)
  await page.click('[data-deseo-carta="sv2-269"] [data-cambiar-deseo]')
  await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
  check('cambiar abre con los dos marcados y «Guardar»', ['fr,pt', 'pt,fr'].includes(await marcados(page)) && (await page.textContent('#iddApuntar')).trim() === 'Guardar en 2 idiomas', `${await marcados(page)} · ${await page.textContent('#iddApuntar')}`)
  await chip(page, 'fr')
  await chip(page, 'de')
  await page.click('#iddApuntar')
  await page.waitForTimeout(900)
  check('  …quitar francés y poner alemán: portugués y alemán', (await deseosDe(page, 'sv2-269')) === 'de,pt', await deseosDe(page, 'sv2-269'))
  await page.click('[data-deseo-carta="sv2-269"] [data-cambiar-deseo]')
  await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
  await chip(page, '')
  await page.click('#iddApuntar')
  await page.waitForTimeout(900)
  check('  …y «Cualquiera» deja uno solo', (await deseosDe(page, 'sv2-269')) === '*', await deseosDe(page, 'sv2-269'))

  // Varias versiones (1129): Pawmi en portugués y francés, Normal y Reverse.
  await page.click('[data-deseos-vista="mercado"]:visible')
  await page.waitForTimeout(1200)
  await page.click('[data-merc-quiero="sv2-50"]')
  await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
  check('con versiones, también son casillas', (await page.$$eval('#iddVersiones [data-variante]', (els) => els.length && els.every((e) => e.getAttribute('role') === 'checkbox'))))
  await chip(page, 'pt')
  await chip(page, 'fr')
  await page.click('#iddVersiones [data-variante="normal"]')
  await page.click('#iddVersiones [data-variante="reverse"]')
  check('  …dos idiomas × dos versiones: «Apuntar 4 deseos»', (await page.textContent('#iddApuntar')).trim() === 'Apuntar 4 deseos', await page.textContent('#iddApuntar'))
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  const pareja = () => page.evaluate(() => (window.__TABLAS__.user_wants || []).filter((w) => w.user_id === 'admin-1' && w.card_id === 'sv2-50').map((w) => `${w.idioma || '*'}:${w.variante || '*'}`).sort().join(','))
  check('  …cuatro deseos, uno por pareja', (await pareja()) === 'fr:normal,fr:reverse,pt:normal,pt:reverse', await pareja())
  await page.click('[data-deseos-vista="quiero"]:visible')
  await page.waitForTimeout(1500)
  const pawmi = await page.$$eval('[data-deseo-carta="sv2-50"]', (els) => els.map((e) => `${e.dataset.deseoClave}:${e.querySelectorAll('.mc-deseo-cambiar .pv-bandera').length}`).sort().join(','))
  check('  …en «La quiero», una baldosa por versión con sus dos banderas', pawmi === 'sv2-50|normal:2,sv2-50|reverse:2', pawmi)
  await page.click('[data-cambiar-deseo="sv2-50"][data-cambiar-version="reverse"]')
  await page.waitForSelector('#iddDialogo[open]', { timeout: 5000 }).catch(() => {})
  await page.click('#iddVersiones [data-variante="reverse"]')
  await page.click('#iddVersiones [data-variante="normal"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('  …y pasar la Reverse a Normal, que ya estaba: aviso y nada cambia', (await pareja()) === 'fr:normal,fr:reverse,pt:normal,pt:reverse' && /ya está en tu lista/.test(await page.textContent('body')), await pareja())
  check('sin errores', !errores.length, errores.join(' | '))
  if (!movil) await page.screenshot({ path: '/tmp/1128-pc.png' })
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
