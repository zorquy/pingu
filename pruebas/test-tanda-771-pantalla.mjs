// Tanda 771 — «La quiero» en rejilla, el idioma al apuntar y sin prioridad.
//
// PINGU: «que aparezcan las cartas de la gente», «la carta que quieras,
// seleccionar el idioma en el que la quieres» y, del desplegable «La busco /
// La busco mucho / Es la que me falta», «yo se lo quitaría». Lo que se mira:
// la rejilla con quién la da (avatares, «La dan N», «Ver quién» abre la
// ficha del Mercado), el filtro «Las da alguien / Nadie aún», que no hay ni
// desplegable ni papelera (el corazón quita la carta en todos sus idiomas),
// que el buscador pregunta el idioma (y la japonesa solo en japonés), y que
// el corazón de la ficha de una carta y el de /carta también lo preguntan.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const CAPS = process.env.PD_CAPS || ''

const SETS = [
  { id: 'swsh7', name: 'Cielos Evolutivos', serie_id: 'swsh', market: 'WEST', release_date: '2021-08-27', card_count_official: 203 },
  { id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, tcg_online_code: 'MEW' },
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 },
  { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', release_date: '2023-06-09', card_count_official: 193 },
  { id: 'SV2a', name: 'ポケモンカード151', name_en: 'Pokémon Card 151', serie_id: 'sv', market: 'JP', release_date: '2023-06-16', card_count_official: 165 },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre, extra = {}) => ({ id, market: setDe(set).market, set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date }, ...extra })
