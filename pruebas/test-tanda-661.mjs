// Tandas 660 y 661 — Scrydex al final de la cadena de escaneos, y la
// gráfica del histórico como la de TCGGO: rangos, una línea por idioma,
// marcas de lanzamiento, chips de 7 y 30 días y lectura al pasar el dedo.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { rutaDeCarta } from '/home/user/pingu/js/carta-ruta.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RAIZ = '/home/user/pingu'
const limpio = (t) => String(t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim()
const d = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

console.log('── 1. La cadena de escaneos (660): Scrydex detrás de TCGdex y TCGGO ──')
{
  const { cadenaDeEscaneo } = await import(`${RAIZ}/js/escaneo-carta.js`)
  const c = cadenaDeEscaneo({ id: 'sv1-1', market: 'WEST', set_id: 'sv1', local_id: '1', image_path: 'sv/sv1/1', image_scrydex: 'https://images.scrydex.com/pokemon/sv1-1', image_tcggo: 'https://images.tcggo.com/1.jpg', tcg_sets: { tcg_online_code: 'SVI' } })
  check('TCGdex (español) primero, TCGGO después, Scrydex detrás, y Limitless y pokemontcg al final', /tcgdex/.test(c[0]) && /tcggo/.test(c[1]) && /scrydex/.test(c[2]) && /limitless/.test(c[3]) && /pokemontcg/.test(c[4]), c.join(' | '))
  const sinTcgdex = cadenaDeEscaneo({ id: 'tcggo-9', market: 'WEST', set_id: 'sv1', local_id: '9', image_scrydex: 'https://images.scrydex.com/pokemon/x', image_tcggo: 'https://images.tcggo.com/9.jpg' })
  check('  …y sin TCGdex, TCGGO primero y Scrydex después', /tcggo/.test(sinTcgdex[0]) && /scrydex/.test(sinTcgdex[1]))
  check('  …y Scrydex sigue en la cadena (un respaldo que contesta no se borra)', c.some((u) => /scrydex/.test(u)))
}

console.log('\n── 2. La gráfica en puro (661) ──')
{
  const m = await import(`${RAIZ}/js/carta-historial.js`)
  const filas = Array.from({ length: 120 }, (_, i) => { const k = 119 - i; return { dia: d(k), cm_low: 100 + i * 0.3, cm_low_es: 120 + i * 0.5, cm_low_en: 150 + i * 0.2, tp_market_eur: 140 + i * 0.25 } })
  check('seis rangos, por defecto tres meses', m.RANGOS.map((r) => r.id).join() === '7D,1M,3M,6M,1A,MAX' && m.RANGO_POR_DEFECTO === '3M')
  check('las filas de un rango se cortan por fecha', m.filasDelRango(filas, '7D').length === 8 && m.filasDelRango(filas, '1M').length === 31 && m.filasDelRango(filas, 'MAX').length === 120, `${m.filasDelRango(filas, '7D').length} ${m.filasDelRango(filas, '1M').length}`)
  // Un rango está disponible con dos puntos dentro (como en la 464): con
  // tres días, todos enseñan los mismos tres y el pedido se respeta; con
  // uno solo no hay gráfica.
  check('  …y con pocos días, el pedido se respeta mientras tenga dos puntos; con uno, nada', m.rangoElegido(filas.slice(-3), '1A')?.id === '1A' && m.rangoElegido(filas, '1A')?.id === '1A' && m.rangoElegido(filas.slice(-1)) === null && m.rangoElegido(filas.slice(-3), 'XX')?.id === '3M')
  const c7 = m.cambioEnDias(filas, 'es', 7)
  const c30 = m.cambioEnDias(filas, 'es', 30)
  check('el cambio de 7 y 30 días del idioma elegido', c7 && Math.abs(c7.cambio - 3.5) < 0.01 && c30 && Math.abs(c30.cambio - 15) < 0.01 && c7.pct > 0, JSON.stringify([c7, c30]))
  check('  …y no se afirma lo que el histórico no cubre', m.cambioEnDias(filas.slice(-4), 'es', 7) === null && m.cambioEnDias(filas.slice(-4), 'es', 30) === null)
  const svg = m.svgDeHistorial(filas, { idioma: 'es', todas: true, marcas: [{ dia: d(40), codigo: 'MEG', nombre: 'Mega Evolution' }, { dia: d(500), codigo: 'OLD', nombre: 'Fuera' }] })
  check('con `todas`, una línea por idioma: la elegida gorda y las demás finas con su idioma', (svg.match(/<polyline/g) || []).length === 3 && /class="carta-historial-linea carta-historial-linea-otra" data-idioma="en"/.test(svg) && /class="carta-historial-linea" data-idioma="es"/.test(svg))
  check('las marcas: la del tramo se dibuja con su código; la de fuera, no', (svg.match(/carta-historial-marca"/g) || []).length === 1 && />MEG</.test(svg) && !/OLD/.test(svg))
  check('los puntos de lectura van en el SVG', JSON.parse(svg.match(/data-puntos="([^"]+)"/)[1].replace(/&quot;/g, '"')).length === 120)
  check('sin `todas`, como antes: una línea y TCGplayer', (m.svgDeHistorial(filas, { idioma: 'es' }).match(/<polyline/g) || []).length === 2)
  check('la leyenda nombra los idiomas dibujados y TCGplayer, con el elegido marcado', /elegido" data-idioma="es"/.test(m.leyendaHtml(filas, 'es', { todas: true })) && /data-idioma="en"/.test(m.leyendaHtml(filas, 'es', { todas: true })) && /TCGplayer/.test(m.leyendaHtml(filas, 'es', { todas: true })))
  check('los chips', /7 d <b>\+/.test(m.chipsHtml(filas, 'es')) && /30 d <b>\+/.test(m.chipsHtml(filas, 'es')) && m.chipsHtml(filas.slice(-3), 'es') === '')
  const marcas = m.cargadorDeMarcas({ from: () => ({ select: () => ({ eq: () => ({ gte: () => ({ lte: () => ({ order: () => ({ limit: async () => ({ data: [{ id: 'me01', name_en: 'Mega Evolution', tcg_online_code: 'MEG', release_date: d(40), card_count_official: 130 }, { id: 'promo', name: 'Promos', tcg_online_code: 'PR', release_date: d(20), card_count_official: 20 }] }) }) }) }) }) }) }) })
  const lista = await marcas(d(100), d(0))
  check('el cargador de marcas se queda con las expansiones grandes (100 cartas o más)', lista.length === 1 && lista[0].codigo === 'MEG' && lista[0].dia === d(40), JSON.stringify(lista))
}

console.log('\n── 3. En /carta ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.addInitScript((sets) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = [{ id: 'xy5-150', market: 'WEST', set_id: 'xy5', local_id: '150', name: 'Groudon-EX', name_es: 'Groudon EX', image_path: 'x/1', rarity: 'Ultra Rare', category: 'Pokemon', variants: { holo: true }, cm_id_product_propio: 273681 }]
    window.__FAKE_PRECIOS__ = [{ card_id: 'xy5-150', cm_id_product: 273681, cm_low: 39, cm_low_es: 140, cm_low_en: 194, tp_market_eur: 171.08, tcggo_updated: '2026-10-05T12:00:00Z' }]
  }, [
    { id: 'xy5', name: 'Duelos Primigenios', name_en: 'Primal Clash', serie_id: 'xy', market: 'WEST', card_count_official: 160, tcg_online_code: 'PRC', release_date: '2015-02-04' },
    { id: 'me01', name: 'Megaevolución', name_en: 'Mega Evolution', serie_id: 'me', market: 'WEST', card_count_official: 130, tcg_online_code: 'MEG', release_date: d(40) },
    { id: 'promo', name: 'Promos', serie_id: 'me', market: 'WEST', card_count_official: 20, tcg_online_code: 'PR', release_date: d(20) },
  ])
  await page.route(/assets\.tcgdex\.net|images\.tcggo\.com/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#c9a227"/></svg>' }))
  await page.route(/api\.tcgdex\.net/, (r) => r.abort())
  let pedidas = 0
  await page.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
  await page.route('**/.netlify/functions/tcggo-historial*', (r) => {
    pedidas++
    const filas = Array.from({ length: 120 }, (_, i) => { const k = 119 - i; return { card_id: 'xy5-150', dia: d(k), cm_low: 100 + i * 0.3, cm_low_es: 120 + i * 0.5, cm_low_en: 150 + i * 0.2, tp_market_eur: 140 + i * 0.25 } })
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ filas }) })
  })
  await page.goto(`${BASE}${rutaDeCarta({ id: 'xy5-150', name: 'Groudon-EX', name_es: 'Groudon EX' })}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  const caja = page.locator('#cmHistorial')
  const puntos = async () => JSON.parse(await caja.locator('svg').getAttribute('data-puntos')).length
  check('por defecto, tres meses (91 puntos), con el 3M puesto', (await puntos()) === 91 && (await caja.locator('.carta-historial-rango.activo').innerText()) === '3M', String(await puntos()))
  check('  …con la marca del lanzamiento grande del tramo (MEG) y no la de las promos', (await caja.locator('svg .carta-historial-marca').count()) === 1 && /MEG/.test(await caja.locator('svg').innerHTML()) && !/>PR</.test(await caja.locator('svg').innerHTML()))
  await caja.locator('[data-rango="7D"]').click()
  await page.waitForTimeout(300)
  check('al pulsar 7D quedan 8 puntos y no se vuelve a pedir', (await puntos()) === 8 && pedidas === 1)
  await caja.locator('[data-rango="MAX"]').click()
  await page.waitForTimeout(300)
  check('  …y MAX, los 120', (await puntos()) === 120)
  const l = caja.locator('.carta-historial-lienzo')
  const b = await l.boundingBox()
  await page.mouse.move(b.x + b.width * 0.5, b.y + b.height * 0.5)
  await page.waitForTimeout(150)
  check('al pasar el ratón sale el globo con el día y el precio', await caja.locator('.carta-historial-lectura').isVisible() && /€/.test(limpio(await caja.locator('.carta-historial-globo').innerText())), limpio(await caja.locator('.carta-historial-globo').innerText()))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await browser.close()
}

console.log('\n── 4. Lo estático ──')
{
  const css = readFileSync(`${RAIZ}/css/cardmarket.css`, 'utf8')
  check('cada idioma con su color, por tokens', /\.carta-historial-linea\[data-idioma='en'\] \{ stroke: var\(--indigo\)/.test(css) && /data-idioma='ja'\] \{ stroke: var\(--rarity-bronze\)/.test(css))
  check('la ficha de /mi-coleccion también pasa las marcas', /cargadorDeMarcas\(supabase, c\?\.market/.test(readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')))
}

console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
