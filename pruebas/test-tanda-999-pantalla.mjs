// Tanda 999 — «Una versión a varias»: la misma versión a mano (la Cosmos Holo)
// a muchas cartas de un set de una vez, desde /admin.
//
// PINGU: «estoy añadiendo Cosmos Holo a cartas de sets que tuvieron una promo
// Cosmos» (carta a carta). Y al ver la propuesta: «adelante, me ahorrará
// mucho tiempo».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. Lo puro ──')
const m = await import(`${RAIZ}/admin/js/version-varias-puro.js`)
{
  const n = (t) => [...m.numerosDeTexto(t)].join()
  check('números sueltos y tramos, con comas, espacios o saltos', n('4, 25 58\n101-103') === '4,25,58,101,102,103', n('4, 25 58\n101-103'))
  check('  …un tramo al revés se da la vuelta; uno enorme no se expande', n('5-3') === '3,4,5' && !m.numerosDeTexto('1-9999').has('500'))
  check('  …«SVP 205» es un número; «TG01» casa con «TG1»; los ceros de delante no cuentan', n('SVP 205') === 'svp205' && m.numeroComparable('TG01') === 'tg1' && m.numeroComparable('003/106') === '3')
  const cartas = [{ id: 'a', local_id: '004' }, { id: 'b', local_id: '25' }, { id: 'c', local_id: 'TG01' }, { id: 'd', local_id: '26' }]
  check('las cartas que entran por lo pegado', m.cartasDeNumeros(cartas, m.numerosDeTexto('4, 25, tg1')).map((c) => c.id).join() === 'a,b,c')
  check('el nombre: vacío o el de una de siempre no vale; «Cosmos Holo» sí', m.problemaDelNombre('') && m.problemaDelNombre('Reverse Holo') && m.problemaDelNombre('holo') && m.problemaDelNombre('Cosmos Holo') === null)
  const p = m.planDeVarias(cartas, 'Cosmos Holo', new Map([['b', new Set(['cosmos-holo'])]]))
  check('la que ya la tiene no se repite', p.crear.map((c) => c.id).join() === 'a,c,d' && p.ya.map((c) => c.id).join() === 'b')
  const d = m.datosDeVersion({ etiqueta: ' Cosmos Holo ', salio_en: 'Blíster', lanzamiento: 'mañana', clase: 'otra' })
  check('lo que se manda: el nombre limpio, sin icono (sale del nombre), la clase por defecto «adicional», sin fecha rara', d.etiqueta === 'Cosmos Holo' && d.icono === '' && d.clase === 'adicional' && d.lanzamiento === '' && d.salio_en === 'Blíster', JSON.stringify(d))
}

