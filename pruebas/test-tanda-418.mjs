// Tanda 418 — la ficha se abre en la ventana, y los mandos del
// archivador a los lados.
//
// PINGU: «en una expansión, cuando clicas en una carta te lleva a la
// ficha completa, pero debería ser igual que en la Pokédex y en todo lo
// que tenemos en mi colección: que te abra el pop-up con toda la info y
// después un botón para ir a la ficha completa»; «los botones de anterior
// y siguiente deberían ir a la izquierda y a la derecha, y las páginas
// quizá abajo»; «los botones de una por carta y una por versión yo los
// pondría a juntar variantes y separar variantes, así queda más claro».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const browser = await chromium.launch()
const abrir = async (ruta = '/mi-coleccion.html?ver=album') => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Scarlet & Violet', serie_id: 'sv', serie_name: 'EP',
      market: 'WEST', card_count_official: 30, card_count_total: 30, release_date: '2023-03-31', logo_path: 'x/l' }]
    // Treinta para que el archivador tenga MÁS de dos pliegos: con dos,
    // los dos se ven a la vez y la flecha de «siguiente» se apaga con
    // razón. Y la primera se llama Bulbasaur para que la Pokédex la
    // reconozca: una carta llamada «Carta 1» no es de ninguna especie.
    window.__FAKE_CARTAS__ = Array.from({ length: 30 }, (_, i) => ({ id: 'sv1-' + (i + 1), set_id: 'sv1',
      local_id: String(i + 1), name: i === 0 ? 'Bulbasaur' : 'Carta ' + (i + 1), image_path: 'x/' + i,
      market: 'WEST', rarity: 'Common', category: 'Pokemon', illustrator: 'kawayoo', variants: { normal: true } }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.slice(0, 3).map((c, i) => ({ id: 'l' + i,
      card_id: c.id, cantidad: 1, idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
  })
  await page.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2500)
  return { page, errores }
}

console.log('\n── 1. Al pulsar una carta se abre la ventana, no la página ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.locator('[data-set="sv1"]').click()
  await page.waitForTimeout(900)
  await page.locator('.mc-bolsillo-enlace').first().click()
  await page.waitForTimeout(700)
  const tuya = await page.evaluate(() => ({
    abierto: document.getElementById('mcEditor').open,
    copia: !document.getElementById('mcEdCopiaBloque').classList.contains('hidden'),
    anadir: document.getElementById('mcEdCopiaBloque').classList.contains('hidden') && !document.getElementById('mcEdAcciones').classList.contains('hidden'),
    ruta: location.pathname,
  }))
  check('una que tienes abre la ficha', tuya.abierto && tuya.copia && !tuya.anadir, JSON.stringify(tuya))
  check('  …sin irse de la página', tuya.ruta === '/mi-coleccion.html', tuya.ruta)
  // El enlace se queda puesto A PROPÓSITO: con el botón de en medio o con
  // Ctrl sigue abriendo la página entera, que es lo que espera cualquiera
  // de un enlace. Lo que cambia es el clic normal.
  check('  …y el enlace a la página sigue estando',
    Boolean(await page.locator('.mc-bolsillo-enlace').first().getAttribute('href')))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)

  // Y una que NO tienes: no hay línea que editar, así que en vez del
  // bloque de «tu copia» sale el de añadirla.
  await page.locator('.mc-bolsillo-enlace').nth(8).click()
  await page.waitForTimeout(700)
  const ajena = await page.evaluate(() => ({
    copia: !document.getElementById('mcEdCopiaBloque').classList.contains('hidden'),
    // Desde la 650 «se puede añadir» es: sin bloque de tu copia y con el «+».
    anadir: document.getElementById('mcEdCopiaBloque').classList.contains('hidden') && !document.getElementById('mcEdAcciones').classList.contains('hidden'),
    titulo: document.getElementById('mcEditorTitulo').textContent,
    ficha: document.getElementById('mcEdFicha').getAttribute('href'),
  }))
  check('una que no tienes también abre la ficha', ajena.anadir && !ajena.copia, JSON.stringify(ajena))
  // LA FORMA DEL FALLO: `cartas` es el mapa de TU colección, así que una
  // carta que no tienes no está. Sin buscarla donde esté a la vista, la
  // ventana salía con el nombre y el enlace de OTRA carta.
  check('  …con SU nombre', ajena.titulo === 'Carta 9', ajena.titulo)
  check('  …y con SU enlace a la página entera', /sv1-9/.test(ajena.ficha || ''), ajena.ficha)
  // Desde la 650: el «+» de debajo de la carta, el diálogo y Guardar.
  await page.click('#mcEdMas')
  await page.waitForTimeout(400)
  if (await page.locator('#mcAdMas').isVisible()) { await page.click('#mcAdMas'); await page.waitForTimeout(200) }
  await page.click('#mcAdGuardar')
  await page.waitForTimeout(900)
  const tras = await page.evaluate(() => ({
    copia: !document.getElementById('mcEdCopiaBloque').classList.contains('hidden'),
    anadir: document.getElementById('mcEdCopiaBloque').classList.contains('hidden'),
  }))
  // La ficha se queda abierta, ya como TUYA: lo que se acaba de hacer es
  // tener la carta, no cerrar una ventana.
  check('al añadirla, la ficha pasa a ser la tuya', tras.copia && !tras.anadir, JSON.stringify(tras))
  await page.close()
}

