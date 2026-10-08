// Tanda 762 — Los productos sellados (PR1, PR2 y Z1 de la ronda 3).
//
// PINGU: «una nueva pestaña en Mi colección que sea productos… la API se
// trae productos por expansiones». Lo que se mira, de abajo arriba:
//   · lo puro, con la respuesta REAL de TCGGO que pegó PINGU (30th
//     Celebration, la lista y la ficha de la ETB del Pokémon Center): el
//     tipo sale del nombre, la fila lleva todo lo `not null`, el precio es
//     el de España y cae a Europa y al mínimo diciéndolo, y «sin precio» no
//     es cero;
//   · la función programada: no gasta sin la tabla, encuentra la ruta que
//     contesta y la apunta, escribe las dos páginas, para con el plan, para
//     si lo que falla es NUESTRO, para si ninguna ruta contesta, y respeta el
//     tope diario y cada cuánto se vuelve a mirar;
//   · la pestaña: lo tuyo con lo que vale, el catálogo de una expansión (la
//     de preventa también) con foto, tipo, mínimo en España y media de 30
//     días, los tipos como chips, el «+ Añadir» y el ×N con − y +;
//   · el Panel con «Cartas · Productos» debajo de la cifra, y /lanzamientos
//     con lo que sale con la próxima expansión.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { tipoDeProducto, filaDeProducto, precioDeProducto, esPreventa, valorDeProductos } from '/home/user/pingu/js/productos.js'
import { procesar, expansionesQueTocan, RUTAS } from '/home/user/pingu/netlify/functions/tcggo-productos.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''
const REAL = JSON.parse(readFileSync(new URL('./fixtures/tcggo-productos-30c.json', import.meta.url), 'utf8'))

console.log('── 1. Lo puro, con la respuesta de verdad ──')
{
  const tipos = Object.fromEntries(REAL.lista.data.map((p) => [p.name, tipoDeProducto(p.name)]))
  check('el tipo sale del nombre', tipos['30th Celebration Booster'] === 'sobre' && tipos['30th Celebration Booster Bundle'] === 'bundle' && tipos['30th Celebration Elite Trainer Box'] === 'etb' && tipos['30th Celebration Pokémon Center Elite Trainer Box'] === 'etb' && tipos['30th Celebration: Eevee 2-Pack Blister'] === 'blister' && tipos['30th Celebration: Espeon ex Battle Deck'] === 'mazo' && tipos['30th Celebration: Mew & Alolan Exeggutor Mini Tin'] === 'lata' && tipos['30th Celebration: Lucario Tech Sticker Collection'] === 'coleccion' && tipos['30th Celebration: Mini Tin Display'] === 'caja', JSON.stringify(tipos))
  const f = filaDeProducto(REAL.lista.data[0], { ahora: new Date('2026-09-01T10:00:00Z') })
  check('la fila del sobre: id, expansión, nombre, foto, mínimos y fecha', f.id === 48447 && f.episode_id === 431 && f.name === '30th Celebration Booster' && f.tipo === 'sobre' && f.cm_lowest === 10.99 && f.cm_lowest_es === 8.78 && f.cm_avg30 === 13.98 && f.release_date === '2026-09-16' && /30th-celebration-booster\.png$/.test(f.image), JSON.stringify(f))
  const sql = readFileSync(`${RAIZ}/supabase-migration-productos.sql`, 'utf8')
  const obligatorias = [...sql.slice(sql.indexOf('create table if not exists public.tcg_products'), sql.indexOf(');', sql.indexOf('create table if not exists public.tcg_products'))).matchAll(/^\s+(\w+) [^,\n]*not null(?! default)/gm)].map((m) => m[1])
  check('  …con todas las columnas `not null` sin valor por defecto (la 526)', obligatorias.length > 0 && obligatorias.every((c) => f[c] != null), `${obligatorias} → ${JSON.stringify(obligatorias.map((c) => f[c]))}`)
  const etb = filaDeProducto(REAL.uno.data)
  check('la ETB del Pokémon Center no se vende en España: su precio es el de Europa, y lo dice', precioDeProducto(etb)?.valor === 400 && precioDeProducto(etb)?.donde === 'Europa', JSON.stringify(precioDeProducto(etb)))
  check('el sobre, el de España', precioDeProducto(f)?.donde === 'España' && precioDeProducto(f).valor === 8.78)
  check('sin ningún mínimo, «no se sabe» y no cero', precioDeProducto({ cm_lowest: null }) === null)
  check('en preventa si su expansión sale después de hoy', esPreventa(f, '2026-09-01') && !esPreventa(f, '2026-10-08'))
  const v = valorDeProductos([{ product_id: 1, cantidad: 2 }, { product_id: 2, cantidad: 1 }], new Map([[1, f], [2, { cm_lowest: null }]]))
  check('lo que valen: cantidad × precio, y lo sin precio aparte', v.total === 17.56 && v.sinPrecio === 1 && v.unidades === 3, JSON.stringify(v))
  const t = expansionesQueTocan([{ tcggo_id: 431, release_date: '2026-09-16' }, { tcggo_id: 431, release_date: '2026-09-16' }, { tcggo_id: 10, release_date: '2010-01-01' }, { tcggo_id: 11, release_date: '2010-01-01' }], { 11: '2026-10-05' }, '2026-10-08')
  check('qué toca: una por expansión, la más cercana a su salida primero, y lo mirado hace poco no', t.map((e) => e.id).join() === '431,10', JSON.stringify(t))
}