console.log('── 2. La pantalla de /admin ──')
const SETS = [{ id: 'sv3pt5', name: '151', name_en: '151', serie_id: 'sv', market: 'WEST', release_date: '2023-09-22', card_count_official: 165, card_count_total: 207 }]
const CARTAS = [1, 4, 25, 58, 101, 102, 103, 150].map((n) => ({ id: `sv3pt5-${n}`, market: 'WEST', set_id: 'sv3pt5', local_id: String(n), name: `Carta ${n}`, rarity_en: 'Common' }))
const VERSIONES = [{ tcggo_id: -50, market: 'WEST', card_id: 'sv3pt5-58', set_id: 'sv3pt5', etiqueta: 'Cosmos Holo', origen: 'mano' }]
const browser = await chromium.launch()
{
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, locale: 'es-ES' })
  await ctx.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    Object.assign(window, { __FAKE_SETS__: d.SETS, __FAKE_CARTAS__: d.CARTAS, __FAKE_COLECCION__: [], __FAKE_VERSIONES__: d.VERSIONES, __FAKE_ERAS__: [] })
  }, { SETS, CARTAS, VERSIONES })
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  const rpcs = (n) => p.evaluate((x) => (window.__RPCS__ || []).filter((r) => r.nombre === x), n)
  const manos = () => p.evaluate(() => (window.__TABLAS__.tcg_card_versions || []).filter((v) => v.origen === 'mano' && v.etiqueta === 'Cosmos Holo').map((v) => v.card_id).sort())
  await p.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1800)
  await p.locator('[data-section="colecciones"]').click()
  await p.waitForTimeout(600)
  await p.locator('#coleccionesDesplegar').click().catch(() => {})
  await p.locator('[data-editar="sv3pt5"]').click()
  await p.waitForTimeout(300)
  await p.locator('#colCartas').click()
  await p.waitForTimeout(800)
  check('la lista de cartas del set tiene «Una versión a varias»', await p.locator('#catVarias').isVisible())
  await p.locator('#catVarias').click()
  await p.waitForFunction(() => document.getElementById('vvResumen'), null, { timeout: 5000 }).catch(() => {})
  await p.waitForTimeout(400)
  const resumen = () => p.locator('#vvResumen').textContent()
  check('sin nada: lo pide y no deja crear', /Marca las cartas/.test(await resumen()) && await p.locator('#vvCrear').isDisabled(), await resumen())
  check('  …una casilla por carta del set', (await p.locator('[data-vv-carta]').count()) === CARTAS.length)
  await p.locator('#vvNombre').fill('Cosmos Holo')
  await p.locator('#vvNumeros').fill('4, 25, 58, 101-103')
  await p.waitForTimeout(200)
  const marcadas = await p.evaluate(() => [...document.querySelectorAll('[data-vv-carta][aria-pressed="true"]')].map((b) => b.dataset.vvCarta).join())
  check('pegar los números marca esas cartas', marcadas === 'sv3pt5-4,sv3pt5-25,sv3pt5-58,sv3pt5-101,sv3pt5-102,sv3pt5-103', marcadas)
  check('  …la 58 ya la tiene: «ya» y no cuenta', /6 cartas marcadas · 1 ya la tiene/.test(await resumen()) && await p.locator('[data-vv-carta="sv3pt5-58"] .vv-ya').isVisible(), await resumen())
  // Tocar una la suma (la 150) y tocar otra la quita (la 4).
  await p.locator('[data-vv-carta="sv3pt5-150"]').click()
  await p.locator('[data-vv-carta="sv3pt5-4"]').click()
  check('tocar marca y desmarca; el botón dice cuántas', /Crear 5 versiones «Cosmos Holo»/.test(await p.locator('#vvCrear').textContent()), await p.locator('#vvCrear').textContent())
  await p.locator('#vvClase').selectOption('impresion')
  await p.locator('#vvSalio').fill('Blíster de 3 sobres')
  await p.locator('#vvCrear').click()
  await p.waitForTimeout(1200)
  const ll = await rpcs('catalogo_version_mano')
  check('crea una por carta con la 934, con lo escrito', ll.length === 5 && ll.every((r) => r.args.p_market === 'WEST' && r.args.p_tcggo_id == null && r.args.p_datos.etiqueta === 'Cosmos Holo' && r.args.p_datos.clase === 'impresion' && r.args.p_datos.salio_en === 'Blíster de 3 sobres'), JSON.stringify(ll.map((r) => r.args.p_card_id)))
  check('  …y quedan en la base, la 58 una sola vez', (await manos()).join() === 'sv3pt5-101,sv3pt5-102,sv3pt5-103,sv3pt5-150,sv3pt5-25,sv3pt5-58', (await manos()).join())
  check('  …con Deshacer a la vista y las marcas limpias', await p.locator('#vvDeshacer').isVisible() && (await p.locator('[data-vv-carta][aria-pressed="true"]').count()) === 0)
  await p.locator('#vvDeshacer').click()
  await p.waitForTimeout(900)
  check('Deshacer quita solo las de esta vez (la 58 de antes se queda)', (await manos()).join() === 'sv3pt5-58', (await manos()).join())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
