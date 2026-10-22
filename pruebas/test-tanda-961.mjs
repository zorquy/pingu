// Tanda 961 — las fotos de todas las cartas de un set a la vez, en /admin.
//
// PINGU: «es un poco tedioso tener que descargarme 60 imágenes y meterlas una
// a una». Lo puro (de qué carta es cada fichero, la dirección con el número)
// en Node, y en el navegador: soltar cuatro fotos (una sin casar, dos para la
// misma carta), subirlas y que cada carta quede con la suya; y una dirección
// con {n3} de la que solo existen unas cuantas, que pone solo esas.
import { join } from 'node:path'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── Lo puro ──')
const p = await import(join(RAIZ, 'admin/js/fotos-lote-puro.js'))
const CARTAS = [
  { id: 'base2-1', local_id: '1', name: 'Clefable' }, { id: 'base2-4', local_id: '4', name: 'Jolteon' },
  { id: 'base2-12', local_id: '12', name: 'Pinsir' }, { id: 'base2-64', local_id: '64', name: 'Weedle' },
  { id: 'dp7-SH2', local_id: 'SH2', name: 'Duskull' },
]
const de = (n) => p.cartaDeFichero(n, CARTAS)?.id || null
check('«4.jpg», «004.png» y «Jolteon 4.webp» son la 4', de('4.jpg') === 'base2-4' && de('004.png') === 'base2-4' && de('Jolteon 4.webp') === 'base2-4')
check('«jungle-4-64.jpg» es la 4, no la 64 (el segundo es la cuenta del set)', de('jungle-4-64.jpg') === 'base2-4')
check('«base2-12.png» por el id entero, y no la 1', de('base2-12.png') === 'base2-12')
check('«SH2.png» y «sh02.webp» son la SH2', de('SH2.png') === 'dp7-SH2' && de('sh02.webp') === 'dp7-SH2')
check('«IMG_9999.jpg» no casa con nada', de('IMG_9999.jpg') === null)
const casadas = p.casarFicheros(['1.jpg', '01.png', '4.jpg', 'foto.jpg'], CARTAS)
check('dos ficheros para la misma carta: «repetida» las dos; sin número, «sin casar»', casadas.map((f) => f.motivo || 'ok').join() === 'repetida,repetida,ok,sin casar', casadas.map((f) => f.motivo || 'ok').join())
check('la dirección con {n3} lleva los ceros, {n} no', p.urlDePatron('https://x/{n3}.png', CARTAS[1]) === 'https://x/004.png' && p.urlDePatron('https://x/{n}.png', CARTAS[1]) === 'https://x/4.png')
check('  …con {id} y {set}', p.urlDePatron('https://x/{set}/{id}.png', CARTAS[4], 'dp7') === 'https://x/dp7/dp7-SH2.png')
check('  …un número con letras no se rellena', p.urlDePatron('https://x/{n3}.png', CARTAS[4]) === 'https://x/SH2.png')
check('  …sin hueco o sin https no vale (sería la misma foto para todas)', p.urlDePatron('https://x/foto.png', CARTAS[1]) === null && p.urlDePatron('http://x/{n}.png', CARTAS[1]) === null)
const lista = await import(join(RAIZ, 'admin/js/lista-cartas-puro.js'))
const conFoto = lista.cartasDeLista('4 · Jolteon · https://x/4.png\n5 · Flareon · Flareon · https://x/5.png').cartas
check('la lista pegada al crear acepta la foto en la línea', conFoto[0].image_path === 'https://x/4.png' && conFoto[0].name === 'Jolteon' && !conFoto[0].name_en && conFoto[1].name_en === 'Flareon' && conFoto[1].image_path === 'https://x/5.png', JSON.stringify(conFoto))

