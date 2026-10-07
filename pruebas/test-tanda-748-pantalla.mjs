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

console.log('── 7. Las Expansiones son la lista de su maqueta (C2) ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [
      { id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-08-11', tcg_online_code: 'OBF' },
      { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-06-09', tcg_online_code: 'PAL' },
      { id: 'swsh12pt5', name: 'Cénit Supremo', serie_id: 'swsh', market: 'WEST', card_count_official: 2, card_count_total: 2, release_date: '2023-01-20', tcg_online_code: 'CRZ' },
      { id: 'swsh12', name: 'Tempestad Plateada', serie_id: 'swsh', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2022-11-11', tcg_online_code: 'SIT' },
    ]
    const c = (set, n) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true } })
    window.__FAKE_CARTAS__ = [c('sv3', 1), c('sv3', 2), c('sv3', 3), c('sv2', 1), c('swsh12pt5', 1), c('swsh12pt5', 2), c('swsh12', 1)]
    // Llevas 3/4 de OBF, 1/4 de PAL, CRZ completa y SIT sin empezar.
    window.__FAKE_COLECCION__ = ['sv3-1', 'sv3-2', 'sv3-3', 'sv2-1', 'swsh12pt5-1', 'swsh12pt5-2'].map((id, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
    try { localStorage.removeItem('mc-estanteria-orden') } catch {}
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const filas = () => page.$$eval('#mcEstanteriaRejilla .mc-set-fila', (fs) => fs.map((f) => ({ set: f.dataset.set, codigo: f.querySelector('.mc-set-codigo')?.textContent.trim(), cuenta: f.querySelector('.mc-set-corta')?.textContent.replace(/\s+/g, ' ').trim(), anillo: f.querySelector('.mc-set-anillo')?.getAttribute('aria-label'), alto: Math.round(f.getBoundingClientRect().height) })))
  const cab = await page.evaluate(() => ({
    titulo: document.querySelector('.mc-estanteria-h')?.textContent,
    orden: !!document.getElementById('mcEstanteriaOrdenAbrir')?.offsetHeight,
    buscadorEscondido: !document.getElementById('mcEstanteriaBuscar')?.offsetHeight,
    chapas: [...document.querySelectorAll('.mc-estanteria-que button')].map((b) => b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' '),
    catalogo: [...document.querySelectorAll('.mc-estanteria-fila2 .seg-btn')].some((b) => b.offsetHeight > 0),
    eras: [...document.querySelectorAll('#mcEstanteriaRejilla .mc-estanteria-titulo')].length,
    tarjetasPorEra: [...document.querySelectorAll('#mcEstanteriaRejilla .mc-estanteria-lista')].length,
  }))
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la cabecera: «Expansiones» con «Orden», el buscador tras la lupa y el catálogo a la vista', cab.titulo === 'Expansiones' && cab.orden && cab.buscadorEscondido && cab.catalogo, JSON.stringify(cab))
  check('  …y las tres chapas, con «Todas» puesta', cab.chapas === 'Empezadas Todas* Completas', cab.chapas)
  check('una tarjeta por era, con una fila por expansión', cab.eras === 2 && cab.tarjetasPorEra === 2, JSON.stringify(cab))
  const fs = await filas()
  const obf = fs.find((f) => f.set === 'sv3')
  const crz = fs.find((f) => f.set === 'swsh12pt5')
  check('cada fila: código, «3/4» y su anillo, y baja', obf?.codigo === 'OBF' && /(^| · )3\/4$/.test(obf.cuenta) && obf.anillo === '3 de 4' && fs.every((f) => f.alto <= 90), JSON.stringify(fs))
  check('  …y la completa lo dice', /(^| · )2\/2 · Completa$/.test(crz?.cuenta || ''), JSON.stringify(crz))
  await page.click('#mcEstanteriaEmpezadas')
  await page.waitForTimeout(500)
  check('«Empezadas» quita las que no has empezado', (await filas()).map((f) => f.set).sort().join(',') === 'sv2,sv3,swsh12pt5', JSON.stringify(await filas()))
  await page.click('#mcEstanteriaCompletas')
  await page.waitForTimeout(500)
  check('«Completas», solo las acabadas', (await filas()).map((f) => f.set).join(',') === 'swsh12pt5', JSON.stringify(await filas()))
  await page.click('#mcEstanteriaTodas')
  await page.click('#mcEstanteriaOrdenAbrir')
  await page.waitForTimeout(300)
  check('«Orden» abre su hoja, con la serie dentro', await page.locator('#mcEstanteriaOrden').evaluate((d) => d.open) && await page.locator('#mcEstanteriaSerie').isVisible())
  await page.click('[data-orden-sets="progreso"]')
  await page.waitForTimeout(400)
  await page.click('#mcEstanteriaOrdenVer')
  await page.waitForTimeout(300)
  const porProgreso = await filas()
  check('«Lo que más llevas»: una lista, de lo más lleno a lo vacío, sin rótulos de era', porProgreso.map((f) => f.set).join(',') === 'swsh12pt5,sv3,sv2,swsh12' && (await page.locator('#mcEstanteriaRejilla .mc-estanteria-titulo').count()) === 0, porProgreso.map((f) => f.set).join(','))
  check('  …y el botón de «Orden» dice que hay un orden puesto', await page.locator('#mcEstanteriaOrdenAbrir.activo').count() === 1)
  await page.click('#mcEstanteriaLupa')
  await page.waitForTimeout(200)
  await page.fill('#mcEstanteriaBuscar', 'tempestad')
  await page.waitForTimeout(400)
  check('la lupa saca el buscador y busca', (await filas()).map((f) => f.set).join(',') === 'swsh12', JSON.stringify(await filas()))
  check('la página no se va de ancho', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await ctx.close()
}

console.log('── 8. La hoja «Tú» de su maqueta (N8) ──')
for (const [nombre, opciones] of [['iPhone', { ...devices['iPhone 13'] }], ['portátil', { viewport: { width: 1280, height: 900 } }]]) {
  const ctx = await browser.newContext({ ...opciones, locale: 'es-ES', colorScheme: 'dark' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_NOTIFICACIONES__ = [{ recipient_id: 'admin-1', type: 'forum_reply', title: 'Misty te ha respondido' }, { recipient_id: 'admin-1', type: 'forum_reply', title: 'Ash te ha respondido' }]
    try { localStorage.setItem('pokedoc-theme', 'light') } catch {}
  })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const css = () => page.evaluate(() => [...document.querySelectorAll('link[rel=stylesheet]')].some((l) => /menu-tu\.css/.test(l.href)))
  check(`[${nombre}] la hoja de la hoja «Tú» no se baja hasta tocarla`, !(await css()))
  await page.click('#navUserBtn')
  await page.waitForTimeout(900)
  const m = await page.evaluate(() => {
    const d = document.getElementById('navUserDropdown')
    const t = (s) => (d.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim()
    return {
      quien: t('.tu-quien'),
      perfil: d.querySelector('.tu-perfil')?.getAttribute('href'),
      dos: [...d.querySelectorAll('.tu-dos > *')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
      lista: [...d.querySelectorAll('.tu-lista a')].map((a) => `${a.textContent.trim()}>${a.getAttribute('href')}`),
      tema: [...d.querySelectorAll('[data-tema]')].map((b) => b.textContent.trim() + (b.getAttribute('aria-pressed') === 'true' ? '*' : '')).join(' '),
      salir: t('#navUserSignOut'),
      viejo: !!d.querySelector('.nav-user-stats, .bm-tu-filas'),
      dentro: (() => { const r = d.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1 })(),
    }
  })
  check(`[${nombre}] sin errores`, errores.length === 0, errores.join(' | '))
  check(`[${nombre}] quién eres en una línea, con «Ver perfil»`, /^Admin @Admin · Novato/.test(m.quien) && m.perfil === '/perfil.html', JSON.stringify(m))
  check(`[${nombre}] avisos (con su número) y mensajes en dos losetas`, m.dos.length === 2 && /^Avisos ?2$/.test(m.dos[0]) && /^Mensajes/.test(m.dos[1]), JSON.stringify(m.dos))
  check(`[${nombre}] lo tuyo en una lista, con «Ajustes» al final`, m.lista.join(' | ') === 'La quiero>/mi-coleccion?ver=quiero | Guardados>/guardados.html | Mis mazos>/mazos | Mis partidas>/mis-partidas | Escribir una guía>/editor-guia.html | Ajustes>/perfil.html?editar=1', m.lista.join(' | '))
  check(`[${nombre}] el tema en tres y «Salir» aparte`, m.tema === 'Claro* Oscuro Auto' && m.salir === 'Salir' && !m.viejo && m.dentro, JSON.stringify(m))
  check(`[${nombre}]   …y su hoja llega al abrirla`, await css())
  await page.click('#navUserDropdown [data-tema="auto"]')
  await page.waitForTimeout(200)
  const auto = await page.evaluate(() => ({ guardado: localStorage.getItem('pokedoc-theme'), tema: document.documentElement.dataset.theme, sistema: matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light' }))
  check(`[${nombre}] «Auto» olvida la elección y sigue al sistema`, auto.guardado === null && auto.tema === 'dark' && auto.sistema === 'dark', JSON.stringify(auto))
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/perfil.html?editar=1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('«Ajustes» abre el editor del perfil y limpia la dirección', await page.locator('#peDisplayName').isVisible() && !/editar=/.test(page.url()), page.url())
  await ctx.close()
}

console.log('── 9. La portada «Hoy» de su maqueta (J5 y N1) ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    const hoy = Date.now()
    window.__FAKE_VALOR__ = Array.from({ length: 40 }, (_, i) => ({ user_id: 'admin-1', dia: new Date(hoy - (39 - i) * 864e5).toISOString().slice(0, 10), valor: 1000 + i * 2 }))
    window.__FAKE_GUIAS__ = [{ id: 'guia-1', slug: 'primer-mazo', title: 'Cómo montar tu primer mazo', blocks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }]
    window.__FAKE_PROGRESO__ = [{ user_id: 'admin-1', guide_id: 'guia-1', status: 'in_progress', current_block: 6, started_at: new Date().toISOString() }]
  })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const m = await page.evaluate(() => {
    const b = document.getElementById('bienvenida')
    const t = (e) => (e?.textContent || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim()
    return {
      fecha: t(b?.querySelector('.bienvenida-texto small')),
      saludo: t(b?.querySelector('.bienvenida-texto strong')),
      viejo: !!b?.querySelector('.mini-avatar, .bienvenida-perfil, .level-badge'),
      tarjeta: getComputedStyle(b).borderTopWidth,
      valor: t(document.querySelector('.hoy-valor')),
      flecha: !!document.querySelector('.hoy-valor-mes.sube .hoy-flecha'),
      area: !!document.querySelector('.hoy-chispa .hoy-chispa-area'),
      reto: document.querySelector('.hoy-ficha[href="/retos"]')?.className,
      sigue: t(document.querySelector('.hoy-sigue')),
      barra: document.querySelector('.hoy-sigue-barra i')?.style.getPropertyValue('--ancho'),
      ancho: document.documentElement.scrollWidth <= innerWidth + 1,
    }
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el saludo: el día y «Buenos días / tardes / noches», sin tarjeta ni avatar', /^(lunes|martes|miércoles|jueves|viernes|sábado|domingo), \d+ de /.test(m.fecha) && /^Buen(os días|as tardes|as noches), Admin$/.test(m.saludo) && !m.viejo && m.tarjeta === '0px', JSON.stringify(m))
  check('tu colección: la cifra con su punto, la flecha y la línea con su relleno', /^TU COLECCIÓN|^Tu colección/i.test(m.valor) && /1\.078,00 €/.test(m.valor) && /este mes/.test(m.valor) && m.flecha && m.area, m.valor)
  check('el reto que te toca, de color', /hoy-destaca/.test(m.reto || ''), m.reto)
  check('«Sigue donde lo dejaste»: la guía empezada con su barra', /Sigue donde lo dejaste/.test(m.sigue) && /Guía · Cómo montar tu primer mazo/.test(m.sigue) && m.barra === '60%', JSON.stringify(m))
  check('la portada no se va de ancho', m.ancho)
  await ctx.close()
}

console.log('── 10. El foro de su maqueta (J1) ──')
{
  const siembra = () => {
    window.__FAKE_SESSION__ = 'admin-1'
    const hace = (m) => new Date(Date.now() - m * 60000).toISOString()
    window.__FAKE_SECCIONES__ = [{ name: 'General' }]
    window.__FAKE_FOROS__ = [{ id: 'foro-1', slug: 'dudas', name: 'Dudas de reglas', section_id: 'seccion-1' }, { id: 'foro-2', slug: 'mercado', name: 'Mercadillo', section_id: 'seccion-1', position: 1 }]
    window.__FAKE_TEMAS__ = [
      { id: 'tema-1', board_id: 'foro-1', title: '¿Esta Pikachu es legal en Estándar?', author_id: 'user-1', post_count: 3, last_post_at: hace(5), last_post_author_id: 'user-2' },
      { id: 'tema-2', board_id: 'foro-2', title: 'Cambio Charizard ex por Umbreon', author_id: 'admin-1', post_count: 2, last_post_at: hace(60), last_post_author_id: 'user-1' },
    ]
    window.__FAKE_MENSAJES__ = [
      { id: 'm1', thread_id: 'tema-1', author_id: 'user-1', body_html: '<p>Tengo una Pikachu ex y no sé si entra.</p>', created_at: hace(40) },
      { id: 'm2', thread_id: 'tema-1', author_id: 'admin-1', body_html: '<p>Mira la letra de abajo.</p>', created_at: hace(30) },
      { id: 'm3', thread_id: 'tema-1', author_id: 'user-2', body_html: '<p>Es una H, así que sí.</p>', created_at: hace(5) },
      { id: 'm4', thread_id: 'tema-2', author_id: 'admin-1', body_html: '<p>Lo cambio en mano.</p>', created_at: hace(90) },
      { id: 'm5', thread_id: 'tema-2', author_id: 'user-1', body_html: '<p>Te escribo por privado.</p>', created_at: hace(60) },
    ]
  }
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(siembra)
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/foro.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const vis = (s) => page.locator(s).first().isVisible().catch(() => false)
  const fila = await page.evaluate(() => {
    const f = document.querySelector('.foro-conv[href*="tema-1"]')
    const t = (s) => (f?.querySelector(s)?.textContent || '').replace(/\s+/g, ' ').trim()
    return { foro: t('.foro-conv-foro'), titulo: t('.foro-conv-titulo'), trozo: t('.foro-conv-trozo'), resp: t('.foro-conv-resp'), punto: !!f?.querySelector('.foro-conv-punto') }
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la fila: de qué foro, el título, quién dijo lo último y cuántas respuestas', fila.foro === 'Dudas de reglas' && /Pikachu/.test(fila.titulo) && /: Es una H, así que sí\./.test(fila.trozo) && fila.resp === '2' && fila.punto, JSON.stringify(fila))
  check('arriba solo «Foro», «Leído» y la lupa: sin subtítulo, sin franja y sin buscador a la vista', !(await vis('#foroSubtitulo')) && !(await vis('#foroDestacado')) && !(await vis('#foroBuscadorTexto')) && (await vis('#foroLupa')))
  await page.click('#foroLupa')
  await page.waitForTimeout(200)
  check('  …y la lupa saca el buscador', await vis('#foroBuscadorTexto'))
  check('el botón de escribir flota', await vis('#foroEscribir'))
  await page.click('#foroEscribir')
  await page.waitForTimeout(300)
  const destinos = await page.$$eval('.foro-elegir-lista a', (as) => as.map((a) => a.getAttribute('href')))
  check('  …y pregunta en qué foro, llevando al formulario', destinos.length === 2 && destinos.every((h) => /\?nuevo=1$/.test(h)), destinos.join(' | '))
  await page.goto(`${BASE}${destinos[0]}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  check('  …que llega abierto', await vis('#temaForm'))
  await page.goto(`${BASE}/tema?t=tema-1`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('en el hilo, compartir y moderar van tras «⋯»', (await vis('#temaMasBtn')) && !(await vis('#temaMas')))
  await page.click('#temaMasBtn')
  await page.waitForTimeout(200)
  check('  …y salen al tocarlo', await vis('#temaMas'))
  const m2 = page.locator('[data-mensaje="m2"]')
  check('cada mensaje guarda sus acciones tras su «⋯»', !(await m2.locator('.foro-mensaje-izq').isVisible()))
  await m2.locator('[data-mas-mensaje]').click()
  await page.waitForTimeout(200)
  check('  …y las saca al tocarlo', await m2.locator('.foro-mensaje-izq').isVisible())
  const tuyo = await m2.locator('.foro-mensaje-cuerpo').evaluate((n) => getComputedStyle(n).backgroundColor)
  const azul = await page.evaluate(() => { const d = document.createElement('i'); d.style.color = 'var(--navy-solid)'; document.body.append(d); const c = getComputedStyle(d).color; d.remove(); return c })
  check('lo tuyo va en el azul de la maqueta', tuyo === azul, `${tuyo} vs ${azul}`)
  const caja = await page.evaluate(() => { const f = document.querySelector('#temaResponder .foro-form'); const b = document.getElementById('btnResponder')?.getBoundingClientRect(); const c = document.querySelector('#temaResponder .rte-wrap')?.getBoundingClientRect(); return { fila: !!b && !!c && Math.abs((b.top + b.bottom) / 2 - (c.top + c.bottom) / 2) < 12, redondo: !!b && Math.round(b.width) === Math.round(b.height) } })
  check('la caja de responder, recogida, es una fila con el botón redondo', caja.fila && caja.redondo, JSON.stringify(caja))
  await ctx.close()
}

console.log('── 11. La ficha de carta de su maqueta (F1) ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy', market: 'WEST', card_count_official: 160 }]
    window.__FAKE_CARTAS__ = [{ id: 'xy5-12', market: 'WEST', set_id: 'xy5', local_id: '12', name: 'Mewtwo-EX', image_path: 'x/12', rarity: 'Ultra Rare', category: 'Pokemon', hp: 170, types: ['Psychic'], variants: { normal: true, holo: true }, tcg_sets: { id: 'xy5', name: 'Duelos Primigenios', serie_id: 'xy' } }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'xy5-12', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-10-01T10:00:00Z' }]
    window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-12', market: 'WEST', cm_low: 12.4, cm_low_es: 12.4, tcggo_updated: '2026-10-06T12:00:00Z', origen: 'tcggo' }]
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="825"><rect width="600" height="825" fill="#e36"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/carta.html?id=xy5-12`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const vis = (s) => { const e = document.querySelector(s); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0 }
    return {
      navbar: vis('.navbar'), bm: vis('.bm'),
      flotan: [...document.querySelectorAll('.carta-flotantes [data-flota]')].map((b) => b.getAttribute('aria-label')),
      orden: r('.carta-scan')?.top < r('.carta-cabecera h1')?.top && r('.carta-cabecera h1')?.top < r('.carta-precio-corto')?.top,
      precio: (document.querySelector('.carta-precio-corto b')?.textContent || '').replace(/[  ]/g, ' '),
      tienes: (document.querySelector('.carta-tienes')?.textContent || '').trim(),
      acciones: [...document.querySelectorAll('#cartaAcciones .mc-ficha-tile')].filter((x) => x.getBoundingClientRect().height > 0).map((x) => x.textContent.trim()),
    }
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('sin las barras del sitio: volver y compartir flotan sobre el arte', !m.navbar && !m.bm && m.flotan.join(' | ') === 'Volver | Compartir', JSON.stringify(m))
  check('la carta primero, luego el nombre y la tarjeta de precio', m.orden && /12,40/.test(m.precio), JSON.stringify(m))
  check('«Tienes 2» es una chapa', /^Tienes 2$/.test(m.tienes), m.tienes)
  // Desde la 751, con el corazón de «La quiero» entre los dos.
  check('abajo, «Añadir», «La quiero» y «Avísame»', m.acciones.length === 3 && /Añadir/.test(m.acciones[0]) && /La quier/.test(m.acciones[1]) && /Avísame/.test(m.acciones[2]), JSON.stringify(m.acciones))
  await ctx.close()
}

console.log('── 12. El meta de su maqueta (J3) ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__RPC_RESPUESTAS__ = {
      meta_resumen: [
        { arquetipo: 'charizard-pidgeot', nombre: 'Charizard Pidgeot', iconos: ['charizard', 'pidgeot'], mazos: 120, top8: 30, cuota: 14.2, cuota_anterior: 12, victorias: 300, derrotas: 250, empates: 10, porcentaje_victorias: 54.1 },
        // Sin ninguna carta suya en la base: el color sale de la especie.
        { arquetipo: 'gardevoir', nombre: 'Gardevoir ex', iconos: ['gardevoir'], mazos: 80, top8: 12, cuota: 8.3, cuota_anterior: 8, victorias: 150, derrotas: 130, empates: 2, porcentaje_victorias: 53 },
      ],
      meta_totales: [{ torneos: 12, jugadores: 800, online: 12, ultima_lectura: new Date().toISOString() }],
    }
    window.__FAKE_CARTAS__ = [{ id: 'sv3-1', market: 'WEST', set_id: 'sv3', local_id: '1', name: 'Charizard ex', dex_ids: [6], types: ['Darkness'] }]
  })
  await ctx.route(/r2\.limitlesstcg\.net|cdn\.jsdelivr\.net|raw\.githubusercontent\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"></svg>' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/meta.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const fs = await page.$$eval('#metaRanking .meta-fila', (fs) => fs.map((f) => ({
    nombre: f.querySelector('.meta-nombre strong')?.textContent,
    tipo: f.querySelector('.meta-barra')?.dataset.tipo || null,
    listas: f.querySelector('.meta-de-listas')?.offsetHeight > 0 ? f.querySelector('.meta-de-listas').textContent.replace(/[  ]/g, ' ') : null,
    gana: (f.querySelector('.meta-victorias')?.textContent || '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ').trim(),
    sub: f.querySelector('.meta-sub')?.offsetHeight > 0,
    carta: getComputedStyle(f).borderTopWidth === '1px',
  })))
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el tipo de las cartas manda: Charizard ex de Oscuro', fs[0]?.tipo === 'Darkness', JSON.stringify(fs[0]))
  check('  …y sin cartas, el de la especie: Gardevoir de Psíquico', fs[1]?.tipo === 'Psychic', JSON.stringify(fs[1]))
  check('cada fila, como su maqueta: «14,2 % de las listas» y «54,1 % gana», en su tarjeta', /14,2 % de las listas/.test(fs[0]?.listas || '') && /^54,1 % ?gana$/.test(fs[0]?.gana) && !fs[0].sub && fs[0].carta, JSON.stringify(fs[0]))
  await ctx.close()
}

console.log('── 13. El escritorio de su maqueta (D1) ──')
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [
      { id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-08-11', tcg_online_code: 'OBF' },
      { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-06-09', tcg_online_code: 'PAL' },
    ]
    const c = (set, n) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: `Carta ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true } })
    window.__FAKE_CARTAS__ = [c('sv3', 1), c('sv3', 2), c('sv2', 1)]
    window.__FAKE_COLECCION__ = [{ id: 'l1', user_id: 'admin-1', card_id: 'sv3-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }, { id: 'l2', user_id: 'admin-1', card_id: 'sv2-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const fs = [...document.querySelectorAll('#mcEstanteriaRejilla .mc-set-fila')].filter((f) => f.offsetHeight > 0).map((f) => f.getBoundingClientRect())
    return {
      pastilla: (document.querySelector('#navSearchBtn .nav-busca-texto')?.offsetWidth || 0) > 0 ? document.querySelector('#navSearchBtn').textContent.trim() : null,
      anchoBuscar: r('#navSearchBtn')?.width || 0,
      avatarArriba: getComputedStyle(document.querySelector('#navUserBtn')).clipPath,
      yo: document.querySelector('.lat-yo')?.offsetHeight > 0 ? document.querySelector('.lat-yo').textContent.trim() : null,
      yoAbajo: (r('.lat-yo')?.bottom || 0) > innerHeight - 120,
      enFila: fs.length >= 2 && Math.abs(fs[0].top - fs[1].top) < 2,
    }
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el buscador es una pastilla que se lee, con su «Ctrl K»', /Busca cartas, guías, gente…\s*Ctrl K/.test(m.pastilla || '') && m.anchoBuscar >= 300, JSON.stringify(m))
  check('tu cuenta, abajo en la lateral («Ver perfil»), y el avatar de arriba apartado', /Ver perfil/.test(m.yo || '') && m.yoAbajo && m.avatarArriba === 'inset(50%)', JSON.stringify(m))
  check('las expansiones, en baldosas una al lado de otra', m.enFila, JSON.stringify(m))
  await page.locator('.lat-yo').click()
  await page.waitForTimeout(600)
  const h = await page.evaluate(() => {
    const d = document.querySelector('#navUserDropdown')
    const b = d?.getBoundingClientRect(), y = document.querySelector('.lat-yo').getBoundingClientRect()
    return { abierta: !!d && !d.classList.contains('hidden') && b.height > 0, dentro: b && b.top >= 0 && b.bottom <= innerHeight && b.left >= y.right - 4, ver: !!d?.querySelector('a.tu-perfil') }
  })
  check('la tarjeta abre la hoja «Tú» a su lado y dentro de la pantalla', h.abierta && h.dentro && h.ver, JSON.stringify(h))
  await ctx.close()
}
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/aprender.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  const m = await page.evaluate(() => ({ yo: !!document.querySelector('.lat-yo'), pastilla: (document.querySelector('#navSearchBtn .nav-busca-texto')?.offsetWidth || 0) > 0 }))
  check('sin sesión: pastilla sí, tarjeta de cuenta no', !errores.length && m.pastilla && !m.yo, JSON.stringify(m) + errores.join(' | '))
  await ctx.close()
}

console.log('── 14. La expansión en tres columnas (D2) ──')
for (const ancho of [1440, 1280]) {
  const ctx = await browser.newContext({ viewport: { width: ancho, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [
      { id: 'sv3', name: 'Llamas Obsidianas', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-08-11', tcg_online_code: 'OBF' },
      { id: 'sv2', name: 'Evoluciones en Paldea', serie_id: 'sv', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2023-06-09', tcg_online_code: 'PAL' },
      { id: 'swsh12', name: 'Tempestad Plateada', serie_id: 'swsh', market: 'WEST', card_count_official: 4, card_count_total: 4, release_date: '2022-11-11', tcg_online_code: 'SIT' },
    ]
    const c = (set, n) => ({ id: `${set}-${n}`, market: 'WEST', set_id: set, local_id: String(n), name: `Carta ${set} ${n}`, image_path: `x/${n}`, rarity: 'Common', category: 'Pokemon', dex_ids: [n], variants: { normal: true } })
    window.__FAKE_CARTAS__ = [1, 2, 3, 4].flatMap((n) => [c('sv3', n), c('sv2', n), c('swsh12', n)])
    window.__FAKE_COLECCION__ = ['sv3-1', 'sv3-2', 'sv2-1', 'swsh12-1'].map((id, i) => ({ id: `l${i}`, user_id: 'admin-1', card_id: id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }))
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"><rect width="600" height="837" fill="#3a7bd5"/></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv3`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  const lee = () => page.evaluate(() => {
    const d = document.getElementById('mcEditor')
    const h = document.getElementById('mcAlbumHermanos')
    return {
      hermanos: h?.offsetHeight > 0 ? [...h.querySelectorAll('.mc-hermano')].map((b) => `${b.textContent.replace(/\s+/g, ' ').trim()}${b.getAttribute('aria-current') ? ' *' : ''}`) : null,
      izquierda: h?.offsetHeight > 0 && h.getBoundingClientRect().right <= document.getElementById('mcAlbum').getBoundingClientRect().left,
      linea: document.getElementById('mcAlbumLinea')?.offsetHeight > 0 ? document.getElementById('mcAlbumLinea').textContent : null,
      chips: document.getElementById('mcAlbumQue')?.offsetHeight > 0,
      titulo: document.getElementById('mcAlbumTitulo').textContent,
      cartas: [...document.querySelectorAll('#mcAlbum [data-carta]')].map((a) => a.dataset.carta),
      ficha: { open: d.open, modal: d.matches(':modal'), der: Math.round(d.getBoundingClientRect().right), nombre: d.querySelector('#mcEditorTitulo')?.textContent.trim() },
      abierta: [...document.querySelectorAll('#mcAlbum .mc-abierta')].map((a) => a.dataset.carta),
      ventana: innerWidth, scroll: document.documentElement.scrollWidth,
    }
  })
  const m = await lee()
  check(`${ancho}: sin errores`, errores.length === 0, errores.join(' | '))
  if (ancho === 1280) {
    check('1280: una columna, como siempre (sin la lista de al lado ni la línea)', m.hermanos === null && m.linea === null && !m.chips, JSON.stringify(m))
    await page.locator('#mcAlbum [data-carta]').first().click()
    await page.waitForTimeout(900)
    check('  …y la carta se abre en su ventana de siempre', (await lee()).ficha.modal)
    await ctx.close()
    continue
  }
  check('a la izquierda, las de su era con su código y su cuenta (y no las de otra)', JSON.stringify(m.hermanos) === JSON.stringify(['OBF Llamas Obsidianas 2/4 *', 'PAL Evoluciones en Paldea 1/4']) && m.izquierda, JSON.stringify(m))
  check('debajo del título, «2 de 4 · 50 %», y Todas / Tengo / Faltan al lado', /^2 de 4 · 50 %/.test(m.linea || '') && m.chips, JSON.stringify(m))
  await page.click('#mcAlbumQue [data-que="mcAlbumSoloFaltan"]')
  await page.waitForTimeout(500)
  const f = await lee()
  check('«Faltan» deja solo las que faltan, y se queda marcada', JSON.stringify(f.cartas) === JSON.stringify(['sv3-3', 'sv3-4']) && (await page.getAttribute('#mcAlbumQue [data-que="mcAlbumSoloFaltan"]', 'aria-pressed')) === 'true', JSON.stringify(f.cartas))
  await page.click('#mcAlbumQue [data-que="mcAlbumTodas"]')
  await page.waitForTimeout(500)
  await page.locator('#mcAlbum [data-carta="sv3-2"]').first().click()
  await page.waitForTimeout(1000)
  const a = await lee()
  check('la carta se abre a la derecha, sin tapar la rejilla, y se marca en ella', a.ficha.open && !a.ficha.modal && a.ficha.der === a.ventana && a.scroll <= a.ventana && JSON.stringify(a.abierta) === '["sv3-2"]', JSON.stringify(a))
  await page.evaluate(() => document.body.focus())
  await page.keyboard.press('ArrowRight')
  await page.waitForTimeout(800)
  const b = await lee()
  check('  …la flecha pasa a la siguiente', b.ficha.open && b.ficha.nombre !== a.ficha.nombre, `${a.ficha.nombre} → ${b.ficha.nombre}`)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  const c = await lee()
  check('  …y Esc la cierra y quita la marca', !c.ficha.open && c.abierta.length === 0, JSON.stringify(c))
  await page.locator('#mcAlbum [data-carta="sv3-1"]').first().click()
  await page.waitForTimeout(900)
  await page.click('#mcAlbumHermanos [data-hermano="sv2"]')
  await page.waitForTimeout(1200)
  const e = await lee()
  check('pulsar otra de la izquierda la abre (y cierra la carta, que era de la otra)', e.titulo === 'Evoluciones en Paldea' && e.cartas[0] === 'sv2-1' && !e.ficha.open && /\*$/.test(e.hermanos?.[1] || ''), JSON.stringify(e))
  await ctx.close()
}

console.log('── 15. Sin saltos al cargar en el ordenador ──')
// La lateral llegaba tarde y empujaba la página 240 px (y, sin su hoja, un
// instante en el flujo, 230 px hacia abajo): 0,5–0,9 de desplazamiento
// acumulado en cada página. Por debajo de 0,1 es «bueno».
for (const ruta of ['/aprender.html', '/foro.html', '/carta.html?id=xy5-1', '/noticias.html', '/mi-coleccion.html?ver=album']) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'es-ES' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__saltos = 0
    window.__izq = []
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__saltos += e.value }).observe({ type: 'layout-shift', buffered: true })
    const mira = () => { const c = document.getElementById('contenido'); if (c) { const x = Math.round(c.getBoundingClientRect().left); if (window.__izq.at(-1) !== x) window.__izq.push(x) } if (performance.now() < 3000) requestAnimationFrame(mira) }
    requestAnimationFrame(mira)
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="837"></svg>' }))
  await ctx.route(/r2\.limitlesstcg\.net|api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  const m = await page.evaluate(() => ({ saltos: Math.round(window.__saltos * 1000) / 1000, izq: window.__izq, lat: !!document.querySelector('.lat:not([hidden])') }))
  check(`${ruta}: la lateral ya tiene su sitio al pintar y la página no salta (< 0,15)`, m.lat && m.saltos < 0.15 && m.izq.every((x) => x === m.izq[0]), JSON.stringify(m))
  await ctx.close()
}

console.log('── 16. El perfil de su maqueta (J4) ──')
{
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'admin-1' })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/perfil.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const m = await page.evaluate(() => {
    const r = (s) => document.querySelector(s)?.getBoundingClientRect()
    const b = r('#heroBanner'), a = r('#heroAvatar'), n = r('.profile-hero-info h1'), e = r('#btnEditProfile')
    const lote = [...document.querySelectorAll('#profileStats .perfil-cifra')]
    return {
      banner: { izq: Math.round(b.left), ancho: Math.round(b.width), ventana: innerWidth, fondo: getComputedStyle(document.getElementById('heroBanner')).backgroundImage.slice(0, 15) },
      avatarCuadrado: getComputedStyle(document.getElementById('heroAvatar')).borderRadius !== '50%' && a.top < b.bottom,
      botonAlLado: Math.abs(e.top - a.top) < a.height && e.left > a.right,
      nombreDebajo: n.top > a.top && n.width > 200,
      arroba: document.querySelector('.perfil-arroba')?.textContent || null,
      cuatro: lote.length === 4 && new Set(lote.map((x) => Math.round(x.getBoundingClientRect().top))).size === 1,
      rotulos: lote.map((x) => x.querySelector('.rotulo').textContent + '/' + getComputedStyle(x.querySelector('.rotulo')).textTransform),
      gente: (document.getElementById('btnShowFollowers').innerText || '').replace(/\s+/g, ' ').trim(),
    }
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el banner va a sangre y, sin foto, con su degradado', m.banner.izq === 0 && m.banner.ancho === m.banner.ventana && /gradient/.test(m.banner.fondo), JSON.stringify(m.banner))
  check('el avatar, cuadrado redondeado y montado en el banner; «Editar perfil» a su lado', m.avatarCuadrado && m.botonAlLado, JSON.stringify(m))
  check('el nombre debajo, a lo ancho, con su @', m.nombreDebajo && /^@/.test(m.arroba || ''), JSON.stringify(m))
  check('las cuatro cifras en una fila, en minúscula, y la gente en una línea («0 seguidores»)', m.cuatro && m.rotulos.every((x) => /lowercase$/.test(x)) && /^0 seguidores$/i.test(m.gente), JSON.stringify(m))
  await ctx.close()
}

console.log('── 17. El torneo mientras juegas (J2) ──')
for (const [quien, juega] of [['user-1', true], ['admin-1', false]]) {
  const ahora = Date.now()
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'es-ES' })
  await ctx.addInitScript(([s, a]) => {
    window.__FAKE_SESSION__ = s
    window.__FAKE_TORNEOS__ = [{ id: 'torneo-1', slug: 'pachanga', name: 'La Pachanga de Otoño', status: 'in_progress', description: 'Tres rondas suizas.', admin_id: 'mod-1', max_players: 16, swiss_rounds: 3, swiss_bo: 3, top_cut_size: 4, top_cut_bo: 3, round_time_minutes: 30, checkin_minutes: 5, start_at: new Date(a - 3600e3).toISOString(), current_round_id: 'ronda-1' }]
    window.__FAKE_INSCRIPCIONES__ = ['user-1', 'user-2'].map((u, i) => ({ id: `i${i}`, tournament_id: 'torneo-1', user_id: u, status: 'active', tcg_live_username: `TCG_${u}`, participation_confirmed_at: new Date(a - 7200e3).toISOString() }))
    window.__FAKE_RONDAS__ = [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, status: 'active', phase: 'swiss', started_at: new Date(a - 120e3).toISOString(), ends_at: new Date(a + 14 * 60000).toISOString() }]
    window.__FAKE_MESAS__ = [{ id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'user-1', player_b_id: 'user-2', status: 'active', check_in_a_at: new Date(a - 60e3).toISOString(), check_in_b_at: new Date(a - 60e3).toISOString() }]
  }, [quien, ahora])
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/torneo?slug=pachanga`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  const m = await page.evaluate(() => {
    const vis = (sel) => { const e = document.querySelector(sel); return !!e && e.getBoundingClientRect().height > 0 }
    const botones = [...document.querySelectorAll('.torneo-bo3-juego .torneo-reportar .torneo-boton-resultado')].map((b) => Math.round(b.getBoundingClientRect().top))
    return {
      clase: document.documentElement.classList.contains('torneo-jugando'),
      formato: vis('#torneoFormato'), plazas: vis('.torneo-plazas'),
      mesaArriba: Math.round(document.getElementById('torneoMiPartida')?.getBoundingClientRect().top + scrollY || 0),
      pantalla: innerHeight,
      enFila: botones.length === 3 && new Set(botones).size === 1,
    }
  })
  check(`${quien}: sin errores`, errores.length === 0, errores.join(' | '))
  if (juega) {
    check('jugando: la cabecera se queda en el nombre (sin formato ni plazas)', m.clase && !m.formato && !m.plazas, JSON.stringify(m))
    check('  …tu mesa empieza en la primera pantalla y media, no dos más abajo', m.mesaArriba > 0 && m.mesaArriba < m.pantalla * 1.5, JSON.stringify(m))
    check('  …y Victoria / Derrota / Tablas, en una fila', m.enFila, JSON.stringify(m))
  } else {
    check('mirando sin jugar: la cabecera entera, con su formato', !m.clase && m.formato, JSON.stringify(m))
  }
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
