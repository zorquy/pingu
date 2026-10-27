// Tanda 940 — Deseos y cambios, tanda 1 de la propuesta «Cambios en PokeDoc».
//
// PINGU: «cuando recargas la página deseos y cambios o vas para atrás las
// cartas ya no cargan las imágenes y el pop-up ya no sale bien»; el pop-up
// «debería ser en un lado… para que las cartas no cambien de columnas»; y
// «el cruce debería estar con él, no con esa carta». Lo que se mira:
//   1. Con la colección llegando tarde (lo normal al recargar), el Mercado
//      sigue con foto, nombre y precio, y la ficha sale entera.
//   2. La ficha va encima y a un lado también a 1280 px: no mueve ni una
//      baldosa, marca la abierta, cambia al tocar otra, ← y →, Esc y fuera.
//   3. La quiero, Las que doy y Cruces abren esa ficha sin salir de la
//      página; en Las que doy, quién la BUSCA, con el cruce de esa persona.
//   4. En el iPhone, la hoja de siempre.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
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


const rects = (page) => page.$$eval('#mcMercadoRejilla .mc-merc', (as) => as.map((a) => { const r = a.getBoundingClientRect(); return `${a.dataset.merc}@${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.width)}` }))
const ficha = (page) => page.evaluate(() => { const d = document.getElementById('mcMercadoFicha'); return { open: d.open, lado: d.classList.contains('mc-prodf-al-lado'), modal: d.matches(':modal'), titulo: document.getElementById('mcMercadoFichaTitulo').textContent, cuerpo: document.getElementById('mcMercadoFichaCuerpo').innerText.replace(/\s+/g, ' ') } })

