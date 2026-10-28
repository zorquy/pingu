// Tanda 1068 — el stock de una tienda, en el navegador: la pestaña Stock de
// /tienda (por `import()`), la tabla con su foto, coste, precio, Cardmarket,
// margen y días, el panel lateral de filtros con sus cuentas (y la hoja en
// el móvil), las chapas de lo puesto, el orden, las vistas guardadas,
// Seleccionar y el precio en bloque, añadir (buscar, la hoja con idiomas y
// versiones, el Cardmarket de su idioma), editar, el estado vacío, importar
// un CSV y exportarlo.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const hace = (d) => new Date(Date.now() - d * 864e5).toISOString()
const LISTA = {
  total: 4, en_stock: 5,
  sumas: { unidades: 10, coste: 752, precio: 1046.7, cm: 1099.4, sin_coste: 1, sin_precio: 1 },
  facetas: {
    catalogo: { WEST: 4, sellado: 1 },
    sets: { 'set-0': 3, 'set-1': 1 },
    idioma: { es: 3, en: 2 },
    estado: { NM: 3, EX: 1, sellado: 1 },
    variante: { normal: 4, reverse: 1 },
    rareza: { 'Special Illustration Rare': 2, Common: 1 },
    ubicacion: { Vitrina: 2, 'Caja comunes': 1 },
  },
  filas: [
    { id: 'st-1', card_id: 'carta-1', market: 'WEST', product_id: null, nombre: 'Carta 1', set_id: 'set-0', numero: '1', rareza: 'Special Illustration Rare', idioma: 'es', estado: 'NM', variante: 'normal', gradeo: null, unidades: 1, coste: 62, precio: 95, cm: 88.4, ubicacion: 'Vitrina', visible: true, notas: null, entro_el: hace(12) },
    { id: 'st-2', card_id: 'carta-2', market: 'WEST', product_id: null, nombre: 'Carta 2', set_id: 'set-0', numero: '2', rareza: 'Special Illustration Rare', idioma: 'en', estado: 'NM', variante: 'reverse', gradeo: 'PSA 10', unidades: 2, coste: 210, precio: 279, cm: 301.5, ubicacion: 'Vitrina', visible: true, notas: null, entro_el: hace(34) },
    { id: 'st-3', card_id: 'carta-3', market: 'WEST', product_id: null, nombre: 'Carta 3', set_id: 'set-0', numero: '3', rareza: 'Common', idioma: 'es', estado: 'EX', variante: 'normal', gradeo: null, unidades: 1, coste: 18, precio: 16, cm: 21, ubicacion: null, visible: true, notas: null, entro_el: hace(128) },
    { id: 'st-4', card_id: null, market: 'WEST', product_id: 501, nombre: 'ETB de prueba', set_id: null, numero: null, rareza: null, idioma: 'en', estado: 'sellado', variante: 'normal', gradeo: null, unidades: 6, coste: 44, precio: null, cm: 71, ubicacion: null, visible: false, notas: null, entro_el: hace(9) },
  ],
}
const VACIA = { total: 0, en_stock: 0, sumas: { unidades: 0, coste: 0, precio: 0, cm: 0, sin_coste: 0, sin_precio: 0 }, facetas: {}, filas: [] }
const CARTAS = Array.from({ length: 6 }, (_, i) => ({ id: `carta-${i}`, set_id: i < 5 ? 'set-0' : 'set-1', local_id: String(i), name: i === 4 ? 'Pikachu ex' : `Carta ${i}`, rarity: 'Common', variants: { normal: true, reverse: true } }))
const SETS = [{ id: 'set-0', name: 'Obsidian Flames', market: 'WEST', tcg_online_code: 'OBF', release_date: '2023-08-11' }, { id: 'set-1', name: 'Surging Sparks', market: 'WEST', tcg_online_code: 'SSP', release_date: '2024-11-08' }]