console.log('── 2. La función programada ──')
{
  const pagina2 = { data: REAL.lista.data.slice(0, 12).map((p, i) => ({ ...p, id: 50000 + i })), paging: { current: 2, total: 2, per_page: 20 }, results: 32 }
  const montar = ({ sinTabla = false, rutaBuena = 1, falla = null, estado = {}, fallaEscribir = false } = {}) => {
    const llamadas = []
    const escritas = []
    let guardado = estado
    const restImpl = async (ruta, o) => {
      if (ruta.startsWith('tcg_products?select=id')) { if (sinTabla) throw new Error('Supabase 404: relation "tcg_products" does not exist'); return [] }
      if (ruta.startsWith('scrydex_estado?select')) return [{ valor: guardado }]
      if (ruta === 'scrydex_estado') { guardado = JSON.parse(o.body)[0].valor; return null }
      if (ruta.startsWith('tcg_sets?')) return [{ id: '30c', market: 'WEST', tcggo_id: 431, release_date: '2026-09-16' }, { id: 'base1', market: 'WEST', tcggo_id: 171, release_date: '1999-01-09' }]
      if (ruta === 'tcg_products') { if (fallaEscribir) throw new Error('Supabase 500: algo nuestro'); escritas.push(...JSON.parse(o.body)); return null }
      throw new Error(`ruta inesperada ${ruta}`)
    }
    const fetchImpl = async (url) => {
      llamadas.push(url)
      if (falla) return new Response(falla.texto, { status: falla.estado })
      const ruta = url.includes('episode_id=') ? 1 : /\/episodes\/\d+\/products/.test(url) ? 0 : -1
      if (ruta !== rutaBuena) return new Response('Not found', { status: 404 })
      const pag = Number(new URL(url).searchParams.get('page'))
      return new Response(JSON.stringify(pag === 1 ? (url.includes('/431') || url.includes('=431') ? REAL.lista : { data: [], paging: { current: 1, total: 1 } }) : pagina2), { status: 200 })
    }
    return { llamadas, escritas, restImpl, fetchImpl, estado: () => guardado }
  }
  const env = { SUPABASE_SERVICE_ROLE_KEY: 'x', TCGGO_API_KEY: 'k' }
  const ahora = new Date('2026-10-08T10:00:00Z')
  {
    const m = montar({ sinTabla: true })
    const r = await procesar({ env, ahora, restImpl: m.restImpl, fetchImpl: m.fetchImpl })
    check('sin la tabla no se gasta ni una petición', m.llamadas.length === 0 && /falta supabase-migration-productos/.test(r.saltado), JSON.stringify(r))
  }
  {
    const m = montar({ rutaBuena: 1 })
    const r = await procesar({ env, ahora, restImpl: m.restImpl, fetchImpl: m.fetchImpl })
    check('la primera ruta da 404, la segunda contesta, y se apunta', m.estado().ruta === RUTAS[1] && /products\?episode_id=431&page=1/.test(m.llamadas[1]), JSON.stringify(m.llamadas.slice(0, 3)))
    check('  …y se escriben las dos páginas de 30th Celebration (32 productos)', m.escritas.filter((f) => f.episode_id === 431).length === 32 && r.productos === 32, JSON.stringify(r))
    check('  …todas con lo `not null` puesto', m.escritas.every((f) => Number.isInteger(f.id) && f.name && f.lang && f.tipo && f.updated_at))
    check('  …las dos expansiones, apuntadas como mirada hoy', m.estado().hechos[431] === '2026-10-08' && m.estado().hechos[171] === '2026-10-08', JSON.stringify(m.estado().hechos))
    const otra = montar({ rutaBuena: 1, estado: m.estado() })
    await procesar({ env, ahora, restImpl: otra.restImpl, fetchImpl: otra.fetchImpl })
    check('la pasada siguiente del mismo día no vuelve a pedir nada', otra.llamadas.length === 0, JSON.stringify(otra.llamadas))
    const manana = montar({ rutaBuena: 1, estado: m.estado() })
    await procesar({ env, ahora: new Date('2026-10-09T10:00:00Z'), restImpl: manana.restImpl, fetchImpl: manana.fetchImpl })
    check('mañana vuelve a la que está cerca de su salida, y con la ruta buena directamente', manana.llamadas.length === 2 && manana.llamadas.every((u) => /products\?episode_id=431/.test(u)), JSON.stringify(manana.llamadas))
  }
  {
    const m = montar({ falla: { estado: 429, texto: 'Too many requests' } })
    const r = await procesar({ env, ahora, restImpl: m.restImpl, fetchImpl: m.fetchImpl })
    check('con el plan agotado (429) para hasta mañana, a la primera', m.llamadas.length === 1 && m.estado().sinPlanHasta === '2026-10-08' && /plan/.test(r.parado), JSON.stringify(r))
    const luego = montar({ estado: m.estado() })
    await procesar({ env, ahora, restImpl: luego.restImpl, fetchImpl: luego.fetchImpl })
    check('  …y la pasada siguiente no pide nada', luego.llamadas.length === 0)
  }
  {
    const m = montar({ rutaBuena: 0, fallaEscribir: true })
    const r = await procesar({ env, ahora, restImpl: m.restImpl, fetchImpl: m.fetchImpl })
    check('si lo que falla es NUESTRA base, se para', /no se han podido escribir/.test(m.estado().parado || '') && r.error, JSON.stringify(r))
    const luego = montar({ estado: m.estado() })
    await procesar({ env, ahora, restImpl: luego.restImpl, fetchImpl: luego.fetchImpl })
    check('  …y no vuelve a gastar hasta que lo quite un humano', luego.llamadas.length === 0)
  }
  {
    let estado = {}
    let gastadas = 0
    for (let dia = 1; dia <= 4; dia++) {
      const m = montar({ rutaBuena: 9, estado })
      await procesar({ env, ahora: new Date(`2026-10-1${dia}T10:00:00Z`), restImpl: m.restImpl, fetchImpl: m.fetchImpl })
      estado = m.estado()
      gastadas += m.llamadas.length
    }
    check('si ninguna ruta contesta, se para a la sexta expansión sin ruta', /ninguna ruta/.test(estado.parado || '') && gastadas <= 12, `${gastadas} peticiones · ${estado.parado}`)
  }
  {
    const m = montar({ rutaBuena: 0 })
    await procesar({ env: { ...env, TCGGO_TOPE_PRODUCTOS: '1' }, ahora, restImpl: m.restImpl, fetchImpl: m.fetchImpl })
    check('el tope diario manda', m.llamadas.length === 1, String(m.llamadas.length))
  }
}

