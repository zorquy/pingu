// Tanda 921 — La ficha de una carta en el ordenador, un pop-up ancho como el
// de Dex (PINGU: «antes se abría en un pop-up central, que es bastante
// mejor… te da un espacio horizontal para mostrarte todo»), y en el móvil
// la versión y tus copias en su propia hoja. Lo que se mira:
//   1. Ya no hay ficha «al lado»: siempre modal y centrada, y la rejilla no
//      se mueve (ni a 1.440 en una expansión, ni a 1.680 en Cartas).
//   2. Dos columnas: la carta a la izquierda sobre su foto difuminada, los
//      datos a la derecha (que se desplazan solos, la carta no).
//   3. Arriba a la derecha la X, el corazón y compartir; las flechas, FUERA
//      del pop-up, y pasan de carta; el sitio en la lista, bajo la carta.
//   4. Las versiones en chips a la vista y «− Tienes N +» en la misma fila;
//      los álbumes y quién la tiene, uno al lado del otro; los atributos en
//      tabla de dos columnas.
//   5. Tocar fuera cierra.
//   6. En el móvil: la versión y tus copias se abren en una hoja encima; el
//      velo y arrastrar hacia abajo la cierran a ella, no a la ficha.
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`)
}

console.log('── 0. Lo estático ──')
{
  check('el módulo de la ficha a la derecha se fue', !existsSync(join(RAIZ, 'js/mi-coleccion/ficha-al-lado.js')))
  const js = readFileSync(join(RAIZ, 'js/mi-coleccion.js'), 'utf8')
  check('  …y la ficha se abre siempre modal', !/vaAlLado|abrirFichaDonde|mc-ficha-al-lado/.test(js) && /if \(!yaAbierta\) d\.showModal\(\)/.test(js))
  check('cartas.html sale del generador con el fondo y el velo', /id="mcEdFondo"/.test(readFileSync(join(RAIZ, 'cartas.html'), 'utf8')) && /id="mcEdSubvelo"/.test(readFileSync(join(RAIZ, 'cartas.html'), 'utf8')))
}

const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 191, card_count_total: 252 }]
const carta = (n, nombre) => ({ id: `sv8-${n}`, market: 'WEST', set_id: 'sv8', local_id: String(n), name: nombre, name_es: nombre, image_path: `sv/sv8/${n}`, rarity: 'Special Illustration Rare', category: 'Pokemon', types: ['Lightning'], dex_ids: [25], illustrator: 'Mitsuhiro Arita', variants: { normal: true, reverse: true }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', release_date: '2024-11-08', card_count_official: 191 } })
const CARTAS = [carta(238, 'Pikachu ex'), carta(239, 'Raichu'), carta(240, 'Zapdos'), ...Array.from({ length: 12 }, (_, i) => carta(241 + i, `Carta ${241 + i}`))]
const PRECIOS = [{ card_id: 'sv8-238', cm_id_product: 777, cm_low: 20, cm_low_es: 28.8, cm_low_en: 24.5, cm_low_it: 27.4, cm_low_fr: 26, cm_low_de: 25, tp_market_eur: 31.2, checked_at: '2026-10-19T10:00:00Z' }]
const COLECCION = [
  { id: 'l1', user_id: 'admin-1', card_id: 'sv8-238', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 2, created_at: '2026-10-01T10:00:00Z' },
  { id: 'o1', user_id: 'u-ana', card_id: 'sv8-238', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1, cambio: 0 },
  { id: 'o2', user_id: 'u-beto', card_id: 'sv8-238', market: 'WEST', idioma: 'en', estado: 'NM', variante: 'normal', cantidad: 4, cambio: 1 },
]
const browser = await chromium.launch()
async function abrir({ movil = false, ancho = 1366, ruta = '/mi-coleccion.html?ver=album&set=sv8' } = {}) {
  const ctx = await browser.newContext({ ...(movil ? devices['iPhone 13'] : { viewport: { width: ancho, height: 900 } }), locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    Object.assign(window, {
      __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_PRECIOS__: d.PRECIOS, __FAKE_COLECCION__: d.COLECCION, __FAKE_DESEOS__: [],
      __FAKE_PERFILES__: [{ id: 'admin-1', username: 'pingu' }, { id: 'u-ana', username: 'ana', coleccion_publica: true }, { id: 'u-beto', username: 'beto', coleccion_publica: true }],
      __FAKE_SEGUIDOS__: [{ follower_id: 'admin-1', following_id: 'u-ana' }],
      __FAKE_IDIOMAS_SET__: { sv8: ['de', 'en', 'es', 'fr', 'it'] },
      __FAKE_CARPETAS__: [{ id: 'c1', user_id: 'admin-1', parent_id: null, nombre: 'Archivador eléctrico', icono: 'folder', orden: 0, created_at: '2026-01-01T00:00:00Z' }],
      __FAKE_CARPETA_CARTAS__: [{ id: 'cc1', user_id: 'admin-1', folder_id: 'c1', line_id: 'l1' }],
    })
  }, { SETS, CARTAS, PRECIOS, COLECCION })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|scrydex|pokemontcg/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" rx="24" fill="#f59e0b"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { ctx, page, errores, cdp: movil ? await ctx.newCDPSession(page) : null }
}
const caja = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height), der: Math.round(r.right), abajo: Math.round(r.bottom) } })
// Dónde está cada carta de la rejilla: si la ficha la apartara, cambiaría.
const columnas = (page) => page.$$eval('#mcAlbum [data-carta]', (as) => as.slice(0, 8).map((a) => { const r = a.getBoundingClientRect(); return `${Math.round(r.left)},${Math.round(r.top)}` }).join(' '))

console.log('── 1–5. En el ordenador ──')
for (const ancho of [1366, 1440]) {
  const { ctx, page, errores } = await abrir({ ancho })
  const antes = await columnas(page)
  const hermanos = await page.evaluate(() => document.getElementById('mcAlbumHermanos')?.offsetHeight || 0)
  await page.locator('#mcAlbum [data-carta="sv8-238"]').first().click()
  await page.waitForTimeout(1500)
  check(`[${ancho}] sin errores`, errores.length === 0, errores.join(' | '))
  const d = await caja(page, '#mcEditor')
  const modal = await page.evaluate(() => document.getElementById('mcEditor').matches(':modal'))
  check(`[${ancho}] modal, centrado y ancho`, modal && Math.abs(d.x - (ancho - d.der)) <= 20 && d.w >= 1000 && d.abajo <= 900, JSON.stringify(d))
  check(`[${ancho}]   …y la expansión de detrás no se mueve`, (await columnas(page)) === antes && (await page.evaluate(() => document.getElementById('mcAlbumHermanos')?.offsetHeight || 0)) === hermanos, `${antes} → ${await columnas(page)}`)
  if (ancho === 1440) { await ctx.close(); continue }

  const foto = await caja(page, '#mcEdFoto')
  const datos = await caja(page, '.mc-ficha-datos')
  const titulo = await caja(page, '#mcEditorTitulo')
  check('dos columnas: la carta a la izquierda y los datos a la derecha, arriba', foto.der <= datos.x && titulo.y - d.y < 90, JSON.stringify({ foto, datos, titulo }))
  const fondo = await page.$eval('#mcEdFondo', (e) => ({ img: getComputedStyle(e).backgroundImage, filtro: getComputedStyle(e).filter }))
  check('  …la carta sobre su propia foto difuminada', /^url\(/.test(fondo.img) && /blur/.test(fondo.filtro), JSON.stringify(fondo))
  check('  …los datos se desplazan por dentro y la carta no', (await page.$eval('.mc-ficha-datos', (e) => getComputedStyle(e).overflowY)) === 'auto' && (await page.$eval('#mcEditor', (e) => getComputedStyle(e).overflow)) === 'hidden')

  const x = await caja(page, '#mcEdCerrar')
  const corazon = await caja(page, '#mcEdCompartir')
  check('arriba a la derecha la X y, a su izquierda, compartir', x.der <= d.der && x.der >= d.der - 24 && x.y - d.y <= 24 && corazon.der < x.x && Math.abs(corazon.y - x.y) <= 4, JSON.stringify({ x, corazon }))
  const izq = await caja(page, '#mcEdAnterior')
  const der = await caja(page, '#mcEdSiguiente')
  check('las flechas, fuera del pop-up y a media altura', izq.der <= d.x && der.x >= d.der && Math.abs(izq.y + izq.h / 2 - (d.y + d.h / 2)) <= 30, JSON.stringify({ izq, der, d }))
  const sitio = await caja(page, '#mcEdSitio')
  check('  …y el sitio en la lista, bajo la carta', sitio.y >= foto.abajo && sitio.der <= datos.x && /^1 de \d+$/.test(await page.textContent('#mcEdSitio')), await page.textContent('#mcEdSitio'))

  const chips = await page.$$eval('#mcEdVersiones .mc-version', (bs) => bs.map((b) => b.innerText.replace(/\s+/g, ' ').trim()))
  const vers = await caja(page, '#mcEdVersiones')
  vers.ultimoDer = await page.$eval('#mcEdVersiones .mc-version:last-child', (e) => Math.round(e.getBoundingClientRect().right))
  const acc = await caja(page, '#mcEdAcciones')
  check('las versiones en chips, a la vista', chips.length === 2 && /^Normal ✓$/.test(chips[0]) && chips[1] === 'Reverse holo' && !(await page.locator('#mcEdVersion').isVisible()), JSON.stringify(chips))
  // Desde la 923 la fila de versiones ocupa todo el ancho y deja su sitio
  // a la derecha (`padding-right`) al «− Tienes 2 +»: se mira el último chip.
  check('  …y «− Tienes 2 +» en la misma fila, a la derecha', Math.abs(vers.y + vers.h / 2 - (acc.y + acc.h / 2)) <= 12 && acc.x > vers.ultimoDer, JSON.stringify({ vers, acc }))
  await page.waitForTimeout(600)
  const alb = await caja(page, '#mcEdCarpetasBloque')
  const quien = await caja(page, '#mcEdQuienBloque')
  check('los álbumes y quién la tiene, uno al lado del otro', alb.h > 0 && quien.h > 0 && Math.abs(alb.y - quien.y) <= 4 && alb.der <= quien.x, JSON.stringify({ alb, quien }))
  const atrib = await page.$$eval('#mcEdTabla .mc-atrib', (fs) => new Set(fs.map((f) => Math.round(f.getBoundingClientRect().left))).size)
  // Tres desde la 923, para que la ficha quepa sin desplazarse.
  check('los atributos, en tabla de tres columnas', atrib === 3, String(atrib))

  await page.click('#mcEdSiguiente')
  await page.waitForTimeout(900)
  check('la flecha de fuera pasa de carta', (await page.textContent('#mcEditorTitulo')) === 'Raichu' && (await page.textContent('#mcEdSitio')).startsWith('2 de'))
  await page.mouse.click(20, 450)
  await page.waitForTimeout(700)
  check('tocar fuera lo cierra', !(await page.evaluate(() => document.getElementById('mcEditor').open)))
  await ctx.close()
}
{
  const { ctx, page } = await abrir({ ancho: 1680, ruta: '/mi-coleccion.html?ver=cartas' })
  await page.locator('#mcCartas .mc-carta').first().click()
  await page.waitForTimeout(1200)
  const d = await caja(page, '#mcEditor')
  check('[1680, Cartas] también modal y centrada, no a la derecha', (await page.evaluate(() => document.getElementById('mcEditor').matches(':modal'))) && Math.abs(d.x - (1680 - d.der)) <= 20, JSON.stringify(d))
  await ctx.close()
}

console.log('── 6. En el iPhone: la versión y tus copias, en su hoja ──')
{
  const { ctx, page, errores, cdp } = await abrir({ movil: true })
  await page.locator('#mcAlbum [data-carta="sv8-238"]').first().click()
  await page.waitForTimeout(1500)
  const arrastrar = async (desde, hasta, pasos = 8) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: desde.x, y: desde.y }] })
    for (let i = 1; i <= pasos; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: desde.x + ((hasta.x - desde.x) * i) / pasos, y: desde.y + ((hasta.y - desde.y) * i) / pasos }] })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la versión, en su fila (la lista cerrada)', (await page.locator('#mcEdVersion').isVisible()) && !(await page.locator('#mcEdVersiones').isVisible()))
  await page.click('#mcEdVersion')
  await page.waitForTimeout(500)
  const hoja = await caja(page, '#mcEdVersiones')
  const pos = await page.$eval('#mcEdVersiones', (e) => getComputedStyle(e).position)
  check('al tocarla, la lista sale en una hoja pegada abajo', pos === 'fixed' && hoja.abajo >= 664 - 2 && hoja.x === 0 && (await page.locator('#mcEdSubvelo').isVisible()), JSON.stringify({ pos, hoja }))
  const scrollAntes = await page.$eval('#mcEditor', (e) => e.scrollTop)
  await page.click('#mcEdSubvelo', { position: { x: 30, y: 30 } })
  await page.waitForTimeout(400)
  check('  …el velo la cierra a ella, y la ficha sigue abierta y donde estaba', !(await page.locator('#mcEdVersiones').isVisible()) && (await page.evaluate(() => document.getElementById('mcEditor').open)) && (await page.$eval('#mcEditor', (e) => e.scrollTop)) === scrollAntes)
  await page.click('#mcEdEditar')
  await page.waitForTimeout(500)
  const copias = await caja(page, '#mcEdCopiaBloque')
  check('«Editar» abre tus copias en su hoja, con los campos', (await page.$eval('#mcEdCopiaBloque', (e) => getComputedStyle(e).position)) === 'fixed' && copias.abajo >= 662 && (await page.locator('#mcEdIdioma').isVisible()), JSON.stringify(copias))
  const arriba = { x: 195, y: copias.y + 14 }
  await arrastrar(arriba, { x: 195, y: arriba.y + 180 })
  await page.waitForTimeout(500)
  const tras = await page.evaluate(() => ({ hoja: !document.getElementById('mcEdCopiaBloque').classList.contains('hidden'), ficha: document.getElementById('mcEditor').open, rotulo: document.querySelector('#mcEdEditar span')?.textContent }))
  check('  …arrastrar hacia abajo cierra la hoja, no la ficha', !tras.hoja && tras.ficha && tras.rotulo === 'Editar', JSON.stringify(tras))
  check('sin errores al final', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
