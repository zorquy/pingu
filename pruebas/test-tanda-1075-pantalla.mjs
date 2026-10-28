// Tanda 1075 — la Colección de una tienda (PINGU: «quitando el panel de los
// usuarios, podemos replicar cómo está el panel de colección… que la tienda
// busque las cartas por expansión y desde ahí añadirlas a stock»). Es /cartas
// abierta por una cuenta de tienda: el catálogo entero con SU stock como «lo
// que tiene», la Pokédex de más, y el «+» que mete en `tienda_stock` (con su
// coste y su precio), sin tocar `user_collection`. Lo de una persona (deseos,
// álbumes, cambios, quién la tiene) no sale. Una persona no nota nada.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const N = 8
const SETS = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: N, card_count_total: N, tcg_online_code: 'SSP', tcggo_id: 300 }]
const CARTAS = Array.from({ length: N }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Pikachu ${i + 1}`, name_es: `Pikachu ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true }, dex_ids: [25] }))
const STOCK = [
  { id: 's1', tienda_id: 'user-2', card_id: 'sv8-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 3, coste: 2, precio: 5, visible: true, created_at: '2026-10-01T10:00:00Z' },
  // Agotada: no se «tiene», pero al añadir una igual se le suma a ella.
  { id: 's2', tienda_id: 'user-2', card_id: 'sv8-4', market: 'WEST', idioma: 'en', estado: 'EX', variante: 'holo', unidades: 0, coste: 1, precio: 3, visible: true, created_at: '2026-10-02T10:00:00Z' },
  // De OTRA tienda: no es suya.
  { id: 's9', tienda_id: 'otra', card_id: 'sv8-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 9, visible: true, created_at: '2026-10-02T10:00:00Z' },
]
const PRODUCTOS = [{ id: 9002, episode_id: 300, market: 'WEST', lang: 'en', name: 'Chispas Charizard ex Tin', tipo: 'lata', cm_lowest: 22, cm_lowest_eu: 20, cm_lowest_es: 21, release_date: '2024-11-08' }]
const PERSONA_LINEA = [{ id: 'l1', user_id: 'user-1', card_id: 'sv8-3', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-10-01T10:00:00Z' }]

const b = await chromium.launch()
async function abrir(ruta, { sesion = 'user-2', tienda = true, marca = true, movil = false } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1500, height: 950 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(([d, s, t, m]) => {
    window.__FAKE_SESSION__ = s
    if (t) window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Cartas de Ane', username: 'cartas-ane' }
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_PRODUCTOS__ = d.PRODUCTOS
    window.__FAKE_COLECCION__ = d.PERSONA_LINEA
    window.__FAKE_FILAS__ = { tienda_stock: d.STOCK.map((x) => ({ ...x })) }
    if (!sessionStorage.getItem('ya')) {
      sessionStorage.setItem('ya', '1')
      try { localStorage.removeItem('pd-tienda'); localStorage.removeItem('pokedoc-prod-idioma'); if (m) localStorage.setItem('pd-tienda', JSON.stringify({ u: 'cartas-ane', id: 'user-2' })) } catch {}
    }
  }, [{ SETS, CARTAS, STOCK, PRODUCTOS, PERSONA_LINEA }, sesion, tienda, marca])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  return { p, ctx, errs }
}
const stock = (p) => p.evaluate(() => (window.__TABLAS__.tienda_stock || []).filter((f) => f.tienda_id === 'user-2' || !f.tienda_id).map((f) => `${f.card_id || 'p' + f.product_id}:${f.idioma}:${f.estado}:${f.unidades}:${f.coste ?? '-'}:${f.precio ?? '-'}`).sort())
const coleccion = (p) => p.evaluate(() => (window.__TABLAS__.user_collection || []).length)

console.log('── 1. Lo puro de la capa de datos ──')
{
  const { p, ctx } = await abrir('/cartas')
  const r = await p.evaluate(async () => {
    const d = await import('/js/mi-coleccion/datos.js')
    return {
      tienda: d.esStockDeTienda(),
      linea: d.lineaDeStock({ id: 'x', tienda_id: 't', card_id: 'c', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', unidades: 4, coste: '2.50', precio: '6', notas: null }),
      cambios: d.cambiosDeStock({ cantidad: 3, valor_manual: 7, precio_compra: 1.2, cambio: 2, user_id: 'u', notas: 'n'.repeat(400), idioma: 'en', raro: 1 }),
      suma: d.sumaDeStock({ unidades: 2, coste: 2 }, { unidades: 2, coste: 4 }),
      sumaSinCoste: d.sumaDeStock({ unidades: 2, coste: null }, { unidades: 1, coste: 3, precio: 9 }),
      sumaAgotada: d.sumaDeStock({ unidades: 0, coste: 5 }, { unidades: 1, coste: 3 }),
    }
  })
  check('en /cartas, una tienda usa su stock', r.tienda === true)
  check('una línea del stock en la forma de una copia: unidades → cantidad, coste → lo pagado, precio → tu valor', r.linea.cantidad === 4 && r.linea.precio_compra === 2.5 && r.linea.valor_manual === 6 && r.linea.user_id === 't' && r.linea.cambio === 0, JSON.stringify(r.linea))
  check('  …y al revés, sin `cambio` ni `user_id` ni lo que no es del stock, y la nota a 300', JSON.stringify(Object.keys(r.cambios).sort()) === '["coste","idioma","notas","precio","unidades"]' && r.cambios.unidades === 3 && r.cambios.precio === 7 && r.cambios.coste === 1.2 && r.cambios.notas.length === 300, JSON.stringify(Object.keys(r.cambios)))
  check('sumar unidades deja el coste en la media (2 a 2 € + 2 a 4 € → 4 a 3 €)', r.suma.unidades === 4 && r.suma.coste === 3 && !('precio' in r.suma), JSON.stringify(r.suma))
  check('  …sin coste en la que había, el nuevo; y un precio escrito manda', r.sumaSinCoste.coste === 3 && r.sumaSinCoste.precio === 9 && r.sumaSinCoste.unidades === 3)
  check('  …y una agotada no pesa en la media', r.sumaAgotada.unidades === 1 && r.sumaAgotada.coste === 3)
  await ctx.close()
}

console.log('── 2. /cartas de una tienda, en el PC ──')
{
  const { p, ctx, errs } = await abrir('/cartas')
  check('sin errores y se queda en /cartas (no la echa a /tienda)', !errs.length && new URL(p.url()).pathname === '/cartas', errs.join(' | ') + ' ' + p.url())
  check('el título es «Colección» y dice que es para el stock', (await p.textContent('#mcTitulo')) === 'Colección' && /tu stock/.test(await p.textContent('.mc-catalogo-lema')) && /Colección — tu tienda/.test(await p.title()))
  const pest = await p.$$eval('#mcMenu [data-pestania]', (bs) => bs.map((x) => x.dataset.pestania))
  check('Expansiones, Pokédex, Productos y Buscar (sin Panel, Álbumes ni Deseos)', pest.join() === 'album,pokedex,productos,buscar', pest.join())
  const lat = await p.$$eval('.lat-seccion-enlace', (as) => as.map((a) => a.textContent.trim() + (a.closest('.lat-seccion').classList.contains('lat-activa') ? '*' : '')))
  check('la lateral es la de la tienda, con Colección encendida', lat.join() === 'Panel,Colección*,Stock,Ventas,Escaparate,Mensajes,Datos', lat.join())
  check('  …con sus pestañas colgadas debajo, como Mi colección', await p.evaluate(() => !!document.querySelector('.lat-activa .lat-menu-sitio #mcMenu')) && (await p.isVisible('.lat-activa [data-pestania="pokedex"]')))
  check('  …y «Colección» lleva a /cartas, no a Mi colección', (await p.getAttribute('.lat-activa .lat-seccion-enlace', 'href')) === '/cartas')
  await p.goto(`${BASE}/cartas?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(2500)
  const tengo = await p.$$eval('#mcAlbum [data-carta]', (xs) => [...new Set(xs.filter((x) => x.closest('.tengo')).map((x) => x.dataset.carta))])
  check('«lo que tiene» es su stock: la de 3 unidades sí; la agotada y la de otra tienda, no', tengo.join() === 'sv8-1', tengo.join())
  check('la cabecera de la expansión vale su stock a su precio (3 × 5 €)', /15,00\s€ a tu precio/.test(await p.textContent('#mcAlbumLinea')))
  await p.click('#mcAlbum [data-carta="sv8-1"]'); await p.waitForTimeout(1300)
  check('la ficha de una que tiene: «3 en stock»', (await p.textContent('#mcEdTienes')) === '3 en stock')
  const ocultas = await p.evaluate(() => ['mcEdQuiero', 'mcEdDeseos', 'mcEdAlbumes', 'mcEdQuienBloque', 'mcEdTiendas', 'mcEdFicha', 'mcEdCompartir', 'mcEdAviso'].filter((id) => { const e = document.getElementById(id); return e && e.getClientRects().length }))
  check('  …sin lo de una persona (deseos, álbumes, quién la tiene, tiendas, compartir, la ficha completa)', !ocultas.length, ocultas.join())
  await p.click('#mcEdEditar'); await p.waitForTimeout(500)
  const rotulos = await p.evaluate(() => ['mcEdCantidad', 'mcEdValor', 'mcEdCompra'].map((id) => document.getElementById(id).closest('label').firstChild.textContent.trim()))
  check('  …editar dice «Unidades», «Tu precio de venta» y «Coste por unidad», sin «Para cambio»', rotulos.join('|') === 'Unidades|Tu precio de venta (€)|Coste por unidad (€)' && !(await p.isVisible('#mcEdCambio')), rotulos.join('|'))
  check('  …con lo del stock: 3, 5 € y 2 €', (await p.inputValue('#mcEdCantidad')) === '3' && /^5/.test(await p.inputValue('#mcEdValor')) && /^2/.test(await p.inputValue('#mcEdCompra')))
  await p.keyboard.press('Escape'); await p.waitForTimeout(500)

  // Añadir una nueva, con coste y precio.
  await p.click('#mcAlbum [data-carta="sv8-2"]'); await p.waitForTimeout(1200)
  check('una que no tiene: «Añadir al stock»', /Añadir al stock/.test(await p.textContent('#mcEditor')))
  await p.click('#mcEdMas'); await p.waitForTimeout(800)
  check('la hoja: «Añadir 1 al stock», con coste y su precio', (await p.textContent('#mcAdGuardar')) === 'Añadir 1 al stock' && (await p.getAttribute('#mcAdCompra', 'placeholder')) === 'Coste (€)' && (await p.isVisible('#mcAdPrecio')))
  await p.fill('#mcAdCompra', '1,5'); await p.fill('#mcAdPrecio', '4')
  await p.click('#mcAdGuardar'); await p.waitForTimeout(1200)
  check('entra en SU stock con su coste y su precio (y nada en la colección)', JSON.stringify(await stock(p)) === JSON.stringify(['sv8-1:es:NM:3:2:5', 'sv8-2:es:NM:1:1.5:4', 'sv8-4:en:EX:0:1:3']) && (await coleccion(p)) === 1, JSON.stringify(await stock(p)))
  check('  …el aviso dice «1 en stock» y la ficha también', /1 en stock/.test(await p.textContent('.toast, [role="status"], body')) && (await p.textContent('#mcEdTienes')) === '1 en stock')
  // Otra igual con otro coste: la misma línea, coste medio, el precio se queda.
  await p.click('#mcEdMas'); await p.waitForTimeout(1200)
  const tras = await stock(p)
  if (!tras.some((x) => x.startsWith('sv8-2:es:NM:2'))) {
    // El «+» de la ficha de una que ya tiene suma otra igual sin preguntar (915).
  }
  check('el «+» de la ficha suma otra igual a la misma línea', tras.includes('sv8-2:es:NM:2:1.5:4'), JSON.stringify(tras))
  await ctx.close()
}

console.log('── 3. La agotada vuelve a su línea ──')
{
  const { p, ctx } = await abrir('/cartas?ver=album&set=sv8')
  await p.click('#mcAlbum [data-carta="sv8-4"]'); await p.waitForTimeout(1200)
  await p.click('#mcEdMas'); await p.waitForTimeout(800)
  await p.click('#mcAdIdiomas [data-idioma="en"]')
  await p.click('#mcAdEstado + .mc-seg [data-valor="EX"], .mc-ad-campo .mc-seg button:has-text("EX")').catch(() => p.selectOption('#mcAdEstado', 'EX'))
  await p.fill('#mcAdCompra', '3')
  await p.click('#mcAdGuardar'); await p.waitForTimeout(1200)
  const s = await stock(p)
  check('añadir una igual a la agotada le suma a ESA línea (no abre otra), con el coste de ahora', s.includes('sv8-4:en:EX:1:3:3') && s.length === 2, JSON.stringify(s))
  await ctx.close()
}

console.log('── 4. Sin la marca: lo sabe por el perfil ──')
{
  const { p, ctx, errs } = await abrir('/cartas?ver=pokedex', { marca: false })
  check('sin errores, en modo tienda y en la Pokédex', !errs.length && (await p.evaluate(() => document.body.hasAttribute('data-tienda'))) && (await p.isVisible('#mcPanelPokedex')), errs.join(' | '))
  check('  …y apunta la marca para la próxima', (await p.evaluate(() => localStorage.getItem('pd-tienda'))) === JSON.stringify({ u: 'cartas-ane', id: 'user-2' }))
  await ctx.close()
}

console.log('── 5. Productos: lo sellado también va al stock ──')
{
  const { p, ctx, errs } = await abrir('/cartas?ver=productos')
  await p.click('#mcProdSets [data-prod-set="300"]'); await p.waitForTimeout(800)
  await p.click('#mcProdRejilla [data-prod="9002"] [data-prod-anadir]'); await p.waitForTimeout(400)
  await p.click('#mcProdIdioma [data-prodi-idioma="es"]'); await p.waitForTimeout(800)
  check('«+ Añadir» de un producto lo mete en el stock, sellado y en su idioma', (await stock(p)).includes('p9002:es:sellado:1:-:-') && !errs.length, JSON.stringify(await stock(p)) + errs.join(' | '))
  await p.click('#mcProdRejilla [data-prod="9002"] [data-prod-mas]'); await p.waitForTimeout(800)
  check('  …y el «+» suma otra unidad', (await stock(p)).includes('p9002:es:sellado:2:-:-'), JSON.stringify(await stock(p)))
  check('  …sin tocar los productos de una persona', await p.evaluate(() => !(window.__TABLAS__.user_products || []).length))
  await ctx.close()
}

console.log('── 6. En el móvil ──')
{
  const { p, ctx, errs } = await abrir('/cartas', { movil: true })
  check('sin errores', !errs.length, errs.join(' | '))
  const bm = await p.$$eval('.bm a', (as) => as.map((a) => a.textContent.trim() + (a.getAttribute('aria-current') ? '*' : '')))
  check('la barra de abajo: Panel, Colección (encendida), Vender, Stock y Mensajes', bm.join() === 'Panel,Colección*,Vender,Stock,Mensajes', bm.join())
  check('  …y encima, la burbuja con sus pestañas', (await p.isVisible('#mcMenu')) && (await p.locator('#mcMenu [data-pestania]').count()) === 4)
  check('  …sin salirse de ancho', (await p.evaluate(() => document.documentElement.scrollWidth)) <= 390)
  await ctx.close()
}

console.log('── 7. Una persona no nota nada ──')
{
  const { p, ctx, errs } = await abrir('/cartas?ver=album&set=sv8', { sesion: 'user-1', tienda: false, marca: false })
  check('sin modo tienda: su título, sus tres pestañas y SU colección', !errs.length && !(await p.evaluate(() => document.body.hasAttribute('data-tienda'))) && /Cartas/.test(await p.textContent('#mcTitulo')) && (await p.$$eval('#mcMenu [data-pestania]', (bs) => bs.map((x) => x.dataset.pestania).join())) === 'album,productos,buscar', errs.join(' | '))
  const tengo = await p.$$eval('#mcAlbum [data-carta]', (xs) => [...new Set(xs.filter((x) => x.closest('.tengo')).map((x) => x.dataset.carta))])
  check('  …lo que tiene es lo de su colección, no el stock de nadie', tengo.join() === 'sv8-3', tengo.join())
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
