// Tanda 748 — seleccionar varias, como en su maqueta (C4 rehecha).
//
// PINGU: «mantener pulsado una carta no funciona, para seleccionar varias».
// Tenía razón: el gesto solo estaba en la rejilla de una expansión, no en
// la de «Cartas», y en el iPhone mantener una imagen o un enlace saca la
// vista previa del sistema, que se come el gesto. Lo que se mira:
//   · con el DEDO (eventos táctiles de verdad), mantener una carta de
//     «Cartas» enciende la selección, la marca y no abre la ficha; los
//     toques siguientes van sumando;
//   · la barra es la de la maqueta: fija arriba, de color, con «N
//     seleccionadas» y «Seleccionar todas»; las acciones flotan abajo y la
//     barra de abajo del sitio se esconde;
//   · «Seleccionar todas» marca las que se ven;
//   · «Añadir» desde Cartas suma UNA copia de cada una, con su idioma;
//   · cambiar de pestaña sale de la selección;
//   · en una expansión, lo mismo;
//   · y la hoja quita la vista previa del iPhone (`-webkit-touch-callout`).
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

async function abrir(ver) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 6, card_count_total: 6 }]
    window.__FAKE_CARTAS__ = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
    window.__FAKE_COLECCION__ = [1, 2, 3, 4].map((n) => ({ id: `l${n}`, user_id: 'admin-1', card_id: `xy5-${n}`, market: 'WEST', cantidad: 1, idioma: n === 2 ? 'en' : 'es', estado: 'NM', variante: 'normal', created_at: `2026-10-0${n}T10:00:00Z` }))
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=${ver}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const cdp = await ctx.newCDPSession(page)
  // Un dedo de verdad: touchStart, esperar, touchEnd. Playwright no tiene
  // «mantener» con el dedo, y con el ratón no se prueba lo que pasa en el
  // iPhone.
  const dedo = async (sel, i, ms) => {
    await page.locator(sel).nth(i).evaluate((el) => el.scrollIntoView({ block: 'center' }))
    await page.waitForTimeout(150)
    const b = await page.locator(sel).nth(i).boundingBox()
    const x = b.x + b.width / 2, y = b.y + b.height / 2
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
    await page.waitForTimeout(ms)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(400)
  }
  return { page, ctx, errores, dedo }
}
const estado = (page) => page.evaluate(() => {
  const arriba = document.querySelector('#mcMarcarBarra .mc-sel-arriba')
  const abajo = document.getElementById('mcMarcarAcciones')
  const r = (e) => e && e.getBoundingClientRect()
  return {
    puesta: !document.getElementById('mcMarcarBarra').classList.contains('hidden'),
    cuenta: document.getElementById('mcMarcarCuenta').textContent,
    ficha: !!document.getElementById('mcEditor')?.open,
    arriba: arriba && { y: Math.round(r(arriba).top), fija: getComputedStyle(arriba).position === 'fixed', fondo: getComputedStyle(arriba).backgroundColor },
    abajo: abajo && { abajo: Math.round(innerHeight - r(abajo).bottom), fija: getComputedStyle(abajo).position === 'fixed' },
    barraSitio: document.querySelector('nav.bm') ? getComputedStyle(document.querySelector('nav.bm')).visibility : null,
    marcadas: document.querySelectorAll('.marcada').length,
  }
})