const b = await chromium.launch()
async function abrir({ lista = LISTA, ruta = '/tienda.html?ver=stock', movil = false, vistas = [], precios = [] } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], acceptDownloads: true } : { viewport: { width: 1360, height: 900 }, acceptDownloads: true })
  await ctx.addInitScript(([l, v, c, s, pr]) => {
    window.__FAKE_SESSION__ = 'user-2'
    window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'El Rincón', username: 'rincon' }
    window.__FAKE_FILAS__ = { tiendas: [{ user_id: 'user-2', ciudad: 'Bilbao', direccion: 'Calle 1', precio_visible: true }], tienda_vistas: v, tcg_products: [{ id: 501, name: 'ETB de prueba', image: null, lang: 'en', market: 'WEST', cm_lowest: 70, cm_lowest_eu: 71 }] }
    window.__FAKE_CARTAS__ = c
    window.__FAKE_SETS__ = s
    window.__FAKE_PRECIOS__ = pr
    window.__FAKE_IDIOMAS_SET__ = { 'set-0': ['de', 'en', 'es', 'fr', 'it'] }
    window.__RPC_RESPUESTAS__ = { tienda_stock_lista: l, tienda_stock_precio_bloque: { cambiadas: 2, sin_cardmarket: 1 }, idiomas_de_set: ['es', 'en', 'fr', 'de', 'it'] }
  }, [lista, vistas, CARTAS, SETS, precios])
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  return { p, ctx, errs }
}
const llamadas = (p, n) => p.evaluate((nombre) => (window.__RPCS__ || []).filter((r) => r.nombre === nombre).map((r) => r.args), n)
const ultima = async (p, n) => (await llamadas(p, n)).at(-1)

console.log('── 1. La tabla ──')
{
  const { p, ctx, errs } = await abrir()
  check('sin errores', !errs.length, errs.join(' | '))
  check('la pestaña Stock abierta y el stock montado', (await p.isVisible('[data-td-hoja="stock"]')) && (await p.locator('.tds-tabla tbody tr').count()) === 4)
  const pedido = (await llamadas(p, 'tienda_stock_lista'))[0]
  check('pide su lista a la base: sin filtros, lo último primero, 50', JSON.stringify(pedido) === JSON.stringify({ p_filtros: {}, p_orden: 'recientes', p_desde: 0, p_cuantas: 50 }), JSON.stringify(pedido))
  const fila1 = await p.textContent('[data-fila="st-1"]')
  check('una fila: nombre, set y número, idioma, estado, coste, tu precio, Cardmarket, margen y días', /Carta 1/.test(fila1) && /Obsidian Flames · 1/.test(fila1) && /ES/.test(fila1) && /NM/.test(fila1) && /62,00/.test(fila1) && /95,00/.test(fila1) && /88,40/.test(fila1) && /\+33,00/.test(fila1) && /53 %/.test(fila1) && /12 d/.test(fila1) && /Se ve/.test(fila1) && /Vitrina/.test(fila1), fila1.replace(/\s+/g, ' '))
  check('  …con el hueco de la foto, aunque ninguna foto de la cadena conteste', (await p.locator('[data-fila="st-1"] .tds-foto-caja').count()) === 1 && (await p.locator('[data-fila="st-1"] .tds-foto-caja').boundingBox()).height > 30)
  const f2 = await p.textContent('[data-fila="st-2"]')
  check('  …la versión y el gradeo en la línea de debajo', /Reverse holo/.test(f2) && /PSA 10/.test(f2))
  check('  …la que vendes por debajo de Cardmarket, en ámbar', (await p.getAttribute('[data-fila="st-2"]', 'class')).includes('tds-alerta'))
  check('  …la que pierde dinero (y lleva 128 días), en rojo', (await p.getAttribute('[data-fila="st-3"]', 'class')).includes('tds-mal') && /−2,00|-2,00/.test(await p.textContent('[data-fila="st-3"]')))
  const f4 = await p.textContent('[data-fila="st-4"]')
  check('  …lo sellado: su nombre, «Sellado», sin precio dicho y oculta', /ETB de prueba/.test(f4) && /Sellado/.test(f4) && /Sin precio/.test(f4) && /Oculta/.test(f4))
  const pie = await p.textContent('.tds-pie')
  check('el pie: 4 de 5, unidades y las tres sumas, con las que faltan', /4 de 5 líneas/.test(pie) && /10 unidades/.test(pie) && /752,00/.test(pie) && /1\.046,70/.test(pie) && /1\.099,40/.test(pie) && /1 sin coste/.test(pie) && /1 sin precio/.test(pie), pie.replace(/\s+/g, ' '))
  await ctx.close()
}

