// Tanda 770 — el Mercado de Deseos y cambios.
//
// PINGU: «que salga públicamente lo que la gente tiene para cambio aunque
// tú no lo desees», en una pestaña general antes de «La quiero», «Las que
// doy» y «Cruces». Lo que se mira: que «Deseos y cambios» abre el Mercado;
// que sale lo que dan LOS DEMÁS, una baldosa por carta con quién la da, en
// qué idiomas y por cuánto; «La buscas» y «Cruce»; los filtros; la ficha
// (al lado en el PC, desde abajo en el iPhone) con la lista de personas y
// «Escribir» con el mensaje redactado; el corazón con su idioma; que se ve
// sin cuenta; y la base, contra PostgreSQL (sql-mercado.sql).
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

console.log('── 1. «Deseos y cambios» abre el Mercado ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page, '/mi-coleccion.html')
  const boton = page.locator('#mcMenu [data-pestania="mercado"]')
  check('el botón del menú lleva al Mercado', (await boton.count()) === 1 && /Deseos y cambios/.test(await boton.innerText()))
  await boton.click()
  await page.waitForTimeout(1800)
  check('  …que se abre, con ?ver=mercado', (await visible(page, '#mcPanelMercado')) && new URL(page.url()).searchParams.get('ver') === 'mercado', page.url())
  const seg = await page.$$eval('#mcPanelMercado .mc-deseos-seg [data-deseos-vista]', (bs) => bs.map((b) => `${b.dataset.deseosVista}:${b.getAttribute('aria-pressed')}`))
  check('el selector: Mercado, La quiero, Las que doy y Cruces', seg.join() === 'mercado:true,quiero:false,doy:false,cruces:false', seg.join())
  const n = await page.$$eval('#mcPanelMercado [data-deseos-n]', (es) => es.map((e) => `${e.dataset.deseosN}=${e.textContent}`))
  check('  …con sus cuentas (4 a cambio, 1 quiero, 1 doy, 2 cruzan)', n.join() === 'mercado=4,quiero=1,doy=1,cruces=2', n.join())
  check('  …y el punto verde de «hay un cruce perfecto»', await visible(page, '#mcPanelMercado [data-deseos-punto]'))
  await page.click('#mcPanelMercado [data-deseos-vista="quiero"]')
  await page.waitForTimeout(600)
  check('de ahí a «La quiero», con el menú encendido', (await visible(page, '#mcPanelQuiero')) && (await page.getAttribute('#mcMenu [data-pestania="mercado"]', 'aria-selected')) === 'true')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Lo que dan los demás, por carta ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page)
  const ids = await baldosas(page)
  check('cuatro cartas: ni lo mío, ni lo de un baneado, ni lo que da 0', ids.slice().sort().join() === 'sv2-269,sv3pt5-199,sv8-238,swsh7-215', ids.join())
  check('  …lo último primero (Umbreon, hace 2 h)', ids[0] === 'swsh7-215', ids.join())
  const iono = await textoDe(page, 'sv2-269')
  check('Iono: «La dan 3», su precio y tres avatares', /La dan 3/.test(iono) && /42,00/.test(iono) && (await page.locator('[data-merc="sv2-269"] .mc-gente-av').count()) === 3, iono)
  check('  …con las banderas de sus idiomas (es y fr)', (await page.$$eval('[data-merc="sv2-269"] .mc-merc-idiomas .pv-bandera', (b) => b.map((x) => x.dataset.idioma).join())) === 'es,fr')
  check('Iono: «Cruce» (Lucía la da y busca tu Mew)', (await page.locator('[data-merc="sv2-269"] .mc-merc-chapa.cruce').count()) === 1)
  check('Charizard: ni cruce ni la buscas', (await page.locator('[data-merc="sv3pt5-199"] .mc-merc-chapa').count()) === 0)
  check('Umbreon, que buscas: el corazón lleno', (await page.getAttribute('[data-merc="swsh7-215"] .mc-merc-corazon', 'aria-pressed')) === 'true')
  check('  …y «4 cartas a cambio»', /4 cartas a cambio/.test(await page.textContent('#mcMercadoCuantas')), await page.textContent('#mcMercadoCuantas'))
  check('el aviso: «1 de las que buscas está aquí»', (await visible(page, '#mcMercadoAviso')) && /1 de las que buscas/.test(await page.textContent('#mcMercadoAviso')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/770-mercado.png` })

  console.log('── 3. Los filtros ──')
  await page.selectOption('#mcMercadoIdioma', 'fr')
  await page.waitForTimeout(1000)
  check('en francés: solo Iono', (await baldosas(page)).join() === 'sv2-269', (await baldosas(page)).join())
  check('  …y cuenta solo lo de ese idioma (Marta)', /La da 1/.test(await textoDe(page, 'sv2-269')), await textoDe(page, 'sv2-269'))
  await page.selectOption('#mcMercadoIdioma', '')
  await page.fill('#mcMercadoBuscar', 'chari')
  await page.waitForTimeout(1200)
  check('«chari»: Charizard', (await baldosas(page)).join() === 'sv3pt5-199', (await baldosas(page)).join())
  await page.fill('#mcMercadoBuscar', '')
  await page.waitForTimeout(1200)
  await page.selectOption('#mcMercadoOrden', 'caro')
  await page.waitForTimeout(1000)
  check('más caro: Umbreon, Charizard, Pikachu, Iono', (await baldosas(page)).join() === 'swsh7-215,sv3pt5-199,sv8-238,sv2-269', (await baldosas(page)).join())
  await page.selectOption('#mcMercadoOrden', 'gente')
  await page.waitForTimeout(1000)
  check('más gente: Iono primero', (await baldosas(page))[0] === 'sv2-269', (await baldosas(page)).join())
  await page.click('#mcMercadoAviso')
  await page.waitForTimeout(1000)
  check('el aviso enciende «Solo las que busco»: Umbreon', (await baldosas(page)).join() === 'swsh7-215' && (await page.getAttribute('#mcMercadoMias', 'aria-pressed')) === 'true', (await baldosas(page)).join())
  await page.click('#mcMercadoMias')
  await page.waitForTimeout(1000)
  await page.click('[data-mercado-catalogo="JP"]')
  await page.waitForTimeout(1200)
  check('el catálogo japonés: la japonesa', (await baldosas(page)).join() === 'SV2a-201', (await baldosas(page)).join())
  check('  …con el idioma desactivado (solo hay japonés)', await page.$eval('#mcMercadoIdioma', (s) => s.disabled))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. La ficha: quién la da, al lado ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page)
  await page.click('[data-merc-ficha="swsh7-215"]')
  await page.waitForTimeout(1200)
  const d = page.locator('#mcMercadoFicha')
  check('se abre al lado (1440 y ratón)', (await d.evaluate((x) => x.open)) && (await d.evaluate((x) => x.classList.contains('mc-prodf-al-lado'))))
  check('  …y la rejilla le deja su sitio', await page.$eval('#mcPanelMercado', (p) => p.classList.contains('con-ficha-al-lado')))
  const gente = await page.$$eval('#mcMercadoFichaCuerpo .mc-merf-persona', (ps) => ps.map((p) => p.innerText.replace(/\s+/g, ' ')))
  check('dos personas, Lucía (cruce) primero', gente.length === 2 && /Lucía Cruce/.test(gente[0]) && /Busca 1 de las tuyas/.test(gente[0]) && /Íker/.test(gente[1]), JSON.stringify(gente))
  check('  …con su idioma y estado', /Español · Near Mint/.test(gente[0]) && /Inglés · Near Mint/.test(gente[1]), JSON.stringify(gente))
  check('«La quieres · cualquier idioma»', /La quieres · cualquier idioma/.test(await page.textContent('#mcMercadoFichaQuiero')))
  if (CAPS) await page.screenshot({ path: `${CAPS}/770-ficha.png` })
  await Promise.all([page.waitForURL(/mensajes\.html/), page.click('#mcMercadoFichaCuerpo [data-merf-escribir="user-1"]')])
  const u = new URL(page.url())
  check('«Escribir» abre el mensaje a Lucía, ya redactado', u.searchParams.get('with') === 'user-1' && /Umbreon VMAX/.test(u.searchParams.get('texto') || '') && /encajan/.test(u.searchParams.get('texto') || ''), page.url())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. El corazón, con su idioma ──')
{
  const { ctx, page, errores } = await abrir()
  await ir(page)
  await page.click('[data-merc-quiero="sv3pt5-199"]')
  await page.waitForTimeout(500)
  const chips = await page.$$eval('#iddDialogo .mc-idioma-chip', (cs) => cs.map((c) => `${c.dataset.idioma || '*'}${c.classList.contains('activo') ? '!' : ''}`))
  check('pregunta el idioma: cualquiera (marcado) y los seis', (await page.$eval('#iddDialogo', (d) => d.open)) && chips.join() === '*!,es,en,fr,de,it,pt', chips.join())
  await page.click('#iddDialogo .mc-idioma-chip[data-idioma="en"]')
  await page.click('#iddApuntar')
  await page.waitForTimeout(1200)
  const fila = await page.evaluate(() => window.__TABLAS__.user_wants.find((d) => d.card_id === 'sv3pt5-199' && d.user_id === 'admin-1'))
  check('  …y la apunta en inglés', fila?.idioma === 'en', JSON.stringify(fila))
  check('  …la baldosa dice «La buscas» y la cuenta sube a 2', (await page.locator('[data-merc="sv3pt5-199"] .mc-merc-chapa.busca').count()) === 1 && (await page.textContent('#mcPanelMercado [data-deseos-n="quiero"]')) === '2')
  await page.click('[data-merc-quiero="sv8-238"]')
  await page.waitForTimeout(400)
  await page.click('#iddCancelar')
  await page.waitForTimeout(800)
  check('Cancelar no apunta nada', !(await page.evaluate(() => window.__TABLAS__.user_wants.some((d) => d.card_id === 'sv8-238'))))
  await page.click('[data-merc-quiero="swsh7-215"]')
  await page.waitForTimeout(1200)
  check('el corazón lleno la quita (sin preguntar)', !(await page.evaluate(() => window.__TABLAS__.user_wants.some((d) => d.card_id === 'swsh7-215' && d.user_id === 'admin-1'))) && (await page.getAttribute('[data-merc="swsh7-215"] .mc-merc-corazon', 'aria-pressed')) === 'false')
  await page.click('[data-mercado-catalogo="JP"]')
  await page.waitForTimeout(1200)
  await page.click('[data-merc-quiero="SV2a-201"]')
  await page.waitForTimeout(500)
  const jp = await page.$$eval('#iddDialogo .mc-idioma-chip', (cs) => cs.map((c) => c.dataset.idioma))
  check('una japonesa: solo «Japonés»', jp.join() === 'ja', jp.join())
  await page.click('#iddApuntar')
  await page.waitForTimeout(1000)
  check('  …y se apunta en japonés', (await page.evaluate(() => window.__TABLAS__.user_wants.find((d) => d.card_id === 'SV2a-201')?.idioma)) === 'ja')
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. Sin cuenta ──')
{
  const { ctx, page, errores } = await abrir({ sesion: false })
  await ir(page)
  check('se ve el Mercado, sin la puerta de «entra»', (await visible(page, '#mcPanelMercado')) && !(await visible(page, '#mcEntrar')))
  check('  …con lo de todo el mundo (cinco: sin «yo», la tuya también sale)', (await baldosas(page)).length === 5, (await baldosas(page)).join())
  check('  …sin el menú de tu colección', !(await visible(page, '#mcMenu')))
  const seg = await page.$$eval('#mcPanelMercado .mc-deseos-seg [data-deseos-vista]', (bs) => bs.filter((b) => !b.classList.contains('hidden')).map((b) => b.dataset.deseosVista))
  check('  …y del selector, solo «Mercado»', seg.join() === 'mercado', seg.join())
  check('  …ni «Solo las que busco»', !(await visible(page, '#mcMercadoMias')))
  check('la invitación a crear la cuenta, con la vuelta', (await visible(page, '#mcMercadoEntrar')) && /registro=1/.test(await page.getAttribute('#mcMercadoEntrarEnlace', 'href')) && /volver=/.test(await page.getAttribute('#mcMercadoEntrarEnlace', 'href')))
  check('el título de la página: «Mercado de cambios»', /Mercado de cambios/.test(await page.title()), await page.title())
  await Promise.all([page.waitForURL(/auth\.html/), page.click('[data-merc-quiero="sv3pt5-199"]')])
  check('el corazón manda a registrarse', /registro=1/.test(page.url()) && /ver%3Dmercado|ver=mercado/.test(decodeURIComponent(page.url())), page.url())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 7. Sin la migración ──')
{
  const { ctx, page, errores } = await abrir({ extra: { __RPC_ERRORES__: { intercambios_mercado: { code: 'PGRST202', message: 'Could not find the function' } } } })
  await ir(page)
  check('dice QUÉ migración falta', /supabase-migration-mercado\.sql/.test(await page.textContent('#mcMercadoRejilla')), await page.textContent('#mcMercadoRejilla'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 8. En el iPhone ──')
{
  const { ctx, page, errores } = await abrir({ movil: true })
  await ir(page)
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('sin irse de ancho', ancho <= 1, String(ancho))
  const seg = await page.$eval('#mcPanelMercado .mc-deseos-seg', (s) => Math.round(s.getBoundingClientRect().height))
  check('el selector en una fila (se desliza)', seg < 60, String(seg))
  const columnas = await page.$eval('#mcMercadoRejilla', (r) => getComputedStyle(r).gridTemplateColumns.split(' ').length)
  check('dos columnas de cartas', columnas === 2, String(columnas))
  const corazon = await page.$eval('[data-merc="sv2-269"] .mc-merc-corazon', (b) => b.getBoundingClientRect().height)
  check('el corazón se toca (44)', corazon >= 44, String(corazon))
  if (CAPS) await page.screenshot({ path: `${CAPS}/770-movil.png` })
  await page.click('[data-merc-ficha="sv2-269"]')
  await page.waitForTimeout(1200)
  const r = await page.$eval('#mcMercadoFicha', (d) => ({ bottom: Math.round(d.getBoundingClientRect().bottom), w: Math.round(d.getBoundingClientRect().width), vh: innerHeight, vw: innerWidth, modal: d.matches(':modal') }))
  check('la ficha sale desde abajo, de lado a lado', r.modal && Math.abs(r.bottom - r.vh) <= 2 && r.w >= r.vw - 2, JSON.stringify(r))
  if (CAPS) await page.screenshot({ path: `${CAPS}/770-movil-ficha.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()

console.log('\n── 9. La base, contra PostgreSQL ──')
{
  const SQL = readFileSync(`${RAIZ}/supabase-migration-mercado.sql`, 'utf8')
  check('sin tablas temporales (tanda 631)', !/create\s+temp/i.test(SQL))
  check('la ve anon (es el escaparate)', /grant execute on function public\.intercambios_mercado\([^)]*\) to anon, authenticated/.test(SQL))
  check('  …y no es la tuya: excluye a quien mira', /c\.user_id is distinct from auth\.uid\(\)/.test(SQL))
  const ruta = join(AQUI, 'sql-mercado.sql')
  check('existe sql-mercado.sql', existsSync(ruta))
  const r = spawnSync('psql', ['-q', '-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-f', ruta], { encoding: 'utf8', timeout: 30000 })
  const salida = r.error ? null : `${r.stdout || ''}${r.stderr || ''}`
  if (salida === null || /could not connect|No such file|connection to server/.test(salida)) {
    console.log('   (no hay PostgreSQL en /var/tmp:5433 — la prueba de la base NO se ha corrido aquí)')
  } else {
    const oks = (salida.match(/ {2}ok {2}/g) || []).length
    const fallos = salida.split('\n').filter((l) => /FALLA|ERROR/.test(l))
    check(`PostgreSQL: ${oks} comprobaciones, ninguna falla`, oks >= 22 && !fallos.length, fallos.slice(0, 3).join(' | ') || salida.slice(-300))
  }
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
