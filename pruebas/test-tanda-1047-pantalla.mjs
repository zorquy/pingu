// Tanda 1047 — «La quiero» con versión.
//
// Del foro: «cuando doy al corazón para tenerlo en la lista de deseos, no
// puedo seleccionar si quiero la variante holo o normal». Lo que se mira:
//   · la ventana del corazón pregunta la versión cuando la carta tiene más
//     de una que se sabe (y no la pregunta cuando no);
//   · «La quiero» pinta una baldosa por carta Y versión, dice cuál, cuenta
//     quién da ESA, y el corazón de una quita solo esa;
//   · tocar la línea de idioma y versión cambia lo que pediste (C1);
//   · los cruces casan por versión y la enseñan;
//   · sin la migración (sin la columna) todo sigue como antes;
//   · /carta pregunta lo mismo, y en el iPhone la hoja sale de abajo.
// Y lo puro (casaVersion, la agrupación, los sellos del perfil) en Node.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''

console.log('── 0. Lo puro ──')
{
  const v = await import(`${RAIZ}/js/deseo-version.js`)
  check('«cualquiera» casa con todo', v.casaVersion({ variante: null }, { variante: 'holo' }) && v.casaVersion({}, { variante: 'reverse' }))
  check('  …una versión, solo con esa (y sin versión la copia es la normal)', v.casaVersion({ variante: 'holo' }, { variante: 'holo' }) && !v.casaVersion({ variante: 'holo' }, { variante: 'normal' }) && v.casaVersion({ variante: 'normal' }, {}) && !v.casaVersion({ variante: 'holo' }, {}))
  const g = v.deseosPorCartaYVersion([
    { id: 1, card_id: 'a', variante: 'holo', idioma: null },
    { id: 2, card_id: 'a', variante: null, idioma: 'es' },
    { id: 3, card_id: 'a', variante: 'holo', idioma: 'en' },
    { id: 4, card_id: 'b', idioma: null },
  ])
  check('una baldosa por carta y versión; los idiomas de una versión, juntos', g.map((x) => `${x.card_id}|${x.variante || '*'}:${x.filas.length}`).join() === 'a|holo:2,a|*:1,b|*:1', JSON.stringify(g.map((x) => [x.card_id, x.variante, x.filas.length])))
  check('faltaVariante: 42703 y PGRST204 de ESA columna', v.faltaVariante({ code: '42703', message: 'column user_wants.variante does not exist' }) && v.faltaVariante({ code: 'PGRST204', message: "Could not find the 'variante' column of 'user_wants' in the schema cache" }) && !v.faltaVariante({ code: '42703', message: 'column user_wants.notas does not exist' }) && !v.faltaVariante(null))
  // conVariante: pide con la columna; si la base dice que no existe, sin ella, y ya no la vuelve a pedir.
  v._ponerHay(null)
  const pedidas = []
  const r1 = await v.conVariante('id,card_id', async (cols) => { pedidas.push(cols); return cols.includes('variante') ? { data: null, error: { code: '42703', message: 'column user_wants.variante does not exist' } } : { data: [{ id: 1 }], error: null } })
  const r2 = await v.conVariante('id,card_id', async (cols) => { pedidas.push(cols); return { data: [], error: null } })
  check('sin la columna: se vuelve a pedir sin ella, y la siguiente ya va sin ella', r1.data?.length === 1 && pedidas.join(' | ') === 'id,card_id,variante | id,card_id | id,card_id' && v.hayVariante() === false, pedidas.join(' | '))
  v._ponerHay(null)
  await v.conVariante('id', async () => ({ data: [], error: null }))
  check('  …con ella, se sabe que está', v.hayVariante() === true)

  const p = await import(`${RAIZ}/js/perfil-cambios-puro.js`)
  const da = p.porCarta([{ card_id: 'a', idioma: 'es', variante: 'normal', cambio: 1 }])
  check('perfil: lo que da guarda sus versiones', da[0].variantes.join() === 'normal' && da[0].cualquierVersion === false)
  check('  …«La buscas» si buscas cualquiera o esa; no si buscas otra', p.selloDeLoQueDa(da[0], [{ card_id: 'a', idioma: null }]) === 'La buscas' && p.selloDeLoQueDa(da[0], [{ card_id: 'a', variante: 'normal' }]) === 'La buscas' && p.selloDeLoQueDa(da[0], [{ card_id: 'a', variante: 'holo' }]) === null)
  const busca = p.porCarta([{ card_id: 'a', idioma: null, variante: 'holo' }], { sumar: 'x' })
  check('  …«La das» solo si das la versión que busca', p.selloDeLoQueBusca(busca[0], [{ card_id: 'a', idioma: 'es', variante: 'holo', cambio: 1 }]) === 'La das' && p.selloDeLoQueBusca(busca[0], [{ card_id: 'a', idioma: 'es', variante: 'normal', cambio: 1 }]) === 'La tienes')
  const cualquiera = p.porCarta([{ card_id: 'a', idioma: null }], { sumar: 'x' })
  check('  …y si busca cualquiera, cualquiera vale', p.selloDeLoQueBusca(cualquiera[0], [{ card_id: 'a', idioma: 'es', variante: 'reverse', cambio: 1 }]) === 'La das')
}