console.log('── En /admin ──')
const SETS = [{ id: 'base2', name: 'Jungle', name_en: 'Jungle', serie_id: 'base', market: 'WEST', release_date: '1999-06-16', card_count_official: 64 }]
const FICHAS = CARTAS.slice(0, 4).map((c) => ({ ...c, market: 'WEST', set_id: 'base2', image_path: null, rarity: 'Rare' }))
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAADCAIAAAA2iEnWAAAAEklEQVR4nGP4z8DAwMDAwMDAAAAoAAJ2bnN8AAAAAElFTkSuQmCC', 'base64')
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
await ctx.addInitScript((d) => {
  window.__FAKE_SESSION__ = 'admin-1'
  window.__FAKE_SETS__ = d.SETS
  window.__FAKE_CARTAS__ = d.FICHAS
  window.__FAKE_PERFILES__ = [{ id: 'admin-1', username: 'pingu', is_admin: true }]
  window.__FAKE_ERAS__ = []
}, { SETS, FICHAS })
// La dirección de prueba: existen la 1 y la 12; la 4 y la 64 dan 404.
await ctx.route(/fotos\.ejemplo\.test\/jungle\/(\d+)\.png/, (r) => {
  const n = /\/(\d+)\.png/.exec(r.request().url())[1]
  return ['001', '012'].includes(n) ? r.fulfill({ status: 200, contentType: 'image/png', body: PNG }) : r.fulfill({ status: 404, body: '' })
})
await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|limitlesstcg|pokemontcg|ejemplo\.supabase\.co/, (r) => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }))
await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }))
const page = await ctx.newPage()
const errores = []
page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
await page.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
await page.waitForTimeout(1800)
await page.locator('[data-section="colecciones"]').click()
await page.waitForTimeout(800)
await page.locator('[data-editar="base2"]').click()
await page.waitForTimeout(900)
await page.locator('#colCartas').click()
await page.waitForTimeout(900)
await page.locator('#catFotos').click()
await page.waitForTimeout(600)
check('la lista de cartas tiene «Fotos de todas» y abre su hoja', await page.locator('#flFicheros').count() === 1)
await page.setInputFiles('#flFicheros', [
  { name: '004.png', mimeType: 'image/png', buffer: PNG },
  { name: 'Pinsir 12.png', mimeType: 'image/png', buffer: PNG },
  { name: 'foto-sin-numero.png', mimeType: 'image/png', buffer: PNG },
])
await page.waitForTimeout(300)
const filas = await page.$$eval('#flCasadas li', (ls) => ls.map((l) => l.innerText.replace(/\s+/g, ' ').trim()))
check('cada fichero con su carta, y el que no casa dicho', /004\.png → 4 · Jolteon/.test(filas[0]) && /Pinsir 12\.png → 12 · Pinsir/.test(filas[1]) && /sin casar/.test(filas[2]), filas.join(' | '))
check('  …y el botón cuenta solo las buenas', /Subir y poner 2 fotos/.test(await page.locator('#flSubir').textContent()))
await page.click('#flSubir')
await page.waitForTimeout(1500)
const t = await page.evaluate(() => ({ cartas: window.__TABLAS__.tcg_cards.filter((c) => c.set_id === 'base2').map((c) => [c.local_id, c.image_path]), subidas: window.__SUBIDAS__ || null }))
const foto = (n) => t.cartas.find(([l]) => l === n)?.[1] || ''
check('la 4 y la 12 quedan con su foto subida al cubo de las guías', /guide-images\/admin-1\/cartas\//.test(foto('4')) && /guide-images\/admin-1\/cartas\//.test(foto('12')) && foto('4') !== foto('12'), JSON.stringify(t.cartas))
check('  …la 1 y la 64, sin tocar', !foto('1') && !foto('64'))
await page.fill('#flPatron', 'https://fotos.ejemplo.test/jungle/{n3}.png')
await page.click('#flProbar')
await page.waitForFunction(() => /^Puestas/.test(document.getElementById('flPatronEstado')?.textContent || ''), null, { timeout: 30000 }).catch(() => {})
const estado = await page.locator('#flPatronEstado').textContent()
const t2 = await page.evaluate(() => window.__TABLAS__.tcg_cards.filter((c) => c.set_id === 'base2').map((c) => [c.local_id, c.image_path]))
const foto2 = (n) => t2.find(([l]) => l === n)?.[1] || ''
check('la dirección con el número pone solo las que cargan (la 1), sin tocar las que ya tenían', foto2('1') === 'https://fotos.ejemplo.test/jungle/001.png' && !foto2('64') && /guide-images/.test(foto2('4')) && /guide-images/.test(foto2('12')), JSON.stringify(t2))
check('  …y dice cuáles no estaban', /Puestas 1 de 2\. Sin foto en esa dirección: 64/.test(estado), estado)
await page.check('#flTambien')
await page.click('#flProbar')
await page.waitForFunction(() => /^Puestas \d+ de 4/.test(document.getElementById('flPatronEstado')?.textContent || ''), null, { timeout: 30000 }).catch(() => {})
const t3 = await page.evaluate(() => window.__TABLAS__.tcg_cards.filter((c) => c.set_id === 'base2').map((c) => [c.local_id, c.image_path]))
check('con la casilla, también cambia las que ya tenían si su dirección carga (la 12)', t3.find(([l]) => l === '12')?.[1] === 'https://fotos.ejemplo.test/jungle/012.png' && /guide-images/.test(t3.find(([l]) => l === '4')?.[1]), JSON.stringify(t3))
const corr = await page.evaluate(() => window.__TABLAS__.tcg_correcciones.filter((c) => c.columna === 'image_path').length)
check('todo se guarda como corrección (no un update a pelo)', corr >= 3, corr)
check('sin errores', errores.length === 0, errores.join(' | '))
await browser.close()
console.log(fails ? `\n❌ ${fails} fallo(s)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
