// Tanda 1276 — lo que pagaste por un producto sellado.
//
// PINGU: «me han pedido que se pueda añadir el valor pagado por el producto
// sellado que tenemos». La columna ya existía (`user_products.pagado`, y en
// una tienda el `coste` de su línea de stock) y ninguna pantalla la usaba.
// Ahora la ficha de un producto lleva un campo por línea (por unidad, como el
// de una carta) y debajo lo pagado contra lo que vale hoy.
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const CAPS = process.env.PD_CAPS || ''

console.log('── 1. La cuenta ──')
{
  const { pagadoDeLineas } = await import(`${RAIZ}/js/productos.js`)
  const f = { lang: 'en', cm_lowest: 22, cm_lowest_eu: 20, cm_lowest_es: 21, cm_lowest_de: 19 }
  check('sin nada apuntado, no se sabe (null), no «cero»', pagadoDeLineas(f, [{ idioma: 'es', cantidad: 2, pagado: null }]) === null)
  const b = pagadoDeLineas(f, [{ idioma: 'es', cantidad: 2, pagado: 18.5 }, { idioma: 'de', cantidad: 1, pagado: null }])
  check('por UNIDAD, y solo las líneas que lo llevan (2 × 18,50 contra 2 × 21)', b.pagado === 37 && b.vale === 42 && b.unidades === 2, JSON.stringify(b))
  const c = pagadoDeLineas({ lang: 'en' }, [{ idioma: 'es', cantidad: 1, pagado: 10 }])
  check('  …y sin precio de hoy, lo que vale no se inventa', c.pagado === 10 && c.vale === null, JSON.stringify(c))
  check('  …un cero es un valor (un regalo)', pagadoDeLineas(f, [{ idioma: 'es', cantidad: 1, pagado: 0 }])?.pagado === 0)
}

const SETS = [{ id: 'sv3', name: 'Obsidiana en Llamas', serie_id: 'sv', market: 'WEST', release_date: '2023-08-11', card_count_official: 197, card_count_total: 230, tcggo_id: 300 }]
const PRODUCTOS = [{ id: 9002, episode_id: 300, market: 'WEST', lang: 'en', name: 'Obsidian Flames Charizard ex Tin', tipo: 'lata', cm_lowest: 22, cm_lowest_eu: 20, cm_lowest_es: 21, cm_lowest_de: 19, release_date: '2023-08-11' }]
const CARTAS = [{ id: 'sv3-1', set_id: 'sv3', local_id: '1', name: 'Scyther', market: 'WEST', category: 'Pokemon' }]
const b = await chromium.launch()
async function abrir(ruta, { tienda = false, movil = false } = {}) {
  const ctx = await b.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(([d, t]) => {
    window.__FAKE_SESSION__ = t ? 'user-2' : 'admin-1'
    if (t) {
      window.__FAKE_PERFIL__ = { tipo: 'tienda', display_name: 'Cartas de Ane', username: 'cartas-ane' }
      window.__FAKE_FILAS__ = { tienda_stock: [{ id: 's7', tienda_id: 'user-2', product_id: 9002, market: 'WEST', idioma: 'es', estado: 'sellado', variante: 'normal', unidades: 4, coste: null, precio: 30, visible: true, created_at: '2026-10-01T10:00:00Z' }] }
      if (!sessionStorage.getItem('ya')) { sessionStorage.setItem('ya', '1'); try { localStorage.setItem('pd-tienda', JSON.stringify({ u: 'cartas-ane', id: 'user-2' })) } catch {} }
    } else {
      window.__FAKE_MIS_PRODUCTOS__ = [{ product_id: 9002, idioma: 'es', cantidad: 2 }, { product_id: 9002, idioma: 'de', cantidad: 1 }]
    }
    window.__FAKE_SETS__ = d.SETS
    window.__FAKE_CARTAS__ = d.CARTAS
    window.__FAKE_COLECCION__ = []
    window.__FAKE_PRODUCTOS__ = d.PRODUCTOS
  }, [{ SETS, PRODUCTOS, CARTAS }, tienda])
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|jsdelivr|githubusercontent|scrydex/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#d97a2b"/></svg>' }))
  await ctx.route(/api\.tcgdex\.net|\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errs = []
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2400)
  return { p, ctx, errs }
}
async function abrirFicha(p) {
  await p.click('#mcProdSets [data-prod-set="300"]'); await p.waitForTimeout(800)
  await p.click('#mcProdRejilla [data-prod="9002"] .mc-prod-abrir'); await p.waitForTimeout(800)
}
const pagados = (p) => p.evaluate(() => (window.__TABLAS__.user_products || []).map((m) => `${m.idioma}:${m.cantidad}:${m.pagado ?? '-'}`).sort())
const escribir = async (p, sel, texto) => { await p.fill(sel, texto); await p.press(sel, 'Enter'); await p.waitForTimeout(600) }