const SETS = [
  { id: 'mcd21', name: "McDonald's Collection 2021", serie_id: 'swsh', market: 'WEST', release_date: '2021-02-09', card_count_official: 25 },
  { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191 },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, nombre, variants, extra = {}) => ({ id, market: 'WEST', set_id: set, local_id: String(n), name: nombre, name_es: nombre, image_path: `x/${id}`, rarity: 'Common', category: 'Pokemon', variants, tcg_sets: { id: set, name: setDe(set).name, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date }, ...extra })
const CARTAS = [
  carta('mcd21-2', 'mcd21', 2, 'Chikorita', { normal: true, holo: true }),
  carta('mcd21-3', 'mcd21', 3, 'Cyndaquil', { normal: true, holo: true }),
  // Una sola versión: no hay nada que elegir.
  carta('sv8-238', 'sv8', 238, 'Pikachu ex', { holo: true }, { rarity: 'Special Illustration Rare' }),
]
const U = (n) => `user-${n}`
const PERFILES = [{ id: 'admin-1', username: 'pingu' }, { id: U(1), username: 'lucia_tcg', display_name: 'Lucía' }, { id: U(2), username: 'danipoke', display_name: 'Dani' }]
const linea = (id, user, card, idioma, variante, cambio) => ({ id, user_id: user, card_id: card, market: 'WEST', cantidad: Math.max(1, cambio), cambio, idioma, estado: 'NM', variante, created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-20T10:00:00Z' })
// Lucía da la Chikorita HOLO; Dani, la NORMAL. Yo doy un Cyndaquil normal.
const COLECCION = [
  linea('c1', U(1), 'mcd21-2', 'es', 'holo', 1),
  linea('c2', U(2), 'mcd21-2', 'es', 'normal', 1),
  linea('m1', 'admin-1', 'mcd21-3', 'es', 'normal', 1),
]
const PRECIOS = [{ card_id: 'mcd21-2', cm_low: 0.5, cm_low_holo: 3 }]

const browser = await chromium.launch()
async function abrir({ movil = false, deseos = [], extra = {} } = {}) {
  const ctx = await browser.newContext({ ...(movil ? { ...devices['iPhone 13'] } : { viewport: { width: 1440, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = d.COLECCION
    window.__FAKE_DESEOS__ = d.deseos
    window.__FAKE_PERFILES__ = d.PERFILES
    window.__FAKE_PRECIOS__ = d.PRECIOS
    Object.assign(window, d.extra)
  }, { SETS, CARTAS, COLECCION, PERFILES, PRECIOS, deseos, extra })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  return { ctx, page, errores }
}
const ir = async (page, ruta) => {
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
}
const misDeseos = (page) => page.evaluate(() => window.__TABLAS__.user_wants.filter((d) => d.user_id === 'admin-1').map((d) => `${d.card_id}:${d.idioma || '*'}:${d.variante || '*'}`).sort())
const versiones = (page) => page.$$eval('#iddVersiones [data-variante]', (bs) => bs.map((b) => b.dataset.variante || '*'))
const abierto = (page) => page.$eval('#iddDialogo', (d) => d.open).catch(() => false)
const deseo = (id, card, variante, idioma = null) => ({ id, user_id: 'admin-1', card_id: card, idioma, variante, prioridad: 1, created_at: `2026-10-2${id.slice(-1)}T10:00:00Z` })

console.log('── 1. El corazón de la ficha pregunta la versión ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=mcd21')
  await page.locator('#mcAlbum [data-carta="mcd21-2"]').first().click()
  await page.waitForTimeout(900)
  await page.click('#mcEdQuiero')
  await page.waitForTimeout(700)
  check('sale la ventana, «¿Cómo la quieres?»', (await abierto(page)) && (await page.textContent('#iddTitulo')) === '¿Cómo la quieres?', await page.textContent('#iddTitulo'))
  check('  …con la fila de versión: Cualquiera, Normal y Holo', (await versiones(page)).join() === '*,normal,holo', (await versiones(page)).join())
  check('  …«Cualquiera» marcada de entrada (A1)', (await page.$eval('#iddVersiones .activo', (b) => b.dataset.variante)) === '')
  check('  …y el rótulo «Idioma» encima de los idiomas', await page.isVisible('#iddIdiomaRot'))
  await page.click('#iddVersiones [data-variante="holo"]')
  if (CAPS) await page.screenshot({ path: `${CAPS}/1047-ventana-pc.png` })
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('se apunta la Holo, en cualquier idioma', (await misDeseos(page)).join() === 'mcd21-2:*:holo', (await misDeseos(page)).join())
  check('  …y la loseta dice «La quieres»', (await page.getAttribute('#mcEdQuiero', 'aria-pressed')) === 'true')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Con una sola versión no se pregunta ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html?ver=album&set=sv8')
  await page.locator('#mcAlbum [data-carta="sv8-238"]').first().click()
  await page.waitForTimeout(900)
  await page.click('#mcEdQuiero')
  await page.waitForTimeout(700)
  check('la ventana de siempre («¿En qué idioma…?»), sin fila de versión', (await abierto(page)) && /idioma/.test(await page.textContent('#iddTitulo')) && (await page.$eval('#iddVersionBloque', (b) => b.hidden)))
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('  …y se apunta sin versión', (await misDeseos(page)).join() === 'sv8-238:*:*', (await misDeseos(page)).join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. «La quiero»: una baldosa por versión ──')
{
  const { ctx, page, errores } = await abrir({ deseos: [deseo('d1', 'mcd21-2', 'holo'), deseo('d2', 'mcd21-2', 'normal', 'es')] })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.waitForTimeout(900)
  const tiles = await page.$$eval('#mcQuieroRejilla .mc-deseo-baldosa', (as) => as.map((a) => ({ carta: a.dataset.deseoCarta, texto: a.innerText.replace(/\s+/g, ' ') })))
  check('dos baldosas de la Chikorita', tiles.length === 2 && tiles.every((t) => t.carta === 'mcd21-2'), JSON.stringify(tiles))
  const holo = tiles.find((t) => /Holo/.test(t.texto))?.texto || ''
  const normal = tiles.find((t) => /Normal/.test(t.texto))?.texto || ''
  check('la Holo: «Holo · Cualquier idioma» y la da 1 (Lucía)', /Holo · Cualquier idioma/.test(holo) && /La da 1/.test(holo), holo)
  check('la Normal: «Normal · Español» y la da 1 (Dani)', /Normal ·\s*Español/.test(normal) && /La da 1/.test(normal), normal)
  check('la cuenta: 2 cartas', /^2 cartas/.test((await page.textContent('#mcQuieroCifra')).trim()), await page.textContent('#mcQuieroCifra'))
  const quien = await page.$$eval('#mcQuieroRejilla .mc-deseo-baldosa', (as) => as.map((a) => [a.querySelector('.mc-deseo-version')?.textContent, [...a.querySelectorAll('.mc-gente-av')].map((x) => x.getAttribute('aria-label') || x.title || '').join('+')]))
  check('  …y cada una con su persona', JSON.stringify(quien).includes('Holo') && quien.every(([, g]) => g.split('+').length === 1), JSON.stringify(quien))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1047-quiero.png`, fullPage: true })

  console.log('── 4. Tocar la línea cambia lo pedido (C1) ──')
  await page.click('[data-cambiar-deseo="mcd21-2"][data-cambiar-version="normal"]')
  await page.waitForTimeout(700)
  check('se abre con lo puesto (Normal, español) y «Guardar»', (await abierto(page)) && (await page.$eval('#iddVersiones .activo', (b) => b.dataset.variante)) === 'normal' && (await page.$eval('#iddChips .activo', (b) => b.dataset.idioma)) === 'es' && (await page.textContent('#iddApuntar')) === 'Guardar')
  await page.click('#iddChips [data-idioma="en"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('  …y se guarda en inglés', (await misDeseos(page)).join() === 'mcd21-2:*:holo,mcd21-2:en:normal', (await misDeseos(page)).join())
  // Cambiarla a Holo en cualquier idioma chocaría con la otra: lo dice y no cambia nada.
  await page.click('[data-cambiar-deseo="mcd21-2"][data-cambiar-version="normal"]')
  await page.waitForTimeout(700)
  await page.click('#iddVersiones [data-variante="holo"]')
  await page.click('#iddChips [data-idioma=""]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('  …y la que ya tienes no se repite (aviso, sin cambios)', (await misDeseos(page)).join() === 'mcd21-2:*:holo,mcd21-2:en:normal' && /ya está en tu lista/.test(await page.textContent('body')), (await misDeseos(page)).join())

  console.log('── 5. El corazón de una baldosa quita solo esa ──')
  await page.click('[data-quitar-deseo-carta="mcd21-2"][data-quitar-deseo-version="holo"]')
  await page.waitForTimeout(1200)
  check('se va la Holo y se queda la Normal', (await misDeseos(page)).join() === 'mcd21-2:en:normal', (await misDeseos(page)).join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. Los cruces casan por versión ──')
{
  const { ctx, page, errores } = await abrir({ deseos: [deseo('d1', 'mcd21-2', 'holo')] })
  await ir(page, '/mi-coleccion.html?ver=cambios')
  await page.waitForTimeout(1200)
  const quienes = await page.$$eval('[data-cruce]', (cs) => cs.map((c) => c.dataset.cruce))
  check('sale Lucía (da la Holo) y no Dani (da la Normal)', quienes.includes(U(1)) && !quienes.includes(U(2)), quienes.join())
  check('  …y su carta lleva la chapa de la versión', (await page.locator(`[data-cruce="${U(1)}"] .mc-cruce-version`).first().textContent().catch(() => '')) === 'H')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 7. Sin la migración, como antes ──')
{
  const { ctx, page, errores } = await abrir({ deseos: [deseo('d1', 'mcd21-3', null)], extra: { __SIN_COLUMNAS__: { user_wants: ['variante'] } } })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.waitForTimeout(900)
  check('«La quiero» se carga', (await page.$$('#mcQuieroRejilla .mc-deseo-baldosa')).length === 1)
  await ir(page, '/mi-coleccion.html?ver=album&set=mcd21')
  await page.locator('#mcAlbum [data-carta="mcd21-2"]').first().click()
  await page.waitForTimeout(900)
  await page.click('#mcEdQuiero')
  await page.waitForTimeout(700)
  check('el corazón NO pregunta la versión', (await abierto(page)) && (await page.$eval('#iddVersionBloque', (b) => b.hidden)))
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('  …y apunta como antes', (await misDeseos(page)).includes('mcd21-2:*:*'), (await misDeseos(page)).join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 8. /carta pregunta lo mismo ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/carta.html?id=mcd21-3')
  await page.waitForTimeout(800)
  await page.click('#cmQuiero')
  await page.waitForTimeout(800)
  check('la ventana con Normal y Holo', (await abierto(page)) && (await versiones(page)).join() === '*,normal,holo', (await versiones(page)).join())
  await page.click('#iddVersiones [data-variante="normal"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  check('  …y apunta la Normal', (await misDeseos(page)).join() === 'mcd21-3:*:normal', (await misDeseos(page)).join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 9. En el iPhone ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await ir(page, '/mi-coleccion.html?ver=quiero')
  await page.fill('#mcDeseoBuscar', 'chikorita')
  await page.waitForTimeout(1400)
  await page.click('#mcDeseoResultados [data-desear="mcd21-2"]')
  await page.waitForTimeout(700)
  const r = await page.$eval('#iddDialogo', (d) => ({ bottom: Math.round(d.getBoundingClientRect().bottom), vh: innerHeight, alto: Math.round(d.getBoundingClientRect().height) }))
  check('la hoja sale de abajo y cabe', Math.abs(r.bottom - r.vh) <= 2 && r.alto <= r.vh, JSON.stringify(r))
  const altos = await page.$$eval('#iddVersiones [data-variante]', (cs) => cs.map((c) => Math.round(c.getBoundingClientRect().height)))
  check('  …con las versiones a 44', altos.length === 3 && altos.every((h) => h >= 44), altos.join())
  if (CAPS) await page.screenshot({ path: `${CAPS}/1047-ventana-movil.png` })
  await page.click('#iddVersiones [data-variante="holo"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1300)
  check('desde el buscador también se apunta con versión', (await misDeseos(page)).join() === 'mcd21-2:*:holo', (await misDeseos(page)).join())
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('sin irse de ancho', ancho <= 1, String(ancho))
  if (CAPS) await page.screenshot({ path: `${CAPS}/1047-quiero-movil.png`, fullPage: true })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