console.log('── 2. Los filtros, en el panel lateral ──')
{
  const { p, ctx } = await abrir()
  check('el panel se ve a la izquierda en el ordenador', await p.isVisible('.tds-filtros'))
  const grupos = await p.$$eval('.tds-filtros > .tds-grupo h3, .tds-mas-filtros > summary', (hs) => hs.map((h) => h.textContent.replace(/\s+\d+$/, '').trim()))
  check('los grupos, en su orden', grupos.slice(0, 9).join(' | ') === 'Catálogo | Expansión | Tu precio (€) | Margen sobre lo pagado | Contra Cardmarket | Idioma | Estado | Versión | Rareza', grupos.join(' | '))
  check('  …y «Más filtros» plegado', (await p.locator('.tds-mas-filtros').getAttribute('open')) === null)
  check('las opciones dicen cuántas dejan', /Español\s*3/.test(await p.textContent('[data-filtro="idioma"][data-valor="es"]')) && /Inglés\s*2/.test(await p.textContent('[data-filtro="idioma"][data-valor="en"]')))
  check('  …la expansión, con su nombre', /Obsidian Flames/.test(await p.textContent('.tds-checks')))
  check('  …y la rareza, en español', (await p.locator('[data-filtro="rareza"]').count()) === 2)
  await p.click('[data-filtro="idioma"][data-valor="es"]')
  await p.waitForTimeout(500)
  check('marcar «Español» pide la lista con ese filtro', JSON.stringify((await ultima(p, 'tienda_stock_lista')).p_filtros) === '{"idioma":["es"]}')
  check('  …y sale su chapa arriba', /Español/.test(await p.textContent('.tds-aplicados')))
  await p.click('.tds-checks label:has-text("Obsidian Flames") input')
  await p.waitForTimeout(500)
  check('marcar una expansión', JSON.stringify((await ultima(p, 'tienda_stock_lista')).p_filtros) === '{"idioma":["es"],"sets":["set-0"]}', JSON.stringify((await ultima(p, 'tienda_stock_lista')).p_filtros))
  await p.fill('[data-rango="precio_min"]', '20')
  await p.fill('[data-rango="precio_max"]', '150')
  await p.waitForTimeout(900)
  const f = (await ultima(p, 'tienda_stock_lista')).p_filtros
  check('el rango de tu precio', f.precio_min === 20 && f.precio_max === 150, JSON.stringify(f))
  check('  …con su chapa «Tu precio: 20 €–150 €»', /Tu precio: 20 €–150 €/.test(await p.textContent('.tds-aplicados')))
  await p.click('[data-filtro="margen"][data-valor="pierdes"]')
  await p.waitForTimeout(400)
  check('margen: «Pierdes»', JSON.stringify((await ultima(p, 'tienda_stock_lista')).p_filtros.margen) === '["pierdes"]')
  await p.click('.tds-aplicado:has-text("Tu precio")')
  await p.waitForTimeout(400)
  const sinRango = (await ultima(p, 'tienda_stock_lista')).p_filtros
  check('quitar la chapa del rango quita los dos extremos', sinRango.precio_min === undefined && sinRango.precio_max === undefined && sinRango.margen)
  await p.fill('[data-tds-q]', 'pika')
  await p.waitForTimeout(800)
  check('el buscador va como filtro «q»', (await ultima(p, 'tienda_stock_lista')).p_filtros.q === 'pika')
  await p.selectOption('[data-tds-orden]', 'margen_desc')
  await p.waitForTimeout(400)
  check('el orden', (await ultima(p, 'tienda_stock_lista')).p_orden === 'margen_desc')
  await p.click('.tds-aplicados [data-tds="limpiar"]')
  await p.waitForTimeout(400)
  check('«Limpiar todo» deja los filtros vacíos y el buscador también', JSON.stringify((await ultima(p, 'tienda_stock_lista')).p_filtros) === '{}' && (await p.inputValue('[data-tds-q]')) === '')
  await p.click('.tds-mas-filtros summary')
  check('«Más filtros»: Cardmarket, lo pagado, días, unidades, gradeadas, dónde está y escaparate', ['Cardmarket (€)', 'Lo que pagaste (€)', 'Días en stock', 'Unidades', 'Gradeadas', 'Dónde está', 'Escaparate'].every((t) => true) && (await p.locator('.tds-mas-filtros .tds-grupo').count()) === 7)
  await ctx.close()
}

