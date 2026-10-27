// Tanda 1046 — dos trampas de «¿Qué carta es?» que vio la gente:
// (1) en el PC, arrastrar la carta borrosa se llevaba la imagen NÍTIDA (el
//     desenfoque es CSS); igual el botón derecho → «Abrir imagen» y, en el
//     móvil, mantener pulsado. Mientras se juega la foto no recibe el
//     puntero (`pointer-events: none`, `draggable="false"`); lo mismo la
//     silueta de «¿Quién es?».
// (2) acertar era decir el NOMBRE: el reto era el Chinchou de Power Keepers y
//     el de Neo Revelation daba «¡Es esta!». Ahora es la carta exacta; el
//     mismo nombre en otra impresión sale «Otra impresión» y no acaba.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const hoy = new Date().toISOString().slice(0, 10)
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>'
const SETS = [
  { id: 'ex11', name: 'Power Keepers', market: 'WEST', serie_id: 'ex', release_date: '2007-02-02', card_count_official: 108, tcg_online_code: 'PK' },
  { id: 'neo3', name: 'Neo Revelation', market: 'WEST', serie_id: 'neo', release_date: '2001-09-21', card_count_official: 64 },
]
const setDe = (id) => SETS.find((s) => s.id === id)
const carta = (id, set, n, name, extra = {}) => ({ id, market: 'WEST', set_id: set, local_id: String(n), name, name_es: name, image_path: `x/${set}/${n}`, category: 'Pokemon', rarity: 'Common', rarity_en: 'Common', types: ['Lightning'], tcg_sets: { name: setDe(set).name, tcg_online_code: setDe(set).tcg_online_code || null, serie_id: setDe(set).serie_id, release_date: setDe(set).release_date }, ...extra })
const RESPUESTA = carta('ex11-49', 'ex11', 49, 'Chinchou')
const CARTAS = [RESPUESTA, carta('neo3-42', 'neo3', 42, 'Chinchou')]

const browser = await chromium.launch()
async function abrir() {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.route('**/.netlify/functions/carta-del-dia**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ dia: hoy, numero: 1, carta: RESPUESTA, ayer: null }) }))
  await page.route(/assets\.tcgdex\.net|limitlesstcg|pokemontcg\.io|images\.tcggo|scrydex/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: SVG }))
  await page.addInitScript(([sets, cartas]) => {
    window.__FAKE_SESSION__ = 'none'
    window.__FAKE_SETS__ = sets
    window.__FAKE_CARTAS__ = cartas
    localStorage.removeItem('pokedoc-carta-del-dia')
  }, [SETS, CARTAS])
  await page.goto(`${BASE}/carta-del-dia.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}
const adivinar = async (page, texto, id) => {
  await page.locator('#cdAdivinar').click()
  await page.waitForTimeout(300)
  await page.fill('#nvBuscar', texto)
  await page.waitForTimeout(900)
  await page.locator(`[data-elegir="${id}"]`).click()
  await page.waitForTimeout(500)
}

console.log('── 1. La carta borrosa no se puede sacar ──')
{
  const { page, errores } = await abrir()
  const f = await page.evaluate(() => {
    const img = document.getElementById('cdFoto')
    const r = img.getBoundingClientRect()
    const encima = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
    return { arrastra: img.draggable, puntero: getComputedStyle(img).pointerEvents, encima: encima?.id || encima?.tagName, borrosa: getComputedStyle(img).filter }
  })
  check('mientras se juega, la foto no se arrastra ni recibe el puntero (lo que se toca es la caja)', f.arrastra === false && f.puntero === 'none' && f.encima !== 'cdFoto' && f.encima !== 'IMG' && /blur/.test(f.borrosa), JSON.stringify(f))
  // Arrastrar de verdad: no sale ningún «dragstart» con la imagen.
  const r = await page.evaluate(() => {
    let arrastrado = null
    document.addEventListener('dragstart', (e) => { arrastrado = e.target?.id || e.target?.tagName }, { once: true })
    return new Promise((ok) => setTimeout(() => ok(arrastrado), 50))
  })
  const caja = await page.locator('#cdRecorte').boundingBox()
  await page.mouse.move(caja.x + caja.width / 2, caja.y + caja.height / 2)
  await page.mouse.down()
  await page.mouse.move(caja.x + caja.width + 200, caja.y + 50, { steps: 8 })
  await page.mouse.up()
  const arrastrado = await page.evaluate(() => new Promise((ok) => { let a = null; document.addEventListener('dragstart', (e) => { a = e.target?.id }, { once: true }); setTimeout(() => ok(a), 50) }))
  check('  …y arrastrando no sale la imagen', r === null && arrastrado === null, JSON.stringify({ r, arrastrado }))

  console.log('── 2. El mismo nombre en otra impresión no es acierto ──')
  await adivinar(page, 'chinchou', 'neo3-42')
  const fila = await page.evaluate(() => {
    const li = document.querySelector('.cd-intento:not(.cd-intento-vacio)')
    return { acierto: li?.classList.contains('acierto'), texto: li?.innerText.replace(/\s+/g, ' ').trim(), casilla: li?.querySelector('.cd-casilla')?.textContent.trim(), clase: li?.querySelector('.cd-casilla')?.className }
  })
  check('el Chinchou de Neo Revelation NO es «¡Es esta!»: dice «Otra impresión» en amarillo', !fila.acierto && fila.casilla === 'Otra impresión' && /casi/.test(fila.clase || ''), JSON.stringify(fila))
  check('  …y la partida sigue (la foto, aún borrosa y sin puntero)', await page.evaluate(() => getComputedStyle(document.getElementById('cdFoto')).pointerEvents === 'none' && !document.getElementById('cdFinal') || document.getElementById('cdFinal').classList.contains('hidden')))

  console.log('── 3. La de Power Keepers, sí ──')
  await adivinar(page, 'chinchou', 'ex11-49')
  const fin = await page.evaluate(() => ({ acierto: Boolean(document.querySelector('.cd-intento.acierto')), titulo: document.querySelector('.cd-final-titulo')?.textContent.trim(), puntero: getComputedStyle(document.getElementById('cdFoto')).pointerEvents }))
  check('la carta exacta es «¡Es esta!» y acaba en 2', fin.acierto && /Acertada en 2/.test(fin.titulo || ''), JSON.stringify(fin))
  check('  …y resuelta, la carta vuelve a ser tocable (es el enlace a su ficha)', fin.puntero !== 'none', fin.puntero)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('── 4. La silueta de «¿Quién es?», igual ──')
{
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } })
  await page.route(/jsdelivr|githubusercontent|limitlesstcg|pokeapi/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: SVG }))
  await page.goto(`${BASE}/quien-es.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  const s = await page.evaluate(() => { const i = document.getElementById('qeDibujo'); return { arrastra: i.draggable, puntero: getComputedStyle(i).pointerEvents } })
  check('mientras se juega, la silueta no se arrastra ni recibe el puntero', s.arrastra === false && s.puntero === 'none', JSON.stringify(s))
  await page.close()
}

await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
