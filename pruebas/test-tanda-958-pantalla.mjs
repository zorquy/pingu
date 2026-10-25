// Tanda 958, en pantalla: el Duskull SH2 de Stormfront es Holo en español y
// Reverse en inglés; desde la 1006 la hoja de añadir enseña las dos y la
// versión elegida apaga los idiomas en que no salió (en Mi colección y en
// /carta). En /admin, la matriz de una carta escribe por la
// función con `p_carta`.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const SETS = [{ id: 'dp7', name: 'Stormfront', serie_id: 'dp', market: 'WEST', release_date: '2008-11-05', card_count_official: 100 }]
const carta = (id, n, nombre, rarity, variants) => ({ id, market: 'WEST', set_id: 'dp7', local_id: String(n), name: nombre, name_es: nombre, name_en: nombre, image_path: `x/${id}`, rarity, category: 'Pokemon', variants, tcg_sets: { id: 'dp7', name: 'Stormfront', serie_id: 'dp', release_date: '2008-11-05' } })
const CARTAS = [
  carta('dp7-SH2', 'SH2', 'Duskull', 'Rare Holo LV.X', { holo: true }),
  carta('dp7-50', 50, 'Gastly', 'Common', { normal: true, reverse: true }),
]
const IDIOMAS_SET = { dp7: ['de', 'en', 'es', 'fr', 'it'] }
const VERSION_IDIOMA = [
  { set_id: 'dp7', card_id: '', variante: 'reverse', idioma: 'es', hay: false },
  ...['en', 'fr', 'de', 'it'].flatMap((idioma) => [
    { set_id: 'dp7', card_id: 'dp7-SH2', variante: 'reverse', idioma, hay: true },
    { set_id: 'dp7', card_id: 'dp7-SH2', variante: 'holo', idioma, hay: false },
  ]),
]

const browser = await chromium.launch()
async function abrir({ conWorker = false, version = VERSION_IDIOMA } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', ...(conWorker ? {} : { serviceWorkers: 'block' }) })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PERFILES__ = [{ id: 'admin-1', username: 'pingu', is_admin: true }]
    window.__FAKE_PRECIOS__ = []
    window.__FAKE_VERSIONES__ = []
    window.__FAKE_ERAS__ = []
    window.__FAKE_IDIOMAS_SET__ = d.IDIOMAS_SET
    window.__FAKE_IDIOMAS_MANO__ = []
    window.__FAKE_VERSION_IDIOMA__ = d.version
  }, { SETS, CARTAS, IDIOMAS_SET, version })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  page.on('dialog', (d) => d.accept())
  return { ctx, page, errores }
}
const ir = async (page, ruta) => { await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(2400) }
const versiones = (page, sel) => page.$$eval(`${sel} option`, (os) => os.map((o) => o.value).join())
const idioma = async (page, sel, l) => { await page.click(`${sel} .mc-idioma-chip[data-idioma="${l}"]`); await page.waitForTimeout(250) }

// Desde la 1006 la versión manda: las dos versiones a la vista, sin aviso, y
// cada una deja tocar solo los idiomas en que salió.
const apagados = (page, sel) => page.$$eval(`${sel} .mc-idioma-chip`, (cs) => cs.filter((c) => c.disabled).map((c) => c.dataset.idioma).join())
const activo = (page, sel) => page.$eval(`${sel} .mc-idioma-chip.activo`, (c) => c.dataset.idioma).catch(() => '')
const elegir = async (page, pre, v) => {
  if (await page.locator(`#${pre}Elegir`).isHidden()) await page.click(`#${pre}VersionFija [data-vp-cambiar]`)
  await page.click(`#${pre}Elegir [data-vp-version="${v}"]`)
  await page.waitForTimeout(250)
}