const CARTAS = [carta('swsh7-215', 'swsh7', 215, 'Umbreon VMAX'), carta('sv3pt5-199', 'sv3pt5', 199, 'Charizard ex'), carta('sv8-238', 'sv8', 238, 'Pikachu ex'), carta('sv2-269', 'sv2', 269, 'Iono'), carta('sv3pt5-151', 'sv3pt5', 151, 'Mew ex'), carta('swsh7-1', 'swsh7', 1, 'Mew'), carta('SV2a-201', 'SV2a', 201, 'リザードン', { name_en: 'Charizard' })]
const U = (n) => `user-${n}`
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: U(1), username: 'lucia_tcg', display_name: 'Lucía' }, { id: U(2), username: 'danipoke', display_name: 'Dani' }, { id: U(3), username: 'marta.jp', display_name: 'Marta' }, { id: U(4), username: 'iker_ex', display_name: 'Íker' }, { id: U(5), username: 'malo', is_banned: true }]
const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
const linea = (id, user, card, idioma, cambio, h, o = {}) => ({ id, user_id: user, card_id: card, market: card.startsWith('SV2a') ? 'JP' : 'WEST', cantidad: Math.max(1, cambio), cambio, idioma, estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: hace(h), ...o })
// Yo (admin-1) doy Mew ex; Lucía busca Mew ex, así que con ella hay cruce.
const COLECCION = [
  linea('m1', 'admin-1', 'sv3pt5-151', 'es', 1, 1),
  linea('o1', U(1), 'swsh7-215', 'es', 1, 2), linea('o2', U(4), 'swsh7-215', 'en', 1, 3), linea('o3', U(2), 'sv3pt5-199', 'es', 1, 5),
  linea('o4', U(2), 'sv2-269', 'es', 1, 6), linea('o5', U(3), 'sv2-269', 'fr', 2, 7), linea('o6', U(1), 'sv2-269', 'es', 1, 8),
  linea('o7', U(4), 'sv8-238', 'es', 1, 9), linea('o8', U(3), 'SV2a-201', 'ja', 1, 1),
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

const quiero = (page) => page.$$eval('#mcQuieroRejilla .mc-deseo-baldosa', (as) => as.map((a) => a.dataset.deseoCarta))
const misDeseos = (page) => page.evaluate(() => window.__TABLAS__.user_wants.filter((d) => d.user_id === 'admin-1').map((d) => `${d.card_id}:${d.idioma || '*'}`).sort())
// Umbreon en cualquier idioma y en japonés (dos filas, una baldosa), Pikachu
// en español y Mew (swsh7-1), que no da nadie que se pueda ver.
const MIOS = [
  { id: 'q1', user_id: 'admin-1', card_id: 'swsh7-215', idioma: null, prioridad: 3, created_at: '2026-10-05T10:00:00Z' },
  { id: 'q2', user_id: 'admin-1', card_id: 'swsh7-215', idioma: 'ja', prioridad: 1, created_at: '2026-10-05T09:00:00Z' },
  { id: 'q3', user_id: 'admin-1', card_id: 'sv8-238', idioma: 'es', prioridad: 2, created_at: '2026-10-06T10:00:00Z' },
  { id: 'q4', user_id: 'admin-1', card_id: 'swsh7-1', idioma: null, prioridad: 1, created_at: '2026-10-04T10:00:00Z' },
  { id: 'q5', user_id: 'user-1', card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
]

console.log('── 1. La rejilla, con quién la da ──')
{
  const { ctx, page, errores } = await abrir({ extra: { __FAKE_DESEOS__: MIOS } })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.waitForTimeout(800)
  check('tres baldosas (Umbreon en dos idiomas es UNA), lo último primero', (await quiero(page)).join() === 'sv8-238,swsh7-215,swsh7-1', (await quiero(page)).join())
  check('ni desplegable de prioridad ni papelera', (await page.locator('#mcQuieroPanel select').count()) === 0 && (await page.locator('#mcQuieroPanel [data-quitar-deseo]').count()) === 0)
  const umbreon = await page.$eval('[data-deseo-carta="swsh7-215"]', (a) => a.innerText.replace(/\s+/g, ' '))
  check('Umbreon: «Cualquier idioma», su precio y «La dan 2»', /Cualquier idioma/.test(umbreon) && /612,00/.test(umbreon) && /La dan 2/.test(umbreon), umbreon)
  check('  …con los avatares de quien la da y «Ver quién»', (await page.locator('[data-deseo-carta="swsh7-215"] .mc-gente-av').count()) === 2 && /Ver quién/.test(umbreon))
  const pika = await page.$eval('[data-deseo-carta="sv8-238"]', (a) => a.innerText.replace(/\s+/g, ' '))
  check('Pikachu, en español (con su bandera)', /Español/.test(pika) && (await page.locator('[data-deseo-carta="sv8-238"] .mc-deseo-idioma .pv-bandera[data-idioma="es"]').count()) === 1, pika)
  check('Mew: «Nadie la da aún»', /Nadie la da aún/.test(await page.$eval('[data-deseo-carta="swsh7-1"]', (a) => a.innerText)))
  check('la cuenta: 3 cartas', /^3 cartas/.test((await page.textContent('#mcQuieroCifra')).trim()), await page.textContent('#mcQuieroCifra'))
  if (CAPS) await page.screenshot({ path: `${CAPS}/771-quiero.png`, fullPage: true })

  console.log('── 2. El filtro ──')
  await page.click('[data-quiero-filtro="nadie"]')
  await page.waitForTimeout(300)
  check('«Nadie aún»: Mew', (await quiero(page)).join() === 'swsh7-1', (await quiero(page)).join())
  await page.click('[data-quiero-filtro="dan"]')
  await page.waitForTimeout(300)
  check('«Las da alguien»: Pikachu y Umbreon', (await quiero(page)).join() === 'sv8-238,swsh7-215', (await quiero(page)).join())
  await page.click('[data-quiero-filtro="todas"]')

  console.log('── 3. «Ver quién»: la ficha del Mercado ──')
  await page.click('[data-deseo-carta="swsh7-215"] [data-ver-quien]')
  await page.waitForTimeout(1300)
  const gente = await page.$$eval('#mcMercadoFichaCuerpo .mc-merf-persona', (ps) => ps.map((p) => p.innerText.replace(/\s+/g, ' ')))
  check('se abre con las dos personas', (await page.$eval('#mcMercadoFicha', (d) => d.open)) && gente.length === 2, JSON.stringify(gente))
  check('  …y dice en qué idiomas la quieres', /La quieres · cualquier idioma, japonés/.test(await page.textContent('#mcMercadoFichaQuiero')), await page.textContent('#mcMercadoFichaQuiero'))
  await page.click('#mcMercadoFichaCerrar')
  await page.waitForTimeout(300)

  console.log('── 4. El corazón quita la carta, en todos sus idiomas ──')
  await page.click('[data-quitar-deseo-carta="swsh7-215"]')
  await page.waitForTimeout(1200)
  check('Umbreon fuera de la base (las dos filas)', (await misDeseos(page)).join() === 'sv8-238:es,swsh7-1:*', (await misDeseos(page)).join())
  check('  …y de la rejilla', (await quiero(page)).join() === 'sv8-238,swsh7-1', (await quiero(page)).join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. El buscador pregunta el idioma ──')
{
  const { ctx, page, errores } = await abrir({ extra: { __FAKE_DESEOS__: [] } })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.fill('#mcDeseoBuscar', 'iono')
  await page.waitForTimeout(1400)
  await page.click('#mcDeseoResultados [data-desear="sv2-269"]')
  await page.waitForTimeout(500)
  check('sale la ventana del idioma, con «Cualquiera» marcado', (await page.$eval('#iddDialogo', (d) => d.open)) && (await page.$eval('#iddDialogo .mc-idioma-chip.activo', (c) => c.dataset.idioma)) === '')
  check('  …y el nombre de la carta', /Iono/.test(await page.textContent('#iddCarta')), await page.textContent('#iddCarta'))
  await page.click('#iddDialogo .mc-idioma-chip[data-idioma="es"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1500)
  check('se apunta en español', (await misDeseos(page)).join() === 'sv2-269:es', (await misDeseos(page)).join())
  check('  …sale en la rejilla y la búsqueda se queda', (await quiero(page)).join() === 'sv2-269' && (await page.inputValue('#mcDeseoBuscar')) === 'iono')
  await page.click('[data-deseo-mercado="JP"]')
  await page.fill('#mcDeseoBuscar', 'charizard')
  await page.waitForTimeout(1400)
  await page.click('#mcDeseoResultados [data-desear="SV2a-201"]')
  await page.waitForTimeout(500)
  const chips = await page.$$eval('#iddDialogo .mc-idioma-chip', (cs) => cs.map((c) => c.dataset.idioma))
  check('una japonesa: solo «Japonés»', chips.join() === 'ja', chips.join())
  await page.click('#iddApuntar')
  await page.waitForTimeout(1500)
  check('  …apuntada en japonés', (await misDeseos(page)).includes('SV2a-201:ja'), (await misDeseos(page)).join())
  await page.fill('#mcDeseoBuscar', '')
  await page.click('[data-deseo-mercado="WEST"]')
  await page.fill('#mcDeseoBuscar', 'pikachu')
  await page.waitForTimeout(1400)
  await page.click('#mcDeseoResultados [data-desear="sv8-238"]')
  await page.waitForTimeout(400)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(800)
  check('Escape no apunta nada', !(await misDeseos(page)).some((d) => d.startsWith('sv8-238')), (await misDeseos(page)).join())
  check('  …y el resultado se puede volver a tocar', await page.$eval('#mcDeseoResultados [data-desear="sv8-238"]', (b) => !b.disabled))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. El corazón de la ficha y el de /carta también preguntan ──')
{
  const { ctx, page, errores } = await abrir({ extra: { __FAKE_DESEOS__: [] } })
  await ir(page, '/mi-coleccion.html?ver=album&set=sv8')
  await page.locator('#mcAlbum [data-carta="sv8-238"]').first().click()
  await page.waitForTimeout(900)
  await page.click('#mcEdQuiero')
  await page.waitForTimeout(500)
  check('la ficha: ventana del idioma', await page.$eval('#iddDialogo', (d) => d.open))
  await page.click('#iddDialogo .mc-idioma-chip[data-idioma="fr"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('  …y se apunta en francés', (await misDeseos(page)).join() === 'sv8-238:fr', (await misDeseos(page)).join())
  check('  …la loseta dice «La quieres»', (await page.getAttribute('#mcEdQuiero', 'aria-pressed')) === 'true')
  await page.goto(`${BASE}/carta.html?id=sv2-269`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  await page.click('#cmQuiero')
  await page.waitForTimeout(500)
  check('/carta: también la ventana', await page.$eval('#iddDialogo', (d) => d.open))
  await page.click('#iddCancelar')
  await page.waitForTimeout(800)
  check('  …y cancelar deja el corazón sin pulsar', (await page.getAttribute('#cmQuiero', 'aria-pressed')) === 'false' && !(await misDeseos(page)).some((d) => d.startsWith('sv2-269')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 7. En el iPhone ──')
{
  const { ctx, page, errores } = await abrir({ movil: true, extra: { __FAKE_DESEOS__: MIOS } })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.waitForTimeout(800)
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('sin irse de ancho', ancho <= 1, String(ancho))
  check('dos columnas', (await page.$eval('#mcQuieroRejilla', (r) => getComputedStyle(r).gridTemplateColumns.split(' ').length)) === 2)
  await page.fill('#mcDeseoBuscar', 'iono')
  await page.waitForTimeout(1400)
  await page.click('#mcDeseoResultados [data-desear="sv2-269"]')
  await page.waitForTimeout(500)
  const r = await page.$eval('#iddDialogo', (d) => ({ bottom: Math.round(d.getBoundingClientRect().bottom), vh: innerHeight }))
  check('la ventana del idioma, desde abajo', Math.abs(r.bottom - r.vh) <= 2, JSON.stringify(r))
  const altos = await page.$$eval('#iddDialogo .mc-idioma-chip', (cs) => cs.map((c) => Math.round(c.getBoundingClientRect().height)))
  check('  …con chips de 44', altos.every((h) => h >= 44), altos.join())
  if (CAPS) await page.screenshot({ path: `${CAPS}/771-movil-idioma.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
