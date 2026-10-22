// Tandas 977, 978 y 979 — abrir una expansión «al momento», como Dex.
//
// PINGU, con capturas de Dex: «la manera en que se cargan las cosas es como
// instantánea; no carga un esqueleto para luego romperlo todo». Propuesta
// https://claude.ai/artifact/J47wdYM1gYLfnNsPKyABSR, «dale con lo recomendado».
//
//   977: las cartas y sus versiones a la vez; la tira y un hueco por carta al
//        tocar, del tamaño de la casilla de verdad; la petición sale al tocar.
//   978: lo de cada set guardado en el navegador (se pinta al momento y se
//        repinta si cambió) y desde la CDN (`cartas-set`, con respaldo).
//   979: en el móvil, la expansión entra deslizando y al volver sale, y la
//        estantería se queda donde estaba; nunca con «menos movimiento».
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(join(RAIZ, f), 'utf8')

console.log('── 1. La función de la CDN ──')
{
  const f = await import(`${RAIZ}/netlify/functions/cartas-set.mjs`)
  check('pide market y sets válidos', !f.pedidoDe('https://x/f?market=WEST') && !f.pedidoDe('https://x/f?market=XX&sets=sv8') && !f.pedidoDe('https://x/f?market=WEST&sets=a),b') && f.pedidoDe('https://x/f?market=WEST&sets=sm11,sm11tg')?.sets.join() === 'sm11,sm11tg')
  check('  …y no más de ocho sets', !f.pedidoDe(`https://x/f?market=WEST&sets=${Array.from({ length: 9 }, (_, i) => `s${i}`).join(',')}`))
  const rutas = []
  let conAMano = 0
  const fetchImpl = async (url) => {
    const u = decodeURIComponent(String(url))
    rutas.push(u)
    if (u.includes('tcg_card_versions') && u.includes('salio_en')) { conAMano++; return new Response('{"code":"42703","message":"column tcg_card_versions.salio_en does not exist"}', { status: 400 }) }
    if (u.includes('tcg_card_versions')) return Response.json([{ tcggo_id: 1, card_id: 'sv8-1', set_id: 'sv8' }])
    const set = /set_id=eq\.([^&]+)/.exec(u)?.[1]
    return Response.json([{ id: `${set}-1`, set_id: set }])
  }
  const r = await f.leerCartasDeSets({ mercado: 'WEST', sets: ['sv8', 'sv8tg'] }, { fetchImpl })
  check('una petición por set, con las columnas de la web', rutas.filter((x) => x.includes('tcg_cards')).length === 2 && rutas.every((x) => !x.includes('tcg_cards') || x.includes('tcg_sets(tcg_online_code,serie_id,release_date)')) && r.cartas.length === 2)
  check('  …y las versiones, sin las columnas a mano si no existen', conAMano === 1 && r.versiones.length === 1, JSON.stringify(r.versiones))
  const res = await f.responder(new Request('https://x/.netlify/functions/cartas-set?market=WEST&sets=sv8'), { fetchImpl })
  check('  …con la etiqueta de caché de la estantería (la tira /admin)', res.status === 200 && res.headers.get('netlify-cache-tag') === 'sets' && /max-age=600/.test(res.headers.get('netlify-cdn-cache-control') || ''))
  const mal = await f.responder(new Request('https://x/.netlify/functions/cartas-set?market=WEST&sets=sv8'), { fetchImpl: async () => new Response('', { status: 500 }) })
  check('  …y un fallo no se guarda en la CDN', mal.status === 502 && mal.headers.get('cache-control') === 'no-store')
  const col = await import(`${RAIZ}/js/mi-coleccion/columnas-set.js`)
  check('la web y la función piden LAS MISMAS columnas (un solo sitio)', /COLUMNAS_CARTA_DE_SET/.test(leer('js/mi-coleccion/datos.js')) && !/\.select\('id,market,set_id,local_id,name,name_es,name_en,image_path,image_scrydex,image_tcggo,rarity,rarity_en,category,variants/.test(leer('js/mi-coleccion/datos.js')) && col.COLUMNAS_CARTA_DE_SET.includes('rarity_en'))
  check('el editor de cartas de /admin también avisa a la web', (leer('admin/js/catalogo-cartas.js').match(/avisarALaWeb\(\)/g) || []).length >= 7 && /from '\.\/avisar-web\.js'/.test(leer('admin/js/colecciones.js')))
}

const N = 18
const semilla = ([n, otros]) => {
  window.__FAKE_SESSION__ = 'user-1'
  try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
  window.__FAKE_SETS__ = [
    { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: n, card_count_total: n },
    ...Array.from({ length: otros }, (_, i) => ({ id: `viejo${i}`, name: `Viejo ${i}`, serie_id: 'base', market: 'WEST', release_date: `2000-01-${String(i + 1).padStart(2, '0')}`, card_count_official: 10, card_count_total: 10 })),
  ]
  window.__FAKE_CARTAS__ = Array.from({ length: n }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Common', category: 'Pokemon', dex_ids: [i + 1], variants: { normal: true }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv' } }))
  window.__FAKE_COLECCION__ = [1, 2, 5, 17].map((k) => ({ id: `l${k}`, user_id: 'user-1', card_id: `sv8-${k}`, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 }))
}
const browser = await chromium.launch()
async function contexto({ movil = true, menos = false, cdn = null } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: 1440, height: 1000 } }), locale: 'es-ES', reducedMotion: menos ? 'reduce' : 'no-preference', serviceWorkers: 'block' })
  await ctx.addInitScript(semilla, [N, 30])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => {
    if (cdn && /cartas-set/.test(r.request().url())) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(cdn) })
    return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  })
  return ctx
}
async function abrirEstanteria(ctx, { retraso = null } = {}) {
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  if (retraso) await page.addInitScript((r) => { window.__FAKE_RETRASO__ = r }, retraso)
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('#mcEstanteriaRejilla [data-set="sv8"]', { timeout: 10000 })
  await page.waitForTimeout(600)
  // Un reloj en la página: cuándo sale la primera carta de verdad.
  await page.evaluate(() => {
    window.__llega = null
    new MutationObserver(() => { if (window.__llega == null && document.querySelector('#mcAlbum [data-carta]')) window.__llega = performance.now() }).observe(document.getElementById('mcAlbum'), { childList: true, subtree: true })
  })
  return { page, errores }
}
const tocar = (page) => page.evaluate(() => { window.__toque = performance.now(); document.querySelector('#mcEstanteriaRejilla [data-set="sv8"]').click() })
const esperaLlegada = async (page) => { await page.waitForFunction(() => window.__llega != null, null, { timeout: 8000 }); return page.evaluate(() => Math.round(window.__llega - window.__toque)) }