console.log('── Mi colección: el Duskull SH2 ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=dp7')
  await page.click('#mcAlbum .mc-mas[data-anadir="dp7-SH2"]')
  await page.waitForTimeout(900)
  check('las dos versiones a la vista: Holo y Reverse, sin aviso', (await versiones(page, '#mcAdVariante')) === 'holo,reverse' && (await page.locator('#mcAdAvisoIdioma').count()) === 0, await versiones(page, '#mcAdVariante'))
  await elegir(page, 'mcAd', 'holo')
  check('con la Holo, solo el español se puede tocar', (await apagados(page, '#mcAdIdiomas')) === 'en,fr,de,it' && (await activo(page, '#mcAdIdiomas')) === 'es', `${await apagados(page, '#mcAdIdiomas')} · ${await activo(page, '#mcAdIdiomas')}`)
  await elegir(page, 'mcAd', 'reverse')
  check('con la Reverse, el español no, y el idioma salta a uno que vale', (await apagados(page, '#mcAdIdiomas')) === 'es' && (await activo(page, '#mcAdIdiomas')) !== 'es', `${await apagados(page, '#mcAdIdiomas')} · ${await activo(page, '#mcAdIdiomas')}`)
  const fija = await page.locator('#mcAdVersionFija').textContent().catch(() => '')
  check('  …y la versión que se enseña es la Reverse', /Reverse/.test(fija || ''), fija)
  await idioma(page, '#mcAdIdiomas', 'it')
  check('  …tocar el italiano no cambia la versión', (await page.locator('#mcAdVariante').inputValue()) === 'reverse' && (await activo(page, '#mcAdIdiomas')) === 'it')
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(900)
  const linea = await page.evaluate(() => window.__TABLAS__.user_collection.find((l) => l.card_id === 'dp7-SH2'))
  check('  …y se guarda en italiano como Reverse', linea?.idioma === 'it' && linea?.variante === 'reverse', JSON.stringify(linea))
  await page.click('#mcAlbum .mc-mas[data-anadir="dp7-50"]').catch(() => {})
  await page.waitForTimeout(900)
  check('otra carta del set: Normal y Reverse', (await versiones(page, '#mcAdVariante')).split(',').sort().join() === 'normal,reverse', await versiones(page, '#mcAdVariante'))
  await elegir(page, 'mcAd', 'reverse')
  check('  …con su Reverse, el español no (lo del set)', (await apagados(page, '#mcAdIdiomas')) === 'es', await apagados(page, '#mcAdIdiomas'))
  await elegir(page, 'mcAd', 'normal')
  check('  …y con la Normal, todos', (await apagados(page, '#mcAdIdiomas')) === '', await apagados(page, '#mcAdIdiomas'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── /carta ──')
{
  const { ctx, page, errores } = await abrir()
  await page.goto(`${BASE}/carta.html?id=dp7-SH2`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  await page.click('#cmAnadir')
  await page.waitForTimeout(900)
  check('las dos versiones, sin aviso', (await versiones(page, '#cmAdVariante')).split(',').sort().join() === 'holo,reverse' && (await page.locator('#cmAdAvisoIdioma').count()) === 0, await versiones(page, '#cmAdVariante'))
  await elegir(page, 'cmAd', 'holo')
  check('con la Holo, solo el español', (await apagados(page, '#cmAdIdiomas')) === 'en,fr,de,it' && (await activo(page, '#cmAdIdiomas')) === 'es', await apagados(page, '#cmAdIdiomas'))
  await elegir(page, 'cmAd', 'reverse')
  check('con la Reverse, todos menos el español', (await apagados(page, '#cmAdIdiomas')) === 'es' && (await activo(page, '#cmAdIdiomas')) !== 'es', await apagados(page, '#cmAdIdiomas'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── /admin: la matriz de una carta ──')
{
  const { ctx, page: p, errores } = await abrir({ conWorker: true, version: [{ set_id: 'dp7', card_id: '', variante: 'reverse', idioma: 'es', hay: false }] })
  await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  await p.locator('[data-section="colecciones"]').click()
  await p.waitForTimeout(800)
  // 975: las eras salen plegadas; se despliegan para tocar «Editar».
  await p.locator('#coleccionesDesplegar').click()
  await p.locator('[data-editar="dp7"]').click()
  await p.waitForTimeout(1000)
  await p.click('#idiVersiones')
  await p.waitForTimeout(1200)
  check('debajo de la del set sale el selector de carta', await p.locator('#vpiCarta').isVisible())
  await p.selectOption('#vpiCarta', 'dp7-SH2')
  await p.waitForTimeout(400)
  const celda = (v, l) => p.locator(`[data-vpc-v="${v}"][data-vpc-l="${l}"]`)
  const txt = async (v, l) => ((await celda(v, l).textContent()) || '').trim()
  check('la carta, sin nada puesto: Holo ✓ y Reverse ✕ en inglés', (await txt('holo', 'en')) === '✓' && (await txt('reverse', 'en')) === '✕')
  for (const l of ['en', 'fr']) {
    await celda('reverse', l).click(); await p.waitForTimeout(400)
    await celda('holo', l).click(); await p.waitForTimeout(400)
  }
  const filas = await p.evaluate(() => window.__TABLAS__.tcg_version_idioma.filter((f) => f.card_id === 'dp7-SH2').map((f) => `${f.variante}:${f.idioma}:${f.hay}`).sort().join())
  check('poner la Reverse y quitar la Holo escribe en la carta', filas === 'holo:en:false,holo:fr:false,reverse:en:true,reverse:fr:true', filas)
  check('  …y se ve con borde (puesto en la carta)', (await txt('reverse', 'en')) === '✓' && (await txt('holo', 'en')) === '✕' && /vpi-propia/.test(await celda('reverse', 'en').getAttribute('class')))
  check('  …el español, como el set', (await txt('holo', 'es')) === '✓' && (await txt('reverse', 'es')) === '✕')
  check('  …y la matriz del set no cambia', ((await p.locator('[data-vpi-v="holo"][data-vpi-l="en"]').textContent()) || '').trim() === '✓')
  await celda('reverse', 'fr').click(); await p.waitForTimeout(400)
  const filas2 = await p.evaluate(() => window.__TABLAS__.tcg_version_idioma.filter((f) => f.card_id === 'dp7-SH2' && f.idioma === 'fr').map((f) => `${f.variante}:${f.hay}`).sort().join())
  check('tocar otra vez una puesta la devuelve a lo del set (borra la fila)', filas2 === 'holo:false', filas2)
  check('el selector marca las cartas con algo puesto y las pone primero', /^• /.test(await p.locator('#vpiCarta option:nth-child(2)').textContent()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
