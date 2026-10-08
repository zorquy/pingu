// Tanda 779 — «separar variantes» donde se pintan cartas del catálogo.
//
// PINGU: «debería estar disponible ese filtro de variantes siempre, en
// todos los lados donde se debería mostrar». Estaba en una expansión y en
// la ficha de una especie de la Pokédex; faltaba en BUSCAR, que es donde se
// buscan las cartas sueltas (y donde se elige la carta de un bolsillo o la
// que se pone para cambio). Y cambiar de catálogo devolvía las variantes a
// «juntas» y se olvidaba de la vista, aunque las dos se guardan.
//
// Lo que se mira: el botón está en Buscar y dice su estado; separadas, cada
// versión es un resultado con su chapa, su velo (solo la reverse) y su ✓;
// es la MISMA memoria que la expansión (se separa en un sitio y se ve
// separado en el otro); y cambiar de catálogo no la olvida.
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs"

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

// ── LOS MANDOS DE LA CABECERA VIVEN DETRÁS DEL ⋮ (tanda 475) ──
// Encontrar un elemento no es poder pulsarlo, así que hay que abrir el menú
// primero. Y se cierra solo al elegir, así que cada pulsación abre otra vez.
const porElMenu = async (page, sel) => {
  await page.click('#mcAlbumMenu > summary')
  await page.waitForTimeout(250)
  await page.click(sel)
  await page.waitForTimeout(350)
}
const browser = await chromium.launch()
const SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'

const abrir = async ({ ancho = 1280, ruta = '/mi-coleccion.html?ver=album' } = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1000 }, hasTouch: ancho < 600, isMobile: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  // Una captura con los datos a medias no es la pantalla (la 441).
  await page.route('**assets.tcgdex.net/**', (r) => r.fulfill({ path: SC + '/visual/carta.png', contentType: 'image/png' }))
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Mega Evolution', serie_id: 'sv', market: 'WEST',
      card_count_official: 12, card_count_total: 12, logo_path: 'x/l', release_date: '2026-09-26', tcg_online_code: 'MEE' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 12 }, (_, i) => ({
      id: 'sv8-' + (i + 1), market: 'WEST', set_id: 'sv8', local_id: String(i + 1),
      name: 'Bulbasaur ' + (i + 1), image_path: 'x/' + (i + 1), rarity: 'Common',
      category: 'Pokemon', types: ['Grass'], dex_ids: [1], variants: { normal: true, reverse: true },
    }))
    window.__FAKE_COLECCION__ = [
      { id: 'l1', card_id: 'sv8-1', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', created_at: '2026-09-01T00:00:00Z' },
      { id: 'l2', card_id: 'sv8-2', market: 'WEST', cantidad: 2, idioma: 'es', estado: 'NM', variante: 'reverse', created_at: '2026-09-02T00:00:00Z' },
      { id: 'l3', card_id: 'sv8-3', market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM', variante: 'holo', created_at: '2026-09-03T00:00:00Z' },
    ]
  })
  await page.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, errores }
}
const abrirSet = async (page) => {
  await page.locator('.mc-set-tarjeta').first().click()
  await page.waitForTimeout(1300)
}

const buscar = async (page, texto) => {
  await page.click('#mcMenu [data-pestania="buscar"]').catch(() => {})
  await page.waitForTimeout(500)
  await page.fill('#mcBuscarTodo', texto)
  await page.waitForTimeout(1400)
}
const resultados = (page) => page.$$eval('#mcBuscarResultados .mc-resultado', (rs) => rs.map((r) => ({
  id: r.dataset.carta, v: r.dataset.variante || null,
  chapa: r.querySelector('.mc-chapa-variante')?.textContent || '',
  velo: Boolean(r.querySelector('.mc-velo-reverse')),
  tengo: r.querySelector('.mc-tengo-marca')?.textContent || '',
})))

for (const ancho of [390, 1280]) {
  console.log(`\n── ${ancho} px ──`)
  const { page, errores } = await abrir({ ancho, ruta: '/mi-coleccion.html?ver=buscar' })
  await buscar(page, 'bulbasaur')
  const boton = page.locator('#mcBuscarVariantes')
  check('Buscar tiene el botón, y dice «juntas»', (await boton.isVisible()) && (await boton.textContent()) === 'Variantes juntas' && (await boton.getAttribute('aria-pressed')) === 'false')
  let r = await resultados(page)
  check('juntas: un resultado por carta y sin chapa', r.length === 12 && r.every((x) => !x.v && !x.chapa), `${r.length}`)
  await boton.click()
  await page.waitForTimeout(600)
  r = await resultados(page)
  check('separadas: uno por versión (24)', r.length === 24, `${r.length}`)
  check('  …con su chapa, N y RH', r[0].chapa.startsWith('N') && r[1].chapa.startsWith('RH'), r.slice(0, 2).map((x) => x.chapa).join(' | '))
  check('  …el velo solo en la reverse', r.every((x) => x.velo === (x.v === 'reverse')))
  const bulba2 = r.filter((x) => x.id === 'sv8-2')
  check('  …y el ✓ en la versión que tienes (sv8-2 reverse ×2), no en la otra', bulba2.find((x) => x.v === 'reverse')?.tengo === '×2' && !bulba2.find((x) => x.v === 'normal')?.tengo, JSON.stringify(bulba2))
  check('  …y el botón dice «separadas»', (await boton.textContent()) === 'Variantes separadas' && (await boton.getAttribute('aria-pressed')) === 'true')
  // La misma memoria: la expansión se abre ya separada.
  await page.click('#mcMenu [data-pestania="album"]')
  await page.waitForTimeout(800)
  await abrirSet(page)
  check('la expansión se abre separada (la misma memoria)', (await page.getAttribute('#mcVistaVariantes', 'aria-pressed')) === 'true' && (await page.locator('#mcAlbum .mc-chapa-variante').count()) === 24)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── Cambiar de catálogo no la olvida ──')
{
  const { page, errores } = await abrir({ ruta: '/mi-coleccion.html?ver=album' })
  await abrirSet(page)
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(600)
  const vista = await page.evaluate(() => localStorage.getItem('mc-album-vista'))
  // Al japonés y de vuelta, SIN recargar: con el selector de catálogo, que
  // es el camino que devolvía las variantes a «juntas» (la memoria la lee
  // el arranque, así que recargar no lo vería).
  const cambiar = (m) => page.evaluate((m) => {
    const s = [...document.querySelectorAll('select.mc-mercado')].find((x) => x.offsetParent) || document.querySelector('select.mc-mercado')
    s.value = m
    s.dispatchEvent(new Event('change', { bubbles: true }))
    return s.value
  }, m)
  const cambio = `${await cambiar('ja')}→`
  await page.waitForTimeout(1500)
  const cambio2 = await cambiar('es')
  await page.waitForTimeout(1800)
  const sel = cambio2 === 'es'
  // Se mira en Buscar, que se pinta de nuevo al buscar: la expansión abierta
  // se queda con su HTML de antes y no diría nada.
  await buscar(page, 'bulbasaur')
  const r = await resultados(page)
  check('de vuelta al occidental, sigue separada (24 resultados con chapa)', sel && r.length === 24 && r.every((x) => x.chapa), `${cambio}${sel} ${r.length}`)
  check('  …y el botón de Buscar lo dice', (await page.textContent('#mcBuscarVariantes')) === 'Variantes separadas')
  check('  …y la vista es la misma', (await page.evaluate(() => localStorage.getItem('mc-album-vista'))) === vista)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}
await browser.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
