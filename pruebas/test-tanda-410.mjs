// Tanda 410 — el panel, con la tira de tarjetas.
//
// PINGU: «el panel está desordenadísimo, lo de los cambios está ahí
// abajo, es demasiado scroll para lo que es. Reordénalo, que tenga
// sentido. Fíjate en Dex: te pone slides con toda la info, y le das a ver
// todo y te saca todas las estadísticas».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const browser = await chromium.launch()

const abrir = async (ancho = 1280, alto = 950) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: alto } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'XY Promos', market: 'WEST', card_count_official: 100,
      card_count_total: 110, release_date: '2016-05-18', logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = Array.from({ length: 6 }, (_, i) => ({ id: 'sv1-' + i, set_id: 'sv1',
      local_id: String(i), name: 'Carta ' + i, image_path: 'x/' + i, market: 'WEST',
      rarity: i % 2 ? 'Rare' : 'Common', category: 'Pokemon', variants: { normal: true } }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({ id: 'l' + i, card_id: c.id,
      cantidad: (i % 3) + 1, idioma: 'es', estado: 'NM', variante: 'normal', notas: null }))
  })
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=resumen', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}

// LA TIRA YA NO EXISTE, Y ES A PROPÓSITO (tanda 440). Esta sección
// defendía un carrusel deslizable con enganche; la 440 lo cambió por una
// REJILLA porque las diapositivas llevan CIFRAS, y una cifra cortada por
// el borde de la pantalla se lee como un fallo. Lo que sigue en pie es que
// las tarjetas estén y se puedan ver enteras, y eso es lo que se mira
// ahora. (Esta prueba llevaba roja desde la 440 sin que nadie la mirara:
// es uno de los once de la 447.)
console.log('\n── 1. Las diapositivas, en rejilla ──')
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Con este fixture no hay precios, así que «Las que más valen» no se
  // pinta: una diapositiva vacía no informa. Lo que tiene que estar es lo
  // que SÍ se puede calcular sin precios.
  const titulos = await page.locator('.mc-diapo h3, .mc-diapo h4').allTextContents()
  for (const t of ['Lo que te costó', 'Lo que te sobra', 'Por rareza']) {
    check(`está «${t}»`, titulos.some((x) => x.trim() === t), titulos.join(' | '))
  }
  check('y no queda ninguna tira deslizable, que es lo que quitó la 440',
    (await page.locator('#mcTira').count()) === 0)
  // Y se ven ENTERAS: lo que la 440 arreglaba es que una cifra no se corte
  // por el borde. En una rejilla eso significa que ninguna tarjeta se sale
  // de su contenedor.
  const sobresalen = await page.locator('.mc-diapos').evaluate((caja) => {
    const c = caja.getBoundingClientRect()
    return [...caja.children].filter((n) => n.getBoundingClientRect().right > c.right + 1).length
  })
  check('  …y ninguna se sale por el borde', sobresalen === 0, String(sobresalen))
}

console.log('\n── 2. Lo largo, detrás de un botón ──')
{
  const { page } = await abrir()
  const escondidas = () => page.locator('#mcEstadisticas').evaluate((e) => e.classList.contains('hidden'))
  check('las estadísticas no están de entrada', await escondidas())
  // Pero la GRÁFICA del valor sí (tanda 416). La 410 la metió aquí
  // dentro y PINGU: «¿y dónde está el gráfico de precios? No existe».
  // Es la única cifra que cambia sola y es la que se viene a mirar;
  // detrás de un botón, no existe.
  check('  …pero la gráfica del valor sí', await page.locator('#mcValorCaja').isVisible())
  check('  …y está FUERA del bloque que se esconde',
    await page.locator('#mcValorCaja').evaluate((e) => !e.closest('#mcEstadisticas')))
  check('  …y el botón lo dice', (await page.locator('#mcVerTodo').getAttribute('aria-expanded')) === 'false')
  await page.locator('#mcVerTodo').click()
  await page.waitForTimeout(600)
  check('al pulsar, salen', (await escondidas()) === false)
  check('  …y son las cuatro cajas de siempre',
    (await page.locator('#mcEstadisticas .mc-resumen-caja').count()) === 4,
    await page.locator('#mcEstadisticas .mc-resumen-caja').count())
  await page.locator('#mcVerTodo').click()
  await page.waitForTimeout(400)
  check('  …y se vuelven a esconder', await escondidas())
  await page.close()
}

console.log('\n── 3. Los cambios ya no están al fondo ──')
{
  // Era la queja: «lo de los cambios está ahí abajo, es demasiado scroll
  // para lo que es». Se mide dónde empiezan, no cuántas secciones hay
  // antes: lo que molesta es el desplazamiento.
  const { page } = await abrir()
  const y = await page.evaluate(() => {
    const p = document.getElementById('mcPanelResumen').getBoundingClientRect().top
    const c = document.getElementById('mcBloqueCambios').getBoundingClientRect().top
    return Math.round(c - p)
  })
  check('los cambios empiezan en la primera pantalla', y < 700, `${y} px por debajo del panel`)
  await page.close()
}

console.log('\n── 4. En el móvil ──')
{
  const { page, errores } = await abrir(390, 820)
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Una tarjeta no puede ser más ancha que la pantalla: si lo fuera, la
  // tira dejaría de deslizarse y pasaría a desbordar la página.
  const r = await page.evaluate(() => {
    const d = document.querySelector('.mc-diapo').getBoundingClientRect()
    return { tarjeta: Math.round(d.width), ventana: innerWidth, scroll: document.documentElement.scrollWidth }
  })
  check('la tarjeta cabe en la pantalla', r.tarjeta < r.ventana, JSON.stringify(r))
  check('  …y la página no se desplaza a lo ancho', r.scroll <= r.ventana, JSON.stringify(r))
  await page.close()
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
