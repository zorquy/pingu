// Tanda 1235 — fotos de verdad de las cartas del stock, frontal y trasera
// (PINGU: «solo a cartas no a productos… desde el stock, quizá una columna con
// el botón de foto y te salga pop-up para añadir frontal y trasera»).
//   · la tabla lleva la columna «Fotos» (con la cámara, o la miniatura y la
//     cuenta), un producto no lleva botón; la rejilla, el botón en la carta;
//   · el pop-up: dos huecos, subir comprime y guarda en la carpeta de la tienda
//     del cubo `tienda-fotos` y la fila en `tienda_stock_fotos`; cambiar borra
//     la de antes; quitar borra el fichero y, sin ninguna, la fila;
//   · en el móvil la columna no está y las fotos van en la ficha de la línea;
//   · sin la migración no hay ni columna ni botón (y nada se rompe);
//   · el escaparate enseña «Ver las fotos» y el pop-up con las dos.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const FILAS = [
  { id: 'st-0', card_id: 'carta-0', market: 'WEST', nombre: 'Pikachu ex', set_id: 'set-0', numero: '0', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, coste: 50, precio: 95, cm: 90, visible: true, entro_el: hace(3), destacada: false },
  { id: 'st-1', card_id: 'carta-1', market: 'WEST', nombre: 'Mew ex', set_id: 'set-0', numero: '1', idioma: 'en', estado: 'EX', variante: 'normal', gradeo: 'PSA 10', unidades: 1, coste: 10, precio: 20, cm: 22, visible: true, entro_el: hace(3), destacada: false },
  { id: 'st-2', product_id: 501, market: 'WEST', nombre: 'ETB Obsidian Flames', estado: 'sellado', unidades: 2, coste: 40, precio: 60, cm: 55, visible: true, entro_el: hace(3), destacada: false },
]
const FOTOS = [{ stock_id: 'st-1', tienda_id: 'user-2', frente: 'user-2/st-1-frente-1.webp', dorso: 'user-2/st-1-dorso-1.webp' }]
// Un PNG de verdad, para que el navegador lo descodifique y lo comprima.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAFklEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDK+mmyAAAAABJRU5ErkJggg==', 'base64')
const b = await chromium.launch()
async function abrir(ruta, { vista = 'tabla', movil = false, sinTabla = false, sesion = 'user-2' } = {}) {
  const ctx = await b.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1500, height: 950 }, isMobile: movil, hasTouch: movil, serviceWorkers: 'block', locale: 'es-ES' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = d.sesion
    if (d.sesion === 'user-2') {
      window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
      localStorage.setItem('pd-tienda', '{"u":"rincon","id":"user-2"}')
    }
    localStorage.setItem('pd-tienda-stock-vista', d.vista)
    if (d.sinTabla) window.__SIN_TABLAS__ = ['tienda_stock_fotos']
    window.__FAKE_PERFILES__ = [{ id: 'user-2', username: 'rincon', display_name: 'El Rincón', tipo: 'tienda' }]
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', precio_visible: true }], tienda_stock: d.FILAS.map((f) => ({ ...f, tienda_id: 'user-2' })), tienda_stock_fotos: d.FOTOS, tcg_products: [{ id: 501, name: 'ETB Obsidian Flames' }] }
    window.__FAKE_CARTAS__ = d.FILAS.filter((f) => f.card_id).map((f) => ({ id: f.card_id, set_id: 'set-0', market: 'WEST', local_id: f.numero, name: f.nombre }))
    window.__FAKE_SETS__ = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST' }]
    window.__RPC_RESPUESTAS__ = {
      tienda_stock_lista: { total: 3, en_stock: 3, destacadas: 0, sumas: {}, facetas: {}, filas: d.FILAS },
      tienda_escaparate: { total: 3, en_escaparate: 3, de_tu_lista: 0, precios: true, facetas: {}, filas: d.FILAS },
      tienda_hoy: { actual: {}, anterior: {}, serie: [], stock: {}, avisos: {}, demanda: [], visitas: {} },
    }
  }, { FILAS, FOTOS, vista, sinTabla, sesion })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex|ejemplo\.supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2500)
  return { p, ctx, errs }
}