console.log('\n── 2. En la Pokédex, igual ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=pokedex')
  await page.locator('[data-dex]').first().click()
  await page.waitForTimeout(1200)
  const hay = await page.locator('.pdx-carta').count()
  if (!hay) {
    check('hay cartas de esa especie', false, 'ninguna')
  } else {
    await page.locator('.pdx-carta').first().click()
    await page.waitForTimeout(700)
    check('también abre la ficha', await page.locator('#mcEditor').evaluate((e) => e.open))
    check('  …sin irse de la página', (await page.evaluate(() => location.pathname)) === '/mi-coleccion.html')
  }
  await page.close()
}

console.log('\n── 3. Los nombres de las dos vistas ──')
{
  const { page } = await abrir()
  await page.locator('[data-set="sv1"]').click()
  await page.waitForTimeout(800)
  // «Una por carta / una por versión» decía el RESULTADO y había que
  // pensarlo; «juntar / separar» dice lo que hace.
  // EL VOCABULARIO SIGUE SIENDO EL DE LA 418 —juntar/separar, no «una por
  // carta»—, pero desde la tanda 473 es UN botón y dice el ESTADO: un
  // control que guarda un estado tiene que decir el estado, o hay que
  // pulsarlo para saber qué tenías puesto.
  const rotulo = () => page.locator('#mcVistaVariantes').textContent().then((t) => t.trim())
  check('dice cómo están las variantes', (await rotulo()) === 'Variantes juntas', await rotulo())
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(700)
  check('  …y al separarlas lo dice', (await rotulo()) === 'Variantes separadas', await rotulo())
  await page.close()
}

console.log('\n── 4. El archivador del álbum: flechas a los lados ──')
{
  const { page, errores } = await abrir('/mi-coleccion.html?ver=carpetas')
  await page.locator('#mcAlbNuevoAbrir').click()
  await page.waitForTimeout(700)
  await page.fill('#mcDlgNombre', 'Álbum')
  await page.selectOption('#mcAlbOrigen', 'set')
  await page.waitForTimeout(300)
  await page.locator('#mcDlgGuardar').click()
  await page.waitForTimeout(1800)
  const sitio = await page.evaluate(() => {
    const caja = document.querySelector('.mc-archivador-caja')
    const der = document.getElementById('mcAlbSiguiente')
    const paginas = document.querySelector('.mc-album-paginas')
    if (!caja || !der || !paginas) return null
    const c = caja.getBoundingClientRect()
    const d = der.getBoundingClientRect()
    return { flechaFija: getComputedStyle(der).position, aLaDerecha: d.left > c.left + c.width / 2,
      paginasDebajo: paginas.getBoundingClientRect().top > c.top }
  })
  check('la flecha va al lado del archivador', sitio?.flechaFija === 'absolute' && sitio.aLaDerecha,
    JSON.stringify(sitio))
  check('  …y las páginas, debajo', sitio?.paginasDebajo === true, JSON.stringify(sitio))
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