console.log('\n── 2. La pantalla, montada al tocar (977) ──')
{
  const ctx = await contexto()
  const { page, errores } = await abrirEstanteria(ctx, { retraso: { tcg_cards: 700, tcg_card_versions: 700 } })
  await tocar(page)
  await page.waitForTimeout(80)
  const antes = await page.evaluate(() => {
    const huecos = [...document.querySelectorAll('#mcAlbum .mc-hueco')]
    return { huecos: huecos.length, esq: document.querySelectorAll('#mcAlbum .mc-esq').length, linea: document.querySelector('#mcAlbumProgreso .mc-avance-linea')?.textContent.replace(/\s+/g, ' ').trim(), alto: Math.round(document.getElementById('mcAlbum').getBoundingClientRect().height), primero: huecos[0] && huecos[0].getBoundingClientRect().toJSON() }
  })
  check('al tocar, un hueco por carta (18) y no el esqueleto de doce', antes.huecos === N && antes.esq === 0, JSON.stringify(antes))
  check('  …y la tira ya dice «4 de 18»', /^4 de 18/.test(antes.linea || ''), antes.linea)
  const ms = await esperaLlegada(page)
  check('las cartas y las versiones llegan A LA VEZ (700 ms cada una: antes 1.400)', ms < 1250, `${ms} ms`)
  await page.waitForTimeout(200)
  const despues = await page.evaluate(() => ({ alto: Math.round(document.getElementById('mcAlbum').getBoundingClientRect().height), primero: document.querySelector('#mcAlbum .mc-bolsillo')?.getBoundingClientRect().toJSON(), linea: document.querySelector('#mcAlbumProgreso .mc-avance-linea')?.textContent.replace(/\s+/g, ' ').trim() }))
  check('al llegar no se mueve nada: mismo alto y la primera carta donde estaba su hueco', Math.abs(despues.alto - antes.alto) <= 2 && Math.abs(despues.primero.top - antes.primero.top) <= 2 && Math.abs(despues.primero.width - antes.primero.width) <= 2, `${antes.alto}→${despues.alto}, ${Math.round(antes.primero.top)}→${Math.round(despues.primero.top)}`)
  check('  …y la tira dice lo mismo', /^4 de 18/.test(despues.linea || ''), despues.linea)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto()
  const { page } = await abrirEstanteria(ctx, { retraso: { tcg_cards: 700, tcg_card_versions: 700 } })
  await page.dispatchEvent('#mcEstanteriaRejilla [data-set="sv8"]', 'pointerdown')
  await page.waitForTimeout(900)
  await tocar(page)
  const ms = await esperaLlegada(page)
  check('la petición sale al tocar la fila: al levantar el dedo ya está', ms < 400, `${ms} ms`)
  await ctx.close()
}

