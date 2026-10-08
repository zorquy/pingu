// Tanda 766 — lo que faltaba de la ronda 3.
//
// PINGU: «¿está todo hecho seguro? Hay cosas que faltan». Lo que se mira:
//   · PR2: la cifra grande del Panel suma cartas y productos, con su franja
//     y dos fichas; la portada suma lo mismo.
//   · AL5 y AL4: cada bolsillo vacío con su número y su destello; las fundas
//     con relieve.
//   · PR1: la expansión con su logo en Productos, lo tuyo con ✓ o «×2», y
//     tus productos agrupados por expansión.
//   · DC1: en «La quiero», quién de los que sigues la tiene (con la función
//     nueva y, sin ella, carta a carta); el aviso en «Las que doy»; y
//     «Compartir lista» con «Busco… / Doy…» y el enlace.
//   · M3: Apoyar PokeDoc, en rosa.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 280) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''

console.log('── 1. La migración ──')
{
  const sql = readFileSync(`${RAIZ}/supabase-migration-seguidos-y-deseos.sql`, 'utf8')
  check('una función para toda la lista, con las reglas de la ficha', /create or replace function public\.coleccion_seguidos_y_mis_deseos\(\)/.test(sql) && /user_follows f\s+where f\.follower_id = auth\.uid\(\)/.test(sql) && /coleccion_publica/.test(sql) && /is_banned/.test(sql))
  check('  …con el rango (la 386) y sin anon', /is_admin boolean/.test(sql) && /revoke all on function public\.coleccion_seguidos_y_mis_deseos\(\) from public, anon/.test(sql))
  check('  …sin tablas temporales (la 631)', !/temp(orary)? table/i.test(sql))
}

const browser = await chromium.launch()
const SETS = [
  { id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, tcggo_id: 300, logo_tcggo: 'https://images.tcggo.com/logo-sv3.png' },
  { id: 'dr', name: 'Delta Reign', serie_id: 'me', market: 'WEST', release_date: '2099-11-06', card_count_official: 0, card_count_total: 0, tcggo_id: 500, oculto: true, logo_tcggo: 'https://images.tcggo.com/logo-dr.png' },
]
const CARTAS = [
  { id: 'sv3-125', market: 'WEST', set_id: 'sv3', local_id: '125', name: 'Charizard ex', name_es: 'Charizard ex', image_path: 'x/1', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } },
  { id: 'sv3-26', market: 'WEST', set_id: 'sv3', local_id: '26', name: 'Charmander', name_es: 'Charmander', image_path: 'x/2', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
  { id: 'sv3-50', market: 'WEST', set_id: 'sv3', local_id: '50', name: 'Pikachu', name_es: 'Pikachu', image_path: 'x/3', rarity: 'Common', category: 'Pokemon', variants: { normal: true } },
]
const PRODUCTOS = [
  { id: 9001, episode_id: 300, lang: 'en', name: 'Obsidian Flames Booster', tipo: 'sobre', image: null, cm_lowest: 5, cm_lowest_eu: 5, cm_lowest_es: 5, cm_avg30: 4.8, release_date: '2023-08-11' },
  { id: 9002, episode_id: 300, lang: 'en', name: 'Obsidian Flames ETB', tipo: 'etb', image: null, cm_lowest: 50, cm_lowest_eu: 50, cm_lowest_es: 50, cm_avg30: null, release_date: '2023-08-11' },
  { id: 9100, episode_id: 500, lang: 'en', name: 'Delta Reign Elite Trainer Box', tipo: 'etb', image: null, cm_lowest: 59.9, cm_lowest_eu: 59.9, cm_lowest_es: 61.5, cm_avg30: null, release_date: '2099-11-06' },
]
async function abrir(ruta, { movil = false, mios = [], rpc = {}, errores: rpcErr = {} } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', permissions: ['clipboard-read', 'clipboard-write'] } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES', permissions: ['clipboard-read', 'clipboard-write'] })
  await ctx.addInitScript(({ SETS, CARTAS, PRODUCTOS, mios, rpc, rpcErr }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = CARTAS
    window.__FAKE_COLECCION__ = [
      { id: 'l1', user_id: 'admin-1', card_id: 'sv3-26', market: 'WEST', cantidad: 4, cambio: 2, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 10, created_at: '2026-10-01T10:00:00Z' },
    ]
    window.__FAKE_DESEOS__ = [
      { id: 'd1', user_id: 'admin-1', card_id: 'sv3-125', idioma: null, prioridad: 2, created_at: '2026-10-01T10:00:00Z' },
      { id: 'd2', user_id: 'admin-1', card_id: 'sv3-50', idioma: null, prioridad: 1, created_at: '2026-10-01T10:00:00Z' },
    ]
    window.__FAKE_PRODUCTOS__ = PRODUCTOS
    window.__FAKE_MIS_PRODUCTOS__ = mios
    window.__FAKE_ALBUMES__ = [{ id: 'alb-bin', user_id: 'admin-1', nombre: 'Mis favoritas', tipo: 'binder', rejilla: '2x2', paginas: 10, tapa: 'verde', cartas: [{ id: 'sv3-26' }, {}, { id: 'sv3-50' }], updated_at: '2026-10-04T10:00:00Z' }]
    window.__RPC_RESPUESTAS__ = rpc
    window.__RPC_ERRORES__ = rpcErr
  }, { SETS, CARTAS, PRODUCTOS, mios, rpc, rpcErr })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: /logo/.test(r.request().url()) ? '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><rect width="200" height="80" rx="12" fill="#f2b632"/></svg>' : '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  await page.addInitScript(() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }) })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