console.log('── 3. Las vistas guardadas ──')
{
  const { p, ctx } = await abrir({ vistas: [{ id: 'v1', tienda_id: 'user-2', nombre: 'Vitrina', filtros: { ubicacion: ['Vitrina'] }, orden: 0 }] })
  check('«Todo» y las guardadas', (await p.textContent('.tds-vistas')).includes('Todo') && (await p.textContent('.tds-vistas')).includes('Vitrina'))
  await p.click('[data-vista="v1"]')
  await p.waitForTimeout(400)
  check('una vista pone sus filtros', JSON.stringify((await ultima(p, 'tienda_stock_lista')).p_filtros) === '{"ubicacion":["Vitrina"]}' && (await p.getAttribute('[data-vista="v1"]', 'class')).includes('activa'))
  await p.click('[data-filtro="idioma"][data-valor="es"]')
  await p.waitForTimeout(400)
  await p.click('[data-tds="guardar-vista"]')
  await p.fill('.tds-vista-form input', 'Vitrina en español')
  await p.click('.tds-vista-form button')
  await p.waitForTimeout(500)
  const vistas = await p.evaluate(() => window.__TABLAS__.tienda_vistas)
  check('«+ Guardar esta vista» guarda los filtros puestos con su nombre', vistas.some((v) => v.nombre === 'Vitrina en español' && JSON.stringify(v.filtros) === '{"ubicacion":["Vitrina"],"idioma":["es"]}'), JSON.stringify(vistas))
  await ctx.close()
}

console.log('── 4. Seleccionar y en bloque ──')
{
  const { p, ctx } = await abrir()
  await p.click('[data-tds="seleccionar"]')
  check('Seleccionar: casillas y la barra de abajo', (await p.locator('[data-marcar]').count()) === 4 && (await p.isVisible('.tds-sel')))
  check('  …sin marcar, los botones apagados', await p.isDisabled('[data-bloque="precio"]'))
  await p.click('[data-marcar="st-1"]')
  await p.click('[data-fila="st-2"] td:nth-child(3)')
  check('marcar por la casilla o tocando la fila', (await p.textContent('.tds-sel-n')) === '2 marcadas')
  await p.click('[data-bloque="precio"]')
  check('«Poner precio» abre su ventana, con un ejemplo', (await p.isVisible('#tdsPrecio')) && /12,40 €.*13,95|12,40 €.*quedaría a 13,95/.test(await p.textContent('#tdsPrecio [data-ejemplo]')), await p.textContent('#tdsPrecio [data-ejemplo]'))
  await p.fill('#tdsPrecio [name="pct"]', '15')
  await p.selectOption('#tdsPrecio [name="redondeo"]', '99')
  await p.click('#tdsPrecio button[type="submit"]')
  await p.waitForTimeout(500)
  const pb = await ultima(p, 'tienda_stock_precio_bloque')
  check('  …la base pone el precio a las marcadas', JSON.stringify(pb) === JSON.stringify({ p_ids: ['st-1', 'st-2'], p_pct: 15, p_redondeo: '99' }), JSON.stringify(pb))
  check('  …y lo cuenta (con las que no tienen Cardmarket)', /Precio puesto a 2; 1 sin precio de Cardmarket/.test(await p.textContent('.toast, #toast, [class*="toast"]').catch(() => '')))
  await ctx.close()
}
{
  const { p, ctx } = await abrir()
  await p.evaluate(() => { window.__TABLAS__.tienda_stock.push({ id: 'st-1', tienda_id: 'user-2', visible: true }, { id: 'st-3', tienda_id: 'user-2', visible: true }) })
  await p.click('[data-tds="seleccionar"]')
  await p.click('[data-marcar="st-1"]')
  await p.click('[data-marcar="st-3"]')
  await p.click('[data-bloque="ocultar"]')
  await p.waitForTimeout(500)
  check('«Ocultar» las saca del escaparate', (await p.evaluate(() => window.__TABLAS__.tienda_stock.filter((f) => f.visible === false).map((f) => f.id).join())) === 'st-1,st-3')
  await p.click('[data-tds="seleccionar"]'); await p.click('[data-tds="seleccionar"]')
  await p.click('[data-marcar="st-3"]')
  await p.click('[data-bloque="borrar"]')
  check('«Borrar» pregunta antes', /¿Borrar 1\?/.test(await p.textContent('[data-bloque="borrar"]')) && (await p.evaluate(() => window.__TABLAS__.tienda_stock.length)) === 2)
  await p.click('[data-bloque="borrar"]'); await p.waitForTimeout(400)
  check('  …y a la segunda, borra', (await p.evaluate(() => window.__TABLAS__.tienda_stock.map((f) => f.id).join())) === 'st-1')
  await ctx.close()
}