console.log('── 1. La tabla: la columna «Fotos» ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=stock')
  check('sin errores', !errs.length, errs.join(' | '))
  check('la tabla lleva la columna «Fotos»', (await p.locator('.tds-tabla thead th.tds-c-fotos').textContent().catch(() => '')) === 'Fotos')
  check('  …la carta sin fotos, con la cámara', (await p.locator('[data-fila="st-0"] .tdf-boton svg').count()) === 1 && /Añadir fotos/.test(await p.getAttribute('[data-fila="st-0"] .tdf-boton', 'aria-label')))
  check('  …la que tiene, con su miniatura y «2»', (await p.locator('[data-fila="st-1"] .tdf-boton img').count()) === 1 && (await p.textContent('[data-fila="st-1"] .tdf-cuenta')) === '2')
  check('  …un producto, sin botón', (await p.locator('[data-fila="st-2"] .tdf-boton').count()) === 0)
  const t = await p.evaluate(() => { const r = document.querySelector('[data-fila="st-0"] .tdf-boton').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] })
  check('  …el botón mide 44', t[0] >= 44 && t[1] >= 44, t.join('×'))

  console.log('── 2. El pop-up: subir, cambiar, quitar ──')
  await p.click('[data-fila="st-0"] .tdf-boton'); await p.waitForTimeout(600)
  check('abre el pop-up con Frontal y Trasera, vacíos', (await p.isVisible('#tdfDialogo[open]')) && (await p.locator('#tdfDialogo .tdf-lado').count()) === 2 && (await p.locator('#tdfDialogo .tdf-hueco img').count()) === 0)
  check('  …no se abre la ficha de editar detrás', !(await p.isVisible('#tdsEditar[open]').catch(() => false)))
  const hueco = await p.evaluate(() => { const r = document.querySelector('#tdfDialogo .tdf-hueco').getBoundingClientRect(); return Math.round((r.height / r.width) * 100) })
  check('  …el hueco tiene forma de carta antes de la foto', Math.abs(hueco - 140) <= 2, hueco)
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1235-vacio.png` })
  // Una foto «de móvil»: grande (pasa de 1.600 px), con ruido para que pese.
  const GRANDE = Buffer.from(await p.evaluate(() => { const c = document.createElement('canvas'); c.width = 2000; c.height = 2800; const x = c.getContext('2d'); for (let i = 0; i < 4000; i++) { x.fillStyle = `hsl(${i % 360} 70% 50%)`; x.fillRect(Math.random() * 2000, Math.random() * 2800, 40, 40) } return c.toDataURL('image/png').split(',')[1] }), 'base64')
  await p.setInputFiles('#tdfDialogo [data-subir="frente"]', { name: 'IMG_0001.png', mimeType: 'image/png', buffer: GRANDE }); await p.waitForTimeout(2500)
  let s = await p.evaluate(() => ({ sub: window.__SUBIDAS__.slice(), fila: (window.__TABLAS__.tienda_stock_fotos || []).find((f) => f.stock_id === 'st-0') }))
  check('subir la frontal la sube al cubo, en la carpeta de la tienda', s.sub.length === 1 && s.sub[0].cubo === 'tienda-fotos' && /^user-2\/st-0-frente-\d+\.(webp|png|jpg)$/.test(s.sub[0].ruta), JSON.stringify(s.sub))
  check('  …comprimida (WebP y más ligera), no el PNG tal cual', s.sub[0]?.tipo === 'image/webp' && s.sub[0].bytes < GRANDE.length && /\.webp$/.test(s.sub[0].ruta), `${s.sub[0]?.tipo} ${s.sub[0]?.bytes} de ${GRANDE.length}`)
  check('  …y apunta la fila con esa ruta', s.fila?.frente === s.sub[0]?.ruta && !s.fila?.dorso && s.fila?.tienda_id === 'user-2', JSON.stringify(s.fila))
  check('  …el hueco ya enseña la foto y «Quitar»', (await p.locator('#tdfDialogo [data-lado="frente"] .tdf-hueco img').count()) === 1 && (await p.locator('#tdfDialogo [data-quitar-foto="frente"]').count()) === 1)
  check('  …y la tabla, detrás, la miniatura con «1»', (await p.textContent('[data-fila="st-0"] .tdf-cuenta').catch(() => '')) === '1')
  await p.setInputFiles('#tdfDialogo [data-subir="dorso"]', { name: 'b.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(1500)
  const primera = s.sub[0].ruta
  await p.setInputFiles('#tdfDialogo [data-subir="frente"]', { name: 'c.png', mimeType: 'image/png', buffer: PNG }); await p.waitForTimeout(1500)
  s = await p.evaluate(() => ({ sub: window.__SUBIDAS__.slice(), bor: window.__BORRADAS__.slice(), fila: window.__TABLAS__.tienda_stock_fotos.find((f) => f.stock_id === 'st-0') }))
  check('cambiar la frontal guarda la nueva y borra la de antes', s.sub.length === 3 && s.fila.frente === s.sub[2].ruta && !!s.fila.dorso && s.bor.some((x) => x.ruta === primera && x.cubo === 'tienda-fotos'), JSON.stringify(s))
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1235-lleno.png` })
  await p.click('#tdfDialogo [data-quitar-foto="dorso"]'); await p.waitForTimeout(800)
  s = await p.evaluate(() => ({ bor: window.__BORRADAS__.slice(), fila: window.__TABLAS__.tienda_stock_fotos.find((f) => f.stock_id === 'st-0') }))
  check('quitar la trasera la borra del cubo y de la fila', !s.fila.dorso && !!s.fila.frente && s.bor.length === 2, JSON.stringify(s))
  await p.click('#tdfDialogo [data-quitar-foto="frente"]'); await p.waitForTimeout(800)
  s = await p.evaluate(() => (window.__TABLAS__.tienda_stock_fotos || []).find((f) => f.stock_id === 'st-0') || null)
  check('  …sin ninguna, la fila se va y la tabla vuelve a la cámara', s === null && (await p.locator('[data-fila="st-0"] .tdf-boton svg').count()) === 1, JSON.stringify(s))
  await p.setInputFiles('#tdfDialogo [data-subir="frente"]', { name: 'x.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') }); await p.waitForTimeout(600)
  check('un fichero que no es una foto no se sube', (await p.evaluate(() => window.__SUBIDAS__.length)) === 3)
  await p.click('#tdfDialogo .tdf-pie [data-cerrar]'); await p.waitForTimeout(300)
  check('«Hecho» cierra', !(await p.isVisible('#tdfDialogo[open]').catch(() => false)))
  await ctx.close()
}