console.log('── 2. PR2: el Panel suma cartas y productos ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html', { mios: [{ product_id: 9001, cantidad: 2 }, { product_id: 9002, cantidad: 1 }] })
  await page.waitForTimeout(800)
  const cifra = limpio(await page.textContent('#mcValorCaja .mc-cartera-cifra'))
  check('la cifra grande es la suma: 40 € de cartas + 60 € de productos', /100,00/.test(cifra), cifra)
  const franja = await page.$$eval('#mcCarteraReparto .mc-reparto-franja i', (is) => is.map((i) => i.style.getPropertyValue('--ancho')))
  check('  …con la franja de lo que pesa cada parte', franja.join() === '40%,60%', JSON.stringify(franja))
  const fichas = await page.$$eval('#mcCarteraReparto .mc-reparto-ficha', (bs) => bs.map((b) => `${b.dataset.irA}:${b.innerText.replace(/\s+/g, ' ').trim()}`))
  check('  …y dos fichas, cada una con lo suyo', fichas.length === 2 && /^cartas:Cartas 40,00 € 4 cartas · 40 %/.test(fichas[0]) && /^productos:Productos 60,00 € 3 productos · 60 %/.test(fichas[1]), JSON.stringify(fichas))
  check('  …que se tocan (44)', (await page.$$eval('#mcCarteraReparto .mc-reparto-ficha', (bs) => bs.every((b) => b.getBoundingClientRect().height >= 44))))
  if (CAPS) await page.screenshot({ path: `${CAPS}/766-panel.png` })
  await page.click('#mcCarteraReparto [data-ir-a="productos"]')
  await page.waitForTimeout(1200)
  check('la de productos lleva a Productos', new URL(page.url()).searchParams.get('ver') === 'productos' && (await page.isVisible('#mcPanelProductos')))

  console.log('── 3. PR1: Productos con su logo, y ✓ o «×2» ──')
  const tuyos = await page.$$eval('#mcProdTuyos .mc-prod-set', (ss) => ss.map((s) => ({ texto: s.textContent.replace(/\s+/g, ' ').trim(), logo: !!s.querySelector('img') })))
  check('tus productos, bajo su expansión con el logo', tuyos.length === 1 && /Obsidiana en Llamas/.test(tuyos[0].texto) && tuyos[0].logo, JSON.stringify(tuyos))
  const marcas = await page.$$eval('#mcProdTuyos .mc-prod', (as) => as.map((a) => `${a.dataset.prod}:${a.querySelector('.mc-prod-tengo')?.textContent || ''}`).sort())
  check('  …el que tienes una vez con ✓ y el de dos con «×2»', marcas.join() === '9001:×2,9002:✓', JSON.stringify(marcas))
  const cab = await page.evaluate(() => ({ visible: !document.getElementById('mcProdSetCabeza').classList.contains('hidden'), texto: document.getElementById('mcProdSetCabeza').textContent.replace(/\s+/g, ' ').trim(), logo: !!document.querySelector('#mcProdSetCabeza img') }))
  check('la expansión elegida, arriba con su logo', cab.visible && cab.logo && /Delta Reign/.test(cab.texto) && /preventa/.test(cab.texto), JSON.stringify(cab))
  await page.selectOption('#mcProdSet', '300')
  await page.waitForTimeout(800)
  const cab2 = limpio(await page.textContent('#mcProdSetCabeza'))
  check('  …y cambia con el desplegable', /Obsidiana en Llamas/.test(cab2) && /2 productos/.test(cab2), cab2)
  const enCatalogo = await page.$$eval('#mcProdRejilla .mc-prod', (as) => as.map((a) => `${a.dataset.prod}:${a.querySelector('.mc-prod-tengo')?.textContent || ''}`).sort())
  check('  …y en el catálogo también se ve lo tuyo', enCatalogo.join() === '9001:×2,9002:✓', JSON.stringify(enCatalogo))
  if (CAPS) await page.screenshot({ path: `${CAPS}/766-productos.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. La portada suma lo mismo ──')
{
  const { ctx, page } = await abrir('/mi-coleccion.html')
  const html = await page.evaluate(async () => {
    const { valorHtml } = await import('/js/hoy.js')
    return { con: valorHtml([{ dia: '2026-10-01', valor: 40 }], { productos: 60 }), sin: valorHtml([{ dia: '2026-10-01', valor: 40 }]) }
  })
  check('con productos, la cifra de «Tu colección» es la suma', /100,00/.test(html.con) && /40,00/.test(html.sin), `${limpio(html.con).slice(0, 120)} | ${limpio(html.sin).slice(0, 80)}`)
  const hoy = readFileSync(`${RAIZ}/js/hoy.js`, 'utf8')
  check('  …y la pide como el Panel (valorParaElPanel)', /valorParaElPanel\(uid\)/.test(hoy) && /valorHtml\(valor \?\? null, \{ productos:/.test(hoy))
  await ctx.close()
}

console.log('── 5. AL5 y AL4: los bolsillos ──')
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=carpetas&album=alb-bin')
  await page.waitForSelector('#mcAlbArchivador [data-hueco]', { timeout: 8000 }).catch(() => {})
  const huecos = await page.$$eval('#mcAlbArchivador [data-hueco]', (bs) => bs.slice(0, 3).map((b) => ({ i: b.dataset.hueco, num: b.querySelector('.mc-hueco-num')?.textContent, destello: !!b.querySelector('.mc-hueco-destello svg') })))
  check('cada bolsillo vacío lleva su número y su destello', huecos.length === 3 && huecos.every((h) => Number(h.num) === Number(h.i) + 1 && h.destello), JSON.stringify(huecos))
  const funda = await page.$eval('#mcAlbArchivador .mc-bolsillo.tengo, #mcAlbArchivador .mc-bolsillo', (b) => ({ antes: getComputedStyle(b, '::before').content, sombra: getComputedStyle(b).boxShadow }))
  check('las fundas, con relieve: el brillo encima y el canto hundido', funda.antes !== 'none' && /inset/.test(funda.sombra), JSON.stringify(funda))
  const anima = await page.$eval('#mcAlbArchivador .mc-hueco-destello', (e) => getComputedStyle(e).animationName)
  check('  …y el destello se mueve', anima === 'mc-destello', anima)
  if (CAPS) await page.screenshot({ path: `${CAPS}/766-bolsillos.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_ALBUMES__ = [{ id: 'alb-bin', user_id: 'admin-1', nombre: 'Mis favoritas', tipo: 'binder', rejilla: '2x2', paginas: 10, tapa: 'verde', cartas: [], updated_at: '2026-10-04T10:00:00Z' }]
  })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mi-coleccion.html?ver=carpetas&album=alb-bin`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcAlbArchivador .mc-hueco-destello', { timeout: 8000 }).catch(() => {})
  const anima = await page.$eval('#mcAlbArchivador .mc-hueco-destello', (e) => getComputedStyle(e).animationName).catch(() => '¿?')
  check('  …salvo con «menos movimiento»', anima === 'none', anima)
  await ctx.close()
}

console.log('── 6. DC1: quién de los que sigues la tiene ──')
{
  const rpc = { coleccion_seguidos_y_mis_deseos: [
    { card_id: 'sv3-125', user_id: 'user-2', username: 'ana', is_admin: false, is_moderator: false, copias: 1 },
    { card_id: 'sv3-125', user_id: 'user-3', username: 'leo', is_admin: false, is_moderator: false, copias: 1 },
    { card_id: 'sv3-50', user_id: 'user-2', username: 'ana', is_admin: false, is_moderator: false, copias: 2 },
  ] }
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=quiero', { rpc })
  await page.waitForTimeout(800)
  const filas = await page.$$eval('#mcQuieroPanel .mc-quiero-fila', (fs) => fs.map((f) => f.querySelector('.mc-deseo-seguidos')?.textContent.trim() || ''))
  check('en cada carta, quién de los que sigues la tiene', filas.some((t) => t === 'La tienen @ana y 1 más de los que sigues') && filas.some((t) => t === 'La tiene @ana, a quien sigues'), JSON.stringify(filas))
  await page.click('#mcQuieroTexto')
  await page.waitForTimeout(400)
  const texto = await page.evaluate(() => navigator.clipboard.readText())
  check('«Compartir lista»: «Busco…», «Doy…» y el enlace', /^Busco:\n• Charizard ex/.test(texto) && /\n\nDoy:\n• Charmander \(Obsidiana en Llamas · 26\) ×2/.test(texto) && /\n\nEscríbeme en PokeDoc: http:\/\/localhost:\d+/.test(texto), texto)
  await page.click('#mcPanelQuiero [data-deseos-vista="doy"]')
  await page.waitForTimeout(900)
  check('en «Las que doy», cada carta con su aviso', (await page.locator('#mcDoyPanel [data-avisar-doy]').count()) === 1)
  await page.click('#mcDoyPanel [data-avisar-doy]')
  await page.waitForTimeout(600)
  check('  …que abre el aviso de precio de siempre', await page.evaluate(() => !!document.getElementById('pvAvisoDialogo')?.open && /10,00/.test(document.getElementById('pvAvisoAhora').textContent)), await page.evaluate(() => document.getElementById('pvAvisoAhora')?.textContent))
  await page.keyboard.press('Escape')
  await page.click('#mcDoyCompartir')
  await page.waitForTimeout(400)
  check('  …y su «Compartir lista» da el mismo texto', (await page.evaluate(() => navigator.clipboard.readText())) === texto)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  // Sin la migración: carta a carta, con la de la ficha.
  const rpc = { coleccion_quien_la_tiene: [{ user_id: 'user-2', username: 'ana', is_admin: false, is_moderator: false, copias: 1 }] }
  const errores = { coleccion_seguidos_y_mis_deseos: { code: 'PGRST202', message: 'Could not find the function' } }
  const { ctx, page } = await abrir('/mi-coleccion.html?ver=quiero', { rpc, errores })
  await page.waitForTimeout(800)
  const filas = await page.$$eval('#mcQuieroPanel .mc-deseo-seguidos', (fs) => fs.map((f) => f.textContent.trim()))
  check('sin la función nueva, se pregunta carta a carta', filas.length === 2 && filas.every((t) => t === 'La tiene @ana, a quien sigues'), JSON.stringify(filas))
  await ctx.close()
}

console.log('── 7. M3: Apoyar PokeDoc, en rosa ──')
for (const tema of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  const c = await page.evaluate(async (tema) => {
    document.documentElement.dataset.theme = tema
    const l = document.createElement('link')
    l.rel = 'stylesheet'
    l.href = '/css/menu-tu.css'
    document.head.appendChild(l)
    await new Promise((ok) => { l.onload = ok; setTimeout(ok, 1500) })
    const caja = document.createElement('ul')
    caja.className = 'tu-lista'
    caja.innerHTML = '<li><a class="tu-apoyar" href="#"><svg></svg><span>Apoyar PokeDoc<small>Un café en Ko-fi</small></span></a></li>'
    document.body.appendChild(caja)
    const ref = document.createElement('i')
    ref.style.color = 'var(--pink)'
    ref.style.background = 'var(--pink-bg)'
    document.body.appendChild(ref)
    const a = caja.querySelector('a')
    return { texto: getComputedStyle(a.querySelector('span')).color, icono: getComputedStyle(a.querySelector('svg')).color, fondo: getComputedStyle(a).backgroundColor, rosa: getComputedStyle(ref).color, rosaFondo: getComputedStyle(ref).backgroundColor }
  }, tema)
  check(`en el tema ${tema === 'light' ? 'claro' : 'oscuro'}, rótulo, taza y fondo en rosa`, c.texto === c.rosa && c.icono === c.rosa && c.fondo === c.rosaFondo, JSON.stringify(c))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