console.log('── 3. La pestaña Productos ──')
const browser = await chromium.launch()
const productos = REAL.lista.data.map((p) => filaDeProducto(p, { ahora: new Date('2026-09-01T10:00:00Z') }))
const SETS = [
  { id: 'me30', name: '30 aniversario', serie_id: 'me', market: 'WEST', release_date: '2026-09-16', card_count_official: 128, card_count_total: 128, tcggo_id: 431 },
  { id: 'dr', name: 'Delta Reign', serie_id: 'me', market: 'WEST', release_date: '2026-11-06', card_count_official: 0, card_count_total: 0, tcggo_id: 500, oculto: true },
]
const PRODUCTOS = [...productos, { id: 77001, episode_id: 500, lang: 'en', name: 'Delta Reign Elite Trainer Box', tipo: 'etb', image: null, cm_lowest: 59.9, cm_lowest_eu: 59.9, cm_lowest_es: 61.5, cm_avg30: null, release_date: '2026-11-06' }]
async function abrir(ruta, { movil = false, mios = [] } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript(({ SETS, PRODUCTOS, mios }) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = SETS
    window.__FAKE_CARTAS__ = [{ id: 'me30-1', market: 'WEST', set_id: 'me30', local_id: '1', name: 'Pikachu', name_es: 'Pikachu', image_path: 'x/1', rarity: 'Rare', category: 'Pokemon', variants: { normal: true } }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'me30-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', valor_manual: 10, created_at: '2026-10-01T10:00:00Z' }]
    window.__FAKE_PRODUCTOS__ = PRODUCTOS
    window.__FAKE_MIS_PRODUCTOS__ = mios
  }, { SETS, PRODUCTOS, mios })
  await ctx.route(/images\.tcggo\.com|assets\.tcgdex\.net|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" rx="20" fill="#d9a521"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { ctx, page, errores }
}
const tabla = (page) => page.evaluate(() => (window.__TABLAS__.user_products || []).map((m) => `${m.product_id}×${m.cantidad}`).sort().join())
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=productos')
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('la pestaña está en el menú', (await page.locator('.mc-pestanias [data-pestania="productos"]').count()) === 1 && (await page.isVisible('#mcPanelProductos')))
  const opciones = await page.$$eval('#mcProdSet option', (os) => os.map((o) => o.textContent))
  check('el selector: la de preventa arriba (aunque esté escondida), y la otra', opciones.join() === 'Delta Reign (preventa),30 aniversario', JSON.stringify(opciones))
  await page.selectOption('#mcProdSet', '431')
  await page.waitForTimeout(800)
  const tarjetas = await page.$$eval('#mcProdRejilla .mc-prod', (as) => as.map((a) => a.textContent.replace(/\s+/g, ' ').trim()))
  check('los veinte de 30th Celebration', tarjetas.length === 20, String(tarjetas.length))
  const sobre = tarjetas.find((t) => /^Sobre .*30th Celebration Booster 8,78/.test(t)) || tarjetas.find((t) => /30th Celebration Booster 8/.test(t))
  check('  …cada uno con su tipo, su mínimo en España y su media de 30 días', /Sobre/.test(sobre || '') && /8,78 € mín\. España/.test(sobre || '') && /Media 30 días: 13,98 €/.test(sobre || ''), sobre)
  const etb = tarjetas.find((t) => /Pokémon Center Elite Trainer Box/.test(t))
  check('  …y el que no se vende en España, con el de Europa y diciéndolo', /400,00 € mín\. Europa/.test(etb || ''), etb)
  const fotos = await page.$$eval('#mcProdRejilla .mc-prod-foto', (fs) => fs.every((f) => Math.abs(f.getBoundingClientRect().width - f.getBoundingClientRect().height) <= 1))
  check('  …con el hueco de la foto reservado (cuadrado)', fotos)
  const chips = await page.$$eval('#mcProdTipos [data-prod-tipo]', (bs) => bs.map((b) => b.textContent))
  check('los tipos que hay, como chips', chips[0] === 'Todo' && chips.includes('Lata') && chips.includes('Caja de Entrenador Élite') && !chips.includes('Otros'), JSON.stringify(chips))
  await page.click('#mcProdTipos [data-prod-tipo="lata"]')
  await page.waitForTimeout(600)
  check('  …y filtran', (await page.locator('#mcProdRejilla .mc-prod').count()) === 10, String(await page.locator('#mcProdRejilla .mc-prod').count()))
  await page.click('#mcProdTipos [data-prod-tipo=""]')
  await page.waitForTimeout(600)
  check('sin productos tuyos, lo dice', /Todavía no tienes productos/.test(await page.textContent('#mcProdTuyos')))
  await page.click('[data-prod-mas="48447"]')
  await page.waitForTimeout(600)
  await page.click('#mcProdRejilla [data-prod-mas="48447"]')
  await page.waitForTimeout(600)
  check('«+ Añadir» y luego «+»: dos sobres, en la base', (await tabla(page)) === '48447×2', await tabla(page))
  const tuyos = (await page.textContent('#mcProdTuyos')).replace(/\s+/g, ' ')
  check('  …y arriba, «Tus productos» con lo que valen', /Tus productos/.test(tuyos) && /17,56 € · 2 productos/.test(tuyos), tuyos)
  check('  …y la tarjeta dice ×2', /×2/.test(await page.textContent('#mcProdRejilla [data-prod="48447"]')))
  await page.click('#mcProdRejilla [data-prod-menos="48447"]')
  await page.waitForTimeout(500)
  await page.click('#mcProdRejilla [data-prod-menos="48447"]')
  await page.waitForTimeout(500)
  check('«−» hasta cero lo quita', (await tabla(page)) === '' && (await page.locator('#mcProdRejilla [data-prod="48447"] .mc-prod-anadir').count()) === 1, await tabla(page))
  const altos = await page.$$eval('#mcProdRejilla .mc-prod-anadir, #mcProdRejilla .mc-prod-boton', (bs) => bs.map((b) => Math.round(b.getBoundingClientRect().height)))
  check('lo que se pulsa mide 44', altos.length > 0 && altos.every((h) => h >= 44), JSON.stringify(altos.slice(0, 4)))
  if (CAPS) await page.screenshot({ path: `${CAPS}/762-productos.png` })
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=resumen', { mios: [{ product_id: 48447, cantidad: 3 }] })
  await page.waitForTimeout(800)
  const r = (await page.textContent('#mcCarteraReparto').catch(() => '')).replace(/\s+/g, ' ')
  check('el Panel: debajo de la cifra, «Cartas · Productos»', /Cartas 10,00 € · Productos 26,34 €/.test(r) && (await page.isVisible('#mcCarteraReparto')), r)
  check('  …y la cifra grande sigue siendo la de las cartas (la de la portada)', /10,00/.test(await page.textContent('.mc-cartera-cifra')))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, page } = await abrir('/mi-coleccion.html?ver=resumen')
  await page.waitForTimeout(600)
  check('sin productos, el Panel no dice nada de ellos', !(await page.isVisible('#mcCarteraReparto')))
  await ctx.close()
}
{
  const { ctx, page, errores } = await abrir('/mi-coleccion.html?ver=productos', { movil: true })
  await page.selectOption('#mcProdSet', '431')
  await page.waitForTimeout(800)
  const ancho = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check('en el iPhone, dos por fila y sin irse de ancho', ancho <= 1 && (await page.$$eval('#mcProdRejilla .mc-prod', (as) => new Set(as.slice(0, 4).map((a) => Math.round(a.getBoundingClientRect().left))).size)) === 2, String(ancho))
  check('  …y la burbuja lleva Productos', (await page.locator('.mc-pestanias [data-pestania="productos"]').isVisible()))
  if (CAPS) await page.screenshot({ path: `${CAPS}/762-movil.png` })
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. /lanzamientos: lo que sale con la próxima ──')
{
  const { ctx, page, errores } = await abrir('/lanzamientos.html')
  await page.waitForTimeout(800)
  const bloque = await page.$eval('#lanzProductos', (e) => ({ titulo: e.querySelector('h2').textContent, n: e.querySelectorAll('.lanz-producto').length, texto: e.textContent.replace(/\s+/g, ' '), tras: e.previousElementSibling?.id })).catch(() => null)
  check('debajo de «El siguiente set», sus productos', bloque && /Lo que sale con Delta Reign/.test(bloque.titulo) && bloque.n === 1 && /Caja de Entrenador Élite · preventa/.test(bloque.texto) && /61,50 € mín\. España/.test(bloque.texto) && bloque.tras === 'proximoDestacado', JSON.stringify(bloque))
  check('sin errores', errores.length === 0, errores.join(' | '))
  if (CAPS) await page.screenshot({ path: `${CAPS}/762-lanzamientos.png` })
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