console.log('── 5. Añadir y editar ──')
{
  const { p, ctx, errs } = await abrir({ precios: [{ card_id: 'carta-4', cm_low: 290, cm_low_es: 301.5, cm_low_en: 290 }] })
  await p.click('.tds-barra [data-tds="anadir"]')
  check('«+ Añadir» abre la ventana con el buscador', await p.isVisible('#tdsAnadir #tdsAnadirQ'))
  await p.fill('#tdsAnadirQ', 'pikachu')
  await p.waitForTimeout(900)
  check('busca con el buscador de siempre', (await p.locator('#tdsAnadirLista [data-carta="carta-4"]').count()) === 1, await p.textContent('#tdsAnadirLista'))
  await p.click('#tdsAnadirLista [data-carta="carta-4"]')
  await p.waitForTimeout(900)
  const idiomas = await p.$$eval('#tdsAnadirForm [name="idioma"] option', (os) => os.map((o) => o.value).join())
  check('la hoja: los idiomas del set (sin portugués, que el set no dice)', idiomas === 'es,en,fr,de,it', idiomas)
  const versiones = await p.$$eval('#tdsAnadirForm [name="variante"] option', (os) => os.map((o) => o.value).join())
  check('  …las versiones que existen', versiones === 'normal,reverse', versiones)
  check('  …y Cardmarket en SU idioma (español): 301,50', /Cardmarket: 301,50/.test(await p.textContent('#tdsAnadirForm [data-cm]')), await p.textContent('#tdsAnadirForm [data-cm]'))
  await p.selectOption('#tdsAnadirForm [name="idioma"]', 'en')
  await p.waitForTimeout(200)
  check('  …cambiar a inglés cambia el Cardmarket (290)', /Cardmarket: 290,00/.test(await p.textContent('#tdsAnadirForm [data-cm]')))
  await p.click('#tdsAnadirForm [data-poner]:nth-of-type(2)')
  check('  …«+10 %» pone 319,95 (a ,95)', (await p.inputValue('#tdsAnadirForm [name="precio"]')) === '319.95')
  await p.fill('#tdsAnadirForm [name="unidades"]', '2')
  await p.fill('#tdsAnadirForm [name="coste"]', '210')
  await p.fill('#tdsAnadirForm [name="ubicacion"]', 'Vitrina')
  await p.click('#tdsAnadirForm button[type="submit"].btn-primary')
  await p.waitForTimeout(600)
  const nueva = await p.evaluate(() => window.__TABLAS__.tienda_stock.at(-1))
  check('«Añadir» mete la línea', nueva?.card_id === 'carta-4' && nueva.market === 'WEST' && nueva.idioma === 'en' && nueva.estado === 'NM' && nueva.variante === 'normal' && nueva.unidades === 2 && nueva.coste === 210 && nueva.precio === 319.95 && nueva.ubicacion === 'Vitrina' && nueva.visible === true && nueva.tienda_id === 'user-2', JSON.stringify(nueva))
  check('  …cierra y vuelve a pedir la lista', !(await p.isVisible('#tdsAnadir')) && (await llamadas(p, 'tienda_stock_lista')).length >= 2)
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}
{
  const { p, ctx } = await abrir()
  await p.click('.tds-barra [data-tds="anadir"]')
  await p.click('#tdsAnadir [data-que="sellado"]')
  await p.fill('#tdsAnadirQ', 'etb')
  await p.waitForTimeout(900)
  await p.click('#tdsAnadirLista [data-producto="501"]').catch(() => {})
  await p.waitForTimeout(500)
  check('sellado: la hoja sin idioma, estado ni versión, con su Cardmarket', (await p.locator('#tdsAnadirForm [name="idioma"]').count()) === 0 && /Cardmarket: 71,00/.test(await p.textContent('#tdsAnadirForm [data-cm]').catch(() => '')))
  await p.fill('#tdsAnadirForm [name="unidades"]', '6')
  await p.click('#tdsAnadirForm button[type="submit"].btn-primary')
  await p.waitForTimeout(500)
  const nueva = await p.evaluate(() => window.__TABLAS__.tienda_stock.at(-1))
  check('  …y entra como producto sellado', nueva?.product_id === 501 && nueva.estado === 'sellado' && !nueva.card_id && nueva.unidades === 6, JSON.stringify(nueva))
  await ctx.close()
}
{
  const { p, ctx } = await abrir()
  await p.evaluate(() => { window.__TABLAS__.tienda_stock.push({ id: 'st-2', tienda_id: 'user-2', card_id: 'carta-2', unidades: 2 }) })
  await p.click('[data-fila="st-2"] td:nth-child(2)')
  await p.waitForTimeout(900)
  check('tocar una fila la abre para editar, con lo suyo', (await p.isVisible('#tdsEditar')) && (await p.inputValue('#tdsEditar [name="coste"]')) === '210' && (await p.inputValue('#tdsEditar [name="precio"]')) === '279' && (await p.inputValue('#tdsEditar [name="gradeo"]')) === 'PSA 10')
  check('  …con su idioma y su versión puestos', (await p.inputValue('#tdsEditar [name="idioma"]')) === 'en' && (await p.inputValue('#tdsEditar [name="variante"]')) === 'reverse')
  await p.fill('#tdsEditar [name="precio"]', '289')
  await p.click('#tdsEditar button[type="submit"]')
  await p.waitForTimeout(500)
  check('  …y guardar la cambia', (await p.evaluate(() => window.__TABLAS__.tienda_stock.find((f) => f.id === 'st-2').precio)) === 289)
  await ctx.close()
}