console.log('── 1. Recargar con la colección llegando tarde ──')
{
  const { ctx, page, errores } = await abrir({ ancho: 1280, extra: { __FAKE_RETRASO__: { user_collection: 1500 } } })
  await ir(page)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  const b = await page.$$eval('#mcMercadoRejilla .mc-merc', (as) => as.map((a) => ({ id: a.dataset.merc, img: Boolean(a.querySelector('.mc-merc-foto img')), nombre: a.querySelector('.mc-merc-nombre')?.textContent || '', precio: a.querySelector('.mc-merc-precio')?.textContent || '' })))
  // Desde la 1038 el Mercado enseña los dos catálogos: las cuatro occidentales y la japonesa.
  check('cuatro baldosas occidentales y la japonesa, todas con su foto', b.length === 5 && b.every((x) => x.img), JSON.stringify(b))
  check('  …con su nombre (no el código de la carta)', b.every((x) => x.nombre && x.nombre !== x.id), JSON.stringify(b.map((x) => x.nombre)))
  check('  …y su precio (las occidentales)', b.filter((x) => !x.id.startsWith('SV2a')).every((x) => /€/.test(x.precio)), JSON.stringify(b.map((x) => x.precio)))
  await page.click('[data-merc-ficha="swsh7-215"]')
  await page.waitForTimeout(1200)
  const f = await ficha(page)
  check('la ficha sale entera: título, set, precio y quién la da', f.titulo === 'Umbreon VMAX' && /Cielos Evolutivos/.test(f.cuerpo) && /612,00/.test(f.cuerpo) && /La dan 2 personas/i.test(f.cuerpo), JSON.stringify(f))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. La ficha, centrada (1056; era a un lado) ──')
{
  const { ctx, page, errores } = await abrir({ ancho: 1280 })
  await ir(page)
  const antes = await rects(page)
  await page.click('[data-merc-ficha="sv2-269"]')
  await page.waitForTimeout(1200)
  let f = await ficha(page)
  // 1056 (PINGU: «los pop-ups mejoran en el centro»): modal y centrada.
  check('a 1280 px se abre centrada y modal', f.open && !f.lado && f.modal, JSON.stringify(f))
  check('  …y ninguna baldosa se mueve ni cambia de tamaño', JSON.stringify(await rects(page)) === JSON.stringify(antes), JSON.stringify([antes, await rects(page)]))
  check('  …la abierta va marcada', (await page.locator('[data-merc="sv2-269"].abierta').count()) === 1 && (await page.locator('.mc-merc.abierta').count()) === 1)
  check('  …Lucía, «Cruce contigo», la primera', /Lucía Cruce contigo/.test(f.cuerpo.split(/La dan/i)[1] || ""), f.cuerpo)
  // Modal: para abrir otra, se cierra y se toca.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.click('[data-merc-ficha="sv3pt5-199"]')
  await page.waitForTimeout(1000)
  f = await ficha(page)
  check('cerrar y tocar otra carta abre la suya', f.open && f.titulo === 'Charizard ex' && (await page.locator('[data-merc="sv3pt5-199"].abierta').count()) === 1, JSON.stringify(f))
  const orden = await page.$$eval('#mcMercadoRejilla .mc-merc', (as) => as.map((a) => a.dataset.merc))
  const i = orden.indexOf('sv3pt5-199')
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(900)
  f = await ficha(page)
  check('→ pasa a la carta de al lado', orden[i + 1] && (await page.locator(`[data-merc="${orden[i + 1]}"].abierta`).count()) === 1, `${orden.join()} · ${f.titulo}`)
  await page.keyboard.press('ArrowLeft')
  await page.waitForTimeout(900)
  check('← vuelve', (await ficha(page)).titulo === 'Charizard ex')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check('Esc la cierra y quita la marca', !(await ficha(page)).open && (await page.locator('.mc-merc.abierta').count()) === 0)
  await page.click('[data-merc-ficha="sv2-269"]')
  await page.waitForTimeout(900)
  await page.mouse.click(300, 160)
  await page.waitForTimeout(300)
  check('tocar fuera la cierra', !(await ficha(page)).open)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. La quiero, Las que doy y Cruces, sin salir de la página ──')
{
  const { ctx, page, errores } = await abrir({ ancho: 1280 })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  const url = page.url()
  await page.click('#mcQuieroPanel [data-deseo-carta="swsh7-215"] .mc-merc-abrir')
  await page.waitForTimeout(1300)
  let f = await ficha(page)
  check('La quiero: la ficha de quién la da, y la página no cambia', page.url() === url && f.open && f.modal && /La dan 2 personas/i.test(f.cuerpo), `${page.url()} ${JSON.stringify(f)}`)
  await page.keyboard.press('Escape')
  await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
  await page.waitForTimeout(1200)
  await page.click('#mcDoyPanel .mc-merc-abrir[data-carta="sv3pt5-151"]')
  await page.waitForTimeout(1300)
  f = await ficha(page)
  check('Las que doy: quién la BUSCA (Lucía)', page.url() === url && f.open && /La busca 1 persona/i.test(f.cuerpo) && /Lucía/.test(f.cuerpo), JSON.stringify(f))
  check('  …con su cruce: da algo que buscas (Umbreon)', /Cruce contigo/.test(f.cuerpo) && /Da 1 de las que buscas/.test(f.cuerpo), f.cuerpo)
  check('  …y lo que das tú de esa', /Das 1 copia/.test(f.cuerpo), f.cuerpo)
  await Promise.all([page.waitForURL(/mensajes\.html/), page.click('#mcMercadoFichaCuerpo [data-merf-escribir="user-1"]')])
  const u = new URL(page.url())
  check('  …«Escribir» le dice que la das', /buscas estas cartas y las doy/.test(u.searchParams.get('texto') || '') && /Mew ex/.test(u.searchParams.get('texto') || ''), u.searchParams.get('texto'))
  await ir(page, '/mi-coleccion.html?ver=cambios')
  const u2 = page.url()
  const carta = page.locator('#mcCambiosPanel [data-cruce-lado="da"] .mc-cruce-carta').first()
  check('Cruces: las dos mitades dicen cuál es cuál', (await page.locator('#mcCambiosPanel [data-cruce-lado="da"]').count()) > 0 && (await page.locator('#mcCambiosPanel [data-cruce-lado="busca"]').count()) > 0)
  await carta.click()
  await page.waitForTimeout(1300)
  f = await ficha(page)
  check('  …y una carta abre la ficha aquí mismo', page.url() === u2 && f.open, `${page.url()} ${JSON.stringify(f)}`)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. En el iPhone, la hoja de siempre ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await ir(page)
  await page.click('[data-merc-ficha="sv2-269"]')
  await page.waitForTimeout(1600)
  const f = await ficha(page)
  check('se abre como hoja (modal), no a un lado', f.open && f.modal && !f.lado, JSON.stringify(f))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