console.log('── 1. En «Cartas», con el dedo ──')
{
  const { page, ctx, errores, dedo } = await abrir('cartas')
  const C = '#mcCartas .mc-carta[data-linea]'
  // Chromium no conoce `-webkit-touch-callout` (es de Safari) y lo quita al
  // leer la hoja, así que se mira en el fichero.
  const hoja = await page.evaluate(() => fetch('/css/mi-coleccion.css').then((r) => r.text()))
  const regla = hoja.match(/\.mc-carta,\s*\.mc-bolsillo\s*\{[^}]*\}/)?.[0] || ''
  check('mantener una carta no saca la vista previa del iPhone ni selecciona texto', /-webkit-touch-callout:\s*none/.test(regla) && /user-select:\s*none/.test(regla), regla)
  await dedo(C, 0, 650)
  let e = await estado(page)
  check('mantener medio segundo enciende la selección y marca esa carta, sin abrir la ficha', e.puesta && e.cuenta === '1 seleccionada' && !e.ficha && e.marcadas === 1, JSON.stringify(e))
  check('  …la barra es la de la maqueta: fija arriba del todo y de color', e.arriba.fija && e.arriba.y === 0 && e.arriba.fondo !== 'rgba(0, 0, 0, 0)', JSON.stringify(e.arriba))
  check('  …las acciones flotan abajo y la barra de abajo del sitio se esconde', e.abajo.fija && e.abajo.abajo >= 0 && e.abajo.abajo < 60 && e.barraSitio === 'hidden', JSON.stringify(e))
  await dedo(C, 1, 80)
  await dedo(C, 2, 80)
  e = await estado(page)
  check('con la selección puesta, cada toque suma una (sin abrir la ficha)', e.cuenta === '3 seleccionadas' && !e.ficha, JSON.stringify(e))
  await dedo(C, 2, 80)
  check('  …y tocar una marcada la quita', (await estado(page)).cuenta === '2 seleccionadas')
  check('las acciones dicen cuántas', (await page.textContent('#mcMarcarGuardarTexto')).trim() === 'Añadir 2' && /Quitar 2/.test(await page.textContent('#mcMarcarQuitarTexto')))
  check('  …y cada una mide 44 o más', await page.$$eval('#mcMarcarAcciones button, .mc-sel-arriba button', (bs) => bs.every((b) => b.getBoundingClientRect().height >= 44)))
  await page.click('#mcMarcarTodas')
  check('«Seleccionar todas» marca las que se ven', (await estado(page)).cuenta === '4 seleccionadas')
  await page.click('#mcMarcarCancelar')
  await dedo(C, 1, 650)
  const antes = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').length)
  await page.click('#mcMarcarGuardar')
  await page.waitForTimeout(800)
  const escr = await page.evaluate(() => JSON.parse(sessionStorage.getItem('__escrituras__') || '[]'))
  const nuevas = escr.slice(antes).filter((x) => x.tabla === 'user_collection')
  const fila = nuevas.flatMap((x) => x.filas || [x.fila || x.datos || {}])[0] || {}
  check('«Añadir» desde Cartas suma una copia MÁS de esa, con su idioma (la 2 es inglesa)', nuevas.length >= 1 && (fila.card_id === 'xy5-2' || JSON.stringify(nuevas).includes('xy5-2')) && (fila.idioma === 'en' || /"idioma":"en"|cantidad/.test(JSON.stringify(nuevas))), JSON.stringify(nuevas).slice(0, 300))
  check('  …y la selección se cierra', !(await estado(page)).puesta)
  await dedo(C, 0, 650)
  // Con la selección puesta, en el móvil las pestañas se esconden (tapa la
  // barra de abajo); en el ordenador siguen ahí. Se pulsa por código.
  await page.evaluate(() => document.querySelector('.mc-pestanias [data-pestania="album"]').click())
  await page.waitForTimeout(500)
  check('cambiar de pestaña sale de la selección', !(await estado(page)).puesta)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. En una expansión ──')
{
  const { page, ctx, errores, dedo } = await abrir('album&set=xy5')
  const A = '#mcAlbum .mc-bolsillo-enlace[data-carta]'
  await dedo(A, 4, 650)
  let e = await estado(page)
  check('mantener una carta enciende la selección (también una que no tienes)', e.puesta && e.cuenta === '1 seleccionada' && !e.ficha, JSON.stringify(e))
  await dedo(A, 5, 80)
  e = await estado(page)
  check('  …y el siguiente toque suma', e.cuenta === '2 seleccionadas' && !e.ficha, JSON.stringify(e))
  const visto = await page.evaluate(() => { const b = document.querySelector('#mcAlbum .mc-bolsillo.marcada'); const r = b.getBoundingClientRect(); const a = getComputedStyle(b, '::after'); return { izq: parseFloat(a.left), ancho: parseFloat(a.width), caja: r.width } })
  check('  …el visto va en la esquina de arriba a la derecha', visto.ancho <= 28 && visto.izq > visto.caja / 2, JSON.stringify(visto))
  check('  …y el «+» de cada casilla se esconde', await page.$$eval('#mcAlbum .mc-mas', (ms) => ms.every((m) => getComputedStyle(m).display === 'none')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. La hoja de añadir, la de su maqueta (C5), en Mi colección y en /carta ──')
for (const [donde, ruta, abrirla, pre] of [
  ['Mi colección', '/mi-coleccion.html?ver=album&set=xy5', async (page) => { await page.locator('#mcAlbum .mc-mas[data-anadir="xy5-1"]').first().click() }, 'mcAd'],
  ['/carta', '/carta.html?id=xy5-1', async (page) => { await page.locator('#cmAnadir').click() }, 'cmAd'],
]) {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 6, card_count_total: 6 }]
    window.__FAKE_CARTAS__ = [1, 2].map((n) => ({ id: `xy5-${n}`, market: 'WEST', set_id: 'xy5', local_id: String(n), name: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true, reverse: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
    window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'xy5-1', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'normal' }]
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await abrirla(page)
  await page.waitForTimeout(800)
  const m = await page.evaluate((pre) => {
    const $ = (id) => document.getElementById(pre + id)
    const d = document.querySelector('dialog.mc-anadir-dialogo[open]')
    const r = (e) => e.getBoundingClientRect()
    const chips = [...$('Idiomas').querySelectorAll('.mc-idioma-chip')]
    return {
      abierta: !!d, titulo: !!d?.querySelector('.mc-panel-cabecera'), paso: !!d?.querySelector('.mc-ad-ya'),
      tirador: !!d?.querySelector('.mc-ad-tirador'), nombre: $('Nombre').textContent, set: $('Set').textContent, tienes: $('Tienes').textContent,
      chipsUnaFila: new Set(chips.map((c) => Math.round(r(c).top))).size === 1,
      activoNombre: d?.querySelector('.mc-idioma-chip.activo')?.textContent.trim(), otro: chips.find((c) => !c.classList.contains('activo'))?.textContent.trim(),
      segmentados: d?.querySelectorAll('.mc-seg').length,
      fila: Math.abs(r(d.querySelector('.mc-ad-fila .mc-contador-mando')).top - r($('Compra')).top) <= 1,
      dentro: [...d.querySelectorAll('.mc-ad-fila *, .mc-ad-guardar')].every((e) => r(e).right <= innerWidth + 1),
      guardar: $('Guardar').textContent.trim(), ancho: Math.round(r($('Guardar')).width), hoja: Math.round(r(d).width),
      cabe: d.scrollHeight <= d.clientHeight + 1,
    }
  }, pre)
  check(`[${donde}] sin barra de título ni paso de «Ya en tu colección»: directa al formulario, con su tirador`, m.abierta && !m.titulo && !m.paso && m.tirador, JSON.stringify(m))
  check(`[${donde}]   …la cabecera: nombre, set · número y «Ya tienes 2»`, m.nombre === 'Carta 1' && m.set === 'Duelos Primigenios · 1' && m.tienes === 'Ya tienes 2', JSON.stringify(m))
  check(`[${donde}]   …los idiomas en UNA fila: el elegido con su nombre, los demás con su sigla`, m.chipsUnaFila && /Español/.test(m.activoNombre) && /^[A-Z]{2}$/.test(m.otro), JSON.stringify(m))
  check(`[${donde}]   …estado y versión segmentados, copias y precio en una fila, nada se sale`, m.segmentados === 2 && m.fila && m.dentro, JSON.stringify(m))
  check(`[${donde}]   …un solo botón, ancho, que dice lo que hará, y la hoja cabe entera`, m.guardar === 'Añadir 1 copia' && m.ancho >= m.hoja - 48 && m.cabe, JSON.stringify(m))
  await page.mouse.click(195, 40)
  await page.waitForTimeout(400)
  check(`[${donde}]   …tocar fuera la cierra`, !(await page.evaluate(() => !!document.querySelector('dialog.mc-anadir-dialogo[open]'))))
  check(`[${donde}] sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Los filtros, los de su maqueta (C6) ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 6, card_count_total: 6 }]
    const tipos = ['Fire', 'Water', 'Fire', 'Grass', 'Dragon', 'Water']
    window.__FAKE_CARTAS__ = tipos.map((t, i) => ({ id: `xy5-${i + 1}`, market: 'WEST', set_id: 'xy5', local_id: String(i + 1), name: `Carta ${i + 1}`, image_path: `x/${i + 1}`, rarity: i % 2 ? 'Rare' : 'Common', category: 'Pokemon', types: [t], dex_ids: [i + 1], variants: { normal: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }))
    window.__FAKE_COLECCION__ = [1, 2, 3, 4].map((n) => ({ id: `l${n}`, user_id: 'admin-1', card_id: `xy5-${n}`, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: n * 10 }))
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=cartas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.click('#mcAbrirFiltros')
  await page.waitForTimeout(600)
  const c = await page.evaluate(() => {
    const d = document.getElementById('mcPanelFiltros')
    const r = (e) => e.getBoundingClientRect()
    const borrar = document.getElementById('mcFiltrosLimpiar')
    const energias = [...d.querySelectorAll('.chip-energia')]
    const primero = d.querySelector('#mcGruposChips h3')?.textContent
    const ver = document.getElementById('mcFiltrosVer')
    return {
      borrarArriba: !!borrar.closest('.mc-panel-cabecera') && borrar.textContent.trim() === 'Borrar todo',
      primero, energias: energias.map((e) => ({ l: e.getAttribute('aria-label'), w: Math.round(r(e).width), h: Math.round(r(e).height), img: !!e.querySelector('img.mc-energia'), txt: e.textContent.trim() })),
      tiradores: d.querySelectorAll('#mcRangoDoble input[type="range"]').length, tope: document.getElementById('mcPrecioTiradorMax').max,
      ver: { w: Math.round(r(ver).width), hoja: Math.round(r(d).width), bajo: Math.round(r(d).bottom - r(ver).bottom) },
      tirador: getComputedStyle(document.getElementById('mcFiltrosCerrar'), '::before').width,
    }
  })
  check('[Cartas] «Borrar todo» arriba, en la cabecera, y el aspa es el tirador', c.borrarArriba && c.tirador === '36px', JSON.stringify(c))
  check('[Cartas]   …el tipo, PRIMERO y en redondo: el símbolo solo, con su nombre para quien no lo ve (las de TU colección: Agua, Fuego, Planta)', c.primero === 'Tipo' && c.energias.length === 3 && c.energias.every((e) => e.img && e.txt === '' && e.w === 44 && e.h === 44 && e.l), JSON.stringify(c.energias))
  check('[Cartas]   …el precio con dos tiradores, hasta lo que vale tu copia más cara', c.tiradores === 2 && c.tope === '40', JSON.stringify(c))
  check('[Cartas]   …y abajo un solo botón ancho, pegado al fondo', c.ver.w >= c.ver.hoja - 48 && c.ver.bajo <= 40, JSON.stringify(c.ver))
  await page.locator('#mcPrecioTiradorMin').evaluate((t) => { t.value = '25'; t.dispatchEvent(new Event('input', { bubbles: true })) })
  await page.waitForTimeout(300)
  check('[Cartas] mover el tirador de abajo filtra: 2 cartas de 25 € o más, y el campo lo dice', (await page.textContent('#mcFiltrosVer')).trim() === 'Ver 2 cartas' && (await page.inputValue('#mcFiltroPrecioDesde')) === '25', await page.textContent('#mcFiltrosVer'))
  await page.click('#mcFiltrosLimpiar')
  await page.waitForTimeout(300)
  check('[Cartas]   …y «Borrar todo» lo devuelve', (await page.textContent('#mcFiltrosVer')).trim() === 'Ver 4 cartas' && (await page.inputValue('#mcPrecioTiradorMin')) === '0')
  await page.locator('.chip-energia[aria-label="Fuego"]').click()
  await page.waitForTimeout(300)
  check('[Cartas] tocar Fuego deja las dos de fuego', (await page.textContent('#mcFiltrosVer')).trim() === 'Ver 2 cartas')
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=xy5`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(600)
  const a = await page.evaluate(() => ({
    que: [...document.querySelectorAll('#mcAlbumPanelFiltros .mc-seg-que button')].map((b) => `${b.textContent}${b.getAttribute('aria-pressed') === 'true' ? '*' : ''}`).join('|'),
    primero: document.querySelector('#mcAlbumPanelFiltros .mc-grupo-filtro:not(.hidden) h3')?.textContent,
    energias: [...document.querySelectorAll('#mcAlbumPanelFiltros .mc-seg-energias .mc-seg-dibujo')].map((b) => b.getAttribute('aria-label')),
    borrar: !!document.getElementById('mcAlbumFiltrosLimpiar').closest('.mc-panel-cabecera'),
  }))
  check('[Expansión] arriba «Qué cartas»: Todas (puesta), Las tengo, Me faltan', a.primero === 'Qué cartas' && a.que === 'Todas*|Las tengo|Me faltan', JSON.stringify(a))
  check('[Expansión]   …el tipo, con los símbolos de las que hay en la expansión', a.energias.sort().join() === 'Agua,Dragón,Fuego,Planta', JSON.stringify(a.energias))
  check('[Expansión]   …y «Borrar todo» arriba', a.borrar)
  await page.click('#mcAlbumSoloFaltan')
  await page.waitForTimeout(300)
  check('[Expansión] «Me faltan» deja las 2 que no tienes y «Todas» se apaga', (await page.textContent('#mcAlbumFiltrosVer')).trim() === 'Ver 2 cartas' && (await page.getAttribute('#mcAlbumTodas', 'aria-pressed')) === 'false')
  await page.click('#mcAlbumTodas')
  await page.locator('#mcAlbumPanelFiltros .mc-seg-dibujo[aria-label="Agua"]').click()
  await page.waitForTimeout(300)
  check('[Expansión] «Todas» vuelve y el tipo Agua deja las dos de agua', (await page.textContent('#mcAlbumFiltrosVer')).trim() === 'Ver 2 cartas' && (await page.getAttribute('#mcAlbumTodas', 'aria-pressed')) === 'true', await page.textContent('#mcAlbumFiltrosVer'))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. La Pokédex: el color no depende de que tus cartas traigan el tipo (C3) ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'sv3pt5', name: '151', serie_id: 'sv', market: 'WEST', card_count_official: 3, card_count_total: 3 }]
    // Mewtwo y Dratini SIN `types` (como tantas cartas antes del engorde) y
    // Charizard con el suyo.
    window.__FAKE_CARTAS__ = [
      { id: 'sv3pt5-150', name: 'Mewtwo', dex_ids: [150] },
      { id: 'sv3pt5-147', name: 'Dratini', dex_ids: [147] },
      { id: 'sv3pt5-6', name: 'Charizard ex', dex_ids: [6], types: ['Fire'] },
    ].map((c) => ({ ...c, market: 'WEST', set_id: 'sv3pt5', local_id: c.id.split('-')[1], image_path: 'x', rarity: 'Common', category: 'Pokemon', variants: { normal: true }, tcg_sets: { id: 'sv3pt5', name: '151', serie_id: 'sv' } }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal' }))
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=pokedex`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const t = await page.evaluate(() => Object.fromEntries([150, 147, 6, 7].map((d) => {
    const b = document.querySelector(`.pdx-especie[data-dex="${d}"]`)
    return [d, { tipo: (b.className.match(/tipo-([A-Z])/) || [])[1] || null, icono: b.querySelector('.pdx-energia')?.getAttribute('src') || null, nombre: b.querySelector('.pdx-nombre').textContent, cuenta: b.querySelector('.pdx-cuenta').textContent, etiqueta: b.getAttribute('aria-label') }]
  })))
  check('Mewtwo tuyo SIN tipo en su carta: teñido de Psíquico igual (sale de la especie)', t[150].tipo === 'P' && /P\.svg$/.test(t[150].icono), JSON.stringify(t[150]))
  check('  …Dratini, de Dragón, con su símbolo nuevo', t[147].tipo === 'N' && /N\.svg$/.test(t[147].icono), JSON.stringify(t[147]))
  check('  …Charizard, con el de su carta (Fuego)', t[6].tipo === 'R', JSON.stringify(t[6]))
  check('el que no tienes: sin teñir, «???» y «te falta», su símbolo (en gris) y su nombre para quien no lo ve', t[7].tipo === null && t[7].nombre === '???' && t[7].cuenta === 'te falta' && /W\.svg$/.test(t[7].icono) && /^Squirtle/.test(t[7].etiqueta), JSON.stringify(t[7]))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. El Panel es la cartera de su maqueta (C1) ──')
for (const [nombre, opciones] of [['iPhone', { ...devices['iPhone 13'] }], ['portátil', { viewport: { width: 1280, height: 900 } }]]) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 6, card_count_total: 6 }, { id: 'xy6', name: 'Cielos Rugientes', serie_id: 'xy', market: 'WEST', card_count_official: 6, card_count_total: 6 }]
    window.__FAKE_CARTAS__ = [1, 2, 3, 4].map((n) => ({ id: `xy${n < 3 ? 5 : 6}-${n}`, market: 'WEST', set_id: n < 3 ? 'xy5' : 'xy6', local_id: String(n), name: ['Mewtwo-EX', 'Rayquaza-EX', 'Ho-Oh-EX', 'Pikachu'][n - 1], image_path: `x/${n}`, rarity: 'Rare', category: 'Pokemon', dex_ids: [n], variants: { normal: true } }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: c.id, market: 'WEST', cantidad: i + 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
    window.__FAKE_PRECIOS__ = window.__FAKE_CARTAS__.map((c, i) => ({ card_id: c.id, market: 'WEST', cm_low: [12.4, 8.9, 4.1, 2][i], cm_low_es: [12.4, 8.9, 4.1, 2][i], tcggo_updated: '2026-10-06T12:00:00Z', origen: 'tcggo' }))
    const dia = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
    window.__FAKE_VALOR__ = Array.from({ length: 40 }, (_, i) => ({ user_id: 'admin-1', dia: dia(39 - i), valor: 30 + i * 0.5 }))
    // Ocho días de precio: Mewtwo sube un 18 %, Ho-Oh baja un 6 %.
    window.__FAKE_HISTORIAL__ = [[0, 10.5, 12.4], [1, 8.2, 8.9], [2, 4.36, 4.1], [3, 2, 2]].flatMap(([k, a, b]) => Array.from({ length: 8 }, (_, d) => ({ card_id: window.__FAKE_CARTAS__[k].id, dia: dia(7 - d), cm_low: a + (b - a) * d / 7, cm_low_es: a + (b - a) * d / 7, origen: 'tcggo' })))
    window.__desplazado = 0
    addEventListener('scroll', () => { window.__desplazado = Math.max(window.__desplazado, scrollY) })
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  const m = await page.evaluate(() => {
    const r = (e) => e?.getBoundingClientRect()
    const q = (s) => document.querySelector(s)
    const t = (s) => (q(s)?.textContent || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim()
    return {
      cabecera: Math.round(r(q('#mcHero')).height),
      etiqueta: t('.mc-cartera-etiqueta'),
      cifra: t('.mc-cartera-cifra'),
      cambio: t('#mcValorCaja .mc-valor-cambio'),
      flecha: !!q('#mcValorCaja .mc-valor-cambio.sube .mc-valor-flecha'),
      rangos: [...document.querySelectorAll('#mcValorCaja [data-rango]')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' '),
      rejilla: document.querySelectorAll('#mcValorCaja .mc-valor-rotulos, #mcValorCaja .mc-valor-chips').length,
      fichas: [...document.querySelectorAll('.mc-cartera-fichas li')].map((li) => [...li.children].map((c) => c.textContent.trim()).join(' ')),
      movidas: [...document.querySelectorAll('#mcMovidas .mc-movida')].map((a) => ({ n: a.querySelector('b').textContent, set: a.querySelector('small').textContent, pct: a.querySelector('.mc-movida-precio small').textContent.replace(/[  ]/g, ' '), sube: a.classList.contains('sube') })),
      movidasTras: (() => { const f = q('.mc-cartera-fichas'), mv = q('#mcMovidas'); return !!(f && mv) && r(mv).top >= r(f).bottom - 1 })(),
      compartirAbajo: (() => { const c = q('#mcCompartir'), v = q('#mcVistazos'); return !!(c && v) && r(c).top >= r(v).top })(),
      ancho: document.documentElement.scrollWidth <= innerWidth + 1,
      desplazado: window.__desplazado,
    }
  })
  check(`[${nombre}] sin errores`, errores.length === 0, errores.join(' | '))
  check(`[${nombre}] abre con lo que vale y nada encima`, m.cabecera === 0 && m.etiqueta === 'Lo que vale tu colección' && /^\d[\d.]*,\d{2} €$/.test(m.cifra), JSON.stringify(m))
  check(`[${nombre}]   …con el cambio del mes y su flecha`, m.flecha && /^Sube [\d.,]+ € · [\d,]+ % este mes$/.test(m.cambio), m.cambio)
  check(`[${nombre}]   …los cinco rangos con 1M puesto, y sin rejilla`, m.rangos === '7D 1M* 6M 1A Todo' && m.rejilla === 0, m.rangos)
  check(`[${nombre}] tres fichas: cartas, distintas y expansiones`, m.fichas.join(' | ') === '10 cartas | 4 distintas | 2 expansiones', m.fichas.join(' | '))
  check(`[${nombre}] «Las que más se mueven», debajo de las fichas, en lista`, m.movidasTras && m.movidas.length === 3, JSON.stringify(m.movidas))
  check(`[${nombre}]   …las tres que MÁS se mueven, con su set y su signo`, m.movidas[0]?.n === 'Mewtwo-EX' && m.movidas[0].set === 'Duelos Primigenios' && m.movidas[0].pct === '+18 %' && m.movidas[0].sube && m.movidas.some((x) => x.n === 'Ho-Oh-EX' && x.pct === '−6 %' && !x.sube) && !m.movidas.some((x) => x.n === 'Pikachu'), JSON.stringify(m.movidas))
  check(`[${nombre}] «Colección pública», al final`, m.compartirAbajo)
  check(`[${nombre}] la página no se va de ancho`, m.ancho)
  check(`[${nombre}] y al cargar no baja sola (la columna de filtros enfocaba «Borrar todo»)`, m.desplazado === 0, String(m.desplazado))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