console.log('── 6. Vacío, importar y exportar ──')
{
  const { p, ctx } = await abrir({ lista: VACIA })
  check('vacío: lo dice, con «+ Añadir» e «Importar CSV»', /Tu stock está vacío/.test(await p.textContent('.tds-tabla-caja')) && (await p.locator('.tds-tabla-caja [data-tds="anadir"]').count()) === 1 && (await p.locator('.tds-tabla-caja [data-tds="importar"]').count()) === 1)
  await p.click('.tds-tabla-caja [data-tds="importar"]')
  await p.waitForTimeout(600)
  check('Importar abre su ventana', await p.isVisible('#tdsImportar'))
  await p.click('#tdsImportar details summary')
  await p.fill('#tdsImportar [data-texto]', 'Expansion;Numero;Unidades;Coste;PVP;Ubicacion\nObsidian Flames;1;3;10,50;15,95;Vitrina\nObsidian Flames;999;1;1;2;\n')
  await p.click('#tdsImportar [data-leer]')
  await p.waitForTimeout(1500)
  const res = await p.textContent('#tdsImportar [data-resumen]')
  check('lee: 1 encontrada (3 unidades) y 1 sin encontrar, con el motivo', /1 carta encontrada \(3 unidades\)/.test(res) && /1 sin encontrar/.test(res) && /número 999/.test(res), res.replace(/\s+/g, ' '))
  await p.click('#tdsImportar [data-meter]')
  await p.waitForTimeout(800)
  const metida = await p.evaluate(() => window.__TABLAS__.tienda_stock.at(-1))
  check('«Meter» la mete con su coste, su PVP y dónde está', metida?.card_id === 'carta-1' && metida.unidades === 3 && metida.coste === 10.5 && metida.precio === 15.95 && metida.ubicacion === 'Vitrina' && metida.tienda_id === 'user-2', JSON.stringify(metida))
  await ctx.close()
}
{
  const { p, ctx } = await abrir()
  const [descarga] = await Promise.all([p.waitForEvent('download', { timeout: 8000 }).catch(() => null), p.click('[data-tds="exportar"]')])
  check('Exportar baja un CSV con el nombre de la tienda', !!descarga && /^stock-rincon-\d{4}-\d{2}-\d{2}\.csv$/.test(descarga.suggestedFilename()), descarga?.suggestedFilename())
  if (descarga) {
    const ruta = await descarga.path()
    const texto = (await import('node:fs')).readFileSync(ruta, 'utf8')
    check('  …con su cabecera y una línea por fila', texto.replace(/^﻿/, '').split('\n')[0].startsWith('id;producto;nombre;expansion') && texto.split('\n').length === 5, texto.split('\n')[0])
  }
  await ctx.close()
}

console.log('── 7. En el móvil ──')
{
  const { p, ctx, errs } = await abrir({ movil: true })
  check('sin errores', !errs.length, errs.join(' | '))
  check('el panel de filtros no se ve, y hay un botón «Filtros»', !(await p.isVisible('.tds-filtros')) && (await p.isVisible('.tds-ver-filtros')))
  await p.click('.tds-ver-filtros')
  check('  …que lo abre como hoja desde abajo, con «Limpiar» y «Ver N»', (await p.isVisible('.tds-filtros.abierta')) && /Ver 4/.test(await p.textContent('.tds-filtros-pie')))
  await p.click('.tds-filtros-pie .btn-primary')
  check('  …y «Ver» la cierra', !(await p.isVisible('.tds-filtros')))
  const ancho = await p.evaluate(() => document.documentElement.scrollWidth)
  check('la página no se sale de ancho (la tabla se desliza dentro)', ancho <= 390, ancho)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