console.log('── 3. La rejilla ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=stock', { vista: 'rejilla' })
  check('la rejilla lleva el botón en las cartas y no en el producto', !errs.length && (await p.locator('.tds-baldosa[data-fila="st-0"] .tdf-boton').count()) === 1 && (await p.locator('.tds-baldosa[data-fila="st-2"] .tdf-boton').count()) === 0, errs.join(' | '))
  const pisa = await p.evaluate(() => { const a = document.querySelector('[data-fila="st-1"] .tdf-boton').getBoundingClientRect(); const c = document.querySelector('[data-fila="st-1"] .chapa-gradeo').getBoundingClientRect(); return a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom })
  check('  …sin pisar la etiqueta de la cápsula', !pisa)
  await p.click('.tds-baldosa[data-fila="st-1"] .tdf-boton'); await p.waitForTimeout(600)
  check('  …y abre el pop-up con las dos que tiene', (await p.locator('#tdfDialogo .tdf-hueco img').count()) === 2)
  await ctx.close()
}

console.log('── 4. El móvil: en la ficha de la línea ──')
{
  const { p, ctx } = await abrir('/tienda.html?ver=stock', { movil: true })
  check('la columna no se ve', (await p.locator('[data-fila="st-0"] .tdf-boton').isVisible()) === false)
  await p.click('[data-fila="st-1"] .tds-c-precio'); await p.waitForTimeout(1300)
  check('la ficha de la línea enseña sus fotos («2 de 2») y «Cambiar»', (await p.isVisible('.tds-form .tdf-en-ficha')) && /2 de 2/.test(await p.textContent('.tds-form .tdf-en-ficha')) && (await p.locator('.tds-form .tdf-miniaturas img').count()) === 2)
  await p.click('.tds-form [data-fotos-abrir]'); await p.waitForTimeout(600)
  check('  …que abre el pop-up encima', await p.isVisible('#tdfDialogo[open]'))
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1235-movil.png` })
  await p.click('#tdfDialogo [data-quitar-foto="dorso"]'); await p.waitForTimeout(800)
  await p.click('#tdfDialogo .tdf-pie [data-cerrar]'); await p.waitForTimeout(300)
  check('  …y al quitar una, la ficha dice «1 de 2»', /1 de 2/.test(await p.textContent('.tds-form .tdf-en-ficha')))
  await ctx.close()
  const { p: p2, ctx: c2 } = await abrir('/tienda.html?ver=stock', { movil: true })
  await p2.click('[data-fila="st-2"] .tds-c-precio'); await p2.waitForTimeout(1300)
  check('un producto no lleva fotos en su ficha', (await p2.isVisible('.tds-form')) && (await p2.locator('.tds-form .tdf-en-ficha').count()) === 0)
  await c2.close()
}

console.log('── 5. Sin la migración ──')
{
  const { p, ctx, errs } = await abrir('/tienda.html?ver=stock', { sinTabla: true })
  check('sin la tabla: el stock sale, sin columna ni botones', !errs.length && (await p.locator('.tds-tabla tbody tr').count()) === 3 && (await p.locator('.tds-c-fotos, .tdf-boton').count()) === 0, errs.join(' | '))
  await ctx.close()
}

console.log('── 6. El escaparate ──')
{
  const { p, ctx, errs } = await abrir('/usuario/rincon', { sesion: 'user-1' })
  check('«Ver las fotos» solo en la que las tiene', !errs.length && (await p.locator('.pt-carta [data-pt-fotos]').count()) === 1 && (await p.getAttribute('.pt-carta [data-pt-fotos]', 'data-pt-fotos')) === 'st-1', errs.join(' | '))
  await p.click('.pt-carta [data-pt-fotos]'); await p.waitForTimeout(600)
  const imgs = await p.$$eval('#tdfVer .tdf-hueco img', (xs) => xs.map((x) => x.getAttribute('src')))
  check('  …abre las dos, frontal primero, del cubo público', imgs.length === 2 && /public\/tienda-fotos\/user-2\/st-1-frente-1\.webp$/.test(imgs[0]) && /dorso/.test(imgs[1]), JSON.stringify(imgs))
  check('  …y sin botones de subir ni quitar', (await p.locator('#tdfVer [data-subir], #tdfVer [data-quitar-foto]').count()) === 0)
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1235-escaparate.png` })
  await ctx.close()
  const { p: p2, ctx: c2, errs: e2 } = await abrir('/usuario/rincon', { sesion: 'user-1', sinTabla: true })
  check('sin la migración, el escaparate sale igual y sin el botón', !e2.length && (await p2.locator('.pt-carta').count()) === 3 && (await p2.locator('[data-pt-fotos]').count()) === 0, e2.join(' | '))
  await c2.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