console.log('── 2. Tu colección: lo que pagaste, en la ficha ──')
{
  const { p, ctx, errs } = await abrir('/mi-coleccion.html?ver=productos')
  await abrirFicha(p)
  const campos = await p.$$eval('#mcProdFichaMando .mc-prodf-linea', (ls) => ls.map((l) => `${l.querySelector('.mc-prod-mando').dataset.idiomaLinea}:${!!l.querySelector('input[data-prod-pagado]')}`))
  check('cada línea (español y alemán) con su campo «Pagaste»', campos.join() === 'es:true,de:true' && !errs.length, campos.join() + errs.join(' | '))
  check('  …y sin nada apuntado, sin balance', (await p.locator('#mcProdFichaMando .mc-prodf-balance').count()) === 0)
  const es = '#mcProdFichaMando .mc-prodf-linea:has([data-idioma-linea="es"]) input[data-prod-pagado]'
  await escribir(p, es, '18,50 €')
  check('«18,50 €» se guarda en la línea española, por unidad', JSON.stringify(await pagados(p)) === JSON.stringify(['de:1:-', 'es:2:18.5']), JSON.stringify(await pagados(p)))
  const bal = (await p.textContent('#mcProdFichaMando .mc-prodf-balance'))?.replace(/\s+/g, ' ')
  check('  …y debajo: pagaste 37 €, hoy vale 42 €, +5 €', /Pagaste 37,00 €/.test(bal) && /Hoy vale 42,00 €/.test(bal) && /\+5,00 €/.test(bal) && (await p.getAttribute('.mc-prodf-dif', 'class')).includes('sube'), bal)
  if (CAPS) await p.screenshot({ path: `${CAPS}/1276-ficha.png` })
  await p.click('#mcProdFichaMando .mc-prodf-linea:has([data-idioma-linea="es"]) [data-prod-mas]'); await p.waitForTimeout(700)
  check('el «+» de la línea conserva lo pagado (3 × 18,50 = 55,50)', JSON.stringify(await pagados(p)) === JSON.stringify(['de:1:-', 'es:3:18.5']) && /Pagaste 55,50 €/.test(await p.textContent('#mcProdFichaMando .mc-prodf-balance')), JSON.stringify(await pagados(p)))
  check('  …y el campo sigue con su valor', (await p.inputValue(es)) === '18,50')
  await escribir(p, es, 'mucho')
  check('un texto que no es dinero no se guarda y avisa', JSON.stringify(await pagados(p)) === JSON.stringify(['de:1:-', 'es:3:18.5']) && (await p.inputValue(es)) === '18,50' && /importe/.test(await p.textContent('body')))
  await escribir(p, es, '')
  check('vaciar el campo lo quita, y el balance se va', JSON.stringify(await pagados(p)) === JSON.stringify(['de:1:-', 'es:3:-']) && (await p.locator('#mcProdFichaMando .mc-prodf-balance').count()) === 0, JSON.stringify(await pagados(p)))
  // Si la base dice que no, vuelve a lo de antes (896).
  await escribir(p, es, '20')
  await p.evaluate(async () => {
    const { supabase } = await import('/js/supabase.js')
    const original = supabase.from.bind(supabase)
    supabase.from = (t) => {
      const q = original(t)
      if (t === 'user_products') q.update = () => ({ eq: () => ({ eq: async () => ({ error: { message: 'permiso denegado' } }) }) })
      return q
    }
  })
  await escribir(p, es, '25')
  check('si la base dice que no, vuelve a lo de antes con su aviso', (await p.inputValue(es)) === '20,00' && /permiso denegado/.test(await p.textContent('body')) && /Pagaste 60,00 €/.test(await p.textContent('#mcProdFichaMando .mc-prodf-balance')), await p.inputValue(es))
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

console.log('── 3. Una tienda: es el coste de su línea de stock ──')
{
  const { p, ctx, errs } = await abrir('/cartas?ver=productos', { tienda: true })
  await abrirFicha(p)
  const sel = '#mcProdFichaMando input[data-prod-pagado]'
  check('la ficha dice «Coste» en la línea de su stock', (await p.locator(sel).count()) === 1 && /Coste/.test(await p.textContent('#mcProdFichaMando .mc-prodf-pagado')) && !errs.length, errs.join(' | '))
  await escribir(p, sel, '15')
  const coste = await p.evaluate(() => (window.__TABLAS__.tienda_stock || []).find((f) => f.id === 's7')?.coste)
  check('  …y se guarda en `tienda_stock.coste`, sin tocar los productos de una persona', Number(coste) === 15 && !(await p.evaluate(() => (window.__TABLAS__.user_products || []).length)), String(coste))
  check('  …con «Coste 60,00 € · Hoy vale 84,00 €»', /Coste 60,00 €/.test(await p.textContent('#mcProdFichaMando .mc-prodf-balance')) && /Hoy vale 84,00 €/.test(await p.textContent('#mcProdFichaMando .mc-prodf-balance')))
  await ctx.close()
}

console.log('── 4. En el móvil ──')
{
  const { p, ctx, errs } = await abrir('/mi-coleccion.html?ver=productos', { movil: true })
  await abrirFicha(p)
  const caja = await p.$eval('#mcProdFichaMando input[data-prod-pagado]', (i) => { const r = i.getBoundingClientRect(); return { alto: r.height, letra: parseFloat(getComputedStyle(i).fontSize), dentro: r.right <= innerWidth } })
  check('el campo mide 44 px, letra de 16 (sin zoom del iPhone) y cabe', caja.alto >= 44 && caja.letra >= 16 && caja.dentro, JSON.stringify(caja))
  if (CAPS) await p.screenshot({ path: `${CAPS}/1276-movil.png` })
  check('sin errores', !errs.length, errs.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
