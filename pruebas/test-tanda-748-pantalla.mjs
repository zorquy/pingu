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

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
