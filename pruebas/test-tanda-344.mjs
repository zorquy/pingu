// Tanda 344 — la colección, de golpe y a un tamaño que se vea.
//
// PINGU: «que aparezcan todas de golpe», «con cuatro por fila quedaría
// mucho más visual», y en el móvil «al menos dos por fila, no queremos
// una por fila».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 180) : ''}`)
}
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()
// Más de las 60 que traía la primera tanda: si el tope siguiera ahí, se
// vería en la cuenta.
const CARTAS = Array.from({ length: 84 }, (_, i) => ({
  id: `sv3-${i + 1}`, set_id: 'sv3', market: 'WEST', local_id: String(i + 1).padStart(3, '0'),
  name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/y/${i + 1}`,
}))

async function abrir(ancho, movil) {
  const page = await browser.newPage({ viewport: { width: ancho, height: 900 }, isMobile: movil })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript((c) => {
    window.__FAKE_SETS__ = [{ id: 'sv3', name: 'Pitch Black', market: 'WEST', serie_name: 'Mega',
      release_date: '2026-06-05', card_count_official: 84, logo_path: 'me/me05/logo' }]
    window.__FAKE_CARTAS__ = c
  }, CARTAS)
  await page.goto(`${BASE}/coleccion/sv3`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
const columnas = (page) =>
  page.locator('.coleccion-rejilla').evaluate((n) => getComputedStyle(n).gridTemplateColumns.split(' ').length)

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Todas de golpe ──')
{
  const { page, errores } = await abrir(1280, false)
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('salen las 84, no las 60 primeras',
    (await page.locator('.coleccion-carta').count()) === 84,
    String(await page.locator('.coleccion-carta').count()))
  check('y ya no hay botón de «ver más»', (await page.locator('#verMas').count()) === 0)
  await page.close()
  check('el HTML tampoco lo lleva', !/id="verMas"/.test(readFileSync('/home/user/pingu/coleccion.html', 'utf8')))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Cuatro por fila arriba, dos en el móvil ──')
{
  for (const [nombre, ancho, movil, esperadas] of [
    ['escritorio', 1280, false, 4],
    ['tableta', 700, false, 3],
    ['móvil', 390, true, 2],
  ]) {
    const { page } = await abrir(ancho, movil)
    const n = await columnas(page)
    check(`en ${nombre} van ${esperadas} por fila`, n === esperadas, `${n} columnas`)
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Y quien mide es el PADRE, no la rejilla ──')
{
  // Un elemento no puede consultarse a sí mismo con `@container`. La
  // rejilla llevaba el `container-type` y sus propios breakpoints, así
  // que ninguno se aplicaba nunca — y no se notaba porque `auto-fill`
  // adaptaba las columnas por su cuenta. Al fijar el número de columnas,
  // el fallo salió a la primera.
  const css = readFileSync('/home/user/pingu/css/carta.css', 'utf8')
  check('el contenedor es la caja de fuera',
    /\.coleccion-medida \{\s*container-type: inline-size;/.test(css))
  check('…y la rejilla ya no se mide a sí misma',
    !/\.coleccion-rejilla \{[^}]*container-type/.test(css))
  const { page } = await abrir(1280, false)
  check('la caja existe en la página', (await page.locator('.coleccion-medida .coleccion-rejilla').count()) === 1)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Y el logo del set en la cabecera ──')
{
  const { page } = await abrir(1280, false)
  check('sale el logo', (await page.locator('.coleccion-logo').count()) === 1)
  check('…de la ruta que guarda el importador',
    ((await page.locator('.coleccion-logo').getAttribute('src')) || '').includes('me/me05/logo'),
    await page.locator('.coleccion-logo').getAttribute('src'))
  // Y sin logo la cabecera no deja un hueco roto: media colección no
  // tiene ninguno.
  await page.close()
  const p2 = await browser.newPage()
  await p2.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv4', name: 'Sin logo', market: 'WEST', card_count_official: 1 }]
    window.__FAKE_CARTAS__ = [{ id: 'sv4-1', set_id: 'sv4', market: 'WEST', local_id: '1', name: 'Una', image_path: 'x/y/1' }]
  })
  await p2.goto(`${BASE}/coleccion/sv4`, { waitUntil: 'domcontentloaded' })
  await p2.waitForTimeout(2200)
  check('un set sin logo no deja hueco', (await p2.locator('.coleccion-logo').count()) === 0)
  check('…y sí su nombre', (await p2.locator('h1').first().textContent()) === 'Sin logo')
  await p2.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