console.log('\n── 3. Lo de la última vez, al momento (978) ──')
{
  const ctx = await contexto()
  const { page } = await abrirEstanteria(ctx)
  await tocar(page)
  await esperaLlegada(page)
  await page.waitForTimeout(500)
  // La segunda vez, en una pestaña nueva y con la base muy lenta.
  const otra = await abrirEstanteria(ctx, { retraso: { tcg_cards: 1500, tcg_card_versions: 1500 } })
  await otra.page.evaluate(() => { const c = window.__TABLAS__.tcg_cards.find((x) => x.id === 'sv8-3'); c.name = c.name_es = 'Cambiada en la base' })
  await tocar(otra.page)
  const ms = await esperaLlegada(otra.page)
  check('la segunda vez, las cartas salen de lo guardado sin esperar a la base', ms < 400, `${ms} ms`)
  check('  …con lo de la última vez', /Carta 3/.test(await otra.page.locator('#mcAlbum [data-carta="sv8-3"]').getAttribute('aria-label')))
  await otra.page.waitForTimeout(1900)
  check('  …y cuando contesta la base con algo nuevo, se repinta', /Cambiada en la base/.test(await otra.page.locator('#mcAlbum [data-carta="sv8-3"]').getAttribute('aria-label')))
  check('  …sin errores', otra.errores.length === 0, otra.errores.join(' | '))
  await ctx.close()
}
{
  const cartas = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `De la CDN ${i + 1}`, name_es: `De la CDN ${i + 1}`, image_path: null, rarity: 'Common', category: 'Pokemon', variants: { normal: true }, tcg_sets: { tcg_online_code: 'SSP', serie_id: 'sv', release_date: '2024-11-08' } }))
  const ctx = await contexto({ cdn: { cartas, versiones: [] } })
  const { page, errores } = await abrirEstanteria(ctx, { retraso: { tcg_cards: 3000 } })
  await tocar(page)
  const ms = await esperaLlegada(page)
  check('la primera vez, desde la CDN si contesta (sin esperar a la base)', ms < 1500 && /De la CDN 1/.test(await page.locator('#mcAlbum [data-carta="sv8-1"]').getAttribute('aria-label')), `${ms} ms`)
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('\n── 4. Entrar deslizando (979) ──')
{
  const ctx = await contexto()
  const { page, errores } = await abrirEstanteria(ctx)
  await page.evaluate(() => window.scrollTo(0, 400))
  await page.waitForTimeout(200)
  const sitio = await page.evaluate(() => Math.round(scrollY))
  await page.evaluate(() => {
    window.__desliza = []
    new MutationObserver(() => window.__desliza.push(document.documentElement.dataset.desliza || '')).observe(document.documentElement, { attributes: true, attributeFilter: ['data-desliza'] })
  })
  await tocar(page)
  await page.waitForTimeout(800)
  const dentro = await page.evaluate(() => ({ marcas: window.__desliza.join(','), arriba: Math.round(scrollY), visible: !document.getElementById('mcArchivadorZona').classList.contains('hidden'), queda: document.documentElement.dataset.desliza || '' }))
  check('en el móvil la expansión entra deslizando, y la marca se quita al acabar', dentro.marcas === 'entra,' && dentro.queda === '' && dentro.visible, JSON.stringify(dentro))
  check('  …y empieza arriba', dentro.arriba === 0, String(dentro.arriba))
  await page.evaluate(() => { window.__desliza = [] })
  await page.locator('#mcAlbumMigas .mc-miga').click()
  await page.waitForTimeout(800)
  const fuera = await page.evaluate(() => ({ marcas: window.__desliza.join(','), sitio: Math.round(scrollY), estante: !document.getElementById('mcEstanteriaZona').classList.contains('hidden') }))
  check('al volver sale deslizando, y la estantería sigue donde la dejaste', fuera.marcas === 'sale,' && fuera.estante && Math.abs(fuera.sitio - sitio) <= 4, `${JSON.stringify(fuera)} (antes ${sitio})`)
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
for (const [nombre, opciones] of [['con «menos movimiento»', { menos: true }], ['en el ordenador', { movil: false }]]) {
  const ctx = await contexto(opciones)
  const { page } = await abrirEstanteria(ctx)
  await page.evaluate(() => { window.__desliza = []; new MutationObserver(() => window.__desliza.push('x')).observe(document.documentElement, { attributes: true, attributeFilter: ['data-desliza'] }) })
  await tocar(page)
  await esperaLlegada(page)
  check(`${nombre}, sin deslizar (y se abre igual)`, (await page.evaluate(() => window.__desliza.length)) === 0 && (await page.locator('#mcAlbum [data-carta]').count()) === N)
  await ctx.close()
}
{
  const css = leer('css/mi-coleccion.css')
  check('la animación se apaga con «menos movimiento»', /prefers-reduced-motion: reduce\)[\s\S]{0,400}html\[data-desliza='entra'\]::view-transition-new\(mc-expansion\)/.test(css))
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
