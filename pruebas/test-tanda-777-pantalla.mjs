// Tanda 777 — lo que das, de los DOS catálogos.
//
// PINGU: «tengo algunas cartas del mercado japonés puestas para cambio,
// pero no salen en cambios». «Las que doy» contaba solo `lineas`, que son
// las del catálogo elegido en la página (Pokémon, de entrada): las japonesas
// no salían ni en la rejilla, ni en la cuenta, ni en el Panel, ni en los
// cruces —que en el servidor sí casan, por id—, y en los cruces su carta
// se buscaba solo en el catálogo elegido, así que salía sin foto ni nombre.
// Es la 485 otra vez: lo que es de TODA la colección no se mira por catálogo.
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

// Doy Mew ex (1 de 1) y Iono (1 de 3); Lucía busca Mew ex y da Umbreon
// (que busco): cruce perfecto. Íker da Umbreon: solo «te da». Dani busca
// Iono: solo «le das».
const MIA = [
  { id: 'm1', user_id: 'admin-1', card_id: 'sv3pt5-151', market: 'WEST', cantidad: 1, cambio: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-07T10:00:00Z' },
  { id: 'm2', user_id: 'admin-1', card_id: 'sv2-269', market: 'WEST', cantidad: 3, cambio: 1, idioma: 'es', estado: 'EX', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-07T09:00:00Z' },
  { id: 'm3', user_id: 'admin-1', card_id: 'sv8-238', market: 'WEST', cantidad: 2, cambio: 0, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-07T09:00:00Z' },
]
// Y una japonesa a cambio, que Marta busca (777).
MIA.push({ id: 'm4', user_id: 'admin-1', card_id: 'SV2a-201', market: 'JP', cantidad: 2, cambio: 1, idioma: 'ja', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-07T08:00:00Z' })
const OTRAS = COLECCION.filter((l) => l.user_id !== 'admin-1')
const BUSCAN = [
  { id: 'd1', user_id: 'admin-1', card_id: 'swsh7-215', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
  { id: 'd2', user_id: 'user-1', card_id: 'sv3pt5-151', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
  { id: 'd3', user_id: 'user-2', card_id: 'sv2-269', idioma: 'es', prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
  { id: 'd4', user_id: 'user-3', card_id: 'SV2a-201', idioma: null, prioridad: 1, created_at: '2026-10-05T10:00:00Z' },
]
const extra = { __FAKE_PRECIOS__: [...PRECIOS, { card_id: 'sv3pt5-151', cm_low: 21.4 }], __FAKE_COLECCION__: [...MIA, ...OTRAS], __FAKE_DESEOS__: BUSCAN, __FAKE_SEGUIDOS__: [{ following_id: 'user-2' }] }
const doy = (page) => page.$$eval('#mcDoyRejilla .mc-doy-baldosa', (as) => as.map((a) => a.dataset.doyLinea))
const cambioDe = (page, id) => page.evaluate((id) => window.__TABLAS__.user_collection.find((l) => l.id === id)?.cambio, id)


console.log('── 1. Las que doy, con el catálogo occidental puesto ──')
{
  const { ctx, page, errores } = await abrir({ extra })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
  await page.waitForTimeout(1500)
  check('salen las tres, la japonesa también', (await doy(page)).sort().join() === 'm1,m2,m4', (await doy(page)).join())
  const jp = await page.$eval('[data-doy-linea="m4"]', (a) => a.innerText.replace(/\s+/g, ' '))
  check('  …con su nombre, su set y «Doy 1 de 2»', /リザードン|Charizard/.test(jp) && /151/.test(jp) && /Doy 1 de 2/.test(jp), jp)
  check('  …con su foto', await page.$eval('[data-doy-linea="m4"] img', (i) => Boolean(i.getAttribute('src'))).catch(() => false))
  check('  …y quién la busca (Marta)', /La busca 1/.test(jp), jp)
  check('la cuenta del selector: 3', (await page.textContent('#mcPanelQuiero [data-deseos-n="doy"]')) === '3')
  await page.click('[data-doy-mas="m4"]')
  await page.waitForTimeout(1200)
  check('+ en la japonesa: da 2 (en la base)', (await cambioDe(page, 'm4')) === 2)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. En los cruces ──')
{
  const { ctx, page, errores } = await abrir({ extra })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.waitForTimeout(1500)
  const quien = await page.$$eval('#mcCambiosPanel .mc-cruce', (cs) => cs.map((c) => c.dataset.cruce))
  check('Marta sale (busca tu japonesa)', quien.includes('user-3'), quien.join())
  const marta = await page.$eval('[data-cruce="user-3"]', (c) => c.innerText.replace(/\s+/g, ' ')).catch(() => '')
  check('  …con la carta por su nombre, no por su id', /le das/i.test(marta) && /リザードン|Charizard/.test(marta) && !/SV2a-201/.test(marta), marta)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Con el catálogo japonés puesto, las occidentales siguen ──')
{
  const { ctx, page, errores } = await abrir({ extra })
  await ir(page, '/mi-coleccion.html?ver=quiero&catalogo=JP')
  await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
  await page.waitForTimeout(1500)
  check('las tres', (await doy(page)).sort().join() === 'm1,m2,m4', (await doy(page)).join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
